import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { logActivity } from '@/lib/activity-log'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/common/EmptyState'
import { LoadingState } from '@/components/common/LoadingState'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import { CalendarDays } from 'lucide-react'
import { toast } from 'sonner'
import { sendEmail } from '@/lib/send-email'
import { format } from 'date-fns'
import { fr, enUS } from 'date-fns/locale'
import type { Booking } from '@/types'

/** Nature d'une réservation dans la liste. */
type BookingKind = 'upcoming' | 'past' | 'cancelled'

export function MyBookingsPage() {
  const { t, i18n } = useTranslation()
  const { user, profile } = useAuth()
  const locale = i18n.language === 'fr' ? fr : enUS
  const isFr = i18n.language === 'fr'
  const [bookings, setBookings] = useState<Booking[]>([])
  const [loading, setLoading] = useState(true)
  const [cancelId, setCancelId] = useState<string | null>(null)
  const [cancellationHours, setCancellationHours] = useState(12)
  /** Natures affichées. Les trois par défaut : la liste montre tout. */
  const [filters, setFilters] = useState<BookingKind[]>(['upcoming', 'past', 'cancelled'])

  useEffect(() => {
    if (!user) return

    // Fetch cancellation deadline from booking_rules
    supabase.from('app_settings').select('value').eq('key', 'booking_rules').single()
      .then(({ data }) => {
        if (data?.value?.cancellation_free_hours !== undefined) {
          setCancellationHours(data.value.cancellation_free_hours as number)
        }
      })

    const fetchBookings = async () => {
      const { data } = await supabase
        .from('bookings')
        .select('*, scheduled_class:scheduled_classes(*, class_type:class_types(*)), pack_purchase:pack_purchases(id, credits_remaining, expires_at, pack_type:pack_types(name, is_unlimited))')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

      const rawBookings = (data as Booking[]) ?? []

      // Resolve coach profiles
      const coachIds = [...new Set(rawBookings.map(b => (b.scheduled_class as any)?.coach_id).filter(Boolean))]
      if (coachIds.length > 0) {
        const { data: coaches } = await supabase.from('profiles').select('id, display_name').in('id', coachIds)
        const coachMap = new Map((coaches ?? []).map(c => [c.id, c]))
        for (const b of rawBookings) {
          if (b.scheduled_class) {
            (b.scheduled_class as any).coach = coachMap.get((b.scheduled_class as any).coach_id)
          }
        }
      }

      setBookings(rawBookings)
      setLoading(false)
    }
    fetchBookings()
  }, [user])

  const handleCancel = async (bookingId: string) => {
    if (!user) return
    const booking = bookings.find(b => b.id === bookingId)

    // Si le cours a été modifié après la réservation, le membre renonce à
    // une prestation qu'il n'avait pas choisie : son crédit lui revient quel
    // que soit le délai. La fonction refuse d'elle-même si le cours n'a pas
    // été modifié, on retombe alors sur l'annulation ordinaire.
    const { data: declined } = await supabase.rpc('decline_modified_booking', {
      p_booking_id: bookingId,
    })

    if ((declined as { ok?: boolean } | null)?.ok) {
      toast.success(isFr
        ? 'Réservation annulée — ton crédit t\'a été restitué.'
        : 'Booking cancelled — your credit has been refunded.')
      setBookings(prev => prev.filter(b => b.id !== bookingId))
      return
    }

    // Use server-side cancel with conditional refund
    const { data: result, error } = await supabase.rpc('cancel_booking_v2', {
      p_booking_id: bookingId,
      p_user_id: user.id,
    })

    if (error) {
      toast.error(error.message)
    } else {
      const refunded = result?.refunded as boolean
      const hoursBefore = result?.hours_before as number

      if (user && booking) {
        await logActivity({
          action: 'booking_cancelled',
          actor_id: user.id,
          target_user_id: user.id,
          entity_type: 'booking',
          entity_id: bookingId,
          details: {
            class_name: booking.scheduled_class?.class_type?.name,
            starts_at: booking.scheduled_class?.starts_at,
            refunded,
            hours_before: hoursBefore,
          },
          description: `Annulation${refunded ? '' : ' tardive'}: ${booking.scheduled_class?.class_type?.name} du ${booking.scheduled_class ? format(new Date(booking.scheduled_class.starts_at), 'dd/MM/yyyy HH:mm') : '?'}`,
        })
      }

      setBookings((prev) =>
        prev.map((b) => (b.id === bookingId ? { ...b, status: 'cancelled' as const, cancelled_at: new Date().toISOString() } : b))
      )

      // Email (self-cancel, optional)
      if (profile?.email_on_self_booking && user.email && booking?.scheduled_class) {
        const sc = booking.scheduled_class
        sendEmail('booking_cancelled_by_self', user.email, {
          user_name: profile.display_name,
          class_name: sc.title || sc.class_type?.name,
          class_date: format(new Date(sc.starts_at), "EEEE dd MMMM 'à' HH:mm", { locale: fr }),
          coach_name: sc.coach?.display_name,
          duration_minutes: sc.duration_minutes,
          refunded,
        })
      }

      // Sur un pack illimité, aucun crédit n'a été décompté à la réservation :
      // parler de restitution n'aurait aucun sens.
      const packType = booking?.pack_purchase?.pack_type
      const packName = packType?.name
      const packSuffix = packName ? ` (${packName})` : ''

      if (packType?.is_unlimited) {
        toast.success(isFr
          ? `Réservation annulée${packSuffix} — accès illimité, aucun crédit décompté`
          : `Booking cancelled${packSuffix} — unlimited access, no credit deducted`)
      } else if (refunded) {
        toast.success(isFr
          ? `Réservation annulée${packSuffix} — crédit restitué`
          : `Booking cancelled${packSuffix} — credit refunded`)
      } else {
        toast.warning(isFr
          ? `Annulation tardive (${hoursBefore}h avant)${packSuffix} — crédit non restitué`
          : `Late cancellation (${hoursBefore}h before)${packSuffix} — credit not refunded`)
      }
    }
    setCancelId(null)
  }

  if (loading) return <LoadingState />

  const now = new Date()

  /**
   * Nature d'une réservation. Un no-show garde status='confirmed' en base,
   * d'où le test explicite avant celui sur la date.
   */
  const kindOf = (b: Booking): BookingKind => {
    if (b.status === 'cancelled' || b.is_no_show) return 'cancelled'
    return new Date(b.scheduled_class?.starts_at ?? '') > now ? 'upcoming' : 'past'
  }

  const counts = {
    upcoming: bookings.filter(b => kindOf(b) === 'upcoming').length,
    past: bookings.filter(b => kindOf(b) === 'past').length,
    cancelled: bookings.filter(b => kindOf(b) === 'cancelled').length,
  }

  // Liste unique : filtrée par nature, puis triée du plus récent au plus
  // ancien. Les séances à venir restent en tête, dans l'ordre chronologique.
  const visible = bookings
    .filter(b => filters.includes(kindOf(b)))
    .sort((a, b) => {
      const ka = kindOf(a), kb = kindOf(b)
      if (ka === 'upcoming' && kb !== 'upcoming') return -1
      if (kb === 'upcoming' && ka !== 'upcoming') return 1
      const ta = new Date(a.scheduled_class?.starts_at ?? '').getTime()
      const tb = new Date(b.scheduled_class?.starts_at ?? '').getTime()
      return ka === 'upcoming' ? ta - tb : tb - ta
    })

  /**
   * Regroupe des réservations par pack d'origine, packs les plus récents en
   * tête. Sur un abonnement reconduit toutes les 4 semaines, chaque cycle est
   * un pack distinct : le regroupement rend visible « ce que j'ai consommé sur
   * l'abonnement en cours » plutôt qu'une liste indifférenciée.
   */
  const groupByPack = (list: Booking[]) => {
    const groups = new Map<string, { pack: Booking['pack_purchase']; items: Booking[] }>()
    for (const b of list) {
      const key = b.pack_purchase_id ?? 'none'
      if (!groups.has(key)) groups.set(key, { pack: b.pack_purchase, items: [] })
      groups.get(key)!.items.push(b)
    }
    return [...groups.values()].sort((a, b) => {
      const da = a.pack?.expires_at ? new Date(a.pack.expires_at).getTime() : 0
      const db = b.pack?.expires_at ? new Date(b.pack.expires_at).getTime() : 0
      return db - da
    })
  }

  /** En-tête d'un groupe : nom du pack, période, et ce qu'il en reste. */
  const PackGroupHeader = ({ pack, count }: { pack: Booking['pack_purchase']; count: number }) => {
    if (!pack?.pack_type) {
      return (
        <h3 className="text-sm font-semibold text-muted-foreground mt-4 mb-2">
          {isFr ? 'Sans pack' : 'No pack'} ({count})
        </h3>
      )
    }
    const isUnlimited = pack.pack_type.is_unlimited
    const isActive = new Date(pack.expires_at) > now
    return (
      <div className="mt-4 mb-2 flex items-center gap-2 flex-wrap">
        <h3 className="text-sm font-semibold">{pack.pack_type.name}</h3>
        {isActive && (
          <Badge variant="default" className="text-[10px]">
            {isFr ? 'En cours' : 'Current'}
          </Badge>
        )}
        <span className="text-xs text-muted-foreground">
          {isFr ? "jusqu'au" : 'until'} {format(new Date(pack.expires_at), 'dd/MM/yyyy', { locale })}
          {' · '}
          {/* Nombre d'éléments AFFICHÉS : dépend des filtres actifs */}
          {count} {isFr ? (count > 1 ? 'lignes' : 'ligne') : count > 1 ? 'entries' : 'entry'}
          {!isUnlimited && (
            <> · {pack.credits_remaining} {isFr ? 'crédit(s) restant(s)' : 'credit(s) left'}</>
          )}
        </span>
      </div>
    )
  }

  const BookingCard = ({ booking }: { booking: Booking }) => (
    <Card>
      <CardContent className="p-4 flex items-center justify-between">
        <div>
          <p className="font-medium">{booking.scheduled_class?.class_type?.name}</p>
          <p className="text-sm text-muted-foreground">
            {format(new Date(booking.scheduled_class?.starts_at ?? ''), 'EEEE dd MMMM, HH:mm', { locale })}
          </p>
          <p className="text-sm text-muted-foreground">
            {t('schedule.coach')}: {booking.scheduled_class?.coach?.display_name}
          </p>
          {/* Contexte d'annulation : quand, et avec quel pack */}
          {booking.status === 'cancelled' && booking.cancelled_at && (() => {
            const startsAt = booking.scheduled_class?.starts_at
            const hoursBefore = startsAt
              ? (new Date(startsAt).getTime() - new Date(booking.cancelled_at).getTime()) / 3600000
              : null
            const isUnlimited = booking.pack_purchase?.pack_type?.is_unlimited
            // Le pack est déjà nommé en en-tête de groupe : pas de répétition ici.
            return (
              <p className="text-xs text-muted-foreground mt-1">
                {isFr ? 'Annulé le' : 'Cancelled'}{' '}
                {format(new Date(booking.cancelled_at), 'dd/MM/yyyy HH:mm', { locale })}
                {hoursBefore !== null && (
                  <> · {Math.round(hoursBefore)} h {isFr ? 'avant' : 'before'}</>
                )}
                {hoursBefore !== null && hoursBefore < cancellationHours && !isUnlimited && (
                  <span className="text-amber-600 dark:text-amber-400">
                    {' '}· {isFr ? 'crédit non restitué' : 'credit not refunded'}
                  </span>
                )}
              </p>
            )
          })()}
        </div>
        <div className="flex items-center gap-2">
          {/* Les natures étant mélangées dans la liste, chaque carte l'affiche */}
          {booking.is_no_show ? (
            <Badge variant="destructive">{isFr ? 'Absent' : 'No-show'}</Badge>
          ) : booking.status === 'cancelled' ? (
            <Badge variant="secondary">{isFr ? 'Annulée' : 'Cancelled'}</Badge>
          ) : kindOf(booking) === 'upcoming' ? (
            <Badge variant="default">{isFr ? 'À venir' : 'Upcoming'}</Badge>
          ) : (
            <Badge variant="outline">{isFr ? 'Passée' : 'Past'}</Badge>
          )}
          {booking.status === 'confirmed' && new Date(booking.scheduled_class?.starts_at ?? '') > now && (() => {
            const startsAt = new Date(booking.scheduled_class?.starts_at ?? '')
            const hoursUntil = (startsAt.getTime() - now.getTime()) / (1000 * 60 * 60)
            const isFreeCancel = hoursUntil >= cancellationHours

            return (
              <div className="flex flex-col items-end gap-1">
                <Button variant="outline" size="sm" onClick={() => setCancelId(booking.id)}>
                  {t('bookings.cancel')}
                </Button>
                {/* Sans objet sur un illimité : aucun crédit n'est en jeu */}
                {!isFreeCancel && !booking.pack_purchase?.pack_type?.is_unlimited && (
                  <span className="text-[11px] text-amber-600 dark:text-amber-400 max-w-[160px] text-right">
                    {isFr
                      ? `Crédit non restitué (< ${cancellationHours}h)`
                      : `Credit not refunded (< ${cancellationHours}h)`}
                  </span>
                )}
              </div>
            )
          })()}
        </div>
      </CardContent>
    </Card>
  )

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">{t('bookings.title')}</h1>

      {/* Filtres : liste unique, on choisit ce qu'on veut voir */}
      <div className="flex gap-2 flex-wrap">
        {([
          { key: 'upcoming' as const, label: t('bookings.upcoming'), count: counts.upcoming },
          { key: 'past' as const, label: t('bookings.past'), count: counts.past },
          { key: 'cancelled' as const, label: isFr ? 'Annulations' : 'Cancellations', count: counts.cancelled },
        ]).map(f => {
          const active = filters.includes(f.key)
          return (
            <Button
              key={f.key}
              size="sm"
              variant={active ? 'default' : 'outline'}
              className="rounded-full h-8 text-xs"
              onClick={() =>
                setFilters(prev =>
                  // Ne jamais tout décocher : la liste resterait vide sans raison.
                  prev.includes(f.key)
                    ? (prev.length > 1 ? prev.filter(k => k !== f.key) : prev)
                    : [...prev, f.key]
                )
              }
            >
              {f.label} ({f.count})
            </Button>
          )
        })}
      </div>

      {/* Liste unique, groupée par pack */}
      <div className="space-y-2">
        {visible.length === 0 ? (
          <EmptyState icon={CalendarDays} message={t('bookings.noBookings')} />
        ) : (
          groupByPack(visible).map((g, i) => (
            <div key={g.pack?.id ?? `none-${i}`}>
              <PackGroupHeader pack={g.pack} count={g.items.length} />
              <div className="space-y-2">
                {g.items.map((b) => <BookingCard key={b.id} booking={b} />)}
              </div>
            </div>
          ))
        )}
      </div>

      <ConfirmDialog
        open={!!cancelId}
        onOpenChange={() => setCancelId(null)}
        title={t('bookings.cancel')}
        description={t('bookings.cancelConfirm')}
        onConfirm={() => cancelId && handleCancel(cancelId)}
      />
    </div>
  )
}

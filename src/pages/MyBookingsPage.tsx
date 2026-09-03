import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { logActivity } from '@/lib/activity-log'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { BoutonAgenda } from '@/components/common/BoutonAgenda'
import { loadStudioLegal } from '@/lib/studio-legal'
import { EmptyState } from '@/components/common/EmptyState'
import { LoadingState } from '@/components/common/LoadingState'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { CalendarDays, Star } from 'lucide-react'
import { toast } from 'sonner'
import { notifyMember } from '@/lib/notify-member'
import { flushEmailQueue } from '@/lib/flush-email-queue'
import { format } from 'date-fns'
import { fr, enUS } from 'date-fns/locale'
import type { Booking } from '@/types'

/** Nature d'une réservation dans la liste. */
type BookingKind = 'upcoming' | 'past' | 'cancelled'

/** L'avis déposé par le membre sur une de ses séances. */
interface MyReview {
  booking_id: string
  rating: number
  comment: string | null
  /** La fenêtre de notation est-elle encore ouverte ? Calculé en base. */
  editable: boolean
}

export function MyBookingsPage() {
  const { t, i18n } = useTranslation()
  const { user, profile } = useAuth()
  const locale = i18n.language === 'fr' ? fr : enUS
  const isFr = i18n.language === 'fr'
  const [bookings, setBookings] = useState<Booking[]>([])
  const [loading, setLoading] = useState(true)
  const [cancelId, setCancelId] = useState<string | null>(null)
  const [cancellationHours, setCancellationHours] = useState(12)
  const [adresseStudio, setAdresseStudio] = useState<string | null>(null)
  /**
   * Natures affichées. **Les séances à venir seulement**, au départ.
   *
   * Les trois natures étaient cochées d'entrée, si bien qu'un membre de longue
   * date ouvrait sa page sur des mois d'historique et devait chercher sa
   * prochaine séance au milieu. Or c'est elle qu'on vient voir. Le passé et
   * les annulations restent à un clic.
   */
  const [filters, setFilters] = useState<BookingKind[]>(['upcoming'])
  /** Les avis déposés, par réservation — pour les relire depuis l'historique. */
  const [myReviews, setMyReviews] = useState<Map<string, MyReview>>(new Map())
  /** Avis en cours de correction. */
  const [editReview, setEditReview] = useState<MyReview | null>(null)
  const [editRating, setEditRating] = useState(0)
  const [editComment, setEditComment] = useState('')
  const [savingReview, setSavingReview] = useState(false)
  /** Réservation dont l'avis est sur le point d'être retiré. */
  const [deleteReviewId, setDeleteReviewId] = useState<string | null>(null)

  // Relisable à la demande : après un refus serveur, l'écran doit repartir de
  // l'état réel plutôt que de sa version optimiste.
  const fetchBookings = useCallback(async () => {
    if (!user) return
    {
      const { data } = await supabase
        .from('bookings')
        .select('*, scheduled_class:scheduled_classes(*, class_type:class_types(*)), pack_purchase:pack_purchases(id, credits_remaining, expires_at, pack_type:pack_types(name, is_unlimited))')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

      const rawBookings = (data as Booking[]) ?? []

      // Resolve coach profiles
      const coachIds = [...new Set(rawBookings.map(b => b.scheduled_class?.coach_id).filter(Boolean))]
      if (coachIds.length > 0) {
        const { data: coaches } = await supabase.from('profils_publics').select('id, display_name').in('id', coachIds)
        const coachMap = new Map((coaches ?? []).map(c => [c.id, c]))
        for (const b of rawBookings) {
          if (b.scheduled_class?.coach_id) {
            b.scheduled_class.coach = coachMap.get(b.scheduled_class.coach_id)
          }
        }
      }

      setBookings(rawBookings)
      setLoading(false)
    }

    // Les avis déjà déposés, pour les afficher sous les séances concernées.
    // Rechargés avec la liste : après un dépôt, l'historique doit suivre.
    const { data: reviews, error } = await supabase.rpc('my_class_reviews')
    if (error) console.error('[reviews] mine', error)
    setMyReviews(new Map(((reviews as MyReview[]) ?? []).map(r => [r.booking_id, r])))
  }, [user])

  // Chargée une fois pour toutes : elle ne sert qu'à renseigner le lieu des
  // entrées d'agenda, et son absence ne doit rien empêcher.
  useEffect(() => {
    loadStudioLegal()
      .then(studio => setAdresseStudio(studio?.address?.trim() || null))
      .catch(() => setAdresseStudio(null))
  }, [])

  useEffect(() => {
    if (!user) return

    // Délai d'annulation gratuite, affiché sur chaque réservation à venir.
    supabase.from('app_settings').select('value').eq('key', 'booking_rules').single()
      .then(({ data }) => {
        if (data?.value?.cancellation_free_hours !== undefined) {
          setCancellationHours(data.value.cancellation_free_hours as number)
        }
      })

    fetchBookings()
  }, [user, fetchBookings])

  /**
   * Ouvre la correction en partant de l'avis existant : on corrige, on ne
   * ressaisit pas. Renseigné ici plutôt que dans un effet — l'état dérive
   * d'un clic, pas d'un rendu.
   */
  const openEditReview = (review: MyReview) => {
    setEditRating(review.rating)
    setEditComment(review.comment ?? '')
    setEditReview(review)
  }

  const handleUpdateReview = async () => {
    if (!editReview || editRating === 0) return
    setSavingReview(true)
    const { data, error } = await supabase.rpc('submit_class_review', {
      p_booking_id: editReview.booking_id,
      p_rating: editRating,
      p_comment: editComment.trim() || null,
    })
    setSavingReview(false)

    if (error) { toast.error(error.message); return }

    // Le refus arrive DANS le retour, sans erreur SQL : sans ce contrôle on
    // afficherait un succès pour un avis non enregistré.
    const res = data as { ok: boolean; reason?: string } | null
    if (!res?.ok) {
      toast.error(res?.reason === 'not_eligible'
        ? (isFr ? 'La période de modification est passée' : 'The editing period has ended')
        : (isFr ? 'Avis non modifié' : 'Review not updated'))
      return
    }

    toast.success(isFr ? 'Avis modifié' : 'Review updated')
    setEditReview(null)
    await fetchBookings()
  }

  const handleDeleteReview = async (bookingId: string) => {
    const { data, error } = await supabase.rpc('delete_class_review', {
      p_booking_id: bookingId,
    })
    setDeleteReviewId(null)

    if (error) { toast.error(error.message); return }

    const res = data as { ok: boolean; reason?: string } | null
    if (!res?.ok) {
      toast.error(res?.reason === 'not_eligible'
        ? (isFr ? 'La période de modification est passée' : 'The editing period has ended')
        : (isFr ? 'Avis non supprimé' : 'Review not deleted'))
      return
    }

    toast.success(isFr ? 'Avis supprimé' : 'Review deleted')
    await fetchBookings()
  }

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

    // `cancel_booking_v2` signale ses refus DANS son retour, pas en levant une
    // erreur SQL : `error` reste null et le code passait dans la branche de
    // succès. L'écran affichait « annulée » alors que rien n'avait bougé en
    // base — d'où un bouton « Annuler » persistant sur une ligne pourtant
    // barrée. Même piège que les écritures muettes du 6 août.
    const rpcError = (result as { error?: string } | null)?.error
    if (error || rpcError) {
      const messages: Record<string, string> = {
        booking_not_found: isFr
          ? 'Cette réservation n\'est plus active. Rechargez la page.'
          : 'This booking is no longer active. Please reload the page.',
      }
      toast.error(error?.message ?? messages[rpcError!] ?? (isFr ? 'Annulation impossible' : 'Cancellation failed'))
      // L'écran ment sur au moins une ligne : on le resynchronise plutôt que
      // de laisser le membre décider sur une information fausse.
      if (rpcError) fetchBookings()
      setCancelId(null)
      return
    }

    {
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

      // L'annulation libère une place : si quelqu'un attendait, la fonction SQL
      // vient de déposer son e-mail. L'offre expire en 2 h — on l'envoie
      // maintenant, pas au prochain passage sur l'accueil.
      flushEmailQueue()

      // La trace est due quelle que soit la préférence e-mail — d'autant plus
      // ici, où le sort du crédit se joue : restitué ou perdu, le membre doit
      // pouvoir le vérifier après coup.
      if (booking?.scheduled_class) {
        const sc = booking.scheduled_class
        const when = format(new Date(sc.starts_at), "EEEE d MMMM 'à' HH:mm", { locale: fr })
        await notifyMember({
          userId: user.id,
          title: isFr ? 'Réservation annulée' : 'Booking cancelled',
          message: isFr
            ? `${sc.title || sc.class_type?.name} — ${when}. ${refunded ? 'Ton crédit t\'a été restitué.' : 'Le délai étant dépassé, le crédit n\'a pas été restitué.'}`
            : `${sc.title || sc.class_type?.name} — ${when}. ${refunded ? 'Your credit was returned.' : 'The deadline had passed, so the credit was not returned.'}`,
          type: refunded ? 'info' : 'warning',
          link: '/my-bookings',
          email: {
            to: user.email,
            template: 'booking_cancelled_by_self',
            vars: {
              user_name: profile?.display_name,
              class_name: sc.title || sc.class_type?.name,
              class_date: when,
              coach_name: sc.coach?.display_name,
              duration_minutes: sc.duration_minutes,
              refunded,
            },
            optOut: !profile?.email_on_self_booking,
          },
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

  // Une seule liste, strictement chronologique : la séance la plus proche en
  // premier, la plus lointaine en dernier.
  //
  // Les réservations étaient auparavant regroupées par pack. Le regroupement
  // montrait bien ce qui avait été consommé sur chaque pack, mais il dispersait
  // les dates : une séance de mardi pouvait se retrouver sous un pack plus bas
  // dans la page, et passer inaperçue. Le pack est désormais rappelé sur chaque
  // ligne — l'information est conservée sans découper le calendrier.
  const visible = bookings
    .filter(b => filters.includes(kindOf(b)))
    .sort((a, b) => {
      const ta = new Date(a.scheduled_class?.starts_at ?? '').getTime()
      const tb = new Date(b.scheduled_class?.starts_at ?? '').getTime()
      return ta - tb
    })

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
          {/* Le pack qui paie cette séance. Portée par la ligne depuis que la
              liste est chronologique : sans ce rappel, l'information disparue
              avec le regroupement laisserait le membre sans repère. */}
          {booking.pack_purchase?.pack_type && (
            <p className="text-xs text-muted-foreground mt-1">
              <span className="inline-flex items-center gap-1 rounded bg-muted px-1.5 py-0.5">
                {booking.is_trial
                  ? (isFr ? 'Séance d\'essai offerte' : 'Free trial session')
                  : booking.pack_purchase.pack_type.name}
              </span>
            </p>
          )}
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
          {/* L'avis laissé sur cette séance. Le membre doit pouvoir relire ce
              qu'il a écrit : sans ça, la note part dans le vide et il ne sait
              plus s'il a répondu. Tant que la fenêtre est ouverte, il peut le
              corriger ou le retirer — un avis donné à chaud se regrette. */}
          {(() => {
            const review = myReviews.get(booking.id)
            if (!review) return null
            return (
              <div className="mt-2 pt-2 border-t">
                <div className="flex items-center gap-1">
                  <span className="text-xs text-muted-foreground mr-1">
                    {isFr ? 'Votre avis' : 'Your review'}
                  </span>
                  {[1, 2, 3, 4, 5].map((n) => (
                    <Star
                      key={n}
                      className={
                        n <= review.rating
                          ? 'h-3.5 w-3.5 fill-amber-400 text-amber-400'
                          : 'h-3.5 w-3.5 text-muted-foreground/25'
                      }
                    />
                  ))}
                </div>
                {review.comment && (
                  <p className="text-xs text-muted-foreground mt-1 italic">« {review.comment} »</p>
                )}
                {review.editable && (
                  <div className="flex items-center gap-3 mt-1.5">
                    <button
                      onClick={() => openEditReview(review)}
                      className="text-xs text-primary hover:underline"
                    >
                      {isFr ? 'Modifier' : 'Edit'}
                    </button>
                    <button
                      onClick={() => setDeleteReviewId(review.booking_id)}
                      className="text-xs text-muted-foreground hover:text-destructive hover:underline"
                    >
                      {isFr ? 'Supprimer' : 'Delete'}
                    </button>
                  </div>
                )}
              </div>
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

            const seance = booking.scheduled_class

            return (
              <div className="flex flex-col items-end gap-1">
                {seance && (
                  <BoutonAgenda
                    cours={{
                      id: seance.id,
                      starts_at: seance.starts_at,
                      duration_minutes: seance.duration_minutes,
                      intitule: seance.title || seance.class_type?.name || (isFr ? 'Cours' : 'Class'),
                      coach: seance.coach?.display_name,
                      salle: seance.floor ? (seance.floor === 'haut'
                        ? (isFr ? 'Étage' : 'Upstairs')
                        : (isFr ? 'Rez-de-chaussée' : 'Ground floor')) : null,
                      description: seance.class_type?.description,
                      lieu: adresseStudio,
                    }}
                  />
                )}
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

      {/* Liste chronologique : la séance la plus proche en premier. Le pack est
          rappelé sur chaque ligne plutôt qu'en tête de groupe. */}
      <div className="space-y-2">
        {visible.length === 0 ? (
          <EmptyState icon={CalendarDays} message={t('bookings.noBookings')} />
        ) : (
          visible.map((b) => <BookingCard key={b.id} booking={b} />)
        )}
      </div>

      <ConfirmDialog
        open={!!cancelId}
        onOpenChange={() => setCancelId(null)}
        title={t('bookings.cancel')}
        description={t('bookings.cancelConfirm')}
        onConfirm={() => cancelId && handleCancel(cancelId)}
      />

      {/* Correction d'un avis. Réutilise `submit_class_review`, qui accepte le
          dépôt comme la modification tant que la fenêtre est ouverte. */}
      <Dialog open={editReview !== null} onOpenChange={(open) => !open && setEditReview(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{isFr ? 'Modifier votre avis' : 'Edit your review'}</DialogTitle>
          </DialogHeader>

          <div className="space-y-3">
            <div className="flex items-center gap-1">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setEditRating(n)}
                  aria-label={`${n} ${isFr ? 'étoile' : 'star'}${n > 1 ? 's' : ''}`}
                  className="p-1 transition-transform hover:scale-110"
                >
                  <Star
                    className={
                      n <= editRating
                        ? 'h-7 w-7 fill-amber-400 text-amber-400'
                        : 'h-7 w-7 text-muted-foreground/30'
                    }
                  />
                </button>
              ))}
            </div>

            <Textarea
              value={editComment}
              onChange={(e) => setEditComment(e.target.value)}
              rows={3}
              placeholder={isFr ? 'Votre commentaire (facultatif)' : 'Your comment (optional)'}
            />
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditReview(null)}>
              {t('common.cancel')}
            </Button>
            <Button onClick={handleUpdateReview} disabled={savingReview || editRating === 0}>
              {savingReview ? '...' : (isFr ? 'Enregistrer' : 'Save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleteReviewId}
        onOpenChange={() => setDeleteReviewId(null)}
        title={isFr ? 'Supprimer votre avis' : 'Delete your review'}
        description={isFr
          ? 'Votre note et votre commentaire seront retirés. Vous pourrez en redonner un tant que la période reste ouverte.'
          : 'Your rating and comment will be removed. You can leave a new one while the period is still open.'}
        onConfirm={() => deleteReviewId && handleDeleteReview(deleteReviewId)}
      />
    </div>
  )
}

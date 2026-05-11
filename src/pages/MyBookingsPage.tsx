import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { logActivity } from '@/lib/activity-log'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
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

export function MyBookingsPage() {
  const { t, i18n } = useTranslation()
  const { user, profile } = useAuth()
  const locale = i18n.language === 'fr' ? fr : enUS
  const isFr = i18n.language === 'fr'
  const [bookings, setBookings] = useState<Booking[]>([])
  const [loading, setLoading] = useState(true)
  const [cancelId, setCancelId] = useState<string | null>(null)
  const [cancellationHours, setCancellationHours] = useState(12)

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
        .select('*, scheduled_class:scheduled_classes(*, class_type:class_types(*))')
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
          description: `Annulation${refunded ? '' : ' tardive'}: ${booking.scheduled_class?.class_type?.name}`,
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

      if (refunded) {
        toast.success(isFr
          ? 'Réservation annulée — crédit restitué'
          : 'Booking cancelled — credit refunded')
      } else {
        toast.warning(isFr
          ? `Annulation tardive (${hoursBefore}h avant) — crédit non restitué`
          : `Late cancellation (${hoursBefore}h before) — credit not refunded`)
      }
    }
    setCancelId(null)
  }

  if (loading) return <LoadingState />

  const now = new Date()
  const upcoming = bookings
    .filter((b) => b.status === 'confirmed' && new Date(b.scheduled_class?.starts_at ?? '') > now)
    .sort((a, b) =>
      new Date(a.scheduled_class?.starts_at ?? '').getTime() - new Date(b.scheduled_class?.starts_at ?? '').getTime()
    )
  const past = bookings
    .filter((b) => b.status !== 'confirmed' || new Date(b.scheduled_class?.starts_at ?? '') <= now)
    .sort((a, b) =>
      new Date(b.scheduled_class?.starts_at ?? '').getTime() - new Date(a.scheduled_class?.starts_at ?? '').getTime()
    )

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
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={booking.status === 'confirmed' ? 'default' : 'secondary'}>
            {t(`bookings.status.${booking.status}`)}
          </Badge>
          {booking.status === 'confirmed' && new Date(booking.scheduled_class?.starts_at ?? '') > now && (() => {
            const startsAt = new Date(booking.scheduled_class?.starts_at ?? '')
            const hoursUntil = (startsAt.getTime() - now.getTime()) / (1000 * 60 * 60)
            const isFreeCancel = hoursUntil >= cancellationHours

            return (
              <div className="flex flex-col items-end gap-1">
                <Button variant="outline" size="sm" onClick={() => setCancelId(booking.id)}>
                  {t('bookings.cancel')}
                </Button>
                {!isFreeCancel && (
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

      <Tabs defaultValue="upcoming">
        <TabsList>
          <TabsTrigger value="upcoming">{t('bookings.upcoming')} ({upcoming.length})</TabsTrigger>
          <TabsTrigger value="past">{t('bookings.past')} ({past.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="upcoming" className="space-y-2 mt-4">
          {upcoming.length === 0 ? (
            <EmptyState icon={CalendarDays} message={t('bookings.noBookings')} />
          ) : (
            upcoming.map((b) => <BookingCard key={b.id} booking={b} />)
          )}
        </TabsContent>
        <TabsContent value="past" className="space-y-2 mt-4">
          {past.length === 0 ? (
            <EmptyState icon={CalendarDays} message={t('bookings.noBookings')} />
          ) : (
            past.map((b) => <BookingCard key={b.id} booking={b} />)
          )}
        </TabsContent>
      </Tabs>

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

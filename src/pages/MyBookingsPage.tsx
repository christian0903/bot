import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/common/EmptyState'
import { LoadingState } from '@/components/common/LoadingState'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import { CalendarDays } from 'lucide-react'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { fr, enUS } from 'date-fns/locale'
import type { Booking } from '@/types'

export function MyBookingsPage() {
  const { t, i18n } = useTranslation()
  const { user } = useAuth()
  const locale = i18n.language === 'fr' ? fr : enUS
  const [bookings, setBookings] = useState<Booking[]>([])
  const [loading, setLoading] = useState(true)
  const [cancelId, setCancelId] = useState<string | null>(null)

  useEffect(() => {
    if (!user) return
    supabase
      .from('bookings')
      .select('*, scheduled_class:scheduled_classes(*, class_type:class_types(*), coach:profiles(display_name))')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        setBookings((data as Booking[]) ?? [])
        setLoading(false)
      })
  }, [user])

  const handleCancel = async (bookingId: string) => {
    const { error } = await supabase
      .from('bookings')
      .update({ status: 'cancelled', cancelled_at: new Date().toISOString() })
      .eq('id', bookingId)

    if (error) {
      toast.error(error.message)
    } else {
      setBookings((prev) =>
        prev.map((b) => (b.id === bookingId ? { ...b, status: 'cancelled' as const, cancelled_at: new Date().toISOString() } : b))
      )
      toast.success(t('schedule.bookingCancelled'))
    }
    setCancelId(null)
  }

  if (loading) return <LoadingState />

  const now = new Date()
  const upcoming = bookings.filter(
    (b) => b.status === 'confirmed' && new Date(b.scheduled_class?.starts_at ?? '') > now
  )
  const past = bookings.filter(
    (b) => b.status !== 'confirmed' || new Date(b.scheduled_class?.starts_at ?? '') <= now
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
          {booking.status === 'confirmed' && new Date(booking.scheduled_class?.starts_at ?? '') > now && (
            <Button variant="outline" size="sm" onClick={() => setCancelId(booking.id)}>
              {t('bookings.cancel')}
            </Button>
          )}
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

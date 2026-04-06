import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { supabase } from '@/lib/supabase'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { EmptyState } from '@/components/common/EmptyState'
import { LoadingState } from '@/components/common/LoadingState'
import { Users } from 'lucide-react'
import { format } from 'date-fns'
import { fr, enUS } from 'date-fns/locale'
import type { ScheduledClass, Booking } from '@/types'

export function CoachClassDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { t, i18n } = useTranslation()
  const locale = i18n.language === 'fr' ? fr : enUS
  const [scheduledClass, setScheduledClass] = useState<ScheduledClass | null>(null)
  const [bookings, setBookings] = useState<Booking[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!id) return

    Promise.all([
      supabase
        .from('scheduled_classes')
        .select('*, class_type:class_types(*)')
        .eq('id', id)
        .single(),
      supabase
        .from('bookings')
        .select('*, user:profiles(display_name, email)')
        .eq('scheduled_class_id', id)
        .eq('status', 'confirmed'),
    ]).then(([classRes, bookingsRes]) => {
      setScheduledClass(classRes.data as ScheduledClass)
      setBookings((bookingsRes.data as Booking[]) ?? [])
      setLoading(false)
    })
  }, [id])

  if (loading) return <LoadingState />
  if (!scheduledClass) return <p>{t('common.noResults')}</p>

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>{scheduledClass.class_type?.name}</CardTitle>
          <p className="text-sm text-muted-foreground">
            {format(new Date(scheduledClass.starts_at), 'EEEE dd MMMM yyyy, HH:mm', { locale })}
          </p>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 mb-4">
            <Users className="h-4 w-4" />
            <span>
              {bookings.length} / {scheduledClass.max_participants} {t('coach.participants')}
            </span>
          </div>

          {bookings.length === 0 ? (
            <EmptyState icon={Users} message={t('bookings.noBookings')} />
          ) : (
            <div className="space-y-2">
              {bookings.map((booking) => (
                <div key={booking.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                  <div>
                    <p className="font-medium">{booking.user?.display_name}</p>
                    <p className="text-sm text-muted-foreground">{booking.user?.email}</p>
                  </div>
                  <Badge>{t(`bookings.status.${booking.status}`)}</Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

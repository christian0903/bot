import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { supabase } from '@/lib/supabase'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { EmptyState } from '@/components/common/EmptyState'
import { LoadingState } from '@/components/common/LoadingState'
import { Users, ArrowLeft, Pencil, Check, X } from 'lucide-react'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { fr, enUS } from 'date-fns/locale'
import type { ScheduledClass, Booking } from '@/types'

export function CoachClassDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const locale = i18n.language === 'fr' ? fr : enUS
  const [scheduledClass, setScheduledClass] = useState<ScheduledClass | null>(null)
  const [bookings, setBookings] = useState<Booking[]>([])
  const [loading, setLoading] = useState(true)

  // Edit max participants
  const [editingMax, setEditingMax] = useState(false)
  const [maxValue, setMaxValue] = useState(0)

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
        .select('*, user:profiles(display_name, email, phone)')
        .eq('scheduled_class_id', id)
        .eq('status', 'confirmed'),
    ]).then(([classRes, bookingsRes]) => {
      const sc = classRes.data as ScheduledClass
      setScheduledClass(sc)
      setMaxValue(sc?.max_participants ?? 0)
      setBookings((bookingsRes.data as Booking[]) ?? [])
      setLoading(false)
    })
  }, [id])

  const handleSaveMax = async () => {
    if (!id || maxValue < 1) return

    // Don't allow reducing below current bookings
    if (maxValue < bookings.length) {
      toast.error(
        i18n.language === 'fr'
          ? `Impossible : ${bookings.length} participant(s) déjà inscrit(s)`
          : `Cannot reduce: ${bookings.length} participant(s) already booked`
      )
      return
    }

    const { error } = await supabase
      .from('scheduled_classes')
      .update({ max_participants: maxValue })
      .eq('id', id)

    if (error) {
      toast.error(error.message)
    } else {
      setScheduledClass(prev => prev ? { ...prev, max_participants: maxValue } : prev)
      setEditingMax(false)
      toast.success(t('common.saveSuccess'))
    }
  }

  if (loading) return <LoadingState />
  if (!scheduledClass) return <p>{t('common.noResults')}</p>

  const spotsLeft = scheduledClass.max_participants - bookings.length

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <Button variant="ghost" size="sm" onClick={() => navigate('/coach/my-classes')}>
        <ArrowLeft className="h-4 w-4 mr-1" />
        {t('common.back')}
      </Button>

      <Card>
        <CardHeader>
          <CardTitle>{scheduledClass.class_type?.name}</CardTitle>
          <p className="text-sm text-muted-foreground">
            {format(new Date(scheduledClass.starts_at), 'EEEE dd MMMM yyyy, HH:mm', { locale })}
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Participants count + edit max */}
          <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              <span className="font-medium">
                {bookings.length} / {scheduledClass.max_participants} {t('coach.participants')}
              </span>
              {spotsLeft <= 2 && spotsLeft > 0 && (
                <Badge variant="secondary" className="text-[11px]">
                  {t('schedule.spots', { count: spotsLeft })}
                </Badge>
              )}
              {spotsLeft <= 0 && (
                <Badge variant="destructive" className="text-[11px]">
                  {t('schedule.full')}
                </Badge>
              )}
            </div>

            {editingMax ? (
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min={1}
                  className="w-20 h-8"
                  value={maxValue}
                  onChange={(e) => setMaxValue(parseInt(e.target.value) || 1)}
                  autoFocus
                />
                <Button size="icon" variant="ghost" className="h-8 w-8" onClick={handleSaveMax}>
                  <Check className="h-4 w-4 text-primary" />
                </Button>
                <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => { setEditingMax(false); setMaxValue(scheduledClass.max_participants) }}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <Button size="sm" variant="outline" onClick={() => setEditingMax(true)}>
                <Pencil className="h-3 w-3 mr-1" />
                {i18n.language === 'fr' ? 'Modifier places' : 'Edit spots'}
              </Button>
            )}
          </div>

          {/* Participants list */}
          {bookings.length === 0 ? (
            <EmptyState icon={Users} message={t('bookings.noBookings')} />
          ) : (
            <div className="space-y-2">
              {bookings.map((booking, index) => (
                <div key={booking.id} className="flex items-center justify-between p-3 rounded-lg border">
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-medium text-muted-foreground w-6">{index + 1}</span>
                    <div>
                      <p className="font-medium">{booking.user?.display_name}</p>
                      <p className="text-xs text-muted-foreground">
                        {booking.user?.email}
                        {booking.user?.phone && ` · ${booking.user.phone}`}
                      </p>
                    </div>
                  </div>
                  <Badge variant="default" className="text-[11px]">
                    {t(`bookings.status.${booking.status}`)}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

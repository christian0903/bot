import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { EmptyState } from '@/components/common/EmptyState'
import { LoadingState } from '@/components/common/LoadingState'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import { CalendarDays, ChevronLeft, ChevronRight, List, LayoutGrid, Clock, Users } from 'lucide-react'
import { toast } from 'sonner'
import { addDays, startOfWeek, format, isSameDay } from 'date-fns'
import { fr, enUS } from 'date-fns/locale'
import { motion } from 'framer-motion'
import type { ScheduledClass } from '@/types'

type ViewMode = 'week' | 'list'

export function SchedulePage() {
  const { t, i18n } = useTranslation()
  const { user } = useAuth()
  const locale = i18n.language === 'fr' ? fr : enUS
  const [classes, setClasses] = useState<ScheduledClass[]>([])
  const [userBookings, setUserBookings] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [viewMode, setViewMode] = useState<ViewMode>('week')
  const [currentDate, setCurrentDate] = useState(new Date())
  const [bookingClassId, setBookingClassId] = useState<string | null>(null)

  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 })
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true)
      const from = weekStart.toISOString()
      const to = addDays(weekStart, 7).toISOString()

      const [classesRes, bookingsRes] = await Promise.all([
        supabase
          .from('scheduled_classes')
          .select('*, class_type:class_types(*), coach:profiles(display_name)')
          .gte('starts_at', from)
          .lt('starts_at', to)
          .eq('is_cancelled', false)
          .order('starts_at'),
        user
          ? supabase
              .from('bookings')
              .select('scheduled_class_id')
              .eq('user_id', user.id)
              .eq('status', 'confirmed')
          : Promise.resolve({ data: [] }),
      ])

      setClasses((classesRes.data as ScheduledClass[]) ?? [])
      setUserBookings(new Set((bookingsRes.data ?? []).map((b) => b.scheduled_class_id)))
      setLoading(false)
    }

    fetchData()
  }, [currentDate, user])

  const handleBook = async (classId: string) => {
    if (!user) return

    const scheduledClass = classes.find((c) => c.id === classId)
    if (!scheduledClass?.class_type) return

    // Check available credits
    const { data: credits } = await supabase.rpc('get_available_credits', {
      p_user_id: user.id,
      p_credit_type_id: scheduledClass.class_type.credit_type_id,
    })

    if (!credits || credits.length === 0) {
      toast.error(t('schedule.noCredits'))
      return
    }

    const packPurchaseId = credits[0].pack_purchase_id

    // Create booking
    const { error: bookingError } = await supabase.from('bookings').insert({
      scheduled_class_id: classId,
      user_id: user.id,
      pack_purchase_id: packPurchaseId,
    })

    if (bookingError) {
      toast.error(bookingError.message)
      return
    }

    // Consume credit
    await supabase.rpc('consume_credit', { p_pack_purchase_id: packPurchaseId })

    setUserBookings((prev) => new Set([...prev, classId]))
    toast.success(t('schedule.bookingConfirmed'))
    setBookingClassId(null)
  }

  const ClassCard = ({ sc }: { sc: ScheduledClass }) => {
    const isBooked = userBookings.has(sc.id)
    const spotsUsed = sc.bookings_count ?? 0
    const spotsFree = sc.max_participants - spotsUsed
    const isFull = spotsFree <= 0

    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
        <Card className="hover:shadow-md transition-shadow">
          <CardContent className="p-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="font-semibold">{sc.class_type?.name}</p>
                <p className="text-sm text-muted-foreground flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {format(new Date(sc.starts_at), 'HH:mm', { locale })} - {t('schedule.duration', { minutes: sc.duration_minutes })}
                </p>
                <p className="text-sm text-muted-foreground">
                  {t('schedule.coach')}: {sc.coach?.display_name}
                </p>
                <p className="text-sm text-muted-foreground flex items-center gap-1">
                  <Users className="h-3 w-3" />
                  {t('schedule.spots', { count: spotsFree })}
                </p>
              </div>
              <div>
                {isBooked ? (
                  <Badge variant="secondary">{t('schedule.booked')}</Badge>
                ) : isFull ? (
                  <Badge variant="destructive">{t('schedule.full')}</Badge>
                ) : (
                  <Button size="sm" onClick={() => setBookingClassId(sc.id)}>
                    {t('schedule.book')}
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    )
  }

  if (loading) return <LoadingState />

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-2xl font-bold">{t('schedule.title')}</h1>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => setCurrentDate((d) => addDays(d, -7))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm font-medium min-w-[200px] text-center">
            {format(weekStart, 'dd MMM', { locale })} - {format(addDays(weekStart, 6), 'dd MMM yyyy', { locale })}
          </span>
          <Button variant="outline" size="icon" onClick={() => setCurrentDate((d) => addDays(d, 7))}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <div className="flex border rounded-md">
            <Button
              variant={viewMode === 'week' ? 'default' : 'ghost'}
              size="icon"
              onClick={() => setViewMode('week')}
            >
              <LayoutGrid className="h-4 w-4" />
            </Button>
            <Button
              variant={viewMode === 'list' ? 'default' : 'ghost'}
              size="icon"
              onClick={() => setViewMode('list')}
            >
              <List className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {classes.length === 0 ? (
        <EmptyState icon={CalendarDays} message={t('schedule.noClasses')} />
      ) : viewMode === 'list' ? (
        <div className="space-y-3">
          {classes.map((sc) => (
            <div key={sc.id}>
              <p className="text-sm font-medium text-muted-foreground mb-1">
                {format(new Date(sc.starts_at), 'EEEE dd MMMM', { locale })}
              </p>
              <ClassCard sc={sc} />
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-7 gap-2">
          {weekDays.map((day) => (
            <div key={day.toISOString()} className="space-y-2">
              <p className="text-center text-sm font-medium py-2 border-b">
                {format(day, 'EEE dd', { locale })}
              </p>
              {classes
                .filter((sc) => isSameDay(new Date(sc.starts_at), day))
                .map((sc) => (
                  <ClassCard key={sc.id} sc={sc} />
                ))}
            </div>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={!!bookingClassId}
        onOpenChange={() => setBookingClassId(null)}
        title={t('schedule.book')}
        description={t('schedule.bookingConfirmed')}
        onConfirm={() => bookingClassId && handleBook(bookingClassId)}
        variant="default"
      />
    </div>
  )
}

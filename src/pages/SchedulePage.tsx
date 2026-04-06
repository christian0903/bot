import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { logActivity } from '@/lib/activity-log'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { EmptyState } from '@/components/common/EmptyState'
import { LoadingState } from '@/components/common/LoadingState'
import { CalendarDays, ChevronLeft, ChevronRight, List, LayoutGrid, Users, Check, Clock3, X } from 'lucide-react'
import { toast } from 'sonner'
import { addDays, startOfWeek, format, isSameDay, isToday } from 'date-fns'
import { fr, enUS } from 'date-fns/locale'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'
import type { ScheduledClass } from '@/types'

type ViewMode = 'week' | 'list'

const CLASS_COLORS: Record<string, { bg: string; border: string; dot: string }> = {
  semi_prive: { bg: 'bg-blue-50 dark:bg-blue-950/30', border: 'border-blue-200 dark:border-blue-800', dot: 'bg-blue-500' },
  personal_training: { bg: 'bg-orange-50 dark:bg-orange-950/30', border: 'border-orange-200 dark:border-orange-800', dot: 'bg-orange-500' },
}

const DEFAULT_COLOR = { bg: 'bg-muted/50', border: 'border-border', dot: 'bg-primary' }

export function SchedulePage() {
  const { t, i18n } = useTranslation()
  const { user } = useAuth()
  const locale = i18n.language === 'fr' ? fr : enUS
  const [classes, setClasses] = useState<ScheduledClass[]>([])
  const [userBookings, setUserBookings] = useState<Set<string>>(new Set())
  const [userWaitlist, setUserWaitlist] = useState<Map<string, { id: string; position: number; status: string }>>(new Map())
  const [bookingCounts, setBookingCounts] = useState<Map<string, number>>(new Map())
  const [loading, setLoading] = useState(true)
  const [bookingInProgress, setBookingInProgress] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<ViewMode>('list')
  const [currentDate, setCurrentDate] = useState(new Date())

  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 })
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))

  const fetchData = async () => {
    setLoading(true)
    const from = weekStart.toISOString()
    const to = addDays(weekStart, 7).toISOString()

    const [classesRes, bookingsRes, waitlistRes] = await Promise.all([
      supabase
        .from('scheduled_classes')
        .select('*, class_type:class_types(*, credit_type:credit_types(name))')
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
      user
        ? supabase
            .from('waitlist')
            .select('id, scheduled_class_id, position, status')
            .eq('user_id', user.id)
            .in('status', ['waiting', 'offered'])
        : Promise.resolve({ data: [] }),
    ])

    const rawClasses = (classesRes.data as ScheduledClass[]) ?? []

    // Fetch coach profiles
    const coachIds = [...new Set(rawClasses.map(c => c.coach_id))]
    if (coachIds.length > 0) {
      const { data: coaches } = await supabase
        .from('profiles')
        .select('id, display_name, avatar_url')
        .in('id', coachIds)
      const coachMap = new Map((coaches ?? []).map(c => [c.id, c]))
      for (const sc of rawClasses) {
        sc.coach = coachMap.get(sc.coach_id) as ScheduledClass['coach']
      }
    }

    // Fetch booking counts per class
    const classIds = rawClasses.map(c => c.id)
    if (classIds.length > 0) {
      const { data: countData } = await supabase
        .from('bookings')
        .select('scheduled_class_id')
        .in('scheduled_class_id', classIds)
        .eq('status', 'confirmed')
      const counts = new Map<string, number>()
      for (const row of countData ?? []) {
        counts.set(row.scheduled_class_id, (counts.get(row.scheduled_class_id) ?? 0) + 1)
      }
      setBookingCounts(counts)
    }

    // Waitlist map
    const wlMap = new Map<string, { id: string; position: number; status: string }>()
    for (const w of waitlistRes.data ?? []) {
      wlMap.set(w.scheduled_class_id, { id: w.id, position: w.position, status: w.status })
    }
    setUserWaitlist(wlMap)

    setClasses(rawClasses)
    setUserBookings(new Set((bookingsRes.data ?? []).map((b) => b.scheduled_class_id)))
    setLoading(false)
  }

  useEffect(() => {
    fetchData()
  }, [currentDate, user])

  const handleBook = async (classId: string) => {
    if (!user) return
    setBookingInProgress(classId)

    const scheduledClass = classes.find((c) => c.id === classId)
    if (!scheduledClass?.class_type) {
      setBookingInProgress(null)
      return
    }

    const { data: credits } = await supabase.rpc('get_available_credits', {
      p_user_id: user.id,
      p_credit_type_id: scheduledClass.class_type.credit_type_id,
    })

    if (!credits || credits.length === 0) {
      toast.error(t('schedule.noCredits'))
      setBookingInProgress(null)
      return
    }

    const packPurchaseId = credits[0].pack_purchase_id

    const { error: bookingError } = await supabase.from('bookings').insert({
      scheduled_class_id: classId,
      user_id: user.id,
      pack_purchase_id: packPurchaseId,
    })

    if (bookingError) {
      toast.error(bookingError.message)
      setBookingInProgress(null)
      return
    }

    await supabase.rpc('consume_credit', { p_pack_purchase_id: packPurchaseId })

    await logActivity({
      action: 'booking_created',
      actor_id: user.id,
      target_user_id: user.id,
      entity_type: 'booking',
      details: { class_name: scheduledClass.class_type?.name, starts_at: scheduledClass.starts_at },
      description: `Réservation: ${scheduledClass.class_type?.name} le ${format(new Date(scheduledClass.starts_at), 'dd/MM/yyyy HH:mm')}`,
    })

    setUserBookings((prev) => new Set([...prev, classId]))
    toast.success(t('schedule.bookingConfirmed'))
    setBookingInProgress(null)
  }

  const handleJoinWaitlist = async (classId: string) => {
    if (!user) return
    setBookingInProgress(classId)

    const { data: posData } = await supabase.rpc('next_waitlist_position', {
      p_scheduled_class_id: classId,
    })
    const position = posData ?? 1

    const { error } = await supabase.from('waitlist').insert({
      scheduled_class_id: classId,
      user_id: user.id,
      position,
    })

    if (error) {
      toast.error(error.message)
    } else {
      const sc = classes.find(c => c.id === classId)
      await logActivity({
        action: 'waitlist_joined',
        actor_id: user.id,
        target_user_id: user.id,
        entity_type: 'scheduled_class',
        entity_id: classId,
        details: { class_name: sc?.class_type?.name, position },
        description: `Liste d'attente (position ${position}): ${sc?.class_type?.name} le ${sc ? format(new Date(sc.starts_at), 'dd/MM/yyyy HH:mm') : ''}`,
      })
      setUserWaitlist(prev => new Map(prev).set(classId, { id: '', position, status: 'waiting' }))
      toast.success(t('schedule.waitlistJoined', { position }))
    }
    setBookingInProgress(null)
  }

  const handleLeaveWaitlist = async (classId: string) => {
    if (!user) return
    const entry = userWaitlist.get(classId)
    if (!entry) return

    await supabase
      .from('waitlist')
      .update({ status: 'cancelled' })
      .eq('scheduled_class_id', classId)
      .eq('user_id', user.id)
      .in('status', ['waiting', 'offered'])

    setUserWaitlist(prev => {
      const next = new Map(prev)
      next.delete(classId)
      return next
    })
    toast.success(t('schedule.waitlistLeft'))
  }

  const handleConfirmWaitlistSpot = async (classId: string) => {
    if (!user) return
    setBookingInProgress(classId)

    // Same logic as handleBook but also update waitlist status
    const scheduledClass = classes.find((c) => c.id === classId)
    if (!scheduledClass?.class_type) { setBookingInProgress(null); return }

    const { data: credits } = await supabase.rpc('get_available_credits', {
      p_user_id: user.id,
      p_credit_type_id: scheduledClass.class_type.credit_type_id,
    })

    if (!credits || credits.length === 0) {
      toast.error(t('schedule.noCredits'))
      setBookingInProgress(null)
      return
    }

    const packPurchaseId = credits[0].pack_purchase_id

    const { error } = await supabase.from('bookings').insert({
      scheduled_class_id: classId,
      user_id: user.id,
      pack_purchase_id: packPurchaseId,
    })

    if (error) {
      toast.error(error.message)
      setBookingInProgress(null)
      return
    }

    await supabase.rpc('consume_credit', { p_pack_purchase_id: packPurchaseId })

    // Update waitlist entry
    await supabase
      .from('waitlist')
      .update({ status: 'confirmed' })
      .eq('scheduled_class_id', classId)
      .eq('user_id', user.id)

    setUserBookings((prev) => new Set([...prev, classId]))
    setUserWaitlist(prev => {
      const next = new Map(prev)
      next.delete(classId)
      return next
    })
    toast.success(t('schedule.spotConfirmed'))
    setBookingInProgress(null)
  }

  const ClassCard = ({ sc }: { sc: ScheduledClass }) => {
    const isBooked = userBookings.has(sc.id)
    const waitlistEntry = userWaitlist.get(sc.id)
    const isOnWaitlist = !!waitlistEntry
    const isOffered = waitlistEntry?.status === 'offered'
    const spotsUsed = bookingCounts.get(sc.id) ?? 0
    const spotsFree = sc.max_participants - spotsUsed
    const isFull = spotsFree <= 0
    const isBooking = bookingInProgress === sc.id
    const creditName = sc.class_type?.credit_type?.name ?? 'default'
    const colors = CLASS_COLORS[creditName] || DEFAULT_COLOR
    const startsAt = new Date(sc.starts_at)

    return (
      <motion.div
        layout
        initial={{ opacity: 0, scale: 0.97 }}
        animate={{ opacity: 1, scale: 1 }}
        className={cn(
          'rounded-xl border p-3.5 transition-all',
          colors.bg,
          colors.border,
          isBooked && 'ring-2 ring-primary/30',
          isOffered && 'ring-2 ring-orange-400/50'
        )}
      >
        <div className="flex items-start gap-3">
          {/* Time block */}
          <div className="flex flex-col items-center shrink-0 pt-0.5">
            <span className="text-lg font-bold leading-none">{format(startsAt, 'HH:mm')}</span>
            <span className="text-[11px] text-muted-foreground">{sc.duration_minutes} min</span>
          </div>

          {/* Color dot + Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <div className={cn('h-2 w-2 rounded-full shrink-0', colors.dot)} />
              <p className="font-semibold text-sm truncate">{sc.class_type?.name}</p>
            </div>
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                {sc.coach?.avatar_url ? (
                  <img src={sc.coach.avatar_url} className="h-4 w-4 rounded-full" alt="" />
                ) : (
                  <div className="h-4 w-4 rounded-full bg-muted flex items-center justify-center text-[9px] font-bold">
                    {sc.coach?.display_name?.charAt(0)}
                  </div>
                )}
                {sc.coach?.display_name}
              </span>
              <span className={cn('flex items-center gap-1', isFull && !isBooked && 'text-destructive')}>
                <Users className="h-3 w-3" />
                {spotsFree}/{sc.max_participants}
              </span>
            </div>
          </div>

          {/* Action */}
          <div className="shrink-0 flex flex-col items-end gap-1">
            {isBooked ? (
              <Badge className="bg-primary/10 text-primary border-primary/20 gap-1">
                <Check className="h-3 w-3" />
                {t('schedule.booked')}
              </Badge>
            ) : isOffered ? (
              <Button
                size="sm"
                className="rounded-full px-3 h-8 text-xs font-semibold bg-orange-500 hover:bg-orange-600"
                onClick={() => handleConfirmWaitlistSpot(sc.id)}
                disabled={isBooking}
              >
                {isBooking ? '...' : t('schedule.confirmSpot')}
              </Button>
            ) : isOnWaitlist ? (
              <div className="flex items-center gap-1">
                <Badge variant="secondary" className="gap-1 text-xs">
                  <Clock3 className="h-3 w-3" />
                  {t('schedule.onWaitlist', { position: waitlistEntry.position })}
                </Badge>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={() => handleLeaveWaitlist(sc.id)}
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            ) : isFull ? (
              <Button
                size="sm"
                variant="outline"
                className="rounded-full px-3 h-8 text-xs font-semibold"
                onClick={() => handleJoinWaitlist(sc.id)}
                disabled={isBooking}
              >
                {isBooking ? '...' : t('schedule.joinWaitlist')}
              </Button>
            ) : (
              <Button
                size="sm"
                className="rounded-full px-4 h-8 text-xs font-semibold"
                onClick={() => handleBook(sc.id)}
                disabled={isBooking}
              >
                {isBooking ? (
                  <span className="animate-pulse">...</span>
                ) : (
                  t('schedule.book')
                )}
              </Button>
            )}
          </div>
        </div>
      </motion.div>
    )
  }

  if (loading) return <LoadingState />

  // Group classes by day for list view
  const classesByDay = weekDays.map((day) => ({
    day,
    classes: classes.filter((sc) => isSameDay(new Date(sc.starts_at), day)),
  })).filter(({ classes: c }) => c.length > 0)

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-2xl font-bold">{t('schedule.title')}</h1>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setCurrentDate((d) => addDays(d, -7))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <button
            onClick={() => setCurrentDate(new Date())}
            className="text-sm font-medium min-w-[180px] text-center hover:text-primary transition-colors"
          >
            {format(weekStart, 'dd MMM', { locale })} – {format(addDays(weekStart, 6), 'dd MMM yyyy', { locale })}
          </button>
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setCurrentDate((d) => addDays(d, 7))}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <div className="flex border rounded-lg overflow-hidden ml-1">
            <button
              className={cn(
                'p-1.5 transition-colors',
                viewMode === 'list' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'
              )}
              onClick={() => setViewMode('list')}
            >
              <List className="h-4 w-4" />
            </button>
            <button
              className={cn(
                'p-1.5 transition-colors',
                viewMode === 'week' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'
              )}
              onClick={() => setViewMode('week')}
            >
              <LayoutGrid className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {classes.length === 0 ? (
        <EmptyState icon={CalendarDays} message={t('schedule.noClasses')} />
      ) : viewMode === 'list' ? (
        /* LIST VIEW */
        <div className="space-y-5">
          <AnimatePresence>
            {classesByDay.map(({ day, classes: dayClasses }) => (
              <motion.div
                key={day.toISOString()}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
              >
                <div className="flex items-center gap-2 mb-2">
                  <h3 className={cn(
                    'text-sm font-semibold capitalize',
                    isToday(day) && 'text-primary'
                  )}>
                    {format(day, 'EEEE d MMMM', { locale })}
                  </h3>
                  {isToday(day) && (
                    <Badge variant="secondary" className="text-[10px] h-5">
                      {i18n.language === 'fr' ? "Aujourd'hui" : 'Today'}
                    </Badge>
                  )}
                </div>
                <div className="space-y-2">
                  {dayClasses.map((sc) => (
                    <ClassCard key={sc.id} sc={sc} />
                  ))}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      ) : (
        /* WEEK VIEW */
        <div className="grid grid-cols-7 gap-1.5 overflow-x-auto">
          {weekDays.map((day) => {
            const dayClasses = classes.filter((sc) => isSameDay(new Date(sc.starts_at), day))
            return (
              <div key={day.toISOString()} className="min-w-[120px]">
                <div className={cn(
                  'text-center text-xs font-medium py-2 mb-1.5 rounded-lg',
                  isToday(day) ? 'bg-primary text-primary-foreground' : 'bg-muted'
                )}>
                  <div>{format(day, 'EEE', { locale })}</div>
                  <div className="text-lg font-bold leading-none mt-0.5">{format(day, 'd')}</div>
                </div>
                <div className="space-y-1.5">
                  {dayClasses.map((sc) => (
                    <ClassCard key={sc.id} sc={sc} />
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { logActivity } from '@/lib/activity-log'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/common/EmptyState'
import { LoadingState } from '@/components/common/LoadingState'
import { CalendarDays, ChevronLeft, ChevronRight, List, LayoutGrid, Users, Check, Clock3, X, Clock, Zap } from 'lucide-react'
import { toast } from 'sonner'
import { addDays, startOfWeek, format, isSameDay, isToday } from 'date-fns'
import { fr, enUS } from 'date-fns/locale'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'
import type { ScheduledClass } from '@/types'

type ViewMode = 'week' | 'list'

// Badge colors by credit type name
const CREDIT_BADGE: Record<string, { bg: string; text: string; label?: string }> = {
  semi_prive: { bg: 'bg-emerald-500/20', text: 'text-emerald-400' },
  personal_training: { bg: 'bg-orange-500/20', text: 'text-orange-400' },
}
const DEFAULT_BADGE = { bg: 'bg-primary/20', text: 'text-primary' }

export function SchedulePage() {
  const { t, i18n } = useTranslation()
  const { user } = useAuth()
  const locale = i18n.language === 'fr' ? fr : enUS
  const isFr = i18n.language === 'fr'
  const [classes, setClasses] = useState<ScheduledClass[]>([])
  const [userBookings, setUserBookings] = useState<Set<string>>(new Set())
  const [userWaitlist, setUserWaitlist] = useState<Map<string, { id: string; position: number; status: string }>>(new Map())
  const [bookingCounts, setBookingCounts] = useState<Map<string, number>>(new Map())
  const [loading, setLoading] = useState(true)
  const [bookingInProgress, setBookingInProgress] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<ViewMode>('week')
  const [currentDate, setCurrentDate] = useState(new Date())
  const [selectedDayIndex, setSelectedDayIndex] = useState(() => {
    const today = new Date().getDay()
    return today === 0 ? 6 : today - 1 // 0=lun
  })

  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 })
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))

  const fetchData = async () => {
    setLoading(true)
    const from = weekStart.toISOString()
    const to = addDays(weekStart, 7).toISOString()

    const [classesRes, bookingsRes, waitlistRes] = await Promise.all([
      supabase
        .from('scheduled_classes')
        .select('*, class_type:class_types(*, credit_type:credit_types(name, label_fr, label_en))')
        .gte('starts_at', from)
        .lt('starts_at', to)
        .eq('is_cancelled', false)
        .order('starts_at'),
      user
        ? supabase.from('bookings').select('scheduled_class_id').eq('user_id', user.id).eq('status', 'confirmed')
        : Promise.resolve({ data: [] }),
      user
        ? supabase.from('waitlist').select('id, scheduled_class_id, position, status').eq('user_id', user.id).in('status', ['waiting', 'offered'])
        : Promise.resolve({ data: [] }),
    ])

    const rawClasses = (classesRes.data as ScheduledClass[]) ?? []

    // Fetch coach profiles
    const coachIds = [...new Set(rawClasses.map(c => c.coach_id).filter(Boolean))]
    if (coachIds.length > 0) {
      const { data: coaches } = await supabase.from('profiles').select('id, display_name, avatar_url').in('id', coachIds)
      const coachMap = new Map((coaches ?? []).map(c => [c.id, c]))
      for (const sc of rawClasses) {
        if (sc.coach_id) sc.coach = coachMap.get(sc.coach_id) as ScheduledClass['coach']
      }
    }

    // Booking counts
    const classIds = rawClasses.map(c => c.id)
    if (classIds.length > 0) {
      const { data: countData } = await supabase.from('bookings').select('scheduled_class_id').in('scheduled_class_id', classIds).eq('status', 'confirmed')
      const counts = new Map<string, number>()
      for (const row of countData ?? []) counts.set(row.scheduled_class_id, (counts.get(row.scheduled_class_id) ?? 0) + 1)
      setBookingCounts(counts)
    }

    // Waitlist
    const wlMap = new Map<string, { id: string; position: number; status: string }>()
    for (const w of waitlistRes.data ?? []) wlMap.set(w.scheduled_class_id, { id: w.id, position: w.position, status: w.status })
    setUserWaitlist(wlMap)

    setClasses(rawClasses)
    setUserBookings(new Set((bookingsRes.data ?? []).map((b) => b.scheduled_class_id)))
    setLoading(false)
  }

  useEffect(() => { fetchData() }, [currentDate, user])

  // ---- Booking handlers ----
  const handleBook = async (classId: string) => {
    if (!user) return
    setBookingInProgress(classId)
    const scheduledClass = classes.find((c) => c.id === classId)
    if (!scheduledClass?.class_type) { setBookingInProgress(null); return }
    if (new Date(scheduledClass.starts_at) < new Date()) { toast.error(isFr ? 'Ce cours est déjà passé' : 'This class has already passed'); setBookingInProgress(null); return }

    const { data: credits } = await supabase.rpc('get_available_credits', {
      p_user_id: user.id, p_credit_type_id: scheduledClass.class_type.credit_type_id,
    })
    if (!credits || credits.length === 0) { toast.error(t('schedule.noCredits')); setBookingInProgress(null); return }

    const packPurchaseId = credits[0].pack_purchase_id
    const { error } = await supabase.from('bookings').insert({ scheduled_class_id: classId, user_id: user.id, pack_purchase_id: packPurchaseId })
    if (error) { toast.error(error.message); setBookingInProgress(null); return }

    await supabase.rpc('consume_credit', { p_pack_purchase_id: packPurchaseId })
    await logActivity({
      action: 'booking_created', actor_id: user.id, target_user_id: user.id, entity_type: 'booking',
      details: { class_name: scheduledClass.class_type?.name, starts_at: scheduledClass.starts_at },
      description: `Réservation: ${scheduledClass.class_type?.name} le ${format(new Date(scheduledClass.starts_at), 'dd/MM/yyyy HH:mm')}`,
    })
    setUserBookings((prev) => new Set([...prev, classId]))
    setBookingCounts(prev => { const n = new Map(prev); n.set(classId, (n.get(classId) ?? 0) + 1); return n })
    toast.success(t('schedule.bookingConfirmed'))
    setBookingInProgress(null)
  }

  const handleJoinWaitlist = async (classId: string) => {
    if (!user) return
    const sc = classes.find(c => c.id === classId)
    if (sc && new Date(sc.starts_at) < new Date()) return
    setBookingInProgress(classId)
    const { data: posData } = await supabase.rpc('next_waitlist_position', { p_scheduled_class_id: classId })
    const position = posData ?? 1
    const { error } = await supabase.from('waitlist').insert({ scheduled_class_id: classId, user_id: user.id, position })
    if (error) { toast.error(error.message) } else {
      const sc = classes.find(c => c.id === classId)
      await logActivity({
        action: 'waitlist_joined', actor_id: user.id, target_user_id: user.id, entity_type: 'scheduled_class', entity_id: classId,
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
    await supabase.from('waitlist').update({ status: 'cancelled' }).eq('scheduled_class_id', classId).eq('user_id', user.id).in('status', ['waiting', 'offered'])
    setUserWaitlist(prev => { const n = new Map(prev); n.delete(classId); return n })
    toast.success(t('schedule.waitlistLeft'))
  }

  const handleConfirmWaitlistSpot = async (classId: string) => {
    if (!user) return
    setBookingInProgress(classId)
    const scheduledClass = classes.find((c) => c.id === classId)
    if (!scheduledClass?.class_type) { setBookingInProgress(null); return }
    if (new Date(scheduledClass.starts_at) < new Date()) { toast.error(isFr ? 'Ce cours est déjà passé' : 'This class has already passed'); setBookingInProgress(null); return }
    const { data: credits } = await supabase.rpc('get_available_credits', { p_user_id: user.id, p_credit_type_id: scheduledClass.class_type.credit_type_id })
    if (!credits || credits.length === 0) { toast.error(t('schedule.noCredits')); setBookingInProgress(null); return }
    const packPurchaseId = credits[0].pack_purchase_id
    const { error } = await supabase.from('bookings').insert({ scheduled_class_id: classId, user_id: user.id, pack_purchase_id: packPurchaseId })
    if (error) { toast.error(error.message); setBookingInProgress(null); return }
    await supabase.rpc('consume_credit', { p_pack_purchase_id: packPurchaseId })
    await supabase.from('waitlist').update({ status: 'confirmed' }).eq('scheduled_class_id', classId).eq('user_id', user.id)
    setUserBookings((prev) => new Set([...prev, classId]))
    setUserWaitlist(prev => { const n = new Map(prev); n.delete(classId); return n })
    toast.success(t('schedule.spotConfirmed'))
    setBookingInProgress(null)
  }

  // ---- Render helpers ----
  const getClassesForDay = (day: Date) => classes.filter((sc) => isSameDay(new Date(sc.starts_at), day))

  const ClassCard = ({ sc }: { sc: ScheduledClass }) => {
    const startsAt = new Date(sc.starts_at)
    const isPast = startsAt < new Date()
    const isBooked = userBookings.has(sc.id)
    const waitlistEntry = userWaitlist.get(sc.id)
    const isOnWaitlist = !!waitlistEntry
    const isOffered = waitlistEntry?.status === 'offered'
    const spotsUsed = bookingCounts.get(sc.id) ?? 0
    const spotsFree = sc.max_participants - spotsUsed
    const isFull = spotsFree <= 0
    const isBooking = bookingInProgress === sc.id
    const creditName = sc.class_type?.credit_type?.name ?? 'default'
    const creditLabel = isFr ? sc.class_type?.credit_type?.label_fr : sc.class_type?.credit_type?.label_en
    const badge = CREDIT_BADGE[creditName] || DEFAULT_BADGE
    const spotsPercent = Math.min((spotsUsed / sc.max_participants) * 100, 100)

    return (
      <motion.div
        layout
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className={cn(
          'rounded-xl border border-border bg-card p-4 transition-all',
          isPast && 'opacity-50',
          !isPast && 'hover:border-primary/40',
          isBooked && !isPast && 'border-primary/50 bg-primary/5',
          isOffered && !isPast && 'border-orange-400/50'
        )}
      >
        {/* Header: name + badge */}
        <div className="flex items-start justify-between mb-3">
          <h3 className="font-bold text-base">{sc.title || sc.class_type?.name}</h3>
          <span className={cn('text-[11px] font-semibold px-2.5 py-0.5 rounded-full', badge.bg, badge.text)}>
            {creditLabel}
          </span>
        </div>

        {/* Coach */}
        {sc.coach && (
          <p className="text-sm text-muted-foreground flex items-center gap-1.5 mb-2">
            <Users className="h-3.5 w-3.5" />
            {sc.coach.display_name}
          </p>
        )}

        {/* Time + Duration + Credits */}
        <div className="flex items-center gap-3 text-sm text-muted-foreground mb-3">
          <span className="flex items-center gap-1">
            <Clock className="h-3.5 w-3.5" />
            {format(startsAt, 'HH:mm')} · {sc.duration_minutes}min
          </span>
          <span className="flex items-center gap-1">
            <Zap className="h-3.5 w-3.5" />
            1 {isFr ? 'crédit' : 'credit'}
          </span>
        </div>

        {/* Spots progress bar + action */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
              <div
                className={cn(
                  'h-full rounded-full transition-all',
                  isFull ? 'bg-destructive' : 'bg-primary'
                )}
                style={{ width: `${spotsPercent}%` }}
              />
            </div>
            <span className={cn('text-xs whitespace-nowrap', isFull ? 'text-destructive font-medium' : 'text-muted-foreground')}>
              {isFull ? (isFr ? 'Complet' : 'Full') : `${spotsFree} ${isFr ? 'places' : 'spots'}`}
            </span>
          </div>

          {/* Action button */}
          {isPast ? (
            <span className="text-xs text-muted-foreground">
              {isBooked ? (
                <span className="flex items-center gap-1 text-primary/60">
                  <Check className="h-3.5 w-3.5" />
                  {t('schedule.booked')}
                </span>
              ) : (
                isFr ? 'Terminé' : 'Past'
              )}
            </span>
          ) : isBooked ? (
            <span className="flex items-center gap-1 text-xs font-medium text-primary">
              <Check className="h-3.5 w-3.5" />
              {t('schedule.booked')}
            </span>
          ) : isOffered ? (
            <Button
              size="sm"
              className="rounded-full px-3 h-7 text-xs font-semibold bg-orange-500 hover:bg-orange-600 text-white"
              onClick={() => handleConfirmWaitlistSpot(sc.id)}
              disabled={isBooking}
            >
              {isBooking ? '...' : t('schedule.confirmSpot')}
            </Button>
          ) : isOnWaitlist ? (
            <div className="flex items-center gap-1">
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <Clock3 className="h-3 w-3" />
                {t('schedule.onWaitlist', { position: waitlistEntry.position })}
              </span>
              <button onClick={() => handleLeaveWaitlist(sc.id)} className="text-muted-foreground hover:text-foreground">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : isFull ? (
            <Button
              size="sm"
              variant="outline"
              className="rounded-full px-3 h-7 text-xs font-semibold border-primary/50 text-primary hover:bg-primary/10"
              onClick={() => handleJoinWaitlist(sc.id)}
              disabled={isBooking}
            >
              {isBooking ? '...' : t('schedule.joinWaitlist')}
            </Button>
          ) : (
            <Button
              size="sm"
              variant="outline"
              className="rounded-full px-3 h-7 text-xs font-semibold border-primary text-primary hover:bg-primary hover:text-primary-foreground"
              onClick={() => handleBook(sc.id)}
              disabled={isBooking}
            >
              {isBooking ? '...' : t('schedule.book')}
            </Button>
          )}
        </div>
      </motion.div>
    )
  }

  if (loading) return <LoadingState />

  // Classes grouped by day for list view
  const classesByDay = weekDays.map((day) => ({
    day,
    classes: getClassesForDay(day),
  })).filter(({ classes: c }) => c.length > 0)

  return (
    <div className="space-y-6">
      {/* Title */}
      <div>
        <h1 className="text-3xl font-bold">
          {isFr ? 'Planning ' : 'Class '}
          <span className="text-primary">{isFr ? 'des cours' : 'Schedule'}</span>
        </h1>
        <p className="text-muted-foreground mt-1">
          {isFr ? 'Réserve ta place et viens transpirer 💪' : 'Book your spot and come sweat 💪'}
        </p>
      </div>

      {/* Week nav + view toggle */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setCurrentDate((d) => addDays(d, -7))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <button
            onClick={() => setCurrentDate(new Date())}
            className="text-sm font-medium hover:text-primary transition-colors"
          >
            {format(weekStart, 'dd MMM', { locale })} — {format(addDays(weekStart, 6), 'dd MMM yyyy', { locale })}
          </button>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setCurrentDate((d) => addDays(d, 7))}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex rounded-lg border overflow-hidden">
          <button
            className={cn('flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors', viewMode === 'week' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted')}
            onClick={() => setViewMode('week')}
          >
            <LayoutGrid className="h-3.5 w-3.5" />
            {isFr ? 'Semaine' : 'Week'}
          </button>
          <button
            className={cn('flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors', viewMode === 'list' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted')}
            onClick={() => setViewMode('list')}
          >
            <List className="h-3.5 w-3.5" />
            {isFr ? 'Liste' : 'List'}
          </button>
        </div>
      </div>

      {viewMode === 'week' ? (
        <>
          {/* Day tabs */}
          <div className="flex gap-2 overflow-x-auto pb-1">
            {weekDays.map((day, idx) => {
              const dayClasses = getClassesForDay(day)
              const isSelected = selectedDayIndex === idx
              const today = isToday(day)
              return (
                <button
                  key={day.toISOString()}
                  onClick={() => setSelectedDayIndex(idx)}
                  className={cn(
                    'flex flex-col items-center min-w-[80px] px-4 py-2.5 rounded-xl border text-sm transition-all',
                    isSelected
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border hover:border-muted-foreground/30',
                    today && !isSelected && 'border-primary/30'
                  )}
                >
                  <span className="font-semibold capitalize">{format(day, 'EEE', { locale })}</span>
                  <span className="text-xs text-muted-foreground mt-0.5">
                    {dayClasses.length} {isFr ? 'cours' : dayClasses.length === 1 ? 'class' : 'classes'}
                  </span>
                </button>
              )
            })}
          </div>

          {/* Classes grid for selected day */}
          <AnimatePresence mode="wait">
            <motion.div
              key={selectedDayIndex}
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              transition={{ duration: 0.15 }}
            >
              {getClassesForDay(weekDays[selectedDayIndex]).length === 0 ? (
                <EmptyState icon={CalendarDays} message={t('schedule.noClasses')} />
              ) : (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {getClassesForDay(weekDays[selectedDayIndex]).map((sc) => (
                    <ClassCard key={sc.id} sc={sc} />
                  ))}
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </>
      ) : (
        /* LIST VIEW */
        <div className="space-y-6">
          <AnimatePresence>
            {classesByDay.length === 0 ? (
              <EmptyState icon={CalendarDays} message={t('schedule.noClasses')} />
            ) : (
              classesByDay.map(({ day, classes: dayClasses }) => (
                <motion.div key={day.toISOString()} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                  <h2 className="text-lg font-bold capitalize mb-3">
                    {format(day, 'EEEE', { locale })}
                    {isToday(day) && <span className="text-primary ml-2 text-sm font-normal">({isFr ? "aujourd'hui" : 'today'})</span>}
                  </h2>
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {dayClasses.map((sc) => (
                      <ClassCard key={sc.id} sc={sc} />
                    ))}
                  </div>
                </motion.div>
              ))
            )}
          </AnimatePresence>
        </div>
      )}
    </div>
  )
}

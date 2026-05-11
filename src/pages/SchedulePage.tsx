import { useEffect, useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { logActivity } from '@/lib/activity-log'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { EmptyState } from '@/components/common/EmptyState'
import { LoadingState } from '@/components/common/LoadingState'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { CalendarDays, ChevronLeft, ChevronRight, List, LayoutGrid, Calendar, Users, Check, Clock3, X, Clock, Lock, Ban, UserMinus, UserPlus, Info, SlidersHorizontal } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import { toast } from 'sonner'
import { sendEmail } from '@/lib/send-email'
import { addDays, startOfWeek, format, isSameDay, isToday } from 'date-fns'
import { fr, enUS } from 'date-fns/locale'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'
import type { ScheduledClass, Booking } from '@/types'

type ViewMode = 'day' | 'week' | 'list'

interface BookingRules {
  morning_cutoff_hour: number
  morning_class_before_hour: number
  afternoon_hours_before_no_bookings: number
  afternoon_minutes_before_with_bookings: number
  cancellation_free_hours: number
}

const DEFAULT_RULES: BookingRules = {
  morning_cutoff_hour: 20,
  morning_class_before_hour: 12,
  afternoon_hours_before_no_bookings: 3,
  afternoon_minutes_before_with_bookings: 30,
  cancellation_free_hours: 12,
}

// Check if booking is closed for a class (client-side check, server validates too)
function isBookingClosed(sc: ScheduledClass, bookingsCount: number, rules: BookingRules): boolean {
  const now = new Date()
  const startsAt = new Date(sc.starts_at)
  if (startsAt <= now) return true

  // Get hour in Brussels timezone
  const brusselsHour = parseInt(startsAt.toLocaleString('en-US', { hour: 'numeric', hour12: false, timeZone: 'Europe/Brussels' }))

  if (brusselsHour < rules.morning_class_before_hour) {
    // Morning class: closed the day before at cutoff hour
    const cutoff = new Date(startsAt)
    cutoff.setDate(cutoff.getDate() - 1)
    cutoff.setHours(rules.morning_cutoff_hour, 0, 0, 0)
    return now > cutoff
  } else {
    // Afternoon/evening class
    if (bookingsCount === 0) {
      const cutoff = new Date(startsAt.getTime() - rules.afternoon_hours_before_no_bookings * 3600000)
      return now > cutoff
    } else {
      const cutoff = new Date(startsAt.getTime() - rules.afternoon_minutes_before_with_bookings * 60000)
      return now > cutoff
    }
  }
}

export function SchedulePage() {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const { user, profile, roles, hasRegistrationFee, hasUsedTrial, refreshProfile } = useAuth()
  const locale = i18n.language === 'fr' ? fr : enUS
  const isFr = i18n.language === 'fr'
  const [classes, setClasses] = useState<ScheduledClass[]>([])
  const [userBookings, setUserBookings] = useState<Set<string>>(new Set())
  const [userWaitlist, setUserWaitlist] = useState<Map<string, { id: string; position: number; status: string }>>(new Map())
  const [bookingCounts, setBookingCounts] = useState<Map<string, number>>(new Map())
  const [loading, setLoading] = useState(true)
  const [bookingInProgress, setBookingInProgress] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<ViewMode>('day')
  const [currentDate, setCurrentDate] = useState(new Date())
  const [selectedDayIndex, setSelectedDayIndex] = useState(0)
  const [bookingRules, setBookingRules] = useState<BookingRules>(DEFAULT_RULES)
  const [roomNames, setRoomNames] = useState<Record<string, string>>({ haut: 'Back On Track Upstairs', bas: 'Back On Track Studio' })
  const [swipeDirection, setSwipeDirection] = useState(0)
  const [filterOpen, setFilterOpen] = useState(false)

  // Filters
  const [filterClassType, setFilterClassType] = useState<string>('all')
  const [filterCoach, setFilterCoach] = useState<string>('all')

  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 })
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))
  // Day view: 7 days starting from currentDate (today by default), Technogym-style
  const dayViewDays = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(currentDate, i)),
    [currentDate]
  )

  // Extract unique class types and coaches for filters
  const classTypes = useMemo(() => {
    const types = new Map<string, { id: string; name: string; color: string }>()
    for (const sc of classes) {
      if (sc.class_type) types.set(sc.class_type.id, { id: sc.class_type.id, name: sc.class_type.name, color: sc.class_type.color })
    }
    return [...types.values()]
  }, [classes])

  const coaches = useMemo(() => {
    const coachMap = new Map<string, string>()
    for (const sc of classes) {
      if (sc.coach) coachMap.set(sc.coach.id, sc.coach.display_name)
    }
    return [...coachMap.entries()].map(([id, name]) => ({ id, name }))
  }, [classes])

  // Filtered classes
  const filteredClasses = useMemo(() => {
    return classes.filter(sc => {
      if (filterClassType !== 'all' && sc.class_type_id !== filterClassType) return false
      if (filterCoach !== 'all' && sc.coach_id !== filterCoach) return false
      return true
    })
  }, [classes, filterClassType, filterCoach])

  const fetchData = async () => {
    setLoading(true)
    const from = weekStart.toISOString()
    // Fetch 14 days to cover day view which can span past weekStart+7
    const to = addDays(weekStart, 14).toISOString()

    const [classesRes, bookingsRes, waitlistRes, rulesRes, roomNamesRes] = await Promise.all([
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
      supabase.from('app_settings').select('value').eq('key', 'booking_rules').single(),
      supabase.from('app_settings').select('value').eq('key', 'room_names').single(),
    ])

    if (rulesRes.data?.value) {
      setBookingRules({ ...DEFAULT_RULES, ...(rulesRes.data.value as Partial<BookingRules>) })
    }
    if (roomNamesRes.data?.value) {
      setRoomNames(prev => ({ ...prev, ...(roomNamesRes.data.value as Record<string, string>) }))
    }

    const rawClasses = (classesRes.data as ScheduledClass[]) ?? []

    // Fetch coach profiles
    const coachIds = [...new Set(rawClasses.map(c => c.coach_id).filter(Boolean))]
    if (coachIds.length > 0) {
      const { data: coachData } = await supabase.from('profiles').select('id, display_name, avatar_url').in('id', coachIds)
      const coachMap = new Map((coachData ?? []).map(c => [c.id, c]))
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

  // Build email vars from a scheduled class
  const classEmailVars = (sc: ScheduledClass, userName?: string) => ({
    user_name: userName,
    class_name: sc.title || sc.class_type?.name,
    class_date: format(new Date(sc.starts_at), "EEEE dd MMMM 'à' HH:mm", { locale: fr }),
    coach_name: sc.coach?.display_name,
    room_name: sc.floor ? (roomNames[sc.floor] || sc.floor) : undefined,
    duration_minutes: sc.duration_minutes,
  })

  // ---- Booking handlers ----
  const handleBook = async (classId: string) => {
    if (!user) return
    setBookingInProgress(classId)
    const scheduledClass = classes.find((c) => c.id === classId)
    if (!scheduledClass?.class_type) { setBookingInProgress(null); return }

    // Server-side check
    const { data: checkResult } = await supabase.rpc('can_book_class', { p_class_id: classId, p_user_id: user.id })
    if (checkResult && !checkResult.can_book) {
      const reason = checkResult.reason as string
      const messages: Record<string, string> = {
        class_past: isFr ? 'Ce cours est déjà passé' : 'This class has already passed',
        class_cancelled: isFr ? 'Ce cours est annulé' : 'This class is cancelled',
        already_booked: isFr ? 'Vous êtes déjà inscrit' : 'You are already booked',
        class_full: isFr ? 'Ce cours est complet' : 'This class is full',
        booking_closed: isFr ? 'Les réservations sont fermées pour ce cours' : 'Bookings are closed for this class',
      }
      toast.error(messages[reason] || t('common.error'))
      setBookingInProgress(null)
      return
    }

    const { data: credits } = await supabase.rpc('get_available_credits', {
      p_user_id: user.id, p_credit_type_id: scheduledClass.class_type.credit_type_id,
    })
    if (!credits || credits.length === 0) { toast.error(t('schedule.noCredits')); setBookingInProgress(null); return }

    const packPurchaseId = credits[0].pack_purchase_id

    // Reactivate cancelled booking if one exists, else insert new
    const { data: reactivated } = await supabase
      .from('bookings')
      .update({ status: 'confirmed', pack_purchase_id: packPurchaseId, cancelled_at: null })
      .eq('scheduled_class_id', classId)
      .eq('user_id', user.id)
      .eq('status', 'cancelled')
      .select()
      .maybeSingle()

    if (!reactivated) {
      const { error } = await supabase.from('bookings').insert({ scheduled_class_id: classId, user_id: user.id, pack_purchase_id: packPurchaseId })
      if (error) { toast.error(error.message); setBookingInProgress(null); return }
    }

    await supabase.rpc('consume_credit', { p_pack_purchase_id: packPurchaseId })
    await logActivity({
      action: 'booking_created', actor_id: user.id, target_user_id: user.id, entity_type: 'booking',
      details: { class_name: scheduledClass.class_type?.name, starts_at: scheduledClass.starts_at },
      description: `Réservation: ${scheduledClass.class_type?.name} le ${format(new Date(scheduledClass.starts_at), 'dd/MM/yyyy HH:mm')}`,
    })
    setUserBookings((prev) => new Set([...prev, classId]))
    setBookingCounts(prev => { const n = new Map(prev); n.set(classId, (n.get(classId) ?? 0) + 1); return n })

    // Email confirmation (self-booking, optional)
    if (profile?.email_on_self_booking && user.email) {
      sendEmail('booking_confirmed', user.email, classEmailVars(scheduledClass, profile.display_name))
    }

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

    const { data: reactivated } = await supabase
      .from('bookings')
      .update({ status: 'confirmed', pack_purchase_id: packPurchaseId, cancelled_at: null })
      .eq('scheduled_class_id', classId)
      .eq('user_id', user.id)
      .eq('status', 'cancelled')
      .select()
      .maybeSingle()

    if (!reactivated) {
      const { error } = await supabase.from('bookings').insert({ scheduled_class_id: classId, user_id: user.id, pack_purchase_id: packPurchaseId })
      if (error) { toast.error(error.message); setBookingInProgress(null); return }
    }

    await supabase.rpc('consume_credit', { p_pack_purchase_id: packPurchaseId })
    await supabase.from('waitlist').update({ status: 'confirmed' }).eq('scheduled_class_id', classId).eq('user_id', user.id)
    setUserBookings((prev) => new Set([...prev, classId]))
    setUserWaitlist(prev => { const n = new Map(prev); n.delete(classId); return n })

    if (profile?.email_on_self_booking && user.email) {
      sendEmail('booking_confirmed', user.email, classEmailVars(scheduledClass, profile.display_name))
    }

    toast.success(t('schedule.spotConfirmed'))
    setBookingInProgress(null)
  }

  // ---- Trial session handler ----
  const handleTrialBooking = async (classId: string) => {
    if (!user) return
    setBookingInProgress(classId)
    const sc = classes.find((c) => c.id === classId)
    if (!sc) { setBookingInProgress(null); return }
    if (new Date(sc.starts_at) < new Date()) { toast.error(isFr ? 'Ce cours est déjà passé' : 'This class has already passed'); setBookingInProgress(null); return }

    const { error: trialError } = await supabase.from('trial_sessions').insert({
      user_id: user.id,
      scheduled_class_id: classId,
    })
    if (trialError) {
      toast.error(trialError.message)
      setBookingInProgress(null)
      return
    }

    await logActivity({
      action: 'trial_booked', actor_id: user.id, target_user_id: user.id, entity_type: 'trial_session',
      details: { class_name: sc.class_type?.name, starts_at: sc.starts_at },
      description: `Séance d'essai: ${sc.class_type?.name} le ${format(new Date(sc.starts_at), 'dd/MM/yyyy HH:mm')}`,
    })

    setBookingCounts(prev => { const n = new Map(prev); n.set(classId, (n.get(classId) ?? 0) + 1); return n })
    setUserBookings((prev) => new Set([...prev, classId]))
    toast.success(isFr ? 'Séance d\'essai réservée !' : 'Trial session booked!')
    refreshProfile()
    setBookingInProgress(null)
  }

  const canUseTrial = user && !hasUsedTrial && !hasRegistrationFee

  // Class info popup
  const [infoClassType, setInfoClassType] = useState<ScheduledClass['class_type'] | null>(null)
  const isStaff = user && (roles.includes('admin') || roles.includes('super_admin') || roles.includes('coach'))

  // ---- Class detail dialog (coach/admin) ----
  const [detailClass, setDetailClass] = useState<ScheduledClass | null>(null)
  const [detailBookings, setDetailBookings] = useState<Booking[]>([])
  const [detailLoading, setDetailLoading] = useState(false)
  const [cancelClassConfirm, setCancelClassConfirm] = useState(false)
  const [addMemberOpen, setAddMemberOpen] = useState(false)
  const [eligibleMembers, setEligibleMembers] = useState<{ user_id: string; display_name: string; credits: number; pack_purchase_id: string }[]>([])
  const [selectedMemberId, setSelectedMemberId] = useState('')
  const [addMemberLoading, setAddMemberLoading] = useState(false)

  const openClassDetail = async (sc: ScheduledClass) => {
    if (!isStaff) return
    setDetailClass(sc)
    setDetailLoading(true)
    setAddMemberOpen(false)

    const { data: bookingData } = await supabase
      .from('bookings')
      .select('*')
      .eq('scheduled_class_id', sc.id)
      .eq('status', 'confirmed')

    const rawBookings = (bookingData as Booking[]) ?? []

    // Fetch profiles separately
    if (rawBookings.length > 0) {
      const userIds = [...new Set(rawBookings.map(b => b.user_id))]
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, display_name, email, phone')
        .in('id', userIds)
      const profileMap = new Map((profiles ?? []).map(p => [p.id, p]))
      for (const b of rawBookings) {
        b.user = profileMap.get(b.user_id) as Booking['user']
      }
    }

    setDetailBookings(rawBookings)
    setDetailLoading(false)
  }

  const handleRemoveBooking = async (booking: Booking) => {
    if (!detailClass || !user) return

    // Cancel booking + refund credit
    const { data: result } = await supabase.rpc('cancel_booking_v2', {
      p_booking_id: booking.id,
      p_user_id: booking.user_id,
    })

    if (result?.error) {
      toast.error(result.error as string)
      return
    }

    await logActivity({
      action: 'booking_cancelled',
      actor_id: user.id,
      target_user_id: booking.user_id,
      entity_type: 'booking',
      entity_id: booking.id,
      details: { class_name: detailClass.class_type?.name, removed_by_admin: true, refunded: result?.refunded },
      description: `Désinscription par ${roles.includes('admin') ? 'admin' : 'coach'}: ${booking.user?.display_name} du cours ${detailClass.class_type?.name}`,
    })

    // In-app notification
    await supabase.from('notifications').insert({
      user_id: booking.user_id,
      title: isFr ? 'Réservation annulée' : 'Booking cancelled',
      message: isFr
        ? `Votre réservation pour ${detailClass.class_type?.name} du ${format(new Date(detailClass.starts_at), 'dd/MM/yyyy HH:mm')} a été annulée par l'équipe.${result?.refunded ? ' Votre crédit a été restitué.' : ''}`
        : `Your booking for ${detailClass.class_type?.name} on ${format(new Date(detailClass.starts_at), 'dd/MM/yyyy HH:mm')} was cancelled by staff.${result?.refunded ? ' Votre crédit a été restitué.' : ''}`,
      type: 'warning',
      link: '/my-bookings',
    })

    // Email (staff-cancel, always sent)
    const { data: memberProfile } = await supabase.from('profiles').select('email, display_name').eq('id', booking.user_id).maybeSingle()
    if (memberProfile?.email) {
      sendEmail('booking_cancelled_by_staff', memberProfile.email, {
        ...classEmailVars(detailClass, memberProfile.display_name ?? booking.user?.display_name),
        refunded: result?.refunded as boolean | undefined,
      })
    }

    setDetailBookings(prev => prev.filter(b => b.id !== booking.id))
    setBookingCounts(prev => {
      const n = new Map(prev)
      n.set(detailClass.id, Math.max(0, (n.get(detailClass.id) ?? 1) - 1))
      return n
    })
    toast.success(isFr
      ? `${booking.user?.display_name} désinscrit(e) — crédit ${result?.refunded ? 'restitué' : 'non restitué'}`
      : `${booking.user?.display_name} removed — credit ${result?.refunded ? 'refunded' : 'not refunded'}`)
  }

  const handleCancelClass = async () => {
    if (!detailClass || !user) return

    // Mark class as cancelled
    await supabase
      .from('scheduled_classes')
      .update({ is_cancelled: true })
      .eq('id', detailClass.id)

    // Cancel all bookings and refund credits
    const userIds = detailBookings.map(b => b.user_id)
    const { data: memberProfiles } = await supabase
      .from('profiles')
      .select('id, display_name, email')
      .in('id', userIds)
    const profileMap = new Map((memberProfiles ?? []).map(p => [p.id, p]))

    for (const booking of detailBookings) {
      await supabase.rpc('cancel_booking_v2', {
        p_booking_id: booking.id,
        p_user_id: booking.user_id,
      })

      // In-app notification
      await supabase.from('notifications').insert({
        user_id: booking.user_id,
        title: isFr ? 'Cours annulé' : 'Class cancelled',
        message: isFr
          ? `Le cours ${detailClass.class_type?.name} du ${format(new Date(detailClass.starts_at), 'EEEE dd/MM à HH:mm', { locale })} a été annulé. Votre crédit a été restitué.`
          : `The class ${detailClass.class_type?.name} on ${format(new Date(detailClass.starts_at), 'EEEE dd/MM HH:mm', { locale })} has been cancelled. Your credit has been refunded.`,
        type: 'error',
        link: '/schedule',
      })

      // Email (class cancel, always sent)
      const p = profileMap.get(booking.user_id)
      if (p?.email) {
        sendEmail('class_cancelled', p.email, classEmailVars(detailClass, p.display_name))
      }
    }

    await logActivity({
      action: 'booking_cancelled',
      actor_id: user.id,
      target_user_id: user.id,
      entity_type: 'scheduled_class',
      entity_id: detailClass.id,
      details: { class_name: detailClass.class_type?.name, cancelled_class: true, members_notified: detailBookings.length },
      description: `Cours annulé: ${detailClass.class_type?.name} du ${format(new Date(detailClass.starts_at), 'dd/MM/yyyy HH:mm')} — ${detailBookings.length} membre(s) notifié(s)`,
    })

    toast.success(isFr
      ? `Cours annulé — ${detailBookings.length} membre(s) notifié(s) et crédits restitués`
      : `Class cancelled — ${detailBookings.length} member(s) notified and credits refunded`)

    setCancelClassConfirm(false)
    setDetailClass(null)
    fetchData()
  }

  const openAddMember = async () => {
    if (!detailClass) return
    setAddMemberLoading(true)
    setAddMemberOpen(true)
    setSelectedMemberId('')

    const creditTypeId = detailClass.class_type?.credit_type_id
    if (!creditTypeId) { setAddMemberLoading(false); return }

    // Get all members with available credits for this credit type
    const { data: packs } = await supabase
      .from('pack_purchases')
      .select('user_id, credits_remaining, expires_at, id, pack_type:pack_types(credit_type_id)')
      .gt('credits_remaining', 0)
      .gt('expires_at', new Date().toISOString())
      .order('expires_at', { ascending: true })

    if (!packs) { setAddMemberLoading(false); return }

    // Filter by correct credit type and exclude already booked members
    // For each member: sum total credits, use pack expiring soonest for booking
    const bookedUserIds = new Set(detailBookings.map(b => b.user_id))
    const memberMap = new Map<string, { user_id: string; credits: number; pack_purchase_id: string }>()

    for (const p of packs) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if ((p.pack_type as any)?.credit_type_id !== creditTypeId) continue
      if (bookedUserIds.has(p.user_id)) continue
      const existing = memberMap.get(p.user_id)
      if (!existing) {
        // First pack for this user (earliest expiry due to ORDER BY)
        memberMap.set(p.user_id, { user_id: p.user_id, credits: p.credits_remaining, pack_purchase_id: p.id })
      } else {
        // Add credits from additional packs
        existing.credits += p.credits_remaining
      }
    }

    // Fetch profiles for eligible members
    const userIds = [...memberMap.keys()]
    if (userIds.length > 0) {
      const { data: profiles } = await supabase.from('profiles').select('id, display_name').in('id', userIds)
      const result = (profiles ?? []).map(p => ({
        user_id: p.id,
        display_name: p.display_name,
        credits: memberMap.get(p.id)!.credits,
        pack_purchase_id: memberMap.get(p.id)!.pack_purchase_id,
      }))
      result.sort((a, b) => a.display_name.localeCompare(b.display_name))
      setEligibleMembers(result)
    } else {
      setEligibleMembers([])
    }

    setAddMemberLoading(false)
  }

  const handleAddMember = async () => {
    if (!detailClass || !selectedMemberId || !user) return
    const member = eligibleMembers.find(m => m.user_id === selectedMemberId)
    if (!member) return

    setAddMemberLoading(true)

    const { data: reactivated } = await supabase
      .from('bookings')
      .update({ status: 'confirmed', pack_purchase_id: member.pack_purchase_id, cancelled_at: null })
      .eq('scheduled_class_id', detailClass.id)
      .eq('user_id', member.user_id)
      .eq('status', 'cancelled')
      .select()
      .maybeSingle()

    if (!reactivated) {
      const { error } = await supabase.from('bookings').insert({
        scheduled_class_id: detailClass.id,
        user_id: member.user_id,
        pack_purchase_id: member.pack_purchase_id,
      })
      if (error) {
        toast.error(error.message)
        setAddMemberLoading(false)
        return
      }
    }

    await supabase.rpc('consume_credit', { p_pack_purchase_id: member.pack_purchase_id })

    await logActivity({
      action: 'booking_assigned',
      actor_id: user.id,
      target_user_id: member.user_id,
      entity_type: 'booking',
      details: { class_name: detailClass.class_type?.name, starts_at: detailClass.starts_at },
      description: `${member.display_name} inscrit au cours ${detailClass.class_type?.name} du ${format(new Date(detailClass.starts_at), 'dd/MM/yyyy HH:mm')}`,
    })

    // In-app notification
    await supabase.from('notifications').insert({
      user_id: member.user_id,
      title: isFr ? 'Inscription à un cours' : 'Class booking',
      message: isFr
        ? `Vous avez été inscrit(e) au cours ${detailClass.class_type?.name} du ${format(new Date(detailClass.starts_at), 'EEEE dd/MM à HH:mm', { locale })}.`
        : `You have been booked for ${detailClass.class_type?.name} on ${format(new Date(detailClass.starts_at), 'EEEE dd/MM HH:mm', { locale })}.`,
      type: 'success',
      link: '/my-bookings',
    })

    // Email (staff-booking, always sent) — fetch member email
    const { data: memberProfile } = await supabase.from('profiles').select('email').eq('id', member.user_id).maybeSingle()
    if (memberProfile?.email) {
      sendEmail('booking_created_by_staff', memberProfile.email, classEmailVars(detailClass, member.display_name))
    }

    toast.success(isFr ? `${member.display_name} inscrit(e) !` : `${member.display_name} booked!`)
    setAddMemberOpen(false)
    setAddMemberLoading(false)

    // Refresh bookings in detail dialog
    await openClassDetail(detailClass)
    setBookingCounts(prev => {
      const n = new Map(prev)
      n.set(detailClass.id, (n.get(detailClass.id) ?? 0) + 1)
      return n
    })
  }

  // ---- Render helpers ----
  const getClassesForDay = (day: Date) => filteredClasses.filter((sc) => isSameDay(new Date(sc.starts_at), day))

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
    const classColor = sc.class_type?.color || '#3B82F6'
    const closed = !isPast && !isBooked && !isOnWaitlist && isBookingClosed(sc, spotsUsed, bookingRules)

    const availabilityText = isPast
      ? (isFr ? 'Terminé' : 'Past')
      : isFull
        ? (isFr ? 'Cours complet' : 'Class full')
        : isFr
          ? `${spotsFree} place${spotsFree > 1 ? 's' : ''} disponible${spotsFree > 1 ? 's' : ''}`
          : `${spotsFree} spot${spotsFree > 1 ? 's' : ''} available`

    const renderAction = () => {
      if (isStaff) return (
        <Button size="sm" variant="outline" className="rounded-full h-8 text-xs font-semibold"
          onClick={(e) => { e.stopPropagation(); openClassDetail(sc) }}>
          <Users className="h-3 w-3 mr-1" />{isFr ? 'Détail' : 'Detail'}
        </Button>
      )
      if (isPast) return isBooked ? (
        <span className="flex items-center gap-1 text-xs text-primary/70">
          <Check className="h-3.5 w-3.5" />{t('schedule.booked')}
        </span>
      ) : null
      if (isBooked) return (
        <span className="flex items-center gap-1 text-xs font-semibold text-primary">
          <Check className="h-4 w-4" />{t('schedule.booked')}
        </span>
      )
      if (isOffered) return (
        <Button size="sm" className="rounded-full h-8 text-xs font-bold bg-orange-500 hover:bg-orange-600 text-white"
          onClick={(e) => { e.stopPropagation(); handleConfirmWaitlistSpot(sc.id) }} disabled={isBooking}>
          {isBooking ? '...' : t('schedule.confirmSpot')}
        </Button>
      )
      if (isOnWaitlist) return (
        <div className="flex items-center gap-1">
          <span className="text-xs text-muted-foreground flex items-center gap-1">
            <Clock3 className="h-3 w-3" />
            {t('schedule.onWaitlist', { position: waitlistEntry.position })}
          </span>
          <button onClick={(e) => { e.stopPropagation(); handleLeaveWaitlist(sc.id) }} className="text-muted-foreground hover:text-foreground">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )
      if (closed) return (
        <span className="flex items-center gap-1 text-xs text-muted-foreground">
          <Lock className="h-3 w-3" />{isFr ? 'Fermé' : 'Closed'}
        </span>
      )
      if (isFull) return (
        <Button size="sm" variant="outline"
          className="rounded-full h-8 text-xs font-bold border-primary/50 text-primary hover:bg-primary/10"
          onClick={(e) => { e.stopPropagation(); handleJoinWaitlist(sc.id) }} disabled={isBooking}>
          {isBooking ? '...' : (isFr ? 'Liste d\'attente' : 'Waitlist')}
        </Button>
      )
      if (canUseTrial) return (
        <Button size="sm"
          className="rounded-full h-8 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white px-4"
          onClick={(e) => { e.stopPropagation(); handleTrialBooking(sc.id) }} disabled={isBooking}>
          {isBooking ? '...' : (isFr ? 'Essai gratuit' : 'Free trial')}
        </Button>
      )
      return (
        <Button size="sm"
          className="rounded-full h-8 text-xs font-bold bg-foreground hover:bg-foreground/90 text-background px-4 uppercase tracking-wide"
          onClick={(e) => { e.stopPropagation(); handleBook(sc.id) }} disabled={isBooking}>
          {isBooking ? '...' : (isFr ? 'Réserver' : 'Book')}
        </Button>
      )
    }

    const clientCanOpenBookings = !isStaff && isBooked && !isPast

    return (
      <motion.div
        layout
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className={cn(
          'flex rounded-2xl border bg-card overflow-hidden transition-all',
          isPast && 'opacity-60',
          !isPast && !isBooked && 'hover:border-primary/40',
          isBooked && !isPast && 'ring-1 ring-primary/30 hover:bg-muted/40',
          isOffered && !isPast && 'ring-1 ring-orange-400/50',
          (isStaff || clientCanOpenBookings) && 'cursor-pointer'
        )}
        onClick={
          isStaff
            ? () => openClassDetail(sc)
            : clientCanOpenBookings
              ? () => navigate('/my-bookings')
              : undefined
        }
      >
        {/* Left: image */}
        <div className="relative w-20 sm:w-28 shrink-0 bg-muted">
          {sc.class_type?.image_url ? (
            <img
              src={sc.class_type.image_url}
              alt={sc.class_type.name}
              className="absolute inset-0 w-full h-full object-cover"
            />
          ) : (
            <div
              className="absolute inset-0 flex items-center justify-center"
              style={{ background: `linear-gradient(135deg, ${classColor}cc, ${classColor}66)` }}
            >
              <span className="text-white/80 font-bold text-lg">
                {(sc.class_type?.name || 'C').charAt(0)}
              </span>
            </div>
          )}
          <div className="absolute left-0 top-0 bottom-0 w-1" style={{ backgroundColor: classColor }} />
        </div>

        {/* Right: info */}
        <div className="flex-1 p-3 min-w-0 flex flex-col gap-1.5">
          {/* Top: time badge + availability */}
          <div className="flex items-start justify-between gap-2">
            <span className="inline-flex items-center px-2.5 py-1 rounded-md bg-foreground text-background font-bold text-sm leading-none">
              {format(startsAt, 'HH:mm')}
            </span>
            <span className={cn(
              'text-[11px] sm:text-xs text-right leading-tight',
              isFull ? 'text-muted-foreground' : 'text-muted-foreground'
            )}>
              {availabilityText}
            </span>
          </div>

          {/* Title + info icon */}
          <div className="flex items-center gap-1.5 min-w-0">
            <h3 className="font-bold text-base sm:text-lg leading-tight truncate">
              {sc.title || sc.class_type?.name}
            </h3>
            {(sc.class_type?.description_md || sc.class_type?.image_url) && (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); setInfoClassType(sc.class_type!) }}
                className="text-muted-foreground hover:text-primary shrink-0"
              >
                <Info className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Coach · Room */}
          {(sc.coach || sc.floor) && (
            <p className="text-xs sm:text-sm text-muted-foreground truncate">
              {sc.coach?.display_name}
              {sc.coach && sc.floor && <span className="mx-1.5">·</span>}
              {sc.floor && (isStaff ? sc.floor : (roomNames[sc.floor] || sc.floor))}
            </p>
          )}

          {/* Bottom: duration + action */}
          <div className="flex items-end justify-between gap-2 mt-auto pt-1">
            <span className="text-xs text-muted-foreground font-medium">
              {sc.duration_minutes} min
            </span>
            {renderAction()}
          </div>
        </div>
      </motion.div>
    )
  }

  if (loading) return <LoadingState />

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
          {isFr ? 'Réserve ta place et viens transpirer' : 'Book your spot and come sweat'}
        </p>
      </div>

      {/* Week nav + view toggle */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" className="h-8 w-8"
            onClick={() => { setSwipeDirection(-1); setCurrentDate((d) => addDays(d, -7)) }}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <button
            onClick={() => { setSwipeDirection(0); setCurrentDate(new Date()); setSelectedDayIndex(0) }}
            className="text-sm font-medium hover:text-primary transition-colors"
          >
            {viewMode === 'day'
              ? `${format(dayViewDays[0], 'dd MMM', { locale })} — ${format(dayViewDays[6], 'dd MMM yyyy', { locale })}`
              : `${format(weekStart, 'dd MMM', { locale })} — ${format(addDays(weekStart, 6), 'dd MMM yyyy', { locale })}`}
          </button>
          <Button variant="ghost" size="icon" className="h-8 w-8"
            onClick={() => { setSwipeDirection(1); setCurrentDate((d) => addDays(d, 7)) }}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex rounded-lg border overflow-hidden">
          <button
            className={cn('flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors', viewMode === 'day' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted')}
            onClick={() => setViewMode('day')}
          >
            <Calendar className="h-3.5 w-3.5" />
            {isFr ? 'Jour' : 'Day'}
          </button>
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

      {/* Filters — single button opens popup */}
      {(() => {
        const activeCount = (filterClassType !== 'all' ? 1 : 0) + (filterCoach !== 'all' ? 1 : 0)
        return (
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="rounded-full h-9 gap-1.5"
              onClick={() => setFilterOpen(true)}
            >
              <SlidersHorizontal className="h-4 w-4" />
              <span className="text-sm">{isFr ? 'Filtres' : 'Filters'}</span>
              {activeCount > 0 && (
                <Badge variant="default" className="h-5 px-1.5 text-[10px] ml-1">{activeCount}</Badge>
              )}
            </Button>
            {activeCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="h-9 text-xs text-muted-foreground"
                onClick={() => { setFilterClassType('all'); setFilterCoach('all') }}
              >
                <X className="h-3.5 w-3.5 mr-1" />
                {isFr ? 'Réinitialiser' : 'Reset'}
              </Button>
            )}
          </div>
        )
      })()}

      {/* DAY VIEW — Technogym style, swipeable week-by-week */}
      {viewMode === 'day' && (
        <>
          {/* Day tabs — swipe horizontal = change week */}
          <div className="relative overflow-hidden">
            <AnimatePresence mode="popLayout" custom={swipeDirection} initial={false}>
              <motion.div
                key={dayViewDays[0].toDateString()}
                custom={swipeDirection}
                variants={{
                  enter: (dir: number) => ({ x: dir > 0 ? 300 : -300, opacity: 0 }),
                  center: { x: 0, opacity: 1 },
                  exit: (dir: number) => ({ x: dir > 0 ? -300 : 300, opacity: 0 }),
                }}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ type: 'spring', stiffness: 260, damping: 28 }}
                drag="x"
                dragConstraints={{ left: 0, right: 0 }}
                dragElastic={0.3}
                onDragEnd={(_, info) => {
                  const threshold = 60
                  if (info.offset.x < -threshold) {
                    setSwipeDirection(1)
                    setCurrentDate(d => addDays(d, 7))
                  } else if (info.offset.x > threshold) {
                    setSwipeDirection(-1)
                    setCurrentDate(d => addDays(d, -7))
                  }
                }}
                className="flex gap-1 touch-pan-y cursor-grab active:cursor-grabbing"
              >
                {dayViewDays.map((day, idx) => {
                  const isSelected = selectedDayIndex === idx
                  const today = isToday(day)
                  const count = getClassesForDay(day).length
                  return (
                    <button
                      key={idx}
                      onClick={() => setSelectedDayIndex(idx)}
                      className={cn(
                        'flex-1 flex flex-col items-center justify-center min-w-0 py-1 rounded-lg transition-colors select-none',
                        isSelected ? 'bg-foreground text-background' : 'hover:bg-muted/50'
                      )}
                    >
                      <span className="text-[9px] font-medium uppercase tracking-wide opacity-70">
                        {format(day, 'EEE', { locale })}
                      </span>
                      <span className="text-base font-bold leading-none mt-0.5">{format(day, 'd')}</span>
                      <span className={cn(
                        'text-[9px] leading-none mt-0.5',
                        isSelected ? 'opacity-70' : 'text-muted-foreground',
                        count === 0 && 'invisible'
                      )}>
                        {count}
                      </span>
                      {today && (
                        <span className={cn('h-1 w-1 rounded-full mt-0.5', isSelected ? 'bg-background' : 'bg-primary')} />
                      )}
                    </button>
                  )
                })}
              </motion.div>
            </AnimatePresence>
          </div>

          <AnimatePresence mode="wait">
            <motion.div
              key={selectedDayIndex}
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              transition={{ duration: 0.15 }}
            >
              {getClassesForDay(dayViewDays[selectedDayIndex]).length === 0 ? (
                <EmptyState icon={CalendarDays} message={t('schedule.noClasses')} />
              ) : (
                <div className="grid gap-3 lg:grid-cols-2">
                  {getClassesForDay(dayViewDays[selectedDayIndex]).map((sc) => (
                    <ClassCard key={sc.id} sc={sc} />
                  ))}
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </>
      )}

      {/* WEEK VIEW - compact grid */}
      {viewMode === 'week' && (
        <div className="grid grid-cols-7 gap-2">
          {weekDays.map((day) => {
            const dayClasses = getClassesForDay(day)
            const today = isToday(day)
            return (
              <div key={day.toISOString()} className="min-w-0">
                <div className={cn(
                  'text-center py-2 rounded-t-lg border-b mb-2',
                  today && 'bg-primary/10 text-primary font-bold'
                )}>
                  <div className="text-xs font-medium capitalize">{format(day, 'EEE', { locale })}</div>
                  <div className="text-lg font-bold">{format(day, 'd')}</div>
                </div>
                <div className="space-y-2">
                  {dayClasses.length === 0 ? (
                    <p className="text-xs text-muted-foreground text-center py-4">—</p>
                  ) : (
                    dayClasses.map(sc => {
                      const startsAt = new Date(sc.starts_at)
                      const isBooked = userBookings.has(sc.id)
                      const spotsUsed = bookingCounts.get(sc.id) ?? 0
                      const isFull = spotsUsed >= sc.max_participants
                      const classColor = sc.class_type?.color || '#3B82F6'
                      const isPast = startsAt < new Date()
                      return (
                        <button
                          key={sc.id}
                          onClick={() => { setSelectedDayIndex(weekDays.findIndex(d => isSameDay(d, day))); setViewMode('day') }}
                          className={cn(
                            'w-full text-left rounded-lg p-2 border text-xs transition-all hover:shadow-sm',
                            isPast && 'opacity-40',
                            isBooked && !isPast && 'ring-1 ring-primary',
                            isFull && !isBooked && !isPast && 'opacity-60'
                          )}
                          style={{ borderLeftWidth: '3px', borderLeftColor: classColor }}
                        >
                          <div className="font-semibold truncate">{format(startsAt, 'HH:mm')}</div>
                          <div className="truncate text-muted-foreground">{sc.class_type?.name}</div>
                          {sc.floor && <div className="text-muted-foreground/60 truncate">{sc.floor === 'haut' ? '↑' : '↓'}</div>}
                          <div className={cn('mt-0.5', isFull ? 'text-destructive' : '')} style={{ color: isFull ? undefined : classColor }}>
                            {spotsUsed}/{sc.max_participants}
                          </div>
                        </button>
                      )
                    })
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* LIST VIEW */}
      {viewMode === 'list' && (
        <div className="space-y-6">
          <AnimatePresence>
            {classesByDay.length === 0 ? (
              <EmptyState icon={CalendarDays} message={t('schedule.noClasses')} />
            ) : (
              classesByDay.map(({ day, classes: dayClasses }) => (
                <motion.div key={day.toISOString()} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                  <h2 className="text-lg font-bold capitalize mb-3">
                    {format(day, 'EEEE d MMMM', { locale })}
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

      {/* Class Detail Dialog (coach/admin) */}
      {isStaff && (
        <>
          <Dialog open={!!detailClass} onOpenChange={(open) => { if (!open) setDetailClass(null) }}>
            <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
              {detailClass && (
                <>
                  <DialogHeader>
                    <DialogTitle>{detailClass.class_type?.name}</DialogTitle>
                    <p className="text-sm text-muted-foreground">
                      {format(new Date(detailClass.starts_at), 'EEEE dd/MM/yyyy HH:mm', { locale })}
                      {detailClass.coach && ` — ${detailClass.coach.display_name}`}
                      {detailClass.floor && ` — ${roomNames[detailClass.floor] || detailClass.floor}`}
                    </p>
                  </DialogHeader>

                  {/* Stats */}
                  <div className="flex items-center gap-3 py-2">
                    <Badge variant="outline">
                      <Users className="h-3 w-3 mr-1" />
                      {detailBookings.length}/{detailClass.max_participants}
                    </Badge>
                    <Badge variant="outline">
                      <Clock className="h-3 w-3 mr-1" />
                      {detailClass.duration_minutes} min
                    </Badge>
                  </div>

                  {/* Participants list */}
                  {detailLoading ? (
                    <LoadingState />
                  ) : detailBookings.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-4 text-center">
                      {isFr ? 'Aucun inscrit' : 'No participants'}
                    </p>
                  ) : (
                    <div className="space-y-2">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                        {isFr ? 'Inscrits' : 'Participants'}
                      </p>
                      {detailBookings.map((booking, idx) => (
                        <div key={booking.id} className="flex items-center justify-between p-2.5 rounded-lg border">
                          <div className="flex items-center gap-2.5">
                            <span className="text-xs font-medium text-muted-foreground w-5">{idx + 1}</span>
                            <div>
                              <p className="text-sm font-medium">{booking.user?.display_name}</p>
                              <p className="text-xs text-muted-foreground">
                                {booking.user?.phone || booking.user?.email}
                              </p>
                            </div>
                          </div>
                          {new Date(detailClass.starts_at) > new Date() && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 text-xs text-destructive hover:text-destructive hover:bg-destructive/10"
                              onClick={(e) => { e.stopPropagation(); handleRemoveBooking(booking) }}
                            >
                              <UserMinus className="h-3.5 w-3.5 mr-1" />
                              {isFr ? 'Retirer' : 'Remove'}
                            </Button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Add member */}
                  {new Date(detailClass.starts_at) > new Date() && detailBookings.length < detailClass.max_participants && (
                    <div className="pt-3 border-t mt-3">
                      {!addMemberOpen ? (
                        <Button
                          variant="outline"
                          className="w-full"
                          onClick={openAddMember}
                        >
                          <UserPlus className="h-4 w-4 mr-2" />
                          {isFr ? 'Ajouter un membre' : 'Add a member'}
                        </Button>
                      ) : (
                        <div className="space-y-3">
                          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                            {isFr ? 'Ajouter un membre' : 'Add a member'}
                          </p>
                          {addMemberLoading ? (
                            <p className="text-sm text-muted-foreground text-center py-2">...</p>
                          ) : eligibleMembers.length === 0 ? (
                            <p className="text-sm text-muted-foreground text-center py-2">
                              {isFr ? 'Aucun membre avec des crédits disponibles' : 'No members with available credits'}
                            </p>
                          ) : (
                            <>
                              <Select value={selectedMemberId} onValueChange={(v) => setSelectedMemberId(v ?? '')}>
                                <SelectTrigger className="h-auto min-h-[2.5rem] whitespace-normal text-left">
                                  <span className="text-sm">
                                    {selectedMemberId
                                      ? (() => {
                                          const m = eligibleMembers.find(m => m.user_id === selectedMemberId)
                                          return m ? `${m.display_name} (${m.credits} crédits)` : ''
                                        })()
                                      : (isFr ? 'Choisir un membre' : 'Choose a member')}
                                  </span>
                                </SelectTrigger>
                                <SelectContent className="min-w-[350px] max-h-60" sideOffset={4}>
                                  {eligibleMembers.map(m => (
                                    <SelectItem key={m.user_id} value={m.user_id}>
                                      {m.display_name} — {m.credits} {isFr ? 'crédit(s)' : 'credit(s)'}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <div className="flex gap-2">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="flex-1"
                                  onClick={() => setAddMemberOpen(false)}
                                >
                                  {t('common.cancel')}
                                </Button>
                                <Button
                                  size="sm"
                                  className="flex-1"
                                  onClick={handleAddMember}
                                  disabled={!selectedMemberId || addMemberLoading}
                                >
                                  <UserPlus className="h-3.5 w-3.5 mr-1" />
                                  {isFr ? 'Inscrire' : 'Book'}
                                </Button>
                              </div>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Cancel class button */}
                  {new Date(detailClass.starts_at) > new Date() && !detailClass.is_cancelled && (
                    <div className="pt-3 border-t mt-3">
                      <Button
                        variant="destructive"
                        className="w-full"
                        onClick={() => setCancelClassConfirm(true)}
                      >
                        <Ban className="h-4 w-4 mr-2" />
                        {isFr ? 'Annuler ce cours' : 'Cancel this class'}
                      </Button>
                      <p className="text-[11px] text-muted-foreground text-center mt-2">
                        {isFr
                          ? `${detailBookings.length} membre(s) seront notifié(s) et leurs crédits restitués`
                          : `${detailBookings.length} member(s) will be notified and their credits refunded`}
                      </p>
                    </div>
                  )}
                </>
              )}
            </DialogContent>
          </Dialog>

          <ConfirmDialog
            open={cancelClassConfirm}
            onOpenChange={setCancelClassConfirm}
            title={isFr ? 'Annuler ce cours ?' : 'Cancel this class?'}
            description={isFr
              ? `Tous les inscrits (${detailBookings.length}) seront notifiés et leurs crédits restitués. Cette action est irréversible.`
              : `All participants (${detailBookings.length}) will be notified and their credits refunded. This cannot be undone.`}
            onConfirm={handleCancelClass}
          />
        </>
      )}

      {/* Filter popup */}
      <Dialog open={filterOpen} onOpenChange={setFilterOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{isFr ? 'Filtres' : 'Filters'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                {isFr ? 'Type de cours' : 'Class type'}
              </p>
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant={filterClassType === 'all' ? 'default' : 'outline'}
                  className="rounded-full h-8 text-xs"
                  onClick={() => setFilterClassType('all')}
                >
                  {isFr ? 'Tous' : 'All'}
                </Button>
                {classTypes.map(ct => (
                  <Button
                    key={ct.id}
                    size="sm"
                    variant={filterClassType === ct.id ? 'default' : 'outline'}
                    className="rounded-full h-8 text-xs gap-1.5"
                    onClick={() => setFilterClassType(ct.id)}
                  >
                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: ct.color }} />
                    {ct.name}
                  </Button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                {isFr ? 'Coach' : 'Coach'}
              </p>
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant={filterCoach === 'all' ? 'default' : 'outline'}
                  className="rounded-full h-8 text-xs"
                  onClick={() => setFilterCoach('all')}
                >
                  {isFr ? 'Tous' : 'All'}
                </Button>
                {coaches.map(c => (
                  <Button
                    key={c.id}
                    size="sm"
                    variant={filterCoach === c.id ? 'default' : 'outline'}
                    className="rounded-full h-8 text-xs"
                    onClick={() => setFilterCoach(c.id)}
                  >
                    {c.name}
                  </Button>
                ))}
              </div>
            </div>
          </div>
          <div className="flex gap-2 justify-end pt-2 border-t">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => { setFilterClassType('all'); setFilterCoach('all') }}
            >
              {isFr ? 'Réinitialiser' : 'Reset'}
            </Button>
            <Button size="sm" onClick={() => setFilterOpen(false)}>
              {isFr ? 'Appliquer' : 'Apply'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Class type info popup */}
      <Dialog open={!!infoClassType} onOpenChange={(open) => { if (!open) setInfoClassType(null) }}>
        <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
          {infoClassType && (
            <>
              {infoClassType.image_url && (
                <div className="rounded-lg overflow-hidden -mx-6 -mt-6 mb-4">
                  <img src={infoClassType.image_url} alt={infoClassType.name} className="w-full h-48 object-cover" />
                </div>
              )}
              <DialogHeader>
                <DialogTitle>{infoClassType.name}</DialogTitle>
              </DialogHeader>
              {infoClassType.description_md && (
                <div className="prose prose-sm dark:prose-invert max-w-none">
                  <ReactMarkdown>{infoClassType.description_md}</ReactMarkdown>
                </div>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

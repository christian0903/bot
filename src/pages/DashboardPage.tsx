import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { CalendarDays, CreditCard, ChevronRight, Dumbbell, ShoppingBag, X, Clock, Megaphone } from 'lucide-react'
import { LoadingState } from '@/components/common/LoadingState'
import type { PackPurchase, Booking, ScheduledClass } from '@/types'
import { motion } from 'framer-motion'
import { format } from 'date-fns'
import { fr, enUS } from 'date-fns/locale'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { MarkdownLink } from '@/components/common/MarkdownLink'

const CREDIT_COLORS: Record<string, string> = {
  semi_prive: 'bg-blue-500',
  personal_training: 'bg-orange-500',
}

const CREDIT_COLORS_LIGHT: Record<string, string> = {
  semi_prive: 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300',
  personal_training: 'bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300',
}

export function DashboardPage() {
  const { t, i18n } = useTranslation()
  const { user, profile } = useAuth()
  const navigate = useNavigate()
  const isFr = i18n.language === 'fr'
  const locale = isFr ? fr : enUS
  const [packs, setPacks] = useState<PackPurchase[]>([])
  const [upcomingBookings, setUpcomingBookings] = useState<(Booking & { scheduled_class: ScheduledClass })[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedPack, setSelectedPack] = useState<PackPurchase | null>(null)
  const [packBookings, setPackBookings] = useState<(Booking & { scheduled_class: ScheduledClass })[]>([])
  const [packBookingsLoading, setPackBookingsLoading] = useState(false)
  const [announcement, setAnnouncement] = useState<string | null>(null)

  useEffect(() => {
    supabase
      .from('app_settings')
      .select('value')
      .eq('key', 'announcement')
      .single()
      .then(({ data }) => {
        if (data?.value?.content && data.value.published) {
          setAnnouncement(data.value.content as string)
        }
      })
  }, [])

  useEffect(() => {
    if (!user) return

    const fetchData = async () => {
      const [packsRes, bookingsRes] = await Promise.all([
        supabase
          .from('pack_purchases')
          .select('*, pack_type:pack_types(*, credit_type:credit_types(*))')
          .eq('user_id', user.id)
          .gt('credits_remaining', 0)
          .gt('expires_at', new Date().toISOString())
          .order('expires_at', { ascending: true }),
        supabase
          .from('bookings')
          .select('*')
          .eq('user_id', user.id)
          .eq('status', 'confirmed'),
      ])

      setPacks((packsRes.data as PackPurchase[]) ?? [])

      // Fetch bookings then resolve scheduled_classes + coaches separately
      const rawBookings = (bookingsRes.data as Booking[]) ?? []

      if (rawBookings.length > 0) {
        // Fetch scheduled classes
        const classIds = [...new Set(rawBookings.map(b => b.scheduled_class_id))]
        const { data: classData } = await supabase
          .from('scheduled_classes')
          .select('*, class_type:class_types(*)')
          .in('id', classIds)
        const classMap = new Map((classData ?? []).map(c => [c.id, c]))

        // Attach classes to bookings
        for (const b of rawBookings) {
          (b as any).scheduled_class = classMap.get(b.scheduled_class_id)
        }

        // Filter future bookings
        const futureBookings = (rawBookings as (Booking & { scheduled_class: ScheduledClass })[])
          .filter(b => b.scheduled_class && new Date(b.scheduled_class.starts_at) > new Date())
          .sort((a, b) => new Date(a.scheduled_class.starts_at).getTime() - new Date(b.scheduled_class.starts_at).getTime())

        // Fetch coach profiles
        const coachIds = [...new Set(futureBookings.map(b => b.scheduled_class?.coach_id).filter(Boolean))]
        if (coachIds.length > 0) {
          const { data: coaches } = await supabase.from('profiles').select('id, display_name, avatar_url').in('id', coachIds)
          const coachMap = new Map((coaches ?? []).map(c => [c.id, c]))
          for (const b of futureBookings) {
            if (b.scheduled_class) {
              (b.scheduled_class as any).coach = coachMap.get(b.scheduled_class.coach_id)
            }
          }
        }

        setUpcomingBookings(futureBookings.slice(0, 5))
      } else {
        setUpcomingBookings([])
      }
      setLoading(false)
    }

    fetchData()
  }, [user])

  const openPackDetail = async (pack: PackPurchase) => {
    setSelectedPack(pack)
    setPackBookingsLoading(true)
    setPackBookings([])

    const { data: bookings } = await supabase
      .from('bookings')
      .select('*')
      .eq('pack_purchase_id', pack.id)
      .order('created_at', { ascending: false })

    const raw = (bookings as Booking[]) ?? []
    if (raw.length > 0) {
      const classIds = [...new Set(raw.map(b => b.scheduled_class_id))]
      const { data: classData } = await supabase
        .from('scheduled_classes')
        .select('*, class_type:class_types(*)')
        .in('id', classIds)
      const classMap = new Map((classData ?? []).map(c => [c.id, c]))
      for (const b of raw) {
        (b as Booking & { scheduled_class: ScheduledClass }).scheduled_class = classMap.get(b.scheduled_class_id) as ScheduledClass
      }
      const withClasses = (raw as (Booking & { scheduled_class: ScheduledClass })[])
        .filter(b => b.scheduled_class)
        .sort((a, b) => new Date(b.scheduled_class.starts_at).getTime() - new Date(a.scheduled_class.starts_at).getTime())
      setPackBookings(withClasses)
    }
    setPackBookingsLoading(false)
  }

  if (loading) return <LoadingState />

  const firstName = profile?.first_name || profile?.display_name?.split(' ')[0] || ''

  return (
    <div className="space-y-6">
      {/* Welcome */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-2xl md:text-3xl font-bold">
          {isFr ? `Bonjour ${firstName} 💪` : `Hey ${firstName} 💪`}
        </h1>
        <p className="text-muted-foreground mt-1">
          {isFr ? 'Prêt pour votre séance ?' : 'Ready for your session?'}
        </p>
      </motion.div>

      {/* Announcement */}
      {announcement && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.03 }}>
          <Card className="border-primary/20 bg-primary/5">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <Megaphone className="h-4 w-4 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="prose prose-sm dark:prose-invert max-w-none">
                    <ReactMarkdown remarkPlugins={[remarkGfm]} components={{ a: MarkdownLink }}>{announcement}</ReactMarkdown>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Upcoming bookings — first and prominent */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
        {upcomingBookings.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="p-6 text-center">
              <Dumbbell className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground mb-3">
                {isFr ? 'Aucun cours prévu' : 'No upcoming classes'}
              </p>
              <Button size="sm" onClick={() => navigate('/schedule')}>
                {t('home.viewSchedule')}
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
                <CalendarDays className="h-4 w-4" />
                {isFr ? 'Mes prochains cours' : 'My upcoming classes'}
              </h2>
              <Button variant="ghost" size="sm" onClick={() => navigate('/my-bookings')} className="text-xs">
                {t('common.all')}
                <ChevronRight className="h-3 w-3 ml-1" />
              </Button>
            </div>
            {upcomingBookings.map((booking) => {
              const sc = booking.scheduled_class
              const startsAt = new Date(sc?.starts_at ?? '')
              const now = new Date()
              const diffMs = startsAt.getTime() - now.getTime()
              const diffHours = diffMs / 3600000
              const isToday = startsAt.toDateString() === now.toDateString()
              const isTomorrow = new Date(now.getTime() + 86400000).toDateString() === startsAt.toDateString()
              const isSoon = diffHours > 0 && diffHours <= 2

              return (
                <div
                  key={booking.id}
                  onClick={() => navigate('/my-bookings')}
                  className={`flex items-center gap-3 p-3 rounded-xl border bg-card hover:bg-muted/50 transition-colors cursor-pointer ${isSoon ? 'border-primary/50 bg-primary/5' : ''}`}
                >
                  <div className={`flex flex-col items-center justify-center h-12 w-12 rounded-lg shrink-0 ${isToday ? 'bg-primary text-primary-foreground' : 'bg-primary/10'}`}>
                    <span className={`text-[11px] font-medium uppercase ${isToday ? '' : 'text-primary'}`}>
                      {format(startsAt, 'EEE', { locale })}
                    </span>
                    <span className={`text-lg font-bold leading-none ${isToday ? '' : 'text-primary'}`}>
                      {format(startsAt, 'd')}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm truncate">{sc?.class_type?.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {format(startsAt, 'HH:mm')} · {sc?.duration_minutes}min
                      {(sc as any)?.coach?.display_name && ` · ${(sc as any).coach.display_name}`}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    {isSoon ? (
                      <span className="text-xs font-semibold text-primary">
                        {isFr ? `Dans ${Math.round(diffHours * 60)}min` : `In ${Math.round(diffHours * 60)}min`}
                      </span>
                    ) : isToday ? (
                      <span className="text-xs font-semibold text-primary">
                        {isFr ? "Aujourd'hui" : 'Today'}
                      </span>
                    ) : isTomorrow ? (
                      <span className="text-xs font-medium text-muted-foreground">
                        {isFr ? 'Demain' : 'Tomorrow'}
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">
                        {format(startsAt, 'dd/MM')}
                      </span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </motion.div>

      {/* Quick actions */}
      <div className="grid grid-cols-2 gap-3">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <Card
            className="cursor-pointer hover:shadow-lg hover:border-primary/30 transition-all group"
            onClick={() => navigate('/schedule')}
          >
            <CardContent className="p-4 flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                <CalendarDays className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="font-semibold text-sm">{t('home.viewSchedule')}</p>
                <p className="text-xs text-muted-foreground">{t('schedule.title')}</p>
              </div>
            </CardContent>
          </Card>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
          <Card
            className="cursor-pointer hover:shadow-lg hover:border-primary/30 transition-all group"
            onClick={() => navigate('/packs')}
          >
            <CardContent className="p-4 flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-secondary flex items-center justify-center group-hover:bg-secondary/80 transition-colors">
                <ShoppingBag className="h-5 w-5 text-secondary-foreground" />
              </div>
              <div>
                <p className="font-semibold text-sm">{t('home.buyPack')}</p>
                <p className="text-xs text-muted-foreground">{t('packs.title')}</p>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Credits overview */}
      {packs.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <CreditCard className="h-4 w-4 text-primary" />
                  {t('packs.myPacks')}
                </CardTitle>
                <Button variant="ghost" size="sm" onClick={() => navigate('/my-packs')} className="text-xs">
                  {t('common.all')}
                  <ChevronRight className="h-3 w-3 ml-1" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {packs.map((pack) => {
                  const creditName = pack.pack_type?.credit_type?.name ?? 'default'
                  const creditLabel = isFr
                    ? pack.pack_type?.credit_type?.label_fr
                    : pack.pack_type?.credit_type?.label_en
                  const totalCreditsInPack = pack.pack_type?.credit_count ?? 1
                  const used = totalCreditsInPack - pack.credits_remaining
                  const progress = (used / totalCreditsInPack) * 100
                  const colorClass = CREDIT_COLORS[creditName] || 'bg-primary'
                  const badgeClass = CREDIT_COLORS_LIGHT[creditName] || 'bg-muted'
                  const daysLeft = Math.ceil((new Date(pack.expires_at).getTime() - Date.now()) / 86400000)

                  return (
                    <div
                      key={pack.id}
                      onClick={() => openPackDetail(pack)}
                      className="p-3 rounded-xl border bg-card cursor-pointer hover:bg-muted/40 transition-colors"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <Badge className={badgeClass} variant="secondary">{creditLabel}</Badge>
                          <span className="text-xs text-muted-foreground">{pack.pack_type?.name}</span>
                        </div>
                        <span className="text-sm font-bold">{pack.credits_remaining}/{totalCreditsInPack}</span>
                      </div>
                      <div className="h-2 rounded-full bg-muted overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${colorClass}`}
                          style={{ width: `${100 - progress}%` }}
                        />
                      </div>
                      <div className="flex justify-between mt-1.5">
                        <span className="text-[11px] text-muted-foreground">
                          {t('packs.creditsRemaining', { count: pack.credits_remaining })}
                        </span>
                        <span className={`text-[11px] ${daysLeft < 14 ? 'text-destructive font-medium' : 'text-muted-foreground'}`}>
                          {daysLeft > 0
                            ? `${daysLeft}j`
                            : t('packs.expired')
                          }
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Pack detail — bookings made with this pack */}
      <Dialog open={!!selectedPack} onOpenChange={(open) => { if (!open) setSelectedPack(null) }}>
        <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
          {selectedPack && (
            <>
              <DialogHeader>
                <DialogTitle>{selectedPack.pack_type?.name}</DialogTitle>
                <p className="text-sm text-muted-foreground">
                  {selectedPack.credits_remaining}/{selectedPack.pack_type?.credit_count} {isFr ? 'crédits restants' : 'credits remaining'}
                  {' · '}
                  {isFr ? 'expire le' : 'expires'} {format(new Date(selectedPack.expires_at), 'dd/MM/yyyy')}
                </p>
              </DialogHeader>

              {packBookingsLoading ? (
                <LoadingState />
              ) : packBookings.length === 0 ? (
                <p className="text-sm text-muted-foreground py-6 text-center">
                  {isFr ? 'Aucun cours réservé avec ce pack' : 'No bookings on this pack'}
                </p>
              ) : (
                <div className="space-y-2 mt-2">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    {isFr ? 'Cours réservés' : 'Bookings'} ({packBookings.length})
                  </p>
                  {packBookings.map((booking) => {
                    const sc = booking.scheduled_class
                    const startsAt = new Date(sc.starts_at)
                    const isPast = startsAt < new Date()
                    const isCancelled = booking.status === 'cancelled'
                    const color = sc.class_type?.color || '#3B82F6'
                    return (
                      <div
                        key={booking.id}
                        className="flex items-center gap-3 p-2.5 rounded-lg border"
                        style={{ borderLeftWidth: '3px', borderLeftColor: color }}
                      >
                        <div className="flex flex-col items-center justify-center h-10 w-10 rounded-lg bg-muted shrink-0">
                          <span className="text-[10px] font-medium uppercase text-muted-foreground">
                            {format(startsAt, 'MMM', { locale })}
                          </span>
                          <span className="text-sm font-bold leading-none">
                            {format(startsAt, 'd')}
                          </span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate">{sc.class_type?.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {format(startsAt, 'HH:mm')} · {sc.duration_minutes}min
                          </p>
                        </div>
                        <div className="shrink-0">
                          {isCancelled ? (
                            <span className="flex items-center gap-1 text-xs text-muted-foreground">
                              <X className="h-3 w-3" />
                              {isFr ? 'Annulé' : 'Cancelled'}
                            </span>
                          ) : isPast ? (
                            <span className="text-xs text-muted-foreground">
                              {isFr ? 'Passé' : 'Past'}
                            </span>
                          ) : (
                            <span className="flex items-center gap-1 text-xs text-primary font-medium">
                              <Clock className="h-3 w-3" />
                              {isFr ? 'À venir' : 'Upcoming'}
                            </span>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

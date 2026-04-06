import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { CalendarDays, CreditCard, Clock, ChevronRight, Dumbbell, ShoppingBag } from 'lucide-react'
import { LoadingState } from '@/components/common/LoadingState'
import { EmptyState } from '@/components/common/EmptyState'
import type { PackPurchase, Booking, ScheduledClass } from '@/types'
import { motion } from 'framer-motion'
import { format } from 'date-fns'
import { fr, enUS } from 'date-fns/locale'

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
  const locale = i18n.language === 'fr' ? fr : enUS
  const [packs, setPacks] = useState<PackPurchase[]>([])
  const [upcomingBookings, setUpcomingBookings] = useState<(Booking & { scheduled_class: ScheduledClass })[]>([])
  const [loading, setLoading] = useState(true)

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
          .select('*, scheduled_class:scheduled_classes(*, class_type:class_types(*))')
          .eq('user_id', user.id)
          .eq('status', 'confirmed')
          .order('created_at', { ascending: true })
          .limit(10),
      ])

      setPacks((packsRes.data as PackPurchase[]) ?? [])

      // Resolve coach profiles for bookings
      const rawBookings = (bookingsRes.data as (Booking & { scheduled_class: ScheduledClass })[]) ?? []
      const futureBookings = rawBookings.filter(b => b.scheduled_class && new Date(b.scheduled_class.starts_at) > new Date())
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
      setLoading(false)
    }

    fetchData()
  }, [user])

  if (loading) return <LoadingState />

  const firstName = profile?.first_name || profile?.display_name?.split(' ')[0] || ''

  return (
    <div className="space-y-6">
      {/* Welcome */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-2xl md:text-3xl font-bold">
          {i18n.language === 'fr' ? `Bonjour ${firstName} 💪` : `Hey ${firstName} 💪`}
        </h1>
        <p className="text-muted-foreground mt-1">
          {i18n.language === 'fr' ? 'Prêt pour votre séance ?' : 'Ready for your session?'}
        </p>
      </motion.div>

      {/* Quick actions */}
      <div className="grid grid-cols-2 gap-3">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
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
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
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
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
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
            {packs.length === 0 ? (
              <div className="text-center py-4">
                <p className="text-sm text-muted-foreground mb-3">{t('packs.noActivePacks')}</p>
                <Button size="sm" onClick={() => navigate('/packs')}>{t('home.buyPack')}</Button>
              </div>
            ) : (
              <div className="space-y-3">
                {packs.map((pack) => {
                  const creditName = pack.pack_type?.credit_type?.name ?? 'default'
                  const creditLabel = i18n.language === 'fr'
                    ? pack.pack_type?.credit_type?.label_fr
                    : pack.pack_type?.credit_type?.label_en
                  const totalCreditsInPack = pack.pack_type?.credit_count ?? 1
                  const used = totalCreditsInPack - pack.credits_remaining
                  const progress = (used / totalCreditsInPack) * 100
                  const colorClass = CREDIT_COLORS[creditName] || 'bg-primary'
                  const badgeClass = CREDIT_COLORS_LIGHT[creditName] || 'bg-muted'
                  const daysLeft = Math.ceil((new Date(pack.expires_at).getTime() - Date.now()) / 86400000)

                  return (
                    <div key={pack.id} className="p-3 rounded-xl border bg-card">
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
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* Upcoming bookings */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <Clock className="h-4 w-4 text-primary" />
                {t('bookings.upcoming')}
              </CardTitle>
              <Button variant="ghost" size="sm" onClick={() => navigate('/my-bookings')} className="text-xs">
                {t('common.all')}
                <ChevronRight className="h-3 w-3 ml-1" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {upcomingBookings.length === 0 ? (
              <EmptyState
                icon={Dumbbell}
                message={i18n.language === 'fr' ? 'Aucun cours prévu' : 'No upcoming classes'}
                actionLabel={t('home.viewSchedule')}
                onAction={() => navigate('/schedule')}
              />
            ) : (
              <div className="space-y-2">
                {upcomingBookings.map((booking) => {
                  const sc = booking.scheduled_class
                  const startsAt = new Date(sc?.starts_at ?? '')

                  return (
                    <div
                      key={booking.id}
                      className="flex items-center gap-3 p-3 rounded-xl border bg-card hover:bg-muted/50 transition-colors"
                    >
                      {/* Date block */}
                      <div className="flex flex-col items-center justify-center h-12 w-12 rounded-lg bg-primary/10 shrink-0">
                        <span className="text-[11px] font-medium text-primary uppercase">
                          {format(startsAt, 'EEE', { locale })}
                        </span>
                        <span className="text-lg font-bold text-primary leading-none">
                          {format(startsAt, 'd')}
                        </span>
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm truncate">{sc?.class_type?.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {format(startsAt, 'HH:mm', { locale })} · {sc?.duration_minutes} min · {sc?.coach?.display_name}
                        </p>
                      </div>

                      <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </div>
  )
}

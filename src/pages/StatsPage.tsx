import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { LoadingState } from '@/components/common/LoadingState'
import { BarChart3, Flame, Target, Trophy, Calendar } from 'lucide-react'
import { format, startOfWeek, addDays, subMonths } from 'date-fns'
import { fr, enUS } from 'date-fns/locale'
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

const BADGE_DEFS = [
  { type: 'sessions_10', label: '10 séances', labelEn: '10 sessions', threshold: 10, icon: '🥉' },
  { type: 'sessions_25', label: '25 séances', labelEn: '25 sessions', threshold: 25, icon: '🥈' },
  { type: 'sessions_50', label: '50 séances', labelEn: '50 sessions', threshold: 50, icon: '🥇' },
  { type: 'sessions_100', label: '100 séances', labelEn: '100 sessions', threshold: 100, icon: '💎' },
  { type: 'streak_4', label: '4 semaines', labelEn: '4 week streak', threshold: 4, icon: '🔥' },
  { type: 'streak_8', label: '8 semaines', labelEn: '8 week streak', threshold: 8, icon: '⚡' },
  { type: 'streak_12', label: '12 semaines', labelEn: '12 week streak', threshold: 12, icon: '🌟' },
]

export function StatsPage() {
  const { i18n } = useTranslation()
  const isFr = i18n.language === 'fr'
  const locale = isFr ? fr : enUS
  const { user, profile } = useAuth()

  const [loading, setLoading] = useState(true)
  const [totalSessions, setTotalSessions] = useState(0)
  const [thisWeekSessions, setThisWeekSessions] = useState(0)
  const [thisMonthSessions, setThisMonthSessions] = useState(0)
  const [streak, setStreak] = useState(0)
  const [byType, setByType] = useState<{ name: string; value: number; color: string }[]>([])
  const [byMonth, setByMonth] = useState<{ month: string; count: number }[]>([])
  const [trainingDays, setTrainingDays] = useState<Set<string>>(new Set())
  const [earnedBadges, setEarnedBadges] = useState<Set<string>>(new Set())
  const [weeklyGoal, setWeeklyGoal] = useState(profile?.weekly_goal ?? 3)

  useEffect(() => {
    if (!user) return

    const fetchStats = async () => {
      const now = new Date()
      const weekStart = startOfWeek(now, { weekStartsOn: 1 })
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)

      const [totalRes, weekRes, monthRes, streakRes, typeRes, monthlyRes, daysRes, badgesRes] = await Promise.all([
        supabase.rpc('member_sessions_count', { p_user_id: user.id, p_from: '2020-01-01', p_to: format(now, 'yyyy-MM-dd') }),
        supabase.rpc('member_sessions_count', { p_user_id: user.id, p_from: format(weekStart, 'yyyy-MM-dd'), p_to: format(now, 'yyyy-MM-dd') }),
        supabase.rpc('member_sessions_count', { p_user_id: user.id, p_from: format(monthStart, 'yyyy-MM-dd'), p_to: format(now, 'yyyy-MM-dd') }),
        supabase.rpc('member_streak', { p_user_id: user.id }),
        supabase.rpc('member_sessions_by_type', { p_user_id: user.id }),
        supabase.rpc('member_sessions_by_month', { p_user_id: user.id }),
        supabase.rpc('member_training_days', { p_user_id: user.id }),
        supabase.from('member_badges').select('badge_type').eq('user_id', user.id),
      ])

      setTotalSessions(totalRes.data ?? 0)
      setThisWeekSessions(weekRes.data ?? 0)
      setThisMonthSessions(monthRes.data ?? 0)
      setStreak(streakRes.data ?? 0)
      setByType((typeRes.data ?? []).map((r: { class_type_name: string; class_type_color: string; count: number }) => ({
        name: r.class_type_name, value: Number(r.count), color: r.class_type_color || '#3B82F6',
      })))
      setByMonth((monthlyRes.data ?? []).map((r: { month: string; count: number }) => ({
        month: r.month, count: Number(r.count),
      })))
      setTrainingDays(new Set((daysRes.data ?? []).map((r: { training_date: string }) => r.training_date)))
      setEarnedBadges(new Set((badgesRes.data ?? []).map((r: { badge_type: string }) => r.badge_type)))
      setWeeklyGoal(profile?.weekly_goal ?? 3)

      // Auto-award badges
      const total = totalRes.data ?? 0
      const s = streakRes.data ?? 0
      const existing = new Set((badgesRes.data ?? []).map((r: { badge_type: string }) => r.badge_type))

      for (const badge of BADGE_DEFS) {
        if (existing.has(badge.type)) continue
        const qualifies = badge.type.startsWith('sessions_') ? total >= badge.threshold : s >= badge.threshold
        if (qualifies) {
          await supabase.from('member_badges').insert({ user_id: user.id, badge_type: badge.type })
          existing.add(badge.type)
        }
      }
      setEarnedBadges(existing)

      setLoading(false)
    }

    fetchStats()
  }, [user, profile])

  const handleGoalChange = async (val: number) => {
    setWeeklyGoal(val)
    if (!user) return
    await supabase.from('profiles').update({ weekly_goal: val }).eq('id', user.id)
    toast.success(isFr ? 'Objectif mis à jour' : 'Goal updated')
  }

  if (loading) return <LoadingState />

  // Calendar: 3 months
  const calendarMonths = [subMonths(new Date(), 2), subMonths(new Date(), 1), new Date()]
  const goalProgress = weeklyGoal > 0 ? Math.min((thisWeekSessions / weeklyGoal) * 100, 100) : 0

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold flex items-center gap-2">
        <BarChart3 className="h-6 w-6 text-primary" />
        {isFr ? 'Mes statistiques' : 'My stats'}
      </h1>

      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-3xl font-bold">{totalSessions}</p>
            <p className="text-xs text-muted-foreground">{isFr ? 'Séances total' : 'Total sessions'}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-3xl font-bold">{thisMonthSessions}</p>
            <p className="text-xs text-muted-foreground">{isFr ? 'Ce mois' : 'This month'}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-3xl font-bold">{thisWeekSessions}</p>
            <p className="text-xs text-muted-foreground">{isFr ? 'Cette semaine' : 'This week'}</p>
          </CardContent>
        </Card>
        <Card className={streak >= 4 ? 'border-orange-500/30 bg-orange-50 dark:bg-orange-950/20' : ''}>
          <CardContent className="p-4 text-center">
            <p className="text-3xl font-bold flex items-center justify-center gap-1">
              <Flame className={cn('h-6 w-6', streak >= 4 ? 'text-orange-500' : 'text-muted-foreground')} />
              {streak}
            </p>
            <p className="text-xs text-muted-foreground">{isFr ? 'Semaines de suite' : 'Week streak'}</p>
          </CardContent>
        </Card>
      </div>

      {/* Weekly goal */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Target className="h-5 w-5 text-primary" />
              <span className="font-semibold text-sm">{isFr ? 'Objectif hebdomadaire' : 'Weekly goal'}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold">{thisWeekSessions}/{weeklyGoal}</span>
              <Input
                type="number"
                min={1}
                max={7}
                value={weeklyGoal}
                onChange={e => handleGoalChange(Math.min(7, Math.max(1, parseInt(e.target.value) || 1)))}
                className="w-16 h-7 text-xs text-center"
              />
            </div>
          </div>
          <div className="h-3 rounded-full bg-muted overflow-hidden">
            <div
              className={cn('h-full rounded-full transition-all', goalProgress >= 100 ? 'bg-green-500' : 'bg-primary')}
              style={{ width: `${goalProgress}%` }}
            />
          </div>
          {goalProgress >= 100 && (
            <p className="text-xs text-green-600 dark:text-green-400 mt-1 text-center font-medium">
              {isFr ? 'Objectif atteint !' : 'Goal reached!'}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Charts: by type + by month */}
      <div className="grid md:grid-cols-2 gap-4">
        {/* Pie chart - by type */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">{isFr ? 'Par type de cours' : 'By class type'}</CardTitle>
          </CardHeader>
          <CardContent>
            {byType.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">{isFr ? 'Pas encore de données' : 'No data yet'}</p>
            ) : (
              <div className="flex items-center gap-4">
                <ResponsiveContainer width={120} height={120}>
                  <PieChart>
                    <Pie data={byType} dataKey="value" cx="50%" cy="50%" innerRadius={30} outerRadius={55} strokeWidth={2}>
                      {byType.map((entry, idx) => (
                        <Cell key={idx} fill={entry.color} />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
                <div className="space-y-1.5 flex-1">
                  {byType.map(entry => (
                    <div key={entry.name} className="flex items-center justify-between text-sm">
                      <span className="flex items-center gap-2">
                        <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: entry.color }} />
                        {entry.name}
                      </span>
                      <span className="font-medium">{entry.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Bar chart - by month */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">{isFr ? 'Évolution mensuelle' : 'Monthly trend'}</CardTitle>
          </CardHeader>
          <CardContent>
            {byMonth.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">{isFr ? 'Pas encore de données' : 'No data yet'}</p>
            ) : (
              <ResponsiveContainer width="100%" height={120}>
                <BarChart data={byMonth}>
                  <XAxis dataKey="month" tick={{ fontSize: 10 }} tickFormatter={m => {
                    const [y, mo] = m.split('-')
                    return format(new Date(parseInt(y), parseInt(mo) - 1), 'MMM', { locale })
                  }} />
                  <YAxis tick={{ fontSize: 10 }} width={25} />
                  <Tooltip formatter={(v: number) => [v, isFr ? 'Séances' : 'Sessions']} labelFormatter={m => {
                    const [y, mo] = (m as string).split('-')
                    return format(new Date(parseInt(y), parseInt(mo) - 1), 'MMMM yyyy', { locale })
                  }} />
                  <Bar dataKey="count" fill="var(--color-primary)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Training calendar */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            {isFr ? 'Calendrier d\'entraînement' : 'Training calendar'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4">
            {calendarMonths.map(monthDate => {
              const year = monthDate.getFullYear()
              const month = monthDate.getMonth()
              const firstDay = new Date(year, month, 1)
              const startDay = (firstDay.getDay() + 6) % 7 // 0=Mon
              const daysInMonth = new Date(year, month + 1, 0).getDate()

              return (
                <div key={monthDate.toISOString()}>
                  <p className="text-xs font-medium text-center mb-2 capitalize">
                    {format(monthDate, 'MMMM', { locale })}
                  </p>
                  <div className="grid grid-cols-7 gap-0.5">
                    {['L', 'M', 'M', 'J', 'V', 'S', 'D'].map((d, i) => (
                      <div key={i} className="text-[9px] text-muted-foreground text-center">{d}</div>
                    ))}
                    {Array.from({ length: startDay }).map((_, i) => (
                      <div key={`empty-${i}`} />
                    ))}
                    {Array.from({ length: daysInMonth }).map((_, i) => {
                      const day = i + 1
                      const dateStr = format(new Date(year, month, day), 'yyyy-MM-dd')
                      const isTrained = trainingDays.has(dateStr)
                      const isToday = dateStr === format(new Date(), 'yyyy-MM-dd')

                      return (
                        <div
                          key={day}
                          className={cn(
                            'h-5 w-5 rounded-sm text-[10px] flex items-center justify-center mx-auto',
                            isTrained && 'bg-primary text-primary-foreground font-bold',
                            !isTrained && isToday && 'border border-primary/50',
                            !isTrained && !isToday && 'text-muted-foreground'
                          )}
                        >
                          {day}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* Badges */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Trophy className="h-4 w-4" />
            {isFr ? 'Badges' : 'Badges'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {BADGE_DEFS.map(badge => {
              const earned = earnedBadges.has(badge.type)
              return (
                <div
                  key={badge.type}
                  className={cn(
                    'p-3 rounded-lg border text-center transition-all',
                    earned
                      ? 'bg-primary/5 border-primary/30'
                      : 'opacity-40 grayscale'
                  )}
                >
                  <span className="text-2xl">{badge.icon}</span>
                  <p className="text-xs font-medium mt-1">{isFr ? badge.label : badge.labelEn}</p>
                  {earned && (
                    <Badge variant="outline" className="text-[9px] mt-1 border-primary/30 text-primary">
                      {isFr ? 'Débloqué' : 'Unlocked'}
                    </Badge>
                  )}
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

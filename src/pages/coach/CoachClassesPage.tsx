import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { Card, CardContent } from '@/components/ui/card'
import { EmptyState } from '@/components/common/EmptyState'
import { LoadingState } from '@/components/common/LoadingState'
import { CalendarDays, Users } from 'lucide-react'
import { format } from 'date-fns'
import { fr, enUS } from 'date-fns/locale'
import type { ScheduledClass } from '@/types'

/** Chiffres personnels du coach sur les 30 derniers jours. */
interface CoachStats {
  given: number
  scheduled: number
  attendees: number
  fillRate: number
  upcoming: number
}

export function CoachClassesPage() {
  const { t, i18n } = useTranslation()
  const { user } = useAuth()
  const navigate = useNavigate()
  const locale = i18n.language === 'fr' ? fr : enUS
  const isFr = i18n.language === 'fr'
  const [classes, setClasses] = useState<ScheduledClass[]>([])
  const [stats, setStats] = useState<CoachStats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return

    const load = async () => {
      const now = new Date()
      const from30d = new Date(now.getTime() - 30 * 86400000).toISOString()

      const [upcomingRes, pastRes, ruleRes] = await Promise.all([
        // Cours à venir : la liste affichée sous les chiffres
        supabase
          .from('scheduled_classes')
          .select('*, class_type:class_types(*)')
          .eq('coach_id', user.id)
          .gte('starts_at', now.toISOString())
          .order('starts_at'),
        // 30 derniers jours, annulations comprises : elles comptent comme
        // planifiées, jamais comme données.
        supabase
          .from('scheduled_classes')
          .select('id, starts_at, is_cancelled, max_participants')
          .eq('coach_id', user.id)
          .gte('starts_at', from30d)
          .lt('starts_at', now.toISOString()),
        supabase.from('app_settings').select('value').eq('key', 'class_given_rule').maybeSingle(),
      ])

      setClasses((upcomingRes.data as ScheduledClass[]) ?? [])

      const minParticipants =
        (ruleRes.data?.value as { min_participants?: number } | undefined)?.min_participants ?? 1
      const pastClasses = pastRes.data ?? []

      // Participants par cours, en une seule requête
      const ids = pastClasses.map(c => c.id)
      const countByClass = new Map<string, number>()
      if (ids.length > 0) {
        const { data: bookings } = await supabase
          .from('bookings')
          .select('scheduled_class_id')
          .in('scheduled_class_id', ids)
          .eq('status', 'confirmed')
        for (const b of bookings ?? []) {
          countByClass.set(b.scheduled_class_id, (countByClass.get(b.scheduled_class_id) ?? 0) + 1)
        }
      }

      let given = 0, attendees = 0, capacity = 0
      for (const c of pastClasses) {
        const n = countByClass.get(c.id) ?? 0
        attendees += n
        if (!c.is_cancelled && n >= minParticipants) {
          given++
          capacity += c.max_participants ?? 0
        }
      }

      setStats({
        given,
        scheduled: pastClasses.length,
        attendees,
        fillRate: capacity > 0 ? Math.round((attendees / capacity) * 100) : 0,
        upcoming: (upcomingRes.data ?? []).length,
      })
      setLoading(false)
    }

    load()
  }, [user])

  if (loading) return <LoadingState />

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">{t('coach.myClasses')}</h1>

      {/* Chiffres personnels — ceux de ce coach uniquement */}
      {stats && (
        <div>
          <p className="text-xs text-muted-foreground mb-2">
            {isFr ? 'Mes 30 derniers jours' : 'My last 30 days'}
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Card>
              <CardContent className="p-3">
                <p className="text-2xl font-bold">
                  {stats.given}
                  <span className="text-sm text-muted-foreground font-normal"> / {stats.scheduled}</span>
                </p>
                <p className="text-xs text-muted-foreground">
                  {isFr ? 'Cours donnés' : 'Classes given'}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-3">
                <p className="text-2xl font-bold">{stats.attendees}</p>
                <p className="text-xs text-muted-foreground">
                  {isFr ? 'Participants' : 'Attendees'}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-3">
                <p className="text-2xl font-bold">{stats.fillRate} %</p>
                <p className="text-xs text-muted-foreground">
                  {isFr ? 'Taux de remplissage' : 'Fill rate'}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-3">
                <p className="text-2xl font-bold">{stats.upcoming}</p>
                <p className="text-xs text-muted-foreground">
                  {isFr ? 'Cours à venir' : 'Upcoming classes'}
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {classes.length === 0 ? (
        <EmptyState icon={CalendarDays} message={t('coach.noClasses')} />
      ) : (
        <div className="space-y-3">
          {classes.map((sc) => (
            <Card
              key={sc.id}
              className="cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => navigate(`/coach/class/${sc.id}`)}
            >
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="font-medium">{sc.class_type?.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {format(new Date(sc.starts_at), 'EEEE dd MMMM, HH:mm', { locale })}
                  </p>
                </div>
                <div className="flex items-center gap-1 text-muted-foreground">
                  <Users className="h-4 w-4" />
                  <span className="text-sm">{sc.max_participants}</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

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

export function CoachClassesPage() {
  const { t, i18n } = useTranslation()
  const { user } = useAuth()
  const navigate = useNavigate()
  const locale = i18n.language === 'fr' ? fr : enUS
  const [classes, setClasses] = useState<ScheduledClass[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return
    supabase
      .from('scheduled_classes')
      .select('*, class_type:class_types(*)')
      .eq('coach_id', user.id)
      .gte('starts_at', new Date().toISOString())
      .order('starts_at')
      .then(({ data }) => {
        setClasses((data as ScheduledClass[]) ?? [])
        setLoading(false)
      })
  }, [user])

  if (loading) return <LoadingState />

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">{t('coach.myClasses')}</h1>

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

import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { supabase } from '@/lib/supabase'
import type { Profile, UserRole } from '@/types'
import { LoadingState } from '@/components/common/LoadingState'
import { EmptyState } from '@/components/common/EmptyState'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Users, ChevronRight } from 'lucide-react'

interface CoachWithRoles extends Profile {
  roles: UserRole[]
  upcoming_classes: number
}

export function AdminCoachesPage() {
  const { i18n } = useTranslation()
  const isFr = i18n.language === 'fr'
  const navigate = useNavigate()
  const [coaches, setCoaches] = useState<CoachWithRoles[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetch = async () => {
      // Get all users with coach or admin or super_admin role
      const { data: rolesData } = await supabase
        .from('user_roles')
        .select('user_id, role')

      // Group roles by user, keep only coach/admin/super_admin
      const roleMap = new Map<string, UserRole[]>()
      for (const r of rolesData ?? []) {
        if (!['coach', 'admin', 'super_admin'].includes(r.role)) continue
        const existing = roleMap.get(r.user_id) ?? []
        existing.push(r.role as UserRole)
        roleMap.set(r.user_id, existing)
      }

      const coachIds = [...roleMap.keys()]
      if (coachIds.length === 0) { setLoading(false); return }

      // Fetch profiles
      const { data: profiles } = await supabase
        .from('profiles')
        .select('*')
        .in('id', coachIds)
        .order('display_name')

      // Count upcoming classes per coach
      const { data: classCounts } = await supabase
        .from('scheduled_classes')
        .select('coach_id')
        .in('coach_id', coachIds)
        .gt('starts_at', new Date().toISOString())
        .eq('is_cancelled', false)

      const countMap = new Map<string, number>()
      for (const c of classCounts ?? []) {
        countMap.set(c.coach_id, (countMap.get(c.coach_id) ?? 0) + 1)
      }

      const result: CoachWithRoles[] = (profiles ?? []).map(p => ({
        ...p as Profile,
        roles: roleMap.get(p.id) ?? [],
        upcoming_classes: countMap.get(p.id) ?? 0,
      }))

      setCoaches(result)
      setLoading(false)
    }
    fetch()
  }, [])

  if (loading) return <LoadingState />

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold flex items-center gap-2">
        <Users className="h-6 w-6 text-primary" />
        {isFr ? 'Coaches & Admins' : 'Coaches & Admins'}
      </h1>

      {coaches.length === 0 ? (
        <EmptyState icon={Users} message={isFr ? 'Aucun coach' : 'No coaches'} />
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {coaches.map(coach => (
            <div
              key={coach.id}
              onClick={() => navigate(`/admin/coaches/${coach.id}`)}
              className="flex items-center gap-4 p-4 rounded-xl border bg-card hover:border-primary/30 hover:shadow-md transition-all cursor-pointer group"
            >
              <Avatar className="h-14 w-14">
                <AvatarImage src={coach.avatar_url ?? undefined} />
                <AvatarFallback className="text-xl">{coach.display_name?.charAt(0).toUpperCase()}</AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="font-semibold">{coach.display_name}</p>
                <p className="text-xs text-muted-foreground">{coach.email}</p>
                <div className="flex gap-1 mt-1">
                  {coach.roles.map(r => (
                    <Badge key={r} variant="outline" className="text-[10px]">
                      {r === 'super_admin' ? 'Super Admin' : r === 'admin' ? 'Admin' : 'Coach'}
                    </Badge>
                  ))}
                </div>
              </div>
              <div className="text-right shrink-0">
                <p className="text-lg font-bold text-primary">{coach.upcoming_classes}</p>
                <p className="text-[10px] text-muted-foreground">{isFr ? 'cours à venir' : 'upcoming'}</p>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

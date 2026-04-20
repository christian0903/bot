import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { supabase } from '@/lib/supabase'
import type { Profile, ScheduledClass, UserRole } from '@/types'
import { LoadingState } from '@/components/common/LoadingState'
import { EmptyState } from '@/components/common/EmptyState'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { ArrowLeft, CalendarDays, Users, Clock, MapPin } from 'lucide-react'
import { format } from 'date-fns'
import { fr, enUS } from 'date-fns/locale'
import ReactMarkdown from 'react-markdown'

export function AdminCoachDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { i18n } = useTranslation()
  const isFr = i18n.language === 'fr'
  const locale = isFr ? fr : enUS
  const navigate = useNavigate()

  const [profile, setProfile] = useState<Profile | null>(null)
  const [roles, setRoles] = useState<UserRole[]>([])
  const [upcomingClasses, setUpcomingClasses] = useState<ScheduledClass[]>([])
  const [pastClassCount, setPastClassCount] = useState(0)
  const [totalBookings, setTotalBookings] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!id) return

    const fetch = async () => {
      const [profileRes, rolesRes, upcomingRes, pastRes, bookingsRes] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', id).single(),
        supabase.from('user_roles').select('role').eq('user_id', id),
        supabase
          .from('scheduled_classes')
          .select('*, class_type:class_types(*)')
          .eq('coach_id', id)
          .gt('starts_at', new Date().toISOString())
          .eq('is_cancelled', false)
          .order('starts_at')
          .limit(20),
        supabase
          .from('scheduled_classes')
          .select('id', { count: 'exact', head: true })
          .eq('coach_id', id)
          .lt('starts_at', new Date().toISOString())
          .eq('is_cancelled', false),
        supabase
          .from('bookings')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'confirmed')
          .in('scheduled_class_id',
            (await supabase.from('scheduled_classes').select('id').eq('coach_id', id)).data?.map(c => c.id) ?? []
          ),
      ])

      setProfile(profileRes.data as Profile)
      setRoles((rolesRes.data ?? []).map(r => r.role as UserRole))
      setUpcomingClasses((upcomingRes.data as ScheduledClass[]) ?? [])
      setPastClassCount(pastRes.count ?? 0)
      setTotalBookings(bookingsRes.count ?? 0)
      setLoading(false)
    }
    fetch()
  }, [id])

  if (loading) return <LoadingState />
  if (!profile) return <EmptyState icon={Users} message="Not found" />

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/admin/coaches')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <Avatar className="h-16 w-16">
          <AvatarImage src={profile.avatar_url ?? undefined} />
          <AvatarFallback className="text-2xl">{profile.display_name?.charAt(0).toUpperCase()}</AvatarFallback>
        </Avatar>
        <div>
          <h1 className="text-2xl font-bold">{profile.display_name}</h1>
          {profile.email && (
            <a href={`mailto:${profile.email}`} className="text-sm text-primary hover:underline">{profile.email}</a>
          )}
          {profile.phone && (
            <a href={`tel:${profile.phone}`} className="text-sm text-muted-foreground hover:underline block">{profile.phone}</a>
          )}
          <div className="flex gap-1 mt-1">
            {roles.filter(r => r !== 'client').map(r => (
              <Badge key={r} variant="outline" className="text-[10px]">
                {r === 'super_admin' ? 'Super Admin' : r === 'admin' ? 'Admin' : 'Coach'}
              </Badge>
            ))}
          </div>
        </div>
      </div>

      {/* Social links */}
      {(profile.instagram_url || profile.facebook_url || profile.linkedin_url) && (
        <div className="flex gap-3">
          {profile.instagram_url && (
            <a href={profile.instagram_url} target="_blank" rel="noopener noreferrer" className="text-sm text-primary hover:underline">Instagram</a>
          )}
          {profile.facebook_url && (
            <a href={profile.facebook_url} target="_blank" rel="noopener noreferrer" className="text-sm text-primary hover:underline">Facebook</a>
          )}
          {profile.linkedin_url && (
            <a href={profile.linkedin_url} target="_blank" rel="noopener noreferrer" className="text-sm text-primary hover:underline">LinkedIn</a>
          )}
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <Card>
          <CardContent className="p-4 text-center">
            <CalendarDays className="h-5 w-5 mx-auto text-primary mb-1" />
            <p className="text-2xl font-bold">{upcomingClasses.length}</p>
            <p className="text-xs text-muted-foreground">{isFr ? 'Cours à venir' : 'Upcoming'}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <Clock className="h-5 w-5 mx-auto text-primary mb-1" />
            <p className="text-2xl font-bold">{pastClassCount}</p>
            <p className="text-xs text-muted-foreground">{isFr ? 'Cours donnés' : 'Classes given'}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <Users className="h-5 w-5 mx-auto text-primary mb-1" />
            <p className="text-2xl font-bold">{totalBookings}</p>
            <p className="text-xs text-muted-foreground">{isFr ? 'Inscriptions total' : 'Total bookings'}</p>
          </CardContent>
        </Card>
      </div>

      {/* Coach description */}
      {profile.coach_description && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{isFr ? 'Présentation' : 'About'}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="prose prose-sm dark:prose-invert max-w-none">
              <ReactMarkdown>{profile.coach_description}</ReactMarkdown>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Upcoming classes */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <CalendarDays className="h-4 w-4" />
            {isFr ? 'Prochains cours' : 'Upcoming classes'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {upcomingClasses.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              {isFr ? 'Aucun cours planifié' : 'No upcoming classes'}
            </p>
          ) : (
            <div className="space-y-2">
              {upcomingClasses.map(sc => {
                const startsAt = new Date(sc.starts_at)
                const classColor = sc.class_type?.color || '#3B82F6'
                return (
                  <div
                    key={sc.id}
                    className="flex items-center gap-3 p-3 rounded-lg border hover:bg-muted/30 transition-colors cursor-pointer"
                    style={{ borderLeftWidth: '3px', borderLeftColor: classColor }}
                    onClick={() => navigate(`/coach/class/${sc.id}`)}
                  >
                    <div className="flex flex-col items-center justify-center h-10 w-10 rounded-lg bg-primary/10 shrink-0">
                      <span className="text-[10px] font-medium text-primary uppercase">
                        {format(startsAt, 'EEE', { locale })}
                      </span>
                      <span className="text-base font-bold text-primary leading-none">
                        {format(startsAt, 'd')}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm">{sc.class_type?.name}</p>
                      <p className="text-xs text-muted-foreground flex items-center gap-2">
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {format(startsAt, 'HH:mm')} · {sc.duration_minutes}min
                        </span>
                        {sc.floor && (
                          <span className="flex items-center gap-1">
                            <MapPin className="h-3 w-3" />
                            {sc.floor}
                          </span>
                        )}
                      </p>
                    </div>
                    <span className="text-xs text-muted-foreground">{sc.max_participants} pl.</span>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

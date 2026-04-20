import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { supabase } from '@/lib/supabase'
import type { Profile, ScheduledClass, UserRole } from '@/types'
import { LoadingState } from '@/components/common/LoadingState'
import { EmptyState } from '@/components/common/EmptyState'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { ArrowLeft, CalendarDays, Users, Clock, MapPin, Euro } from 'lucide-react'
import { formatEuros } from '@/lib/utils'
import { format, addDays } from 'date-fns'
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
  const [classes, setClasses] = useState<ScheduledClass[]>([])
  const [bookingCounts, setBookingCounts] = useState<Map<string, number>>(new Map())
  const [classRevenue, setClassRevenue] = useState<Map<string, number>>(new Map())
  const [pastClassCount, setPastClassCount] = useState(0)
  const [totalBookings, setTotalBookings] = useState(0)
  const [loading, setLoading] = useState(true)

  // Date filter
  const [dateFrom, setDateFrom] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [dateTo, setDateTo] = useState(format(addDays(new Date(), 30), 'yyyy-MM-dd'))

  const fetchClasses = async () => {
    if (!id) return

    const { data: classData } = await supabase
      .from('scheduled_classes')
      .select('*, class_type:class_types(*)')
      .eq('coach_id', id)
      .gte('starts_at', dateFrom + 'T00:00:00')
      .lte('starts_at', dateTo + 'T23:59:59')
      .eq('is_cancelled', false)
      .order('starts_at')

    const classList = (classData as ScheduledClass[]) ?? []
    setClasses(classList)

    // Fetch booking counts + revenue per class
    if (classList.length > 0) {
      const classIds = classList.map(c => c.id)
      const { data: bookingData } = await supabase
        .from('bookings')
        .select('scheduled_class_id, pack_purchase_id')
        .in('scheduled_class_id', classIds)
        .eq('status', 'confirmed')

      const counts = new Map<string, number>()
      for (const b of bookingData ?? []) {
        counts.set(b.scheduled_class_id, (counts.get(b.scheduled_class_id) ?? 0) + 1)
      }
      setBookingCounts(counts)

      // Fetch pack purchases for revenue calculation
      const packIds = [...new Set((bookingData ?? []).map(b => b.pack_purchase_id))]
      if (packIds.length > 0) {
        const { data: packData } = await supabase
          .from('pack_purchases')
          .select('id, price_paid_cents, pack_type:pack_types(credit_count)')
          .in('id', packIds)
        const packMap = new Map((packData ?? []).map(p => [p.id, p]))

        const revenue = new Map<string, number>()
        for (const b of bookingData ?? []) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const pack = packMap.get(b.pack_purchase_id) as any
          if (pack) {
            const creditValue = pack.price_paid_cents / (pack.pack_type?.credit_count || 1)
            revenue.set(b.scheduled_class_id, (revenue.get(b.scheduled_class_id) ?? 0) + creditValue)
          }
        }
        setClassRevenue(revenue)
      } else {
        setClassRevenue(new Map())
      }
    } else {
      setBookingCounts(new Map())
      setClassRevenue(new Map())
    }
  }

  useEffect(() => {
    if (!id) return

    const fetchProfile = async () => {
      const [profileRes, rolesRes, pastRes] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', id).single(),
        supabase.from('user_roles').select('role').eq('user_id', id),
        supabase
          .from('scheduled_classes')
          .select('id', { count: 'exact', head: true })
          .eq('coach_id', id)
          .lt('starts_at', new Date().toISOString())
          .eq('is_cancelled', false),
      ])

      setProfile(profileRes.data as Profile)
      setRoles((rolesRes.data ?? []).map(r => r.role as UserRole))
      setPastClassCount(pastRes.count ?? 0)

      // Total bookings for this coach's classes
      const { data: allClassIds } = await supabase
        .from('scheduled_classes')
        .select('id')
        .eq('coach_id', id)
      if (allClassIds && allClassIds.length > 0) {
        const { count } = await supabase
          .from('bookings')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'confirmed')
          .in('scheduled_class_id', allClassIds.map(c => c.id))
        setTotalBookings(count ?? 0)
      }

      setLoading(false)
    }

    fetchProfile()
  }, [id])

  useEffect(() => { fetchClasses() }, [id, dateFrom, dateTo])

  if (loading) return <LoadingState />
  if (!profile) return <EmptyState icon={Users} message="Not found" />

  const now = new Date()
  const upcomingCount = classes.filter(c => new Date(c.starts_at) > now).length
  const periodRevenueCents = [...classRevenue.values()].reduce((sum, v) => sum + v, 0)

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
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-4 text-center">
            <CalendarDays className="h-5 w-5 mx-auto text-primary mb-1" />
            <p className="text-2xl font-bold">{upcomingCount}</p>
            <p className="text-xs text-muted-foreground">{isFr ? 'Cours à venir' : 'Upcoming'}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <Clock className="h-5 w-5 mx-auto text-primary mb-1" />
            <p className="text-2xl font-bold">{pastClassCount}</p>
            <p className="text-xs text-muted-foreground">{isFr ? 'Cours donnés' : 'Given'}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <Users className="h-5 w-5 mx-auto text-primary mb-1" />
            <p className="text-2xl font-bold">{totalBookings}</p>
            <p className="text-xs text-muted-foreground">{isFr ? 'Inscriptions' : 'Bookings'}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <Euro className="h-5 w-5 mx-auto text-primary mb-1" />
            <p className="text-2xl font-bold">{formatEuros(periodRevenueCents, 0)}</p>
            <p className="text-xs text-muted-foreground">{isFr ? 'Revenu période' : 'Period revenue'}</p>
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

      {/* Classes with date filter */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <CardTitle className="text-base flex items-center gap-2">
              <CalendarDays className="h-4 w-4" />
              {isFr ? 'Cours' : 'Classes'} ({classes.length})
            </CardTitle>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1">
                <Label className="text-xs">{isFr ? 'Du' : 'From'}</Label>
                <Input type="date" className="h-7 text-xs w-32" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
              </div>
              <div className="flex items-center gap-1">
                <Label className="text-xs">{isFr ? 'Au' : 'To'}</Label>
                <Input type="date" className="h-7 text-xs w-32" value={dateTo} onChange={e => setDateTo(e.target.value)} />
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {classes.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              {isFr ? 'Aucun cours sur cette période' : 'No classes in this period'}
            </p>
          ) : (
            <div className="space-y-2">
              {classes.map(sc => {
                const startsAt = new Date(sc.starts_at)
                const isPast = startsAt < now
                const classColor = sc.class_type?.color || '#3B82F6'
                const booked = bookingCounts.get(sc.id) ?? 0

                return (
                  <div
                    key={sc.id}
                    className={`flex items-center gap-3 p-3 rounded-lg border hover:bg-muted/30 transition-colors cursor-pointer ${isPast ? 'opacity-50' : ''}`}
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
                    <div className="text-right shrink-0 space-y-0.5">
                      <span className={`text-sm font-bold ${booked >= sc.max_participants ? 'text-destructive' : 'text-primary'}`}>
                        {booked}/{sc.max_participants}
                      </span>
                      {(classRevenue.get(sc.id) ?? 0) > 0 && (
                        <p className="text-[10px] text-muted-foreground">{formatEuros(classRevenue.get(sc.id) ?? 0, 0)}</p>
                      )}
                    </div>
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

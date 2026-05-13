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
import { ArrowLeft, CalendarDays, Users, Clock, MapPin, Euro, Pencil, Mail } from 'lucide-react'
import { adminUpdateEmail } from '@/lib/admin-update-email'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { ImageUpload } from '@/components/common/ImageUpload'
import { toast } from 'sonner'
import { formatEuros } from '@/lib/utils'
import { format, addDays } from 'date-fns'
import { fr, enUS } from 'date-fns/locale'
import ReactMarkdown from 'react-markdown'
import { MarkdownLink } from '@/components/common/MarkdownLink'

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
  const [loading, setLoading] = useState(true)

  // Edit coach profile
  const [editOpen, setEditOpen] = useState(false)
  const [editForm, setEditForm] = useState({
    display_name: '',
    phone: '',
    avatar_url: '',
    coach_description: '',
    instagram_url: '',
    facebook_url: '',
    linkedin_url: '',
  })
  const [editSaving, setEditSaving] = useState(false)

  // Email change dialog
  const [emailDialogOpen, setEmailDialogOpen] = useState(false)
  const [newEmail, setNewEmail] = useState('')
  const [emailSaving, setEmailSaving] = useState(false)

  const openEdit = () => {
    setEditForm({
      display_name: profile?.display_name ?? '',
      phone: profile?.phone ?? '',
      avatar_url: profile?.avatar_url ?? '',
      coach_description: profile?.coach_description ?? '',
      instagram_url: profile?.instagram_url ?? '',
      facebook_url: profile?.facebook_url ?? '',
      linkedin_url: profile?.linkedin_url ?? '',
    })
    setEditOpen(true)
  }

  const handleSaveProfile = async () => {
    if (!id) return
    setEditSaving(true)
    const { error } = await supabase.from('profiles').update({
      display_name: editForm.display_name,
      phone: editForm.phone || null,
      avatar_url: editForm.avatar_url || null,
      coach_description: editForm.coach_description || null,
      instagram_url: editForm.instagram_url || null,
      facebook_url: editForm.facebook_url || null,
      linkedin_url: editForm.linkedin_url || null,
    }).eq('id', id)
    setEditSaving(false)
    if (error) { toast.error(error.message); return }
    toast.success(isFr ? 'Profil mis à jour' : 'Profile updated')
    setEditOpen(false)
    // Refresh profile
    const { data } = await supabase.from('profiles').select('*').eq('id', id).single()
    setProfile(data as Profile)
  }

  const handleChangeEmail = async () => {
    if (!id || !profile) return
    const candidate = newEmail.trim().toLowerCase()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(candidate)) {
      toast.error(isFr ? 'Email invalide' : 'Invalid email')
      return
    }
    if (candidate === (profile.email ?? '').toLowerCase()) {
      toast.error(isFr ? 'Adresse identique à l\'actuelle' : 'Same as current address')
      return
    }
    setEmailSaving(true)
    const result = await adminUpdateEmail(id, candidate)
    setEmailSaving(false)
    if (!result.ok) {
      toast.error(result.error ?? (isFr ? 'Échec de la mise à jour' : 'Update failed'))
      return
    }
    toast.success(isFr
      ? `Lien de confirmation envoyé à ${candidate}`
      : `Confirmation link sent to ${candidate}`)
    setEmailDialogOpen(false)
  }

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
      const [profileRes, rolesRes] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', id).single(),
        supabase.from('user_roles').select('role').eq('user_id', id),
      ])

      setProfile(profileRes.data as Profile)
      setRoles((rolesRes.data ?? []).map(r => r.role as UserRole))
      setLoading(false)
    }

    fetchProfile()
  }, [id])

  useEffect(() => { fetchClasses() }, [id, dateFrom, dateTo])

  if (loading) return <LoadingState />
  if (!profile) return <EmptyState icon={Users} message="Not found" />

  const now = new Date()
  const upcomingCount = classes.filter(c => new Date(c.starts_at) > now).length
  const pastCount = classes.filter(c => new Date(c.starts_at) <= now).length
  const totalBookingsInPeriod = [...bookingCounts.values()].reduce((sum, v) => sum + v, 0)
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
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold">{profile.display_name}</h1>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={openEdit}>
              <Pencil className="h-3.5 w-3.5" />
            </Button>
          </div>
          {profile.email && (
            <span className="text-sm text-muted-foreground">{profile.email}</span>
          )}
          {profile.phone && (
            <span className="text-sm text-muted-foreground block">{profile.phone}</span>
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

      {/* Date filter */}
      <div className="flex items-center gap-3 flex-wrap p-3 rounded-lg border bg-muted/30">
        <Label className="text-xs font-semibold">{isFr ? 'Période' : 'Period'}</Label>
        <div className="flex items-center gap-1">
          <Label className="text-xs">{isFr ? 'Du' : 'From'}</Label>
          <Input type="date" className="h-7 text-xs w-32" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
        </div>
        <div className="flex items-center gap-1">
          <Label className="text-xs">{isFr ? 'Au' : 'To'}</Label>
          <Input type="date" className="h-7 text-xs w-32" value={dateTo} onChange={e => setDateTo(e.target.value)} />
        </div>
        <span className="text-xs text-muted-foreground">{classes.length} {isFr ? 'cours' : 'classes'}</span>
      </div>

      {/* Stats (based on filtered period) */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-4 text-center">
            <CalendarDays className="h-5 w-5 mx-auto text-primary mb-1" />
            <p className="text-2xl font-bold">{upcomingCount}</p>
            <p className="text-xs text-muted-foreground">{isFr ? 'À venir' : 'Upcoming'}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <Clock className="h-5 w-5 mx-auto text-primary mb-1" />
            <p className="text-2xl font-bold">{pastCount}</p>
            <p className="text-xs text-muted-foreground">{isFr ? 'Donnés' : 'Given'}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <Users className="h-5 w-5 mx-auto text-primary mb-1" />
            <p className="text-2xl font-bold">{totalBookingsInPeriod}</p>
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
              <ReactMarkdown components={{ a: MarkdownLink }}>{profile.coach_description}</ReactMarkdown>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Classes with date filter */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <CalendarDays className="h-4 w-4" />
            {isFr ? 'Cours' : 'Classes'}
          </CardTitle>
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

      {/* Edit coach profile dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{isFr ? 'Modifier le profil coach' : 'Edit coach profile'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>{isFr ? 'Nom' : 'Name'}</Label>
              <Input value={editForm.display_name} onChange={e => setEditForm(f => ({ ...f, display_name: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>{isFr ? 'Téléphone' : 'Phone'}</Label>
              <Input type="tel" value={editForm.phone} onChange={e => setEditForm(f => ({ ...f, phone: e.target.value }))} />
            </div>
            <div className="rounded-md border bg-muted/30 p-3 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <div className="space-y-0.5 min-w-0">
                  <p className="text-xs font-medium">Email</p>
                  <p className="text-xs text-muted-foreground truncate">{profile?.email ?? '—'}</p>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs shrink-0"
                  onClick={() => { setEditOpen(false); setNewEmail(''); setEmailDialogOpen(true) }}
                >
                  <Mail className="h-3 w-3 mr-1" />
                  {isFr ? 'Corriger…' : 'Fix…'}
                </Button>
              </div>
              <p className="text-[11px] text-muted-foreground">
                {isFr
                  ? `Un lien de confirmation sera envoyé à la nouvelle adresse.`
                  : `A confirmation link will be sent to the new address.`}
              </p>
            </div>
            <div>
              <Label>Photo</Label>
              <ImageUpload
                value={editForm.avatar_url || null}
                onChange={(url) => setEditForm(f => ({ ...f, avatar_url: url ?? '' }))}
                folder="coaches"
                size="md"
              />
            </div>
            <div className="space-y-2">
              <Label>{isFr ? 'Description (markdown)' : 'Description (markdown)'}</Label>
              <Textarea
                value={editForm.coach_description}
                onChange={e => setEditForm(f => ({ ...f, coach_description: e.target.value }))}
                rows={6}
                placeholder={isFr ? 'Spécialités, parcours, philosophie...' : 'Specialties, background, philosophy...'}
              />
            </div>
            <div className="space-y-2">
              <Label>Instagram</Label>
              <Input value={editForm.instagram_url} onChange={e => setEditForm(f => ({ ...f, instagram_url: e.target.value }))} placeholder="https://instagram.com/..." />
            </div>
            <div className="space-y-2">
              <Label>Facebook</Label>
              <Input value={editForm.facebook_url} onChange={e => setEditForm(f => ({ ...f, facebook_url: e.target.value }))} placeholder="https://facebook.com/..." />
            </div>
            <div className="space-y-2">
              <Label>LinkedIn</Label>
              <Input value={editForm.linkedin_url} onChange={e => setEditForm(f => ({ ...f, linkedin_url: e.target.value }))} placeholder="https://linkedin.com/in/..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>{isFr ? 'Annuler' : 'Cancel'}</Button>
            <Button onClick={handleSaveProfile} disabled={editSaving}>
              {editSaving ? '...' : (isFr ? 'Enregistrer' : 'Save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Email change dialog (admin / super_admin) */}
      <Dialog open={emailDialogOpen} onOpenChange={setEmailDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Mail className="h-4 w-4" />
              {isFr ? `Corriger l'email de ${profile?.display_name ?? ''}` : `Fix email for ${profile?.display_name ?? ''}`}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-xs text-muted-foreground">
              {isFr
                ? `Adresse actuelle : ${profile?.email ?? '—'}. Un lien de confirmation sera envoyé à la nouvelle adresse — le changement ne s'applique qu'après confirmation.`
                : `Current address: ${profile?.email ?? '—'}. A confirmation link will be sent to the new address — the change applies only after confirmation.`}
            </p>
            <div className="space-y-1">
              <Label htmlFor="coach-new-email">{isFr ? 'Nouvelle adresse email' : 'New email'}</Label>
              <Input
                id="coach-new-email"
                type="email"
                autoComplete="off"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                placeholder="prenom.nom@example.com"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEmailDialogOpen(false)} disabled={emailSaving}>
              {isFr ? 'Annuler' : 'Cancel'}
            </Button>
            <Button onClick={handleChangeEmail} disabled={emailSaving || !newEmail.trim()}>
              {emailSaving ? '...' : (isFr ? 'Envoyer le lien' : 'Send link')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

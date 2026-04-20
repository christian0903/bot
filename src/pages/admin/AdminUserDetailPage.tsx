import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { supabase } from '@/lib/supabase'
import { logActivity } from '@/lib/activity-log'
import { useAuth } from '@/contexts/AuthContext'
import type { Profile, PackPurchase, Booking, ScheduledClass, MemberCategory } from '@/types'
import { LoadingState } from '@/components/common/LoadingState'
import { EmptyState } from '@/components/common/EmptyState'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from '@/components/ui/select'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { toast } from 'sonner'
import { ArrowLeft, CreditCard, CalendarDays, Package, Plus, Clock, User, Pencil, Receipt } from 'lucide-react'
import { format } from 'date-fns'
import { fr, enUS } from 'date-fns/locale'
import { cn, formatEuros } from '@/lib/utils'

export function AdminUserDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { t, i18n } = useTranslation()
  const { user: currentUser } = useAuth()
  const navigate = useNavigate()
  const locale = i18n.language === 'fr' ? fr : enUS

  const [profile, setProfile] = useState<Profile | null>(null)
  const [packs, setPacks] = useState<PackPurchase[]>([])
  const [bookings, setBookings] = useState<Booking[]>([])
  const [loading, setLoading] = useState(true)

  // Edit pack dialog
  const [editPackDialogOpen, setEditPackDialogOpen] = useState(false)
  const [editingPack, setEditingPack] = useState<PackPurchase | null>(null)
  const [editCredits, setEditCredits] = useState(0)
  const [editExpiresAt, setEditExpiresAt] = useState('')
  const [editPackSaving, setEditPackSaving] = useState(false)

  // Categories
  const [categories, setCategories] = useState<MemberCategory[]>([])

  // Registration fee
  const [hasRegFee, setHasRegFee] = useState(false)
  const [regFeeSaving, setRegFeeSaving] = useState(false)

  // Book class dialog
  const [bookDialogOpen, setBookDialogOpen] = useState(false)
  const [availableClasses, setAvailableClasses] = useState<ScheduledClass[]>([])
  const [selectedClassId, setSelectedClassId] = useState('')
  const [selectedPackId, setSelectedPackId] = useState('')
  const [bookingSaving, setBookingSaving] = useState(false)

  const fetchData = async () => {
    if (!id) return

    const [profileRes, packsRes, bookingsRes, regFeeRes, catRes] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', id).single(),
      supabase
        .from('pack_purchases')
        .select('*, pack_type:pack_types(*, credit_type:credit_types(*))')
        .eq('user_id', id)
        .order('purchased_at', { ascending: false }),
      supabase
        .from('bookings')
        .select('*, scheduled_class:scheduled_classes(*, class_type:class_types(*))')
        .eq('user_id', id)
        .order('created_at', { ascending: false }),
      supabase.from('registration_fees').select('id').eq('user_id', id).limit(1),
      supabase.from('member_categories').select('*').order('name'),
    ])

    setProfile(profileRes.data as Profile)
    setHasRegFee((regFeeRes.data?.length ?? 0) > 0)
    setCategories((catRes.data as MemberCategory[]) ?? [])
    setPacks((packsRes.data as PackPurchase[]) ?? [])

    // Resolve coaches for bookings
    const rawBookings = (bookingsRes.data as Booking[]) ?? []
    const coachIds = [...new Set(rawBookings.map(b => (b.scheduled_class as any)?.coach_id).filter(Boolean))]
    if (coachIds.length > 0) {
      const { data: coaches } = await supabase.from('profiles').select('id, display_name').in('id', coachIds)
      const coachMap = new Map((coaches ?? []).map(c => [c.id, c]))
      for (const b of rawBookings) {
        if (b.scheduled_class) {
          (b.scheduled_class as any).coach = coachMap.get((b.scheduled_class as any).coach_id)
        }
      }
    }

    setBookings(rawBookings)
    setLoading(false)
  }

  const isFr = i18n.language === 'fr'

  const handleToggleRegFee = async () => {
    if (!id) return
    setRegFeeSaving(true)

    if (hasRegFee) {
      // Remove registration fee
      await supabase.from('registration_fees').delete().eq('user_id', id)
      setHasRegFee(false)
      toast.success(isFr ? 'Frais d\'inscription retirés' : 'Registration fee removed')
    } else {
      // Mark as paid (by admin)
      await supabase.from('registration_fees').insert({
        user_id: id,
        amount_cents: 3000,
      })
      setHasRegFee(true)

      // Update member status
      await supabase.rpc('update_member_status', { p_user_id: id })

      await logActivity({
        action: 'registration_fee_paid',
        actor_id: currentUser?.id ?? null,
        target_user_id: id,
        entity_type: 'registration_fee',
        details: { marked_by_admin: true },
        description: `Frais d'inscription validés par admin pour ${profile?.display_name}`,
      })

      toast.success(isFr ? 'Frais d\'inscription validés' : 'Registration fee confirmed')
    }

    setRegFeeSaving(false)
    fetchData()
  }

  useEffect(() => {
    fetchData()
  }, [id])

  const openEditPack = (pack: PackPurchase) => {
    setEditingPack(pack)
    setEditCredits(pack.credits_remaining)
    setEditExpiresAt(format(new Date(pack.expires_at), 'yyyy-MM-dd'))
    setEditPackDialogOpen(true)
  }

  const handleEditPack = async () => {
    if (!editingPack) return
    setEditPackSaving(true)

    const { error } = await supabase
      .from('pack_purchases')
      .update({
        credits_remaining: editCredits,
        expires_at: new Date(editExpiresAt + 'T23:59:59').toISOString(),
      })
      .eq('id', editingPack.id)

    setEditPackSaving(false)
    if (error) {
      toast.error(error.message)
      return
    }

    await logActivity({
      action: 'pack_modified',
      actor_id: currentUser?.id ?? null,
      target_user_id: id!,
      entity_type: 'pack_purchase',
      entity_id: editingPack.id,
      details: {
        pack_name: editingPack.pack_type?.name,
        before: {
          credits_remaining: editingPack.credits_remaining,
          expires_at: editingPack.expires_at,
        },
        after: {
          credits_remaining: editCredits,
          expires_at: editExpiresAt,
        },
      },
      description: `Pack "${editingPack.pack_type?.name}" modifié pour ${profile?.display_name}: crédits ${editingPack.credits_remaining}→${editCredits}, expiration ${format(new Date(editingPack.expires_at), 'dd/MM/yyyy')}→${editExpiresAt}`,
    })

    toast.success(t('common.saveSuccess'))
    setEditPackDialogOpen(false)
    fetchData()
  }

  const openBookDialog = async () => {
    // Fetch upcoming classes
    const { data } = await supabase
      .from('scheduled_classes')
      .select('*, class_type:class_types(*, credit_type:credit_types(name, label_fr, label_en))')
      .gte('starts_at', new Date().toISOString())
      .eq('is_cancelled', false)
      .order('starts_at')
      .limit(50)

    const rawClasses = (data as ScheduledClass[]) ?? []

    // Resolve coaches
    const coachIds = [...new Set(rawClasses.map(c => c.coach_id))]
    if (coachIds.length > 0) {
      const { data: coaches } = await supabase.from('profiles').select('id, display_name').in('id', coachIds)
      const coachMap = new Map((coaches ?? []).map(c => [c.id, c]))
      for (const sc of rawClasses) {
        sc.coach = coachMap.get(sc.coach_id) as any
      }
    }

    setAvailableClasses(rawClasses)
    setSelectedClassId('')
    setSelectedPackId('')
    setBookDialogOpen(true)
  }

  const handleBookClass = async () => {
    if (!id || !selectedClassId || !selectedPackId) return
    setBookingSaving(true)

    // Check not already booked
    const existing = bookings.find(b => b.scheduled_class_id === selectedClassId && b.status === 'confirmed')
    if (existing) {
      toast.error(i18n.language === 'fr' ? 'Déjà inscrit à ce cours' : 'Already booked for this class')
      setBookingSaving(false)
      return
    }

    const { error } = await supabase.from('bookings').insert({
      scheduled_class_id: selectedClassId,
      user_id: id,
      pack_purchase_id: selectedPackId,
    })

    if (error) {
      toast.error(error.message)
      setBookingSaving(false)
      return
    }

    // Consume credit
    await supabase.rpc('consume_credit', { p_pack_purchase_id: selectedPackId })

    const sc = availableClasses.find(c => c.id === selectedClassId)
    await logActivity({
      action: 'booking_assigned',
      actor_id: currentUser?.id ?? null,
      target_user_id: id,
      entity_type: 'booking',
      details: {
        class_name: sc?.class_type?.name,
        starts_at: sc?.starts_at,
        pack_purchase_id: selectedPackId,
      },
      description: `${profile?.display_name} inscrit au cours "${sc?.class_type?.name}" du ${sc ? format(new Date(sc.starts_at), 'dd/MM/yyyy HH:mm') : ''}`,
    })

    toast.success(t('schedule.bookingConfirmed'))
    setBookDialogOpen(false)
    setBookingSaving(false)
    fetchData()
  }

  if (loading) return <LoadingState />
  if (!profile) return <EmptyState icon={User} message={t('common.noResults')} />

  const now = new Date()
  const activePacks = packs.filter(p => p.credits_remaining > 0 && new Date(p.expires_at) > now)
  const totalCredits = activePacks.reduce((sum, p) => sum + p.credits_remaining, 0)
  const upcomingBookings = bookings.filter(b => b.status === 'confirmed' && new Date(b.scheduled_class?.starts_at ?? '') > now)
  const pastBookings = bookings.filter(b => b.status !== 'confirmed' || new Date(b.scheduled_class?.starts_at ?? '') <= now)

  // For booking dialog: filter packs compatible with selected class
  const selectedClass = availableClasses.find(c => c.id === selectedClassId)
  const compatiblePacks = selectedClass
    ? activePacks.filter(p => p.pack_type?.credit_type_id === selectedClass.class_type?.credit_type_id)
    : activePacks

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/admin/users')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <Avatar className="h-14 w-14">
          <AvatarImage src={profile.avatar_url ?? undefined} />
          <AvatarFallback className="text-xl">{profile.display_name?.charAt(0).toUpperCase()}</AvatarFallback>
        </Avatar>
        <div>
          <h1 className="text-2xl font-bold">{profile.display_name}</h1>
          {profile.email && (
            <a href={`mailto:${profile.email}`} className="text-sm text-primary hover:underline">
              {profile.email}
            </a>
          )}
          {profile.phone && (
            <a href={`tel:${profile.phone}`} className="text-sm text-muted-foreground hover:underline block">
              {profile.phone}
            </a>
          )}
        </div>
      </div>

      {/* Status + Category + Registration fee */}
      <div className="flex items-center gap-3 flex-wrap">
        <Badge variant="outline" className={profile.member_status === 'active' ? 'border-green-500 text-green-600' : profile.member_status === 'inactive' ? 'border-orange-500 text-orange-600' : profile.member_status === 'former' ? 'border-red-500 text-red-600' : ''}>
          {t(`profile.status.${profile.member_status}`)}
        </Badge>

        {/* Category selector */}
        <Select
          value={profile.member_category_id ?? ''}
          onValueChange={async (v) => {
            const val = v || null
            await supabase.from('profiles').update({ member_category_id: val }).eq('id', id!)
            setProfile(prev => prev ? { ...prev, member_category_id: val } : prev)
            toast.success(isFr ? 'Catégorie mise à jour' : 'Category updated')
          }}
        >
          <SelectTrigger className="h-7 text-xs w-auto min-w-[120px]">
            <span>{categories.find(c => c.id === profile.member_category_id)?.name || (isFr ? 'Catégorie' : 'Category')}</span>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">{isFr ? 'Aucune' : 'None'}</SelectItem>
            {categories.map(cat => (
              <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="flex items-center gap-2">
          <Badge
            variant={hasRegFee ? 'default' : 'secondary'}
            className={hasRegFee ? 'bg-green-600' : ''}
          >
            <Receipt className="h-3 w-3 mr-1" />
            {isFr
              ? (hasRegFee ? 'Frais OK' : 'Frais non payés')
              : (hasRegFee ? 'Fee OK' : 'Fee unpaid')}
          </Badge>
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs"
            disabled={regFeeSaving}
            onClick={handleToggleRegFee}
          >
            {regFeeSaving ? '...' : hasRegFee
              ? (isFr ? 'Retirer' : 'Remove')
              : (isFr ? 'Valider' : 'Confirm')}
          </Button>
        </div>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-3 gap-3">
        <Card>
          <CardContent className="p-4 text-center">
            <CreditCard className="h-5 w-5 mx-auto text-primary mb-1" />
            <p className="text-2xl font-bold">{totalCredits}</p>
            <p className="text-xs text-muted-foreground">{t('packs.creditsRemaining', { count: totalCredits })}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <Package className="h-5 w-5 mx-auto text-primary mb-1" />
            <p className="text-2xl font-bold">{activePacks.length}</p>
            <p className="text-xs text-muted-foreground">{i18n.language === 'fr' ? 'Packs actifs' : 'Active packs'}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <CalendarDays className="h-5 w-5 mx-auto text-primary mb-1" />
            <p className="text-2xl font-bold">{upcomingBookings.length}</p>
            <p className="text-xs text-muted-foreground">{t('bookings.upcoming')}</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="packs">
        <TabsList>
          <TabsTrigger value="packs">
            <Package className="h-4 w-4 mr-1.5" />
            {t('packs.myPacks')} ({packs.length})
          </TabsTrigger>
          <TabsTrigger value="bookings">
            <CalendarDays className="h-4 w-4 mr-1.5" />
            {t('bookings.title')} ({bookings.length})
          </TabsTrigger>
        </TabsList>

        {/* PACKS TAB */}
        <TabsContent value="packs" className="mt-4 space-y-3">
          {packs.length === 0 ? (
            <EmptyState icon={Package} message={t('packs.noActivePacks')} />
          ) : (
            packs.map((pack) => {
              const isExpired = new Date(pack.expires_at) < now
              const isEmpty = pack.credits_remaining <= 0
              const inactive = isExpired || isEmpty
              const totalInPack = pack.pack_type?.credit_count ?? 1
              const used = totalInPack - pack.credits_remaining
              const progress = (used / totalInPack) * 100
              const creditLabel = i18n.language === 'fr'
                ? pack.pack_type?.credit_type?.label_fr
                : pack.pack_type?.credit_type?.label_en
              const daysLeft = Math.ceil((new Date(pack.expires_at).getTime() - now.getTime()) / 86400000)

              return (
                <Card
                  key={pack.id}
                  className={cn(
                    'cursor-pointer hover:shadow-md hover:border-primary/30 transition-all group',
                    inactive && 'opacity-50'
                  )}
                  onClick={() => openEditPack(pack)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold">{pack.pack_type?.name}</span>
                        <Badge variant="outline" className="text-[11px]">{creditLabel}</Badge>
                      </div>
                      <div className="flex items-center gap-2">
                        {pack.price_paid_cents === 0 && (
                          <Badge variant="secondary" className="text-[11px]">
                            {i18n.language === 'fr' ? 'Offert' : 'Gift'}
                          </Badge>
                        )}
                        {inactive && (
                          <Badge variant="destructive" className="text-[11px]">
                            {isExpired ? t('packs.expired') : i18n.language === 'fr' ? 'Épuisé' : 'Used up'}
                          </Badge>
                        )}
                        <Pencil className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                    </div>
                    <div className="h-2 rounded-full bg-muted overflow-hidden mb-2">
                      <div
                        className="h-full rounded-full bg-primary transition-all"
                        style={{ width: `${100 - progress}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>{pack.credits_remaining}/{totalInPack} crédits</span>
                      <span>{formatEuros(pack.price_paid_cents, 0)}</span>
                      <span>
                        {format(new Date(pack.purchased_at), 'dd/MM/yyyy', { locale })}
                        {' → '}
                        {format(new Date(pack.expires_at), 'dd/MM/yyyy', { locale })}
                        {!inactive && daysLeft <= 14 && (
                          <span className="text-destructive font-medium ml-1">({daysLeft}j)</span>
                        )}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              )
            })
          )}
        </TabsContent>

        {/* BOOKINGS TAB */}
        <TabsContent value="bookings" className="mt-4 space-y-4">
          <div className="flex justify-end">
            <Button size="sm" onClick={openBookDialog} disabled={activePacks.length === 0}>
              <Plus className="h-4 w-4 mr-1" />
              {i18n.language === 'fr' ? 'Inscrire à un cours' : 'Book a class'}
            </Button>
          </div>

          {/* Upcoming */}
          {upcomingBookings.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-muted-foreground mb-2">{t('bookings.upcoming')}</h3>
              <div className="space-y-2">
                {upcomingBookings.map((b) => (
                  <BookingRow key={b.id} booking={b} locale={locale} t={t} />
                ))}
              </div>
            </div>
          )}

          {/* Past */}
          {pastBookings.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-muted-foreground mb-2">{t('bookings.past')}</h3>
              <div className="space-y-2">
                {pastBookings.map((b) => (
                  <BookingRow key={b.id} booking={b} locale={locale} t={t} isPast />
                ))}
              </div>
            </div>
          )}

          {bookings.length === 0 && (
            <EmptyState icon={CalendarDays} message={t('bookings.noBookings')} />
          )}
        </TabsContent>
      </Tabs>

      {/* Book Class Dialog */}
      <Dialog open={bookDialogOpen} onOpenChange={setBookDialogOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CalendarDays className="h-5 w-5 text-primary" />
              {i18n.language === 'fr' ? 'Inscrire à un cours' : 'Book a class'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Class selection */}
            <div className="space-y-2">
              <Label>{i18n.language === 'fr' ? 'Cours' : 'Class'}</Label>
              <Select
                value={selectedClassId}
                onValueChange={(val) => {
                  setSelectedClassId(val ?? '')
                  setSelectedPackId('')
                }}
              >
                <SelectTrigger className="h-auto min-h-[2.5rem] whitespace-normal text-left">
                  <span className="text-sm">
                    {selectedClass
                      ? `${selectedClass.class_type?.name} — ${format(new Date(selectedClass.starts_at), 'EEE dd/MM HH:mm', { locale })} — ${(selectedClass.coach as any)?.display_name ?? ''}`
                      : i18n.language === 'fr' ? 'Choisir un cours' : 'Choose a class'
                    }
                  </span>
                </SelectTrigger>
                <SelectContent className="max-w-[calc(100vw-2rem)] w-[500px]">
                  {availableClasses.map(sc => (
                    <SelectItem key={sc.id} value={sc.id} className="text-sm">
                      <div className="flex flex-col">
                        <span className="font-medium">{sc.class_type?.name}</span>
                        <span className="text-xs text-muted-foreground">
                          {format(new Date(sc.starts_at), 'EEEE dd/MM HH:mm', { locale })} — {(sc.coach as any)?.display_name}
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Pack selection (filtered by credit type) */}
            {selectedClassId && (
              <div className="space-y-2">
                <Label>{i18n.language === 'fr' ? 'Pack à débiter' : 'Pack to debit'}</Label>
                {compatiblePacks.length === 0 ? (
                  <p className="text-sm text-destructive">{t('schedule.noCredits')}</p>
                ) : (
                  <Select
                    value={selectedPackId}
                    onValueChange={(val) => setSelectedPackId(val ?? '')}
                  >
                    <SelectTrigger>
                      <span>
                        {selectedPackId
                          ? (() => {
                              const p = compatiblePacks.find(p => p.id === selectedPackId)
                              return p ? `${p.pack_type?.name} (${p.credits_remaining} crédits)` : ''
                            })()
                          : i18n.language === 'fr' ? 'Choisir un pack' : 'Choose a pack'
                        }
                      </span>
                    </SelectTrigger>
                    <SelectContent>
                      {compatiblePacks.map(p => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.pack_type?.name} — {p.credits_remaining} crédits — exp. {format(new Date(p.expires_at), 'dd/MM', { locale })}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setBookDialogOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button
              onClick={handleBookClass}
              disabled={!selectedClassId || !selectedPackId || bookingSaving}
            >
              {bookingSaving ? '...' : t('common.confirm')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Pack Dialog */}
      <Dialog open={editPackDialogOpen} onOpenChange={setEditPackDialogOpen}>
        <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="h-5 w-5 text-primary" />
              {i18n.language === 'fr' ? 'Modifier le pack' : 'Edit pack'}
            </DialogTitle>
          </DialogHeader>

          {editingPack && (
            <div className="space-y-4">
              <div className="p-3 rounded-lg bg-muted/50">
                <p className="font-medium">{editingPack.pack_type?.name}</p>
                <p className="text-xs text-muted-foreground">
                  {i18n.language === 'fr'
                    ? editingPack.pack_type?.credit_type?.label_fr
                    : editingPack.pack_type?.credit_type?.label_en}
                  {' · '}
                  {i18n.language === 'fr' ? 'Acheté le' : 'Purchased'} {format(new Date(editingPack.purchased_at), 'dd/MM/yyyy', { locale })}
                  {' · '}
                  {formatEuros(editingPack.price_paid_cents, 0)}
                </p>
              </div>

              <div className="space-y-2">
                <Label>{i18n.language === 'fr' ? 'Crédits restants' : 'Credits remaining'}</Label>
                <Input
                  type="number"
                  min={0}
                  max={editingPack.pack_type?.credit_count ?? 999}
                  value={editCredits}
                  onChange={(e) => setEditCredits(parseInt(e.target.value) || 0)}
                />
                <p className="text-[11px] text-muted-foreground">
                  {i18n.language === 'fr' ? 'Pack original' : 'Original pack'}: {editingPack.pack_type?.credit_count} crédits
                </p>
              </div>

              <div className="space-y-2">
                <Label>{i18n.language === 'fr' ? 'Date de fin de validité' : 'Expiry date'}</Label>
                <Input
                  type="date"
                  value={editExpiresAt}
                  onChange={(e) => setEditExpiresAt(e.target.value)}
                />
              </div>

              {/* Bookings made with this pack */}
              <div className="space-y-2">
                <Label>{i18n.language === 'fr' ? 'Réservations avec ce pack' : 'Bookings with this pack'}</Label>
                {(() => {
                  const packBookings = bookings.filter(b => b.pack_purchase_id === editingPack.id)
                  if (packBookings.length === 0) {
                    return (
                      <p className="text-xs text-muted-foreground py-2">
                        {i18n.language === 'fr' ? 'Aucune réservation' : 'No bookings'}
                      </p>
                    )
                  }
                  return (
                    <div className="space-y-1.5 max-h-48 overflow-y-auto">
                      {packBookings.map(b => {
                        const sc = b.scheduled_class
                        const startsAt = new Date(sc?.starts_at ?? '')
                        const isPastBooking = startsAt < now
                        return (
                          <div
                            key={b.id}
                            className={cn(
                              'flex items-center justify-between p-2 rounded border text-xs',
                              isPastBooking && 'opacity-60'
                            )}
                          >
                            <div>
                              <span className="font-medium">{sc?.class_type?.name}</span>
                              <span className="text-muted-foreground ml-2">
                                {format(startsAt, 'dd/MM/yyyy HH:mm', { locale })}
                              </span>
                            </div>
                            <Badge
                              variant={b.status === 'confirmed' ? 'default' : 'secondary'}
                              className="text-[10px] h-5"
                            >
                              {t(`bookings.status.${b.status}`)}
                            </Badge>
                          </div>
                        )
                      })}
                    </div>
                  )
                })()}
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditPackDialogOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button onClick={handleEditPack} disabled={editPackSaving}>
              {editPackSaving ? '...' : t('common.save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function BookingRow({ booking, locale, t, isPast }: {
  booking: Booking
  locale: typeof fr
  t: (key: string) => string
  isPast?: boolean
}) {
  const sc = booking.scheduled_class
  const startsAt = new Date(sc?.starts_at ?? '')

  return (
    <div className={cn(
      'flex items-center gap-3 p-3 rounded-xl border',
      isPast ? 'opacity-60' : 'bg-card'
    )}>
      <div className="flex flex-col items-center justify-center h-11 w-11 rounded-lg bg-primary/10 shrink-0">
        <span className="text-[10px] font-medium text-primary uppercase">
          {format(startsAt, 'EEE', { locale })}
        </span>
        <span className="text-base font-bold text-primary leading-none">
          {format(startsAt, 'd')}
        </span>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="font-medium text-sm truncate">{sc?.class_type?.name}</p>
          <Badge
            variant={booking.status === 'confirmed' ? 'default' : 'secondary'}
            className="text-[10px] h-5"
          >
            {t(`bookings.status.${booking.status}`)}
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground flex items-center gap-1">
          <Clock className="h-3 w-3" />
          {format(startsAt, 'HH:mm', { locale })} · {sc?.duration_minutes} min
          {(sc as any)?.coach?.display_name && ` · ${(sc as any).coach.display_name}`}
        </p>
      </div>
    </div>
  )
}

import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { supabase } from '@/lib/supabase'
import type { Profile, PackPurchase, Booking, ScheduledClass } from '@/types'
import { LoadingState } from '@/components/common/LoadingState'
import { EmptyState } from '@/components/common/EmptyState'
import { Button } from '@/components/ui/button'
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
import { ArrowLeft, CreditCard, CalendarDays, Package, Plus, Clock, User } from 'lucide-react'
import { format } from 'date-fns'
import { fr, enUS } from 'date-fns/locale'
import { cn } from '@/lib/utils'

export function AdminUserDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const locale = i18n.language === 'fr' ? fr : enUS

  const [profile, setProfile] = useState<Profile | null>(null)
  const [packs, setPacks] = useState<PackPurchase[]>([])
  const [bookings, setBookings] = useState<Booking[]>([])
  const [loading, setLoading] = useState(true)

  // Book class dialog
  const [bookDialogOpen, setBookDialogOpen] = useState(false)
  const [availableClasses, setAvailableClasses] = useState<ScheduledClass[]>([])
  const [selectedClassId, setSelectedClassId] = useState('')
  const [selectedPackId, setSelectedPackId] = useState('')
  const [bookingSaving, setBookingSaving] = useState(false)

  const fetchData = async () => {
    if (!id) return

    const [profileRes, packsRes, bookingsRes] = await Promise.all([
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
    ])

    setProfile(profileRes.data as Profile)
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

  useEffect(() => {
    fetchData()
  }, [id])

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
                <Card key={pack.id} className={cn(inactive && 'opacity-50')}>
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
                      <span>{(pack.price_paid_cents / 100).toFixed(0)}€</span>
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
                <SelectTrigger>
                  <span>
                    {selectedClass
                      ? `${selectedClass.class_type?.name} — ${format(new Date(selectedClass.starts_at), 'EEE dd/MM HH:mm', { locale })} — ${(selectedClass.coach as any)?.display_name ?? ''}`
                      : i18n.language === 'fr' ? 'Choisir un cours' : 'Choose a class'
                    }
                  </span>
                </SelectTrigger>
                <SelectContent>
                  {availableClasses.map(sc => (
                    <SelectItem key={sc.id} value={sc.id}>
                      {sc.class_type?.name} — {format(new Date(sc.starts_at), 'EEE dd/MM HH:mm', { locale })} — {(sc.coach as any)?.display_name}
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

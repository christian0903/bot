import { useEffect, useState, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { supabase } from '@/lib/supabase'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { LoadingState } from '@/components/common/LoadingState'
import { DollarSign, CreditCard, Users, ChevronRight, CalendarDays } from 'lucide-react'
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfQuarter, endOfQuarter, startOfYear, endOfYear } from 'date-fns'
import { fr, enUS } from 'date-fns/locale'

type PeriodPreset = 'week' | 'month' | 'quarter' | 'year' | 'custom'

interface PackSale {
  id: string
  user_name: string
  pack_name: string
  price_paid_cents: number
  credits: number
  purchased_at: string
}

interface BookingDetail {
  id: string
  user_name: string
  class_name: string
  starts_at: string
  pack_name: string
  price_paid_cents: number
  credit_count: number
}

interface CoachStat {
  coach_id: string
  coach_name: string
  class_count: number
  total_bookings: number
  total_revenue_cents: number
  classes: {
    id: string
    class_name: string
    starts_at: string
    bookings: number
    revenue_cents: number
  }[]
}

export function AdminDashboardPage() {
  const { t, i18n } = useTranslation()
  const locale = i18n.language === 'fr' ? fr : enUS
  const isFr = i18n.language === 'fr'

  const [loading, setLoading] = useState(true)
  const [preset, setPreset] = useState<PeriodPreset>('month')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')

  const [packSales, setPackSales] = useState<PackSale[]>([])
  const [bookings, setBookings] = useState<BookingDetail[]>([])
  const [coachStats, setCoachStats] = useState<CoachStat[]>([])

  const [detailDialog, setDetailDialog] = useState<'packs' | 'credits' | 'coach' | null>(null)
  const [selectedCoach, setSelectedCoach] = useState<CoachStat | null>(null)

  // Compute date range
  const { dateFrom, dateTo } = useMemo(() => {
    const now = new Date()
    if (preset === 'custom' && customFrom && customTo) {
      return { dateFrom: new Date(customFrom + 'T00:00:00'), dateTo: new Date(customTo + 'T23:59:59') }
    }
    switch (preset) {
      case 'week': return { dateFrom: startOfWeek(now, { weekStartsOn: 1 }), dateTo: endOfWeek(now, { weekStartsOn: 1 }) }
      case 'month': return { dateFrom: startOfMonth(now), dateTo: endOfMonth(now) }
      case 'quarter': return { dateFrom: startOfQuarter(now), dateTo: endOfQuarter(now) }
      case 'year': return { dateFrom: startOfYear(now), dateTo: endOfYear(now) }
      default: return { dateFrom: startOfMonth(now), dateTo: endOfMonth(now) }
    }
  }, [preset, customFrom, customTo])

  useEffect(() => {
    fetchData()
  }, [dateFrom, dateTo])

  const fetchData = async () => {
    setLoading(true)
    const from = dateFrom.toISOString()
    const to = dateTo.toISOString()

    // 1. Pack sales in period
    const { data: purchasesData } = await supabase
      .from('pack_purchases')
      .select('id, user_id, pack_type_id, price_paid_cents, credits_remaining, purchased_at, pack_type:pack_types(name, credit_count)')
      .gte('purchased_at', from)
      .lte('purchased_at', to)
      .order('purchased_at', { ascending: false })

    // Resolve user names
    const userIds = [...new Set((purchasesData ?? []).map(p => p.user_id))]
    const profileMap = new Map<string, string>()
    if (userIds.length > 0) {
      const { data: profiles } = await supabase.from('profiles').select('id, display_name').in('id', userIds)
      for (const p of profiles ?? []) profileMap.set(p.id, p.display_name)
    }

    const sales: PackSale[] = (purchasesData ?? []).map(p => ({
      id: p.id,
      user_name: profileMap.get(p.user_id) ?? '-',
      pack_name: (p.pack_type as any)?.name ?? '-',
      price_paid_cents: p.price_paid_cents,
      credits: (p.pack_type as any)?.credit_count ?? 0,
      purchased_at: p.purchased_at,
    }))
    setPackSales(sales)

    // 2. Bookings (credits consumed) in period — based on class date
    const { data: classesInPeriod } = await supabase
      .from('scheduled_classes')
      .select('id, class_type_id, coach_id, starts_at, class_type:class_types(name)')
      .gte('starts_at', from)
      .lte('starts_at', to)
      .eq('is_cancelled', false)
      .order('starts_at')

    const classIds = (classesInPeriod ?? []).map(c => c.id)
    let allBookings: any[] = []
    if (classIds.length > 0) {
      const { data: bookingsData } = await supabase
        .from('bookings')
        .select('id, scheduled_class_id, user_id, pack_purchase_id, status, pack_purchase:pack_purchases(price_paid_cents, pack_type:pack_types(name, credit_count))')
        .in('scheduled_class_id', classIds)
        .eq('status', 'confirmed')

      allBookings = bookingsData ?? []

      // Resolve user names for bookings
      const bookingUserIds = [...new Set(allBookings.map((b: any) => b.user_id))]
      const missingIds = bookingUserIds.filter(id => !profileMap.has(id))
      if (missingIds.length > 0) {
        const { data: extraProfiles } = await supabase.from('profiles').select('id, display_name').in('id', missingIds)
        for (const p of extraProfiles ?? []) profileMap.set(p.id, p.display_name)
      }
    }

    // Resolve coach names
    const coachIds = [...new Set((classesInPeriod ?? []).map(c => c.coach_id).filter(Boolean))]
    const missingCoachIds = coachIds.filter(id => !profileMap.has(id))
    if (missingCoachIds.length > 0) {
      const { data: coachProfiles } = await supabase.from('profiles').select('id, display_name').in('id', missingCoachIds)
      for (const p of coachProfiles ?? []) profileMap.set(p.id, p.display_name)
    }

    // Build booking details
    const classMap = new Map((classesInPeriod ?? []).map(c => [c.id, c]))
    const bookingDetails: BookingDetail[] = allBookings.map((b: any) => {
      const sc = classMap.get(b.scheduled_class_id)
      const pp = b.pack_purchase
      return {
        id: b.id,
        user_name: profileMap.get(b.user_id) ?? '-',
        class_name: (sc?.class_type as any)?.name ?? '-',
        starts_at: sc?.starts_at ?? '',
        pack_name: pp?.pack_type?.name ?? '-',
        price_paid_cents: pp?.price_paid_cents ?? 0,
        credit_count: pp?.pack_type?.credit_count ?? 1,
      }
    })
    setBookings(bookingDetails)

    // 3. Coach stats
    const coachMap = new Map<string, CoachStat>()
    for (const sc of classesInPeriod ?? []) {
      const cid = sc.coach_id ?? 'none'
      if (!coachMap.has(cid)) {
        coachMap.set(cid, {
          coach_id: cid,
          coach_name: profileMap.get(cid) ?? (isFr ? 'Sans coach' : 'No coach'),
          class_count: 0,
          total_bookings: 0,
          total_revenue_cents: 0,
          classes: [],
        })
      }
      const stat = coachMap.get(cid)!
      stat.class_count++

      const classBookings = allBookings.filter((b: any) => b.scheduled_class_id === sc.id)
      let classRevenue = 0
      for (const b of classBookings) {
        const pp = b.pack_purchase
        const creditValue = (pp?.price_paid_cents ?? 0) / (pp?.pack_type?.credit_count ?? 1)
        classRevenue += creditValue
      }

      stat.total_bookings += classBookings.length
      stat.total_revenue_cents += classRevenue
      stat.classes.push({
        id: sc.id,
        class_name: (sc.class_type as any)?.name ?? '-',
        starts_at: sc.starts_at,
        bookings: classBookings.length,
        revenue_cents: classRevenue,
      })
    }
    setCoachStats([...coachMap.values()].sort((a, b) => b.total_revenue_cents - a.total_revenue_cents))

    setLoading(false)
  }

  // Totals
  const totalRevenue = packSales.reduce((s, p) => s + p.price_paid_cents, 0)
  const totalCreditsConsumed = bookings.length
  const totalClassRevenue = bookings.reduce((s, b) => s + (b.price_paid_cents / b.credit_count), 0)

  const presets: { value: PeriodPreset; label: string }[] = [
    { value: 'week', label: isFr ? 'Cette semaine' : 'This week' },
    { value: 'month', label: isFr ? 'Ce mois' : 'This month' },
    { value: 'quarter', label: isFr ? 'Ce trimestre' : 'This quarter' },
    { value: 'year', label: isFr ? 'Cette année' : 'This year' },
    { value: 'custom', label: isFr ? 'Personnalisé' : 'Custom' },
  ]

  const openCoachDetail = (coach: CoachStat) => {
    setSelectedCoach(coach)
    setDetailDialog('coach')
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">{t('admin.dashboard.title')}</h1>

      {/* Period selector */}
      <div className="flex flex-wrap items-end gap-3 p-3 rounded-lg border bg-muted/30">
        <div className="flex gap-1.5">
          {presets.map(p => (
            <Button
              key={p.value}
              variant={preset === p.value ? 'default' : 'outline'}
              size="sm"
              className="text-xs"
              onClick={() => setPreset(p.value)}
            >
              {p.label}
            </Button>
          ))}
        </div>
        {preset === 'custom' && (
          <div className="flex items-end gap-2">
            <div>
              <Label className="text-xs">{isFr ? 'Du' : 'From'}</Label>
              <Input type="date" className="h-8 text-xs w-36" value={customFrom} onChange={e => setCustomFrom(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">{isFr ? 'Au' : 'To'}</Label>
              <Input type="date" className="h-8 text-xs w-36" value={customTo} onChange={e => setCustomTo(e.target.value)} />
            </div>
          </div>
        )}
        <span className="text-xs text-muted-foreground ml-auto">
          {format(dateFrom, 'dd MMM', { locale })} — {format(dateTo, 'dd MMM yyyy', { locale })}
        </span>
      </div>

      {loading ? <LoadingState /> : (
        <>
          {/* KPI Cards */}
          <div className="grid gap-4 md:grid-cols-3">
            {/* Total recettes */}
            <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setDetailDialog('packs')}>
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-3">
                  <div className="h-10 w-10 rounded-xl bg-green-100 dark:bg-green-950 flex items-center justify-center">
                    <DollarSign className="h-5 w-5 text-green-600" />
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </div>
                <p className="text-3xl font-bold">{(totalRevenue / 100).toFixed(0)}€</p>
                <p className="text-sm text-muted-foreground mt-1">
                  {isFr ? 'Recettes encaissées' : 'Revenue collected'}
                </p>
                <p className="text-xs text-muted-foreground">
                  {packSales.length} {isFr ? 'pack(s) vendu(s)' : 'pack(s) sold'}
                </p>
              </CardContent>
            </Card>

            {/* Total crédits consommés */}
            <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setDetailDialog('credits')}>
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-3">
                  <div className="h-10 w-10 rounded-xl bg-blue-100 dark:bg-blue-950 flex items-center justify-center">
                    <CreditCard className="h-5 w-5 text-blue-600" />
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </div>
                <p className="text-3xl font-bold">{totalCreditsConsumed}</p>
                <p className="text-sm text-muted-foreground mt-1">
                  {isFr ? 'Crédits consommés' : 'Credits consumed'}
                </p>
                <p className="text-xs text-muted-foreground">
                  {isFr ? 'Valeur' : 'Value'}: {(totalClassRevenue / 100).toFixed(0)}€
                </p>
              </CardContent>
            </Card>

            {/* Total cours */}
            <Card>
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-3">
                  <div className="h-10 w-10 rounded-xl bg-purple-100 dark:bg-purple-950 flex items-center justify-center">
                    <CalendarDays className="h-5 w-5 text-purple-600" />
                  </div>
                </div>
                <p className="text-3xl font-bold">{coachStats.reduce((s, c) => s + c.class_count, 0)}</p>
                <p className="text-sm text-muted-foreground mt-1">
                  {isFr ? 'Cours donnés' : 'Classes given'}
                </p>
                <p className="text-xs text-muted-foreground">
                  {coachStats.length} {isFr ? 'coach(s)' : 'coach(es)'}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Coach stats table */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Users className="h-4 w-4 text-primary" />
                {isFr ? 'Cours par coach' : 'Classes by coach'}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {coachStats.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">{t('common.noResults')}</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{isFr ? 'Coach' : 'Coach'}</TableHead>
                      <TableHead className="text-center">{isFr ? 'Cours' : 'Classes'}</TableHead>
                      <TableHead className="text-center">{isFr ? 'Réservations' : 'Bookings'}</TableHead>
                      <TableHead className="text-right">{isFr ? 'Valeur crédits' : 'Credit value'}</TableHead>
                      <TableHead className="w-10"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {coachStats.map(coach => (
                      <TableRow key={coach.coach_id} className="cursor-pointer hover:bg-muted/50" onClick={() => openCoachDetail(coach)}>
                        <TableCell className="font-medium">{coach.coach_name}</TableCell>
                        <TableCell className="text-center">{coach.class_count}</TableCell>
                        <TableCell className="text-center">{coach.total_bookings}</TableCell>
                        <TableCell className="text-right font-medium">{(coach.total_revenue_cents / 100).toFixed(0)}€</TableCell>
                        <TableCell><ChevronRight className="h-4 w-4 text-muted-foreground" /></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </>
      )}

      {/* Detail: Pack Sales */}
      <Dialog open={detailDialog === 'packs'} onOpenChange={(open) => !open && setDetailDialog(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{isFr ? 'Détail des ventes de packs' : 'Pack sales detail'}</DialogTitle>
          </DialogHeader>
          {packSales.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">{t('common.noResults')}</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{isFr ? 'Date' : 'Date'}</TableHead>
                  <TableHead>{isFr ? 'Client' : 'Client'}</TableHead>
                  <TableHead>{isFr ? 'Pack' : 'Pack'}</TableHead>
                  <TableHead className="text-center">{isFr ? 'Crédits' : 'Credits'}</TableHead>
                  <TableHead className="text-right">{isFr ? 'Montant' : 'Amount'}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {packSales.map(sale => (
                  <TableRow key={sale.id}>
                    <TableCell className="text-sm">{format(new Date(sale.purchased_at), 'dd/MM/yyyy', { locale })}</TableCell>
                    <TableCell>{sale.user_name}</TableCell>
                    <TableCell>{sale.pack_name}</TableCell>
                    <TableCell className="text-center">{sale.credits}</TableCell>
                    <TableCell className="text-right font-medium">
                      {sale.price_paid_cents === 0
                        ? <Badge variant="secondary" className="text-[10px]">{isFr ? 'Offert' : 'Gift'}</Badge>
                        : `${(sale.price_paid_cents / 100).toFixed(0)}€`
                      }
                    </TableCell>
                  </TableRow>
                ))}
                <TableRow className="font-bold border-t-2">
                  <TableCell colSpan={3}>{isFr ? 'Total' : 'Total'}</TableCell>
                  <TableCell className="text-center">{packSales.reduce((s, p) => s + p.credits, 0)}</TableCell>
                  <TableCell className="text-right">{(totalRevenue / 100).toFixed(0)}€</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          )}
        </DialogContent>
      </Dialog>

      {/* Detail: Credits consumed */}
      <Dialog open={detailDialog === 'credits'} onOpenChange={(open) => !open && setDetailDialog(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{isFr ? 'Détail des crédits consommés' : 'Credits consumed detail'}</DialogTitle>
          </DialogHeader>
          {bookings.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">{t('common.noResults')}</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{isFr ? 'Date' : 'Date'}</TableHead>
                  <TableHead>{isFr ? 'Cours' : 'Class'}</TableHead>
                  <TableHead>{isFr ? 'Client' : 'Client'}</TableHead>
                  <TableHead>{isFr ? 'Pack' : 'Pack'}</TableHead>
                  <TableHead className="text-right">{isFr ? 'Valeur' : 'Value'}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {bookings.map(b => (
                  <TableRow key={b.id}>
                    <TableCell className="text-sm">{b.starts_at ? format(new Date(b.starts_at), 'dd/MM HH:mm', { locale }) : '-'}</TableCell>
                    <TableCell>{b.class_name}</TableCell>
                    <TableCell>{b.user_name}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{b.pack_name}</TableCell>
                    <TableCell className="text-right font-medium">{(b.price_paid_cents / b.credit_count / 100).toFixed(0)}€</TableCell>
                  </TableRow>
                ))}
                <TableRow className="font-bold border-t-2">
                  <TableCell colSpan={4}>{isFr ? 'Total' : 'Total'} ({bookings.length} {isFr ? 'crédits' : 'credits'})</TableCell>
                  <TableCell className="text-right">{(totalClassRevenue / 100).toFixed(0)}€</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          )}
        </DialogContent>
      </Dialog>

      {/* Detail: Coach classes */}
      <Dialog open={detailDialog === 'coach'} onOpenChange={(open) => !open && setDetailDialog(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selectedCoach?.coach_name} — {isFr ? 'Détail des cours' : 'Class detail'}</DialogTitle>
          </DialogHeader>
          {selectedCoach && (
            <>
              <div className="flex gap-4 mb-4">
                <Badge variant="outline">{selectedCoach.class_count} {isFr ? 'cours' : 'classes'}</Badge>
                <Badge variant="outline">{selectedCoach.total_bookings} {isFr ? 'réservations' : 'bookings'}</Badge>
                <Badge variant="outline">{(selectedCoach.total_revenue_cents / 100).toFixed(0)}€</Badge>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{isFr ? 'Date' : 'Date'}</TableHead>
                    <TableHead>{isFr ? 'Cours' : 'Class'}</TableHead>
                    <TableHead className="text-center">{isFr ? 'Résa.' : 'Book.'}</TableHead>
                    <TableHead className="text-right">{isFr ? 'Valeur' : 'Value'}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {selectedCoach.classes.map(c => (
                    <TableRow key={c.id}>
                      <TableCell className="text-sm">{format(new Date(c.starts_at), 'EEE dd/MM HH:mm', { locale })}</TableCell>
                      <TableCell>{c.class_name}</TableCell>
                      <TableCell className="text-center">{c.bookings}</TableCell>
                      <TableCell className="text-right font-medium">{(c.revenue_cents / 100).toFixed(0)}€</TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="font-bold border-t-2">
                    <TableCell colSpan={2}>{isFr ? 'Total' : 'Total'}</TableCell>
                    <TableCell className="text-center">{selectedCoach.total_bookings}</TableCell>
                    <TableCell className="text-right">{(selectedCoach.total_revenue_cents / 100).toFixed(0)}€</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

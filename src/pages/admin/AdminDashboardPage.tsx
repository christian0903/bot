import { useEffect, useState, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { supabase } from '@/lib/supabase'
import { formatEuros, creditValueCents } from '@/lib/utils'
import { one, type ToOne } from '@/lib/supabase-joins'
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
import { Euro, CreditCard, Users, ChevronRight, CalendarDays, Download } from 'lucide-react'
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfQuarter, endOfQuarter, startOfYear, endOfYear } from 'date-fns'
import { fr, enUS } from 'date-fns/locale'

type PeriodPreset = 'week' | 'month' | 'quarter' | 'year' | 'custom'

/**
 * Une réservation telle que la renvoie la requête de cette page — le pack
 * acheté et son type sont ramenés par jointure, pour valoriser la séance.
 */
interface BookingRow {
  id: string
  scheduled_class_id: string
  user_id: string
  pack_purchase_id: string | null
  status: string
  pack_purchase: ToOne<{
    price_paid_cents: number
    pack_type: ToOne<{ name: string; credit_count: number; is_unlimited: boolean }>
  }>
}

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
  class_title: string
  coach_name: string
  starts_at: string
  pack_name: string
  price_paid_cents: number
  credit_value_cents: number
}

interface CoachStat {
  coach_id: string
  coach_name: string
  /** Cours réellement donnés : passés, non annulés, avec le minimum d'inscrits. */
  class_count: number
  /** Tous les cours au programme sur la période (à venir et annulés compris). */
  scheduled_count: number
  total_bookings: number
  total_revenue_cents: number
  classes: {
    id: string
    class_name: string
    starts_at: string
    bookings: number
    revenue_cents: number
    was_given: boolean
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
  /**
   * Les trois étapes du parcours franchies pendant la période : inscription,
   * premier essai réservé, premier pack acheté. On date la TRANSITION et non
   * l'état courant — quelqu'un devenu membre en juin ne compte pas dans les
   * achats de juillet.
   */
  const [parcours, setParcours] = useState({ inscriptions: 0, essais: 0, achats: 0 })

  const [detailDialog, setDetailDialog] = useState<'packs' | 'credits' | 'coach' | null>(null)
  const [selectedCoach, setSelectedCoach] = useState<CoachStat | null>(null)
  /**
   * Coût moyen d'une séance sur un pack illimité (Réglages). Sur ces packs
   * credit_count n'est pas un diviseur valable : sans ce montant, le prix
   * entier du pack serait attribué à chaque séance.
   */
  const [unlimitedSessionCost, setUnlimitedSessionCost] = useState<number | null>(null)
  /** Minimum d'inscrits pour qu'un cours compte comme donné (Réglages). */
  const [minParticipants, setMinParticipants] = useState(1)
  const [settingsLoaded, setSettingsLoaded] = useState(false)

  useEffect(() => {
    supabase
      .from('app_settings')
      .select('key, value')
      .in('key', ['unlimited_session_cost', 'class_given_rule'])
      .then(({ data }) => {
        for (const s of data ?? []) {
          if (s.key === 'unlimited_session_cost') {
            setUnlimitedSessionCost((s.value as { amount_cents?: number })?.amount_cents ?? null)
          }
          if (s.key === 'class_given_rule') {
            setMinParticipants((s.value as { min_participants?: number })?.min_participants ?? 1)
          }
        }
        setSettingsLoaded(true)
      })
  }, [])

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

  // Attendre le paramètre : sans lui, les séances des packs illimités
  // seraient valorisées à 0 au premier rendu.
  useEffect(() => {
    if (settingsLoaded) fetchData()
  }, [dateFrom, dateTo, settingsLoaded, unlimitedSessionCost, minParticipants])

  const fetchData = async () => {
    setLoading(true)
    const from = dateFrom.toISOString()
    const to = dateTo.toISOString()

    // 1. Pack sales in period
    const { data: purchasesData } = await supabase
      .from('pack_purchases')
      .select('id, user_id, pack_type_id, price_paid_cents, credits_remaining, purchased_at, pack_type:pack_types(name, credit_count, is_unlimited)')
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
      pack_name: one(p.pack_type)?.name ?? '-',
      price_paid_cents: p.price_paid_cents,
      credits: one(p.pack_type)?.credit_count ?? 0,
      purchased_at: p.purchased_at,
    }))
    setPackSales(sales)

    // 2. Bookings (credits consumed) in period — based on class date
    // Les cours annulés sont chargés eux aussi : ils comptent dans les cours
    // PLANIFIÉS (ils étaient au programme) mais jamais dans les cours DONNÉS.
    const { data: allClassesInPeriod } = await supabase
      .from('scheduled_classes')
      .select('id, class_type_id, coach_id, starts_at, title, is_cancelled, class_type:class_types(name)')
      .gte('starts_at', from)
      .lte('starts_at', to)
      .order('starts_at')

    // Les réservations et le CA ne portent que sur les cours non annulés.
    const classesInPeriod = (allClassesInPeriod ?? []).filter(c => !c.is_cancelled)

    const classIds = classesInPeriod.map(c => c.id)
    let allBookings: BookingRow[] = []
    if (classIds.length > 0) {
      const { data: bookingsData } = await supabase
        .from('bookings')
        .select('id, scheduled_class_id, user_id, pack_purchase_id, status, pack_purchase:pack_purchases(price_paid_cents, pack_type:pack_types(name, credit_count, is_unlimited))')
        .in('scheduled_class_id', classIds)
        .eq('status', 'confirmed')

      allBookings = (bookingsData ?? []) as BookingRow[]

      // Resolve user names for bookings
      const bookingUserIds = [...new Set(allBookings.map(b => b.user_id))]
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
    const bookingDetails: BookingDetail[] = allBookings.map(b => {
      const sc = classMap.get(b.scheduled_class_id)
      const pp = one(b.pack_purchase)
      return {
        id: b.id,
        user_name: profileMap.get(b.user_id) ?? '-',
        class_name: one(sc?.class_type)?.name ?? '-',
        class_title: sc?.title ?? '',
        coach_name: sc?.coach_id ? (profileMap.get(sc.coach_id) ?? '-') : '',
        starts_at: sc?.starts_at ?? '',
        pack_name: one(pp?.pack_type)?.name ?? '-',
        price_paid_cents: pp?.price_paid_cents ?? 0,
        // Valeur de la séance, calculée une seule fois ici : prix / crédits,
        // ou le coût moyen paramétré si le pack est illimité.
        credit_value_cents: creditValueCents(
          pp?.price_paid_cents ?? 0,
          one(pp?.pack_type),
          unlimitedSessionCost,
        ) ?? 0,
      }
    })
    setBookings(bookingDetails)

    // 3. Coach stats
    //
    // Deux compteurs, sur les seuls cours DÉJÀ PASSÉS de la période. Un cours
    // à venir n'a pas encore eu l'occasion d'être donné : l'inclure rendrait
    // les deux chiffres incomparables.
    //  - PLANIFIÉS : les cours qui étaient au programme, annulations comprises.
    //  - DONNÉS : ceux qui ont réellement eu lieu — non annulés, et ayant
    //    réuni au moins `minParticipants` inscrits.
    const nowTs = Date.now()
    const coachMap = new Map<string, CoachStat>()
    for (const sc of allClassesInPeriod ?? []) {
      // Les cours à venir ne sont comptés dans aucun des deux compteurs.
      if (new Date(sc.starts_at).getTime() >= nowTs) continue
      const cid = sc.coach_id ?? 'none'
      if (!coachMap.has(cid)) {
        coachMap.set(cid, {
          coach_id: cid,
          coach_name: profileMap.get(cid) ?? (isFr ? 'Sans coach' : 'No coach'),
          class_count: 0,
          scheduled_count: 0,
          total_bookings: 0,
          total_revenue_cents: 0,
          classes: [],
        })
      }
      const stat = coachMap.get(cid)!
      stat.scheduled_count++

      // Un cours annulé reste planifié, mais n'est ni donné ni générateur de CA.
      if (sc.is_cancelled) continue

      // allBookings est déjà filtré sur status='confirmed' à la requête.
      const classBookings = allBookings.filter(b => b.scheduled_class_id === sc.id)
      let classRevenue = 0
      for (const b of classBookings) {
        const pp = one(b.pack_purchase)
        // Sur un illimité, credit_count n'est pas un diviseur valable :
        // on retombe sur le coût moyen paramétré dans les Réglages.
        classRevenue += creditValueCents(
          pp?.price_paid_cents ?? 0,
          one(pp?.pack_type),
          unlimitedSessionCost,
        ) ?? 0
      }

      // Le cours est forcément passé et non annulé ici : reste le seuil.
      const wasGiven = classBookings.length >= minParticipants
      if (wasGiven) stat.class_count++

      stat.total_bookings += classBookings.length
      stat.total_revenue_cents += classRevenue
      stat.classes.push({
        id: sc.id,
        class_name: one(sc.class_type)?.name ?? '-',
        starts_at: sc.starts_at,
        bookings: classBookings.length,
        revenue_cents: classRevenue,
        was_given: wasGiven,
      })
    }
    setCoachStats([...coachMap.values()].sort((a, b) => b.total_revenue_cents - a.total_revenue_cents))

    // 4. Étapes du parcours franchies dans la période. Une fonction SQL plutôt
    // qu'une agrégation ici : elle date les transitions par des MIN(), ce qui
    // se fait mal côté client sans tout charger.
    const { data: par } = await supabase.rpc('stats_parcours', { p_from: from, p_to: to })
    const ligne = Array.isArray(par) ? par[0] : par
    setParcours({
      inscriptions: ligne?.inscriptions ?? 0,
      essais: ligne?.essais ?? 0,
      achats: ligne?.achats ?? 0,
    })

    setLoading(false)
  }

  // Totals
  const totalRevenue = packSales.reduce((s, p) => s + p.price_paid_cents, 0)
  const totalCreditsConsumed = bookings.length
  const totalClassRevenue = bookings.reduce((s, b) => s + b.credit_value_cents, 0)

  /**
   * Remplissage moyen : inscrits par cours donné. C'est la maille utile — le
   * studio raisonne en cours, pas en heures. Un ratio « par heure » obligeait à
   * traduire mentalement un semi-privé de 50 min en 0,83 heure, sans rien
   * apporter : deux formats de cours qui se comparent bien sont le
   * semi-privé et le personal training, et c'est leur remplissage qui parle,
   * pas leur durée.
   */

  /**
   * Revenu moyen par séance donnée. `totalClassRevenue` additionne, réservation
   * par réservation, ce que vaut le crédit consommé : deux membres à 30 € et
   * 20 € font 50 € pour ce cours-là. Divisé par les cours réellement donnés,
   * cela dit ce que rapporte un créneau — un chiffre comparable d'un mois à
   * l'autre, là où le total dépend du nombre de cours au programme.
   *
   * Dénominateur : les cours DONNÉS, pas les planifiés. Un créneau annulé ou
   * sans inscrit n'a rien rapporté ; le compter tirerait la moyenne vers le bas
   * sans rien dire de la valeur d'une séance.
   */
  const coursDonnes = coachStats.reduce((s, c) => s + c.class_count, 0)
  const revenuMoyenParSeance = coursDonnes > 0 ? totalClassRevenue / coursDonnes : null
  const inscritsParCours = coursDonnes > 0 ? totalCreditsConsumed / coursDonnes : null


  const presets: { value: PeriodPreset; label: string }[] = [
    { value: 'week', label: isFr ? 'Cette semaine' : 'This week' },
    { value: 'month', label: isFr ? 'Ce mois' : 'This month' },
    { value: 'quarter', label: isFr ? 'Ce trimestre' : 'This quarter' },
    { value: 'year', label: isFr ? 'Cette année' : 'This year' },
    { value: 'custom', label: isFr ? 'Personnalisé' : 'Custom' },
  ]

  const exportCsv = (rows: Record<string, string | number>[], filename: string) => {
    if (rows.length === 0) return
    const BOM = '\uFEFF'
    const headers = Object.keys(rows[0])
    const csv = BOM + [
      headers.join(';'),
      ...rows.map(row => headers.map(h => `"${String(row[h] ?? '').replace(/"/g, '""')}"`).join(';'))
    ].join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `${filename}.csv`
    link.click()
  }

  const exportPackSales = () => {
    const periodLabel = format(dateFrom, 'yyyy-MM-dd') + '_' + format(dateTo, 'yyyy-MM-dd')
    exportCsv(
      packSales.map(s => ({
        'Date': format(new Date(s.purchased_at), 'dd/MM/yyyy HH:mm'),
        'Client': s.user_name,
        'Pack': s.pack_name,
        'Crédits': s.credits,
        'Montant (€)': s.price_paid_cents === 0 ? 'Offert' : formatEuros(s.price_paid_cents),
      })),
      `ventes-packs_${periodLabel}`
    )
  }

  const exportBookings = () => {
    const periodLabel = format(dateFrom, 'yyyy-MM-dd') + '_' + format(dateTo, 'yyyy-MM-dd')
    exportCsv(
      bookings.map(b => ({
        'Date': b.starts_at ? format(new Date(b.starts_at), 'dd/MM/yyyy') : '',
        'Heure': b.starts_at ? format(new Date(b.starts_at), 'HH:mm') : '',
        'Type de cours': b.class_name,
        'Titre événement': b.class_title,
        'Coach': b.coach_name,
        'Client': b.user_name,
        'Pack utilisé': b.pack_name,
        'Valeur crédit (€)': formatEuros(b.credit_value_cents),
      })),
      `cours-reservations_${periodLabel}`
    )
  }

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

      {/* Export buttons */}
      {!loading && (packSales.length > 0 || bookings.length > 0) && (
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="text-xs" onClick={exportPackSales} disabled={packSales.length === 0}>
            <Download className="h-3.5 w-3.5 mr-1.5" />
            {isFr ? 'Export ventes packs (.csv)' : 'Export pack sales (.csv)'}
          </Button>
          <Button variant="outline" size="sm" className="text-xs" onClick={exportBookings} disabled={bookings.length === 0}>
            <Download className="h-3.5 w-3.5 mr-1.5" />
            {isFr ? 'Export cours-réservations (.csv)' : 'Export class bookings (.csv)'}
          </Button>
        </div>
      )}

      {loading ? <LoadingState /> : (
        <>
          {/* KPI Cards */}
          <div className="grid gap-4 md:grid-cols-3">
            {/* Total recettes */}
            <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setDetailDialog('packs')}>
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-3">
                  <div className="h-10 w-10 rounded-xl bg-green-100 dark:bg-green-950 flex items-center justify-center">
                    <Euro className="h-5 w-5 text-green-600" />
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </div>
                <p className="text-3xl font-bold">{formatEuros(totalRevenue, 0)}</p>
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
                {/* La valeur a désormais sa propre carte : on garde ici le
                    remplissage, qui ne se lit nulle part ailleurs. */}
                <p className="text-xs text-muted-foreground">
                  {inscritsParCours !== null
                    ? `${inscritsParCours.toFixed(1)} ${isFr ? 'par cours donné' : 'per class given'}`
                    : (isFr ? 'aucun cours donné' : 'no class given')}
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
                <p className="text-3xl font-bold">
                  {coachStats.reduce((s, c) => s + c.class_count, 0)}
                  <span className="text-lg text-muted-foreground font-normal">
                    {' '}/ {coachStats.reduce((s, c) => s + c.scheduled_count, 0)}
                  </span>
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  {isFr ? 'Cours donnés / planifiés' : 'Classes given / scheduled'}
                </p>
                <p className="text-xs text-muted-foreground">
                  {coachStats.length} {isFr ? 'coach(s)' : 'coach(es)'}
                </p>
              </CardContent>
            </Card>

            {/* Valeur consommée — ce que valent les séances réellement suivies.
                Distincte des recettes encaissées : un pack vendu en janvier se
                consomme jusqu'en mars, et c'est la consommation qui dit ce que
                le studio a produit sur la période. */}
            <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setDetailDialog('credits')}>
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-3">
                  <div className="h-10 w-10 rounded-xl bg-amber-100 dark:bg-amber-950 flex items-center justify-center">
                    <Euro className="h-5 w-5 text-amber-600" />
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </div>
                <p className="text-3xl font-bold">{formatEuros(totalClassRevenue, 0)}</p>
                <p className="text-sm text-muted-foreground mt-1">
                  {isFr ? 'Valeur consommée' : 'Value consumed'}
                </p>
                <p className="text-xs text-muted-foreground">
                  {revenuMoyenParSeance !== null
                    ? `${formatEuros(revenuMoyenParSeance, 0)} ${isFr ? 'par séance donnée' : 'per class given'}`
                    : (isFr ? 'aucune séance donnée' : 'no class given')}
                </p>
              </CardContent>
            </Card>

          </div>

          {/* ---- Statistiques membres, sur leur propre ligne ----
              Elles ne se lisent pas avec les chiffres d'activité : celles-ci
              content des personnes qui franchissent une étape, celles-là de
              l'argent et des cours. Les mêler dans une grille unique laissait
              croire à une continuité qui n'existe pas. */}
          <div className="grid gap-4 md:grid-cols-3">
            {/* ---- Le parcours, en trois nombres bruts ----
                Inscription → essai réservé → pack acheté, aux noms des statuts
                de membre. Trois chiffres et aucun quotient : un taux
                « achats / essais » dépassait 100 % en pratique, puisqu'on peut
                acheter sans être passé par l'essai, ou essayer un mois et
                acheter le suivant. Les trois nombres côte à côte se lisent sans
                piège ; le rapport se fait à l'œil quand il a du sens. */}
            <Card>
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-3">
                  <div className="h-10 w-10 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                    <Users className="h-5 w-5 text-slate-600" />
                  </div>
                </div>
                <p className="text-3xl font-bold">{parcours.inscriptions}</p>
                <p className="text-sm text-muted-foreground mt-1">
                  {isFr ? 'Premier contact' : 'First contact'}
                </p>
                <p className="text-xs text-muted-foreground">
                  {isFr ? 'comptes créés' : 'accounts created'}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-3">
                  <div className="h-10 w-10 rounded-xl bg-teal-100 dark:bg-teal-950 flex items-center justify-center">
                    <Users className="h-5 w-5 text-teal-600" />
                  </div>
                </div>
                <p className="text-3xl font-bold">{parcours.essais}</p>
                <p className="text-sm text-muted-foreground mt-1">
                  {isFr ? 'Membres potentiels' : 'Potential members'}
                </p>
                <p className="text-xs text-muted-foreground">
                  {isFr ? 'ont réservé leur essai' : 'booked their trial'}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-3">
                  <div className="h-10 w-10 rounded-xl bg-rose-100 dark:bg-rose-950 flex items-center justify-center">
                    <Users className="h-5 w-5 text-rose-600" />
                  </div>
                </div>
                <p className="text-3xl font-bold">{parcours.achats}</p>
                <p className="text-sm text-muted-foreground mt-1">
                  {isFr ? 'Nouveaux membres' : 'New members'}
                </p>
                <p className="text-xs text-muted-foreground">
                  {isFr ? 'ont acheté un pack' : 'bought a pack'}
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
                <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{isFr ? 'Coach' : 'Coach'}</TableHead>
                      {/* donnés (planifiés) — cours passés de la période uniquement */}
                      <TableHead className="hidden sm:table-cell text-center">
                        {isFr ? 'Donnés (planifiés)' : 'Given (scheduled)'}
                      </TableHead>
                      {/* Participants aux cours du coach, pas des réservations lui appartenant */}
                      <TableHead className="text-center">{isFr ? 'Nb part.' : 'Attendees'}</TableHead>
                      <TableHead className="text-right">{isFr ? 'Valeur' : 'Value'}</TableHead>
                      <TableHead className="w-10"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {coachStats.map(coach => (
                      <TableRow key={coach.coach_id} className="cursor-pointer hover:bg-muted/50" onClick={() => openCoachDetail(coach)}>
                        <TableCell className="font-medium">{coach.coach_name}</TableCell>
                        {/* donnés (planifiés) */}
                        <TableCell className="hidden sm:table-cell text-center">
                          {coach.class_count}
                          <span className="text-muted-foreground text-xs">
                            {' '}({coach.scheduled_count})
                          </span>
                        </TableCell>
                        <TableCell className="text-center">{coach.total_bookings}</TableCell>
                        <TableCell className="text-right font-medium">{formatEuros(coach.total_revenue_cents, 0)}</TableCell>
                        <TableCell><ChevronRight className="h-4 w-4 text-muted-foreground" /></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                </div>
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
            <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="hidden sm:table-cell">{isFr ? 'Date' : 'Date'}</TableHead>
                  <TableHead>{isFr ? 'Client' : 'Client'}</TableHead>
                  <TableHead>{isFr ? 'Pack' : 'Pack'}</TableHead>
                  <TableHead className="hidden md:table-cell text-center">{isFr ? 'Crédits' : 'Credits'}</TableHead>
                  <TableHead className="text-right">{isFr ? 'Montant' : 'Amount'}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {packSales.map(sale => (
                  <TableRow key={sale.id}>
                    <TableCell className="hidden sm:table-cell text-sm">{format(new Date(sale.purchased_at), 'dd/MM/yyyy', { locale })}</TableCell>
                    <TableCell>{sale.user_name}</TableCell>
                    <TableCell>{sale.pack_name}</TableCell>
                    <TableCell className="hidden md:table-cell text-center">{sale.credits}</TableCell>
                    <TableCell className="text-right font-medium">
                      {sale.price_paid_cents === 0
                        ? <Badge variant="secondary" className="text-[10px]">{isFr ? 'Offert' : 'Gift'}</Badge>
                        : formatEuros(sale.price_paid_cents, 0)
                      }
                    </TableCell>
                  </TableRow>
                ))}
                <TableRow className="font-bold border-t-2">
                  <TableCell className="hidden sm:table-cell"></TableCell>
                  <TableCell colSpan={2}>{isFr ? 'Total' : 'Total'}</TableCell>
                  <TableCell className="hidden md:table-cell text-center">{packSales.reduce((s, p) => s + p.credits, 0)}</TableCell>
                  <TableCell className="text-right">{formatEuros(totalRevenue, 0)}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
            </div>
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
            <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="hidden sm:table-cell">{isFr ? 'Date' : 'Date'}</TableHead>
                  <TableHead>{isFr ? 'Cours' : 'Class'}</TableHead>
                  <TableHead>{isFr ? 'Client' : 'Client'}</TableHead>
                  <TableHead className="hidden md:table-cell">{isFr ? 'Pack' : 'Pack'}</TableHead>
                  <TableHead className="text-right">{isFr ? 'Valeur' : 'Value'}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {bookings.map(b => (
                  <TableRow key={b.id}>
                    <TableCell className="hidden sm:table-cell text-sm">{b.starts_at ? format(new Date(b.starts_at), 'dd/MM HH:mm', { locale }) : '-'}</TableCell>
                    <TableCell>{b.class_name}</TableCell>
                    <TableCell>{b.user_name}</TableCell>
                    <TableCell className="hidden md:table-cell text-xs text-muted-foreground">{b.pack_name}</TableCell>
                    <TableCell className="text-right font-medium">{formatEuros(b.credit_value_cents, 0)}</TableCell>
                  </TableRow>
                ))}
                <TableRow className="font-bold border-t-2">
                  <TableCell className="hidden sm:table-cell"></TableCell>
                  <TableCell colSpan={2}>{isFr ? 'Total' : 'Total'} ({bookings.length} {isFr ? 'crédits' : 'credits'})</TableCell>
                  <TableCell className="hidden md:table-cell"></TableCell>
                  <TableCell className="text-right">{formatEuros(totalClassRevenue, 0)}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
            </div>
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
                <Badge variant="outline">
                  {selectedCoach.class_count} / {selectedCoach.scheduled_count}{' '}
                  {isFr ? 'cours donnés' : 'classes given'}
                </Badge>
                <Badge variant="outline">{selectedCoach.total_bookings} {isFr ? 'participants' : 'attendees'}</Badge>
                <Badge variant="outline">{formatEuros(selectedCoach.total_revenue_cents, 0)}</Badge>
              </div>
              <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{isFr ? 'Date' : 'Date'}</TableHead>
                    <TableHead>{isFr ? 'Cours' : 'Class'}</TableHead>
                    <TableHead className="text-center">{isFr ? 'Nb part.' : 'Attendees'}</TableHead>
                    <TableHead className="text-right">{isFr ? 'Valeur' : 'Value'}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {selectedCoach.classes.map(c => (
                    <TableRow key={c.id} className={c.was_given ? undefined : 'opacity-50'}>
                      <TableCell className="text-sm whitespace-nowrap">{format(new Date(c.starts_at), 'EEE dd/MM HH:mm', { locale })}</TableCell>
                      <TableCell>
                        {c.class_name}
                        {!c.was_given && (
                          <span className="text-xs text-muted-foreground ml-1.5">
                            ({isFr ? 'non donné' : 'not given'})
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-center">{c.bookings}</TableCell>
                      <TableCell className="text-right font-medium">{formatEuros(c.revenue_cents, 0)}</TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="font-bold border-t-2">
                    <TableCell colSpan={2}>{isFr ? 'Total' : 'Total'}</TableCell>
                    <TableCell className="text-center">{selectedCoach.total_bookings}</TableCell>
                    <TableCell className="text-right">{formatEuros(selectedCoach.total_revenue_cents, 0)}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

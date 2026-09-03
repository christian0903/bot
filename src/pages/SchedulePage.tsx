import { useEffect, useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '@/contexts/AuthContext'
import { useMode } from '@/contexts/ModeContext'
import { supabase } from '@/lib/supabase'
import { logActivity } from '@/lib/activity-log'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { EmptyState } from '@/components/common/EmptyState'
import { LoadingState } from '@/components/common/LoadingState'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import { NoCreditsDialog, type NoCreditsReason } from '@/components/common/NoCreditsDialog'
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { CalendarDays, ChevronLeft, ChevronRight, List, LayoutGrid, Calendar, Users, Check, Clock3, X, Clock, Lock, Ban, UserMinus, UserPlus, Info, SlidersHorizontal } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import { MarkdownLink } from '@/components/common/MarkdownLink'
import { toast } from 'sonner'
import { sendEmail } from '@/lib/send-email'
import { notifyMember } from '@/lib/notify-member'
import { addDays, startOfWeek, format, isSameDay, isToday } from 'date-fns'
import { fr, enUS } from 'date-fns/locale'
import { motion, AnimatePresence } from 'framer-motion'
import { cn, getClassStatus, classStatusLabel } from '@/lib/utils'
import type { ScheduledClass, Booking } from '@/types'
import { urlImage } from '@/lib/url-image'
import { one } from '@/lib/supabase-joins'

/** Une façon de payer une séance : abonnement ou pack, telle que renvoyée par get_available_credits. */
type CreditSource = {
  pack_purchase_id: string
  credits_remaining: number
  expires_at: string
  is_unlimited: boolean
  pack_name: string
  subscription_id: string | null
  is_subscription: boolean
}

/** Un inscrit tel que le voient les autres membres : un prenom, une photo, rien d'autre. */
type Participant = {
  user_id: string
  prenom: string
  avatar_url: string | null
}

type ViewMode = 'day' | 'week' | 'list'

interface BookingRules {
  morning_cutoff_hour: number
  morning_class_before_hour: number
  afternoon_hours_before_no_bookings: number
  afternoon_minutes_before_with_bookings: number
  cancellation_free_hours: number
}

const DEFAULT_RULES: BookingRules = {
  morning_cutoff_hour: 20,
  morning_class_before_hour: 12,
  afternoon_hours_before_no_bookings: 3,
  afternoon_minutes_before_with_bookings: 30,
  cancellation_free_hours: 12,
}

// Check if booking is closed for a class (client-side check, server validates too)
function isBookingClosed(sc: ScheduledClass, bookingsCount: number, rules: BookingRules): boolean {
  const now = new Date()
  const startsAt = new Date(sc.starts_at)
  if (startsAt <= now) return true

  // Get hour in Brussels timezone
  const brusselsHour = parseInt(startsAt.toLocaleString('en-US', { hour: 'numeric', hour12: false, timeZone: 'Europe/Brussels' }))

  if (brusselsHour < rules.morning_class_before_hour) {
    // Morning class: closed the day before at cutoff hour
    const cutoff = new Date(startsAt)
    cutoff.setDate(cutoff.getDate() - 1)
    cutoff.setHours(rules.morning_cutoff_hour, 0, 0, 0)
    return now > cutoff
  } else {
    // Afternoon/evening class
    if (bookingsCount === 0) {
      const cutoff = new Date(startsAt.getTime() - rules.afternoon_hours_before_no_bookings * 3600000)
      return now > cutoff
    } else {
      const cutoff = new Date(startsAt.getTime() - rules.afternoon_minutes_before_with_bookings * 60000)
      return now > cutoff
    }
  }
}

export function SchedulePage() {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const { user, profile, roles, hasRegistrationFee, hasUsedTrial, refreshProfile } = useAuth()
  const locale = i18n.language === 'fr' ? fr : enUS
  const isFr = i18n.language === 'fr'
  const [classes, setClasses] = useState<ScheduledClass[]>([])
  /**
   * Les types de credits du CATALOGUE, et non ceux de la periode affichee.
   *
   * Les onglets se deduisaient des cours charges — quatorze jours. Une semaine
   * sans personal training les faisait donc disparaitre, et le membre perdait
   * le moyen de revenir a ce qu'il regardait. Le catalogue, lui, ne varie pas
   * d'une semaine a l'autre.
   */
  const [typesAuCatalogue, setTypesAuCatalogue] = useState<{ id: string; label: string; name: string }[]>([])
  const [userBookings, setUserBookings] = useState<Set<string>>(new Set())
  const [userWaitlist, setUserWaitlist] = useState<Map<string, { id: string; position: number; status: string }>>(new Map())
  const [bookingCounts, setBookingCounts] = useState<Map<string, number>>(new Map())
  /** Présences pointées : distingue un cours établi d'un cours supposé. */
  const [attendedCounts, setAttendedCounts] = useState<Map<string, number>>(new Map())
  /** Absents pointés : un cours tout en absences reste un cours donné. */
  const [noShowCounts, setNoShowCounts] = useState<Map<string, number>>(new Map())
  const [loading, setLoading] = useState(true)
  const [bookingInProgress, setBookingInProgress] = useState<string | null>(null)
  /** Réservation en attente de confirmation dans la pop-up. */
  const [bookingConfirm, setBookingConfirm] = useState<{ sc: ScheduledClass; sources: CreditSource[] } | null>(null)
  const [selectedSourceId, setSelectedSourceId] = useState<string>('')
  const [viewMode, setViewMode] = useState<ViewMode>('day')
  const [currentDate, setCurrentDate] = useState(new Date())
  // Le jour affiché en vue « jour », stocké comme DATE et non comme index.
  //
  // C'était un index, partagé entre deux tableaux de 7 jours d'origines
  // différentes : `weekDays` part du lundi, `dayViewDays` part de currentDate.
  // Cliquer vendredi en vue semaine ouvrait donc un autre jour — l'écart valant
  // le rang du jour courant dans la semaine (un mercredi : +2 jours). Une date
  // ne peut pas se désynchroniser d'elle-même.
  const [selectedDay, setSelectedDay] = useState<Date>(() => new Date())
  const [bookingRules, setBookingRules] = useState<BookingRules>(DEFAULT_RULES)
  const [roomNames, setRoomNames] = useState<Record<string, string>>({ haut: 'Back On Track Upstairs', bas: 'Back On Track Studio' })
  const [swipeDirection, setSwipeDirection] = useState(0)
  const [filterOpen, setFilterOpen] = useState(false)
  /** Le membre a-t-il au moins un pack valide (illimité compris) ? */
  const [hasUsablePack, setHasUsablePack] = useState(false)
  // Le crédit d'essai encore disponible, s'il existe. Sert à proposer l'essai
  // et à afficher jusqu'à quand il reste valable.
  const [trialCredit, setTrialCredit] = useState<{ id: string; expires_at: string } | null>(null)
  /** Crédits restants par type de crédit, pour le rappel en tête de planning. */
  const [creditsByType, setCreditsByType] = useState<Map<string, { count: number; unlimited: boolean }>>(new Map())
  // Réservation refusée faute de crédit : on propose l'achat sur place.
  const [noCredits, setNoCredits] = useState<{
    reason: NoCreditsReason
    creditTypeId: string | null
    creditTypeLabel: string | null
  } | null>(null)
  /** Minimum d'inscrits pour qu'un cours compte comme donné (Réglages). */
  const [minParticipants, setMinParticipants] = useState(1)
  /** Cours que le staff a choisi de maintenir : retirés du bandeau de revue. */
  const [reviewDismissed, setReviewDismissed] = useState<string[]>([])

  // Filters
  /** Onglet de type de crédit. 'all' = tout le planning, la vue d'ensemble. */
  const [filterCreditType, setFilterCreditType] = useState<string>('all')
  const [filterClassType, setFilterClassType] = useState<string>('all')
  const [filterCoach, setFilterCoach] = useState<string>('all')

  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 })
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))
  // Day view: 7 days starting from currentDate (today by default), Technogym-style
  const dayViewDays = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(currentDate, i)),
    [currentDate]
  )

  // Défini ici plutôt que plus bas : la navigation du planning en dépend, et
  // une constante utilisée avant sa déclaration casse à l'exécution.
  //
  // Le planning suit le MODE CHOISI, pas seulement le rôle. Auparavant, un
  // admin qui basculait en « Membre » voyait le bouton passer au vert mais
  // gardait la vue staff : mêmes alertes, mêmes codes de salle, un clic qui
  // ouvrait la gestion au lieu de la réservation. Les deux boutons menaient au
  // même écran, ce qui rendait la bascule incompréhensible.
  //
  // Il ne s'agit pas d'un contrôle d'accès : le mode ne donne aucun droit, et
  // les routes comme les policies RLS restent inchangées. Un admin en mode
  // Membre garde tous ses droits — il regarde simplement son studio avec les
  // yeux d'un client.
  //
  // C'est ce qui manquait le 31 août, quand un coach a signalé « 5 places
  // disponibles » sur un cours complet : le défaut ne touchait que les
  // membres, et aucun écran interne ne pouvait le montrer.
  const { mode } = useMode()
  const aLeRoleStaff = !!user && (roles.includes('admin') || roles.includes('super_admin') || roles.includes('coach'))
  const isStaff = aLeRoleStaff && mode !== 'membre'

  // Le bouton « Aujourd'hui » ne s'affiche que si on n'y est pas : proposer de
  // revenir là où l'on se trouve déjà n'apprend rien.
  const showingToday = isSameDay(currentDate, new Date())

  /**
   * Crédits à rappeler en tête de planning.
   *
   * Le libellé du type vient des cours affichés — c'est la seule source qui le
   * porte. Un type dont aucun cours n'est programmé sur la période n'apparaît
   * donc pas : le membre n'a de toute façon rien à y réserver.
   *
   * Réservé au client : le staff réserve pour les autres, ses propres crédits
   * n'ont rien à faire là.
   */
  const creditSummary = useMemo(() => {
    if (isStaff) return []
    const labels = new Map<string, string>()
    for (const sc of classes) {
      const ct = sc.class_type?.credit_type
      const id = sc.class_type?.credit_type_id
      if (!id || labels.has(id)) continue
      const label = (isFr ? ct?.label_fr : ct?.label_en) ?? ct?.name
      if (label) labels.set(id, label)
    }
    // On part des types PRÉSENTS AU PLANNING, pas des packs détenus : sans pack
    // Personal Training, `creditsByType` n'a aucune entrée pour ce type, et le
    // membre ne voyait alors rien — ni solde, ni zéro. Or « 0 crédit » est
    // précisément ce qu'il doit lire avant de tenter une réservation.
    return [...labels.entries()]
      .map(([id, label]) => {
        const v = creditsByType.get(id)
        return { id, label, count: v?.count ?? 0, unlimited: v?.unlimited ?? false }
      })
      .sort((a, b) => a.label.localeCompare(b.label))
  }, [creditsByType, classes, isFr, isStaff])

  // Le client ne recule pas avant la semaine en cours. Le staff, si : il a
  // besoin de l'historique pour les présences et la facturation.
  const canGoBack = isStaff || startOfWeek(addDays(currentDate, -7), { weekStartsOn: 1 })
    >= startOfWeek(new Date(), { weekStartsOn: 1 })

  /**
   * Types de crédit présents au planning : semi-privé, personal training…
   *
   * Le type de crédit commande la réservation — un crédit Personal Training ne
   * paie pas un cours semi-privé. Mélangés dans une même grille, les deux
   * obligeaient le membre à lire chaque carte pour savoir laquelle le concerne.
   * `PacksPage` a réglé le même problème par des onglets ; le planning suit,
   * pour que la lecture soit la même des deux côtés.
   *
   * Déduits des cours affichés, comme les autres filtres : un type sans cours
   * programmé n'a rien à proposer, son onglet serait un cul-de-sac.
   */
  const creditTypeTabs = useMemo(() => {
    // Le semi-privé d'abord : c'est la prestation courante du studio, donc
    // l'onglet ouvert par défaut. Un tri alphabétique aurait mis « Personal
    // Training » en tête, ce qui n'a rien à voir avec l'usage.
    const rang = (nom: string) =>
      nom === 'semi_prive' ? 0 : nom === 'personal_training' ? 1 : 2
    return [...typesAuCatalogue]
      .sort((a, b) => rang(a.name) - rang(b.name) || a.label.localeCompare(b.label))
      .map(({ id, label }) => ({ id, label }))
  }, [typesAuCatalogue])

  /**
   * Onglet réellement affiché : le choix du membre, ou le premier de la liste.
   *
   * Calculé au rendu plutôt que posé dans un effet — écrire un état depuis un
   * effet provoque un second rendu pour un résultat qu'on sait déduire. Le
   * repli couvre aussi le cas où l'onglet choisi disparaît : changer de semaine
   * peut retirer du planning le seul type qu'on regardait.
   */
  const ongletActif = creditTypeTabs.some(t => t.id === filterCreditType)
    ? filterCreditType
    : creditTypeTabs[0]?.id ?? 'all'

  // Extract unique class types and coaches for filters
  const classTypes = useMemo(() => {
    const types = new Map<string, { id: string; name: string; color: string }>()
    for (const sc of classes) {
      // Restreint à l'onglet actif : proposer un cours semi-privé alors qu'on
      // regarde le Personal Training donnerait un planning vide sans que rien
      // ne l'explique — deux filtres qui se contredisent en silence.
      if (ongletActif !== 'all' && sc.class_type?.credit_type_id !== ongletActif) continue
      if (sc.class_type) types.set(sc.class_type.id, { id: sc.class_type.id, name: sc.class_type.name, color: sc.class_type.color })
    }
    return [...types.values()]
  }, [classes, ongletActif])

  const coaches = useMemo(() => {
    const coachMap = new Map<string, string>()
    for (const sc of classes) {
      if (sc.coach) coachMap.set(sc.coach.id, sc.coach.display_name)
    }
    return [...coachMap.entries()].map(([id, name]) => ({ id, name }))
  }, [classes])

  // Filtered classes
  const filteredClasses = useMemo(() => {
    return classes.filter(sc => {
      if (ongletActif !== 'all' && sc.class_type?.credit_type_id !== ongletActif) return false
      if (filterClassType !== 'all' && sc.class_type_id !== filterClassType) return false
      if (filterCoach !== 'all' && sc.coach_id !== filterCoach) return false
      return true
    })
  }, [classes, ongletActif, filterClassType, filterCoach])

  const fetchData = async () => {
    setLoading(true)
    const from = weekStart.toISOString()
    // Fetch 14 days to cover day view which can span past weekStart+7
    const to = addDays(weekStart, 14).toISOString()

    const [classesRes, bookingsRes, waitlistRes, rulesRes, roomNamesRes, givenRuleRes] = await Promise.all([
      // Les cours annulés sont chargés, puis filtrés selon le rôle plus bas :
      // visibles pour le staff (information de gestion), masqués pour les
      // clients — un planning parsemé d'« Annulé » donne une mauvaise image.
      supabase
        .from('scheduled_classes')
        .select('*, class_type:class_types(*, credit_type:credit_types(name, label_fr, label_en))')
        .gte('starts_at', from)
        .lt('starts_at', to)
        .order('starts_at'),
      user
        ? supabase.from('bookings').select('scheduled_class_id').eq('user_id', user.id).eq('status', 'confirmed')
        : Promise.resolve({ data: [] }),
      user
        ? supabase.from('waitlist').select('id, scheduled_class_id, position, status').eq('user_id', user.id).in('status', ['waiting', 'offered'])
        : Promise.resolve({ data: [] }),
      supabase.from('app_settings').select('value').eq('key', 'booking_rules').single(),
      supabase.from('app_settings').select('value').eq('key', 'room_names').single(),
      supabase.from('app_settings').select('value').eq('key', 'class_given_rule').maybeSingle(),
    ])

    // Le membre possède-t-il un pack utilisable ? Un illimité compte même si
    // credits_remaining vaut 0 : son compteur n'est jamais décrémenté.
    if (user) {
      const { data: packRows } = await supabase
        .from('pack_purchases')
        .select('id, credits_remaining, expires_at, subscription_id, pack_type:pack_types(name, is_unlimited, credit_type_id, is_trial)')
        .eq('user_id', user.id)
        .gt('expires_at', new Date().toISOString())

      const rows = (packRows ?? []) as unknown as {
        id: string
        credits_remaining: number
        expires_at: string
        subscription_id: string | null
        pack_type: { name: string; is_unlimited: boolean; credit_type_id: string; is_trial: boolean } | null
      }[]

      // Le pack d'essai est exclu : il est offert à tout nouveau profil, et le
      // compter ici ferait disparaître le bouton « Essai gratuit » chez ceux à
      // qui il est justement destiné. Posséder son essai n'est pas être client.
      setHasUsablePack(
        rows.some(p => !p.pack_type?.is_trial
          && (p.pack_type?.is_unlimited || p.credits_remaining > 0)),
      )

      setTrialCredit(
        rows.find(p => p.pack_type?.is_trial && p.credits_remaining > 0) ?? null,
      )

      // Crédits restants par type, calculés depuis les packs déjà chargés :
      // aucune requête de plus. Affichés en tête du planning pour répondre à
      // « combien de réservations puis-je encore faire ? » sans quitter la
      // page — jusqu'ici il fallait aller dans « Mes packs ».
      const byType = new Map<string, { count: number; unlimited: boolean }>()
      for (const p of rows) {
        const t = p.pack_type?.credit_type_id
        if (!t) continue
        const cur = byType.get(t) ?? { count: 0, unlimited: false }
        if (p.pack_type?.is_unlimited) cur.unlimited = true
        else cur.count += Math.max(0, p.credits_remaining)
        byType.set(t, cur)
      }
      setCreditsByType(byType)
    } else {
      setHasUsablePack(false)
      setCreditsByType(new Map())
    }

    const givenRule = givenRuleRes.data?.value as { min_participants?: number } | undefined
    if (givenRule?.min_participants) setMinParticipants(givenRule.min_participants)

    if (rulesRes.data?.value) {
      setBookingRules({ ...DEFAULT_RULES, ...(rulesRes.data.value as Partial<BookingRules>) })
    }
    if (roomNamesRes.data?.value) {
      setRoomNames(prev => ({ ...prev, ...(roomNamesRes.data.value as Record<string, string>) }))
    }

    // Le staff voit les cours annulés (information de gestion) ; les clients
    // non, pour ne pas afficher un planning parsemé d'annulations.
    //
    // `isStaff` et non le rôle seul : en mode Membre, un admin doit voir le
    // planning débarrassé des annulations, comme son client. Sans cela, la
    // bascule laissait passer la moitié de la vue staff.
    const rawClasses = ((classesRes.data as ScheduledClass[]) ?? [])
      .filter(c => isStaff || !c.is_cancelled)

    // Fetch coach profiles
    const coachIds = [...new Set(rawClasses.map(c => c.coach_id).filter(Boolean))]
    if (coachIds.length > 0) {
      // `profils_publics` et non `profiles` : un membre ne lit plus que son propre
      // profil depuis le 2026-08-29. La vue ne porte que le nom et la photo.
      const { data: coachData } = await supabase.from('profils_publics').select('id, display_name, avatar_url').in('id', coachIds)
      const coachMap = new Map((coachData ?? []).map(c => [c.id, c]))
      for (const sc of rawClasses) {
        if (sc.coach_id) sc.coach = coachMap.get(sc.coach_id) as ScheduledClass['coach']
      }
    }

    // Booking counts
    const classIds = rawClasses.map(c => c.id)
    if (classIds.length > 0) {
      // LES PLACES PRISES VIENNENT DU SERVEUR, et non d'un comptage ici.
      //
      // Elles se comptaient sur `bookings`, lu directement. Or la policy de
      // lecture est `auth.uid() = user_id` : un membre ne voit QUE SES PROPRES
      // reservations. Sur un cours ou il n'etait pas inscrit, la requete
      // revenait vide — zero place prise, donc « 5 places disponibles » a
      // l'ecran — et la reservation repondait « Ce cours est complet ».
      //
      // Le defaut etait invisible pour un admin ou un coach, qui lisent tout :
      // il ne touchait que les membres. Signale par un coach le 31 aout.
      //
      // `places_prises_par_cours` applique le MEME critere que `book_class` :
      // `status = 'confirmed'`. Une annulation tardive libere donc la place —
      // le credit reste consomme, mais la place est physiquement libre, et
      // c'est ce que la reservation appliquera.
      const { data: placesData, error: placesError } = await supabase
        .rpc('places_prises_par_cours', { p_class_ids: classIds })

      const counts = new Map<string, number>()
      if (placesError) {
        // Tester `error` : un refus revient dans l'objet de reponse sans lever
        // d'exception, et l'ecran afficherait tous les cours vides.
        console.error('places_prises_par_cours:', placesError.message)
      } else {
        for (const row of (placesData ?? []) as { scheduled_class_id: string; places_prises: number }[]) {
          counts.set(row.scheduled_class_id, row.places_prises)
        }
      }

      // Les presences et les absences restent lues ici : elles ne servent qu'a
      // l'espace coach, qui a le droit de tout voir.
      const { data: countData } = await supabase
        .from('bookings')
        .select('scheduled_class_id, status, is_no_show, checked_in_at')
        .in('scheduled_class_id', classIds)
      const attended = new Map<string, number>()
      const noShows = new Map<string, number>()
      for (const row of (countData ?? []) as {
        scheduled_class_id: string; status: string; is_no_show: boolean; checked_in_at: string | null
      }[]) {
        if (row.checked_in_at) {
          attended.set(row.scheduled_class_id, (attended.get(row.scheduled_class_id) ?? 0) + 1)
        }
        if (row.is_no_show) {
          noShows.set(row.scheduled_class_id, (noShows.get(row.scheduled_class_id) ?? 0) + 1)
        }
      }
      setBookingCounts(counts)
      setAttendedCounts(attended)
      setNoShowCounts(noShows)
    }

    // Waitlist
    const wlMap = new Map<string, { id: string; position: number; status: string }>()
    for (const w of waitlistRes.data ?? []) wlMap.set(w.scheduled_class_id, { id: w.id, position: w.position, status: w.status })
    setUserWaitlist(wlMap)

    setClasses(rawClasses)
    setUserBookings(new Set((bookingsRes.data ?? []).map((b) => b.scheduled_class_id)))
    setLoading(false)
  }

  // Retour de Stripe après un achat lancé depuis le dialogue « pas de crédits ».
  // La redirection ayant remplacé l'ouverture d'un onglet, le membre n'a plus la
  // page Stripe sous les yeux : sans accusé, il ignore si son paiement a abouti.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('success') === 'true') {
      toast.success(isFr
        ? 'Paiement confirmé. Tu peux réserver ton cours.'
        : 'Payment confirmed. You can book your class.')
      window.history.replaceState({}, '', '/schedule')
    }
  }, [isFr])

  useEffect(() => { fetchData() }, [currentDate, user])

  // Une seule fois : le catalogue ne change pas quand on tourne les semaines.
  useEffect(() => {
    supabase
      .from('class_types')
      .select('credit_type_id, credit_type:credit_types(name, label_fr, label_en)')
      .then(({ data }) => {
        const vus = new Map<string, { id: string; label: string; name: string }>()
        for (const ct of data ?? []) {
          const id = ct.credit_type_id
          const c = one(ct.credit_type) as { name?: string; label_fr?: string; label_en?: string } | null
          if (!id || vus.has(id) || !c) continue
          const label = (isFr ? c.label_fr : c.label_en) ?? c.name
          if (label) vus.set(id, { id, label, name: c.name ?? '' })
        }
        setTypesAuCatalogue([...vus.values()])
      })
  }, [isFr])

  // Build email vars from a scheduled class
  const classEmailVars = (sc: ScheduledClass, userName?: string) => ({
    user_name: userName,
    class_name: sc.title || sc.class_type?.name,
    class_date: format(new Date(sc.starts_at), "EEEE dd MMMM 'à' HH:mm", { locale: fr }),
    coach_name: sc.coach?.display_name,
    room_name: sc.floor ? (roomNames[sc.floor] || sc.floor) : undefined,
    duration_minutes: sc.duration_minutes,
  })

  // ---- Booking handlers ----
  const handleBook = async (classId: string) => {
    if (!user) return
    setBookingInProgress(classId)
    const scheduledClass = classes.find((c) => c.id === classId)
    if (!scheduledClass?.class_type) { setBookingInProgress(null); return }

    // Server-side check
    const { data: checkResult } = await supabase.rpc('can_book_class', { p_class_id: classId, p_user_id: user.id })
    if (checkResult && !checkResult.can_book) {
      const reason = checkResult.reason as string
      const messages: Record<string, string> = {
        class_past: isFr ? 'Ce cours est déjà passé' : 'This class has already passed',
        class_cancelled: isFr ? 'Ce cours est annulé' : 'This class is cancelled',
        already_booked: isFr ? 'Vous êtes déjà inscrit' : 'You are already booked',
        class_full: isFr ? 'Ce cours est complet' : 'This class is full',
        booking_closed: isFr ? 'Les réservations sont fermées pour ce cours' : 'Bookings are closed for this class',
      }
      // La fenetre d'ouverture merite sa date : « trop tot » sans dire quand
      // revenir laisse chercher. `opens_at` vient de can_book_class.
      if (reason === 'outside_booking_window') {
        const ouvre = checkResult.opens_at
          ? format(new Date(checkResult.opens_at as string), 'dd/MM à HH:mm', { locale })
          : null
        toast.error(isFr
          ? (ouvre
            ? `Ce cours ouvre à la réservation le ${ouvre}.`
            : 'Ce cours est encore trop loin pour être réservé.')
          : (ouvre
            ? `Bookings for this class open on ${ouvre}.`
            : 'This class is too far ahead to be booked yet.'))
        setBookingInProgress(null)
        return
      }
      toast.error(messages[reason] || t('common.error'))
      setBookingInProgress(null)
      return
    }

    // La date du cours écarte les packs qui ne le couvrent pas — un cycle
    // d'abonnement ne paie pas une séance postérieure à son terme — et ceux
    // dont le quota du cycle est épuisé.
    const { data: credits } = await supabase.rpc('get_available_credits', {
      p_user_id: user.id,
      p_credit_type_id: scheduledClass.class_type.credit_type_id,
      p_class_starts_at: scheduledClass.starts_at,
    })

    if (!credits || credits.length === 0) {
      // Un pack peut exister et être écarté pour trois raisons distinctes :
      // quota du cycle épuisé, abonnement qui se termine avant le cours, ou
      // mauvais type de crédit. Les confondre sous « aucun crédit » enverrait
      // vers la boutique quelqu'un qui a déjà payé.
      const { data: blocked } = await supabase.rpc('why_no_credit_for_class', {
        p_user_id: user.id,
        p_class_id: classId,
      })
      const blockReason = (blocked as {
        reason?: string
        detail?: string
        quota_sessions?: number
        quota_days?: number
        after_renewal?: boolean
      } | null) ?? null

      // Crédits épuisés mais abonnement à jour : le prochain cycle les
      // rechargera. Sans ce cas, le membre voyait « aucun crédit » et croyait
      // devoir racheter un pack, alors qu'il lui suffit d'attendre.
      if (blockReason?.reason === 'credits_exhausted_renewal') {
        toast.error(blockReason.after_renewal
          ? (isFr
            ? `Vos crédits sont épuisés. Votre abonnement se renouvelle le ${blockReason.detail} : vous pourrez réserver cette séance à partir de cette date.`
            : `Your credits are used up. Your subscription renews on ${blockReason.detail}: you will be able to book this class from then.`)
          : (isFr
            ? `Vos crédits sont épuisés pour ce cycle. Votre abonnement se renouvelle le ${blockReason.detail}, mais cette séance a lieu avant : il vous faudrait un autre pack.`
            : `Your credits are used up for this cycle. Your subscription renews on ${blockReason.detail}, but this class is earlier: you would need another pack.`))
        setBookingInProgress(null)
        return
      }

      if (blockReason?.reason === 'quota_reached') {
        // Nommer le plafond : « maximum atteint » sans dire lequel laisse le
        // membre croire que son pack est épuisé.
        toast.error(isFr
          ? `Votre pack ne permet pas plus de ${blockReason.quota_sessions} cours sur ${blockReason.quota_days} jours. Choisissez une date plus éloignée de vos autres séances.`
          : `Your pack allows no more than ${blockReason.quota_sessions} classes over ${blockReason.quota_days} days. Pick a date further from your other sessions.`)
        setBookingInProgress(null)
        return
      }

      if (blockReason?.reason === 'subscription_ending') {
        toast.error(isFr
          ? `Votre abonnement se termine le ${blockReason.detail} et ne couvre pas cette séance.`
          : `Your subscription ends on ${blockReason.detail} and does not cover this class.`)
        setBookingInProgress(null)
        return
      }

      // « Aucun crédit » est trompeur quand le membre en a, mais d'un autre
      // type : un pack Personal Training ne paie pas un cours semi-privé. On
      // regarde ce qu'il possède pour lui dire précisément ce qui bloque.
      const { data: others } = await supabase
        .from('pack_purchases')
        .select('credits_remaining, pack_type:pack_types(name, is_unlimited, credit_type_id)')
        .eq('user_id', user.id)
        .gt('expires_at', new Date().toISOString())

      const rows = (others ?? []) as unknown as {
        credits_remaining: number
        pack_type: { name: string; is_unlimited: boolean; credit_type_id: string } | null
      }[]

      const requiredType = scheduledClass.class_type.credit_type_id
      const sameTypeExhausted = rows.some(
        p => p.pack_type?.credit_type_id === requiredType
          && !p.pack_type.is_unlimited
          && p.credits_remaining <= 0,
      )
      const otherTypeAvailable = rows.filter(
        p => p.pack_type?.credit_type_id !== requiredType
          && (p.pack_type?.is_unlimited || p.credits_remaining > 0),
      )

      const typeLabel = isFr
        ? scheduledClass.class_type.credit_type?.label_fr
        : scheduledClass.class_type.credit_type?.label_en

      // Un toast laissait le membre chercher seul le chemin vers les packs.
      // C'est pourtant l'instant où l'intention d'achat est la plus forte : on
      // lui propose directement les formules qui débloquent CE cours.
      setNoCredits({
        reason: sameTypeExhausted ? 'exhausted' : otherTypeAvailable.length > 0 ? 'wrong_type' : 'none',
        creditTypeId: requiredType,
        creditTypeLabel: typeLabel ?? null,
      })
      setBookingInProgress(null)
      return
    }

    // Le clic ouvre toujours la pop-up : elle confirme la réservation et, quand
    // le membre a plusieurs sources, lui laisse choisir laquelle consommer.
    // Un abonné qui invite quelqu'un doit pouvoir prendre un crédit de pack
    // plutôt que son abonnement.
    const sources = credits as CreditSource[]
    // Refermer le detail : la confirmation s'ouvre par-dessus, et deux
    // dialogues empiles se recouvrent a moitie sur mobile.
    setDetailMembre(null)
    setBookingConfirm({ sc: scheduledClass, sources })
    setSelectedSourceId(sources[0].pack_purchase_id)
    setBookingInProgress(null)
  }

  /** Réservation effective, une fois la source connue. */
  const confirmBooking = async (classId: string, packPurchaseId: string) => {
    if (!user) return
    setBookingInProgress(classId)
    const scheduledClass = classes.find((c) => c.id === classId)
    if (!scheduledClass?.class_type) { setBookingInProgress(null); return }

    // Une seule opération : `book_class` vérifie et écrit dans la même
    // transaction, sous verrou du cours.
    //
    // Elle remplace quatre allers-retours — réactivation d'une annulation,
    // insertion, décompte du crédit — qui laissaient deux trous. Entre le
    // contrôle des places et l'écriture, rien ne tenait : deux membres sur la
    // dernière place passaient tous les deux. Et `consume_credit` renvoyant
    // VOID, un décompte qui ne trouvait plus de crédit ne remontait aucune
    // erreur : la réservation existait, rien n'était débité.
    //
    // Les contrôles faits plus haut dans `handleBook` restent utiles — ils
    // expliquent au membre CE QUI bloque. Ils ne sont simplement plus ce sur
    // quoi repose la justesse.
    const { data: booked, error: bookError } = await supabase.rpc('book_class', {
      p_class_id: classId,
      p_pack_purchase_id: packPurchaseId,
    })

    if (bookError) { toast.error(bookError.message); setBookingInProgress(null); return }

    if (!booked?.ok) {
      // Le cours a pu se remplir, ou le crédit disparaître, pendant que la
      // pop-up était ouverte. Nommer la cause plutôt qu'un « erreur » opaque.
      const causes: Record<string, string> = {
        class_full: isFr
          ? 'Ce cours vient d\'afficher complet.'
          : 'This class has just filled up.',
        already_booked: isFr ? 'Vous êtes déjà inscrit à ce cours.' : 'You are already booked for this class.',
        class_cancelled: isFr ? 'Ce cours a été annulé.' : 'This class has been cancelled.',
        class_past: isFr ? 'Ce cours est déjà passé.' : 'This class has already passed.',
        booking_closed: isFr
          ? 'Les réservations sont fermées pour ce cours.'
          : 'Bookings are closed for this class.',
        no_credit: isFr
          ? 'Aucun crédit disponible pour ce cours.'
          : 'No credit available for this class.',
      }
      toast.error(causes[booked?.reason as string] ?? t('common.error'))
      setBookingInProgress(null)
      // Refermer la pop-up : son bouton ne peut plus aboutir, le laisser
      // cliquable inviterait à réessayer indéfiniment.
      setBookingConfirm(null)
      // Le refus vient d'un état qui a changé depuis l'affichage : on relit,
      // sinon l'écran continuerait d'annoncer une place qui n'existe plus.
      fetchData()
      return
    }

    // LA PLACE EST PRISE : on rend la main AVANT tout le reste.
    //
    // La fermeture de la pop-up venait autrefois en dernier, après le journal
    // et la notification. Deux appels réseau accessoires suffisaient donc à
    // laisser la fenêtre ouverte sur une réservation pourtant réussie — le
    // membre voyait un bouton qui ne répondait plus et pouvait cliquer une
    // seconde fois. Ce qui est acquis s'affiche maintenant tout de suite ;
    // la trace et l'e-mail suivent, et leur échec ne concerne plus l'écran.
    setUserBookings((prev) => new Set([...prev, classId]))
    setBookingCounts(prev => { const n = new Map(prev); n.set(classId, (n.get(classId) ?? 0) + 1); return n })
    setBookingInProgress(null)
    setBookingConfirm(null)

    toast.success(
      isFr
        ? `Séance réservée — ${scheduledClass.class_type?.name}, ${format(new Date(scheduledClass.starts_at), "EEEE d MMMM 'à' HH:mm", { locale })}`
        : `Class booked — ${scheduledClass.class_type?.name}, ${format(new Date(scheduledClass.starts_at), "EEEE d MMMM 'at' HH:mm", { locale })}`,
    )

    // Journal, notification, e-mail : utiles, jamais bloquants. Un `catch` les
    // isole — une panne d'envoi ne doit pas faire croire à un échec de la
    // réservation, qui est déjà enregistrée en base.
    try {
      await logActivity({
        action: 'booking_created', actor_id: user.id, target_user_id: user.id, entity_type: 'booking',
        details: { class_name: scheduledClass.class_type?.name, starts_at: scheduledClass.starts_at },
        description: `Réservation: ${scheduledClass.class_type?.name} le ${format(new Date(scheduledClass.starts_at), 'dd/MM/yyyy HH:mm')}`,
      })

      // `email_on_self_booking` est une préférence d'E-MAIL : elle ne doit pas
      // priver le membre de la trace dans l'application. Il a refusé un canal,
      // pas l'information.
      await notifyMember({
        userId: user.id,
        title: isFr ? 'Réservation confirmée' : 'Booking confirmed',
        message: isFr
          ? `${scheduledClass.class_type?.name} — ${format(new Date(scheduledClass.starts_at), "EEEE d MMMM 'à' HH:mm", { locale })}`
          : `${scheduledClass.class_type?.name} — ${format(new Date(scheduledClass.starts_at), "EEEE d MMMM 'at' HH:mm", { locale })}`,
        type: 'success',
        link: '/my-bookings',
        email: {
          to: user.email,
          template: 'booking_confirmed',
          vars: classEmailVars(scheduledClass, profile?.display_name ?? ''),
          optOut: !profile?.email_on_self_booking,
        },
      })
    } catch (e) {
      console.error('[reservation] trace ou notification en echec:', e)
    }

    // Les compteurs ont bougé : on relit pour que la prochaine réservation
    // propose l'état réel des sources.
    fetchData()
  }

  const handleJoinWaitlist = async (classId: string) => {
    if (!user) return
    const sc = classes.find(c => c.id === classId)
    if (sc && new Date(sc.starts_at) < new Date()) return
    setBookingInProgress(classId)
    const { data: posData } = await supabase.rpc('next_waitlist_position', { p_scheduled_class_id: classId })
    const position = posData ?? 1
    const { error } = await supabase.from('waitlist').insert({ scheduled_class_id: classId, user_id: user.id, position })
    if (error) { toast.error(error.message) } else {
      // L'inscription est faite : on l'affiche avant de la journaliser.
      setUserWaitlist(prev => new Map(prev).set(classId, { id: '', position, status: 'waiting' }))
      toast.success(t('schedule.waitlistJoined', { position }))
      try {
        await logActivity({
          action: 'waitlist_joined', actor_id: user.id, target_user_id: user.id, entity_type: 'scheduled_class', entity_id: classId,
          details: { class_name: sc?.class_type?.name, position },
          description: `Liste d'attente (position ${position}): ${sc?.class_type?.name} le ${sc ? format(new Date(sc.starts_at), 'dd/MM/yyyy HH:mm') : ''}`,
        })
      } catch (e) {
        console.error('[liste attente] trace en echec:', e)
      }
    }
    setBookingInProgress(null)
  }

  const handleLeaveWaitlist = async (classId: string) => {
    if (!user) return
    await supabase.from('waitlist').update({ status: 'cancelled' }).eq('scheduled_class_id', classId).eq('user_id', user.id).in('status', ['waiting', 'offered'])
    setUserWaitlist(prev => { const n = new Map(prev); n.delete(classId); return n })
    toast.success(t('schedule.waitlistLeft'))
  }

  const handleConfirmWaitlistSpot = async (classId: string) => {
    if (!user) return
    setBookingInProgress(classId)
    const scheduledClass = classes.find((c) => c.id === classId)
    if (!scheduledClass?.class_type) { setBookingInProgress(null); return }
    if (new Date(scheduledClass.starts_at) < new Date()) { toast.error(isFr ? 'Ce cours est déjà passé' : 'This class has already passed'); setBookingInProgress(null); return }
    const { data: credits } = await supabase.rpc('get_available_credits', {
      p_user_id: user.id,
      p_credit_type_id: scheduledClass.class_type.credit_type_id,
      p_class_starts_at: scheduledClass.starts_at,
    })
    // La place offerte expire : c'est l'endroit où laisser le membre sans
    // solution coûte le plus cher. On propose l'achat immédiatement.
    if (!credits || credits.length === 0) {
      setNoCredits({
        reason: 'none',
        creditTypeId: scheduledClass.class_type.credit_type_id,
        creditTypeLabel: (isFr
          ? scheduledClass.class_type.credit_type?.label_fr
          : scheduledClass.class_type.credit_type?.label_en) ?? null,
      })
      setBookingInProgress(null)
      return
    }
    const packPurchaseId = credits[0].pack_purchase_id

    // Même passage par `book_class` que la réservation ordinaire. Le besoin y
    // est encore plus net : accepter une place de liste d'attente, c'est se
    // précipiter sur une place qui vient de se libérer — la situation même où
    // deux personnes cliquent en même temps.
    const { data: booked, error: bookError } = await supabase.rpc('book_class', {
      p_class_id: classId,
      p_pack_purchase_id: packPurchaseId,
    })

    if (bookError) { toast.error(bookError.message); setBookingInProgress(null); return }

    if (!booked?.ok) {
      toast.error(booked?.reason === 'class_full'
        ? (isFr ? 'La place vient d\'être prise.' : 'The spot has just been taken.')
        : t('common.error'))
      setBookingInProgress(null)
      fetchData()
      return
    }

    await supabase.from('waitlist').update({ status: 'confirmed' }).eq('scheduled_class_id', classId).eq('user_id', user.id)

    // La place est prise : on rend la main tout de suite, comme pour une
    // réservation ordinaire. La notification qui suit ne doit pas retenir le
    // bouton si son envoi échoue.
    setUserBookings((prev) => new Set([...prev, classId]))
    setUserWaitlist(prev => { const n = new Map(prev); n.delete(classId); return n })
    setBookingInProgress(null)
    toast.success(t('schedule.spotConfirmed'))

    try {
      await notifyMember({
        userId: user.id,
        title: isFr ? 'Place confirmée' : 'Spot confirmed',
        message: isFr
          ? `Tu as pris la place libérée — ${scheduledClass.class_type?.name}, ${format(new Date(scheduledClass.starts_at), "EEEE d MMMM 'à' HH:mm", { locale })}`
          : `You took the freed spot — ${scheduledClass.class_type?.name}, ${format(new Date(scheduledClass.starts_at), "EEEE d MMMM 'at' HH:mm", { locale })}`,
        type: 'success',
        link: '/my-bookings',
        email: {
          to: user.email,
          template: 'booking_confirmed',
          vars: classEmailVars(scheduledClass, profile?.display_name ?? ''),
          optOut: !profile?.email_on_self_booking,
        },
      })
    } catch (e) {
      console.error('[liste attente] notification en echec:', e)
    }
  }

  // ---- Trial session handler ----
  const handleTrialBooking = async (classId: string) => {
    if (!user) return
    setBookingInProgress(classId)
    const sc = classes.find((c) => c.id === classId)
    if (!sc) { setBookingInProgress(null); return }
    if (new Date(sc.starts_at) < new Date()) { toast.error(isFr ? 'Ce cours est déjà passé' : 'This class has already passed'); setBookingInProgress(null); return }

    // La séance d'essai est une réservation comme une autre : elle consomme le
    // crédit du pack d'essai offert à l'inscription. C'est ce qui la rend
    // visible dans « Mes réservations », sur l'accueil et dans la liste de
    // présence du coach — l'ancienne table séparée ne l'était nulle part.
    if (!sc.class_type) { setBookingInProgress(null); return }

    const { data: credits } = await supabase.rpc('get_available_credits', {
      p_user_id: user.id,
      p_credit_type_id: sc.class_type.credit_type_id,
      p_class_starts_at: sc.starts_at,
    })
    const packPurchaseId = credits?.[0]?.pack_purchase_id
    if (!packPurchaseId) {
      toast.error(isFr
        ? 'Ta séance d\'essai n\'est plus disponible.'
        : 'Your trial session is no longer available.')
      setBookingInProgress(null)
      return
    }

    const { error: trialError } = await supabase.from('bookings').insert({
      scheduled_class_id: classId,
      user_id: user.id,
      pack_purchase_id: packPurchaseId,
      is_trial: true,
    })
    if (trialError) {
      toast.error(trialError.message)
      setBookingInProgress(null)
      return
    }

    const { error: consumeError } = await supabase.rpc('consume_credit', {
      p_pack_purchase_id: packPurchaseId,
    })
    if (consumeError) {
      toast.error(consumeError.message)
      setBookingInProgress(null)
      return
    }

    // Réservée : on rend la main, puis on journalise.
    setBookingCounts(prev => { const n = new Map(prev); n.set(classId, (n.get(classId) ?? 0) + 1); return n })
    setUserBookings((prev) => new Set([...prev, classId]))
    setBookingInProgress(null)
    toast.success(isFr ? 'Séance d\'essai réservée !' : 'Trial session booked!')
    refreshProfile()

    try {
      await logActivity({
        action: 'trial_booked', actor_id: user.id, target_user_id: user.id, entity_type: 'booking',
        details: { class_name: sc.class_type?.name, starts_at: sc.starts_at },
        description: `Séance d'essai: ${sc.class_type?.name} le ${format(new Date(sc.starts_at), 'dd/MM/yyyy HH:mm')}`,
      })
    } catch (e) {
      console.error('[essai] trace en echec:', e)
    }
  }

  // L'essai se propose à qui détient encore son crédit d'essai — c'est la
  // possession qui fait foi, plus une déduction indirecte.
  //
  // Un membre qui possède un pack acheté n'est plus un prospect en essai : sans
  // cette condition, un pack attribué par l'admin (sans paiement des frais
  // d'inscription) laissait le bouton bloqué sur « Essai gratuit ».
  const canUseTrial = user && !!trialCredit && !hasUsedTrial && !hasRegistrationFee && !hasUsablePack

  // Class info popup
  const [infoClassType, setInfoClassType] = useState<ScheduledClass['class_type'] | null>(null)

  /**
   * Cours à signaler au staff : réservations fermées, cours pas encore commencé,
   * effectif sous le minimum. Ce sont les candidats à l'annulation — proposés,
   * jamais annulés d'office : le coach peut vouloir maintenir la séance.
   */
  const classesToReview = isStaff
    ? classes.filter(sc => {
        if (sc.is_cancelled || reviewDismissed.includes(sc.id)) return false
        const startsAt = new Date(sc.starts_at)
        if (startsAt <= new Date()) return false
        const count = bookingCounts.get(sc.id) ?? 0
        return count < minParticipants && isBookingClosed(sc, count, bookingRules)
      })
    : []

  /**
   * Cours passés restés sans décision.
   *
   * Des gens étaient inscrits, leur crédit a été consommé, et personne n'a dit
   * si le cours avait eu lieu : ni présence pointée, ni annulation. Cet état ne
   * doit pas durer — soit le cours a eu lieu et il faut pointer, soit il n'a
   * pas eu lieu et il faut rendre les crédits.
   *
   * Ne concerne que les cours sous le seuil : au-dessus, l'absence de pointage
   * est un oubli du coach, pas une décision en suspens.
   *
   * Un cours dont TOUTES les réservations sont pointées en absence n'y figure
   * pas : le coach s'est déplacé et a constaté que personne n'était venu. Le
   * cours a eu lieu, les absents n'ont pas annulé à temps, leurs crédits sont
   * acquis. Rien à décider — et l'écran de pointage n'offrait d'ailleurs plus
   * aucun bouton, ce qui rendait la demande insoluble.
   */
  /**
   * Cours passés qui attendent encore un geste du staff.
   *
   * Deux cas, et ils appellent la même action — ouvrir la fiche pour pointer :
   *
   *   `pending_checkin`  quorum atteint, personne pointé
   *   `not_given`        sous le quorum, des membres ont consommé un crédit
   *
   * La sélection écartait auparavant les cours atteignant le quorum
   * (`count >= minParticipants`), alors que le planning leur affiche le badge
   * « Présence à confirmer » calculé par `getClassStatus`. L'écran se
   * contredisait : il signalait un cours à traiter sans offrir le moyen de le
   * faire. Les deux reposent désormais sur la même fonction — c'est elle qui
   * décide, ici comme sur le badge.
   */
  const classesPendingDecision = isStaff
    ? classes.filter(sc => {
        const statut = getClassStatus({
          starts_at: sc.starts_at,
          is_cancelled: sc.is_cancelled,
          bookings: bookingCounts.get(sc.id) ?? 0,
          attended: attendedCounts.get(sc.id) ?? 0,
          noShows: noShowCounts.get(sc.id) ?? 0,
          minParticipants,
        })
        return statut === 'pending_checkin' || statut === 'not_given'
      })
    : []

  // ---- Detail d'une seance, cote membre ----
  //
  // Distinct du dialogue du staff, et volontairement : celui-ci affiche le
  // telephone de chaque inscrit et porte les boutons « Retirer » et
  // « Inscrire ». Un membre ne doit voir ni les uns ni les autres, et mutualiser
  // les deux ecrans reviendrait a faire dependre cette frontiere d'une suite de
  // conditions — la premiere oubliee exposerait des coordonnees.
  const [detailMembre, setDetailMembre] = useState<ScheduledClass | null>(null)
  const [participants, setParticipants] = useState<Participant[]>([])
  const [participantsLoading, setParticipantsLoading] = useState(false)

  const ouvrirDetailMembre = async (sc: ScheduledClass) => {
    setDetailMembre(sc)
    setParticipants([])
    setParticipantsLoading(true)

    // Un seul cours, charge a l'ouverture : la liste ne s'affiche que la, il
    // n'y a rien a precharger pour la semaine entiere.
    //
    // Passe par le serveur, comme les places prises : la policy de `bookings`
    // est `auth.uid() = user_id`, une lecture directe rendrait une liste vide
    // SANS erreur — et le defaut serait invisible en test admin.
    const { data, error } = await supabase
      .rpc('participants_par_cours', { p_class_id: sc.id })

    if (error) {
      // Tester `error` : un refus revient dans l'objet de reponse sans lever
      // d'exception. Sans ce test, l'ecran afficherait « aucun inscrit » sur un
      // cours plein.
      console.error('participants_par_cours:', error.message)
    } else {
      setParticipants((data ?? []) as Participant[])
    }
    setParticipantsLoading(false)
  }

  // ---- Class detail dialog (coach/admin) ----
  const [detailClass, setDetailClass] = useState<ScheduledClass | null>(null)
  const [detailBookings, setDetailBookings] = useState<Booking[]>([])
  const [detailLoading, setDetailLoading] = useState(false)
  const [cancelClassConfirm, setCancelClassConfirm] = useState(false)
  const [addMemberOpen, setAddMemberOpen] = useState(false)
  const [eligibleMembers, setEligibleMembers] = useState<{ user_id: string; display_name: string; credits: number; pack_purchase_id: string; unlimited: boolean }[]>([])
  const [selectedMemberId, setSelectedMemberId] = useState('')
  const [addMemberLoading, setAddMemberLoading] = useState(false)

  const openClassDetail = async (sc: ScheduledClass) => {
    if (!isStaff) return
    setDetailClass(sc)
    setDetailLoading(true)
    setAddMemberOpen(false)

    const { data: bookingData } = await supabase
      .from('bookings')
      .select('*')
      .eq('scheduled_class_id', sc.id)
      .eq('status', 'confirmed')

    const rawBookings = (bookingData as Booking[]) ?? []

    // Fetch profiles separately
    if (rawBookings.length > 0) {
      const userIds = [...new Set(rawBookings.map(b => b.user_id))]
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, display_name, email, phone')
        .in('id', userIds)
      const profileMap = new Map((profiles ?? []).map(p => [p.id, p]))
      for (const b of rawBookings) {
        b.user = profileMap.get(b.user_id) as Booking['user']
      }
    }

    setDetailBookings(rawBookings)
    setDetailLoading(false)
  }

  const handleRemoveBooking = async (booking: Booking) => {
    if (!detailClass || !user) return

    // Retrait décidé par le studio : le crédit revient quoi qu'il arrive.
    // cancel_booking_v2 appliquerait le délai de prévenance du membre et
    // pourrait le lui faire perdre sans qu'il y soit pour rien.
    const { data: result } = await supabase.rpc('cancel_booking_by_studio', {
      p_booking_id: booking.id,
    })

    if (result?.error) {
      toast.error(result.error as string)
      return
    }

    await logActivity({
      action: 'booking_cancelled',
      actor_id: user.id,
      target_user_id: booking.user_id,
      entity_type: 'booking',
      entity_id: booking.id,
      details: { class_name: detailClass.class_type?.name, removed_by_admin: true, refunded: result?.refunded },
      description: `Désinscription par ${roles.includes('admin') ? 'admin' : 'coach'}: ${booking.user?.display_name} du cours ${detailClass.class_type?.name} du ${format(new Date(detailClass.starts_at), 'dd/MM/yyyy HH:mm')}`,
    })

    // In-app notification
    await supabase.from('notifications').insert({
      user_id: booking.user_id,
      title: isFr ? 'Réservation annulée' : 'Booking cancelled',
      message: isFr
        ? `Votre réservation pour ${detailClass.class_type?.name} du ${format(new Date(detailClass.starts_at), 'dd/MM/yyyy HH:mm')} a été annulée par l'équipe.${result?.refunded ? ' Votre crédit a été restitué.' : ''}`
        : `Your booking for ${detailClass.class_type?.name} on ${format(new Date(detailClass.starts_at), 'dd/MM/yyyy HH:mm')} was cancelled by staff.${result?.refunded ? ' Votre crédit a été restitué.' : ''}`,
      type: 'warning',
      link: '/my-bookings',
    })

    // Email (staff-cancel, always sent)
    const { data: memberProfile } = await supabase.from('profiles').select('email, display_name').eq('id', booking.user_id).maybeSingle()
    if (memberProfile?.email) {
      sendEmail('booking_cancelled_by_staff', memberProfile.email, {
        ...classEmailVars(detailClass, memberProfile.display_name ?? booking.user?.display_name),
        refunded: result?.refunded as boolean | undefined,
      })
    }

    setDetailBookings(prev => prev.filter(b => b.id !== booking.id))
    setBookingCounts(prev => {
      const n = new Map(prev)
      n.set(detailClass.id, Math.max(0, (n.get(detailClass.id) ?? 1) - 1))
      return n
    })
    toast.success(isFr
      ? `${booking.user?.display_name} désinscrit(e) — crédit ${result?.refunded ? 'restitué' : 'non restitué'}`
      : `${booking.user?.display_name} removed — credit ${result?.refunded ? 'refunded' : 'not refunded'}`)
  }

  /**
   * Annule un cours : restitue les crédits, notifie et informe par e-mail les
   * inscrits. Utilisée par le dialogue de détail et par le bandeau de revue des
   * cours sous le seuil.
   */
  const cancelClass = async (sc: ScheduledClass, bookingsOfClass: Booking[], reason?: 'below_minimum') => {
    if (!user) return

    const { error: cancelError } = await supabase
      .from('scheduled_classes')
      .update({ is_cancelled: true })
      .eq('id', sc.id)

    // Sans ce contrôle, un refus d'écriture passait inaperçu : le cours
    // restait planifié alors que les crédits avaient déjà été rendus.
    if (cancelError) {
      console.error('cancelClass', cancelError)
      toast.error(cancelError.message)
      return
    }

    const userIds = bookingsOfClass.map(b => b.user_id)
    const { data: memberProfiles } = await supabase
      .from('profiles')
      .select('id, display_name, email')
      .in('id', userIds.length > 0 ? userIds : ['00000000-0000-0000-0000-000000000000'])
    const profileMap = new Map((memberProfiles ?? []).map(p => [p.id, p]))

    for (const booking of bookingsOfClass) {
      // Le crédit revient toujours : l'annulation vient du studio.
      await supabase.rpc('cancel_booking_by_studio', { p_booking_id: booking.id })

      const when = format(new Date(sc.starts_at), 'EEEE dd/MM à HH:mm', { locale })
      const isUnlimited = booking.pack_purchase?.pack_type?.is_unlimited
      await supabase.from('notifications').insert({
        user_id: booking.user_id,
        title: isFr ? 'Cours annulé' : 'Class cancelled',
        message: isFr
          ? `Le cours ${sc.class_type?.name} du ${when} a été annulé${reason === 'below_minimum' ? ' (nombre de participants insuffisant)' : ''}.${isUnlimited ? '' : ' Votre crédit a été restitué.'}`
          : `The class ${sc.class_type?.name} on ${when} has been cancelled${reason === 'below_minimum' ? ' (not enough participants)' : ''}.${isUnlimited ? '' : ' Your credit has been refunded.'}`,
        type: 'error',
        link: '/schedule',
      })

      const p = profileMap.get(booking.user_id)
      if (p?.email) {
        sendEmail('class_cancelled', p.email, classEmailVars(sc, p.display_name))
      }
    }

    await logActivity({
      action: 'booking_cancelled',
      actor_id: user.id,
      target_user_id: user.id,
      entity_type: 'scheduled_class',
      entity_id: sc.id,
      details: {
        class_name: sc.class_type?.name,
        cancelled_class: true,
        members_notified: bookingsOfClass.length,
        reason: reason ?? 'manual',
      },
      description: `Cours annulé: ${sc.class_type?.name} du ${format(new Date(sc.starts_at), 'dd/MM/yyyy HH:mm')}${reason === 'below_minimum' ? ' (effectif insuffisant)' : ''} — ${bookingsOfClass.length} membre(s) notifié(s)`,
    })
  }

  /** Annulation depuis le bandeau de revue : charge les inscrits puis annule. */
  const cancelClassFromReview = async (sc: ScheduledClass) => {
    const { data } = await supabase
      .from('bookings')
      .select('*, pack_purchase:pack_purchases(pack_type:pack_types(is_unlimited))')
      .eq('scheduled_class_id', sc.id)
      .eq('status', 'confirmed')
    await cancelClass(sc, (data as Booking[]) ?? [], 'below_minimum')
    toast.success(isFr
      ? `Cours annulé — ${(data ?? []).length} membre(s) notifié(s)`
      : `Class cancelled — ${(data ?? []).length} member(s) notified`)
    fetchData()
  }

  const handleCancelClass = async () => {
    if (!detailClass || !user) return

    // Mark class as cancelled
    const { error: cancelError } = await supabase
      .from('scheduled_classes')
      .update({ is_cancelled: true })
      .eq('id', detailClass.id)

    if (cancelError) {
      console.error('handleCancelClass', cancelError)
      toast.error(cancelError.message)
      return
    }

    // Cancel all bookings and refund credits
    const userIds = detailBookings.map(b => b.user_id)
    const { data: memberProfiles } = await supabase
      .from('profiles')
      .select('id, display_name, email')
      .in('id', userIds)
    const profileMap = new Map((memberProfiles ?? []).map(p => [p.id, p]))

    for (const booking of detailBookings) {
      // cancel_booking_by_studio et non cancel_booking_v2 : l'annulation vient
      // du studio, le crédit revient toujours — même à moins de 24 h du cours.
      await supabase.rpc('cancel_booking_by_studio', { p_booking_id: booking.id })

      // In-app notification
      await supabase.from('notifications').insert({
        user_id: booking.user_id,
        title: isFr ? 'Cours annulé' : 'Class cancelled',
        message: isFr
          ? `Le cours ${detailClass.class_type?.name} du ${format(new Date(detailClass.starts_at), 'EEEE dd/MM à HH:mm', { locale })} a été annulé. Votre crédit a été restitué.`
          : `The class ${detailClass.class_type?.name} on ${format(new Date(detailClass.starts_at), 'EEEE dd/MM HH:mm', { locale })} has been cancelled. Your credit has been refunded.`,
        type: 'error',
        link: '/schedule',
      })

      // Email (class cancel, always sent)
      const p = profileMap.get(booking.user_id)
      if (p?.email) {
        sendEmail('class_cancelled', p.email, classEmailVars(detailClass, p.display_name))
      }
    }

    await logActivity({
      action: 'booking_cancelled',
      actor_id: user.id,
      target_user_id: user.id,
      entity_type: 'scheduled_class',
      entity_id: detailClass.id,
      details: { class_name: detailClass.class_type?.name, cancelled_class: true, members_notified: detailBookings.length },
      description: `Cours annulé: ${detailClass.class_type?.name} du ${format(new Date(detailClass.starts_at), 'dd/MM/yyyy HH:mm')} — ${detailBookings.length} membre(s) notifié(s)`,
    })

    toast.success(isFr
      ? `Cours annulé — ${detailBookings.length} membre(s) notifié(s) et crédits restitués`
      : `Class cancelled — ${detailBookings.length} member(s) notified and credits refunded`)

    setCancelClassConfirm(false)
    setDetailClass(null)
    fetchData()
  }

  const openAddMember = async () => {
    if (!detailClass) return
    setAddMemberLoading(true)
    setAddMemberOpen(true)
    setSelectedMemberId('')

    const creditTypeId = detailClass.class_type?.credit_type_id
    if (!creditTypeId) { setAddMemberLoading(false); return }

    // Le filtre `credits_remaining > 0` excluait les packs et abonnements
    // ILLIMITÉS, dont le compteur ne bouge jamais : un membre en illimité
    // n'apparaissait pas dans la liste.
    const { data: packs } = await supabase
      .from('pack_purchases')
      .select('user_id, credits_remaining, expires_at, id, subscription_id, pack_type:pack_types(credit_type_id, is_unlimited)')
      .gt('expires_at', new Date().toISOString())
      .order('expires_at', { ascending: true })

    if (!packs) { setAddMemberLoading(false); return }

    const bookedUserIds = new Set(detailBookings.map(b => b.user_id))
    const memberMap = new Map<string, { user_id: string; credits: number; pack_purchase_id: string; unlimited: boolean; fromSub: boolean }>()

    for (const p of packs) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const pt = p.pack_type as any
      if (pt?.credit_type_id !== creditTypeId) continue
      if (bookedUserIds.has(p.user_id)) continue

      const unlimited = !!pt?.is_unlimited
      if (!unlimited && p.credits_remaining <= 0) continue

      const fromSub = !!p.subscription_id
      const existing = memberMap.get(p.user_id)

      if (!existing) {
        memberMap.set(p.user_id, {
          user_id: p.user_id,
          credits: unlimited ? 0 : p.credits_remaining,
          pack_purchase_id: p.id,
          unlimited,
          fromSub,
        })
        continue
      }

      if (!unlimited) existing.credits += p.credits_remaining
      if (unlimited) existing.unlimited = true
      // Priorité à l'abonnement pour la source réellement consommée.
      if (fromSub && !existing.fromSub) {
        existing.pack_purchase_id = p.id
        existing.fromSub = true
      }
    }

    // Fetch profiles for eligible members
    const userIds = [...memberMap.keys()]
    if (userIds.length > 0) {
      const { data: profiles } = await supabase.from('profiles').select('id, display_name').in('id', userIds)
      const result = (profiles ?? []).map(p => ({
        user_id: p.id,
        display_name: p.display_name,
        credits: memberMap.get(p.id)!.credits,
        pack_purchase_id: memberMap.get(p.id)!.pack_purchase_id,
        unlimited: memberMap.get(p.id)!.unlimited,
      }))
      result.sort((a, b) => a.display_name.localeCompare(b.display_name))
      setEligibleMembers(result)
    } else {
      setEligibleMembers([])
    }

    setAddMemberLoading(false)
  }

  const handleAddMember = async () => {
    if (!detailClass || !selectedMemberId || !user) return
    const member = eligibleMembers.find(m => m.user_id === selectedMemberId)
    if (!member) return

    setAddMemberLoading(true)

    const { data: reactivated } = await supabase
      .from('bookings')
      .update({ status: 'confirmed', pack_purchase_id: member.pack_purchase_id, cancelled_at: null })
      .eq('scheduled_class_id', detailClass.id)
      .eq('user_id', member.user_id)
      .eq('status', 'cancelled')
      .select()
      .maybeSingle()

    if (!reactivated) {
      const { error } = await supabase.from('bookings').insert({
        scheduled_class_id: detailClass.id,
        user_id: member.user_id,
        pack_purchase_id: member.pack_purchase_id,
      })
      if (error) {
        toast.error(error.message)
        setAddMemberLoading(false)
        return
      }
    }

    await supabase.rpc('consume_credit', { p_pack_purchase_id: member.pack_purchase_id })

    await logActivity({
      action: 'booking_assigned',
      actor_id: user.id,
      target_user_id: member.user_id,
      entity_type: 'booking',
      details: { class_name: detailClass.class_type?.name, starts_at: detailClass.starts_at },
      description: `${member.display_name} inscrit au cours ${detailClass.class_type?.name} du ${format(new Date(detailClass.starts_at), 'dd/MM/yyyy HH:mm')}`,
    })

    // In-app notification
    await supabase.from('notifications').insert({
      user_id: member.user_id,
      title: isFr ? 'Inscription à un cours' : 'Class booking',
      message: isFr
        ? `Vous avez été inscrit(e) au cours ${detailClass.class_type?.name} du ${format(new Date(detailClass.starts_at), 'EEEE dd/MM à HH:mm', { locale })}.`
        : `You have been booked for ${detailClass.class_type?.name} on ${format(new Date(detailClass.starts_at), 'EEEE dd/MM HH:mm', { locale })}.`,
      type: 'success',
      link: '/my-bookings',
    })

    // Email (staff-booking, always sent) — fetch member email
    const { data: memberProfile } = await supabase.from('profiles').select('email').eq('id', member.user_id).maybeSingle()
    if (memberProfile?.email) {
      sendEmail('booking_created_by_staff', memberProfile.email, classEmailVars(detailClass, member.display_name))
    }

    toast.success(isFr ? `${member.display_name} inscrit(e) !` : `${member.display_name} booked!`)
    setAddMemberOpen(false)
    setAddMemberLoading(false)

    // Refresh bookings in detail dialog
    await openClassDetail(detailClass)
    setBookingCounts(prev => {
      const n = new Map(prev)
      n.set(detailClass.id, (n.get(detailClass.id) ?? 0) + 1)
      return n
    })
  }

  // ---- Render helpers ----
  const getClassesForDay = (day: Date) => filteredClasses.filter((sc) => isSameDay(new Date(sc.starts_at), day))

  const ClassCard = ({ sc }: { sc: ScheduledClass }) => {
    const startsAt = new Date(sc.starts_at)
    const isPast = startsAt < new Date()
    const isBooked = userBookings.has(sc.id)
    const waitlistEntry = userWaitlist.get(sc.id)
    const isOnWaitlist = !!waitlistEntry
    const isOffered = waitlistEntry?.status === 'offered'
    const spotsUsed = bookingCounts.get(sc.id) ?? 0
    const spotsFree = sc.max_participants - spotsUsed
    const isFull = spotsFree <= 0
    const isBooking = bookingInProgress === sc.id
    const classColor = sc.class_type?.color || '#3B82F6'
    const closed = !isPast && !isBooked && !isOnWaitlist && isBookingClosed(sc, spotsUsed, bookingRules)

    const availabilityText = isPast
      ? (isFr ? 'Terminé' : 'Past')
      : isFull
        ? (isFr ? 'Cours complet' : 'Class full')
        : isFr
          ? `${spotsFree} place${spotsFree > 1 ? 's' : ''} disponible${spotsFree > 1 ? 's' : ''}`
          : `${spotsFree} spot${spotsFree > 1 ? 's' : ''} available`

    const renderAction = () => {
      if (isStaff) {
        // Statut dérivé, réservé au staff : les clients ne voient jamais
        // "Annulé" ni "Effectif insuffisant".
        const status = getClassStatus({
          starts_at: sc.starts_at,
          is_cancelled: sc.is_cancelled,
          bookings: bookingCounts.get(sc.id) ?? 0,
          // Sans ces deux comptes, un cours pointé passait pour « à décider » :
          // c'est ce qui affichait « décision attendue » sur un cours dont
          // toutes les présences étaient déjà tranchées.
          attended: attendedCounts.get(sc.id) ?? 0,
          noShows: noShowCounts.get(sc.id) ?? 0,
          minParticipants,
        })
        const badge = classStatusLabel(status, isFr)
        return (
          <div className="flex items-center gap-2">
            {status !== 'scheduled' && (
              <Badge variant={badge.variant} className={cn('text-[10px]', badge.className)}>
                {badge.label}
              </Badge>
            )}
            <Button size="sm" variant="outline" className="rounded-full h-8 text-xs font-semibold"
              onClick={(e) => { e.stopPropagation(); openClassDetail(sc) }}>
              <Users className="h-3 w-3 mr-1" />{isFr ? 'Détail' : 'Detail'}
            </Button>
          </div>
        )
      }
      if (isPast) return isBooked ? (
        <span className="flex items-center gap-1 text-xs text-primary/70">
          <Check className="h-3.5 w-3.5" />{t('schedule.booked')}
        </span>
      ) : null
      if (isBooked) return (
        <span className="flex items-center gap-1 text-xs font-semibold text-primary">
          <Check className="h-4 w-4" />{t('schedule.booked')}
        </span>
      )
      if (isOffered) return (
        <Button size="sm" className="rounded-full h-8 text-xs font-bold bg-orange-500 hover:bg-orange-600 text-white"
          onClick={(e) => { e.stopPropagation(); handleConfirmWaitlistSpot(sc.id) }} disabled={isBooking}>
          {isBooking ? '...' : t('schedule.confirmSpot')}
        </Button>
      )
      if (isOnWaitlist) return (
        <div className="flex items-center gap-1">
          <span className="text-xs text-muted-foreground flex items-center gap-1">
            <Clock3 className="h-3 w-3" />
            {t('schedule.onWaitlist', { position: waitlistEntry.position })}
          </span>
          <button onClick={(e) => { e.stopPropagation(); handleLeaveWaitlist(sc.id) }} className="text-muted-foreground hover:text-foreground">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )
      if (closed) return (
        <span className="flex items-center gap-1 text-xs text-muted-foreground">
          <Lock className="h-3 w-3" />{isFr ? 'Fermé' : 'Closed'}
        </span>
      )
      if (isFull) return (
        <Button size="sm" variant="outline"
          className="rounded-full h-8 text-xs font-bold border-primary/50 text-primary hover:bg-primary/10"
          onClick={(e) => { e.stopPropagation(); handleJoinWaitlist(sc.id) }} disabled={isBooking}>
          {isBooking ? '...' : (isFr ? 'Liste d\'attente' : 'Waitlist')}
        </Button>
      )
      if (canUseTrial) return (
        <Button size="sm"
          className="rounded-full h-8 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white px-4"
          onClick={(e) => { e.stopPropagation(); handleTrialBooking(sc.id) }} disabled={isBooking}>
          {isBooking ? '...' : (isFr ? 'Essai gratuit' : 'Free trial')}
        </Button>
      )
      return (
        <Button size="sm"
          className="rounded-full h-8 text-xs font-bold bg-foreground hover:bg-foreground/90 text-background px-4 uppercase tracking-wide"
          onClick={(e) => { e.stopPropagation(); handleBook(sc.id) }} disabled={isBooking}>
          {isBooking ? '...' : (isFr ? 'Réserver' : 'Book')}
        </Button>
      )
    }

    // Un cours passe n'ouvre plus rien cote membre : la consultation du passe
    // n'apporte rien a qui veut reserver, et les coachs n'en voulaient pas.
    const clientPeutOuvrirDetail = !isStaff && !isPast

    return (
      <motion.div
        layout
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className={cn(
          'flex rounded-2xl border bg-card overflow-hidden transition-all',
          isPast && 'opacity-60',
          !isPast && !isBooked && 'hover:border-primary/40',
          isBooked && !isPast && 'ring-1 ring-primary/30 hover:bg-muted/40',
          isOffered && !isPast && 'ring-1 ring-orange-400/50',
          (isStaff || clientPeutOuvrirDetail) && 'cursor-pointer'
        )}
        onClick={
          // Son propre cours, déjà passé : c'est le pointage qu'on vient
          // chercher, pas la fiche de gestion. Le dialogue de cette page sait
          // inscrire, désinscrire et annuler, mais pas marquer présent ou
          // absent — cliquer y menait donc à un écran sans le bouton attendu.
          isStaff && isPast && sc.coach_id === user?.id
            ? () => navigate(`/coach/class/${sc.id}`)
            : isStaff
              ? () => openClassDetail(sc)
              : clientPeutOuvrirDetail
                ? () => ouvrirDetailMembre(sc)
                : undefined
        }
      >
        {/* Left: image */}
        <div className="relative w-20 sm:w-28 shrink-0 bg-muted">
          {sc.class_type?.image_url ? (
            <img
              src={urlImage(sc.class_type.image_url)}
              alt={sc.class_type.name}
              className="absolute inset-0 w-full h-full object-cover"
            />
          ) : (
            <div
              className="absolute inset-0 flex items-center justify-center"
              style={{ background: `linear-gradient(135deg, ${classColor}cc, ${classColor}66)` }}
            >
              <span className="text-white/80 font-bold text-lg">
                {(sc.class_type?.name || 'C').charAt(0)}
              </span>
            </div>
          )}
          <div className="absolute left-0 top-0 bottom-0 w-1" style={{ backgroundColor: classColor }} />
        </div>

        {/* Right: info */}
        <div className="flex-1 p-3 min-w-0 flex flex-col gap-1.5">
          {/* Top: time badge + availability */}
          <div className="flex items-start justify-between gap-2">
            <span className="inline-flex items-center px-2.5 py-1 rounded-md bg-foreground text-background font-bold text-sm leading-none">
              {format(startsAt, 'HH:mm')}
            </span>
            <span className={cn(
              'text-[11px] sm:text-xs text-right leading-tight',
              isFull ? 'text-muted-foreground' : 'text-muted-foreground'
            )}>
              {availabilityText}
            </span>
          </div>

          {/* Title + info icon */}
          <div className="flex items-center gap-1.5 min-w-0">
            <h3 className="font-bold text-base sm:text-lg leading-tight truncate">
              {sc.title || sc.class_type?.name}
            </h3>
            {(sc.class_type?.description_md || sc.class_type?.image_url) && (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); setInfoClassType(sc.class_type!) }}
                className="text-muted-foreground hover:text-primary shrink-0"
              >
                <Info className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Coach · Room */}
          {(sc.coach || sc.floor) && (
            <p className="text-xs sm:text-sm text-muted-foreground truncate">
              {sc.coach?.display_name}
              {sc.coach && sc.floor && <span className="mx-1.5">·</span>}
              {sc.floor && (isStaff ? sc.floor : (roomNames[sc.floor] || sc.floor))}
            </p>
          )}

          {/* Bottom: duration + action */}
          <div className="flex items-end justify-between gap-2 mt-auto pt-1">
            <span className="text-xs text-muted-foreground font-medium">
              {sc.duration_minutes} min
            </span>
            {renderAction()}
          </div>
        </div>
      </motion.div>
    )
  }

  if (loading) return <LoadingState />

  const classesByDay = weekDays.map((day) => ({
    day,
    classes: getClassesForDay(day),
  })).filter(({ classes: c }) => c.length > 0)

  return (
    <div className="space-y-6">
      {/* Semi-privé / Personal Training — au-dessus du titre : c'est le
          premier choix, celui qui commande tout le reste de la page. Un crédit
          Personal Training ne paie pas un cours semi-privé.

          Pas d'onglet « Tout » : mélangés, les deux obligeaient à lire chaque
          carte pour trier. On regarde un type à la fois, et le semi-privé
          s'ouvre par défaut — c'est la prestation courante du studio. */}
      {creditTypeTabs.length > 1 && (
        <div className="flex justify-center">
          <div className="inline-flex rounded-lg border bg-muted/30 p-1 max-w-full overflow-x-auto">
            {creditTypeTabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                // Le type de cours choisi appartient peut-être à l'autre onglet :
                // le garder viderait le planning sans raison visible.
                onClick={() => { setFilterCreditType(tab.id); setFilterClassType('all') }}
                className={cn(
                  'px-4 py-2 rounded-md text-sm font-medium transition-colors whitespace-nowrap',
                  ongletActif === tab.id
                    ? 'bg-background shadow-sm'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Title — porte le type affiché : « Planning des cours » quand on voit
          tout, « Planning Personal Training » quand on filtre. L'écran dit
          alors ce qu'il montre, sans qu'on ait à remonter aux onglets.
          
          Le titre suit `ongletActif` seul, sans regarder combien d'onglets
          existent. Le `creditTypeTabs.length > 1` d'avant le faisait retomber
          sur « des cours » dès qu'une semaine ne proposait qu'un seul type :
          l'écran montrait du personal training et s'annonçait générique. Or
          les onglets se déduisent des cours de la période — leur nombre varie
          d'une semaine à l'autre, le titre n'a pas à en dépendre. */}
      <div>
        <h1 className="text-3xl font-bold">
          {isFr ? 'Planning ' : 'Class '}
          <span className="text-primary">
            {ongletActif !== 'all'
              ? (creditTypeTabs.find(t => t.id === ongletActif)?.label ?? (isFr ? 'des cours' : 'Schedule'))
              : (isFr ? 'des cours' : 'Schedule')}
          </span>
        </h1>
        <p className="text-muted-foreground mt-1">
          {isFr ? 'Réserve ta place et viens transpirer' : 'Book your spot and come sweat'}
        </p>
      </div>

      {/* Cours passés restés sans décision. Des gens ont consommé un crédit et
          personne n'a dit si le cours avait eu lieu. Deux issues, pas d'autre :
          pointer les présences, ou annuler et rendre les crédits. */}
      {classesPendingDecision.length > 0 && (
        <div className="rounded-xl border-2 border-orange-500 bg-orange-50 dark:bg-orange-950/30 p-3 space-y-2">
          <div>
            <p className="text-sm font-semibold text-orange-700 dark:text-orange-400">
              {isFr
                ? `${classesPendingDecision.length} cours passé(s) à pointer`
                : `${classesPendingDecision.length} past class(es) to check in`}
            </p>
            <p className="text-xs text-orange-700/80 dark:text-orange-400/80 mt-0.5">
              {isFr
                ? 'Des membres ont consommé un crédit sans qu\'on sache s\'ils sont venus. Pointe les présences, ou annule le cours pour leur rendre leur crédit.'
                : 'Members used a credit and nobody said whether they came. Check them in, or cancel the class to refund their credit.'}
            </p>
          </div>
          {classesPendingDecision.map(sc => {
            const count = bookingCounts.get(sc.id) ?? 0
            return (
              <div key={sc.id} className="flex items-center justify-between gap-2 rounded-lg bg-background p-2.5 flex-wrap">
                <div className="min-w-0">
                  {/* Le coach est nommé ici : ce bandeau est visible par tout
                      le staff, et pointer un cours revient à celui qui l'a
                      donné. Sans le nom, chacun devait ouvrir la fiche pour
                      savoir si l'affaire le concernait. */}
                  <p className="text-sm font-medium truncate">
                    {sc.title || sc.class_type?.name}
                    <span className="font-normal text-muted-foreground">
                      {' ('}
                      {sc.coach?.display_name ?? (isFr ? 'sans coach' : 'no coach')}
                      {')'}
                    </span>
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {format(new Date(sc.starts_at), 'EEEE dd/MM à HH:mm', { locale })}
                    {' · '}
                    {isFr ? `${count} inscrit(s)` : `${count} booked`}
                  </p>
                </div>
                <div className="flex gap-1.5 shrink-0">
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 text-xs"
                    onClick={() => navigate(`/coach/class/${sc.id}`)}
                  >
                    {isFr ? 'Pointer les présences' : 'Check in'}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 text-xs text-destructive hover:text-destructive"
                    onClick={() => openClassDetail(sc)}
                  >
                    {isFr ? 'Annuler' : 'Cancel'}
                  </Button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Cours sous le seuil, réservations fermées — proposés à l'annulation.
          Rien n'est annulé d'office : le coach peut vouloir maintenir. */}
      {classesToReview.length > 0 && (
        <div className="rounded-xl border border-orange-500/50 bg-orange-50 dark:bg-orange-950/30 p-3 space-y-2">
          <p className="text-sm font-semibold text-orange-700 dark:text-orange-400">
            {isFr
              ? `${classesToReview.length} cours sous le seuil de ${minParticipants} participant(s), réservations fermées`
              : `${classesToReview.length} class(es) below the ${minParticipants}-attendee threshold, bookings closed`}
          </p>
          {classesToReview.map(sc => {
            const count = bookingCounts.get(sc.id) ?? 0
            return (
              <div key={sc.id} className="flex items-center justify-between gap-3 flex-wrap text-sm">
                <span>
                  <span className="font-medium">{sc.class_type?.name}</span>
                  {' · '}
                  {format(new Date(sc.starts_at), 'EEE dd/MM HH:mm', { locale })}
                  {' · '}
                  <span className={count === 0 ? 'text-destructive' : undefined}>
                    {count}/{minParticipants} {isFr ? 'inscrit(s)' : 'booked'}
                  </span>
                </span>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" className="h-7 text-xs"
                    onClick={() => setReviewDismissed(prev => [...prev, sc.id])}>
                    {isFr ? 'Maintenir' : 'Keep'}
                  </Button>
                  <Button size="sm" variant="destructive" className="h-7 text-xs"
                    onClick={() => cancelClassFromReview(sc)}>
                    {isFr ? 'Annuler le cours' : 'Cancel class'}
                  </Button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Crédits restants — « combien de réservations puis-je encore faire ? »
          Il fallait aller dans « Mes packs » pour le savoir. */}
      {creditSummary.some(c => ongletActif === 'all' || c.id === ongletActif) && (
        <div className="flex items-center gap-2 flex-wrap text-xs">
          {/* Les crédits suivent l'onglet : afficher le solde semi-privé sous un
              planning Personal Training donnerait un compte que ces cours ne
              peuvent pas consommer. */}
          {creditSummary.filter(c => ongletActif === 'all' || c.id === ongletActif).map((c) => (
            <span
              key={c.id}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1',
                c.unlimited || c.count > 0
                  ? 'border-primary/30 bg-primary/5'
                  : 'border-amber-500/40 bg-amber-500/5 text-amber-700 dark:text-amber-400',
              )}
            >
              <span className="text-muted-foreground">{c.label}</span>
              <span className="font-semibold">
                {c.unlimited
                  ? (isFr ? 'illimité' : 'unlimited')
                  : isFr
                    ? `${c.count} crédit${c.count > 1 ? 's' : ''}`
                    : `${c.count} credit${c.count > 1 ? 's' : ''}`}
              </span>
            </span>
          ))}
        </div>
      )}

      {/* Week nav + view toggle */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          {/* Reculer est refusé au client quand cela sortirait de la semaine
              courante : le passé ne lui sert à rien et il pouvait s'y perdre
              sans comprendre pourquoi le planning était vide. Le staff garde
              l'accès complet — il a besoin de l'historique. */}
          <Button variant="ghost" size="icon" className="h-8 w-8"
            disabled={!canGoBack}
            title={!canGoBack ? (isFr ? 'Les cours passés ne sont pas consultables' : 'Past classes are not available') : undefined}
            onClick={() => { setSwipeDirection(-1); setCurrentDate((d) => addDays(d, -7)) }}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm font-medium">
            {viewMode === 'day'
              ? `${format(dayViewDays[0], 'dd MMM', { locale })} — ${format(dayViewDays[6], 'dd MMM yyyy', { locale })}`
              : `${format(weekStart, 'dd MMM', { locale })} — ${format(addDays(weekStart, 6), 'dd MMM yyyy', { locale })}`}
          </span>
          <Button variant="ghost" size="icon" className="h-8 w-8"
            onClick={() => { setSwipeDirection(1); setCurrentDate((d) => addDays(d, 7)) }}>
            <ChevronRight className="h-4 w-4" />
          </Button>

          {/* Le retour à aujourd'hui existait, mais caché derrière la plage de
              dates : rien n'indiquait qu'elle était cliquable. Il devient un
              bouton, visible seulement quand on n'y est pas déjà. */}
          {!showingToday && (
            <Button
              variant="outline"
              size="sm"
              className="h-8 text-xs"
              onClick={() => { setSwipeDirection(0); setCurrentDate(new Date()); setSelectedDay(new Date()) }}
            >
              {isFr ? "Aujourd'hui" : 'Today'}
            </Button>
          )}
        </div>

        <div className="flex rounded-lg border overflow-hidden">
          <button
            className={cn('flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors', viewMode === 'day' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted')}
            onClick={() => setViewMode('day')}
          >
            <Calendar className="h-3.5 w-3.5" />
            {isFr ? 'Jour' : 'Day'}
          </button>
          <button
            className={cn('flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors', viewMode === 'week' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted')}
            onClick={() => setViewMode('week')}
          >
            <LayoutGrid className="h-3.5 w-3.5" />
            {isFr ? 'Semaine' : 'Week'}
          </button>
          <button
            className={cn('flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors', viewMode === 'list' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted')}
            onClick={() => setViewMode('list')}
          >
            <List className="h-3.5 w-3.5" />
            {isFr ? 'Liste' : 'List'}
          </button>
        </div>
      </div>

      {/* Filters — single button opens popup */}
      {(() => {
        // L'onglet de type de crédit compte comme un filtre : sans lui, un
        // planning vidé par l'onglet actif n'aurait aucune explication visible.
        const activeCount = (filterCreditType !== 'all' ? 1 : 0)
          + (filterClassType !== 'all' ? 1 : 0)
          + (filterCoach !== 'all' ? 1 : 0)
        return (
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="rounded-full h-9 gap-1.5"
              onClick={() => setFilterOpen(true)}
            >
              <SlidersHorizontal className="h-4 w-4" />
              <span className="text-sm">{isFr ? 'Filtres' : 'Filters'}</span>
              {activeCount > 0 && (
                <Badge variant="default" className="h-5 px-1.5 text-[10px] ml-1">{activeCount}</Badge>
              )}
            </Button>
            {activeCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="h-9 text-xs text-muted-foreground"
                onClick={() => { setFilterCreditType('all'); setFilterClassType('all'); setFilterCoach('all') }}
              >
                <X className="h-3.5 w-3.5 mr-1" />
                {isFr ? 'Réinitialiser' : 'Reset'}
              </Button>
            )}
          </div>
        )
      })()}

      {/* DAY VIEW — Technogym style, swipeable week-by-week */}
      {viewMode === 'day' && (
        <>
          {/* Day tabs — swipe horizontal = change week */}
          <div className="relative overflow-hidden">
            <AnimatePresence mode="popLayout" custom={swipeDirection} initial={false}>
              <motion.div
                key={dayViewDays[0].toDateString()}
                custom={swipeDirection}
                variants={{
                  enter: (dir: number) => ({ x: dir > 0 ? 300 : -300, opacity: 0 }),
                  center: { x: 0, opacity: 1 },
                  exit: (dir: number) => ({ x: dir > 0 ? -300 : 300, opacity: 0 }),
                }}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ type: 'spring', stiffness: 260, damping: 28 }}
                drag="x"
                dragConstraints={{ left: 0, right: 0 }}
                dragElastic={0.3}
                onDragEnd={(_, info) => {
                  const threshold = 60
                  if (info.offset.x < -threshold) {
                    setSwipeDirection(1)
                    setCurrentDate(d => addDays(d, 7))
                  } else if (info.offset.x > threshold) {
                    setSwipeDirection(-1)
                    setCurrentDate(d => addDays(d, -7))
                  }
                }}
                className="flex gap-1 touch-pan-y cursor-grab active:cursor-grabbing"
              >
                {dayViewDays.map((day, idx) => {
                  const isSelected = isSameDay(day, selectedDay)
                  const today = isToday(day)
                  const count = getClassesForDay(day).length
                  return (
                    <button
                      key={idx}
                      onClick={() => setSelectedDay(day)}
                      className={cn(
                        'flex-1 flex flex-col items-center justify-center min-w-0 py-1 rounded-lg transition-colors select-none',
                        isSelected ? 'bg-foreground text-background' : 'hover:bg-muted/50'
                      )}
                    >
                      <span className="text-[9px] font-medium uppercase tracking-wide opacity-70">
                        {format(day, 'EEE', { locale })}
                      </span>
                      <span className="text-base font-bold leading-none mt-0.5">{format(day, 'd')}</span>
                      <span className={cn(
                        'text-[9px] leading-none mt-0.5',
                        isSelected ? 'opacity-70' : 'text-muted-foreground',
                        count === 0 && 'invisible'
                      )}>
                        {count}
                      </span>
                      {today && (
                        <span className={cn('h-1 w-1 rounded-full mt-0.5', isSelected ? 'bg-background' : 'bg-primary')} />
                      )}
                    </button>
                  )
                })}
              </motion.div>
            </AnimatePresence>
          </div>

          <AnimatePresence mode="wait">
            <motion.div
              key={selectedDay.toDateString()}
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              transition={{ duration: 0.15 }}
            >
              {getClassesForDay(selectedDay).length === 0 ? (
                <EmptyState icon={CalendarDays} message={t('schedule.noClasses')} />
              ) : (
                <div className="grid gap-3 lg:grid-cols-2">
                  {getClassesForDay(selectedDay).map((sc) => (
                    <ClassCard key={sc.id} sc={sc} />
                  ))}
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </>
      )}

      {/* WEEK VIEW - compact grid */}
      {viewMode === 'week' && (
        <div className="grid grid-cols-7 gap-2">
          {weekDays.map((day) => {
            const dayClasses = getClassesForDay(day)
            const today = isToday(day)
            return (
              <div key={day.toISOString()} className="min-w-0">
                <div className={cn(
                  'text-center py-2 rounded-t-lg border-b mb-2',
                  today && 'bg-primary/10 text-primary font-bold'
                )}>
                  <div className="text-xs font-medium capitalize">{format(day, 'EEE', { locale })}</div>
                  <div className="text-lg font-bold">{format(day, 'd')}</div>
                </div>
                <div className="space-y-2">
                  {dayClasses.length === 0 ? (
                    <p className="text-xs text-muted-foreground text-center py-4">—</p>
                  ) : (
                    dayClasses.map(sc => {
                      const startsAt = new Date(sc.starts_at)
                      const isBooked = userBookings.has(sc.id)
                      const spotsUsed = bookingCounts.get(sc.id) ?? 0
                      const isFull = spotsUsed >= sc.max_participants
                      const classColor = sc.class_type?.color || '#3B82F6'
                      const isPast = startsAt < new Date()
                      return (
                        <button
                          key={sc.id}
                          onClick={() => { setSelectedDay(day); setCurrentDate(day); setViewMode('day') }}
                          className={cn(
                            'w-full text-left rounded-lg p-2 border text-xs transition-all hover:shadow-sm',
                            isPast && 'opacity-40',
                            isBooked && !isPast && 'ring-1 ring-primary',
                            isFull && !isBooked && !isPast && 'opacity-60'
                          )}
                          style={{ borderLeftWidth: '3px', borderLeftColor: classColor }}
                        >
                          <div className="font-semibold truncate">{format(startsAt, 'HH:mm')}</div>
                          <div className="truncate text-muted-foreground">{sc.class_type?.name}</div>
                          {sc.floor && <div className="text-muted-foreground/60 truncate">{sc.floor === 'haut' ? '↑' : '↓'}</div>}
                          <div className={cn('mt-0.5', isFull ? 'text-destructive' : '')} style={{ color: isFull ? undefined : classColor }}>
                            {spotsUsed}/{sc.max_participants}
                          </div>
                        </button>
                      )
                    })
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* LIST VIEW */}
      {viewMode === 'list' && (
        <div className="space-y-6">
          <AnimatePresence>
            {classesByDay.length === 0 ? (
              <EmptyState icon={CalendarDays} message={t('schedule.noClasses')} />
            ) : (
              classesByDay.map(({ day, classes: dayClasses }) => (
                <motion.div key={day.toISOString()} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                  <h2 className="text-lg font-bold capitalize mb-3">
                    {format(day, 'EEEE d MMMM', { locale })}
                    {isToday(day) && <span className="text-primary ml-2 text-sm font-normal">({isFr ? "aujourd'hui" : 'today'})</span>}
                  </h2>
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {dayClasses.map((sc) => (
                      <ClassCard key={sc.id} sc={sc} />
                    ))}
                  </div>
                </motion.div>
              ))
            )}
          </AnimatePresence>
        </div>
      )}

      {/* Pas de crédit pour ce cours : proposer l'achat sans quitter le contexte */}
      <NoCreditsDialog
        open={!!noCredits}
        onOpenChange={(open) => { if (!open) setNoCredits(null) }}
        reason={noCredits?.reason ?? 'none'}
        creditTypeId={noCredits?.creditTypeId ?? null}
        creditTypeLabel={noCredits?.creditTypeLabel ?? null}
      />

      {/* Class Detail Dialog (coach/admin) */}
      {isStaff && (
        <>
          <Dialog open={!!detailClass} onOpenChange={(open) => { if (!open) setDetailClass(null) }}>
            <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
              {detailClass && (
                <>
                  <DialogHeader>
                    <DialogTitle>{detailClass.class_type?.name}</DialogTitle>
                    <p className="text-sm text-muted-foreground">
                      {format(new Date(detailClass.starts_at), 'EEEE dd/MM/yyyy HH:mm', { locale })}
                      {detailClass.coach && ` — ${detailClass.coach.display_name}`}
                      {detailClass.floor && ` — ${roomNames[detailClass.floor] || detailClass.floor}`}
                    </p>
                  </DialogHeader>

                  {/* Stats */}
                  <div className="flex items-center gap-3 py-2">
                    <Badge variant="outline">
                      <Users className="h-3 w-3 mr-1" />
                      {detailBookings.length}/{detailClass.max_participants}
                    </Badge>
                    <Badge variant="outline">
                      <Clock className="h-3 w-3 mr-1" />
                      {detailClass.duration_minutes} min
                    </Badge>
                  </div>

                  {/* Participants list */}
                  {detailLoading ? (
                    <LoadingState />
                  ) : detailBookings.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-4 text-center">
                      {isFr ? 'Aucun inscrit' : 'No participants'}
                    </p>
                  ) : (
                    <div className="space-y-2">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                        {isFr ? 'Inscrits' : 'Participants'}
                      </p>
                      {detailBookings.map((booking, idx) => (
                        <div key={booking.id} className="flex items-center justify-between p-2.5 rounded-lg border">
                          <div className="flex items-center gap-2.5">
                            <span className="text-xs font-medium text-muted-foreground w-5">{idx + 1}</span>
                            <div>
                              <p className="text-sm font-medium">{booking.user?.display_name}</p>
                              <p className="text-xs text-muted-foreground">
                                {booking.user?.phone || booking.user?.email}
                              </p>
                            </div>
                          </div>
                          {new Date(detailClass.starts_at) > new Date() && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 text-xs text-destructive hover:text-destructive hover:bg-destructive/10"
                              onClick={(e) => { e.stopPropagation(); handleRemoveBooking(booking) }}
                            >
                              <UserMinus className="h-3.5 w-3.5 mr-1" />
                              {isFr ? 'Retirer' : 'Remove'}
                            </Button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Add member */}
                  {new Date(detailClass.starts_at) > new Date() && detailBookings.length < detailClass.max_participants && (
                    <div className="pt-3 border-t mt-3">
                      {!addMemberOpen ? (
                        <Button
                          variant="outline"
                          className="w-full"
                          onClick={openAddMember}
                        >
                          <UserPlus className="h-4 w-4 mr-2" />
                          {isFr ? 'Ajouter un membre' : 'Add a member'}
                        </Button>
                      ) : (
                        <div className="space-y-3">
                          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                            {isFr ? 'Ajouter un membre' : 'Add a member'}
                          </p>
                          {addMemberLoading ? (
                            <p className="text-sm text-muted-foreground text-center py-2">...</p>
                          ) : eligibleMembers.length === 0 ? (
                            <p className="text-sm text-muted-foreground text-center py-2">
                              {isFr ? 'Aucun membre avec des crédits disponibles' : 'No members with available credits'}
                            </p>
                          ) : (
                            <>
                              <Select value={selectedMemberId} onValueChange={(v) => setSelectedMemberId(v ?? '')}>
                                <SelectTrigger className="h-auto min-h-[2.5rem] whitespace-normal text-left">
                                  <span className="text-sm">
                                    {selectedMemberId
                                      ? (() => {
                                          const m = eligibleMembers.find(m => m.user_id === selectedMemberId)
                                          return m ? `${m.display_name} (${m.unlimited ? (isFr ? 'illimité' : 'unlimited') : `${m.credits} ${isFr ? 'crédits' : 'credits'}`})` : ''
                                        })()
                                      : (isFr ? 'Choisir un membre' : 'Choose a member')}
                                  </span>
                                </SelectTrigger>
                                <SelectContent className="min-w-[350px] max-h-60" sideOffset={4}>
                                  {eligibleMembers.map(m => (
                                    <SelectItem key={m.user_id} value={m.user_id}>
                                      {m.display_name} — {m.unlimited ? (isFr ? 'illimité' : 'unlimited') : `${m.credits} ${isFr ? 'crédit(s)' : 'credit(s)'}`}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <div className="flex gap-2">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="flex-1"
                                  onClick={() => setAddMemberOpen(false)}
                                >
                                  {t('common.cancel')}
                                </Button>
                                <Button
                                  size="sm"
                                  className="flex-1"
                                  onClick={handleAddMember}
                                  disabled={!selectedMemberId || addMemberLoading}
                                >
                                  <UserPlus className="h-3.5 w-3.5 mr-1" />
                                  {isFr ? 'Inscrire' : 'Book'}
                                </Button>
                              </div>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Cancel class button */}
                  {new Date(detailClass.starts_at) > new Date() && !detailClass.is_cancelled && (
                    <div className="pt-3 border-t mt-3">
                      <Button
                        variant="destructive"
                        className="w-full"
                        onClick={() => setCancelClassConfirm(true)}
                      >
                        <Ban className="h-4 w-4 mr-2" />
                        {isFr ? 'Annuler ce cours' : 'Cancel this class'}
                      </Button>
                      <p className="text-[11px] text-muted-foreground text-center mt-2">
                        {isFr
                          ? `${detailBookings.length} membre(s) seront notifié(s) et leurs crédits restitués`
                          : `${detailBookings.length} member(s) will be notified and their credits refunded`}
                      </p>
                    </div>
                  )}
                </>
              )}
            </DialogContent>
          </Dialog>

          <ConfirmDialog
            open={cancelClassConfirm}
            onOpenChange={setCancelClassConfirm}
            title={isFr ? 'Annuler ce cours ?' : 'Cancel this class?'}
            description={isFr
              ? `Tous les inscrits (${detailBookings.length}) seront notifiés et leurs crédits restitués. Cette action est irréversible.`
              : `All participants (${detailBookings.length}) will be notified and their credits refunded. This cannot be undone.`}
            onConfirm={handleCancelClass}
          />
        </>
      )}

      {/* Filter popup */}
      <Dialog open={filterOpen} onOpenChange={setFilterOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{isFr ? 'Filtres' : 'Filters'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                {isFr ? 'Type de cours' : 'Class type'}
              </p>
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant={filterClassType === 'all' ? 'default' : 'outline'}
                  className="rounded-full h-8 text-xs"
                  onClick={() => setFilterClassType('all')}
                >
                  {isFr ? 'Tous' : 'All'}
                </Button>
                {classTypes.map(ct => (
                  <Button
                    key={ct.id}
                    size="sm"
                    variant={filterClassType === ct.id ? 'default' : 'outline'}
                    className="rounded-full h-8 text-xs gap-1.5"
                    onClick={() => setFilterClassType(ct.id)}
                  >
                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: ct.color }} />
                    {ct.name}
                  </Button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                {isFr ? 'Coach' : 'Coach'}
              </p>
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant={filterCoach === 'all' ? 'default' : 'outline'}
                  className="rounded-full h-8 text-xs"
                  onClick={() => setFilterCoach('all')}
                >
                  {isFr ? 'Tous' : 'All'}
                </Button>
                {coaches.map(c => (
                  <Button
                    key={c.id}
                    size="sm"
                    variant={filterCoach === c.id ? 'default' : 'outline'}
                    className="rounded-full h-8 text-xs"
                    onClick={() => setFilterCoach(c.id)}
                  >
                    {c.name}
                  </Button>
                ))}
              </div>
            </div>
          </div>
          <div className="flex gap-2 justify-end pt-2 border-t">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => { setFilterClassType('all'); setFilterCoach('all') }}
            >
              {isFr ? 'Réinitialiser' : 'Reset'}
            </Button>
            <Button size="sm" onClick={() => setFilterOpen(false)}>
              {isFr ? 'Appliquer' : 'Apply'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Detail d'une seance, cote membre.
          Le clic sur la carte menait auparavant vers /my-bookings quand on
          etait inscrit, et nulle part sinon : « Reserver » etait la seule
          action possible sur un cours, sans moyen d'en savoir plus. */}
      <Dialog open={!!detailMembre} onOpenChange={(open) => { if (!open) setDetailMembre(null) }}>
        <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
          {detailMembre && (() => {
            const debut = new Date(detailMembre.starts_at)
            const fin = new Date(debut.getTime() + detailMembre.duration_minutes * 60000)
            const places = bookingCounts.get(detailMembre.id) ?? 0
            return (
              <>
                {detailMembre.class_type?.image_url && (
                  <div className="rounded-lg overflow-hidden -mx-6 -mt-6 mb-4">
                    <img
                      src={urlImage(detailMembre.class_type.image_url)}
                      alt={detailMembre.class_type.name}
                      className="w-full h-40 object-cover"
                    />
                  </div>
                )}

                <DialogHeader>
                  <DialogTitle>{detailMembre.title || detailMembre.class_type?.name}</DialogTitle>
                  <p className="text-sm text-muted-foreground capitalize">
                    {format(debut, 'EEEE d MMMM', { locale })}
                    {' · '}
                    {format(debut, 'HH:mm')}–{format(fin, 'HH:mm')}
                  </p>
                </DialogHeader>

                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline">
                    <Users className="h-3 w-3 mr-1" />
                    {isFr
                      ? `${places}/${detailMembre.max_participants} inscrits`
                      : `${places}/${detailMembre.max_participants} booked`}
                  </Badge>
                  <Badge variant="outline">
                    <Clock className="h-3 w-3 mr-1" />
                    {detailMembre.duration_minutes} min
                  </Badge>
                  {/* Jamais `haut`/`bas` bruts : les membres voient le nom commercial de la salle. */}
                  {detailMembre.floor && (
                    <Badge variant="outline">
                      {roomNames[detailMembre.floor] || detailMembre.floor}
                    </Badge>
                  )}
                </div>

                {detailMembre.coach && (
                  <div className="flex items-center gap-2.5 pt-1">
                    <Avatar className="h-9 w-9">
                      <AvatarImage src={urlImage(detailMembre.coach.avatar_url)} />
                      <AvatarFallback>{detailMembre.coach.display_name?.charAt(0).toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <p className="text-xs text-muted-foreground">{isFr ? 'Coach' : 'Coach'}</p>
                      <p className="text-sm font-medium truncate">{detailMembre.coach.display_name}</p>
                    </div>
                  </div>
                )}

                {detailMembre.class_type?.description_md && (
                  <div className="md-annonce text-sm pt-1">
                    <ReactMarkdown components={{ a: MarkdownLink }}>
                      {detailMembre.class_type.description_md}
                    </ReactMarkdown>
                  </div>
                )}

                {/* Qui a deja reserve — la raison d'etre de cet ecran. */}
                <div className="pt-3 border-t">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                    {isFr ? 'Déjà inscrits' : 'Already booked'}
                  </p>
                  {participantsLoading ? (
                    <LoadingState />
                  ) : participants.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-2">
                      {/* Un cours peut avoir des inscrits sans qu'aucun n'apparaisse :
                          ceux qui se sont retires de la liste depuis leur profil. Le
                          message ne dit donc pas « personne », qui serait faux. */}
                      {places > 0
                        ? (isFr ? 'Aucun inscrit ne souhaite apparaître ici.' : 'No participant wishes to appear here.')
                        : (isFr ? 'Soyez le premier à réserver !' : 'Be the first to book!')}
                    </p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {participants.map(p => (
                        <div
                          key={p.user_id}
                          className={cn(
                            'flex items-center gap-2 pl-1 pr-3 py-1 rounded-full border',
                            p.user_id === user?.id && 'border-primary/50 bg-primary/5'
                          )}
                        >
                          <Avatar className="h-6 w-6">
                            <AvatarImage src={urlImage(p.avatar_url)} />
                            <AvatarFallback className="text-[10px]">
                              {p.prenom?.charAt(0).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <span className="text-sm">
                            {p.user_id === user?.id ? (isFr ? 'Vous' : 'You') : p.prenom}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Agir sans repasser par la carte : sans ce pied, le dialogue
                    serait un cul-de-sac — il faudrait le fermer pour reserver
                    le cours qu'on vient d'y consulter. Les memes conditions que
                    la carte, dans le meme ordre. */}
                <div className="pt-3 border-t">
                  {(() => {
                    const dejaInscrit = userBookings.has(detailMembre.id)
                    const attente = userWaitlist.get(detailMembre.id)
                    const complet = places >= detailMembre.max_participants
                    const ferme = isBookingClosed(detailMembre, places, bookingRules)
                    const enCours = bookingInProgress === detailMembre.id

                    if (dejaInscrit) return (
                      <Button variant="outline" className="w-full"
                        onClick={() => { setDetailMembre(null); navigate('/my-bookings') }}>
                        <Check className="h-4 w-4 mr-2" />
                        {isFr ? 'Vous êtes inscrit(e) — voir ma réservation' : "You're booked — see my booking"}
                      </Button>
                    )
                    if (attente?.status === 'offered') return (
                      <Button className="w-full bg-orange-500 hover:bg-orange-600 text-white"
                        onClick={() => { setDetailMembre(null); handleConfirmWaitlistSpot(detailMembre.id) }} disabled={enCours}>
                        {enCours ? '...' : t('schedule.confirmSpot')}
                      </Button>
                    )
                    if (attente) return (
                      <p className="text-sm text-muted-foreground text-center flex items-center justify-center gap-1.5">
                        <Clock3 className="h-3.5 w-3.5" />
                        {t('schedule.onWaitlist', { position: attente.position })}
                      </p>
                    )
                    if (ferme) return (
                      <p className="text-sm text-muted-foreground text-center flex items-center justify-center gap-1.5">
                        <Lock className="h-3.5 w-3.5" />
                        {isFr ? 'Réservations fermées' : 'Bookings closed'}
                      </p>
                    )
                    if (complet) return (
                      <Button variant="outline" className="w-full border-primary/50 text-primary hover:bg-primary/10"
                        onClick={() => { setDetailMembre(null); handleJoinWaitlist(detailMembre.id) }} disabled={enCours}>
                        {enCours ? '...' : (isFr ? "Rejoindre la liste d'attente" : 'Join waitlist')}
                      </Button>
                    )
                    if (canUseTrial) return (
                      <Button className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
                        onClick={() => { setDetailMembre(null); handleTrialBooking(detailMembre.id) }} disabled={enCours}>
                        {enCours ? '...' : (isFr ? 'Essai gratuit' : 'Free trial')}
                      </Button>
                    )
                    return (
                      <Button className="w-full bg-foreground hover:bg-foreground/90 text-background font-bold uppercase tracking-wide"
                        onClick={() => handleBook(detailMembre.id)} disabled={enCours}>
                        {enCours ? '...' : (isFr ? 'Réserver' : 'Book')}
                      </Button>
                    )
                  })()}
                </div>
              </>
            )
          })()}
        </DialogContent>
      </Dialog>

      {/* Class type info popup */}
      <Dialog open={!!infoClassType} onOpenChange={(open) => { if (!open) setInfoClassType(null) }}>
        <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
          {infoClassType && (
            <>
              {infoClassType.image_url && (
                <div className="rounded-lg overflow-hidden -mx-6 -mt-6 mb-4">
                  <img src={urlImage(infoClassType.image_url)} alt={infoClassType.name} className="w-full h-48 object-cover" />
                </div>
              )}
              <DialogHeader>
                <DialogTitle>{infoClassType.name}</DialogTitle>
              </DialogHeader>
              {infoClassType.description_md && (
                <div className="md-annonce text-sm">
                  <ReactMarkdown components={{ a: MarkdownLink }}>{infoClassType.description_md}</ReactMarkdown>
                </div>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Confirmation de réservation.
          Ouverte à chaque clic sur Réserver : elle rappelle le cours, et quand
          le membre dispose de plusieurs sources, lui laisse choisir laquelle
          consommer (un abonné qui invite quelqu'un prend un crédit de pack). */}
      <Dialog
        open={!!bookingConfirm}
        onOpenChange={(open) => { if (!open) setBookingConfirm(null) }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{isFr ? 'Confirmer la réservation' : 'Confirm booking'}</DialogTitle>
          </DialogHeader>

          {bookingConfirm && (
            <div className="space-y-4">
              {/* Rappel du cours */}
              <div className="rounded-lg border p-3">
                <p className="font-semibold">
                  {bookingConfirm.sc.title || bookingConfirm.sc.class_type?.name}
                </p>
                <p className="text-sm text-muted-foreground mt-0.5">
                  {format(new Date(bookingConfirm.sc.starts_at), "EEEE d MMMM 'à' HH:mm", { locale })}
                  {' · '}{bookingConfirm.sc.duration_minutes} min
                </p>
                {bookingConfirm.sc.coach?.display_name && (
                  <p className="text-sm text-muted-foreground">
                    {isFr ? 'avec ' : 'with '}{bookingConfirm.sc.coach.display_name}
                  </p>
                )}
              </div>

              {/* Source de paiement */}
              {bookingConfirm.sources.length === 1 ? (
                <p className="text-sm text-muted-foreground">
                  {isFr ? 'Séance décomptée de ' : 'Session taken from '}
                  <span className="font-medium text-foreground">
                    {bookingConfirm.sources[0].pack_name}
                  </span>
                  {bookingConfirm.sources[0].is_unlimited
                    ? (isFr ? ' (illimité)' : ' (unlimited)')
                    : (isFr
                        ? ` — il te restera ${bookingConfirm.sources[0].credits_remaining - 1} crédit${bookingConfirm.sources[0].credits_remaining - 1 > 1 ? 's' : ''}`
                        : ` — ${bookingConfirm.sources[0].credits_remaining - 1} credit(s) left`)}
                </p>
              ) : (
                <div className="space-y-2">
                  <p className="text-sm font-medium">
                    {isFr ? 'Réserver avec' : 'Book using'}
                  </p>
                  {bookingConfirm.sources.map((c) => {
                    const selected = selectedSourceId === c.pack_purchase_id
                    return (
                      <button
                        key={c.pack_purchase_id}
                        type="button"
                        onClick={() => setSelectedSourceId(c.pack_purchase_id)}
                        className={cn(
                          'w-full text-left rounded-lg border p-3 transition',
                          selected
                            ? 'border-primary ring-1 ring-primary/30 bg-primary/5'
                            : 'hover:border-muted-foreground/40',
                        )}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="min-w-0">
                            <p className="font-medium truncate">
                              {c.pack_name}
                              {c.is_subscription && (
                                <Badge variant="secondary" className="ml-2 text-[10px]">
                                  {isFr ? 'Abonnement' : 'Subscription'}
                                </Badge>
                              )}
                            </p>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {c.is_unlimited
                                ? (isFr ? 'Illimité' : 'Unlimited')
                                : (isFr
                                    ? `${c.credits_remaining} crédit${c.credits_remaining > 1 ? 's' : ''} restant${c.credits_remaining > 1 ? 's' : ''}`
                                    : `${c.credits_remaining} credit${c.credits_remaining > 1 ? 's' : ''} left`)}
                              {' · '}
                              {isFr ? "jusqu'au " : 'until '}
                              {format(new Date(c.expires_at), 'dd/MM/yyyy')}
                            </p>
                          </div>
                          {selected && <Check className="h-4 w-4 text-primary shrink-0" />}
                        </div>
                      </button>
                    )
                  })}
                </div>
              )}

              <div className="flex justify-end gap-2 pt-1">
                <Button variant="outline" onClick={() => setBookingConfirm(null)}>
                  {t('common.cancel')}
                </Button>
                <Button
                  disabled={!selectedSourceId || bookingInProgress === bookingConfirm.sc.id}
                  onClick={() => confirmBooking(bookingConfirm.sc.id, selectedSourceId)}
                >
                  {bookingInProgress === bookingConfirm.sc.id
                    ? (isFr ? 'Réservation…' : 'Booking…')
                    : (isFr ? 'Je réserve' : 'Book')}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

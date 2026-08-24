import { useEffect, useState, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { supabase } from '@/lib/supabase'
import { logActivity } from '@/lib/activity-log'
import { useAuth } from '@/contexts/AuthContext'
import type { ScheduledClass, ClassType, Profile } from '@/types'
import { LoadingState } from '@/components/common/LoadingState'
import { EmptyState } from '@/components/common/EmptyState'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger,
} from '@/components/ui/select'
import { toast } from 'sonner'
import { sendEmail } from '@/lib/send-email'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { CalendarDays, Pencil, Plus, Trash2, Users, UserCog, Eye, Copy, ChevronLeft, ChevronRight, AlertTriangle} from 'lucide-react'
import { format } from 'date-fns'
import { fr, enUS } from 'date-fns/locale'
import { cn, getClassStatus, classStatusLabel } from '@/lib/utils'
import { analyserConflits, type AnalyseConflits, type Conflit } from '@/lib/conflits-planning'

interface ScheduleForm {
  class_type_id: string
  coach_id: string
  date: string
  time: string
  max_participants: number
  duration_minutes: number
  title: string
  description: string
  repeat_weeks: number
  floor: string
}

const DEFAULT_FLOOR_NAMES: Record<string, string> = {
  bas: 'Back On Track Studio',
  haut: 'Back On Track Upstairs',
}

const emptyForm: ScheduleForm = {
  class_type_id: '',
  coach_id: '',
  date: format(new Date(), 'yyyy-MM-dd'),
  time: '10:00',
  max_participants: 4,
  duration_minutes: 60,
  title: '',
  description: '',
  repeat_weeks: 0,
  floor: 'bas',
}

export function AdminSchedulePage() {
  const { t, i18n } = useTranslation()
  const { user: currentUser } = useAuth()
  const navigate = useNavigate()
  const locale = i18n.language === 'fr' ? fr : enUS
  const isFr = i18n.language === 'fr'
  const [classes, setClasses] = useState<ScheduledClass[]>([])
  /** Places occupées par cours : confirmées, plus les désistements tardifs
      dont le crédit a été consommé. */
  const [bookingCounts, setBookingCounts] = useState<Map<string, number>>(new Map())
  /** Présences pointées par cours : distingue un cours établi d'un cours supposé. */
  const [attendedCounts, setAttendedCounts] = useState<Map<string, number>>(new Map())
  /** Absents pointés : un cours tout en absences reste un cours donné. */
  const [noShowCounts, setNoShowCounts] = useState<Map<string, number>>(new Map())
  /** Minimum d'inscrits pour qu'un cours compte comme donné (Réglages). */
  const [minParticipants, setMinParticipants] = useState(1)
  const [classTypes, setClassTypes] = useState<ClassType[]>([])
  const [coaches, setCoaches] = useState<Profile[]>([])
  const [floorNames, setFloorNames] = useState<Record<string, string>>(DEFAULT_FLOOR_NAMES)
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<ScheduledClass | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<ScheduledClass | null>(null)
  const [form, setForm] = useState<ScheduleForm>(emptyForm)

  // Filters
  /**
   * Période affichée, conservée dans l'URL.
   *
   * Sans cela, ouvrir un cours puis revenir ramenait à la semaine courante :
   * le composant se recrée et perd son état. Dans l'URL, la période survit à
   * l'aller-retour — et le bouton « précédent » du navigateur fonctionne.
   */
  const [searchParams, setSearchParams] = useSearchParams()
  const filterDateFrom = searchParams.get('from') ?? format(new Date(), 'yyyy-MM-dd')
  const filterDateTo = searchParams.get('to') ?? ''

  const setPeriod = (from: string, to: string) => {
    const next = new URLSearchParams(searchParams)
    if (from) next.set('from', from); else next.delete('from')
    if (to) next.set('to', to); else next.delete('to')
    setSearchParams(next, { replace: true })
  }

  const setFilterDateFrom = (v: string) => setPeriod(v, filterDateTo)
  const setFilterDateTo = (v: string) => setPeriod(filterDateFrom, v)

  /**
   * Décale la période d'une longueur équivalente.
   * Sans date de fin, on se déplace d'une semaine — c'est la maille de
   * lecture habituelle d'un planning.
   */
  const shiftPeriod = (direction: -1 | 1) => {
    const from = new Date(filterDateFrom + 'T12:00:00')
    if (!filterDateTo) {
      const moved = new Date(from.getTime() + direction * 7 * 86400000)
      setPeriod(format(moved, 'yyyy-MM-dd'), '')
      return
    }
    const to = new Date(filterDateTo + 'T12:00:00')
    // +1 jour : du 1er au 7 fait 7 jours, pas 6.
    const span = to.getTime() - from.getTime() + 86400000
    setPeriod(
      format(new Date(from.getTime() + direction * span), 'yyyy-MM-dd'),
      format(new Date(to.getTime() + direction * span), 'yyyy-MM-dd'),
    )
  }
  const [filterCoach, setFilterCoach] = useState('all')
  const [filterClassType, setFilterClassType] = useState('all')

  // Bulk selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [bulkAction, setBulkAction] = useState<'coach' | 'max' | 'duplicate' | null>(null)
  const [bulkCoachId, setBulkCoachId] = useState('')
  const [bulkMaxParticipants, setBulkMaxParticipants] = useState(4)
  const [bulkDuplicateDays, setBulkDuplicateDays] = useState(7)
  const [bulkSaving, setBulkSaving] = useState(false)
  /**
   * Conflits à valider avant d'écrire. Non nul = le dialogue est ouvert.
   *
   * La duplication écrivait puis annonçait « 2 ignorés » : l'admin découvrait
   * après coup, sans savoir lesquels ni pouvoir revenir en arrière.
   */
  const [conflitsAValider, setConflitsAValider] = useState<{
    analyse: AnalyseConflits
    lignes: Record<string, unknown>[]
    dayOffset: number
  } | null>(null)

  const fetchData = async () => {
    // On ne charge que la période affichée. La page tirait auparavant TOUS les
    // cours de la base, puis toutes leurs réservations, avant de filtrer côté
    // navigateur : le temps d'attente grandissait avec l'historique.
    //
    // Marge d'un mois de part et d'autre : les flèches de navigation restent
    // fluides sans recharger à chaque clic.
    const rangeFrom = new Date((filterDateFrom || format(new Date(), 'yyyy-MM-dd')) + 'T00:00:00')
    rangeFrom.setMonth(rangeFrom.getMonth() - 1)
    const rangeTo = new Date((filterDateTo || filterDateFrom || format(new Date(), 'yyyy-MM-dd')) + 'T23:59:59')
    rangeTo.setMonth(rangeTo.getMonth() + 2)

    const [classRes, typeRes, coachRes, roomRes, givenRuleRes] = await Promise.all([
      supabase
        .from('scheduled_classes')
        .select('*, class_type:class_types(*)')
        .gte('starts_at', rangeFrom.toISOString())
        .lte('starts_at', rangeTo.toISOString())
        .order('starts_at', { ascending: true }),
      supabase.from('class_types').select('*').eq('is_active', true).order('name'),
      // Vue SQL qui bypass les RLS circulaires sur user_roles
      supabase.from('coach_profiles').select('*').order('display_name'),
      supabase.from('app_settings').select('value').eq('key', 'room_names').single(),
      supabase.from('app_settings').select('value').eq('key', 'class_given_rule').maybeSingle(),
    ])

    const rawClasses = (classRes.data as ScheduledClass[]) ?? []
    setClassTypes((typeRes.data as ClassType[]) ?? [])
    if (roomRes.data?.value) {
      setFloorNames(prev => ({ ...prev, ...(roomRes.data.value as Record<string, string>) }))
    }

    const coachList = (coachRes.data as Profile[]) ?? []
    setCoaches(coachList)
    const coachMap = new Map(coachList.map(c => [c.id, c]))

    // Attach coach to each class (peut aussi être un ancien coach pas dans la vue)
    if (rawClasses.length > 0) {
      const missingCoachIds = [...new Set(rawClasses.map(sc => sc.coach_id).filter(id => id && !coachMap.has(id)))]
      if (missingCoachIds.length > 0) {
        const { data: extraProfiles } = await supabase.from('profiles').select('*').in('id', missingCoachIds)
        for (const p of extraProfiles ?? []) coachMap.set(p.id, p as Profile)
      }
      for (const sc of rawClasses) {
        if (sc.coach_id) sc.coach = coachMap.get(sc.coach_id) as Profile
      }

      // Places occupées, en une requête pour tout le planning. Une annulation
      // tardive compte : le crédit a été consommé, la place était prise.
      const { data: bookingRows } = await supabase
        .from('bookings')
        .select('scheduled_class_id, status, is_no_show, checked_in_at')
        .in('scheduled_class_id', rawClasses.map(c => c.id))

      const counts = new Map<string, number>()
      const attended = new Map<string, number>()
      const noShows = new Map<string, number>()
      for (const b of (bookingRows ?? []) as {
        scheduled_class_id: string; status: string; is_no_show: boolean; checked_in_at: string | null
      }[]) {
        if (b.checked_in_at) {
          attended.set(b.scheduled_class_id, (attended.get(b.scheduled_class_id) ?? 0) + 1)
        }
        if (b.status !== 'confirmed' && !b.is_no_show) continue
        counts.set(b.scheduled_class_id, (counts.get(b.scheduled_class_id) ?? 0) + 1)
        if (b.is_no_show) {
          noShows.set(b.scheduled_class_id, (noShows.get(b.scheduled_class_id) ?? 0) + 1)
        }
      }
      setBookingCounts(counts)
      setAttendedCounts(attended)
      setNoShowCounts(noShows)
    }

    setMinParticipants(
      (givenRuleRes.data?.value as { min_participants?: number } | undefined)?.min_participants ?? 1,
    )

    setClasses(rawClasses)
    setSelectedIds(new Set())
    setLoading(false)
  }

  // Recharge quand la période change : la marge d'un mois absorbe les clics
  // de flèche, mais un saut plus lointain sort de la fenêtre chargée.
  useEffect(() => { fetchData() }, [filterDateFrom, filterDateTo])

  // Filtered classes
  const filteredClasses = useMemo(() => {
    return classes.filter(sc => {
      const dt = new Date(sc.starts_at)
      if (filterDateFrom && dt < new Date(filterDateFrom + 'T00:00:00')) return false
      if (filterDateTo && dt > new Date(filterDateTo + 'T23:59:59')) return false
      if (filterCoach !== 'all' && sc.coach_id !== filterCoach) return false
      if (filterClassType !== 'all' && sc.class_type_id !== filterClassType) return false
      return true
    })
  }, [classes, filterDateFrom, filterDateTo, filterCoach, filterClassType])

  const allSelected = filteredClasses.length > 0 && filteredClasses.every(sc => selectedIds.has(sc.id))

  const toggleAll = () => {
    if (allSelected) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(filteredClasses.map(sc => sc.id)))
    }
  }

  const toggleOne = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  // CRUD
  const openAdd = () => { setEditing(null); setForm(emptyForm); setDialogOpen(true) }

  const openEdit = (sc: ScheduledClass) => {
    const dt = new Date(sc.starts_at)
    setEditing(sc)
    setForm({
      class_type_id: sc.class_type_id,
      coach_id: sc.coach_id ?? '',
      date: format(dt, 'yyyy-MM-dd'),
      time: format(dt, 'HH:mm'),
      max_participants: sc.max_participants,
      duration_minutes: sc.duration_minutes,
      title: sc.title ?? '',
      description: sc.description ?? '',
      repeat_weeks: 0,
      floor: sc.floor ?? 'bas',
    })
    setDialogOpen(true)
  }

  /**
   * Changements « lourds » : ils transforment la prestation, pas seulement
   * ses modalités. Quelqu'un inscrit à un Pilates du mardi matin n'a pas
   * demandé un autre cours ni un autre créneau.
   */
  const pendingHeavyChange = (() => {
    if (!editing || !form.date || !form.time) return null
    const newStarts = new Date(`${form.date}T${form.time}`)
    const oldStarts = new Date(editing.starts_at)
    const timeChanged = oldStarts.getTime() !== newStarts.getTime()
    const typeChanged = editing.class_type_id !== form.class_type_id
    if (!timeChanged && !typeChanged) return null
    return {
      timeChanged,
      typeChanged,
      booked: bookingCounts.get(editing.id) ?? 0,
    }
  })()

  const handleSave = async () => {
    const baseDate = new Date(`${form.date}T${form.time}`)
    const basePayload = {
      class_type_id: form.class_type_id,
      coach_id: form.coach_id || null,
      max_participants: form.max_participants,
      duration_minutes: form.duration_minutes,
      title: form.title || null,
      description: form.description || null,
      floor: form.floor || null,
    }

    if (editing) {
      // Detect significant changes worth emailing enrolled members about
      const oldStarts = new Date(editing.starts_at)
      const newStarts = baseDate
      const startsChanged = oldStarts.getTime() !== newStarts.getTime()
      const floorChanged = (editing.floor ?? null) !== (basePayload.floor ?? null)
      const coachChanged = (editing.coach_id ?? null) !== (basePayload.coach_id ?? null)
      const durationChanged = editing.duration_minutes !== basePayload.duration_minutes
      const significantChange = startsChanged || floorChanged || coachChanged || durationChanged

      const { error } = await supabase.from('scheduled_classes').update({
        ...basePayload,
        starts_at: newStarts.toISOString(),
      }).eq('id', editing.id)
      if (error) { toast.error(t('common.error')); return }

      // Email enrolled members if something significant changed
      if (significantChange) {
        const { data: affectedBookings } = await supabase
          .from('bookings')
          .select('user_id')
          .eq('scheduled_class_id', editing.id)
          .eq('status', 'confirmed')

        const userIds = [...new Set((affectedBookings ?? []).map(b => b.user_id))]
        if (userIds.length > 0) {
          const { data: memberProfiles } = await supabase
            .from('profiles')
            .select('id, display_name, email')
            .in('id', userIds)

          const newCoachName = coaches.find(c => c.id === basePayload.coach_id)?.display_name
          const newRoomName = basePayload.floor ? (floorNames[basePayload.floor] || basePayload.floor) : undefined
          const className = basePayload.title || classTypes.find(c => c.id === basePayload.class_type_id)?.name

          // Nommer ce qui a changé. Le code le sait déjà — il ne le disait
          // simplement pas, et le membre recevait un bloc d'informations sans
          // savoir ce qui n'était plus comme avant.
          const isFr = i18n.language === 'fr'
          const heavyChange = startsChanged || editing.class_type_id !== basePayload.class_type_id
          const changes: string[] = []
          if (startsChanged) changes.push(isFr ? 'nouvel horaire' : 'new time')
          if (coachChanged) {
            changes.push(newCoachName
              ? (isFr ? `changement de coach (${newCoachName})` : `coach changed (${newCoachName})`)
              : (isFr ? 'coach retiré' : 'coach removed'))
          }
          if (floorChanged) {
            changes.push(newRoomName
              ? (isFr ? `changement de salle (${newRoomName})` : `room changed (${newRoomName})`)
              : (isFr ? 'changement de salle' : 'room changed'))
          }
          if (durationChanged) {
            changes.push(isFr
              ? `durée : ${basePayload.duration_minutes} min`
              : `duration: ${basePayload.duration_minutes} min`)
          }

          for (const p of memberProfiles ?? []) {
            if (!p.email) continue
            sendEmail('class_modified', p.email, {
              user_name: p.display_name,
              class_name: className,
              class_date: format(newStarts, "EEEE dd MMMM 'à' HH:mm", { locale: fr }),
              old_class_date: startsChanged ? format(oldStarts, "EEEE dd MMMM 'à' HH:mm", { locale: fr }) : undefined,
              coach_name: newCoachName,
              room_name: newRoomName,
              duration_minutes: basePayload.duration_minutes,
              changes,
              // Horaire ou type modifié : la prestation change, l'e-mail
              // propose alors explicitement de renoncer avec restitution.
              heavy_change: startsChanged || editing.class_type_id !== basePayload.class_type_id,
            })
          }

          // Notification dans l'application : elle n'existait pas, seul
          // l'e-mail partait. Un membre qui ne lit pas ses mails ne savait rien.
          await supabase.from('notifications').insert(
            userIds.map(uid => ({
              user_id: uid,
              title: isFr ? 'Cours modifié' : 'Class modified',
              message: isFr
                ? `${className} du ${format(newStarts, 'EEEE dd/MM à HH:mm', { locale })} — ${changes.join(', ')}.${heavyChange ? ' Si ce créneau ne te convient plus, tu peux annuler : ton crédit te sera rendu.' : ''}`
                : `${className} on ${format(newStarts, 'EEEE dd/MM HH:mm', { locale })} — ${changes.join(', ')}.${heavyChange ? ' If this no longer suits you, you can cancel: your credit will be refunded.' : ''}`,
              type: 'info',
              link: '/my-bookings',
            })),
          )
        }
      }
    } else {
      // Build candidate rows
      const candidates = []
      for (let w = 0; w <= form.repeat_weeks; w++) {
        const d = new Date(baseDate)
        d.setDate(d.getDate() + w * 7)
        d.setSeconds(0, 0)
        candidates.push({ ...basePayload, starts_at: d.toISOString() })
      }

      // Check for existing classes at those times + same floor (minute precision)
      const minDate = candidates[0].starts_at
      const maxDate = candidates[candidates.length - 1].starts_at
      const { data: existing } = await supabase
        .from('scheduled_classes')
        .select('starts_at, floor')
        .gte('starts_at', minDate)
        .lte('starts_at', maxDate)
        .eq('is_cancelled', false)

      const toMinuteKey = (iso: string, floor: string | null) => iso.slice(0, 16) + '|' + (floor ?? '')
      const existingKeys = new Set((existing ?? []).map(e => toMinuteKey(e.starts_at, e.floor)))
      const rows = candidates.filter(c => !existingKeys.has(toMinuteKey(c.starts_at, c.floor)))
      const skipped = candidates.length - rows.length

      if (rows.length === 0) {
        toast.error(isFr
          ? 'Aucun cours créé — tous les créneaux sont déjà occupés'
          : 'No classes created — all slots already taken')
        setBulkSaving(false)
        return
      }

      const { error } = await supabase.from('scheduled_classes').insert(rows)
      if (error) { toast.error(t('common.error')); return }

      if (skipped > 0) {
        toast.warning(isFr
          ? `${rows.length} cours créés, ${skipped} ignoré(s) (créneau déjà occupé)`
          : `${rows.length} created, ${skipped} skipped (slot already taken)`)
      } else if (form.repeat_weeks > 0) {
        toast.success(isFr
          ? `${rows.length} cours créés (${form.repeat_weeks} semaines de répétition)`
          : `${rows.length} classes created (${form.repeat_weeks} weeks repeated)`)
      }
    }
    toast.success(t('common.saveSuccess'))
    setDialogOpen(false)
    fetchData()
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    const { error } = await supabase.from('scheduled_classes').delete().eq('id', deleteTarget.id)
    if (error) { toast.error(t('common.error')); return }
    toast.success(t('common.deleteSuccess'))
    setDeleteTarget(null)
    fetchData()
  }

  // Bulk actions
  const handleBulkApply = async () => {
    if (selectedIds.size === 0) return
    setBulkSaving(true)
    const ids = [...selectedIds]

    // Build human-readable list of affected classes
    const affectedClasses = filteredClasses
      .filter(sc => ids.includes(sc.id))
      .map(sc => `${sc.title || sc.class_type?.name} ${format(new Date(sc.starts_at), 'EEE dd/MM HH:mm', { locale })}`)

    if (bulkAction === 'coach' && bulkCoachId) {
      const { error } = await supabase
        .from('scheduled_classes')
        .update({ coach_id: bulkCoachId })
        .in('id', ids)
      if (error) { toast.error(error.message); setBulkSaving(false); return }

      const coachName = coaches.find(c => c.id === bulkCoachId)?.display_name ?? ''
      await logActivity({
        action: 'role_changed',
        actor_id: currentUser?.id ?? null,
        target_user_id: bulkCoachId,
        entity_type: 'scheduled_class',
        details: { scheduled_class_ids: ids, coach_name: coachName, classes: affectedClasses },
        description: `Coach ${coachName} assigné à ${ids.length} cours : ${affectedClasses.join(' | ')}`,
      })

      toast.success(`Coach ${coachName} assigné à ${ids.length} cours`)
    }

    if (bulkAction === 'max') {
      const { error } = await supabase
        .from('scheduled_classes')
        .update({ max_participants: bulkMaxParticipants })
        .in('id', ids)
      if (error) { toast.error(error.message); setBulkSaving(false); return }

      await logActivity({
        action: 'pack_modified',
        actor_id: currentUser?.id ?? null,
        target_user_id: currentUser?.id ?? '',
        entity_type: 'scheduled_class',
        details: { scheduled_class_ids: ids, max_participants: bulkMaxParticipants, classes: affectedClasses },
        description: `Max participants → ${bulkMaxParticipants} pour ${ids.length} cours : ${affectedClasses.join(' | ')}`,
      })

      toast.success(`Max participants changé à ${bulkMaxParticipants} pour ${ids.length} cours`)
    }

    if (bulkAction === 'duplicate') {
      const selectedClasses = classes.filter(sc => ids.includes(sc.id))

      const dayOffset = bulkDuplicateDays
      if (!Number.isInteger(dayOffset) || dayOffset < 1) {
        toast.error(isFr ? 'Nombre de jours invalide (min. 1)' : 'Invalid number of days (min. 1)')
        setBulkSaving(false); return
      }

      // Build candidate rows, en décalant chaque cours du même nombre de jours
      const candidates = selectedClasses.map(sc => {
        const nextWeek = new Date(sc.starts_at)
        nextWeek.setDate(nextWeek.getDate() + dayOffset)
        // Truncate to minute precision to avoid millisecond mismatch
        nextWeek.setSeconds(0, 0)
        return {
          class_type_id: sc.class_type_id,
          coach_id: sc.coach_id || null,
          starts_at: nextWeek.toISOString(),
          max_participants: sc.max_participants,
          duration_minutes: sc.duration_minutes,
          title: sc.title || null,
          description: sc.description || null,
          floor: sc.floor || null,
          _original_name: sc.class_type?.name || sc.title || '',
        }
      })

      // Check for existing classes in the target week range
      const targetDates = candidates.map(c => c.starts_at)
      const minDate = targetDates.reduce((a, b) => a < b ? a : b)
      const maxDate = targetDates.reduce((a, b) => a > b ? a : b)

      const { data: existing } = await supabase
        .from('scheduled_classes')
        .select('starts_at, floor, coach_id')
        .gte('starts_at', minDate)
        .lte('starts_at', maxDate)
        .eq('is_cancelled', false)

      const analyse = analyserConflits(
        candidates.map(c => ({
          starts_at: c.starts_at,
          floor: c.floor,
          coach_id: c.coach_id,
          libelle: c._original_name,
        })),
        (existing ?? []) as { starts_at: string; floor: string | null; coach_id: string | null }[],
      )

      // Remove internal field before insert
      // `_original_name` sert à l'aperçu écran ; la colonne n'existe pas en
      // base. On l'écarte par destructuration — d'où une variable déclarée
      // mais jamais lue, qui est ici tout l'intérêt de la ligne.
      const retenus = new Set(analyse.aCreer.map(c => c.starts_at + '|' + (c.floor ?? '')))
      const rows = candidates
        .filter(c => retenus.has(c.starts_at + '|' + (c.floor ?? '')))
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        .map(({ _original_name, ...row }) => row)

      // Rien à signaler : dupliquer sans rien demander, l'admin a déjà cliqué.
      if (analyse.bloques.length === 0 && analyse.avertissements.length === 0) {
        const { error } = await supabase.from('scheduled_classes').insert(rows)
        if (error) { toast.error(error.message); setBulkSaving(false); return }
        toast.success(isFr
          ? `${rows.length} cours dupliqués (+${dayOffset} jour${dayOffset > 1 ? 's' : ''})`
          : `${rows.length} classes duplicated (+${dayOffset} day${dayOffset > 1 ? 's' : ''})`)
      } else {
        // Sinon : montrer ce qui coince AVANT d'écrire, et laisser renoncer.
        setConflitsAValider({ analyse, lignes: rows, dayOffset })
        setBulkSaving(false)
        return
      }
    }

    setBulkSaving(false)
    setBulkAction(null)
    setSelectedIds(new Set())
    setBulkDuplicateDays(7)
    await fetchData()
  }

  /** Écrit les duplications que l'admin vient de confirmer malgré les conflits. */
  const confirmerDuplication = async () => {
    if (!conflitsAValider) return
    const { lignes, analyse, dayOffset } = conflitsAValider
    setBulkSaving(true)

    if (lignes.length > 0) {
      const { error } = await supabase.from('scheduled_classes').insert(lignes)
      if (error) {
        toast.error(error.message)
        setBulkSaving(false)
        return
      }
      toast.success(analyse.bloques.length > 0
        ? (isFr
          ? `${lignes.length} cours dupliqués, ${analyse.bloques.length} ignoré(s)`
          : `${lignes.length} duplicated, ${analyse.bloques.length} skipped`)
        : (isFr
          ? `${lignes.length} cours dupliqués (+${dayOffset} jour${dayOffset > 1 ? 's' : ''})`
          : `${lignes.length} classes duplicated (+${dayOffset} day${dayOffset > 1 ? 's' : ''})`))
    } else {
      toast.error(isFr
        ? 'Aucun cours dupliqué — tous les créneaux sont déjà occupés'
        : 'No classes duplicated — all slots already taken')
    }

    setConflitsAValider(null)
    setBulkSaving(false)
    setBulkAction(null)
    setSelectedIds(new Set())
    setBulkDuplicateDays(7)
    await fetchData()
  }

  /** « CrossTraining — lundi 31/08 18h30, salle du bas ». */
  const decrireConflit = (c: Conflit) => {
    const d = new Date(c.candidat.starts_at)
    const quand = format(d, 'EEEE dd/MM HH:mm', { locale })
    const salle = c.candidat.floor ? (floorNames[c.candidat.floor] || c.candidat.floor) : null
    return [c.candidat.libelle, quand, salle].filter(Boolean).join(' — ')
  }

  if (loading) return <LoadingState />

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t('admin.schedule.title')}</h1>
        <Button onClick={openAdd}>
          <Plus className="h-4 w-4 mr-2" />
          {t('admin.schedule.add')}
        </Button>
      </div>

      {/* Filtres.
          Les champs portent un libellé au-dessus, les boutons non : alignés
          tous ensemble par le bas, les libellés flottaient au-dessus du reste
          et la barre paraissait avoir une ligne en trop. Chaque champ forme
          donc sa propre colonne, et les boutons de période sont poussés à la
          hauteur des champs par une cale invisible. */}
      <div className="flex flex-wrap items-end gap-x-3 gap-y-4 p-3 rounded-lg border bg-muted/30">
        {/* Navigation de période : les flèches encadrent les deux dates, elles
            forment un seul geste et ne doivent pas être séparées par un retour
            à la ligne. */}
        <div className="flex items-end gap-2">
          {/* Flèches : décalent la période d'une longueur équivalente. Sans date
              de fin, on avance d'une semaine. */}
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8 shrink-0"
            onClick={() => shiftPeriod(-1)}
            title={i18n.language === 'fr' ? 'Période précédente' : 'Previous period'}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>

          <div className="flex flex-col gap-1">
            <Label className="text-xs text-muted-foreground">{i18n.language === 'fr' ? 'Du' : 'From'}</Label>
            <Input type="date" className="h-8 text-xs w-36" value={filterDateFrom} onChange={(e) => setFilterDateFrom(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1">
            <Label className="text-xs text-muted-foreground">{i18n.language === 'fr' ? 'Au' : 'To'}</Label>
            <Input type="date" className="h-8 text-xs w-36" value={filterDateTo} onChange={(e) => setFilterDateTo(e.target.value)} />
          </div>

          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8 shrink-0"
            onClick={() => shiftPeriod(1)}
            title={i18n.language === 'fr' ? 'Période suivante' : 'Next period'}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>

          <Button
            variant="ghost"
            size="sm"
            className="h-8 text-xs shrink-0"
            onClick={() => setPeriod(format(new Date(), 'yyyy-MM-dd'), '')}
          >
            {i18n.language === 'fr' ? "Aujourd'hui" : 'Today'}
          </Button>
        </div>

        <div className="flex flex-col gap-1">
          <Label className="text-xs text-muted-foreground">{t('admin.schedule.coach')}</Label>
          <Select value={filterCoach} onValueChange={(v) => setFilterCoach(v ?? 'all')}>
            <SelectTrigger className="h-8 text-xs w-40">
              <span>{filterCoach === 'all' ? t('common.all') : coaches.find(c => c.id === filterCoach)?.display_name}</span>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('common.all')}</SelectItem>
              {coaches.map(c => (
                <SelectItem key={c.id} value={c.id}>{c.display_name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1">
          <Label className="text-xs text-muted-foreground">{t('admin.schedule.classType')}</Label>
          <Select value={filterClassType} onValueChange={(v) => setFilterClassType(v ?? 'all')}>
            <SelectTrigger className="h-8 text-xs w-40">
              <span>{filterClassType === 'all' ? t('common.all') : classTypes.find(c => c.id === filterClassType)?.name}</span>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('common.all')}</SelectItem>
              {classTypes.map(ct => (
                <SelectItem key={ct.id} value={ct.id}>{ct.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="h-8 text-xs shrink-0"
          onClick={() => { setFilterDateFrom(''); setFilterDateTo(''); setFilterCoach('all'); setFilterClassType('all') }}
        >
          {i18n.language === 'fr' ? 'Réinitialiser' : 'Reset'}
        </Button>
      </div>

      {/* Bulk actions bar */}
      {selectedIds.size > 0 && (
        <div className="flex items-center gap-3 p-3 rounded-lg border border-primary/30 bg-primary/5">
          <Badge variant="default">{selectedIds.size}</Badge>
          <span className="text-sm font-medium">
            {i18n.language === 'fr' ? 'cours sélectionné(s)' : 'class(es) selected'}
          </span>
          <div className="flex-1" />

          {bulkAction === 'coach' ? (
            <div className="flex items-center gap-2">
              <select
                className="h-8 rounded-md border border-input bg-background px-2 text-xs"
                value={bulkCoachId}
                onChange={(e) => setBulkCoachId(e.target.value)}
              >
                <option value="">{t('admin.schedule.coach')}</option>
                {coaches.map(c => (
                  <option key={c.id} value={c.id}>{c.display_name}</option>
                ))}
              </select>
              <Button size="sm" className="text-xs" onClick={handleBulkApply} disabled={!bulkCoachId || bulkSaving}>
                {bulkSaving ? '...' : 'Assigner'}
              </Button>
              <Button size="sm" variant="ghost" className="text-xs" onClick={() => setBulkAction(null)}>
                {t('common.cancel')}
              </Button>
            </div>
          ) : bulkAction === 'max' ? (
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min={1}
                className="h-8 w-20 text-xs"
                value={bulkMaxParticipants}
                onChange={(e) => setBulkMaxParticipants(parseInt(e.target.value) || 1)}
              />
              <Button size="sm" className="text-xs" onClick={handleBulkApply} disabled={bulkSaving}>
                {bulkSaving ? '...' : (isFr ? 'Appliquer' : 'Apply')}
              </Button>
              <Button size="sm" variant="ghost" className="text-xs" onClick={() => setBulkAction(null)}>
                {t('common.cancel')}
              </Button>
            </div>
          ) : bulkAction === 'duplicate' ? (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-muted-foreground">
                {isFr ? `Dupliquer ${selectedIds.size} cours dans` : `Duplicate ${selectedIds.size} classes in`}
              </span>
              <Input
                type="number"
                min={1}
                className="h-8 w-20 text-xs"
                value={bulkDuplicateDays}
                onChange={(e) => setBulkDuplicateDays(parseInt(e.target.value) || 1)}
              />
              <span className="text-xs text-muted-foreground">
                {isFr ? `jour${bulkDuplicateDays > 1 ? 's' : ''} (1 = lendemain, 7 = sem. suiv.)` : `day${bulkDuplicateDays > 1 ? 's' : ''} (1 = tomorrow, 7 = next week)`}
              </span>
              <Button size="sm" className="text-xs" onClick={handleBulkApply} disabled={bulkSaving || bulkDuplicateDays < 1}>
                {bulkSaving ? '...' : t('common.confirm')}
              </Button>
              <Button size="sm" variant="ghost" className="text-xs" onClick={() => { setBulkAction(null); setBulkDuplicateDays(7) }}>
                {t('common.cancel')}
              </Button>
            </div>
          ) : (
            <>
              <Button size="sm" variant="outline" className="text-xs gap-1" onClick={() => { setBulkAction('coach'); setBulkCoachId('') }}>
                <UserCog className="h-3 w-3" />
                {isFr ? 'Assigner coach' : 'Assign coach'}
              </Button>
              <Button size="sm" variant="outline" className="text-xs gap-1" onClick={() => setBulkAction('max')}>
                <Users className="h-3 w-3" />
                {isFr ? 'Max participants' : 'Max participants'}
              </Button>
              <Button size="sm" variant="outline" className="text-xs gap-1" onClick={() => setBulkAction('duplicate')}>
                <Copy className="h-3 w-3" />
                {isFr ? 'Dupliquer…' : 'Duplicate…'}
              </Button>
            </>
          )}
        </div>
      )}

      {/* Table */}
      {filteredClasses.length === 0 ? (
        <EmptyState icon={CalendarDays} message={t('common.noResults')} actionLabel={t('admin.schedule.add')} onAction={openAdd} />
      ) : (
        <div className="border rounded-lg overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={toggleAll}
                    className="h-4 w-4 rounded border-input accent-primary cursor-pointer"
                  />
                </TableHead>
                <TableHead>{t('admin.schedule.date')}</TableHead>
                <TableHead>{t('admin.schedule.time')}</TableHead>
                <TableHead className="hidden md:table-cell">{isFr ? 'Salle' : 'Room'}</TableHead>
                <TableHead>{t('admin.schedule.classType')}</TableHead>
                <TableHead className="hidden sm:table-cell">{t('admin.schedule.coach')}</TableHead>
                <TableHead className="hidden lg:table-cell text-center whitespace-nowrap">
                  {i18n.language === 'fr' ? 'Inscrits' : 'Booked'}
                </TableHead>
                <TableHead className="w-[80px]">{t('common.actions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredClasses.map((sc) => {
                const dt = new Date(sc.starts_at)
                const isSelected = selectedIds.has(sc.id)
                return (
                  <TableRow key={sc.id} className={cn(
                    isSelected && 'bg-primary/5',
                    sc.is_cancelled && 'bg-destructive/5',
                    !sc.is_cancelled && new Date(sc.starts_at) < new Date()
                      && (bookingCounts.get(sc.id) ?? 0) === 0 && 'bg-muted/40',
                  )}>
                    <TableCell>
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleOne(sc.id)}
                        className="h-4 w-4 rounded border-input accent-primary cursor-pointer"
                      />
                    </TableCell>
                    <TableCell className="text-sm whitespace-nowrap">{format(dt, 'EEE dd/MM', { locale })}</TableCell>
                    <TableCell className="text-sm font-medium">{format(dt, 'HH:mm')}</TableCell>
                    <TableCell className="hidden md:table-cell text-xs font-mono">
                      {sc.floor || '—'}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={cn(
                          'font-medium',
                          sc.is_cancelled && 'line-through text-muted-foreground',
                        )}>
                          {sc.title || sc.class_type?.name || '-'}
                        </span>
                        {sc.title && <span className="text-xs text-muted-foreground">({sc.class_type?.name})</span>}
                        {/* Statut réel du cours. « Annulé » et « Sans inscrit »
                            aboutissent au même résultat — le cours n'a pas eu
                            lieu — mais l'un est une décision, l'autre un
                            constat. Les distinguer évite de chercher une
                            annulation qui n'a jamais existé. */}
                        {(() => {
                          const st = getClassStatus({
                            starts_at: sc.starts_at,
                            is_cancelled: sc.is_cancelled,
                            bookings: bookingCounts.get(sc.id) ?? 0,
                            attended: attendedCounts.get(sc.id) ?? 0,
                            noShows: noShowCounts.get(sc.id) ?? 0,
                            minParticipants,
                          })
                          if (st === 'scheduled') return null
                          const badge = classStatusLabel(st, i18n.language === 'fr')
                          return (
                            <Badge variant={badge.variant} className={cn('text-[10px]', badge.className)}>
                              {badge.label}
                            </Badge>
                          )
                        })()}
                      </div>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">{sc.coach?.display_name ?? '—'}</TableCell>
                    <TableCell className="hidden lg:table-cell text-center whitespace-nowrap">
                      <span className={cn(
                        (bookingCounts.get(sc.id) ?? 0) >= sc.max_participants && 'text-primary font-medium',
                      )}>
                        {bookingCounts.get(sc.id) ?? 0}/{sc.max_participants}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" className="h-7 w-7" title={i18n.language === 'fr' ? 'Détail / inscrits' : 'Detail / participants'} onClick={() => navigate(`/coach/class/${sc.id}`)}>
                          <Eye className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(sc)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setDeleteTarget(sc)}>
                          <Trash2 className="h-3.5 w-3.5 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
          <div className="px-4 py-2 border-t text-xs text-muted-foreground">
            {filteredClasses.length} {i18n.language === 'fr' ? 'cours' : 'classes'}
            {filteredClasses.length !== classes.length && ` / ${classes.length} ${i18n.language === 'fr' ? 'total' : 'total'}`}
          </div>
        </div>
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? t('admin.schedule.edit') : t('admin.schedule.add')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>{t('admin.schedule.classType')}</Label>
              <Select
                value={form.class_type_id || undefined}
                onValueChange={(val) => {
                  const ct = classTypes.find(c => c.id === val)
                  setForm(f => ({ ...f, class_type_id: val ?? '', max_participants: ct?.default_max_participants ?? f.max_participants }))
                }}
              >
                <SelectTrigger>
                  <span>{classTypes.find(ct => ct.id === form.class_type_id)?.name || t('admin.schedule.classType')}</span>
                </SelectTrigger>
                <SelectContent>
                  {classTypes.map(ct => (
                    <SelectItem key={ct.id} value={ct.id}>{ct.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Titre custom (événement spécial) */}
            <div>
              <Label>{i18n.language === 'fr' ? 'Titre (optionnel — événement spécial)' : 'Title (optional — special event)'}</Label>
              <Input
                placeholder={i18n.language === 'fr' ? 'Ex: Conférence Nutrition Sportive' : 'E.g. Sports Nutrition Conference'}
                value={form.title}
                onChange={(e) => setForm(f => ({ ...f, title: e.target.value }))}
              />
            </div>

            {/* Description (événement) */}
            {form.title && (
              <div>
                <Label>{i18n.language === 'fr' ? 'Description de l\'événement' : 'Event description'}</Label>
                <Textarea
                  placeholder={i18n.language === 'fr' ? 'Détails, intervenant, informations pratiques...' : 'Details, speaker, practical info...'}
                  value={form.description}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setForm(f => ({ ...f, description: e.target.value }))}
                  rows={3}
                />
              </div>
            )}

            <div>
              <Label>{t('admin.schedule.coach')} {i18n.language === 'fr' ? '(optionnel)' : '(optional)'}</Label>
              <Select value={form.coach_id || undefined} onValueChange={(val) => setForm(f => ({ ...f, coach_id: val ?? '' }))}>
                <SelectTrigger>
                  <span>{coaches.find(c => c.id === form.coach_id)?.display_name || (i18n.language === 'fr' ? 'Aucun coach' : 'No coach')}</span>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">{i18n.language === 'fr' ? 'Aucun coach' : 'No coach'}</SelectItem>
                  {coaches.map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.display_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>{isFr ? 'Salle' : 'Room'}</Label>
              <Select value={form.floor} onValueChange={(val) => setForm(f => ({ ...f, floor: val ?? 'bas' }))}>
                <SelectTrigger>
                  <span>{form.floor}</span>
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(floorNames).map(([slug]) => (
                    <SelectItem key={slug} value={slug}>{slug}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>{t('admin.schedule.date')}</Label>
                <Input type="date" value={form.date} onChange={(e) => setForm(f => ({ ...f, date: e.target.value }))} />
              </div>
              <div>
                <Label>{t('admin.schedule.time')}</Label>
                <Input type="time" value={form.time} step="3600" onChange={(e) => setForm(f => ({ ...f, time: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>{t('admin.schedule.maxParticipants')}</Label>
                <Input type="number" min={1} value={form.max_participants} onChange={(e) => setForm(f => ({ ...f, max_participants: parseInt(e.target.value) || 1 }))} />
              </div>
              <div>
                <Label>{isFr ? 'Durée (min)' : 'Duration (min)'}</Label>
                <Input type="number" min={15} step={15} value={form.duration_minutes} onChange={(e) => setForm(f => ({ ...f, duration_minutes: parseInt(e.target.value) || 60 }))} />
              </div>
            </div>
            {!editing && (
              <div>
                <Label>{isFr ? 'Répéter pour X semaines' : 'Repeat for X weeks'}</Label>
                <div className="flex items-center gap-3">
                  <Input
                    type="number"
                    min={0}
                    max={10}
                    value={form.repeat_weeks}
                    onChange={(e) => setForm(f => ({ ...f, repeat_weeks: Math.min(10, Math.max(0, parseInt(e.target.value) || 0)) }))}
                    className="w-20"
                  />
                  <span className="text-sm text-muted-foreground">
                    {form.repeat_weeks === 0
                      ? (isFr ? 'Ce cours uniquement' : 'This class only')
                      : (isFr
                        ? `→ ${form.repeat_weeks + 1} cours seront créés (aujourd'hui + ${form.repeat_weeks} semaine${form.repeat_weeks > 1 ? 's' : ''})`
                        : `→ ${form.repeat_weeks + 1} classes will be created (today + ${form.repeat_weeks} week${form.repeat_weeks > 1 ? 's' : ''})`)}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Changement lourd sur un cours qui a des inscrits : l'admin doit
              savoir ce qu'il déclenche avant de valider. */}
          {pendingHeavyChange && pendingHeavyChange.booked > 0 && (
            <div className="flex items-start gap-2 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-500/40 p-3 text-sm">
              <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
              <div className="text-amber-900 dark:text-amber-200">
                <p className="font-medium">
                  {isFr
                    ? `${pendingHeavyChange.booked} personne(s) déjà inscrite(s)`
                    : `${pendingHeavyChange.booked} member(s) already booked`}
                </p>
                <p className="text-xs mt-1">
                  {isFr
                    ? `Tu changes ${pendingHeavyChange.timeChanged && pendingHeavyChange.typeChanged
                        ? 'l\'horaire et le type de cours'
                        : pendingHeavyChange.timeChanged ? 'l\'horaire' : 'le type de cours'}. Ces personnes s'étaient inscrites à autre chose : elles seront prévenues et invitées à se désinscrire avec restitution de leur crédit si le nouveau créneau ne leur convient pas.`
                    : `You are changing ${pendingHeavyChange.timeChanged && pendingHeavyChange.typeChanged
                        ? 'the time and the class type'
                        : pendingHeavyChange.timeChanged ? 'the time' : 'the class type'}. These members booked something else: they will be notified and invited to cancel with a refund if the new slot does not suit them.`}
                </p>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>{t('common.cancel')}</Button>
            <Button onClick={handleSave} disabled={!form.class_type_id || !form.date || !form.time}>
              {t('common.save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title={isFr ? 'Supprimer ce cours ?' : 'Delete this class?'}
        description={deleteTarget
          ? `${deleteTarget.class_type?.name || deleteTarget.title || ''} — ${format(new Date(deleteTarget.starts_at), 'EEEE dd/MM/yyyy HH:mm', { locale })} — ${deleteTarget.floor || ''}`
          : ''}
        onConfirm={handleDelete}
      />

      {/* Conflits de duplication : montrer avant d'écrire, et nommer chaque
          cours concerné. « 2 ignorés » sans dire lesquels obligeait à parcourir
          le planning pour retrouver ce qu'il fallait reprendre à la main. */}
      <Dialog open={conflitsAValider !== null} onOpenChange={(o) => { if (!o) setConflitsAValider(null) }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              {isFr ? 'Conflits détectés' : 'Conflicts detected'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 text-sm max-h-[60vh] overflow-y-auto">
            {conflitsAValider && conflitsAValider.analyse.bloques.length > 0 && (
              <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3">
                <p className="font-medium">
                  {isFr
                    ? `${conflitsAValider.analyse.bloques.length} créneau(x) déjà occupé(s) — ces cours ne seront PAS créés :`
                    : `${conflitsAValider.analyse.bloques.length} slot(s) already taken — these will NOT be created:`}
                </p>
                <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                  {conflitsAValider.analyse.bloques.map((c, i) => (
                    <li key={i}>• {decrireConflit(c)}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Le coach n'empêche pas : il peut superviser deux salles, ou
                l'admin corrigera. Bloquer interdirait des plannings valides. */}
            {conflitsAValider && conflitsAValider.analyse.avertissements.length > 0 && (
              <div className="rounded-lg border border-amber-500/40 bg-amber-500/5 p-3">
                <p className="font-medium">
                  {isFr
                    ? `${conflitsAValider.analyse.avertissements.length} conflit(s) de coach — le cours sera créé quand même :`
                    : `${conflitsAValider.analyse.avertissements.length} coach conflict(s) — the class will still be created:`}
                </p>
                <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                  {conflitsAValider.analyse.avertissements.map((c, i) => (
                    <li key={i}>• {decrireConflit(c)}</li>
                  ))}
                </ul>
              </div>
            )}

            <p className="font-medium">
              {isFr
                ? `${conflitsAValider?.lignes.length ?? 0} cours seront créés.`
                : `${conflitsAValider?.lignes.length ?? 0} class(es) will be created.`}
            </p>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setConflitsAValider(null)}>
              {t('common.cancel')}
            </Button>
            <Button
              onClick={confirmerDuplication}
              disabled={bulkSaving || (conflitsAValider?.lignes.length ?? 0) === 0}
            >
              {t('common.confirm')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

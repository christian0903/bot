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
import { useNavigate } from 'react-router-dom'
import { CalendarDays, Pencil, Plus, Trash2, Users, UserCog, Eye, Copy } from 'lucide-react'
import { format } from 'date-fns'
import { fr, enUS } from 'date-fns/locale'
import { cn } from '@/lib/utils'

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
  const [classTypes, setClassTypes] = useState<ClassType[]>([])
  const [coaches, setCoaches] = useState<Profile[]>([])
  const [floorNames, setFloorNames] = useState<Record<string, string>>(DEFAULT_FLOOR_NAMES)
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<ScheduledClass | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<ScheduledClass | null>(null)
  const [form, setForm] = useState<ScheduleForm>(emptyForm)

  // Filters
  const [filterDateFrom, setFilterDateFrom] = useState(() => format(new Date(), 'yyyy-MM-dd'))
  const [filterDateTo, setFilterDateTo] = useState('')
  const [filterCoach, setFilterCoach] = useState('all')
  const [filterClassType, setFilterClassType] = useState('all')

  // Bulk selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [bulkAction, setBulkAction] = useState<'coach' | 'max' | 'duplicate' | null>(null)
  const [bulkCoachId, setBulkCoachId] = useState('')
  const [bulkMaxParticipants, setBulkMaxParticipants] = useState(4)
  const [bulkSaving, setBulkSaving] = useState(false)

  const fetchData = async () => {
    const [classRes, typeRes, coachRes, roomRes] = await Promise.all([
      supabase
        .from('scheduled_classes')
        .select('*, class_type:class_types(*)')
        .order('starts_at', { ascending: true }),
      supabase.from('class_types').select('*').eq('is_active', true).order('name'),
      // Vue SQL qui bypass les RLS circulaires sur user_roles
      supabase.from('coach_profiles').select('*').order('display_name'),
      supabase.from('app_settings').select('value').eq('key', 'room_names').single(),
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
    }

    setClasses(rawClasses)
    setSelectedIds(new Set())
    setLoading(false)
  }

  useEffect(() => { fetchData() }, [])

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
      const { error } = await supabase.from('scheduled_classes').update({
        ...basePayload,
        starts_at: baseDate.toISOString(),
      }).eq('id', editing.id)
      if (error) { toast.error(t('common.error')); return }
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

      // Build candidate rows for next week
      const candidates = selectedClasses.map(sc => {
        const nextWeek = new Date(sc.starts_at)
        nextWeek.setDate(nextWeek.getDate() + 7)
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
        .select('starts_at, floor')
        .gte('starts_at', minDate)
        .lte('starts_at', maxDate)
        .eq('is_cancelled', false)

      // Compare by minute precision + floor
      const toMinuteKey = (iso: string, floor: string | null) => {
        return iso.slice(0, 16) + '|' + (floor ?? '')
      }
      const existingKeys = new Set((existing ?? []).map(e => toMinuteKey(e.starts_at, e.floor)))

      // Split into insertable and skipped
      const toInsert = candidates.filter(c => !existingKeys.has(toMinuteKey(c.starts_at, c.floor)))
      const skipped = candidates.filter(c => existingKeys.has(toMinuteKey(c.starts_at, c.floor)))

      // Remove internal field before insert
      const rows = toInsert.map(({ _original_name, ...row }) => row)

      if (rows.length > 0) {
        const { error } = await supabase.from('scheduled_classes').insert(rows)
        if (error) { toast.error(error.message); setBulkSaving(false); return }
      }

      if (skipped.length > 0 && rows.length > 0) {
        toast.warning(isFr
          ? `${rows.length} cours dupliqués, ${skipped.length} ignoré(s) (créneau déjà occupé)`
          : `${rows.length} duplicated, ${skipped.length} skipped (slot already taken)`)
      } else if (skipped.length > 0 && rows.length === 0) {
        toast.error(isFr
          ? `Aucun cours dupliqué — tous les créneaux sont déjà occupés`
          : `No classes duplicated — all slots already taken`)
      } else {
        toast.success(isFr
          ? `${rows.length} cours dupliqués pour la semaine suivante`
          : `${rows.length} classes duplicated to next week`)
      }
    }

    setBulkSaving(false)
    setBulkAction(null)
    setSelectedIds(new Set())
    await fetchData()
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

      {/* Filters */}
      <div className="flex flex-wrap items-end gap-3 p-3 rounded-lg border bg-muted/30">
        <div>
          <Label className="text-xs">{i18n.language === 'fr' ? 'Du' : 'From'}</Label>
          <Input type="date" className="h-8 text-xs w-36" value={filterDateFrom} onChange={(e) => setFilterDateFrom(e.target.value)} />
        </div>
        <div>
          <Label className="text-xs">{i18n.language === 'fr' ? 'Au' : 'To'}</Label>
          <Input type="date" className="h-8 text-xs w-36" value={filterDateTo} onChange={(e) => setFilterDateTo(e.target.value)} />
        </div>
        <div>
          <Label className="text-xs">{t('admin.schedule.coach')}</Label>
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
        <div>
          <Label className="text-xs">{t('admin.schedule.classType')}</Label>
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
          className="text-xs"
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
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">
                {isFr
                  ? `Dupliquer ${selectedIds.size} cours → semaine suivante ?`
                  : `Duplicate ${selectedIds.size} classes → next week?`}
              </span>
              <Button size="sm" className="text-xs" onClick={handleBulkApply} disabled={bulkSaving}>
                {bulkSaving ? '...' : t('common.confirm')}
              </Button>
              <Button size="sm" variant="ghost" className="text-xs" onClick={() => setBulkAction(null)}>
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
                {isFr ? 'Dupliquer sem. suivante' : 'Duplicate next week'}
              </Button>
            </>
          )}
        </div>
      )}

      {/* Table */}
      {filteredClasses.length === 0 ? (
        <EmptyState icon={CalendarDays} message={t('common.noResults')} actionLabel={t('admin.schedule.add')} onAction={openAdd} />
      ) : (
        <div className="border rounded-lg">
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
                <TableHead>{isFr ? 'Salle' : 'Room'}</TableHead>
                <TableHead>{t('admin.schedule.classType')}</TableHead>
                <TableHead>{t('admin.schedule.coach')}</TableHead>
                <TableHead className="text-center">{t('admin.schedule.maxParticipants')}</TableHead>
                <TableHead className="w-[80px]">{t('common.actions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredClasses.map((sc) => {
                const dt = new Date(sc.starts_at)
                const isSelected = selectedIds.has(sc.id)
                return (
                  <TableRow key={sc.id} className={cn(isSelected && 'bg-primary/5')}>
                    <TableCell>
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleOne(sc.id)}
                        className="h-4 w-4 rounded border-input accent-primary cursor-pointer"
                      />
                    </TableCell>
                    <TableCell className="text-sm">{format(dt, 'EEE dd/MM', { locale })}</TableCell>
                    <TableCell className="text-sm font-medium">{format(dt, 'HH:mm')}</TableCell>
                    <TableCell className="text-xs font-mono">
                      {sc.floor || '—'}
                    </TableCell>
                    <TableCell>
                      <div>
                        <span className="font-medium">{sc.title || sc.class_type?.name || '-'}</span>
                        {sc.title && <span className="text-xs text-muted-foreground ml-1.5">({sc.class_type?.name})</span>}
                      </div>
                    </TableCell>
                    <TableCell>{sc.coach?.display_name ?? '—'}</TableCell>
                    <TableCell className="text-center">{sc.max_participants}</TableCell>
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
    </div>
  )
}

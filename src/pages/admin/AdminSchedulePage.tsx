import { useEffect, useState, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { supabase } from '@/lib/supabase'
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
import { CalendarDays, Pencil, Plus, Trash2, Users, UserCog } from 'lucide-react'
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
}

const emptyForm: ScheduleForm = {
  class_type_id: '',
  coach_id: '',
  date: '',
  time: '',
  max_participants: 4,
  duration_minutes: 60,
  title: '',
  description: '',
}

export function AdminSchedulePage() {
  const { t, i18n } = useTranslation()
  const locale = i18n.language === 'fr' ? fr : enUS
  const [classes, setClasses] = useState<ScheduledClass[]>([])
  const [classTypes, setClassTypes] = useState<ClassType[]>([])
  const [coaches, setCoaches] = useState<Profile[]>([])
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
  const [bulkAction, setBulkAction] = useState<'coach' | 'max' | null>(null)
  const [bulkCoachId, setBulkCoachId] = useState('')
  const [bulkMaxParticipants, setBulkMaxParticipants] = useState(4)
  const [bulkSaving, setBulkSaving] = useState(false)

  const fetchData = async () => {
    const [classRes, typeRes, coachRes] = await Promise.all([
      supabase
        .from('scheduled_classes')
        .select('*, class_type:class_types(*)')
        .order('starts_at', { ascending: true }),
      supabase.from('class_types').select('*').eq('is_active', true).order('name'),
      // Vue SQL qui bypass les RLS circulaires sur user_roles
      supabase.from('coach_profiles').select('*').order('display_name'),
    ])

    const rawClasses = (classRes.data as ScheduledClass[]) ?? []
    setClassTypes((typeRes.data as ClassType[]) ?? [])

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
    })
    setDialogOpen(true)
  }

  const handleSave = async () => {
    const starts_at = new Date(`${form.date}T${form.time}`).toISOString()
    const payload = {
      class_type_id: form.class_type_id,
      coach_id: form.coach_id || null,
      starts_at,
      max_participants: form.max_participants,
      duration_minutes: form.duration_minutes,
      title: form.title || null,
      description: form.description || null,
    }
    if (editing) {
      const { error } = await supabase.from('scheduled_classes').update(payload).eq('id', editing.id)
      if (error) { toast.error(t('common.error')); return }
    } else {
      const { error } = await supabase.from('scheduled_classes').insert(payload)
      if (error) { toast.error(t('common.error')); return }
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

    if (bulkAction === 'coach' && bulkCoachId) {
      const { error } = await supabase
        .from('scheduled_classes')
        .update({ coach_id: bulkCoachId })
        .in('id', ids)
      if (error) { toast.error(error.message); setBulkSaving(false); return }
      toast.success(i18n.language === 'fr'
        ? `Coach assigné à ${ids.length} cours`
        : `Coach assigned to ${ids.length} classes`)
    }

    if (bulkAction === 'max') {
      const { error } = await supabase
        .from('scheduled_classes')
        .update({ max_participants: bulkMaxParticipants })
        .in('id', ids)
      if (error) { toast.error(error.message); setBulkSaving(false); return }
      toast.success(i18n.language === 'fr'
        ? `Max participants modifié pour ${ids.length} cours`
        : `Max participants updated for ${ids.length} classes`)
    }

    setBulkSaving(false)
    setBulkAction(null)
    setSelectedIds(new Set())
    fetchData()
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
          <Input
            type="date"
            className="h-8 text-xs w-36"
            value={filterDateFrom}
            onChange={(e) => setFilterDateFrom(e.target.value)}
          />
        </div>
        <div>
          <Label className="text-xs">{i18n.language === 'fr' ? 'Au' : 'To'}</Label>
          <Input
            type="date"
            className="h-8 text-xs w-36"
            value={filterDateTo}
            onChange={(e) => setFilterDateTo(e.target.value)}
          />
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
                {bulkSaving ? '...' : (i18n.language === 'fr' ? 'Assigner' : 'Assign')}
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
                {bulkSaving ? '...' : (i18n.language === 'fr' ? 'Appliquer' : 'Apply')}
              </Button>
              <Button size="sm" variant="ghost" className="text-xs" onClick={() => setBulkAction(null)}>
                {t('common.cancel')}
              </Button>
            </div>
          ) : (
            <>
              <Button size="sm" variant="outline" className="text-xs gap-1" onClick={() => { setBulkAction('coach'); setBulkCoachId('') }}>
                <UserCog className="h-3 w-3" />
                {i18n.language === 'fr' ? 'Assigner coach' : 'Assign coach'}
              </Button>
              <Button size="sm" variant="outline" className="text-xs gap-1" onClick={() => setBulkAction('max')}>
                <Users className="h-3 w-3" />
                {i18n.language === 'fr' ? 'Changer max participants' : 'Change max participants'}
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
                    <TableCell>
                      <div>
                        <span className="font-medium">{sc.title || sc.class_type?.name || '-'}</span>
                        {sc.title && <span className="text-xs text-muted-foreground ml-1.5">({sc.class_type?.name})</span>}
                      </div>
                    </TableCell>
                    <TableCell>{sc.coach?.display_name ?? (i18n.language === 'fr' ? '—' : '—')}</TableCell>
                    <TableCell className="text-center">{sc.max_participants}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
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
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>{t('admin.schedule.date')}</Label>
                <Input type="date" value={form.date} onChange={(e) => setForm(f => ({ ...f, date: e.target.value }))} />
              </div>
              <div>
                <Label>{t('admin.schedule.time')}</Label>
                <Input type="time" value={form.time} onChange={(e) => setForm(f => ({ ...f, time: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>{t('admin.schedule.maxParticipants')}</Label>
                <Input type="number" min={1} value={form.max_participants} onChange={(e) => setForm(f => ({ ...f, max_participants: parseInt(e.target.value) || 1 }))} />
              </div>
              <div>
                <Label>{i18n.language === 'fr' ? 'Durée (min)' : 'Duration (min)'}</Label>
                <Input type="number" min={15} step={15} value={form.duration_minutes} onChange={(e) => setForm(f => ({ ...f, duration_minutes: parseInt(e.target.value) || 60 }))} />
              </div>
            </div>
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
        title={t('admin.schedule.delete')}
        description={t('common.confirmDelete')}
        onConfirm={handleDelete}
      />
    </div>
  )
}

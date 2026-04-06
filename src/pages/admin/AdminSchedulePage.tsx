import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { supabase } from '@/lib/supabase'
import type { ScheduledClass, ClassType, Profile } from '@/types'
import { LoadingState } from '@/components/common/LoadingState'
import { EmptyState } from '@/components/common/EmptyState'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,

} from '@/components/ui/select'
import { toast } from 'sonner'
import { CalendarDays, Pencil, Plus, Trash2 } from 'lucide-react'
import { format } from 'date-fns'
import { fr, enUS } from 'date-fns/locale'

interface ScheduleForm {
  class_type_id: string
  coach_id: string
  date: string
  time: string
  max_participants: number
  duration_minutes: number
}

const emptyForm: ScheduleForm = {
  class_type_id: '',
  coach_id: '',
  date: '',
  time: '',
  max_participants: 10,
  duration_minutes: 60,
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

  const fetchData = async () => {
    const [classRes, typeRes, coachRolesRes] = await Promise.all([
      supabase
        .from('scheduled_classes')
        .select('*, class_type:class_types(*)')
        .order('starts_at', { ascending: true }),
      supabase.from('class_types').select('*').eq('is_active', true).order('name'),
      supabase.from('user_roles').select('user_id').eq('role', 'coach'),
    ])

    const rawClasses = (classRes.data as ScheduledClass[]) ?? []
    setClassTypes((typeRes.data as ClassType[]) ?? [])

    // Fetch coach profiles
    const coachIds = (coachRolesRes.data ?? []).map((r: { user_id: string }) => r.user_id)
    // Also include coach_ids from scheduled classes in case role was removed
    const allCoachIds = [...new Set([...coachIds, ...rawClasses.map(c => c.coach_id)])]
    if (allCoachIds.length > 0) {
      const { data: coachProfiles } = await supabase
        .from('profiles')
        .select('*')
        .in('id', allCoachIds)
        .order('display_name')
      setCoaches((coachProfiles as Profile[]) ?? [])

      // Attach coach to each class
      const coachMap = new Map((coachProfiles ?? []).map(c => [c.id, c]))
      for (const sc of rawClasses) {
        sc.coach = coachMap.get(sc.coach_id) as Profile
      }
    }

    setClasses(rawClasses)
    setLoading(false)
  }

  useEffect(() => {
    fetchData()
  }, [])

  const openAdd = () => {
    setEditing(null)
    setForm(emptyForm)
    setDialogOpen(true)
  }

  const openEdit = (sc: ScheduledClass) => {
    const dt = new Date(sc.starts_at)
    setEditing(sc)
    setForm({
      class_type_id: sc.class_type_id,
      coach_id: sc.coach_id,
      date: format(dt, 'yyyy-MM-dd'),
      time: format(dt, 'HH:mm'),
      max_participants: sc.max_participants,
      duration_minutes: sc.duration_minutes,
    })
    setDialogOpen(true)
  }

  const handleSave = async () => {
    const starts_at = new Date(`${form.date}T${form.time}`).toISOString()
    const payload = {
      class_type_id: form.class_type_id,
      coach_id: form.coach_id,
      starts_at,
      max_participants: form.max_participants,
      duration_minutes: form.duration_minutes,
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

      {classes.length === 0 ? (
        <EmptyState icon={CalendarDays} message={t('common.noResults')} actionLabel={t('admin.schedule.add')} onAction={openAdd} />
      ) : (
        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('admin.schedule.classType')}</TableHead>
                <TableHead>{t('admin.schedule.coach')}</TableHead>
                <TableHead>{t('admin.schedule.date')}</TableHead>
                <TableHead>{t('admin.schedule.time')}</TableHead>
                <TableHead>{t('admin.schedule.maxParticipants')}</TableHead>
                <TableHead>{t('schedule.duration', { minutes: '' }).trim()}</TableHead>
                <TableHead className="w-[100px]">{t('common.actions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {classes.map((sc) => {
                const dt = new Date(sc.starts_at)
                return (
                  <TableRow key={sc.id}>
                    <TableCell className="font-medium">{sc.class_type?.name ?? '-'}</TableCell>
                    <TableCell>{sc.coach?.display_name ?? '-'}</TableCell>
                    <TableCell>{format(dt, 'dd/MM/yyyy', { locale })}</TableCell>
                    <TableCell>{format(dt, 'HH:mm')}</TableCell>
                    <TableCell>{sc.max_participants}</TableCell>
                    <TableCell>{sc.duration_minutes} min</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" onClick={() => openEdit(sc)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => setDeleteTarget(sc)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editing ? t('admin.schedule.edit') : t('admin.schedule.add')}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>{t('admin.schedule.classType')}</Label>
              <Select
                value={form.class_type_id}
                onValueChange={(val) => setForm(f => ({ ...f, class_type_id: val ?? '' }))}
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
            <div>
              <Label>{t('admin.schedule.coach')}</Label>
              <Select
                value={form.coach_id}
                onValueChange={(val) => setForm(f => ({ ...f, coach_id: val ?? '' }))}
              >
                <SelectTrigger>
                  <span>{coaches.find(c => c.id === form.coach_id)?.display_name || t('admin.schedule.coach')}</span>
                </SelectTrigger>
                <SelectContent>
                  {coaches.map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.display_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>{t('admin.schedule.date')}</Label>
                <Input
                  type="date"
                  value={form.date}
                  onChange={(e) => setForm(f => ({ ...f, date: e.target.value }))}
                />
              </div>
              <div>
                <Label>{t('admin.schedule.time')}</Label>
                <Input
                  type="time"
                  value={form.time}
                  onChange={(e) => setForm(f => ({ ...f, time: e.target.value }))}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>{t('admin.schedule.maxParticipants')}</Label>
                <Input
                  type="number"
                  min={1}
                  value={form.max_participants}
                  onChange={(e) => setForm(f => ({ ...f, max_participants: parseInt(e.target.value) || 1 }))}
                />
              </div>
              <div>
                <Label>{t('schedule.duration', { minutes: '' }).trim()}</Label>
                <Input
                  type="number"
                  min={15}
                  step={15}
                  value={form.duration_minutes}
                  onChange={(e) => setForm(f => ({ ...f, duration_minutes: parseInt(e.target.value) || 60 }))}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button
              onClick={handleSave}
              disabled={!form.class_type_id || !form.coach_id || !form.date || !form.time}
            >
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

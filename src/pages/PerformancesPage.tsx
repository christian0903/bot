import { useEffect, useState, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import type { Performance, PerformanceType } from '@/types'
import { LoadingState } from '@/components/common/LoadingState'
import { EmptyState } from '@/components/common/EmptyState'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
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
import { Activity, Plus, Pencil, Trash2, Settings } from 'lucide-react'
import { format } from 'date-fns'
import { fr, enUS } from 'date-fns/locale'

interface FormState {
  performance_type_id: string
  date: string
  value: string
  notes: string
}

const todayISO = () => format(new Date(), 'yyyy-MM-dd')

const emptyForm: FormState = {
  performance_type_id: '',
  date: todayISO(),
  value: '',
  notes: '',
}

export function PerformancesPage() {
  const { i18n } = useTranslation()
  const isFr = i18n.language === 'fr'
  const locale = isFr ? fr : enUS
  const { user, hasRole } = useAuth()
  const navigate = useNavigate()
  const canManageTypes = hasRole('coach') || hasRole('admin')

  const [types, setTypes] = useState<PerformanceType[]>([])
  const [performances, setPerformances] = useState<Performance[]>([])
  const [loading, setLoading] = useState(true)
  const [filterTypeId, setFilterTypeId] = useState<string>('')

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Performance | null>(null)
  const [form, setForm] = useState<FormState>(emptyForm)
  const [saving, setSaving] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<Performance | null>(null)

  const fetchData = async () => {
    if (!user) return
    const [tRes, pRes] = await Promise.all([
      supabase
        .from('performance_types')
        .select('*')
        .order('display_order')
        .order('name'),
      supabase
        .from('performances')
        .select('*, performance_type:performance_types(*)')
        .eq('user_id', user.id)
        .order('date', { ascending: false })
        .order('created_at', { ascending: false }),
    ])
    setTypes((tRes.data as PerformanceType[]) ?? [])
    setPerformances((pRes.data as Performance[]) ?? [])
    setLoading(false)
  }

  useEffect(() => { fetchData() }, [user?.id])

  const activeTypes = useMemo(() => types.filter(t => !t.archived), [types])

  const filteredPerformances = useMemo(
    () => (filterTypeId ? performances.filter(p => p.performance_type_id === filterTypeId) : performances),
    [performances, filterTypeId],
  )

  const openCreate = () => {
    setEditing(null)
    setForm({
      ...emptyForm,
      performance_type_id: activeTypes[0]?.id ?? '',
      date: todayISO(),
    })
    setDialogOpen(true)
  }

  const openEdit = (p: Performance) => {
    setEditing(p)
    setForm({
      performance_type_id: p.performance_type_id,
      date: p.date,
      value: p.value,
      notes: p.notes ?? '',
    })
    setDialogOpen(true)
  }

  const handleSave = async () => {
    if (!user) return
    if (!form.performance_type_id) {
      toast.error(isFr ? 'Choisis un type' : 'Pick a type')
      return
    }
    if (!form.value.trim()) {
      toast.error(isFr ? 'La valeur est requise' : 'Value is required')
      return
    }
    setSaving(true)
    const payload = {
      performance_type_id: form.performance_type_id,
      date: form.date,
      value: form.value.trim(),
      notes: form.notes.trim() || null,
    }
    const { error } = editing
      ? await supabase.from('performances').update(payload).eq('id', editing.id)
      : await supabase.from('performances').insert({ ...payload, user_id: user.id, created_by: user.id })
    setSaving(false)
    if (error) { toast.error(error.message); return }
    toast.success(isFr ? 'Performance enregistrée' : 'Performance saved')
    setDialogOpen(false)
    fetchData()
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    const { error } = await supabase.from('performances').delete().eq('id', deleteTarget.id)
    if (error) { toast.error(error.message); return }
    toast.success(isFr ? 'Performance supprimée' : 'Performance deleted')
    setDeleteTarget(null)
    fetchData()
  }

  if (loading) return <LoadingState />

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Activity className="h-6 w-6" />
            {isFr ? 'Mes performances' : 'My performances'}
          </h1>
          <p className="text-sm text-muted-foreground">
            {isFr ? 'Enregistre tes scores et suis ta progression.' : 'Log your scores and follow your progress.'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {canManageTypes && (
            <Button variant="outline" size="sm" onClick={() => navigate('/performance-types')}>
              <Settings className="h-4 w-4 mr-1" />
              {isFr ? 'Gérer les types' : 'Manage types'}
            </Button>
          )}
          <Button onClick={openCreate} disabled={activeTypes.length === 0}>
            <Plus className="h-4 w-4 mr-1" />
            {isFr ? 'Nouvelle performance' : 'New performance'}
          </Button>
        </div>
      </div>

      {activeTypes.length === 0 && (
        <Card>
          <CardContent className="pt-6 text-center text-sm text-muted-foreground">
            {isFr
              ? 'Aucun type de performance disponible. Demande à un coach de définir les types.'
              : 'No performance types available. Ask a coach to define types.'}
          </CardContent>
        </Card>
      )}

      {activeTypes.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant={filterTypeId === '' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilterTypeId('')}
          >
            {isFr ? 'Tous' : 'All'}
          </Button>
          {activeTypes.map(t => (
            <Button
              key={t.id}
              variant={filterTypeId === t.id ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilterTypeId(t.id)}
            >
              {t.color && (
                <span
                  className="h-2 w-2 rounded-full mr-1.5"
                  style={{ backgroundColor: t.color }}
                />
              )}
              {t.name}
            </Button>
          ))}
        </div>
      )}

      {filteredPerformances.length === 0 ? (
        <EmptyState
          icon={Activity}
          message={isFr ? 'Aucune performance enregistrée' : 'No performance recorded'}
        />
      ) : (
        <div className="space-y-2">
          {filteredPerformances.map(p => (
            <Card key={p.id} className="group">
              <CardContent className="p-3 flex items-center gap-3">
                {p.performance_type?.color && (
                  <span
                    className="h-2.5 w-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: p.performance_type.color }}
                  />
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold">{p.value}</span>
                    {p.performance_type?.unit_hint && !p.value.toLowerCase().includes(p.performance_type.unit_hint.toLowerCase()) && (
                      <span className="text-xs text-muted-foreground">{p.performance_type.unit_hint}</span>
                    )}
                    <Badge variant="outline" className="text-[11px]">{p.performance_type?.name ?? '—'}</Badge>
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {format(new Date(p.date), 'EEEE dd MMMM yyyy', { locale })}
                    {p.notes && <span className="ml-2">— {p.notes}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(p)}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setDeleteTarget(p)}>
                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editing
                ? (isFr ? 'Éditer la performance' : 'Edit performance')
                : (isFr ? 'Nouvelle performance' : 'New performance')}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1">
              <Label>{isFr ? 'Type' : 'Type'}</Label>
              <Select
                value={form.performance_type_id}
                onValueChange={(v) => setForm(f => ({ ...f, performance_type_id: v ?? '' }))}
              >
                <SelectTrigger>
                  <span>{activeTypes.find(t => t.id === form.performance_type_id)?.name ?? (isFr ? 'Choisir...' : 'Pick...')}</span>
                </SelectTrigger>
                <SelectContent>
                  {activeTypes.map(t => (
                    <SelectItem key={t.id} value={t.id}>{t.name}{t.unit_hint ? ` (${t.unit_hint})` : ''}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>{isFr ? 'Date' : 'Date'}</Label>
                <Input
                  type="date"
                  value={form.date}
                  onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
                />
              </div>
              <div className="space-y-1">
                <Label>{isFr ? 'Valeur' : 'Value'}</Label>
                <Input
                  value={form.value}
                  onChange={e => setForm(f => ({ ...f, value: e.target.value }))}
                  placeholder={
                    activeTypes.find(t => t.id === form.performance_type_id)?.unit_hint
                      ? `ex: 13 ${activeTypes.find(t => t.id === form.performance_type_id)?.unit_hint}`
                      : 'ex: 13 kg, 3:42, 1500m'
                  }
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label>{isFr ? 'Notes (optionnel)' : 'Notes (optional)'}</Label>
              <Textarea
                value={form.notes}
                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>
              {isFr ? 'Annuler' : 'Cancel'}
            </Button>
            <Button onClick={handleSave} disabled={saving || !form.value.trim() || !form.performance_type_id}>
              {saving ? '...' : (isFr ? 'Enregistrer' : 'Save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title={isFr ? 'Supprimer cette performance ?' : 'Delete this performance?'}
        description={isFr ? 'Cette action est définitive.' : 'This action is permanent.'}
        variant="destructive"
        onConfirm={handleDelete}
      />
    </div>
  )
}

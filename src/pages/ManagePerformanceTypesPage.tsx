import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { supabase } from '@/lib/supabase'
import type { PerformanceType } from '@/types'
import { LoadingState } from '@/components/common/LoadingState'
import { EmptyState } from '@/components/common/EmptyState'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { toast } from 'sonner'
import { Activity, Pencil, Plus, Trash2 } from 'lucide-react'

interface FormState {
  name: string
  unit_hint: string
  color: string
  display_order: number
  archived: boolean
}

const emptyForm: FormState = {
  name: '',
  unit_hint: '',
  color: '',
  display_order: 0,
  archived: false,
}

export function ManagePerformanceTypesPage() {
  const { i18n } = useTranslation()
  const isFr = i18n.language === 'fr'
  const [types, setTypes] = useState<PerformanceType[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<PerformanceType | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<PerformanceType | null>(null)
  const [form, setForm] = useState<FormState>(emptyForm)
  const [saving, setSaving] = useState(false)

  const fetchData = async () => {
    const { data } = await supabase
      .from('performance_types')
      .select('*')
      .order('display_order', { ascending: true })
      .order('name', { ascending: true })
    setTypes((data as PerformanceType[]) ?? [])
    setLoading(false)
  }

  useEffect(() => { fetchData() }, [])

  const openCreate = () => {
    setEditing(null)
    setForm(emptyForm)
    setDialogOpen(true)
  }

  const openEdit = (t: PerformanceType) => {
    setEditing(t)
    setForm({
      name: t.name,
      unit_hint: t.unit_hint ?? '',
      color: t.color ?? '',
      display_order: t.display_order,
      archived: t.archived,
    })
    setDialogOpen(true)
  }

  const handleSave = async () => {
    if (!form.name.trim()) {
      toast.error(isFr ? 'Le nom est requis' : 'Name required')
      return
    }
    setSaving(true)
    const payload = {
      name: form.name.trim(),
      unit_hint: form.unit_hint.trim() || null,
      color: form.color.trim() || null,
      display_order: form.display_order,
      archived: form.archived,
    }
    const { error } = editing
      ? await supabase.from('performance_types').update(payload).eq('id', editing.id)
      : await supabase.from('performance_types').insert(payload)
    setSaving(false)
    if (error) { toast.error(error.message); return }
    toast.success(isFr ? 'Type enregistré' : 'Type saved')
    setDialogOpen(false)
    fetchData()
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    const { error } = await supabase.from('performance_types').delete().eq('id', deleteTarget.id)
    if (error) {
      toast.error(isFr
        ? `Suppression impossible (peut-être utilisé par des performances). Astuce : archive-le à la place.`
        : `Cannot delete (might be in use). Tip: archive it instead.`)
      setDeleteTarget(null)
      return
    }
    toast.success(isFr ? 'Type supprimé' : 'Type deleted')
    setDeleteTarget(null)
    fetchData()
  }

  if (loading) return <LoadingState />

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Activity className="h-6 w-6" />
            {isFr ? 'Types de performances' : 'Performance types'}
          </h1>
          <p className="text-sm text-muted-foreground">
            {isFr
              ? 'Catalogue partagé : rameur, ski, poids, etc. Géré par coachs et admins.'
              : 'Shared catalog: rower, ski, weights, etc. Managed by coaches and admins.'}
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4 mr-1" />
          {isFr ? 'Nouveau type' : 'New type'}
        </Button>
      </div>

      {types.length === 0 ? (
        <EmptyState icon={Activity} message={isFr ? 'Aucun type défini' : 'No types defined'} />
      ) : (
        <div className="space-y-2">
          {types.map(t => (
            <div key={t.id} className="flex items-center justify-between p-3 rounded-lg border bg-card">
              <div className="flex items-center gap-3 min-w-0">
                {t.color && (
                  <span
                    className="h-3 w-3 rounded-full shrink-0"
                    style={{ backgroundColor: t.color }}
                  />
                )}
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium truncate">{t.name}</span>
                    {t.unit_hint && <Badge variant="outline" className="text-[11px]">{t.unit_hint}</Badge>}
                    {t.archived && <Badge variant="secondary" className="text-[11px]">{isFr ? 'Archivé' : 'Archived'}</Badge>}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <Button variant="ghost" size="icon" onClick={() => openEdit(t)}>
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" onClick={() => setDeleteTarget(t)}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? (isFr ? 'Éditer le type' : 'Edit type') : (isFr ? 'Nouveau type' : 'New type')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1">
              <Label>{isFr ? 'Nom' : 'Name'}</Label>
              <Input
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder={isFr ? 'ex: Rameur, Ski, Poids' : 'e.g. Rower, Ski, Weights'}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>{isFr ? 'Unité (indicative)' : 'Unit hint'}</Label>
                <Input
                  value={form.unit_hint}
                  onChange={e => setForm(f => ({ ...f, unit_hint: e.target.value }))}
                  placeholder="kg, min, m..."
                />
              </div>
              <div className="space-y-1">
                <Label>{isFr ? 'Ordre' : 'Order'}</Label>
                <Input
                  type="number"
                  value={form.display_order}
                  onChange={e => setForm(f => ({ ...f, display_order: parseInt(e.target.value) || 0 }))}
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label>{isFr ? 'Couleur (hex)' : 'Color (hex)'}</Label>
              <Input
                value={form.color}
                onChange={e => setForm(f => ({ ...f, color: e.target.value }))}
                placeholder="#ef4444"
              />
            </div>
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <Label className="text-sm">{isFr ? 'Archivé' : 'Archived'}</Label>
                <p className="text-xs text-muted-foreground">
                  {isFr ? 'Masqué dans les listes mais l\'historique reste' : 'Hidden from lists but history kept'}
                </p>
              </div>
              <Switch
                checked={form.archived}
                onCheckedChange={(checked) => setForm(f => ({ ...f, archived: checked }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>
              {isFr ? 'Annuler' : 'Cancel'}
            </Button>
            <Button onClick={handleSave} disabled={saving || !form.name.trim()}>
              {saving ? '...' : (isFr ? 'Enregistrer' : 'Save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title={isFr ? 'Supprimer ce type ?' : 'Delete this type?'}
        description={isFr
          ? `"${deleteTarget?.name}" sera supprimé. Si des performances l'utilisent, la suppression échouera.`
          : `"${deleteTarget?.name}" will be deleted. If performances reference it, deletion will fail.`}
        variant="destructive"
        onConfirm={handleDelete}
      />
    </div>
  )
}

import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { supabase } from '@/lib/supabase'
import type { ClassType, CreditType } from '@/types'
import { LoadingState } from '@/components/common/LoadingState'
import { EmptyState } from '@/components/common/EmptyState'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
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
import { Dumbbell, Pencil, Plus, Trash2 } from 'lucide-react'
import { ImageUpload } from '@/components/common/ImageUpload'

interface ClassTypeForm {
  name: string
  description: string
  description_md: string
  image_url: string
  credit_type_id: string
  default_max_participants: number
  is_active: boolean
}

const emptyForm: ClassTypeForm = {
  name: '',
  description: '',
  description_md: '',
  image_url: '',
  credit_type_id: '',
  default_max_participants: 4,
  is_active: true,
}

export function AdminClassTypesPage() {
  const { t } = useTranslation()
  const [classTypes, setClassTypes] = useState<ClassType[]>([])
  const [creditTypes, setCreditTypes] = useState<CreditType[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [globalDefaultMax, setGlobalDefaultMax] = useState(4)
  const [editing, setEditing] = useState<ClassType | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<ClassType | null>(null)
  const [form, setForm] = useState<ClassTypeForm>(emptyForm)

  const fetchData = async () => {
    const [ctRes, creditRes] = await Promise.all([
      supabase.from('class_types').select('*, credit_type:credit_types(*)').order('name'),
      supabase.from('credit_types').select('*').order('name'),
    ])
    setClassTypes((ctRes.data as ClassType[]) ?? [])
    setCreditTypes((creditRes.data as CreditType[]) ?? [])
    setLoading(false)
  }

  useEffect(() => {
    fetchData()
    // Fetch global default max participants
    supabase.from('app_settings').select('value').eq('key', 'studio_defaults').single()
      .then(({ data }) => {
        if (data?.value?.default_max_participants) {
          setGlobalDefaultMax(data.value.default_max_participants as number)
        }
      })
  }, [])

  const openAdd = () => {
    setEditing(null)
    setForm({ ...emptyForm, default_max_participants: globalDefaultMax })
    setDialogOpen(true)
  }

  const openEdit = (ct: ClassType) => {
    setEditing(ct)
    setForm({
      name: ct.name,
      description: ct.description ?? '',
      description_md: ct.description_md ?? '',
      image_url: ct.image_url ?? '',
      credit_type_id: ct.credit_type_id,
      default_max_participants: ct.default_max_participants ?? 8,
      is_active: ct.is_active,
    })
    setDialogOpen(true)
  }

  const handleSave = async () => {
    const payload = {
      name: form.name,
      description: form.description || null,
      description_md: form.description_md || null,
      image_url: form.image_url || null,
      credit_type_id: form.credit_type_id,
      default_max_participants: form.default_max_participants,
      is_active: form.is_active,
    }
    if (editing) {
      const { error } = await supabase.from('class_types').update(payload).eq('id', editing.id)
      if (error) { toast.error(t('common.error')); return }
    } else {
      const { error } = await supabase.from('class_types').insert(payload)
      if (error) { toast.error(t('common.error')); return }
    }
    toast.success(t('common.saveSuccess'))
    setDialogOpen(false)
    fetchData()
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    const { error } = await supabase.from('class_types').delete().eq('id', deleteTarget.id)
    if (error) { toast.error(t('common.error')); return }
    toast.success(t('common.deleteSuccess'))
    setDeleteTarget(null)
    fetchData()
  }

  if (loading) return <LoadingState />

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t('admin.classTypes.title')}</h1>
        <Button onClick={openAdd}>
          <Plus className="h-4 w-4 mr-2" />
          {t('admin.classTypes.add')}
        </Button>
      </div>

      {classTypes.length === 0 ? (
        <EmptyState icon={Dumbbell} message={t('common.noResults')} actionLabel={t('admin.classTypes.add')} onAction={openAdd} />
      ) : (
        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('admin.classTypes.name')}</TableHead>
                <TableHead>{t('admin.classTypes.description')}</TableHead>
                <TableHead>{t('admin.classTypes.creditType')}</TableHead>
                <TableHead className="text-center">{t('schedule.defaultMaxParticipants')}</TableHead>
                <TableHead>{t('admin.classTypes.active')}</TableHead>
                <TableHead className="w-[100px]">{t('common.actions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {classTypes.map((ct) => (
                <TableRow key={ct.id}>
                  <TableCell className="font-medium">{ct.name}</TableCell>
                  <TableCell>{ct.description ?? '-'}</TableCell>
                  <TableCell>{ct.credit_type?.label_fr ?? '-'}</TableCell>
                  <TableCell className="text-center font-medium">{ct.default_max_participants ?? '-'}</TableCell>
                  <TableCell>
                    <Badge variant={ct.is_active ? 'default' : 'secondary'}>
                      {ct.is_active ? t('common.active') : t('common.inactive')}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(ct)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => setDeleteTarget(ct)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editing ? t('admin.classTypes.edit') : t('admin.classTypes.add')}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>{t('admin.classTypes.name')}</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div>
              <Label>{t('admin.classTypes.description')}</Label>
              <Textarea
                value={form.description}
                onChange={(e) => setForm(f => ({ ...f, description: e.target.value }))}
              />
            </div>
            <div>
              <Label>Description détaillée (markdown)</Label>
              <Textarea
                value={form.description_md}
                onChange={(e) => setForm(f => ({ ...f, description_md: e.target.value }))}
                rows={5}
                placeholder="Décrivez ce type de cours en détail..."
              />
            </div>
            <div>
              <Label>Photo</Label>
              <ImageUpload
                value={form.image_url || null}
                onChange={(url) => setForm(f => ({ ...f, image_url: url ?? '' }))}
                folder="class-types"
                size="lg"
              />
            </div>
            <div>
              <Label>{t('admin.classTypes.creditType')}</Label>
              <Select
                value={form.credit_type_id}
                onValueChange={(val) => setForm(f => ({ ...f, credit_type_id: val ?? '' }))}
              >
                <SelectTrigger>
                  <span>{creditTypes.find(ct => ct.id === form.credit_type_id)?.label_fr || t('admin.classTypes.creditType')}</span>
                </SelectTrigger>
                <SelectContent>
                  {creditTypes.map(ct => (
                    <SelectItem key={ct.id} value={ct.id}>{ct.label_fr}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>{t('schedule.defaultMaxParticipants')}</Label>
              <Input
                type="number"
                min={1}
                value={form.default_max_participants}
                onChange={(e) => setForm(f => ({ ...f, default_max_participants: parseInt(e.target.value) || 8 }))}
              />
            </div>
            <div className="flex items-center gap-2">
              <Switch
                checked={form.is_active}
                onCheckedChange={(checked) => setForm(f => ({ ...f, is_active: checked }))}
              />
              <Label>{t('admin.classTypes.active')}</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button onClick={handleSave} disabled={!form.name.trim() || !form.credit_type_id}>
              {t('common.save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title={t('admin.classTypes.delete')}
        description={t('common.confirmDelete')}
        onConfirm={handleDelete}
      />
    </div>
  )
}

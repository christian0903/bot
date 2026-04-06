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
  SelectValue,
} from '@/components/ui/select'
import { toast } from 'sonner'
import { Dumbbell, Pencil, Plus, Trash2 } from 'lucide-react'

interface ClassTypeForm {
  name: string
  description: string
  credit_type_id: string
  is_active: boolean
}

const emptyForm: ClassTypeForm = {
  name: '',
  description: '',
  credit_type_id: '',
  is_active: true,
}

export function AdminClassTypesPage() {
  const { t } = useTranslation()
  const [classTypes, setClassTypes] = useState<ClassType[]>([])
  const [creditTypes, setCreditTypes] = useState<CreditType[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
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
  }, [])

  const openAdd = () => {
    setEditing(null)
    setForm(emptyForm)
    setDialogOpen(true)
  }

  const openEdit = (ct: ClassType) => {
    setEditing(ct)
    setForm({
      name: ct.name,
      description: ct.description ?? '',
      credit_type_id: ct.credit_type_id,
      is_active: ct.is_active,
    })
    setDialogOpen(true)
  }

  const handleSave = async () => {
    const payload = {
      name: form.name,
      description: form.description || null,
      credit_type_id: form.credit_type_id,
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
                <TableHead>{t('admin.classTypes.active')}</TableHead>
                <TableHead className="w-[100px]">{t('common.actions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {classTypes.map((ct) => (
                <TableRow key={ct.id}>
                  <TableCell className="font-medium">{ct.name}</TableCell>
                  <TableCell>{ct.description ?? '-'}</TableCell>
                  <TableCell>{ct.credit_type?.name ?? '-'}</TableCell>
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
              <Label>{t('admin.classTypes.creditType')}</Label>
              <Select
                value={form.credit_type_id}
                onValueChange={(val) => setForm(f => ({ ...f, credit_type_id: val ?? '' }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {creditTypes.map(ct => (
                    <SelectItem key={ct.id} value={ct.id}>{ct.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
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

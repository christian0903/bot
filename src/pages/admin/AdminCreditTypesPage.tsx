import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { supabase } from '@/lib/supabase'
import type { CreditType } from '@/types'
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
import { toast } from 'sonner'
import { CreditCard, Pencil, Plus, Trash2 } from 'lucide-react'

export function AdminCreditTypesPage() {
  const { t } = useTranslation()
  const [creditTypes, setCreditTypes] = useState<CreditType[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<CreditType | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<CreditType | null>(null)
  const [form, setForm] = useState({ name: '', label_fr: '', label_en: '' })

  const fetchData = async () => {
    const { data } = await supabase
      .from('credit_types')
      .select('*')
      .order('name')
    setCreditTypes((data as CreditType[]) ?? [])
    setLoading(false)
  }

  useEffect(() => {
    fetchData()
  }, [])

  const openAdd = () => {
    setEditing(null)
    setForm({ name: '', label_fr: '', label_en: '' })
    setDialogOpen(true)
  }

  const openEdit = (ct: CreditType) => {
    setEditing(ct)
    setForm({ name: ct.name, label_fr: ct.label_fr, label_en: ct.label_en })
    setDialogOpen(true)
  }

  const handleSave = async () => {
    const payload = { name: form.name, label_fr: form.label_fr, label_en: form.label_en }
    if (editing) {
      const { error } = await supabase.from('credit_types').update(payload).eq('id', editing.id)
      if (error) { toast.error(t('common.error')); return }
    } else {
      const { error } = await supabase.from('credit_types').insert(payload)
      if (error) { toast.error(t('common.error')); return }
    }
    toast.success(t('common.saveSuccess'))
    setDialogOpen(false)
    fetchData()
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    const { error } = await supabase.from('credit_types').delete().eq('id', deleteTarget.id)
    if (error) { toast.error(t('common.error')); return }
    toast.success(t('common.deleteSuccess'))
    setDeleteTarget(null)
    fetchData()
  }

  if (loading) return <LoadingState />

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t('admin.creditTypes.title')}</h1>
        <Button onClick={openAdd}>
          <Plus className="h-4 w-4 mr-2" />
          {t('admin.creditTypes.add')}
        </Button>
      </div>

      {creditTypes.length === 0 ? (
        <EmptyState icon={CreditCard} message={t('common.noResults')} actionLabel={t('admin.creditTypes.add')} onAction={openAdd} />
      ) : (
        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('admin.creditTypes.name')}</TableHead>
                <TableHead>{t('admin.creditTypes.labelFr')}</TableHead>
                <TableHead>{t('admin.creditTypes.labelEn')}</TableHead>
                <TableHead className="w-[100px]">{t('common.actions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {creditTypes.map((ct) => (
                <TableRow key={ct.id}>
                  <TableCell className="font-medium">{ct.name}</TableCell>
                  <TableCell>{ct.label_fr}</TableCell>
                  <TableCell>{ct.label_en}</TableCell>
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
              {editing ? t('admin.creditTypes.edit') : t('admin.creditTypes.add')}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>{t('admin.creditTypes.name')}</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div>
              <Label>{t('admin.creditTypes.labelFr')}</Label>
              <Input
                value={form.label_fr}
                onChange={(e) => setForm(f => ({ ...f, label_fr: e.target.value }))}
              />
            </div>
            <div>
              <Label>{t('admin.creditTypes.labelEn')}</Label>
              <Input
                value={form.label_en}
                onChange={(e) => setForm(f => ({ ...f, label_en: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button onClick={handleSave} disabled={!form.name.trim() || !form.label_fr.trim() || !form.label_en.trim()}>
              {t('common.save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title={t('admin.creditTypes.delete')}
        description={t('common.confirmDelete')}
        onConfirm={handleDelete}
      />
    </div>
  )
}

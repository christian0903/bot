import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { supabase } from '@/lib/supabase'
import type { PackType, CreditType, MemberCategory } from '@/types'
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
import { Package, Pencil, Plus, Trash2 } from 'lucide-react'

interface PackTypeForm {
  name: string
  description: string
  credit_type_id: string
  credit_count: number
  price_cents: number
  validity_days: number
  is_active: boolean
  category_ids: string[]
}

const emptyForm: PackTypeForm = {
  name: '',
  description: '',
  credit_type_id: '',
  credit_count: 1,
  price_cents: 0,
  validity_days: 30,
  is_active: true,
  category_ids: [],
}

export function AdminPackTypesPage() {
  const { t } = useTranslation()
  const [packTypes, setPackTypes] = useState<PackType[]>([])
  const [creditTypes, setCreditTypes] = useState<CreditType[]>([])
  const [categories, setCategories] = useState<MemberCategory[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<PackType | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<PackType | null>(null)
  const [form, setForm] = useState<PackTypeForm>(emptyForm)

  const fetchData = async () => {
    const [packRes, creditRes, catRes] = await Promise.all([
      supabase.from('pack_types').select('*, credit_type:credit_types(*)').order('name'),
      supabase.from('credit_types').select('*').order('name'),
      supabase.from('member_categories').select('*').order('name'),
    ])
    const packs = (packRes.data as PackType[]) ?? []

    // Fetch category associations for each pack type
    const { data: ptcData } = await supabase.from('pack_type_categories').select('*')
    const ptcMap = new Map<string, string[]>()
    for (const row of ptcData ?? []) {
      const existing = ptcMap.get(row.pack_type_id) ?? []
      existing.push(row.member_category_id)
      ptcMap.set(row.pack_type_id, existing)
    }
    for (const pt of packs) {
      const catIds = ptcMap.get(pt.id) ?? []
      pt.categories = (catRes.data as MemberCategory[])?.filter(c => catIds.includes(c.id)) ?? []
    }

    setPackTypes(packs)
    setCreditTypes((creditRes.data as CreditType[]) ?? [])
    setCategories((catRes.data as MemberCategory[]) ?? [])
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

  const openEdit = (pt: PackType) => {
    setEditing(pt)
    setForm({
      name: pt.name,
      description: pt.description ?? '',
      credit_type_id: pt.credit_type_id,
      credit_count: pt.credit_count,
      price_cents: pt.price_cents,
      validity_days: pt.validity_days,
      is_active: pt.is_active,
      category_ids: pt.categories?.map(c => c.id) ?? [],
    })
    setDialogOpen(true)
  }

  const handleSave = async () => {
    const payload = {
      name: form.name,
      description: form.description || null,
      credit_type_id: form.credit_type_id,
      credit_count: form.credit_count,
      price_cents: form.price_cents,
      validity_days: form.validity_days,
      is_active: form.is_active,
    }

    let packTypeId = editing?.id
    if (editing) {
      const { error } = await supabase.from('pack_types').update(payload).eq('id', editing.id)
      if (error) { toast.error(t('common.error')); return }
    } else {
      const { data, error } = await supabase.from('pack_types').insert(payload).select().single()
      if (error) { toast.error(t('common.error')); return }
      packTypeId = data.id
    }

    // Update junction table
    await supabase.from('pack_type_categories').delete().eq('pack_type_id', packTypeId!)
    if (form.category_ids.length > 0) {
      await supabase.from('pack_type_categories').insert(
        form.category_ids.map(cid => ({ pack_type_id: packTypeId!, member_category_id: cid }))
      )
    }

    toast.success(t('common.saveSuccess'))
    setDialogOpen(false)
    fetchData()
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    await supabase.from('pack_type_categories').delete().eq('pack_type_id', deleteTarget.id)
    const { error } = await supabase.from('pack_types').delete().eq('id', deleteTarget.id)
    if (error) { toast.error(t('common.error')); return }
    toast.success(t('common.deleteSuccess'))
    setDeleteTarget(null)
    fetchData()
  }

  const toggleCategory = (catId: string) => {
    setForm(f => ({
      ...f,
      category_ids: f.category_ids.includes(catId)
        ? f.category_ids.filter(id => id !== catId)
        : [...f.category_ids, catId],
    }))
  }

  if (loading) return <LoadingState />

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t('admin.packTypes.title')}</h1>
        <Button onClick={openAdd}>
          <Plus className="h-4 w-4 mr-2" />
          {t('admin.packTypes.add')}
        </Button>
      </div>

      {packTypes.length === 0 ? (
        <EmptyState icon={Package} message={t('common.noResults')} actionLabel={t('admin.packTypes.add')} onAction={openAdd} />
      ) : (
        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('admin.packTypes.name')}</TableHead>
                <TableHead>{t('admin.packTypes.creditType')}</TableHead>
                <TableHead>{t('admin.packTypes.credits')}</TableHead>
                <TableHead>{t('admin.packTypes.price')}</TableHead>
                <TableHead>{t('admin.packTypes.validity')}</TableHead>
                <TableHead>{t('admin.packTypes.categories')}</TableHead>
                <TableHead>{t('admin.packTypes.active')}</TableHead>
                <TableHead className="w-[100px]">{t('common.actions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {packTypes.map((pt) => (
                <TableRow key={pt.id}>
                  <TableCell className="font-medium">{pt.name}</TableCell>
                  <TableCell>{pt.credit_type?.name ?? '-'}</TableCell>
                  <TableCell>{pt.credit_count}</TableCell>
                  <TableCell>{(pt.price_cents / 100).toFixed(2)} &euro;</TableCell>
                  <TableCell>{pt.validity_days}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {pt.categories?.map(c => (
                        <Badge key={c.id} variant="secondary">{c.name}</Badge>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={pt.is_active ? 'default' : 'secondary'}>
                      {pt.is_active ? t('common.active') : t('common.inactive')}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(pt)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => setDeleteTarget(pt)}>
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
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editing ? t('admin.packTypes.edit') : t('admin.packTypes.add')}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>{t('admin.packTypes.name')}</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div>
              <Label>{t('admin.categories.description')}</Label>
              <Textarea
                value={form.description}
                onChange={(e) => setForm(f => ({ ...f, description: e.target.value }))}
              />
            </div>
            <div>
              <Label>{t('admin.packTypes.creditType')}</Label>
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
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>{t('admin.packTypes.credits')}</Label>
                <Input
                  type="number"
                  min={1}
                  value={form.credit_count}
                  onChange={(e) => setForm(f => ({ ...f, credit_count: parseInt(e.target.value) || 1 }))}
                />
              </div>
              <div>
                <Label>{t('admin.packTypes.price')} (&euro;)</Label>
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  value={(form.price_cents / 100).toFixed(2)}
                  onChange={(e) => setForm(f => ({ ...f, price_cents: Math.round(parseFloat(e.target.value) * 100) || 0 }))}
                />
              </div>
            </div>
            <div>
              <Label>{t('admin.packTypes.validity')}</Label>
              <Input
                type="number"
                min={1}
                value={form.validity_days}
                onChange={(e) => setForm(f => ({ ...f, validity_days: parseInt(e.target.value) || 1 }))}
              />
            </div>
            <div className="flex items-center gap-2">
              <Switch
                checked={form.is_active}
                onCheckedChange={(checked) => setForm(f => ({ ...f, is_active: checked }))}
              />
              <Label>{t('admin.packTypes.active')}</Label>
            </div>
            <div>
              <Label>{t('admin.packTypes.categories')}</Label>
              <div className="flex flex-wrap gap-2 mt-2">
                {categories.map(cat => (
                  <Badge
                    key={cat.id}
                    variant={form.category_ids.includes(cat.id) ? 'default' : 'outline'}
                    className="cursor-pointer"
                    onClick={() => toggleCategory(cat.id)}
                  >
                    {cat.name}
                  </Badge>
                ))}
              </div>
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
        title={t('admin.packTypes.delete')}
        description={t('common.confirmDelete')}
        onConfirm={handleDelete}
      />
    </div>
  )
}

import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { supabase } from '@/lib/supabase'
import { formatEuros } from '@/lib/utils'
import type { Coupon } from '@/types'
import { LoadingState } from '@/components/common/LoadingState'
import { EmptyState } from '@/components/common/EmptyState'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
import { toast } from 'sonner'
import { Pencil, Plus, Ticket, Trash2 } from 'lucide-react'
import { format } from 'date-fns'
import { fr, enUS } from 'date-fns/locale'

interface CouponForm {
  code: string
  discount_percent: string
  discount_amount_cents: string
  max_uses: string
  valid_from: string
  valid_until: string
  is_active: boolean
}

const emptyForm: CouponForm = {
  code: '',
  discount_percent: '',
  discount_amount_cents: '',
  max_uses: '',
  valid_from: '',
  valid_until: '',
  is_active: true,
}

export function AdminCouponsPage() {
  const { t, i18n } = useTranslation()
  const locale = i18n.language === 'fr' ? fr : enUS
  const [coupons, setCoupons] = useState<Coupon[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Coupon | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Coupon | null>(null)
  const [form, setForm] = useState<CouponForm>(emptyForm)

  const fetchData = async () => {
    const { data } = await supabase
      .from('coupons')
      .select('*')
      .order('created_at', { ascending: false })
    setCoupons((data as Coupon[]) ?? [])
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

  const openEdit = (c: Coupon) => {
    setEditing(c)
    setForm({
      code: c.code,
      discount_percent: c.discount_percent?.toString() ?? '',
      discount_amount_cents: c.discount_amount_cents ? formatEuros(c.discount_amount_cents) : '',
      max_uses: c.max_uses?.toString() ?? '',
      valid_from: c.valid_from ? format(new Date(c.valid_from), 'yyyy-MM-dd') : '',
      valid_until: c.valid_until ? format(new Date(c.valid_until), 'yyyy-MM-dd') : '',
      is_active: c.is_active,
    })
    setDialogOpen(true)
  }

  const handleSave = async () => {
    const payload = {
      code: form.code.toUpperCase().trim(),
      discount_percent: form.discount_percent ? parseFloat(form.discount_percent) : null,
      discount_amount_cents: form.discount_amount_cents ? Math.round(parseFloat(form.discount_amount_cents) * 100) : null,
      max_uses: form.max_uses ? parseInt(form.max_uses) : null,
      valid_from: form.valid_from || new Date().toISOString(),
      valid_until: form.valid_until || null,
      is_active: form.is_active,
    }

    if (editing) {
      const { error } = await supabase.from('coupons').update(payload).eq('id', editing.id)
      if (error) { toast.error(t('common.error')); return }
    } else {
      const { error } = await supabase.from('coupons').insert(payload)
      if (error) { toast.error(t('common.error')); return }
    }
    toast.success(t('common.saveSuccess'))
    setDialogOpen(false)
    fetchData()
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    const { error } = await supabase.from('coupons').delete().eq('id', deleteTarget.id)
    if (error) { toast.error(t('common.error')); return }
    toast.success(t('common.deleteSuccess'))
    setDeleteTarget(null)
    fetchData()
  }

  const formatDiscount = (c: Coupon) => {
    if (c.discount_percent) return `${c.discount_percent}%`
    if (c.discount_amount_cents) return `${formatEuros(c.discount_amount_cents)} \u20AC`
    return '-'
  }

  if (loading) return <LoadingState />

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t('admin.coupons.title')}</h1>
        <Button onClick={openAdd}>
          <Plus className="h-4 w-4 mr-2" />
          {t('admin.coupons.add')}
        </Button>
      </div>

      {coupons.length === 0 ? (
        <EmptyState icon={Ticket} message={t('common.noResults')} actionLabel={t('admin.coupons.add')} onAction={openAdd} />
      ) : (
        <div className="border rounded-lg overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('admin.coupons.code')}</TableHead>
                <TableHead>{t('admin.coupons.discount')}</TableHead>
                <TableHead className="hidden sm:table-cell">{t('admin.coupons.uses')}</TableHead>
                <TableHead className="hidden md:table-cell">{t('admin.coupons.validity')}</TableHead>
                <TableHead>{t('admin.coupons.active')}</TableHead>
                <TableHead className="w-[100px]">{t('common.actions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {coupons.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium font-mono">{c.code}</TableCell>
                  <TableCell>{formatDiscount(c)}</TableCell>
                  <TableCell className="hidden sm:table-cell">
                    {c.current_uses}{c.max_uses ? ` / ${c.max_uses}` : ''}
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    {format(new Date(c.valid_from), 'dd/MM/yyyy', { locale })}
                    {c.valid_until ? ` - ${format(new Date(c.valid_until), 'dd/MM/yyyy', { locale })}` : ''}
                  </TableCell>
                  <TableCell>
                    <Badge variant={c.is_active ? 'default' : 'secondary'}>
                      {c.is_active ? t('common.active') : t('common.inactive')}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(c)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => setDeleteTarget(c)}>
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
              {editing ? t('admin.coupons.edit') : t('admin.coupons.add')}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>{t('admin.coupons.code')}</Label>
              <Input
                value={form.code}
                onChange={(e) => setForm(f => ({ ...f, code: e.target.value }))}
                className="font-mono uppercase"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>{t('admin.coupons.discount')} (%)</Label>
                <Input
                  type="number"
                  min={0}
                  max={100}
                  value={form.discount_percent}
                  onChange={(e) => setForm(f => ({ ...f, discount_percent: e.target.value, discount_amount_cents: '' }))}
                  placeholder="10"
                />
              </div>
              <div>
                <Label>{t('admin.coupons.discount')} (&euro;)</Label>
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  value={form.discount_amount_cents}
                  onChange={(e) => setForm(f => ({ ...f, discount_amount_cents: e.target.value, discount_percent: '' }))}
                  placeholder="5.00"
                />
              </div>
            </div>
            <div>
              <Label>{t('admin.coupons.uses')} (max)</Label>
              <Input
                type="number"
                min={1}
                value={form.max_uses}
                onChange={(e) => setForm(f => ({ ...f, max_uses: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>{t('admin.coupons.validity')} (from)</Label>
                <Input
                  type="date"
                  value={form.valid_from}
                  onChange={(e) => setForm(f => ({ ...f, valid_from: e.target.value }))}
                />
              </div>
              <div>
                <Label>{t('admin.coupons.validity')} (until)</Label>
                <Input
                  type="date"
                  value={form.valid_until}
                  onChange={(e) => setForm(f => ({ ...f, valid_until: e.target.value }))}
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                checked={form.is_active}
                onCheckedChange={(checked) => setForm(f => ({ ...f, is_active: checked }))}
              />
              <Label>{t('admin.coupons.active')}</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button onClick={handleSave} disabled={!form.code.trim()}>
              {t('common.save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title={t('admin.coupons.delete')}
        description={t('common.confirmDelete')}
        onConfirm={handleDelete}
      />
    </div>
  )
}

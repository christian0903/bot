import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { supabase } from '@/lib/supabase'
import { formatEuros, daysToWeeks, weeksToDays, formatValidity } from '@/lib/utils'
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

} from '@/components/ui/select'
import { toast } from 'sonner'
import { Package, Pencil, Plus, Trash2, RefreshCw } from 'lucide-react'

interface PackTypeForm {
  name: string
  description: string
  credit_type_id: string
  credit_count: number
  price_euros: string
  /** Saisi en semaines ; converti en jours (validity_days) a l'enregistrement. */
  validity_weeks: number
  is_unlimited: boolean
  is_recurring: boolean
  recurring_interval: 'day' | 'week' | 'month'
  recurring_interval_count: number
  is_active: boolean
  category_ids: string[]
}

const emptyForm: PackTypeForm = {
  name: '',
  description: '',
  credit_type_id: '',
  credit_count: 1,
  price_euros: '',
  validity_weeks: 4,
  is_unlimited: false,
  is_recurring: false,
  // 4 semaines par défaut : le cycle retenu pour les abonnements du studio.
  recurring_interval: 'week',
  recurring_interval_count: 4,
  is_active: true,
  category_ids: [],
}

export function AdminPackTypesPage() {
  const { t, i18n } = useTranslation()
  const isFr = i18n.language === 'fr'
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
      price_euros: (pt.price_cents / 100).toString(),
      validity_weeks: daysToWeeks(pt.validity_days),
      is_unlimited: pt.is_unlimited,
      is_recurring: pt.is_recurring,
      recurring_interval: pt.recurring_interval ?? 'week',
      recurring_interval_count: pt.recurring_interval_count ?? 4,
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
      // Sur un pack illimité, credit_count n'est jamais consommé — mais la
      // contrainte CHECK (credit_count > 0) impose une valeur.
      credit_count: form.is_unlimited ? 1 : form.credit_count,
      price_cents: Math.round(parseFloat(form.price_euros || '0') * 100),
      // L'interface parle en semaines, la base stocke des jours
      validity_days: weeksToDays(form.validity_weeks),
      is_unlimited: form.is_unlimited,
      is_recurring: form.is_recurring,
      // La contrainte pack_types_recurring_coherent impose une périodicité
      // renseignée si récurrent — et rien de résiduel sinon.
      recurring_interval: form.is_recurring ? form.recurring_interval : null,
      recurring_interval_count: form.is_recurring ? form.recurring_interval_count : null,
      is_active: form.is_active,
    }

    // Un Price Stripe est immuable : son montant et sa périodicité ne peuvent
    // pas être modifiés après création. Si l'un des deux change, on efface les
    // identifiants mémorisés pour qu'un nouveau Price soit créé au prochain
    // achat. Les abonnements déjà souscrits gardent l'ancien prix — c'est le
    // comportement attendu : on ne change pas le tarif de quelqu'un sans le
    // prévenir.
    const priceOrIntervalChanged = editing && (
      editing.price_cents !== payload.price_cents ||
      editing.recurring_interval !== payload.recurring_interval ||
      editing.recurring_interval_count !== payload.recurring_interval_count
    )
    if (priceOrIntervalChanged) {
      Object.assign(payload, { stripe_price_id_test: null, stripe_price_id_live: null })
    }

    let packTypeId = editing?.id
    if (editing) {
      const { error } = await supabase.from('pack_types').update(payload).eq('id', editing.id)
      if (error) { console.error('pack_types update', error); toast.error(error.message); return }
    } else {
      const { data, error } = await supabase.from('pack_types').insert(payload).select().single()
      if (error) { console.error('pack_types insert', error); toast.error(error.message); return }
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

  // Abonnements d'abord, packs ponctuels ensuite — même ordre que la page
  // client, pour que l'admin voie son catalogue tel que le membre le verra.
  // Les en-têtes sont des lignes du tableau : pas de sous-tableaux, pas de
  // colonnes qui se désalignent.
  // Type de crédit en premier niveau : c'est lui qui détermine quels cours un
  // pack permet de réserver. Un pack créé sur le mauvais type devient
  // inutilisable sans que rien ne le signale.
  type Row =
    | { kind: 'creditType'; key: string; label: string; count: number }
    | { kind: 'header'; key: string; recurring: boolean; count: number }
    | { kind: 'pack'; pt: PackType }

  const groupedPackTypes: Row[] = (() => {
    const byType = new Map<string, { label: string; packs: PackType[] }>()
    for (const pt of packTypes) {
      const key = pt.credit_type_id
      const label = (isFr ? pt.credit_type?.label_fr : pt.credit_type?.label_en)
        ?? pt.credit_type?.name ?? (isFr ? 'Sans type' : 'No type')
      if (!byType.has(key)) byType.set(key, { label, packs: [] })
      byType.get(key)!.packs.push(pt)
    }

    const rows: Row[] = []
    for (const [key, group] of [...byType.entries()].sort((a, b) => a[1].label.localeCompare(b[1].label))) {
      rows.push({ kind: 'creditType', key: `ct-${key}`, label: group.label, count: group.packs.length })
      const recurring = group.packs.filter(p => p.is_recurring)
      const oneOff = group.packs.filter(p => !p.is_recurring)
      if (recurring.length > 0) {
        rows.push({ kind: 'header', key: `h-sub-${key}`, recurring: true, count: recurring.length })
        rows.push(...recurring.map(pt => ({ kind: 'pack', pt } as Row)))
      }
      if (oneOff.length > 0) {
        rows.push({ kind: 'header', key: `h-one-${key}`, recurring: false, count: oneOff.length })
        rows.push(...oneOff.map(pt => ({ kind: 'pack', pt } as Row)))
      }
    }
    return rows
  })()

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
        <div className="border rounded-lg overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('admin.packTypes.name')}</TableHead>
                <TableHead className="hidden lg:table-cell">{t('admin.packTypes.creditType')}</TableHead>
                <TableHead className="hidden sm:table-cell">{t('admin.packTypes.credits')}</TableHead>
                <TableHead>{t('admin.packTypes.price')}</TableHead>
                <TableHead className="hidden md:table-cell">{t('admin.packTypes.validity')}</TableHead>
                <TableHead className="hidden xl:table-cell">{t('admin.packTypes.categories')}</TableHead>
                <TableHead>{t('admin.packTypes.active')}</TableHead>
                <TableHead className="w-[100px]">{t('common.actions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {groupedPackTypes.map((entry) => entry.kind === 'creditType' ? (
                <TableRow key={entry.key} className="bg-primary/5 hover:bg-primary/5 border-t-2">
                  <TableCell colSpan={8} className="py-2.5">
                    <span className="flex items-center gap-2 text-sm font-bold">
                      {entry.label}
                      <span className="font-normal text-xs text-muted-foreground">
                        ({entry.count})
                      </span>
                    </span>
                  </TableCell>
                </TableRow>
              ) : entry.kind === 'header' ? (
                <TableRow key={entry.key} className="bg-muted/50 hover:bg-muted/50">
                  <TableCell colSpan={8} className="py-2">
                    <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      {entry.recurring
                        ? <><RefreshCw className="h-3.5 w-3.5" />{isFr ? 'Abonnements' : 'Subscriptions'}</>
                        : <><Package className="h-3.5 w-3.5" />{isFr ? 'Packs à l\'unité' : 'One-off packs'}</>}
                      <span className="font-normal normal-case">({entry.count})</span>
                    </span>
                  </TableCell>
                </TableRow>
              ) : (
                <TableRow key={entry.pt.id}>
                  {(() => { const pt = entry.pt; return <>
                  <TableCell className="font-medium">{pt.name}</TableCell>
                  <TableCell className="hidden lg:table-cell">{pt.credit_type?.label_fr ?? '-'}</TableCell>
                  <TableCell className="hidden sm:table-cell">{pt.is_unlimited ? '∞' : pt.credit_count}</TableCell>
                  <TableCell>{formatEuros(pt.price_cents)}</TableCell>
                  <TableCell className="hidden md:table-cell">
                    {formatValidity(pt.validity_days, isFr)}
                    {pt.is_recurring && pt.recurring_interval_count && (
                      <Badge variant="secondary" className="ml-1.5 text-[10px]">
                        {isFr ? 'tous les' : 'every'} {pt.recurring_interval_count}{' '}
                        {pt.recurring_interval === 'day' ? (isFr ? 'j' : 'd')
                          : pt.recurring_interval === 'month' ? (isFr ? 'mois' : 'mo')
                            : (isFr ? 'sem' : 'wk')}
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="hidden xl:table-cell">
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
                  </> })()}
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
                  <span>{creditTypes.find(ct => ct.id === form.credit_type_id)?.label_fr || t('admin.packTypes.creditType')}</span>
                </SelectTrigger>
                <SelectContent>
                  {creditTypes.map(ct => (
                    <SelectItem key={ct.id} value={ct.id}>{ct.label_fr}</SelectItem>
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
                  disabled={form.is_unlimited}
                  value={form.is_unlimited ? '' : form.credit_count}
                  placeholder={form.is_unlimited ? '∞' : undefined}
                  onChange={(e) => setForm(f => ({ ...f, credit_count: parseInt(e.target.value) || 1 }))}
                />
              </div>
              <div>
                <Label>{t('admin.packTypes.price')} (€)</Label>
                <Input
                  type="number"
                  min={0}
                  placeholder="250"
                  value={form.price_euros}
                  onChange={(e) => setForm(f => ({ ...f, price_euros: e.target.value }))}
                />
              </div>
            </div>
            <div>
              <Label>{t('admin.packTypes.validity')}</Label>
              <Input
                type="number"
                min={1}
                value={form.validity_weeks}
                onChange={(e) => setForm(f => ({ ...f, validity_weeks: parseInt(e.target.value) || 1 }))}
              />
              <p className="text-[11px] text-muted-foreground mt-1">
                = {weeksToDays(form.validity_weeks)} {isFr ? 'jours' : 'days'}
              </p>
            </div>
            {/* Abonnement : renouvellement automatique par Stripe */}
            <div className="rounded-lg border p-3 space-y-3">
              <div className="flex items-center gap-2">
                <Switch
                  checked={form.is_recurring}
                  onCheckedChange={(checked) => setForm(f => ({ ...f, is_recurring: checked }))}
                />
                <div>
                  <Label>{isFr ? 'Abonnement (paiement récurrent)' : 'Subscription (recurring payment)'}</Label>
                  <p className="text-xs text-muted-foreground">
                    {isFr
                      ? 'Le pack se renouvelle et se paie automatiquement à chaque échéance.'
                      : 'The pack renews and is charged automatically at each cycle.'}
                  </p>
                </div>
              </div>

              {form.is_recurring && (
                <div className="space-y-2 pl-1">
                  <Label>{isFr ? 'Prélèvement tous les' : 'Charge every'}</Label>
                  <div className="flex gap-2 items-center">
                    <Input
                      type="number"
                      min={1}
                      className="w-20"
                      value={form.recurring_interval_count}
                      onChange={(e) => setForm(f => ({ ...f, recurring_interval_count: parseInt(e.target.value) || 1 }))}
                    />
                    <Select
                      value={form.recurring_interval}
                      onValueChange={(val) =>
                        setForm(f => ({ ...f, recurring_interval: (val as 'day' | 'week' | 'month') ?? 'week' }))
                      }
                    >
                      <SelectTrigger className="w-40">
                        <span>
                          {form.recurring_interval === 'day'
                            ? (isFr ? 'jours' : 'days')
                            : form.recurring_interval === 'month'
                              ? (isFr ? 'mois' : 'months')
                              : (isFr ? 'semaines' : 'weeks')}
                        </span>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="day">{isFr ? 'jours' : 'days'}</SelectItem>
                        <SelectItem value="week">{isFr ? 'semaines' : 'weeks'}</SelectItem>
                        <SelectItem value="month">{isFr ? 'mois' : 'months'}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* 4 semaines ≠ 1 mois : 13 échéances par an au lieu de 12 */}
                  {form.recurring_interval === 'week' && form.recurring_interval_count === 4 && (
                    <p className="text-[11px] text-amber-600 dark:text-amber-400">
                      {isFr
                        ? '28 jours fixes, soit 13 prélèvements par an (et non 12). À annoncer au membre comme « toutes les 4 semaines », jamais « par mois ».'
                        : '28 fixed days = 13 charges per year (not 12). Communicate it as "every 4 weeks", never "monthly".'}
                    </p>
                  )}

                  {form.validity_weeks * 7 !== (
                    form.recurring_interval === 'week' ? form.recurring_interval_count * 7
                      : form.recurring_interval === 'day' ? form.recurring_interval_count
                        : form.recurring_interval_count * 30
                  ) && (
                    <p className="text-[11px] text-destructive">
                      {isFr
                        ? `La validité (${form.validity_weeks} sem.) ne correspond pas au cycle de prélèvement : les crédits expireraient avant ou après le renouvellement.`
                        : `Validity (${form.validity_weeks} wk) does not match the billing cycle: credits would expire before or after renewal.`}
                    </p>
                  )}
                </div>
              )}
            </div>

            <div className="flex items-center gap-2">
              <Switch
                checked={form.is_unlimited}
                onCheckedChange={(checked) => setForm(f => ({ ...f, is_unlimited: checked }))}
              />
              <div>
                <Label>{t('admin.packTypes.unlimited')}</Label>
                <p className="text-xs text-muted-foreground">{t('admin.packTypes.unlimitedHint')}</p>
              </div>
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

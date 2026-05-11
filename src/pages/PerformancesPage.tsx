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
import { Activity, Plus, Pencil, Trash2, Settings, ChevronLeft, ChevronRight, Trophy } from 'lucide-react'
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, addDays, addWeeks, addMonths, isWithinInterval } from 'date-fns'
import { fr, enUS } from 'date-fns/locale'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'

type Period = 'day' | 'week' | 'month'

function parseLeadingNumber(value: string): number | null {
  // Handles "13 kg", "250 kg", "1500m", and m:ss / h:mm:ss durations
  const trimmed = value.trim()
  const timeMatch = trimmed.match(/^(\d+):(\d{1,2})(?::(\d{1,2}))?/)
  if (timeMatch) {
    const a = parseInt(timeMatch[1] ?? '0', 10)
    const b = parseInt(timeMatch[2] ?? '0', 10)
    const c = timeMatch[3] ? parseInt(timeMatch[3], 10) : null
    return c == null ? a + b / 60 : a * 60 + b + c / 60
  }
  const m = trimmed.match(/^-?\d+(?:[.,]\d+)?/)
  return m ? parseFloat(m[0].replace(',', '.')) : null
}

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

  const [period, setPeriod] = useState<Period>('week')
  const [anchorDate, setAnchorDate] = useState<Date>(new Date())

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

  const selectedType = useMemo(
    () => types.find(t => t.id === filterTypeId),
    [types, filterTypeId],
  )

  const periodRange = useMemo(() => {
    if (period === 'day') {
      return { start: anchorDate, end: anchorDate }
    }
    if (period === 'week') {
      return {
        start: startOfWeek(anchorDate, { weekStartsOn: 1 }),
        end: endOfWeek(anchorDate, { weekStartsOn: 1 }),
      }
    }
    return { start: startOfMonth(anchorDate), end: endOfMonth(anchorDate) }
  }, [period, anchorDate])

  const periodLabel = useMemo(() => {
    const { start, end } = periodRange
    if (period === 'day') return format(start, 'EEEE dd MMMM yyyy', { locale })
    if (period === 'week') return `${format(start, 'dd', { locale })} - ${format(end, 'dd MMM yyyy', { locale })}`
    return format(start, 'MMMM yyyy', { locale })
  }, [periodRange, period, locale])

  // chartData: per-day MAX of numeric value, within periodRange
  const chartData = useMemo(() => {
    if (!filterTypeId) return []
    const { start, end } = periodRange
    const inRange = filteredPerformances.filter(p => {
      const d = new Date(p.date + 'T00:00:00')
      return isWithinInterval(d, { start, end })
    })

    if (period === 'day') {
      // one bar per entry (sorted chronologically by created_at)
      return inRange
        .slice()
        .sort((a, b) => a.created_at.localeCompare(b.created_at))
        .map((p, i) => {
          const n = parseLeadingNumber(p.value)
          return { label: `#${i + 1}`, value: n ?? 0, rawValue: p.value }
        })
    }

    // week/month: max per day
    const byDay = new Map<string, { date: string; max: number; raw: string }>()
    for (const p of inRange) {
      const n = parseLeadingNumber(p.value)
      if (n == null) continue
      const existing = byDay.get(p.date)
      if (!existing || n > existing.max) {
        byDay.set(p.date, { date: p.date, max: n, raw: p.value })
      }
    }

    // fill missing days with 0 for steady X axis
    const days: { date: string; max: number; raw: string }[] = []
    const dayCount = Math.round((end.getTime() - start.getTime()) / 86400000) + 1
    for (let i = 0; i < dayCount; i++) {
      const d = addDays(start, i)
      const key = format(d, 'yyyy-MM-dd')
      const found = byDay.get(key)
      days.push({ date: key, max: found?.max ?? 0, raw: found?.raw ?? '' })
    }
    return days.map(d => ({
      label: format(new Date(d.date + 'T00:00:00'), period === 'week' ? 'EEE' : 'dd', { locale }),
      value: d.max,
      rawValue: d.raw,
      date: d.date,
    }))
  }, [filterTypeId, filteredPerformances, periodRange, period, locale])

  const periodSummary = useMemo(() => {
    if (!filterTypeId) return null
    const { start, end } = periodRange
    const entries = filteredPerformances.filter(p => {
      const d = new Date(p.date + 'T00:00:00')
      return isWithinInterval(d, { start, end })
    })
    const numericValues = entries
      .map(p => ({ p, n: parseLeadingNumber(p.value) }))
      .filter(x => x.n != null) as { p: Performance; n: number }[]
    const best = numericValues.reduce<{ p: Performance; n: number } | null>(
      (acc, x) => (acc && acc.n >= x.n ? acc : x),
      null,
    )
    return { count: entries.length, best }
  }, [filterTypeId, filteredPerformances, periodRange])

  const shiftPeriod = (direction: 1 | -1) => {
    if (period === 'day') setAnchorDate(addDays(anchorDate, direction))
    else if (period === 'week') setAnchorDate(addWeeks(anchorDate, direction))
    else setAnchorDate(addMonths(anchorDate, direction))
  }

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
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Activity className="h-6 w-6 shrink-0" />
            {isFr ? 'Mes performances' : 'My performances'}
          </h1>
          <p className="text-sm text-muted-foreground hidden sm:block">
            {isFr ? 'Enregistre tes scores et suis ta progression.' : 'Log your scores and follow your progress.'}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {canManageTypes && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate('/performance-types')}
              title={isFr ? 'Gérer les types' : 'Manage types'}
            >
              <Settings className="h-4 w-4 sm:mr-1" />
              <span className="hidden sm:inline">{isFr ? 'Gérer les types' : 'Manage types'}</span>
            </Button>
          )}
          <Button size="sm" onClick={openCreate} disabled={activeTypes.length === 0}>
            <Plus className="h-4 w-4 sm:mr-1" />
            <span className="hidden sm:inline">{isFr ? 'Nouvelle' : 'New'}</span>
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

      {filterTypeId && selectedType && (
        <Card>
          <CardContent className="p-3 sm:p-4 space-y-3">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2 min-w-0">
                {selectedType.color && (
                  <span className="h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: selectedType.color }} />
                )}
                <span className="font-semibold truncate">{selectedType.name}</span>
                {selectedType.unit_hint && (
                  <Badge variant="outline" className="text-[11px] shrink-0">{selectedType.unit_hint}</Badge>
                )}
              </div>
              <div className="inline-flex rounded-md border bg-muted/30 p-0.5 text-xs shrink-0">
                {(['day', 'week', 'month'] as Period[]).map(p => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => { setPeriod(p); setAnchorDate(new Date()) }}
                    className={
                      'px-2 py-1 rounded transition-colors ' +
                      (period === p ? 'bg-background shadow-sm font-medium' : 'text-muted-foreground hover:text-foreground')
                    }
                  >
                    {isFr
                      ? (p === 'day' ? 'Jour' : p === 'week' ? 'Sem.' : 'Mois')
                      : (p === 'day' ? 'Day' : p === 'week' ? 'Week' : 'Month')}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between">
              <Button variant="ghost" size="icon" onClick={() => shiftPeriod(-1)}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-sm font-medium capitalize">{periodLabel}</span>
              <Button variant="ghost" size="icon" onClick={() => shiftPeriod(1)}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>

            {chartData.length === 0 || chartData.every(d => d.value === 0) ? (
              <p className="text-sm text-muted-foreground text-center py-6">
                {isFr ? 'Aucune performance sur cette période' : 'No performance in this period'}
              </p>
            ) : (
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 4 }}>
                  <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} width={32} />
                  <Tooltip
                    contentStyle={{ fontSize: 12 }}
                    formatter={(v, _name, props) => {
                      const raw = (props?.payload as { rawValue?: string } | undefined)?.rawValue
                      return [raw || String(v), selectedType.name]
                    }}
                    labelFormatter={() => ''}
                  />
                  <Bar
                    dataKey="value"
                    fill={selectedType.color || 'var(--color-primary)'}
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            )}

            <div className="grid grid-cols-2 gap-2 pt-1">
              <div className="rounded-lg border p-2 text-center">
                <p className="text-xs text-muted-foreground">{isFr ? 'Entrées' : 'Entries'}</p>
                <p className="text-xl font-bold">{periodSummary?.count ?? 0}</p>
              </div>
              <div className="rounded-lg border p-2 text-center">
                <p className="text-xs text-muted-foreground flex items-center justify-center gap-1">
                  <Trophy className="h-3 w-3" />
                  {isFr ? 'Meilleur' : 'Best'}
                </p>
                <p className="text-xl font-bold truncate">
                  {periodSummary?.best ? periodSummary.best.p.value : '—'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {filteredPerformances.length === 0 ? (
        <EmptyState
          icon={Activity}
          message={isFr ? 'Aucune performance enregistrée' : 'No performance recorded'}
        />
      ) : (
        <div className="space-y-2">
          {filteredPerformances.map(p => (
            <Card key={p.id}>
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
                  <div className="text-xs text-muted-foreground mt-0.5 break-words">
                    <span className="sm:hidden">{format(new Date(p.date), 'dd MMM yyyy', { locale })}</span>
                    <span className="hidden sm:inline">{format(new Date(p.date), 'EEEE dd MMMM yyyy', { locale })}</span>
                    {p.notes && <span className="ml-1">— {p.notes}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-0.5 shrink-0">
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(p)}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setDeleteTarget(p)}>
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

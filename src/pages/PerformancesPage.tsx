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
import { cn } from '@/lib/utils'
import { Activity, Plus, Pencil, Trash2, Settings, Trophy, Target } from 'lucide-react'
import { format } from 'date-fns'
import { fr, enUS } from 'date-fns/locale'
import { LineChart, Line, CartesianGrid, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'

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
  const { user, profile, hasRole } = useAuth()
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
  /** Chrono saisi en deux champs : « 1:55 » ne se tape plus à la main. */
  const [timeMin, setTimeMin] = useState('')
  const [timeSec, setTimeSec] = useState('')

  /** Nature du mouvement en cours de saisie : commande la forme du formulaire. */
  const formKind = types.find(t => t.id === form.performance_type_id)?.measure_kind ?? 'number'
  /** Unité affichée à côté du champ. Vient du type, jamais de la frappe. */
  const selectedUnit = types.find(t => t.id === form.performance_type_id)?.unit_hint ?? ''

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

  /**
   * Mouvement affiché par défaut : le plus suivi.
   *
   * Le graphique demande un mouvement. Sans cela, la page s'ouvrait sur une
   * simple liste et le membre ne découvrait la courbe qu'en cliquant au
   * hasard sur un filtre.
   *
   * Calculé au rendu plutôt que posé dans un effet : écrire un état depuis un
   * effet provoque un second rendu en cascade, pour un résultat qu'on sait
   * déduire directement.
   */
  const defaultTypeId = useMemo(() => {
    if (performances.length === 0 || activeTypes.length === 0) return ''
    // Un mouvement archivé n'a pas de bouton de filtre : le choisir
    // afficherait une courbe que le membre ne pourrait plus quitter.
    const selectable = new Set(activeTypes.map(t => t.id))
    const counts = new Map<string, number>()
    for (const p of performances) {
      if (p.value_num === null || p.value_num === undefined) continue
      if (!selectable.has(p.performance_type_id)) continue
      counts.set(p.performance_type_id, (counts.get(p.performance_type_id) ?? 0) + 1)
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? ''
  }, [performances, activeTypes])

  /** Sélection effective : le choix du membre, ou le mouvement par défaut. */
  const shownTypeId = filterTypeId || defaultTypeId

  const filteredPerformances = useMemo(
    () => (shownTypeId ? performances.filter(p => p.performance_type_id === shownTypeId) : performances),
    [performances, shownTypeId],
  )

  const selectedType = useMemo(
    () => types.find(t => t.id === shownTypeId),
    [types, shownTypeId],
  )

  /**
   * La courbe de progression : toutes les mesures du mouvement, dans l'ordre.
   *
   * Elle ne se limite plus à la période affichée. Une progression se lit sur
   * la durée — un squat qui passe de 35 à 60 kg en cinq mois ne se voit pas
   * sur une semaine.
   *
   * Les jours sans mesure ne sont plus comblés par des zéros : sur un chrono,
   * un « 0 seconde » écrasait toute l'échelle et rendait la courbe illisible.
   * Un point par mesure, espacé selon sa date.
   */
  const chartData = useMemo(() => {
    if (!shownTypeId) return []
    return filteredPerformances
      .filter(p => p.value_num !== null && p.value_num !== undefined)
      .slice()
      .sort((a, b) => a.date.localeCompare(b.date))
      .map(p => ({
        label: format(new Date(p.date + 'T00:00:00'), 'dd/MM', { locale }),
        value: Number(p.value_num),
        rawValue: p.value,
        date: p.date,
      }))
  }, [shownTypeId, filteredPerformances, locale])

  /**
   * Ce que la courbe raconte : record, progression, dernière mesure.
   *
   * Le sens du progrès vient du type de mouvement. Chercher le maximum sur un
   * chrono désignerait la pire performance comme record — c'est ce que faisait
   * le code précédent.
   */
  const progression = useMemo(() => {
    if (!selectedType || chartData.length === 0) return null

    const lowerIsBetter = selectedType.lower_is_better
    const values = chartData.map(d => d.value)
    const first = chartData[0]
    const last = chartData[chartData.length - 1]

    const bestValue = lowerIsBetter ? Math.min(...values) : Math.max(...values)
    const best = chartData.find(d => d.value === bestValue)!

    // Écart entre la première et la dernière mesure, exprimé dans le sens du
    // progrès : positif = amélioration, quel que soit le type de mesure.
    const rawDelta = last.value - first.value
    const gain = lowerIsBetter ? -rawDelta : rawDelta

    return {
      count: chartData.length,
      first,
      last,
      best,
      gain,
      isRecord: last.value === bestValue && chartData.length > 1,
      since: format(new Date(first.date + 'T00:00:00'), 'MMMM yyyy', { locale }),
    }
  }, [selectedType, chartData, locale])

  /** Met en forme un écart selon la nature de la mesure. */
  const formatGain = (gain: number): string => {
    const kind = selectedType?.measure_kind
    const sign = gain > 0 ? '+' : ''
    if (kind === 'time') {
      // Un écart de temps se lit en secondes tant qu'il reste court.
      const abs = Math.abs(gain)
      const txt = abs >= 60
        ? `${Math.floor(abs / 60)} min ${String(Math.round(abs % 60)).padStart(2, '0')} s`
        : `${Math.round(abs)} s`
      return gain > 0 ? `−${txt}` : `+${txt}`
    }
    const unit = selectedType?.unit_hint ?? ''
    return `${sign}${Number(gain.toFixed(1))} ${unit}`.trim()
  }

  /** Affiche une valeur brute selon la nature : « 1:55 » ou « 50 kg ». */
  const formatValue = (n: number): string => {
    if (selectedType?.measure_kind === 'time') {
      const m = Math.floor(n / 60)
      const s = Math.round(n % 60)
      return `${m}:${String(s).padStart(2, '0')}`
    }
    const unit = selectedType?.unit_hint ?? ''
    return `${Number(n.toFixed(1))} ${unit}`.trim()
  }

  const openCreate = () => {
    setEditing(null)
    setTimeMin('')
    setTimeSec('')
    setForm({
      ...emptyForm,
      performance_type_id: activeTypes[0]?.id ?? '',
      date: todayISO(),
    })
    setDialogOpen(true)
  }

  const openEdit = (p: Performance) => {
    setEditing(p)
    const kind = types.find(t => t.id === p.performance_type_id)?.measure_kind ?? 'number'

    if (kind === 'time') {
      // On repart du nombre quand il existe : le texte a pu être saisi dans
      // l'ancien format libre, et n'est pas toujours redécoupable.
      const total = p.value_num ?? null
      if (total !== null) {
        setTimeMin(String(Math.floor(total / 60)))
        setTimeSec(String(Math.round(total % 60)).padStart(2, '0'))
      } else {
        const m = p.value.match(/^(\d+):([0-5]\d)$/)
        setTimeMin(m?.[1] ?? '')
        setTimeSec(m?.[2] ?? '')
      }
    } else {
      setTimeMin('')
      setTimeSec('')
    }

    setForm({
      performance_type_id: p.performance_type_id,
      date: p.date,
      // Le champ numérique n'accepte pas « 50 kg » : on lui donne le nombre.
      value: p.value_num !== null && p.value_num !== undefined
        ? String(p.value_num)
        : p.value.replace(/[^\d.,]/g, '').replace(',', '.'),
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

    // Deux formes produites ensemble : le texte, lisible et affiché tel quel,
    // et le nombre, qui sert aux courbes et aux records. Les calculer ici
    // garantit qu'ils ne divergent jamais.
    let valueText: string
    let valueNum: number | null

    if (formKind === 'time') {
      const m = parseInt(timeMin || '0', 10)
      const s = parseInt(timeSec || '0', 10)
      if (Number.isNaN(m) || Number.isNaN(s) || (m === 0 && s === 0)) {
        toast.error(isFr ? 'Indique un temps' : 'Enter a time')
        return
      }
      if (s > 59) {
        toast.error(isFr ? 'Les secondes vont de 0 à 59' : 'Seconds must be 0–59')
        return
      }
      valueNum = m * 60 + s
      valueText = `${m}:${String(s).padStart(2, '0')}`
    } else {
      const raw = form.value.trim().replace(',', '.')
      const n = Number(raw)
      if (!raw || Number.isNaN(n) || n < 0) {
        toast.error(isFr ? 'Indique une valeur chiffrée' : 'Enter a numeric value')
        return
      }
      valueNum = n
      // L'unité vient du type, jamais de la frappe : c'est ce mélange qui
      // rendait « 50 kg », « 6kg » et « 22,5 » incomparables.
      valueText = selectedUnit ? `${raw} ${selectedUnit}` : raw
    }

    setSaving(true)
    const payload = {
      performance_type_id: form.performance_type_id,
      date: form.date,
      value: valueText,
      value_num: valueNum,
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

      {/* L'objectif du membre, rappelé au moment de noter un score.
          Il vit dans le profil, un écran qu'on ouvre à l'inscription puis
          presque jamais : le relire ici, c'est se souvenir de ce qu'on mesure
          et pourquoi. Le même quel que soit le mouvement — c'est un cap, pas
          une consigne d'exercice. */}
      <Card className={profile?.objectives ? 'border-primary/20 bg-primary/5' : 'border-dashed'}>
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <div className={cn(
              'h-8 w-8 rounded-lg flex items-center justify-center shrink-0',
              profile?.objectives ? 'bg-primary/10' : 'bg-muted',
            )}>
              <Target className={cn(
                'h-4 w-4',
                profile?.objectives ? 'text-primary' : 'text-muted-foreground',
              )} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                {isFr ? 'Mon objectif' : 'My goal'}
              </p>
              {profile?.objectives ? (
                /* whitespace-pre-line : le champ est un textarea, ses retours à
                   la ligne font partie de ce que le membre a écrit. */
                <p className="text-sm mt-0.5 whitespace-pre-line">{profile.objectives}</p>
              ) : (
                /* Un objectif vide ne laisse pas un blanc : la carte devient
                   l'invitation à le remplir, au moment précis où il servirait —
                   devant ses propres chiffres. Le profil est un écran qu'on
                   ouvre à l'inscription puis presque plus jamais. */
                <p className="text-sm mt-0.5 text-muted-foreground">
                  {isFr
                    ? 'Vous n\'avez pas encore noté votre objectif. Le définir aide à situer vos progrès.'
                    : 'You have not set a goal yet. Defining one helps put your progress in context.'}
                </p>
              )}
              {/* Le bouton reste dans les deux cas : un objectif se révise en
                  cours de route, et le chemin pour le faire ne doit pas
                  disparaître une fois qu'il est rempli. */}
              <Button
                variant="outline"
                size="sm"
                className="mt-2"
                onClick={() => navigate('/profile')}
              >
                <Pencil className="h-3.5 w-3.5 mr-1.5" />
                {profile?.objectives
                  ? (isFr ? 'Modifier mon objectif' : 'Edit my goal')
                  : (isFr ? 'Compléter mon objectif' : 'Set my goal')}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {activeTypes.length === 0 && (
        <Card>
          <CardContent className="pt-6 text-center text-sm text-muted-foreground">
            {isFr
              ? 'Aucun type de performance disponible. Demande à un coach de définir les types.'
              : 'No performance types available. Ask a coach to define types.'}
          </CardContent>
        </Card>
      )}

      {/* Plus de bouton « Tous » : la courbe demande un mouvement, et un
          filtre qui ne peut plus s'activer serait un bouton mort. */}
      {activeTypes.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          {activeTypes.map(t => (
            <Button
              key={t.id}
              variant={shownTypeId === t.id ? 'default' : 'outline'}
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

      {shownTypeId && selectedType && (
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
            </div>

            {chartData.length < 2 ? (
              <p className="text-sm text-muted-foreground text-center py-6">
                {chartData.length === 0
                  ? (isFr ? 'Aucune mesure enregistrée' : 'No measurement yet')
                  : (isFr
                    ? 'Encore une mesure et la courbe apparaît.'
                    : 'One more measurement and the curve appears.')}
              </p>
            ) : (
              <>
                {/* La progression, en clair. C'est ce que le membre retient —
                    la courbe illustre, la phrase informe. */}
                {progression && (
                  <div className="flex items-baseline justify-between gap-2 flex-wrap">
                    <div>
                      <span className={cn(
                        'text-2xl font-bold',
                        progression.gain > 0 && 'text-emerald-600 dark:text-emerald-400',
                      )}>
                        {progression.gain === 0
                          ? formatValue(progression.last.value)
                          : formatGain(progression.gain)}
                      </span>
                      <span className="text-xs text-muted-foreground ml-2">
                        {progression.gain === 0
                          ? (isFr ? 'stable' : 'steady')
                          : (isFr ? `depuis ${progression.since}` : `since ${progression.since}`)}
                      </span>
                    </div>
                    {progression.isRecord && (
                      <Badge className="gap-1">
                        <Trophy className="h-3 w-3" />
                        {isFr ? 'Record' : 'Personal best'}
                      </Badge>
                    )}
                  </div>
                )}

                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" vertical={false} />
                    <XAxis dataKey="label" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                    {/* Axe inversé sur un chrono : « ça monte » doit toujours
                        vouloir dire « je progresse ». Sans cela, une courbe
                        descendante ferait croire à une régression alors que
                        c'est un record. */}
                    <YAxis
                      tick={{ fontSize: 10 }}
                      width={44}
                      domain={['dataMin - 5', 'dataMax + 5']}
                      reversed={selectedType.lower_is_better}
                      tickFormatter={(v) => formatValue(Number(v))}
                    />
                    <Tooltip
                      contentStyle={{ fontSize: 12 }}
                      formatter={(_v, _name, props) => {
                        const raw = (props?.payload as { rawValue?: string } | undefined)?.rawValue
                        return [raw ?? '', selectedType.name]
                      }}
                      labelFormatter={(l) => String(l)}
                    />
                    <Line
                      type="monotone"
                      dataKey="value"
                      stroke={selectedType.color || 'var(--color-primary)'}
                      strokeWidth={2}
                      dot={{ r: 3 }}
                      activeDot={{ r: 5 }}
                    />
                  </LineChart>
                </ResponsiveContainer>

                <div className="grid grid-cols-3 gap-2 pt-1">
                  <div className="rounded-lg border p-2 text-center">
                    <p className="text-xs text-muted-foreground">{isFr ? 'Mesures' : 'Entries'}</p>
                    <p className="text-lg font-bold">{progression?.count ?? 0}</p>
                  </div>
                  <div className="rounded-lg border p-2 text-center">
                    <p className="text-xs text-muted-foreground flex items-center justify-center gap-1">
                      <Trophy className="h-3 w-3" />
                      {isFr ? 'Record' : 'Best'}
                    </p>
                    <p className="text-lg font-bold truncate">
                      {progression ? progression.best.rawValue : '—'}
                    </p>
                  </div>
                  <div className="rounded-lg border p-2 text-center">
                    <p className="text-xs text-muted-foreground">{isFr ? 'Dernière' : 'Latest'}</p>
                    <p className="text-lg font-bold truncate">
                      {progression ? progression.last.rawValue : '—'}
                    </p>
                  </div>
                </div>
              </>
            )}
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
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>{isFr ? 'Date' : 'Date'}</Label>
                <Input
                  type="date"
                  value={form.date}
                  onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
                />
              </div>
              {/* La saisie suit la nature du mouvement. Le champ libre
                  precedent invitait a melanger les formats — son placeholder
                  proposait « 13 kg, 3:42, 1500m » — et 55 valeurs sur 57 sont
                  devenues incomparables. Un chrono se saisit en deux champs,
                  une charge en nombre : le format n'est plus une question. */}
              {formKind === 'time' ? (
                <div className="space-y-1">
                  <Label>{isFr ? 'Temps' : 'Time'}</Label>
                  <div className="flex items-center gap-1">
                    <Input
                      type="number"
                      min={0}
                      inputMode="numeric"
                      className="text-center"
                      value={timeMin}
                      onChange={e => setTimeMin(e.target.value)}
                      placeholder="min"
                      aria-label={isFr ? 'Minutes' : 'Minutes'}
                    />
                    <span className="text-muted-foreground font-medium">:</span>
                    <Input
                      type="number"
                      min={0}
                      max={59}
                      inputMode="numeric"
                      className="text-center"
                      value={timeSec}
                      onChange={e => setTimeSec(e.target.value)}
                      placeholder="sec"
                      aria-label={isFr ? 'Secondes' : 'Seconds'}
                    />
                  </div>
                </div>
              ) : (
                <div className="space-y-1">
                  <Label>
                    {isFr ? 'Valeur' : 'Value'}
                    {selectedUnit && <span className="text-muted-foreground font-normal"> ({selectedUnit})</span>}
                  </Label>
                  <Input
                    type="number"
                    min={0}
                    step="0.5"
                    inputMode="decimal"
                    value={form.value}
                    onChange={e => setForm(f => ({ ...f, value: e.target.value }))}
                    placeholder={formKind === 'weight' ? '50' : '10'}
                  />
                </div>
              )}
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
            {/* La condition suit le champ réellement affiché : un chrono se
                saisit dans timeMin/timeSec, jamais dans form.value. Exiger
                form.value ici laissait le bouton mort en permanence pour tout
                type `time` — le membre saisissait son temps, cliquait, et rien
                ne se passait, sans le moindre message. handleSave valide déjà
                le détail (temps vide, secondes hors bornes) et le dit. */}
            <Button onClick={handleSave} disabled={saving || !form.performance_type_id || (formKind === 'time' ? !timeMin.trim() && !timeSec.trim() : !form.value.trim())}>
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

import { useEffect, useState, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import type { Performance, PerformanceType, Profile } from '@/types'
import { LoadingState } from '@/components/common/LoadingState'
import { EmptyState } from '@/components/common/EmptyState'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { urlImage } from '@/lib/url-image'
import { Activity, ArrowLeft, Target, Trophy } from 'lucide-react'
import { format } from 'date-fns'
import { fr, enUS } from 'date-fns/locale'
import { LineChart, Line, CartesianGrid, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'

/**
 * Les performances d'un membre, vues par un coach.
 *
 * **Lecture seule** : le coach consulte pour préparer sa séance, le membre
 * reste maître de ce qu'il enregistre. La policy `Perf: insert` autoriserait
 * l'écriture — ce n'est pas un oubli, c'est un choix.
 *
 * L'objectif du membre est repris en tête, comme sur son propre écran : c'est
 * ce qui donne un sens aux chiffres qui suivent.
 */
export function CoachMemberPerformancesPage() {
  const { i18n } = useTranslation()
  const isFr = i18n.language === 'fr'
  const locale = isFr ? fr : enUS
  const navigate = useNavigate()
  const { userId } = useParams<{ userId: string }>()

  const [membre, setMembre] = useState<Profile | null>(null)
  const [types, setTypes] = useState<PerformanceType[]>([])
  const [performances, setPerformances] = useState<Performance[]>([])
  const [loading, setLoading] = useState(true)
  const [filterTypeId, setFilterTypeId] = useState('')

  useEffect(() => {
    if (!userId) return
    const charger = async () => {
      const [pRes, tRes, perfRes] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', userId).single(),
        supabase.from('performance_types').select('*').order('display_order').order('name'),
        supabase
          .from('performances')
          .select('*, performance_type:performance_types(*)')
          .eq('user_id', userId)
          .order('date', { ascending: false })
          .order('created_at', { ascending: false }),
      ])
      setMembre(pRes.data as Profile | null)
      setTypes((tRes.data as PerformanceType[]) ?? [])
      setPerformances((perfRes.data as Performance[]) ?? [])
      setLoading(false)
    }
    charger()
  }, [userId])

  const activeTypes = useMemo(() => types.filter(t => !t.archived), [types])

  /** Mouvement affiché par défaut : le plus suivi, comme sur l'écran du membre. */
  const defaultTypeId = useMemo(() => {
    if (performances.length === 0 || activeTypes.length === 0) return ''
    const selectable = new Set(activeTypes.map(t => t.id))
    const counts = new Map<string, number>()
    for (const p of performances) {
      if (p.value_num === null || p.value_num === undefined) continue
      if (!selectable.has(p.performance_type_id)) continue
      counts.set(p.performance_type_id, (counts.get(p.performance_type_id) ?? 0) + 1)
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? ''
  }, [performances, activeTypes])

  const shownTypeId = filterTypeId || defaultTypeId
  const selectedType = useMemo(() => types.find(t => t.id === shownTypeId), [types, shownTypeId])

  const filtered = useMemo(
    () => (shownTypeId ? performances.filter(p => p.performance_type_id === shownTypeId) : performances),
    [performances, shownTypeId],
  )

  const chartData = useMemo(() => {
    if (!shownTypeId) return []
    return filtered
      .filter(p => p.value_num !== null && p.value_num !== undefined)
      .slice()
      .sort((a, b) => a.date.localeCompare(b.date))
      .map(p => ({
        label: format(new Date(p.date + 'T00:00:00'), 'dd/MM', { locale }),
        value: Number(p.value_num),
        rawValue: p.value,
        date: p.date,
      }))
  }, [shownTypeId, filtered, locale])

  /**
   * Record et progression. Le sens du progrès vient du type : sur un chrono,
   * le record est le plus PETIT temps — chercher le maximum désignerait la pire
   * performance.
   */
  const progression = useMemo(() => {
    if (!selectedType || chartData.length === 0) return null
    const lowerIsBetter = selectedType.lower_is_better
    const values = chartData.map(d => d.value)
    const first = chartData[0]
    const last = chartData[chartData.length - 1]
    const bestValue = lowerIsBetter ? Math.min(...values) : Math.max(...values)
    const best = chartData.find(d => d.value === bestValue)!
    const rawDelta = last.value - first.value
    return {
      count: chartData.length,
      best,
      gain: lowerIsBetter ? -rawDelta : rawDelta,
      isRecord: last.value === bestValue && chartData.length > 1,
    }
  }, [selectedType, chartData])

  if (loading) return <LoadingState />

  if (!membre) {
    return (
      <div className="max-w-3xl mx-auto space-y-4">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4 mr-1.5" />
          {isFr ? 'Retour' : 'Back'}
        </Button>
        <EmptyState icon={Activity} message={isFr ? 'Membre introuvable' : 'Member not found'} />
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
        <ArrowLeft className="h-4 w-4 mr-1.5" />
        {isFr ? 'Retour' : 'Back'}
      </Button>

      <div className="flex items-center gap-3">
        <Avatar className="h-12 w-12">
          <AvatarImage src={urlImage(membre.avatar_url)} />
          <AvatarFallback>{membre.display_name?.[0]?.toUpperCase() ?? '?'}</AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          <h1 className="text-xl font-bold truncate">{membre.display_name}</h1>
          <p className="text-sm text-muted-foreground">
            {isFr ? 'Performances' : 'Performances'}
          </p>
        </div>
      </div>

      {/* L'objectif donne son sens à ce qui suit : un chrono qui stagne n'a pas
          la même lecture selon qu'on vise la performance ou la remise en forme. */}
      {membre.objectives && (
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <Target className="h-4 w-4 text-primary" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  {isFr ? 'Son objectif' : 'Their goal'}
                </p>
                <p className="text-sm mt-0.5 whitespace-pre-line">{membre.objectives}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {performances.length === 0 ? (
        <EmptyState
          icon={Activity}
          message={isFr ? 'Aucune performance enregistrée' : 'No performance recorded'}
        />
      ) : (
        <>
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
                    <span className="h-2 w-2 rounded-full mr-1.5" style={{ backgroundColor: t.color }} />
                  )}
                  {t.name}
                </Button>
              ))}
            </div>
          )}

          {shownTypeId && selectedType && chartData.length > 0 && (
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
                  {progression?.isRecord && (
                    <Badge className="shrink-0 gap-1">
                      <Trophy className="h-3 w-3" />
                      {isFr ? 'Record' : 'Record'}
                    </Badge>
                  )}
                </div>

                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={chartData} margin={{ top: 5, right: 10, bottom: 5, left: -20 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} domain={['auto', 'auto']} />
                    <Tooltip
                      formatter={(_v, _n, item) => [item.payload.rawValue, selectedType.name]}
                      labelFormatter={(l) => l}
                    />
                    <Line
                      type="monotone"
                      dataKey="value"
                      stroke={selectedType.color || 'var(--primary)'}
                      strokeWidth={2}
                      dot={{ r: 3 }}
                    />
                  </LineChart>
                </ResponsiveContainer>

                {progression && (
                  <p className="text-xs text-muted-foreground">
                    {progression.count} {isFr ? 'mesure(s)' : 'measurement(s)'}
                    {' · '}
                    {isFr ? 'record' : 'best'} : {progression.best.rawValue}
                  </p>
                )}
              </CardContent>
            </Card>
          )}

          <Card>
            <CardContent className="p-0 divide-y">
              {filtered.map(p => (
                <div key={p.id} className="flex items-center justify-between gap-3 p-3">
                  <div className="min-w-0">
                    <p className="font-medium truncate">{p.value}</p>
                    {p.notes && (
                      <p className="text-xs text-muted-foreground truncate">{p.notes}</p>
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground shrink-0">
                    {format(new Date(p.date + 'T00:00:00'), 'dd/MM/yyyy', { locale })}
                  </span>
                </div>
              ))}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}

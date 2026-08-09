import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { format } from 'date-fns'
import { fr, enUS } from 'date-fns/locale'
import { TrendingDown, TrendingUp, Minus, Search, Users, Euro, AlertTriangle } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { EmptyState } from '@/components/common/EmptyState'
import { LoadingState } from '@/components/common/LoadingState'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

interface ClientRow {
  user_id: string
  display_name: string | null
  email: string | null
  phone: string | null
  member_status: string | null
  is_business: boolean
  derniere_seance: string | null
  jours_depuis_derniere: number | null
  etat: 'actif' | 'ralentit' | 'decroche' | 'perdu' | 'jamais_venu'
  reservations_total: number
  pointages_total: number
  reservations_recentes: number
  reservations_precedentes: number
  tendance: 'hausse' | 'stable' | 'baisse' | 'arret' | 'nouveau' | 'aucune'
  ca_total: number
  seances_consommees: number
  ca_par_seance: number | null
  a_pack_actif: boolean
  a_abonnement: boolean
}

/**
 * Suivi des clients — repérer qui ralentit avant de le perdre.
 *
 * Trois lectures dans un seul écran : l'état de fréquentation (qui décroche),
 * la tendance (qui vient moins qu'avant), et ce que chacun rapporte.
 *
 * Deux colonnes de présence figurent volontairement côte à côte. « Réservé »
 * est toujours fiable — la réservation a consommé un crédit. « Pointé » dit la
 * venue réelle, mais dépend de la rigueur du pointage. L'écart entre les deux
 * se lit : sur un membre qui réserve sans venir, ou sur un pointage négligé.
 * Le classement s'appuie sur la réservation, la donnée toujours présente.
 */
export function AdminClientTrackingPage() {
  const isFr = (localStorage.getItem('i18nextLng') ?? 'fr').startsWith('fr')
  const locale = isFr ? fr : enUS

  const [rows, setRows] = useState<ClientRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filtre, setFiltre] = useState<'a_relancer' | 'tous' | 'ralentit' | 'decroche' | 'perdu' | 'jamais_venu'>('a_relancer')
  const [recherche, setRecherche] = useState('')

  useEffect(() => {
    ;(async () => {
      setLoading(true)
      const { data, error } = await supabase.rpc('client_tracking_stats')
      if (error) setError(error.message)
      else setRows((data ?? []) as ClientRow[])
      setLoading(false)
    })()
  }, [])

  const compteurs = useMemo(() => {
    const c = { ralentit: 0, decroche: 0, perdu: 0, jamais_venu: 0, actif: 0 }
    for (const r of rows) c[r.etat] = (c[r.etat] ?? 0) + 1
    return c
  }, [rows])

  // « À relancer » réunit les trois états qui appellent une action, sans les
  // « jamais venus » : un inscrit qui n'est jamais venu appelle un accueil,
  // pas une relance — ce n'est pas le même geste commercial.
  const visibles = useMemo(() => {
    let out = rows
    if (filtre === 'a_relancer') out = rows.filter(r => ['ralentit', 'decroche', 'perdu'].includes(r.etat))
    else if (filtre !== 'tous') out = rows.filter(r => r.etat === filtre)

    const q = recherche.trim().toLowerCase()
    if (q) {
      out = out.filter(r =>
        (r.display_name ?? '').toLowerCase().includes(q) ||
        (r.email ?? '').toLowerCase().includes(q))
    }
    return out
  }, [rows, filtre, recherche])

  const caTotal = useMemo(() => rows.reduce((s, r) => s + Number(r.ca_total ?? 0), 0), [rows])

  if (loading) return <LoadingState />
  if (error) {
    return (
      <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm">
        <p className="font-medium">{isFr ? 'Impossible de charger le suivi' : 'Could not load tracking'}</p>
        <p className="text-muted-foreground mt-1">{error}</p>
      </div>
    )
  }

  const badgeEtat = (etat: ClientRow['etat']) => {
    const styles: Record<string, string> = {
      actif: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30',
      ralentit: 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30',
      decroche: 'bg-orange-500/10 text-orange-700 dark:text-orange-400 border-orange-500/30',
      perdu: 'bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/30',
      jamais_venu: 'bg-muted text-muted-foreground border-border',
    }
    const libelles: Record<string, string> = isFr
      ? { actif: 'Actif', ralentit: 'Ralentit', decroche: 'Décroche', perdu: 'Perdu', jamais_venu: 'Jamais venu' }
      : { actif: 'Active', ralentit: 'Slowing', decroche: 'Dropping', perdu: 'Lost', jamais_venu: 'Never came' }
    return (
      <span className={cn('inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium', styles[etat])}>
        {libelles[etat]}
      </span>
    )
  }

  const iconeTendance = (t: ClientRow['tendance']) => {
    if (t === 'baisse' || t === 'arret') return <TrendingDown className="h-4 w-4 text-red-500" />
    if (t === 'hausse') return <TrendingUp className="h-4 w-4 text-emerald-500" />
    if (t === 'stable') return <Minus className="h-4 w-4 text-muted-foreground" />
    return null
  }

  const onglets: { cle: typeof filtre; libelle: string; compte?: number }[] = [
    { cle: 'a_relancer', libelle: isFr ? 'À relancer' : 'To follow up', compte: compteurs.ralentit + compteurs.decroche + compteurs.perdu },
    { cle: 'ralentit', libelle: isFr ? 'Ralentit' : 'Slowing', compte: compteurs.ralentit },
    { cle: 'decroche', libelle: isFr ? 'Décroche' : 'Dropping', compte: compteurs.decroche },
    { cle: 'perdu', libelle: isFr ? 'Perdu' : 'Lost', compte: compteurs.perdu },
    { cle: 'jamais_venu', libelle: isFr ? 'Jamais venu' : 'Never came', compte: compteurs.jamais_venu },
    { cle: 'tous', libelle: isFr ? 'Tous' : 'All', compte: rows.length },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">{isFr ? 'Suivi des clients' : 'Client tracking'}</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {isFr
            ? 'Qui vient moins, qui ne vient plus, et ce que chacun rapporte.'
            : 'Who comes less, who stopped coming, and what each one brings in.'}
        </p>
      </div>

      {/* Trois chiffres qui résument la situation */}
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-lg border p-4">
          <div className="flex items-center gap-2 text-muted-foreground text-sm">
            <Users className="h-4 w-4" />
            {isFr ? 'Clients actifs' : 'Active clients'}
          </div>
          <p className="text-2xl font-semibold mt-1">{compteurs.actif}</p>
        </div>
        <div className="rounded-lg border p-4">
          <div className="flex items-center gap-2 text-muted-foreground text-sm">
            <AlertTriangle className="h-4 w-4" />
            {isFr ? 'À relancer' : 'To follow up'}
          </div>
          <p className="text-2xl font-semibold mt-1">
            {compteurs.ralentit + compteurs.decroche + compteurs.perdu}
          </p>
        </div>
        <div className="rounded-lg border p-4">
          <div className="flex items-center gap-2 text-muted-foreground text-sm">
            <Euro className="h-4 w-4" />
            {isFr ? 'Chiffre d\'affaires cumulé' : 'Total revenue'}
          </div>
          <p className="text-2xl font-semibold mt-1">{caTotal.toFixed(0)} €</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {onglets.map(o => (
          <Button
            key={o.cle}
            variant={filtre === o.cle ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFiltre(o.cle)}
          >
            {o.libelle}
            {o.compte !== undefined && (
              <span className="ml-1.5 opacity-70">{o.compte}</span>
            )}
          </Button>
        ))}
        <div className="relative ml-auto w-full sm:w-64">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={isFr ? 'Nom ou e-mail…' : 'Name or email…'}
            value={recherche}
            onChange={e => setRecherche(e.target.value)}
            className="pl-8"
          />
        </div>
      </div>

      {visibles.length === 0 ? (
        <EmptyState
          icon={Users}
          message={
            filtre === 'a_relancer'
              ? (isFr ? 'Personne à relancer : tous vos clients sont venus récemment.' : 'Nobody to follow up: all your clients came recently.')
              : (isFr ? 'Personne dans cette catégorie.' : 'Nobody in this category.')
          }
        />
      ) : (
        <div className="rounded-lg border overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left">
              <tr>
                <th className="p-3 font-medium">{isFr ? 'Client' : 'Client'}</th>
                <th className="p-3 font-medium">{isFr ? 'État' : 'Status'}</th>
                <th className="p-3 font-medium whitespace-nowrap">{isFr ? 'Dernière séance' : 'Last session'}</th>
                <th className="p-3 font-medium text-center" title={isFr ? 'Séances réservées / séances pointées' : 'Booked / checked in'}>
                  {isFr ? 'Réservé / pointé' : 'Booked / checked'}
                </th>
                <th className="p-3 font-medium text-center">{isFr ? 'Tendance' : 'Trend'}</th>
                <th className="p-3 font-medium text-right">{isFr ? 'CA' : 'Revenue'}</th>
                <th className="p-3 font-medium text-right whitespace-nowrap">{isFr ? '€ / séance' : '€ / session'}</th>
              </tr>
            </thead>
            <tbody>
              {visibles.map(r => (
                <tr key={r.user_id} className="border-t hover:bg-muted/30">
                  <td className="p-3">
                    <Link to={`/admin/users/${r.user_id}`} className="font-medium hover:underline">
                      {r.display_name ?? (isFr ? 'Sans nom' : 'No name')}
                    </Link>
                    <div className="text-xs text-muted-foreground">{r.email}</div>
                    <div className="flex gap-1 mt-1">
                      {r.a_abonnement && (
                        <span className="text-[10px] rounded bg-blue-500/10 text-blue-700 dark:text-blue-400 px-1.5 py-0.5">
                          {isFr ? 'Abonné' : 'Subscriber'}
                        </span>
                      )}
                      {r.is_business && (
                        <span className="text-[10px] rounded bg-purple-500/10 text-purple-700 dark:text-purple-400 px-1.5 py-0.5">
                          B2B
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="p-3">{badgeEtat(r.etat)}</td>
                  <td className="p-3 whitespace-nowrap">
                    {r.derniere_seance ? (
                      <>
                        <div>{format(new Date(r.derniere_seance), 'dd/MM/yyyy', { locale })}</div>
                        <div className="text-xs text-muted-foreground">
                          {isFr ? `il y a ${r.jours_depuis_derniere} j` : `${r.jours_depuis_derniere} d ago`}
                        </div>
                      </>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="p-3 text-center tabular-nums">
                    <span className="font-medium">{r.reservations_total}</span>
                    <span className="text-muted-foreground"> / {r.pointages_total}</span>
                  </td>
                  <td className="p-3">
                    <div className="flex items-center justify-center gap-1.5" title={
                      isFr
                        ? `${r.reservations_recentes} récemment contre ${r.reservations_precedentes} sur la période précédente`
                        : `${r.reservations_recentes} recently vs ${r.reservations_precedentes} in the previous period`
                    }>
                      {iconeTendance(r.tendance)}
                      <span className="text-xs tabular-nums text-muted-foreground">
                        {r.reservations_recentes}/{r.reservations_precedentes}
                      </span>
                    </div>
                  </td>
                  <td className="p-3 text-right tabular-nums">{Number(r.ca_total).toFixed(0)} €</td>
                  <td className="p-3 text-right tabular-nums text-muted-foreground">
                    {r.ca_par_seance != null ? `${Number(r.ca_par_seance).toFixed(1)} €` : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="rounded-lg bg-muted/40 p-4 text-sm text-muted-foreground space-y-2">
        <p>
          <strong className="text-foreground">{isFr ? 'Réservé / pointé' : 'Booked / checked'}</strong>{' '}
          {isFr
            ? '— la première colonne compte les séances réservées et non annulées, la seconde celles qui ont été pointées. Un écart important peut venir d\'un membre qui réserve sans venir, ou simplement d\'un pointage oublié.'
            : '— the first counts booked sessions, the second those actually checked in. A large gap may mean a member books without coming, or simply that check-in was skipped.'}
        </p>
        <p>
          <strong className="text-foreground">{isFr ? 'Tendance' : 'Trend'}</strong>{' '}
          {isFr
            ? '— compare la période récente à la précédente, de même durée. C\'est cette comparaison qui révèle un ralentissement : un total cumulé reste élevé chez quelqu\'un qui a cessé de venir.'
            : '— compares the recent period to the previous one of equal length. A cumulative total stays high even for someone who stopped coming.'}
        </p>
        <p>
          {isFr
            ? 'Les seuils (ralentit, décroche, perdu) se règlent dans Administration → Réglages.'
            : 'Thresholds are set in Administration → Settings.'}
        </p>
      </div>
    </div>
  )
}

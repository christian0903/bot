import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router-dom'
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from 'date-fns'
import { fr, enUS } from 'date-fns/locale'
import { Star, MessageSquare, ChevronLeft, ChevronRight, ChevronDown } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { EmptyState } from '@/components/common/EmptyState'
import { LoadingState } from '@/components/common/LoadingState'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select'
import { cn } from '@/lib/utils'
import type { ClassType, Profile } from '@/types'

interface AdminReview {
  id: string
  rating: number
  comment: string | null
  created_at: string
  user_id: string
  member_name: string | null
  member_email: string | null
  scheduled_class_id: string
  class_name: string | null
  class_type_id: string | null
  starts_at: string
  coach_id: string | null
  coach_name: string | null
}

interface CoachStat {
  coach_id: string
  coach_name: string | null
  review_count: number
  average_rating: number
}

/** Étoiles en lecture seule. */
function Stars({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5 shrink-0">
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          className={cn(
            'h-3.5 w-3.5',
            n <= rating ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground/25',
          )}
        />
      ))}
    </div>
  )
}

const iso = (d: Date) => format(d, 'yyyy-MM-dd')

/**
 * Les avis des membres, côté admin.
 *
 * Nominatif, contrairement à la vue coach : c'est ce qui permet de traiter un
 * avis problématique. Sans le nom, on ne peut ni recontacter la personne, ni
 * distinguer un mécontentement isolé d'un acharnement.
 *
 * La liste reste volontairement maigre — date, note, bouton. Le reste (coach,
 * membre, commentaire) vit dans le détail : une liste qui montre tout ne se
 * parcourt plus.
 *
 * La période se lit sur la date du COURS, pas sur celle du dépôt : « les avis
 * de cette semaine » veut dire les cours de cette semaine.
 */
export function AdminReviewsPage() {
  const { t, i18n } = useTranslation()
  const isFr = i18n.language === 'fr'
  const locale = isFr ? fr : enUS

  /**
   * Période dans l'URL, comme le planning : l'écran est partageable, et le
   * bouton « précédent » du navigateur fonctionne. Par défaut le mois en
   * cours — sur des avis, la semaine est souvent trop courte pour voir
   * quoi que ce soit.
   */
  const [searchParams, setSearchParams] = useSearchParams()
  const dateFrom = searchParams.get('from') ?? iso(startOfMonth(new Date()))
  const dateTo = searchParams.get('to') ?? iso(endOfMonth(new Date()))

  const setPeriod = (from: string, to: string) => {
    const next = new URLSearchParams(searchParams)
    if (from) next.set('from', from); else next.delete('from')
    if (to) next.set('to', to); else next.delete('to')
    setSearchParams(next, { replace: true })
  }

  /**
   * Décale la période d'une longueur équivalente — même mécanique que le
   * planning. Sans date de fin, on se déplace d'une semaine.
   */
  const shiftPeriod = (direction: -1 | 1) => {
    const from = new Date(dateFrom + 'T12:00:00')
    if (!dateTo) {
      setPeriod(iso(new Date(from.getTime() + direction * 7 * 86400000)), '')
      return
    }
    const to = new Date(dateTo + 'T12:00:00')
    // +1 jour : du 1er au 7 fait 7 jours, pas 6.
    const span = to.getTime() - from.getTime() + 86400000
    setPeriod(
      iso(new Date(from.getTime() + direction * span)),
      iso(new Date(to.getTime() + direction * span)),
    )
  }

  const [reviews, setReviews] = useState<AdminReview[]>([])
  const [stats, setStats] = useState<CoachStat[]>([])
  const [coaches, setCoaches] = useState<Profile[]>([])
  const [classTypes, setClassTypes] = useState<ClassType[]>([])
  const [loading, setLoading] = useState(true)
  const [filterCoach, setFilterCoach] = useState('all')
  const [filterClassType, setFilterClassType] = useState('all')
  /** Note exacte à afficher, ou `null` pour toutes. */
  const [starFilter, setStarFilter] = useState<number | null>(null)
  /** Avis dont le détail est déplié. Plusieurs peuvent l'être à la fois. */
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  // Coachs et types de cours : chargés une fois, ils alimentent les listes
  // déroulantes. Même sources que le planning, pour que les deux écrans
  // proposent les mêmes choix.
  useEffect(() => {
    let cancelled = false
    Promise.all([
      supabase.from('coach_profiles').select('*').order('display_name'),
      supabase.from('class_types').select('*').eq('is_active', true).order('name'),
    ]).then(([coachRes, typeRes]) => {
      if (cancelled) return
      setCoaches((coachRes.data as Profile[]) ?? [])
      setClassTypes((typeRes.data as ClassType[]) ?? [])
    })
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    let cancelled = false
    // Pas de remise à `true` au changement de filtre : la liste précédente
    // reste affichée le temps du rechargement, plutôt que de clignoter.

    Promise.all([
      supabase.rpc('class_reviews_for_admin', {
        p_coach_id: filterCoach === 'all' ? null : filterCoach,
        p_class_type_id: filterClassType === 'all' ? null : filterClassType,
        p_from: dateFrom ? `${dateFrom}T00:00:00` : null,
        p_to: dateTo ? `${dateTo}T23:59:59` : null,
        p_limit: 500,
      }),
      supabase.rpc('class_review_stats_by_coach'),
    ]).then(([reviewRes, statsRes]) => {
      if (cancelled) return
      if (reviewRes.error) console.error('[reviews] admin', reviewRes.error)
      if (statsRes.error) console.error('[reviews] stats', statsRes.error)
      setReviews((reviewRes.data as AdminReview[]) ?? [])
      setStats((statsRes.data as CoachStat[]) ?? [])
      setLoading(false)
    })

    return () => { cancelled = true }
  }, [filterCoach, filterClassType, dateFrom, dateTo])

  // Le filtre par étoiles se fait ici plutôt qu'en base : les avis de la
  // période sont déjà chargés, et basculer d'une note à l'autre doit être
  // instantané.
  const shown = useMemo(
    () => (starFilter === null ? reviews : reviews.filter((r) => r.rating === starFilter)),
    [reviews, starFilter],
  )

  /** Combien d'avis par note, pour renseigner les boutons de filtre. */
  const countByStar = useMemo(() => {
    const counts = new Map<number, number>()
    for (const r of reviews) counts.set(r.rating, (counts.get(r.rating) ?? 0) + 1)
    return counts
  }, [reviews])

  /** Moyenne de ce qui est affiché — la période et les filtres comptent. */
  const periodAverage = useMemo(() => {
    if (reviews.length === 0) return 0
    return reviews.reduce((s, r) => s + r.rating, 0) / reviews.length
  }, [reviews])

  if (loading && reviews.length === 0) return <LoadingState />

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold flex items-center gap-2">
        <MessageSquare className="h-6 w-6 text-primary" />
        {isFr ? 'Évaluations' : 'Reviews'}
      </h1>

      {/* Période et filtres — même disposition que le planning. */}
      <div className="flex flex-wrap items-end gap-3 p-3 rounded-lg border bg-muted/30">
        <Button
          variant="outline"
          size="icon"
          className="h-8 w-8"
          onClick={() => shiftPeriod(-1)}
          title={isFr ? 'Période précédente' : 'Previous period'}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>

        <div>
          <Label className="text-xs">{isFr ? 'Du' : 'From'}</Label>
          <Input
            type="date"
            className="h-8 text-xs w-36"
            value={dateFrom}
            onChange={(e) => setPeriod(e.target.value, dateTo)}
          />
        </div>
        <div>
          <Label className="text-xs">{isFr ? 'Au' : 'To'}</Label>
          <Input
            type="date"
            className="h-8 text-xs w-36"
            value={dateTo}
            onChange={(e) => setPeriod(dateFrom, e.target.value)}
          />
        </div>

        <Button
          variant="outline"
          size="icon"
          className="h-8 w-8"
          onClick={() => shiftPeriod(1)}
          title={isFr ? 'Période suivante' : 'Next period'}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>

        {/* Raccourcis : les deux mailles de lecture courantes. */}
        <Button
          variant="ghost"
          size="sm"
          className="h-8 text-xs"
          onClick={() => setPeriod(
            iso(startOfWeek(new Date(), { weekStartsOn: 1 })),
            iso(endOfWeek(new Date(), { weekStartsOn: 1 })),
          )}
        >
          {isFr ? 'Cette semaine' : 'This week'}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-8 text-xs"
          onClick={() => setPeriod(iso(startOfMonth(new Date())), iso(endOfMonth(new Date())))}
        >
          {isFr ? 'Ce mois' : 'This month'}
        </Button>

        <div>
          <Label className="text-xs">{t('admin.schedule.coach')}</Label>
          <Select value={filterCoach} onValueChange={(v) => setFilterCoach(v ?? 'all')}>
            <SelectTrigger className="h-8 text-xs w-40">
              <span>
                {filterCoach === 'all'
                  ? t('common.all')
                  : coaches.find(c => c.id === filterCoach)?.display_name}
              </span>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('common.all')}</SelectItem>
              {coaches.map(c => (
                <SelectItem key={c.id} value={c.id}>{c.display_name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label className="text-xs">{t('admin.schedule.classType')}</Label>
          <Select value={filterClassType} onValueChange={(v) => setFilterClassType(v ?? 'all')}>
            <SelectTrigger className="h-8 text-xs w-40">
              <span>
                {filterClassType === 'all'
                  ? t('common.all')
                  : classTypes.find(c => c.id === filterClassType)?.name}
              </span>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('common.all')}</SelectItem>
              {classTypes.map(ct => (
                <SelectItem key={ct.id} value={ct.id}>{ct.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Button
          variant="ghost"
          size="sm"
          className="text-xs"
          onClick={() => {
            setPeriod(iso(startOfMonth(new Date())), iso(endOfMonth(new Date())))
            setFilterCoach('all')
            setFilterClassType('all')
            setStarFilter(null)
          }}
        >
          {isFr ? 'Réinitialiser' : 'Reset'}
        </Button>
      </div>

      {/* Ce que dit la période affichée */}
      <div className="grid grid-cols-2 gap-3">
        <div className="p-4 rounded-lg border text-center">
          <p className="text-2xl font-bold">{reviews.length}</p>
          <p className="text-xs text-muted-foreground">
            {isFr ? 'Avis sur la période' : 'Reviews in period'}
          </p>
        </div>
        <div className="p-4 rounded-lg border text-center">
          <p className="text-2xl font-bold flex items-center justify-center gap-1">
            {reviews.length > 0 ? periodAverage.toFixed(1) : '—'}
            {reviews.length > 0 && <Star className="h-4 w-4 fill-amber-400 text-amber-400" />}
          </p>
          <p className="text-xs text-muted-foreground">{isFr ? 'Moyenne' : 'Average'}</p>
        </div>
      </div>

      {/* Filtre par note — 5 boutons, un par étoile, plus « Toutes ». */}
      <div className="flex flex-wrap items-center gap-2">
        <Button
          size="sm"
          variant={starFilter === null ? 'default' : 'outline'}
          onClick={() => setStarFilter(null)}
        >
          {isFr ? 'Toutes' : 'All'} ({reviews.length})
        </Button>
        {[5, 4, 3, 2, 1].map((n) => {
          const count = countByStar.get(n) ?? 0
          return (
            <Button
              key={n}
              size="sm"
              variant={starFilter === n ? 'default' : 'outline'}
              // Une note que personne n'a donnée n'a rien à filtrer.
              disabled={count === 0}
              onClick={() => setStarFilter(starFilter === n ? null : n)}
            >
              {n}
              <Star
                className={cn(
                  'h-3 w-3 ml-0.5',
                  starFilter === n ? 'fill-current' : 'fill-amber-400 text-amber-400',
                )}
              />
              <span className="ml-1 text-xs opacity-70">({count})</span>
            </Button>
          )
        })}
      </div>

      {/* Liste : une ligne par avis — cours, date, note, détails. Le détail
          s'ouvre en place plutôt qu'en fenêtre : on parcourt une liste d'avis
          en en ouvrant plusieurs, une modale forcerait à fermer à chaque fois. */}
      {shown.length === 0 ? (
        <EmptyState
          icon={MessageSquare}
          message={
            reviews.length === 0
              ? (isFr ? 'Aucun avis sur cette période' : 'No reviews in this period')
              : (isFr ? 'Aucun avis pour ce filtre' : 'No review for this filter')
          }
        />
      ) : (
        <div className="border rounded-lg divide-y">
          {shown.map((r) => {
            const open = expanded.has(r.id)
            return (
              <div key={r.id}>
                <div className="flex items-center gap-3 p-3">
                  <span className="font-medium text-sm min-w-0 flex-1 truncate">
                    {r.class_name ?? (isFr ? 'Cours supprimé' : 'Deleted class')}
                  </span>
                  <span className="text-sm text-muted-foreground tabular-nums shrink-0">
                    {format(new Date(r.starts_at), 'dd/MM/yyyy HH:mm', { locale })}
                  </span>
                  <Stars rating={r.rating} />
                  <Button
                    size="sm"
                    variant="outline"
                    className="shrink-0"
                    aria-expanded={open}
                    onClick={() => setExpanded((prev) => {
                      const next = new Set(prev)
                      if (next.has(r.id)) next.delete(r.id); else next.add(r.id)
                      return next
                    })}
                  >
                    {isFr ? 'Détails' : 'Details'}
                    <ChevronDown
                      className={cn('h-3.5 w-3.5 ml-1 transition-transform', open && 'rotate-180')}
                    />
                  </Button>
                </div>

                {open && (
                  <div className="px-3 pb-3 -mt-1 space-y-2 text-sm bg-muted/30">
                    <div className="space-y-1 pt-2">
                      <Row
                        label={isFr ? 'Coach' : 'Coach'}
                        value={r.coach_name ?? (isFr ? 'Non renseigné' : 'Not set')}
                      />
                      <Row
                        label={isFr ? 'Membre' : 'Member'}
                        value={r.member_name ?? (isFr ? 'Membre supprimé' : 'Deleted member')}
                      />
                      {r.member_email && (
                        <Row label={isFr ? 'E-mail' : 'Email'} value={r.member_email} />
                      )}
                      <Row
                        label={isFr ? 'Déposé le' : 'Submitted'}
                        value={format(new Date(r.created_at), 'dd/MM/yyyy HH:mm', { locale })}
                      />
                    </div>

                    <div className="pt-2 border-t">
                      {r.comment ? (
                        <p className="italic">« {r.comment} »</p>
                      ) : (
                        <p className="text-muted-foreground text-xs">
                          {isFr ? 'Aucun commentaire écrit' : 'No written comment'}
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Moyenne par coach — sur l'ensemble des avis, pas sur la période :
          c'est une tendance de fond, elle n'a de sens que dans la durée. */}
      {stats.length > 0 && (
        <div className="border rounded-lg divide-y">
          <div className="px-4 py-2 text-xs font-medium text-muted-foreground">
            {isFr ? 'Moyenne par coach (tout l\'historique)' : 'Average by coach (all time)'}
          </div>
          {stats.map((c) => (
            <button
              key={c.coach_id}
              onClick={() => setFilterCoach(filterCoach === c.coach_id ? 'all' : c.coach_id)}
              className={cn(
                'w-full flex items-center justify-between p-3 text-left transition-colors hover:bg-muted/50',
                filterCoach === c.coach_id && 'bg-muted',
              )}
            >
              <div className="min-w-0">
                <p className="font-medium text-sm truncate">
                  {c.coach_name ?? (isFr ? 'Coach inconnu' : 'Unknown coach')}
                </p>
                <p className="text-xs text-muted-foreground">
                  {c.review_count} {isFr ? 'avis' : 'reviews'}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Stars rating={Math.round(Number(c.average_rating))} />
                <span className="text-sm font-semibold w-8 text-right">
                  {Number(c.average_rating).toFixed(1)}
                </span>
              </div>
            </button>
          ))}
        </div>
      )}

    </div>
  )
}

/** Ligne libellé / valeur du détail. */
function Row({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="flex gap-2">
      <span className="text-muted-foreground w-24 shrink-0">{label}</span>
      <span className="min-w-0 break-words">{value ?? '—'}</span>
    </div>
  )
}

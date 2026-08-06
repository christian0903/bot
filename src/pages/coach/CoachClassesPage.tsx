import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { Card, CardContent } from '@/components/ui/card'
import { EmptyState } from '@/components/common/EmptyState'
import { LoadingState } from '@/components/common/LoadingState'
import { CalendarDays, Users } from 'lucide-react'
import { format } from 'date-fns'
import { fr, enUS } from 'date-fns/locale'
import type { ScheduledClass } from '@/types'
import { cn, getClassStatus, classStatusLabel } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

/** Chiffres personnels du coach sur les 30 derniers jours. */
interface CoachStats {
  /** Cours qui ont eu lieu : au moins le minimum de participants. */
  given: number
  /** Tous les cours passés, annulations comprises. */
  scheduled: number
  /** Cours passés sans aucun inscrit. */
  emptyCount: number
  /** Cours annulés par le studio. */
  cancelledCount: number
  /** Personnes réellement venues (pointées), sur les cours donnés. */
  attendees: number
  /** Personnes inscrites sur les cours donnés. */
  booked: number
  /** Inscrits / capacité, sur les cours donnés. */
  fillRate: number
  /** Venus / inscrits. Proche de 100 % en temps normal. */
  showUpRate: number
  upcoming: number
}

export function CoachClassesPage() {
  const { t, i18n } = useTranslation()
  const { user } = useAuth()
  const navigate = useNavigate()
  const locale = i18n.language === 'fr' ? fr : enUS
  const isFr = i18n.language === 'fr'
  const [classes, setClasses] = useState<ScheduledClass[]>([])
  /** Inscrits confirmés par cours, pour l'affichage « 2/5 ». */
  const [bookingCounts, setBookingCounts] = useState<Map<string, number>>(new Map())
  /** Présents réellement pointés — n'a de sens que sur un cours passé. */
  const [attendedCounts, setAttendedCounts] = useState<Map<string, number>>(new Map())
  /** Période affichée. « upcoming » par défaut : c'est ce qu'on regarde le matin. */
  const [period, setPeriod] = useState<'upcoming' | 'week' | 'month'>('upcoming')
  /** Filtre de statut, utile surtout sur les cours passés. */
  const [statusFilter, setStatusFilter] = useState<'all' | 'given' | 'pending_checkin' | 'not_given' | 'empty' | 'cancelled'>('all')
  const [minParticipants, setMinParticipants] = useState(1)
  const [stats, setStats] = useState<CoachStats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return

    const load = async () => {
      const now = new Date()
      const from30d = new Date(now.getTime() - 30 * 86400000).toISOString()

      // Fenêtre affichée selon la période choisie.
      const from = period === 'upcoming'
        ? now
        : new Date(now.getTime() - (period === 'week' ? 7 : 30) * 86400000)
      const to = period === 'upcoming' ? null : now

      let listQuery = supabase
        .from('scheduled_classes')
        .select('*, class_type:class_types(*)')
        .eq('coach_id', user.id)
        .gte('starts_at', from.toISOString())
      if (to) listQuery = listQuery.lt('starts_at', to.toISOString())

      const [upcomingRes, pastRes, ruleRes] = await Promise.all([
        // Les cours passés se lisent du plus récent au plus ancien.
        listQuery.order('starts_at', { ascending: period === 'upcoming' }),
        // 30 derniers jours, annulations comprises : elles comptent comme
        // planifiées, jamais comme données. Sert aux chiffres du haut, qui
        // ne bougent pas avec le filtre.
        supabase
          .from('scheduled_classes')
          .select('id, starts_at, is_cancelled, max_participants')
          .eq('coach_id', user.id)
          .gte('starts_at', from30d)
          .lt('starts_at', now.toISOString()),
        supabase.from('app_settings').select('value').eq('key', 'class_given_rule').maybeSingle(),
      ])

      const upcoming = (upcomingRes.data as ScheduledClass[]) ?? []
      setClasses(upcoming)

      // Inscrits ET présents pointés, en une seule requête pour toute la liste.
      if (upcoming.length > 0) {
        // Une place occupée compte, même si la personne s'est désistée trop
        // tard : son crédit a été consommé. `is_no_show` marque ces cas, et
        // les no-show classiques.
        const { data: bookingRows } = await supabase
          .from('bookings')
          .select('scheduled_class_id, checked_in_at, status, is_no_show')
          .in('scheduled_class_id', upcoming.map(c => c.id))

        const counts = new Map<string, number>()
        const attended = new Map<string, number>()
        for (const b of (bookingRows ?? []) as {
          scheduled_class_id: string; checked_in_at: string | null
          status: string; is_no_show: boolean
        }[]) {
          const seatTaken = b.status === 'confirmed' || b.is_no_show
          if (!seatTaken) continue
          counts.set(b.scheduled_class_id, (counts.get(b.scheduled_class_id) ?? 0) + 1)
          if (b.checked_in_at) {
            attended.set(b.scheduled_class_id, (attended.get(b.scheduled_class_id) ?? 0) + 1)
          }
        }
        setBookingCounts(counts)
        setAttendedCounts(attended)
      } else {
        setBookingCounts(new Map())
        setAttendedCounts(new Map())
      }

      const minParticipants =
        (ruleRes.data?.value as { min_participants?: number } | undefined)?.min_participants ?? 1
      setMinParticipants(minParticipants)
      const pastClasses = pastRes.data ?? []

      // Participants par cours, en une seule requête
      const ids = pastClasses.map(c => c.id)
      const countByClass = new Map<string, number>()
      const attendedByClass = new Map<string, number>()
      if (ids.length > 0) {
        const { data: bookings } = await supabase
          .from('bookings')
          .select('scheduled_class_id, checked_in_at, status, is_no_show')
          .in('scheduled_class_id', ids)
        for (const b of (bookings ?? []) as {
          scheduled_class_id: string; checked_in_at: string | null
          status: string; is_no_show: boolean
        }[]) {
          const seatTaken = b.status === 'confirmed' || b.is_no_show
          if (!seatTaken) continue
          countByClass.set(b.scheduled_class_id, (countByClass.get(b.scheduled_class_id) ?? 0) + 1)
          if (b.checked_in_at) {
            attendedByClass.set(b.scheduled_class_id, (attendedByClass.get(b.scheduled_class_id) ?? 0) + 1)
          }
        }
      }

      // Trois familles, à ne pas mélanger :
      //   - donnés : le cours a eu lieu, c'est sur eux qu'on mesure
      //   - sans inscrit : personne ne s'était inscrit, aucun préjudice
      //   - annulés : décision du studio, crédits rendus
      // Le remplissage ne se calcule que sur les cours donnés : inclure un
      // cours vide ferait chuter le taux sans rien dire du travail du coach.
      let given = 0, emptyCount = 0, cancelledCount = 0
      let booked = 0, attended = 0, capacity = 0

      for (const c of pastClasses) {
        const n = countByClass.get(c.id) ?? 0

        if (c.is_cancelled) { cancelledCount++; continue }
        if (n === 0) { emptyCount++; continue }
        if (n < minParticipants) continue   // sous le seuil : ni donné, ni vide

        given++
        booked += n
        attended += attendedByClass.get(c.id) ?? 0
        capacity += c.max_participants ?? 0
      }

      setStats({
        given,
        scheduled: pastClasses.length,
        emptyCount,
        cancelledCount,
        attendees: attended,
        booked,
        // Remplissage : inscrits sur capacité, sur les seuls cours donnés.
        fillRate: capacity > 0 ? Math.round((booked / capacity) * 100) : 0,
        // Présence : venus sur inscrits. Proche de 100 % en temps normal ;
        // s'en écarter signale des absences répétées.
        showUpRate: booked > 0 ? Math.round((attended / booked) * 100) : 0,
        upcoming: (upcomingRes.data ?? []).length,
      })
      setLoading(false)
    }

    load()
  }, [user, period])

  // Statut calculé par la même règle que partout ailleurs (getClassStatus) :
  // un cours passé a « eu lieu » s'il atteignait le minimum de participants.
  const statusOf = (sc: ScheduledClass) => getClassStatus({
    starts_at: sc.starts_at,
    is_cancelled: sc.is_cancelled,
    bookings: bookingCounts.get(sc.id) ?? 0,
    attended: attendedCounts.get(sc.id) ?? 0,
    minParticipants,
  })

  const visibleClasses = statusFilter === 'all'
    ? classes
    : classes.filter(sc => statusOf(sc) === statusFilter)

  if (loading) return <LoadingState />

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">{t('coach.myClasses')}</h1>

      {/* Chiffres personnels — ceux de ce coach uniquement */}
      {stats && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <CalendarDays className="h-4 w-4 text-primary" />
            <h2 className="text-base font-semibold">
              {isFr ? 'Mes 30 derniers jours' : 'My last 30 days'}
            </h2>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Card>
              <CardContent className="p-3">
                <p className="text-2xl font-bold">
                  {stats.given}
                  <span className="text-sm text-muted-foreground font-normal"> / {stats.scheduled}</span>
                </p>
                <p className="text-xs text-muted-foreground">
                  {isFr ? 'Cours donnés / planifiés' : 'Classes given / scheduled'}
                  {(stats.emptyCount > 0 || stats.cancelledCount > 0) && (
                    <span className="block">
                      {stats.emptyCount > 0 && (isFr
                        ? `${stats.emptyCount} sans inscrit`
                        : `${stats.emptyCount} with no bookings`)}
                      {stats.emptyCount > 0 && stats.cancelledCount > 0 && ' · '}
                      {stats.cancelledCount > 0 && (isFr
                        ? `${stats.cancelledCount} annulé(s)`
                        : `${stats.cancelledCount} cancelled`)}
                    </span>
                  )}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-3">
                <p className="text-2xl font-bold">{stats.attendees}</p>
                <p className="text-xs text-muted-foreground">
                  {isFr ? 'Participants venus' : 'Members attended'}
                  <span className="block">{isFr ? 'sur les cours donnés' : 'on classes given'}</span>
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-3">
                <p className="text-2xl font-bold">
                  {stats.fillRate} %
                  <span className="text-sm text-muted-foreground font-normal"> ({stats.showUpRate} %)</span>
                </p>
                <p className="text-xs text-muted-foreground">
                  {isFr ? 'Remplissage (présence)' : 'Fill rate (attendance)'}
                  <span className="block">
                    {isFr ? 'inscrits/places (venus/inscrits)' : 'booked/seats (attended/booked)'}
                  </span>
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-3">
                <p className="text-2xl font-bold">{stats.upcoming}</p>
                <p className="text-xs text-muted-foreground">
                  {isFr ? 'Cours à venir' : 'Upcoming classes'}
                  <span className="block">{isFr ? 'à partir de maintenant' : 'from now on'}</span>
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* Filtres. La période recharge les données ; le statut filtre en place. */}
      <div className="space-y-2">
        <div className="flex gap-1.5 flex-wrap">
          {([
            ['upcoming', isFr ? 'À venir' : 'Upcoming'],
            ['week', isFr ? '7 derniers jours' : 'Last 7 days'],
            ['month', isFr ? '30 derniers jours' : 'Last 30 days'],
          ] as const).map(([key, label]) => (
            <Button
              key={key}
              variant={period === key ? 'default' : 'outline'}
              size="sm"
              className="h-8 text-xs"
              onClick={() => { setPeriod(key); setStatusFilter('all') }}
            >
              {label}
            </Button>
          ))}
        </div>

        {/* Le statut n'a de sens que sur des cours passés : un cours à venir
            n'a ni eu lieu ni été manqué. */}
        {period !== 'upcoming' && (
          <div className="flex gap-1.5 flex-wrap">
            {([
              ['all', isFr ? 'Tous' : 'All'],
              ['given', isFr ? 'Exécutés' : 'Given'],
              ['pending_checkin', isFr ? 'Présences à valider' : 'Check-in pending'],
              ['not_given', isFr ? 'Décision attendue' : 'Decision needed'],
              ['empty', isFr ? 'Sans inscrit' : 'No bookings'],
              ['cancelled', isFr ? 'Annulés' : 'Cancelled'],
            ] as const).map(([key, label]) => (
              <Button
                key={key}
                variant={statusFilter === key ? 'secondary' : 'ghost'}
                size="sm"
                className="h-7 text-xs"
                onClick={() => setStatusFilter(key)}
              >
                {label}
              </Button>
            ))}
          </div>
        )}
      </div>

      {visibleClasses.length === 0 ? (
        <EmptyState icon={CalendarDays} message={t('coach.noClasses')} />
      ) : (
        <div className="space-y-3">
          {visibleClasses.map((sc) => (
            <Card
              key={sc.id}
              className="cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => navigate(`/coach/class/${sc.id}`)}
            >
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="font-medium">{sc.class_type?.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {format(new Date(sc.starts_at), 'EEEE dd MMMM, HH:mm', { locale })}
                  </p>
                </div>
                {(() => {
                  const booked = bookingCounts.get(sc.id) ?? 0
                  const attended = attendedCounts.get(sc.id) ?? 0
                  const full = booked >= (sc.max_participants ?? 0)
                  const isPast = new Date(sc.starts_at) < new Date()
                  const st = statusOf(sc)
                  const badge = classStatusLabel(st, isFr)

                  return (
                    <div className="flex items-center gap-2 shrink-0">
                      {(isPast || sc.is_cancelled) && (
                        <Badge variant={badge.variant} className={cn('text-[10px]', badge.className)}>
                          {badge.label}
                        </Badge>
                      )}
                      <div className={cn(
                        'flex items-center gap-1',
                        full && !isPast ? 'text-primary font-medium' : 'text-muted-foreground',
                      )}>
                        <Users className="h-4 w-4" />
                        {/* Sur un cours passé : présents / inscrits / capacité.
                            Sur un cours à venir, le nombre de présents n'a
                            aucun sens — personne n'est encore venu. */}
                        <span className="text-sm">
                          {isPast && !sc.is_cancelled
                            ? `${attended}/${booked}/${sc.max_participants}`
                            : `${booked}/${sc.max_participants}`}
                        </span>
                      </div>
                    </div>
                  )
                })()}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

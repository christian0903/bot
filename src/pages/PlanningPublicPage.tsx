import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { format, startOfWeek, addDays, isSameDay, isToday } from 'date-fns'
import { fr, enUS } from 'date-fns/locale'
import { useTranslation } from 'react-i18next'
import { ChevronLeft, ChevronRight, Dumbbell } from 'lucide-react'
import { urlImage } from '@/lib/url-image'
import { cn } from '@/lib/utils'

/**
 * Le planning, pour le site public.
 *
 * Cette page est faite pour vivre dans un `<iframe>` sur
 * backontrackstudio.be — elle remplace le widget Technogym. D'où trois partis
 * pris qui la distinguent de `SchedulePage` :
 *
 *   * ni en-tête ni pied de page : le site qui l'accueille a déjà les siens,
 *     et les empiler ferait deux menus l'un sous l'autre ;
 *   * aucune réservation. Un visiteur sans compte ne peut rien réserver, et
 *     un bouton qui mène à une page de connexion déçoit plus qu'il n'invite ;
 *   * **pas de places restantes**. Elles seraient utiles à un membre, mais
 *     affichées publiquement elles racontent le taux de remplissage du studio
 *     à qui passe — un concurrent compris (décision du 2026-08-30).
 *
 * La présentation reprend celle du planning de l'application : une bande de
 * jours qu'on fait défiler, puis les cours en cartes. Un visiteur qui
 * téléchargera l'application y retrouvera ce qu'il a vu sur le site.
 *
 * Les données sont lisibles sans compte : `class_types` et `scheduled_classes`
 * ont chacune une policy de lecture publique. Rien d'autre n'est interrogé —
 * ni les coachs, ni les réservations.
 */

interface CoursPublic {
  id: string
  starts_at: string
  duration_minutes: number
  title: string | null
  is_cancelled: boolean
  class_type: { name: string; color: string | null; image_url: string | null } | null
}

/** Deux semaines : de quoi avancer sans recharger à chaque changement de jour. */
const JOURS_CHARGES = 14

export function PlanningPublicPage() {
  const { i18n } = useTranslation()
  const isFr = i18n.language === 'fr'
  const locale = isFr ? fr : enUS

  const [cours, setCours] = useState<CoursPublic[]>([])
  const [ancre, setAncre] = useState(() => startOfWeek(new Date(), { weekStartsOn: 0 }))
  const [jourActif, setJourActif] = useState(() => new Date())
  const [chargement, setChargement] = useState(true)

  useEffect(() => {
    const charger = async () => {
      setChargement(true)
      const { data } = await supabase
        .from('scheduled_classes')
        .select('id, starts_at, duration_minutes, title, is_cancelled, class_type:class_types(name, color, image_url)')
        .gte('starts_at', ancre.toISOString())
        .lt('starts_at', addDays(ancre, JOURS_CHARGES).toISOString())
        .order('starts_at')
      // Les cours annulés ne s'affichent pas : un planning parsemé d'« Annulé »
      // donne une mauvaise image à qui découvre le studio.
      setCours(((data ?? []) as unknown as CoursPublic[]).filter(c => !c.is_cancelled))
      setChargement(false)
    }
    void charger()
  }, [ancre])

  const jours = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(ancre, i)),
    [ancre],
  )

  /** Le compteur sous chaque jour : il évite d'ouvrir une journée vide. */
  const parJour = useMemo(() => {
    const m = new Map<string, CoursPublic[]>()
    for (const c of cours) {
      const cle = format(new Date(c.starts_at), 'yyyy-MM-dd')
      if (!m.has(cle)) m.set(cle, [])
      m.get(cle)!.push(c)
    }
    return m
  }, [cours])

  const duJour = parJour.get(format(jourActif, 'yyyy-MM-dd')) ?? []

  const changerSemaine = (pas: number) => {
    const nouvelle = addDays(ancre, pas * 7)
    setAncre(nouvelle)
    setJourActif(nouvelle)
  }

  return (
    <div className="p-3 sm:p-4 max-w-3xl mx-auto">
      {/* La bande de jours. Défilable horizontalement sur téléphone, où les
          sept ne tiennent pas — la même solution que dans l'application. */}
      <div className="flex items-center gap-1 mb-4">
        <button
          type="button"
          onClick={() => changerSemaine(-1)}
          aria-label={isFr ? 'Semaine précédente' : 'Previous week'}
          className="shrink-0 rounded-lg border p-1.5 hover:bg-muted transition-colors"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>

        <div className="flex-1 flex gap-1 overflow-x-auto">
          {jours.map(jour => {
            const cle = format(jour, 'yyyy-MM-dd')
            const nb = parJour.get(cle)?.length ?? 0
            const actif = isSameDay(jour, jourActif)
            return (
              <button
                key={cle}
                type="button"
                onClick={() => setJourActif(jour)}
                className={cn(
                  'flex-1 min-w-[3.2rem] rounded-xl px-1 py-2 text-center transition-colors',
                  actif ? 'bg-foreground text-background' : 'hover:bg-muted',
                )}
              >
                <div className="text-[10px] uppercase tracking-wide opacity-70">
                  {format(jour, 'EEE', { locale })}
                </div>
                <div className="text-lg font-bold leading-tight">{format(jour, 'd')}</div>
                {/* Un point sous aujourd'hui, un compteur sous les autres : on
                    repère la date du jour sans lire les chiffres. */}
                {isToday(jour) && !actif ? (
                  <div className="h-3 flex items-center justify-center">
                    <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                  </div>
                ) : (
                  <div className="h-3 text-[10px] opacity-60">{nb > 0 ? nb : ''}</div>
                )}
              </button>
            )
          })}
        </div>

        <button
          type="button"
          onClick={() => changerSemaine(1)}
          aria-label={isFr ? 'Semaine suivante' : 'Next week'}
          className="shrink-0 rounded-lg border p-1.5 hover:bg-muted transition-colors"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      {chargement ? (
        <p className="text-center text-muted-foreground py-12 text-sm">
          {isFr ? 'Chargement…' : 'Loading…'}
        </p>
      ) : duJour.length === 0 ? (
        <p className="text-center text-muted-foreground py-12 text-sm">
          {isFr ? 'Aucun cours ce jour-là.' : 'No classes on this day.'}
        </p>
      ) : (
        <div className="space-y-2">
          {duJour.map(c => {
            const debut = new Date(c.starts_at)
            const image = urlImage(c.class_type?.image_url)
            return (
              <div key={c.id} className="flex rounded-xl border overflow-hidden bg-card">
                {/* La photo du type de cours, ou un aplat de sa couleur tant
                    qu'aucune n'est déposée. Un cadre vide se remarquerait plus
                    qu'une bande colorée. */}
                <div
                  className="w-20 sm:w-28 shrink-0 bg-cover bg-center"
                  style={{
                    backgroundImage: image ? `url(${image})` : undefined,
                    backgroundColor: image ? undefined : (c.class_type?.color ?? '#94a3b8'),
                  }}
                >
                  {!image && (
                    <div className="h-full flex items-center justify-center">
                      <Dumbbell className="h-6 w-6 text-white/70" />
                    </div>
                  )}
                </div>

                <div className="flex-1 p-3 min-w-0">
                  <span className="inline-block rounded-lg bg-foreground text-background px-2.5 py-1 text-sm font-bold tabular-nums">
                    {format(debut, 'HH:mm')}
                  </span>
                  <p className="mt-1.5 font-semibold truncate">
                    {c.title || c.class_type?.name || (isFr ? 'Cours' : 'Class')}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {c.duration_minutes} min
                  </p>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Le seul appel à l'action. `_top` sort de l'iframe : sans lui,
          l'application s'ouvrirait dans le cadre du site, à l'étroit. */}
      <p className="text-center mt-6 text-sm text-muted-foreground">
        {isFr ? 'Pour réserver, ' : 'To book, '}
        <a
          href="https://app.backontrackstudio.be"
          target="_top"
          className="text-primary font-medium hover:underline"
        >
          {isFr ? 'connecte-toi à l\'application' : 'sign in to the app'}
        </a>
      </p>
    </div>
  )
}

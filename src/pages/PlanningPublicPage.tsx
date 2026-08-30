import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { format, startOfWeek, addDays, isSameDay } from 'date-fns'
import { fr, enUS } from 'date-fns/locale'
import { useTranslation } from 'react-i18next'
import { ChevronLeft, ChevronRight } from 'lucide-react'

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
  class_type: { name: string; color: string | null } | null
}

export function PlanningPublicPage() {
  const { i18n } = useTranslation()
  const isFr = i18n.language === 'fr'
  const locale = isFr ? fr : enUS

  const [cours, setCours] = useState<CoursPublic[]>([])
  const [debutSemaine, setDebutSemaine] = useState(() =>
    startOfWeek(new Date(), { weekStartsOn: 1 }),
  )
  const [chargement, setChargement] = useState(true)

  useEffect(() => {
    const charger = async () => {
      setChargement(true)
      const fin = addDays(debutSemaine, 7)
      const { data } = await supabase
        .from('scheduled_classes')
        .select('id, starts_at, duration_minutes, title, is_cancelled, class_type:class_types(name, color)')
        .gte('starts_at', debutSemaine.toISOString())
        .lt('starts_at', fin.toISOString())
        .order('starts_at')
      // Les cours annulés ne s'affichent pas : un planning parsemé d'« Annulé »
      // donne une mauvaise image à qui découvre le studio.
      setCours(((data ?? []) as unknown as CoursPublic[]).filter(c => !c.is_cancelled))
      setChargement(false)
    }
    void charger()
  }, [debutSemaine])

  const jours = Array.from({ length: 7 }, (_, i) => addDays(debutSemaine, i))
  const aujourdhui = new Date()

  return (
    <div className="p-3 sm:p-4 max-w-5xl mx-auto">
      {/* La navigation reste sobre : trois boutons, pas de filtres. Qui
          consulte un horaire sur un site veut voir la semaine, pas la trier. */}
      <div className="flex items-center justify-between mb-4 gap-2">
        <button
          type="button"
          onClick={() => setDebutSemaine(d => addDays(d, -7))}
          className="inline-flex items-center gap-1 rounded-lg border px-3 py-1.5 text-sm hover:bg-muted transition-colors"
        >
          <ChevronLeft className="h-4 w-4" />
          <span className="hidden sm:inline">{isFr ? 'Semaine précédente' : 'Previous'}</span>
        </button>

        <button
          type="button"
          onClick={() => setDebutSemaine(startOfWeek(new Date(), { weekStartsOn: 1 }))}
          className="text-sm font-semibold hover:underline"
        >
          {format(debutSemaine, 'd MMM', { locale })} – {format(addDays(debutSemaine, 6), 'd MMM yyyy', { locale })}
        </button>

        <button
          type="button"
          onClick={() => setDebutSemaine(d => addDays(d, 7))}
          className="inline-flex items-center gap-1 rounded-lg border px-3 py-1.5 text-sm hover:bg-muted transition-colors"
        >
          <span className="hidden sm:inline">{isFr ? 'Semaine suivante' : 'Next'}</span>
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      {chargement ? (
        <p className="text-center text-muted-foreground py-12 text-sm">
          {isFr ? 'Chargement…' : 'Loading…'}
        </p>
      ) : cours.length === 0 ? (
        <p className="text-center text-muted-foreground py-12 text-sm">
          {isFr ? 'Aucun cours cette semaine.' : 'No classes this week.'}
        </p>
      ) : (
        /* Une colonne par jour sur grand écran, une liste empilée sur
           téléphone : une grille de sept colonnes y devient illisible. */
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {jours.map(jour => {
            const duJour = cours.filter(c => isSameDay(new Date(c.starts_at), jour))
            if (duJour.length === 0) return null
            return (
              <div key={jour.toISOString()} className="rounded-xl border overflow-hidden">
                <div className={`px-3 py-2 text-sm font-semibold ${
                  isSameDay(jour, aujourdhui) ? 'bg-primary/10 text-primary' : 'bg-muted/50'
                }`}>
                  {format(jour, 'EEEE d MMMM', { locale })}
                </div>
                <div className="divide-y">
                  {duJour.map(c => (
                    <div key={c.id} className="px-3 py-2 flex items-center gap-2">
                      <span
                        className="h-8 w-1 rounded-full shrink-0"
                        style={{ backgroundColor: c.class_type?.color ?? '#94a3b8' }}
                      />
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">
                          {c.title || c.class_type?.name || (isFr ? 'Cours' : 'Class')}
                        </p>
                        <p className="text-xs text-muted-foreground tabular-nums">
                          {format(new Date(c.starts_at), 'HH:mm')}
                          {' – '}
                          {format(new Date(new Date(c.starts_at).getTime() + c.duration_minutes * 60000), 'HH:mm')}
                        </p>
                      </div>
                    </div>
                  ))}
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

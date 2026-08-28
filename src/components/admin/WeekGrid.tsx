import { useMemo } from 'react'
import { addDays, format, isSameDay, isToday, startOfWeek } from 'date-fns'
import { fr, enUS } from 'date-fns/locale'
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { ScheduledClass } from '@/types'
import { urlImage } from '@/lib/url-image'

/**
 * Grille hebdomadaire du planning : jours en colonnes, heures en lignes.
 *
 * La liste disait tout mais ne montrait rien — un trou de deux heures le jeudi
 * matin n'y ressemble à rien, alors qu'il saute aux yeux dans une grille. D'où
 * l'autre gain, moins visible : **une case vide est un point de création**,
 * date et heure déjà connues. Dans une liste, il n'y a pas de case vide.
 */

interface WeekGridProps {
  /** Cours déjà filtrés (coach, type) — la grille ne refiltre rien. */
  classes: ScheduledClass[]
  /** N'importe quelle date de la semaine à afficher. */
  anchorDate: Date
  /** Inscrits par cours, comptés par la page parente. */
  bookingCounts: Map<string, number>
  isFr: boolean
  /** Repli mobile : une seule journée au lieu des sept. */
  singleDay?: boolean
  onShiftWeek: (direction: -1 | 1) => void
  onToday: () => void
  onOpenClass: (sc: ScheduledClass) => void
  /** Clic sur une case vide : créer un cours à cette date et cette heure. */
  onCreateAt: (date: Date, heure: number) => void
}

/**
 * Amplitude horaire affichée.
 *
 * Bornes larges par défaut, resserrées sur ce que le planning contient
 * réellement : afficher minuit à 23 h ferait défiler dans le vide, et un studio
 * qui ouvre à 8 h n'a que faire des sept premières lignes.
 */
const HEURE_MIN_DEFAUT = 7
const HEURE_MAX_DEFAUT = 21

export function WeekGrid({
  classes,
  anchorDate,
  bookingCounts,
  isFr,
  singleDay = false,
  onShiftWeek,
  onToday,
  onOpenClass,
  onCreateAt,
}: WeekGridProps) {
  const locale = isFr ? fr : enUS

  const jours = useMemo(() => {
    if (singleDay) return [anchorDate]
    const debut = startOfWeek(anchorDate, { weekStartsOn: 1 })
    return Array.from({ length: 7 }, (_, i) => addDays(debut, i))
  }, [anchorDate, singleDay])

  /** Bornes horaires calées sur le contenu réel de la semaine affichée. */
  const [heureMin, heureMax] = useMemo(() => {
    const heures = classes
      .filter(sc => jours.some(j => isSameDay(new Date(sc.starts_at), j)))
      .map(sc => new Date(sc.starts_at).getHours())
    if (heures.length === 0) return [HEURE_MIN_DEFAUT, HEURE_MAX_DEFAUT]
    return [
      Math.min(HEURE_MIN_DEFAUT, ...heures),
      Math.max(HEURE_MAX_DEFAUT, ...heures.map(h => h + 1)),
    ]
  }, [classes, jours])

  const heures = useMemo(
    () => Array.from({ length: heureMax - heureMin + 1 }, (_, i) => heureMin + i),
    [heureMin, heureMax],
  )

  /**
   * Index (jour, heure) → cours. Reconstruire ce filtre dans chaque cellule
   * ferait 7 × 15 balayages de la liste à chaque rendu.
   */
  const parCase = useMemo(() => {
    const index = new Map<string, ScheduledClass[]>()
    for (const sc of classes) {
      const dt = new Date(sc.starts_at)
      const cle = `${format(dt, 'yyyy-MM-dd')}#${dt.getHours()}`
      const liste = index.get(cle)
      if (liste) liste.push(sc)
      else index.set(cle, [sc])
    }
    // Deux cours dans la même heure se lisent dans l'ordre du planning.
    for (const liste of index.values()) {
      liste.sort((a, b) => a.starts_at.localeCompare(b.starts_at))
    }
    return index
  }, [classes])

  const coursDe = (jour: Date, heure: number) =>
    parCase.get(`${format(jour, 'yyyy-MM-dd')}#${heure}`) ?? []

  const libelleSemaine = singleDay
    ? format(anchorDate, 'EEEE d MMMM', { locale })
    : `${format(jours[0], 'd MMM', { locale })} — ${format(jours[6], 'd MMM yyyy', { locale })}`

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Button variant="outline" size="icon" onClick={() => onShiftWeek(-1)} title={isFr ? 'Précédent' : 'Previous'}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <Button variant="outline" size="icon" onClick={() => onShiftWeek(1)} title={isFr ? 'Suivant' : 'Next'}>
          <ChevronRight className="h-4 w-4" />
        </Button>
        <Button variant="outline" size="sm" onClick={onToday}>
          {isFr ? "Aujourd'hui" : 'Today'}
        </Button>
        <span className="text-sm font-medium capitalize ml-1">{libelleSemaine}</span>
      </div>

      <div className="border rounded-lg overflow-x-auto">
        <div className="min-w-[720px]" style={{ minWidth: singleDay ? 0 : undefined }}>
          {/* En-tête des jours */}
          <div
            className="grid border-b bg-muted/30 sticky top-0 z-10"
            style={{ gridTemplateColumns: `3rem repeat(${jours.length}, minmax(0, 1fr))` }}
          >
            <div />
            {jours.map(jour => (
              <div key={jour.toISOString()} className="px-2 py-2 text-center border-l">
                <div className="text-[11px] uppercase text-muted-foreground">
                  {format(jour, 'EEE', { locale })}
                </div>
                <div
                  className={cn(
                    'text-sm font-medium',
                    isToday(jour) && 'inline-block px-2 rounded bg-primary text-primary-foreground',
                  )}
                >
                  {format(jour, 'd MMM', { locale })}
                </div>
              </div>
            ))}
          </div>

          {heures.map(heure => (
            <div
              key={heure}
              className="grid border-b last:border-b-0"
              style={{ gridTemplateColumns: `3rem repeat(${jours.length}, minmax(0, 1fr))` }}
            >
              <div className="px-1 py-2 text-[11px] text-muted-foreground text-right tabular-nums">
                {heure}h
              </div>

              {jours.map(jour => {
                const cours = coursDe(jour, heure)
                return (
                  <div key={jour.toISOString()} className="border-l p-1 min-h-[3.5rem] relative group">
                    {cours.length === 0 ? (
                      // La case vide est le geste de création : sans elle, il
                      // faudrait rouvrir le formulaire et ressaisir ce que la
                      // position dans la grille dit déjà.
                      <button
                        type="button"
                        onClick={() => onCreateAt(jour, heure)}
                        className="absolute inset-1 rounded-md opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity flex items-center justify-center text-muted-foreground hover:bg-muted/60"
                        title={isFr
                          ? `Créer un cours le ${format(jour, 'dd/MM', { locale })} à ${heure}h`
                          : `Create a class on ${format(jour, 'MM/dd', { locale })} at ${heure}:00`}
                      >
                        <Plus className="h-4 w-4" />
                      </button>
                    ) : (
                      <div className="space-y-1">
                        {cours.map(sc => (
                          <CarteCours
                            key={sc.id}
                            sc={sc}
                            inscrits={bookingCounts.get(sc.id) ?? 0}
                            isFr={isFr}
                            onClick={() => onOpenClass(sc)}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

/** Une carte de cours dans la grille. */
function CarteCours({
  sc,
  inscrits,
  isFr,
  onClick,
}: {
  sc: ScheduledClass
  inscrits: number
  isFr: boolean
  onClick: () => void
}) {
  const debut = new Date(sc.starts_at)
  const fin = new Date(debut.getTime() + sc.duration_minutes * 60000)
  const complet = inscrits >= sc.max_participants
  const couleur = sc.class_type?.color || '#3B82F6'

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'w-full text-left rounded-md border-l-4 px-1.5 py-1 transition-colors',
        sc.is_cancelled
          ? 'bg-muted/60 hover:bg-muted opacity-60'
          : 'bg-primary/10 hover:bg-primary/20',
      )}
      style={{ borderLeftColor: sc.is_cancelled ? undefined : couleur }}
    >
      <div className="flex items-start gap-1">
        {sc.class_type?.image_url && !sc.is_cancelled && (
          <img
            src={urlImage(sc.class_type.image_url)}
            alt=""
            className="h-6 w-6 rounded object-cover shrink-0 hidden sm:block"
          />
        )}
        <div className="min-w-0 flex-1">
          <div className="text-[10px] text-muted-foreground tabular-nums">
            {format(debut, 'HH:mm')} – {format(fin, 'HH:mm')}
          </div>
          <div className={cn('text-xs font-medium truncate', sc.is_cancelled && 'line-through')}>
            {sc.title || sc.class_type?.name}
          </div>
          {sc.coach?.display_name && (
            <div className="text-[10px] text-muted-foreground truncate">
              {sc.coach.display_name}
            </div>
          )}
        </div>
      </div>

      <div className="flex justify-end mt-0.5">
        {sc.is_cancelled ? (
          <span className="text-[10px] text-muted-foreground">
            {isFr ? 'Annulé' : 'Cancelled'}
          </span>
        ) : (
          // Le ratio est ce qu'on vient lire en premier sur un planning :
          // rouge quand il n'y a plus de place, vert tant qu'il en reste.
          <span
            className={cn(
              'text-[10px] font-medium px-1 rounded tabular-nums',
              complet
                ? 'bg-destructive text-destructive-foreground'
                : 'bg-emerald-600/15 text-emerald-700 dark:text-emerald-400',
            )}
          >
            {inscrits}/{sc.max_participants}
          </span>
        )}
      </div>
    </button>
  )
}

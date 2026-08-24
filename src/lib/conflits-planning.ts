/**
 * Détection des conflits avant d'écrire au planning.
 *
 * Deux natures de conflit, qui n'appellent pas la même réponse :
 *
 * - **Créneau occupé** (même minute, même salle) : bloquant. Deux cours ne
 *   tiennent pas dans la même salle au même moment, et les empiler produirait
 *   un planning que personne ne peut honorer.
 * - **Coach déjà pris** (même minute, même coach, salles différentes) : simple
 *   avertissement. Un coach peut superviser deux salles, ou l'admin corrigera
 *   après — bloquer interdirait des plannings valides.
 *
 * Une salle non renseignée **ne bloque pas** : rien ne dit que deux cours sans
 * salle s'opposent. Les traiter comme une salle commune bloquait deux Personal
 * Training simultanés, ce qui est au contraire le cas normal avec deux coachs.
 */

/** Cours envisagé, avant écriture. */
export interface CoursCandidat {
  starts_at: string
  floor: string | null
  coach_id: string | null
  /** Pour l'affichage seulement : nom du cours, jamais écrit en base. */
  libelle?: string
}

/** Cours déjà au planning, tel que relu depuis la base. */
export interface CoursExistant {
  starts_at: string
  floor: string | null
  coach_id: string | null
}

export interface Conflit {
  candidat: CoursCandidat
  /** `salle` bloque l'écriture ; `coach` la laisse passer. */
  type: 'salle' | 'coach'
}

export interface AnalyseConflits {
  /** Cours qui seront réellement créés. */
  aCreer: CoursCandidat[]
  /** Écartés : la salle est déjà prise à cette minute. */
  bloques: Conflit[]
  /** Créés malgré tout, mais le coach est déjà occupé ailleurs. */
  avertissements: Conflit[]
}

/**
 * Minute de départ, sans les secondes : deux cours saisis à la même heure
 * peuvent différer de quelques millisecondes selon leur origine.
 */
function minute(iso: string): string {
  return iso.slice(0, 16)
}

/**
 * Répartit les candidats entre créables, bloqués et signalés.
 *
 * Les candidats sont confrontés aux cours existants **et entre eux** : dupliquer
 * deux cours vers le même créneau doit se voir, alors qu'aucun des deux n'est
 * encore en base.
 */
export function analyserConflits(
  candidats: CoursCandidat[],
  existants: CoursExistant[],
): AnalyseConflits {
  const aCreer: CoursCandidat[] = []
  const bloques: Conflit[] = []
  const avertissements: Conflit[] = []

  // Salles prises. Une salle vide n'entre pas dans l'index : elle ne bloque rien.
  const sallesPrises = new Set(
    existants.filter(e => e.floor).map(e => `${minute(e.starts_at)}|${e.floor}`),
  )
  // Coachs occupés. Un cours sans coach ne rend personne indisponible.
  const coachsPris = new Set(
    existants.filter(e => e.coach_id).map(e => `${minute(e.starts_at)}|${e.coach_id}`),
  )

  for (const c of candidats) {
    const cleSalle = c.floor ? `${minute(c.starts_at)}|${c.floor}` : null

    if (cleSalle && sallesPrises.has(cleSalle)) {
      bloques.push({ candidat: c, type: 'salle' })
      continue
    }

    if (c.coach_id && coachsPris.has(`${minute(c.starts_at)}|${c.coach_id}`)) {
      avertissements.push({ candidat: c, type: 'coach' })
    }

    // Le candidat retenu occupe à son tour le créneau : sans cela, deux
    // candidats visant la même salle passeraient tous les deux.
    if (cleSalle) sallesPrises.add(cleSalle)
    if (c.coach_id) coachsPris.add(`${minute(c.starts_at)}|${c.coach_id}`)
    aCreer.push(c)
  }

  return { aCreer, bloques, avertissements }
}

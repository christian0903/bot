import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Format cents to euros with comma decimal separator (Belgian format) */
export function formatEuros(cents: number, decimals = 2): string {
  return (cents / 100).toFixed(decimals).replace('.', ',') + ' €'
}

/**
 * Libellé du quota d'un pack : "10 crédits", ou "Illimité" si le pack est
 * illimité (son credit_count est alors purement technique et ne doit jamais
 * s'afficher).
 */
export function formatPackCredits(
  pack: { credit_count: number; is_unlimited?: boolean } | null | undefined,
  isFr = true,
): string {
  if (!pack) return ''
  if (pack.is_unlimited) return isFr ? 'Illimité' : 'Unlimited'
  return `${pack.credit_count} ${isFr ? 'crédits' : 'credits'}`
}

/**
 * Valeur d'une séance pour le calcul de revenu.
 * Sur un pack illimité, credit_count ne veut rien dire comme diviseur : il n'y
 * a pas de valeur de crédit calculable. On retombe alors sur le coût moyen
 * paramétré dans Réglages → Finances (`unlimited_session_cost`), passé ici en
 * `fallbackCents`. Sans ce paramètre, renvoie null pour que l'appelant
 * n'affiche pas un montant faux.
 */
export function creditValueCents(
  pricePaidCents: number,
  pack: { credit_count: number; is_unlimited?: boolean } | null | undefined,
  fallbackCents?: number | null,
): number | null {
  if (!pack) return null
  if (pack.is_unlimited) return fallbackCents ?? null
  if (!pack.credit_count) return null
  return pricePaidCents / pack.credit_count
}

// ---------------------------------------------------------------------------
// Statut d'un cours
//
// DÉRIVÉ, jamais stocké : il se déduit de la date, de is_cancelled et du
// nombre d'inscrits. Une colonne en base devrait être entretenue par une tâche
// planifiée et finirait par diverger du réel (un cours passe de "à risque" à
// "exécuté" par le simple écoulement du temps).
// ---------------------------------------------------------------------------

export type ClassStatus = 'scheduled' | 'at_risk' | 'given' | 'pending_checkin' | 'not_given' | 'empty' | 'cancelled'

export interface ClassStatusInput {
  starts_at: string
  is_cancelled?: boolean
  /** Réservations confirmées sur ce cours. */
  bookings: number
  /** Minimum d'inscrits pour qu'un cours compte comme donné (Réglages). */
  minParticipants: number
  /** À combien d'heures du cours on alerte sur un effectif insuffisant. */
  atRiskHours?: number
  /**
   * Présences réellement pointées.
   * Distingue un cours dont on SAIT qu'il a eu lieu (le coach a pointé) d'un
   * cours qu'on suppose donné parce que l'effectif était suffisant.
   */
  attended?: number
}

export function getClassStatus(c: ClassStatusInput, now = new Date()): ClassStatus {
  if (c.is_cancelled) return 'cancelled'

  const startsAt = new Date(c.starts_at)
  const hoursUntil = (startsAt.getTime() - now.getTime()) / 3600000
  const hasQuorum = c.bookings >= c.minParticipants

  // Cours passé. Trois cas, et la distinction compte :
  //   - quorum atteint : le cours a eu lieu
  //   - personne inscrit : rien ne s'est passé, personne n'a été lésé
  //   - sous le seuil avec des inscrits : ceux-là ont consommé un crédit
  //     pour un cours qui n'a peut-être pas eu lieu. C'est ce cas qu'il faut
  //     pouvoir repérer et traiter.
  if (hoursUntil <= 0) {
    if (c.bookings === 0) return 'empty'
    // « Exécuté » exige des présences pointées : sans elles, personne ne sait
    // si le cours a eu lieu. Le déduire de l'effectif donnerait une fausse
    // certitude — et masquerait le fait que le coach n'a pas pointé.
    if ((c.attended ?? 0) > 0) return 'given'
    if (hasQuorum) return 'pending_checkin'
    return 'not_given'
  }

  // Cours à venir : "à risque" quand l'échéance approche sans quorum.
  if (!hasQuorum && hoursUntil <= (c.atRiskHours ?? 24)) return 'at_risk'
  return 'scheduled'
}

/** Libellé + couleur d'un statut, pour les badges. */
export function classStatusLabel(status: ClassStatus, isFr = true): { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline'; className?: string } {
  switch (status) {
    case 'cancelled':
      return { label: isFr ? 'Annulé' : 'Cancelled', variant: 'destructive' }
    case 'empty':
      // Personne ne s'était inscrit : rien à traiter, personne n'a été lésé.
      // Volontairement discret.
      return {
        label: isFr ? 'Sans inscrit' : 'No bookings',
        variant: 'outline',
        className: 'text-muted-foreground/70 border-muted',
      }
    case 'given':
      // Présences pointées : le cours a bien eu lieu, c'est établi.
      return {
        label: isFr ? 'Exécuté' : 'Given',
        variant: 'default',
        className: 'bg-green-600 hover:bg-green-600 text-white',
      }
    case 'pending_checkin':
      // Effectif suffisant mais aucune présence pointée : on ne sait pas si le
      // cours a eu lieu. C'est au coach de le dire.
      return {
        label: isFr ? 'Présences à valider' : 'Check-in pending',
        variant: 'outline',
        className: 'border-amber-500 text-amber-600',
      }
    case 'not_given':
      // Des inscrits, mais sous le seuil : leur crédit a été consommé pour un
      // cours qui n'a probablement pas eu lieu. C'est le cas à traiter.
      return {
        label: isFr ? 'Effectif insuffisant' : 'Below minimum',
        variant: 'outline',
        className: 'border-orange-500 text-orange-600 dark:text-orange-400',
      }
    case 'at_risk':
      // Cours à venir dont l'effectif ne suffit pas encore : une alerte, pas
      // un constat. D'où un libellé qui annonce plutôt qu'il ne juge.
      return {
        label: isFr ? 'Effectif à surveiller' : 'Watch attendance',
        variant: 'outline',
        className: 'border-amber-500 text-amber-600',
      }
    default:
      return { label: isFr ? 'Planifié' : 'Scheduled', variant: 'outline' }
  }
}

// ---------------------------------------------------------------------------
// Validité des packs
//
// La base stocke des JOURS (`validity_days`) : les Edge Functions Stripe et le
// calcul de `expires_at` s'appuient dessus, et les packs déjà vendus gardent
// leur valeur exacte. L'interface, elle, parle en SEMAINES — un studio raisonne
// en cycles de 4 ou 12 semaines, pas en 28 ou 84 jours.
// Ces deux fonctions sont le seul point de conversion.
// ---------------------------------------------------------------------------

/** Jours stockés → semaines affichées (arrondi au plus proche, minimum 1). */
export function daysToWeeks(days: number): number {
  return Math.max(1, Math.round(days / 7))
}

/** Semaines saisies → jours stockés. */
export function weeksToDays(weeks: number): number {
  return Math.max(1, Math.round(weeks)) * 7
}

/**
 * Libellé de validité : "4 semaines".
 * Les packs antérieurs au passage aux semaines (30 ou 90 jours) sont arrondis
 * à la semaine la plus proche — l'écart s'affiche, il ne change pas la date
 * d'expiration réelle, qui reste calculée en jours.
 */
export function formatValidity(days: number, isFr = true): string {
  const w = daysToWeeks(days)
  if (isFr) return `${w} ${w > 1 ? 'semaines' : 'semaine'}`
  return `${w} ${w > 1 ? 'weeks' : 'week'}`
}

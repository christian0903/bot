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

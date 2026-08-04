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
 * Sur un pack illimité, credit_count ne veut rien dire comme diviseur : le
 * revenu doit être réparti sur les séances réellement consommées, ce que seul
 * le SQL (booking_revenue) sait faire. Renvoie null dans ce cas pour que
 * l'appelant n'affiche pas un montant faux.
 */
export function creditValueCents(
  pricePaidCents: number,
  pack: { credit_count: number; is_unlimited?: boolean } | null | undefined,
): number | null {
  if (!pack || pack.is_unlimited || !pack.credit_count) return null
  return pricePaidCents / pack.credit_count
}

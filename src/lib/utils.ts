import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Format cents to euros with comma decimal separator (Belgian format) */
export function formatEuros(cents: number, decimals = 2): string {
  return (cents / 100).toFixed(decimals).replace('.', ',') + ' €'
}

import { supabase } from '@/lib/supabase'

/**
 * Coordonnées légales du studio, telles que saisies dans les Réglages.
 *
 * Elles vivent en base et non dans les fichiers Markdown : un document
 * juridique se rédige une fois, mais une adresse change. Les répéter dans
 * `cgv.md` et `politique-confidentialite.md` obligerait à les corriger à deux
 * endroits — et l'un des deux finirait par mentir.
 */
export interface StudioLegal {
  name?: string
  address?: string
  company_number?: string
  vat_number?: string
  email?: string
  phone?: string
}

/**
 * Remplace les repères d'un document par les valeurs des Réglages.
 *
 * Les repères s'écrivent `{{studio_name}}`, `{{studio_address}}`, etc. Un
 * champ vide laisse une mention explicite plutôt qu'un trou : le lecteur voit
 * qu'il manque quelque chose, et l'admin aussi.
 */
export function fillLegalPlaceholders(
  markdown: string,
  studio: StudioLegal | null,
  isFr: boolean,
): string {
  const missing = isFr ? '*(à compléter dans les Réglages)*' : '*(to be completed in Settings)*'

  const values: Record<string, string> = {
    studio_name: studio?.name?.trim() || missing,
    studio_address: studio?.address?.trim() || missing,
    studio_company_number: studio?.company_number?.trim() || missing,
    // Le n° de TVA est souvent identique au n° d'entreprise : on retombe
    // dessus plutôt que d'afficher deux fois « à compléter ».
    studio_vat: studio?.vat_number?.trim() || studio?.company_number?.trim() || missing,
    studio_email: studio?.email?.trim() || missing,
    studio_phone: studio?.phone?.trim() || missing,
  }

  return markdown.replace(/\{\{(\w+)\}\}/g, (whole, key: string) =>
    key in values ? values[key] : whole,
  )
}

/** Lit les coordonnées du studio. `null` si le réglage n'existe pas encore. */
export async function loadStudioLegal(): Promise<StudioLegal | null> {
  const { data } = await supabase
    .from('app_settings')
    .select('value')
    .eq('key', 'studio_info')
    .maybeSingle()

  return (data?.value as StudioLegal) ?? null
}

// ============================================================================
// Jointures Supabase — lire une relation sans renoncer au typage
// ----------------------------------------------------------------------------
// PostgREST renvoie une relation imbriquée tantôt comme un objet, tantôt comme
// un tableau à un élément, selon la façon dont la clé étrangère est détectée.
// Les types générés reflètent cette ambiguïté, alors que le code, lui, sait
// qu'il attend un seul enregistrement.
//
// Le réflexe était d'écrire `(row.class_type as any)?.name`. Le cast passait,
// mais il éteignait aussi toute vérification sur les champs lus : une faute de
// frappe dans un nom de colonne ne se voyait qu'à l'écran, en `undefined`.
//
// `one()` lève exactement cette ambiguïté-là, et rien d'autre : elle ramène la
// relation à l'objet unique attendu, en conservant son type.
// ============================================================================

/**
 * Relation « vers un seul » d'une requête PostgREST, que la réponse l'exprime
 * comme un objet ou comme un tableau d'un élément.
 */
export type ToOne<T> = T | T[] | null | undefined

/**
 * L'enregistrement unique d'une relation, ou `undefined` s'il n'y en a pas.
 *
 *   const nom = one(row.class_type)?.name ?? '-'
 */
export function one<T>(relation: ToOne<T>): T | undefined {
  if (relation == null) return undefined
  return Array.isArray(relation) ? relation[0] : relation
}

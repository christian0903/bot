/**
 * Reconstruit l'URL publique d'une image du Storage à partir du chemin stocké.
 *
 * La base ne garde que le chemin — `coaches/1776757694078-hwvcodyf5pj.jpg` —
 * et non l'URL complète. Sans cela, chaque ligne porterait la référence du
 * projet en dur :
 *
 *     https://<ref>.supabase.co/storage/v1/object/public/avatars/coaches/x.jpg
 *
 * ce qui rendait la base dépendante du projet qui l'héberge : copier les
 * données vers une autre base laissait les images pointer vers l'ancienne. Et
 * le défaut restait invisible tant que l'ancien projet vivait — les images
 * s'affichaient — pour disparaître toutes le jour de sa suppression.
 *
 * Accepte aussi une URL déjà complète : les lignes écrites avant ce changement
 * sont renvoyées telles quelles, et une image hébergée ailleurs continue de
 * fonctionner.
 */
const BASE_STORAGE = `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/avatars/`

export function urlImage(chemin?: string | null): string | undefined {
  if (!chemin) return undefined

  // Déjà une URL absolue : une valeur d'avant la bascule, ou une image externe.
  if (chemin.startsWith('http://') || chemin.startsWith('https://')) return chemin

  // Tolère un « / » de tête pour ne pas produire une double barre.
  return BASE_STORAGE + chemin.replace(/^\/+/, '')
}

/**
 * Chemin de stockage à partir d'une valeur quelconque — l'inverse d'`urlImage`.
 *
 * Sert à supprimer un fichier : l'API Storage attend le chemin, pas l'URL.
 * Accepte les deux formes, pour que la suppression marche aussi sur les lignes
 * écrites avant la bascule.
 */
export function cheminImage(valeur?: string | null): string | undefined {
  if (!valeur) return undefined
  const apres = valeur.split('/avatars/')[1]
  return apres ?? valeur.replace(/^\/+/, '')
}

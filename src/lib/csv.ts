// ============================================================================
// Export CSV — une seule implémentation, pour tout le monde
// ----------------------------------------------------------------------------
// Le projet en portait deux, divergentes : `AdminUsersPage` séparait par des
// virgules, `AdminDashboardPage` par des points-virgules, et la première
// n'échappait pas les guillemets — un nom contenant `"` cassait le fichier
// sans que rien ne le signale.
//
// DEUX CHOIX QUI ÉVITENT LA MANIPULATION MANUELLE À L'OUVERTURE
//
// Le POINT-VIRGULE : sur un Windows ou un Excel configuré en français, la
// virgule est le séparateur DÉCIMAL. Un fichier séparé par des virgules s'y
// ouvre en une seule colonne, et il faut passer par l'assistant d'importation.
//
// Le BOM UTF-8 (U+FEFF) : sans lui, Excel lit le fichier dans son encodage
// régional et « Rémi » devient « RÃ©mi ». Trois octets invisibles suffisent à
// lui faire reconnaître l'UTF-8.
// ============================================================================

/**
 * Marque d'ordre des octets. Écrite en échappement plutôt qu'en clair : le
 * caractère est invisible dans un éditeur, et sa présence littérale dans le
 * source ressemble à une coquille.
 */
const BOM = '\uFEFF'

/** Une ligne de CSV : des colonnes nommées, des valeurs simples. */
export type CsvRow = Record<string, string | number | boolean | null | undefined>

/**
 * Une valeur, prête à figurer dans une cellule.
 *
 * Tout est entouré de guillemets — c'est plus simple, et surtout plus sûr, que
 * de décider au cas par cas : un texte libre (commentaire d'avis, nom de
 * cours) peut contenir un point-virgule ou un retour à la ligne, qui
 * décaleraient toutes les colonnes suivantes. Les guillemets internes sont
 * doublés, comme le veut le format.
 */
function cell(value: CsvRow[string]): string {
  if (value === null || value === undefined) return '""'
  return `"${String(value).replace(/"/g, '""')}"`
}

/**
 * Le contenu d'un fichier CSV, à partir de lignes homogènes.
 *
 * Les colonnes sont celles de la première ligne : c'est à l'appelant de
 * fournir des objets de même forme.
 */
export function toCsv(rows: CsvRow[]): string {
  if (rows.length === 0) return ''
  const headers = Object.keys(rows[0])
  return BOM + [
    headers.map(cell).join(';'),
    ...rows.map(row => headers.map(h => cell(row[h])).join(';')),
  ].join('\r\n')   // CRLF : ce qu'attendent Excel et le format RFC 4180.
}

/**
 * Propose le fichier au téléchargement.
 *
 * `filename` s'entend sans extension — `.csv` est ajouté ici, pour qu'aucun
 * appelant ne l'oublie.
 *
 * L'URL temporaire est libérée après le clic : la garder retiendrait le
 * fichier entier en mémoire jusqu'au rechargement de la page, ce qui se voit
 * sur un export de plusieurs milliers de lignes.
 */
export function downloadCsv(rows: CsvRow[], filename: string): void {
  if (rows.length === 0) return

  const blob = new Blob([toCsv(rows)], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `${filename}.csv`
  link.click()
  URL.revokeObjectURL(url)
}

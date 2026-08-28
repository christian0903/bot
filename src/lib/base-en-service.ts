/**
 * La base que l'application interroge, telle que déclarée dans `.env`.
 *
 * Le test est isolé ici parce que trois endroits en dépendent — le bandeau
 * d'avertissement, le retrait d'encoche du header et le décalage du header
 * lui-même — et qu'une règle recopiée est une règle qui finit par diverger.
 *
 * Le défaut penche du côté sûr : tout ce qui n'est pas explicitement `ops`
 * est traité comme une base de test, y compris une variable absente.
 */
export const estHorsProduction = import.meta.env.VITE_BASE !== 'ops'

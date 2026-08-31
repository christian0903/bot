import { BlocCours } from '@/components/vitrine/BlocCours'

/**
 * Les cours, en liste resserree avec fenetre de detail — servie par `/cours-2`.
 *
 * Cette presentation etait celle de `/cours` jusqu'au 2026-08-31. Christian lui
 * a prefere la grille du WordPress, qui a pris sa place ; celle-ci reste
 * accessible le temps de montrer les deux aux coachs.
 *
 * Ce qui suit explique pourquoi les cours ont une page a eux, et vaut pour les
 * deux presentations.
 *
 * Ils ont d'abord vecu dans la page d'accueil, atteints par une ancre. Le
 * defilement ne se declenchait pas depuis une AUTRE page : le navigateur
 * cherche l'ancre des qu'il recoit le document, quand React n'a pas encore
 * rendu la section. Trois tentatives de rattrapage n'ont pas tenu — l'une
 * dependait de `requestAnimationFrame`, suspendu dans un onglet d'arriere-plan.
 *
 * Une page repond a la meme question sans aucun de ces pieges : une adresse,
 * un contenu, aucun defilement a orchestrer.
 */
export function VitrineCoursListePage() {
  return <BlocCours enPage />
}

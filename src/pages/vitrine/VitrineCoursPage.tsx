import { BlocCours } from '@/components/vitrine/BlocCours'

/**
 * Les cours, sur leur propre page.
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
export function VitrineCoursPage() {
  return <BlocCours enPage />
}

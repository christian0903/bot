import { BlocTarifs } from '@/components/vitrine/BlocTarifs'

/**
 * Les tarifs, sur leur propre page — meme raison que pour les cours : une
 * ancre ne se rejoue pas de facon fiable depuis une autre page.
 *
 * Le contenu reste LU EN BASE : c'est le composant qui compte, pas l'endroit
 * ou on l'affiche.
 */
export function VitrineTarifsPage() {
  return <BlocTarifs />
}

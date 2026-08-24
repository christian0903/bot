import { Suspense, lazy } from 'react'

/**
 * Rend une annonce en Markdown, sans peser sur le démarrage.
 *
 * `react-markdown` et ses greffons pèsent ~34 ko gzip. Importés en statique
 * depuis l'accueil — la seule page qui n'est pas différée — ils partaient dans
 * le chargement initial de **tous** les visiteurs, y compris quand aucune
 * annonce n'était publiée. Le rendu est conditionnel : le chargement doit
 * l'être aussi.
 */
const RenduMarkdown = lazy(() => import('./RenduMarkdown'))

export function AnnonceMarkdown({ contenu }: { contenu: string }) {
  return (
    // Pas de squelette : une annonce arrive déjà dans une carte visible, et un
    // clignotement au chargement attirerait l'œil plus que le texte lui-même.
    <Suspense fallback={null}>
      <RenduMarkdown contenu={contenu} />
    </Suspense>
  )
}

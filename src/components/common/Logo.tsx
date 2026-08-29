import { useState } from 'react'
import { Dumbbell } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Le logo du studio, remplaçable sans toucher au code.
 *
 * Déposer un fichier nommé `logo.svg` (ou `.png`) dans `public/` suffit : il
 * est servi tel quel, sans reconstruction ni déploiement du code. Sans ce
 * fichier, l'icône d'origine s'affiche — l'application ne montre jamais une
 * image cassée.
 *
 * C'est le seul changement de charte qui touchait vraiment au code : les
 * couleurs, elles, vivent déjà dans les variables de `src/index.css`.
 *
 * Trois tailles, une par emplacement : l'en-tête, l'écran de connexion et la
 * page d'accueil. Elles sont nommées plutôt que passées en pixels pour que
 * deux écrans ne finissent pas avec deux logos de tailles voisines.
 */

const TAILLES = {
  header: 'h-6 w-6',
  auth: 'h-10 w-10',
  home: 'h-8 w-8',
} as const

/** Cherché dans `public/`, par ordre de préférence. */
const CANDIDATS = ['/logo.svg', '/logo.png']

export function Logo({
  taille = 'header',
  className,
}: {
  taille?: keyof typeof TAILLES
  className?: string
}) {
  // `index` avance à chaque échec de chargement : SVG, puis PNG, puis l'icône.
  // Sans ce repli, un studio qui dépose un PNG verrait une image brisée tant
  // qu'il n'a pas compris que le nom attendu était `.svg`.
  const [index, setIndex] = useState(0)
  const classes = cn(TAILLES[taille], className)

  if (index >= CANDIDATS.length) {
    return <Dumbbell className={cn(classes, 'text-primary')} />
  }

  return (
    <img
      src={CANDIDATS[index]}
      alt=""
      // `alt` vide et `aria-hidden` : le nom du studio est écrit juste à côté
      // dans les trois emplacements. Le répéter ferait dire deux fois la même
      // chose à un lecteur d'écran.
      aria-hidden
      className={cn(classes, 'object-contain')}
      onError={() => setIndex(i => i + 1)}
    />
  )
}

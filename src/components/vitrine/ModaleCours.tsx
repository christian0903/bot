import { useEffect, useRef } from 'react'
import { X } from 'lucide-react'

export type Cours = {
  nom: string
  categorie: string
  texte: string
  image: string
}

/**
 * Le detail d'un cours, en fenetre.
 *
 * Bati sur `<dialog>` plutot que sur un empilement de `div` : le navigateur
 * apporte alors gratuitement le fond assombri, le piege du focus au clavier,
 * la fermeture par Echap et le retour du focus au bouton d'ou l'on vient.
 * Refaire tout cela a la main demanderait beaucoup de code, et le ferait moins
 * bien — c'est typiquement ce qu'on rate sur l'accessibilite.
 */
export function ModaleCours({
  cours,
  onFermer,
}: {
  cours: Cours | null
  onFermer: () => void
}) {
  const ref = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialogue = ref.current
    if (!dialogue) return

    // `showModal()` et non l'attribut `open` : lui seul rend la fenetre
    // reellement modale — sans lui, on peut encore atteindre la page derriere
    // avec la touche de tabulation.
    if (cours && !dialogue.open) dialogue.showModal()
    if (!cours && dialogue.open) dialogue.close()
  }, [cours])

  // Fermer en cliquant a cote. L'evenement part du `<dialog>` lui-meme quand
  // le clic tombe sur le fond assombri : c'est ce qui distingue le dehors du
  // dedans, sans avoir a comparer des coordonnees.
  const clicDehors = (e: React.MouseEvent<HTMLDialogElement>) => {
    if (e.target === ref.current) onFermer()
  }

  return (
    <dialog
      ref={ref}
      className="v-modale"
      onClose={onFermer}
      onClick={clicDehors}
      aria-labelledby="titre-cours"
    >
      {/* Le contenu n'est monte que si un cours est choisi : sans cette garde,
          la fenetre garderait le texte du cours precedent une fraction de
          seconde en se refermant. */}
      {cours && (
        <div style={{ position: 'relative' }}>
          <img
            className="v-modale__image"
            src={cours.image}
            alt=""
            aria-hidden="true"
            width={1200}
            height={675}
          />
          <button
            type="button"
            className="v-modale__fermer"
            onClick={onFermer}
            aria-label="Fermer"
          >
            <X size={20} />
          </button>
          <div className="v-modale__corps">
            <p className="v-modale__categorie">{cours.categorie}</p>
            <h2 className="v-modale__titre" id="titre-cours">{cours.nom}</h2>
            <p className="v-modale__texte">{cours.texte}</p>
            <button
              type="button"
              className="v-bouton v-bouton--ligne"
              onClick={onFermer}
            >
              Fermer
            </button>
          </div>
        </div>
      )}
    </dialog>
  )
}

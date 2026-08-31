import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ModaleCours, type Cours } from './ModaleCours'

const URL_APP = import.meta.env.VITE_URL_APPLICATION || 'https://app.backontrackstudio.be'

// Les six cours. Les textes sont ceux du site WordPress, repris fidelement.
export const COURS: Cours[] = [
  {
    nom: 'Back on Track',
    categorie: 'Renforcement global',
    image: '/vitrine/DSC01143.webp',
    texte: "Idéal pour reprendre le sport à ton rythme. Tu y apprends les bases du renforcement musculaire et les bons gestes. Confiance, sécurité et progrès garantis.",
  },
  {
    nom: 'Ladies',
    categorie: 'Renforcement & cardio entre femmes',
    image: '/vitrine/DSC02643.webp',
    texte: "Le cours Back on Track en version 100 % féminine. Même approche : renforcement complet et progression à votre rythme, avec un accent particulier sur la préservation du périnée pendant le travail de la sangle abdominale et du bas du corps.",
  },
  {
    nom: 'Boxing',
    categorie: 'Cardio & renfo fonctionnel',
    image: '/vitrine/DSC02813.webp',
    texte: "Technique, cardio et renforcement. On travaille sur sac de frappe et pattes d'ours pour apprendre les gestes, se dépenser et évacuer. Pas besoin d'avoir boxé un jour dans sa vie : venir, passer un bon moment et se défouler suffit.",
  },
  {
    nom: 'Crosstraining',
    categorie: 'Cardio & renfo fonctionnel',
    image: '/vitrine/CrossTraining.webp',
    texte: "Un entraînement varié qui combine force, cardio et mouvements fonctionnels. Chaque séance est différente, l'intensité s'adapte à vous. De quoi progresser sur tous les tableaux sans jamais s'ennuyer.",
  },
  {
    nom: 'Mobility & Stretch',
    categorie: 'Mobilité, tronc & prévention des douleurs',
    image: '/vitrine/small-group.webp',
    texte: "Une séance pour retrouver de l'amplitude, relâcher les tensions et bouger plus librement. Mobilité articulaire, étirements et respiration : le complément indispensable à un corps qui s'entraîne — ou qui reste assis toute la journée.",
  },
  {
    nom: 'Adolescents',
    categorie: 'Renforcement, souplesse et agilité',
    image: '/vitrine/DSC02513.webp',
    texte: "Un cours dédié aux 12-17 ans : apprendre à connaître son corps et à le rendre plus fort, par le renforcement, la mobilité ou l'agilité. Groupes de 4 au maximum, séparés en deux catégories — 12-14 ans et 15-17 ans.",
  },
]

/**
 * Les six cours, avec leur fenetre de detail.
 *
 * Le meme bloc sert la page d'accueil et la page `/cours` : `enPage` change la
 * mise en forme, jamais le contenu. Deux copies du texte auraient fini par
 * diverger — c'est exactement ce qui est arrive au site WordPress, qui
 * annoncait deux delais d'annulation differents sur deux pages.
 */
export function BlocCours({ enPage = false }: { enPage?: boolean }) {
  const [coursOuvert, setCoursOuvert] = useState<Cours | null>(null)

  const pastilles = (
    <>
      <div className="v-cours">
        {COURS.map((c) => (
          <button
            type="button"
            className="v-cours__pastille"
            key={c.nom}
            onClick={() => setCoursOuvert(c)}
          >
            {c.nom}
          </button>
        ))}
      </div>
      <p style={{ marginTop: '1rem', fontSize: '0.9375rem', opacity: 0.7 }}>
        Cliquez sur un cours pour en savoir plus.
      </p>
      <div className="v-boutons" style={{ marginTop: '1.5rem' }}>
        <Link className="v-bouton v-bouton--plein" to="/planning">
          Consulter l'horaire
        </Link>
        <a className="v-bouton v-bouton--ligne" href={`${URL_APP}/auth`}>
          Réserver ma séance d'essai
        </a>
      </div>
    </>
  )

  return (
    <>
      <section className="v-section v-section--sombre" id="les-cours">
        {enPage ? (
          // Sur sa propre page, le bloc s'ouvre par un titre de niveau 1 et la
          // photo passe dessous : la page n'a pas d'autre contenu a annoncer.
          <div className="v-largeur">
            <h1 className="v-titre-section">Nos cours</h1>
            <p className="v-chapeau">
              Renforcement, cardio, mobilité, boxe — tous en petits groupes de
              cinq, tous adaptés à votre niveau. Que vous soyez débutant,
              confirmé ou en reprise, le coach ajuste la séance à votre profil.
            </p>
            {pastilles}
            {/* `loading="lazy"` a ete retire : sur cette page l'image est le
                seul contenu sous les boutons, et le chargement differe laissait
                un grand vide noir a la place. Elle est visible d'emblee, elle
                se charge d'emblee. */}
            <img
              className="v-duo__image"
              src="/vitrine/CrossTraining.webp"
              alt="Séance de crosstraining au studio"
              width={1600}
              height={1200}
              style={{ marginTop: '3rem' }}
            />
          </div>
        ) : (
          <div className="v-largeur v-duo">
            <img
              className="v-duo__image"
              src="/vitrine/CrossTraining.webp"
              alt="Séance de crosstraining au studio"
              width={1600}
              height={1200}
              loading="lazy"
            />
            <div>
              <h2 className="v-titre-section">Six cours, une seule exigence</h2>
              <p className="v-chapeau">
                Renforcement, cardio, mobilité, boxe — tous en petits groupes de
                cinq, tous adaptés à votre niveau. Que vous soyez débutant,
                confirmé ou en reprise, le coach ajuste la séance à votre profil.
              </p>
              {pastilles}
            </div>
          </div>
        )}
      </section>

      <ModaleCours cours={coursOuvert} onFermer={() => setCoursOuvert(null)} />
    </>
  )
}

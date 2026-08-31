import { Link } from 'react-router-dom'

const URL_APP = import.meta.env.VITE_URL_APPLICATION || 'https://app.backontrackstudio.be'

/**
 * Les cours, sur `/cours` — la presentation retenue.
 *
 * C'est la grille de la page « Nos cours semi-prives » du WordPress : trois
 * colonnes, chaque carte portant sa photo, son nom, une pastille de couleur et
 * son texte, dans sa longueur d'origine.
 *
 * L'autre presentation — cartes resserrees et fenetre de detail — reste servie
 * par `/cours-2` (`VitrineCoursListePage`) le temps de la montrer aux coachs.
 * Elle se supprimera ensuite ; c'est celle-ci qui reste.
 */

/**
 * L'ordre, les textes et les couleurs sont ceux du WordPress, releves sur
 * `cours-semi-prives.html`. La couleur n'est pas decorative : elle distingue
 * les familles de cours d'un coup d'oeil dans une grille de six.
 */
const COURS_2 = [
  {
    nom: 'Mobility & Stretch',
    sousTitre: 'Mobilité, tronc & prévention douleurs',
    couleur: '#50ca4e',
    image: '/vitrine/DSC00865.webp',
    texte: "Une séance pour retrouver de l'amplitude, relâcher les tensions et bouger plus librement. Mobilité articulaire, étirements et respiration : le complément indispensable à un corps qui s'entraîne ou qui reste assis toute la journée :)",
  },
  {
    nom: 'Back on Track',
    sousTitre: 'Renforcement global',
    couleur: '#4d79ff',
    image: '/vitrine/DSC01002.webp',
    texte: "Idéal pour reprendre le sport à ton rythme. Tu y apprends les bases du renforcement musculaire, les bons gestes. Confiance, sécurité et progrès garantis.",
  },
  {
    nom: 'Ladies',
    sousTitre: 'Renforcement global & cardio entre femmes',
    couleur: '#cb3fe4',
    image: '/vitrine/DSC02613.webp',
    texte: "Le cours BackOnTrack en version 100 % féminine. Même approche : renforcement complet et progression à votre rythme. Avec un accent particulier pour la préservation du périnée durant le travail de la sangle abdominale et le bas du corps !",
  },
  {
    nom: 'Boxing',
    sousTitre: 'Cardio & renfo fonctionnel',
    couleur: '#ccaa00',
    image: '/vitrine/DSC02813.webp',
    texte: "Technique, cardio et renforcement. On travaille sur sac de frappes et pattes d'ours pour apprendre les gestes, se dépenser et évacuer. Pas besoin d'avoir boxé un jour dans sa vie. Juste venir, passer un bon moment et se défouler",
  },
  {
    nom: 'Crosstraining',
    sousTitre: 'Cardio & renfo fonctionnel',
    couleur: '#ff773d',
    image: '/vitrine/CrossTraining.webp',
    texte: "Un entraînement varié qui combine force, cardio et mouvements fonctionnels. Chaque séance est différente, l'intensité s'adapte à vous. De quoi progresser sur tous les tableaux sans jamais s'ennuyer.",
  },
  {
    nom: 'Adolescent',
    sousTitre: 'Renforcement, souplesse, agilité, prise de conscience du corps en mouvement',
    couleur: '#d63838',
    image: '/vitrine/IMG_5849.webp',
    texte: "Cours dédié aux adolescents à partir de 12 ans jusque 17 ans, l'idée est d'apprendre à connaitre son corps et comment le rendre plus fort que ca soit à travers du renforcement, de la mobilité ou de l'agilité. Petits groupes de maximum 4 séparé en 2 catégories : 12/14 ans et 15/17 ans",
  },
]

export function VitrineCoursPage() {
  return (
    <>
      <section className="v-section">
        <div className="v-largeur">
          <h1 className="v-titre-section v-cours2__titre">Nos cours semi-privés</h1>
          <p className="v-cours2__chapeau">
            Trouve le format, l'intensité et l'énergie qui matchent avec tes
            objectifs.
          </p>

          <div className="v-cours2__grille">
            {COURS_2.map((c) => (
              <article className="v-cours2" key={c.nom}>
                <img
                  className="v-cours2__image"
                  src={c.image}
                  alt=""
                  aria-hidden="true"
                  width={1200}
                  height={800}
                  loading="lazy"
                />
                <div className="v-cours2__corps">
                  <h2 className="v-cours2__nom">{c.nom}</h2>
                  {/* La couleur vient de la donnee et non d'une classe : six
                      teintes pour six cours, chacune n'ayant qu'un seul
                      usage — une classe par couleur n'apporterait rien. */}
                  <p className="v-cours2__pastille" style={{ background: c.couleur }}>
                    {c.sousTitre}
                  </p>
                  <p className="v-cours2__texte">{c.texte}</p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* Le meme appel que sur l'accueil : c'est celui du WordPress au bas de
          cette page. */}
      <section className="v-section v-section--sombre v-appel-bandeau">
        <div className="v-largeur">
          <h2 className="v-titre-section">
            Prêt·e à te (re)mettre en mouvement&nbsp;?
          </h2>
          <p className="v-chapeau">
            On t'attend pour transpirer, rigoler et progresser dans une ambiance
            bienveillante.
          </p>
          <div className="v-boutons">
            <Link className="v-bouton v-bouton--ligne" to="/tarifs">
              Tarifications
            </Link>
            <a className="v-bouton v-bouton--plein" href={`${URL_APP}/auth`}>
              Séance d'essai gratuite
            </a>
          </div>
        </div>
      </section>
    </>
  )
}

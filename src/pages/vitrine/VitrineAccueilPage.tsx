import { Link } from 'react-router-dom'
import { MapPin, Check, ArrowRight } from 'lucide-react'
import { BlocCours } from '@/components/vitrine/BlocCours'
import { BlocTarifs } from '@/components/vitrine/BlocTarifs'
import { BlocFaq } from '@/components/vitrine/BlocFaq'

const URL_APP = import.meta.env.VITE_URL_APPLICATION || 'https://app.backontrackstudio.be'

// Le contenu vit en tete de fichier, separe du balisage : corriger un texte ou
// changer une photo ne demande pas de lire le JSX. Les textes sont ceux du site
// WordPress, repris fidelement.

const CHIFFRES = [
  { valeur: '5', libelle: 'participants au maximum par cours' },
  { valeur: '50', libelle: 'minutes par séance' },
  { valeur: '7j/7', libelle: 'des créneaux matin et soir' },
]

const ARGUMENTS = [
  'Jamais plus de 5 personnes par cours — on apprend vraiment à vous connaître',
  'On s\'adapte à vous, pas l\'inverse',
  'Un suivi qui évolue en fonction de vos progrès et de vos ressentis',
  'Une ambiance où l\'on peut autant transpirer que rire',
]

const FORMULES = [
  {
    titre: 'Cours semi-privés',
    image: '/vitrine/small-group.webp',
    texte: "L'énergie d'un cours collectif avec l'attention d'un coach particulier. Des cours variés en petits groupes de 5 personnes maximum, pour progresser à votre rythme dans une ambiance dynamique.",
    lien: '/cours',
    libelleLien: 'Voir les cours',
  },
  {
    titre: 'Personal training',
    image: '/vitrine/PT.webp',
    texte: 'Un accompagnement sur mesure pour atteindre vos objectifs. Votre coach dédié élabore un programme adapté à vos besoins, votre niveau et vos contraintes.',
    lien: '/contact',
    libelleLien: 'Nous contacter',
  },
  {
    titre: 'Coaching en entreprise',
    image: '/vitrine/Coaching-en-entreprise.webp',
    texte: "1 h de temps libre = 1 h de coaching. Notre équipe se déplace dans vos bureaux, avec le matériel si nécessaire : des horaires plus souples, le bien-être de vos collaborateurs, et un gain de temps considérable.",
    lien: '/contact',
    libelleLien: 'Demander un devis',
  },
]


const COACHS = [
  {
    prenom: 'Anselme',
    photo: '/vitrine/portrait-capture.webp',
    texte: "Notre spécialiste de l'endurance, qui trouve toujours le mot juste pour vous faire donner ce petit effort supplémentaire.",
    objectif: "Te donner le goût de revenir jour après jour pour te dépasser, sans te blesser.",
  },
  {
    prenom: 'Gauthier',
    photo: '/vitrine/IMG_4900.webp',
    texte: "Toujours à la recherche de nouvelles formations dans le domaine de la santé. Vous me trouverez dans tous nos cours semi-privés ainsi qu'en personal training.",
    objectif: "Trois piliers essentiels : l'écoute, le partage et la progressivité.",
  },
  {
    prenom: 'Joan',
    photo: '/vitrine/IMG_4857.webp',
    texte: "Sportif passionné et coureur aguerri, j'accompagne chacun avec exigence et bienveillance pour retrouver sa forme, son énergie et sa confiance.",
    objectif: "Vous transmettre le goût de l'effort et du progrès, dans une ambiance positive et accessible à tous.",
  },
]

export function VitrineAccueilPage() {
  return (
    <>
      {/* ---- Le hero ---------------------------------------------------- */}
      <section className="v-hero">
        <img
          className="v-hero__fond"
          src="/vitrine/DSC00990.webp"
          alt=""
          /* Une photo de decor : elle n'apporte rien a qui ne la voit pas, et
             un lecteur d'ecran qui la decrirait ne ferait que retarder l'acces
             au titre. D'ou l'alt vide, volontaire. */
          aria-hidden="true"
          width={1600}
          height={1200}
          /* Cette image est le premier pixel affiche : la charger en priorite
             plutot qu'en differe est ce qui separe une page qui s'ouvre d'une
             page qui clignote. */
          fetchPriority="high"
        />
        <div className="v-hero__voile" />
        <div className="v-hero__contenu">
          <p className="v-hero__lieu">
            <MapPin size={15} aria-hidden="true" />
            Rixensart · Avenue de Merode 64
          </p>
          <h1 className="v-hero__titre">
            Le studio où chacun compte
          </h1>
          <p className="v-hero__accroche">
            Un accompagnement fitness adapté à VOTRE vie, dans une ambiance
            où l'on se sent bien. Pas de grandes salles impersonnelles :
            cinq personnes maximum, et un coach qui vous connaît.
          </p>
          <div className="v-boutons">
            <a className="v-bouton v-bouton--plein" href={`${URL_APP}/auth`}>
              Réserver ma séance d'essai
            </a>
            <Link className="v-bouton v-bouton--ligne" to="/cours">
              Découvrir les cours
            </Link>
          </div>
        </div>
      </section>

      {/* ---- Les chiffres ----------------------------------------------- */}
      <section className="v-chiffres">
        <div className="v-chiffres__grille">
          {CHIFFRES.map(({ valeur, libelle }) => (
            <div key={libelle}>
              <div className="v-chiffre__valeur">{valeur}</div>
              <div className="v-chiffre__libelle">{libelle}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ---- Le studio -------------------------------------------------- */}
      <section className="v-section" id="le-studio">
        <div className="v-largeur v-duo">
          <div>
            <h2 className="v-titre-section">Le studio à taille humaine</h2>
            <p className="v-chapeau" style={{ marginBottom: 0 }}>
              Chez nous, pas de grandes salles impersonnelles ni de machines à
              perte de vue. Back on Track est né d'une conviction simple : le
              fitness devrait être accessible à tous, dans un cadre où l'on se
              sent à l'aise.
            </p>
            <ul className="v-arguments">
              {ARGUMENTS.map((texte) => (
                <li className="v-argument" key={texte}>
                  <span className="v-argument__puce" aria-hidden="true">
                    <Check size={15} strokeWidth={3} />
                  </span>
                  <span>{texte}</span>
                </li>
              ))}
            </ul>
          </div>
          <img
            className="v-duo__image"
            src="/vitrine/DSC01143.webp"
            alt="Un cours semi-privé en cours dans le studio"
            width={1600}
            height={1200}
            loading="lazy"
          />
        </div>
      </section>

      {/* ---- Les formules ----------------------------------------------- */}
      <section className="v-section v-section--alt" id="formules">
        <div className="v-largeur">
          <h2 className="v-titre-section">Nos formules</h2>
          <p className="v-chapeau">
            Seul ou en petit groupe, au studio ou dans vos bureaux.
          </p>
          <div className="v-grille v-grille--large">
            {FORMULES.map((f) => (
              <article className="v-formule" key={f.titre}>
                <img
                  className="v-formule__image"
                  src={f.image}
                  alt=""
                  aria-hidden="true"
                  width={1200}
                  height={800}
                  loading="lazy"
                />
                <div className="v-formule__corps">
                  <h3 className="v-carte__titre">{f.titre}</h3>
                  <p className="v-carte__texte">{f.texte}</p>
                  <Link className="v-formule__lien" to={f.lien}>
                    {f.libelleLien}
                    <ArrowRight size={17} aria-hidden="true" />
                  </Link>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ---- Les cours, avec leur fenetre de detail ------------------ */}
      <BlocCours />

      {/* ---- Les coachs ------------------------------------------------- */}
      <section className="v-section" id="coachs">
        <div className="v-largeur">
          <h2 className="v-titre-section">Notre équipe</h2>
          <p className="v-chapeau">
            Trois coachs, et la même façon de travailler : on s'adapte à vous.
          </p>
          <div className="v-grille">
            {COACHS.map((c) => (
              <article className="v-coach" key={c.prenom}>
                <img
                  className="v-coach__photo"
                  src={c.photo}
                  alt={`${c.prenom}, coach au studio Back on Track`}
                  width={1200}
                  height={1600}
                  loading="lazy"
                />
                <h3 className="v-coach__nom">{c.prenom}</h3>
                <p className="v-carte__texte">{c.texte}</p>
                <p className="v-coach__objectif">{c.objectif}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ---- Les tarifs, lus en base ------------------------------------ */}
      <BlocTarifs />

      {/* ---- Les questions frequentes ----------------------------------- */}
      <BlocFaq />

      {/* ---- L'appel final ---------------------------------------------- */}
      <section className="v-section v-section--alt">
        <div className="v-largeur">
          <div className="v-appel">
            <h2 className="v-appel__titre">
              La première séance est offerte
            </h2>
            <p className="v-appel__texte">
              Sans engagement, pour découvrir notre approche et le studio.
              La réservation se fait dans l'application, depuis un navigateur
              ou depuis l'écran d'accueil de votre téléphone.
            </p>
            <div className="v-boutons">
              <a className="v-bouton v-bouton--plein" href={`${URL_APP}/auth`}>
                Réserver ma séance d'essai
              </a>
              <Link className="v-bouton v-bouton--ligne" to="/contact">
                Nous poser une question
              </Link>
            </div>
          </div>
        </div>
      </section>
    </>
  )
}

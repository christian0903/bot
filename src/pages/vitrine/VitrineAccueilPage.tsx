import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Check, ArrowRight } from 'lucide-react'
import { BlocCours } from '@/components/vitrine/BlocCours'
import { BlocTarifs } from '@/components/vitrine/BlocTarifs'
import { BlocFaq } from '@/components/vitrine/BlocFaq'

const URL_APP = import.meta.env.VITE_URL_APPLICATION || 'https://app.backontrackstudio.be'

// La video de fond du hero, reprise du site WordPress. `nocookie` sert le
// lecteur sans deposer de cookie publicitaire tant que rien n'est joue : c'est
// ce qui evite d'avoir a demander un consentement pour la page d'accueil.
//
// Les parametres reproduisent l'ancien reglage : elle demarre seule, muette et
// en boucle, sans commandes ni suggestions de fin. `playlist` valant l'id de la
// video est la seule facon de faire boucler un `embed` isole — sans lui, `loop`
// est ignore.
const VIDEO_HERO = 'A3FVv05feQI'
const VIDEO_HERO_SRC =
  `https://www.youtube-nocookie.com/embed/${VIDEO_HERO}` +
  `?autoplay=1&mute=1&loop=1&playlist=${VIDEO_HERO}` +
  '&controls=0&rel=0&showinfo=0&modestbranding=1&playsinline=1&iv_load_policy=3&disablekb=1'

// Le contenu vit en tete de fichier, separe du balisage : corriger un texte ou
// changer une photo ne demande pas de lire le JSX. Les textes sont ceux du site
// WordPress, repris fidelement.

const CHIFFRES = [
  { valeur: '5', libelle: 'participants au maximum par cours' },
  { valeur: '50', libelle: 'minutes par séance' },
  { valeur: '7j/7', libelle: 'des créneaux matin et soir' },
]

const ARGUMENTS = [
  'Jamais plus de 5 personnes par cours (on apprend vraiment à vous connaître !)',
  'On s\'adapte à vous, pas l\'inverse',
  'Un suivi qui évolue en fonction de vos progrès et ressentis',
  'Une ambiance où l\'on peut autant transpirer que rire',
]

const FORMULES = [
  {
    titre: 'Cours semi-privés',
    image: '/vitrine/small-group.webp',
    texte: "L'énergie d'un cours collectif avec l'attention d'un coach particulier. Nos cours variés en petits groupes (5 personnes max) vous permettent de progresser à votre rythme dans une ambiance dynamique.",
    lien: '/cours',
    libelleLien: 'Explorer les cours semi-privés',
  },
  {
    titre: 'Personal Training',
    image: '/vitrine/PT.webp',
    texte: 'Un accompagnement personnel sur mesure pour atteindre vos objectifs spécifiques. Votre coach dédié élabore un programme adapté à vos besoins, votre niveau et vos contraintes.',
    lien: '/contact',
    libelleLien: 'Nos formules',
  },
  {
    titre: 'Coaching en entreprise',
    image: '/vitrine/Coaching-en-entreprise.webp',
    // Le WordPress ouvre ce bloc par une accroche detachee du paragraphe.
    accroche: '1H de temps libre = 1H de coaching',
    texte: "Notre équipe se déplace directement jusque dans vos bureaux, avec matériel si nécessaire, pour des horaires plus flexibles, le bien être de vos collaborateurs et un gain de temps considérable !",
    lien: '/contact',
    libelleLien: 'Nos formules',
  },
]


const COACHS = [
  {
    prenom: 'Anselme',
    photo: '/vitrine/portrait-capture.webp',
    texte: "Notre spécialiste de l'endurance qui trouve toujours le mot juste pour vous faire donner ce petit effort supplémentaire",
    objectif: "Mon objectif : te donner le gout de vouloir revenir jour après jour pour te dépasser sans te blesser.",
  },
  {
    prenom: 'Gauthier',
    photo: '/vitrine/IMG_4900.webp',
    texte: "Toujours à la recherche de nouvelles formations dans le domaine de la santé, vous me trouverez dans tous nos cours semi-privés ainsi qu'en personal training.",
    objectif: "Mon objectif : il repose sur trois piliers essentiels, l'écoute, le partage et la progressivité.",
  },
  {
    prenom: 'Joan',
    photo: '/vitrine/IMG_4857.webp',
    texte: "Sportif passionné et coureur aguerri, j'accompagne chacun avec exigence et bienveillance pour retrouver sa forme, son énergie et sa confiance.",
    objectif: "Mon objectif : vous transmettre le goût de l'effort, du progrès et du dépassement de soi, dans une ambiance positive et accessible à tous.",
  },
]

export function VitrineAccueilPage() {
  // La video ne se pose qu'une fois la page affichee et interactive. L'iframe
  // YouTube tire pres d'un demi-megaoctet de script : la charger d'emblee
  // retarderait le titre, c'est-a-dire la seule chose que le visiteur est venu
  // lire. La photo tient le fond en attendant, puis la video se substitue.
  const [videoPosee, setVideoPosee] = useState(false)

  useEffect(() => {
    // Qui a demande moins d'animations garde la photo : une video plein ecran
    // qui tourne en boucle est precisement ce que ce reglage systeme vise.
    const sobre = window.matchMedia('(prefers-reduced-motion: reduce)')
    if (sobre.matches) return

    // `requestIdleCallback` attend que le navigateur n'ait plus rien d'urgent.
    // Safari ne le connait pas, d'ou le repli sur un delai court.
    const lancer = () => setVideoPosee(true)
    const idle = window.requestIdleCallback
    if (idle) {
      const id = idle(lancer, { timeout: 2500 })
      return () => window.cancelIdleCallback?.(id)
    }
    const t = window.setTimeout(lancer, 1200)
    return () => window.clearTimeout(t)
  }, [])

  return (
    <>
      {/* ---- Le hero -----------------------------------------------------
          La video de fond, le voile, le texte, et l'invite a defiler : c'est
          la composition du site d'origine, que les coachs connaissent. */}
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
             page qui clignote. Elle reste sous la video — si YouTube est
             bloque ou lent, le hero ne devient jamais un rectangle noir. */
          fetchPriority="high"
        />

        {videoPosee && (
          <div className="v-hero__video" aria-hidden="true">
            <iframe
              src={VIDEO_HERO_SRC}
              title=""
              /* La video n'est que decor : elle ne porte aucune information et
                 ne doit donc pas se presenter au clavier ni aux lecteurs
                 d'ecran, qui n'y trouveraient qu'un cadre vide a traverser. */
              tabIndex={-1}
              frameBorder="0"
              allow="autoplay; encrypted-media; picture-in-picture"
              referrerPolicy="strict-origin-when-cross-origin"
              loading="lazy"
            />
          </div>
        )}

        <div className="v-hero__voile" />

        <div className="v-hero__contenu">
          <p className="v-hero__lieu">
            Back On Track
            <span className="v-hero__adresse">
              Avenue de Merode 64, 1330 Rixensart
            </span>
          </p>
          <h1 className="v-hero__titre">
            Studio de fitness à Rixensart
          </h1>
          <p className="v-hero__accroche">
            Un accompagnement fitness adapté à VOTRE vie, dans une ambiance
            où l'on se sent bien.
          </p>
          <div className="v-boutons">
            <Link className="v-bouton v-bouton--plein" to="/cours">
              Découvrir nos cours
            </Link>
            <a className="v-bouton v-bouton--ligne" href={`${URL_APP}/auth`}>
              Séance d'essai gratuite
            </a>
          </div>
        </div>

        {/* L'invite a defiler du site d'origine : la souris et son mot. Elle
            mene a la premiere section, et se laisse donc activer au clavier
            comme n'importe quel lien d'ancre. */}
        <a className="v-hero__explorer" href="#le-studio">
          <span className="v-hero__souris" aria-hidden="true" />
          <span className="v-hero__explorer-mot">Explorer</span>
        </a>
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
              perte de vue. <strong>Back on Track, c'est avant tout un espace à
              taille humaine où chacun compte</strong>. Notre petit studio à
              Rixensart est né d'une conviction simple : le fitness devrait être
              accessible à tous, dans un cadre où l'on se sent à l'aise.
            </p>
            <p className="v-chapeau" style={{ marginBottom: 0 }}>
              Nous avons créé un environnement bienveillant où vous serez
              toujours entouré. Que vous choisissiez un accompagnement
              individuel ou nos petits cours de 5 personnes maximum
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
          <h2 className="v-titre-section">Nos formules de cours</h2>
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
                  {/* Le WordPress detache cette ligne du paragraphe, en avant. */}
                  {f.accroche && (
                    <p className="v-formule__accroche">{f.accroche}</p>
                  )}
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

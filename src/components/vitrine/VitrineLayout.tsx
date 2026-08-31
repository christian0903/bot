import { useState } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { Menu, X } from 'lucide-react'
import '@/vitrine.css'

// L'adresse de l'application, ou part tout ce qui demande un compte. Elle est
// lue dans la configuration plutot qu'ecrite en dur : pendant la mise au point,
// la vitrine de demonstration pointe vers `jag.` et non vers la production.
const URL_APP = import.meta.env.VITE_URL_APPLICATION || 'https://app.backontrackstudio.be'

// Les cours et les tarifs ont LEUR PROPRE PAGE, et non une ancre dans la page
// d'accueil. Une ancre ne se rejoue pas de facon fiable depuis une autre page :
// le navigateur la cherche avant que React ait rendu la section, et on restait
// en haut. Trois rattrapages n'ont pas tenu — l'un dependait de
// `requestAnimationFrame`, suspendu dans un onglet d'arriere-plan.
//
// Une page repond a la meme question sans aucun de ces pieges.
const MENU = [
  { chemin: '/', libelle: 'Accueil' },
  { chemin: '/cours', libelle: 'Les cours' },
  { chemin: '/planning', libelle: 'Horaires' },
  { chemin: '/tarifs', libelle: 'Tarifs' },
  { chemin: '/contact', libelle: 'Contact' },
]

/**
 * L'ossature des pages vitrine : en-tete, contenu, pied de page.
 *
 * Rien a voir avec le `Layout` de l'application, et c'est voulu. Celui-ci
 * s'adresse a des membres connectes — barre de navigation mobile, bandeau de
 * base de test, menu de compte ; celui-la s'adresse a des visiteurs qui ne
 * connaissent pas encore le studio. Les fondre en un seul obligerait a
 * arbitrer entre les deux publics a chaque retouche.
 */
export function VitrineLayout() {
  const [menuOuvert, setMenuOuvert] = useState(false)
  const { pathname } = useLocation()

  // Le menu deplie reste ouvert d'une page a l'autre si personne ne le ferme :
  // sur telephone, on cliquait un lien et le menu masquait la page d'arrivee.
  const fermer = () => setMenuOuvert(false)

  return (
    <div className="vitrine">
      <a className="v-evitement" href="#contenu">Aller au contenu</a>

      <header className="v-entete">
        <div className="v-entete__barre" style={{ position: 'relative' }}>
          <Link to="/" className="v-entete__logo" onClick={fermer}>
            <img
              src="/vitrine/Sans-titre-4-02.webp"
              alt="Back on Track Studio"
              width={340}
              height={135}
            />
          </Link>

          <nav
            className={`v-menu${menuOuvert ? ' est-ouvert' : ''}`}
            aria-label="Menu principal"
          >
            {MENU.map(({ chemin, libelle }) => (
              <NavLink
                key={chemin}
                to={chemin}
                end={chemin === '/'}
                onClick={fermer}
                aria-current={pathname === chemin ? 'page' : undefined}
              >
                {libelle}
              </NavLink>
            ))}
            <a className="v-bouton v-bouton--plein" href={`${URL_APP}/auth`}>
              Se connecter
            </a>
          </nav>

          {/* Sur telephone, « Se connecter » sort du menu replie et reste
              visible en permanence : c'est l'action que le site existe pour
              provoquer, elle ne se cache pas derriere un hamburger. Le CSS le
              masque sur grand ecran, ou il vit deja dans le menu. */}
          <a
            className="v-bouton v-bouton--plein v-entete__action"
            href={`${URL_APP}/auth`}
            onClick={fermer}
          >
            Se connecter
          </a>

          <button
            type="button"
            className="v-bascule"
            aria-label={menuOuvert ? 'Fermer le menu' : 'Ouvrir le menu'}
            aria-expanded={menuOuvert}
            onClick={() => setMenuOuvert((o) => !o)}
          >
            {menuOuvert ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </header>

      <main id="contenu">
        <Outlet />
      </main>

      <footer className="v-pied">
        <div className="v-pied__grille">
          <div>
            <p className="v-pied__titre">Back on Track Studio</p>
            <p style={{ margin: 0 }}>
              Avenue de Merode 64<br />
              1330 Rixensart
            </p>
          </div>

          <div>
            <p className="v-pied__titre">Nous joindre</p>
            <ul className="v-pied__liens">
              <li><a href="tel:+32470296169">+32 470 29 61 69</a></li>
              <li>
                <a href="mailto:info@backontrackstudio.be">
                  info@backontrackstudio.be
                </a>
              </li>
            </ul>
          </div>

          <div>
            <p className="v-pied__titre">Le studio</p>
            <ul className="v-pied__liens">
              {MENU.slice(1).map(({ chemin, libelle }) => (
                <li key={chemin}>
                  <Link to={chemin}>{libelle}</Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <p className="v-pied__titre">Nous suivre</p>
            <ul className="v-pied__liens">
              <li>
                <a
                  href="https://www.instagram.com/back_on_track1330/"
                  target="_blank"
                  rel="noreferrer"
                >
                  Instagram
                </a>
              </li>
              <li>
                <a
                  href="https://www.facebook.com/people/Back-On-Track/61564299572758/"
                  target="_blank"
                  rel="noreferrer"
                >
                  Facebook
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="v-pied__bas">
          <span>© {new Date().getFullYear()} Back on Track Studio</span>
          {/* Les mentions legales vivent dans l'application, qui en est la
              source unique : les dupliquer ici, c'est se condamner a les voir
              diverger. */}
          <span style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
            <a href={`${URL_APP}/cgv`}>CGV</a>
            <a href={`${URL_APP}/confidentialite`}>Confidentialité</a>
          </span>
        </div>
      </footer>
    </div>
  )
}

import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'

/**
 * Les questions frequentes.
 *
 * Fusion des trois FAQ de l'ancien site — tarifs, horaire et cours — d'ou
 * quelques doublons ont ete retires : « dois-je apporter du materiel » et
 * « puis-je changer de cours » y figuraient deux fois, avec des reponses
 * legerement differentes.
 *
 * Bati sur `<details>` : le navigateur gere l'ouverture, la fermeture et le
 * clavier tout seul, et le contenu reste dans la page pour qui la cherche avec
 * Ctrl+F — ce qu'un accordeon en JavaScript casse presque toujours.
 */

const URL_APP = import.meta.env.VITE_URL_APPLICATION || 'https://app.backontrackstudio.be'

// `{delai}`, `{delaiPt}` et `{frais}` sont remplaces par les valeurs lues en
// base. Les ecrire en dur est exactement ce qui a fait diverger l'ancien site,
// qui annoncait 12 h sur une page et 24 h sur une autre.
//
// Aucune des six questions ci-dessous ne s'en sert aujourd'hui : le mecanisme
// tourne a vide. Il est conserve parce qu'une question sur les delais ou les
// frais reviendra tot ou tard, et qu'elle devra lire la base plutot que
// figer un chiffre.
// Les six questions du site d'origine, avec leurs reponses mot pour mot.
//
// La vitrine en affichait douze, ecrites pour l'occasion : la page y gagnait
// en exhaustivite ce qu'elle perdait en lisibilite. Christian a tranche pour
// les six du WordPress — l'accordeon garde l'ensemble compact.
//
// Le tutoiement de deux reponses vient de l'original : le site d'origine
// alterne vouvoiement et tutoiement. Corriger cette hesitation serait
// s'ecarter de la copie fidele ; c'est une decision editoriale a prendre a
// part.
const QUESTIONS: { q: string; r: string }[] = [
  {
    q: 'Où se trouve le studio ?',
    r: "Notre studio se trouve Avenue de Mérode 64 à Rixensart, dans un cadre privé et convivial. Pour préserver la qualité de nos séances, l'accès se fait uniquement sur réservation. Nous serons ravis de vous y accueillir !",
  },
  {
    q: 'Les cours sont-ils adaptés aux débutants ?',
    r: "Oui ! Que tu n'aies jamais mis un pied dans une salle de sport ou que tu reprennes après une pause, nos coachs adaptent chaque séance à ton niveau.",
  },
  {
    q: 'Combien de personnes par cours ?',
    r: "Les cours sont en petit groupe (maximum 5 personnes), pour garantir un encadrement de qualité et une vraie attention individuelle.",
  },
  {
    q: 'Proposez-vous du coaching en entreprise ?',
    r: "Oui, nous proposons du coaching en entreprise adapté aux besoins spécifiques de chaque structure.",
  },
  {
    q: 'Où peut-on se garer pour venir au studio ?',
    r: "Vous pouvez vous garer facilement autour du studio. L'Avenue des Pâquerettes, située juste à côté, dispose de places en zone bleue (disque de stationnement obligatoire avant 18h). Vous pouvez également utiliser le grand parking gratuit de l'Intermarché, situé juste en face du Ciné Centre, à seulement une centaine de mètres du studio.",
  },
  {
    q: 'Je veux tester, comment faire ?',
    r: "Prend contact avec nous via le formulaire disponible et nous te recontacterons le plus rapidement !",
  },
]

export function BlocFaq() {
  // Valeurs de repli identiques a celles du code de reservation : si la lecture
  // echoue, la vitrine annonce ce que l'application applique par defaut.
  const [delai, setDelai] = useState(12)
  const [delaiPt, setDelaiPt] = useState(24)
  const [frais, setFrais] = useState('30 €')

  useEffect(() => {
    // Une seule requete pour les deux reglages : deux allers-retours pour deux
    // lignes de la meme table ne se justifient pas.
    supabase
      .from('app_settings')
      .select('key,value')
      .in('key', ['booking_rules', 'registration_fee'])
      .then(({ data, error }) => {
        if (error || !data) return
        for (const ligne of data) {
          const v = ligne.value as Record<string, unknown>
          if (ligne.key === 'booking_rules') {
            if (typeof v.cancellation_free_hours === 'number') setDelai(v.cancellation_free_hours)
            if (typeof v.pt_cancellation_free_hours === 'number') setDelaiPt(v.pt_cancellation_free_hours)
          }
          if (ligne.key === 'registration_fee' && typeof v.amount_cents === 'number') {
            const euros = v.amount_cents / 100
            setFrais(Number.isInteger(euros) ? `${euros} €` : `${euros.toFixed(2).replace('.', ',')} €`)
          }
        }
      })
  }, [])

  return (
    <section className="v-section" id="faq">
      <div className="v-largeur">
        <h2 className="v-titre-section">Questions fréquentes</h2>
        <p className="v-chapeau">
          Une question qui n'est pas ici ? <Link to="/contact">Écrivez-nous</Link>.
        </p>

        <div className="v-faq">
          {QUESTIONS.map(({ q, r }) => (
            <details className="v-faq__item" key={q}>
              <summary className="v-faq__question">{q}</summary>
              <div className="v-faq__reponse">
                {r
                  .replace('{delai}', String(delai))
                  .replace('{delaiPt}', String(delaiPt))
                  .replace('{frais}', frais)}
              </div>
            </details>
          ))}
        </div>

        <div className="v-boutons" style={{ marginTop: '2.5rem' }}>
          <a className="v-bouton v-bouton--plein" href={`${URL_APP}/auth`}>
            Réserver ma séance d'essai
          </a>
        </div>
      </div>
    </section>
  )
}

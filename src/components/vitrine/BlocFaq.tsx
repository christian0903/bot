import { useEffect, useState } from 'react'
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

// `{delai}` et `{delaiPt}` sont remplaces par les valeurs lues en base. Les
// ecrire en dur est exactement ce qui a fait diverger l'ancien site, qui
// annoncait 12 h sur une page et 24 h sur une autre.
const QUESTIONS: { q: string; r: string }[] = [
  {
    q: 'Comment réserver ma séance d’essai gratuite ?',
    r: "La première séance est offerte. Créez votre compte dans l'application Back on Track, choisissez un cours au planning et réservez : la séance d'essai est créditée automatiquement. En cas de difficulté, contactez-nous et nous vous aiderons.",
  },
  {
    q: 'Est-ce adapté à tous les niveaux ?',
    r: "Oui. Que vous soyez débutant, confirmé ou en reprise sportive, nos coachs adaptent chaque séance à votre profil et à vos objectifs. Pas besoin d'être en grande forme pour commencer : on s'adapte à vous.",
  },
  {
    q: 'Pourquoi des cours semi-privés ?',
    r: "Un cours semi-privé, c'est une séance en petit groupe — cinq participants au maximum — où chacun bénéficie d'un coaching personnalisé. Cela nous permet d'adapter les exercices à votre niveau et à vos besoins, tout en profitant de la dynamique du groupe.",
  },
  {
    q: 'Quelles sont vos heures de cours ?',
    r: "Nos cours ont lieu principalement en matinée et en soirée, du lundi au dimanche. Le planning complet et à jour est consultable sur cette page, à la rubrique Horaires.",
  },
  {
    q: 'Puis-je réserver du personal training en dehors des cours ?',
    r: "Oui. Dans l'application, une section Personal Training vous permet de réserver librement les créneaux disponibles. Vous pouvez aussi tester une séance à 20 € avant de vous engager sur un suivi.",
  },
  {
    q: 'Quelle est votre politique d’annulation ?',
    r: "Un cours collectif s'annule sans frais jusqu'à {delai} heures avant son début, et une séance de personal training jusqu'à {delaiPt} heures. Toute annulation justifiée médicalement est également sans frais. Vous pouvez ensuite reprogrammer votre séance selon les disponibilités.",
  },
  {
    q: 'Que se passe-t-il si un cours est complet ?',
    r: "Vous pouvez vous inscrire sur la liste d'attente. Dès qu'une place se libère, vous êtes prévenu automatiquement : la première personne qui confirme obtient la place.",
  },
  {
    q: 'Puis-je changer de cours d’une semaine à l’autre ?',
    r: "Totalement. Vous pouvez tester différents cours selon vos envies et votre emploi du temps. L'objectif est que vous bougiez avec plaisir et régularité.",
  },
  {
    q: 'Dois-je apporter du matériel ?',
    r: "Tout est fourni sur place. Vous pouvez néanmoins apporter votre propre tapis pour des raisons d'hygiène si vous le souhaitez. Prévoyez une serviette, une gourde et des chaussures propres.",
  },
  {
    q: 'Les packs sont-ils remboursables ?',
    r: "Non, mais en cas d'empêchement long — une blessure, par exemple — contactez-nous : on trouvera une solution.",
  },
  {
    q: 'Y a-t-il des frais d’inscription ?',
    r: "Oui, une seule fois : {frais}, à régler directement dans l'application.",
  },
  {
    q: 'Envie de faire bouger vos collaborateurs ?',
    r: "Notre équipe se déplace dans vos bureaux, avec le matériel si nécessaire. Contactez-nous pour un devis sur mesure.",
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
          Une question qui n'est pas ici ? <a href="/contact">Écrivez-nous</a>.
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

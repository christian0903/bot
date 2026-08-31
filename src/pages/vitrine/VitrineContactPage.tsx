import { useState } from 'react'
import { MapPin, Phone, Mail, Send, Check } from 'lucide-react'

const URL_APP = import.meta.env.VITE_URL_APPLICATION || 'https://app.backontrackstudio.be'

type Etat = 'saisie' | 'envoi' | 'envoye' | 'erreur'

export function VitrineContactPage() {
  const [etat, setEtat] = useState<Etat>('saisie')
  const [erreur, setErreur] = useState<string | null>(null)

  const envoyer = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setEtat('envoi')
    setErreur(null)

    const donnees = new FormData(e.currentTarget)

    // `supabase.functions.invoke` a été écarté : sur un statut d'erreur, il
    // remplit `error` mais JETTE le corps de la réponse. Le visiteur voyait
    // donc « L'envoi a échoué » là où la fonction disait « Trop de messages
    // envoyés, réessayez dans un moment » — un message qui, lui, indique quoi
    // faire. `fetch` nous laisse lire la réponse quel que soit le statut.
    const base = import.meta.env.VITE_SUPABASE_URL
    const cle = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

    let reponse: Response
    try {
      reponse = await fetch(`${base}/functions/v1/contact`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apikey: cle },
        body: JSON.stringify({
          nom: donnees.get('nom'),
          email: donnees.get('email'),
          telephone: donnees.get('telephone'),
          message: donnees.get('message'),
          // Le champ-piège, invisible à l'écran : un robot le remplit, un
          // humain ne le voit jamais.
          site: donnees.get('site'),
        }),
      })
    } catch {
      setErreur("Connexion impossible. Vérifiez votre réseau, ou écrivez-nous directement à l'adresse ci-contre.")
      setEtat('erreur')
      return
    }

    const resultat = await reponse.json().catch(() => null)

    if (!reponse.ok || resultat?.error) {
      setErreur(
        resultat?.error ??
          "L'envoi a échoué. Réessayez, ou écrivez-nous directement à l'adresse ci-contre."
      )
      setEtat('erreur')
      return
    }
    setEtat('envoye')
  }

  return (
    <section className="v-section" id="contact-direct">
      <div className="v-largeur">
        <h1 className="v-titre-section">Nous contacter</h1>
        <p className="v-chapeau">
          Une question, une demande de devis, ou l'envie d'essayer ? Écrivez-nous,
          on vous répond.
        </p>

        <div className="v-contact">
          {/* ---- Les coordonnées, toujours visibles --------------------- */}
          <div className="v-contact__infos">
            <h2 className="v-contact__titre">Le studio</h2>

            <a className="v-contact__ligne" href="https://maps.google.com/?q=Avenue+de+Merode+64,+1330+Rixensart" target="_blank" rel="noreferrer">
              <MapPin size={20} aria-hidden="true" />
              <span>
                Avenue de Mérode 64<br />
                1330 Rixensart
              </span>
            </a>

            <a className="v-contact__ligne" href="tel:+32470296169">
              <Phone size={20} aria-hidden="true" />
              <span>+32 470 29 61 69</span>
            </a>

            <a className="v-contact__ligne" href="mailto:info@backontrackstudio.be">
              <Mail size={20} aria-hidden="true" />
              <span>info@backontrackstudio.be</span>
            </a>

            <div className="v-contact__essai">
              <p>
                <strong>La première séance est offerte.</strong> Pour la réserver,
                pas besoin de nous écrire : créez votre compte et choisissez un
                cours au planning.
              </p>
              <a className="v-bouton v-bouton--plein" href={`${URL_APP}/auth`}>
                Réserver ma séance d'essai
              </a>
            </div>
          </div>

          {/* ---- Le formulaire ------------------------------------------ */}
          <div className="v-contact__formulaire">
            {etat === 'envoye' ? (
              <div className="v-contact__succes">
                <span className="v-argument__puce" aria-hidden="true">
                  <Check size={16} strokeWidth={3} />
                </span>
                <h2 className="v-carte__titre">Message envoyé</h2>
                <p className="v-carte__texte">
                  Merci — nous vous répondons dès que possible, à l'adresse que
                  vous avez indiquée.
                </p>
              </div>
            ) : (
              <form onSubmit={envoyer} noValidate>
                <h2 className="v-contact__titre">Votre message</h2>

                <label className="v-champ">
                  <span>Nom <em>*</em></span>
                  <input name="nom" type="text" required maxLength={120} autoComplete="name" />
                </label>

                <label className="v-champ">
                  <span>E-mail <em>*</em></span>
                  <input name="email" type="email" required maxLength={200} autoComplete="email" />
                </label>

                <label className="v-champ">
                  <span>Téléphone</span>
                  <input name="telephone" type="tel" maxLength={40} autoComplete="tel" />
                </label>

                <label className="v-champ">
                  <span>Message <em>*</em></span>
                  <textarea name="message" required rows={6} maxLength={5000} />
                </label>

                {/* Le champ-piege. `aria-hidden` et `tabIndex={-1}` le retirent
                    aussi des lecteurs d'ecran et du parcours au clavier : il ne
                    doit exister que pour les robots. */}
                <div className="v-piege" aria-hidden="true">
                  <label>
                    Ne remplissez pas ce champ
                    <input name="site" type="text" tabIndex={-1} autoComplete="off" />
                  </label>
                </div>

                {erreur && <p className="v-contact__erreur">{erreur}</p>}

                <button
                  type="submit"
                  className="v-bouton v-bouton--plein"
                  disabled={etat === 'envoi'}
                >
                  {etat === 'envoi' ? 'Envoi…' : (
                    <>
                      Envoyer le message
                      <Send size={16} aria-hidden="true" />
                    </>
                  )}
                </button>

                <p className="v-contact__mention">
                  Vos coordonnées servent uniquement à vous répondre. Elles ne
                  sont ni revendues ni utilisées à d'autres fins.
                </p>
              </form>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}

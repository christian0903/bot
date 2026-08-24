import { Browser } from '@capacitor/browser'
import { Capacitor } from '@capacitor/core'

/**
 * Envoie le membre vers une page de paiement Stripe.
 *
 * Sur le web, `Browser.open` du plugin Capacitor se réduit à
 * `window.open(url, '_blank')` — une ouverture d'onglet. Deux choses la font
 * échouer ici :
 *
 * - **Le popup est bloqué.** L'ouverture suit un `fetch` vers
 *   `create-checkout-session` ; le navigateur ne la rattache plus au clic et
 *   l'écarte comme une fenêtre intempestive. Le membre restait sur la page des
 *   packs sans comprendre pourquoi rien ne se passait.
 * - **En PWA installée, `_blank` sort de l'application** — ou n'aboutit pas du
 *   tout sur iOS.
 *
 * On redirige donc la page courante. Stripe ramène ensuite le membre par
 * `success_url` ou `cancel_url`, qui pointent déjà vers l'application : le
 * retour est prévu, il ne dépend pas d'un onglet resté ouvert.
 *
 * Dans l'application native, `Browser.open` reste le bon appel : il ouvre une
 * vue intégrée dont l'utilisateur revient sans quitter l'app.
 */
export async function ouvrirPaiement(url: string): Promise<void> {
  if (Capacitor.isNativePlatform()) {
    await Browser.open({ url, presentationStyle: 'popover' })
    return
  }
  window.location.href = url
}

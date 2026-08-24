import { useCallback, useEffect, useState } from 'react'
import { Capacitor } from '@capacitor/core'

/**
 * Toutes les heures. Un membre qui garde l'application ouverte toute la journée
 * — le cas le plus fréquent sur ordinateur — ne déclenche aucune navigation :
 * sans cette vérification périodique, le navigateur ne regarderait `sw.js`
 * qu'à la prochaine ouverture, c'est-à-dire peut-être le lendemain.
 */
const INTERVALLE_VERIFICATION = 60 * 60 * 1000

/**
 * Une nouvelle version est-elle prête à prendre la main ?
 *
 * Le service worker qui vient d'être installé reste **en attente** : il ne
 * s'active que sur ordre (message `ACTIVER_MAINTENANT`). C'est ce qui permet de
 * demander son avis au membre au lieu de recharger sous ses pieds.
 *
 * Rien de tout cela dans l'application native : son code est embarqué dans le
 * binaire, et se met à jour par le store.
 */
export function useMiseAJourPWA() {
  const [disponible, setDisponible] = useState(false)

  useEffect(() => {
    if (Capacitor.isNativePlatform()) return
    if (!('serviceWorker' in navigator)) return

    let annule = false
    let minuterie: ReturnType<typeof setInterval> | undefined

    /** Un worker installé et en attente signifie : nouvelle version prête. */
    const surveiller = (registration: ServiceWorkerRegistration) => {
      // Déjà en attente à l'arrivée sur la page : le cas d'un membre qui a
      // rouvert son onglet après un déploiement. Sans ce test, la bannière
      // n'apparaîtrait qu'au déploiement *suivant*.
      if (registration.waiting) {
        setDisponible(true)
        return
      }

      registration.addEventListener('updatefound', () => {
        const nouveau = registration.installing
        if (!nouveau) return
        nouveau.addEventListener('statechange', () => {
          // `controller` absent = première visite du site : le worker s'installe
          // pour la première fois, ce n'est pas une mise à jour et annoncer une
          // « nouvelle version » à quelqu'un qui vient d'arriver n'a aucun sens.
          if (nouveau.state === 'installed' && navigator.serviceWorker.controller) {
            if (!annule) setDisponible(true)
          }
        })
      })
    }

    navigator.serviceWorker.ready.then((registration) => {
      if (annule) return
      surveiller(registration)
      minuterie = setInterval(() => registration.update().catch(() => {}), INTERVALLE_VERIFICATION)
    }).catch(() => {})

    // Le navigateur a basculé sur le nouveau worker : le code servi n'est plus
    // celui qui tourne. On recharge pour que les deux correspondent.
    let dejaRecharge = false
    const surBascule = () => {
      if (dejaRecharge) return
      dejaRecharge = true
      window.location.reload()
    }
    navigator.serviceWorker.addEventListener('controllerchange', surBascule)

    return () => {
      annule = true
      if (minuterie) clearInterval(minuterie)
      navigator.serviceWorker.removeEventListener('controllerchange', surBascule)
    }
  }, [])

  /**
   * Bascule sur la nouvelle version. Le rechargement n'est pas déclenché ici :
   * il vient de `controllerchange`, une fois la bascule réellement faite. Le
   * provoquer tout de suite rechargerait l'ancienne version, le nouveau worker
   * n'ayant pas encore pris la main.
   */
  const recharger = useCallback(async () => {
    const registration = await navigator.serviceWorker.getRegistration()

    if (registration?.waiting) {
      registration.waiting.postMessage('ACTIVER_MAINTENANT')
      // Filet : si `controllerchange` ne vient pas — iOS l'a déjà manqué après
      // une bascule d'application — on recharge quand même plutôt que de
      // laisser le membre devant un bouton qui n'a rien fait.
      setTimeout(() => window.location.reload(), 2000)
      return
    }

    // Pas de worker en attente, alors qu'une nouvelle version est annoncée.
    // Recharger ne servirait à rien : un rechargement **ne remplace jamais**
    // un worker actif, la page revient à l'identique et la bannière
    // réapparaît — la boucle dans laquelle une installation pouvait rester
    // bloquée plusieurs versions durant.
    //
    // On force donc une vérification, puis on active ce qui en sort.
    if (registration) {
      try {
        await registration.update()
        if (registration.waiting) {
          registration.waiting.postMessage('ACTIVER_MAINTENANT')
          setTimeout(() => window.location.reload(), 2000)
          return
        }
        // Toujours rien : le worker installé est hors d'état de se renouveler
        // (installation échouée, worker devenu obsolète). Le désinscrire et
        // vider les caches rend la main au réseau — c'est le seul geste qui
        // débloque, et il ne coûte qu'un chargement complet.
        await registration.unregister()
        const cles = await caches.keys()
        await Promise.all(cles.map(k => caches.delete(k)))
      } catch {
        // Rien à rattraper : le rechargement ci-dessous reste la sortie.
      }
    }

    window.location.reload()
  }, [])

  return { disponible, recharger }
}

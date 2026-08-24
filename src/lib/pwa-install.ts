import { useEffect, useState } from 'react'
import { Capacitor } from '@capacitor/core'

/**
 * Événement Chrome/Edge qui annonce que le site est installable. Il n'existe
 * pas dans la lib DOM standard : Safari ne l'implémente pas et ne l'implémentera
 * pas.
 */
interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[]
  prompt: () => Promise<void>
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

/**
 * Comment ce visiteur peut installer l'application.
 *
 * `prompt`      — Chrome/Edge/Android : le navigateur sait le faire tout seul,
 *                 il suffit de lui redonner la main sur l'événement capté.
 * `ios-manuel`  — Safari iOS/iPadOS : aucune API d'installation n'existe, le
 *                 geste est « Partager » puis « Sur l'écran d'accueil ». Le
 *                 seul recours est de l'expliquer.
 * `installee`   — déjà lancée depuis l'écran d'accueil, ou dans l'app native.
 * `impossible`  — navigateur de bureau sans installation, ou Firefox iOS : ne
 *                 rien promettre plutôt que d'afficher un bouton qui ment.
 */
export type ModeInstallation = 'prompt' | 'ios-manuel' | 'installee' | 'impossible'

/** L'application tourne-t-elle déjà en plein écran, hors navigateur ? */
function estDejaInstallee(): boolean {
  // `standalone` est la propriété historique de Safari iOS, absente des types.
  const safariStandalone = (window.navigator as { standalone?: boolean }).standalone
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    window.matchMedia('(display-mode: fullscreen)').matches ||
    safariStandalone === true
  )
}

/**
 * iPhone et iPad. Depuis iPadOS 13, un iPad se déclare « Macintosh » : le seul
 * marqueur qui reste est l'écran tactile.
 */
function estIOS(): boolean {
  const ua = window.navigator.userAgent
  return (
    /iPad|iPhone|iPod/.test(ua) ||
    (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)
  )
}

/**
 * Sur iOS, seul Safari sait installer sur l'écran d'accueil. Chrome, Firefox et
 * Edge y sont des habillages de WebKit et n'exposent pas « Sur l'écran
 * d'accueil » : proposer le geste à leur utilisateur l'enverrait chercher un
 * bouton inexistant.
 */
function estSafariIOS(): boolean {
  const ua = window.navigator.userAgent
  return estIOS() && !/CriOS|FxiOS|EdgiOS|OPiOS/.test(ua)
}

/**
 * État d'installation de la PWA.
 *
 * Il n'existe aucune façon unifiée d'installer une application web : Chrome
 * offre une API, Safari n'offre qu'un geste manuel, et les deux se détectent
 * différemment. Ce hook ramène les trois cas à une seule réponse, pour que
 * l'interface n'ait pas à connaître les navigateurs.
 *
 * Dans l'application native (Capacitor), il répond toujours `installee` : y
 * proposer une installation n'aurait aucun sens, et Apple rejette une app qui
 * pousse vers un autre canal de distribution.
 */
/**
 * Ce que l'on sait sans attendre : plateforme native, application déjà lancée
 * depuis l'écran d'accueil, ou Safari iOS. Ces trois cas se lisent au premier
 * rendu — seul `prompt` dépend d'un événement à venir.
 */
function modeInitial(): ModeInstallation {
  if (Capacitor.isNativePlatform()) return 'installee'
  if (estDejaInstallee()) return 'installee'
  if (estSafariIOS()) return 'ios-manuel'
  return 'impossible'
}

export function useInstallationPWA() {
  const [mode, setMode] = useState<ModeInstallation>(modeInitial)
  const [evenement, setEvenement] = useState<BeforeInstallPromptEvent | null>(null)

  useEffect(() => {
    // Rien à écouter dans les cas déjà tranchés : sur une plateforme native,
    // `beforeinstallprompt` n'existe pas, et une application installée n'a plus
    // rien à installer.
    if (mode === 'installee' || mode === 'ios-manuel') return

    const capter = (e: Event) => {
      // Sans ce preventDefault, Chrome affiche sa propre barre d'installation et
      // l'événement n'est plus rejouable ensuite : le bouton maison serait mort.
      e.preventDefault()
      setEvenement(e as BeforeInstallPromptEvent)
      setMode('prompt')
    }

    const installee = () => {
      setMode('installee')
      setEvenement(null)
    }

    window.addEventListener('beforeinstallprompt', capter)
    window.addEventListener('appinstalled', installee)
    return () => {
      window.removeEventListener('beforeinstallprompt', capter)
      window.removeEventListener('appinstalled', installee)
    }
  }, [mode])

  /**
   * Déclenche l'invite native. Renvoie `true` si le visiteur a accepté.
   *
   * L'événement n'est utilisable qu'une fois : on le jette après usage, sinon
   * un second clic appellerait `prompt()` sur un événement consommé — ce qui
   * lève une exception.
   */
  const installer = async (): Promise<boolean> => {
    if (!evenement) return false
    await evenement.prompt()
    const { outcome } = await evenement.userChoice
    setEvenement(null)
    if (outcome === 'accepted') setMode('installee')
    return outcome === 'accepted'
  }

  return { mode, installer }
}

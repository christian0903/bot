import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Download, Share, Plus, X } from 'lucide-react'
import { useInstallationPWA } from '@/lib/pwa-install'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

/**
 * Refus mémorisé. Une bannière qui revient à chaque page finit par être perçue
 * comme une publicité — et fait fuir le membre au lieu de l'installer.
 */
const CLE_REFUS = 'bot:install-refuse'

/** Reproposer un mois plus tard : le refus d'un jour n'est pas un refus définitif. */
const DELAI_AVANT_RELANCE = 30 * 24 * 60 * 60 * 1000

function refusEncoreValable(): boolean {
  try {
    const brut = localStorage.getItem(CLE_REFUS)
    if (!brut) return false
    return Date.now() - Number(brut) < DELAI_AVANT_RELANCE
  } catch {
    // Navigation privée : le stockage lève. Mieux vaut une bannière de trop
    // qu'une erreur qui casse la page.
    return false
  }
}

function memoriserLeRefus() {
  try {
    localStorage.setItem(CLE_REFUS, String(Date.now()))
  } catch {
    // Sans stockage, la bannière reviendra — comportement acceptable.
  }
}

/**
 * Invitation à installer l'application sur l'écran d'accueil.
 *
 * Deux chemins, parce que les navigateurs n'offrent pas la même chose : sur
 * Chrome et Android un bouton suffit, sur iPhone il n'existe aucune API et le
 * seul recours est de montrer le geste. Sans cette explication, un utilisateur
 * iPhone ne découvre jamais qu'il peut installer — rien dans Safari ne le lui
 * dit.
 *
 * La bannière ne s'affiche ni dans l'application native, ni une fois installée :
 * `useInstallationPWA` répond alors `installee`.
 */
export function InstallPrompt() {
  const { t } = useTranslation()
  const { mode, installer } = useInstallationPWA()
  // Lu à l'initialisation plutôt que dans un effet : le refus est connu dès le
  // premier rendu, et le lire après aurait fait apparaître la bannière une
  // fraction de seconde avant de la retirer.
  const [masquee, setMasquee] = useState(refusEncoreValable)
  const [aideIOS, setAideIOS] = useState(false)

  if (masquee || mode === 'installee' || mode === 'impossible') return null

  const refuser = () => {
    memoriserLeRefus()
    setMasquee(true)
  }

  const cliquer = async () => {
    if (mode === 'ios-manuel') {
      setAideIOS(true)
      return
    }
    const accepte = await installer()
    if (accepte) toast.success(t('install.success'))
  }

  return (
    <>
      <div className="mb-4 flex items-center gap-3 rounded-lg border bg-muted/40 p-3">
        <Download className="h-5 w-5 shrink-0 text-primary" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">{t('install.banner')}</p>
          <p className="text-xs text-muted-foreground">{t('install.bannerHint')}</p>
        </div>
        <Button size="sm" onClick={cliquer}>
          {t('install.button')}
        </Button>
        <Button
          size="icon"
          variant="ghost"
          onClick={refuser}
          aria-label={t('install.later')}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Le geste iOS se montre plutôt qu'il ne se décrit : les icônes reprises
          ici sont celles que le membre a sous les yeux dans Safari. */}
      <Dialog open={aideIOS} onOpenChange={setAideIOS}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t('install.iosTitle')}</DialogTitle>
            <DialogDescription>{t('install.iosIntro')}</DialogDescription>
          </DialogHeader>

          <ol className="space-y-3 text-sm">
            <li className="flex items-start gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
                1
              </span>
              <span className="flex flex-wrap items-center gap-1.5">
                {t('install.iosStep1')}
                <Share className="h-4 w-4 shrink-0 text-primary" />
              </span>
            </li>
            <li className="flex items-start gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
                2
              </span>
              <span className="flex flex-wrap items-center gap-1.5">
                {t('install.iosStep2')}
                <Plus className="h-4 w-4 shrink-0 text-primary" />
              </span>
            </li>
            <li className="flex items-start gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
                3
              </span>
              <span>{t('install.iosStep3')}</span>
            </li>
          </ol>

          <p className="text-xs text-muted-foreground">{t('install.iosNote')}</p>

          <Button
            onClick={() => {
              // Le membre dit avoir installé : on ne le relance plus.
              memoriserLeRefus()
              setAideIOS(false)
              setMasquee(true)
            }}
          >
            {t('install.done')}
          </Button>
        </DialogContent>
      </Dialog>
    </>
  )
}

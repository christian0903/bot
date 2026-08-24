import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { RefreshCw } from 'lucide-react'
import { useMiseAJourPWA } from '@/lib/pwa-update'
import { Button } from '@/components/ui/button'

/**
 * Annonce qu'une nouvelle version est prête, et laisse le membre choisir quand
 * basculer.
 *
 * Elle vaut autant sur ordinateur que sur téléphone — davantage, même : c'est
 * au navigateur qu'on laisse un onglet ouvert des heures, alors qu'iOS décharge
 * régulièrement une application installée, ce qui la met à jour d'elle-même.
 * Elle ne s'affiche pas dans l'application native, dont le code est embarqué et
 * se met à jour par le store.
 *
 * Aucun bouton pour la fermer : elle n'apparaît qu'en présence d'une version
 * réellement en attente, et la faire disparaître laisserait le membre sur du
 * code périmé en croyant l'inverse. Elle disparaît en rechargeant — ce que le
 * bouton fait.
 */
export function UpdatePrompt() {
  const { t } = useTranslation()
  const { disponible, recharger } = useMiseAJourPWA()
  const [enCours, setEnCours] = useState(false)

  if (!disponible) return null

  const cliquer = () => {
    // Le rechargement vient de `controllerchange`, pas d'ici : l'attente peut
    // durer une seconde, et sans retour visuel le membre reclique.
    setEnCours(true)
    void recharger()
  }

  return (
    <div
      // Au-dessus de la navigation mobile (h-16, z-50) pour ne pas la masquer,
      // et sous l'encoche des iPhone récents.
      className="fixed inset-x-0 bottom-16 z-50 px-4 pb-2 md:bottom-0 md:pb-4"
      style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 0.5rem)' }}
      role="status"
    >
      <div className="mx-auto flex max-w-md items-center gap-3 rounded-lg border bg-background/95 p-3 shadow-lg backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <RefreshCw className="h-5 w-5 shrink-0 text-primary" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">{t('install.newVersion')}</p>
          <p className="text-xs text-muted-foreground">{t('install.newVersionHint')}</p>
        </div>
        <Button size="sm" onClick={cliquer} disabled={enCours}>
          {enCours ? t('common.loading') : t('install.reload')}
        </Button>
      </div>
    </div>
  )
}

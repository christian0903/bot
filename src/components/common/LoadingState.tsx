import { useTranslation } from 'react-i18next'
import { Loader2 } from 'lucide-react'

export function LoadingState() {
  const { t } = useTranslation()

  return (
    // Centré verticalement plutôt que collé en haut : sur un grand écran,
    // py-16 laissait une vaste zone vide en dessous, et la page paraissait
    // blanche le temps du chargement.
    <div className="flex items-center justify-center min-h-[50vh] py-16">
      <Loader2 className="h-6 w-6 animate-spin text-primary mr-2" />
      <p className="text-muted-foreground">{t('common.loading')}</p>
    </div>
  )
}

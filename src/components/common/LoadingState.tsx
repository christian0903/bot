import { useTranslation } from 'react-i18next'
import { Loader2 } from 'lucide-react'

export function LoadingState() {
  const { t } = useTranslation()

  return (
    <div className="flex items-center justify-center py-16">
      <Loader2 className="h-6 w-6 animate-spin text-primary mr-2" />
      <p className="text-muted-foreground">{t('common.loading')}</p>
    </div>
  )
}

import { useTranslation } from 'react-i18next'
import { CalendarPlus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { telechargerICS, type CoursPourAgenda } from '@/lib/agenda-ics'

/**
 * « Ajouter à mon agenda » — produit un .ics que le téléphone ouvre dans
 * l'agenda du membre.
 *
 * Le composant existe parce que le bouton apparaît à trois endroits : la
 * confirmation de réservation, la fiche d'un cours et « Mes réservations ».
 */
export function BoutonAgenda({
  cours,
  variant = 'outline',
  size = 'sm',
  className,
}: {
  cours: CoursPourAgenda
  variant?: 'default' | 'outline' | 'ghost'
  size?: 'default' | 'sm' | 'lg'
  className?: string
}) {
  const { i18n } = useTranslation()
  const isFr = i18n.language === 'fr'

  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      className={className}
      onClick={() => telechargerICS(cours, isFr)}
    >
      <CalendarPlus className="h-4 w-4 mr-2" />
      {isFr ? 'Ajouter à mon agenda' : 'Add to my calendar'}
    </Button>
  )
}

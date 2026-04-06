import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'

export function LanguageSwitcher() {
  const { i18n } = useTranslation()

  const toggleLanguage = () => {
    const newLang = i18n.language === 'fr' ? 'en' : 'fr'
    i18n.changeLanguage(newLang)
  }

  return (
    <Button variant="ghost" size="sm" onClick={toggleLanguage} className="font-medium">
      {i18n.language === 'fr' ? 'EN' : 'FR'}
    </Button>
  )
}

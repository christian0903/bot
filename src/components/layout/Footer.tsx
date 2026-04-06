import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { Heart } from 'lucide-react'

const APP_VERSION = '1.0.0'

export function Footer() {
  const { t } = useTranslation()

  return (
    <footer className="border-t bg-background">
      <div className="container flex flex-col sm:flex-row items-center justify-between gap-2 py-4 px-4 mx-auto max-w-7xl text-sm text-muted-foreground">
        <p>
          &copy; {new Date().getFullYear()} {t('app.name')}. {t('footer.rights')}
        </p>
        <div className="flex items-center gap-4">
          <Link to="/help" className="hover:text-foreground transition-colors">
            {t('nav.help')}
          </Link>
          <span>{t('footer.version', { version: APP_VERSION })}</span>
          <Link to="/packs" className="flex items-center gap-1 hover:text-foreground transition-colors">
            <Heart className="h-3 w-3" />
            {t('footer.support')}
          </Link>
        </div>
      </div>
    </footer>
  )
}

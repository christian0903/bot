import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { estHorsProduction } from '@/lib/base-en-service'

/** Injectée au build depuis package.json (cf. vite.config.ts). */
declare const __APP_VERSION__: string

export function Footer() {
  const { t } = useTranslation()

  return (
    <footer className="border-t bg-background">
      <div className="container flex flex-col sm:flex-row items-center justify-between gap-2 py-4 px-4 mx-auto max-w-7xl text-sm text-muted-foreground">
        <p>
          &copy; {new Date().getFullYear()} {t('footer.copyright')}. {t('footer.rights')}
        </p>
        <div className="flex items-center gap-4 flex-wrap justify-center">
          {/* Document contractuel : il doit rester atteignable en permanence,
              pas seulement au moment de cocher la case à l'inscription. */}
          <Link to="/cgv" className="hover:text-foreground transition-colors">
            {t('footer.terms')}
          </Link>
          <Link to="/confidentialite" className="hover:text-foreground transition-colors">
            {t('footer.privacy')}
          </Link>
          <Link to="/help" className="hover:text-foreground transition-colors">
            {t('nav.help')}
          </Link>
          {/* Ici les DEUX cas sont nommes, `-ops` compris : on vient lire le
              pied de page quand on doute de ce qu'on regarde, et un silence
              n'aurait alors rien repondu. L'en-tete, lui, ne signale que le
              developpement — il est sous les yeux en permanence. */}
          <span>
            {t('footer.version', { version: __APP_VERSION__ })}
            <span className={estHorsProduction ? 'text-amber-600 dark:text-amber-500' : undefined}>
              {estHorsProduction ? '-dev' : '-ops'}
            </span>
          </span>
        </div>
      </div>
    </footer>
  )
}

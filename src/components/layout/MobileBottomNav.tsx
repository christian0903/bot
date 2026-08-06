import { NavLink } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '@/contexts/AuthContext'
import { Home, CalendarDays, CreditCard, ClipboardList } from 'lucide-react'
import { cn } from '@/lib/utils'

export function MobileBottomNav() {
  const { t, i18n } = useTranslation()
  const isFr = i18n.language === 'fr'
  const { user } = useAuth()

  if (!user) return null

  // Quatre entrées : au-delà, les libellés se coupent sur un petit écran.
  // « Mes réservations » remplace les stats — le planning signale les cours
  // réservés mais ne les regroupe pas, et « quand est-ce que je m'entraîne
  // cette semaine ? » est la question la plus fréquente. Les statistiques
  // restent accessibles depuis le menu du haut.
  const items = [
    { path: '/', icon: Home, label: t('nav.home') },
    { path: '/schedule', icon: CalendarDays, label: t('nav.schedule') },
    { path: '/my-bookings', icon: ClipboardList, label: isFr ? 'Mes cours' : 'My classes' },
    { path: '/my-packs', icon: CreditCard, label: t('packs.myPacks') },
  ]

  return (
    <nav
      className="md:hidden fixed bottom-0 left-0 right-0 z-50 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="flex items-center justify-around h-16">
        {items.map(({ path, icon: Icon, label }) => (
          <NavLink
            key={path}
            to={path}
            end={path === '/'}
            className={({ isActive }) =>
              cn(
                'flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-lg transition-colors text-[11px] font-medium',
                isActive
                  ? 'text-primary'
                  : 'text-muted-foreground'
              )
            }
          >
            <Icon className="h-5 w-5" />
            <span>{label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  )
}

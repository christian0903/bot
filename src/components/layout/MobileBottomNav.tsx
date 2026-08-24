import { NavLink } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '@/contexts/AuthContext'
import {
  Home, CalendarDays, CreditCard, ClipboardList,
  LayoutDashboard, Users, Dumbbell, Settings,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useMode } from '@/contexts/ModeContext'

/**
 * Barre de navigation mobile, adaptée au **mode choisi**.
 *
 * Quatre entrées au maximum : au-delà, les libellés se coupent sur un petit
 * écran. Chaque mode montre les quatre écrans qu'on y ouvre le plus souvent, le
 * reste passant par le menu du haut.
 *
 * Elle suivait le rôle, et supposait que « le staff ne s'entraîne pas au
 * studio » : un gérant sur téléphone n'avait alors aucun moyen d'atteindre ses
 * réservations ou ses packs, la barre du bas étant sa seule navigation. Il lui
 * suffit désormais de passer en mode Membre.
 */
export function MobileBottomNav() {
  const { t, i18n } = useTranslation()
  const isFr = i18n.language === 'fr'
  const { user } = useAuth()
  const { mode } = useMode()

  if (!user) return null

  // Admin : piloter le studio. Le tableau de bord, les membres, le planning
  // d'ensemble, et les réglages qu'on ajuste souvent en début de cycle.
  const adminItems = [
    { path: '/admin/dashboard', icon: LayoutDashboard, label: isFr ? 'Tableau' : 'Dashboard' },
    { path: '/admin/users', icon: Users, label: isFr ? 'Membres' : 'Members' },
    { path: '/admin/schedule', icon: CalendarDays, label: isFr ? 'Planning' : 'Schedule' },
    { path: '/admin/settings', icon: Settings, label: isFr ? 'Réglages' : 'Settings' },
  ]

  // Mode coach : ses cours et le planning. Les écrans d'administration ne s'y
  // trouvent pas, même pour un admin — c'est le sens du mode.
  const coachItems = [
    { path: '/dashboard', icon: Home, label: t('nav.home') },
    { path: '/coach/my-classes', icon: Dumbbell, label: isFr ? 'Mes cours' : 'My classes' },
    { path: '/schedule', icon: CalendarDays, label: t('nav.schedule') },
    { path: '/performance-types', icon: ClipboardList, label: isFr ? 'Perfs' : 'Perfs' },
  ]

  // Membre : « Mes cours » plutôt que les stats — le planning signale les cours
  // réservés mais ne les regroupe pas, et savoir quand on s'entraîne est la
  // question la plus fréquente.
  const memberItems = [
    // `/dashboard` et non `/` : la racine renvoie un membre du staff vers son
    // espace d'administration, ce qui annulerait le mode choisi.
    { path: '/dashboard', icon: Home, label: t('nav.home') },
    { path: '/schedule', icon: CalendarDays, label: t('nav.schedule') },
    { path: '/my-bookings', icon: ClipboardList, label: isFr ? 'Mes cours' : 'My classes' },
    { path: '/my-packs', icon: CreditCard, label: t('packs.myPacks') },
  ]

  const items = mode === 'admin' ? adminItems : mode === 'coach' ? coachItems : memberItems

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

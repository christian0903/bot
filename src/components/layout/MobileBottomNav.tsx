import { NavLink } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '@/contexts/AuthContext'
import {
  Home, CalendarDays, CreditCard, ClipboardList,
  LayoutDashboard, Users, Dumbbell, Settings,
} from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Barre de navigation mobile, adaptée au rôle.
 *
 * Quatre entrées au maximum : au-delà, les libellés se coupent sur un petit
 * écran. Chaque rôle voit les quatre écrans qu'il ouvre le plus souvent, le
 * reste passant par le menu du haut.
 *
 * Un admin ou un coach reste membre du studio : le planning figure dans toutes
 * les barres, et l'espace membre reste joignable par le menu.
 */
export function MobileBottomNav() {
  const { t, i18n } = useTranslation()
  const isFr = i18n.language === 'fr'
  const { user, hasRole } = useAuth()

  if (!user) return null

  const isAdmin = hasRole('admin') || hasRole('super_admin')
  const isCoach = hasRole('coach')

  // Admin : piloter le studio. Le tableau de bord, les membres, le planning
  // d'ensemble, et les réglages qu'on ajuste souvent en début de cycle.
  const adminItems = [
    { path: '/admin/dashboard', icon: LayoutDashboard, label: isFr ? 'Tableau' : 'Dashboard' },
    { path: '/admin/users', icon: Users, label: isFr ? 'Membres' : 'Members' },
    { path: '/admin/schedule', icon: CalendarDays, label: isFr ? 'Planning' : 'Schedule' },
    { path: '/admin/settings', icon: Settings, label: isFr ? 'Réglages' : 'Settings' },
  ]

  // Coach non admin : ses cours et le planning. Il n'a pas accès aux écrans
  // d'administration, inutile de les lui proposer.
  const coachItems = [
    { path: '/coach/my-classes', icon: Dumbbell, label: isFr ? 'Mes cours' : 'My classes' },
    { path: '/schedule', icon: CalendarDays, label: t('nav.schedule') },
    { path: '/my-bookings', icon: ClipboardList, label: isFr ? 'Mes résas' : 'My bookings' },
    { path: '/', icon: Home, label: t('nav.home') },
  ]

  // Membre : « Mes cours » plutôt que les stats — le planning signale les cours
  // réservés mais ne les regroupe pas, et savoir quand on s'entraîne est la
  // question la plus fréquente.
  const memberItems = [
    { path: '/', icon: Home, label: t('nav.home') },
    { path: '/schedule', icon: CalendarDays, label: t('nav.schedule') },
    { path: '/my-bookings', icon: ClipboardList, label: isFr ? 'Mes cours' : 'My classes' },
    { path: '/my-packs', icon: CreditCard, label: t('packs.myPacks') },
  ]

  const items = isAdmin ? adminItems : isCoach ? coachItems : memberItems

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

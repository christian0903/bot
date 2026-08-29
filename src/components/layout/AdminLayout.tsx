import { NavLink, Outlet } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  Users,
  UserCog,
  Tags,
  CreditCard,
  Package,
  Dumbbell,
  Activity,
  CalendarDays,
  BookOpen,
  Ticket,
  Megaphone,
  Settings,
  BarChart3,
  ScrollText,
  FileText,
  Gift,
  MessageSquare,
  UserSearch,
  Download,
  HelpCircle,
  Stethoscope,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuth } from '@/contexts/AuthContext'

const adminNav = [
  { path: '/admin/users', icon: Users, labelKey: 'admin.users.title' },
  // Juste après les membres : c'est l'écran le plus ouvert de la journée, il
  // n'a rien à faire au milieu des réglages qu'on touche une fois par saison.
  { path: '/admin/schedule', icon: CalendarDays, labelKey: 'admin.schedule.title' },
  { path: '/admin/coaches', icon: UserCog, labelKey: 'admin.coaches.title' },
  { path: '/admin/categories', icon: Tags, labelKey: 'admin.categories.title' },
  { path: '/admin/credit-types', icon: CreditCard, labelKey: 'admin.creditTypes.title' },
  { path: '/admin/pack-types', icon: Package, labelKey: 'admin.packTypes.title' },
  { path: '/admin/class-types', icon: Dumbbell, labelKey: 'admin.classTypes.title' },
  { path: '/performance-types', icon: Activity, labelKey: 'admin.performanceTypes.title' },
  { path: '/admin/bookings', icon: BookOpen, labelKey: 'admin.bookings.title' },
  { path: '/admin/coupons', icon: Ticket, labelKey: 'admin.coupons.title' },
  { path: '/admin/announcements', icon: Megaphone, labelKey: 'admin.announcements.title' },
  { path: '/admin/activity-log', icon: ScrollText, labelKey: 'admin.activityLog.title' },
  { path: '/admin/invoice-requests', icon: FileText, labelKey: 'admin.invoiceRequests.title' },
  { path: '/admin/referrals', icon: Gift, labelKey: 'admin.referrals.title' },
  { path: '/admin/reviews', icon: MessageSquare, labelKey: 'admin.reviews.title' },
  { path: '/admin/client-tracking', icon: UserSearch, labelKey: 'admin.clientTracking.title' },
  { path: '/admin/dashboard', icon: BarChart3, labelKey: 'admin.dashboard.title' },
  { path: '/admin/exports', icon: Download, labelKey: 'admin.exports.title' },
  { path: '/admin/settings', icon: Settings, labelKey: 'admin.settings.title' },
  // Réservé au super_admin : le diagnostic dit l'état de l'installation, pas
  // celui du studio. Un gérant n'a rien à y faire, et la première entrée de ce
  // menu à dépendre d'un rôle.
  { path: '/admin/diagnostic', icon: Stethoscope, labelKey: 'admin.diagnostic.title', superAdminOnly: true },
  // L'aide vit hors de /admin (page publique aux membres) : le lien y mène
  // directement, l'onglet « Guide coach & admin » s'y affiche selon le rôle.
  { path: '/help', icon: HelpCircle, labelKey: 'nav.help' },
]

export function AdminLayout() {
  const { t } = useTranslation()
  const { hasRole } = useAuth()
  const entrees = adminNav.filter((item) => !item.superAdminOnly || hasRole('super_admin'))

  return (
    <div className="flex flex-col md:flex-row gap-6">
      {/* Sidebar desktop / Horizontal scroll mobile */}
      <nav className="md:w-56 shrink-0 sticky top-[calc(3.5rem+env(safe-area-inset-top))] z-30 -mx-4 px-4 py-2 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 md:static md:mx-0 md:px-0 md:py-0 md:bg-transparent md:backdrop-blur-none">
        <div className="flex md:flex-col gap-1 overflow-x-auto md:overflow-x-visible md:sticky md:top-20">
          {entrees.map(({ path, icon: Icon, labelKey }) => (
            <NavLink
              key={path}
              to={path}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium whitespace-nowrap transition-colors',
                  isActive
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                )
              }
            >
              <Icon className="h-4 w-4 shrink-0" />
              {t(labelKey)}
            </NavLink>
          ))}
        </div>
      </nav>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <Outlet />
      </div>
    </div>
  )
}

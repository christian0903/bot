import { NavLink, Outlet } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  Users,
  Tags,
  CreditCard,
  Package,
  Dumbbell,
  CalendarDays,
  BookOpen,
  Ticket,
  Megaphone,
  Settings,
  BarChart3,
  ScrollText,
  FileText,
  Gift,
} from 'lucide-react'
import { cn } from '@/lib/utils'

const adminNav = [
  { path: '/admin/users', icon: Users, labelKey: 'admin.users.title' },
  { path: '/admin/categories', icon: Tags, labelKey: 'admin.categories.title' },
  { path: '/admin/credit-types', icon: CreditCard, labelKey: 'admin.creditTypes.title' },
  { path: '/admin/pack-types', icon: Package, labelKey: 'admin.packTypes.title' },
  { path: '/admin/class-types', icon: Dumbbell, labelKey: 'admin.classTypes.title' },
  { path: '/admin/schedule', icon: CalendarDays, labelKey: 'admin.schedule.title' },
  { path: '/admin/bookings', icon: BookOpen, labelKey: 'admin.bookings.title' },
  { path: '/admin/coupons', icon: Ticket, labelKey: 'admin.coupons.title' },
  { path: '/admin/announcements', icon: Megaphone, labelKey: 'admin.announcements.title' },
  { path: '/admin/activity-log', icon: ScrollText, labelKey: 'admin.activityLog.title' },
  { path: '/admin/invoice-requests', icon: FileText, labelKey: 'admin.invoiceRequests.title' },
  { path: '/admin/referrals', icon: Gift, labelKey: 'admin.referrals.title' },
  { path: '/admin/dashboard', icon: BarChart3, labelKey: 'admin.dashboard.title' },
  { path: '/admin/settings', icon: Settings, labelKey: 'admin.settings.title' },
]

export function AdminLayout() {
  const { t } = useTranslation()

  return (
    <div className="flex flex-col md:flex-row gap-6">
      {/* Sidebar desktop / Horizontal scroll mobile */}
      <nav className="md:w-56 shrink-0">
        <div className="flex md:flex-col gap-1 overflow-x-auto md:overflow-x-visible pb-2 md:pb-0 md:sticky md:top-20">
          {adminNav.map(({ path, icon: Icon, labelKey }) => (
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

import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { Toaster } from 'sonner'
import { TooltipProvider } from '@/components/ui/tooltip'
import { AuthProvider } from '@/contexts/AuthContext'
import { ThemeProvider } from '@/contexts/ThemeContext'
import { NotificationProvider } from '@/contexts/NotificationContext'
import { AuthGuard } from '@/components/auth/AuthGuard'
import { RoleGuard } from '@/components/auth/RoleGuard'
import { Layout } from '@/components/layout/Layout'
import { AdminLayout } from '@/components/layout/AdminLayout'
import { LoadingState } from '@/components/common/LoadingState'

// Pages publiques (chargées immédiatement)
import { HomePage } from '@/pages/HomePage'
import { AuthPage } from '@/pages/AuthPage'
import { ResetPasswordPage } from '@/pages/ResetPasswordPage'
import { ConfirmEmailPage } from '@/pages/ConfirmEmailPage'

// Pages authentifiées (lazy)
const DashboardPage = lazy(() => import('@/pages/DashboardPage').then(m => ({ default: m.DashboardPage })))
const SchedulePage = lazy(() => import('@/pages/SchedulePage').then(m => ({ default: m.SchedulePage })))
const MyBookingsPage = lazy(() => import('@/pages/MyBookingsPage').then(m => ({ default: m.MyBookingsPage })))
const MyPacksPage = lazy(() => import('@/pages/MyPacksPage').then(m => ({ default: m.MyPacksPage })))
const PacksPage = lazy(() => import('@/pages/PacksPage').then(m => ({ default: m.PacksPage })))
const ProfilePage = lazy(() => import('@/pages/ProfilePage').then(m => ({ default: m.ProfilePage })))
const PublicProfilePage = lazy(() => import('@/pages/PublicProfilePage').then(m => ({ default: m.PublicProfilePage })))
const NotificationsPage = lazy(() => import('@/pages/NotificationsPage').then(m => ({ default: m.NotificationsPage })))
const HelpPage = lazy(() => import('@/pages/HelpPage').then(m => ({ default: m.HelpPage })))

// Pages coach (lazy)
const CoachClassesPage = lazy(() => import('@/pages/coach/CoachClassesPage').then(m => ({ default: m.CoachClassesPage })))
const CoachClassDetailPage = lazy(() => import('@/pages/coach/CoachClassDetailPage').then(m => ({ default: m.CoachClassDetailPage })))

// Pages admin (lazy)
const AdminUsersPage = lazy(() => import('@/pages/admin/AdminUsersPage').then(m => ({ default: m.AdminUsersPage })))
const AdminCategoriesPage = lazy(() => import('@/pages/admin/AdminCategoriesPage').then(m => ({ default: m.AdminCategoriesPage })))
const AdminCreditTypesPage = lazy(() => import('@/pages/admin/AdminCreditTypesPage').then(m => ({ default: m.AdminCreditTypesPage })))
const AdminPackTypesPage = lazy(() => import('@/pages/admin/AdminPackTypesPage').then(m => ({ default: m.AdminPackTypesPage })))
const AdminClassTypesPage = lazy(() => import('@/pages/admin/AdminClassTypesPage').then(m => ({ default: m.AdminClassTypesPage })))
const AdminSchedulePage = lazy(() => import('@/pages/admin/AdminSchedulePage').then(m => ({ default: m.AdminSchedulePage })))
const AdminBookingsPage = lazy(() => import('@/pages/admin/AdminBookingsPage').then(m => ({ default: m.AdminBookingsPage })))
const AdminCouponsPage = lazy(() => import('@/pages/admin/AdminCouponsPage').then(m => ({ default: m.AdminCouponsPage })))
const AdminAnnouncementsPage = lazy(() => import('@/pages/admin/AdminAnnouncementsPage').then(m => ({ default: m.AdminAnnouncementsPage })))
const AdminSettingsPage = lazy(() => import('@/pages/admin/AdminSettingsPage').then(m => ({ default: m.AdminSettingsPage })))
const AdminDashboardPage = lazy(() => import('@/pages/admin/AdminDashboardPage').then(m => ({ default: m.AdminDashboardPage })))

const AdminUserDetailPage = lazy(() => import('@/pages/admin/AdminUserDetailPage').then(m => ({ default: m.AdminUserDetailPage })))
const AdminActivityLogPage = lazy(() => import('@/pages/admin/AdminActivityLogPage').then(m => ({ default: m.AdminActivityLogPage })))
const AdminInvoiceRequestsPage = lazy(() => import('@/pages/admin/AdminInvoiceRequestsPage').then(m => ({ default: m.AdminInvoiceRequestsPage })))
const InvoiceRequestPage = lazy(() => import('@/pages/InvoiceRequestPage').then(m => ({ default: m.InvoiceRequestPage })))

function Lazy({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={<LoadingState />}>{children}</Suspense>
}

function App() {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <AuthProvider>
          <NotificationProvider>
            <TooltipProvider>
              <Routes>
                <Route element={<Layout />}>
                  {/* Public */}
                  <Route path="/" element={<HomePage />} />
                  <Route path="/auth" element={<AuthPage />} />
                  <Route path="/auth/reset-password" element={<ResetPasswordPage />} />
                  <Route path="/auth/confirm" element={<ConfirmEmailPage />} />

                  {/* Authenticated */}
                  <Route path="/dashboard" element={<AuthGuard><Lazy><DashboardPage /></Lazy></AuthGuard>} />
                  <Route path="/schedule" element={<AuthGuard><Lazy><SchedulePage /></Lazy></AuthGuard>} />
                  <Route path="/my-bookings" element={<AuthGuard><Lazy><MyBookingsPage /></Lazy></AuthGuard>} />
                  <Route path="/my-packs" element={<AuthGuard><Lazy><MyPacksPage /></Lazy></AuthGuard>} />
                  <Route path="/packs" element={<AuthGuard><Lazy><PacksPage /></Lazy></AuthGuard>} />
                  <Route path="/profile" element={<AuthGuard><Lazy><ProfilePage /></Lazy></AuthGuard>} />
                  <Route path="/profile/:id" element={<AuthGuard><Lazy><PublicProfilePage /></Lazy></AuthGuard>} />
                  <Route path="/notifications" element={<AuthGuard><Lazy><NotificationsPage /></Lazy></AuthGuard>} />
                  <Route path="/invoice-request" element={<AuthGuard><Lazy><InvoiceRequestPage /></Lazy></AuthGuard>} />
                  <Route path="/help" element={<Lazy><HelpPage /></Lazy>} />

                  {/* Coach */}
                  <Route path="/coach/my-classes" element={<AuthGuard><RoleGuard roles={['coach', 'admin']}><Lazy><CoachClassesPage /></Lazy></RoleGuard></AuthGuard>} />
                  <Route path="/coach/class/:id" element={<AuthGuard><RoleGuard roles={['coach', 'admin']}><Lazy><CoachClassDetailPage /></Lazy></RoleGuard></AuthGuard>} />

                  {/* Admin */}
                  <Route path="/admin" element={<AuthGuard><RoleGuard roles={['admin']}><AdminLayout /></RoleGuard></AuthGuard>}>
                    <Route path="users" element={<Lazy><AdminUsersPage /></Lazy>} />
                    <Route path="users/:id" element={<Lazy><AdminUserDetailPage /></Lazy>} />
                    <Route path="categories" element={<Lazy><AdminCategoriesPage /></Lazy>} />
                    <Route path="credit-types" element={<Lazy><AdminCreditTypesPage /></Lazy>} />
                    <Route path="pack-types" element={<Lazy><AdminPackTypesPage /></Lazy>} />
                    <Route path="class-types" element={<Lazy><AdminClassTypesPage /></Lazy>} />
                    <Route path="schedule" element={<Lazy><AdminSchedulePage /></Lazy>} />
                    <Route path="bookings" element={<Lazy><AdminBookingsPage /></Lazy>} />
                    <Route path="coupons" element={<Lazy><AdminCouponsPage /></Lazy>} />
                    <Route path="announcements" element={<Lazy><AdminAnnouncementsPage /></Lazy>} />
                    <Route path="settings" element={<Lazy><AdminSettingsPage /></Lazy>} />
                    <Route path="activity-log" element={<Lazy><AdminActivityLogPage /></Lazy>} />
                    <Route path="dashboard" element={<Lazy><AdminDashboardPage /></Lazy>} />
                    <Route path="invoice-requests" element={<Lazy><AdminInvoiceRequestsPage /></Lazy>} />
                  </Route>
                </Route>
              </Routes>
              <Toaster richColors position="top-right" />
            </TooltipProvider>
          </NotificationProvider>
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  )
}

export default App

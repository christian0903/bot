import { Navigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { useTranslation } from 'react-i18next'
import type { UserRole } from '@/types'

interface RoleGuardProps {
  children: React.ReactNode
  roles: UserRole[]
}

export function RoleGuard({ children, roles }: RoleGuardProps) {
  const { loading, roles: userRoles } = useAuth()
  const { t } = useTranslation()

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <p className="text-muted-foreground">{t('common.loading')}</p>
      </div>
    )
  }

  const hasRequiredRole = roles.some((role) => userRoles.includes(role))

  if (!hasRequiredRole) {
    return <Navigate to="/" replace />
  }

  return <>{children}</>
}

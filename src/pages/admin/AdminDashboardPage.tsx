import { useTranslation } from 'react-i18next'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { BarChart3 } from 'lucide-react'

export function AdminDashboardPage() {
  const { t } = useTranslation()

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">{t('admin.dashboard.title')}</h1>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-muted-foreground" />
            {t('admin.dashboard.title')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <BarChart3 className="h-12 w-12 text-muted-foreground/50 mb-4" />
            <p className="text-lg font-medium text-muted-foreground">Phase 2</p>
            <p className="text-sm text-muted-foreground mt-1">
              {t('admin.dashboard.revenue')}, {t('admin.dashboard.packSales')}, {t('admin.dashboard.classesByCoach')}
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

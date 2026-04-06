import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { MailCheck } from 'lucide-react'

export function ConfirmEmailPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()

  return (
    <div className="flex items-center justify-center min-h-[70vh]">
      <Card className="w-full max-w-md text-center">
        <CardHeader>
          <div className="flex justify-center mb-4">
            <MailCheck className="h-12 w-12 text-primary" />
          </div>
          <CardTitle>{t('auth.emailConfirmation')}</CardTitle>
        </CardHeader>
        <CardContent>
          <Button variant="outline" onClick={() => navigate('/auth')}>
            {t('auth.loginButton')}
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}

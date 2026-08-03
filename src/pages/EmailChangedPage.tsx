import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { MailCheck } from 'lucide-react'

export function EmailChangedPage() {
  const { i18n } = useTranslation()
  const isFr = i18n.language === 'fr'
  const navigate = useNavigate()

  return (
    <div className="flex items-center justify-center min-h-[70vh]">
      <Card className="w-full max-w-md text-center">
        <CardHeader>
          <div className="flex justify-center mb-4">
            <MailCheck className="h-12 w-12 text-primary" />
          </div>
          <CardTitle>
            {isFr ? 'Adresse email mise à jour' : 'Email address updated'}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            {isFr
              ? 'Votre nouvelle adresse email est désormais active. Connectez-vous avec cette adresse pour accéder à votre compte.'
              : 'Your new email address is now active. Sign in with that address to access your account.'}
          </p>
          <Button className="w-full" onClick={() => navigate('/auth')}>
            {isFr ? 'Se connecter' : 'Sign in'}
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}

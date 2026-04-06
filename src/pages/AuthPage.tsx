import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { toast } from 'sonner'
import { Dumbbell } from 'lucide-react'

const DISPLAY_NAME_REGEX = /^[a-zA-ZÀ-ÿ\s-]+$/
const VERIFICATION_ANSWER = '7'

export function AuthPage() {
  const { t } = useTranslation()
  const { signIn, signUp, resetPassword } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const from = (location.state as { from?: string })?.from ?? '/dashboard'

  const [tab, setTab] = useState<string>('login')
  const [loading, setLoading] = useState(false)

  // Login form
  const [loginEmail, setLoginEmail] = useState('')
  const [loginPassword, setLoginPassword] = useState('')

  // Register form
  const [regEmail, setRegEmail] = useState('')
  const [regPassword, setRegPassword] = useState('')
  const [regConfirmPassword, setRegConfirmPassword] = useState('')
  const [regDisplayName, setRegDisplayName] = useState('')
  const [regVerification, setRegVerification] = useState('')
  const [honeypot, setHoneypot] = useState('')

  // Forgot password
  const [forgotEmail, setForgotEmail] = useState('')

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!loginEmail) { toast.error(t('auth.emailRequired')); return }
    if (!loginPassword) { toast.error(t('auth.passwordRequired')); return }
    setLoading(true)
    const { error } = await signIn(loginEmail, loginPassword)
    setLoading(false)
    if (error) {
      toast.error(error.message)
    } else {
      toast.success(t('auth.loginSuccess'))
      navigate(from, { replace: true })
    }
  }

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    // Honeypot check
    if (honeypot) return

    if (!regDisplayName) { toast.error(t('auth.displayNameRequired')); return }
    if (!DISPLAY_NAME_REGEX.test(regDisplayName)) { toast.error(t('auth.invalidDisplayName')); return }
    if (!regEmail) { toast.error(t('auth.emailRequired')); return }
    if (!regPassword || regPassword.length < 8) { toast.error(t('auth.passwordMinLength')); return }
    if (regPassword !== regConfirmPassword) { toast.error(t('auth.passwordMismatch')); return }
    if (regVerification !== VERIFICATION_ANSWER) { toast.error(t('auth.verificationError')); return }

    setLoading(true)
    const { error } = await signUp(regEmail, regPassword, regDisplayName)
    setLoading(false)
    if (error) {
      toast.error(error.message)
    } else {
      toast.success(t('auth.emailConfirmation'))
      setTab('login')
    }
  }

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!forgotEmail) { toast.error(t('auth.emailRequired')); return }
    setLoading(true)
    const { error } = await resetPassword(forgotEmail)
    setLoading(false)
    if (error) {
      toast.error(error.message)
    } else {
      toast.success(t('auth.resetEmailSent'))
    }
  }

  return (
    <div className="flex items-center justify-center min-h-[70vh]">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-2">
            <Dumbbell className="h-10 w-10 text-primary" />
          </div>
          <CardTitle>{t('app.name')}</CardTitle>
          <CardDescription>{t('app.tagline')}</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={tab} onValueChange={setTab}>
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="login">{t('auth.login')}</TabsTrigger>
              <TabsTrigger value="register">{t('auth.register')}</TabsTrigger>
              <TabsTrigger value="forgot">{t('auth.forgotPassword')}</TabsTrigger>
            </TabsList>

            {/* LOGIN */}
            <TabsContent value="login">
              <form onSubmit={handleLogin} className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label htmlFor="login-email">{t('auth.email')}</Label>
                  <Input
                    id="login-email"
                    type="email"
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="login-password">{t('auth.password')}</Label>
                  <Input
                    id="login-password"
                    type="password"
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    required
                  />
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {t('auth.loginButton')}
                </Button>
                <p className="text-center text-sm text-muted-foreground">
                  {t('auth.noAccount')}{' '}
                  <button type="button" className="text-primary underline" onClick={() => setTab('register')}>
                    {t('auth.register')}
                  </button>
                </p>
              </form>
            </TabsContent>

            {/* REGISTER */}
            <TabsContent value="register">
              <form onSubmit={handleRegister} className="space-y-4 mt-4">
                {/* Honeypot - hidden from users */}
                <div className="absolute opacity-0 pointer-events-none" aria-hidden="true">
                  <Input
                    tabIndex={-1}
                    autoComplete="off"
                    value={honeypot}
                    onChange={(e) => setHoneypot(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="reg-name">{t('auth.displayName')}</Label>
                  <Input
                    id="reg-name"
                    value={regDisplayName}
                    onChange={(e) => setRegDisplayName(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="reg-email">{t('auth.email')}</Label>
                  <Input
                    id="reg-email"
                    type="email"
                    value={regEmail}
                    onChange={(e) => setRegEmail(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="reg-password">{t('auth.password')}</Label>
                  <Input
                    id="reg-password"
                    type="password"
                    value={regPassword}
                    onChange={(e) => setRegPassword(e.target.value)}
                    required
                    minLength={8}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="reg-confirm">{t('auth.confirmPassword')}</Label>
                  <Input
                    id="reg-confirm"
                    type="password"
                    value={regConfirmPassword}
                    onChange={(e) => setRegConfirmPassword(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="reg-verification">{t('auth.verificationQuestion')}</Label>
                  <Input
                    id="reg-verification"
                    value={regVerification}
                    onChange={(e) => setRegVerification(e.target.value)}
                    required
                  />
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {t('auth.registerButton')}
                </Button>
                <p className="text-center text-sm text-muted-foreground">
                  {t('auth.hasAccount')}{' '}
                  <button type="button" className="text-primary underline" onClick={() => setTab('login')}>
                    {t('auth.login')}
                  </button>
                </p>
              </form>
            </TabsContent>

            {/* FORGOT PASSWORD */}
            <TabsContent value="forgot">
              <form onSubmit={handleForgotPassword} className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label htmlFor="forgot-email">{t('auth.email')}</Label>
                  <Input
                    id="forgot-email"
                    type="email"
                    value={forgotEmail}
                    onChange={(e) => setForgotEmail(e.target.value)}
                    required
                  />
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {t('auth.sendResetLink')}
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  )
}

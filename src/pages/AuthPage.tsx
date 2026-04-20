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
import { Dumbbell, ChevronRight, ChevronLeft, Check } from 'lucide-react'

const NAME_REGEX = /^[a-zA-ZÀ-ÿ\s-]+$/
const VERIFICATION_ANSWER = '7'

export function AuthPage() {
  const { t, i18n } = useTranslation()
  const isFr = i18n.language === 'fr'
  const { signIn, signUp, resetPassword } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const from = (location.state as { from?: string })?.from ?? '/dashboard'

  const [tab, setTab] = useState<string>('login')
  const [loading, setLoading] = useState(false)
  const [regStep, setRegStep] = useState(1) // 1: infos perso, 2: compte + legal

  // Login form
  const [loginEmail, setLoginEmail] = useState('')
  const [loginPassword, setLoginPassword] = useState('')

  // Register form - Step 1: infos personnelles
  const [regFirstName, setRegFirstName] = useState('')
  const [regLastName, setRegLastName] = useState('')
  const [regPhone, setRegPhone] = useState('')
  const [regDateOfBirth, setRegDateOfBirth] = useState('')
  const [regAddress, setRegAddress] = useState('')

  // Register form - Step 2: compte + legal
  const [regEmail, setRegEmail] = useState('')
  const [regPassword, setRegPassword] = useState('')
  const [regConfirmPassword, setRegConfirmPassword] = useState('')
  const [regVerification, setRegVerification] = useState('')
  const [regReferralCode, setRegReferralCode] = useState(() => {
    const params = new URLSearchParams(window.location.search)
    return params.get('ref')?.toUpperCase() || ''
  })
  const [regCgvAccepted, setRegCgvAccepted] = useState(false)
  const [regRgpdAccepted, setRegRgpdAccepted] = useState(false)
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

  const validateStep1 = (): boolean => {
    if (!regFirstName || !NAME_REGEX.test(regFirstName)) {
      toast.error(t('auth.firstNameRequired'))
      return false
    }
    if (!regLastName || !NAME_REGEX.test(regLastName)) {
      toast.error(t('auth.lastNameRequired'))
      return false
    }
    if (!regPhone) {
      toast.error(t('auth.phoneRequired'))
      return false
    }
    if (!regDateOfBirth) {
      toast.error(t('auth.dateOfBirthRequired'))
      return false
    }
    if (!regAddress) {
      toast.error(t('auth.addressRequired'))
      return false
    }
    return true
  }

  const handleNextStep = () => {
    if (validateStep1()) {
      setRegStep(2)
    }
  }

  const [regErrors, setRegErrors] = useState<string[]>([])

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    if (honeypot) return

    const errors: string[] = []
    if (!regEmail) errors.push(t('auth.emailRequired'))
    if (!regPassword || regPassword.length < 12) errors.push(t('auth.passwordMinLength'))
    if (regPassword && regPassword.length >= 12 && regPassword !== regConfirmPassword) errors.push(t('auth.passwordMismatch'))
    if (regVerification !== VERIFICATION_ANSWER) errors.push(t('auth.verificationError'))
    if (!regCgvAccepted) errors.push(t('auth.cgvRequired'))
    if (!regRgpdAccepted) errors.push(t('auth.rgpdRequired'))

    if (errors.length > 0) {
      setRegErrors(errors)
      toast.error(errors[0])
      return
    }
    setRegErrors([])
    setLoading(true)
    const displayName = `${regFirstName} ${regLastName}`
    const { error } = await signUp(regEmail, regPassword, {
      display_name: displayName,
      first_name: regFirstName,
      last_name: regLastName,
      phone: regPhone,
      date_of_birth: regDateOfBirth,
      address: regAddress,
      cgv_accepted: regCgvAccepted,
      rgpd_accepted: regRgpdAccepted,
      referral_code: regReferralCode || undefined,
    })
    setLoading(false)
    if (error) {
      toast.error(error.message)
    } else {
      toast.success(t('auth.emailConfirmation'))
      setTab('login')
      setRegStep(1)
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
          <Tabs value={tab} onValueChange={(v) => { setTab(v); setRegStep(1) }}>
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
              {/* Honeypot - hidden from users */}
              <div className="absolute opacity-0 pointer-events-none" aria-hidden="true">
                <Input
                  tabIndex={-1}
                  autoComplete="off"
                  value={honeypot}
                  onChange={(e) => setHoneypot(e.target.value)}
                />
              </div>

              {/* Step indicator */}
              <div className="flex items-center justify-center gap-2 mt-4 mb-2">
                <div className={`h-2 w-8 rounded-full ${regStep === 1 ? 'bg-primary' : 'bg-muted'}`} />
                <div className={`h-2 w-8 rounded-full ${regStep === 2 ? 'bg-primary' : 'bg-muted'}`} />
              </div>
              <p className="text-center text-xs text-muted-foreground mb-4">
                {t('auth.step')} {regStep}/2 — {regStep === 1 ? t('auth.personalInfo') : t('auth.accountAndLegal')}
              </p>

              {regStep === 1 && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="reg-firstname">{t('auth.firstName')} *</Label>
                      <Input
                        id="reg-firstname"
                        value={regFirstName}
                        onChange={(e) => setRegFirstName(e.target.value)}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="reg-lastname">{t('auth.lastName')} *</Label>
                      <Input
                        id="reg-lastname"
                        value={regLastName}
                        onChange={(e) => setRegLastName(e.target.value)}
                        required
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="reg-phone">{t('auth.phone')} *</Label>
                    <Input
                      id="reg-phone"
                      type="tel"
                      value={regPhone}
                      onChange={(e) => setRegPhone(e.target.value)}
                      placeholder="+32 4xx xx xx xx"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="reg-dob">{t('auth.dateOfBirth')} *</Label>
                    <Input
                      id="reg-dob"
                      type="date"
                      value={regDateOfBirth}
                      onChange={(e) => setRegDateOfBirth(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="reg-address">{t('auth.address')} *</Label>
                    <Input
                      id="reg-address"
                      value={regAddress}
                      onChange={(e) => setRegAddress(e.target.value)}
                      placeholder={t('auth.addressPlaceholder')}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="reg-referral">{t('auth.referralCode')}</Label>
                    <Input
                      id="reg-referral"
                      value={regReferralCode}
                      onChange={(e) => setRegReferralCode(e.target.value.toUpperCase())}
                      placeholder={t('auth.referralCodePlaceholder')}
                    />
                  </div>
                  <Button type="button" className="w-full" onClick={handleNextStep}>
                    {t('common.next')} <ChevronRight className="ml-2 h-4 w-4" />
                  </Button>
                </div>
              )}

              {regStep === 2 && (
                <form onSubmit={handleRegister} className="space-y-4">
                  {/* Field validation states */}
                  {(() => {
                    const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(regEmail)
                    const passOk = regPassword.length >= 12
                    const confirmOk = passOk && regPassword === regConfirmPassword
                    const verifyOk = regVerification === VERIFICATION_ANSWER
                    const cgvOk = regCgvAccepted
                    const rgpdOk = regRgpdAccepted
                    const checks = [emailOk, passOk, confirmOk, verifyOk, cgvOk, rgpdOk]
                    const doneCount = checks.filter(Boolean).length
                    const progress = (doneCount / checks.length) * 100

                    const FieldCheck = ({ ok }: { ok: boolean }) => ok
                      ? <Check className="h-4 w-4 text-green-500 shrink-0" />
                      : <span className="h-4 w-4 shrink-0" />

                    return (
                      <>
                        {/* Progress bar */}
                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs text-muted-foreground">{doneCount}/{checks.length}</span>
                            {progress >= 100 && <span className="text-xs text-green-500 font-medium">{isFr ? 'Prêt !' : 'Ready!'}</span>}
                          </div>
                          <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                            <div className={`h-full rounded-full transition-all ${progress >= 100 ? 'bg-green-500' : 'bg-primary'}`} style={{ width: `${progress}%` }} />
                          </div>
                        </div>

                        {/* Validation errors */}
                        {regErrors.length > 0 && (
                          <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3">
                            <ul className="text-sm text-destructive space-y-1">
                              {regErrors.map((err, i) => <li key={i}>{err}</li>)}
                            </ul>
                          </div>
                        )}

                        <div className="space-y-2">
                          <Label htmlFor="reg-email" className="flex items-center gap-2">
                            {t('auth.email')} * <FieldCheck ok={emailOk} />
                          </Label>
                          <Input id="reg-email" type="email" value={regEmail}
                            onChange={(e) => { setRegEmail(e.target.value); setRegErrors([]) }} />
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="reg-password" className="flex items-center gap-2">
                            {t('auth.password')} * <FieldCheck ok={passOk} />
                          </Label>
                          <Input id="reg-password" type="password" value={regPassword}
                            onChange={(e) => { setRegPassword(e.target.value); setRegErrors([]) }} />
                          <p className={`text-xs ${regPassword && !passOk ? 'text-destructive font-medium' : passOk ? 'text-green-500' : 'text-muted-foreground'}`}>
                            {t('auth.passwordMinLengthHint')} ({regPassword.length}/12)
                          </p>
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="reg-confirm" className="flex items-center gap-2">
                            {t('auth.confirmPassword')} * <FieldCheck ok={confirmOk} />
                          </Label>
                          <Input id="reg-confirm" type="password" value={regConfirmPassword}
                            onChange={(e) => { setRegConfirmPassword(e.target.value); setRegErrors([]) }} />
                          {regConfirmPassword && !confirmOk && (
                            <p className="text-xs text-destructive">{t('auth.passwordMismatch')}</p>
                          )}
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="reg-verification" className="flex items-center gap-2">
                            {t('auth.verificationQuestion')} <FieldCheck ok={verifyOk} />
                          </Label>
                          <Input id="reg-verification" value={regVerification}
                            onChange={(e) => { setRegVerification(e.target.value); setRegErrors([]) }} />
                        </div>

                        {/* CGV + RGPD checkboxes */}
                        <div className="space-y-3 rounded-md border p-4">
                          <div className="flex items-start gap-3">
                            <input type="checkbox" id="reg-cgv" checked={regCgvAccepted}
                              onChange={(e) => { setRegCgvAccepted(e.target.checked); setRegErrors([]) }}
                              className="mt-1 h-4 w-4 rounded border-gray-300" />
                            <Label htmlFor="reg-cgv" className="text-sm font-normal leading-snug flex items-center gap-2">
                              {t('auth.cgvAccept')} * <FieldCheck ok={cgvOk} />
                            </Label>
                          </div>
                          <div className="flex items-start gap-3">
                            <input type="checkbox" id="reg-rgpd" checked={regRgpdAccepted}
                              onChange={(e) => { setRegRgpdAccepted(e.target.checked); setRegErrors([]) }}
                              className="mt-1 h-4 w-4 rounded border-gray-300" />
                            <Label htmlFor="reg-rgpd" className="text-sm font-normal leading-snug flex items-center gap-2">
                              {t('auth.rgpdAccept')} * <FieldCheck ok={rgpdOk} />
                            </Label>
                          </div>
                        </div>

                        <div className="flex gap-2">
                          <Button type="button" variant="outline" className="flex-1" onClick={() => setRegStep(1)}>
                            <ChevronLeft className="mr-2 h-4 w-4" /> {t('common.previous')}
                          </Button>
                          <Button type="submit" className="flex-1" disabled={loading}>
                            {t('auth.registerButton')}
                          </Button>
                        </div>
                      </>
                    )
                  })()}
                  <p className="text-center text-sm text-muted-foreground">
                    {t('auth.hasAccount')}{' '}
                    <button type="button" className="text-primary underline" onClick={() => setTab('login')}>
                      {t('auth.login')}
                    </button>
                  </p>
                </form>
              )}
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

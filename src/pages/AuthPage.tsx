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
import { Dumbbell, ChevronRight, ChevronLeft, Check, MailCheck, RefreshCw } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { landingRouteFor } from '@/lib/landing-route'
import type { UserRole } from '@/types'

const NAME_REGEX = /^[a-zA-ZÀ-ÿ\s-]+$/
const VERIFICATION_ANSWER = '7'

export function AuthPage() {
  const { t, i18n } = useTranslation()
  const isFr = i18n.language === 'fr'
  const { signIn, signUp, resetPassword, resendConfirmation } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  // `null` quand l'utilisateur n'a pas été renvoyé ici depuis une page
  // protégée : on choisira alors sa destination selon son rôle.
  const from = (location.state as { from?: string })?.from ?? null

  // Un lien de parrainage (`?ref=CODE`) s'adresse par définition à quelqu'un qui
  // n'a pas de compte : l'ouvrir sur « Connexion » lui demande de se connecter à
  // un compte qu'il n'a pas. Le code était bien repris dans le formulaire, mais
  // encore fallait-il y arriver.
  const [tab, setTab] = useState<string>(() =>
    new URLSearchParams(window.location.search).has('ref') ? 'register' : 'login',
  )
  const [loading, setLoading] = useState(false)
  const [regStep, setRegStep] = useState(1) // 1: infos perso, 2: compte + legal
  /** Adresse à laquelle l'e-mail de confirmation vient de partir. Non nul = inscription aboutie. */
  const [registeredEmail, setRegisteredEmail] = useState<string | null>(null)
  /** Renvoi de confirmation en cours : évite qu'un double clic parte deux fois. */
  const [resending, setResending] = useState(false)
  /**
   * Connexion refusée faute de confirmation. C'est le cas de celui qui a fermé
   * l'écran d'inscription : sans cet état, il n'aurait plus aucun moyen de
   * relancer l'e-mail.
   */
  const [needsConfirmation, setNeedsConfirmation] = useState(false)

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

  // Forgot password
  const [forgotEmail, setForgotEmail] = useState('')

  /**
   * Renvoie l'e-mail de confirmation à l'adresse donnée.
   *
   * Le message de succès ne dit pas si l'adresse existe : Supabase répond sans
   * erreur pour une adresse inconnue, et distinguer les deux cas ici
   * transformerait ce bouton en moyen de savoir qui est inscrit au studio.
   */
  const handleResend = async (email: string) => {
    setResending(true)
    const { error } = await resendConfirmation(email)
    setResending(false)
    if (error) {
      // Supabase impose une minute entre deux envois. Le dire, sinon le membre
      // reclique en croyant que rien ne part.
      const tropTot = error.message?.toLowerCase().includes('security purposes')
        || error.message?.toLowerCase().includes('rate limit')
      toast.error(
        tropTot
          ? (isFr
            ? 'Un e-mail vient déjà de partir. Patiente une minute avant d\'en redemander un.'
            : 'An email was just sent. Please wait a minute before asking for another.')
          : (isFr ? `Erreur : ${error.message}` : `Error: ${error.message}`),
      )
      return
    }
    toast.success(
      isFr
        ? 'Si un compte existe pour cette adresse, un nouvel e-mail vient de partir.'
        : 'If an account exists for this address, a new email has been sent.',
    )
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!loginEmail) { toast.error(t('auth.emailRequired')); return }
    if (!loginPassword) { toast.error(t('auth.passwordRequired')); return }
    setLoading(true)
    const { error } = await signIn(loginEmail, loginPassword)
    setLoading(false)
    if (error) {
      const nonConfirme = error.message?.includes('Email not confirmed')
      // Le refus pour non-confirmation ouvre un encart avec un bouton de renvoi :
      // un simple toast laissait le membre sans aucune issue.
      setNeedsConfirmation(!!nonConfirme)
      const msg = error.message?.includes('Invalid login')
        ? (isFr ? 'Email ou mot de passe incorrect.' : 'Invalid email or password.')
        : nonConfirme
          ? (isFr ? 'Veuillez confirmer votre email avant de vous connecter.' : 'Please confirm your email before signing in.')
          : (isFr ? `Erreur : ${error.message}` : `Error: ${error.message}`)
      toast.error(msg)
    } else {
      toast.success(t('auth.loginSuccess'))
      // Les rôles arrivent de façon asynchrone : on les lit directement plutôt
      // que d'attendre le contexte, sinon un admin partirait vers /dashboard.
      const { data: { user: signed } } = await supabase.auth.getUser()
      let byRole = '/dashboard'
      if (signed) {
        const { data: roleRows } = await supabase
          .from('user_roles').select('role').eq('user_id', signed.id)
        byRole = landingRouteFor(
          (roleRows ?? []).map((r: { role: string }) => r.role as UserRole),
        )
      }

      // `from` sert à revenir à la page qu'on voulait ouvrir. Mais une
      // déconnexion depuis un écran protégé laisse aussi un `from`, souvent
      // '/' ou '/dashboard' après le passage des gardes : le respecter
      // renverrait un admin vers l'espace client. Ces destinations « par
      // défaut » cèdent donc le pas au rôle.
      const neutral = ['/', '/dashboard', '/auth']
      const target = from && !neutral.includes(from) ? from : byRole
      navigate(target, { replace: true })
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

  // Live validation for step 2
  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(regEmail)
  const passOk = regPassword.length >= 12
  const confirmOk = passOk && regPassword === regConfirmPassword
  const verifyOk = regVerification === VERIFICATION_ANSWER
  const cgvOk = regCgvAccepted
  const rgpdOk = regRgpdAccepted
  const step2Checks = [emailOk, passOk, confirmOk, verifyOk, cgvOk, rgpdOk]
  const step2DoneCount = step2Checks.filter(Boolean).length
  const step2Progress = (step2DoneCount / step2Checks.length) * 100

  const FieldCheck = ({ ok }: { ok: boolean }) => ok
    ? <Check className="h-4 w-4 text-green-500 shrink-0" />
    : <span className="h-4 w-4 shrink-0" />

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
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
    const { error, dejaInscrit } = await signUp(regEmail, regPassword, {
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
      const friendlyMessages: Record<string, { fr: string; en: string }> = {
        'User already registered': { fr: 'Cet email est déjà utilisé.', en: 'This email is already registered.' },
        'Password should be at least': { fr: 'Le mot de passe est trop court.', en: 'Password is too short.' },
        'Unable to validate email address': { fr: 'Adresse email invalide.', en: 'Invalid email address.' },
        'Signups not allowed': { fr: 'Les inscriptions sont désactivées.', en: 'Signups are disabled.' },
        'Database error': { fr: 'Erreur serveur. Veuillez réessayer.', en: 'Server error. Please try again.' },
      }
      const key = Object.keys(friendlyMessages).find(k => error.message?.includes(k))
      const msg = key
        ? (isFr ? friendlyMessages[key].fr : friendlyMessages[key].en)
        : (isFr ? `Erreur : ${error.message}` : `Error: ${error.message}`)
      setRegErrors([msg])
      toast.error(msg)
    } else {
      // L'adresse a déjà un compte : Supabase a répondu comme si de rien
      // n'était et n'a envoyé aucun e-mail. L'écran ne le dit pas — ce serait
      // révéler qui fréquente le studio — mais le journal, lui, le note : c'est
      // ce qui permettra d'expliquer un « je n'ai jamais reçu l'e-mail ».
      if (dejaInscrit) {
        // Sans await : la trace ne doit pas retarder l'affichage, et un échec
        // d'écriture ne doit pas transformer une inscription en erreur.
        void supabase.rpc('log_duplicate_signup', { p_email: regEmail })
      }
      // Un toast disparaît en quelques secondes : le membre se retrouvait
      // devant le formulaire de connexion sans savoir qu'un e-mail l'attendait,
      // et beaucoup essayaient de se connecter en vain. L'écran de
      // confirmation reste affiché tant qu'il ne le quitte pas.
      setRegisteredEmail(regEmail)
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

  // Inscription aboutie : on remplace le formulaire par la marche à suivre.
  // Le membre ne peut pas se connecter tant qu'il n'a pas cliqué le lien reçu —
  // le lui dire ici évite qu'il essaie, échoue, et conclue à une panne.
  if (registeredEmail) {
    return (
      <div className="flex items-center justify-center min-h-[70vh]">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-3">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
                <MailCheck className="h-7 w-7 text-primary" />
              </div>
            </div>
            <CardTitle>
              {isFr ? 'Vérifie ta boîte mail' : 'Check your inbox'}
            </CardTitle>
            <CardDescription>
              {isFr
                ? 'Ton compte est créé, il reste une étape.'
                : 'Your account is created — one step left.'}
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            <div className="rounded-lg border bg-muted/40 p-4 text-sm">
              <p>
                {isFr ? 'Un e-mail vient d\'être envoyé à ' : 'An email was just sent to '}
                <strong className="break-all">{registeredEmail}</strong>.
              </p>
              <p className="mt-2 text-muted-foreground">
                {isFr
                  ? 'Clique sur le lien qu\'il contient pour activer ton compte. Sans cette confirmation, la connexion ne fonctionnera pas.'
                  : 'Click the link inside to activate your account. Until you do, signing in won\'t work.'}
              </p>
            </div>

            {/* Le dossier indésirables est la première cause de « je n'ai rien
                reçu » : autant le dire tout de suite. */}
            <p className="text-xs text-muted-foreground">
              {isFr
                ? 'Rien reçu après quelques minutes ? Regarde dans les indésirables (spam), ou demande un nouvel envoi ci-dessous.'
                : 'Nothing after a few minutes? Check your spam folder, or ask for a new email below.'}
            </p>

            {/* Deuxième cause, invisible pour qui la subit : l'adresse a déjà un
                compte. Supabase répond alors comme si l'inscription avait
                réussi, sans envoyer d'e-mail — c'est délibéré de sa part, dire
                « cette adresse existe » permettrait de savoir qui est inscrit au
                studio. On ne l'affirme donc pas non plus ici : on décrit le cas
                et on donne la sortie, ce qui débloque sans rien divulguer. */}
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
              <p className="text-xs">
                {isFr
                  ? 'Tu as déjà un compte avec cette adresse ? Aucun e-mail n\'est envoyé dans ce cas. Connecte-toi directement, ou passe par « Mot de passe oublié ».'
                  : 'Already have an account with this address? No email is sent in that case. Sign in directly, or use “Forgot password”.'}
              </p>
              <button
                type="button"
                className="mt-1 text-xs text-primary underline"
                onClick={() => {
                  // Reporter l'adresse : la retaper est le genre de friction qui
                  // fait abandonner quelqu'un déjà bloqué depuis dix minutes.
                  setForgotEmail(registeredEmail)
                  setRegisteredEmail(null)
                  setTab('forgot')
                }}
              >
                {isFr ? 'Mot de passe oublié' : 'Forgot password'}
              </button>
            </div>

            <Button
              className="w-full"
              onClick={() => { setRegisteredEmail(null); setTab('login') }}
            >
              {isFr ? 'J\'ai confirmé, me connecter' : 'I confirmed, sign in'}
            </Button>

            <Button
              variant="outline"
              className="w-full"
              disabled={resending}
              onClick={() => handleResend(registeredEmail)}
            >
              <RefreshCw className={`h-4 w-4 ${resending ? 'animate-spin' : ''}`} />
              {isFr ? 'Renvoyer l\'e-mail' : 'Resend the email'}
            </Button>

            {/* Une faute de frappe dans l'adresse est l'autre cause de « je n'ai
                rien reçu », et le renvoi n'y peut rien : il repartirait à la
                même adresse fausse. */}
            <p className="text-xs text-muted-foreground text-center">
              {isFr
                ? 'Adresse erronée ? Recommence l\'inscription avec la bonne, ou contacte le studio.'
                : 'Wrong address? Sign up again with the correct one, or contact the studio.'}
            </p>
          </CardContent>
        </Card>
      </div>
    )
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

                {/* La connexion a été refusée faute de confirmation. C'est le
                    seul point de passage de celui qui a fermé l'écran
                    d'inscription : sans ce bouton, il reste bloqué dehors. */}
                {needsConfirmation && (
                  <div className="rounded-lg border bg-muted/40 p-3 space-y-2">
                    <p className="text-sm">
                      {isFr
                        ? 'Ton compte attend encore la confirmation de ton adresse e-mail.'
                        : 'Your account is still waiting for you to confirm your email address.'}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {isFr
                        ? 'Regarde dans les indésirables (spam) avant de demander un nouvel envoi.'
                        : 'Check your spam folder before asking for a new email.'}
                    </p>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="w-full"
                      disabled={resending || !loginEmail}
                      onClick={() => handleResend(loginEmail)}
                    >
                      <RefreshCw className={`h-4 w-4 ${resending ? 'animate-spin' : ''}`} />
                      {isFr ? 'Renvoyer l\'e-mail de confirmation' : 'Resend confirmation email'}
                    </Button>
                  </div>
                )}

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

              {/* Arrivé par un lien de parrainage : dire pourquoi le code est
                  déjà rempli, sinon il ressemble à une saisie inexpliquée — et
                  rappeler ce qu'il rapporte, c'est ce qui décide de finir le
                  formulaire. */}
              {regReferralCode && (
                <div className="mt-4 rounded-lg border border-primary/30 bg-primary/5 p-3">
                  <p className="text-sm font-medium">
                    {isFr ? 'Tu as été parrainé 🎉' : 'You were referred 🎉'}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {isFr
                      ? `Le code ${regReferralCode} est déjà renseigné. Vous recevrez chacun un bon d'achat dès ton premier paiement.`
                      : `Code ${regReferralCode} is already filled in. You'll each get a voucher after your first payment.`}
                  </p>
                </div>
              )}

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
                  {/* Progress bar */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-muted-foreground">{step2DoneCount}/{step2Checks.length}</span>
                      {step2Progress >= 100 && <span className="text-xs text-green-500 font-medium">{isFr ? 'Prêt !' : 'Ready!'}</span>}
                    </div>
                    <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                      <div className={`h-full rounded-full transition-all ${step2Progress >= 100 ? 'bg-green-500' : 'bg-primary'}`} style={{ width: `${step2Progress}%` }} />
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
                      <Label htmlFor="reg-cgv" className="text-sm font-normal leading-snug flex items-center gap-2 flex-wrap">
                        {/* Le document doit être atteignable AVANT d'accepter :
                            une case cochée pour des conditions illisibles
                            n'engage à rien. Nouvel onglet pour ne pas perdre
                            le formulaire en cours de saisie. */}
                        <a
                          href="/cgv"
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="underline underline-offset-2 hover:text-primary"
                        >
                          {t('auth.cgvAccept')}
                        </a> * <FieldCheck ok={cgvOk} />
                      </Label>
                    </div>
                    <div className="flex items-start gap-3">
                      <input type="checkbox" id="reg-rgpd" checked={regRgpdAccepted}
                        onChange={(e) => { setRegRgpdAccepted(e.target.checked); setRegErrors([]) }}
                        className="mt-1 h-4 w-4 rounded border-gray-300" />
                      <Label htmlFor="reg-rgpd" className="text-sm font-normal leading-snug flex items-center gap-2 flex-wrap">
                        {/* Même principe que les CGV : on ne consent pas à un
                            document qu'on ne peut pas lire avant de cocher. */}
                        <a
                          href="/confidentialite"
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="underline underline-offset-2 hover:text-primary"
                        >
                          {t('auth.rgpdAccept')}
                        </a> * <FieldCheck ok={rgpdOk} />
                      </Label>
                    </div>
                  </div>

                  {/* Annoncé AVANT de valider : le membre sait qu'une étape
                      l'attend, au lieu de la découvrir après coup. */}
                  <p className="text-xs text-muted-foreground text-center">
                    {isFr
                      ? 'Après validation, un e-mail te sera envoyé pour activer ton compte.'
                      : 'After submitting, you\'ll receive an email to activate your account.'}
                  </p>

                  <div className="flex gap-2">
                    <Button type="button" variant="outline" className="flex-1" onClick={() => setRegStep(1)}>
                      <ChevronLeft className="mr-2 h-4 w-4" /> {t('common.previous')}
                    </Button>
                    <Button type="button" className="flex-1" disabled={loading} onClick={() => handleRegister({ preventDefault: () => {} } as React.FormEvent)}>
                      {loading ? '...' : t('auth.registerButton')}
                    </Button>
                  </div>
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

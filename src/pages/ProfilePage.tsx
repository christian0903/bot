import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth, urlApplication } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { notifyMember } from '@/lib/notify-member'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { LoadingState } from '@/components/common/LoadingState'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import { Copy, Share2, ScanLine, FileText } from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'
import { urlImage } from '@/lib/url-image'

const STATUS_COLORS: Record<string, string> = {
  // Teintes lisibles sur fond clair ET sombre : les `bg-*-100` d'origine
  // viraient au blanc laiteux en mode sombre, et le texte foncé par-dessus
  // devenait illisible. Un fond translucide prend la couleur du thème.
  visitor: 'bg-slate-500/15 text-slate-700 dark:text-slate-300 border-slate-500/30',
  potential: 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30',
  active: 'bg-green-500/15 text-green-700 dark:text-green-400 border-green-500/30',
  // `former` partage la teinte d'`inactive` : les deux se lisent « Inactif ».
  // La base garde la distinction — quatre semaines d'écart, et `former` marque
  // aussi un compte supprimé — mais elle n'intéresse pas qui lit une liste.
  inactive: 'bg-orange-500/15 text-orange-700 dark:text-orange-400 border-orange-500/30',
  former: 'bg-orange-500/15 text-orange-700 dark:text-orange-400 border-orange-500/30',
}

export function ProfilePage() {
  const { t, i18n } = useTranslation()
  const isFr = i18n.language === 'fr'
  const navigate = useNavigate()
  const { user, profile, roles, refreshProfile } = useAuth()
  const isCoachOrAdmin = roles.includes('coach') || roles.includes('admin') || roles.includes('super_admin')
  const [loading, setLoading] = useState(false)
  const [deleteChecking, setDeleteChecking] = useState(false)
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  /** Ce que le membre perdra, annoncé avant qu'il confirme. */
  const [deleteWarning, setDeleteWarning] = useState('')
  const [form, setForm] = useState({
    display_name: '',
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    bio: '',
    date_of_birth: '',
    address: '',
    emergency_contact_name: '',
    emergency_contact_phone: '',
    objectives: '',
    fitness_level: '',
    medical_conditions: '',
    instagram_url: '',
    facebook_url: '',
    linkedin_url: '',
    coach_description: '',
    email_on_self_booking: true,
    visible_aux_autres: true,
  })

  useEffect(() => {
    if (profile) {
      setForm({
        display_name: profile.display_name ?? '',
        first_name: profile.first_name ?? '',
        last_name: profile.last_name ?? '',
        email: user?.email ?? profile.email ?? '',
        phone: profile.phone ?? '',
        bio: profile.bio ?? '',
        date_of_birth: profile.date_of_birth ?? '',
        address: profile.address ?? '',
        emergency_contact_name: profile.emergency_contact_name ?? '',
        emergency_contact_phone: profile.emergency_contact_phone ?? '',
        objectives: profile.objectives ?? '',
        fitness_level: profile.fitness_level ?? '',
        medical_conditions: profile.medical_conditions ?? '',
        instagram_url: profile.instagram_url ?? '',
        facebook_url: profile.facebook_url ?? '',
        linkedin_url: profile.linkedin_url ?? '',
        coach_description: profile.coach_description ?? '',
        email_on_self_booking: profile.email_on_self_booking ?? true,
        visible_aux_autres: profile.visible_aux_autres ?? true,
      })
    }
  }, [profile])


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) return
    setLoading(true)

    // Email change: only via auth, profiles.email is synced by a DB trigger
    // once the user confirms the new address by clicking the email link.
    // Requires Supabase "Secure email change" to be OFF, so only the new
    // address receives the actionable link. We send an informational
    // notice to the OLD address ourselves (via Resend) for security audit.
    const currentEmail = user.email ?? ''
    const newEmail = form.email.trim()
    let emailChangeRequested = false
    if (newEmail && newEmail !== currentEmail) {
      // Toujours viser l'URL de production : le lien doit fonctionner d'où
      // que la demande soit partie. La destination est un écran de
      // confirmation dédié, pour que le membre sache où il atterrit.
      const appUrl = urlApplication()
      const { error: authError } = await supabase.auth.updateUser(
        { email: newEmail },
        { emailRedirectTo: `${appUrl}/auth/email-changed` },
      )
      if (authError) {
        setLoading(false)
        toast.error(authError.message)
        return
      }
      emailChangeRequested = true
      // Point d'alerte contre le détournement de compte : si la demande ne
      // vient pas du membre, c'est là qu'il doit s'en apercevoir. L'avertir
      // uniquement à l'ancienne adresse ne suffit pas — il peut ne plus la
      // consulter, alors qu'il est connecté à l'application maintenant.
      if (user) {
        await notifyMember({
          userId: user.id,
          title: isFr ? 'Changement d\'adresse e-mail demandé' : 'Email change requested',
          message: isFr
            ? `Une demande de changement vers ${newEmail} a été enregistrée. Si ce n'est pas toi, contacte le studio immédiatement.`
            : `A change to ${newEmail} was requested. If this wasn't you, contact the studio immediately.`,
          type: 'warning',
          link: '/profile',
          email: {
            to: currentEmail,
            template: 'email_change_notice',
            vars: {
              user_name: form.display_name || profile?.display_name || '',
              new_email: newEmail,
            },
          },
        })
      }
    }

    const { error } = await supabase
      .from('profiles')
      .update({
        display_name: form.display_name,
        first_name: form.first_name || null,
        last_name: form.last_name || null,
        phone: form.phone || null,
        bio: form.bio || null,
        date_of_birth: form.date_of_birth || null,
        address: form.address || null,
        emergency_contact_name: form.emergency_contact_name || null,
        emergency_contact_phone: form.emergency_contact_phone || null,
        objectives: form.objectives || null,
        fitness_level: form.fitness_level || null,
        medical_conditions: form.medical_conditions || null,
        instagram_url: form.instagram_url || null,
        facebook_url: form.facebook_url || null,
        linkedin_url: form.linkedin_url || null,
        coach_description: form.coach_description || null,
        email_on_self_booking: form.email_on_self_booking,
        visible_aux_autres: form.visible_aux_autres,
      })
      .eq('id', user.id)

    setLoading(false)

    if (error) {
      toast.error(error.message)
    } else {
      toast.success(t('profile.updated'))
      if (emailChangeRequested) {
        toast.info(
          isFr
            ? `Un email de confirmation a été envoyé à ${newEmail}. Cliquez sur le lien pour valider. Un avertissement (sans action) a aussi été envoyé à ${currentEmail}.`
            : `A confirmation email was sent to ${newEmail}. Click the link to validate. A notice (no action needed) was also sent to ${currentEmail}.`,
          { duration: 10000 },
        )
      }
      refreshProfile()
    }
  }

  /**
   * Premier temps : demander au serveur si la fermeture est possible, et ce
   * qu'elle emporte.
   *
   * Un abonnement actif bloque — sans compte, le membre ne pourrait plus le
   * résilier et continuerait d'être prélevé. Les réservations à venir ne
   * bloquent pas, mais il doit savoir qu'elles seront annulées.
   */
  const startAccountDeletion = async () => {
    setDeleteChecking(true)
    const { data, error } = await supabase.rpc('can_delete_own_account')
    setDeleteChecking(false)

    if (error) { toast.error(error.message); return }

    const res = data as { ok: boolean; reason?: string; upcoming_bookings?: number } | null

    if (!res?.ok) {
      if (res?.reason === 'active_subscription') {
        toast.error(isFr
          ? 'Résilie d\'abord ton abonnement : sans compte, tu ne pourrais plus le faire.'
          : 'Cancel your subscription first — without an account you could no longer do it.')
        return
      }
      toast.error(isFr ? 'Suppression impossible' : 'Deletion not possible')
      return
    }

    const upcoming = res.upcoming_bookings ?? 0
    setDeleteWarning(
      isFr
        ? `Tes données personnelles seront effacées définitivement.${upcoming > 0 ? ` ${upcoming} réservation${upcoming > 1 ? 's' : ''} à venir ${upcoming > 1 ? 'seront annulées' : 'sera annulée'}.` : ''} Tu seras déconnecté.`
        : `Your personal data will be permanently erased.${upcoming > 0 ? ` ${upcoming} upcoming booking${upcoming > 1 ? 's' : ''} will be cancelled.` : ''} You will be signed out.`,
    )
    setDeleteConfirmOpen(true)
  }

  const confirmAccountDeletion = async () => {
    const { data, error } = await supabase.rpc('delete_own_account')
    if (error) { toast.error(error.message); return }

    const res = data as { ok: boolean; reason?: string } | null
    if (!res?.ok) {
      // Le refus arrive DANS le retour, pas en erreur SQL : sans ce contrôle
      // on déconnecterait un membre dont le compte existe toujours.
      toast.error(isFr ? 'Suppression impossible' : 'Deletion failed')
      return
    }

    toast.success(isFr ? 'Ton compte a été supprimé.' : 'Your account has been deleted.')
    await supabase.auth.signOut()
    navigate('/')
  }

  const copyReferralCode = () => {
    if (profile?.referral_code) {
      navigator.clipboard.writeText(profile.referral_code)
      toast.success(t('profile.referralCopied'))
    }
  }

  const shareReferralCode = async () => {
    if (!profile?.referral_code) return
    const shareData = {
      title: t('app.name'),
      text: t('profile.referralShareText', { code: profile.referral_code }),
      url: `${window.location.origin}/auth?ref=${profile.referral_code}`,
    }
    try {
      await navigator.share(shareData)
    } catch {
      copyReferralCode()
    }
  }

  if (!profile) return <LoadingState />

  // Pending email change (Supabase exposes user.new_email until both confirmations done)
  const pendingNewEmail = (user as { new_email?: string } | null)?.new_email

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {pendingNewEmail && (
        <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
          <p className="font-semibold text-amber-700 dark:text-amber-300">
            {isFr ? '⏳ Changement d\'email en attente' : '⏳ Email change pending'}
          </p>
          <p className="text-amber-700 dark:text-amber-300 mt-1">
            {isFr
              ? `Cliquez sur le lien envoyé à ${pendingNewEmail} pour valider le changement.`
              : `Click the link sent to ${pendingNewEmail} to validate the change.`}
          </p>
        </div>
      )}
      {/* Identity header */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-3">
            <Avatar className="h-16 w-16">
              <AvatarImage src={urlImage(profile.avatar_url)} />
              <AvatarFallback className="text-xl">
                {profile.display_name?.charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <h2 className="text-lg font-semibold truncate">{profile.display_name}</h2>
              {(profile.email || user?.email) && (
                <p className="text-sm text-muted-foreground truncate">
                  {profile.email || user?.email}
                </p>
              )}
              <Badge className={`mt-1 ${STATUS_COLORS[profile.member_status] ?? STATUS_COLORS.visitor}`}>
                {t(`profile.status.${profile.member_status}`)}
              </Badge>
            </div>
          </div>

          {/* Invoice request link */}
          <div className="mt-4">
            <Button variant="outline" className="w-full" onClick={() => navigate('/invoice-request')}>
              <FileText className="h-4 w-4 mr-2" />
              {t('profile.requestInvoice')}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Main profile form */}
      <Card>
        <CardHeader>
          <CardTitle>{t('profile.personalInfo')}</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Identity */}
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>{t('auth.displayName')}</Label>
                <Input
                  value={form.display_name}
                  onChange={(e) => setForm({ ...form, display_name: e.target.value })}
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{t('auth.firstName')}</Label>
                  <Input
                    value={form.first_name}
                    onChange={(e) => setForm({ ...form, first_name: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t('auth.lastName')}</Label>
                  <Input
                    value={form.last_name}
                    onChange={(e) => setForm({ ...form, last_name: e.target.value })}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>{t('auth.email')}</Label>
                <Input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                />
                {form.email && form.email !== (user?.email ?? '') && (
                  <p className="text-xs text-muted-foreground">
                    {isFr
                      ? 'Un email de confirmation sera envoyé à la nouvelle adresse.'
                      : 'A confirmation email will be sent to the new address.'}
                  </p>
                )}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{t('profile.phone')}</Label>
                  <Input
                    type="tel"
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t('auth.dateOfBirth')}</Label>
                  <Input
                    type="date"
                    value={form.date_of_birth}
                    onChange={(e) => setForm({ ...form, date_of_birth: e.target.value })}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>{t('auth.address')}</Label>
                <Input
                  value={form.address}
                  onChange={(e) => setForm({ ...form, address: e.target.value })}
                />
              </div>
            </div>

            {/* Emergency contact */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                {t('profile.emergencyContact')}
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{t('profile.emergencyName')}</Label>
                  <Input
                    value={form.emergency_contact_name}
                    onChange={(e) => setForm({ ...form, emergency_contact_name: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t('profile.emergencyPhone')}</Label>
                  <Input
                    type="tel"
                    value={form.emergency_contact_phone}
                    onChange={(e) => setForm({ ...form, emergency_contact_phone: e.target.value })}
                  />
                </div>
              </div>
            </div>

            {/* Fitness info */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                {t('profile.fitnessInfo')}
              </h3>
              <div className="space-y-2">
                <Label>{t('profile.objectives')}</Label>
                <Textarea
                  value={form.objectives}
                  onChange={(e) => setForm({ ...form, objectives: e.target.value })}
                  rows={2}
                  placeholder={t('profile.objectivesPlaceholder')}
                />
              </div>
              <div className="space-y-2">
                <Label>{t('profile.fitnessLevel')}</Label>
                <Select
                  value={form.fitness_level}
                  onValueChange={(v) => setForm({ ...form, fitness_level: v ?? '' })}
                >
                  <SelectTrigger>
                    <span>{form.fitness_level ? t(`profile.levels.${form.fitness_level}`) : t('profile.fitnessLevel')}</span>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="beginner">{t('profile.levels.beginner')}</SelectItem>
                    <SelectItem value="intermediate">{t('profile.levels.intermediate')}</SelectItem>
                    <SelectItem value="advanced">{t('profile.levels.advanced')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>{t('profile.medicalConditions')}</Label>
                <Textarea
                  value={form.medical_conditions}
                  onChange={(e) => setForm({ ...form, medical_conditions: e.target.value })}
                  rows={2}
                  placeholder={t('profile.medicalPlaceholder')}
                />
              </div>
            </div>

            {/* Email notifications */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                {isFr ? 'Notifications email' : 'Email notifications'}
              </h3>
              <div className="flex items-start gap-3 p-3 rounded-lg border">
                <Switch
                  checked={form.email_on_self_booking}
                  onCheckedChange={(checked) => setForm({ ...form, email_on_self_booking: checked })}
                />
                <div className="flex-1">
                  <p className="text-sm font-medium">
                    {isFr ? 'Confirmation par email' : 'Email confirmations'}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {isFr
                      ? 'Recevoir un email à chaque réservation ou annulation que vous effectuez vous-même. Les inscriptions/annulations par un coach ou admin, et les modifications de cours, sont toujours envoyées.'
                      : 'Receive an email for each booking or cancellation you make yourself. Staff-initiated actions and class changes are always sent.'}
                  </p>
                </div>
              </div>
            </div>

            {/* Visibilite aupres des autres membres */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                {isFr ? 'Visibilité' : 'Visibility'}
              </h3>
              <div className="flex items-start gap-3 p-3 rounded-lg border">
                <Switch
                  checked={form.visible_aux_autres}
                  onCheckedChange={(checked) => setForm({ ...form, visible_aux_autres: checked })}
                />
                <div className="flex-1">
                  <p className="text-sm font-medium">
                    {isFr ? 'Apparaître dans la liste des inscrits' : 'Appear in the participant list'}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {isFr
                      ? 'Les autres membres voient votre prénom et votre photo parmi les inscrits d\'un cours. Sans cela, vous réservez normalement, mais personne ne vous y voit.'
                      : 'Other members see your first name and photo among a class\'s participants. Without it, you book as usual, but nobody sees you there.'}
                  </p>
                </div>
              </div>
            </div>

            {/* Bio */}
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>{t('profile.bio')}</Label>
                <Textarea
                  value={form.bio}
                  onChange={(e) => setForm({ ...form, bio: e.target.value })}
                  rows={3}
                />
              </div>
            </div>

            {/* Coach section */}
            {isCoachOrAdmin && (
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                  {isFr ? 'Profil coach' : 'Coach profile'}
                </h3>
                <div className="space-y-2">
                  <Label>{isFr ? 'Description (markdown)' : 'Description (markdown)'}</Label>
                  <Textarea
                    value={form.coach_description}
                    onChange={(e) => setForm({ ...form, coach_description: e.target.value })}
                    rows={5}
                    placeholder={isFr ? 'Spécialités, parcours, philosophie...' : 'Specialties, background, philosophy...'}
                  />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>Instagram</Label>
                    <Input
                      value={form.instagram_url}
                      onChange={(e) => setForm({ ...form, instagram_url: e.target.value })}
                      placeholder="https://instagram.com/..."
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Facebook</Label>
                    <Input
                      value={form.facebook_url}
                      onChange={(e) => setForm({ ...form, facebook_url: e.target.value })}
                      placeholder="https://facebook.com/..."
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>LinkedIn</Label>
                    <Input
                      value={form.linkedin_url}
                      onChange={(e) => setForm({ ...form, linkedin_url: e.target.value })}
                      placeholder="https://linkedin.com/in/..."
                    />
                  </div>
                </div>
              </div>
            )}

            <div className="flex gap-2 justify-end">
              <Button type="submit" disabled={loading}>
                {t('profile.save')}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* QR Code + Referral code at bottom */}
      <Card>
        <CardContent className="pt-6 space-y-4">
          {/* QR Code for check-in */}
          <div className="rounded-lg border p-4">
            <p className="text-sm font-medium mb-3 flex items-center gap-2">
              <ScanLine className="h-4 w-4" />
              {t('profile.qrTitle')}
            </p>
            <div className="flex justify-center">
              <div className="bg-white p-3 rounded-lg">
                <QRCodeSVG value={profile.id} size={160} />
              </div>
            </div>
            <p className="text-xs text-muted-foreground text-center mt-2">
              {t('profile.qrDesc')}
            </p>
          </div>

          {/* Referral code */}
          {profile.referral_code && (
            <div className="rounded-lg border p-4">
              <p className="text-sm font-medium mb-2">{t('profile.referralTitle')}</p>
              <div className="flex items-center gap-2">
                <code className="flex-1 rounded bg-muted px-3 py-2 text-sm font-mono">
                  {profile.referral_code}
                </code>
                <Button type="button" variant="outline" size="icon" onClick={copyReferralCode}>
                  <Copy className="h-4 w-4" />
                </Button>
                <Button type="button" variant="outline" size="icon" onClick={shareReferralCode}>
                  <Share2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Fermeture du compte — exigée par Apple depuis 2022 pour toute
          application permettant d'en créer un, et par le RGPD. Isolée en bas
          de page, en rouge : ce n'est pas une action qu'on déclenche par
          mégarde. */}
      <Card className="border-destructive/30">
        <CardHeader>
          <CardTitle className="text-base text-destructive">
            {isFr ? 'Supprimer mon compte' : 'Delete my account'}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            {isFr
              ? 'Tes données personnelles seront effacées et tes réservations à venir annulées. Cette action est définitive.'
              : 'Your personal data will be erased and upcoming bookings cancelled. This cannot be undone.'}
          </p>
          {/* Dit franchement ce qui est conservé, plutôt que de laisser croire
              à un effacement total : la loi comptable l'impose. */}
          <p className="text-xs text-muted-foreground">
            {isFr
              ? 'Les justificatifs de paiement sont conservés sans lien avec ton identité, comme la loi comptable l\'exige.'
              : 'Payment records are kept without any link to your identity, as accounting law requires.'}
          </p>
          <Button
            type="button"
            variant="destructive"
            size="sm"
            disabled={deleteChecking}
            onClick={startAccountDeletion}
          >
            {deleteChecking
              ? '...'
              : (isFr ? 'Supprimer mon compte' : 'Delete my account')}
          </Button>
        </CardContent>
      </Card>

      <ConfirmDialog
        open={deleteConfirmOpen}
        onOpenChange={setDeleteConfirmOpen}
        title={isFr ? 'Supprimer définitivement ?' : 'Delete permanently?'}
        description={deleteWarning}
        variant="destructive"
        onConfirm={confirmAccountDeletion}
      />
    </div>
  )
}

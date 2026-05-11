import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
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
import { Copy, Share2, ScanLine, FileText } from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'

const STATUS_COLORS: Record<string, string> = {
  visitor: 'bg-gray-100 text-gray-800',
  potential: 'bg-yellow-100 text-yellow-800',
  active: 'bg-green-100 text-green-800',
  inactive: 'bg-orange-100 text-orange-800',
  former: 'bg-red-100 text-red-800',
}

export function ProfilePage() {
  const { t, i18n } = useTranslation()
  const isFr = i18n.language === 'fr'
  const navigate = useNavigate()
  const { user, profile, roles, refreshProfile } = useAuth()
  const isCoachOrAdmin = roles.includes('coach') || roles.includes('admin') || roles.includes('super_admin')
  const [loading, setLoading] = useState(false)
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
      })
    }
  }, [profile])


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) return
    setLoading(true)

    // Email change: only via auth, profiles.email is synced by a DB trigger
    // once the user confirms the new address by clicking the email link.
    const currentEmail = user.email ?? ''
    const newEmail = form.email.trim()
    let emailChangeRequested = false
    if (newEmail && newEmail !== currentEmail) {
      const { error: authError } = await supabase.auth.updateUser({ email: newEmail })
      if (authError) {
        setLoading(false)
        toast.error(authError.message)
        return
      }
      emailChangeRequested = true
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
            ? `Un email de confirmation a été envoyé à ${newEmail}. Cliquez sur le lien pour valider le changement.`
            : `A confirmation email was sent to ${newEmail}. Click the link to validate the change.`,
          { duration: 8000 },
        )
      }
      refreshProfile()
    }
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

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Identity header */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-3">
            <Avatar className="h-16 w-16">
              <AvatarImage src={profile.avatar_url ?? undefined} />
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
    </div>
  )
}

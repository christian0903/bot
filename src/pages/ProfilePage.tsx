import { useState, useEffect } from 'react'
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
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { LoadingState } from '@/components/common/LoadingState'
import { Copy, Share2 } from 'lucide-react'
import type { MemberCategory } from '@/types'

const STATUS_COLORS: Record<string, string> = {
  visitor: 'bg-gray-100 text-gray-800',
  potential: 'bg-yellow-100 text-yellow-800',
  active: 'bg-green-100 text-green-800',
  inactive: 'bg-orange-100 text-orange-800',
  former: 'bg-red-100 text-red-800',
}

export function ProfilePage() {
  const { t } = useTranslation()
  const { user, profile, refreshProfile } = useAuth()
  const [loading, setLoading] = useState(false)
  const [categories, setCategories] = useState<MemberCategory[]>([])
  const [form, setForm] = useState({
    display_name: '',
    first_name: '',
    last_name: '',
    phone: '',
    bio: '',
    date_of_birth: '',
    address: '',
    emergency_contact_name: '',
    emergency_contact_phone: '',
    objectives: '',
    fitness_level: '',
    medical_conditions: '',
    member_category_id: '',
  })

  useEffect(() => {
    if (profile) {
      setForm({
        display_name: profile.display_name ?? '',
        first_name: profile.first_name ?? '',
        last_name: profile.last_name ?? '',
        phone: profile.phone ?? '',
        bio: profile.bio ?? '',
        date_of_birth: profile.date_of_birth ?? '',
        address: profile.address ?? '',
        emergency_contact_name: profile.emergency_contact_name ?? '',
        emergency_contact_phone: profile.emergency_contact_phone ?? '',
        objectives: profile.objectives ?? '',
        fitness_level: profile.fitness_level ?? '',
        medical_conditions: profile.medical_conditions ?? '',
        member_category_id: profile.member_category_id ?? '',
      })
    }
  }, [profile])

  useEffect(() => {
    supabase
      .from('member_categories')
      .select('*')
      .order('name')
      .then(({ data }) => setCategories(data ?? []))
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) return
    setLoading(true)

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
        member_category_id: form.member_category_id || null,
      })
      .eq('id', user.id)

    setLoading(false)

    if (error) {
      toast.error(error.message)
    } else {
      toast.success(t('profile.updated'))
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
      {/* Status + Referral Card */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Avatar className="h-16 w-16">
                <AvatarImage src={profile.avatar_url ?? undefined} />
                <AvatarFallback className="text-xl">
                  {profile.display_name?.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div>
                <h2 className="text-lg font-semibold">{profile.display_name}</h2>
                <Badge className={STATUS_COLORS[profile.member_status] ?? STATUS_COLORS.visitor}>
                  {t(`profile.status.${profile.member_status}`)}
                </Badge>
              </div>
            </div>
          </div>

          {/* Referral code */}
          {profile.referral_code && (
            <div className="mt-4 rounded-lg border p-4">
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

            {/* Category + Bio */}
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>{t('profile.category')}</Label>
                <Select
                  value={form.member_category_id}
                  onValueChange={(v) => setForm({ ...form, member_category_id: v ?? '' })}
                >
                  <SelectTrigger>
                    <span>{categories.find(c => c.id === form.member_category_id)?.name || t('profile.category')}</span>
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((cat) => (
                      <SelectItem key={cat.id} value={cat.id}>
                        {cat.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>{t('profile.bio')}</Label>
                <Textarea
                  value={form.bio}
                  onChange={(e) => setForm({ ...form, bio: e.target.value })}
                  rows={3}
                />
              </div>
            </div>

            <div className="flex gap-2 justify-end">
              <Button type="submit" disabled={loading}>
                {t('profile.save')}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}

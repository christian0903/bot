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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'
import { LoadingState } from '@/components/common/LoadingState'
import type { MemberCategory } from '@/types'

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

  if (!profile) return <LoadingState />

  return (
    <div className="max-w-2xl mx-auto">
      <Card>
        <CardHeader>
          <CardTitle>{t('profile.title')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex justify-center mb-6">
            <Avatar className="h-20 w-20">
              <AvatarImage src={profile.avatar_url ?? undefined} />
              <AvatarFallback className="text-2xl">
                {profile.display_name?.charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
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
              <Label>{t('profile.phone')}</Label>
              <Input
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>{t('profile.category')}</Label>
              <Select
                value={form.member_category_id}
                onValueChange={(v) => setForm({ ...form, member_category_id: v ?? '' })}
              >
                <SelectTrigger>
                  <SelectValue />
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

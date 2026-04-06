import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { supabase } from '@/lib/supabase'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { LoadingState } from '@/components/common/LoadingState'
import type { Profile } from '@/types'

export function PublicProfilePage() {
  const { id } = useParams<{ id: string }>()
  const { t } = useTranslation()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!id) return
    supabase
      .from('profiles')
      .select('*')
      .eq('id', id)
      .single()
      .then(({ data }) => {
        setProfile(data)
        setLoading(false)
      })
  }, [id])

  if (loading) return <LoadingState />
  if (!profile) return <p className="text-center text-muted-foreground">{t('common.noResults')}</p>

  return (
    <div className="max-w-lg mx-auto">
      <Card>
        <CardHeader className="text-center">
          <Avatar className="h-20 w-20 mx-auto mb-4">
            <AvatarImage src={profile.avatar_url ?? undefined} />
            <AvatarFallback className="text-2xl">
              {profile.display_name?.charAt(0).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <CardTitle>{profile.display_name}</CardTitle>
        </CardHeader>
        <CardContent className="text-center">
          {profile.bio && <p className="text-muted-foreground">{profile.bio}</p>}
        </CardContent>
      </Card>
    </div>
  )
}

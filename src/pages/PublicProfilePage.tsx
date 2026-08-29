import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { supabase } from '@/lib/supabase'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { LoadingState } from '@/components/common/LoadingState'
import { urlImage } from '@/lib/url-image'

/**
 * Ce que cette page montre, et donc tout ce qu'elle demande.
 *
 * Le type `Profile` complet declarait trente colonnes ; s'en servir ici
 * invitait au `select('*')` qui rapatriait telephone, adresse et donnees
 * medicales pour afficher un nom et une bio.
 */
interface ProfilPublic {
  id: string
  display_name: string | null
  avatar_url: string | null
  bio: string | null
}

export function PublicProfilePage() {
  const { id } = useParams<{ id: string }>()
  const { t } = useTranslation()
  const [profile, setProfile] = useState<ProfilPublic | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!id) return
    // Les trois champs affiches, et rien d'autre. `select('*')` rapatriait le
    // telephone, l'adresse, la date de naissance, le contact d'urgence et les
    // `medical_conditions` — des donnees de sante au sens de l'article 9 du
    // RGPD — pour n'en montrer aucun. Ce qui ne s'affiche pas n'a pas a
    // transiter : c'est vrai meme quand la policy autorise la lecture.
    supabase
      .from('profiles')
      .select('id, display_name, avatar_url, bio')
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
            <AvatarImage src={urlImage(profile.avatar_url)} />
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

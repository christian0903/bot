import { useEffect, useState, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import type { Profile } from '@/types'
import { LoadingState } from '@/components/common/LoadingState'
import { EmptyState } from '@/components/common/EmptyState'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { urlImage } from '@/lib/url-image'
import { Users, Search, ChevronRight, Activity } from 'lucide-react'

/**
 * La liste des membres, pour un coach.
 *
 * Elle complète l'accès par la fiche de cours : celui-ci suffit pour le membre
 * qu'on a devant soi, pas pour retrouver quelqu'un qui n'est pas au programme
 * du jour.
 *
 * Volontairement pauvre — nom, photo, et le nombre de performances notées. Un
 * coach n'a pas à voir ici les coordonnées ni les données de santé : elles
 * relèvent de la fiche membre côté administration.
 */
export function CoachMembersPage() {
  const { i18n } = useTranslation()
  const isFr = i18n.language === 'fr'
  const navigate = useNavigate()

  const [membres, setMembres] = useState<Profile[]>([])
  const [comptes, setComptes] = useState<Map<string, number>>(new Map())
  const [loading, setLoading] = useState(true)
  const [recherche, setRecherche] = useState('')

  useEffect(() => {
    const charger = async () => {
      const [pRes, perfRes] = await Promise.all([
        supabase
          .from('profiles')
          .select('id, display_name, avatar_url, member_status')
          .is('deleted_at', null)
          .order('display_name'),
        supabase.from('performances').select('user_id'),
      ])

      const parMembre = new Map<string, number>()
      for (const p of (perfRes.data ?? []) as { user_id: string }[]) {
        parMembre.set(p.user_id, (parMembre.get(p.user_id) ?? 0) + 1)
      }
      setComptes(parMembre)
      setMembres((pRes.data as Profile[]) ?? [])
      setLoading(false)
    }
    charger()
  }, [])

  const filtres = useMemo(() => {
    const q = recherche.trim().toLowerCase()
    if (!q) return membres
    return membres.filter(m => m.display_name?.toLowerCase().includes(q))
  }, [membres, recherche])

  if (loading) return <LoadingState />

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <h1 className="text-2xl font-bold flex items-center gap-2">
        <Users className="h-6 w-6 shrink-0" />
        {isFr ? 'Membres' : 'Members'}
      </h1>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          className="pl-9"
          placeholder={isFr ? 'Rechercher un membre…' : 'Search a member…'}
          value={recherche}
          onChange={e => setRecherche(e.target.value)}
        />
      </div>

      {filtres.length === 0 ? (
        <EmptyState icon={Users} message={isFr ? 'Aucun membre' : 'No member'} />
      ) : (
        <Card>
          <CardContent className="p-0 divide-y">
            {filtres.map(m => {
              const n = comptes.get(m.id) ?? 0
              return (
                <button
                  key={m.id}
                  onClick={() => navigate(`/coach/member/${m.id}/performances`)}
                  className="w-full flex items-center gap-3 p-3 text-left hover:bg-accent/50 transition-colors"
                >
                  <Avatar className="h-9 w-9 shrink-0">
                    <AvatarImage src={urlImage(m.avatar_url)} />
                    <AvatarFallback>{m.display_name?.[0]?.toUpperCase() ?? '?'}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium truncate">{m.display_name}</p>
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <Activity className="h-3 w-3" />
                      {n === 0
                        ? (isFr ? 'aucune performance' : 'no performance')
                        : `${n} ${isFr ? 'performance(s)' : 'performance(s)'}`}
                    </p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                </button>
              )
            })}
          </CardContent>
        </Card>
      )}
    </div>
  )
}

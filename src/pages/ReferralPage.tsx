import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { formatEuros } from '@/lib/utils'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { EmptyState } from '@/components/common/EmptyState'
import { LoadingState } from '@/components/common/LoadingState'
import { Copy, Share2, Users, Gift, Clock, Check } from 'lucide-react'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { fr, enUS } from 'date-fns/locale'
import type { Referral, ReferralReward } from '@/types'

export function ReferralPage() {
  const { i18n } = useTranslation()
  const isFr = i18n.language === 'fr'
  const locale = isFr ? fr : enUS
  const { user, profile } = useAuth()

  const [referrals, setReferrals] = useState<Referral[]>([])
  const [rewards, setRewards] = useState<ReferralReward[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return

    Promise.all([
      supabase
        .from('referrals')
        .select('*')
        .eq('referrer_id', user.id)
        .order('created_at', { ascending: false }),
      supabase
        .from('referral_rewards')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false }),
    ]).then(async ([referralsRes, rewardsRes]) => {
      const refs = (referralsRes.data as Referral[]) ?? []

      // Fetch referee profiles
      if (refs.length > 0) {
        const refereeIds = refs.map(r => r.referee_id)
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, display_name, email')
          .in('id', refereeIds)
        const profileMap = new Map((profiles ?? []).map(p => [p.id, p]))
        for (const r of refs) {
          r.referee = profileMap.get(r.referee_id) as Referral['referee']
        }
      }

      setReferrals(refs)
      setRewards((rewardsRes.data as ReferralReward[]) ?? [])
      setLoading(false)
    })
  }, [user])

  const copyCode = () => {
    if (profile?.referral_code) {
      navigator.clipboard.writeText(profile.referral_code)
      toast.success(isFr ? 'Code copié !' : 'Code copied!')
    }
  }

  const shareCode = async () => {
    if (!profile?.referral_code) return
    try {
      await navigator.share({
        title: 'Back on Track',
        text: isFr
          ? `Rejoins Back on Track avec mon code ${profile.referral_code} et obtiens 30€ de réduction !`
          : `Join Back on Track with my code ${profile.referral_code} and get €30 off!`,
        url: `${window.location.origin}/auth?ref=${profile.referral_code}`,
      })
    } catch {
      copyCode()
    }
  }

  if (loading) return <LoadingState />

  const activeRewards = rewards.filter(r => !r.is_used && (!r.expires_at || new Date(r.expires_at) > new Date()))
  const totalEarned = rewards.reduce((sum, r) => sum + r.amount_cents, 0)
  const qualifiedCount = referrals.filter(r => r.status !== 'pending').length

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header + code */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Gift className="h-5 w-5 text-primary" />
            {isFr ? 'Parrainage' : 'Referral Program'}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            {isFr
              ? 'Parraine tes amis et gagnez chacun 30€ de réduction sur votre prochain achat de pack !'
              : 'Refer your friends and each of you gets €30 off your next pack purchase!'}
          </p>

          {/* Referral code */}
          {profile?.referral_code && (
            <div className="rounded-lg border p-4 bg-muted/30">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                {isFr ? 'Ton code de parrainage' : 'Your referral code'}
              </p>
              <div className="flex items-center gap-2">
                <code className="flex-1 rounded bg-background px-4 py-3 text-lg font-mono font-bold text-center">
                  {profile.referral_code}
                </code>
                <Button variant="outline" size="icon" onClick={copyCode}>
                  <Copy className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="icon" onClick={shareCode}>
                  <Share2 className="h-4 w-4" />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground mt-2 text-center">
                {isFr
                  ? 'Ton ami entre ce code à l\'inscription'
                  : 'Your friend enters this code when signing up'}
              </p>
            </div>
          )}

          {/* Stats */}
          <div className="grid grid-cols-3 gap-3">
            <div className="text-center p-3 rounded-lg bg-muted/30">
              <p className="text-2xl font-bold">{referrals.length}</p>
              <p className="text-xs text-muted-foreground">{isFr ? 'Filleuls' : 'Referees'}</p>
            </div>
            <div className="text-center p-3 rounded-lg bg-muted/30">
              <p className="text-2xl font-bold">{qualifiedCount}</p>
              <p className="text-xs text-muted-foreground">{isFr ? 'Qualifiés' : 'Qualified'}</p>
            </div>
            <div className="text-center p-3 rounded-lg bg-muted/30">
              <p className="text-2xl font-bold">{formatEuros(totalEarned, 0)}</p>
              <p className="text-xs text-muted-foreground">{isFr ? 'Gagné' : 'Earned'}</p>
            </div>
          </div>

          {/* How it works */}
          <div className="rounded-lg border p-4 space-y-2">
            <p className="text-sm font-semibold">{isFr ? 'Comment ça marche ?' : 'How does it work?'}</p>
            <ol className="text-sm text-muted-foreground space-y-1.5 list-decimal list-inside">
              <li>{isFr ? 'Partage ton code à un ami' : 'Share your code with a friend'}</li>
              <li>{isFr ? 'Il s\'inscrit avec ton code' : 'They sign up with your code'}</li>
              <li>{isFr ? 'Il paie ses frais d\'inscription + achète un pack de 10 séances minimum' : 'They pay registration fee + buy a pack of 10+ sessions'}</li>
              <li>{isFr ? 'Vous recevez chacun 30€ de réduction !' : 'You each get €30 off!'}</li>
            </ol>
          </div>
        </CardContent>
      </Card>

      {/* Active rewards */}
      {activeRewards.length > 0 && (
        <Card className="border-green-500/30 bg-green-50 dark:bg-green-950/20">
          <CardContent className="pt-6">
            <p className="text-sm font-semibold text-green-700 dark:text-green-300 mb-3 flex items-center gap-2">
              <Gift className="h-4 w-4" />
              {isFr ? 'Récompenses disponibles' : 'Available rewards'}
            </p>
            {activeRewards.map(reward => (
              <div key={reward.id} className="flex items-center justify-between p-3 rounded-lg border border-green-200 dark:border-green-800 bg-background mb-2">
                <div>
                  <p className="font-bold text-green-700 dark:text-green-300">{formatEuros(reward.amount_cents, 0)} {isFr ? 'de réduction' : 'off'}</p>
                  {reward.expires_at && (
                    <p className="text-xs text-muted-foreground">
                      {isFr ? 'Expire le' : 'Expires'} {format(new Date(reward.expires_at), 'dd/MM/yyyy', { locale })}
                    </p>
                  )}
                </div>
                <Badge className="bg-green-600">{isFr ? 'Actif' : 'Active'}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Referrals list */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="h-4 w-4 text-primary" />
            {isFr ? 'Mes filleuls' : 'My referees'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {referrals.length === 0 ? (
            <EmptyState
              icon={Users}
              message={isFr ? 'Aucun filleul pour le moment' : 'No referees yet'}
            />
          ) : (
            <div className="space-y-2">
              {referrals.map(ref => (
                <div key={ref.id} className="flex items-center justify-between p-3 rounded-lg border">
                  <div>
                    <p className="font-medium text-sm">{ref.referee?.display_name ?? '...'}</p>
                    <p className="text-xs text-muted-foreground">
                      {isFr ? 'Inscrit le' : 'Joined'} {format(new Date(ref.created_at), 'dd/MM/yyyy', { locale })}
                    </p>
                  </div>
                  <Badge
                    variant={ref.status === 'pending' ? 'secondary' : 'default'}
                    className={ref.status !== 'pending' ? 'bg-green-600' : ''}
                  >
                    {ref.status === 'pending' ? (
                      <><Clock className="h-3 w-3 mr-1" /> {isFr ? 'En attente' : 'Pending'}</>
                    ) : ref.status === 'qualified' ? (
                      <><Check className="h-3 w-3 mr-1" /> {isFr ? 'Qualifié' : 'Qualified'}</>
                    ) : (
                      <><Gift className="h-3 w-3 mr-1" /> {isFr ? 'Récompensé' : 'Rewarded'}</>
                    )}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

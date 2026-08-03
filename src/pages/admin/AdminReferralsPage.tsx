import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { formatEuros } from '@/lib/utils'
import { supabase } from '@/lib/supabase'
import { Badge } from '@/components/ui/badge'
import { EmptyState } from '@/components/common/EmptyState'
import { LoadingState } from '@/components/common/LoadingState'
import { Gift, Clock, Check, Users } from 'lucide-react'
import { format } from 'date-fns'
import { fr, enUS } from 'date-fns/locale'
import type { Referral } from '@/types'

export function AdminReferralsPage() {
  const { i18n } = useTranslation()
  const isFr = i18n.language === 'fr'
  const locale = isFr ? fr : enUS
  const [referrals, setReferrals] = useState<Referral[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase
        .from('referrals')
        .select('*')
        .order('created_at', { ascending: false })

      const refs = (data as Referral[]) ?? []

      // Fetch profiles for referrers and referees
      if (refs.length > 0) {
        const allIds = [...new Set([...refs.map(r => r.referrer_id), ...refs.map(r => r.referee_id)])]
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, display_name, email')
          .in('id', allIds)
        const profileMap = new Map((profiles ?? []).map(p => [p.id, p]))
        for (const r of refs) {
          r.referrer = profileMap.get(r.referrer_id) as Referral['referrer']
          r.referee = profileMap.get(r.referee_id) as Referral['referee']
        }
      }

      setReferrals(refs)
      setLoading(false)
    }
    fetch()
  }, [])

  if (loading) return <LoadingState />

  const pendingCount = referrals.filter(r => r.status === 'pending').length
  const qualifiedCount = referrals.filter(r => r.status !== 'pending').length
  const totalRewardCents = referrals
    .filter(r => r.status !== 'pending')
    .reduce((sum, r) => sum + r.referrer_reward_cents + r.referee_reward_cents, 0)

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold flex items-center gap-2">
        <Gift className="h-6 w-6 text-primary" />
        {isFr ? 'Parrainages' : 'Referrals'}
      </h1>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="p-4 rounded-lg border text-center">
          <p className="text-2xl font-bold">{referrals.length}</p>
          <p className="text-xs text-muted-foreground">{isFr ? 'Total' : 'Total'}</p>
        </div>
        <div className="p-4 rounded-lg border text-center">
          <p className="text-2xl font-bold text-amber-600">{pendingCount}</p>
          <p className="text-xs text-muted-foreground">{isFr ? 'En attente' : 'Pending'}</p>
        </div>
        <div className="p-4 rounded-lg border text-center">
          <p className="text-2xl font-bold text-green-600">{qualifiedCount}</p>
          <p className="text-xs text-muted-foreground">{isFr ? 'Qualifiés' : 'Qualified'} ({formatEuros(totalRewardCents, 0)})</p>
        </div>
      </div>

      {/* List */}
      {referrals.length === 0 ? (
        <EmptyState icon={Users} message={isFr ? 'Aucun parrainage' : 'No referrals'} />
      ) : (
        <div className="border rounded-lg divide-y">
          {referrals.map(ref => (
            <div key={ref.id} className="flex items-center justify-between p-4">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-medium text-sm">{ref.referrer?.display_name}</span>
                  <span className="text-xs text-muted-foreground">→</span>
                  <span className="font-medium text-sm">{ref.referee?.display_name}</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  {isFr ? 'Code' : 'Code'}: {ref.referral_code} · {format(new Date(ref.created_at), 'dd/MM/yyyy', { locale })}
                  {ref.qualified_at && ` · ${isFr ? 'Qualifié le' : 'Qualified'} ${format(new Date(ref.qualified_at), 'dd/MM/yyyy', { locale })}`}
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
    </div>
  )
}

import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/common/EmptyState'
import { LoadingState } from '@/components/common/LoadingState'
import { CreditCard } from 'lucide-react'
import { format } from 'date-fns'
import { fr, enUS } from 'date-fns/locale'
import type { PackPurchase } from '@/types'

export function MyPacksPage() {
  const { t, i18n } = useTranslation()
  const { user } = useAuth()
  const navigate = useNavigate()
  const locale = i18n.language === 'fr' ? fr : enUS
  const [packs, setPacks] = useState<PackPurchase[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return
    supabase
      .from('pack_purchases')
      .select('*, pack_type:pack_types(*, credit_type:credit_types(*))')
      .eq('user_id', user.id)
      .order('purchased_at', { ascending: false })
      .then(({ data }) => {
        setPacks((data as PackPurchase[]) ?? [])
        setLoading(false)
      })
  }, [user])

  if (loading) return <LoadingState />

  const now = new Date()

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t('packs.myPacks')}</h1>
        <Button onClick={() => navigate('/packs')}>{t('home.buyPack')}</Button>
      </div>

      {packs.length === 0 ? (
        <EmptyState
          icon={CreditCard}
          message={t('packs.noActivePacks')}
          actionLabel={t('home.buyPack')}
          onAction={() => navigate('/packs')}
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {packs.map((pack) => {
            const isExpired = new Date(pack.expires_at) < now
            const isEmpty = pack.credits_remaining <= 0
            const creditLabel = i18n.language === 'fr'
              ? pack.pack_type?.credit_type?.label_fr
              : pack.pack_type?.credit_type?.label_en

            return (
              <Card key={pack.id} className={isExpired || isEmpty ? 'opacity-60' : ''}>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">{pack.pack_type?.name}</CardTitle>
                    {(isExpired || isEmpty) && (
                      <Badge variant="secondary">{t('packs.expired')}</Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-1 text-sm">
                    <p>{creditLabel}</p>
                    <p className="font-semibold text-lg">
                      {t('packs.creditsRemaining', { count: pack.credits_remaining })}
                    </p>
                    <p className="text-muted-foreground">
                      {t('packs.expiresAt', { date: format(new Date(pack.expires_at), 'dd MMM yyyy', { locale }) })}
                    </p>
                    <p className="text-muted-foreground">
                      {(pack.price_paid_cents / 100).toFixed(2).replace('.', ',')} €
                    </p>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}

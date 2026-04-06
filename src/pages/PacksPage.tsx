import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { EmptyState } from '@/components/common/EmptyState'
import { LoadingState } from '@/components/common/LoadingState'
import { ShoppingBag, Check } from 'lucide-react'
import { toast } from 'sonner'
import type { PackType } from '@/types'
import { motion } from 'framer-motion'

export function PacksPage() {
  const { t, i18n } = useTranslation()
  const { profile } = useAuth()
  const [packTypes, setPackTypes] = useState<PackType[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchPacks = async () => {
      let query = supabase
        .from('pack_types')
        .select('*, credit_type:credit_types(*), categories:pack_type_categories(member_category_id)')
        .eq('is_active', true)
        .order('price_cents')

      const { data } = await query
      let packs = (data as PackType[]) ?? []

      // Filter by user's category if they have one
      if (profile?.member_category_id) {
        packs = packs.filter((p) => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const cats = (p as any).categories as { member_category_id: string }[] | undefined
          return cats?.some((c) => c.member_category_id === profile.member_category_id) || cats?.length === 0
        })
      }

      setPackTypes(packs)
      setLoading(false)
    }

    fetchPacks()
  }, [profile])

  const handleBuy = async (packType: PackType) => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        toast.error(t('common.error'))
        return
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-checkout-session`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            pack_type_id: packType.id,
            success_url: `${window.location.origin}/my-packs?success=true`,
            cancel_url: `${window.location.origin}/packs?cancelled=true`,
          }),
        }
      )

      const data = await response.json()

      if (data.url) {
        window.location.href = data.url
      } else {
        toast.error(data.error || t('common.error'))
      }
    } catch {
      toast.error(t('common.error'))
    }
  }

  if (loading) return <LoadingState />

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">{t('packs.title')}</h1>

      {packTypes.length === 0 ? (
        <EmptyState icon={ShoppingBag} message={t('packs.noPacks')} />
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {packTypes.map((pack, index) => {
            const creditLabel = i18n.language === 'fr'
              ? pack.credit_type?.label_fr
              : pack.credit_type?.label_en

            return (
              <motion.div
                key={pack.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
              >
                <Card className="flex flex-col h-full hover:shadow-lg transition-shadow">
                  <CardHeader>
                    <CardTitle>{pack.name}</CardTitle>
                    <CardDescription>{pack.description}</CardDescription>
                  </CardHeader>
                  <CardContent className="flex-1 flex flex-col justify-between">
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">{creditLabel}</Badge>
                      </div>
                      <ul className="space-y-2 text-sm">
                        <li className="flex items-center gap-2">
                          <Check className="h-4 w-4 text-primary" />
                          {t('packs.credits', { count: pack.credit_count })}
                        </li>
                        <li className="flex items-center gap-2">
                          <Check className="h-4 w-4 text-primary" />
                          {t('packs.validity', { days: pack.validity_days })}
                        </li>
                      </ul>
                      <p className="text-3xl font-bold mt-4">
                        {t('packs.price', { price: (pack.price_cents / 100).toFixed(0) })}
                      </p>
                    </div>
                    <Button className="w-full mt-6" onClick={() => handleBuy(pack)}>
                      {t('packs.buy')}
                    </Button>
                  </CardContent>
                </Card>
              </motion.div>
            )
          })}
        </div>
      )}
    </div>
  )
}

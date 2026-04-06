import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { EmptyState } from '@/components/common/EmptyState'
import { LoadingState } from '@/components/common/LoadingState'
import { ShoppingBag, Check, Zap } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import type { PackType } from '@/types'
import { motion } from 'framer-motion'

const CREDIT_ACCENT: Record<string, string> = {
  semi_prive: 'from-blue-500 to-blue-600',
  personal_training: 'from-orange-500 to-orange-600',
}

export function PacksPage() {
  const { t, i18n } = useTranslation()
  const { profile } = useAuth()
  const [packTypes, setPackTypes] = useState<PackType[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchPacks = async () => {
      const { data } = await supabase
        .from('pack_types')
        .select('*, credit_type:credit_types(*), categories:pack_type_categories(member_category_id)')
        .eq('is_active', true)
        .order('price_cents')

      let packs = (data as PackType[]) ?? []

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
      <div className="text-center">
        <h1 className="text-2xl md:text-3xl font-bold">{t('packs.title')}</h1>
        <p className="text-muted-foreground mt-1">
          {i18n.language === 'fr' ? 'Choisissez le pack adapté à vos besoins' : 'Choose the pack that fits your needs'}
        </p>
      </div>

      {packTypes.length === 0 ? (
        <EmptyState icon={ShoppingBag} message={t('packs.noPacks')} />
      ) : (
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3 max-w-5xl mx-auto">
          {packTypes.map((pack, index) => {
            const creditLabel = i18n.language === 'fr'
              ? pack.credit_type?.label_fr
              : pack.credit_type?.label_en
            const creditName = pack.credit_type?.name ?? 'default'
            const gradient = CREDIT_ACCENT[creditName] || 'from-primary to-primary'
            const isBestValue = index === Math.floor(packTypes.length / 2)
            const pricePerCredit = (pack.price_cents / 100 / pack.credit_count).toFixed(0)

            return (
              <motion.div
                key={pack.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.08 }}
                className={cn(isBestValue && 'md:-mt-2 md:mb-2')}
              >
                <Card className={cn(
                  'relative overflow-hidden flex flex-col h-full transition-all hover:shadow-xl',
                  isBestValue && 'border-primary shadow-lg ring-1 ring-primary/20'
                )}>
                  {/* Top accent bar */}
                  <div className={cn('h-1.5 bg-gradient-to-r', gradient)} />

                  {isBestValue && (
                    <div className="absolute top-4 right-4">
                      <Badge className="bg-primary text-primary-foreground gap-1">
                        <Zap className="h-3 w-3" />
                        {i18n.language === 'fr' ? 'Populaire' : 'Popular'}
                      </Badge>
                    </div>
                  )}

                  <CardContent className="p-5 flex-1 flex flex-col">
                    <Badge variant="outline" className="w-fit mb-3 text-[11px]">
                      {creditLabel}
                    </Badge>

                    <h3 className="text-lg font-bold mb-1">{pack.name}</h3>
                    {pack.description && (
                      <p className="text-sm text-muted-foreground mb-4">{pack.description}</p>
                    )}

                    {/* Price */}
                    <div className="my-4">
                      <div className="flex items-baseline gap-1">
                        <span className="text-4xl font-extrabold">{(pack.price_cents / 100).toFixed(0)}</span>
                        <span className="text-lg font-medium text-muted-foreground">€</span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {pricePerCredit}€ / {i18n.language === 'fr' ? 'séance' : 'session'}
                      </p>
                    </div>

                    {/* Features */}
                    <ul className="space-y-2 mb-6 flex-1">
                      <li className="flex items-center gap-2 text-sm">
                        <Check className="h-4 w-4 text-primary shrink-0" />
                        {t('packs.credits', { count: pack.credit_count })}
                      </li>
                      <li className="flex items-center gap-2 text-sm">
                        <Check className="h-4 w-4 text-primary shrink-0" />
                        {t('packs.validity', { days: pack.validity_days })}
                      </li>
                    </ul>

                    <Button
                      className={cn(
                        'w-full rounded-full font-semibold',
                        isBestValue ? '' : 'variant-outline'
                      )}
                      variant={isBestValue ? 'default' : 'outline'}
                      onClick={() => handleBuy(pack)}
                    >
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

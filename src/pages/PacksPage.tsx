import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/common/EmptyState'
import { LoadingState } from '@/components/common/LoadingState'
import { ShoppingBag, Check, Zap, Flame } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import type { PackType } from '@/types'
import { motion } from 'framer-motion'

export function PacksPage() {
  const { t, i18n } = useTranslation()
  const isFr = i18n.language === 'fr'
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
      if (!session) { toast.error(t('common.error')); return }
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-checkout-session`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
          body: JSON.stringify({
            pack_type_id: packType.id,
            success_url: `${window.location.origin}/my-packs?success=true`,
            cancel_url: `${window.location.origin}/packs?cancelled=true`,
          }),
        }
      )
      const data = await response.json()
      if (data.url) { window.location.href = data.url } else { toast.error(data.error || t('common.error')) }
    } catch { toast.error(t('common.error')) }
  }

  if (loading) return <LoadingState />

  // Determine which pack is "popular" (middle one, or the one with best value)
  const popularIndex = packTypes.length >= 2 ? Math.floor(packTypes.length / 2) : -1

  return (
    <div className="space-y-8">
      {/* Title */}
      <div className="text-center">
        <h1 className="text-3xl md:text-4xl font-bold">
          {isFr ? 'Packs de ' : 'Credit '}
          <span className="text-primary">{isFr ? 'crédits' : 'Packs'}</span>
        </h1>
        <p className="text-muted-foreground mt-2 max-w-lg mx-auto">
          {isFr
            ? 'Achète des crédits et réserve tes cours préférés. Plus le pack est gros, plus le prix par crédit baisse 🔥'
            : 'Buy credits and book your favorite classes. The bigger the pack, the lower the price per credit 🔥'}
        </p>
      </div>

      {packTypes.length === 0 ? (
        <EmptyState icon={ShoppingBag} message={t('packs.noPacks')} />
      ) : (
        <div className="flex justify-center">
          <div className={cn(
            'grid gap-5 w-full max-w-5xl',
            packTypes.length === 1 && 'max-w-sm',
            packTypes.length === 2 && 'md:grid-cols-2 max-w-2xl',
            packTypes.length === 3 && 'md:grid-cols-3',
            packTypes.length >= 4 && 'md:grid-cols-2 lg:grid-cols-4',
          )}>
            {packTypes.map((pack, index) => {
              const isPopular = index === popularIndex
              const creditLabel = isFr ? pack.credit_type?.label_fr : pack.credit_type?.label_en
              const priceEuros = (pack.price_cents / 100).toFixed(0)
              const pricePerCredit = (pack.price_cents / 100 / pack.credit_count).toFixed(1)
              const validityMonths = Math.round(pack.validity_days / 30)
              const validityLabel = validityMonths >= 1
                ? `${validityMonths} ${isFr ? 'mois' : validityMonths === 1 ? 'month' : 'months'}`
                : `${pack.validity_days} ${isFr ? 'jours' : 'days'}`

              return (
                <motion.div
                  key={pack.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.08 }}
                  className="relative"
                >
                  {/* Popular badge */}
                  {isPopular && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-10">
                      <span className="flex items-center gap-1 bg-primary text-primary-foreground text-xs font-semibold px-3 py-1 rounded-full">
                        <Flame className="h-3 w-3" />
                        {isFr ? 'Populaire' : 'Popular'}
                      </span>
                    </div>
                  )}

                  <div className={cn(
                    'rounded-xl border bg-card p-6 flex flex-col h-full transition-all',
                    isPopular
                      ? 'border-primary ring-1 ring-primary/30 shadow-lg shadow-primary/10'
                      : 'border-border hover:border-muted-foreground/30'
                  )}>
                    {/* Name + description */}
                    <h3 className="text-lg font-bold">{pack.name}</h3>
                    {pack.description && (
                      <p className="text-sm text-muted-foreground mt-0.5">{pack.description}</p>
                    )}

                    {/* Price */}
                    <div className="mt-5 mb-1">
                      <span className="text-4xl font-extrabold">{priceEuros}</span>
                      <span className="text-lg text-muted-foreground ml-1">€</span>
                    </div>

                    {/* Credits + price per credit */}
                    <div className="flex items-center gap-2 text-sm mb-5">
                      <span className="flex items-center gap-1 text-primary font-semibold">
                        <Zap className="h-3.5 w-3.5" />
                        {pack.credit_count} {isFr ? 'crédits' : 'credits'}
                      </span>
                      <span className="text-muted-foreground">
                        {pricePerCredit}€/{isFr ? 'crédit' : 'credit'}
                      </span>
                    </div>

                    {/* Features */}
                    <ul className="space-y-2 flex-1 mb-6">
                      <li className="flex items-center gap-2 text-sm">
                        <Check className="h-4 w-4 text-primary shrink-0" />
                        {isFr ? 'Valable' : 'Valid'} {validityLabel}
                      </li>
                      <li className="flex items-center gap-2 text-sm">
                        <Check className="h-4 w-4 text-primary shrink-0" />
                        {creditLabel}
                      </li>
                    </ul>

                    {/* Buy button */}
                    <Button
                      className={cn(
                        'w-full rounded-lg font-semibold',
                        isPopular
                          ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                          : 'bg-transparent border border-primary text-primary hover:bg-primary hover:text-primary-foreground'
                      )}
                      variant={isPopular ? 'default' : 'outline'}
                      onClick={() => handleBuy(pack)}
                    >
                      {t('packs.buy')}
                    </Button>
                  </div>
                </motion.div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { Browser } from '@capacitor/browser'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { EmptyState } from '@/components/common/EmptyState'
import { LoadingState } from '@/components/common/LoadingState'
import { ShoppingBag, Check, Zap, Flame, AlertTriangle, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'
import { cn, formatPackCredits, formatValidity } from '@/lib/utils'
import type { PackType } from '@/types'
import { motion } from 'framer-motion'

/**
 * Périodicité d'un abonnement, en clair.
 * « toutes les 4 semaines » plutôt que « tous les mois » : le cycle de 28 jours
 * produit 13 prélèvements par an, pas 12. Le client doit le lire tel quel.
 */
function formatRecurrence(pack: PackType, isFr: boolean): string {
  const n = pack.recurring_interval_count ?? 1
  const unit = pack.recurring_interval
  if (isFr) {
    if (unit === 'week') return n === 1 ? 'chaque semaine' : `toutes les ${n} semaines`
    if (unit === 'month') return n === 1 ? 'chaque mois' : `tous les ${n} mois`
    return n === 1 ? 'chaque jour' : `tous les ${n} jours`
  }
  if (unit === 'week') return n === 1 ? 'every week' : `every ${n} weeks`
  if (unit === 'month') return n === 1 ? 'every month' : `every ${n} months`
  return n === 1 ? 'every day' : `every ${n} days`
}

export function PacksPage() {
  const { t, i18n } = useTranslation()
  const isFr = i18n.language === 'fr'
  const { profile, hasRegistrationFee, refreshProfile } = useAuth()
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

  const [regFeeLoading, setRegFeeLoading] = useState(false)

  const handlePayRegistrationFee = async () => {
    try {
      setRegFeeLoading(true)
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { toast.error(t('common.error')); return }
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-checkout-session`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
          body: JSON.stringify({
            type: 'registration_fee',
            success_url: `${window.location.origin}/packs?fee_paid=true`,
            cancel_url: `${window.location.origin}/packs?cancelled=true`,
          }),
        }
      )
      const data = await response.json()
      if (data.url) {
        await Browser.open({ url: data.url, presentationStyle: 'popover' })
      } else {
        toast.error(data.error || t('common.error'))
      }
    } catch { toast.error(t('common.error')) } finally { setRegFeeLoading(false) }
  }

  // Refresh after fee payment
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('fee_paid') === 'true') {
      refreshProfile()
      toast.success(t('packs.registrationFeePaid'))
      window.history.replaceState({}, '', '/packs')
    }
  }, [])

  /** Pack récurrent en attente de confirmation (null = pas de dialogue ouvert). */
  const [pendingSubscription, setPendingSubscription] = useState<PackType | null>(null)

  const handleBuy = async (packType: PackType) => {
    if (!hasRegistrationFee) {
      toast.error(t('packs.registrationFeeRequired'))
      return
    }
    // Un abonnement engage des prélèvements répétés : on demande une
    // confirmation explicite plutôt que de lancer le paiement sur un clic.
    if (packType.is_recurring) {
      setPendingSubscription(packType)
      return
    }
    await startCheckout(packType)
  }

  const startCheckout = async (packType: PackType) => {
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
      if (data.url) {
        await Browser.open({ url: data.url, presentationStyle: 'popover' })
      } else {
        toast.error(data.error || t('common.error'))
      }
    } catch { toast.error(t('common.error')) }
  }

  if (loading) return <LoadingState />

  // Les abonnements passent devant : c'est la formule que le studio met en
  // avant. Les packs ponctuels restent disponibles, en second rideau.
  const subscriptionPacks = packTypes.filter(p => p.is_recurring)
  const oneOffPacks = packTypes.filter(p => !p.is_recurring)

  // « Populaire » ne se calcule que sur les packs ponctuels : un abonnement
  // porte déjà son propre badge.
  const popularIndex = oneOffPacks.length >= 2 ? Math.floor(oneOffPacks.length / 2) : -1

  const gridClass = (count: number) => cn(
    'grid gap-5 w-full max-w-5xl',
    count === 1 && 'max-w-sm',
    count === 2 && 'md:grid-cols-2 max-w-2xl',
    count === 3 && 'md:grid-cols-3',
    count >= 4 && 'md:grid-cols-2 lg:grid-cols-4',
  )

  const renderPack = (pack: PackType, index: number, isPopular: boolean) => {
    const creditLabel = isFr ? pack.credit_type?.label_fr : pack.credit_type?.label_en
    const priceEuros = (pack.price_cents / 100).toFixed(0).replace('.', ',')
    // Pas de prix par credit sur un illimite : rien ne se decompte
    const pricePerCredit = pack.is_unlimited
      ? null
      : (pack.price_cents / 100 / pack.credit_count).toFixed(1).replace('.', ',')
    const validityLabel = formatValidity(pack.validity_days, isFr)
    const highlighted = isPopular || pack.is_recurring

    return (
      <motion.div
        key={pack.id}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: index * 0.08 }}
        className="relative"
      >
        {/* Badge : l'abonnement prime sur « populaire » — l'engagement
            récurrent est l'information la plus utile au client. */}
        {pack.is_recurring ? (
          <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-10">
            <span className="flex items-center gap-1 bg-primary text-primary-foreground text-xs font-semibold px-3 py-1 rounded-full">
              <RefreshCw className="h-3 w-3" />
              {isFr ? 'Abonnement' : 'Subscription'}
            </span>
          </div>
        ) : isPopular && (
          <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-10">
            <span className="flex items-center gap-1 bg-primary text-primary-foreground text-xs font-semibold px-3 py-1 rounded-full">
              <Flame className="h-3 w-3" />
              {isFr ? 'Populaire' : 'Popular'}
            </span>
          </div>
        )}

        <div className={cn(
          'rounded-xl border bg-card p-6 flex flex-col h-full transition-all',
          highlighted
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
            {pack.is_recurring && (
              <span className="text-sm text-muted-foreground ml-1">
                / {formatRecurrence(pack, isFr)}
              </span>
            )}
          </div>

          {/* Credits + price per credit */}
          <div className="flex items-center gap-2 text-sm mb-5">
            <span className="flex items-center gap-1 text-primary font-semibold">
              <Zap className="h-3.5 w-3.5" />
              {formatPackCredits(pack, isFr)}
            </span>
            {pricePerCredit && (
              <span className="text-muted-foreground">
                {pricePerCredit}€/{isFr ? 'crédit' : 'credit'}
              </span>
            )}
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
            {pack.is_recurring && (
              <li className="flex items-start gap-2 text-sm">
                <RefreshCw className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                <span>
                  {isFr
                    ? `Renouvellement automatique ${formatRecurrence(pack, true)}`
                    : `Renews automatically ${formatRecurrence(pack, false)}`}
                </span>
              </li>
            )}
          </ul>

          {/* Buy button */}
          <Button
            className={cn(
              'w-full rounded-lg font-semibold',
              highlighted
                ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                : 'bg-transparent border border-primary text-primary hover:bg-primary hover:text-primary-foreground'
            )}
            variant={highlighted ? 'default' : 'outline'}
            onClick={() => handleBuy(pack)}
          >
            {pack.is_recurring
              ? (isFr ? 'S\'abonner' : 'Subscribe')
              : t('packs.buy')}
          </Button>
        </div>
      </motion.div>
    )
  }

  return (
    <div className="space-y-8">
      {/* Title */}
      <div className="text-center">
        <h1 className="text-3xl md:text-4xl font-bold">
          {isFr ? 'Nos ' : 'Our '}
          <span className="text-primary">{isFr ? 'formules' : 'plans'}</span>
        </h1>
        <p className="text-muted-foreground mt-2 max-w-lg mx-auto">
          {isFr
            ? 'Abonne-toi pour venir régulièrement sans y penser, ou achète des crédits à l\'unité 🔥'
            : 'Subscribe to train regularly without thinking about it, or buy credits one pack at a time 🔥'}
        </p>
      </div>

      {/* Registration fee alert */}
      {!hasRegistrationFee && (
        <Card className="border-amber-500/50 bg-amber-50 dark:bg-amber-950/20 max-w-2xl mx-auto">
          <CardContent className="pt-6">
            <div className="flex items-start gap-4">
              <AlertTriangle className="h-6 w-6 text-amber-500 shrink-0 mt-0.5" />
              <div className="flex-1">
                <h3 className="font-semibold text-amber-900 dark:text-amber-200">
                  {t('packs.registrationFeeTitle')}
                </h3>
                <p className="text-sm text-amber-800 dark:text-amber-300 mt-1">
                  {t('packs.registrationFeeDesc')}
                </p>
                <Button
                  className="mt-3"
                  onClick={handlePayRegistrationFee}
                  disabled={regFeeLoading}
                >
                  {t('packs.payRegistrationFee')}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {packTypes.length === 0 ? (
        <EmptyState icon={ShoppingBag} message={t('packs.noPacks')} />
      ) : (
        <div className="space-y-10">
          {/* Abonnements — mis en avant */}
          {subscriptionPacks.length > 0 && (
            <div className="space-y-4">
              <div className="text-center">
                <h2 className="text-xl font-bold">
                  {isFr ? 'Abonnements' : 'Subscriptions'}
                </h2>
                <p className="text-sm text-muted-foreground mt-1">
                  {isFr
                    ? 'Renouvellement automatique, sans avoir à y penser. Résiliable à tout moment.'
                    : 'Renews automatically, nothing to think about. Cancel any time.'}
                </p>
              </div>
              <div className="flex justify-center">
                <div className={gridClass(subscriptionPacks.length)}>
                  {subscriptionPacks.map((pack, index) => renderPack(pack, index, false))}
                </div>
              </div>
            </div>
          )}

          {/* Packs ponctuels */}
          {oneOffPacks.length > 0 && (
            <div className="space-y-4">
              <div className="text-center">
                <h2 className="text-xl font-bold">
                  {isFr ? 'Packs à l\'unité' : 'One-off packs'}
                </h2>
                <p className="text-sm text-muted-foreground mt-1">
                  {isFr
                    ? 'Sans engagement : tu achètes tes crédits quand tu en as besoin.'
                    : 'No commitment: buy credits whenever you need them.'}
                </p>
              </div>
              <div className="flex justify-center">
                <div className={gridClass(oneOffPacks.length)}>
                  {oneOffPacks.map((pack, index) => renderPack(pack, index, index === popularIndex))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Confirmation avant souscription : le client doit avoir lu le mot
          « automatiquement » et la périodicité avant d'arriver chez Stripe. */}
      <Dialog
        open={!!pendingSubscription}
        onOpenChange={(open) => { if (!open) setPendingSubscription(null) }}
      >
        <DialogContent className="max-w-md">
          {pendingSubscription && (
            <>
              <DialogHeader>
                <DialogTitle>
                  {isFr ? 'Confirmer l\'abonnement' : 'Confirm subscription'}
                </DialogTitle>
              </DialogHeader>

              <div className="space-y-4 text-sm">
                <div className="rounded-lg border p-4 space-y-1">
                  <p className="font-semibold">{pendingSubscription.name}</p>
                  <p className="text-2xl font-extrabold">
                    {(pendingSubscription.price_cents / 100).toFixed(2).replace('.', ',')} €
                    <span className="text-sm font-normal text-muted-foreground ml-1">
                      / {formatRecurrence(pendingSubscription, isFr)}
                    </span>
                  </p>
                </div>

                <div className="flex items-start gap-2 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-500/40 p-3">
                  <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                  <p className="text-amber-900 dark:text-amber-200">
                    {isFr
                      ? `Ce montant sera prélevé automatiquement ${formatRecurrence(pendingSubscription, true)}, jusqu'à résiliation. Tu peux résilier à tout moment depuis « Mes packs » : tes droits restent acquis jusqu'à la fin de la période déjà payée.`
                      : `This amount will be charged automatically ${formatRecurrence(pendingSubscription, false)} until you cancel. You can cancel at any time from "My packs": your access remains valid until the end of the period already paid.`}
                  </p>
                </div>
              </div>

              <DialogFooter className="gap-2 sm:gap-0">
                <Button variant="outline" onClick={() => setPendingSubscription(null)}>
                  {isFr ? 'Annuler' : 'Cancel'}
                </Button>
                <Button
                  onClick={() => {
                    const pack = pendingSubscription
                    setPendingSubscription(null)
                    startCheckout(pack)
                  }}
                >
                  {isFr ? 'Je m\'abonne' : 'Subscribe'}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

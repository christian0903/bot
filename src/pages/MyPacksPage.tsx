import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { EmptyState } from '@/components/common/EmptyState'
import { LoadingState } from '@/components/common/LoadingState'
import { CreditCard, X, Clock, RefreshCw, AlertTriangle, PauseCircle, TicketPercent } from 'lucide-react'
import { format } from 'date-fns'
import { fr, enUS } from 'date-fns/locale'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import type { PackPurchase, Booking, ScheduledClass, Subscription, SubscriptionDiscount } from '@/types'

/** Consommation du plafond de séances sur un cycle d'abonnement. */
interface QuotaUsage {
  pack_purchase_id: string
  quota_sessions: number
  used: number
  remaining: number
}

export function MyPacksPage() {
  const { t, i18n } = useTranslation()
  const isFr = i18n.language === 'fr'
  const { user } = useAuth()
  const navigate = useNavigate()
  const locale = isFr ? fr : enUS
  const [packs, setPacks] = useState<PackPurchase[]>([])
  /** Plafond de séances par cycle, par achat. Vide si aucun pack n'en a. */
  const [quotaUsage, setQuotaUsage] = useState<Map<string, QuotaUsage>>(new Map())
  /** Inclure les packs vides ou expirés. Faux par défaut : ils encombrent. */
  const [showAllPacks, setShowAllPacks] = useState(false)
  const [loading, setLoading] = useState(true)
  const [selectedPack, setSelectedPack] = useState<PackPurchase | null>(null)
  const [packBookings, setPackBookings] = useState<(Booking & { scheduled_class: ScheduledClass })[]>([])
  const [packBookingsLoading, setPackBookingsLoading] = useState(false)
  /** Abonnement en cours (au plus un vivant à la fois). */
  const [subscription, setSubscription] = useState<Subscription | null>(null)
  /** Réductions accordées par le studio sur cet abonnement. */
  const [discounts, setDiscounts] = useState<SubscriptionDiscount[]>([])
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false)
  const [cancelling, setCancelling] = useState(false)

  const openPackDetail = async (pack: PackPurchase) => {
    setSelectedPack(pack)
    setPackBookingsLoading(true)
    setPackBookings([])

    const { data: bookings } = await supabase
      .from('bookings')
      .select('*')
      .eq('pack_purchase_id', pack.id)
      .order('created_at', { ascending: false })

    const raw = (bookings as Booking[]) ?? []
    if (raw.length > 0) {
      const classIds = [...new Set(raw.map(b => b.scheduled_class_id))]
      const { data: classData } = await supabase
        .from('scheduled_classes')
        .select('*, class_type:class_types(*)')
        .in('id', classIds)
      const classMap = new Map((classData ?? []).map(c => [c.id, c]))
      for (const b of raw) {
        (b as Booking & { scheduled_class: ScheduledClass }).scheduled_class = classMap.get(b.scheduled_class_id) as ScheduledClass
      }
      const withClasses = (raw as (Booking & { scheduled_class: ScheduledClass })[])
        .filter(b => b.scheduled_class)
        .sort((a, b) => new Date(b.scheduled_class.starts_at).getTime() - new Date(a.scheduled_class.starts_at).getTime())
      setPackBookings(withClasses)
    }
    setPackBookingsLoading(false)
  }

  const fetchAll = async () => {
    if (!user) return
    const [packsRes, subRes, quotaRes] = await Promise.all([
      supabase
        .from('pack_purchases')
        .select('*, pack_type:pack_types(*, credit_type:credit_types(*))')
        .eq('user_id', user.id)
        .order('purchased_at', { ascending: false }),
      // Un seul abonnement vivant à la fois : on prend le plus récent.
      supabase
        .from('subscriptions')
        .select('*, pack_type:pack_types(*)')
        .eq('user_id', user.id)
        .in('status', ['active', 'past_due', 'paused'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
      // Vide tant qu'aucun pack du membre n'a de plafond.
      supabase.rpc('my_pack_quota_usage'),
    ])
    setPacks((packsRes.data as PackPurchase[]) ?? [])
    setQuotaUsage(new Map(
      ((quotaRes.data as QuotaUsage[]) ?? []).map(q => [q.pack_purchase_id, q]),
    ))
    const sub = (subRes.data as Subscription) ?? null
    setSubscription(sub)

    if (sub) {
      const { data: disc } = await supabase
        .from('subscription_discounts')
        .select('*')
        .eq('subscription_id', sub.id)
        .order('applied_at', { ascending: false })
      setDiscounts((disc as SubscriptionDiscount[]) ?? [])
    } else {
      setDiscounts([])
    }
    setLoading(false)
  }

  useEffect(() => {
    fetchAll()
  }, [user])

  const handleCancelSubscription = async () => {
    setCancelling(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { toast.error(t('common.error')); return }
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/cancel-my-subscription`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
          body: JSON.stringify({}),
        }
      )
      const data = await response.json()
      if (data.ok) {
        toast.success(data.message ?? (isFr ? 'Résiliation enregistrée' : 'Cancellation registered'))
        setCancelDialogOpen(false)
        await fetchAll()
      } else {
        toast.error(data.error ?? t('common.error'))
      }
    } catch {
      toast.error(t('common.error'))
    } finally {
      setCancelling(false)
    }
  }

  if (loading) return <LoadingState />

  const now = new Date()

  // Une seule réduction peut être en attente à la fois (duration: once côté
  // Stripe). On calcule ce que la prochaine échéance coûtera réellement.
  const pendingDiscount = discounts.find(d => !d.consumed_at) ?? null
  const appliedDiscount = discounts.find(d => d.consumed_at) ?? null

  const fullPriceCents = subscription?.pack_type?.price_cents ?? null
  const eur = (cents: number) => `${(cents / 100).toFixed(2).replace('.', ',')} €`

  const fullPriceLabel = fullPriceCents !== null ? eur(fullPriceCents) : null

  // Le pack d'un abonnement porte le même nom que l'abonnement lui-même :
  // affichés côte à côte, ils passaient pour un doublon. Les crédits du cycle
  // en cours sont donc montrés DANS la carte d'abonnement, et seuls les packs
  // achetés séparément gardent leur propre carte.
  const subscriptionPack = subscription
    ? packs.find(p => p.subscription_id === subscription.id && new Date(p.expires_at) > now) ?? null
    : null
  const standalonePacks = packs.filter(p => !p.subscription_id)
  // Tout pack d'abonnement qui n'est pas affiché dans la carte ci-dessus garde
  // sa propre carte : les cycles passés, et le cas d'un abonnement résilié dont
  // les crédits courent encore.
  const otherSubscriptionPacks = packs.filter(
    p => p.subscription_id && p.id !== subscriptionPack?.id,
  )
  const allPacks = [...standalonePacks, ...otherSubscriptionPacks]
    .sort((a, b) => new Date(b.purchased_at).getTime() - new Date(a.purchased_at).getTime())

  /** Utilisable : pas expiré, et il reste des crédits (ou l'accès est illimité). */
  const isUsable = (p: PackPurchase) =>
    new Date(p.expires_at) > now
    && (p.pack_type?.is_unlimited || p.credits_remaining > 0)

  // Par défaut, seuls les packs utilisables. Les packs vides ou périmés
  // s'accumulent au fil des mois et noient ceux qui servent encore : le membre
  // doit voir d'un coup d'œil ce dont il dispose, pas son historique d'achats.
  const spentCount = allPacks.length - allPacks.filter(isUsable).length
  const displayedPacks = showAllPacks ? allPacks : allPacks.filter(isUsable)
  let nextAmountLabel: string | null = null
  if (pendingDiscount && fullPriceCents !== null) {
    const reduced = pendingDiscount.percent_off
      ? Math.round(fullPriceCents * (1 - pendingDiscount.percent_off / 100))
      : Math.max(0, fullPriceCents - (pendingDiscount.amount_off_cents ?? 0))
    nextAmountLabel = eur(reduced)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t('packs.myPacks')}</h1>
        <Button onClick={() => navigate('/packs')}>{t('home.buyPack')}</Button>
      </div>

      {/* Abonnement en cours. Placé avant les packs : c'est le contrat vivant,
          celui qui engage un prélèvement à venir. */}
      {subscription && (
        <Card className={subscription.status === 'past_due' ? 'border-red-500/50' : 'border-primary/40'}>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <CardTitle className="text-lg flex items-center gap-2">
                <RefreshCw className="h-4 w-4 text-primary" />
                {subscription.pack_type?.name ?? (isFr ? 'Abonnement' : 'Subscription')}
              </CardTitle>
              {subscription.status === 'past_due' ? (
                <Badge variant="destructive">{isFr ? 'Paiement en échec' : 'Payment failed'}</Badge>
              ) : subscription.status === 'paused' ? (
                <Badge variant="secondary">{isFr ? 'Suspendu' : 'Paused'}</Badge>
              ) : subscription.cancel_at_period_end ? (
                <Badge variant="secondary">{isFr ? 'Résiliation programmée' : 'Cancellation scheduled'}</Badge>
              ) : (
                <Badge variant="outline" className="border-green-500 text-green-600">
                  {isFr ? 'Actif' : 'Active'}
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {subscription.current_period_end && (
              <p className="text-sm">
                {subscription.cancel_at_period_end
                  ? (isFr
                      ? `Tes droits sont conservés jusqu'au ${format(new Date(subscription.current_period_end), 'dd MMMM yyyy', { locale })}. Aucun nouveau prélèvement ne sera effectué.`
                      : `Your access remains valid until ${format(new Date(subscription.current_period_end), 'dd MMMM yyyy', { locale })}. No further charges will be made.`)
                  : (isFr
                      ? `Prochaine échéance le ${format(new Date(subscription.current_period_end), 'dd MMMM yyyy', { locale })}`
                      : `Next payment on ${format(new Date(subscription.current_period_end), 'dd MMMM yyyy', { locale })}`)}
              </p>
            )}

            {/* Réduction accordée mais pas encore appliquée : le membre doit
                savoir ce qu'il paiera réellement à la prochaine échéance. */}
            {pendingDiscount && (
              <div className="flex items-start gap-2 rounded-lg bg-green-50 dark:bg-green-950/20 border border-green-500/40 p-3 text-sm">
                <TicketPercent className="h-4 w-4 text-green-600 shrink-0 mt-0.5" />
                <div className="text-green-900 dark:text-green-200">
                  <p className="font-medium">
                    {isFr ? 'Réduction accordée : ' : 'Discount granted: '}
                    {pendingDiscount.percent_off
                      ? `-${pendingDiscount.percent_off} %`
                      : `-${((pendingDiscount.amount_off_cents ?? 0) / 100).toFixed(2).replace('.', ',')} €`}
                    {pendingDiscount.reason && ` · ${pendingDiscount.reason}`}
                  </p>
                  <p className="text-xs mt-0.5">
                    {nextAmountLabel
                      ? (isFr
                          ? `Tu paieras ${nextAmountLabel} à la prochaine échéance, au lieu de ${fullPriceLabel}. Les suivantes reviennent au tarif normal.`
                          : `You will pay ${nextAmountLabel} at the next payment instead of ${fullPriceLabel}. Later payments return to the normal price.`)
                      : (isFr
                          ? 'Elle s\'applique à la prochaine échéance uniquement.'
                          : 'It applies to the next payment only.')}
                  </p>
                </div>
              </div>
            )}

            {/* Réduction déjà consommée : trace rassurante après coup. */}
            {!pendingDiscount && appliedDiscount && (
              <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                <TicketPercent className="h-3.5 w-3.5 shrink-0" />
                {isFr
                  ? `Réduction de ${appliedDiscount.percent_off ? `${appliedDiscount.percent_off} %` : `${((appliedDiscount.amount_off_cents ?? 0) / 100).toFixed(2).replace('.', ',')} €`} appliquée le ${format(new Date(appliedDiscount.consumed_at!), 'dd/MM/yyyy')}`
                  : `Discount of ${appliedDiscount.percent_off ? `${appliedDiscount.percent_off}%` : `${((appliedDiscount.amount_off_cents ?? 0) / 100).toFixed(2).replace('.', ',')} €`} applied on ${format(new Date(appliedDiscount.consumed_at!), 'dd/MM/yyyy')}`}
              </p>
            )}

            {subscription.status === 'past_due' && (
              <div className="flex items-start gap-2 rounded-lg bg-red-50 dark:bg-red-950/20 border border-red-500/40 p-3 text-sm">
                <AlertTriangle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
                <p className="text-red-900 dark:text-red-200">
                  {isFr
                    ? 'Le dernier prélèvement a échoué. Contacte le studio pour régulariser ta situation.'
                    : 'The last payment failed. Please contact the studio to sort it out.'}
                </p>
              </div>
            )}

            {subscription.status === 'paused' && (
              <div className="flex items-start gap-2 rounded-lg bg-muted p-3 text-sm">
                <PauseCircle className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                <p className="text-muted-foreground">
                  {isFr
                    ? 'Ton abonnement est suspendu à la demande du studio. Aucun prélèvement n\'est effectué.'
                    : 'Your subscription is paused by the studio. No charges are being made.'}
                </p>
              </div>
            )}

            {/* Accès du cycle en cours. Intégré ici plutôt qu'en carte séparée :
                il porte le même nom que l'abonnement et passait pour un doublon. */}
            {subscriptionPack && (
              <button
                type="button"
                onClick={() => openPackDetail(subscriptionPack)}
                className="w-full text-left rounded-lg border p-3 hover:border-primary/40 transition"
              >
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wide">
                      {isFr ? 'Accès en cours' : 'Current access'}
                    </p>
                    <p className="font-semibold">
                      {subscriptionPack.pack_type?.is_unlimited
                        ? t('packs.unlimited')
                        : t('packs.creditsRemaining', { count: subscriptionPack.credits_remaining })}
                    </p>
                    {/* Un plafond qu'on découvre en butant dessus au moment de
                        réserver est vécu comme une panne. On le montre ici. */}
                    {(() => {
                      const q = quotaUsage.get(subscriptionPack.id)
                      if (!q) return null
                      return (
                        <p className={cn(
                          'text-xs mt-0.5',
                          q.remaining === 0 ? 'text-destructive' : 'text-muted-foreground',
                        )}>
                          {isFr
                            ? `${q.used} / ${q.quota_sessions} séances utilisées sur ce cycle`
                            : `${q.used} / ${q.quota_sessions} sessions used this cycle`}
                        </p>
                      )
                    })()}
                  </div>
                  <div className="text-right text-xs text-muted-foreground">
                    <p>
                      {isFr ? 'jusqu\'au ' : 'until '}
                      {format(new Date(subscriptionPack.expires_at), 'dd MMM yyyy', { locale })}
                    </p>
                    <p className="mt-0.5">{isFr ? 'Voir les réservations' : 'View bookings'}</p>
                  </div>
                </div>
              </button>
            )}

            {!subscription.cancel_at_period_end && subscription.status !== 'paused' && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCancelDialogOpen(true)}
              >
                {isFr ? 'Résilier mon abonnement' : 'Cancel subscription'}
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {packs.length === 0 ? (
        <EmptyState
          icon={CreditCard}
          message={t('packs.noActivePacks')}
          actionLabel={t('home.buyPack')}
          onAction={() => navigate('/packs')}
        />
      ) : (
        <>
        {/* Titre uniquement s'il y a un abonnement au-dessus : sans lui, deux
            cartes du même nom se suivaient sans que rien ne distingue le
            contrat de ses crédits. */}
        {subscription && standalonePacks.length > 0 && (
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide pt-2">
            {isFr ? 'Autres packs' : 'Other packs'}
          </h2>
        )}
        <div className="grid gap-4 md:grid-cols-2">
          {displayedPacks.map((pack) => {
            const isExpired = new Date(pack.expires_at) < now
            const isUnlimited = pack.pack_type?.is_unlimited ?? false
            // Un pack illimité n'est jamais "épuisé" : son compteur ne bouge pas.
            const isEmpty = !isUnlimited && pack.credits_remaining <= 0
            const creditLabel = i18n.language === 'fr'
              ? pack.pack_type?.credit_type?.label_fr
              : pack.pack_type?.credit_type?.label_en

            return (
              <Card
                key={pack.id}
                onClick={() => openPackDetail(pack)}
                className={`cursor-pointer hover:border-primary/40 hover:shadow-sm transition ${isExpired || isEmpty ? 'opacity-60' : ''}`}
              >
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
                      {isUnlimited
                        ? t('packs.unlimited')
                        : t('packs.creditsRemaining', { count: pack.credits_remaining })}
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

        {/* Rien d'utilisable, mais de l'historique : le dire, sinon la page
            paraît vide alors que des packs existent. */}
        {displayedPacks.length === 0 && spentCount > 0 && (
          <p className="text-sm text-muted-foreground text-center py-6">
            {isFr
              ? 'Aucun pack utilisable pour le moment.'
              : 'No usable pack at the moment.'}
          </p>
        )}

        {spentCount > 0 && (
          <button
            onClick={() => setShowAllPacks((v) => !v)}
            className="w-full text-xs text-muted-foreground hover:text-foreground transition-colors py-2"
          >
            {showAllPacks
              ? (isFr ? 'Masquer les packs terminés' : 'Hide finished packs')
              : (isFr
                ? `Voir aussi les packs terminés (${spentCount})`
                : `Also show finished packs (${spentCount})`)}
          </button>
        )}
        </>
      )}

      {/* Pack detail — bookings made with this pack */}
      <Dialog open={!!selectedPack} onOpenChange={(open) => { if (!open) setSelectedPack(null) }}>
        <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
          {selectedPack && (
            <>
              <DialogHeader>
                <DialogTitle>{selectedPack.pack_type?.name}</DialogTitle>
                <p className="text-sm text-muted-foreground">
                  {selectedPack.pack_type?.is_unlimited
                    ? (isFr ? 'Accès illimité' : 'Unlimited access')
                    : `${selectedPack.credits_remaining}/${selectedPack.pack_type?.credit_count} ${isFr ? 'crédits restants' : 'credits remaining'}`}
                  {' · '}
                  {isFr ? 'expire le' : 'expires'} {format(new Date(selectedPack.expires_at), 'dd/MM/yyyy')}
                </p>
              </DialogHeader>

              {packBookingsLoading ? (
                <LoadingState />
              ) : packBookings.length === 0 ? (
                <p className="text-sm text-muted-foreground py-6 text-center">
                  {isFr ? 'Aucun cours réservé avec ce pack' : 'No bookings on this pack'}
                </p>
              ) : (
                <div className="space-y-2 mt-2">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    {isFr ? 'Cours réservés' : 'Bookings'} ({packBookings.length})
                  </p>
                  {packBookings.map((booking) => {
                    const sc = booking.scheduled_class
                    const startsAt = new Date(sc.starts_at)
                    const isPast = startsAt < new Date()
                    const isCancelled = booking.status === 'cancelled'
                    const color = sc.class_type?.color || '#3B82F6'
                    return (
                      <div
                        key={booking.id}
                        className="flex items-center gap-3 p-2.5 rounded-lg border"
                        style={{ borderLeftWidth: '3px', borderLeftColor: color }}
                      >
                        <div className="flex flex-col items-center justify-center h-10 w-10 rounded-lg bg-muted shrink-0">
                          <span className="text-[10px] font-medium uppercase text-muted-foreground">
                            {format(startsAt, 'MMM', { locale })}
                          </span>
                          <span className="text-sm font-bold leading-none">
                            {format(startsAt, 'd')}
                          </span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate">{sc.class_type?.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {format(startsAt, 'HH:mm')} · {sc.duration_minutes}min
                          </p>
                        </div>
                        <div className="shrink-0">
                          {isCancelled ? (
                            <span className="flex items-center gap-1 text-xs text-muted-foreground">
                              <X className="h-3 w-3" />
                              {isFr ? 'Annulé' : 'Cancelled'}
                            </span>
                          ) : isPast ? (
                            <span className="text-xs text-muted-foreground">
                              {isFr ? 'Passé' : 'Past'}
                            </span>
                          ) : (
                            <span className="flex items-center gap-1 text-xs text-primary font-medium">
                              <Clock className="h-3 w-3" />
                              {isFr ? 'À venir' : 'Upcoming'}
                            </span>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Résiliation : on annonce la date de fin des droits avant de valider,
          pour que personne ne croie perdre une période déjà payée. */}
      <Dialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{isFr ? 'Résilier mon abonnement' : 'Cancel subscription'}</DialogTitle>
          </DialogHeader>

          <div className="space-y-3 text-sm">
            <p>
              {isFr
                ? 'Le renouvellement automatique sera arrêté.'
                : 'Automatic renewal will be stopped.'}
            </p>
            {subscription?.current_period_end && (
              <p className="font-medium">
                {isFr
                  ? `Tu conserves tes droits jusqu'au ${format(new Date(subscription.current_period_end), 'dd MMMM yyyy', { locale })}, période que tu as déjà payée.`
                  : `You keep your access until ${format(new Date(subscription.current_period_end), 'dd MMMM yyyy', { locale })}, the period you have already paid for.`}
              </p>
            )}
            <p className="text-muted-foreground">
              {isFr
                ? 'Tu pourras souscrire à nouveau à tout moment depuis la page Packs.'
                : 'You can subscribe again at any time from the Packs page.'}
            </p>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setCancelDialogOpen(false)} disabled={cancelling}>
              {isFr ? 'Garder mon abonnement' : 'Keep my subscription'}
            </Button>
            <Button variant="destructive" onClick={handleCancelSubscription} disabled={cancelling}>
              {cancelling
                ? (isFr ? 'Résiliation…' : 'Cancelling…')
                : (isFr ? 'Confirmer la résiliation' : 'Confirm cancellation')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

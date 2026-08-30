import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { ouvrirPaiement } from '@/lib/ouvrir-paiement'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { EmptyState } from '@/components/common/EmptyState'
import { LoadingState } from '@/components/common/LoadingState'
import { ShoppingBag, Check, Zap, Flame, AlertTriangle, RefreshCw, Receipt, TicketPercent } from 'lucide-react'
import { toast } from 'sonner'
import { cn, formatPackCredits, formatValidity } from '@/lib/utils'
import type { PackType, Subscription, CreditNote } from '@/types'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'

/**
 * Périodicité d'un abonnement, en clair.
 * « toutes les 4 semaines » plutôt que « tous les mois » : le cycle de 28 jours
 * produit 13 prélèvements par an, pas 12. Le client doit le lire tel quel.
 */
function formatRecurrence(pack: PackType, isFr: boolean): string {
  const n = pack.recurring_interval_count ?? 1
  const unit = pack.recurring_interval
  // Douze mois se dit « chaque année » : c'est ce que le membre comprend, et
  // c'est ainsi qu'un abonnement annuel se vend. « Tous les 12 mois » est juste
  // mais se lit comme une échéance administrative.
  const estAnnuel = unit === 'month' && n === 12
  if (isFr) {
    if (estAnnuel) return 'chaque année'
    if (unit === 'week') return n === 1 ? 'chaque semaine' : `toutes les ${n} semaines`
    return n === 1 ? 'chaque mois' : `tous les ${n} mois`
  }
  if (estAnnuel) return 'every year'
  if (unit === 'week') return n === 1 ? 'every week' : `every ${n} weeks`
  return n === 1 ? 'every month' : `every ${n} months`
}

export function PacksPage() {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const isFr = i18n.language === 'fr'
  const { user, profile, hasRegistrationFee, refreshProfile } = useAuth()
  const [packTypes, setPackTypes] = useState<PackType[]>([])
  const [loading, setLoading] = useState(true)
  /** Abonnement en cours : on n'en propose pas un second. */
  const [activeSubscription, setActiveSubscription] = useState<Subscription | null>(null)
  /** Bons d'achat utilisables, celui qui expire le plus tôt en tête. */
  const [creditNotes, setCreditNotes] = useState<CreditNote[]>([])
  /** Achat en attente de confirmation, quand un bon peut s'appliquer. */
  const [pendingPurchase, setPendingPurchase] = useState<{ pack: PackType | null; isFee: boolean } | null>(null)
  /** Pack en attente de commande sur facture (client professionnel). */
  const [pendingInvoice, setPendingInvoice] = useState<PackType | null>(null)
  const [invoiceOrdering, setInvoiceOrdering] = useState(false)
  /** Onglet de type de crédit choisi par le membre. Vide = premier groupe. */
  const [activeCreditTab, setActiveCreditTab] = useState('')
  /** Code promotionnel saisi, et sa validation par le serveur. */
  const [couponInput, setCouponInput] = useState('')
  const [couponChecking, setCouponChecking] = useState(false)
  const [appliedCoupon, setAppliedCoupon] = useState<{ code: string; discount_cents: number | null } | null>(null)
  const [useCreditNote, setUseCreditNote] = useState(true)
  /** Le membre a-t-il déjà un parrain ? Sinon on lui propose de saisir un code. */
  const [hasReferrer, setHasReferrer] = useState(true)
  const [referralInput, setReferralInput] = useState('')
  const [referralClaiming, setReferralClaiming] = useState(false)

  useEffect(() => {
    const fetchPacks = async () => {
      const { data } = await supabase
        .from('pack_types')
        .select('*, credit_type:credit_types(*), categories:pack_type_categories(member_category_id)')
        .eq('is_active', true)
        // La séance d'essai est offerte, pas vendue : elle reste active (donc
        // utilisable) mais ne figure pas au catalogue.
        .eq('is_purchasable', true)
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

      if (user) {
        const { data: sub } = await supabase
          .from('subscriptions')
          .select('*, pack_type:pack_types(*)')
          .eq('user_id', user.id)
          .in('status', ['active', 'past_due', 'paused', 'incomplete'])
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle()
        setActiveSubscription((sub as Subscription) ?? null)

        const { data: notes } = await supabase.rpc('get_usable_credit_notes', {
          p_user_id: user.id,
        })
        setCreditNotes((notes as CreditNote[]) ?? [])

        // Beaucoup oublient le code à l'inscription : on le repropose au
        // moment de payer, quand ils l'ont sous les yeux.
        const { data: ref } = await supabase
          .from('referrals')
          .select('id')
          .eq('referee_id', user.id)
          .limit(1)
        setHasReferrer((ref?.length ?? 0) > 0)
      }

      setLoading(false)
    }
    fetchPacks()
  }, [profile, user])

  const [regFeeLoading, setRegFeeLoading] = useState(false)

  /**
   * Bons activables pour l'achat en cours.
   *
   * Le filtrage se fait côté base : `get_usable_credit_notes` connaît le seuil
   * minimum d'achat et ne renvoie que ce qui s'applique. L'interface n'a donc
   * aucune règle à dupliquer — elle demande, elle affiche.
   */
  const [applicableNotes, setApplicableNotes] = useState<CreditNote[]>([])

  const loadApplicableNotes = async (purchaseCents: number) => {
    if (!user) return []
    const { data } = await supabase.rpc('get_usable_credit_notes', {
      p_user_id: user.id,
      p_purchase_cents: purchaseCents,
    })
    const list = (data as CreditNote[]) ?? []
    setApplicableNotes(list)
    return list
  }

  /** Le bon qu'on proposera : celui qui expire le plus tôt. */
  const bestNote = applicableNotes[0] ?? null
  /** Seuil affiché quand un bon existe mais que l'achat est trop petit. */
  const minPurchaseCents = creditNotes[0]?.min_purchase_cents ?? 3000
  const hasBlockedNote = applicableNotes.length === 0 && creditNotes.length > 0

  /**
   * Enregistre le code du parrain saisi au moment de payer.
   *
   * Le parrainage doit exister AVANT le paiement : c'est le webhook qui
   * qualifie une fois l'argent reçu, et il ne trouvera rien si le lien n'est
   * pas encore là.
   */
  const claimReferral = async () => {
    if (!referralInput.trim()) return
    setReferralClaiming(true)
    try {
      const { data, error } = await supabase.rpc('claim_referral_code', {
        p_referral_code: referralInput.trim(),
      })
      if (error) { toast.error(t('common.error')); return }

      const res = data as { ok: boolean; error?: string }
      if (res?.ok) {
        setHasReferrer(true)
        setReferralInput('')
        toast.success(isFr
          ? 'Code de parrainage enregistré. Ton bon arrivera après ce paiement.'
          : 'Referral code saved. Your credit note will arrive after this payment.')
        return
      }

      const messages: Record<string, { fr: string; en: string }> = {
        unknown_code: { fr: 'Ce code de parrainage n\'existe pas.', en: 'This referral code does not exist.' },
        already_referred: { fr: 'Tu as déjà un parrain.', en: 'You already have a referrer.' },
        self_referral: { fr: 'Tu ne peux pas utiliser ton propre code.', en: 'You cannot use your own code.' },
      }
      const m = messages[res?.error ?? '']
      toast.error(m ? (isFr ? m.fr : m.en) : t('common.error'))
    } finally {
      setReferralClaiming(false)
    }
  }

  const handlePayRegistrationFee = async () => {
    // La base décide quels bons s'appliquent à ce montant : on interroge avant
    // d'ouvrir la fenêtre, et on affiche ce qu'elle renvoie.
    const notes = await loadApplicableNotes(3000)
    if (notes.length > 0 || creditNotes.length > 0 || !hasReferrer) {
      setUseCreditNote(notes.length > 0)
      setPendingPurchase({ pack: null, isFee: true })
      return
    }
    startRegistrationFee()
  }

  const startRegistrationFee = async (noteId?: string) => {
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
            credit_note_id: noteId ?? null,
            success_url: `${window.location.origin}/packs?fee_paid=true`,
            cancel_url: `${window.location.origin}/packs?cancelled=true`,
          }),
        }
      )
      const data = await response.json()
      // Bon couvrant la totalité : rien à payer, tout s'est fait côté serveur.
      if (data.paid_with_credit_note) {
        toast.success(isFr
          ? 'Frais d\'inscription couverts par ton bon. Rien à payer.'
          : 'Registration fee covered by your credit note. Nothing to pay.')
        setPendingPurchase(null)
        refreshProfile()
        window.location.reload()
        return
      }
      if (data.url) {
        setPendingPurchase(null)
        await ouvrirPaiement(data.url)
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
  // Démarrage différé : vide = l'abonnement commence tout de suite. Renseigné,
  // la carte est enregistrée maintenant et le premier prélèvement attend la
  // date choisie (vendre en août un abonnement qui commence en septembre).
  const [subStartsOn, setSubStartsOn] = useState('')
  // Stripe refuse un report de moins de 48 h : on empêche la saisie plutôt que
  // de laisser le serveur refuser après coup.
  const minStartDate = new Date(Date.now() + 49 * 3600 * 1000).toISOString().slice(0, 10)

  /** Le studio a qualifié ce membre comme professionnel : il paie sur facture. */
  const isBusiness = profile?.is_business === true

  /**
   * Commande sur facture.
   *
   * Le pack est crédité immédiatement : l'employé doit pouvoir s'entraîner
   * sans attendre le circuit comptable de son employeur. Le studio suit
   * l'encaissement de son côté.
   */
  const confirmInvoiceOrder = async () => {
    if (!pendingInvoice) return
    setInvoiceOrdering(true)
    const { data, error } = await supabase.rpc('order_pack_on_invoice', {
      p_pack_type_id: pendingInvoice.id,
    })
    setInvoiceOrdering(false)

    if (error) { toast.error(error.message); return }

    const res = data as { ok: boolean; reason?: string } | null
    if (!res?.ok) {
      const messages: Record<string, string> = {
        not_business: isFr
          ? 'Ton profil n\'est pas enregistré comme professionnel. Contacte le studio.'
          : 'Your profile is not registered as a business. Contact the studio.',
        company_missing: isFr
          ? 'Il manque la raison sociale sur ton profil. Contacte le studio.'
          : 'Your company name is missing. Contact the studio.',
        registration_fee_due: isFr
          ? 'Les frais d\'inscription doivent être réglés d\'abord.'
          : 'Registration fee must be paid first.',
        recurring_not_supported: isFr
          ? 'Les abonnements ne se commandent pas sur facture.'
          : 'Subscriptions cannot be ordered by invoice.',
      }
      toast.error(messages[res?.reason ?? ''] ?? (isFr ? 'Commande impossible' : 'Order failed'))
      return
    }

    toast.success(isFr
      ? 'Commande enregistrée. Ton pack est actif, la facture suivra.'
      : 'Order placed. Your pack is active, the invoice will follow.')
    setPendingInvoice(null)
    navigate('/my-packs')
  }

  /**
   * Vérifie un code avant le paiement.
   *
   * Le membre doit savoir ce que vaut son code AVANT d'être envoyé sur Stripe :
   * découvrir un refus sur la page de paiement, sans explication, est le plus
   * sûr moyen de faire abandonner un achat. La fonction ne consomme rien —
   * le décompte se fait au paiement confirmé.
   */
  const verifyCoupon = async (purchaseCents: number) => {
    if (!couponInput.trim()) return
    setCouponChecking(true)
    const { data, error } = await supabase.rpc('check_coupon', {
      p_code: couponInput.trim(),
      p_purchase_cents: purchaseCents,
    })
    setCouponChecking(false)

    if (error) { toast.error(t('common.error')); return }

    const res = data as {
      ok: boolean; reason?: string; code?: string; discount_cents?: number | null
    } | null

    if (!res?.ok) {
      const messages: Record<string, string> = {
        unknown_code: isFr ? 'Ce code n\'existe pas.' : 'This code does not exist.',
        expired: isFr ? 'Ce code a expiré.' : 'This code has expired.',
        not_yet_valid: isFr ? 'Ce code n\'est pas encore actif.' : 'This code is not active yet.',
        exhausted: isFr ? 'Ce code a atteint sa limite d\'utilisation.' : 'This code reached its usage limit.',
        // Distinct d'`exhausted` : « tu l'as déjà utilisé » et « il est épuisé »
        // appellent des réactions différentes, et le second laisserait croire
        // qu'on est arrivé trop tard alors qu'on en a déjà profité.
        already_used: isFr
          ? 'Tu as déjà utilisé ce code — il ne vaut qu\'une fois.'
          : 'You have already used this code — it works once per person.',
        not_eligible: isFr
          ? 'Ce code ne s\'applique pas à ton profil.'
          : 'This code does not apply to your profile.',
      }
      toast.error(messages[res?.reason ?? ''] ?? (isFr ? 'Code invalide' : 'Invalid code'))
      return
    }

    setAppliedCoupon({ code: res.code!, discount_cents: res.discount_cents ?? null })
    toast.success(isFr ? 'Code appliqué' : 'Code applied')
  }

  const clearCoupon = () => {
    setAppliedCoupon(null)
    setCouponInput('')
  }

  const handleBuy = async (packType: PackType) => {
    if (!hasRegistrationFee) {
      toast.error(t('packs.registrationFeeRequired'))
      return
    }

    // Client professionnel : commande sur facture, sans carte. Les abonnements
    // restent exclus — un prélèvement automatique n'a pas de sens sur facture.
    if (isBusiness && !packType.is_recurring) {
      setPendingInvoice(packType)
      return
    }
    // Un abonnement engage des prélèvements répétés : on demande une
    // confirmation explicite plutôt que de lancer le paiement sur un clic.
    if (packType.is_recurring) {
      // La section est déjà masquée ; ceci couvre un état de page périmé.
      if (activeSubscription) {
        toast.error(isFr
          ? 'Tu as déjà un abonnement en cours.'
          : 'You already have an active subscription.')
        return
      }
      const subNotes = await loadApplicableNotes(packType.price_cents)
      setUseCreditNote(subNotes.length > 0)
      setPendingSubscription(packType)
      return
    }
    // Pack ponctuel : confirmation s'il y a un bon (applicable ou bloqué par le
    // seuil, qu'on explique), ou si le membre peut encore déclarer un parrain.
    const notes = await loadApplicableNotes(packType.price_cents)
    if (notes.length > 0 || creditNotes.length > 0 || !hasReferrer) {
      setUseCreditNote(notes.length > 0)
      setPendingPurchase({ pack: packType, isFee: false })
      return
    }
    await startCheckout(packType)
  }

  const startCheckout = async (packType: PackType, noteId?: string, startsOn?: string) => {
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
            credit_note_id: noteId ?? null,
            coupon_code: appliedCoupon?.code ?? null,
            starts_on: startsOn ?? null,
            success_url: `${window.location.origin}/my-packs?success=true`,
            cancel_url: `${window.location.origin}/packs?cancelled=true`,
          }),
        }
      )
      const data = await response.json()
      // Bon couvrant la totalité : le pack est déjà crédité, rien à payer.
      if (data.paid_with_credit_note) {
        toast.success(isFr
          ? 'Pack activé, couvert par ton bon. Rien à payer.'
          : 'Pack activated, covered by your credit note. Nothing to pay.')
        setPendingPurchase(null)
        navigate('/my-packs')
        return
      }
      if (data.url) {
        setPendingPurchase(null)
        await ouvrirPaiement(data.url)
      } else {
        toast.error(data.error || t('common.error'))
      }
    } catch { toast.error(t('common.error')) }
  }

  if (loading) return <LoadingState />

  // Les abonnements passent devant : c'est la formule que le studio met en
  // avant. Les packs ponctuels restent disponibles, en second rideau.
  // Le type de crédit commande tout : un crédit Personal Training ne paie pas
  // un cours semi-privé. Acheté sans le voir, le pack devient inutilisable —
  // c'est arrivé en test. Il devient donc le premier niveau de lecture, et les
  // formules se rangent dessous.
  const creditTypeGroups = (() => {
    const map = new Map<string, { label: string; nomInterne: string; subscriptions: PackType[]; oneOff: PackType[] }>()
    for (const p of packTypes) {
      // Un professionnel ne voit pas les abonnements : ils se prélèvent
      // automatiquement par carte, ce qui n'a pas de sens sur facture. Le
      // filtre suit `is_business` plutôt qu'une catégorie dédiée — deux
      // marqueurs pour le même fait finiraient par diverger, et un membre
      // oublié en catégorie tomberait sur un paiement Stripe inattendu.
      if (isBusiness && p.is_recurring) continue

      const key = p.credit_type_id
      const label = (isFr ? p.credit_type?.label_fr : p.credit_type?.label_en)
        ?? p.credit_type?.name
        ?? (isFr ? 'Autres' : 'Other')
      // Le nom technique sert au tri, comme au planning.
      if (!map.has(key)) map.set(key, { label, nomInterne: p.credit_type?.name ?? '', subscriptions: [], oneOff: [] })
      const g = map.get(key)!
      if (p.is_recurring) g.subscriptions.push(p)
      else g.oneOff.push(p)
    }
    // Les packs promus remontent en tête de leur section : un bandeau au milieu
    // d'une grille se remarque moins qu'une carte placée en premier.
    for (const g of map.values()) {
      const promuDAbord = (a: PackType, b: PackType) =>
        Number(b.is_featured ?? false) - Number(a.is_featured ?? false)
      g.subscriptions.sort(promuDAbord)
      g.oneOff.sort(promuDAbord)
    }
    // Le semi-prive d'abord, le personal training ensuite — le meme ordre
    // qu'au planning, ou l'onglet semi-prive s'ouvre par defaut. Le tri
    // precedent partait de « qui propose un abonnement », puis de l'ordre
    // alphabetique : « Personal Training » passait donc avant « Semi-prive »,
    // et les deux ecrans se contredisaient sur ce que le studio vend d'abord.
    const rang = (nom: string) =>
      nom === 'semi_prive' ? 0 : nom === 'personal_training' ? 1 : 2
    return [...map.values()].sort((a, b) =>
      rang(a.nomInterne) - rang(b.nomInterne) || a.label.localeCompare(b.label))
  })()

  /**
   * Onglet affiché : le choix du membre, ou le premier groupe.
   *
   * Calculé au rendu plutôt que posé dans un effet — écrire un état depuis un
   * effet provoque un second rendu pour un résultat qu'on sait déduire. Le
   * repli sur le premier groupe couvre aussi le cas où l'onglet choisi
   * disparaît (un professionnel dont les abonnements sont masqués).
   */
  const shownCreditTab = creditTypeGroups.some(g => g.label === activeCreditTab)
    ? activeCreditTab
    : creditTypeGroups[0]?.label ?? ''

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
        {/* Ordre des bandeaux : la promotion d'abord — c'est le message que le
            studio a délibérément choisi de pousser, il prime sur l'information
            générique. Vient ensuite l'abonnement, dont l'engagement récurrent
            est ce que le client doit savoir avant tout le reste. */}
        {isPopular ? (
          <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-10">
            <span className="flex items-center gap-1 bg-primary text-primary-foreground text-xs font-semibold px-3 py-1 rounded-full whitespace-nowrap">
              <Flame className="h-3 w-3" />
              {pack.featured_label?.trim() || (isFr ? 'Recommandé' : 'Recommended')}
            </span>
          </div>
        ) : pack.is_recurring ? (
          <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-10">
            <span className="flex items-center gap-1 bg-primary text-primary-foreground text-xs font-semibold px-3 py-1 rounded-full">
              <RefreshCw className="h-3 w-3" />
              {isFr ? 'Abonnement' : 'Subscription'}
            </span>
          </div>
        ) : null}

        <div className={cn(
          'rounded-xl border bg-card p-6 flex flex-col h-full transition-all',
          // Le promu se distingue de l'abonnement, qui porte déjà un cadre :
          // sans anneau plus marqué, la mise en avant passerait inaperçue au
          // milieu d'abonnements déjà tous encadrés.
          isPopular
            ? 'border-primary ring-2 ring-primary/50 shadow-xl shadow-primary/20'
            : highlighted
              ? 'border-primary ring-1 ring-primary/30 shadow-lg shadow-primary/10'
              : 'border-border hover:border-muted-foreground/30'
        )}>
          {/* Name + description */}
          <h3 className="text-lg font-bold">{pack.name}</h3>
          {/* Type de crédit rappelé sur la carte : le titre de section disparaît
              au défilement, et c'est lui qui détermine les cours accessibles. */}
          <span className="inline-flex self-start mt-1 rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
            {creditLabel}
          </span>
          {pack.description && (
            <p className="text-sm text-muted-foreground mt-1.5">{pack.description}</p>
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
              // Un professionnel ne paie pas maintenant : le bouton doit dire
              // ce qui va réellement se passer, pas « Acheter ».
              : isBusiness
                ? (isFr ? 'Payer par facture' : 'Pay by invoice')
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
          {isBusiness
            // Un professionnel ne voit aucun abonnement : lui parler de
            // s'abonner n'aurait pas de sens.
            ? (isFr
              ? 'Choisis un pack pour ton entreprise : les crédits sont disponibles tout de suite, la facture suit.'
              : 'Pick a pack for your company: credits are available right away, the invoice follows.')
            : (isFr
              ? 'Abonne-toi pour venir régulièrement sans y penser, ou achète des crédits à l\'unité 🔥'
              : 'Subscribe to train regularly without thinking about it, or buy credits one pack at a time 🔥')}
        </p>
      </div>

      {/* Compte professionnel : dit AVANT tout clic que rien ne sera prélevé.
          Sans ce repère, le membre découvre le mode de paiement au moment de
          valider — trop tard pour qu'il comprenne où il est. */}
      {isBusiness && (
        <div className="max-w-2xl mx-auto rounded-xl border border-blue-500/40 bg-blue-50 dark:bg-blue-950/20 p-4">
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-500/15">
              <Receipt className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            </div>
            <div className="min-w-0">
              <p className="font-semibold text-blue-900 dark:text-blue-200">
                {isFr ? 'Compte professionnel' : 'Business account'}
                {profile?.company_name ? ` — ${profile.company_name}` : ''}
              </p>
              <p className="text-sm text-blue-800/80 dark:text-blue-300/80 mt-1">
                {isFr
                  ? 'Aucun paiement par carte : tes commandes sont facturées. Les crédits sont activés dès la commande, tu peux réserver sans attendre le règlement.'
                  : 'No card payment: your orders are invoiced. Credits are activated on order — you can book before payment goes through.'}
              </p>
            </div>
          </div>
        </div>
      )}

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
          {/* Déjà abonné : on ne propose pas un second abonnement, on rappelle
              celui en cours et on renvoie vers sa gestion. */}
          {activeSubscription && (
            <Card className="border-primary/40 max-w-2xl mx-auto">
              <CardContent className="pt-6">
                <div className="flex items-start gap-4">
                  <RefreshCw className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <h3 className="font-semibold">
                      {isFr ? 'Tu es déjà abonné' : 'You are already subscribed'}
                      {activeSubscription.pack_type?.name && ` — ${activeSubscription.pack_type.name}`}
                    </h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      {isFr
                        ? 'Pour changer de formule ou résilier, passe par « Mes packs ». Un seul abonnement à la fois.'
                        : 'To change plan or cancel, go to "My packs". One subscription at a time.'}
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-3"
                      onClick={() => navigate('/my-packs')}
                    >
                      {isFr ? 'Voir mon abonnement' : 'View my subscription'}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Un onglet par type de crédit.
              Les blocs étaient empilés : semi-privé d'abord, personal training
              tout en bas. Un client PT devait faire défiler toute la page pour
              trouver ce qui le concerne. Les onglets mettent les deux au même
              niveau — et le type de crédit reste le premier choix, puisqu'un
              crédit PT ne paie pas un cours semi-privé. */}
          {creditTypeGroups.length > 1 && (
            <div className="flex justify-center">
              <div className="inline-flex rounded-lg border bg-muted/30 p-1">
                {creditTypeGroups.map((group) => (
                  <button
                    key={group.label}
                    type="button"
                    onClick={() => setActiveCreditTab(group.label)}
                    className={cn(
                      'px-4 py-2 rounded-md text-sm font-medium transition-colors',
                      shownCreditTab === group.label
                        ? 'bg-background shadow-sm'
                        : 'text-muted-foreground hover:text-foreground',
                    )}
                  >
                    {group.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {creditTypeGroups
            .filter((group) => creditTypeGroups.length === 1 || group.label === shownCreditTab)
            .map((group) => (
            <div key={group.label} className="space-y-5">
              {/* Le titre ne se répète pas quand l'onglet le porte déjà. */}
              {creditTypeGroups.length === 1 && (
                <div className="text-center">
                  <h2 className="text-2xl font-bold">{group.label}</h2>
                  <div className="mx-auto mt-2 h-px w-16 bg-border" />
                </div>
              )}

              {/* Abonnements du type */}
              {!activeSubscription && group.subscriptions.length > 0 && (
                <div className="space-y-3">
                  <div className="text-center">
                    <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                      {isFr ? 'Abonnements' : 'Subscriptions'}
                    </h3>
                    <p className="text-xs text-muted-foreground mt-1">
                      {isFr
                        ? 'Renouvellement automatique. Résiliable à tout moment.'
                        : 'Renews automatically. Cancel any time.'}
                    </p>
                  </div>
                  <div className="flex justify-center">
                    <div className={gridClass(group.subscriptions.length)}>
                      {group.subscriptions.map((pack, index) => renderPack(pack, index, !!pack.is_featured))}
                    </div>
                  </div>
                </div>
              )}

              {/* Packs ponctuels du type */}
              {group.oneOff.length > 0 && (
                <div className="space-y-3">
                  <div className="text-center">
                    <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                      {isFr ? "Packs à l'unité" : 'One-off packs'}
                    </h3>
                    <p className="text-xs text-muted-foreground mt-1">
                      {isFr
                        ? 'Sans engagement : tu achètes tes crédits quand tu en as besoin.'
                        : 'No commitment: buy credits whenever you need them.'}
                    </p>
                  </div>
                  <div className="flex justify-center">
                    <div className={gridClass(group.oneOff.length)}>
                      {group.oneOff.map((pack, index) => renderPack(pack, index, !!pack.is_featured))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Commande sur facture — clients professionnels. Le pack est actif
          immédiatement, la facture suit : c'est un engagement, on le dit
          clairement avant de valider. */}
      <Dialog
        open={!!pendingInvoice}
        onOpenChange={(open) => { if (!open) setPendingInvoice(null) }}
      >
        <DialogContent className="max-w-md">
          {pendingInvoice && (
            <>
              <DialogHeader>
                <DialogTitle>
                  {isFr ? 'Commander sur facture' : 'Order by invoice'}
                </DialogTitle>
              </DialogHeader>

              <div className="space-y-3">
                <div className="rounded-lg border p-3">
                  <p className="font-semibold">{pendingInvoice.name}</p>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    {formatPackCredits(pendingInvoice, isFr)}
                  </p>
                  <p className="text-lg font-bold mt-2">
                    {(pendingInvoice.price_cents / 100).toFixed(2).replace('.', ',')} €
                  </p>
                </div>

                <div className="rounded-lg bg-muted/50 p-3 text-sm space-y-1">
                  <p>
                    {isFr
                      ? 'La facture sera établie au nom de '
                      : 'The invoice will be issued to '}
                    <strong>{profile?.company_name}</strong>.
                  </p>
                  <p className="text-muted-foreground">
                    {isFr
                      ? 'Tes crédits sont disponibles immédiatement : tu peux réserver sans attendre le règlement.'
                      : 'Your credits are available right away — you can book before payment goes through.'}
                  </p>
                </div>
              </div>

              <DialogFooter className="gap-2 sm:gap-0">
                <Button variant="outline" onClick={() => setPendingInvoice(null)} disabled={invoiceOrdering}>
                  {t('common.cancel')}
                </Button>
                <Button onClick={confirmInvoiceOrder} disabled={invoiceOrdering}>
                  {invoiceOrdering
                    ? '...'
                    : (isFr ? 'Confirmer la commande' : 'Confirm order')}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Proposition du bon d'achat sur un achat ponctuel ou les frais
          d'inscription. Le bon n'est jamais appliqué d'office : le membre
          confirme, et s'il perd de la valeur, il le sait avant. */}
      <Dialog
        open={!!pendingPurchase}
        onOpenChange={(open) => { if (!open) setPendingPurchase(null) }}
      >
        <DialogContent className="max-w-md">
          {pendingPurchase && (() => {
            const priceCents = pendingPurchase.isFee
              ? 3000
              : pendingPurchase.pack?.price_cents ?? 0
            const noteCents = bestNote?.amount_cents ?? 0
            const loss = Math.max(0, noteCents - priceCents)
            const due = Math.max(0, priceCents - noteCents)
            const eur = (c: number) => `${(c / 100).toFixed(2).replace('.', ',')} €`

            return (
              <>
                <DialogHeader>
                  <DialogTitle>
                    {pendingPurchase.isFee
                      ? (isFr ? 'Frais d\'inscription' : 'Registration fee')
                      : pendingPurchase.pack?.name}
                  </DialogTitle>
                </DialogHeader>

                <div className="space-y-4 text-sm">
                  <div className="rounded-lg border p-3 space-y-1">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">{isFr ? 'Montant' : 'Amount'}</span>
                      <span>{eur(priceCents)}</span>
                    </div>
                    {bestNote && useCreditNote && (
                      <div className="flex justify-between text-green-600">
                        <span>{isFr ? 'Bon' : 'Credit note'} {bestNote.code}</span>
                        <span>-{eur(Math.min(noteCents, priceCents))}</span>
                      </div>
                    )}
                    <div className="flex justify-between font-semibold pt-1 border-t">
                      <span>{isFr ? 'À payer' : 'To pay'}</span>
                      <span>{bestNote && useCreditNote ? eur(due) : eur(priceCents)}</span>
                    </div>
                  </div>

                  {bestNote && (
                    <label className="flex items-start gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={useCreditNote}
                        onChange={(e) => setUseCreditNote(e.target.checked)}
                        className="h-4 w-4 rounded border-gray-300 mt-0.5"
                      />
                      <span>
                        {isFr
                          ? `Utiliser mon bon de ${eur(noteCents)}`
                          : `Use my ${eur(noteCents)} credit note`}
                        {bestNote.expires_at && (
                          <span className="block text-xs text-muted-foreground">
                            {isFr ? 'Valable jusqu\'au ' : 'Valid until '}
                            {new Date(bestNote.expires_at).toLocaleDateString('fr-BE')}
                            {creditNotes.length > 1 && (isFr
                              ? ` · ${creditNotes.length} bons disponibles`
                              : ` · ${creditNotes.length} notes available`)}
                          </span>
                        )}
                      </span>
                    </label>
                  )}

                  {/* Le membre a un bon, mais cet achat est trop petit pour
                      l'activer. On le dit plutôt que de masquer le bon : sinon
                      il croirait l'avoir perdu. */}
                  {hasBlockedNote && (
                    <div className="flex items-start gap-2 rounded-lg bg-muted p-3">
                      <TicketPercent className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                      <p className="text-muted-foreground">
                        {isFr
                          ? `Tu as un bon de ${eur(creditNotes[0].amount_cents)}, utilisable à partir de ${eur(minPurchaseCents)} d'achat. Il reste disponible pour un pack plus important.`
                          : `You have a ${eur(creditNotes[0].amount_cents)} credit note, usable from ${eur(minPurchaseCents)} of purchase. It stays available for a bigger pack.`}
                      </p>
                    </div>
                  )}

                  {/* Dernier moment utile pour déclarer un parrain : le membre
                      a son code sous les yeux quand il paie. Le parrainage doit
                      exister AVANT le paiement, sinon le webhook ne trouvera
                      rien à qualifier. */}
                  {!hasReferrer && (
                    <div className="rounded-lg border border-dashed p-3 space-y-2">
                      <p className="text-sm font-medium">
                        {isFr ? 'Tu as été parrainé ?' : 'Were you referred?'}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {isFr
                          ? 'Saisis le code de ton parrain : vous recevrez chacun un bon de 30 € après ce paiement.'
                          : 'Enter your referrer\'s code: you will each receive a 30 € credit note after this payment.'}
                      </p>
                      <div className="flex gap-2">
                        <Input
                          value={referralInput}
                          onChange={(e) => setReferralInput(e.target.value.toUpperCase())}
                          placeholder={isFr ? 'Code du parrain' : 'Referrer code'}
                          className="h-9"
                          autoComplete="off"
                        />
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-9 shrink-0"
                          disabled={!referralInput.trim() || referralClaiming}
                          onClick={claimReferral}
                        >
                          {referralClaiming
                            ? (isFr ? '…' : '…')
                            : (isFr ? 'Valider' : 'Apply')}
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* Code promotionnel. Le champ n'existait nulle part : on
                      pouvait créer des coupons que personne ne pouvait saisir.
                      Il vit ici, au moment de payer — donc jamais chez un
                      client professionnel, qui règle sur facture.
                      Un bon d'achat et un coupon ne se cumulent pas : le
                      serveur refuse, autant ne pas le proposer. */}
                  {!(bestNote && useCreditNote) && (
                    <div className="rounded-lg border p-3 space-y-2">
                      <p className="font-medium text-sm">
                        {isFr ? 'Code promo' : 'Promo code'}
                      </p>
                      {appliedCoupon ? (
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm text-emerald-600 dark:text-emerald-400">
                            <span className="font-mono font-semibold">{appliedCoupon.code}</span>
                            {appliedCoupon.discount_cents
                              ? ` — ${eur(appliedCoupon.discount_cents)} ${isFr ? 'de remise' : 'off'}`
                              : ''}
                          </p>
                          <Button variant="ghost" size="sm" onClick={clearCoupon}>
                            {isFr ? 'Retirer' : 'Remove'}
                          </Button>
                        </div>
                      ) : (
                        <div className="flex gap-2">
                          <Input
                            value={couponInput}
                            onChange={(e) => setCouponInput(e.target.value.toUpperCase())}
                            placeholder={isFr ? 'Ton code' : 'Your code'}
                            className="font-mono"
                          />
                          <Button
                            variant="outline"
                            disabled={couponChecking || !couponInput.trim()}
                            onClick={() => verifyCoupon(priceCents)}
                          >
                            {couponChecking ? '…' : (isFr ? 'Valider' : 'Apply')}
                          </Button>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Le bon vaut plus que l'achat : la différence est perdue.
                      On le dit avant, le membre choisit de reporter ou non. */}
                  {bestNote && useCreditNote && loss > 0 && (
                    <div className="flex items-start gap-2 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-500/40 p-3">
                      <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                      <p className="text-amber-900 dark:text-amber-200">
                        {isFr
                          ? `Ton bon vaut ${eur(bestNote.amount_cents)}, cet achat coûte ${eur(priceCents)}. Tu perdrais ${eur(loss)}. Tu peux le garder pour un achat plus important.`
                          : `Your note is worth ${eur(bestNote.amount_cents)}, this purchase costs ${eur(priceCents)}. You would lose ${eur(loss)}. You can keep it for a bigger purchase.`}
                      </p>
                    </div>
                  )}
                </div>

                <DialogFooter className="gap-2 sm:gap-0">
                  <Button variant="outline" onClick={() => setPendingPurchase(null)}>
                    {isFr ? 'Annuler' : 'Cancel'}
                  </Button>
                  <Button
                    disabled={regFeeLoading}
                    onClick={() => {
                      const noteId = bestNote && useCreditNote ? bestNote.id : undefined
                      if (pendingPurchase.isFee) startRegistrationFee(noteId)
                      else if (pendingPurchase.pack) startCheckout(pendingPurchase.pack, noteId)
                    }}
                  >
                    {isFr ? 'Continuer' : 'Continue'}
                  </Button>
                </DialogFooter>
              </>
            )
          })()}
        </DialogContent>
      </Dialog>

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

                {/* Déclaration d'un parrain, ici aussi : une souscription est
                    souvent le premier achat, donc le moment où le parrainage
                    se qualifie. */}
                {!hasReferrer && (
                  <div className="rounded-lg border border-dashed p-3 space-y-2">
                    <p className="text-sm font-medium">
                      {isFr ? 'Tu as été parrainé ?' : 'Were you referred?'}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {isFr
                        ? 'Saisis le code de ton parrain : vous recevrez chacun un bon de 30 € après ce paiement.'
                        : 'Enter your referrer\'s code: you will each receive a 30 € credit note after this payment.'}
                    </p>
                    <div className="flex gap-2">
                      <Input
                        value={referralInput}
                        onChange={(e) => setReferralInput(e.target.value.toUpperCase())}
                        placeholder={isFr ? 'Code du parrain' : 'Referrer code'}
                        className="h-9"
                        autoComplete="off"
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-9 shrink-0"
                        disabled={!referralInput.trim() || referralClaiming}
                        onClick={claimReferral}
                      >
                        {isFr ? 'Valider' : 'Apply'}
                      </Button>
                    </div>
                  </div>
                )}

                {/* Bon d'achat : il ne vaut que pour la PREMIÈRE échéance
                    (coupon Stripe duration:once). Les suivantes repartent au
                    tarif plein — c'est ce que dit le texte. */}
                {bestNote && (
                  <label className="flex items-start gap-2 cursor-pointer rounded-lg border p-3">
                    <input
                      type="checkbox"
                      checked={useCreditNote}
                      onChange={(e) => setUseCreditNote(e.target.checked)}
                      className="h-4 w-4 rounded border-gray-300 mt-0.5"
                    />
                    <span>
                      {isFr
                        ? `Utiliser mon bon de ${(bestNote.amount_cents / 100).toFixed(2).replace('.', ',')} €`
                        : `Use my ${(bestNote.amount_cents / 100).toFixed(2).replace('.', ',')} € credit note`}
                      <span className="block text-xs text-muted-foreground">
                        {isFr
                          ? 'Déduit de la première échéance seulement. Les suivantes reviennent au tarif normal.'
                          : 'Applied to the first payment only. Later payments return to the normal price.'}
                      </span>
                    </span>
                  </label>
                )}

                <div className="space-y-1.5">
                  <label htmlFor="sub-starts-on" className="text-sm font-medium">
                    {isFr ? 'Démarrer plus tard (facultatif)' : 'Start later (optional)'}
                  </label>
                  <input
                    id="sub-starts-on"
                    type="date"
                    value={subStartsOn}
                    min={minStartDate}
                    onChange={(e) => setSubStartsOn(e.target.value)}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  />
                  <p className="text-xs text-muted-foreground">
                    {subStartsOn
                      ? (isFr
                        ? `Ta carte est enregistrée aujourd'hui, mais rien n'est prélevé avant le ${new Date(subStartsOn).toLocaleDateString('fr-BE')}. Tes crédits arrivent à cette date : aucune séance n'est réservable avant.`
                        : `Your card is saved today, but nothing is charged before ${new Date(subStartsOn).toLocaleDateString('en-GB')}. Your credits arrive on that date: no session can be booked before.`)
                      : (isFr
                        ? 'Laisse vide pour commencer tout de suite. Une date au moins 48 h plus tard décale le premier prélèvement.'
                        : 'Leave empty to start now. A date at least 48 h from now defers the first charge.')}
                  </p>
                </div>

                <div className="flex items-start gap-2 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-500/40 p-3">
                  <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                  <p className="text-amber-900 dark:text-amber-200">
                    {isFr
                      ? `Ce montant sera prélevé automatiquement ${formatRecurrence(pendingSubscription, true)}${subStartsOn ? `, à partir du ${new Date(subStartsOn).toLocaleDateString('fr-BE')}` : ''}, jusqu'à résiliation. Tu peux résilier à tout moment depuis « Mes packs » : tes droits restent acquis jusqu'à la fin de la période déjà payée.`
                      : `This amount will be charged automatically ${formatRecurrence(pendingSubscription, false)}${subStartsOn ? `, starting ${new Date(subStartsOn).toLocaleDateString('en-GB')}` : ''} until you cancel. You can cancel at any time from "My packs": your access remains valid until the end of the period already paid.`}
                  </p>
                </div>
              </div>

              <DialogFooter className="gap-2 sm:gap-0">
                <Button variant="outline" onClick={() => { setPendingSubscription(null); setSubStartsOn('') }}>
                  {isFr ? 'Annuler' : 'Cancel'}
                </Button>
                <Button
                  onClick={() => {
                    const pack = pendingSubscription
                    const noteId = useCreditNote && bestNote ? bestNote.id : undefined
                    const startsOn = subStartsOn || undefined
                    setPendingSubscription(null)
                    setSubStartsOn('')
                    startCheckout(pack, noteId, startsOn)
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

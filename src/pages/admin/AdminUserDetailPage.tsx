import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { supabase } from '@/lib/supabase'
import { logActivity } from '@/lib/activity-log'
import { adminUpdatePassword } from '@/lib/admin-update-password'
import { adminUpdateEmail } from '@/lib/admin-update-email'
import { notifyMember } from '@/lib/notify-member'
import { useAuth } from '@/contexts/AuthContext'
import type { Profile, PackPurchase, Booking, ScheduledClass, MemberCategory, Subscription, SubscriptionDiscount, ReferralReward } from '@/types'
import { LoadingState } from '@/components/common/LoadingState'
import { EmptyState } from '@/components/common/EmptyState'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from '@/components/ui/select'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { toast } from 'sonner'
import { ArrowLeft, CreditCard, CalendarDays, Package, Plus, Clock, User, Pencil, Receipt, KeyRound, Mail, X, RefreshCw, PauseCircle, PlayCircle, AlertTriangle, RotateCcw, Trash2, Building2, TicketPercent, UserPlus, UserCog, Shield } from 'lucide-react'
import { format } from 'date-fns'
import { fr, enUS } from 'date-fns/locale'
import { cn, formatEuros } from '@/lib/utils'

export function AdminUserDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { t, i18n } = useTranslation()
  const { user: currentUser, hasRole } = useAuth()
  const navigate = useNavigate()
  const locale = i18n.language === 'fr' ? fr : enUS

  const [profile, setProfile] = useState<Profile | null>(null)
  const [packs, setPacks] = useState<PackPurchase[]>([])
  const [bookings, setBookings] = useState<Booking[]>([])
  const [loading, setLoading] = useState(true)
  /** Seuil d'alerte annulations par cycle (Réglages → Alerte annulations). */
  const [cancelAlertThreshold, setCancelAlertThreshold] = useState(4)

  // Edit pack dialog
  const [editPackDialogOpen, setEditPackDialogOpen] = useState(false)
  const [editingPack, setEditingPack] = useState<PackPurchase | null>(null)
  const [editCredits, setEditCredits] = useState(0)
  const [editExpiresAt, setEditExpiresAt] = useState('')
  const [editPackSaving, setEditPackSaving] = useState(false)

  // Categories
  const [categories, setCategories] = useState<MemberCategory[]>([])

  // Show expired packs
  const [showExpiredPacks, setShowExpiredPacks] = useState(false)

  // Registration fee
  const [hasRegFee, setHasRegFee] = useState(false)
  /** Rôles du membre affiché — un admin les accorde, un super admin seul promeut admin. */
  const [memberRoles, setMemberRoles] = useState<string[]>([])
  const [roleSaving, setRoleSaving] = useState<string | null>(null)
  const [regFeeSaving, setRegFeeSaving] = useState(false)

  // Book class dialog
  const [bookDialogOpen, setBookDialogOpen] = useState(false)
  const [availableClasses, setAvailableClasses] = useState<ScheduledClass[]>([])
  const [selectedClassId, setSelectedClassId] = useState('')
  const [selectedPackId, setSelectedPackId] = useState('')
  const [bookingSaving, setBookingSaving] = useState(false)

  // Password reset dialog
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false)
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordSaving, setPasswordSaving] = useState(false)

  // Email change dialog
  const [emailDialogOpen, setEmailDialogOpen] = useState(false)
  const [newEmail, setNewEmail] = useState('')
  const [emailSaving, setEmailSaving] = useState(false)

  // Edit profile (name) dialog
  const [editProfileOpen, setEditProfileOpen] = useState(false)
  const [editProfileForm, setEditProfileForm] = useState({ display_name: '', first_name: '', last_name: '' })
  const [editProfileSaving, setEditProfileSaving] = useState(false)

  // ---- Abonnement ------------------------------------------------------
  const [subscription, setSubscription] = useState<Subscription | null>(null)
  const [subDiscounts, setSubDiscounts] = useState<SubscriptionDiscount[]>([])
  /** Action en cours d'exécution — bloque les boutons le temps de l'aller-retour Stripe. */
  const [subActionRunning, setSubActionRunning] = useState<string | null>(null)
  const [discountDialogOpen, setDiscountDialogOpen] = useState(false)
  const [discountMode, setDiscountMode] = useState<'amount' | 'percent'>('amount')
  const [discountValue, setDiscountValue] = useState('')
  const [discountReason, setDiscountReason] = useState('')
  const [postponeDialogOpen, setPostponeDialogOpen] = useState(false)
  const [postponeDate, setPostponeDate] = useState('')
  const [cancelSubDialogOpen, setCancelSubDialogOpen] = useState(false)
  const [cancelImmediately, setCancelImmediately] = useState(false)

  // ---- Parrainage et bons d'achat --------------------------------------
  const [referrerCodeInput, setReferrerCodeInput] = useState('')
  const [attachReferrerOpen, setAttachReferrerOpen] = useState(false)
  const [attachingReferrer, setAttachingReferrer] = useState(false)
  const [memberReferral, setMemberReferral] = useState<{ referral_code: string; status: string } | null>(null)
  const [creditNotes, setCreditNotes] = useState<ReferralReward[]>([])
  const [grantNoteOpen, setGrantNoteOpen] = useState(false)
  const [grantAmount, setGrantAmount] = useState('')
  const [grantReason, setGrantReason] = useState('')
  const [grantOrigin, setGrantOrigin] = useState<'geste_commercial' | 'dedommagement' | 'autre'>('geste_commercial')
  const [granting, setGranting] = useState(false)

  // ---- Remise à zéro (mode test uniquement) ----------------------------
  const [stripeTestMode, setStripeTestMode] = useState(false)
  const [resetDialogOpen, setResetDialogOpen] = useState(false)
  const [resetConfirmText, setResetConfirmText] = useState('')
  const [resetRunning, setResetRunning] = useState(false)

  /** Qualification professionnelle : décidée par le studio seul. */
  const [businessForm, setBusinessForm] = useState({
    is_business: false,
    company_name: '',
    company_vat: '',
    company_address: '',
  })
  const [businessSaving, setBusinessSaving] = useState(false)
  /** Factures en attente d'encaissement : avertissement avant de repasser en B2C. */
  const [unpaidInvoices, setUnpaidInvoices] = useState({ count: 0, totalCents: 0 })

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deleteConfirmText, setDeleteConfirmText] = useState('')
  const [deleteRunning, setDeleteRunning] = useState(false)

  const fetchData = async () => {
    if (!id) return

    const [profileRes, packsRes, bookingsRes, regFeeRes, catRes, alertRes, modeRes, subRes] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', id).single(),
      supabase
        .from('pack_purchases')
        .select('*, pack_type:pack_types(*, credit_type:credit_types(*))')
        .eq('user_id', id)
        .order('purchased_at', { ascending: false }),
      supabase
        .from('bookings')
        .select('*, scheduled_class:scheduled_classes(*, class_type:class_types(*))')
        .eq('user_id', id)
        .order('created_at', { ascending: false }),
      supabase.from('registration_fees').select('id').eq('user_id', id).limit(1),
      supabase.from('member_categories').select('*').order('name'),
      supabase.from('app_settings').select('value').eq('key', 'cancellation_alert').maybeSingle(),
      supabase.from('app_settings').select('value').eq('key', 'stripe_mode').maybeSingle(),
      // Abonnement le plus récent, même résilié : le studio doit pouvoir
      // constater qu'une résiliation a bien été enregistrée.
      supabase
        .from('subscriptions')
        .select('*, pack_type:pack_types(*)')
        .eq('user_id', id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
    ])

    // Le bouton de remise à zéro n'existe qu'en mode test : en live, aucun
    // moyen de détruire des achats réels par mégarde.
    const modeVal = modeRes.data?.value as { mode?: string } | undefined
    setStripeTestMode((modeVal?.mode ?? 'test') !== 'live')

    // Parrainage du membre (en tant que filleul), bons d'achat, et rôles.
    const [refRes, notesRes, rolesRes, unpaidRes] = await Promise.all([
      supabase.from('referrals').select('referral_code, status').eq('referee_id', id).maybeSingle(),
      supabase.from('referral_rewards').select('*').eq('user_id', id).order('created_at', { ascending: false }),
      supabase.from('user_roles').select('role').eq('user_id', id),
      // Factures en attente : ce qu'il faut savoir avant de retirer la
      // qualification professionnelle à quelqu'un.
      supabase.from('invoice_requests')
        .select('id, amount_cents')
        .eq('user_id', id)
        .is('paid_at', null)
        .neq('status', 'cancelled'),
    ])
    const unpaid = (unpaidRes.data as { id: string; amount_cents: number | null }[]) ?? []
    setUnpaidInvoices({
      count: unpaid.length,
      totalCents: unpaid.reduce((s, i) => s + (i.amount_cents ?? 0), 0),
    })
    setMemberRoles(((rolesRes.data ?? []) as { role: string }[]).map(r => r.role))
    setMemberReferral(refRes.data as { referral_code: string; status: string } | null)
    setCreditNotes((notesRes.data as ReferralReward[]) ?? [])

    const sub = (subRes.data as Subscription) ?? null
    setSubscription(sub)
    if (sub) {
      const { data: discounts } = await supabase
        .from('subscription_discounts')
        .select('*')
        .eq('subscription_id', sub.id)
        .order('applied_at', { ascending: false })
      setSubDiscounts((discounts as SubscriptionDiscount[]) ?? [])
    } else {
      setSubDiscounts([])
    }

    const loadedProfile = profileRes.data as Profile
    setProfile(loadedProfile)

    // Le formulaire part de ce qui est enregistré : sans cela il s'ouvrirait
    // vide sur un profil déjà qualifié, et l'enregistrer effacerait tout.
    setBusinessForm({
      is_business: loadedProfile.is_business ?? false,
      company_name: loadedProfile.company_name ?? '',
      company_vat: loadedProfile.company_vat ?? '',
      company_address: loadedProfile.company_address ?? '',
    })

    const alertVal = alertRes.data?.value as { threshold_per_cycle?: number } | undefined
    if (alertVal?.threshold_per_cycle) setCancelAlertThreshold(alertVal.threshold_per_cycle)
    setHasRegFee((regFeeRes.data?.length ?? 0) > 0)
    setCategories((catRes.data as MemberCategory[]) ?? [])
    setPacks((packsRes.data as PackPurchase[]) ?? [])

    // Resolve coaches for bookings
    const rawBookings = (bookingsRes.data as Booking[]) ?? []
    const coachIds = [...new Set(rawBookings.map(b => b.scheduled_class?.coach_id).filter(Boolean))]
    if (coachIds.length > 0) {
      const { data: coaches } = await supabase.from('profiles').select('id, display_name').in('id', coachIds)
      const coachMap = new Map((coaches ?? []).map(c => [c.id, c]))
      for (const b of rawBookings) {
        if (b.scheduled_class?.coach_id) {
          b.scheduled_class.coach = coachMap.get(b.scheduled_class.coach_id)
        }
      }
    }

    setBookings(rawBookings)
    setLoading(false)
  }

  const isFr = i18n.language === 'fr'

  /**
   * Appelle manage-subscription. Rien n'est écrit en base ici : Stripe émet
   * customer.subscription.updated, le webhook met la table à jour, et on
   * relit ensuite. C'est la seule source de vérité.
   */
  const runSubscriptionAction = async (
    action: 'discount' | 'postpone' | 'pause' | 'resume' | 'cancel',
    payload: Record<string, unknown> = {},
  ) => {
    if (!subscription) return
    setSubActionRunning(action)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { toast.error(t('common.error')); return }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/manage-subscription`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
          body: JSON.stringify({ action, subscription_id: subscription.id, ...payload }),
        },
      )
      const data = await response.json()

      if (data.ok) {
        toast.success(data.message ?? (isFr ? 'Action effectuée' : 'Done'))
        // Le webhook Stripe met la table à jour en asynchrone : on laisse un
        // court délai avant de relire, sinon on réaffiche l'état d'avant.
        await new Promise(r => setTimeout(r, 1200))
        await fetchData()
        return true
      }
      toast.error(data.error ?? t('common.error'))
      return false
    } catch {
      toast.error(t('common.error'))
      return false
    } finally {
      setSubActionRunning(null)
    }
  }

  const handleApplyDiscount = async () => {
    const value = parseFloat(discountValue.replace(',', '.'))
    if (!value || value <= 0) {
      toast.error(isFr ? 'Indiquez un montant valide' : 'Enter a valid amount')
      return
    }
    if (discountMode === 'percent' && value > 100) {
      toast.error(isFr ? 'Le pourcentage ne peut pas dépasser 100' : 'Percentage cannot exceed 100')
      return
    }
    const payload = discountMode === 'percent'
      ? { percent_off: Math.round(value) }
      : { amount_off_cents: Math.round(value * 100) }

    const ok = await runSubscriptionAction('discount', {
      ...payload,
      reason: discountReason || null,
    })
    if (ok) {
      setDiscountDialogOpen(false)
      setDiscountValue('')
      setDiscountReason('')
    }
  }

  /**
   * Ouvre le report avec une date déjà posée : l'échéance actuelle + 7 jours.
   * Sans valeur initiale, le calendrier s'ouvrait sur le mois courant et
   * l'admin devait naviguer jusqu'à la bonne période. La proposition reste
   * modifiable — c'est un point de départ, pas un choix imposé.
   */
  const openPostponeDialog = () => {
    const base = subscription?.current_period_end
      ? new Date(subscription.current_period_end)
      : new Date()
    const floor = base > new Date() ? base : new Date()
    const suggested = new Date(floor.getTime() + 7 * 86400000)
    setPostponeDate(suggested.toISOString().split('T')[0])
    setPostponeDialogOpen(true)
  }

  const handlePostpone = async () => {
    if (!postponeDate) {
      toast.error(isFr ? 'Choisissez une date' : 'Pick a date')
      return
    }
    // Le bouton est déjà bloqué en cas d'erreur : ceci couvre un état incohérent.
    if (postponeError) {
      toast.error(postponeError)
      return
    }
    // Midi, pour qu'un décalage de fuseau ne fasse pas basculer la veille.
    const ok = await runSubscriptionAction('postpone', {
      new_date: new Date(`${postponeDate}T12:00:00`).toISOString(),
    })
    if (ok) {
      setPostponeDialogOpen(false)
      setPostponeDate('')
    }
  }

  const handleCancelSubscription = async () => {
    const ok = await runSubscriptionAction('cancel', { immediately: cancelImmediately })
    if (ok) {
      setCancelSubDialogOpen(false)
      setCancelImmediately(false)
    }
  }

  /**
   * Rattache un parrain après coup.
   *
   * Les codes oubliés à l'inscription sont fréquents et réclamés plus tard :
   * il faut pouvoir corriger sans passer par la base.
   */
  const handleAttachReferrer = async () => {
    if (!id || !referrerCodeInput.trim()) return
    setAttachingReferrer(true)
    try {
      const { data, error } = await supabase.rpc('attach_referrer', {
        p_referee_id: id,
        p_referral_code: referrerCodeInput.trim(),
      })
      if (error) { toast.error(error.message); return }
      const res = data as { ok: boolean; error?: string }
      if (res?.ok) {
        toast.success(isFr
          ? 'Parrain rattaché. Le bon sera créé au prochain paiement du membre.'
          : 'Referrer attached. The credit note will be created on the member\'s next payment.')
        setAttachReferrerOpen(false)
        setReferrerCodeInput('')
        await fetchData()
      } else {
        toast.error(res?.error ?? t('common.error'))
      }
    } finally {
      setAttachingReferrer(false)
    }
  }

  /** Accorde un bon d'achat à la main (geste commercial, dédommagement). */
  const handleGrantNote = async () => {
    if (!id) return
    const value = parseFloat(grantAmount.replace(',', '.'))
    if (!value || value <= 0) {
      toast.error(isFr ? 'Indiquez un montant valide' : 'Enter a valid amount')
      return
    }
    setGranting(true)
    try {
      const { data, error } = await supabase.rpc('grant_credit_note', {
        p_user_id: id,
        p_amount_cents: Math.round(value * 100),
        p_origin: grantOrigin,
        p_reason: grantReason || null,
      })
      if (error) { toast.error(error.message); return }
      const res = data as { ok: boolean; code?: string }
      if (res?.ok) {
        toast.success(isFr
          ? `Bon de ${value.toFixed(2)} € accordé (${res.code})`
          : `${value.toFixed(2)} € credit note granted (${res.code})`)
        setGrantNoteOpen(false)
        setGrantAmount('')
        setGrantReason('')
        await fetchData()
      }
    } finally {
      setGranting(false)
    }
  }

  /**
   * Accorde ou retire un rôle.
   *
   * La hiérarchie est appliquée côté base : un admin gère les coachs, seul un
   * super admin promeut au rang d'admin. L'interface masque simplement ce qui
   * n'est pas permis.
   */
  const toggleRole = async (role: 'coach' | 'admin' | 'super_admin', grant: boolean) => {
    if (!id) return
    setRoleSaving(role)
    try {
      const { data, error } = await supabase.rpc(
        grant ? 'grant_user_role' : 'revoke_user_role',
        { p_user_id: id, p_role: role },
      )
      if (error) { toast.error(error.message); return }

      const res = data as { ok: boolean; error?: string }
      if (res?.ok) {
        toast.success(grant
          ? (isFr ? `Rôle « ${role} » accordé` : `Role "${role}" granted`)
          : (isFr ? `Rôle « ${role} » retiré` : `Role "${role}" removed`))
        await fetchData()
        return
      }

      const messages: Record<string, { fr: string; en: string }> = {
        super_admin_requis: { fr: 'Seul un super admin peut accorder ce rôle.', en: 'Only a super admin can grant this role.' },
        auto_retrait_interdit: { fr: 'Tu ne peux pas retirer tes propres droits.', en: 'You cannot remove your own rights.' },
        dernier_super_admin: { fr: 'Impossible : c\'est le dernier super admin.', en: 'Cannot remove the last super admin.' },
        membre_introuvable: { fr: 'Membre introuvable.', en: 'Member not found.' },
      }
      const m = messages[res?.error ?? '']
      toast.error(m ? (isFr ? m.fr : m.en) : t('common.error'))
    } finally {
      setRoleSaving(null)
    }
  }

  /**
   * Ferme le compte d'un membre à sa demande.
   *
   * Le serveur refait tous les contrôles — rôle de l'appelant, abonnement
   * actif, protection du super admin — et signale son refus DANS son retour,
   * sans lever d'erreur SQL. C'est le piège du 6 août : sans tester `ok`, on
   * afficherait « supprimé » sur un compte intact.
   */
  const handleDeleteAccount = async () => {
    if (!id) return
    setDeleteRunning(true)
    const { data, error } = await supabase.rpc('delete_member_account', { p_user_id: id })
    setDeleteRunning(false)

    if (error) { toast.error(error.message); return }

    const res = data as { ok: boolean; reason?: string; former_name?: string } | null
    if (!res?.ok) {
      const messages: Record<string, string> = {
        active_subscription: isFr
          ? 'Résiliez d\'abord l\'abonnement en cours.'
          : 'Cancel the active subscription first.',
        super_admin_protected: isFr
          ? 'Un super administrateur ne peut pas être supprimé.'
          : 'A super admin cannot be deleted.',
        not_found: isFr ? 'Membre introuvable.' : 'Member not found.',
      }
      toast.error(messages[res?.reason ?? ''] ?? (isFr ? 'Suppression impossible' : 'Deletion failed'))
      return
    }

    toast.success(isFr
      ? `Compte de ${res.former_name} supprimé.`
      : `${res.former_name}'s account deleted.`)
    setDeleteDialogOpen(false)
    navigate('/admin/users')
  }

  const handleResetPurchases = async () => {
    if (!id) return
    setResetRunning(true)
    try {
      const { data, error } = await supabase.rpc('reset_member_purchases', { p_user_id: id })
      if (error) {
        toast.error(error.message)
        return
      }
      const r = data as Record<string, number>
      toast.success(
        isFr
          ? `Remise à zéro : ${r.packs} pack(s), ${r.subscriptions} abonnement(s), ${r.bookings} réservation(s)`
          : `Reset: ${r.packs} pack(s), ${r.subscriptions} subscription(s), ${r.bookings} booking(s)`,
      )
      setResetDialogOpen(false)
      setResetConfirmText('')
      await fetchData()
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setResetRunning(false)
    }
  }

  const handleToggleRegFee = async () => {
    if (!id) return
    setRegFeeSaving(true)

    if (hasRegFee) {
      // Remove registration fee
      await supabase.from('registration_fees').delete().eq('user_id', id)
      setHasRegFee(false)
      toast.success(isFr ? 'Frais d\'inscription retirés' : 'Registration fee removed')
    } else {
      // Mark as paid (by admin)
      await supabase.from('registration_fees').insert({
        user_id: id,
        amount_cents: 3000,
      })
      setHasRegFee(true)

      // Update member status
      await supabase.rpc('update_member_status', { p_user_id: id })

      await logActivity({
        action: 'registration_fee_paid',
        actor_id: currentUser?.id ?? null,
        target_user_id: id,
        entity_type: 'registration_fee',
        details: { marked_by_admin: true },
        description: `Frais d'inscription validés par admin pour ${profile?.display_name}`,
      })

      toast.success(isFr ? 'Frais d\'inscription validés' : 'Registration fee confirmed')
    }

    setRegFeeSaving(false)
    fetchData()
  }

  useEffect(() => {
    fetchData()
  }, [id])

  const openEditPack = (pack: PackPurchase) => {
    setEditingPack(pack)
    setEditCredits(pack.credits_remaining)
    setEditExpiresAt(format(new Date(pack.expires_at), 'yyyy-MM-dd'))
    setEditPackDialogOpen(true)
  }

  const handleEditPack = async () => {
    if (!editingPack) return
    setEditPackSaving(true)

    const { error } = await supabase
      .from('pack_purchases')
      .update({
        credits_remaining: editCredits,
        expires_at: new Date(editExpiresAt + 'T23:59:59').toISOString(),
      })
      .eq('id', editingPack.id)

    setEditPackSaving(false)
    if (error) {
      toast.error(error.message)
      return
    }

    await logActivity({
      action: 'pack_modified',
      actor_id: currentUser?.id ?? null,
      target_user_id: id!,
      entity_type: 'pack_purchase',
      entity_id: editingPack.id,
      details: {
        pack_name: editingPack.pack_type?.name,
        before: {
          credits_remaining: editingPack.credits_remaining,
          expires_at: editingPack.expires_at,
        },
        after: {
          credits_remaining: editCredits,
          expires_at: editExpiresAt,
        },
      },
      description: `Pack "${editingPack.pack_type?.name}" modifié pour ${profile?.display_name}: crédits ${editingPack.credits_remaining}→${editCredits}, expiration ${format(new Date(editingPack.expires_at), 'dd/MM/yyyy')}→${editExpiresAt}`,
    })

    toast.success(t('common.saveSuccess'))
    setEditPackDialogOpen(false)
    fetchData()
  }

  const openBookDialog = async () => {
    // Fetch upcoming classes
    const { data } = await supabase
      .from('scheduled_classes')
      .select('*, class_type:class_types(*, credit_type:credit_types(name, label_fr, label_en))')
      .gte('starts_at', new Date().toISOString())
      .eq('is_cancelled', false)
      .order('starts_at')
      .limit(50)

    const rawClasses = (data as ScheduledClass[]) ?? []

    // Resolve coaches
    const coachIds = [...new Set(rawClasses.map(c => c.coach_id))]
    if (coachIds.length > 0) {
      const { data: coaches } = await supabase.from('profiles').select('id, display_name').in('id', coachIds)
      const coachMap = new Map((coaches ?? []).map(c => [c.id, c]))
      for (const sc of rawClasses) {
        if (sc.coach_id) sc.coach = coachMap.get(sc.coach_id)
      }
    }

    setAvailableClasses(rawClasses)
    setSelectedClassId('')
    setSelectedPackId('')
    setBookDialogOpen(true)
  }

  const handleBookClass = async () => {
    if (!id || !selectedClassId || !selectedPackId) return
    setBookingSaving(true)

    // Check not already booked
    const existing = bookings.find(b => b.scheduled_class_id === selectedClassId && b.status === 'confirmed')
    if (existing) {
      toast.error(i18n.language === 'fr' ? 'Déjà inscrit à ce cours' : 'Already booked for this class')
      setBookingSaving(false)
      return
    }

    const { error } = await supabase.from('bookings').insert({
      scheduled_class_id: selectedClassId,
      user_id: id,
      pack_purchase_id: selectedPackId,
    })

    if (error) {
      toast.error(error.message)
      setBookingSaving(false)
      return
    }

    // Consume credit
    await supabase.rpc('consume_credit', { p_pack_purchase_id: selectedPackId })

    const sc = availableClasses.find(c => c.id === selectedClassId)
    await logActivity({
      action: 'booking_assigned',
      actor_id: currentUser?.id ?? null,
      target_user_id: id,
      entity_type: 'booking',
      details: {
        class_name: sc?.class_type?.name,
        starts_at: sc?.starts_at,
        pack_purchase_id: selectedPackId,
      },
      description: `${profile?.display_name} inscrit au cours "${sc?.class_type?.name}" du ${sc ? format(new Date(sc.starts_at), 'dd/MM/yyyy HH:mm') : ''}`,
    })

    toast.success(t('schedule.bookingConfirmed'))
    setBookDialogOpen(false)
    setBookingSaving(false)
    fetchData()
  }

  const openPasswordDialog = () => {
    setNewPassword('')
    setConfirmPassword('')
    setPasswordDialogOpen(true)
  }

  const openEmailDialog = () => {
    setNewEmail('')
    setEmailDialogOpen(true)
  }

  const handleChangeEmail = async () => {
    if (!profile || !id) return
    const candidate = newEmail.trim().toLowerCase()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(candidate)) {
      toast.error(isFr ? 'Email invalide' : 'Invalid email')
      return
    }
    if (candidate === (profile.email ?? '').toLowerCase()) {
      toast.error(isFr ? 'Adresse identique à l\'actuelle' : 'Same as current address')
      return
    }
    setEmailSaving(true)
    const result = await adminUpdateEmail(id, candidate)
    setEmailSaving(false)
    if (!result.ok) {
      toast.error(result.error ?? (isFr ? 'Échec de la mise à jour' : 'Update failed'))
      return
    }
    await logActivity({
      action: 'email_change_by_admin',
      actor_id: currentUser?.id ?? null,
      target_user_id: id,
      description: `Demande de changement d'email pour ${profile.display_name} : ${profile.email ?? '—'} → ${candidate} (en attente de confirmation)`,
    })
    toast.success(isFr
      ? `Lien de confirmation envoyé à ${candidate}`
      : `Confirmation link sent to ${candidate}`)
    setEmailDialogOpen(false)
  }

  const openEditProfile = () => {
    if (!profile) return
    setEditProfileForm({
      display_name: profile.display_name ?? '',
      first_name: profile.first_name ?? '',
      last_name: profile.last_name ?? '',
    })
    setEditProfileOpen(true)
  }

  const handleSaveProfile = async () => {
    if (!id) return
    if (!editProfileForm.display_name.trim()) {
      toast.error(isFr ? 'Le nom affiché est requis' : 'Display name is required')
      return
    }
    setEditProfileSaving(true)
    const { error } = await supabase.from('profiles').update({
      display_name: editProfileForm.display_name.trim(),
      first_name: editProfileForm.first_name.trim() || null,
      last_name: editProfileForm.last_name.trim() || null,
    }).eq('id', id)
    setEditProfileSaving(false)
    if (error) {
      toast.error(error.message)
      return
    }
    setProfile(prev => prev ? {
      ...prev,
      display_name: editProfileForm.display_name.trim(),
      first_name: editProfileForm.first_name.trim() || null,
      last_name: editProfileForm.last_name.trim() || null,
    } : prev)
    setEditProfileOpen(false)
    toast.success(isFr ? 'Profil mis à jour' : 'Profile updated')
  }

  const handleSaveBusiness = async () => {
    if (!id) return
    // La raison sociale conditionne la commande sur facture : l'exiger ici
    // évite un refus incompréhensible plus tard, côté membre.
    if (businessForm.is_business && !businessForm.company_name.trim()) {
      toast.error(isFr ? 'La raison sociale est requise' : 'Company name is required')
      return
    }
    setBusinessSaving(true)
    const payload = {
      is_business: businessForm.is_business,
      company_name: businessForm.company_name.trim() || null,
      company_vat: businessForm.company_vat.trim() || null,
      company_address: businessForm.company_address.trim() || null,
    }
    const { error } = await supabase.from('profiles').update(payload).eq('id', id)
    setBusinessSaving(false)
    if (error) { toast.error(error.message); return }

    setProfile(prev => prev ? { ...prev, ...payload } : prev)
    toast.success(businessForm.is_business
      ? (isFr ? 'Client professionnel : paiement sur facture activé' : 'Business client: invoice payment enabled')
      : (isFr ? 'Paiement sur facture désactivé' : 'Invoice payment disabled'))
  }

  const handleResetPassword = async () => {
    if (!profile || !id) return
    if (newPassword.length < 12) {
      toast.error(isFr ? 'Mot de passe : 12 caractères minimum' : 'Password: minimum 12 characters')
      return
    }
    if (newPassword !== confirmPassword) {
      toast.error(isFr ? 'Les mots de passe ne correspondent pas' : 'Passwords do not match')
      return
    }

    setPasswordSaving(true)
    const result = await adminUpdatePassword(id, newPassword)
    if (!result.ok) {
      toast.error(result.error ?? (isFr ? 'Échec de la mise à jour' : 'Update failed'))
      setPasswordSaving(false)
      return
    }

    await logActivity({
      action: 'password_reset_by_admin',
      actor_id: currentUser?.id ?? null,
      target_user_id: id,
      description: `Mot de passe réinitialisé pour ${profile.display_name}`,
    })

    // Un tiers a changé le mot de passe : le membre doit en garder une trace
    // dans l'application, pas seulement dans une boîte mail qu'il ne lira
    // peut-être pas. C'est un événement de sécurité.
    await notifyMember({
      userId: id!,
      title: isFr ? 'Mot de passe modifié' : 'Password changed',
      message: isFr
        ? 'Le studio a réinitialisé ton mot de passe. Si tu n\'es pas à l\'origine de cette demande, contacte-nous.'
        : 'The studio reset your password. If you did not request this, please contact us.',
      type: 'warning',
      link: '/profile',
      email: {
        to: profile.email,
        template: 'password_reset_by_admin',
        vars: { user_name: profile.display_name },
      },
    })

    toast.success(isFr ? 'Mot de passe mis à jour' : 'Password updated')
    setPasswordDialogOpen(false)
    setNewPassword('')
    setConfirmPassword('')
    setPasswordSaving(false)
  }

  if (loading) return <LoadingState />
  if (!profile) return <EmptyState icon={User} message={t('common.noResults')} />

  const now = new Date()
  const activePacks = packs.filter(p => p.credits_remaining > 0 && new Date(p.expires_at) > now)
  const totalCredits = activePacks.reduce((sum, p) => sum + p.credits_remaining, 0)

  /** Seul un admin ferme un compte : un coach ne doit pas pouvoir le faire. */
  const isAdmin = hasRole('admin') || hasRole('super_admin')

  /**
   * Un abonnement en cours empêche la suppression : Stripe ne sait rien de ce
   * qui se passe côté application et continuerait de prélever. « canceled »
   * n'est pas dans la liste, mais une résiliation programmée laisse le statut
   * « active » — elle bloque donc aussi, à raison.
   */
  const hasActiveSubscription = !!subscription
    && ['active', 'past_due', 'paused', 'incomplete'].includes(subscription.status)
  const upcomingBookings = bookings.filter(b => b.status === 'confirmed' && new Date(b.scheduled_class?.starts_at ?? '') > now)
  // Séances réellement honorées : les annulations et absences ont leur onglet
  // (un no-show garde status='confirmed', d'où l'exclusion explicite).
  const pastBookings = bookings.filter(b => b.status === 'confirmed' && !b.is_no_show && new Date(b.scheduled_class?.starts_at ?? '') <= now)

  // ---- Annulations et no-show : reperage des derives de reservation ----
  // Un membre illimite peut reserver sans compter puis se desister : il bloque
  // des places sans que rien ne le lui coute. Ces indicateurs le rendent
  // visible, la sanction restant humaine (decision de la reunion).
  //
  // IMPORTANT : on raisonne PAR CYCLE, pas sur tout l'historique. Chaque
  // echeance payee cree une nouvelle ligne pack_purchases, et les reservations
  // pointent vers celle en cours : le compteur se remet donc a zero tout seul a
  // chaque reconduction. Cumuler 13 cycles d'abonnement ne dirait rien d'utile.
  const cancelledBookings = bookings
    .filter(b => b.status === 'cancelled' || b.is_no_show)
    .sort((a, b) => new Date(b.scheduled_class?.starts_at ?? '').getTime() - new Date(a.scheduled_class?.starts_at ?? '').getTime())

  const isLateCancel = (b: Booking) => {
    if (b.status !== 'cancelled' || !b.cancelled_at || !b.scheduled_class?.starts_at) return false
    return (new Date(b.scheduled_class.starts_at).getTime() - new Date(b.cancelled_at).getTime()) / 3600000 < 12
  }

  /** Pack actif le plus recent : definit le cycle en cours. */
  const currentPack = packs
    .filter(p => new Date(p.expires_at) > now)
    .sort((a, b) => new Date(b.purchased_at).getTime() - new Date(a.purchased_at).getTime())[0]

  const cycleBookings = currentPack
    ? bookings.filter(b => b.pack_purchase_id === currentPack.id)
    : []
  const cycleCancelled = cycleBookings.filter(b => b.status === 'cancelled' || b.is_no_show)
  const cycleLate = cycleBookings.filter(isLateCancel).length
  const cycleNoShow = cycleBookings.filter(b => b.is_no_show).length
  const cycleRate = cycleBookings.length > 0
    ? Math.round((cycleCancelled.length / cycleBookings.length) * 100)
    : 0
  const overThreshold = cycleCancelled.length > cancelAlertThreshold

  const confirmedTotal = bookings.filter(b => b.status === 'confirmed' && !b.is_no_show).length
  /** Nombre de cycles (packs) ayant donne lieu a au moins une reservation. */
  const cyclesWithActivity = new Set(bookings.map(b => b.pack_purchase_id).filter(Boolean)).size

  // Montant réel de la prochaine échéance : une réduction en attente n'est
  // visible nulle part ailleurs tant que la facture n'est pas émise.
  const pendingSubDiscount = subDiscounts.find(d => !d.consumed_at) ?? null
  const subFullPriceCents = subscription?.pack_type?.price_cents ?? null
  const eurLabel = (cents: number) => `${(cents / 100).toFixed(2).replace('.', ',')} €`
  const fullPriceLabel = subFullPriceCents !== null ? eurLabel(subFullPriceCents) : null
  let nextAmountLabel: string | null = null
  if (pendingSubDiscount && subFullPriceCents !== null) {
    const reduced = pendingSubDiscount.percent_off
      ? Math.round(subFullPriceCents * (1 - pendingSubDiscount.percent_off / 100))
      : Math.max(0, subFullPriceCents - (pendingSubDiscount.amount_off_cents ?? 0))
    nextAmountLabel = eurLabel(reduced)
  }

  // ---- Report d'échéance : bornes et contrôle de saisie ----
  // Un report ne peut que repousser. Une date antérieure avancerait le
  // prélèvement et raccourcirait l'accès du membre.
  const currentPeriodEnd = subscription?.current_period_end
    ? new Date(subscription.current_period_end)
    : null

  const postponeMinDate = (() => {
    const floor = currentPeriodEnd && currentPeriodEnd > now ? currentPeriodEnd : now
    return new Date(floor.getTime() + 86400000).toISOString().split('T')[0]
  })()

  const postponeTarget = postponeDate ? new Date(`${postponeDate}T12:00:00`) : null

  const postponeShiftDays = postponeTarget && currentPeriodEnd
    ? Math.round((postponeTarget.getTime() - currentPeriodEnd.getTime()) / 86400000)
    : null

  const postponeError = (() => {
    if (!postponeTarget) return null
    if (postponeTarget <= now) {
      return isFr ? 'La date doit être dans le futur.' : 'The date must be in the future.'
    }
    if (currentPeriodEnd && postponeTarget <= currentPeriodEnd) {
      return isFr
        ? `La date doit être postérieure à l'échéance actuelle (${format(currentPeriodEnd, 'dd/MM/yyyy')}).`
        : `The date must be after the current payment date (${format(currentPeriodEnd, 'dd/MM/yyyy')}).`
    }
    if (postponeShiftDays !== null && postponeShiftDays > 365) {
      return isFr
        ? `Report de ${postponeShiftDays} jours : le maximum est de 365 jours.`
        : `Postponing by ${postponeShiftDays} days: the maximum is 365 days.`
    }
    return null
  })()

  // For booking dialog: filter packs compatible with selected class
  // Abonnement en tête : c'est la source par défaut (il est déjà facturé, les
  // crédits achetés à côté restent au membre).
  const selectedClass = availableClasses.find(c => c.id === selectedClassId)
  const compatiblePacks = (selectedClass
    ? activePacks.filter(p => p.pack_type?.credit_type_id === selectedClass.class_type?.credit_type_id)
    : activePacks
  ).slice().sort((a, b) => {
    const aSub = a.subscription_id ? 0 : 1
    const bSub = b.subscription_id ? 0 : 1
    if (aSub !== bSub) return aSub - bSub
    return new Date(a.expires_at).getTime() - new Date(b.expires_at).getTime()
  })

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/admin/users')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <Avatar className="h-14 w-14">
          <AvatarImage src={profile.avatar_url ?? undefined} />
          <AvatarFallback className="text-xl">{profile.display_name?.charAt(0).toUpperCase()}</AvatarFallback>
        </Avatar>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold">{profile.display_name}</h1>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={openEditProfile} title={isFr ? 'Éditer le nom' : 'Edit name'}>
              <Pencil className="h-3.5 w-3.5" />
            </Button>
          </div>
          {profile.email && (
            <a href={`mailto:${profile.email}`} className="text-sm text-primary hover:underline">
              {profile.email}
            </a>
          )}
          {profile.phone && (
            <a href={`tel:${profile.phone}`} className="text-sm text-muted-foreground hover:underline block">
              {profile.phone}
            </a>
          )}
        </div>
      </div>

      {/* Coach info */}
      {(profile.coach_description || profile.instagram_url || profile.facebook_url || profile.linkedin_url) && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              {isFr ? 'Profil coach' : 'Coach profile'}
            </p>
            {profile.coach_description && (
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">{profile.coach_description}</p>
            )}
            <div className="flex gap-3 flex-wrap">
              {profile.instagram_url && (
                <a href={profile.instagram_url} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline">Instagram</a>
              )}
              {profile.facebook_url && (
                <a href={profile.facebook_url} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline">Facebook</a>
              )}
              {profile.linkedin_url && (
                <a href={profile.linkedin_url} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline">LinkedIn</a>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Status + Category + Registration fee */}
      <div className="flex items-center gap-3 flex-wrap">
        <Badge variant="outline" className={profile.member_status === 'active' ? 'border-green-500 text-green-600' : profile.member_status === 'inactive' ? 'border-orange-500 text-orange-600' : profile.member_status === 'former' ? 'border-red-500 text-red-600' : ''}>
          {t(`profile.status.${profile.member_status}`)}
        </Badge>

        {/* Category selector */}
        <Select
          value={profile.member_category_id ?? ''}
          onValueChange={async (v) => {
            const val = v || null
            await supabase.from('profiles').update({ member_category_id: val }).eq('id', id!)
            setProfile(prev => prev ? { ...prev, member_category_id: val } : prev)
            toast.success(isFr ? 'Catégorie mise à jour' : 'Category updated')
          }}
        >
          <SelectTrigger className="h-7 text-xs w-auto min-w-[120px]">
            <span>{categories.find(c => c.id === profile.member_category_id)?.name || (isFr ? 'Catégorie' : 'Category')}</span>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">{isFr ? 'Aucune' : 'None'}</SelectItem>
            {categories.map(cat => (
              <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="flex items-center gap-2">
          <Badge
            variant={hasRegFee ? 'default' : 'secondary'}
            className={hasRegFee ? 'bg-green-600' : ''}
          >
            <Receipt className="h-3 w-3 mr-1" />
            {isFr
              ? (hasRegFee ? 'Frais OK' : 'Frais non payés')
              : (hasRegFee ? 'Fee OK' : 'Fee unpaid')}
          </Badge>
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs"
            disabled={regFeeSaving}
            onClick={handleToggleRegFee}
          >
            {regFeeSaving ? '...' : hasRegFee
              ? (isFr ? 'Retirer' : 'Remove')
              : (isFr ? 'Valider' : 'Confirm')}
          </Button>
        </div>

        {/* Rôles. Un admin gère les coachs ; seul un super admin promeut
            au rang d'admin ou de super admin. La base applique la règle,
            l'interface masque ce qui n'est pas permis. */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {memberRoles.filter(r => r !== 'client').map(r => (
            <Badge key={r} variant="outline" className="border-primary text-primary">
              {r === 'coach' ? (isFr ? 'Coach' : 'Coach')
                : r === 'admin' ? 'Admin'
                : r === 'super_admin' ? 'Super admin' : r}
            </Badge>
          ))}

          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs"
            disabled={roleSaving === 'coach'}
            onClick={() => toggleRole('coach', !memberRoles.includes('coach'))}
          >
            <UserCog className="h-3 w-3 mr-1" />
            {roleSaving === 'coach' ? '...' : memberRoles.includes('coach')
              ? (isFr ? 'Retirer coach' : 'Remove coach')
              : (isFr ? 'Désigner coach' : 'Make coach')}
          </Button>

          {hasRole('super_admin') && (
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs"
              disabled={roleSaving === 'admin'}
              onClick={() => toggleRole('admin', !memberRoles.includes('admin'))}
            >
              <Shield className="h-3 w-3 mr-1" />
              {roleSaving === 'admin' ? '...' : memberRoles.includes('admin')
                ? (isFr ? 'Retirer admin' : 'Remove admin')
                : (isFr ? 'Désigner admin' : 'Make admin')}
            </Button>
          )}

          {hasRole('super_admin') && memberRoles.includes('admin') && (
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs"
              disabled={roleSaving === 'super_admin'}
              onClick={() => toggleRole('super_admin', !memberRoles.includes('super_admin'))}
            >
              <Shield className="h-3 w-3 mr-1" />
              {roleSaving === 'super_admin' ? '...' : memberRoles.includes('super_admin')
                ? (isFr ? 'Retirer super admin' : 'Remove super admin')
                : (isFr ? 'Désigner super admin' : 'Make super admin')}
            </Button>
          )}
        </div>

        {hasRole('super_admin') && (
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs"
            onClick={openPasswordDialog}
          >
            <KeyRound className="h-3 w-3 mr-1" />
            {isFr ? 'Changer mot de passe' : 'Change password'}
          </Button>
        )}

        {/* Outil de test : absent dès que Stripe passe en live. */}
        {stripeTestMode && (
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs border-amber-500 text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/20"
            onClick={() => { setResetConfirmText(''); setResetDialogOpen(true) }}
          >
            <RotateCcw className="h-3 w-3 mr-1" />
            {isFr ? 'Remise à zéro (test)' : 'Reset (test)'}
          </Button>
        )}

        {/* Suppression à la demande du membre. Réservée aux admins, et jamais
            proposée sur un compte déjà fermé. */}
        {isAdmin && !profile.deleted_at && (
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs border-destructive/50 text-destructive hover:bg-destructive/5"
            onClick={() => { setDeleteConfirmText(''); setDeleteDialogOpen(true) }}
          >
            <Trash2 className="h-3 w-3 mr-1" />
            {isFr ? 'Supprimer le compte' : 'Delete account'}
          </Button>
        )}
      </div>

      {/* Compte déjà fermé : le dire, sinon un profil « Membre supprimé #… »
          ressemble à une anomalie. */}
      {profile.deleted_at && (
        <div className="rounded-lg border border-muted bg-muted/40 p-3 text-sm text-muted-foreground">
          {isFr
            ? `Compte supprimé le ${format(new Date(profile.deleted_at), 'dd/MM/yyyy', { locale })}. Les données personnelles ont été effacées ; les justificatifs de paiement sont conservés.`
            : `Account deleted on ${format(new Date(profile.deleted_at), 'dd/MM/yyyy', { locale })}. Personal data was erased; payment records are kept.`}
        </div>
      )}

      {/* Stats cards */}
      <div className="grid grid-cols-3 gap-3">
        <Card>
          <CardContent className="p-4 text-center">
            <CreditCard className="h-5 w-5 mx-auto text-primary mb-1" />
            <p className="text-2xl font-bold">{totalCredits}</p>
            <p className="text-xs text-muted-foreground">{t('packs.creditsRemaining', { count: totalCredits })}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <Package className="h-5 w-5 mx-auto text-primary mb-1" />
            <p className="text-2xl font-bold">{activePacks.length}</p>
            <p className="text-xs text-muted-foreground">{i18n.language === 'fr' ? 'Packs actifs' : 'Active packs'}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <CalendarDays className="h-5 w-5 mx-auto text-primary mb-1" />
            <p className="text-2xl font-bold">{upcomingBookings.length}</p>
            <p className="text-xs text-muted-foreground">{t('bookings.upcoming')}</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="packs">
        <TabsList>
          <TabsTrigger value="packs">
            <Package className="h-4 w-4 mr-1.5" />
            {t('packs.myPacks')} ({activePacks.length})
          </TabsTrigger>
          <TabsTrigger value="bookings">
            <CalendarDays className="h-4 w-4 mr-1.5" />
            {t('bookings.title')} ({confirmedTotal})
          </TabsTrigger>
          <TabsTrigger value="cancellations">
            <X className="h-4 w-4 mr-1.5" />
            {isFr ? 'Annulations' : 'Cancellations'} ({cancelledBookings.length})
          </TabsTrigger>
          {subscription && (
            <TabsTrigger value="subscription">
              <RefreshCw className="h-4 w-4 mr-1.5" />
              {isFr ? 'Abonnement' : 'Subscription'}
            </TabsTrigger>
          )}
          <TabsTrigger value="credits">
            <TicketPercent className="h-4 w-4 mr-1.5" />
            {isFr ? 'Bons' : 'Credits'}
            {creditNotes.filter(n => !n.is_used).length > 0 && ` (${creditNotes.filter(n => !n.is_used).length})`}
          </TabsTrigger>
        </TabsList>

        {/* PACKS TAB */}
        <TabsContent value="packs" className="mt-4 space-y-3">
          {/* Qualification professionnelle. Décidée par le studio, jamais par
              le client : se déclarer entreprise serait le moyen le plus simple
              d'obtenir des séances sans payer. */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Building2 className="h-4 w-4 text-primary" />
                {isFr ? 'Client professionnel' : 'Business client'}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm">
                    {isFr ? 'Paiement sur facture' : 'Pay by invoice'}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {isFr
                      ? 'Le membre commande ses packs sans carte. Les crédits sont donnés tout de suite, la facture suit.'
                      : 'The member orders packs without a card. Credits are granted immediately, the invoice follows.'}
                  </p>
                </div>
                <Switch checked={businessForm.is_business} onCheckedChange={(v: boolean) => setBusinessForm(f => ({ ...f, is_business: v }))} />
              </div>

              {businessForm.is_business && (
                <div className="space-y-2">
                  <div>
                    <Label className="text-xs">{isFr ? 'Raison sociale' : 'Company name'} *</Label>
                    <Input
                      value={businessForm.company_name}
                      onChange={(e) => setBusinessForm(f => ({ ...f, company_name: e.target.value }))}
                      placeholder={isFr ? 'Ex. Dupont SPRL' : 'e.g. Dupont Ltd'}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-xs">{isFr ? 'N° TVA' : 'VAT number'}</Label>
                      <Input
                        value={businessForm.company_vat}
                        onChange={(e) => setBusinessForm(f => ({ ...f, company_vat: e.target.value }))}
                        placeholder="BE 0123.456.789"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">{isFr ? 'Adresse de facturation' : 'Billing address'}</Label>
                      <Input
                        value={businessForm.company_address}
                        onChange={(e) => setBusinessForm(f => ({ ...f, company_address: e.target.value }))}
                      />
                    </div>
                  </div>
                  {/* La raison sociale est obligatoire côté serveur : sans elle
                      la facture n'a pas de destinataire. */}
                  {!businessForm.company_name.trim() && (
                    <p className="text-xs text-amber-600 dark:text-amber-400">
                      {isFr
                        ? 'La raison sociale est nécessaire : sans elle, le membre ne pourra pas commander sur facture.'
                        : 'A company name is required, otherwise the member cannot order by invoice.'}
                    </p>
                  )}
                </div>
              )}

              {/* Retirer la qualification ne casse rien — les packs et les
                  factures restent — mais le membre repassera au paiement par
                  carte. S'il reste des factures ouvertes, il faut le savoir
                  avant, pas le découvrir en cherchant pourquoi elles traînent. */}
              {!businessForm.is_business && profile.is_business && unpaidInvoices.count > 0 && (
                <div className="rounded-lg border border-amber-500/50 bg-amber-50 dark:bg-amber-950/20 p-3 text-sm">
                  <p className="font-medium text-amber-800 dark:text-amber-300">
                    {isFr
                      ? `${unpaidInvoices.count} facture${unpaidInvoices.count > 1 ? 's' : ''} encore à encaisser`
                      : `${unpaidInvoices.count} invoice${unpaidInvoices.count > 1 ? 's' : ''} still unpaid`}
                    {unpaidInvoices.totalCents > 0 && ` — ${(unpaidInvoices.totalCents / 100).toFixed(2).replace('.', ',')} €`}
                  </p>
                  <p className="text-amber-700/80 dark:text-amber-400/80 mt-1">
                    {isFr
                      ? 'Elles restent dues et suivies dans les demandes de facture. Le membre repassera simplement au paiement par carte pour ses prochains achats.'
                      : 'They remain due and tracked in invoice requests. The member will simply go back to card payment for future purchases.'}
                  </p>
                </div>
              )}

              <Button size="sm" onClick={handleSaveBusiness} disabled={businessSaving}>
                {businessSaving ? '...' : (isFr ? 'Enregistrer' : 'Save')}
              </Button>
            </CardContent>
          </Card>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="show-expired"
              checked={showExpiredPacks}
              onChange={(e) => setShowExpiredPacks(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300"
            />
            <label htmlFor="show-expired" className="text-xs text-muted-foreground cursor-pointer">
              {isFr ? 'Montrer les packs expirés' : 'Show expired packs'}
            </label>
          </div>
          {(() => {
            const visiblePacks = showExpiredPacks
              ? packs
              // Un illimité reste actif quel que soit son compteur
              : packs.filter(p => (p.pack_type?.is_unlimited || p.credits_remaining > 0) && new Date(p.expires_at) > now)
            return visiblePacks.length === 0 ? (
              <EmptyState icon={Package} message={isFr ? 'Aucun pack actif' : 'No active packs'} />
            ) : (
            visiblePacks.map((pack) => {
              const isExpired = new Date(pack.expires_at) < now
              const isUnlimited = pack.pack_type?.is_unlimited ?? false
              const isEmpty = !isUnlimited && pack.credits_remaining <= 0
              const inactive = isExpired || isEmpty
              const totalInPack = pack.pack_type?.credit_count ?? 1
              const used = totalInPack - pack.credits_remaining
              // Pas de barre de progression sur un illimité : rien ne se consomme
              const progress = isUnlimited ? 0 : (used / totalInPack) * 100
              const creditLabel = i18n.language === 'fr'
                ? pack.pack_type?.credit_type?.label_fr
                : pack.pack_type?.credit_type?.label_en
              const daysLeft = Math.ceil((new Date(pack.expires_at).getTime() - now.getTime()) / 86400000)

              return (
                <Card
                  key={pack.id}
                  className={cn(
                    'cursor-pointer hover:shadow-md hover:border-primary/30 transition-all group',
                    inactive && 'opacity-50'
                  )}
                  onClick={() => openEditPack(pack)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold">{pack.pack_type?.name}</span>
                        <Badge variant="outline" className="text-[11px]">{creditLabel}</Badge>
                      </div>
                      <div className="flex items-center gap-2">
                        {pack.price_paid_cents === 0 && (
                          <Badge variant="secondary" className="text-[11px]">
                            {i18n.language === 'fr' ? 'Offert' : 'Gift'}
                          </Badge>
                        )}
                        {inactive && (
                          <Badge variant="destructive" className="text-[11px]">
                            {isExpired ? t('packs.expired') : i18n.language === 'fr' ? 'Épuisé' : 'Used up'}
                          </Badge>
                        )}
                        <Pencil className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                    </div>
                    <div className="h-2 rounded-full bg-muted overflow-hidden mb-2">
                      <div
                        className="h-full rounded-full bg-primary transition-all"
                        style={{ width: `${100 - progress}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>
                        {isUnlimited
                          // Sur un illimité on ne compte pas des crédits : on
                          // compte ce qui a réellement été consommé.
                          ? `${isFr ? 'Illimité' : 'Unlimited'} · ${
                              bookings.filter(b => b.pack_purchase_id === pack.id && b.status === 'confirmed').length
                            } ${isFr ? 'séances' : 'sessions'}`
                          : `${pack.credits_remaining}/${totalInPack} crédits`}
                      </span>
                      <span>{formatEuros(pack.price_paid_cents, 0)}</span>
                      <span>
                        {format(new Date(pack.purchased_at), 'dd/MM/yyyy', { locale })}
                        {' → '}
                        {format(new Date(pack.expires_at), 'dd/MM/yyyy', { locale })}
                        {!inactive && daysLeft <= 14 && (
                          <span className="text-destructive font-medium ml-1">({daysLeft}j)</span>
                        )}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              )
            })
          )
          })()}
        </TabsContent>

        {/* BOOKINGS TAB */}
        <TabsContent value="bookings" className="mt-4 space-y-4">
          <div className="flex justify-end">
            <Button size="sm" onClick={openBookDialog} disabled={activePacks.length === 0}>
              <Plus className="h-4 w-4 mr-1" />
              {i18n.language === 'fr' ? 'Inscrire à un cours' : 'Book a class'}
            </Button>
          </div>

          {/* Upcoming */}
          {upcomingBookings.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-muted-foreground mb-2">{t('bookings.upcoming')}</h3>
              <div className="space-y-2">
                {upcomingBookings.map((b) => (
                  <BookingRow key={b.id} booking={b} locale={locale} t={t} />
                ))}
              </div>
            </div>
          )}

          {/* Past */}
          {pastBookings.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-muted-foreground mb-2">{t('bookings.past')}</h3>
              <div className="space-y-2">
                {pastBookings.map((b) => (
                  <BookingRow key={b.id} booking={b} locale={locale} t={t} isPast />
                ))}
              </div>
            </div>
          )}

          {bookings.length === 0 && (
            <EmptyState icon={CalendarDays} message={t('bookings.noBookings')} />
          )}
        </TabsContent>

        {/* CANCELLATIONS TAB */}
        <TabsContent value="cancellations" className="mt-4 space-y-4">
          {/* Cycle en cours */}
          {currentPack ? (
            <div className="space-y-3">
              <div>
                <h3 className="text-sm font-semibold">
                  {isFr ? 'Cycle en cours' : 'Current cycle'} — {currentPack.pack_type?.name}
                </h3>
                <p className="text-xs text-muted-foreground">
                  {isFr ? 'depuis le' : 'since'}{' '}
                  {format(new Date(currentPack.purchased_at), 'dd/MM/yyyy', { locale })}
                  {' · '}
                  {isFr ? 'fin le' : 'ends'}{' '}
                  {format(new Date(currentPack.expires_at), 'dd/MM/yyyy', { locale })}
                </p>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <Card className={cn(overThreshold && 'border-orange-500')}>
                  <CardContent className="p-3">
                    <p className={cn('text-2xl font-bold', overThreshold && 'text-orange-500')}>
                      {cycleCancelled.length}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {isFr ? 'Annulations' : 'Cancellations'}
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-3">
                    <p className={cn('text-2xl font-bold', cycleLate > 0 && 'text-orange-500')}>
                      {cycleLate}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {isFr ? 'Tardives (< 12 h)' : 'Late (< 12 h)'}
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-3">
                    <p className={cn('text-2xl font-bold', cycleNoShow > 0 && 'text-destructive')}>
                      {cycleNoShow}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {isFr ? 'Absences' : 'No-shows'}
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-3">
                    <p className="text-2xl font-bold">{cycleRate} %</p>
                    <p className="text-xs text-muted-foreground">
                      {isFr
                        ? `sur ${cycleBookings.length} résa.`
                        : `of ${cycleBookings.length} bookings`}
                    </p>
                  </CardContent>
                </Card>
              </div>

              {overThreshold && (
                <p className="text-xs text-orange-600 dark:text-orange-400">
                  {isFr
                    ? `Au-delà du seuil de ${cancelAlertThreshold} annulations par cycle — à évoquer avec le membre.`
                    : `Above the ${cancelAlertThreshold} cancellations per cycle threshold — worth discussing with the member.`}
                </p>
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              {isFr ? 'Aucun pack actif — pas de cycle en cours.' : 'No active pack — no current cycle.'}
            </p>
          )}

          {/* Historique tous cycles confondus */}
          <div className="border-t pt-3">
            <p className="text-xs text-muted-foreground">
              {isFr
                ? `Depuis l'inscription : ${cancelledBookings.length} annulation(s) sur ${bookings.length} réservation(s), ${cyclesWithActivity} cycle(s).`
                : `Since sign-up: ${cancelledBookings.length} cancellation(s) out of ${bookings.length} booking(s), across ${cyclesWithActivity} cycle(s).`}
            </p>
          </div>

          {cancelledBookings.length > 0 ? (
            <div className="space-y-2">
              {cancelledBookings.map((b) => {
                const startsAt = b.scheduled_class?.starts_at
                const hoursBefore = b.cancelled_at && startsAt
                  ? (new Date(startsAt).getTime() - new Date(b.cancelled_at).getTime()) / 3600000
                  : null
                const isLate = hoursBefore !== null && hoursBefore < 12
                return (
                  <Card key={b.id}>
                    <CardContent className="p-3 flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-medium text-sm truncate">
                          {b.scheduled_class?.class_type?.name}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {startsAt && format(new Date(startsAt), 'dd/MM/yyyy HH:mm', { locale })}
                          {b.cancelled_at && (
                            <>
                              {' · '}
                              {isFr ? 'annulé le' : 'cancelled'}{' '}
                              {format(new Date(b.cancelled_at), 'dd/MM/yyyy HH:mm', { locale })}
                            </>
                          )}
                        </p>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {currentPack && b.pack_purchase_id === currentPack.id && (
                          <Badge variant="outline" className="text-[11px]">
                            {isFr ? 'Cycle en cours' : 'Current cycle'}
                          </Badge>
                        )}
                        {b.is_no_show && (
                          <Badge variant="destructive" className="text-[11px]">
                            {isFr ? 'Absent' : 'No-show'}
                          </Badge>
                        )}
                        {isLate && !b.is_no_show && (
                          <Badge className="text-[11px] bg-orange-500 hover:bg-orange-500">
                            {isFr ? 'Tardive' : 'Late'}
                          </Badge>
                        )}
                        {hoursBefore !== null && hoursBefore >= 12 && (
                          <Badge variant="secondary" className="text-[11px]">
                            {isFr ? `${Math.round(hoursBefore)} h avant` : `${Math.round(hoursBefore)} h before`}
                          </Badge>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          ) : (
            <EmptyState
              icon={X}
              message={isFr ? 'Aucune annulation' : 'No cancellations'}
            />
          )}
        </TabsContent>

        {/* SUBSCRIPTION TAB */}
        {subscription && (
          <TabsContent value="subscription" className="mt-4 space-y-4">
            {/* État courant */}
            <Card>
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div>
                    <p className="font-semibold">
                      {subscription.pack_type?.name ?? (isFr ? 'Abonnement' : 'Subscription')}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {(subscription.pack_type?.price_cents ?? 0) / 100} €
                      {subscription.pack_type?.recurring_interval_count && subscription.pack_type?.recurring_interval && (
                        <> · {isFr ? 'tous les' : 'every'} {subscription.pack_type.recurring_interval_count}{' '}
                        {subscription.pack_type.recurring_interval === 'week'
                          ? (isFr ? 'semaines' : 'weeks')
                          : subscription.pack_type.recurring_interval === 'month'
                            ? (isFr ? 'mois' : 'months')
                            : (isFr ? 'jours' : 'days')}</>
                      )}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {subscription.stripe_mode === 'test' && (
                      <Badge variant="outline" className="border-amber-500 text-amber-600">test</Badge>
                    )}
                    {subscription.status === 'active' && !subscription.cancel_at_period_end && (
                      <Badge variant="outline" className="border-green-500 text-green-600">
                        {isFr ? 'Actif' : 'Active'}
                      </Badge>
                    )}
                    {subscription.status === 'past_due' && (
                      <Badge variant="destructive">{isFr ? 'Paiement en échec' : 'Past due'}</Badge>
                    )}
                    {subscription.status === 'paused' && (
                      <Badge variant="secondary">{isFr ? 'Suspendu' : 'Paused'}</Badge>
                    )}
                    {subscription.status === 'canceled' && (
                      <Badge variant="secondary">{isFr ? 'Résilié' : 'Canceled'}</Badge>
                    )}
                    {subscription.cancel_at_period_end && subscription.status !== 'canceled' && (
                      <Badge variant="secondary">
                        {isFr ? 'Résiliation programmée' : 'Cancellation scheduled'}
                      </Badge>
                    )}
                  </div>
                </div>

                {subscription.current_period_end && subscription.status !== 'canceled' && (
                  <p className="text-sm">
                    {subscription.cancel_at_period_end
                      ? (isFr ? 'Fin des droits le ' : 'Access ends on ')
                      : (isFr ? 'Prochaine échéance le ' : 'Next payment on ')}
                    <span className="font-medium">
                      {format(new Date(subscription.current_period_end), 'dd MMMM yyyy', { locale })}
                    </span>
                    {!subscription.cancel_at_period_end && nextAmountLabel && (
                      <>
                        {' · '}
                        <span className="font-medium text-green-600">{nextAmountLabel}</span>
                        <span className="text-muted-foreground line-through ml-1">{fullPriceLabel}</span>
                      </>
                    )}
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Actions du studio */}
            {subscription.status !== 'canceled' && (
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setDiscountDialogOpen(true)}
                  disabled={!!subActionRunning}
                >
                  <Receipt className="h-4 w-4 mr-1.5" />
                  {isFr ? 'Réduction ponctuelle' : 'One-off discount'}
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={openPostponeDialog}
                  disabled={!!subActionRunning}
                >
                  <Clock className="h-4 w-4 mr-1.5" />
                  {isFr ? 'Décaler l\'échéance' : 'Postpone payment'}
                </Button>

                {subscription.status === 'paused' ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => runSubscriptionAction('resume')}
                    disabled={!!subActionRunning}
                  >
                    <PlayCircle className="h-4 w-4 mr-1.5" />
                    {subActionRunning === 'resume'
                      ? (isFr ? 'Reprise…' : 'Resuming…')
                      : (isFr ? 'Reprendre' : 'Resume')}
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => runSubscriptionAction('pause')}
                    disabled={!!subActionRunning}
                  >
                    <PauseCircle className="h-4 w-4 mr-1.5" />
                    {subActionRunning === 'pause'
                      ? (isFr ? 'Suspension…' : 'Pausing…')
                      : (isFr ? 'Suspendre' : 'Pause')}
                  </Button>
                )}

                {!subscription.cancel_at_period_end && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-destructive hover:text-destructive"
                    onClick={() => setCancelSubDialogOpen(true)}
                    disabled={!!subActionRunning}
                  >
                    <X className="h-4 w-4 mr-1.5" />
                    {isFr ? 'Résilier' : 'Cancel'}
                  </Button>
                )}
              </div>
            )}

            {/* Historique des remises accordées */}
            {subDiscounts.length > 0 && (
              <Card>
                <CardContent className="p-4 space-y-2">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    {isFr ? 'Réductions accordées' : 'Discounts granted'}
                  </p>
                  {subDiscounts.map(d => (
                    <div key={d.id} className="flex items-center justify-between gap-2 text-sm border-b last:border-0 pb-2 last:pb-0">
                      <div>
                        <span className="font-medium">
                          {d.percent_off ? `-${d.percent_off} %` : `-${((d.amount_off_cents ?? 0) / 100).toFixed(2).replace('.', ',')} €`}
                        </span>
                        {d.reason && <span className="text-muted-foreground"> · {d.reason}</span>}
                      </div>
                      <span className="text-xs text-muted-foreground shrink-0">
                        {d.consumed_at
                          ? (isFr ? 'Appliquée' : 'Applied')
                          : (isFr ? 'En attente' : 'Pending')}
                        {' · '}
                        {format(new Date(d.applied_at), 'dd/MM/yyyy')}
                      </span>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}
          </TabsContent>
        )}
        {/* CREDITS TAB — parrainage et bons d'achat */}
        <TabsContent value="credits" className="mt-4 space-y-4">
          {/* Parrainage du membre en tant que filleul */}
          <Card>
            <CardContent className="p-4 space-y-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                {isFr ? 'Parrainage' : 'Referral'}
              </p>
              {memberReferral ? (
                <p className="text-sm">
                  {isFr ? 'Parrainé avec le code ' : 'Referred with code '}
                  <span className="font-mono font-medium">{memberReferral.referral_code}</span>
                  {' · '}
                  <Badge variant={memberReferral.status === 'pending' ? 'secondary' : 'outline'}
                         className={memberReferral.status !== 'pending' ? 'border-green-500 text-green-600' : ''}>
                    {memberReferral.status === 'pending'
                      ? (isFr ? 'En attente du 1er paiement' : 'Awaiting first payment')
                      : (isFr ? 'Qualifié' : 'Qualified')}
                  </Badge>
                </p>
              ) : (
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">
                    {isFr
                      ? 'Aucun parrain. Si le membre a oublié le code à l\'inscription, tu peux le rattacher ici.'
                      : 'No referrer. If the member forgot the code at signup, you can attach it here.'}
                  </p>
                  <Button variant="outline" size="sm" onClick={() => setAttachReferrerOpen(true)}>
                    <UserPlus className="h-4 w-4 mr-1.5" />
                    {isFr ? 'Rattacher un parrain' : 'Attach a referrer'}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Bons d'achat */}
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              {isFr ? 'Bons d\'achat' : 'Credit notes'}
            </p>
            <Button variant="outline" size="sm" onClick={() => setGrantNoteOpen(true)}>
              <Plus className="h-4 w-4 mr-1.5" />
              {isFr ? 'Accorder un bon' : 'Grant a note'}
            </Button>
          </div>

          {creditNotes.length === 0 ? (
            <EmptyState icon={TicketPercent} message={isFr ? 'Aucun bon' : 'No credit notes'} />
          ) : (
            <div className="space-y-2">
              {creditNotes.map(note => {
                const expired = note.expires_at && new Date(note.expires_at) < now
                return (
                  <Card key={note.id} className={note.is_used || expired ? 'opacity-60' : ''}>
                    <CardContent className="p-3">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <div>
                          <p className="font-medium">
                            {formatEuros(note.amount_cents)}
                            <span className="font-mono text-xs text-muted-foreground ml-2">{note.code}</span>
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {note.origin === 'parrainage'
                              ? (isFr ? 'Parrainage (parrain)' : 'Referral (referrer)')
                              : note.origin === 'parrainage_filleul'
                              ? (isFr ? 'Parrainage (filleul)' : 'Referral (referee)')
                              : note.origin === 'dedommagement'
                                ? (isFr ? 'Dédommagement' : 'Compensation')
                                : note.origin === 'geste_commercial'
                                  ? (isFr ? 'Geste commercial' : 'Goodwill')
                                  : (isFr ? 'Autre' : 'Other')}
                            {note.reason && ` · ${note.reason}`}
                            {note.expires_at && ` · ${isFr ? 'exp.' : 'exp.'} ${format(new Date(note.expires_at), 'dd/MM/yyyy')}`}
                          </p>
                        </div>
                        {note.is_used ? (
                          <Badge variant="secondary">
                            {isFr ? 'Utilisé' : 'Used'}
                            {note.used_at && ` ${format(new Date(note.used_at), 'dd/MM/yy')}`}
                          </Badge>
                        ) : expired ? (
                          <Badge variant="secondary">{isFr ? 'Expiré' : 'Expired'}</Badge>
                        ) : (
                          <Badge variant="outline" className="border-green-500 text-green-600">
                            {isFr ? 'Disponible' : 'Available'}
                          </Badge>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Rattacher un parrain a posteriori */}
      <Dialog open={attachReferrerOpen} onOpenChange={setAttachReferrerOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{isFr ? 'Rattacher un parrain' : 'Attach a referrer'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              {isFr
                ? 'Le parrainage sera enregistré comme si le code avait été saisi à l\'inscription. Les deux bons seront créés au prochain paiement du membre.'
                : 'The referral will be recorded as if the code had been entered at signup. Both credit notes will be created on the member\'s next payment.'}
            </p>
            <div className="space-y-2">
              <Label>{isFr ? 'Code du parrain' : 'Referrer code'}</Label>
              <Input
                value={referrerCodeInput}
                onChange={(e) => setReferrerCodeInput(e.target.value.toUpperCase())}
                placeholder="ABC123"
                autoComplete="off"
              />
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setAttachReferrerOpen(false)} disabled={attachingReferrer}>
              {t('common.cancel')}
            </Button>
            <Button onClick={handleAttachReferrer} disabled={attachingReferrer || !referrerCodeInput.trim()}>
              {attachingReferrer ? (isFr ? 'Rattachement…' : 'Attaching…') : (isFr ? 'Rattacher' : 'Attach')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Accorder un bon d'achat */}
      <Dialog open={grantNoteOpen} onOpenChange={setGrantNoteOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{isFr ? 'Accorder un bon d\'achat' : 'Grant a credit note'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {isFr
                ? 'Le bon sera proposé au membre lors de son prochain achat. Il s\'utilise en une fois, en entier.'
                : 'The note will be offered to the member on their next purchase. It is used once, in full.'}
            </p>

            <div className="space-y-2">
              <Label>{isFr ? 'Montant en euros' : 'Amount in euros'}</Label>
              <Input
                type="number" min="1" step="0.01"
                value={grantAmount}
                onChange={(e) => setGrantAmount(e.target.value)}
                placeholder="30"
              />
            </div>

            <div className="space-y-2">
              <Label>{isFr ? 'Motif' : 'Reason'}</Label>
              <div className="flex gap-2 flex-wrap">
                {(['geste_commercial', 'dedommagement', 'autre'] as const).map(o => (
                  <Button
                    key={o}
                    type="button"
                    variant={grantOrigin === o ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setGrantOrigin(o)}
                  >
                    {o === 'geste_commercial' ? (isFr ? 'Geste commercial' : 'Goodwill')
                      : o === 'dedommagement' ? (isFr ? 'Dédommagement' : 'Compensation')
                        : (isFr ? 'Autre' : 'Other')}
                  </Button>
                ))}
              </div>
              <Input
                value={grantReason}
                onChange={(e) => setGrantReason(e.target.value)}
                placeholder={isFr ? 'Précision (facultatif)' : 'Details (optional)'}
                maxLength={80}
              />
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setGrantNoteOpen(false)} disabled={granting}>
              {t('common.cancel')}
            </Button>
            <Button onClick={handleGrantNote} disabled={granting || !grantAmount}>
              {granting ? (isFr ? 'Création…' : 'Creating…') : (isFr ? 'Accorder' : 'Grant')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Réduction ponctuelle — s'applique à la prochaine échéance seulement */}
      <Dialog open={discountDialogOpen} onOpenChange={setDiscountDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{isFr ? 'Réduction ponctuelle' : 'One-off discount'}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {isFr
                ? 'La réduction s\'applique à la prochaine échéance uniquement. Les suivantes repartent au tarif plein, sans intervention.'
                : 'The discount applies to the next payment only. Later payments return to full price automatically.'}
            </p>

            <div className="flex gap-2">
              <Button
                type="button"
                variant={discountMode === 'amount' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setDiscountMode('amount')}
              >
                {isFr ? 'Montant (€)' : 'Amount (€)'}
              </Button>
              <Button
                type="button"
                variant={discountMode === 'percent' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setDiscountMode('percent')}
              >
                {isFr ? 'Pourcentage (%)' : 'Percentage (%)'}
              </Button>
            </div>

            <div className="space-y-2">
              <Label>{discountMode === 'amount' ? (isFr ? 'Montant en euros' : 'Amount in euros') : (isFr ? 'Pourcentage' : 'Percentage')}</Label>
              <Input
                type="number"
                min="1"
                step={discountMode === 'amount' ? '0.01' : '1'}
                value={discountValue}
                onChange={(e) => setDiscountValue(e.target.value)}
                placeholder={discountMode === 'amount' ? '25' : '20'}
              />
            </div>

            <div className="space-y-2">
              <Label>{isFr ? 'Motif (facultatif)' : 'Reason (optional)'}</Label>
              <Input
                value={discountReason}
                onChange={(e) => setDiscountReason(e.target.value)}
                placeholder={isFr ? 'Geste commercial, blessure…' : 'Goodwill, injury…'}
                maxLength={40}
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setDiscountDialogOpen(false)} disabled={!!subActionRunning}>
              {t('common.cancel')}
            </Button>
            <Button onClick={handleApplyDiscount} disabled={!!subActionRunning}>
              {subActionRunning === 'discount'
                ? (isFr ? 'Application…' : 'Applying…')
                : (isFr ? 'Appliquer' : 'Apply')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Décaler l'échéance — congés, blessure */}
      <Dialog open={postponeDialogOpen} onOpenChange={setPostponeDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{isFr ? 'Décaler l\'échéance' : 'Postpone payment'}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {isFr
                ? 'La période offerte n\'est pas facturée, et l\'accès du membre est prolongé d\'autant. Les échéances suivantes se recalent sur la nouvelle date et reprennent leur rythme normal.'
                : 'The skipped period is not charged, and the member\'s access is extended accordingly. Later payments follow the new date and resume their normal rhythm.'}
            </p>

            {subscription?.current_period_end && (
              <p className="text-sm">
                {isFr ? 'Échéance actuelle : ' : 'Current date: '}
                <span className="font-medium">
                  {format(new Date(subscription.current_period_end), 'dd MMMM yyyy', { locale })}
                </span>
              </p>
            )}

            {/* Raccourcis en durée : un coach pense « deux semaines de congés »,
                pas « le 16 septembre ». La date reste modifiable à la main. */}
            {currentPeriodEnd && (
              <div className="flex flex-wrap gap-1.5">
                {[7, 14, 21, 28].map(days => {
                  const target = new Date(currentPeriodEnd.getTime() + days * 86400000)
                  const iso = target.toISOString().split('T')[0]
                  return (
                    <Button
                      key={days}
                      type="button"
                      variant={postponeDate === iso ? 'default' : 'outline'}
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() => setPostponeDate(iso)}
                    >
                      +{days} {isFr ? 'j' : 'd'}
                    </Button>
                  )
                })}
              </div>
            )}

            <div className="space-y-2">
              <Label>{isFr ? 'Nouvelle date d\'échéance' : 'New payment date'}</Label>
              <Input
                type="date"
                value={postponeDate}
                // Un report ne peut que repousser : le calendrier commence au
                // lendemain de l'échéance actuelle.
                min={postponeMinDate}
                onChange={(e) => setPostponeDate(e.target.value)}
              />
              {postponeError ? (
                <p className="text-xs text-destructive">{postponeError}</p>
              ) : postponeShiftDays !== null && (
                <p className="text-xs text-muted-foreground">
                  {isFr
                    ? `Report de ${postponeShiftDays} jour${postponeShiftDays > 1 ? 's' : ''}. L'accès du membre est prolongé d'autant.`
                    : `Postponed by ${postponeShiftDays} day${postponeShiftDays > 1 ? 's' : ''}. The member's access is extended accordingly.`}
                </p>
              )}
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setPostponeDialogOpen(false)} disabled={!!subActionRunning}>
              {t('common.cancel')}
            </Button>
            <Button onClick={handlePostpone} disabled={!!subActionRunning || !postponeDate || !!postponeError}>
              {subActionRunning === 'postpone'
                ? (isFr ? 'Décalage…' : 'Postponing…')
                : (isFr ? 'Décaler' : 'Postpone')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Résiliation par le studio */}
      <Dialog open={cancelSubDialogOpen} onOpenChange={setCancelSubDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{isFr ? 'Résilier l\'abonnement' : 'Cancel subscription'}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="flex items-start gap-2">
              <input
                type="checkbox"
                id="cancel-now"
                checked={cancelImmediately}
                onChange={(e) => setCancelImmediately(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 mt-0.5"
              />
              <label htmlFor="cancel-now" className="text-sm cursor-pointer">
                {isFr ? 'Résilier immédiatement' : 'Cancel immediately'}
                <span className="block text-xs text-muted-foreground">
                  {isFr
                    ? 'Sans cette option, le membre garde ses droits jusqu\'à la fin de la période déjà payée.'
                    : 'Without this, the member keeps access until the end of the period already paid.'}
                </span>
              </label>
            </div>

            {cancelImmediately && (
              <div className="flex items-start gap-2 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-500/40 p-3 text-sm">
                <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                <p className="text-amber-900 dark:text-amber-200">
                  {isFr
                    ? 'Le membre perd immédiatement l\'accès, y compris pour la période qu\'il a payée. Aucun remboursement n\'est effectué automatiquement.'
                    : 'The member loses access at once, including the period already paid. No refund is issued automatically.'}
                </p>
              </div>
            )}
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setCancelSubDialogOpen(false)} disabled={!!subActionRunning}>
              {t('common.cancel')}
            </Button>
            <Button variant="destructive" onClick={handleCancelSubscription} disabled={!!subActionRunning}>
              {subActionRunning === 'cancel'
                ? (isFr ? 'Résiliation…' : 'Cancelling…')
                : (isFr ? 'Confirmer' : 'Confirm')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Remise à zéro — outil de test.
          La saisie du nom évite le clic réflexe : cette action est irréversible
          et détruit des lignes, contrairement aux autres boutons de la page. */}
      <Dialog open={resetDialogOpen} onOpenChange={setResetDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{isFr ? 'Remise à zéro des achats' : 'Reset purchases'}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="flex items-start gap-2 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-500/40 p-3 text-sm">
              <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
              <div className="text-amber-900 dark:text-amber-200">
                <p className="font-medium">
                  {isFr ? 'Action irréversible, réservée aux tests.' : 'Irreversible, for testing only.'}
                </p>
                <p className="text-xs mt-1">
                  {isFr
                    ? 'Seront supprimés : packs, abonnements, réservations, liste d\'attente, frais d\'inscription et essai gratuit. Le compte et son profil sont conservés.'
                    : 'Will be deleted: packs, subscriptions, bookings, waitlist, registration fee and free trial. The account and profile are kept.'}
                </p>
              </div>
            </div>

            <p className="text-xs text-muted-foreground">
              {isFr
                ? 'Les abonnements encore actifs chez Stripe ne sont pas résiliés par cette action : résiliez-les avant, sinon un prélèvement pourrait survenir sans contrepartie en base.'
                : 'Subscriptions still active at Stripe are not cancelled by this action: cancel them first, otherwise a charge could occur with no matching record.'}
            </p>

            <div className="space-y-2">
              <Label>
                {isFr
                  ? <>Tapez <span className="font-mono font-semibold">{profile.display_name}</span> pour confirmer</>
                  : <>Type <span className="font-mono font-semibold">{profile.display_name}</span> to confirm</>}
              </Label>
              <Input
                value={resetConfirmText}
                onChange={(e) => setResetConfirmText(e.target.value)}
                placeholder={profile.display_name ?? ''}
                autoComplete="off"
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setResetDialogOpen(false)} disabled={resetRunning}>
              {t('common.cancel')}
            </Button>
            <Button
              variant="destructive"
              onClick={handleResetPurchases}
              disabled={resetRunning || resetConfirmText.trim() !== (profile.display_name ?? '').trim()}
            >
              {resetRunning
                ? (isFr ? 'Suppression…' : 'Deleting…')
                : (isFr ? 'Tout effacer' : 'Delete all')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Suppression du compte à la demande du membre */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-destructive">
              {isFr ? 'Supprimer le compte' : 'Delete account'}
            </DialogTitle>
          </DialogHeader>

          {/* L'abonnement actif est un blocage, pas un avertissement : Stripe
              ne sait rien de la suppression et continuerait de prélever. On le
              dit AVANT que l'admin tape le nom pour rien. */}
          {hasActiveSubscription ? (
            <div className="space-y-3">
              <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-4">
                <p className="font-medium text-destructive">
                  {isFr ? 'Abonnement en cours — résiliez-le d\'abord' : 'Active subscription — cancel it first'}
                </p>
                <p className="text-sm text-muted-foreground mt-2">
                  {isFr
                    ? 'Ce membre a un abonnement actif. Le supprimer maintenant laisserait Stripe continuer les prélèvements, sans que personne puisse les arrêter côté application.'
                    : 'This member has an active subscription. Deleting now would let Stripe keep charging, with no way to stop it from the app.'}
                </p>
                <p className="text-sm text-muted-foreground mt-2">
                  {isFr
                    ? 'Résiliez l\'abonnement dans l\'onglet Abonnement, puis revenez ici.'
                    : 'Cancel the subscription in the Subscription tab, then come back.'}
                </p>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
                  {t('common.close')}
                </Button>
              </DialogFooter>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-4 space-y-2 text-sm">
                <p className="font-medium text-destructive">
                  {isFr ? 'Cette action est définitive.' : 'This cannot be undone.'}
                </p>
                <p className="text-muted-foreground">
                  {isFr
                    ? 'Nom, coordonnées, date de naissance, contact d\'urgence, informations de santé, performances et notifications seront effacés. Les réservations à venir seront annulées.'
                    : 'Name, contact details, date of birth, emergency contact, health information, performances and notifications will be erased. Upcoming bookings will be cancelled.'}
                </p>
                <p className="text-muted-foreground">
                  {isFr
                    ? 'Les justificatifs de paiement — frais d\'inscription, packs, abonnements — sont conservés sans lien avec l\'identité, comme la loi comptable l\'exige.'
                    : 'Payment records — registration fees, packs, subscriptions — are kept without any link to identity, as accounting law requires.'}
                </p>
              </div>

              <div className="space-y-2">
                <Label>
                  {isFr
                    ? <>Tapez <span className="font-mono font-semibold">{profile.display_name}</span> pour confirmer</>
                    : <>Type <span className="font-mono font-semibold">{profile.display_name}</span> to confirm</>}
                </Label>
                <Input
                  value={deleteConfirmText}
                  onChange={(e) => setDeleteConfirmText(e.target.value)}
                  placeholder={profile.display_name ?? ''}
                  autoComplete="off"
                />
              </div>

              <DialogFooter className="gap-2 sm:gap-0">
                <Button variant="outline" onClick={() => setDeleteDialogOpen(false)} disabled={deleteRunning}>
                  {t('common.cancel')}
                </Button>
                <Button
                  variant="destructive"
                  onClick={handleDeleteAccount}
                  disabled={deleteRunning || deleteConfirmText.trim() !== (profile.display_name ?? '').trim()}
                >
                  {deleteRunning
                    ? (isFr ? 'Suppression…' : 'Deleting…')
                    : (isFr ? 'Supprimer le compte' : 'Delete account')}
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Book Class Dialog */}
      <Dialog open={bookDialogOpen} onOpenChange={setBookDialogOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CalendarDays className="h-5 w-5 text-primary" />
              {i18n.language === 'fr' ? 'Inscrire à un cours' : 'Book a class'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Class selection */}
            <div className="space-y-2">
              <Label>{i18n.language === 'fr' ? 'Cours' : 'Class'}</Label>
              <Select
                value={selectedClassId}
                onValueChange={(val) => {
                  setSelectedClassId(val ?? '')
                  setSelectedPackId('')
                }}
              >
                <SelectTrigger className="h-auto min-h-[2.5rem] whitespace-normal text-left">
                  <span className="text-sm">
                    {selectedClass
                      ? `${selectedClass.class_type?.name} — ${format(new Date(selectedClass.starts_at), 'EEE dd/MM HH:mm', { locale })} — ${selectedClass.coach?.display_name ?? ''}`
                      : i18n.language === 'fr' ? 'Choisir un cours' : 'Choose a class'
                    }
                  </span>
                </SelectTrigger>
                <SelectContent className="max-w-[calc(100vw-2rem)] w-[500px]">
                  {availableClasses.map(sc => (
                    <SelectItem key={sc.id} value={sc.id} className="text-sm">
                      <div className="flex flex-col">
                        <span className="font-medium">{sc.class_type?.name}</span>
                        <span className="text-xs text-muted-foreground">
                          {format(new Date(sc.starts_at), 'EEEE dd/MM HH:mm', { locale })} — {sc.coach?.display_name}
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Pack selection (filtered by credit type) */}
            {selectedClassId && (
              <div className="space-y-2">
                <Label>{i18n.language === 'fr' ? 'Pack à débiter' : 'Pack to debit'}</Label>
                {compatiblePacks.length === 0 ? (
                  <p className="text-sm text-destructive">{t('schedule.noCredits')}</p>
                ) : (
                  <Select
                    value={selectedPackId}
                    onValueChange={(val) => setSelectedPackId(val ?? '')}
                  >
                    <SelectTrigger>
                      <span>
                        {selectedPackId
                          ? (() => {
                              const p = compatiblePacks.find(p => p.id === selectedPackId)
                              if (!p) return ''
                              // « X crédits » sur un illimité serait trompeur :
                              // son compteur ne bouge jamais.
                              const detail = p.pack_type?.is_unlimited
                                ? (isFr ? 'illimité' : 'unlimited')
                                : `${p.credits_remaining} ${isFr ? 'crédits' : 'credits'}`
                              return `${p.pack_type?.name} (${detail})`
                            })()
                          : i18n.language === 'fr' ? 'Choisir la source' : 'Choose the source'
                        }
                      </span>
                    </SelectTrigger>
                    <SelectContent>
                      {compatiblePacks.map(p => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.pack_type?.name}
                          {p.subscription_id ? (isFr ? ' (abonnement)' : ' (subscription)') : ''}
                          {' — '}
                          {p.pack_type?.is_unlimited
                            ? (isFr ? 'illimité' : 'unlimited')
                            : `${p.credits_remaining} ${isFr ? 'crédits' : 'credits'}`}
                          {' — exp. '}{format(new Date(p.expires_at), 'dd/MM', { locale })}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setBookDialogOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button
              onClick={handleBookClass}
              disabled={!selectedClassId || !selectedPackId || bookingSaving}
            >
              {bookingSaving ? '...' : t('common.confirm')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Pack Dialog */}
      <Dialog open={editPackDialogOpen} onOpenChange={setEditPackDialogOpen}>
        <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="h-5 w-5 text-primary" />
              {i18n.language === 'fr' ? 'Modifier le pack' : 'Edit pack'}
            </DialogTitle>
          </DialogHeader>

          {editingPack && (
            <div className="space-y-4">
              <div className="p-3 rounded-lg bg-muted/50">
                <p className="font-medium">{editingPack.pack_type?.name}</p>
                <p className="text-xs text-muted-foreground">
                  {i18n.language === 'fr'
                    ? editingPack.pack_type?.credit_type?.label_fr
                    : editingPack.pack_type?.credit_type?.label_en}
                  {' · '}
                  {i18n.language === 'fr' ? 'Acheté le' : 'Purchased'} {format(new Date(editingPack.purchased_at), 'dd/MM/yyyy', { locale })}
                  {' · '}
                  {formatEuros(editingPack.price_paid_cents, 0)}
                </p>
              </div>

              {editingPack.pack_type?.is_unlimited ? (
                // Rien a ajuster sur un illimite : le compteur n'est jamais consomme
                <div className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">
                  {isFr
                    ? "Accès illimité — aucun crédit n'est décompté ni restitué. Seule la date de fin de validité s'applique."
                    : 'Unlimited access — no credit is deducted or refunded. Only the expiry date applies.'}
                </div>
              ) : (
                <div className="space-y-2">
                  <Label>{i18n.language === 'fr' ? 'Crédits restants' : 'Credits remaining'}</Label>
                  <Input
                    type="number"
                    min={0}
                    max={editingPack.pack_type?.credit_count ?? 999}
                    value={editCredits}
                    onChange={(e) => setEditCredits(parseInt(e.target.value) || 0)}
                  />
                  <p className="text-[11px] text-muted-foreground">
                    {i18n.language === 'fr' ? 'Pack original' : 'Original pack'}: {editingPack.pack_type?.credit_count} crédits
                  </p>
                </div>
              )}

              <div className="space-y-2">
                <Label>{i18n.language === 'fr' ? 'Date de fin de validité' : 'Expiry date'}</Label>
                <Input
                  type="date"
                  value={editExpiresAt}
                  onChange={(e) => setEditExpiresAt(e.target.value)}
                />
              </div>

              {/* Bookings made with this pack */}
              <div className="space-y-2">
                <Label>{i18n.language === 'fr' ? 'Réservations avec ce pack' : 'Bookings with this pack'}</Label>
                {(() => {
                  const packBookings = bookings.filter(b => b.pack_purchase_id === editingPack.id)
                  if (packBookings.length === 0) {
                    return (
                      <p className="text-xs text-muted-foreground py-2">
                        {i18n.language === 'fr' ? 'Aucune réservation' : 'No bookings'}
                      </p>
                    )
                  }
                  return (
                    <div className="space-y-1.5 max-h-48 overflow-y-auto">
                      {packBookings.map(b => {
                        const sc = b.scheduled_class
                        const startsAt = new Date(sc?.starts_at ?? '')
                        const isPastBooking = startsAt < now
                        return (
                          <div
                            key={b.id}
                            className={cn(
                              'flex items-center justify-between p-2 rounded border text-xs',
                              isPastBooking && 'opacity-60'
                            )}
                          >
                            <div>
                              <span className="font-medium">{sc?.class_type?.name}</span>
                              <span className="text-muted-foreground ml-2">
                                {format(startsAt, 'dd/MM/yyyy HH:mm', { locale })}
                              </span>
                            </div>
                            <Badge
                              variant={b.status === 'confirmed' ? 'default' : 'secondary'}
                              className="text-[10px] h-5"
                            >
                              {t(`bookings.status.${b.status}`)}
                            </Badge>
                          </div>
                        )
                      })}
                    </div>
                  )
                })()}
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditPackDialogOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button onClick={handleEditPack} disabled={editPackSaving}>
              {editPackSaving ? '...' : t('common.save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Profile Dialog (name fields) */}
      <Dialog open={editProfileOpen} onOpenChange={setEditProfileOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{isFr ? 'Éditer le profil' : 'Edit profile'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1">
              <Label>{isFr ? 'Nom affiché' : 'Display name'}</Label>
              <Input
                value={editProfileForm.display_name}
                onChange={(e) => setEditProfileForm(f => ({ ...f, display_name: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>{isFr ? 'Prénom' : 'First name'}</Label>
                <Input
                  value={editProfileForm.first_name}
                  onChange={(e) => setEditProfileForm(f => ({ ...f, first_name: e.target.value }))}
                />
              </div>
              <div className="space-y-1">
                <Label>{isFr ? 'Nom' : 'Last name'}</Label>
                <Input
                  value={editProfileForm.last_name}
                  onChange={(e) => setEditProfileForm(f => ({ ...f, last_name: e.target.value }))}
                />
              </div>
            </div>
            <div className="rounded-md border bg-muted/30 p-3 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <div className="space-y-0.5 min-w-0">
                  <p className="text-xs font-medium">{isFr ? 'Adresse email' : 'Email address'}</p>
                  <p className="text-xs text-muted-foreground truncate">{profile.email ?? '—'}</p>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs shrink-0"
                  onClick={() => { setEditProfileOpen(false); openEmailDialog() }}
                >
                  <Mail className="h-3 w-3 mr-1" />
                  {isFr ? 'Corriger…' : 'Fix…'}
                </Button>
              </div>
              <p className="text-[11px] text-muted-foreground">
                {isFr
                  ? `Un lien de confirmation sera envoyé à la nouvelle adresse. Le changement n'est effectif qu'après confirmation par le membre.`
                  : `A confirmation link will be sent to the new address. The change applies only after the member confirms.`}
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditProfileOpen(false)} disabled={editProfileSaving}>
              {t('common.cancel')}
            </Button>
            <Button onClick={handleSaveProfile} disabled={editProfileSaving || !editProfileForm.display_name.trim()}>
              {editProfileSaving ? '...' : (isFr ? 'Enregistrer' : 'Save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Password Reset Dialog (super_admin only) */}
      {/* Email change dialog (admin / super_admin) */}
      <Dialog open={emailDialogOpen} onOpenChange={setEmailDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Mail className="h-4 w-4" />
              {isFr ? `Corriger l'email de ${profile.display_name}` : `Fix email for ${profile.display_name}`}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-xs text-muted-foreground">
              {isFr
                ? `Adresse actuelle : ${profile.email ?? '—'}. Un lien de confirmation sera envoyé à la nouvelle adresse — le changement ne s'applique qu'après que le membre clique sur ce lien.`
                : `Current address: ${profile.email ?? '—'}. A confirmation link will be sent to the new address — the change applies only after the member clicks it.`}
            </p>
            <div className="space-y-1">
              <Label htmlFor="admin-new-email">{isFr ? 'Nouvelle adresse email' : 'New email'}</Label>
              <Input
                id="admin-new-email"
                type="email"
                autoComplete="off"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                placeholder="prenom.nom@example.com"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEmailDialogOpen(false)} disabled={emailSaving}>
              {t('common.cancel')}
            </Button>
            <Button
              onClick={handleChangeEmail}
              disabled={emailSaving || !newEmail.trim()}
            >
              {emailSaving ? '...' : (isFr ? 'Envoyer le lien' : 'Send link')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={passwordDialogOpen} onOpenChange={setPasswordDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <KeyRound className="h-4 w-4" />
              {isFr ? 'Changer le mot de passe' : 'Change password'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-xs text-muted-foreground">
              {isFr
                ? `Définir un nouveau mot de passe pour ${profile.display_name}. Le membre devra l'utiliser à sa prochaine connexion.`
                : `Set a new password for ${profile.display_name}. The member will use it on next sign-in.`}
            </p>
            <div className="space-y-1">
              <Label htmlFor="new-password">{isFr ? 'Nouveau mot de passe' : 'New password'}</Label>
              <Input
                id="new-password"
                type="password"
                autoComplete="new-password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder={isFr ? 'Min. 12 caractères' : 'Min. 12 characters'}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="confirm-password">{isFr ? 'Confirmer' : 'Confirm'}</Label>
              <Input
                id="confirm-password"
                type="password"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPasswordDialogOpen(false)} disabled={passwordSaving}>
              {t('common.cancel')}
            </Button>
            <Button
              onClick={handleResetPassword}
              disabled={passwordSaving || newPassword.length < 12 || newPassword !== confirmPassword}
            >
              {passwordSaving ? '...' : (isFr ? 'Mettre à jour' : 'Update')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function BookingRow({ booking, locale, t, isPast }: {
  booking: Booking
  locale: typeof fr
  t: (key: string) => string
  isPast?: boolean
}) {
  const sc = booking.scheduled_class
  const startsAt = new Date(sc?.starts_at ?? '')

  return (
    <div className={cn(
      'flex items-center gap-3 p-3 rounded-xl border',
      isPast ? 'opacity-60' : 'bg-card'
    )}>
      <div className="flex flex-col items-center justify-center h-11 w-11 rounded-lg bg-primary/10 shrink-0">
        <span className="text-[10px] font-medium text-primary uppercase">
          {format(startsAt, 'EEE', { locale })}
        </span>
        <span className="text-base font-bold text-primary leading-none">
          {format(startsAt, 'd')}
        </span>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="font-medium text-sm truncate">{sc?.class_type?.name}</p>
          <Badge
            variant={booking.status === 'confirmed' ? 'default' : 'secondary'}
            className="text-[10px] h-5"
          >
            {t(`bookings.status.${booking.status}`)}
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground flex items-center gap-1">
          <Clock className="h-3 w-3" />
          {format(startsAt, 'HH:mm', { locale })} · {sc?.duration_minutes} min
          {sc?.coach?.display_name && ` · ${sc.coach.display_name}`}
        </p>
      </div>
    </div>
  )
}

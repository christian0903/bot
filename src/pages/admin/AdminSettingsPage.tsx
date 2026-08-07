import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { LoadingState } from '@/components/common/LoadingState'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { toast } from 'sonner'
import { Settings, CreditCard, Users, Clock, Building, Shield, CalendarDays, Star } from 'lucide-react'

interface RoomNames {
  haut: string
  bas: string
}

interface BookingRules {
  morning_cutoff_hour: number
  morning_class_before_hour: number
  afternoon_hours_before_no_bookings: number
  afternoon_minutes_before_with_bookings: number
  cancellation_free_hours: number
  no_show_auto_minutes: number
  pt_cancellation_free_hours: number
}

interface StudioInfo {
  name: string
  address: string
  phone: string
  email: string
  vat_number: string
  /** Numéro d'entreprise (BCE). Distinct du n° TVA, qui peut différer. */
  company_number: string
  instagram_url: string
  facebook_url: string
  website_url: string
  tiktok_url: string
  youtube_url: string
  /** Numéro au format international sans espaces ni « + » — ex. 32470123456. */
  whatsapp_number: string
  /** Lien d'avis Google. Mieux vaut susciter des avis que les afficher. */
  google_review_url: string
}

export function AdminSettingsPage() {
  const { i18n } = useTranslation()
  const isFr = i18n.language === 'fr'
  const { user, hasRole } = useAuth()
  const isSuperAdmin = hasRole('super_admin')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)

  // Stripe
  const [stripeLive, setStripeLive] = useState(false)

  // Booking rules
  const [rules, setRules] = useState<BookingRules>({
    morning_cutoff_hour: 20,
    morning_class_before_hour: 12,
    afternoon_hours_before_no_bookings: 3,
    afternoon_minutes_before_with_bookings: 30,
    cancellation_free_hours: 12,
    no_show_auto_minutes: 15,
    pt_cancellation_free_hours: 24,
  })

  // Studio info
  const [studio, setStudio] = useState<StudioInfo>({
    name: 'Back On Track',
    address: '',
    phone: '',
    email: '',
    vat_number: '',
    company_number: '',
    instagram_url: '',
    facebook_url: '',
    website_url: '',
    tiktok_url: '',
    youtube_url: '',
    whatsapp_number: '',
    google_review_url: '',
  })

  // Room names
  const [roomNames, setRoomNames] = useState<RoomNames>({
    haut: 'Back On Track Upstairs',
    bas: 'Back On Track Studio',
  })

  // Registration fee
  const [regFeeAmount, setRegFeeAmount] = useState(30)
  const [regFeeEnabled, setRegFeeEnabled] = useState(true)
  /** Coût moyen d'une séance sur un pack illimité (€), pour le calcul du CA. */
  /** Achat minimum pour qu'un filleul puisse activer son bon de parrainage. */
  const [referralMinPurchase, setReferralMinPurchase] = useState(30)
  const [referrerReward, setReferrerReward] = useState(30)
  const [refereeReward, setRefereeReward] = useState(30)
  const [referralValidity, setReferralValidity] = useState(180)
  /** Reste de la clé referral_rules (montants, validité) : à préserver au save. */
  const [referralRules, setReferralRules] = useState<Record<string, unknown> | null>(null)
  const [unlimitedCost, setUnlimitedCost] = useState(0)
  /** Seuil d'alerte : nombre d'annulations par cycle au-delà duquel signaler. */
  const [cancelAlert, setCancelAlert] = useState(4)
  /** Minimum de participants pour qu'un cours compte comme donné. */
  const [minParticipants, setMinParticipants] = useState(1)
  /** Demande d'avis après un cours : active, et combien de jours affichée. */
  const [reviewsEnabled, setReviewsEnabled] = useState(true)
  const [reviewDays, setReviewDays] = useState(7)

  useEffect(() => {
    const fetchData = async () => {
      const { data } = await supabase
        .from('app_settings')
        .select('*')
        .in('key', ['stripe_mode', 'booking_rules', 'studio_info', 'registration_fee', 'room_names', 'unlimited_session_cost', 'cancellation_alert', 'class_given_rule', 'referral_rules', 'class_reviews'])

      for (const setting of data ?? []) {
        if (setting.key === 'stripe_mode') {
          setStripeLive((setting.value as { mode: string }).mode === 'live')
        }
        if (setting.key === 'booking_rules') {
          setRules(prev => ({ ...prev, ...(setting.value as Partial<BookingRules>) }))
        }
        if (setting.key === 'studio_info') {
          setStudio(prev => ({ ...prev, ...(setting.value as Partial<StudioInfo>) }))
        }
        if (setting.key === 'registration_fee') {
          const val = setting.value as { amount_cents?: number; enabled?: boolean }
          setRegFeeAmount((val.amount_cents ?? 3000) / 100)
          setRegFeeEnabled(val.enabled ?? true)
        }
        if (setting.key === 'room_names') {
          setRoomNames(prev => ({ ...prev, ...(setting.value as Partial<RoomNames>) }))
        }
        if (setting.key === 'unlimited_session_cost') {
          const val = setting.value as { amount_cents?: number }
          setUnlimitedCost((val.amount_cents ?? 0) / 100)
        }
        if (setting.key === 'referral_rules') {
          const val = setting.value as {
            min_purchase_cents?: number
            referrer_reward_cents?: number
            referee_reward_cents?: number
            reward_validity_days?: number
          }
          setReferralRules(setting.value as Record<string, unknown>)
          setReferralMinPurchase((val.min_purchase_cents ?? 3000) / 100)
          setReferrerReward((val.referrer_reward_cents ?? 3000) / 100)
          setRefereeReward((val.referee_reward_cents ?? 3000) / 100)
          setReferralValidity(val.reward_validity_days ?? 180)
        }
        if (setting.key === 'class_reviews') {
          const v = setting.value as { enabled?: boolean; days_to_review?: number }
          setReviewsEnabled(v.enabled ?? true)
          setReviewDays(v.days_to_review ?? 7)
        }
        if (setting.key === 'cancellation_alert') {
          const val = setting.value as { threshold_per_cycle?: number }
          setCancelAlert(val.threshold_per_cycle ?? 4)
        }
        if (setting.key === 'class_given_rule') {
          const val = setting.value as { min_participants?: number }
          setMinParticipants(val.min_participants ?? 1)
        }
      }
      setLoading(false)
    }
    fetchData()
  }, [])

  const saveSetting = async (key: string, value: Record<string, unknown>) => {
    setSaving(key)

    // upsert et non update : un UPDATE sur une clé absente ne renvoie PAS
    // d'erreur, il touche zéro ligne. L'ancien code affichait donc
    // « Paramètres enregistrés » sans rien écrire pour tout nouveau réglage.
    const { error } = await supabase
      .from('app_settings')
      .upsert({ key, value, updated_by: user?.id ?? null }, { onConflict: 'key' })

    setSaving(null)

    if (error) {
      console.error('app_settings upsert', error)
      toast.error(error.message)
      return
    }
    toast.success(isFr ? 'Paramètres enregistrés' : 'Settings saved')
  }

  /**
   * Mentions légales manquantes.
   *
   * Signalées plutôt que supposées présentes : elles bloquent les CGV, la
   * politique de confidentialité et les factures, et rien ne le dirait
   * autrement — les documents se contenteraient d'afficher un trou.
   */
  const missingLegal = [
    !studio.name.trim() && (isFr ? 'dénomination' : 'legal name'),
    !studio.company_number.trim() && (isFr ? 'n° d\'entreprise' : 'company number'),
    !studio.address.trim() && (isFr ? 'adresse du siège' : 'registered address'),
    !studio.email.trim() && (isFr ? 'email de contact' : 'contact email'),
  ].filter(Boolean) as string[]

  if (loading) return <LoadingState />

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold flex items-center gap-2">
        <Settings className="h-6 w-6 text-primary" />
        {isFr ? 'Paramètres' : 'Settings'}
      </h1>

      {/* Studio info */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Building className="h-4 w-4 text-primary" />
            {isFr ? 'Informations du studio' : 'Studio information'}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Ces données ne sont pas décoratives : elles alimentent les CGV, la
              politique de confidentialité et les factures. Tant qu'elles sont
              vides, ces documents portent des mentions manquantes. */}
          <p className="text-xs text-muted-foreground">
            {isFr
              ? 'Ces informations apparaissent sur vos documents légaux (CGV, politique de confidentialité) et sur les factures. Elles sont obligatoires en Belgique.'
              : 'This information appears on your legal documents (terms, privacy policy) and on invoices. It is legally required in Belgium.'}
          </p>

          {missingLegal.length > 0 && (
            <div className="rounded-lg border border-amber-500/50 bg-amber-50 dark:bg-amber-950/20 p-3">
              <p className="text-sm font-medium text-amber-800 dark:text-amber-300">
                {isFr ? 'Mentions légales incomplètes' : 'Legal details incomplete'}
              </p>
              <p className="text-xs text-amber-700/80 dark:text-amber-400/80 mt-1">
                {isFr ? 'Manque : ' : 'Missing: '}{missingLegal.join(', ')}
              </p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>{isFr ? 'Dénomination sociale' : 'Legal name'} *</Label>
              <Input
                value={studio.name}
                onChange={e => setStudio(s => ({ ...s, name: e.target.value }))}
                placeholder={isFr ? 'Ex. Back On Track SRL' : 'e.g. Back On Track Ltd'}
              />
            </div>
            <div className="space-y-2">
              <Label>{isFr ? 'N° d\'entreprise (BCE)' : 'Company number'} *</Label>
              <Input
                value={studio.company_number}
                onChange={e => setStudio(s => ({ ...s, company_number: e.target.value }))}
                placeholder="BE 0123.456.789"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>{isFr ? 'Adresse du siège' : 'Registered address'} *</Label>
              <Input
                value={studio.address}
                onChange={e => setStudio(s => ({ ...s, address: e.target.value }))}
                placeholder={isFr ? 'Rue, numéro, code postal, commune' : 'Street, number, postcode, city'}
              />
            </div>
            <div className="space-y-2">
              <Label>{isFr ? 'N° TVA' : 'VAT number'}</Label>
              <Input
                value={studio.vat_number}
                onChange={e => setStudio(s => ({ ...s, vat_number: e.target.value }))}
                placeholder="BE 0123.456.789"
              />
              <p className="text-[11px] text-muted-foreground">
                {isFr
                  ? 'Laisser vide s\'il est identique au numéro d\'entreprise.'
                  : 'Leave empty if identical to the company number.'}
              </p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>{isFr ? 'Téléphone' : 'Phone'}</Label>
              <Input value={studio.phone} onChange={e => setStudio(s => ({ ...s, phone: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>{isFr ? 'Email de contact' : 'Contact email'} *</Label>
              <Input type="email" value={studio.email} onChange={e => setStudio(s => ({ ...s, email: e.target.value }))} />
              <p className="text-[11px] text-muted-foreground">
                {isFr
                  ? 'Sert aussi aux demandes relatives aux données personnelles (RGPD).'
                  : 'Also used for personal data requests (GDPR).'}
              </p>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Instagram</Label>
              <Input value={studio.instagram_url} onChange={e => setStudio(s => ({ ...s, instagram_url: e.target.value }))} placeholder="https://instagram.com/..." />
            </div>
            <div className="space-y-2">
              <Label>Facebook</Label>
              <Input value={studio.facebook_url} onChange={e => setStudio(s => ({ ...s, facebook_url: e.target.value }))} placeholder="https://facebook.com/..." />
            </div>
            <div className="space-y-2">
              <Label>{isFr ? 'Site web' : 'Website'}</Label>
              <Input value={studio.website_url} onChange={e => setStudio(s => ({ ...s, website_url: e.target.value }))} placeholder="https://..." />
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label>TikTok</Label>
              <Input value={studio.tiktok_url} onChange={e => setStudio(s => ({ ...s, tiktok_url: e.target.value }))} placeholder="https://tiktok.com/@..." />
            </div>
            <div className="space-y-2">
              <Label>YouTube</Label>
              <Input value={studio.youtube_url} onChange={e => setStudio(s => ({ ...s, youtube_url: e.target.value }))} placeholder="https://youtube.com/@..." />
            </div>
            <div className="space-y-2">
              <Label>WhatsApp</Label>
              <Input
                value={studio.whatsapp_number}
                onChange={e => setStudio(s => ({ ...s, whatsapp_number: e.target.value }))}
                placeholder="32470123456"
              />
              <p className="text-[11px] text-muted-foreground">
                {isFr
                  ? 'Format international, sans + ni espaces.'
                  : 'International format, no + or spaces.'}
              </p>
            </div>
            <div className="space-y-2">
              <Label>{isFr ? 'Avis Google' : 'Google review'}</Label>
              <Input value={studio.google_review_url} onChange={e => setStudio(s => ({ ...s, google_review_url: e.target.value }))} placeholder="https://g.page/r/.../review" />
              <p className="text-[11px] text-muted-foreground">
                {isFr
                  ? 'Lien qui ouvre le formulaire d\'avis.'
                  : 'Link that opens the review form.'}
              </p>
            </div>
          </div>

          {/* Les liens vides ne s'affichent nulle part : renseigner un réseau
              suffit à le faire apparaître, l'effacer le retire. */}
          <p className="text-xs text-muted-foreground">
            {isFr
              ? 'Ces liens apparaissent sur la page d\'accueil, publique et connectée. Un champ vide n\'affiche rien.'
              : 'These links appear on the home page, public and signed-in. An empty field shows nothing.'}
          </p>
          <Button size="sm" disabled={saving === 'studio_info'} onClick={() => saveSetting('studio_info', studio as unknown as Record<string, unknown>)}>
            {saving === 'studio_info' ? '...' : (isFr ? 'Enregistrer' : 'Save')}
          </Button>
        </CardContent>
      </Card>

      {/* Room names */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Building className="h-4 w-4 text-primary" />
            {isFr ? 'Noms des salles' : 'Room names'}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground font-mono bg-muted px-1.5 py-0.5 rounded">bas</span>
                {isFr ? 'Salle du bas' : 'Lower room'}
              </Label>
              <Input value={roomNames.bas} onChange={e => setRoomNames(r => ({ ...r, bas: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground font-mono bg-muted px-1.5 py-0.5 rounded">haut</span>
                {isFr ? 'Salle du haut' : 'Upper room'}
              </Label>
              <Input value={roomNames.haut} onChange={e => setRoomNames(r => ({ ...r, haut: e.target.value }))} />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            {isFr
              ? 'Les noms sont affichés aux clients. Les slugs (bas/haut) sont utilisés dans l\'administration.'
              : 'Names are shown to clients. Slugs (bas/haut) are used in admin views.'}
          </p>
          <Button size="sm" disabled={saving === 'room_names'} onClick={() => saveSetting('room_names', roomNames as unknown as Record<string, unknown>)}>
            {saving === 'room_names' ? '...' : (isFr ? 'Enregistrer' : 'Save')}
          </Button>
        </CardContent>
      </Card>

      {/* Booking rules */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Clock className="h-4 w-4 text-primary" />
            {isFr ? 'Règles de réservation' : 'Booking rules'}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <p className="text-xs text-muted-foreground">
            {isFr
              ? "Ces règles déterminent jusqu'à quand un membre peut réserver un cours, et jusqu'à quand il peut annuler sans perdre son crédit."
              : 'These rules set how late a member can book a class, and how late they can cancel without losing their credit.'}
          </p>

          {/* ---- Fermeture des réservations ---- */}
          <div className="space-y-4">
            <div>
              <p className="text-sm font-semibold">
                {isFr ? 'Fermeture des réservations' : 'Booking cut-off'}
              </p>
              <p className="text-xs text-muted-foreground">
                {isFr
                  ? "Les cours du matin ferment la veille au soir : le coach doit savoir s'il se lève. Les cours de l'après-midi ferment le jour même, plus ou moins tard selon qu'il y a déjà du monde inscrit."
                  : 'Morning classes close the evening before, so the coach knows whether to get up. Afternoon classes close on the day, earlier or later depending on whether anyone has booked.'}
              </p>
            </div>

            <div className="space-y-1.5">
              <Label className="text-sm">
                {isFr ? 'Un cours est « du matin » s\'il commence avant' : 'A class counts as "morning" if it starts before'}
              </Label>
              <div className="flex items-center gap-2">
                <Input type="number" min={0} max={23} className="w-20"
                  value={rules.morning_class_before_hour}
                  onChange={e => setRules(r => ({ ...r, morning_class_before_hour: parseInt(e.target.value) || 12 }))} />
                <span className="text-sm text-muted-foreground">{isFr ? 'h' : 'h'}</span>
              </div>
              <p className="text-xs text-muted-foreground">
                {isFr
                  ? `Sépare les deux régimes ci-dessous. À ${rules.morning_class_before_hour} h : un cours de 9 h suit la règle du matin, un cours de 14 h celle de l'après-midi.`
                  : `Separates the two rules below. At ${rules.morning_class_before_hour}h: a 9am class follows the morning rule, a 2pm class the afternoon one.`}
              </p>
            </div>

            <div className="space-y-1.5">
              <Label className="text-sm">
                {isFr ? 'Cours du matin : réservations fermées la veille à' : 'Morning classes: bookings close the day before at'}
              </Label>
              <div className="flex items-center gap-2">
                <Input type="number" min={0} max={23} className="w-20"
                  value={rules.morning_cutoff_hour}
                  onChange={e => setRules(r => ({ ...r, morning_cutoff_hour: parseInt(e.target.value) || 20 }))} />
                <span className="text-sm text-muted-foreground">h</span>
              </div>
              <p className="text-xs text-muted-foreground">
                {isFr
                  ? `Personne ne peut plus s'inscrire à un cours du matin après ${rules.morning_cutoff_hour} h la veille.`
                  : `Nobody can book a morning class after ${rules.morning_cutoff_hour}h the previous day.`}
              </p>
            </div>

            <div className="space-y-1.5">
              <Label className="text-sm">
                {isFr ? 'Cours de l\'après-midi, si personne n\'est encore inscrit : fermeture' : 'Afternoon classes, if nobody has booked yet: closes'}
              </Label>
              <div className="flex items-center gap-2">
                <Input type="number" min={0} className="w-20"
                  value={rules.afternoon_hours_before_no_bookings}
                  onChange={e => setRules(r => ({ ...r, afternoon_hours_before_no_bookings: parseInt(e.target.value) || 3 }))} />
                <span className="text-sm text-muted-foreground">{isFr ? 'h avant le cours' : 'h before the class'}</span>
              </div>
              <p className="text-xs text-muted-foreground">
                {isFr
                  ? `Un cours vide se ferme tôt : passé ce délai, le coach sait qu'il n'aura personne. Plus le délai est long, plus il est prévenu tôt.`
                  : `An empty class closes early: past this point the coach knows nobody is coming. The longer the delay, the earlier they know.`}
              </p>
            </div>

            <div className="space-y-1.5">
              <Label className="text-sm">
                {isFr ? 'Cours de l\'après-midi, si au moins une personne est inscrite : fermeture' : 'Afternoon classes, if at least one person booked: closes'}
              </Label>
              <div className="flex items-center gap-2">
                <Input type="number" min={0} className="w-20"
                  value={rules.afternoon_minutes_before_with_bookings}
                  onChange={e => setRules(r => ({ ...r, afternoon_minutes_before_with_bookings: parseInt(e.target.value) || 30 }))} />
                <span className="text-sm text-muted-foreground">{isFr ? 'min avant le cours' : 'min before the class'}</span>
              </div>
              <p className="text-xs text-muted-foreground">
                {isFr
                  ? `Le cours a lieu de toute façon : on laisse les retardataires s'inscrire jusqu'à ${rules.afternoon_minutes_before_with_bookings} minutes avant.`
                  : `The class runs anyway: latecomers can still book up to ${rules.afternoon_minutes_before_with_bookings} minutes before.`}
              </p>
            </div>
          </div>

          {/* ---- Annulation ---- */}
          <div className="space-y-4 pt-2 border-t">
            <div>
              <p className="text-sm font-semibold">{isFr ? 'Annulation par le membre' : 'Cancellation by the member'}</p>
              <p className="text-xs text-muted-foreground">
                {isFr
                  ? "Annuler à temps rend le crédit et libère la place. Annuler trop tard consomme la séance : la place n'a plus le temps d'être reprise."
                  : 'Cancelling in time returns the credit and frees the spot. Cancelling too late uses up the session: the spot can no longer be filled.'}
              </p>
            </div>

            <div className="space-y-1.5">
              <Label className="text-sm">
                {isFr ? 'Annulation sans perdre son crédit : jusqu\'à' : 'Cancel without losing the credit: up to'}
              </Label>
              <div className="flex items-center gap-2">
                <Input type="number" min={0} className="w-20"
                  value={rules.cancellation_free_hours}
                  onChange={e => setRules(r => ({ ...r, cancellation_free_hours: parseInt(e.target.value) || 12 }))} />
                <span className="text-sm text-muted-foreground">{isFr ? 'h avant le cours' : 'h before the class'}</span>
              </div>
              <p className="text-xs text-muted-foreground">
                {isFr
                  ? `Au-delà de ${rules.cancellation_free_hours} h avant le début, le crédit revient au membre. En deçà, la séance est décomptée. Sur un abonnement illimité, rien ne se décompte, mais l'annulation tardive est comptabilisée.`
                  : `More than ${rules.cancellation_free_hours}h before the start, the credit goes back to the member. Less than that, the session is used up. On an unlimited pack nothing is deducted, but the late cancellation is recorded.`}
              </p>
            </div>

            {/* Ces deux réglages sont enregistrés mais aucun code ne les lit
                aujourd'hui : le signaler évite de croire qu'on agit sur quelque
                chose. À implémenter ou à retirer. */}
            <div className="rounded-lg border border-dashed p-3 space-y-4">
              <p className="text-xs text-amber-600 dark:text-amber-500 font-medium">
                {isFr
                  ? '⚠ Réglages sans effet aujourd\'hui — la logique correspondante n\'est pas encore implémentée.'
                  : '⚠ These settings have no effect yet — the matching logic is not implemented.'}
              </p>

              <div className="space-y-1.5">
                <Label className="text-sm">
                  {isFr ? 'Personal training : annulation sans frais jusqu\'à' : 'Personal training: free cancellation up to'}
                </Label>
                <div className="flex items-center gap-2">
                  <Input type="number" min={0} className="w-20"
                    value={rules.pt_cancellation_free_hours}
                    onChange={e => setRules(r => ({ ...r, pt_cancellation_free_hours: parseInt(e.target.value) || 24 }))} />
                  <span className="text-sm text-muted-foreground">{isFr ? 'h avant la séance' : 'h before the session'}</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  {isFr
                    ? 'Prévu pour un délai plus strict qu\'en cours collectif : un créneau de coaching individuel ne se remplit pas au dernier moment.'
                    : 'Intended to be stricter than group classes: a one-to-one slot cannot be filled at the last minute.'}
                </p>
              </div>

              <div className="space-y-1.5">
                <Label className="text-sm">
                  {isFr ? 'Absence constatée automatiquement après' : 'Automatic no-show after'}
                </Label>
                <div className="flex items-center gap-2">
                  <Input type="number" min={0} className="w-20"
                    value={rules.no_show_auto_minutes}
                    onChange={e => setRules(r => ({ ...r, no_show_auto_minutes: parseInt(e.target.value) || 15 }))} />
                  <span className="text-sm text-muted-foreground">{isFr ? 'min après le début' : 'min after the start'}</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  {isFr
                    ? 'Prévu pour marquer en absence un inscrit qui n\'a pas pointé passé ce délai. Aujourd\'hui, l\'absence se marque à la main.'
                    : 'Intended to flag as absent a member who has not checked in past this delay. Today, absences are marked by hand.'}
                </p>
              </div>
            </div>
          </div>

          <Button size="sm" disabled={saving === 'booking_rules'} onClick={() => saveSetting('booking_rules', rules as unknown as Record<string, unknown>)}>
            {saving === 'booking_rules' ? '...' : (isFr ? 'Enregistrer' : 'Save')}
          </Button>
        </CardContent>
      </Card>

      {/* Registration fee */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Users className="h-4 w-4 text-primary" />
            {isFr ? 'Frais d\'inscription' : 'Registration fee'}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">{isFr ? 'Frais d\'inscription obligatoires' : 'Registration fee required'}</p>
              <p className="text-xs text-muted-foreground">
                {isFr ? 'Les nouveaux membres doivent payer avant d\'acheter un pack' : 'New members must pay before buying a pack'}
              </p>
            </div>
            <Switch checked={regFeeEnabled} onCheckedChange={setRegFeeEnabled} />
          </div>
          <div className="space-y-2">
            <Label>{isFr ? 'Montant (€)' : 'Amount (€)'}</Label>
            <Input type="number" min={0} className="w-32" value={regFeeAmount} onChange={e => setRegFeeAmount(parseFloat(e.target.value) || 0)} />
          </div>
          <Button size="sm" disabled={saving === 'registration_fee'} onClick={() => saveSetting('registration_fee', { amount_cents: Math.round(regFeeAmount * 100), enabled: regFeeEnabled })}>
            {saving === 'registration_fee' ? '...' : (isFr ? 'Enregistrer' : 'Save')}
          </Button>
        </CardContent>
      </Card>

      {/* Coût moyen d'une séance illimitée */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <CreditCard className="h-4 w-4 text-primary" />
            {isFr ? 'Packs illimités — coût par séance' : 'Unlimited packs — cost per session'}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-xs text-muted-foreground">
            {isFr
              ? "Sur un pack illimité, aucun crédit n'est décompté : le chiffre d'affaires par séance ne peut pas être calculé automatiquement. Ce montant sert de valeur de référence dans les statistiques. Laisser à 0 pour ne rien attribuer."
              : 'On an unlimited pack no credit is deducted, so revenue per session cannot be derived. This amount is used as a reference value in statistics. Leave at 0 to attribute nothing.'}
          </p>
          <div className="space-y-2">
            <Label>{isFr ? 'Montant par séance (€)' : 'Amount per session (€)'}</Label>
            <Input
              type="number"
              min={0}
              step="0.5"
              className="w-32"
              value={unlimitedCost}
              onChange={e => setUnlimitedCost(parseFloat(e.target.value) || 0)}
            />
          </div>
          <Button
            size="sm"
            disabled={saving === 'unlimited_session_cost'}
            onClick={() => saveSetting('unlimited_session_cost', { amount_cents: Math.round(unlimitedCost * 100) })}
          >
            {saving === 'unlimited_session_cost' ? '...' : (isFr ? 'Enregistrer' : 'Save')}
          </Button>
        </CardContent>
      </Card>

      {/* Parrainage — montants, seuil et validité */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <CreditCard className="h-4 w-4 text-primary" />
            {isFr ? 'Parrainage' : 'Referral'}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-xs text-muted-foreground">
            {isFr
              ? "Quand un filleul effectue son premier achat, le parrain et le filleul reçoivent chacun un bon. Un bon s'utilise en une fois, en entier."
              : 'When a referee makes their first purchase, both the referrer and the referee receive a credit note. A note is used once, in full.'}
          </p>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>{isFr ? 'Bon du parrain (€)' : 'Referrer note (€)'}</Label>
              <Input
                type="number" min={0} step="5"
                value={referrerReward}
                onChange={e => setReferrerReward(parseFloat(e.target.value) || 0)}
              />
            </div>
            <div className="space-y-2">
              <Label>{isFr ? 'Bon du filleul (€)' : 'Referee note (€)'}</Label>
              <Input
                type="number" min={0} step="5"
                value={refereeReward}
                onChange={e => setRefereeReward(parseFloat(e.target.value) || 0)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>{isFr ? 'Achat minimum pour le filleul (€)' : 'Minimum purchase for the referee (€)'}</Label>
            <Input
              type="number" min={30} max={100} step="5"
              className="w-32"
              value={referralMinPurchase}
              onChange={e => setReferralMinPurchase(parseFloat(e.target.value) || 30)}
            />
            <p className="text-xs text-muted-foreground">
              {isFr
                ? "Entre 30 € et 100 €. Sans ce seuil, un filleul peut liquider son bon sur une petite série de séances sans vraiment s'engager. Ne s'applique qu'au filleul : le parrain est déjà client, et un dédommagement du studio reste utilisable sans condition."
                : 'Between 30 € and 100 €. Without this threshold, a referee could spend their note on a small pack without really committing. Applies to the referee only: the referrer is already a customer, and studio compensation stays usable without conditions.'}
            </p>
          </div>

          <div className="space-y-2">
            <Label>{isFr ? 'Validité d\'un bon (jours)' : 'Note validity (days)'}</Label>
            <Input
              type="number" min={1} step="30"
              className="w-32"
              value={referralValidity}
              onChange={e => setReferralValidity(parseInt(e.target.value) || 180)}
            />
          </div>

          <Button
            size="sm"
            disabled={saving === 'referral_rules'}
            onClick={() => {
              // Le seuil est borné ici aussi : la saisie peut sortir des bornes
              // du champ selon le navigateur.
              const clamped = Math.min(100, Math.max(30, referralMinPurchase))
              setReferralMinPurchase(clamped)
              // Les clés inconnues de cet écran sont préservées.
              saveSetting('referral_rules', {
                ...(referralRules ?? {}),
                referrer_reward_cents: Math.round(referrerReward * 100),
                referee_reward_cents: Math.round(refereeReward * 100),
                min_purchase_cents: Math.round(clamped * 100),
                reward_validity_days: referralValidity,
              })
            }}
          >
            {saving === 'referral_rules' ? '...' : (isFr ? 'Enregistrer' : 'Save')}
          </Button>

          <p className="text-xs text-muted-foreground">
            {isFr
              ? 'Ces montants s\'appliquent aux futurs parrainages. Les bons déjà créés gardent leur valeur.'
              : 'These amounts apply to future referrals. Notes already created keep their value.'}
          </p>
        </CardContent>
      </Card>

      {/* Seuil d'alerte sur les annulations */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Clock className="h-4 w-4 text-primary" />
            {isFr ? 'Alerte annulations' : 'Cancellation alert'}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-xs text-muted-foreground">
            {isFr
              ? "Au-delà de ce nombre d'annulations sur un même cycle, le compteur passe en orange dans la fiche du membre. C'est un signalement visuel : aucune sanction n'est appliquée automatiquement, l'arbitrage reste humain."
              : 'Above this number of cancellations within a single cycle, the counter turns orange on the member page. This is a visual flag only: no automatic penalty, the decision stays human.'}
          </p>
          <div className="space-y-2">
            <Label>{isFr ? 'Seuil par cycle' : 'Threshold per cycle'}</Label>
            <Input
              type="number"
              min={1}
              className="w-32"
              value={cancelAlert}
              onChange={e => setCancelAlert(parseInt(e.target.value) || 1)}
            />
          </div>
          <Button
            size="sm"
            disabled={saving === 'cancellation_alert'}
            onClick={() => saveSetting('cancellation_alert', { threshold_per_cycle: cancelAlert })}
          >
            {saving === 'cancellation_alert' ? '...' : (isFr ? 'Enregistrer' : 'Save')}
          </Button>
        </CardContent>
      </Card>

      {/* Avis sur les cours */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Star className="h-4 w-4 text-primary" />
            {isFr ? 'Avis sur les cours' : 'Class feedback'}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-xs text-muted-foreground">
            {isFr
              ? "Après une séance, le membre peut la noter de 1 à 5 étoiles et laisser un commentaire. La proposition apparaît sur son accueil, puis disparaît d'elle-même après le délai fixé ici — une demande qui insiste se fait ignorer, puis agace."
              : 'After a class, members can rate it 1 to 5 stars and leave a comment. The prompt appears on their home page, then disappears on its own after the delay set here — a request that keeps nagging gets ignored, then resented.'}
          </p>
          <p className="text-xs text-muted-foreground">
            {isFr
              ? 'Les avis sont anonymes pour le coach : c\'est ce qui les rend francs. Vous seul pouvez remonter à leur auteur.'
              : 'Feedback is anonymous to the coach — that is what keeps it honest. Only you can trace it back.'}
          </p>

          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <p className="text-sm font-medium">
                {isFr ? 'Demander un avis après les cours' : 'Ask for feedback after classes'}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {isFr
                  ? 'Désactiver ne supprime aucun avis déjà donné.'
                  : 'Turning this off keeps existing feedback.'}
              </p>
            </div>
            <Switch checked={reviewsEnabled} onCheckedChange={setReviewsEnabled} />
          </div>

          {reviewsEnabled && (
            <div className="space-y-2">
              <Label>{isFr ? 'Durée d\'affichage (jours)' : 'Display window (days)'}</Label>
              <Input
                type="number"
                min={1}
                max={90}
                className="w-32"
                value={reviewDays}
                onChange={e => setReviewDays(parseInt(e.target.value) || 1)}
              />
              <p className="text-[11px] text-muted-foreground">
                {isFr
                  ? 'Au-delà, la séance ne peut plus être notée. Sept jours est un bon compromis : le souvenir est encore net.'
                  : 'After that, the class can no longer be rated. Seven days is a good balance — the memory is still fresh.'}
              </p>
            </div>
          )}

          <Button
            size="sm"
            disabled={saving === 'class_reviews'}
            onClick={() => saveSetting('class_reviews', {
              enabled: reviewsEnabled,
              days_to_review: reviewDays,
            })}
          >
            {saving === 'class_reviews' ? '...' : (isFr ? 'Enregistrer' : 'Save')}
          </Button>
        </CardContent>
      </Card>

      {/* Règle "cours donné" */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <CalendarDays className="h-4 w-4 text-primary" />
            {isFr ? 'Cours donné — seuil de participants' : 'Class given — attendee threshold'}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-xs text-muted-foreground">
            {isFr
              ? "Un cours planifié n'est comptabilisé comme donné que s'il a réuni au moins ce nombre de participants et n'a pas été annulé. Sert au tableau de bord (colonne « Cours donnés ») pour distinguer ce qui a réellement eu lieu de ce qui était au planning."
              : 'A scheduled class only counts as given if it gathered at least this many attendees and was not cancelled. Used in the dashboard ("Classes given") to tell what actually happened from what was merely planned.'}
          </p>
          <div className="space-y-2">
            <Label>{isFr ? 'Minimum de participants' : 'Minimum attendees'}</Label>
            <Input
              type="number"
              min={1}
              className="w-32"
              value={minParticipants}
              onChange={e => setMinParticipants(parseInt(e.target.value) || 1)}
            />
          </div>
          <Button
            size="sm"
            disabled={saving === 'class_given_rule'}
            onClick={() => saveSetting('class_given_rule', { min_participants: minParticipants })}
          >
            {saving === 'class_given_rule' ? '...' : (isFr ? 'Enregistrer' : 'Save')}
          </Button>
        </CardContent>
      </Card>

      {/* Stripe — super admin only */}
      {isSuperAdmin && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <CreditCard className="h-4 w-4 text-primary" />
              {isFr ? 'Mode paiement' : 'Payment mode'}
              <Shield className="h-3 w-3 text-red-500" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">
                  {stripeLive ? (isFr ? 'Mode production' : 'Live mode') : (isFr ? 'Mode test' : 'Test mode')}
                </p>
                <p className="text-sm text-muted-foreground">
                  {isFr
                    ? stripeLive ? 'Paiements réels activés' : 'Mode test — aucun paiement réel'
                    : stripeLive ? 'Real payments enabled' : 'Test mode — no real payments'}
                </p>
              </div>
              <Switch
                checked={stripeLive}
                onCheckedChange={(checked) => {
                  setStripeLive(checked)
                  saveSetting('stripe_mode', { mode: checked ? 'live' : 'test' })
                }}
              />
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

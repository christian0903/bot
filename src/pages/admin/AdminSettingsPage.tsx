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
import { Settings, CreditCard, Users, Clock, Building, Shield } from 'lucide-react'

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
  instagram_url: string
  facebook_url: string
  website_url: string
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
    instagram_url: '',
    facebook_url: '',
    website_url: '',
  })

  // Room names
  const [roomNames, setRoomNames] = useState<RoomNames>({
    haut: 'Back On Track Upstairs',
    bas: 'Back On Track Studio',
  })

  // Registration fee
  const [regFeeAmount, setRegFeeAmount] = useState(30)
  const [regFeeEnabled, setRegFeeEnabled] = useState(true)

  useEffect(() => {
    const fetchData = async () => {
      const { data } = await supabase
        .from('app_settings')
        .select('*')
        .in('key', ['stripe_mode', 'booking_rules', 'studio_info', 'registration_fee', 'room_names'])

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
      }
      setLoading(false)
    }
    fetchData()
  }, [])

  const saveSetting = async (key: string, value: Record<string, unknown>) => {
    setSaving(key)
    const { error } = await supabase
      .from('app_settings')
      .update({ value, updated_by: user?.id ?? null })
      .eq('key', key)

    if (error) {
      // Try insert if not exists
      await supabase.from('app_settings').insert({ key, value, updated_by: user?.id ?? null })
    }
    setSaving(null)
    toast.success(isFr ? 'Paramètres enregistrés' : 'Settings saved')
  }

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
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>{isFr ? 'Nom' : 'Name'}</Label>
              <Input value={studio.name} onChange={e => setStudio(s => ({ ...s, name: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>{isFr ? 'N° TVA' : 'VAT number'}</Label>
              <Input value={studio.vat_number} onChange={e => setStudio(s => ({ ...s, vat_number: e.target.value }))} placeholder="BE0xxx.xxx.xxx" />
            </div>
          </div>
          <div className="space-y-2">
            <Label>{isFr ? 'Adresse' : 'Address'}</Label>
            <Input value={studio.address} onChange={e => setStudio(s => ({ ...s, address: e.target.value }))} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>{isFr ? 'Téléphone' : 'Phone'}</Label>
              <Input value={studio.phone} onChange={e => setStudio(s => ({ ...s, phone: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input type="email" value={studio.email} onChange={e => setStudio(s => ({ ...s, email: e.target.value }))} />
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
        <CardContent className="space-y-5">
          <div className="space-y-1">
            <p className="text-sm font-medium">{isFr ? 'Cours du matin' : 'Morning classes'}</p>
            <p className="text-xs text-muted-foreground mb-2">
              {isFr ? 'Cours commençant avant l\'heure ci-dessous' : 'Classes starting before the hour below'}
            </p>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label className="text-xs">{isFr ? 'Cours "matin" si avant (h)' : 'Morning if before (h)'}</Label>
                <Input type="number" min={0} max={23} className="w-24" value={rules.morning_class_before_hour} onChange={e => setRules(r => ({ ...r, morning_class_before_hour: parseInt(e.target.value) || 12 }))} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">{isFr ? 'Fermeture résa la veille à (h)' : 'Booking closes day before at (h)'}</Label>
                <Input type="number" min={0} max={23} className="w-24" value={rules.morning_cutoff_hour} onChange={e => setRules(r => ({ ...r, morning_cutoff_hour: parseInt(e.target.value) || 20 }))} />
              </div>
            </div>
          </div>

          <div className="space-y-1">
            <p className="text-sm font-medium">{isFr ? 'Cours après-midi / soir' : 'Afternoon / evening classes'}</p>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label className="text-xs">{isFr ? 'Fermeture si 0 inscrit (h avant)' : 'Close if 0 booked (h before)'}</Label>
                <Input type="number" min={0} className="w-24" value={rules.afternoon_hours_before_no_bookings} onChange={e => setRules(r => ({ ...r, afternoon_hours_before_no_bookings: parseInt(e.target.value) || 3 }))} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">{isFr ? 'Fermeture si inscrits (min avant)' : 'Close if booked (min before)'}</Label>
                <Input type="number" min={0} className="w-24" value={rules.afternoon_minutes_before_with_bookings} onChange={e => setRules(r => ({ ...r, afternoon_minutes_before_with_bookings: parseInt(e.target.value) || 30 }))} />
              </div>
            </div>
          </div>

          <div className="space-y-1">
            <p className="text-sm font-medium">{isFr ? 'Annulation' : 'Cancellation'}</p>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-1">
                <Label className="text-xs">{isFr ? 'Annulation gratuite (h avant)' : 'Free cancel (h before)'}</Label>
                <Input type="number" min={0} className="w-24" value={rules.cancellation_free_hours} onChange={e => setRules(r => ({ ...r, cancellation_free_hours: parseInt(e.target.value) || 12 }))} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">{isFr ? 'Annulation PT (h avant)' : 'PT cancel (h before)'}</Label>
                <Input type="number" min={0} className="w-24" value={rules.pt_cancellation_free_hours} onChange={e => setRules(r => ({ ...r, pt_cancellation_free_hours: parseInt(e.target.value) || 24 }))} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">{isFr ? 'No-show auto (min après début)' : 'Auto no-show (min after start)'}</Label>
                <Input type="number" min={0} className="w-24" value={rules.no_show_auto_minutes} onChange={e => setRules(r => ({ ...r, no_show_auto_minutes: parseInt(e.target.value) || 15 }))} />
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

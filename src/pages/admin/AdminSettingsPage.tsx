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
import { Settings, CreditCard, Users, Clock } from 'lucide-react'

export function AdminSettingsPage() {
  const { t, i18n } = useTranslation()
  const isFr = i18n.language === 'fr'
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [stripeLive, setStripeLive] = useState(false)
  const [stripeSettingId, setStripeSettingId] = useState<string | null>(null)
  const [defaultMaxParticipants, setDefaultMaxParticipants] = useState(4)
  const [cancellationHours, setCancellationHours] = useState(24)
  const [defaultsSettingId, setDefaultsSettingId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const fetchData = async () => {
      const { data } = await supabase
        .from('app_settings')
        .select('*')
        .in('key', ['stripe_mode', 'studio_defaults'])

      for (const setting of data ?? []) {
        if (setting.key === 'stripe_mode') {
          setStripeLive((setting.value as { mode: string }).mode === 'live')
          setStripeSettingId(setting.id)
        }
        if (setting.key === 'studio_defaults') {
          const val = setting.value as { default_max_participants?: number; cancellation_deadline_hours?: number }
          setDefaultMaxParticipants(val.default_max_participants ?? 4)
          setCancellationHours(val.cancellation_deadline_hours ?? 24)
          setDefaultsSettingId(setting.id)
        }
      }
      setLoading(false)
    }
    fetchData()
  }, [])

  const handleStripeToggle = async (checked: boolean) => {
    setStripeLive(checked)
    const value = { mode: checked ? 'live' : 'test' }

    if (stripeSettingId) {
      const { error } = await supabase
        .from('app_settings')
        .update({ value, updated_by: user?.id ?? null })
        .eq('id', stripeSettingId)
      if (error) { toast.error(t('common.error')); return }
    } else {
      const { data, error } = await supabase
        .from('app_settings')
        .insert({ key: 'stripe_mode', value, updated_by: user?.id ?? null })
        .select().single()
      if (error) { toast.error(t('common.error')); return }
      setStripeSettingId(data.id)
    }
    toast.success(t('common.saveSuccess'))
  }

  const handleSaveDefaults = async () => {
    setSaving(true)
    const value = {
      default_max_participants: defaultMaxParticipants,
      cancellation_deadline_hours: cancellationHours,
    }

    if (defaultsSettingId) {
      const { error } = await supabase
        .from('app_settings')
        .update({ value, updated_by: user?.id ?? null })
        .eq('id', defaultsSettingId)
      if (error) { toast.error(t('common.error')); setSaving(false); return }
    } else {
      const { data, error } = await supabase
        .from('app_settings')
        .insert({ key: 'studio_defaults', value, updated_by: user?.id ?? null })
        .select().single()
      if (error) { toast.error(t('common.error')); setSaving(false); return }
      setDefaultsSettingId(data.id)
    }
    toast.success(t('common.saveSuccess'))
    setSaving(false)
  }

  if (loading) return <LoadingState />

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold flex items-center gap-2">
        <Settings className="h-6 w-6 text-primary" />
        {t('admin.settings.title')}
      </h1>

      {/* Studio defaults */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Users className="h-4 w-4 text-primary" />
            {isFr ? 'Paramètres du studio' : 'Studio settings'}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Users className="h-3.5 w-3.5 text-muted-foreground" />
              {isFr ? 'Nombre max de participants par défaut' : 'Default max participants'}
            </Label>
            <Input
              type="number"
              min={1}
              className="w-32"
              value={defaultMaxParticipants}
              onChange={(e) => setDefaultMaxParticipants(parseInt(e.target.value) || 1)}
            />
            <p className="text-xs text-muted-foreground">
              {isFr
                ? 'Appliqué par défaut à chaque nouveau type de cours créé.'
                : 'Applied by default to each new class type created.'}
            </p>
          </div>

          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Clock className="h-3.5 w-3.5 text-muted-foreground" />
              {isFr ? 'Délai d\'annulation (heures avant le cours)' : 'Cancellation deadline (hours before class)'}
            </Label>
            <Input
              type="number"
              min={0}
              className="w-32"
              value={cancellationHours}
              onChange={(e) => setCancellationHours(parseInt(e.target.value) || 0)}
            />
            <p className="text-xs text-muted-foreground">
              {isFr
                ? `Les clients ne pourront plus annuler leur réservation si le cours a lieu dans moins de ${cancellationHours}h. Mettre 0 pour permettre l'annulation à tout moment.`
                : `Clients won't be able to cancel their booking if the class starts in less than ${cancellationHours}h. Set to 0 to allow cancellation at any time.`}
            </p>
          </div>

          <Button onClick={handleSaveDefaults} disabled={saving} size="sm">
            {saving ? '...' : t('common.save')}
          </Button>
        </CardContent>
      </Card>

      {/* Stripe */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <CreditCard className="h-4 w-4 text-primary" />
            {t('admin.settings.stripeMode')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">
                {stripeLive ? t('admin.settings.liveMode') : t('admin.settings.testMode')}
              </p>
              <p className="text-sm text-muted-foreground">
                {isFr
                  ? stripeLive ? 'Paiements réels activés' : 'Mode test — aucun paiement réel'
                  : stripeLive ? 'Real payments enabled' : 'Test mode — no real payments'}
              </p>
            </div>
            <Switch checked={stripeLive} onCheckedChange={handleStripeToggle} />
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

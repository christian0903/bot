import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { LoadingState } from '@/components/common/LoadingState'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

import { Switch } from '@/components/ui/switch'
import { toast } from 'sonner'

export function AdminSettingsPage() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const [stripeLive, setStripeLive] = useState(false)
  const [loading, setLoading] = useState(true)
  const [settingId, setSettingId] = useState<string | null>(null)

  useEffect(() => {
    const fetchData = async () => {
      const { data } = await supabase
        .from('app_settings')
        .select('*')
        .eq('key', 'stripe_mode')
        .single()

      if (data) {
        const val = data.value as { mode: string }
        setStripeLive(val.mode === 'live')
        setSettingId(data.id)
      }
      setLoading(false)
    }
    fetchData()
  }, [])

  const handleToggle = async (checked: boolean) => {
    setStripeLive(checked)
    const value = { mode: checked ? 'live' : 'test' }

    if (settingId) {
      const { error } = await supabase
        .from('app_settings')
        .update({ value, updated_by: user?.id ?? null })
        .eq('id', settingId)
      if (error) { toast.error(t('common.error')); return }
    } else {
      const { data, error } = await supabase
        .from('app_settings')
        .insert({ key: 'stripe_mode', value, updated_by: user?.id ?? null })
        .select()
        .single()
      if (error) { toast.error(t('common.error')); return }
      setSettingId(data.id)
    }
    toast.success(t('common.saveSuccess'))
  }

  if (loading) return <LoadingState />

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">{t('admin.settings.title')}</h1>

      <Card>
        <CardHeader>
          <CardTitle>{t('admin.settings.stripeMode')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">
                {stripeLive ? t('admin.settings.liveMode') : t('admin.settings.testMode')}
              </p>
              <p className="text-sm text-muted-foreground">
                {stripeLive ? 'Stripe Live' : 'Stripe Test'}
              </p>
            </div>
            <Switch checked={stripeLive} onCheckedChange={handleToggle} />
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Gift } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

/**
 * Rappel de la séance d'essai offerte, tant qu'elle n'est pas utilisée.
 *
 * Le crédit est attribué à la création du profil, sans que le membre en soit
 * informé nulle part : sans ce rappel, l'essai reste un cadeau que personne ne
 * voit. Le bandeau disparaît de lui-même dès que la séance est réservée.
 *
 * L'échéance est nommée quand elle approche : « il te reste 5 jours » agit là
 * où « valable 30 jours » laisse indifférent.
 */
export function TrialCreditBanner({ className }: { className?: string }) {
  const { user } = useAuth()
  const { i18n } = useTranslation()
  const isFr = i18n.language === 'fr'
  const navigate = useNavigate()
  const [daysLeft, setDaysLeft] = useState<number | null>(null)

  useEffect(() => {
    if (!user) { setDaysLeft(null); return }

    const load = async () => {
      const { data } = await supabase
        .from('pack_purchases')
        .select('expires_at, credits_remaining, pack_type:pack_types!inner(is_trial)')
        .eq('user_id', user.id)
        .eq('pack_types.is_trial', true)
        .gt('credits_remaining', 0)
        .gt('expires_at', new Date().toISOString())
        .maybeSingle()

      if (!data) { setDaysLeft(null); return }

      const ms = new Date((data as { expires_at: string }).expires_at).getTime() - Date.now()
      setDaysLeft(Math.max(0, Math.ceil(ms / 86_400_000)))
    }

    load()
  }, [user])

  if (daysLeft === null) return null

  // Le compte à rebours n'apparaît que dans la dernière semaine : affiché trop
  // tôt, il banalise l'échéance au lieu de la signaler.
  const urgent = daysLeft <= 7

  return (
    <div
      className={cn(
        'flex items-center gap-3 rounded-xl border border-primary/30 bg-primary/5 px-4 py-3',
        className,
      )}
    >
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/15">
        <Gift className="h-4 w-4 text-primary" />
      </div>

      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold leading-tight">
          {isFr ? 'Ta séance d\'essai offerte' : 'Your free trial session'}
        </p>
        <p className="text-xs text-muted-foreground mt-0.5">
          {urgent
            ? (isFr
              ? `Plus que ${daysLeft} jour${daysLeft > 1 ? 's' : ''} pour en profiter.`
              : `Only ${daysLeft} day${daysLeft > 1 ? 's' : ''} left to use it.`)
            : (isFr
              ? 'Choisis ton cours, c\'est offert.'
              : 'Pick a class — it\'s on us.')}
        </p>
      </div>

      <Button size="sm" className="shrink-0" onClick={() => navigate('/schedule')}>
        {isFr ? 'Réserver' : 'Book'}
      </Button>
    </div>
  )
}

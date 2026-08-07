import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Browser } from '@capacitor/browser'
import { toast } from 'sonner'
import { CreditCard, Repeat, ArrowRight } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { PackType } from '@/types'

/**
 * Raison pour laquelle la réservation a échoué faute de crédit.
 *
 * `exhausted` — le membre a bien un pack du bon type, mais il est vide.
 * `wrong_type` — il a des crédits, d'un autre type que celui demandé.
 * `none`      — aucun crédit du tout.
 */
export type NoCreditsReason = 'exhausted' | 'wrong_type' | 'none'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  reason: NoCreditsReason
  /** Type de crédit qu'il faut pour ce cours : on ne propose que ce qui débloque. */
  creditTypeId: string | null
  creditTypeLabel?: string | null
}

/**
 * Proposition d'achat au moment où le membre ne peut pas réserver.
 *
 * Un toast d'erreur laissait le membre chercher seul le chemin vers les packs :
 * beaucoup abandonnaient là. C'est pourtant l'instant où l'intention d'achat
 * est la plus forte — il voulait réserver à la seconde près.
 *
 * On ne propose que les packs du type de crédit manquant : lui montrer un pack
 * Personal Training quand il lui faut du semi-privé, c'est reproduire l'erreur
 * qui a fait acheter le mauvais pack au studio lui-même.
 */
export function NoCreditsDialog({ open, onOpenChange, reason, creditTypeId, creditTypeLabel }: Props) {
  const { user } = useAuth()
  const { i18n } = useTranslation()
  const isFr = i18n.language === 'fr'
  const navigate = useNavigate()

  const [packs, setPacks] = useState<PackType[]>([])
  const [loading, setLoading] = useState(true)
  const [buying, setBuying] = useState<string | null>(null)

  useEffect(() => {
    if (!open || !creditTypeId) return

    const load = async () => {
      setLoading(true)
      const { data } = await supabase
        .from('pack_types')
        .select('*, credit_type:credit_types(*)')
        .eq('is_active', true)
        .eq('is_purchasable', true)
        .eq('credit_type_id', creditTypeId)
        .order('price_cents')

      setPacks((data as PackType[]) ?? [])
      setLoading(false)
    }
    load()
  }, [open, creditTypeId])

  /**
   * Ouvre le paiement sans quitter le contexte.
   *
   * Le membre reste sur son cours : s'il paie, il revient et réserve. L'ancien
   * parcours le renvoyait vers la page Packs, où il perdait de vue le cours
   * qu'il voulait.
   */
  const buy = async (pack: PackType) => {
    if (!user) return
    setBuying(pack.id)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { toast.error(isFr ? 'Session expirée' : 'Session expired'); return }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-checkout-session`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
          body: JSON.stringify({
            pack_type_id: pack.id,
            success_url: `${window.location.origin}/schedule?success=true`,
            cancel_url: `${window.location.origin}/schedule?cancelled=true`,
          }),
        },
      )
      const data = await response.json()

      if (data.url) {
        await Browser.open({ url: data.url, presentationStyle: 'popover' })
        onOpenChange(false)
        return
      }
      // Frais d'inscription impayés, éligibilité, abonnement déjà en cours :
      // le serveur explique précisément, on relaie son message plutôt qu'un
      // « une erreur est survenue » qui laisserait le membre sans recours.
      toast.error(data.error || (isFr ? 'Achat impossible' : 'Purchase failed'))
      if (data.error) onOpenChange(false)
    } catch {
      toast.error(isFr ? 'Achat impossible' : 'Purchase failed')
    } finally {
      setBuying(null)
    }
  }

  const title = reason === 'exhausted'
    ? (isFr ? 'Tes crédits sont épuisés' : 'Your credits are used up')
    : reason === 'wrong_type'
      ? (isFr ? 'Il te faut un autre type de crédit' : 'You need a different credit type')
      : (isFr ? 'Il te faut des crédits' : 'You need credits')

  const description = reason === 'wrong_type'
    ? (isFr
      ? `Ce cours demande un crédit « ${creditTypeLabel} ». Voici les formules qui le couvrent.`
      : `This class needs a "${creditTypeLabel}" credit. Here are the options that cover it.`)
    : (isFr
      ? `Choisis une formule et réserve ton cours dans la foulée.`
      : `Pick an option and book your class right away.`)

  const price = (cents: number) => (cents / 100).toFixed(2).replace('.', ',')

  const cycle = (p: PackType) => {
    if (!p.is_recurring) return ''
    const n = p.recurring_interval_count ?? 1
    if (p.recurring_interval === 'week') {
      return isFr ? `toutes les ${n} semaines` : `every ${n} weeks`
    }
    if (p.recurring_interval === 'month') {
      return n === 1 ? (isFr ? 'par mois' : 'per month') : (isFr ? `tous les ${n} mois` : `every ${n} months`)
    }
    return isFr ? `tous les ${n} jours` : `every ${n} days`
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="py-8 text-center text-sm text-muted-foreground">
            {isFr ? 'Chargement…' : 'Loading…'}
          </div>
        ) : packs.length === 0 ? (
          <div className="py-6 text-center">
            <p className="text-sm text-muted-foreground mb-4">
              {isFr
                ? 'Aucune formule disponible pour ce type de cours.'
                : 'No option available for this class type.'}
            </p>
            <Button variant="outline" onClick={() => { onOpenChange(false); navigate('/packs') }}>
              {isFr ? 'Voir toutes les formules' : 'See all options'}
            </Button>
          </div>
        ) : (
          <div className="space-y-2">
            {packs.map((pack) => (
              <button
                key={pack.id}
                disabled={buying !== null}
                onClick={() => buy(pack)}
                className={cn(
                  'w-full flex items-center gap-3 rounded-xl border p-3 text-left transition-colors',
                  'hover:border-primary/50 hover:bg-muted/40',
                  buying === pack.id && 'opacity-60',
                  buying !== null && buying !== pack.id && 'opacity-40',
                )}
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10">
                  {pack.is_recurring
                    ? <Repeat className="h-4 w-4 text-primary" />
                    : <CreditCard className="h-4 w-4 text-primary" />}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold truncate">{pack.name}</span>
                    {pack.is_recurring && (
                      <Badge variant="secondary" className="text-[10px] shrink-0">
                        {isFr ? 'Abonnement' : 'Subscription'}
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {pack.is_unlimited
                      ? (isFr ? 'Séances illimitées' : 'Unlimited sessions')
                      : (isFr
                        ? `${pack.credit_count} séance${pack.credit_count > 1 ? 's' : ''}`
                        : `${pack.credit_count} session${pack.credit_count > 1 ? 's' : ''}`)}
                    {pack.is_recurring ? ` · ${cycle(pack)}` : ''}
                  </p>
                </div>

                <div className="shrink-0 text-right">
                  <div className="text-sm font-bold">{price(pack.price_cents)} €</div>
                  {buying === pack.id
                    ? <span className="text-[10px] text-muted-foreground">{isFr ? 'Ouverture…' : 'Opening…'}</span>
                    : <ArrowRight className="h-3 w-3 ml-auto text-muted-foreground" />}
                </div>
              </button>
            ))}

            <button
              onClick={() => { onOpenChange(false); navigate('/packs') }}
              className="w-full pt-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              {isFr ? 'Voir toutes les formules' : 'See all options'}
            </button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

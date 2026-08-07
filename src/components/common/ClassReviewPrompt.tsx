import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { format } from 'date-fns'
import { fr, enUS } from 'date-fns/locale'
import { Star, X } from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'

interface PendingReview {
  booking_id: string
  scheduled_class_id: string
  class_name: string | null
  starts_at: string
  coach_name: string | null
}

/**
 * Demande d'avis après une séance.
 *
 * Une seule séance proposée à la fois, la plus récente : enchaîner les
 * demandes transformerait l'accueil en questionnaire. Les autres remonteront
 * aux visites suivantes.
 *
 * Le commentaire reste facultatif — exiger un texte fait chuter le taux de
 * réponse, et une note seule est déjà une information utile.
 */
export function ClassReviewPrompt() {
  const { user } = useAuth()
  const { i18n } = useTranslation()
  const isFr = i18n.language === 'fr'
  const locale = isFr ? fr : enUS

  const [pending, setPending] = useState<PendingReview | null>(null)
  const [rating, setRating] = useState(0)
  const [hovered, setHovered] = useState(0)
  const [comment, setComment] = useState('')
  const [saving, setSaving] = useState(false)
  /** Écarté pour cette visite : on ne reproposera qu'au prochain chargement. */
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    if (!user) return
    let cancelled = false

    supabase.rpc('pending_class_reviews').then(({ data, error }) => {
      if (cancelled) return
      if (error) { console.error('[reviews] pending', error); return }
      const rows = (data as PendingReview[]) ?? []
      setPending(rows[0] ?? null)
    })

    return () => { cancelled = true }
  }, [user])

  const submit = async () => {
    if (!pending || rating === 0) return
    setSaving(true)
    const { data, error } = await supabase.rpc('submit_class_review', {
      p_booking_id: pending.booking_id,
      p_rating: rating,
      p_comment: comment.trim() || null,
    })
    setSaving(false)

    if (error) { toast.error(error.message); return }

    // Le refus arrive DANS le retour, sans erreur SQL : sans ce contrôle on
    // remercierait le membre pour un avis qui n'a pas été enregistré.
    const res = data as { ok: boolean; reason?: string } | null
    if (!res?.ok) {
      toast.error(isFr ? 'Avis non enregistré' : 'Review not saved')
      return
    }

    toast.success(isFr ? 'Merci pour ton retour !' : 'Thanks for your feedback!')
    setPending(null)
  }

  if (!pending || dismissed) return null

  const stars = [1, 2, 3, 4, 5]
  const shown = hovered || rating

  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-medium text-sm">
            {isFr ? 'Comment s\'est passé ton cours ?' : 'How was your class?'}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {pending.class_name}
            {' — '}
            {format(new Date(pending.starts_at), 'EEEE d MMMM', { locale })}
            {pending.coach_name ? ` · ${pending.coach_name}` : ''}
          </p>
        </div>
        <button
          onClick={() => setDismissed(true)}
          aria-label={isFr ? 'Plus tard' : 'Later'}
          className="shrink-0 rounded p-1 text-muted-foreground/50 hover:bg-muted hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="flex items-center gap-1 mt-3" onMouseLeave={() => setHovered(0)}>
        {stars.map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => setRating(n)}
            onMouseEnter={() => setHovered(n)}
            aria-label={`${n} ${isFr ? 'étoile' : 'star'}${n > 1 ? 's' : ''}`}
            className="p-1 transition-transform hover:scale-110"
          >
            <Star
              className={cn(
                'h-7 w-7 transition-colors',
                n <= shown
                  ? 'fill-amber-400 text-amber-400'
                  : 'text-muted-foreground/30',
              )}
            />
          </button>
        ))}
      </div>

      {/* Le commentaire n'apparaît qu'une fois la note donnée : demander les
          deux d'emblée fait reculer. */}
      {rating > 0 && (
        <div className="mt-3 space-y-2">
          <Textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            rows={2}
            placeholder={isFr
              ? 'Un mot pour le coach ? (facultatif)'
              : 'A word for the coach? (optional)'}
          />
          <div className="flex gap-2">
            <Button size="sm" onClick={submit} disabled={saving}>
              {saving
                ? '...'
                : (isFr ? 'Envoyer' : 'Send')}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setDismissed(true)}>
              {isFr ? 'Plus tard' : 'Later'}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

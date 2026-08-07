import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { format } from 'date-fns'
import { fr, enUS } from 'date-fns/locale'
import { Star } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'

interface Review {
  rating: number
  comment: string | null
  created_at: string
}

/**
 * Avis reçus sur un cours, côté staff.
 *
 * Sans le nom des auteurs : c'est la contrepartie de la franchise. Un membre
 * qui reverra son coach mardi ne note pas honnêtement s'il sait être identifié.
 * L'admin garde l'accès nominatif en base, pour le cas où un avis poserait
 * problème.
 */
export function ClassReviews({ scheduledClassId }: { scheduledClassId: string }) {
  const { i18n } = useTranslation()
  const isFr = i18n.language === 'fr'
  const locale = isFr ? fr : enUS

  const [reviews, setReviews] = useState<Review[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    supabase
      .rpc('class_reviews_for_staff', { p_scheduled_class_id: scheduledClassId })
      .then(({ data, error }) => {
        if (cancelled) return
        if (error) console.error('[reviews] staff', error)
        setReviews((data as Review[]) ?? [])
        setLoading(false)
      })
    return () => { cancelled = true }
  }, [scheduledClassId])

  if (loading || reviews.length === 0) return null

  const average = reviews.reduce((s, r) => s + r.rating, 0) / reviews.length
  const withComment = reviews.filter((r) => r.comment)

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          {isFr ? 'Avis des participants' : 'Participant feedback'}
          <span className="flex items-center gap-1 text-sm font-normal">
            <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
            <span className="font-semibold">{average.toFixed(1)}</span>
            <span className="text-muted-foreground">
              ({reviews.length})
            </span>
          </span>
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-3">
        {/* Répartition : une moyenne de 4 cache mal deux 5 et un 2. */}
        <div className="space-y-1">
          {[5, 4, 3, 2, 1].map((n) => {
            const count = reviews.filter((r) => r.rating === n).length
            const pct = (count / reviews.length) * 100
            return (
              <div key={n} className="flex items-center gap-2 text-xs">
                <span className="w-3 text-muted-foreground">{n}</span>
                <Star className="h-3 w-3 text-muted-foreground/50" />
                <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                  <div
                    className={cn('h-full rounded-full', n >= 4 ? 'bg-emerald-500' : n === 3 ? 'bg-amber-500' : 'bg-red-500')}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <span className="w-4 text-right text-muted-foreground">{count}</span>
              </div>
            )
          })}
        </div>

        {withComment.length > 0 && (
          <div className="space-y-2 pt-2 border-t">
            {withComment.map((r, i) => (
              <div key={i} className="text-sm">
                <div className="flex items-center gap-1">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <Star
                      key={n}
                      className={cn(
                        'h-3 w-3',
                        n <= r.rating ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground/25',
                      )}
                    />
                  ))}
                  <span className="text-[11px] text-muted-foreground ml-1">
                    {format(new Date(r.created_at), 'dd/MM', { locale })}
                  </span>
                </div>
                <p className="text-muted-foreground mt-0.5">{r.comment}</p>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

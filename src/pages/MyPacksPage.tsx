import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { EmptyState } from '@/components/common/EmptyState'
import { LoadingState } from '@/components/common/LoadingState'
import { CreditCard, X, Clock } from 'lucide-react'
import { format } from 'date-fns'
import { fr, enUS } from 'date-fns/locale'
import type { PackPurchase, Booking, ScheduledClass } from '@/types'

export function MyPacksPage() {
  const { t, i18n } = useTranslation()
  const isFr = i18n.language === 'fr'
  const { user } = useAuth()
  const navigate = useNavigate()
  const locale = isFr ? fr : enUS
  const [packs, setPacks] = useState<PackPurchase[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedPack, setSelectedPack] = useState<PackPurchase | null>(null)
  const [packBookings, setPackBookings] = useState<(Booking & { scheduled_class: ScheduledClass })[]>([])
  const [packBookingsLoading, setPackBookingsLoading] = useState(false)

  const openPackDetail = async (pack: PackPurchase) => {
    setSelectedPack(pack)
    setPackBookingsLoading(true)
    setPackBookings([])

    const { data: bookings } = await supabase
      .from('bookings')
      .select('*')
      .eq('pack_purchase_id', pack.id)
      .order('created_at', { ascending: false })

    const raw = (bookings as Booking[]) ?? []
    if (raw.length > 0) {
      const classIds = [...new Set(raw.map(b => b.scheduled_class_id))]
      const { data: classData } = await supabase
        .from('scheduled_classes')
        .select('*, class_type:class_types(*)')
        .in('id', classIds)
      const classMap = new Map((classData ?? []).map(c => [c.id, c]))
      for (const b of raw) {
        (b as Booking & { scheduled_class: ScheduledClass }).scheduled_class = classMap.get(b.scheduled_class_id) as ScheduledClass
      }
      const withClasses = (raw as (Booking & { scheduled_class: ScheduledClass })[])
        .filter(b => b.scheduled_class)
        .sort((a, b) => new Date(b.scheduled_class.starts_at).getTime() - new Date(a.scheduled_class.starts_at).getTime())
      setPackBookings(withClasses)
    }
    setPackBookingsLoading(false)
  }

  useEffect(() => {
    if (!user) return
    supabase
      .from('pack_purchases')
      .select('*, pack_type:pack_types(*, credit_type:credit_types(*))')
      .eq('user_id', user.id)
      .order('purchased_at', { ascending: false })
      .then(({ data }) => {
        setPacks((data as PackPurchase[]) ?? [])
        setLoading(false)
      })
  }, [user])

  if (loading) return <LoadingState />

  const now = new Date()

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t('packs.myPacks')}</h1>
        <Button onClick={() => navigate('/packs')}>{t('home.buyPack')}</Button>
      </div>

      {packs.length === 0 ? (
        <EmptyState
          icon={CreditCard}
          message={t('packs.noActivePacks')}
          actionLabel={t('home.buyPack')}
          onAction={() => navigate('/packs')}
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {packs.map((pack) => {
            const isExpired = new Date(pack.expires_at) < now
            const isEmpty = pack.credits_remaining <= 0
            const creditLabel = i18n.language === 'fr'
              ? pack.pack_type?.credit_type?.label_fr
              : pack.pack_type?.credit_type?.label_en

            return (
              <Card
                key={pack.id}
                onClick={() => openPackDetail(pack)}
                className={`cursor-pointer hover:border-primary/40 hover:shadow-sm transition ${isExpired || isEmpty ? 'opacity-60' : ''}`}
              >
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">{pack.pack_type?.name}</CardTitle>
                    {(isExpired || isEmpty) && (
                      <Badge variant="secondary">{t('packs.expired')}</Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-1 text-sm">
                    <p>{creditLabel}</p>
                    <p className="font-semibold text-lg">
                      {t('packs.creditsRemaining', { count: pack.credits_remaining })}
                    </p>
                    <p className="text-muted-foreground">
                      {t('packs.expiresAt', { date: format(new Date(pack.expires_at), 'dd MMM yyyy', { locale }) })}
                    </p>
                    <p className="text-muted-foreground">
                      {(pack.price_paid_cents / 100).toFixed(2).replace('.', ',')} €
                    </p>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* Pack detail — bookings made with this pack */}
      <Dialog open={!!selectedPack} onOpenChange={(open) => { if (!open) setSelectedPack(null) }}>
        <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
          {selectedPack && (
            <>
              <DialogHeader>
                <DialogTitle>{selectedPack.pack_type?.name}</DialogTitle>
                <p className="text-sm text-muted-foreground">
                  {selectedPack.credits_remaining}/{selectedPack.pack_type?.credit_count} {isFr ? 'crédits restants' : 'credits remaining'}
                  {' · '}
                  {isFr ? 'expire le' : 'expires'} {format(new Date(selectedPack.expires_at), 'dd/MM/yyyy')}
                </p>
              </DialogHeader>

              {packBookingsLoading ? (
                <LoadingState />
              ) : packBookings.length === 0 ? (
                <p className="text-sm text-muted-foreground py-6 text-center">
                  {isFr ? 'Aucun cours réservé avec ce pack' : 'No bookings on this pack'}
                </p>
              ) : (
                <div className="space-y-2 mt-2">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    {isFr ? 'Cours réservés' : 'Bookings'} ({packBookings.length})
                  </p>
                  {packBookings.map((booking) => {
                    const sc = booking.scheduled_class
                    const startsAt = new Date(sc.starts_at)
                    const isPast = startsAt < new Date()
                    const isCancelled = booking.status === 'cancelled'
                    const color = sc.class_type?.color || '#3B82F6'
                    return (
                      <div
                        key={booking.id}
                        className="flex items-center gap-3 p-2.5 rounded-lg border"
                        style={{ borderLeftWidth: '3px', borderLeftColor: color }}
                      >
                        <div className="flex flex-col items-center justify-center h-10 w-10 rounded-lg bg-muted shrink-0">
                          <span className="text-[10px] font-medium uppercase text-muted-foreground">
                            {format(startsAt, 'MMM', { locale })}
                          </span>
                          <span className="text-sm font-bold leading-none">
                            {format(startsAt, 'd')}
                          </span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate">{sc.class_type?.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {format(startsAt, 'HH:mm')} · {sc.duration_minutes}min
                          </p>
                        </div>
                        <div className="shrink-0">
                          {isCancelled ? (
                            <span className="flex items-center gap-1 text-xs text-muted-foreground">
                              <X className="h-3 w-3" />
                              {isFr ? 'Annulé' : 'Cancelled'}
                            </span>
                          ) : isPast ? (
                            <span className="text-xs text-muted-foreground">
                              {isFr ? 'Passé' : 'Past'}
                            </span>
                          ) : (
                            <span className="flex items-center gap-1 text-xs text-primary font-medium">
                              <Clock className="h-3 w-3" />
                              {isFr ? 'À venir' : 'Upcoming'}
                            </span>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

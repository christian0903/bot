import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { CalendarDays, CreditCard, Clock } from 'lucide-react'
import { LoadingState } from '@/components/common/LoadingState'
import type { PackPurchase, Booking, ScheduledClass } from '@/types'
import { motion } from 'framer-motion'

export function DashboardPage() {
  const { t, i18n } = useTranslation()
  const { user } = useAuth()
  const navigate = useNavigate()
  const [packs, setPacks] = useState<PackPurchase[]>([])
  const [upcomingBookings, setUpcomingBookings] = useState<(Booking & { scheduled_class: ScheduledClass })[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return

    const fetchData = async () => {
      const [packsRes, bookingsRes] = await Promise.all([
        supabase
          .from('pack_purchases')
          .select('*, pack_type:pack_types(*, credit_type:credit_types(*))')
          .eq('user_id', user.id)
          .gt('credits_remaining', 0)
          .gt('expires_at', new Date().toISOString())
          .order('expires_at', { ascending: true }),
        supabase
          .from('bookings')
          .select('*, scheduled_class:scheduled_classes(*, class_type:class_types(*), coach:profiles(*))')
          .eq('user_id', user.id)
          .eq('status', 'confirmed')
          .gt('scheduled_class.starts_at', new Date().toISOString())
          .order('created_at', { ascending: true })
          .limit(5),
      ])

      setPacks((packsRes.data as PackPurchase[]) ?? [])
      setUpcomingBookings((bookingsRes.data as (Booking & { scheduled_class: ScheduledClass })[]) ?? [])
      setLoading(false)
    }

    fetchData()
  }, [user])

  if (loading) return <LoadingState />

  const totalCredits = packs.reduce((sum, p) => sum + p.credits_remaining, 0)

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">{t('home.welcome')}</h1>

      <div className="grid gap-4 md:grid-cols-3">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate('/my-packs')}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">{t('packs.myPacks')}</CardTitle>
              <CreditCard className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalCredits}</div>
              <p className="text-xs text-muted-foreground">
                {t('packs.creditsRemaining', { count: totalCredits })}
              </p>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate('/my-bookings')}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">{t('bookings.upcoming')}</CardTitle>
              <CalendarDays className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{upcomingBookings.length}</div>
              <p className="text-xs text-muted-foreground">{t('bookings.title')}</p>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate('/schedule')}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">{t('schedule.title')}</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <Button variant="outline" size="sm">{t('home.viewSchedule')}</Button>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {upcomingBookings.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>{t('bookings.upcoming')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {upcomingBookings.map((booking) => (
                <div key={booking.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                  <div>
                    <p className="font-medium">{booking.scheduled_class?.class_type?.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {new Date(booking.scheduled_class?.starts_at).toLocaleDateString(i18n.language, {
                        weekday: 'long',
                        day: 'numeric',
                        month: 'long',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </p>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {t('schedule.coach')}: {booking.scheduled_class?.coach?.display_name}
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

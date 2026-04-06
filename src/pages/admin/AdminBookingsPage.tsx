import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { supabase } from '@/lib/supabase'
import type { Booking } from '@/types'
import { LoadingState } from '@/components/common/LoadingState'
import { EmptyState } from '@/components/common/EmptyState'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { CalendarDays } from 'lucide-react'
import { format } from 'date-fns'
import { fr, enUS } from 'date-fns/locale'

export function AdminBookingsPage() {
  const { t, i18n } = useTranslation()
  const locale = i18n.language === 'fr' ? fr : enUS
  const [bookings, setBookings] = useState<Booking[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchData = async () => {
      const { data } = await supabase
        .from('bookings')
        .select(`
          *,
          scheduled_class:scheduled_classes(*, class_type:class_types(*)),
          user:profiles(*),
          pack_purchase:pack_purchases(*, pack_type:pack_types(*))
        `)
        .order('created_at', { ascending: false })

      setBookings((data as Booking[]) ?? [])
      setLoading(false)
    }
    fetchData()
  }, [])

  if (loading) return <LoadingState />

  const getRevenue = (booking: Booking) => {
    const pp = booking.pack_purchase
    if (!pp || !pp.pack_type) return '-'
    const creditCount = pp.pack_type.credit_count
    if (creditCount === 0) return '-'
    return `${(pp.price_paid_cents / creditCount / 100).toFixed(2)} \u20AC`
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">{t('admin.bookings.title')}</h1>

      {bookings.length === 0 ? (
        <EmptyState icon={CalendarDays} message={t('common.noResults')} />
      ) : (
        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('admin.bookings.class')}</TableHead>
                <TableHead>{t('common.date')}</TableHead>
                <TableHead>{t('admin.bookings.client')}</TableHead>
                <TableHead>{t('admin.bookings.pack')}</TableHead>
                <TableHead>{t('admin.bookings.status')}</TableHead>
                <TableHead>{t('admin.bookings.revenue')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {bookings.map((b) => (
                <TableRow key={b.id}>
                  <TableCell className="font-medium">
                    {b.scheduled_class?.class_type?.name ?? '-'}
                  </TableCell>
                  <TableCell>
                    {b.scheduled_class
                      ? format(new Date(b.scheduled_class.starts_at), 'dd/MM/yyyy HH:mm', { locale })
                      : '-'}
                  </TableCell>
                  <TableCell>{b.user?.display_name ?? '-'}</TableCell>
                  <TableCell>{b.pack_purchase?.pack_type?.name ?? '-'}</TableCell>
                  <TableCell>
                    <Badge variant={b.status === 'confirmed' ? 'default' : 'secondary'}>
                      {t(`bookings.status.${b.status}`)}
                    </Badge>
                  </TableCell>
                  <TableCell>{getRevenue(b)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}

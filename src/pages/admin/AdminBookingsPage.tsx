import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { supabase } from '@/lib/supabase'
import type { Booking } from '@/types'
import { LoadingState } from '@/components/common/LoadingState'
import { EmptyState } from '@/components/common/EmptyState'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { CalendarDays } from 'lucide-react'
import { formatEuros } from '@/lib/utils'
import { format } from 'date-fns'
import { fr, enUS } from 'date-fns/locale'

export function AdminBookingsPage() {
  const { t, i18n } = useTranslation()
  const isFr = i18n.language === 'fr'
  const locale = isFr ? fr : enUS
  const [bookings, setBookings] = useState<Booking[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'confirmed' | 'cancelled'>('all')

  useEffect(() => {
    const fetchData = async () => {
      // Fetch bookings
      const { data: bookingData } = await supabase
        .from('bookings')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(200)

      const rawBookings = (bookingData as Booking[]) ?? []

      if (rawBookings.length > 0) {
        // Fetch scheduled classes
        const classIds = [...new Set(rawBookings.map(b => b.scheduled_class_id))]
        const { data: classData } = await supabase
          .from('scheduled_classes')
          .select('*, class_type:class_types(*)')
          .in('id', classIds)
        const classMap = new Map((classData ?? []).map(c => [c.id, c]))

        // Fetch profiles
        const userIds = [...new Set(rawBookings.map(b => b.user_id))]
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, display_name, email')
          .in('id', userIds)
        const profileMap = new Map((profiles ?? []).map(p => [p.id, p]))

        // Fetch pack purchases
        const packIds = [...new Set(rawBookings.map(b => b.pack_purchase_id))]
        const { data: packs } = await supabase
          .from('pack_purchases')
          .select('id, price_paid_cents, pack_type:pack_types(name, credit_count)')
          .in('id', packIds)
        const packMap = new Map((packs ?? []).map(p => [p.id, p]))

        for (const b of rawBookings) {
          b.scheduled_class = classMap.get(b.scheduled_class_id) as Booking['scheduled_class']
          b.user = profileMap.get(b.user_id) as Booking['user']
          b.pack_purchase = packMap.get(b.pack_purchase_id) as Booking['pack_purchase']
        }
      }

      setBookings(rawBookings)
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
    return formatEuros(pp.price_paid_cents / creditCount)
  }

  const filtered = bookings.filter(b => {
    if (statusFilter !== 'all' && b.status !== statusFilter) return false
    if (search) {
      const q = search.toLowerCase()
      const name = (b.user?.display_name || '').toLowerCase()
      const className = (b.scheduled_class?.class_type?.name || '').toLowerCase()
      if (!name.includes(q) && !className.includes(q)) return false
    }
    return true
  })

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">{t('admin.bookings.title')}</h1>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <Input
          type="text"
          placeholder={isFr ? 'Rechercher membre ou cours...' : 'Search member or class...'}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-64 h-8 text-sm"
        />
        <div className="flex rounded-lg border overflow-hidden">
          {(['all', 'confirmed', 'cancelled'] as const).map(s => (
            <button
              key={s}
              className={`px-3 py-1.5 text-xs font-medium transition-colors ${statusFilter === s ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}
              onClick={() => setStatusFilter(s)}
            >
              {s === 'all' ? (isFr ? 'Toutes' : 'All')
                : s === 'confirmed' ? (isFr ? 'Confirmées' : 'Confirmed')
                : (isFr ? 'Annulées' : 'Cancelled')}
            </button>
          ))}
        </div>
        <span className="text-xs text-muted-foreground">{filtered.length} {isFr ? 'résultat(s)' : 'result(s)'}</span>
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={CalendarDays} message={t('common.noResults')} />
      ) : (
        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('admin.bookings.client')}</TableHead>
                <TableHead>{t('admin.bookings.class')}</TableHead>
                <TableHead>{t('common.date')}</TableHead>
                <TableHead>{t('admin.bookings.status')}</TableHead>
                <TableHead>{t('admin.bookings.revenue')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((b) => (
                <TableRow key={b.id}>
                  <TableCell className="font-medium">
                    {b.user?.display_name ?? '-'}
                  </TableCell>
                  <TableCell>
                    {b.scheduled_class?.class_type?.name ?? '-'}
                  </TableCell>
                  <TableCell className="text-sm">
                    {b.scheduled_class
                      ? format(new Date(b.scheduled_class.starts_at), 'EEE dd/MM HH:mm', { locale })
                      : '-'}
                  </TableCell>
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

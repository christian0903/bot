import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { supabase } from '@/lib/supabase'
import { LoadingState } from '@/components/common/LoadingState'
import { EmptyState } from '@/components/common/EmptyState'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select, SelectContent, SelectItem, SelectTrigger,
} from '@/components/ui/select'
import { ScrollText, ChevronDown, Gift, Pencil, CalendarDays, X, Clock3, UserCog, ShoppingBag } from 'lucide-react'
import { format } from 'date-fns'
import { fr, enUS } from 'date-fns/locale'
import { cn } from '@/lib/utils'
import type { Profile } from '@/types'

interface ActivityEntry {
  id: string
  action: string
  actor_id: string | null
  target_user_id: string
  entity_type: string | null
  entity_id: string | null
  details: Record<string, unknown>
  description: string
  created_at: string
}

const ACTION_CONFIG: Record<string, { icon: typeof Gift; color: string; label_fr: string; label_en: string }> = {
  pack_purchased: { icon: ShoppingBag, color: 'text-green-600 bg-green-50 dark:bg-green-950', label_fr: 'Achat pack', label_en: 'Pack purchased' },
  pack_assigned: { icon: Gift, color: 'text-blue-600 bg-blue-50 dark:bg-blue-950', label_fr: 'Pack attribué', label_en: 'Pack assigned' },
  pack_modified: { icon: Pencil, color: 'text-orange-600 bg-orange-50 dark:bg-orange-950', label_fr: 'Pack modifié', label_en: 'Pack modified' },
  booking_created: { icon: CalendarDays, color: 'text-primary bg-primary/10', label_fr: 'Réservation', label_en: 'Booking' },
  booking_cancelled: { icon: X, color: 'text-destructive bg-destructive/10', label_fr: 'Annulation', label_en: 'Cancellation' },
  booking_assigned: { icon: UserCog, color: 'text-indigo-600 bg-indigo-50 dark:bg-indigo-950', label_fr: 'Inscription admin', label_en: 'Admin booking' },
  role_changed: { icon: UserCog, color: 'text-purple-600 bg-purple-50 dark:bg-purple-950', label_fr: 'Rôle modifié', label_en: 'Role changed' },
  waitlist_joined: { icon: Clock3, color: 'text-amber-600 bg-amber-50 dark:bg-amber-950', label_fr: 'Liste d\'attente', label_en: 'Waitlist' },
  waitlist_promoted: { icon: CalendarDays, color: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-950', label_fr: 'Promu (attente)', label_en: 'Promoted (waitlist)' },
}

const ACTION_TYPES = Object.keys(ACTION_CONFIG)

export function AdminActivityLogPage() {
  const { t, i18n } = useTranslation()
  const locale = i18n.language === 'fr' ? fr : enUS
  const [entries, setEntries] = useState<ActivityEntry[]>([])
  const [profiles, setProfiles] = useState<Map<string, Profile>>(new Map())
  const [loading, setLoading] = useState(true)
  const [hasMore, setHasMore] = useState(true)
  const [page, setPage] = useState(0)
  const PAGE_SIZE = 50

  // Filters
  const [filterAction, setFilterAction] = useState('all')
  const [filterDateFrom, setFilterDateFrom] = useState('')
  const [filterDateTo, setFilterDateTo] = useState('')

  const fetchEntries = async (pageNum: number, append = false) => {
    setLoading(true)

    let query = supabase
      .from('activity_log')
      .select('*')
      .order('created_at', { ascending: false })
      .range(pageNum * PAGE_SIZE, (pageNum + 1) * PAGE_SIZE - 1)

    if (filterAction !== 'all') {
      query = query.eq('action', filterAction)
    }
    if (filterDateFrom) {
      query = query.gte('created_at', filterDateFrom + 'T00:00:00')
    }
    if (filterDateTo) {
      query = query.lte('created_at', filterDateTo + 'T23:59:59')
    }

    const { data } = await query
    const newEntries = (data as ActivityEntry[]) ?? []

    setHasMore(newEntries.length === PAGE_SIZE)

    const allEntries = append ? [...entries, ...newEntries] : newEntries

    // Fetch profiles for actors and targets
    const userIds = [...new Set([
      ...allEntries.map(e => e.actor_id).filter(Boolean) as string[],
      ...allEntries.map(e => e.target_user_id),
    ])]
    const missingIds = userIds.filter(id => !profiles.has(id))
    if (missingIds.length > 0) {
      const { data: profileData } = await supabase
        .from('profiles')
        .select('id, display_name')
        .in('id', missingIds)
      const newProfiles = new Map(profiles)
      for (const p of profileData ?? []) {
        newProfiles.set(p.id, p as Profile)
      }
      setProfiles(newProfiles)
    }

    setEntries(allEntries)
    setLoading(false)
  }

  useEffect(() => {
    setPage(0)
    fetchEntries(0)
  }, [filterAction, filterDateFrom, filterDateTo])

  const loadMore = () => {
    const nextPage = page + 1
    setPage(nextPage)
    fetchEntries(nextPage, true)
  }

  const getProfileName = (id: string | null) => {
    if (!id) return i18n.language === 'fr' ? 'Système' : 'System'
    return profiles.get(id)?.display_name ?? '...'
  }

  if (loading && entries.length === 0) return <LoadingState />

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold flex items-center gap-2">
        <ScrollText className="h-6 w-6 text-primary" />
        {i18n.language === 'fr' ? 'Journal d\'activité' : 'Activity Log'}
      </h1>

      {/* Filters */}
      <div className="flex flex-wrap items-end gap-3 p-3 rounded-lg border bg-muted/30">
        <div>
          <Label className="text-xs">{i18n.language === 'fr' ? 'Type' : 'Type'}</Label>
          <Select value={filterAction} onValueChange={(v) => setFilterAction(v ?? 'all')}>
            <SelectTrigger className="h-8 text-xs w-44">
              <span>
                {filterAction === 'all'
                  ? t('common.all')
                  : (i18n.language === 'fr'
                    ? ACTION_CONFIG[filterAction]?.label_fr
                    : ACTION_CONFIG[filterAction]?.label_en)}
              </span>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('common.all')}</SelectItem>
              {ACTION_TYPES.map(a => (
                <SelectItem key={a} value={a}>
                  {i18n.language === 'fr' ? ACTION_CONFIG[a].label_fr : ACTION_CONFIG[a].label_en}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">{i18n.language === 'fr' ? 'Du' : 'From'}</Label>
          <Input type="date" className="h-8 text-xs w-36" value={filterDateFrom} onChange={(e) => setFilterDateFrom(e.target.value)} />
        </div>
        <div>
          <Label className="text-xs">{i18n.language === 'fr' ? 'Au' : 'To'}</Label>
          <Input type="date" className="h-8 text-xs w-36" value={filterDateTo} onChange={(e) => setFilterDateTo(e.target.value)} />
        </div>
        <Button variant="ghost" size="sm" className="text-xs" onClick={() => { setFilterAction('all'); setFilterDateFrom(''); setFilterDateTo('') }}>
          {i18n.language === 'fr' ? 'Réinitialiser' : 'Reset'}
        </Button>
      </div>

      {/* Entries */}
      {entries.length === 0 ? (
        <EmptyState icon={ScrollText} message={t('common.noResults')} />
      ) : (
        <div className="space-y-2">
          {entries.map((entry) => {
            const config = ACTION_CONFIG[entry.action] ?? ACTION_CONFIG.booking_created
            const Icon = config.icon

            return (
              <div key={entry.id} className="flex items-start gap-3 p-3 rounded-lg border hover:bg-muted/30 transition-colors">
                <div className={cn('h-8 w-8 rounded-lg flex items-center justify-center shrink-0', config.color)}>
                  <Icon className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <Badge variant="outline" className="text-[10px] h-5">
                      {i18n.language === 'fr' ? config.label_fr : config.label_en}
                    </Badge>
                    <span className="text-[11px] text-muted-foreground">
                      {format(new Date(entry.created_at), 'dd/MM/yyyy HH:mm', { locale })}
                    </span>
                  </div>
                  <p className="text-sm">{entry.description}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {i18n.language === 'fr' ? 'Par' : 'By'}: <span className="font-medium">{getProfileName(entry.actor_id)}</span>
                    {entry.actor_id !== entry.target_user_id && (
                      <> → <span className="font-medium">{getProfileName(entry.target_user_id)}</span></>
                    )}
                  </p>
                </div>
              </div>
            )
          })}

          {hasMore && (
            <div className="flex justify-center pt-2">
              <Button variant="outline" size="sm" onClick={loadMore} disabled={loading}>
                <ChevronDown className="h-4 w-4 mr-1" />
                {i18n.language === 'fr' ? 'Charger plus' : 'Load more'}
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

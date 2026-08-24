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
import { ScrollText, ChevronDown, Gift, Pencil, CalendarDays, X, Clock3, UserCog, ShoppingBag, UserPlus, Receipt, LogIn, Star, ScanLine, AlertTriangle, Download, Trash2, Eraser, UserRoundPlus, UserRoundX, Banknote } from 'lucide-react'
import { format } from 'date-fns'
import { fr, enUS } from 'date-fns/locale'
import { cn, formatEuros } from '@/lib/utils'
import { downloadCsv } from '@/lib/csv'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import { useAuth } from '@/contexts/AuthContext'
import { toast } from 'sonner'
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
  user_created: { icon: UserPlus, color: 'text-teal-600 bg-teal-50 dark:bg-teal-950', label_fr: 'Nouveau membre', label_en: 'New member' },
  signup_attempt: { icon: UserRoundPlus, color: 'text-cyan-600 bg-cyan-50 dark:bg-cyan-950', label_fr: 'Inscription', label_en: 'Sign-up' },
  registration_fee_paid: { icon: Receipt, color: 'text-green-600 bg-green-50 dark:bg-green-950', label_fr: 'Frais inscription', label_en: 'Registration fee' },
  user_login: { icon: LogIn, color: 'text-sky-600 bg-sky-50 dark:bg-sky-950', label_fr: 'Connexion', label_en: 'Login' },
  trial_booked: { icon: Star, color: 'text-yellow-600 bg-yellow-50 dark:bg-yellow-950', label_fr: 'Séance d\'essai', label_en: 'Trial session' },
  check_in: { icon: ScanLine, color: 'text-green-600 bg-green-50 dark:bg-green-950', label_fr: 'Check-in', label_en: 'Check-in' },
  no_show: { icon: AlertTriangle, color: 'text-red-600 bg-red-50 dark:bg-red-950', label_fr: 'No-show', label_en: 'No-show' },
  activity_log_purged: { icon: Eraser, color: 'text-slate-600 bg-slate-100 dark:bg-slate-800', label_fr: 'Journal purgé', label_en: 'Log purged' },
}

const ACTION_TYPES = Object.keys(ACTION_CONFIG)

export function AdminActivityLogPage() {
  const { t, i18n } = useTranslation()
  const isFr = i18n.language === 'fr'
  const locale = isFr ? fr : enUS
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

  // Export et purge
  const { hasRole } = useAuth()
  const isSuperAdmin = hasRole('super_admin')
  const isAdmin = hasRole('admin') || isSuperAdmin
  /** Compte parasite dont l'effacement est proposé à la confirmation. */
  const [purgeUser, setPurgeUser] = useState<{ id: string; nom: string } | null>(null)
  const [purgingUser, setPurgingUser] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [purgeMonths, setPurgeMonths] = useState('12')
  const [purgeConfirm, setPurgeConfirm] = useState<{ count: number } | null>(null)
  const [purging, setPurging] = useState(false)

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

  /**
   * Exporter TOUT ce que les filtres retiennent, pas seulement l'écran.
   *
   * La page n'affiche que 50 entrées à la fois ; exporter cet échantillon
   * donnerait un fichier qui a l'air complet sans l'être. On relit donc avec
   * les mêmes filtres, sans pagination.
   */
  const handleExport = async () => {
    setExporting(true)
    try {
      let query = supabase
        .from('activity_log')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50000)

      if (filterAction !== 'all') query = query.eq('action', filterAction)
      if (filterDateFrom) query = query.gte('created_at', filterDateFrom + 'T00:00:00')
      if (filterDateTo) query = query.lte('created_at', filterDateTo + 'T23:59:59')

      const { data, error } = await query
      if (error) { toast.error(error.message); return }

      const lignes = (data as ActivityEntry[]) ?? []
      if (lignes.length === 0) {
        toast.info(isFr ? 'Aucune entrée à exporter.' : 'Nothing to export.')
        return
      }

      // Les noms manquants : l'export couvre plus large que ce qui est à
      // l'écran, donc plus large que les profils déjà chargés.
      const ids = [...new Set([
        ...lignes.map(e => e.actor_id).filter(Boolean) as string[],
        ...lignes.map(e => e.target_user_id).filter(Boolean),
      ])]
      const noms = new Map(profiles)
      const manquants = ids.filter(id => !noms.has(id))
      for (let i = 0; i < manquants.length; i += 500) {
        const { data: p } = await supabase
          .from('profiles').select('id, display_name')
          .in('id', manquants.slice(i, i + 500))
        for (const prof of p ?? []) noms.set(prof.id, prof as Profile)
      }

      downloadCsv(
        lignes.map(e => ({
          [isFr ? 'Date' : 'Date']: format(new Date(e.created_at), 'dd/MM/yyyy HH:mm:ss'),
          [isFr ? 'Action' : 'Action']: isFr
            ? (ACTION_CONFIG[e.action]?.label_fr ?? e.action)
            : (ACTION_CONFIG[e.action]?.label_en ?? e.action),
          [isFr ? 'Code action' : 'Action code']: e.action,
          [isFr ? 'Par' : 'By']: e.actor_id ? (noms.get(e.actor_id)?.display_name ?? '') : (isFr ? 'Système' : 'System'),
          [isFr ? 'Concerne' : 'Target']: e.target_user_id ? (noms.get(e.target_user_id)?.display_name ?? '') : '',
          [isFr ? 'Type' : 'Type']: e.entity_type ?? '',
          [isFr ? 'Description' : 'Description']: e.description ?? '',
          [isFr ? 'Détails' : 'Details']: e.details ? JSON.stringify(e.details) : '',
        })),
        `journal-activite_${format(new Date(), 'yyyy-MM-dd')}`,
      )
      toast.success(isFr
        ? `${lignes.length} entrée${lignes.length > 1 ? 's' : ''} exportée${lignes.length > 1 ? 's' : ''}.`
        : `${lignes.length} entr${lignes.length > 1 ? 'ies' : 'y'} exported.`)
    } finally {
      setExporting(false)
    }
  }

  /** Combien serait effacé — on l'annonce avant de demander confirmation. */
  const demanderPurge = async () => {
    const mois = parseInt(purgeMonths, 10)
    const { data, error } = await supabase.rpc('count_activity_log_before', { p_months: mois })
    if (error) { toast.error(error.message); return }
    if (data === null) { toast.error(isFr ? 'Réservé au super admin.' : 'Super admin only.'); return }
    if (data === 0) {
      toast.info(isFr
        ? `Aucune entrée n'a plus de ${mois} mois.`
        : `No entries older than ${mois} months.`)
      return
    }
    setPurgeConfirm({ count: data as number })
  }

  const purger = async () => {
    setPurging(true)
    try {
      const { data, error } = await supabase.rpc('purge_activity_log', {
        p_months: parseInt(purgeMonths, 10),
      })
      if (error) { toast.error(error.message); return }

      if (!data?.ok) {
        const causes: Record<string, string> = {
          forbidden: isFr ? 'Réservé au super admin.' : 'Super admin only.',
          too_recent: isFr
            ? 'On ne purge pas en deçà de 6 mois.'
            : 'Cannot purge under 6 months.',
        }
        toast.error(causes[data?.reason as string] ?? t('common.error'))
        return
      }

      toast.success(isFr
        ? `${data.deleted} entrée(s) effacée(s).`
        : `${data.deleted} entr${data.deleted > 1 ? 'ies' : 'y'} deleted.`)
      setPurgeConfirm(null)
      setPage(0)
      fetchEntries(0)
    } finally {
      setPurging(false)
    }
  }

  const getProfileName = (id: string | null) => {
    if (!id) return isFr ? 'Système' : 'System'
    return profiles.get(id)?.display_name ?? '...'
  }

  /**
   * Le bouton d'effacement ne s'affiche que là où il a une chance d'aboutir.
   *
   * C'est un filtre d'affichage, pas une sécurité : la décision appartient au
   * serveur, qui refuse tout compte confirmé, membre du staff, ou portant la
   * moindre trace d'achat. Ici on évite seulement de proposer une action qui
   * serait refusée.
   */
  const peutPurger = (entry: ActivityEntry) => {
    if (!isAdmin) return false
    if (entry.action !== 'signup_attempt') return false
    // Une tentative sur adresse existante ne crée aucun compte : il n'y a rien
    // à effacer, et le compte visé est justement celui d'un membre légitime.
    if (entry.details?.duplicate === true) return false
    if (entry.details?.email_confirmed === true) return false
    // Le profil a disparu de la liste : compte déjà effacé, ligne obsolète.
    return profiles.has(entry.target_user_id)
  }

  /** Efface un compte parasite après confirmation. */
  const purgerParasite = async () => {
    if (!purgeUser) return
    setPurgingUser(true)
    const { data, error } = await supabase.rpc('purge_parasite_account', {
      p_user_id: purgeUser.id,
    })
    setPurgingUser(false)

    if (error) {
      toast.error(isFr ? `Erreur : ${error.message}` : `Error: ${error.message}`)
      return
    }

    const res = data as { ok: boolean; reason?: string; blocker?: string } | null
    if (!res?.ok) {
      // Nommer le motif : « impossible » sans raison laisse l'admin croire à
      // une panne, alors que le refus est le plus souvent délibéré.
      const motifs: Record<string, { fr: string; en: string }> = {
        forbidden: { fr: 'Réservé aux administrateurs.', en: 'Admins only.' },
        self: { fr: 'Vous ne pouvez pas effacer votre propre compte.', en: 'You cannot purge your own account.' },
        not_found: { fr: 'Ce compte n\'existe plus.', en: 'This account no longer exists.' },
        email_confirmed: {
          fr: 'Ce membre a confirmé son adresse : ce n\'est pas un parasite. Passez par sa fiche pour une suppression classique.',
          en: 'This member confirmed their address — not spam. Use their profile for a regular deletion.',
        },
        staff: { fr: 'Un membre du staff ne s\'efface pas ici.', en: 'Staff accounts cannot be purged here.' },
        has_activity: {
          fr: 'Ce compte a une activité (achat, abonnement ou réservation) : la loi impose de le conserver. Passez par sa fiche pour l\'anonymiser.',
          en: 'This account has activity (purchase, subscription or booking): the law requires keeping it. Use their profile to anonymise.',
        },
      }
      const m = motifs[res?.reason ?? '']
      toast.error(m ? (isFr ? m.fr : m.en) : (isFr ? 'Effacement refusé.' : 'Purge refused.'))
      setPurgeUser(null)
      return
    }

    toast.success(isFr
      ? `Compte de ${res && 'former_name' in res ? (res as { former_name: string }).former_name : purgeUser.nom} effacé.`
      : 'Account purged.')
    setPurgeUser(null)
    // Le compte et ses traces ont disparu : recharger plutôt que retirer une
    // ligne, plusieurs entrées du journal peuvent le concerner.
    setPage(0)
    fetchEntries(0)
  }

  if (loading && entries.length === 0) return <LoadingState />

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <ScrollText className="h-6 w-6 text-primary" />
          {isFr ? 'Journal d\'activité' : 'Activity Log'}
        </h1>
        <Button variant="outline" size="sm" onClick={handleExport} disabled={exporting}>
          <Download className="h-4 w-4 mr-1.5" />
          {exporting
            ? (isFr ? 'Préparation…' : 'Preparing…')
            : (isFr ? 'Exporter (.csv)' : 'Export (.csv)')}
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-end gap-3 p-3 rounded-lg border bg-muted/30">
        <div>
          <Label className="text-xs">{isFr ? 'Type' : 'Type'}</Label>
          <Select value={filterAction} onValueChange={(v) => setFilterAction(v ?? 'all')}>
            <SelectTrigger className="h-8 text-xs w-44">
              <span>
                {filterAction === 'all'
                  ? t('common.all')
                  : (isFr
                    ? ACTION_CONFIG[filterAction]?.label_fr
                    : ACTION_CONFIG[filterAction]?.label_en)}
              </span>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('common.all')}</SelectItem>
              {ACTION_TYPES.map(a => (
                <SelectItem key={a} value={a}>
                  {isFr ? ACTION_CONFIG[a].label_fr : ACTION_CONFIG[a].label_en}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">{isFr ? 'Du' : 'From'}</Label>
          <Input type="date" className="h-8 text-xs w-36" value={filterDateFrom} onChange={(e) => setFilterDateFrom(e.target.value)} />
        </div>
        <div>
          <Label className="text-xs">{isFr ? 'Au' : 'To'}</Label>
          <Input type="date" className="h-8 text-xs w-36" value={filterDateTo} onChange={(e) => setFilterDateTo(e.target.value)} />
        </div>
        <Button variant="ghost" size="sm" className="text-xs" onClick={() => { setFilterAction('all'); setFilterDateFrom(''); setFilterDateTo('') }}>
          {isFr ? 'Réinitialiser' : 'Reset'}
        </Button>
      </div>

      {/* L'effacement est réservé au super admin. Le bouton masqué n'est PAS
          la sécurité — `purge_activity_log` refuse elle-même tout appelant
          qui n'a pas le rôle. Ici on évite seulement de proposer à un admin
          une action qu'il ne peut pas faire. */}
      {isSuperAdmin && (
        <div className="flex flex-wrap items-end gap-3 p-3 rounded-lg border border-destructive/30 bg-destructive/5">
          <div>
            <Label className="text-xs flex items-center gap-1.5">
              <Trash2 className="h-3.5 w-3.5 text-destructive" />
              {isFr ? 'Effacer les entrées de plus de' : 'Delete entries older than'}
            </Label>
            <div className="flex items-center gap-2 mt-1">
              <Input
                type="number"
                min={6}
                max={120}
                className="h-8 text-xs w-20"
                value={purgeMonths}
                onChange={(e) => setPurgeMonths(e.target.value)}
              />
              <span className="text-xs text-muted-foreground">{isFr ? 'mois' : 'months'}</span>
              <Button
                variant="destructive"
                size="sm"
                className="text-xs"
                disabled={purging || parseInt(purgeMonths, 10) < 6 || !purgeMonths}
                onClick={demanderPurge}
              >
                {isFr ? 'Effacer…' : 'Delete…'}
              </Button>
            </div>
          </div>
          <p className="text-xs text-muted-foreground pb-1.5 max-w-md">
            {isFr
              ? 'Irréversible. Six mois au minimum. Exportez avant, si ces traces doivent être conservées — l\'effacement lui-même reste inscrit au journal.'
              : 'Irreversible. Six months minimum. Export first if these records must be kept — the deletion itself stays in the log.'}
          </p>
        </div>
      )}

      {/* Entries */}
      {entries.length === 0 ? (
        <EmptyState icon={ScrollText} message={t('common.noResults')} />
      ) : (
        <div className="space-y-2">
          {entries.map((entry) => {
            const config = ACTION_CONFIG[entry.action] ?? ACTION_CONFIG.booking_created
            const Icon = config.icon

            // Un encaissement hors ligne n'a aucun relevé Stripe pour le
            // recouper : s'il se lit comme une ligne parmi d'autres, il sort
            // du journal sans être repris en comptabilité.
            const mode = (entry.details as { payment_method?: string } | null)?.payment_method
            const horsLigne = mode === 'cash' || mode === 'transfer'
            const montantCents = (entry.details as { price_paid_cents?: number } | null)?.price_paid_cents

            return (
              <div
                key={entry.id}
                className={cn(
                  'flex items-start gap-3 p-3 rounded-lg border transition-colors',
                  horsLigne
                    ? 'border-amber-400 bg-amber-50 dark:bg-amber-950/40 dark:border-amber-700 hover:bg-amber-100/70 dark:hover:bg-amber-950/60'
                    : 'hover:bg-muted/30',
                )}
              >
                <div className={cn('h-8 w-8 rounded-lg flex items-center justify-center shrink-0', config.color)}>
                  <Icon className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <Badge variant="outline" className="text-[10px] h-5">
                      {isFr ? config.label_fr : config.label_en}
                    </Badge>
                    {horsLigne && (
                      <Badge className="text-[10px] h-5 bg-amber-500 hover:bg-amber-500 text-white border-transparent gap-1">
                        <Banknote className="h-3 w-3" />
                        {mode === 'cash'
                          ? (isFr ? 'ESPÈCES' : 'CASH')
                          : (isFr ? 'VIREMENT' : 'TRANSFER')}
                        {typeof montantCents === 'number' && ` · ${formatEuros(montantCents, 0)} €`}
                      </Badge>
                    )}
                    <span className="text-[11px] text-muted-foreground">
                      {format(new Date(entry.created_at), 'dd/MM/yyyy HH:mm', { locale })}
                    </span>
                  </div>
                  <p className="text-sm">{entry.description}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {isFr ? 'Par' : 'By'}: <span className="font-medium">{getProfileName(entry.actor_id)}</span>
                    {entry.actor_id !== entry.target_user_id && (
                      <> → <span className="font-medium">{getProfileName(entry.target_user_id)}</span></>
                    )}
                  </p>
                </div>

                {/* Effacer le parasite depuis la ligne qui le signale : le
                    repérer puis aller chercher sa fiche ferait perdre le fil
                    d'un journal qu'on parcourt de haut en bas. Le serveur
                    refusera de toute façon tout compte confirmé ou ayant la
                    moindre trace d'achat. */}
                {peutPurger(entry) && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="shrink-0 text-muted-foreground hover:text-destructive"
                    disabled={purgingUser}
                    title={isFr ? 'Effacer ce compte parasite' : 'Purge this spam account'}
                    onClick={() => setPurgeUser({
                      id: entry.target_user_id,
                      nom: getProfileName(entry.target_user_id),
                    })}
                  >
                    <UserRoundX className="h-4 w-4" />
                  </Button>
                )}
              </div>
            )
          })}

          {hasMore && (
            <div className="flex justify-center pt-2">
              <Button variant="outline" size="sm" onClick={loadMore} disabled={loading}>
                <ChevronDown className="h-4 w-4 mr-1" />
                {isFr ? 'Charger plus' : 'Load more'}
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Le décompte figure dans la question : « effacer 1 240 entrées » et
          « effacer 3 entrées » n'appellent pas la même réponse. */}
      <ConfirmDialog
        open={purgeConfirm !== null}
        onOpenChange={(o) => { if (!o) setPurgeConfirm(null) }}
        title={isFr ? 'Effacer ces entrées du journal ?' : 'Delete these log entries?'}
        description={isFr
          ? `${purgeConfirm?.count ?? 0} entrée(s) antérieure(s) à ${purgeMonths} mois seront définitivement effacées. Cette opération est irréversible.`
          : `${purgeConfirm?.count ?? 0} entr${(purgeConfirm?.count ?? 0) > 1 ? 'ies' : 'y'} older than ${purgeMonths} months will be permanently deleted. This cannot be undone.`}
        onConfirm={purger}
        variant="destructive"
      />

      {/* Effacement définitif, sans anonymisation : la question doit le dire, et
          nommer le compte visé — une ligne de journal ressemble à la suivante. */}
      <ConfirmDialog
        open={purgeUser !== null}
        onOpenChange={(o) => { if (!o) setPurgeUser(null) }}
        title={isFr ? 'Effacer ce compte ?' : 'Purge this account?'}
        description={isFr
          ? `Le compte de ${purgeUser?.nom ?? ''} et toutes ses traces seront définitivement effacés. Réservé aux inscriptions jamais confirmées et sans aucun achat — le serveur refusera dans tous les autres cas. Cette opération est irréversible.`
          : `${purgeUser?.nom ?? 'This account'} and all its traces will be permanently deleted. Only for never-confirmed sign-ups with no purchase — the server will refuse otherwise. This cannot be undone.`}
        onConfirm={purgerParasite}
        variant="destructive"
      />
    </div>
  )
}

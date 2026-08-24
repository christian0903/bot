import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { supabase } from '@/lib/supabase'
import { formatEuros, formatPackCredits, formatValidity } from '@/lib/utils'
import { logActivity } from '@/lib/activity-log'
import { useAuth } from '@/contexts/AuthContext'
import type { Profile, UserRole, PackType, MemberCategory, PaymentMethod } from '@/types'
import { LoadingState } from '@/components/common/LoadingState'
import { EmptyState } from '@/components/common/EmptyState'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { toast } from 'sonner'
import { Download, Trash2, Users, Gift, ChevronRight, CreditCard, Plus, Banknote, Landmark, AlertTriangle } from 'lucide-react'
import { format, addDays } from 'date-fns'
import { fr, enUS } from 'date-fns/locale'

interface UserWithRole extends Profile {
  role: UserRole
  roles: UserRole[]
  credits: number
  /** Le membre a un pack illimité valide : la colonne Crédits affiche "Illimité". */
  hasUnlimited: boolean
}

const exportCsv = (data: Record<string, unknown>[], filename: string) => {
  const BOM = '\uFEFF'
  const headers = Object.keys(data[0])
  const csv = BOM + [headers.join(','), ...data.map(row => headers.map(h => `"${row[h] ?? ''}"`).join(','))].join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const link = document.createElement('a')
  link.href = URL.createObjectURL(blob)
  link.download = `${filename}.csv`
  link.click()
}

export function AdminUsersPage() {
  const { t, i18n } = useTranslation()
  const { user: currentUser } = useAuth()
  const navigate = useNavigate()
  const locale = i18n.language === 'fr' ? fr : enUS
  const isFr = i18n.language === 'fr'
  const [users, setUsers] = useState<UserWithRole[]>([])
  const [loading, setLoading] = useState(true)
  const [deleteTarget, setDeleteTarget] = useState<UserWithRole | null>(null)
  const [roleFilter, setRoleFilter] = useState<UserRole | 'all'>('client')

  // Create user state
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [createSaving, setCreateSaving] = useState(false)
  const [newUser, setNewUser] = useState({
    email: '', password: '', display_name: '', first_name: '', last_name: '', phone: '', role: 'client' as UserRole,
  })

  // Assign pack state
  const [packDialogOpen, setPackDialogOpen] = useState(false)
  const [packTarget, setPackTarget] = useState<UserWithRole | null>(null)
  const [packTypes, setPackTypes] = useState<PackType[]>([])
  const [selectedPackTypeId, setSelectedPackTypeId] = useState('')
  const [packPriceOverride, setPackPriceOverride] = useState('')
  /**
   * Canal d'encaissement, choisi et non déduit. Le prix ne suffit pas : un pack
   * offert au tarif plein passerait pour une recette, et l'argent d'une caisse
   * ne se distinguerait pas d'un virement au moment du rapprochement.
   */
  const [packPaymentMethod, setPackPaymentMethod] = useState<PaymentMethod>('gift')
  /** Non nul = le garde-fou d'encaissement est affiché, en attente de réponse. */
  const [confirmEncaissement, setConfirmEncaissement] = useState<PaymentMethod | null>(null)
  const [packSaving, setPackSaving] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [categories, setCategories] = useState<MemberCategory[]>([])
  const [filterCategory, setFilterCategory] = useState<string>('all')

  // Sélection multiple. Les catégories et statuts se changeaient un membre à la
  // fois, depuis sa fiche : ranger une saison entière d'anciens membres
  // demandait autant d'allers-retours que de personnes.
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  /**
   * Attribution groupée de catégorie. Non nul = le dialogue est ouvert.
   *
   * Seule la **catégorie** se règle ici, pas `member_status` : ce dernier est
   * calculé par `update_member_status` à partir des faits (frais payés, pack
   * actif, ancienneté du dernier pack). Un statut posé à la main serait écrasé
   * au prochain recalcul — un bouton qui ment vaut moins que pas de bouton.
   */
  const [bulkCategoryOpen, setBulkCategoryOpen] = useState(false)
  const [bulkCategoryId, setBulkCategoryId] = useState<string>('')
  const [bulkSaving, setBulkSaving] = useState(false)

  const fetchUsers = async () => {
    const [profilesRes, rolesRes, packsRes, catRes] = await Promise.all([
      supabase.from('profiles').select('*').order('created_at', { ascending: false }),
      supabase.from('user_roles').select('user_id, role'),
      supabase
        .from('pack_purchases')
        // Pas de filtre sur credits_remaining : un illimité valide a souvent 0.
        .select('user_id, credits_remaining, expires_at, pack_type:pack_types(is_unlimited)')
        .gt('expires_at', new Date().toISOString()),
      supabase.from('member_categories').select('*').order('name'),
    ])

    setCategories((catRes.data as MemberCategory[]) ?? [])

    // Build roles map (user can have multiple roles)
    const rolesMap = new Map<string, UserRole[]>()
    for (const r of rolesRes.data ?? []) {
      const existing = rolesMap.get(r.user_id) ?? []
      existing.push(r.role as UserRole)
      rolesMap.set(r.user_id, existing)
    }

    // Somme des crédits par membre, et repérage des accès illimités
    const creditMap = new Map<string, number>()
    const unlimitedSet = new Set<string>()
    for (const p of packsRes.data ?? []) {
      const pt = p.pack_type as unknown as { is_unlimited?: boolean } | null
      if (pt?.is_unlimited) {
        unlimitedSet.add(p.user_id)
      } else if (p.credits_remaining > 0) {
        creditMap.set(p.user_id, (creditMap.get(p.user_id) ?? 0) + p.credits_remaining)
      }
    }

    // Primary role for display: super_admin > admin > coach > client
    const primaryRole = (roles: UserRole[]): UserRole => {
      if (roles.includes('super_admin')) return 'super_admin'
      if (roles.includes('admin')) return 'admin'
      if (roles.includes('coach')) return 'coach'
      return 'client'
    }

    const merged: UserWithRole[] = (profilesRes.data ?? []).map((p: Profile) => {
      const userRoles = rolesMap.get(p.id) ?? ['client']
      return {
        ...p,
        role: primaryRole(userRoles),
        roles: userRoles,
        credits: creditMap.get(p.id) ?? 0,
        hasUnlimited: unlimitedSet.has(p.id),
      }
    })
    // Exclude coaches and admins — they have their own page
    const clientsOnly = merged.filter(u => !u.roles.includes('coach') && !u.roles.includes('admin') && !u.roles.includes('super_admin'))
    setUsers(clientsOnly)
    setLoading(false)
  }

  const handleCreateUser = async () => {
    if (!newUser.email || !newUser.password || !newUser.display_name) return
    setCreateSaving(true)

    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { toast.error(t('common.error')); setCreateSaving(false); return }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-user`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify(newUser),
        }
      )

      const data = await response.json()

      if (!response.ok) {
        toast.error(data.error || t('common.error'))
        setCreateSaving(false)
        return
      }

      await logActivity({
        action: 'user_created',
        actor_id: currentUser?.id ?? null,
        target_user_id: data.user_id,
        entity_type: 'profiles',
        details: { email: newUser.email, display_name: newUser.display_name, role: newUser.role },
        description: `Nouveau membre: ${newUser.display_name} (${newUser.email}) — rôle ${newUser.role}`,
      })

      toast.success(t('admin.users.userCreated'))
      setCreateDialogOpen(false)
      setNewUser({ email: '', password: '', display_name: '', first_name: '', last_name: '', phone: '', role: 'client' })
      fetchUsers()
    } catch {
      toast.error(t('common.error'))
    }
    setCreateSaving(false)
  }

  useEffect(() => {
    fetchUsers()
    supabase
      .from('pack_types')
      .select('*, credit_type:credit_types(*)')
      .eq('is_active', true)
      .order('name')
      .then(({ data }) => setPackTypes((data as PackType[]) ?? []))
  }, [])

  const handleDelete = async () => {
    if (!deleteTarget) return
    const { error } = await supabase.from('profiles').delete().eq('id', deleteTarget.id)
    if (error) { toast.error(t('common.error')); return }
    setUsers(prev => prev.filter(u => u.id !== deleteTarget.id))
    toast.success(t('common.deleteSuccess'))
    setDeleteTarget(null)
  }

  const handleExport = () => {
    const data = filteredUsers.map(u => ({
      name: u.display_name,
      email: u.email ?? '',
      role: u.role,
      // Visible à l'écran, donc attendue dans le fichier : une colonne qu'on
      // voit et qu'on ne retrouve pas à l'export se remarque tout de suite.
      category: categories.find(c => c.id === u.member_category_id)?.name ?? '',
      credits: u.hasUnlimited ? (isFr ? 'Illimité' : 'Unlimited') : u.credits,
      joined: u.created_at,
    }))
    exportCsv(data, 'users')
  }

  const openAssignPack = (user: UserWithRole) => {
    setPackTarget(user)
    setSelectedPackTypeId('')
    setPackPriceOverride('')
    // Le cadeau est le défaut : hériter d'un « espèces » de l'attribution
    // précédente déclarerait une recette que personne n'a encaissée.
    setPackPaymentMethod('gift')
    setConfirmEncaissement(null)
    setPackDialogOpen(true)
  }

  const handleAssignPack = async () => {
    if (!packTarget || !selectedPackTypeId) return
    setPackSaving(true)

    const packType = packTypes.find(p => p.id === selectedPackTypeId)
    if (!packType) { setPackSaving(false); return }

    const priceCents = packPriceOverride !== ''
      ? Math.round(parseFloat(packPriceOverride) * 100)
      : packType.price_cents

    const now = new Date()
    const expiresAt = addDays(now, packType.validity_days)

    // `select()` : sans l'identifiant créé, l'entrée de journal ne pointerait
    // vers aucune ligne d'achat, et un refus RLS passerait pour un succès.
    const { data: creee, error } = await supabase.from('pack_purchases').insert({
      user_id: packTarget.id,
      pack_type_id: packType.id,
      price_paid_cents: priceCents,
      credits_remaining: packType.credit_count,
      purchased_at: now.toISOString(),
      expires_at: expiresAt.toISOString(),
      payment_method: packPaymentMethod,
    }).select('id')

    setPackSaving(false)
    if (error) { toast.error(error.message); return }
    if (!creee || creee.length === 0) {
      toast.error(isFr
        ? 'Attribution refusée — vous n\'avez pas les droits'
        : 'Assignment refused — you lack permission')
      return
    }

    await supabase.from('notifications').insert({
      user_id: packTarget.id,
      title: i18n.language === 'fr' ? 'Pack attribué' : 'Pack assigned',
      message: i18n.language === 'fr'
        ? `Le pack "${packType.name}" (${formatPackCredits(packType, true)}) vous a été attribué. Valide jusqu'au ${format(expiresAt, 'dd/MM/yyyy')}.`
        : `The pack "${packType.name}" (${formatPackCredits(packType, false)}) has been assigned to you. Valid until ${format(expiresAt, 'dd/MM/yyyy')}.`,
      type: 'success',
      link: '/my-packs',
    })

    // Log activity
    //
    // La description est ce que lit un comptable, et c'est parfois la seule
    // chose qu'il lit : l'encaissement hors ligne s'y annonce en premier mot,
    // avant même le nom du pack, pour ne pas se noyer dans la ligne.
    const libelleMode: Record<PaymentMethod, string> = {
      cash: 'ESPÈCES',
      transfer: 'VIREMENT',
      gift: 'offert',
      stripe: 'en ligne',
    }
    const horsLigne = packPaymentMethod === 'cash' || packPaymentMethod === 'transfer'
    const prefixe = horsLigne ? `ENCAISSEMENT ${libelleMode[packPaymentMethod]} — ` : ''

    await logActivity({
      action: 'pack_assigned',
      actor_id: currentUser?.id ?? null,
      target_user_id: packTarget.id,
      entity_type: 'pack_purchase',
      entity_id: creee[0].id,
      details: {
        pack_name: packType.name,
        credits: packType.credit_count,
        price_paid_cents: priceCents,
        expires_at: expiresAt.toISOString(),
        payment_method: packPaymentMethod,
      },
      description: `${prefixe}Pack "${packType.name}" (${formatPackCredits(packType, true)}, ${formatEuros(priceCents, 0)}${horsLigne ? '' : `, ${libelleMode[packPaymentMethod]}`}) attribué à ${packTarget.display_name}`,
    })

    // Update local credits count (un illimité n'ajoute aucun credit au total)
    if (!packType.is_unlimited) {
      setUsers(prev => prev.map(u =>
        u.id === packTarget.id ? { ...u, credits: u.credits + packType.credit_count } : u
      ))
    }

    toast.success(t('admin.users.packAssigned'))
    setPackDialogOpen(false)
  }

  if (loading) return <LoadingState />

  const filteredUsers = users.filter(u => {
    if (roleFilter !== 'all' && roleFilter !== u.role) return false
    if (filterCategory !== 'all') {
      if (filterCategory === 'none') {
        if (u.member_category_id) return false
      } else {
        if (u.member_category_id !== filterCategory) return false
      }
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      const name = (u.display_name || '').toLowerCase()
      const first = (u.first_name || '').toLowerCase()
      const last = (u.last_name || '').toLowerCase()
      const email = (u.email || '').toLowerCase()
      if (!name.includes(q) && !first.includes(q) && !last.includes(q) && !email.includes(q)) return false
    }
    return true
  })

  const selectedPack = packTypes.find(p => p.id === selectedPackTypeId)

  // La sélection ne porte que sur ce qui est affiché : cocher « tout » après
  // avoir filtré ne doit pas embarquer des membres qu'on ne voit pas.
  const allSelected = filteredUsers.length > 0
    && filteredUsers.every(u => selectedIds.has(u.id))

  const toggleAll = () => {
    setSelectedIds(allSelected ? new Set() : new Set(filteredUsers.map(u => u.id)))
  }

  const toggleOne = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  /** Attribue — ou retire — une catégorie aux membres sélectionnés. */
  const appliquerCategorie = async () => {
    const ids = [...selectedIds]
    if (ids.length === 0) return
    setBulkSaving(true)

    // Chaîne vide = retirer la catégorie. Un `null` explicite, pas un oubli.
    const valeur = bulkCategoryId === '__none__' ? null : bulkCategoryId
    const { error } = await supabase
      .from('profiles')
      .update({ member_category_id: valeur })
      .in('id', ids)

    if (error) {
      toast.error(error.message)
      setBulkSaving(false)
      return
    }

    const nomCategorie = valeur
      ? categories.find(c => c.id === valeur)?.name ?? ''
      : (isFr ? 'aucune' : 'none')

    await logActivity({
      action: 'role_changed',
      actor_id: currentUser?.id ?? null,
      target_user_id: ids[0],
      entity_type: 'profile',
      details: { bulk_category: nomCategorie, count: ids.length, user_ids: ids },
      description: `Catégorie « ${nomCategorie} » attribuée à ${ids.length} membre(s)`,
    })

    toast.success(isFr
      ? `${ids.length} membre(s) rangé(s) en « ${nomCategorie} »`
      : `${ids.length} member(s) set to “${nomCategorie}”`)

    setBulkCategoryOpen(false)
    setSelectedIds(new Set())
    setBulkCategoryId('')
    setBulkSaving(false)
    await fetchUsers()
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-2xl font-bold">{isFr ? 'Membres' : 'Members'}</h1>
        <div className="flex gap-2">
          <Button size="sm" onClick={() => setCreateDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-1" />
            {t('admin.users.createUser')}
          </Button>
          <Button variant="outline" size="sm" onClick={handleExport}>
            <Download className="h-4 w-4 mr-1" />
            {t('admin.users.exportCsv')}
          </Button>
        </div>
      </div>

      {/* Search + Category filter */}
      <div className="flex items-center gap-3 flex-wrap">
        <Input
          type="text"
          placeholder={isFr ? 'Rechercher nom, prénom, email...' : 'Search name, email...'}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-64 h-8 text-sm"
        />
        {categories.length > 0 && (
          <Select value={filterCategory} onValueChange={(v) => setFilterCategory(v ?? 'all')}>
            <SelectTrigger className="h-8 text-xs w-auto min-w-[140px]">
              <span>{filterCategory === 'all'
                ? (isFr ? 'Toutes catégories' : 'All categories')
                : filterCategory === 'none'
                  ? (isFr ? 'Sans catégorie' : 'No category')
                  : categories.find(c => c.id === filterCategory)?.name}</span>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{isFr ? 'Toutes catégories' : 'All categories'}</SelectItem>
              <SelectItem value="none">{isFr ? 'Sans catégorie' : 'No category'}</SelectItem>
              {categories.map(cat => (
                <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        {(['all', 'client'] as const).map((role) => (
          <Button
            key={role}
            variant={roleFilter === role ? 'default' : 'outline'}
            size="sm"
            onClick={() => setRoleFilter(role)}
            className="text-xs"
          >
            {role === 'all' ? t('common.all') : t(`roles.${role}`)}
            <Badge variant="secondary" className="ml-1.5 h-5 px-1.5 text-[10px]">
              {users.length}
            </Badge>
          </Button>
        ))}
      </div>

      {/* Actions groupées : n'apparaît qu'une fois quelque chose de sélectionné,
          sinon elle occupe la place sans rien proposer. */}
      {selectedIds.size > 0 && (
        <div className="flex flex-wrap items-center gap-3 p-3 rounded-lg border border-primary/30 bg-primary/5">
          <Badge variant="default">{selectedIds.size}</Badge>
          <span className="text-sm font-medium">
            {isFr ? 'membre(s) sélectionné(s)' : 'member(s) selected'}
          </span>
          <div className="flex-1" />
          <Button size="sm" variant="outline" onClick={() => setBulkCategoryOpen(true)}>
            <Users className="h-4 w-4 mr-1.5" />
            {isFr ? 'Attribuer une catégorie' : 'Set category'}
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setSelectedIds(new Set())}>
            {isFr ? 'Désélectionner' : 'Clear'}
          </Button>
        </div>
      )}

      {filteredUsers.length === 0 ? (
        <EmptyState icon={Users} message={t('common.noResults')} />
      ) : (
        <div className="border rounded-lg overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={toggleAll}
                    className="h-4 w-4 rounded border-input accent-primary cursor-pointer"
                  />
                </TableHead>
                <TableHead>{t('admin.users.name')}</TableHead>
                {/* Pas de colonne Rôle : cette page exclut coachs et admins,
                    elle aurait affiché « Client » sur chaque ligne. Le rôle
                    reste visible sur la fiche individuelle, où il peut varier.
                    La catégorie, elle, commande les packs achetables — la voir
                    ici évite de cocher à l'aveugle avant une attribution. */}
                <TableHead className="hidden sm:table-cell">
                  {isFr ? 'Catégorie' : 'Category'}
                </TableHead>
                <TableHead className="text-center">
                  <span className="flex items-center gap-1 justify-center">
                    <CreditCard className="h-3 w-3" />
                    {isFr ? 'Crédits' : 'Credits'}
                  </span>
                </TableHead>
                <TableHead className="hidden md:table-cell">{t('admin.users.lastLogin')}</TableHead>
                <TableHead>{t('admin.users.actions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredUsers.map((user) => (
                <TableRow key={user.id} className="group">
                  <TableCell>
                    <input
                      type="checkbox"
                      checked={selectedIds.has(user.id)}
                      onChange={() => toggleOne(user.id)}
                      className="h-4 w-4 rounded border-input accent-primary cursor-pointer"
                    />
                  </TableCell>
                  <TableCell>
                    <button
                      className="font-medium text-left hover:text-primary hover:underline transition-colors flex items-center gap-1"
                      onClick={() => navigate(`/admin/users/${user.id}`)}
                    >
                      {user.display_name}
                      {/* Repère professionnel : ce membre commande sur facture,
                          pas par carte. Utile avant même d'ouvrir sa fiche. */}
                      {user.is_business && (
                        <Badge
                          variant="outline"
                          className="ml-1 h-5 px-1.5 text-[10px] border-blue-500/50 text-blue-600 dark:text-blue-400"
                          title={user.company_name ?? undefined}
                        >
                          B2B
                        </Badge>
                      )}
                      <ChevronRight className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </button>
                    {/* Sous le nom en dessous de 640 px, où la colonne dédiée
                        est masquée : un iPhone en portrait ne la voyait jamais,
                        et c'est précisément l'information qu'on vérifie avant
                        de cocher quelqu'un. La ligne du nom a de la place, le
                        tableau n'en a plus. */}
                    {(() => {
                      const cat = categories.find(c => c.id === user.member_category_id)
                      if (!cat) return null
                      return (
                        <Badge
                          variant="secondary"
                          className="sm:hidden mt-1 text-[10px] font-normal"
                        >
                          {cat.name}
                        </Badge>
                      )
                    })()}
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">
                    {(() => {
                      const cat = categories.find(c => c.id === user.member_category_id)
                      // Un tiret plutôt qu'une case vide : sans catégorie est un
                      // état légitime, pas une donnée manquante.
                      if (!cat) return <span className="text-xs text-muted-foreground">—</span>
                      return (
                        <Badge variant="secondary" className="text-[10px] font-normal">
                          {cat.name}
                        </Badge>
                      )
                    })()}
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge
                      variant={user.hasUnlimited || user.credits > 0 ? 'default' : 'secondary'}
                      className="text-xs"
                    >
                      {user.hasUnlimited ? (isFr ? 'Illimité' : 'Unlimited') : user.credits}
                    </Badge>
                  </TableCell>
                  <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                    {user.last_sign_in_at
                      ? format(new Date(user.last_sign_in_at), 'dd/MM/yyyy HH:mm', { locale })
                      : '-'}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        title={t('admin.users.assignPack')}
                        onClick={() => openAssignPack(user)}
                      >
                        <Gift className="h-4 w-4 text-primary" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => setDeleteTarget(user)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Create User Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5 text-primary" />
              {t('admin.users.createUser')}
            </DialogTitle>
            <DialogDescription>{t('admin.users.createUserDesc')}</DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">{t('auth.firstName')}</Label>
                <Input
                  value={newUser.first_name}
                  onChange={(e) => setNewUser(u => ({ ...u, first_name: e.target.value }))}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">{t('auth.lastName')}</Label>
                <Input
                  value={newUser.last_name}
                  onChange={(e) => setNewUser(u => ({ ...u, last_name: e.target.value }))}
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">{t('auth.displayName')} *</Label>
              <Input
                value={newUser.display_name}
                onChange={(e) => setNewUser(u => ({ ...u, display_name: e.target.value }))}
                required
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">{t('auth.email')} *</Label>
              <Input
                type="email"
                value={newUser.email}
                onChange={(e) => setNewUser(u => ({ ...u, email: e.target.value }))}
                required
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">{t('auth.password')} *</Label>
              <Input
                type="password"
                value={newUser.password}
                onChange={(e) => setNewUser(u => ({ ...u, password: e.target.value }))}
                required
                minLength={8}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">{t('profile.phone')}</Label>
              <Input
                value={newUser.phone}
                onChange={(e) => setNewUser(u => ({ ...u, phone: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">{t('admin.users.role')}</Label>
              <select
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={newUser.role}
                onChange={(e) => setNewUser(u => ({ ...u, role: e.target.value as UserRole }))}
              >
                <option value="client">{t('roles.client')}</option>
                <option value="coach">{t('roles.coach')}</option>
                <option value="admin">{t('roles.admin')}</option>
              </select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button
              onClick={handleCreateUser}
              disabled={!newUser.email || !newUser.password || !newUser.display_name || createSaving}
            >
              {createSaving ? '...' : t('admin.users.createUser')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Assign Pack Dialog */}
      <Dialog open={packDialogOpen} onOpenChange={setPackDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Gift className="h-5 w-5 text-primary" />
              {t('admin.users.assignPack')}
            </DialogTitle>
            <DialogDescription>{t('admin.users.assignPackDesc')}</DialogDescription>
          </DialogHeader>

          {packTarget && (
            <div className="space-y-4">
              <div className="p-3 rounded-lg bg-muted/50">
                <p className="font-medium">{packTarget.display_name}</p>
                <p className="text-sm text-muted-foreground">{packTarget.email}</p>
              </div>

              <div className="space-y-2">
                <Label>{t('admin.users.selectPack')}</Label>
                <Select
                  value={selectedPackTypeId}
                  onValueChange={(val) => {
                    setSelectedPackTypeId(val ?? '')
                    setPackPriceOverride('')
                  }}
                >
                  <SelectTrigger>
                    <span>
                      {selectedPack
                        ? `${selectedPack.name} — ${formatPackCredits(selectedPack, isFr)}`
                        : t('admin.users.selectPack')}
                    </span>
                  </SelectTrigger>
                  <SelectContent>
                    {packTypes.map(pt => (
                      <SelectItem key={pt.id} value={pt.id}>
                        {pt.name} — {formatPackCredits(pt, isFr)} — {formatEuros(pt.price_cents, 0)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {selectedPack && (
                <div className="space-y-3">
                  <div className="flex gap-2 flex-wrap">
                    <Badge variant="outline">
                      {i18n.language === 'fr' ? selectedPack.credit_type?.label_fr : selectedPack.credit_type?.label_en}
                    </Badge>
                    <Badge variant="outline">{formatPackCredits(selectedPack, isFr)}</Badge>
                    <Badge variant="outline">{formatValidity(selectedPack.validity_days, isFr)}</Badge>
                  </div>

                  <div className="space-y-2">
                    <Label>{t('admin.packTypes.price')} (€)</Label>
                    <Input
                      type="number"
                      min={0}
                      placeholder={formatEuros(selectedPack.price_cents, 0)}
                      value={packPriceOverride}
                      onChange={(e) => setPackPriceOverride(e.target.value)}
                    />
                    {/* Le canal se choisit, il ne se déduit plus du prix : un
                        pack offert au tarif plein passait pour une recette, et
                        l'espèces ne se distinguait pas du virement. */}
                    <div className="grid grid-cols-3 gap-2 pt-1">
                      {([
                        { mode: 'gift' as const, icone: Gift, libelle: isFr ? 'Cadeau / offert' : 'Gift', prix: 0 },
                        { mode: 'cash' as const, icone: Banknote, libelle: isFr ? 'Espèces' : 'Cash', prix: selectedPack.price_cents },
                        { mode: 'transfer' as const, icone: Landmark, libelle: isFr ? 'Virement' : 'Transfer', prix: selectedPack.price_cents },
                      ]).map(({ mode, icone: Icone, libelle, prix }) => (
                        <Button
                          key={mode}
                          type="button"
                          variant={packPaymentMethod === mode ? 'default' : 'outline'}
                          size="sm"
                          className="text-xs h-auto py-2 flex-col gap-1"
                          onClick={() => {
                            setPackPriceOverride(prix === 0 ? '0' : formatEuros(prix, 0))
                            // Un encaissement se confirme avant d'être retenu :
                            // c'est le clic distrait qu'on cherche à casser.
                            if (mode === 'gift') setPackPaymentMethod('gift')
                            else setConfirmEncaissement(mode)
                          }}
                        >
                          <Icone className="h-3.5 w-3.5" />
                          <span>{libelle}</span>
                        </Button>
                      ))}
                    </div>

                    {(packPaymentMethod === 'cash' || packPaymentMethod === 'transfer') && (
                      <div className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-950/40 dark:border-amber-800 p-2.5">
                        <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-500 shrink-0 mt-0.5" />
                        <p className="text-xs text-amber-900 dark:text-amber-200">
                          {isFr
                            ? `Vous déclarez avoir encaissé ${packPriceOverride || formatEuros(selectedPack.price_cents, 0)} € ${packPaymentMethod === 'cash' ? 'en espèces' : 'par virement'}. Cette somme comptera dans les recettes.`
                            : `You declare having collected €${packPriceOverride || formatEuros(selectedPack.price_cents, 0)} ${packPaymentMethod === 'cash' ? 'in cash' : 'by transfer'}. This will count as revenue.`}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setPackDialogOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button onClick={handleAssignPack} disabled={!selectedPackTypeId || packSaving}>
              {packSaving ? '...' : t('common.confirm')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title={t('admin.users.delete')}
        description={t('admin.users.deleteConfirm')}
        onConfirm={handleDelete}
      />

      {/* Garde-fou d'encaissement.
          Le motif est toujours le même : « j'ai offert le pack, j'ai cliqué
          Paiement manuel sans réfléchir » — et le studio se retrouve avec une
          recette fantôme qu'aucune caisse ne recoupe. Le montant est répété en
          gros, seul, parce que c'est lui qu'on ne relit pas. */}
      <Dialog open={!!confirmEncaissement} onOpenChange={(open) => !open && setConfirmEncaissement(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-500" />
              {isFr ? 'Encaissement déclaré' : 'Declared payment'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              {isFr ? 'Vous déclarez avoir reçu' : 'You declare having received'}
            </p>
            <p className="text-3xl font-semibold text-center py-2">
              {selectedPack ? formatEuros(selectedPack.price_cents, 0) : '—'} €
            </p>
            <p className="text-sm">
              {isFr
                ? `${confirmEncaissement === 'cash' ? 'en espèces' : 'par virement'} de ${packTarget?.display_name ?? ''}.`
                : `${confirmEncaissement === 'cash' ? 'in cash' : 'by bank transfer'} from ${packTarget?.display_name ?? ''}.`}
            </p>
            <div className="rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-950/40 dark:border-amber-800 p-2.5">
              <p className="text-xs text-amber-900 dark:text-amber-200">
                {isFr
                  ? 'Cette somme sera comptée dans les recettes. S\'il s\'agit d\'un cadeau, annulez et choisissez « Cadeau / offert ».'
                  : 'This will count as revenue. If it is a gift, cancel and pick “Gift”.'}
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmEncaissement(null)}>
              {t('common.cancel')}
            </Button>
            <Button
              onClick={() => {
                if (confirmEncaissement) setPackPaymentMethod(confirmEncaissement)
                setConfirmEncaissement(null)
              }}
            >
              {isFr ? 'Je confirme' : 'I confirm'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Attribution groupée de catégorie. */}
      <Dialog open={bulkCategoryOpen} onOpenChange={setBulkCategoryOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {isFr ? 'Attribuer une catégorie' : 'Set a category'}
            </DialogTitle>
            <DialogDescription>
              {isFr
                ? `${selectedIds.size} membre(s) sélectionné(s). La catégorie détermine les packs qui leur sont proposés à l'achat.`
                : `${selectedIds.size} member(s) selected. The category determines which packs they are offered.`}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <Label>{isFr ? 'Catégorie' : 'Category'}</Label>
            <Select value={bulkCategoryId} onValueChange={(v) => setBulkCategoryId(v ?? '')}>
              <SelectTrigger>
                <span>
                  {bulkCategoryId === '__none__'
                    ? (isFr ? 'Aucune catégorie' : 'No category')
                    : categories.find(c => c.id === bulkCategoryId)?.name
                      ?? (isFr ? 'Choisir…' : 'Choose…')}
                </span>
              </SelectTrigger>
              <SelectContent>
                {categories.map(c => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
                {/* Retirer la catégorie est une décision comme une autre : sans
                    cette entrée, un membre mal rangé le resterait. */}
                <SelectItem value="__none__">
                  {isFr ? 'Aucune catégorie' : 'No category'}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkCategoryOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button onClick={appliquerCategorie} disabled={bulkSaving || !bulkCategoryId}>
              {t('common.confirm')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

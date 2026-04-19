import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { supabase } from '@/lib/supabase'
import { logActivity } from '@/lib/activity-log'
import { useAuth } from '@/contexts/AuthContext'
import type { Profile, UserRole, PackType } from '@/types'
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
import { Download, Trash2, Users, Gift, ChevronRight, CreditCard, Plus } from 'lucide-react'
import { format, addDays } from 'date-fns'
import { fr, enUS } from 'date-fns/locale'

interface UserWithRole extends Profile {
  role: UserRole
  credits: number
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
  const [packSaving, setPackSaving] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  const fetchUsers = async () => {
    const [profilesRes, rolesRes, packsRes] = await Promise.all([
      supabase.from('profiles').select('*').order('created_at', { ascending: false }),
      supabase.from('user_roles').select('user_id, role'),
      supabase
        .from('pack_purchases')
        .select('user_id, credits_remaining, expires_at')
        .gt('credits_remaining', 0)
        .gt('expires_at', new Date().toISOString()),
    ])

    const roleMap = new Map((rolesRes.data ?? []).map((r: { user_id: string; role: UserRole }) => [r.user_id, r.role]))

    // Sum credits per user
    const creditMap = new Map<string, number>()
    for (const p of packsRes.data ?? []) {
      creditMap.set(p.user_id, (creditMap.get(p.user_id) ?? 0) + p.credits_remaining)
    }

    const merged: UserWithRole[] = (profilesRes.data ?? []).map((p: Profile) => ({
      ...p,
      role: roleMap.get(p.id) ?? 'client',
      credits: creditMap.get(p.id) ?? 0,
    }))
    setUsers(merged)
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
      credits: u.credits,
      joined: u.created_at,
    }))
    exportCsv(data, 'users')
  }

  const openAssignPack = (user: UserWithRole) => {
    setPackTarget(user)
    setSelectedPackTypeId('')
    setPackPriceOverride('')
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

    const { error } = await supabase.from('pack_purchases').insert({
      user_id: packTarget.id,
      pack_type_id: packType.id,
      price_paid_cents: priceCents,
      credits_remaining: packType.credit_count,
      purchased_at: now.toISOString(),
      expires_at: expiresAt.toISOString(),
    })

    setPackSaving(false)
    if (error) { toast.error(error.message); return }

    await supabase.from('notifications').insert({
      user_id: packTarget.id,
      title: i18n.language === 'fr' ? 'Pack attribué' : 'Pack assigned',
      message: i18n.language === 'fr'
        ? `Le pack "${packType.name}" (${packType.credit_count} crédits) vous a été attribué. Valide jusqu'au ${format(expiresAt, 'dd/MM/yyyy')}.`
        : `The pack "${packType.name}" (${packType.credit_count} credits) has been assigned to you. Valid until ${format(expiresAt, 'dd/MM/yyyy')}.`,
      type: 'success',
      link: '/my-packs',
    })

    // Log activity
    await logActivity({
      action: 'pack_assigned',
      actor_id: currentUser?.id ?? null,
      target_user_id: packTarget.id,
      entity_type: 'pack_purchase',
      details: {
        pack_name: packType.name,
        credits: packType.credit_count,
        price_paid_cents: priceCents,
        expires_at: expiresAt.toISOString(),
      },
      description: `Pack "${packType.name}" (${packType.credit_count} crédits, ${(priceCents / 100).toFixed(0)}€) attribué à ${packTarget.display_name}`,
    })

    // Update local credits count
    setUsers(prev => prev.map(u =>
      u.id === packTarget.id ? { ...u, credits: u.credits + packType.credit_count } : u
    ))

    toast.success(t('admin.users.packAssigned'))
    setPackDialogOpen(false)
  }

  if (loading) return <LoadingState />

  const filteredUsers = users.filter(u => {
    if (roleFilter !== 'all' && u.role !== roleFilter) return false
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

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-2xl font-bold">{t('admin.users.title')}</h1>
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

      {/* Search + Role filter */}
      <div className="flex items-center gap-3 flex-wrap">
        <Input
          type="text"
          placeholder={isFr ? 'Rechercher nom, prénom, email...' : 'Search name, email...'}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-64 h-8 text-sm"
        />
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        {(['client', 'coach', 'admin', 'all'] as const).map((role) => (
          <Button
            key={role}
            variant={roleFilter === role ? 'default' : 'outline'}
            size="sm"
            onClick={() => setRoleFilter(role)}
            className="text-xs"
          >
            {role === 'all' ? t('common.all') : t(`roles.${role}`)}
            <Badge variant="secondary" className="ml-1.5 h-5 px-1.5 text-[10px]">
              {role === 'all' ? users.length : users.filter(u => u.role === role).length}
            </Badge>
          </Button>
        ))}
      </div>

      {filteredUsers.length === 0 ? (
        <EmptyState icon={Users} message={t('common.noResults')} />
      ) : (
        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('admin.users.name')}</TableHead>
                <TableHead>{t('admin.users.role')}</TableHead>
                <TableHead className="text-center">
                  <span className="flex items-center gap-1 justify-center">
                    <CreditCard className="h-3 w-3" />
                    {isFr ? 'Crédits' : 'Credits'}
                  </span>
                </TableHead>
                <TableHead>{t('admin.users.lastLogin')}</TableHead>
                <TableHead>{t('admin.users.actions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredUsers.map((user) => (
                <TableRow key={user.id} className="group">
                  <TableCell>
                    <button
                      className="font-medium text-left hover:text-primary hover:underline transition-colors flex items-center gap-1"
                      onClick={() => navigate(`/admin/users/${user.id}`)}
                    >
                      {user.display_name}
                      <ChevronRight className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </button>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-[11px]">
                      {t(`roles.${user.role}`)}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge
                      variant={user.credits > 0 ? 'default' : 'secondary'}
                      className="text-xs"
                    >
                      {user.credits}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
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
                        ? `${selectedPack.name} — ${selectedPack.credit_count} crédits`
                        : t('admin.users.selectPack')}
                    </span>
                  </SelectTrigger>
                  <SelectContent>
                    {packTypes.map(pt => (
                      <SelectItem key={pt.id} value={pt.id}>
                        {pt.name} — {pt.credit_count} crédits — {(pt.price_cents / 100).toFixed(0)}€
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
                    <Badge variant="outline">{selectedPack.credit_count} crédits</Badge>
                    <Badge variant="outline">{selectedPack.validity_days}j</Badge>
                  </div>

                  <div className="space-y-2">
                    <Label>{t('admin.packTypes.price')} (€)</Label>
                    <Input
                      type="number"
                      min={0}
                      placeholder={(selectedPack.price_cents / 100).toFixed(0)}
                      value={packPriceOverride}
                      onChange={(e) => setPackPriceOverride(e.target.value)}
                    />
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="text-xs"
                        onClick={() => setPackPriceOverride('0')}
                      >
                        <Gift className="h-3 w-3 mr-1" />
                        {t('admin.users.freeGift')}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="text-xs"
                        onClick={() => setPackPriceOverride((selectedPack.price_cents / 100).toFixed(0))}
                      >
                        {t('admin.users.manualPayment')} ({(selectedPack.price_cents / 100).toFixed(0)}€)
                      </Button>
                    </div>
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
    </div>
  )
}

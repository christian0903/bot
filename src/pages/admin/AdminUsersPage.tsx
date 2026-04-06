import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { supabase } from '@/lib/supabase'
import type { Profile, UserRole, PackType } from '@/types'
import { LoadingState } from '@/components/common/LoadingState'
import { EmptyState } from '@/components/common/EmptyState'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { Download, Trash2, Users, Gift, ChevronRight } from 'lucide-react'
import { format, addDays } from 'date-fns'
import { fr, enUS } from 'date-fns/locale'

interface UserWithRole extends Profile {
  role: UserRole
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
  const navigate = useNavigate()
  const locale = i18n.language === 'fr' ? fr : enUS
  const [users, setUsers] = useState<UserWithRole[]>([])
  const [loading, setLoading] = useState(true)
  const [deleteTarget, setDeleteTarget] = useState<UserWithRole | null>(null)

  // Assign pack state
  const [packDialogOpen, setPackDialogOpen] = useState(false)
  const [packTarget, setPackTarget] = useState<UserWithRole | null>(null)
  const [packTypes, setPackTypes] = useState<PackType[]>([])
  const [selectedPackTypeId, setSelectedPackTypeId] = useState('')
  const [packPriceOverride, setPackPriceOverride] = useState('')
  const [packSaving, setPackSaving] = useState(false)

  const fetchUsers = async () => {
    const { data: profiles } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false })

    const { data: roles } = await supabase
      .from('user_roles')
      .select('user_id, role')

    const roleMap = new Map((roles ?? []).map((r: { user_id: string; role: UserRole }) => [r.user_id, r.role]))
    const merged: UserWithRole[] = (profiles ?? []).map((p: Profile) => ({
      ...p,
      role: roleMap.get(p.id) ?? 'client',
    }))
    setUsers(merged)
    setLoading(false)
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

  const handleRoleChange = async (userId: string, newRole: UserRole) => {
    const { error } = await supabase
      .from('user_roles')
      .upsert({ user_id: userId, role: newRole }, { onConflict: 'user_id' })

    if (error) {
      toast.error(t('common.error'))
      return
    }

    setUsers(prev => prev.map(u => u.id === userId ? { ...u, role: newRole } : u))
    toast.success(t('common.saveSuccess'))
  }

  const handleDelete = async () => {
    if (!deleteTarget) return

    const { error } = await supabase
      .from('profiles')
      .delete()
      .eq('id', deleteTarget.id)

    if (error) {
      toast.error(t('common.error'))
      return
    }

    setUsers(prev => prev.filter(u => u.id !== deleteTarget.id))
    toast.success(t('common.deleteSuccess'))
    setDeleteTarget(null)
  }

  const handleExport = () => {
    const data = users.map(u => ({
      name: u.display_name,
      email: u.email ?? '',
      role: u.role,
      joined: u.created_at,
      lastLogin: u.last_sign_in_at ?? '',
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

    if (error) {
      toast.error(error.message)
      return
    }

    // Send notification to user
    await supabase.from('notifications').insert({
      user_id: packTarget.id,
      title: i18n.language === 'fr' ? 'Pack attribué' : 'Pack assigned',
      message: i18n.language === 'fr'
        ? `Le pack "${packType.name}" (${packType.credit_count} crédits) vous a été attribué. Valide jusqu'au ${format(expiresAt, 'dd/MM/yyyy')}.`
        : `The pack "${packType.name}" (${packType.credit_count} credits) has been assigned to you. Valid until ${format(expiresAt, 'dd/MM/yyyy')}.`,
      type: 'success',
      link: '/my-packs',
    })

    toast.success(t('admin.users.packAssigned'))
    setPackDialogOpen(false)
  }

  if (loading) return <LoadingState />

  const selectedPack = packTypes.find(p => p.id === selectedPackTypeId)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t('admin.users.title')}</h1>
        <Button variant="outline" onClick={handleExport}>
          <Download className="h-4 w-4 mr-2" />
          {t('admin.users.exportCsv')}
        </Button>
      </div>

      {users.length === 0 ? (
        <EmptyState icon={Users} message={t('common.noResults')} />
      ) : (
        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('admin.users.name')}</TableHead>
                <TableHead>{t('admin.users.email')}</TableHead>
                <TableHead>{t('admin.users.role')}</TableHead>
                <TableHead>{t('admin.users.joined')}</TableHead>
                <TableHead>{t('admin.users.lastLogin')}</TableHead>
                <TableHead>{t('admin.users.actions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((user) => (
                <TableRow key={user.id}>
                  <TableCell>
                    <button
                      className="font-medium text-left hover:text-primary hover:underline transition-colors flex items-center gap-1"
                      onClick={() => navigate(`/admin/users/${user.id}`)}
                    >
                      {user.display_name}
                      <ChevronRight className="h-3 w-3 opacity-0 group-hover:opacity-100" />
                    </button>
                  </TableCell>
                  <TableCell>{user.email}</TableCell>
                  <TableCell>
                    <Select
                      value={user.role}
                      onValueChange={(val) => handleRoleChange(user.id, (val ?? 'client') as UserRole)}
                    >
                      <SelectTrigger className="w-[140px]">
                        <span>{t(`roles.${user.role}`)}</span>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="client">{t('roles.client')}</SelectItem>
                        <SelectItem value="coach">{t('roles.coach')}</SelectItem>
                        <SelectItem value="admin">{t('roles.admin')}</SelectItem>
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    {format(new Date(user.created_at), 'dd/MM/yyyy', { locale })}
                  </TableCell>
                  <TableCell>
                    {user.last_sign_in_at
                      ? format(new Date(user.last_sign_in_at), 'dd/MM/yyyy HH:mm', { locale })
                      : '-'}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        title={t('admin.users.assignPack')}
                        onClick={() => openAssignPack(user)}
                      >
                        <Gift className="h-4 w-4 text-primary" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
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
              {/* User info */}
              <div className="p-3 rounded-lg bg-muted/50">
                <p className="font-medium">{packTarget.display_name}</p>
                <p className="text-sm text-muted-foreground">{packTarget.email}</p>
              </div>

              {/* Pack selection */}
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

              {/* Pack details */}
              {selectedPack && (
                <div className="space-y-3">
                  <div className="flex gap-2 flex-wrap">
                    <Badge variant="outline">
                      {i18n.language === 'fr' ? selectedPack.credit_type?.label_fr : selectedPack.credit_type?.label_en}
                    </Badge>
                    <Badge variant="outline">
                      {selectedPack.credit_count} crédits
                    </Badge>
                    <Badge variant="outline">
                      {selectedPack.validity_days}j
                    </Badge>
                  </div>

                  {/* Price override */}
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
            <Button
              onClick={handleAssignPack}
              disabled={!selectedPackTypeId || packSaving}
            >
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

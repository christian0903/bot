import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { supabase } from '@/lib/supabase'
import type { Profile, UserRole } from '@/types'
import { LoadingState } from '@/components/common/LoadingState'
import { EmptyState } from '@/components/common/EmptyState'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import { Button } from '@/components/ui/button'
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

import { toast } from 'sonner'
import { Download, Trash2, Users } from 'lucide-react'
import { format } from 'date-fns'
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
  const locale = i18n.language === 'fr' ? fr : enUS
  const [users, setUsers] = useState<UserWithRole[]>([])
  const [loading, setLoading] = useState(true)
  const [deleteTarget, setDeleteTarget] = useState<UserWithRole | null>(null)

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

  if (loading) return <LoadingState />

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
                  <TableCell className="font-medium">{user.display_name}</TableCell>
                  <TableCell>{user.email}</TableCell>
                  <TableCell>
                    <Select
                      value={user.role}
                      onValueChange={(val) => handleRoleChange(user.id, val as UserRole)}
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
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setDeleteTarget(user)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

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

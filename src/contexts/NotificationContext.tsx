import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from './AuthContext'
import type { Notification } from '@/types'

interface NotificationContextType {
  notifications: Notification[]
  unreadCount: number
  markAsRead: (id: string) => Promise<void>
  markAllAsRead: () => Promise<void>
  /** Retire une communication de l'écran du membre. La ligne est conservée. */
  dismiss: (id: string) => Promise<void>
  /** Retire toutes les communications déjà lues. Les non lues restent. */
  dismissRead: () => Promise<void>
  loading: boolean
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined)

export function NotificationProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(false)

  const fetchNotifications = useCallback(async () => {
    if (!user) return
    setLoading(true)
    // Les communications écartées ne reviennent pas : le membre les a retirées
    // de son écran. Elles restent en base comme preuve de transmission.
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', user.id)
      .is('dismissed_at', null)
      .order('created_at', { ascending: false })
      .limit(50)
    setNotifications((data as Notification[]) ?? [])
    setLoading(false)
  }, [user])

  useEffect(() => {
    fetchNotifications()

    if (!user) return

    const channel = supabase
      .channel('notifications')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          setNotifications((prev) => [payload.new as Notification, ...prev])
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [user, fetchNotifications])

  const unreadCount = notifications.filter((n) => !n.is_read).length

  const markAsRead = async (id: string) => {
    await supabase.from('notifications').update({ is_read: true }).eq('id', id)
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
    )
  }

  const markAllAsRead = async () => {
    if (!user) return
    await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('user_id', user.id)
      .eq('is_read', false)
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })))
  }

  const dismiss = async (id: string) => {
    // Retiré de l'écran tout de suite : attendre le serveur donnerait
    // l'impression que le bouton ne répond pas.
    setNotifications((prev) => prev.filter((n) => n.id !== id))
    const { error } = await supabase
      .from('notifications')
      .update({ dismissed_at: new Date().toISOString(), is_read: true })
      .eq('id', id)
    // Le refus serveur est silencieux côté Supabase : sans ce contrôle, la
    // communication réapparaîtrait au prochain chargement sans explication.
    if (error) {
      console.error('[notifications] dismiss', error)
      fetchNotifications()
    }
  }

  const dismissRead = async () => {
    const { error } = await supabase.rpc('dismiss_read_notifications')
    if (error) {
      console.error('[notifications] dismissRead', error)
      return
    }
    setNotifications((prev) => prev.filter((n) => !n.is_read))
  }

  return (
    <NotificationContext.Provider
      value={{ notifications, unreadCount, markAsRead, markAllAsRead, dismiss, dismissRead, loading }}
    >
      {children}
    </NotificationContext.Provider>
  )
}

export function useNotifications() {
  const context = useContext(NotificationContext)
  if (!context) {
    throw new Error('useNotifications must be used within a NotificationProvider')
  }
  return context
}

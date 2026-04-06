import { Bell } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { useNotifications } from '@/contexts/NotificationContext'

export function NotificationBell() {
  const { unreadCount } = useNotifications()
  const navigate = useNavigate()

  return (
    <Button variant="ghost" size="icon" className="relative" onClick={() => navigate('/notifications')}>
      <Bell className="h-5 w-5" />
      {unreadCount > 0 && (
        <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground">
          {unreadCount > 9 ? '9+' : unreadCount}
        </span>
      )}
    </Button>
  )
}

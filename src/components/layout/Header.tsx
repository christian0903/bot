import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '@/contexts/AuthContext'
import { LanguageSwitcher } from '@/components/common/LanguageSwitcher'
import { ThemeSwitcher } from '@/components/common/ThemeSwitcher'
import { NotificationBell } from '@/components/common/NotificationBell'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet'
import { Menu, User, LogOut, Settings, Shield, Dumbbell } from 'lucide-react'

export function Header() {
  const { t } = useTranslation()
  const { user, profile, hasRole, signOut } = useAuth()
  const navigate = useNavigate()
  const [mobileOpen, setMobileOpen] = useState(false)

  const handleLogout = async () => {
    await signOut()
    navigate('/')
  }

  const navItems = [
    { label: t('nav.home'), path: '/', show: true },
    { label: t('nav.schedule'), path: '/schedule', show: !!user },
    { label: t('nav.myBookings'), path: '/my-bookings', show: !!user },
    { label: t('nav.myPacks'), path: '/my-packs', show: !!user },
    { label: t('nav.packs'), path: '/packs', show: !!user },
    { label: t('nav.coach'), path: '/coach/my-classes', show: hasRole('coach') },
    { label: t('nav.admin'), path: '/admin/users', show: hasRole('admin') },
  ].filter((item) => item.show)

  const NavLinks = ({ onClick }: { onClick?: () => void }) => (
    <>
      {navItems.map((item) => (
        <Link
          key={item.path}
          to={item.path}
          onClick={onClick}
          className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
        >
          {item.label}
        </Link>
      ))}
    </>
  )

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-14 items-center px-4 mx-auto max-w-7xl">
        <Link to="/" className="flex items-center gap-2 mr-6">
          <Dumbbell className="h-6 w-6 text-primary" />
          <span className="font-bold text-lg hidden sm:inline">{t('app.name')}</span>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-6 flex-1">
          <NavLinks />
        </nav>

        <div className="flex items-center gap-1 ml-auto">
          <LanguageSwitcher />
          <ThemeSwitcher />

          {user ? (
            <>
              <NotificationBell />
              <DropdownMenu>
                <DropdownMenuTrigger className="inline-flex items-center justify-center rounded-full h-9 w-9">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={profile?.avatar_url ?? undefined} />
                    <AvatarFallback>
                      {profile?.display_name?.charAt(0).toUpperCase() ?? 'U'}
                    </AvatarFallback>
                  </Avatar>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuItem onClick={() => navigate('/profile')}>
                    <User className="mr-2 h-4 w-4" />
                    {t('nav.profile')}
                  </DropdownMenuItem>
                  {hasRole('admin') && (
                    <DropdownMenuItem onClick={() => navigate('/admin/settings')}>
                      <Settings className="mr-2 h-4 w-4" />
                      {t('admin.settings.title')}
                    </DropdownMenuItem>
                  )}
                  {hasRole('admin') && (
                    <DropdownMenuItem onClick={() => navigate('/admin/users')}>
                      <Shield className="mr-2 h-4 w-4" />
                      {t('nav.admin')}
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleLogout}>
                    <LogOut className="mr-2 h-4 w-4" />
                    {t('nav.logout')}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          ) : (
            <Button variant="default" size="sm" onClick={() => navigate('/auth')}>
              {t('nav.login')}
            </Button>
          )}

          {/* Mobile menu */}
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger className="inline-flex items-center justify-center rounded-md h-9 w-9 hover:bg-accent md:hidden">
              <Menu className="h-5 w-5" />
            </SheetTrigger>
            <SheetContent side="left" className="w-64">
              <div className="flex flex-col gap-4 mt-8">
                <NavLinks onClick={() => setMobileOpen(false)} />
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  )
}

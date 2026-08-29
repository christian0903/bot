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
import { Badge } from '@/components/ui/badge'
import { User, LogOut, Settings, Shield, Gift, CreditCard, ShoppingBag, FileText, BarChart3 } from 'lucide-react'
import { useMode } from '@/contexts/ModeContext'
import { ModeSwitcher } from '@/components/layout/ModeSwitcher'
import { urlImage } from '@/lib/url-image'
import { estHorsProduction } from '@/lib/base-en-service'
import { Logo } from '@/components/common/Logo'

/** Injectée au build depuis package.json (cf. vite.config.ts). */
declare const __APP_VERSION__: string

const ROLE_COLORS: Record<string, string> = {
  super_admin: 'bg-red-500/15 text-red-600 border-red-500/30',
  admin: 'bg-purple-500/15 text-purple-600 border-purple-500/30',
  coach: 'bg-blue-500/15 text-blue-600 border-blue-500/30',
  client: 'bg-gray-500/15 text-gray-600 border-gray-500/30',
}

export function Header() {
  const { t } = useTranslation()
  const { user, profile, roles, hasRole, signOut } = useAuth()
  const primaryRole = roles.includes('super_admin') ? 'super_admin' : roles.includes('admin') ? 'admin' : roles.includes('coach') ? 'coach' : 'client'
  const navigate = useNavigate()

  const handleLogout = async () => {
    // Quitter la page protégée AVANT de fermer la session : sinon AuthGuard et
    // RoleGuard se déclenchent sur l'écran courant et mémorisent un `from`,
    // qui renverrait ensuite vers l'espace client à la reconnexion.
    navigate('/', { replace: true })
    await signOut()
  }

  /**
   * Le staff ne s'entraîne pas au studio : ni pack, ni réservation, ni
   * performance à suivre. Les écrans personnels n'ont donc rien à faire dans sa
   * barre — ils l'encombrent avec des fonctions qu'il n'ouvrira jamais.
   *
   * Le planning fait exception : c'est l'outil de travail du staff, et lui seul
   * y voit les cours à surveiller et les décisions en attente.
   *
   * Les routes, elles, restent ouvertes. Masquer un lien range un menu, ça ne
   * protège rien — et un membre qui deviendrait coach garde l'accès à son
   * historique par une URL directe.
   */
  const isStaff = hasRole('coach') || hasRole('admin')
  const { mode } = useMode()

  /**
   * Le menu suit le **mode choisi**, plus le rôle.
   *
   * Les écrans membre étaient masqués à tout le staff (`!isStaff`) : un gérant
   * n'atteignait donc ni ses réservations, ni ses packs, ni la boutique, alors
   * qu'il s'entraîne au studio comme les autres. Il les retrouve en mode
   * Membre, et ne les voit plus encombrer son menu en mode Admin.
   */
  const enMembre = mode === 'membre'

  const navItems = [
    // Connecté, l'accueil est le tableau de bord : la racine renvoie un membre
    // du staff vers son espace d'administration, annulant le mode choisi.
    { label: t('nav.home'), path: user ? '/dashboard' : '/', show: true },
    { label: t('nav.schedule'), path: '/schedule', show: !!user },
    { label: t('nav.myBookings'), path: '/my-bookings', show: !!user && enMembre },
    // Même ordre que la barre du bas (accueil | planning | mes cours | mes
    // performances) : deux navigations qui se contredisent obligent à chercher.
    { label: t('nav.performances'), path: '/performances', show: !!user && enMembre },
    // Les performances mesurent chaque seance, les statistiques racontent
    // l'assiduite sur la duree. Voisines a l'ecran parce qu'on passe de l'une
    // a l'autre — la page existait sans qu'aucun lien n'y mene.
    { label: t('nav.stats'), path: '/stats', show: !!user && enMembre },
    { label: t('nav.myPacks'), path: '/my-packs', show: !!user && enMembre },
    { label: t('nav.packs'), path: '/packs', show: !!user && enMembre },
    // L'admin y a droit — la route accepte déjà `['coach', 'admin']`. Sans ce
    // `hasRole('admin')`, un admin qui donne des cours devait taper l'URL à la
    // main pour atteindre un écran qui lui était pourtant ouvert.
    { label: t('nav.coach'), path: '/coach/my-classes', show: isStaff && mode === 'coach' },
    { label: t('nav.coachMembers'), path: '/coach/members', show: isStaff && mode === 'coach' },
    { label: t('nav.admin'), path: '/admin/users', show: hasRole('admin') && mode === 'admin' },
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
    <header
      className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60"
      style={{ paddingTop: 'env(safe-area-inset-top)' }}
    >
      <div className="container flex h-14 items-center px-4 mx-auto max-w-7xl">
        <Link to="/" className="flex items-center gap-2 mr-6">
          <Logo />
          <span className="font-bold text-lg hidden sm:inline">{t('app.name')}</span>
          {/* Visible sur toutes les pages, sans défiler : c'est le premier
              renseignement à demander à un testeur qui signale un problème, et
              le pied de page est hors de vue sur téléphone. Reste affiché sous
              640px, où le nom du studio disparaît.

              Le suffixe `-dev` ne s'affiche qu'en développement. La
              production reste silencieuse : un membre n'a que faire de savoir
              sur quelle base il est, et un marquage permanent finit par ne
              plus être lu — c'est déjà le parti pris du bandeau.

              Le pied de page, lui, nomme les deux cas : on va l'y chercher
              quand on doute, il n'a pas à être discret. */}
          <span className="text-[11px] font-normal text-muted-foreground tabular-nums">
            v{__APP_VERSION__}
            {estHorsProduction && (
              <span className="ml-0.5 font-semibold text-amber-600 dark:text-amber-500">
                -dev
              </span>
            )}
          </span>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-6 flex-1">
          <NavLinks />
        </nav>

        <div className="flex items-center gap-1 ml-auto">
          {/* Avant les réglages de langue et de thème : c'est le choix qui
              change le plus l'écran, il mérite la place la plus visible. */}
          <ModeSwitcher className="mr-1" />
          <LanguageSwitcher />
          <ThemeSwitcher />

          {user ? (
            <>
              <NotificationBell />
              <DropdownMenu>
                <DropdownMenuTrigger className="inline-flex items-center justify-center rounded-full h-9 w-9">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={urlImage(profile?.avatar_url)} />
                    <AvatarFallback>
                      {profile?.display_name?.charAt(0).toUpperCase() ?? 'U'}
                    </AvatarFallback>
                  </Avatar>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-52">
                  <div className="px-2 py-1.5 mb-1">
                    <p className="text-sm font-medium truncate">{profile?.display_name}</p>
                    <Badge variant="outline" className={`text-[10px] mt-1 ${ROLE_COLORS[primaryRole] || ''}`}>
                      {t(`roles.${primaryRole}`)}
                    </Badge>
                  </div>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => navigate('/profile')}>
                    <User className="mr-2 h-4 w-4" />
                    {t('nav.profile')}
                  </DropdownMenuItem>
                  {/* Sur mobile, ce menu est la seule voie vers ces pages : la
                      barre du bas ne tient que quatre entrées, et le tiroir
                      hamburger a été retiré. « Acheter un pack » en fait partie
                      — sans elle, un membre sur iPhone ne pourrait plus
                      acheter. */}
                  {enMembre && (
                    <>
                      <DropdownMenuItem onClick={() => navigate('/my-packs')}>
                        <CreditCard className="mr-2 h-4 w-4" />
                        {t('nav.myPacks')}
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => navigate('/packs')}>
                        <ShoppingBag className="mr-2 h-4 w-4" />
                        {t('nav.packs')}
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => navigate('/stats')}>
                        <BarChart3 className="mr-2 h-4 w-4" />
                        {t('nav.stats')}
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => navigate('/invoice-request')}>
                        <FileText className="mr-2 h-4 w-4" />
                        {t('nav.myInvoices')}
                      </DropdownMenuItem>
                    </>
                  )}
                  <DropdownMenuItem onClick={() => navigate('/referral')}>
                    <Gift className="mr-2 h-4 w-4" />
                    {t('admin.referrals.title')}
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

        </div>
      </div>
    </header>
  )
}

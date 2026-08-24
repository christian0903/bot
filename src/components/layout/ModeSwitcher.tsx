import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { User, Dumbbell, Shield } from 'lucide-react'
import { useMode, type ModeApp } from '@/contexts/ModeContext'
import { cn } from '@/lib/utils'

/**
 * Bascule Membre / Coach / Admin.
 *
 * N'apparaît que pour un compte qui porte plusieurs casquettes : un membre
 * simple n'a rien à choisir, et un sélecteur à une seule entrée n'est qu'un
 * élément de plus à comprendre.
 */

/** Écran d'arrivée de chaque mode : celui qu'on ouvre en premier. */
const ACCUEIL: Record<ModeApp, string> = {
  membre: '/',
  coach: '/coach/my-classes',
  admin: '/admin/dashboard',
}

const ICONES: Record<ModeApp, typeof User> = {
  membre: User,
  coach: Dumbbell,
  admin: Shield,
}

export function ModeSwitcher({ className }: { className?: string }) {
  const { mode, setMode, modesDisponibles } = useMode()
  const { i18n } = useTranslation()
  const navigate = useNavigate()
  const isFr = i18n.language === 'fr'

  if (modesDisponibles.length < 2) return null

  const libelles: Record<ModeApp, string> = {
    membre: isFr ? 'Membre' : 'Member',
    coach: isFr ? 'Coach' : 'Coach',
    admin: isFr ? 'Admin' : 'Admin',
  }

  return (
    <div className={cn('flex rounded-lg border overflow-hidden shrink-0', className)}>
      {modesDisponibles.map(m => {
        const Icone = ICONES[m]
        return (
          <button
            key={m}
            type="button"
            onClick={() => {
              setMode(m)
              // Changer de mode sans bouger laisserait l'écran précédent
              // affiché sous une navigation qui ne lui correspond plus.
              navigate(ACCUEIL[m])
            }}
            title={libelles[m]}
            className={cn(
              'flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium transition-colors',
              mode === m ? 'bg-primary text-primary-foreground' : 'hover:bg-muted',
            )}
          >
            <Icone className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">{libelles[m]}</span>
          </button>
        )
      })}
    </div>
  )
}

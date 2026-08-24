import { createContext, useContext, useMemo, useState, type ReactNode } from 'react'
import { useLocation } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'

/**
 * Mode d'utilisation de l'application.
 *
 * Un même compte porte plusieurs casquettes : le gérant est admin, mais il
 * s'entraîne aussi et achète des packs. Le code masquait jusqu'ici tous les
 * écrans membre au staff (`show: !!user && !isStaff`) — un admin n'avait donc
 * plus aucun accès à ses réservations, ses packs ou la boutique, sur aucun
 * support. Sur téléphone, où la barre du bas est la seule navigation, la
 * fonction devenait introuvable.
 *
 * Le mode ne donne aucun droit : il choisit ce qu'on affiche. Les autorisations
 * restent portées par `RoleGuard` et par les policies RLS — basculer en mode
 * Admin sans le rôle ne mène nulle part.
 */
export type ModeApp = 'membre' | 'coach' | 'admin'

interface ModeContextValue {
  mode: ModeApp
  setMode: (m: ModeApp) => void
  /** Modes réellement ouverts à ce compte, dans l'ordre d'affichage. */
  modesDisponibles: ModeApp[]
}

const ModeContext = createContext<ModeContextValue | undefined>(undefined)

const CLE_STOCKAGE = 'bot.mode'

/** Le mode déduit de l'URL, quand celle-ci ne laisse pas de doute. */
function modeDuChemin(pathname: string): ModeApp | null {
  if (pathname.startsWith('/admin')) return 'admin'
  if (pathname.startsWith('/coach')) return 'coach'
  return null
}

export function ModeProvider({ children }: { children: ReactNode }) {
  const { user, hasRole } = useAuth()
  const { pathname } = useLocation()

  const modesDisponibles = useMemo<ModeApp[]>(() => {
    if (!user) return ['membre']
    const modes: ModeApp[] = ['membre']
    // Un admin peut donner des cours : il garde le mode coach.
    if (hasRole('coach') || hasRole('admin')) modes.push('coach')
    if (hasRole('admin')) modes.push('admin')
    return modes
  }, [user, hasRole])

  const [modeChoisi, setModeChoisi] = useState<ModeApp>(() => {
    // Le mode survit à un rechargement : un gérant qui passe sa journée dans
    // l'administration ne veut pas repartir en membre à chaque ouverture.
    if (typeof window === 'undefined') return 'membre'
    try {
      const stocke = window.localStorage.getItem(CLE_STOCKAGE)
      if (stocke === 'membre' || stocke === 'coach' || stocke === 'admin') return stocke
    } catch {
      // Navigation privée, stockage refusé : le défaut fait l'affaire.
    }
    return 'membre'
  })

  /**
   * Le mode effectif se **dérive** plutôt qu'il ne se corrige dans un effet :
   * un `setState` en effet déclenche un second rendu, et l'écran afficherait
   * brièvement une navigation périmée.
   *
   * Deux corrections s'appliquent au mode stocké :
   *  - l'URL fait foi quand elle est explicite (`/admin`, `/coach`) — ouvrir un
   *    lien direct doit basculer l'affichage, sinon la barre du bas proposerait
   *    la navigation membre par-dessus un écran d'administration ;
   *  - un mode devenu interdit retombe sur le premier disponible : le rôle a pu
   *    être retiré entre deux sessions, et chaque entrée mènerait à un refus.
   */
  const mode = useMemo<ModeApp>(() => {
    const deduit = modeDuChemin(pathname)
    if (deduit && modesDisponibles.includes(deduit)) return deduit
    if (modesDisponibles.includes(modeChoisi)) return modeChoisi
    return modesDisponibles[0]
  }, [pathname, modeChoisi, modesDisponibles])

  const setMode = (m: ModeApp) => {
    if (!modesDisponibles.includes(m)) return
    setModeChoisi(m)
    try {
      window.localStorage.setItem(CLE_STOCKAGE, m)
    } catch {
      // Sans stockage, le mode vaut pour la session en cours. Suffisant.
    }
  }

  return (
    <ModeContext.Provider value={{ mode, setMode, modesDisponibles }}>
      {children}
    </ModeContext.Provider>
  )
}

export function useMode() {
  const ctx = useContext(ModeContext)
  if (!ctx) throw new Error('useMode doit être utilisé dans un ModeProvider')
  return ctx
}

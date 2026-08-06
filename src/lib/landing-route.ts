import type { UserRole } from '@/types'

/**
 * Écran d'arrivée d'un membre selon son rôle.
 *
 * Un admin ou un coach n'a que faire du tableau de bord client (ses packs, ses
 * réservations) : il arrive dans son espace de travail.
 *
 * Cette fonction est la source unique de la règle. Elle était auparavant écrite
 * dans HomePage seulement, ce qui la rendait inopérante après une connexion :
 * AuthPage redirige vers /dashboard, donc HomePage n'était jamais traversée.
 */
export function landingRouteFor(roles: UserRole[]): string {
  if (roles.includes('admin') || roles.includes('super_admin')) {
    return '/admin/dashboard'
  }
  // Un coach SANS le rôle admin ne peut pas entrer dans /admin : son espace,
  // c'est la liste de ses cours.
  if (roles.includes('coach')) {
    return '/coach/my-classes'
  }
  return '/dashboard'
}

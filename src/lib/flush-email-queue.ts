import { supabase } from '@/lib/supabase'

/**
 * Déclenche l'envoi des e-mails en attente.
 *
 * La file est alimentée par des fonctions SQL, qui ne peuvent pas appeler une
 * Edge Function — le cas typique étant l'offre d'une place de liste d'attente,
 * valable deux heures seulement.
 *
 * Faute de `pg_cron` sur ce projet, c'est l'application qui déclenche : à
 * l'ouverture, et à chaque action susceptible d'alimenter la file (annulation,
 * modification d'un cours). Le staff ouvrant l'application plusieurs fois par
 * jour, la file ne stagne pas.
 *
 * Sans effet visible et sans blocage : l'appel n'est jamais attendu, et un
 * échec ne remonte pas à l'utilisateur — l'e-mail reste en file, il repartira
 * au déclenchement suivant.
 */
export function flushEmailQueue(): void {
  const url = import.meta.env.VITE_SUPABASE_URL
  const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY
  if (!url || !key) return

  supabase.auth.getSession().then(({ data: { session } }) => {
    // Réservé aux personnes connectées : inutile de solliciter le serveur
    // depuis une page publique.
    if (!session) return

    fetch(`${url}/functions/v1/process-email-queue`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
      },
    }).catch(() => {
      // Silencieux par conception : ce n'est pas l'affaire de l'utilisateur.
    })
  })
}

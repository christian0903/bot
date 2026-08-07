// ============================================================================
// process-email-queue
// ----------------------------------------------------------------------------
// Envoie les e-mails déposés dans `email_queue` par les fonctions SQL, qui ne
// peuvent pas appeler une Edge Function elles-mêmes.
//
// Le cas qui l'a motivée : `promote_from_waitlist` offre une place qui expire
// en DEUX HEURES. Sans e-mail, il fallait que le membre ouvre l'application par
// hasard dans ce créneau — sinon la place partait au suivant sans qu'il l'ait
// su.
//
// À appeler périodiquement (cron Supabase, toutes les minutes). Idempotente :
// une ligne déjà envoyée porte `sent_at` et n'est plus reprise.
// ============================================================================

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const admin = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
)

/** Au-delà, on cesse de réessayer : l'adresse est probablement invalide. */
const MAX_ATTEMPTS = 3

/** Traité par appel. Borne le temps d'exécution ; le reste part au tour suivant. */
const BATCH = 20

serve(async () => {
  const { data: pending, error } = await admin
    .from('email_queue')
    .select('id, user_id, template, vars, attempts')
    .is('sent_at', null)
    .lt('attempts', MAX_ATTEMPTS)
    .order('created_at', { ascending: true })
    .limit(BATCH)

  if (error) {
    console.error('process-email-queue: lecture', error)
    return new Response(JSON.stringify({ error: error.message }), { status: 500 })
  }

  if (!pending || pending.length === 0) {
    return new Response(JSON.stringify({ sent: 0 }), {
      headers: { 'Content-Type': 'application/json' },
    })
  }

  let sent = 0
  let failed = 0

  for (const row of pending) {
    try {
      const { data: prof } = await admin
        .from('profiles').select('email, display_name').eq('id', row.user_id).maybeSingle()

      // Sans adresse, rien à tenter : on clôt la ligne pour ne pas la reprendre
      // indéfiniment, en gardant la raison.
      if (!prof?.email) {
        await admin.from('email_queue').update({
          sent_at: new Date().toISOString(),
          last_error: 'adresse absente',
        }).eq('id', row.id)
        continue
      }

      const res = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/send-email`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          template: row.template,
          to: prof.email,
          vars: { user_name: prof.display_name ?? '', ...(row.vars ?? {}) },
        }),
      })

      if (res.ok) {
        await admin.from('email_queue')
          .update({ sent_at: new Date().toISOString(), attempts: row.attempts + 1 })
          .eq('id', row.id)
        sent++
      } else {
        const text = await res.text()
        await admin.from('email_queue')
          .update({ attempts: row.attempts + 1, last_error: text.slice(0, 500) })
          .eq('id', row.id)
        failed++
      }
    } catch (err) {
      // L'échec d'un e-mail ne doit pas empêcher les suivants : on trace et on
      // continue la boucle.
      await admin.from('email_queue')
        .update({ attempts: row.attempts + 1, last_error: String(err).slice(0, 500) })
        .eq('id', row.id)
      failed++
    }
  }

  return new Response(JSON.stringify({ sent, failed }), {
    headers: { 'Content-Type': 'application/json' },
  })
})

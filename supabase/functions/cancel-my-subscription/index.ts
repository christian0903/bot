// ============================================================================
// cancel-my-subscription
// ----------------------------------------------------------------------------
// Résiliation en libre-service, par le membre lui-même.
//
// Distincte de `manage-subscription`, réservée aux admins : ici l'appelant ne
// peut agir que sur SON propre abonnement, et sur cette seule action. Le
// subscription_id n'est même pas accepté en paramètre — il est retrouvé à
// partir du jeton d'authentification, pour qu'aucun identifiant fourni par le
// client ne puisse désigner l'abonnement d'un autre.
//
// Toujours en fin de période : le membre garde les droits qu'il a payés.
// Rien n'est écrit en base ici — le webhook reçoit
// customer.subscription.updated et met la table à jour.
// ============================================================================

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Stripe from 'https://esm.sh/stripe@14?target=deno'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return json({ error: 'Unauthorized' }, 401)

    const userClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    )

    const { data: { user }, error: authError } = await userClient.auth.getUser()
    if (authError || !user) return json({ error: 'Unauthorized' }, 401)

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    // L'abonnement est déduit de l'utilisateur authentifié, jamais du corps de
    // la requête : impossible de viser celui de quelqu'un d'autre.
    // `limit(1)` avant `maybeSingle()` : sans lui, un membre ayant plusieurs
    // abonnements (souscriptions successives, données de test) fait échouer la
    // requête, et l'erreur se présentait comme « aucun abonnement en cours ».
    const { data: sub, error: subError } = await admin
      .from('subscriptions')
      .select('*')
      .eq('user_id', user.id)
      .in('status', ['active', 'past_due', 'paused'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (subError) {
      console.error('Lecture de l\'abonnement', subError)
      return json({ error: 'Impossible de lire votre abonnement' }, 500)
    }
    if (!sub) return json({ error: 'Aucun abonnement en cours' }, 404)

    if (sub.cancel_at_period_end) {
      return json({ error: 'La résiliation est déjà programmée' }, 400)
    }

    const stripeKey = sub.stripe_mode === 'live'
      ? Deno.env.get('STRIPE_SECRET_KEY_LIVE')
      : Deno.env.get('STRIPE_SECRET_KEY_TEST')

    if (!stripeKey) {
      return json({ error: `Clé Stripe ${sub.stripe_mode} absente` }, 500)
    }

    const stripe = new Stripe(stripeKey, { apiVersion: '2023-10-16' })

    const updated = await stripe.subscriptions.update(sub.stripe_subscription_id, {
      cancel_at_period_end: true,
    })

    // Les API Stripe récentes portent la fin de période sur les items, pas sur
    // la racine de l'abonnement. On lit les deux, et on retombe sur la valeur
    // déjà connue en base si Stripe ne la donne pas.
    // deno-lint-ignore no-explicit-any
    const item = (updated.items?.data?.[0] ?? {}) as any
    // deno-lint-ignore no-explicit-any
    const rawEnd = item.current_period_end ?? (updated as any).current_period_end
    let endsAt: Date | null = null
    if (typeof rawEnd === 'number' && Number.isFinite(rawEnd)) {
      const d = new Date(rawEnd * 1000)
      if (!Number.isNaN(d.getTime())) endsAt = d
    }
    if (!endsAt && sub.current_period_end) {
      const d = new Date(sub.current_period_end)
      if (!Number.isNaN(d.getTime())) endsAt = d
    }

    // Trace pour le studio : une résiliation en libre-service doit se voir
    // sans avoir à consulter le dashboard Stripe.
    await admin.from('activity_log').insert({
      action: 'subscription_cancelled',
      actor_id: user.id,
      target_user_id: user.id,
      entity_type: 'subscription',
      entity_id: sub.id,
      details: { by_member: true, ends_at: endsAt?.toISOString() ?? null },
      description: `Résiliation demandée par le membre${endsAt ? `, effective le ${endsAt.toLocaleDateString('fr-BE')}` : ''}`,
    })

    return json({
      ok: true,
      ends_at: endsAt?.toISOString() ?? null,
      message: endsAt
        ? `Résiliation enregistrée. Vos droits sont conservés jusqu'au ${endsAt.toLocaleDateString('fr-BE')}.`
        : 'Résiliation enregistrée.',
    })
  } catch (err) {
    console.error('cancel-my-subscription', err)
    return json({ error: (err as Error).message }, 500)
  }
})

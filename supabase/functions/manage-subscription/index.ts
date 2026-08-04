// ============================================================================
// manage-subscription
// ----------------------------------------------------------------------------
// Actions d'administration sur un abonnement. Réservée aux admins : la clé
// secrète Stripe ne doit jamais se trouver dans le bundle React, et ces
// opérations engagent de l'argent.
//
// Actions :
//   discount   réduction ponctuelle sur la prochaine échéance seulement
//   postpone   décaler l'échéance (congés, blessure) — les cycles suivants
//              suivent la nouvelle date
//   pause      suspendre les prélèvements sans résilier
//   resume     reprendre après suspension
//   cancel     résilier (fin de période par défaut, ou immédiatement)
//
// Le webhook reçoit ensuite customer.subscription.updated et met la base à
// jour : on ne duplique pas l'écriture ici, sauf pour la trace des remises.
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

    // ---- Contrôle du rôle : admin uniquement ------------------------------
    const { data: roles } = await admin
      .from('user_roles').select('role').eq('user_id', user.id)
    const isAdmin = (roles ?? []).some(r => r.role === 'admin' || r.role === 'super_admin')
    if (!isAdmin) return json({ error: 'Réservé aux administrateurs' }, 403)

    const { action, subscription_id, amount_off_cents, percent_off, reason, new_date, immediately } =
      await req.json()

    if (!action || !subscription_id) {
      return json({ error: 'action et subscription_id sont requis' }, 400)
    }

    const { data: subRow } = await admin
      .from('subscriptions').select('*').eq('id', subscription_id).maybeSingle()
    if (!subRow) return json({ error: 'Abonnement introuvable' }, 404)

    // La clé doit correspondre au mode dans lequel l'abonnement a été créé :
    // un abonnement de test n'existe pas côté live.
    const stripeKey = subRow.stripe_mode === 'live'
      ? Deno.env.get('STRIPE_SECRET_KEY_LIVE')
      : Deno.env.get('STRIPE_SECRET_KEY_TEST')

    if (!stripeKey) {
      return json({ error: `Clé Stripe ${subRow.stripe_mode} absente` }, 500)
    }

    const stripe = new Stripe(stripeKey, { apiVersion: '2023-10-16' })
    const subId = subRow.stripe_subscription_id

    switch (action) {
      // ====================================================================
      // Réduction sur la PROCHAINE échéance uniquement.
      // `duration: 'once'` : Stripe retire le coupon tout seul après la
      // facture. Les échéances suivantes repartent au tarif plein, sans
      // aucune intervention.
      case 'discount': {
        if (!amount_off_cents && !percent_off) {
          return json({ error: 'Indiquez un montant ou un pourcentage' }, 400)
        }

        const coupon = await stripe.coupons.create({
          duration: 'once',
          ...(percent_off
            ? { percent_off: Number(percent_off) }
            : { amount_off: Number(amount_off_cents), currency: 'eur' }),
          name: reason ? String(reason).slice(0, 40) : 'Geste commercial',
        })

        await stripe.subscriptions.update(subId, {
          discounts: [{ coupon: coupon.id }],
        })

        await admin.from('subscription_discounts').insert({
          subscription_id: subRow.id,
          stripe_coupon_id: coupon.id,
          amount_off_cents: amount_off_cents ? Number(amount_off_cents) : null,
          percent_off: percent_off ? Number(percent_off) : null,
          reason: reason ?? null,
          applied_by: user.id,
        })

        return json({
          ok: true,
          message: 'Réduction appliquée à la prochaine échéance uniquement.',
        })
      }

      // ====================================================================
      // Décaler l'échéance : tous les cycles suivants suivent la nouvelle
      // date. `proration_behavior: 'none'` — l'intervalle offert n'est pas
      // facturé, c'est le geste attendu pour des congés ou une blessure.
      case 'postpone': {
        if (!new_date) return json({ error: 'new_date est requis' }, 400)

        const anchor = Math.floor(new Date(new_date).getTime() / 1000)
        if (anchor <= Math.floor(Date.now() / 1000)) {
          return json({ error: 'La nouvelle date doit être dans le futur' }, 400)
        }

        const updated = await stripe.subscriptions.update(subId, {
          trial_end: anchor,
          proration_behavior: 'none',
        })

        return json({
          ok: true,
          message: `Prochaine échéance décalée au ${new Date(updated.current_period_end * 1000).toLocaleDateString('fr-BE')}.`,
        })
      }

      // ====================================================================
      // Suspendre : les prélèvements s'arrêtent, l'abonnement reste en place.
      case 'pause': {
        await stripe.subscriptions.update(subId, {
          pause_collection: { behavior: 'void' },
        })
        return json({ ok: true, message: 'Abonnement suspendu. Aucun prélèvement jusqu\'à la reprise.' })
      }

      case 'resume': {
        await stripe.subscriptions.update(subId, { pause_collection: null })
        return json({ ok: true, message: 'Abonnement réactivé.' })
      }

      // ====================================================================
      // Résilier. Par défaut en fin de période : le membre garde ses droits
      // jusqu'au terme qu'il a payé.
      case 'cancel': {
        if (immediately) {
          await stripe.subscriptions.cancel(subId)
          return json({ ok: true, message: 'Abonnement résilié immédiatement.' })
        }
        const updated = await stripe.subscriptions.update(subId, {
          cancel_at_period_end: true,
        })
        return json({
          ok: true,
          message: `Résiliation programmée au ${new Date(updated.current_period_end * 1000).toLocaleDateString('fr-BE')}. Les droits sont conservés jusque-là.`,
        })
      }

      default:
        return json({ error: `Action inconnue : ${action}` }, 400)
    }
  } catch (err) {
    console.error('manage-subscription', err)
    return json({ error: (err as Error).message }, 500)
  }
})

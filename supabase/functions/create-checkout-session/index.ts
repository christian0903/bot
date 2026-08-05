// ============================================================================
// create-checkout-session
// ----------------------------------------------------------------------------
// Ouvre une session Stripe Checkout pour trois cas :
//   1. frais d'inscription   (type: 'registration_fee')  — paiement unique
//   2. pack ponctuel          (pack_type_id, pack non récurrent) — paiement unique
//   3. abonnement             (pack_type_id, pack récurrent) — mode subscription
//
// La clé secrète Stripe ne quitte JAMAIS cette fonction : le front reçoit
// uniquement l'URL de paiement.
//
// Rien n'est écrit en base ici. C'est le webhook, et lui seul, qui crédite
// après confirmation de paiement par Stripe — sinon un utilisateur pourrait
// obtenir des crédits en fermant la page avant de payer.
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
    // ---- Identification de l'appelant ------------------------------------
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } },
    )

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser()
    if (authError || !user) return json({ error: 'Unauthorized' }, 401)

    const { type, pack_type_id, coupon_code, success_url, cancel_url } = await req.json()

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    // ---- Mode et clé Stripe ----------------------------------------------
    const { data: modeSetting } = await admin
      .from('app_settings').select('value').eq('key', 'stripe_mode').maybeSingle()

    const isLive = (modeSetting?.value as { mode?: string } | null)?.mode === 'live'
    const stripeKey = isLive
      ? Deno.env.get('STRIPE_SECRET_KEY_LIVE')
      : Deno.env.get('STRIPE_SECRET_KEY_TEST')

    if (!stripeKey) {
      return json({
        error: `Clé Stripe ${isLive ? 'live' : 'test'} absente. À poser avec : supabase secrets set STRIPE_SECRET_KEY_${isLive ? 'LIVE' : 'TEST'}=sk_...`,
      }, 500)
    }

    const stripe = new Stripe(stripeKey, { apiVersion: '2023-10-16' })
    const origin = req.headers.get('origin') ?? ''

    // ========================================================================
    // CAS 1 — Frais d'inscription
    // ========================================================================
    if (type === 'registration_fee') {
      const { data: already } = await admin
        .from('registration_fees').select('id').eq('user_id', user.id).limit(1)
      if (already && already.length > 0) {
        return json({ error: 'Frais d\'inscription déjà payés' }, 400)
      }

      const { data: feeSetting } = await admin
        .from('app_settings').select('value').eq('key', 'registration_fee').maybeSingle()
      const fee = feeSetting?.value as { amount_cents?: number; enabled?: boolean } | null

      if (fee?.enabled === false) {
        return json({ error: 'Les frais d\'inscription sont désactivés' }, 400)
      }
      const amountCents = fee?.amount_cents ?? 3000

      const session = await stripe.checkout.sessions.create({
        mode: 'payment',
        payment_method_types: ['card'],
        line_items: [{
          price_data: {
            currency: 'eur',
            product_data: { name: 'Frais d\'inscription' },
            unit_amount: amountCents,
          },
          quantity: 1,
        }],
        success_url: success_url || `${origin}/packs?fee_paid=true`,
        cancel_url: cancel_url || `${origin}/packs?cancelled=true`,
        customer_email: user.email,
        metadata: {
          kind: 'registration_fee',
          user_id: user.id,
          amount_cents: amountCents.toString(),
        },
      })

      return json({ url: session.url, session_id: session.id })
    }

    // ========================================================================
    // CAS 2 et 3 — Pack ponctuel ou abonnement
    // ========================================================================
    if (!pack_type_id) return json({ error: 'pack_type_id est requis' }, 400)

    const { data: packType, error: packError } = await admin
      .from('pack_types')
      .select('*, credit_type:credit_types(*)')
      .eq('id', pack_type_id)
      .eq('is_active', true)
      .maybeSingle()

    if (packError || !packType) return json({ error: 'Type de pack introuvable' }, 404)

    // Éligibilité par catégorie de membre
    const { data: profile } = await admin
      .from('profiles').select('member_category_id').eq('id', user.id).maybeSingle()

    if (profile?.member_category_id) {
      const { data: eligible } = await admin
        .from('pack_type_categories')
        .select('member_category_id')
        .eq('pack_type_id', pack_type_id)

      if (eligible && eligible.length > 0) {
        const ok = eligible.some(
          (c: { member_category_id: string }) => c.member_category_id === profile.member_category_id,
        )
        if (!ok) return json({ error: 'Vous n\'êtes pas éligible à ce pack' }, 403)
      }
    }

    // Frais d'inscription obligatoires avant tout achat
    const { data: feeSetting } = await admin
      .from('app_settings').select('value').eq('key', 'registration_fee').maybeSingle()
    const feeEnabled = (feeSetting?.value as { enabled?: boolean } | null)?.enabled !== false

    if (feeEnabled) {
      const { data: paidFee } = await admin
        .from('registration_fees').select('id').eq('user_id', user.id).limit(1)
      if (!paidFee || paidFee.length === 0) {
        return json({ error: 'Frais d\'inscription à régler avant tout achat' }, 403)
      }
    }

    // ---- Coupon éventuel (réduction sur ce paiement) ----------------------
    let priceCents: number = packType.price_cents
    let couponId: string | null = null
    let stripeCouponId: string | null = null

    if (coupon_code) {
      const { data: coupon } = await admin
        .from('coupons')
        .select('*')
        .eq('code', String(coupon_code).toUpperCase())
        .eq('is_active', true)
        .maybeSingle()

      if (coupon) {
        const now = new Date()
        const validFrom = new Date(coupon.valid_from)
        const validUntil = coupon.valid_until ? new Date(coupon.valid_until) : null
        const usesLeft = !coupon.max_uses || coupon.current_uses < coupon.max_uses

        if (now >= validFrom && (!validUntil || now <= validUntil) && usesLeft) {
          couponId = coupon.id
          if (packType.is_recurring) {
            // Sur un abonnement, la remise passe par un coupon Stripe
            // `duration: once` : elle s'applique à la première facture puis
            // Stripe la retire tout seul. Baisser le prix du Price la rendrait
            // permanente.
            const c = await stripe.coupons.create({
              duration: 'once',
              ...(coupon.discount_percent
                ? { percent_off: coupon.discount_percent }
                : { amount_off: coupon.discount_amount_cents, currency: 'eur' }),
              name: `Code ${coupon.code}`,
            })
            stripeCouponId = c.id
          } else if (coupon.discount_percent) {
            priceCents = Math.round(priceCents * (1 - coupon.discount_percent / 100))
          } else if (coupon.discount_amount_cents) {
            priceCents = Math.max(0, priceCents - coupon.discount_amount_cents)
          }
        }
      }
    }

    // ---- Métadonnées communes --------------------------------------------
    // Elles voyagent jusqu'au webhook : c'est lui qui crédite.
    const metadata: Record<string, string> = {
      user_id: user.id,
      pack_type_id,
      coupon_id: couponId ?? '',
      validity_days: String(packType.validity_days),
      credit_count: String(packType.credit_count),
    }

    // ========================================================================
    // CAS 3 — Abonnement
    // ========================================================================
    if (packType.is_recurring) {
      if (!packType.recurring_interval || !packType.recurring_interval_count) {
        return json({ error: 'Périodicité manquante sur ce pack récurrent' }, 400)
      }

      // Un seul abonnement à la fois. Sans ce contrôle, un membre pouvait
      // souscrire deux fois et se retrouver prélevé en double — le front masque
      // déjà les offres, mais la fonction est appelable directement.
      // 'canceled' est exclu : une résiliation programmée laisse le statut
      // 'active' avec cancel_at_period_end, et il ne faut pas non plus
      // souscrire par-dessus.
      const { data: existing } = await admin
        .from('subscriptions')
        .select('id, status, current_period_end')
        .eq('user_id', user.id)
        .in('status', ['active', 'past_due', 'paused', 'incomplete'])
        .limit(1)
        .maybeSingle()

      if (existing) {
        return json({
          error: 'Vous avez déjà un abonnement en cours. Résiliez-le avant d\'en souscrire un autre, ou contactez le studio pour en changer.',
        }, 409)
      }

      // Price Stripe : réutilisé s'il existe, créé sinon. Les identifiants test
      // et live sont distincts et ne sont jamais interchangeables.
      const priceColumn = isLive ? 'stripe_price_id_live' : 'stripe_price_id_test'
      let priceId: string | null = packType[priceColumn] ?? null

      if (priceId) {
        // Un Price supprimé côté Stripe, ou créé dans l'autre mode, ferait
        // échouer le checkout : on vérifie avant de s'en servir.
        try {
          const existing = await stripe.prices.retrieve(priceId)
          if (!existing.active) priceId = null
        } catch {
          priceId = null
        }
      }

      if (!priceId) {
        const price = await stripe.prices.create({
          currency: 'eur',
          unit_amount: packType.price_cents,
          recurring: {
            interval: packType.recurring_interval as 'day' | 'week' | 'month',
            interval_count: packType.recurring_interval_count,
          },
          product_data: { name: packType.name },
        })
        priceId = price.id
        await admin.from('pack_types').update({ [priceColumn]: priceId }).eq('id', pack_type_id)
      }

      const session = await stripe.checkout.sessions.create({
        mode: 'subscription',
        line_items: [{ price: priceId, quantity: 1 }],
        ...(stripeCouponId ? { discounts: [{ coupon: stripeCouponId }] } : {}),
        success_url: success_url || `${origin}/my-packs?success=true`,
        cancel_url: cancel_url || `${origin}/packs?cancelled=true`,
        customer_email: user.email,
        metadata: { ...metadata, kind: 'subscription' },
        // Recopiées sur l'abonnement lui-même : les factures de renouvellement
        // ne portent pas les métadonnées de la session de checkout.
        subscription_data: { metadata: { ...metadata, kind: 'subscription' } },
      })

      return json({ url: session.url, session_id: session.id })
    }

    // ========================================================================
    // CAS 2 — Pack ponctuel
    // ========================================================================
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: [{
        price_data: {
          currency: 'eur',
          product_data: {
            name: packType.name,
            description: packType.is_unlimited
              ? `Accès illimité — ${packType.credit_type?.label_fr ?? ''}`
              : `${packType.credit_count} crédit(s) — ${packType.credit_type?.label_fr ?? ''}`,
          },
          unit_amount: priceCents,
        },
        quantity: 1,
      }],
      success_url: success_url || `${origin}/my-packs?success=true`,
      cancel_url: cancel_url || `${origin}/packs?cancelled=true`,
      customer_email: user.email,
      metadata: { ...metadata, kind: 'pack', price_paid_cents: String(priceCents) },
    })

    return json({ url: session.url, session_id: session.id })
  } catch (err) {
    console.error('create-checkout-session', err)
    return json({ error: (err as Error).message }, 500)
  }
})

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

    const { type, pack_type_id, coupon_code, credit_note_id, success_url, cancel_url, starts_on } = await req.json()

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

    // ---- Bon d'achat éventuel --------------------------------------------
    // Nominatif : on vérifie qu'il appartient bien à l'appelant, qu'il n'est
    // pas déjà consommé et qu'il n'a pas expiré. Le bon n'est PAS marqué
    // utilisé ici — c'est le webhook qui le fera, une fois le paiement
    // confirmé. Sinon un client qui ferme la page perdrait son bon sans avoir
    // rien acheté.
    let creditNote: { id: string; amount_cents: number; code: string } | null = null
    if (credit_note_id) {
      const { data: note } = await admin
        .from('referral_rewards')
        .select('id, amount_cents, code, expires_at, is_used')
        .eq('id', credit_note_id)
        .eq('user_id', user.id)
        .maybeSingle()

      if (!note) return json({ error: 'Bon d\'achat introuvable' }, 404)
      if (note.is_used) return json({ error: 'Ce bon a déjà été utilisé' }, 400)
      if (note.expires_at && new Date(note.expires_at) < new Date()) {
        return json({ error: 'Ce bon a expiré' }, 400)
      }
      creditNote = { id: note.id, amount_cents: note.amount_cents, code: note.code }
    }

    /**
     * Vérifie le montant minimum d'achat avant d'accepter un bon.
     *
     * Le front masque déjà les bons non activables, mais cette fonction est
     * appelable directement : le seuil se contrôle là où il engage de l'argent.
     * Il porte sur le prix AVANT déduction — c'est l'engagement qu'on mesure.
     */
    const checkNoteMinimum = async (purchaseCents: number) => {
      if (!creditNote) return null
      const { data } = await admin.rpc('credit_note_applicable', {
        p_note_id: creditNote.id,
        p_user_id: user.id,
        p_purchase_cents: purchaseCents,
      })
      const res = data as { ok: boolean; error?: string; min_purchase_cents?: number } | null
      if (res?.ok) return null

      if (res?.error === 'below_minimum') {
        const min = ((res.min_purchase_cents ?? 3000) / 100).toFixed(2).replace('.', ',')
        return json({
          error: `Ce bon s'utilise à partir de ${min} € d'achat. Garde-le pour un pack plus important.`,
        }, 400)
      }
      return json({ error: 'Ce bon n\'est pas utilisable sur cet achat' }, 400)
    }

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
      // Achat ponctuel : c'est l'application qui soustrait, pas Stripe. Il n'y
      // a pas de récurrence à protéger (cf. docs/cadrage-bons-achat.md).
      const feeBlock = await checkNoteMinimum(amountCents)
      if (feeBlock) return feeBlock

      const dueCents = Math.max(0, amountCents - (creditNote?.amount_cents ?? 0))

      // Bon supérieur ou égal au montant dû : Stripe refuse une session à 0 €.
      // On enregistre directement, en consommant le bon — c'est le cas nominal
      // du parrainage, où 30 € de bon couvrent 30 € de frais d'inscription.
      if (creditNote && dueCents === 0) {
        const { error: feeError } = await admin.from('registration_fees').insert({
          user_id: user.id,
          amount_cents: amountCents,
        })
        if (feeError) return json({ error: feeError.message }, 500)

        await admin.rpc('consume_credit_note', {
          p_note_id: creditNote.id,
          p_user_id: user.id,
          p_used_on: 'registration_fee',
        })
        await admin.rpc('update_member_status', { p_user_id: user.id })
        await admin.rpc('check_referral_qualification', { p_referee_id: user.id })

        await admin.from('notifications').insert({
          user_id: user.id,
          title: 'Inscription confirmée',
          message: `Vos frais d'inscription sont couverts par votre bon de ${(creditNote.amount_cents / 100).toFixed(2)} €. Rien à payer.`,
          type: 'success',
          link: '/packs',
        })

        return json({ paid_with_credit_note: true, code: creditNote.code })
      }

      const session = await stripe.checkout.sessions.create({
        mode: 'payment',
        payment_method_types: ['card'],
        line_items: [{
          price_data: {
            currency: 'eur',
            product_data: { name: 'Frais d\'inscription' },
            unit_amount: dueCents,
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
          credit_note_id: creditNote?.id ?? '',
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

    // Un pack hors catalogue ne s'achète pas — cas de la séance d'essai, qui
    // est offerte à l'inscription. Le front ne l'affiche pas, mais cette
    // fonction est appelable directement : sans ce refus, n'importe qui
    // obtiendrait un pack à 0 € en passant son identifiant.
    if (packType.is_purchasable === false) {
      return json({ error: 'Ce pack n\'est pas en vente' }, 403)
    }

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

        // Catégories éligibles. Aucune ligne = coupon ouvert à tous — c'est le
        // cas nominal, on ne demande pas de cocher toutes les catégories.
        //
        // Le contrôle est refait ici et pas seulement à l'écran : cette
        // fonction est appelable directement, et un coupon réservé à une
        // population serait sinon utilisable par n'importe qui.
        const { data: couponCats } = await admin
          .from('coupon_categories')
          .select('member_category_id')
          .eq('coupon_id', coupon.id)

        const categoryOk = !couponCats || couponCats.length === 0
          || couponCats.some(
            (c: { member_category_id: string }) => c.member_category_id === profile?.member_category_id,
          )

        // Un coupon ne sert qu'une fois par personne. Le controle est refait
        // ici et pas seulement dans `check_coupon` : cette fonction est
        // appelable directement, et l'ecran n'est qu'une politesse.
        const { data: dejaUtilise } = await admin
          .from('pack_purchases')
          .select('id')
          .eq('user_id', user.id)
          .eq('coupon_id', coupon.id)
          .limit(1)

        const jamaisUtilise = !dejaUtilise || dejaUtilise.length === 0

        if (categoryOk && jamaisUtilise && now >= validFrom && (!validUntil || now <= validUntil) && usesLeft) {
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

      // Sur un abonnement, c'est Stripe qui soustrait — jamais l'application.
      // `duration: 'once'` applique la remise à la PREMIÈRE facture puis retire
      // le coupon de lui-même : le prix récurrent reste intact. Baisser le
      // Price rendrait la réduction permanente.
      const subBlock = await checkNoteMinimum(packType.price_cents)
      if (subBlock) return subBlock

      let noteCouponId: string | null = null
      if (creditNote) {
        if (stripeCouponId) {
          return json({ error: 'Un seul code par achat : coupon ou bon d\'achat' }, 400)
        }
        const c = await stripe.coupons.create({
          duration: 'once',
          amount_off: creditNote.amount_cents,
          currency: 'eur',
          name: `Bon ${creditNote.code}`,
        })
        noteCouponId = c.id
      }

      const appliedCoupon = stripeCouponId ?? noteCouponId

      // ---- Démarrage différé ------------------------------------------------
      // Vendre le 15/08 un abonnement qui commence le 01/09 : la carte est
      // enregistrée tout de suite, le premier prélèvement attend la date.
      //
      // C'est `trial_end` qui porte ce report — pas une période d'essai
      // gratuite au sens commercial, mais le mécanisme Stripe qui décale la
      // première facture. L'abonnement passe en statut `trialing` jusque-là,
      // que le webhook traite déjà comme actif.
      //
      // Rien n'est crédité avant le paiement : le webhook ne crédite que sur
      // `invoice.paid`, et il ignore les factures à 0 € que Stripe émet en fin
      // d'essai. Le membre voit donc son abonnement souscrit, sans crédits,
      // jusqu'à la date choisie.
      let trialEnd: number | undefined
      if (starts_on) {
        const start = new Date(starts_on)
        if (isNaN(start.getTime())) {
          return json({ error: 'Date de démarrage invalide' }, 400)
        }
        // Stripe impose au moins 48 h et refuse au-delà de 2 ans. On borne un
        // peu plus court côté studio : au-delà d'un an, c'est une erreur de
        // saisie bien plus probablement qu'une intention.
        const minStart = new Date(Date.now() + 48 * 3600 * 1000)
        const maxStart = new Date(Date.now() + 365 * 24 * 3600 * 1000)
        if (start < minStart) {
          return json({
            error: 'Le démarrage différé doit être fixé à au moins 48 h. Pour commencer maintenant, laissez la date vide.',
          }, 400)
        }
        if (start > maxStart) {
          return json({ error: 'Le démarrage ne peut pas être différé de plus d\'un an' }, 400)
        }
        trialEnd = Math.floor(start.getTime() / 1000)
      }

      const session = await stripe.checkout.sessions.create({
        mode: 'subscription',
        line_items: [{ price: priceId, quantity: 1 }],
        ...(appliedCoupon ? { discounts: [{ coupon: appliedCoupon }] } : {}),
        success_url: success_url || `${origin}/my-packs?success=true`,
        cancel_url: cancel_url || `${origin}/packs?cancelled=true`,
        customer_email: user.email,
        metadata: { ...metadata, kind: 'subscription', credit_note_id: creditNote?.id ?? '' },
        // Recopiées sur l'abonnement lui-même : les factures de renouvellement
        // ne portent pas les métadonnées de la session de checkout.
        subscription_data: {
          metadata: { ...metadata, kind: 'subscription' },
          ...(trialEnd ? { trial_end: trialEnd } : {}),
        },
      })

      return json({ url: session.url, session_id: session.id })
    }

    // ========================================================================
    // CAS 2 — Pack ponctuel
    // ========================================================================
    // Achat ponctuel : l'application soustrait le bon avant l'envoi à Stripe.
    const packBlock = await checkNoteMinimum(priceCents)
    if (packBlock) return packBlock

    const dueCents = Math.max(0, priceCents - (creditNote?.amount_cents ?? 0))

    // Bon couvrant la totalité : Stripe refuse une session à 0 €, on crédite
    // directement le pack en consommant le bon.
    if (creditNote && dueCents === 0) {
      const expiresAt = new Date()
      expiresAt.setDate(expiresAt.getDate() + packType.validity_days)

      const { error: purchaseError } = await admin.from('pack_purchases').insert({
        user_id: user.id,
        pack_type_id: pack_type_id,
        price_paid_cents: 0,
        credits_remaining: packType.credit_count,
        purchased_at: new Date().toISOString(),
        expires_at: expiresAt.toISOString(),
        coupon_id: couponId,
      })
      if (purchaseError) return json({ error: purchaseError.message }, 500)

      await admin.rpc('consume_credit_note', {
        p_note_id: creditNote.id,
        p_user_id: user.id,
        p_used_on: 'pack',
      })
      if (couponId) await admin.rpc('increment_coupon_usage', { p_coupon_id: couponId })
      await admin.rpc('check_referral_qualification', { p_referee_id: user.id })

      await admin.from('notifications').insert({
        user_id: user.id,
        title: 'Pack activé',
        message: `Votre pack ${packType.name} est activé, couvert par votre bon de ${(creditNote.amount_cents / 100).toFixed(2)} €. Valide jusqu'au ${expiresAt.toLocaleDateString('fr-BE')}.`,
        type: 'success',
        link: '/my-packs',
      })

      return json({ paid_with_credit_note: true, code: creditNote.code })
    }

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
          unit_amount: dueCents,
        },
        quantity: 1,
      }],
      success_url: success_url || `${origin}/my-packs?success=true`,
      cancel_url: cancel_url || `${origin}/packs?cancelled=true`,
      customer_email: user.email,
      metadata: {
        ...metadata,
        kind: 'pack',
        price_paid_cents: String(dueCents),
        credit_note_id: creditNote?.id ?? '',
      },
    })

    return json({ url: session.url, session_id: session.id })
  } catch (err) {
    console.error('create-checkout-session', err)
    return json({ error: (err as Error).message }, 500)
  }
})

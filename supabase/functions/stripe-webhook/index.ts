// ============================================================================
// stripe-webhook
// ----------------------------------------------------------------------------
// Seul endroit où l'on crédite. Stripe confirme le paiement, on écrit en base.
//
// Événements traités :
//   checkout.session.completed      paiement unique (frais ou pack) + 1er cycle
//   invoice.paid                    échéance d'abonnement → recharge le pack
//   invoice.payment_failed          échec → past_due, admin et membre notifiés
//   customer.subscription.updated   statut, dates, suspension, résiliation
//   customer.subscription.deleted   abonnement terminé
//
// IDEMPOTENCE — Stripe rejoue ses événements (nouvelle tentative après une
// erreur réseau, bouton « resend » du dashboard). Chaque écriture est donc
// protégée : index unique sur pack_purchases.stripe_invoice_id, contrainte
// unique sur subscriptions.stripe_subscription_id, vérification d'existence
// pour les frais d'inscription.
//
// À DÉPLOYER AVEC --no-verify-jwt : Stripe n'envoie pas de JWT Supabase.
// L'authenticité est garantie par la signature du webhook.
// ============================================================================

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Stripe from 'https://esm.sh/stripe@14?target=deno'

const admin = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
)

/** Crée une ligne pack_purchases : un cycle payé = une ligne. */
async function creditPack(opts: {
  userId: string
  packTypeId: string
  pricePaidCents: number
  validityDays: number
  creditCount: number
  couponId?: string | null
  subscriptionId?: string | null
  stripeInvoiceId?: string | null
  stripePaymentIntentId?: string | null
}) {
  const purchasedAt = new Date()
  const expiresAt = new Date(purchasedAt)
  expiresAt.setDate(expiresAt.getDate() + opts.validityDays)

  const { error } = await admin.from('pack_purchases').insert({
    user_id: opts.userId,
    pack_type_id: opts.packTypeId,
    price_paid_cents: opts.pricePaidCents,
    credits_remaining: opts.creditCount,
    purchased_at: purchasedAt.toISOString(),
    expires_at: expiresAt.toISOString(),
    coupon_id: opts.couponId || null,
    subscription_id: opts.subscriptionId ?? null,
    stripe_invoice_id: opts.stripeInvoiceId ?? null,
    stripe_payment_intent_id: opts.stripePaymentIntentId ?? null,
  })

  // 23505 = violation d'unicité : l'événement a déjà été traité. Ce n'est pas
  // une erreur, c'est la protection contre le rejeu qui fait son travail.
  if (error && error.code !== '23505') throw error
  return { alreadyProcessed: error?.code === '23505', expiresAt }
}

async function notify(userId: string, title: string, message: string, type = 'success', link = '/my-packs') {
  await admin.from('notifications').insert({ user_id: userId, title, message, type, link })
}

/** Prévient tous les admins (échec de paiement, incident). */
async function notifyAdmins(title: string, message: string) {
  const { data: admins } = await admin
    .from('user_roles').select('user_id').in('role', ['admin', 'super_admin'])
  const ids = [...new Set((admins ?? []).map(r => r.user_id))]
  if (ids.length === 0) return
  await admin.from('notifications').insert(
    ids.map(id => ({ user_id: id, title, message, type: 'warning', link: '/admin/users' })),
  )
}

serve(async (req) => {
  const signature = req.headers.get('stripe-signature')
  if (!signature) return new Response('Signature manquante', { status: 400 })

  const body = await req.text()

  const { data: modeSetting } = await admin
    .from('app_settings').select('value').eq('key', 'stripe_mode').maybeSingle()
  const isLive = (modeSetting?.value as { mode?: string } | null)?.mode === 'live'

  const stripeKey = isLive
    ? Deno.env.get('STRIPE_SECRET_KEY_LIVE')
    : Deno.env.get('STRIPE_SECRET_KEY_TEST')
  const webhookSecret = isLive
    ? Deno.env.get('STRIPE_WEBHOOK_SECRET_LIVE')
    : Deno.env.get('STRIPE_WEBHOOK_SECRET_TEST')

  if (!stripeKey || !webhookSecret) {
    console.error('Clé ou secret webhook absent pour le mode', isLive ? 'live' : 'test')
    return new Response('Configuration Stripe incomplète', { status: 500 })
  }

  const stripe = new Stripe(stripeKey, { apiVersion: '2023-10-16' })

  let event: Stripe.Event
  try {
    // constructEventAsync : la version synchrone n'est pas utilisable sous Deno
    // (crypto asynchrone).
    event = await stripe.webhooks.constructEventAsync(body, signature, webhookSecret)
  } catch (err) {
    console.error('Signature invalide', err)
    return new Response(`Signature invalide: ${(err as Error).message}`, { status: 400 })
  }

  try {
    switch (event.type) {
      // ====================================================================
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session
        const md = session.metadata ?? {}

        // ---- Frais d'inscription ----
        if (md.kind === 'registration_fee') {
          const { data: already } = await admin
            .from('registration_fees').select('id').eq('user_id', md.user_id).limit(1)
          if (already && already.length > 0) break   // déjà traité

          await admin.from('registration_fees').insert({
            user_id: md.user_id,
            amount_cents: parseInt(md.amount_cents ?? '3000'),
            stripe_payment_intent_id: session.payment_intent as string,
          })
          await notify(
            md.user_id,
            'Inscription confirmée',
            'Vos frais d\'inscription ont bien été reçus. Vous pouvez maintenant acheter un pack.',
            'success', '/packs',
          )
          break
        }

        // ---- Abonnement : création + premier cycle ----
        if (md.kind === 'subscription' && session.subscription) {
          const sub = await stripe.subscriptions.retrieve(session.subscription as string)

          const { data: subRow } = await admin.from('subscriptions').upsert({
            user_id: md.user_id,
            pack_type_id: md.pack_type_id,
            stripe_subscription_id: sub.id,
            stripe_customer_id: sub.customer as string,
            stripe_price_id: sub.items.data[0]?.price.id ?? '',
            stripe_mode: isLive ? 'live' : 'test',
            status: sub.status === 'active' || sub.status === 'trialing' ? 'active' : 'incomplete',
            current_period_start: new Date(sub.current_period_start * 1000).toISOString(),
            current_period_end: new Date(sub.current_period_end * 1000).toISOString(),
            cancel_at_period_end: sub.cancel_at_period_end,
          }, { onConflict: 'stripe_subscription_id' }).select().single()

          // Le premier cycle est crédité par l'invoice.paid qui suit — ne rien
          // faire ici évite de créditer deux fois.
          if (subRow) {
            await notify(
              md.user_id,
              'Abonnement activé',
              `Votre abonnement est actif. Prochaine échéance le ${new Date(sub.current_period_end * 1000).toLocaleDateString('fr-BE')}.`,
            )
          }
          break
        }

        // ---- Pack ponctuel ----
        if (md.kind === 'pack' || md.pack_type_id) {
          const creditCount = parseInt(md.credit_count ?? '0')
          const { alreadyProcessed, expiresAt } = await creditPack({
            userId: md.user_id,
            packTypeId: md.pack_type_id,
            pricePaidCents: parseInt(md.price_paid_cents ?? '0'),
            validityDays: parseInt(md.validity_days ?? '0'),
            creditCount,
            couponId: md.coupon_id,
            stripePaymentIntentId: session.payment_intent as string,
          })
          if (alreadyProcessed) break

          if (md.coupon_id) {
            await admin.rpc('increment_coupon_usage', { p_coupon_id: md.coupon_id })
          }
          await notify(
            md.user_id,
            'Achat confirmé',
            `Votre pack est activé (${creditCount} crédit(s)). Valide jusqu'au ${expiresAt.toLocaleDateString('fr-BE')}.`,
          )
        }
        break
      }

      // ====================================================================
      // Échéance payée : recharge le pack. C'est ici que se fait le
      // renouvellement, y compris pour le tout premier cycle.
      case 'invoice.paid': {
        const invoice = event.data.object as Stripe.Invoice
        if (!invoice.subscription) break

        const { data: subRow } = await admin
          .from('subscriptions')
          .select('*, pack_type:pack_types(*)')
          .eq('stripe_subscription_id', invoice.subscription as string)
          .maybeSingle()

        if (!subRow) {
          console.error('Abonnement inconnu', invoice.subscription)
          break
        }

        const pt = subRow.pack_type as {
          credit_count: number; validity_days: number; name: string
        } | null
        if (!pt) break

        const { alreadyProcessed, expiresAt } = await creditPack({
          userId: subRow.user_id,
          packTypeId: subRow.pack_type_id,
          pricePaidCents: invoice.amount_paid,
          validityDays: pt.validity_days,
          creditCount: pt.credit_count,
          subscriptionId: subRow.id,
          stripeInvoiceId: invoice.id,
        })
        if (alreadyProcessed) break

        // Marquer les réductions ponctuelles comme consommées : la facture
        // réduite vient d'être payée.
        if ((invoice.total_discount_amounts?.length ?? 0) > 0) {
          await admin
            .from('subscription_discounts')
            .update({ consumed_at: new Date().toISOString() })
            .eq('subscription_id', subRow.id)
            .is('consumed_at', null)
        }

        await admin.from('subscriptions').update({
          status: 'active',
          current_period_start: invoice.period_start
            ? new Date(invoice.period_start * 1000).toISOString() : null,
          current_period_end: invoice.period_end
            ? new Date(invoice.period_end * 1000).toISOString() : null,
        }).eq('id', subRow.id)

        await notify(
          subRow.user_id,
          'Abonnement renouvelé',
          `Votre abonnement ${pt.name} a été renouvelé. Crédits disponibles jusqu'au ${expiresAt.toLocaleDateString('fr-BE')}.`,
        )
        break
      }

      // ====================================================================
      // Échec de paiement : on suspend le renouvellement, on ne résilie pas.
      // Une carte expirée ne doit pas coûter un client.
      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice
        if (!invoice.subscription) break

        const { data: subRow } = await admin
          .from('subscriptions')
          .select('*, pack_type:pack_types(name)')
          .eq('stripe_subscription_id', invoice.subscription as string)
          .maybeSingle()
        if (!subRow) break

        await admin.from('subscriptions')
          .update({ status: 'past_due' })
          .eq('id', subRow.id)

        const { data: prof } = await admin
          .from('profiles').select('display_name').eq('id', subRow.user_id).maybeSingle()

        await notify(
          subRow.user_id,
          'Paiement refusé',
          'Le renouvellement de votre abonnement n\'a pas abouti. Vérifiez votre moyen de paiement — nous réessaierons automatiquement.',
          'error', '/my-packs',
        )
        await notifyAdmins(
          'Échec de paiement',
          `Le renouvellement de ${prof?.display_name ?? 'un membre'} a échoué (${(subRow.pack_type as { name?: string } | null)?.name ?? 'abonnement'}).`,
        )
        break
      }

      // ====================================================================
      case 'customer.subscription.updated': {
        const sub = event.data.object as Stripe.Subscription

        // Une suspension décidée par le studio se lit sur pause_collection.
        const paused = !!sub.pause_collection
        const status = paused
          ? 'paused'
          : sub.status === 'active' || sub.status === 'trialing'
            ? 'active'
            : sub.status === 'past_due' || sub.status === 'unpaid'
              ? 'past_due'
              : sub.status === 'canceled'
                ? 'canceled'
                : 'incomplete'

        await admin.from('subscriptions').update({
          status,
          current_period_start: new Date(sub.current_period_start * 1000).toISOString(),
          current_period_end: new Date(sub.current_period_end * 1000).toISOString(),
          cancel_at_period_end: sub.cancel_at_period_end,
          paused_at: paused ? new Date().toISOString() : null,
          stripe_price_id: sub.items.data[0]?.price.id ?? '',
        }).eq('stripe_subscription_id', sub.id)
        break
      }

      // ====================================================================
      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription
        const { data: subRow } = await admin
          .from('subscriptions')
          .update({ status: 'canceled', canceled_at: new Date().toISOString() })
          .eq('stripe_subscription_id', sub.id)
          .select('user_id')
          .maybeSingle()

        if (subRow) {
          await notify(
            subRow.user_id,
            'Abonnement terminé',
            'Votre abonnement a pris fin. Vos crédits en cours restent utilisables jusqu\'à leur date d\'expiration.',
            'info', '/my-packs',
          )
        }
        break
      }

      default:
        // Les autres événements ne nous concernent pas : répondre 200 évite
        // que Stripe les rejoue indéfiniment.
        break
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('stripe-webhook', event.type, err)
    // 500 → Stripe réessaiera. L'idempotence garantit qu'un rejeu ne double
    // aucune écriture.
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
})

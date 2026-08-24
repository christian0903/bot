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

/**
 * Lecture d'un champ que le typage du SDK Stripe ne déclare pas.
 *
 * Les objets renvoyés par l'API portent plus de champs que la version des
 * types embarquée dans le SDK : les périodes ont migré vers les items, le
 * lien vers l'abonnement vers `parent`. On lit donc ces objets comme des
 * enregistrements ouverts, sans renoncer au contrôle de type — chaque valeur
 * ressort en `unknown` et doit être vérifiée avant usage.
 */
type Loose = Record<string, unknown>

/** Vue ouverte d'un objet Stripe, pour atteindre les champs non typés. */
const loose = (v: unknown): Loose => (v ?? {}) as Loose

/** Champ imbriqué lu en profondeur, `undefined` dès qu'un maillon manque. */
function dig(v: unknown, ...path: string[]): unknown {
  let cur: unknown = v
  for (const key of path) {
    if (cur === null || typeof cur !== 'object') return undefined
    cur = (cur as Loose)[key]
  }
  return cur
}

/** Identifiant Stripe, qu'il arrive en clair ou dans un objet étendu. */
function idOf(v: unknown): string | null {
  if (typeof v === 'string') return v
  const nested = dig(v, 'id')
  return typeof nested === 'string' ? nested : null
}

/**
 * Bornes du cycle courant d'un abonnement.
 *
 * Les versions récentes de l'API Stripe (à partir de 2025-03) ont déplacé
 * `current_period_start` / `current_period_end` de la racine de l'abonnement
 * vers ses items. Lire uniquement la racine donnait `undefined`, puis une
 * "Invalid time value" au moment du `.toISOString()` — et le webhook échouait
 * avant d'avoir rien écrit.
 *
 * On lit donc les deux emplacements, en préférant l'item quand il est présent.
 */
function periodOf(sub: Stripe.Subscription): { start: string | null; end: string | null } {
  const item = loose(sub.items?.data?.[0])
  const anySub = loose(sub)

  const toIso = (ts: unknown): string | null => {
    if (typeof ts !== 'number' || !Number.isFinite(ts)) return null
    const d = new Date(ts * 1000)
    return Number.isNaN(d.getTime()) ? null : d.toISOString()
  }

  return {
    start: toIso(item.current_period_start ?? anySub.current_period_start),
    end: toIso(item.current_period_end ?? anySub.current_period_end),
  }
}

/**
 * Abonnement rattaché à une facture.
 *
 * Même mouvement que pour les périodes : les API récentes ont déplacé
 * `invoice.subscription` vers `invoice.parent.subscription_details.subscription`.
 * Sans cette lecture double, invoice.paid sortait sans rien créditer.
 */
function subscriptionIdOf(invoice: Stripe.Invoice): string | null {
  const inv = loose(invoice)

  const direct = idOf(inv.subscription)
  if (direct) return direct

  const nested = idOf(dig(inv, 'parent', 'subscription_details', 'subscription'))
  if (nested) return nested

  // Dernier recours : la ligne de facture porte aussi le lien.
  const line = dig(inv, 'lines', 'data', '0')
  const fromLine = idOf(
    dig(line, 'subscription') ??
      dig(line, 'parent', 'subscription_item_details', 'subscription'),
  )
  if (fromLine) return fromLine

  return null
}

/** Bornes de période portées par une facture (racine ou première ligne). */
function invoicePeriod(invoice: Stripe.Invoice): { start: string | null; end: string | null } {
  const inv = loose(invoice)
  const line = dig(inv, 'lines', 'data', '0')

  const toIso = (ts: unknown): string | null => {
    if (typeof ts !== 'number' || !Number.isFinite(ts)) return null
    const d = new Date(ts * 1000)
    return Number.isNaN(d.getTime()) ? null : d.toISOString()
  }

  // La LIGNE d'abord, la racine seulement en secours.
  //
  // `invoice.period_start` / `period_end` datent la FACTURE, pas le cycle
  // d'abonnement : sur une souscription, les deux valent l'instant d'émission.
  // Les lire en priorité enregistrait donc une période de durée nulle —
  // `current_period_end` figé au jour de la souscription. L'abonnement
  // paraissait échu le jour même, alors que Stripe le renouvelait normalement
  // 28 jours plus tard.
  //
  // Le piège est que `??` ne bascule que sur null/undefined : `period_end`
  // étant un nombre valide, la ligne n'était jamais consultée.
  return {
    start: toIso(dig(line, 'period', 'start') ?? inv.period_start),
    end: toIso(dig(line, 'period', 'end') ?? inv.period_end),
  }
}

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
  /**
   * Cycle facturé, quand il y en a un (abonnement). Le pack couvre CETTE
   * période, pas les N jours qui suivent l'instant du traitement.
   */
  periodStart?: string | null
  periodEnd?: string | null
}) {
  // Le cycle facturé fait foi. Compter les jours depuis `new Date()` datait le
  // pack de l'instant où le webhook s'exécute : un événement rejoué avec
  // retard, ou traité en différé, produisait un pack décalé — et sous test
  // clock, un pack expirant avant même le cycle qu'il couvre.
  //
  // Sans période (achat ponctuel), la durée de validité du pack s'applique à
  // partir de l'achat, comme avant.
  const purchasedAt = opts.periodStart ? new Date(opts.periodStart) : new Date()

  let expiresAt: Date
  if (opts.periodEnd) {
    expiresAt = new Date(opts.periodEnd)
  } else {
    expiresAt = new Date(purchasedAt)
    expiresAt.setDate(expiresAt.getDate() + opts.validityDays)
  }

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
    // Tout ce qui passe par ce webhook est encaissé en ligne, par
    // construction : c'est Stripe qui l'appelle.
    payment_method: 'stripe',
  })

  // 23505 = violation d'unicité : l'événement a déjà été traité. Ce n'est pas
  // une erreur, c'est la protection contre le rejeu qui fait son travail.
  if (error && error.code !== '23505') throw error
  return { alreadyProcessed: error?.code === '23505', expiresAt }
}

/**
 * Qualifie le parrainage du membre si un paiement vient d'aboutir.
 *
 * Appelée aux trois endroits où de l'argent rentre : frais d'inscription, pack
 * ponctuel, échéance d'abonnement. Le premier des trois déclenche les deux bons
 * de 30 € — c'est la règle « au premier achat payé » retenue le 2026-08-05.
 *
 * La fonction SQL filtre sur `status = 'pending'` : un rejeu d'événement Stripe
 * ne crée pas de bons en double, et les paiements suivants ne font rien.
 */
async function qualifyReferral(userId: string | undefined) {
  if (!userId) return
  const { data, error } = await admin.rpc('check_referral_qualification', {
    p_referee_id: userId,
  })
  if (error) {
    // Un parrainage non qualifié ne doit jamais faire échouer un paiement :
    // on trace et on continue.
    console.error('check_referral_qualification', error)
    return
  }
  if ((data as { qualified?: boolean } | null)?.qualified) {
    console.log('Parrainage qualifié pour', userId)
  }
}

/**
 * Marque un bon d'achat comme consommé.
 *
 * Uniquement ici, une fois le paiement confirmé : si on le faisait au moment du
 * calcul, un client qui ferme la page de paiement perdrait son bon sans avoir
 * rien acheté. Même principe que pour les crédits — le webhook est le seul
 * endroit qui engage quelque chose.
 *
 * La fonction SQL est idempotente (UPDATE conditionné à is_used = FALSE) : un
 * rejeu d'événement ne consomme pas deux fois.
 */
async function consumeCreditNote(
  noteId: string | undefined,
  userId: string | undefined,
  usedOn: 'pack' | 'subscription' | 'registration_fee',
) {
  if (!noteId || !userId) return
  const { error } = await admin.rpc('consume_credit_note', {
    p_note_id: noteId,
    p_user_id: userId,
    p_used_on: usedOn,
  })
  if (error) console.error('consume_credit_note', error)
}

async function notify(
  userId: string, title: string, message: string, type = 'success', link = '/my-packs',
  emailTemplate: string | null = null,
) {
  const { error } = await admin.from('notifications').insert({
    user_id: userId, title, message, type, link, email_template: emailTemplate,
  })
  if (error) console.error('notify', error)
}

/**
 * Envoie un e-mail depuis le webhook.
 *
 * Les paiements se jouent ici, sans que le membre soit devant son écran : une
 * communication laissée dans la seule application peut n'être lue que des
 * jours plus tard. Pour un échec de prélèvement, c'est trop tard.
 *
 * L'échec d'envoi ne fait jamais échouer le traitement du paiement : on trace
 * et on continue.
 */
async function sendMemberEmail(
  userId: string,
  template: string,
  vars: Record<string, unknown>,
) {
  try {
    const { data: prof } = await admin
      .from('profiles').select('email, display_name').eq('id', userId).maybeSingle()
    if (!prof?.email) return

    const res = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/send-email`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        template,
        to: prof.email,
        vars: { user_name: prof.display_name ?? '', ...vars },
      }),
    })
    if (!res.ok) console.error('sendMemberEmail', template, await res.text())
  } catch (err) {
    console.error('sendMemberEmail', template, err)
  }
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
          await consumeCreditNote(md.credit_note_id, md.user_id, 'registration_fee')
          await qualifyReferral(md.user_id)
          break
        }

        // ---- Abonnement : création + premier cycle ----
        if (md.kind === 'subscription' && session.subscription) {
          const sub = await stripe.subscriptions.retrieve(session.subscription as string)
          const period = periodOf(sub)

          const { data: subRow } = await admin.from('subscriptions').upsert({
            user_id: md.user_id,
            pack_type_id: md.pack_type_id,
            stripe_subscription_id: sub.id,
            stripe_customer_id: sub.customer as string,
            stripe_price_id: sub.items.data[0]?.price.id ?? '',
            stripe_mode: isLive ? 'live' : 'test',
            status: sub.status === 'active' || sub.status === 'trialing' ? 'active' : 'incomplete',
            current_period_start: period.start,
            current_period_end: period.end,
            cancel_at_period_end: sub.cancel_at_period_end,
          }, { onConflict: 'stripe_subscription_id' }).select().single()

          // Le premier cycle est crédité par l'invoice.paid qui suit — ne rien
          // faire ici évite de créditer deux fois.
          if (subRow) {
            // Le bon a servi à réduire la première facture (coupon
            // duration:once) : on le consomme ici, où les métadonnées de la
            // session le portent encore.
            await consumeCreditNote(md.credit_note_id, md.user_id, 'subscription')

            // Démarrage différé : Stripe met l'abonnement en `trialing` et
            // n'émettra la première facture qu'à `trial_end`. Annoncer
            // « abonnement actif » serait faux — le membre chercherait des
            // crédits qui n'arriveront qu'à cette date.
            const startsLater = sub.status === 'trialing' && sub.trial_end
              ? new Date(sub.trial_end * 1000)
              : null

            await notify(
              md.user_id,
              startsLater ? 'Abonnement enregistré' : 'Abonnement activé',
              startsLater
                ? `Votre abonnement débutera le ${startsLater.toLocaleDateString('fr-BE')}. Vos crédits seront disponibles à cette date, au premier prélèvement. Aucun montant n'est débité d'ici là.`
                : period.end
                  ? `Votre abonnement est actif. Prochaine échéance le ${new Date(period.end).toLocaleDateString('fr-BE')}.`
                  : 'Votre abonnement est actif.',
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
          await consumeCreditNote(md.credit_note_id, md.user_id, 'pack')
          await qualifyReferral(md.user_id)
        }
        break
      }

      // ====================================================================
      // Échéance payée : recharge le pack. C'est ici que se fait le
      // renouvellement, y compris pour le tout premier cycle.
      case 'invoice.paid': {
        const invoice = event.data.object as Stripe.Invoice
        const invoiceSubId = subscriptionIdOf(invoice)
        // Une facture sans abonnement (paiement isolé) ne nous concerne pas.
        if (!invoiceSubId) break

        // Décaler l'échéance passe par `trial_end` : Stripe clôt alors la
        // période d'essai en émettant une facture à 0 €. Sans ce filtre, elle
        // était comptée comme un cycle payé et créait un second pack — le
        // membre se retrouvait avec deux packs pour un seul paiement.
        // Un cycle réel a toujours un montant : 0 € = pas de cycle acheté.
        if (!invoice.amount_paid || invoice.amount_paid <= 0) {
          console.log('invoice.paid à 0 € ignorée (fin d\'essai / ajustement)', invoice.id)
          break
        }

        let { data: subRow } = await admin
          .from('subscriptions')
          .select('*, pack_type:pack_types(*)')
          .eq('stripe_subscription_id', invoiceSubId)
          .maybeSingle()

        // Stripe ne garantit pas l'ordre de livraison : invoice.paid peut
        // précéder checkout.session.completed, qui crée normalement la ligne.
        // Plutôt que d'abandonner le crédit, on crée l'abonnement ici à partir
        // des métadonnées portées par l'objet Stripe. L'upsert sur
        // stripe_subscription_id rend l'opération sûre si l'autre événement
        // arrive ensuite.
        if (!subRow) {
          console.log('invoice.paid avant checkout : création de l\'abonnement', invoiceSubId)
          const sub = await stripe.subscriptions.retrieve(invoiceSubId)
          const md = sub.metadata ?? {}

          if (!md.user_id || !md.pack_type_id) {
            console.error('Abonnement sans métadonnées exploitables', invoiceSubId)
            break
          }

          const period = periodOf(sub)
          const { data: created } = await admin.from('subscriptions').upsert({
            user_id: md.user_id,
            pack_type_id: md.pack_type_id,
            stripe_subscription_id: sub.id,
            stripe_customer_id: sub.customer as string,
            stripe_price_id: sub.items.data[0]?.price.id ?? '',
            stripe_mode: isLive ? 'live' : 'test',
            status: 'active',
            current_period_start: period.start,
            current_period_end: period.end,
            cancel_at_period_end: sub.cancel_at_period_end,
          }, { onConflict: 'stripe_subscription_id' })
            .select('*, pack_type:pack_types(*)')
            .single()

          subRow = created
        }

        if (!subRow) break

        const pt = subRow.pack_type as {
          credit_count: number; validity_days: number; name: string
        } | null
        if (!pt) break

        // Le pack couvre exactement le cycle facturé : les crédits vivent aussi
        // longtemps que la période payée, ni plus ni moins.
        const cyclePeriod = invoicePeriod(invoice)

        const { alreadyProcessed, expiresAt } = await creditPack({
          userId: subRow.user_id,
          packTypeId: subRow.pack_type_id,
          pricePaidCents: invoice.amount_paid,
          validityDays: pt.validity_days,
          creditCount: pt.credit_count,
          subscriptionId: subRow.id,
          stripeInvoiceId: invoice.id,
          periodStart: cyclePeriod.start,
          periodEnd: cyclePeriod.end,
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
          current_period_start: cyclePeriod.start,
          current_period_end: cyclePeriod.end,
        }).eq('id', subRow.id)

        await notify(
          subRow.user_id,
          'Abonnement renouvelé',
          `Votre abonnement ${pt.name} a été renouvelé. Crédits disponibles jusqu'au ${expiresAt.toLocaleDateString('fr-BE')}.`,
        )
        // La souscription initiale passe aussi par ici : c'est donc le point
        // de qualification pour un filleul qui commence par un abonnement.
        await qualifyReferral(subRow.user_id)
        break
      }

      // ====================================================================
      // Échec de paiement : on suspend le renouvellement, on ne résilie pas.
      // Une carte expirée ne doit pas coûter un client.
      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice
        const failedSubId = subscriptionIdOf(invoice)
        if (!failedSubId) break

        const { data: subRow } = await admin
          .from('subscriptions')
          .select('*, pack_type:pack_types(name)')
          .eq('stripe_subscription_id', failedSubId)
          .maybeSingle()
        if (!subRow) break

        await admin.from('subscriptions')
          .update({ status: 'past_due' })
          .eq('id', subRow.id)

        const { data: prof } = await admin
          .from('profiles').select('display_name').eq('id', subRow.user_id).maybeSingle()

        const failedPackName = (subRow.pack_type as { name?: string } | null)?.name

        // L'application seule ne suffit pas ici : le membre n'est pas devant
        // son écran quand le prélèvement échoue, et il peut perdre son
        // abonnement sans l'avoir su. L'e-mail est le seul canal qui le
        // rattrape à temps.
        await notify(
          subRow.user_id,
          'Paiement refusé',
          'Le renouvellement de votre abonnement n\'a pas abouti. Vérifiez votre moyen de paiement — nous réessaierons automatiquement.',
          'error', '/my-packs',
          'payment_failed',
        )
        await sendMemberEmail(subRow.user_id, 'payment_failed', {
          pack_name: failedPackName,
        })
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

        const period = periodOf(sub)
        const md = sub.metadata ?? {}

        const { data: touched } = await admin.from('subscriptions').update({
          status,
          current_period_start: period.start,
          current_period_end: period.end,
          cancel_at_period_end: sub.cancel_at_period_end,
          paused_at: paused ? new Date().toISOString() : null,
          stripe_price_id: sub.items.data[0]?.price.id ?? '',
        }).eq('stripe_subscription_id', sub.id).select('id')

        // Un UPDATE qui ne touche aucune ligne ne renvoie pas d'erreur : si cet
        // événement précède checkout.session.completed, l'état serait perdu
        // sans bruit. On crée alors la ligne à partir des métadonnées.
        if ((touched?.length ?? 0) === 0 && md.user_id && md.pack_type_id) {
          await admin.from('subscriptions').upsert({
            user_id: md.user_id,
            pack_type_id: md.pack_type_id,
            stripe_subscription_id: sub.id,
            stripe_customer_id: sub.customer as string,
            stripe_price_id: sub.items.data[0]?.price.id ?? '',
            stripe_mode: isLive ? 'live' : 'test',
            status,
            current_period_start: period.start,
            current_period_end: period.end,
            cancel_at_period_end: sub.cancel_at_period_end,
            paused_at: paused ? new Date().toISOString() : null,
          }, { onConflict: 'stripe_subscription_id' })
        }
        break
      }

      // ====================================================================
      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription
        const endedAt = new Date()

        const { data: subRow } = await admin
          .from('subscriptions')
          .update({ status: 'canceled', canceled_at: endedAt.toISOString() })
          .eq('stripe_subscription_id', sub.id)
          .select('id, user_id, current_period_end')
          .maybeSingle()

        if (!subRow) break

        // Deux résiliations très différentes, à distinguer par la date de fin :
        //   - en fin de période : le terme payé est atteint, les packs ont
        //     expiré d'eux-mêmes. Rien à faire.
        //   - immédiate : le studio coupe avant le terme. Le pack doit être
        //     clôturé aussi (décision du 2026-08-05), sinon le membre continue
        //     de s'entraîner sans payer — et l'avertissement affiché à l'admin
        //     (« le membre perd immédiatement l'accès ») serait mensonger.
        const periodEnd = subRow.current_period_end ? new Date(subRow.current_period_end) : null
        const endedEarly = periodEnd ? endedAt < periodEnd : false

        let closedPacks = 0
        if (endedEarly) {
          const { data: closed } = await admin
            .from('pack_purchases')
            .update({ expires_at: endedAt.toISOString() })
            .eq('subscription_id', subRow.id)
            .gt('expires_at', endedAt.toISOString())
            .select('id')
          closedPacks = closed?.length ?? 0
        }

        await notify(
          subRow.user_id,
          'Abonnement terminé',
          closedPacks > 0
            ? 'Votre abonnement a pris fin et vos accès sont clôturés. Contactez le studio pour toute question.'
            : 'Votre abonnement a pris fin. Vos crédits en cours restent utilisables jusqu\'à leur date d\'expiration.',
          'info', '/my-packs',
        )
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

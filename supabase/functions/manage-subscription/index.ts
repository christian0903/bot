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

/**
 * Fin du cycle courant, en français.
 *
 * Les API Stripe récentes ont déplacé `current_period_end` de la racine de
 * l'abonnement vers ses items : lire la racine seule produisait « Invalid
 * Date » dans les messages de confirmation.
 */
function periodEndLabel(sub: Stripe.Subscription): string | null {
  // deno-lint-ignore no-explicit-any
  const item = (sub.items?.data?.[0] ?? {}) as any
  // deno-lint-ignore no-explicit-any
  const ts = item.current_period_end ?? (sub as any).current_period_end
  if (typeof ts !== 'number' || !Number.isFinite(ts)) return null
  const d = new Date(ts * 1000)
  return Number.isNaN(d.getTime()) ? null : d.toLocaleDateString('fr-BE')
}

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

    /** Trace le geste du studio : ces décisions doivent rester lisibles après coup. */
    const logAction = async (act: string, description: string, details: Record<string, unknown> = {}) => {
      await admin.from('activity_log').insert({
        action: act,
        actor_id: user.id,
        target_user_id: subRow.user_id,
        entity_type: 'subscription',
        entity_id: subRow.id,
        details,
        description,
      })
    }

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

        await logAction(
          'subscription_discounted',
          `Réduction accordée : ${percent_off ? `-${percent_off} %` : `-${(Number(amount_off_cents) / 100).toFixed(2)} €`}${reason ? ` (${reason})` : ''}`,
          { percent_off: percent_off ?? null, amount_off_cents: amount_off_cents ?? null, reason: reason ?? null },
        )

        return json({
          ok: true,
          message: 'Réduction appliquée à la prochaine échéance uniquement.',
        })
      }

      // ====================================================================
      // Décaler l'échéance : tous les cycles suivants suivent la nouvelle
      // date. `proration_behavior: 'none'` — l'intervalle offert n'est pas
      // facturé, c'est le geste attendu pour des congés ou une blessure.
      //
      // Le pack en cours est prolongé d'autant. Décidé le 2026-08-05 : une
      // maladie déclarée en milieu de cycle ne se « met pas en pause », elle
      // se compense. Couper l'accès ne protégerait rien (la personne empêchée
      // ne vient pas), et sur un illimité cela n'aurait aucun sens.
      case 'postpone': {
        if (!new_date) return json({ error: 'new_date est requis' }, 400)

        const target = new Date(new_date)
        if (Number.isNaN(target.getTime())) {
          return json({ error: 'Date invalide' }, 400)
        }

        const anchor = Math.floor(target.getTime() / 1000)
        if (anchor <= Math.floor(Date.now() / 1000)) {
          return json({ error: 'La nouvelle date doit être dans le futur' }, 400)
        }

        // Mesuré depuis l'échéance connue, pas depuis aujourd'hui : c'est le
        // décalage réel du cycle, indépendamment du moment de la demande.
        const previousEnd = subRow.current_period_end
          ? new Date(subRow.current_period_end)
          : null

        // Un report ne peut que repousser. Une date antérieure avancerait le
        // prélèvement et raccourcirait le pack (décalage négatif) : le membre
        // paierait plus tôt et perdrait des jours d'accès. Refusé ici même si
        // le formulaire l'interdit déjà — la fonction est appelable seule.
        if (previousEnd && target <= previousEnd) {
          return json({
            error: `La nouvelle date doit être postérieure à l'échéance actuelle (${previousEnd.toLocaleDateString('fr-BE')}).`,
          }, 400)
        }

        // Garde-fou : au-delà d'un an, c'est presque sûrement une faute de
        // saisie (année mal tapée). Le studio peut toujours refaire l'opération.
        if (previousEnd) {
          const maxShiftDays = 365
          const shiftDays = (target.getTime() - previousEnd.getTime()) / 86400000
          if (shiftDays > maxShiftDays) {
            return json({
              error: `Report de ${Math.round(shiftDays)} jours refusé : le maximum est de ${maxShiftDays} jours.`,
            }, 400)
          }
        }

        const updated = await stripe.subscriptions.update(subId, {
          trial_end: anchor,
          proration_behavior: 'none',
        })

        let extendedUntil: string | null = null
        if (previousEnd) {
          const shiftMs = new Date(anchor * 1000).getTime() - previousEnd.getTime()
          if (shiftMs > 0) {
            // Le pack vivant du cycle courant : celui qui n'a pas encore expiré.
            const { data: pack } = await admin
              .from('pack_purchases')
              .select('id, expires_at')
              .eq('subscription_id', subRow.id)
              .order('purchased_at', { ascending: false })
              .limit(1)
              .maybeSingle()

            if (pack) {
              const newExpiry = new Date(new Date(pack.expires_at).getTime() + shiftMs)
              await admin
                .from('pack_purchases')
                .update({ expires_at: newExpiry.toISOString() })
                .eq('id', pack.id)
              extendedUntil = newExpiry.toLocaleDateString('fr-BE')
            }
          }
        }

        await admin.from('activity_log').insert({
          action: 'subscription_postponed',
          actor_id: user.id,
          target_user_id: subRow.user_id,
          entity_type: 'subscription',
          entity_id: subRow.id,
          details: {
            new_date: new Date(anchor * 1000).toISOString(),
            previous_end: previousEnd?.toISOString() ?? null,
            pack_extended_until: extendedUntil,
          },
          description: `Échéance décalée au ${new Date(anchor * 1000).toLocaleDateString('fr-BE')}${extendedUntil ? `, accès prolongé jusqu'au ${extendedUntil}` : ''}`,
        })

        const label = periodEndLabel(updated)
        return json({
          ok: true,
          message: label
            ? `Prochaine échéance décalée au ${label}.${extendedUntil ? ` L'accès est prolongé jusqu'au ${extendedUntil}.` : ''}`
            : 'Prochaine échéance décalée.',
        })
      }

      // ====================================================================
      // Suspendre : les prélèvements s'arrêtent, l'abonnement reste en place.
      case 'pause': {
        await stripe.subscriptions.update(subId, {
          pause_collection: { behavior: 'void' },
        })
        await logAction('subscription_paused', 'Abonnement suspendu par le studio')
        return json({ ok: true, message: 'Abonnement suspendu. Aucun prélèvement jusqu\'à la reprise.' })
      }

      case 'resume': {
        await stripe.subscriptions.update(subId, { pause_collection: null })
        await logAction('subscription_resumed', 'Abonnement réactivé par le studio')
        return json({ ok: true, message: 'Abonnement réactivé.' })
      }

      // ====================================================================
      // Résilier. Par défaut en fin de période : le membre garde ses droits
      // jusqu'au terme qu'il a payé.
      case 'cancel': {
        if (immediately) {
          await stripe.subscriptions.cancel(subId)

          // Clôture des accès en cours. Le webhook customer.subscription.deleted
          // fait la même chose, mais il peut arriver avec du retard : l'admin
          // doit voir l'effet tout de suite. L'opération est idempotente.
          const now = new Date().toISOString()
          const { data: closed } = await admin
            .from('pack_purchases')
            .update({ expires_at: now })
            .eq('subscription_id', subRow.id)
            .gt('expires_at', now)
            .select('id')

          await admin.from('subscriptions')
            .update({ status: 'canceled', canceled_at: now })
            .eq('id', subRow.id)

          const n = closed?.length ?? 0
          await logAction(
            'subscription_cancelled',
            `Abonnement résilié immédiatement par le studio${n > 0 ? `, ${n} accès clôturé(s)` : ''}`,
            { immediately: true, packs_closed: n },
          )
          return json({
            ok: true,
            message: n > 0
              ? 'Abonnement résilié et accès clôturés immédiatement.'
              : 'Abonnement résilié immédiatement.',
          })
        }
        const updated = await stripe.subscriptions.update(subId, {
          cancel_at_period_end: true,
        })
        const endLabel = periodEndLabel(updated)
        await logAction(
          'subscription_cancelled',
          `Résiliation programmée par le studio${endLabel ? ` au ${endLabel}` : ' en fin de période'}`,
        )
        return json({
          ok: true,
          message: endLabel
            ? `Résiliation programmée au ${endLabel}. Les droits sont conservés jusque-là.`
            : 'Résiliation programmée en fin de période. Les droits sont conservés jusque-là.',
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

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Stripe from 'https://esm.sh/stripe@14?target=deno'

serve(async (req) => {
  try {
    const signature = req.headers.get('stripe-signature')
    if (!signature) {
      return new Response('Missing stripe-signature', { status: 400 })
    }

    const body = await req.text()

    // Determine which webhook secret to use
    const adminClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const { data: stripeModeSetting } = await adminClient
      .from('app_settings')
      .select('value')
      .eq('key', 'stripe_mode')
      .single()

    const isLive = stripeModeSetting?.value?.mode === 'live'
    const stripeKey = isLive
      ? Deno.env.get('STRIPE_SECRET_KEY_LIVE')!
      : Deno.env.get('STRIPE_SECRET_KEY_TEST')!
    const webhookSecret = isLive
      ? Deno.env.get('STRIPE_WEBHOOK_SECRET_LIVE')!
      : Deno.env.get('STRIPE_WEBHOOK_SECRET_TEST')!

    const stripe = new Stripe(stripeKey, { apiVersion: '2023-10-16' })

    const event = stripe.webhooks.constructEvent(body, signature, webhookSecret)

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session
      const metadata = session.metadata!

      const userId = metadata.user_id
      const packTypeId = metadata.pack_type_id
      const pricePaidCents = parseInt(metadata.price_paid_cents)
      const couponId = metadata.coupon_id || null
      const validityDays = parseInt(metadata.validity_days)
      const creditCount = parseInt(metadata.credit_count)

      // Calculate expiry date
      const purchasedAt = new Date()
      const expiresAt = new Date(purchasedAt)
      expiresAt.setDate(expiresAt.getDate() + validityDays)

      // Create pack purchase
      const { error: purchaseError } = await adminClient
        .from('pack_purchases')
        .insert({
          user_id: userId,
          pack_type_id: packTypeId,
          price_paid_cents: pricePaidCents,
          credits_remaining: creditCount,
          purchased_at: purchasedAt.toISOString(),
          expires_at: expiresAt.toISOString(),
          stripe_payment_intent_id: session.payment_intent as string,
          coupon_id: couponId,
        })

      if (purchaseError) {
        console.error('Error creating pack purchase:', purchaseError)
        return new Response(JSON.stringify({ error: purchaseError.message }), { status: 500 })
      }

      // Increment coupon usage if used
      if (couponId) {
        await adminClient.rpc('increment_coupon_usage', { p_coupon_id: couponId })
      }

      // Send notification to user
      await adminClient.from('notifications').insert({
        user_id: userId,
        title: 'Achat confirmé',
        message: `Votre pack a été activé avec ${creditCount} crédit(s). Valide jusqu'au ${expiresAt.toLocaleDateString('fr-FR')}.`,
        type: 'success',
        link: '/my-packs',
      })

      console.log(`Pack purchase created for user ${userId}`)
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('Webhook error:', err)
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }
})

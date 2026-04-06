import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Stripe from 'https://esm.sh/stripe@14?target=deno'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      {
        global: { headers: { Authorization: req.headers.get('Authorization')! } },
      }
    )

    // Verify user
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser()
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { pack_type_id, coupon_code, success_url, cancel_url } = await req.json()

    if (!pack_type_id) {
      return new Response(JSON.stringify({ error: 'pack_type_id is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Fetch pack type
    const adminClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const { data: packType, error: packError } = await adminClient
      .from('pack_types')
      .select('*, credit_type:credit_types(*)')
      .eq('id', pack_type_id)
      .eq('is_active', true)
      .single()

    if (packError || !packType) {
      return new Response(JSON.stringify({ error: 'Pack type not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Check user's category is eligible
    const { data: profile } = await adminClient
      .from('profiles')
      .select('member_category_id')
      .eq('id', user.id)
      .single()

    if (profile?.member_category_id) {
      const { data: eligibleCategories } = await adminClient
        .from('pack_type_categories')
        .select('member_category_id')
        .eq('pack_type_id', pack_type_id)

      if (eligibleCategories && eligibleCategories.length > 0) {
        const isEligible = eligibleCategories.some(
          (c: { member_category_id: string }) => c.member_category_id === profile.member_category_id
        )
        if (!isEligible) {
          return new Response(JSON.stringify({ error: 'Not eligible for this pack' }), {
            status: 403,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          })
        }
      }
    }

    // Determine Stripe mode
    const { data: stripeModeSetting } = await adminClient
      .from('app_settings')
      .select('value')
      .eq('key', 'stripe_mode')
      .single()

    const isLive = stripeModeSetting?.value?.mode === 'live'
    const stripeKey = isLive
      ? Deno.env.get('STRIPE_SECRET_KEY_LIVE')!
      : Deno.env.get('STRIPE_SECRET_KEY_TEST')!

    const stripe = new Stripe(stripeKey, { apiVersion: '2023-10-16' })

    let priceCents = packType.price_cents

    // Apply coupon if provided
    let couponId: string | null = null
    if (coupon_code) {
      const { data: coupon } = await adminClient
        .from('coupons')
        .select('*')
        .eq('code', coupon_code.toUpperCase())
        .eq('is_active', true)
        .single()

      if (coupon) {
        const now = new Date()
        const validFrom = new Date(coupon.valid_from)
        const validUntil = coupon.valid_until ? new Date(coupon.valid_until) : null

        if (now >= validFrom && (!validUntil || now <= validUntil)) {
          if (!coupon.max_uses || coupon.current_uses < coupon.max_uses) {
            couponId = coupon.id
            if (coupon.discount_percent) {
              priceCents = Math.round(priceCents * (1 - coupon.discount_percent / 100))
            } else if (coupon.discount_amount_cents) {
              priceCents = Math.max(0, priceCents - coupon.discount_amount_cents)
            }
          }
        }
      }
    }

    // Create Stripe Checkout Session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'eur',
            product_data: {
              name: packType.name,
              description: `${packType.credit_count} crédit(s) - ${packType.credit_type?.label_fr}`,
            },
            unit_amount: priceCents,
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: success_url || `${req.headers.get('origin')}/my-packs?success=true`,
      cancel_url: cancel_url || `${req.headers.get('origin')}/packs?cancelled=true`,
      metadata: {
        user_id: user.id,
        pack_type_id: pack_type_id,
        price_paid_cents: priceCents.toString(),
        coupon_id: couponId || '',
        validity_days: packType.validity_days.toString(),
        credit_count: packType.credit_count.toString(),
      },
      customer_email: user.email,
    })

    return new Response(JSON.stringify({ url: session.url, session_id: session.id }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error(err)
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})

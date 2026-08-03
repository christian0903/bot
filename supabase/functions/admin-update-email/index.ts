import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function jsonError(msg: string, status: number) {
  return new Response(JSON.stringify({ error: msg }), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

interface Payload {
  user_id: string
  new_email: string
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return jsonError('Unauthorized', 401)

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const appUrl = Deno.env.get('APP_URL') ?? 'https://desk.backontrackstudio.be'

    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    })

    const { data: { user: caller } } = await callerClient.auth.getUser()
    if (!caller) return jsonError('Unauthorized', 401)

    const { data: roles } = await callerClient
      .from('user_roles').select('role').eq('user_id', caller.id)
    const isAdmin = (roles ?? []).some(r => r.role === 'admin' || r.role === 'super_admin')
    if (!isAdmin) return jsonError('Forbidden: admin required', 403)

    const payload = (await req.json()) as Payload
    const newEmail = (payload.new_email ?? '').trim().toLowerCase()
    if (!payload.user_id || !newEmail) return jsonError('user_id and new_email required', 400)
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail)) return jsonError('Invalid email', 400)

    const adminClient = createClient(supabaseUrl, serviceKey)

    const { data: target, error: getErr } = await adminClient.auth.admin.getUserById(payload.user_id)
    if (getErr || !target?.user) return jsonError('User not found', 404)
    const oldEmail = target.user.email
    if (!oldEmail) return jsonError('Target user has no email', 400)
    if (oldEmail.toLowerCase() === newEmail) return jsonError('Already the current email', 400)

    // Génère le lien de confirmation envoyé à la NOUVELLE adresse.
    // Quand l'utilisateur clique, Supabase met à jour auth.users.email,
    // et le trigger sync_profile_email répercute dans profiles.email.
    const { data: linkData, error: linkErr } = await adminClient.auth.admin.generateLink({
      type: 'email_change_new',
      email: oldEmail,
      newEmail,
      options: { redirectTo: `${appUrl}/auth/email-changed` },
    })
    if (linkErr || !linkData?.properties?.action_link) {
      return jsonError(linkErr?.message ?? 'Failed to generate link', 500)
    }

    const { data: profile } = await adminClient
      .from('profiles').select('display_name').eq('id', payload.user_id).single()

    const sendRes = await fetch(`${supabaseUrl}/functions/v1/send-email`, {
      method: 'POST',
      headers: {
        Authorization: authHeader,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        template: 'email_change_by_admin',
        to: newEmail,
        vars: {
          user_name: profile?.display_name ?? '',
          new_email: newEmail,
          confirmation_url: linkData.properties.action_link,
          app_url: appUrl,
        },
      }),
    })

    if (!sendRes.ok) {
      const errText = await sendRes.text()
      return jsonError(`Email send failed: ${errText}`, 500)
    }

    return new Response(JSON.stringify({ ok: true, new_email: newEmail }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    return jsonError((err as Error).message, 500)
  }
})

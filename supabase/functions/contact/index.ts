// ============================================================================
// contact — le formulaire du site vitrine
// ----------------------------------------------------------------------------
// La seule fonction du projet ouverte SANS authentification : un visiteur qui
// ecrit n'a pas de compte, c'est tout l'objet du formulaire. Elle est donc la
// seule a devoir se defendre seule, et c'est ce qui explique l'essentiel du
// code ci-dessous.
//
// Elle remplace le formulaire WordPress, hors service depuis un moment : la
// page affichait « Google reCaptcha : Cle de site invalide » et aucun message
// ne partait. Combien de prospects perdus, personne ne le sait.
//
// Deploiement — comme le webhook Stripe, elle se passe de jeton :
//     supabase functions deploy contact --no-verify-jwt
// ============================================================================
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const FROM_EMAIL = Deno.env.get('EMAIL_FROM') ?? 'Back On Track <no-reply@backontrackstudio.be>'
// Ou arrivent les demandes. C'est l'adresse du studio, celle qui remplace
// l'ancienne boite Gmail.
//
// Attention en la modifiant : `app_settings.studio_info.email` portait, elle,
// `info@backotrackstudio.be` — sans le « n » de « track ». Ne pas recopier une
// valeur de la base sans la relire.
const DESTINATAIRE = Deno.env.get('CONTACT_TO') ?? 'info@backontrackstudio.be'

// Limitation du debit — EN BASE, et non en memoire.
//
// La premiere version comptait dans une Map de l'instance. Eprouve en ligne :
// dix envois consecutifs sont passes sans jamais etre refuses. Supabase
// repartit les requetes sur plusieurs instances, et chacune repartait de zero.
// La protection n'existait que sur le papier.
//
// `contact_debit_depasse` compte et enregistre en une seule requete : deux
// appels separes laisseraient passer deux envois simultanes.
const MAX_PAR_HEURE = 5

async function tropDeMessages(ip: string): Promise<boolean> {
  const url = Deno.env.get('SUPABASE_URL')
  const cle = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  // Sans acces a la base, on laisse passer plutot que de bloquer : un
  // formulaire muet coute des prospects, un message de trop n'en coute aucun.
  if (!url || !cle) return false

  const admin = createClient(url, cle)
  const { data, error } = await admin.rpc('contact_debit_depasse', {
    p_ip: ip,
    p_max: MAX_PAR_HEURE,
  })
  if (error) {
    console.error('limite de debit indisponible:', error.message)
    return false
  }
  return data === true
}

// Un texte insere dans un e-mail HTML doit etre echappe : sans cela, un message
// contenant du balisage s'executerait dans la boite de reception du studio.
function echapper(texte: string): string {
  return texte
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Méthode non autorisée' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  try {
    const corps = await req.json()
    const nom = String(corps.nom ?? '').trim()
    const email = String(corps.email ?? '').trim()
    const telephone = String(corps.telephone ?? '').trim()
    const message = String(corps.message ?? '').trim()
    const piege = String(corps.site ?? '').trim()

    // Le champ-piege : invisible pour un humain, rempli par la plupart des
    // robots qui completent tout ce qu'ils trouvent. On repond 200 plutot que
    // 400 — un robot qui recoit une erreur reessaie, un robot qui croit avoir
    // reussi passe au suivant.
    if (piege) {
      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (!nom || !email || !message) {
      return new Response(JSON.stringify({ error: 'Nom, e-mail et message sont obligatoires.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      return new Response(JSON.stringify({ error: "Cette adresse e-mail ne semble pas valide." }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    // Bornes hautes : un message de 50 000 caracteres n'est jamais une demande
    // de seance d'essai.
    if (nom.length > 120 || email.length > 200 || telephone.length > 40 || message.length > 5000) {
      return new Response(JSON.stringify({ error: 'Message trop long.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? 'inconnue'
    if (await tropDeMessages(ip)) {
      return new Response(JSON.stringify({ error: 'Trop de messages envoyés. Réessayez dans un moment.' }), {
        status: 429,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const apiKey = Deno.env.get('RESEND_API_KEY')
    if (!apiKey) throw new Error('RESEND_API_KEY manquante')

    const html = `
      <h2>Nouveau message depuis le site</h2>
      <p><strong>Nom :</strong> ${echapper(nom)}</p>
      <p><strong>E-mail :</strong> ${echapper(email)}</p>
      ${telephone ? `<p><strong>Téléphone :</strong> ${echapper(telephone)}</p>` : ''}
      <hr>
      <p style="white-space:pre-wrap">${echapper(message)}</p>
    `

    const reponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: [DESTINATAIRE],
        // `reply_to` sur l'adresse du visiteur : repondre depuis la boite du
        // studio lui ecrit directement, sans copier-coller son adresse.
        reply_to: email,
        subject: `Site — message de ${nom}`,
        html,
      }),
    })

    if (!reponse.ok) {
      const detail = await reponse.text()
      console.error('Resend a refuse:', reponse.status, detail)
      throw new Error(`Resend ${reponse.status}`)
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (e) {
    console.error('contact:', e)
    // Le detail reste dans les journaux : un message d'erreur technique
    // renvoye au visiteur ne l'aide pas et renseigne un attaquant.
    return new Response(JSON.stringify({ error: "L'envoi a échoué. Réessayez ou écrivez-nous directement." }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})

export type TemplateKey =
  | 'booking_confirmed'
  | 'booking_cancelled_by_self'
  | 'booking_created_by_staff'
  | 'booking_cancelled_by_staff'
  | 'class_modified'
  | 'class_cancelled'
  | 'password_reset_by_admin'
  | 'email_change_notice'
  | 'email_change_by_admin'

export interface TemplateVars {
  user_name?: string
  class_name?: string
  class_date?: string        // ex: "mardi 22 avril 2026 à 10:00"
  old_class_date?: string    // pour class_modified
  coach_name?: string
  room_name?: string
  duration_minutes?: number
  refunded?: boolean         // pour booking_cancelled_by_self
  new_email?: string         // pour email_change_notice / email_change_by_admin
  confirmation_url?: string  // pour email_change_by_admin
  app_url?: string
}

function shell(title: string, body: string) {
  return `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<title>${title}</title>
</head>
<body style="margin:0;padding:24px;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#18181b;">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:16px;overflow:hidden;">
    <tr>
      <td style="padding:28px 32px;background:#0a0a0a;color:#ffffff;">
        <div style="font-size:13px;letter-spacing:2px;opacity:0.7;text-transform:uppercase;">Back On Track</div>
        <div style="font-size:22px;font-weight:700;margin-top:8px;">${title}</div>
      </td>
    </tr>
    <tr>
      <td style="padding:28px 32px;font-size:15px;line-height:1.6;">
        ${body}
      </td>
    </tr>
    <tr>
      <td style="padding:18px 32px;background:#fafafa;font-size:12px;color:#71717a;border-top:1px solid #e4e4e7;">
        Back On Track — SRL Aikicom Perspectives<br>
        Cet email vous a été envoyé suite à une action sur votre compte.
      </td>
    </tr>
  </table>
</body>
</html>`
}

function detailsBlock(v: TemplateVars) {
  const rows: string[] = []
  if (v.class_name) rows.push(`<strong>Cours :</strong> ${v.class_name}`)
  if (v.class_date) rows.push(`<strong>Quand :</strong> ${v.class_date}`)
  if (v.coach_name) rows.push(`<strong>Coach :</strong> ${v.coach_name}`)
  if (v.room_name) rows.push(`<strong>Salle :</strong> ${v.room_name}`)
  if (v.duration_minutes) rows.push(`<strong>Durée :</strong> ${v.duration_minutes} min`)
  return `<div style="background:#f4f4f5;border-radius:8px;padding:16px 18px;margin:18px 0;font-size:14px;">
    ${rows.join('<br>')}
  </div>`
}

function cta(url: string, label: string) {
  return `<div style="margin:24px 0 8px;"><a href="${url}" style="display:inline-block;background:#0a0a0a;color:#ffffff;padding:12px 22px;border-radius:999px;text-decoration:none;font-weight:600;font-size:14px;">${label}</a></div>`
}

export function buildTemplate(template: TemplateKey, v: TemplateVars): { subject: string; html: string } {
  const appUrl = v.app_url ?? 'https://desk.backontrackstudio.be'
  const hello = v.user_name ? `Bonjour ${v.user_name},` : 'Bonjour,'

  switch (template) {
    case 'booking_confirmed': {
      const subject = `Réservation confirmée — ${v.class_name}`
      const body = `
        <p>${hello}</p>
        <p>Votre réservation est bien enregistrée.</p>
        ${detailsBlock(v)}
        <p>À très vite au studio !</p>
        ${cta(`${appUrl}/my-bookings`, 'Voir mes réservations')}
      `
      return { subject, html: shell('Réservation confirmée', body) }
    }

    case 'booking_cancelled_by_self': {
      const subject = `Annulation confirmée — ${v.class_name}`
      const refundText = v.refunded
        ? '<p>Votre crédit a été <strong>restitué</strong>.</p>'
        : '<p>⚠️ Annulation tardive : <strong>le crédit n\'a pas été restitué</strong>.</p>'
      const body = `
        <p>${hello}</p>
        <p>Votre annulation est bien prise en compte.</p>
        ${detailsBlock(v)}
        ${refundText}
        ${cta(`${appUrl}/schedule`, 'Voir le planning')}
      `
      return { subject, html: shell('Annulation confirmée', body) }
    }

    case 'booking_created_by_staff': {
      const subject = `Inscription à un cours — ${v.class_name}`
      const body = `
        <p>${hello}</p>
        <p>L'équipe Back On Track vous a inscrit(e) au cours suivant :</p>
        ${detailsBlock(v)}
        <p>Si ce n'est pas ce que vous souhaitez, vous pouvez annuler depuis l'application.</p>
        ${cta(`${appUrl}/my-bookings`, 'Voir mes réservations')}
      `
      return { subject, html: shell('Nouvelle inscription', body) }
    }

    case 'booking_cancelled_by_staff': {
      const subject = `Réservation annulée — ${v.class_name}`
      const refundText = v.refunded
        ? '<p>Votre crédit a été <strong>restitué</strong>.</p>'
        : ''
      const body = `
        <p>${hello}</p>
        <p>L'équipe a annulé votre inscription au cours :</p>
        ${detailsBlock(v)}
        ${refundText}
        <p>Contactez-nous si vous avez une question.</p>
        ${cta(`${appUrl}/schedule`, 'Voir le planning')}
      `
      return { subject, html: shell('Inscription annulée', body) }
    }

    case 'class_modified': {
      const subject = `Cours modifié — ${v.class_name}`
      const oldRow = v.old_class_date
        ? `<p style="color:#a16207;"><strong>Ancien horaire :</strong> ${v.old_class_date}</p>`
        : ''
      const body = `
        <p>${hello}</p>
        <p>Un cours auquel vous êtes inscrit(e) a été <strong>modifié</strong>.</p>
        ${oldRow}
        <p><strong>Nouvelles informations :</strong></p>
        ${detailsBlock(v)}
        ${cta(`${appUrl}/my-bookings`, 'Voir mes réservations')}
      `
      return { subject, html: shell('Cours modifié', body) }
    }

    case 'class_cancelled': {
      const subject = `Cours annulé — ${v.class_name}`
      const body = `
        <p>${hello}</p>
        <p>Nous sommes désolés, le cours suivant a été <strong>annulé</strong> :</p>
        ${detailsBlock(v)}
        <p>Votre crédit a été <strong>restitué automatiquement</strong>. Vous pouvez réserver un autre cours dès maintenant.</p>
        ${cta(`${appUrl}/schedule`, 'Voir le planning')}
      `
      return { subject, html: shell('Cours annulé', body) }
    }

    case 'password_reset_by_admin': {
      const subject = 'Votre mot de passe a été réinitialisé'
      const body = `
        <p>${hello}</p>
        <p>Un administrateur de Back On Track a <strong>réinitialisé votre mot de passe</strong>.</p>
        <p>Connectez-vous avec le nouveau mot de passe qui vous a été communiqué directement par l'administrateur.</p>
        <p style="color:#a16207;font-size:13px;">Si vous n'êtes pas à l'origine de cette demande, contactez-nous immédiatement.</p>
        ${cta(`${appUrl}/auth`, 'Se connecter')}
      `
      return { subject, html: shell('Mot de passe réinitialisé', body) }
    }

    case 'email_change_by_admin': {
      const subject = 'Confirmez votre nouvelle adresse email — Back On Track'
      const body = `
        <p>${hello}</p>
        <p>Un administrateur de Back On Track a initié un <strong>changement d'adresse email</strong> sur votre compte (typiquement pour corriger une adresse mal saisie).</p>
        <p>Votre nouvelle adresse sera : <strong>${v.new_email ?? ''}</strong></p>
        <p>Cliquez sur le bouton ci-dessous pour <strong>confirmer ce changement</strong>. Sans confirmation, votre adresse actuelle reste inchangée.</p>
        ${cta(v.confirmation_url ?? '#', 'Confirmer ma nouvelle adresse')}
        <p style="background:#fef3c7;border-radius:8px;padding:12px 14px;color:#92400e;font-size:14px;margin:18px 0;">
          ⚠️ <strong>Vous n'avez rien demandé&nbsp;?</strong><br>
          Ne cliquez pas sur le lien et contactez-nous immédiatement.
        </p>
      `
      return { subject, html: shell('Confirmer votre nouvelle adresse', body) }
    }

    case 'email_change_notice': {
      const subject = 'Votre adresse email va changer'
      const body = `
        <p>${hello}</p>
        <p>Une demande de <strong>changement d'email</strong> a été initiée depuis votre compte Back On Track.</p>
        <p>Votre nouvelle adresse sera : <strong>${v.new_email ?? ''}</strong></p>
        <p>Un email de confirmation a été envoyé à cette nouvelle adresse. Le changement sera effectif dès que vous aurez cliqué sur le lien de confirmation.</p>
        <p style="background:#fef3c7;border-radius:8px;padding:12px 14px;color:#92400e;font-size:14px;margin:18px 0;">
          ⚠️ <strong>Vous n'êtes pas à l'origine de cette demande ?</strong><br>
          Connectez-vous immédiatement et changez votre mot de passe, ou contactez-nous.
        </p>
        ${cta(`${appUrl}/auth`, 'Se connecter')}
      `
      return { subject, html: shell('Changement d\'adresse email', body) }
    }
  }
}

import { supabase } from '@/lib/supabase'
import { sendEmail, type EmailTemplate, type EmailVars } from '@/lib/send-email'
import type { Notification } from '@/types'

/**
 * Prévient un membre : trace dans l'application, e-mail si sa préférence
 * l'autorise.
 *
 * L'ordre compte. Jusqu'ici l'e-mail était le canal principal et la
 * notification un ajout écrit à la main juste à côté — six envois sur
 * quatorze l'avaient oublié. Ici la notification part TOUJOURS : elle est la
 * trace, l'e-mail n'est qu'un rappel. Tout le monde ne lit pas ses e-mails.
 *
 * Conséquence directe : `emailOptOut` ne coupe que l'e-mail. Un membre qui a
 * désactivé les e-mails de réservation garde l'information dans l'application
 * — il a refusé un canal, pas l'information elle-même.
 */
export async function notifyMember(opts: {
  userId: string
  title: string
  message: string
  type?: Notification['type']
  link?: string
  /** E-mail à envoyer en parallèle. Omis : communication in-app seulement. */
  email?: {
    to: string | null | undefined
    template: EmailTemplate
    vars: EmailVars
    /** `true` quand le membre a désactivé ce type d'e-mail. La notification part quand même. */
    optOut?: boolean
  }
}): Promise<void> {
  const { error } = await supabase.from('notifications').insert({
    user_id: opts.userId,
    title: opts.title,
    message: opts.message,
    type: opts.type ?? 'info',
    link: opts.link ?? null,
    // Sert à afficher « aussi envoyé par e-mail » sur l'accueil, et au studio
    // à vérifier qu'une communication a bien emprunté les deux canaux.
    email_template: opts.email && !opts.email.optOut ? opts.email.template : null,
  })

  // Supabase ne lève pas d'exception sur un refus : sans ce contrôle, la
  // communication disparaîtrait en silence (le piège du 6 août).
  if (error) console.error('[notify-member] notification non créée:', error)

  if (opts.email?.to && !opts.email.optOut) {
    await sendEmail(opts.email.template, opts.email.to, opts.email.vars)
  }
}

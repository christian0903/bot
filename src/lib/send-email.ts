import { supabase } from '@/lib/supabase'

export type EmailTemplate =
  | 'booking_confirmed'
  | 'booking_cancelled_by_self'
  | 'booking_created_by_staff'
  | 'booking_cancelled_by_staff'
  | 'class_modified'
  | 'class_cancelled'
  | 'password_reset_by_admin'
  | 'email_change_notice'
  | 'email_change_by_admin'

export interface EmailVars {
  user_name?: string
  class_name?: string
  class_date?: string
  old_class_date?: string
  coach_name?: string
  room_name?: string
  duration_minutes?: number
  refunded?: boolean
  new_email?: string
  app_url?: string
}

/**
 * Envoie un email transactionnel via la Edge Function send-email (Resend).
 * Silent-fail: logge l'erreur sans casser l'UX si l'envoi échoue.
 */
export async function sendEmail(
  template: EmailTemplate,
  to: string | string[],
  vars: EmailVars
): Promise<void> {
  try {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return

    const response = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-email`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ template, to, vars }),
      }
    )

    if (!response.ok) {
      const err = await response.text()
      console.error('[send-email] failed:', response.status, err)
    }
  } catch (err) {
    console.error('[send-email] exception:', err)
  }
}

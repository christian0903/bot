import { supabase } from './supabase'

type ActivityAction =
  | 'pack_purchased'
  | 'pack_assigned'
  | 'pack_modified'
  | 'booking_created'
  | 'booking_cancelled'
  | 'booking_assigned'
  | 'role_changed'
  | 'waitlist_joined'
  | 'waitlist_promoted'
  | 'user_created'
  | 'registration_fee_paid'
  | 'user_login'
  | 'trial_booked'
  | 'check_in'
  | 'no_show'
  | 'password_reset_by_admin'

interface LogEntry {
  action: ActivityAction
  actor_id: string | null
  target_user_id: string
  entity_type?: string
  entity_id?: string
  details?: Record<string, unknown>
  description: string
}

export async function logActivity(entry: LogEntry) {
  await supabase.from('activity_log').insert({
    action: entry.action,
    actor_id: entry.actor_id,
    target_user_id: entry.target_user_id,
    entity_type: entry.entity_type ?? null,
    entity_id: entry.entity_id ?? null,
    details: entry.details ?? {},
    description: entry.description,
  })
}

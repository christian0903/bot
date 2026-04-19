export type UserRole = 'admin' | 'coach' | 'client' | 'super_admin'

export type MemberStatus = 'visitor' | 'potential' | 'active' | 'inactive' | 'former'

export type ThemeMode = 'classic' | 'dark' | 'vivid' | 'vivid-dark'

export interface Profile {
  id: string
  display_name: string
  first_name: string | null
  last_name: string | null
  phone: string | null
  email: string | null
  avatar_url: string | null
  bio: string | null
  member_category_id: string | null
  date_of_birth: string | null
  address: string | null
  emergency_contact_name: string | null
  emergency_contact_phone: string | null
  objectives: string | null
  fitness_level: string | null
  medical_conditions: string | null
  cgv_accepted_at: string | null
  rgpd_accepted_at: string | null
  referral_code: string | null
  member_status: MemberStatus
  weekly_goal: number
  created_at: string
  updated_at: string
  last_sign_in_at: string | null
}

export interface MemberCategory {
  id: string
  name: string
  description: string | null
  created_at: string
}

export interface CreditType {
  id: string
  name: string
  label_fr: string
  label_en: string
  created_at: string
}

export interface PackType {
  id: string
  name: string
  description: string | null
  credit_type_id: string
  credit_count: number
  price_cents: number
  validity_days: number
  is_active: boolean
  created_at: string
  updated_at: string
  credit_type?: CreditType
  categories?: MemberCategory[]
}

export interface PackPurchase {
  id: string
  user_id: string
  pack_type_id: string
  price_paid_cents: number
  credits_remaining: number
  purchased_at: string
  expires_at: string
  stripe_payment_intent_id: string | null
  coupon_id: string | null
  created_at: string
  pack_type?: PackType
}

export interface Coupon {
  id: string
  code: string
  discount_percent: number | null
  discount_amount_cents: number | null
  max_uses: number | null
  current_uses: number
  valid_from: string
  valid_until: string | null
  is_active: boolean
  created_at: string
}

export interface ClassType {
  id: string
  name: string
  description: string | null
  credit_type_id: string
  default_max_participants: number
  color: string
  is_active: boolean
  created_at: string
  credit_type?: CreditType
}

export interface WaitlistEntry {
  id: string
  scheduled_class_id: string
  user_id: string
  position: number
  created_at: string
  notified_at: string | null
  expires_at: string | null
  status: 'waiting' | 'offered' | 'confirmed' | 'expired' | 'cancelled'
  scheduled_class?: ScheduledClass
  user?: Profile
}

export interface ScheduledClass {
  id: string
  class_type_id: string
  coach_id: string | null
  starts_at: string
  duration_minutes: number
  max_participants: number
  is_cancelled: boolean
  title: string | null
  description: string | null
  floor: 'haut' | 'bas' | null
  created_at: string
  updated_at: string
  class_type?: ClassType
  coach?: Profile
  bookings_count?: number
}

export interface Booking {
  id: string
  scheduled_class_id: string
  user_id: string
  pack_purchase_id: string
  status: 'confirmed' | 'cancelled'
  checked_in_at: string | null
  is_no_show: boolean
  created_at: string
  cancelled_at: string | null
  scheduled_class?: ScheduledClass
  user?: Profile
  pack_purchase?: PackPurchase
}

export interface Notification {
  id: string
  user_id: string
  title: string
  message: string
  type: 'info' | 'success' | 'warning' | 'error'
  is_read: boolean
  link: string | null
  created_at: string
}

export interface AppSetting {
  id: string
  key: string
  value: Record<string, unknown>
  updated_at: string
  updated_by: string | null
}

export interface RegistrationFee {
  id: string
  user_id: string
  amount_cents: number
  paid_at: string
  stripe_payment_intent_id: string | null
  mollie_payment_id: string | null
  created_at: string
}

export interface TrialSession {
  id: string
  user_id: string
  scheduled_class_id: string | null
  created_at: string
}

export interface InvoiceRequest {
  id: string
  user_id: string
  pack_purchase_id: string | null
  company_name: string
  address: string
  vat_number: string | null
  status: 'pending' | 'processed'
  admin_notes: string | null
  created_at: string
  processed_at: string | null
  pack_purchase?: PackPurchase
  user?: Profile
}

export interface Referral {
  id: string
  referrer_id: string
  referee_id: string
  referral_code: string
  status: 'pending' | 'qualified' | 'rewarded'
  referrer_reward_cents: number
  referee_reward_cents: number
  created_at: string
  qualified_at: string | null
  rewarded_at: string | null
  referee?: Profile
  referrer?: Profile
}

export interface ReferralReward {
  id: string
  user_id: string
  referral_id: string
  amount_cents: number
  is_used: boolean
  used_at: string | null
  expires_at: string | null
  created_at: string
}

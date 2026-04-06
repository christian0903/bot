export type UserRole = 'admin' | 'coach' | 'client'

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
  is_active: boolean
  created_at: string
  credit_type?: CreditType
}

export interface ScheduledClass {
  id: string
  class_type_id: string
  coach_id: string
  starts_at: string
  duration_minutes: number
  max_participants: number
  is_cancelled: boolean
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

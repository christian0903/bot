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
  /**
   * Client professionnel : commande sur facture au lieu de payer par carte.
   * Positionné par un admin uniquement — un client qui se déclarerait
   * entreprise obtiendrait des séances sans payer.
   */
  is_business: boolean
  /** Raison sociale, reportée sur la facture. Requise si `is_business`. */
  company_name: string | null
  company_vat: string | null
  company_address: string | null
  /**
   * Compte fermé à la demande du membre : données personnelles anonymisées,
   * pièces comptables conservées sans lien identifiable.
   */
  deleted_at: string | null
  referral_code: string | null
  member_status: MemberStatus
  weekly_goal: number
  instagram_url: string | null
  facebook_url: string | null
  linkedin_url: string | null
  coach_description: string | null
  email_on_self_booking: boolean
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
  /** Sur un pack illimité : indicatif seulement, jamais consommé. */
  credit_count: number
  price_cents: number
  validity_days: number
  /** Accès illimité : pas de décompte à la réservation, pas de recrédit à l'annulation. */
  is_unlimited: boolean
  /**
   * Plafond de cours sur une fenêtre glissante de `quota_days`, centrée sur la
   * séance visée. `null` = aucun plafond. Compté sur la DATE DES COURS.
   */
  quota_sessions: number | null
  /** Demi-largeur de la fenêtre, en jours (1 à 14). Va avec `quota_sessions`. */
  quota_days: number | null
  /** Vendu en abonnement : renouvellement automatique par Stripe. */
  is_recurring: boolean
  /** Unité du cycle. « week » × 4 = 28 jours fixes ; « month » × 1 = mois calendaire. */
  recurring_interval: 'day' | 'week' | 'month' | null
  recurring_interval_count: number | null
  /** Price Stripe, distinct selon le mode : un prix de test n'existe pas en live. */
  stripe_price_id_test: string | null
  stripe_price_id_live: string | null
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
  /** Rempli quand la ligne provient d'une échéance d'abonnement. */
  subscription_id?: string | null
  stripe_invoice_id?: string | null
}

/**
 * Abonnement Stripe. Reflet local de l'objet distant : c'est le webhook qui
 * tient cette table à jour, jamais le front.
 */
export interface Subscription {
  id: string
  user_id: string
  pack_type_id: string
  stripe_subscription_id: string
  stripe_customer_id: string
  stripe_price_id: string
  /** Un abonnement de test n'est jamais piloté avec la clé live. */
  stripe_mode: 'test' | 'live'
  /** 'paused' = suspension décidée par le studio. */
  status: 'active' | 'past_due' | 'paused' | 'canceled' | 'incomplete'
  current_period_start: string | null
  /** Prochaine échéance. */
  current_period_end: string | null
  /** Résiliation programmée : droits conservés jusqu'au terme payé. */
  cancel_at_period_end: boolean
  canceled_at: string | null
  paused_at: string | null
  created_at: string
  updated_at: string
  pack_type?: PackType
}

/** Remise ponctuelle accordée par le studio sur une échéance d'abonnement. */
export interface SubscriptionDiscount {
  id: string
  subscription_id: string
  stripe_coupon_id: string
  amount_off_cents: number | null
  percent_off: number | null
  reason: string | null
  applied_by: string | null
  applied_at: string
  /** Renseigné par le webhook quand la facture réduite a été payée. */
  consumed_at: string | null
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
  description_md: string | null
  image_url: string | null
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
  /** Null seulement pour un essai régularisé à la main (cf. contrainte bookings_pack_or_trial). */
  pack_purchase_id: string | null
  status: 'confirmed' | 'cancelled'
  checked_in_at: string | null
  is_no_show: boolean
  /** Séance d'essai offerte : payée par le pack d'essai, affichée comme telle. */
  is_trial: boolean
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
  /**
   * Le membre a retiré cette communication de son accueil. La ligne reste en
   * base : elle prouve que l'information a été transmise.
   */
  dismissed_at: string | null
  /** Template e-mail parti en parallèle, `null` si la communication est in-app seulement. */
  email_template: string | null
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
  /** Pack commandé sur facture. NULL si la demande porte sur un achat déjà payé. */
  pack_type_id: string | null
  amount_cents: number | null
  /** Encaissement pointé à la main. NULL = en attente. Sans effet sur les crédits. */
  paid_at: string | null
  invoice_number: string | null
  /** Date de la facture émise dans Odoo. Distincte de la commande et du paiement. */
  invoice_date: string | null
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

/**
 * Bon d'achat utilisable, tel que renvoyé par get_usable_credit_notes().
 * Un bon se consomme EN ENTIER : pas de solde partiel.
 */
export interface CreditNote {
  id: string
  /** Code lisible (BON-4F8A) — référence et saisie de secours. */
  code: string
  amount_cents: number
  origin: 'parrainage' | 'parrainage_filleul' | 'geste_commercial' | 'dedommagement' | 'autre'
  reason: string | null
  expires_at: string | null
  /**
   * Montant d'achat minimum pour activer ce bon (paramètre du studio).
   * Ne s'applique qu'aux bons de parrainage : un dédommagement reste
   * utilisable sans condition.
   */
  min_purchase_cents: number
}

export interface ReferralReward {
  id: string
  user_id: string
  /** Nul quand le bon vient d'un geste du studio et non d'un parrainage. */
  referral_id: string | null
  amount_cents: number
  is_used: boolean
  used_at: string | null
  expires_at: string | null
  created_at: string
  code: string
  origin: 'parrainage' | 'parrainage_filleul' | 'geste_commercial' | 'dedommagement' | 'autre'
  reason: string | null
  granted_by: string | null
  /** Sur quoi le bon a servi — utile pour retracer une réclamation. */
  used_on: 'pack' | 'subscription' | 'registration_fee' | null
}

export interface PerformanceType {
  id: string
  name: string
  unit_hint: string | null
  color: string | null
  display_order: number
  archived: boolean
  created_at: string
  /** Nature de la mesure : commande la forme du formulaire et l'affichage. */
  measure_kind: 'weight' | 'time' | 'reps' | 'distance' | 'number'
  /**
   * TRUE quand descendre est un progrès (chrono). Indépendant de
   * `measure_kind` : un gainage se mesure en temps et s'améliore en montant.
   */
  lower_is_better: boolean
}

export interface Performance {
  id: string
  user_id: string
  performance_type_id: string
  date: string
  /** Ce que le coach voit : « 1:55 », « 50 kg ». Source de vérité affichée. */
  value: string
  /**
   * La même valeur en nombre, unité canonique (kg, SECONDES, reps, mètres).
   * `null` quand la saisie d'origine était ininterprétable : la ligne reste
   * lisible, elle est simplement absente des courbes.
   */
  value_num: number | null
  notes: string | null
  created_by: string | null
  created_at: string
  performance_type?: PerformanceType
}

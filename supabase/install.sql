-- ============================================
-- Back On Track — Fitness Studio v2
-- Installation complète de la base de données
--
-- À exécuter dans le SQL Editor de Supabase, sur un projet NEUF (base vide).
--
-- IMPORTANT : exécuter en DEUX FOIS
--   1) SECTION A (les types énumérés)
--   2) SECTION B (tout le reste)
-- PostgreSQL refuse d'utiliser une valeur d'enum créée dans la même
-- transaction : d'où la coupure.
--
-- Dernière mise à jour : 2026-08-06 (soir) — remise à niveau complète, puis
-- rattrapage des migrations du jour : rôles, bons d'achat, inscription par le
-- staff, renoncement après modification, et les policies coach qui manquaient.
-- Ce fichier avait pris du retard sur les migrations : il lui manquait les
-- abonnements, le parrainage, les bons d'achat, les badges et une douzaine
-- de fonctions. Il contenait aussi deux policies trop permissives, retirées
-- ici (voir la section 5).
--
-- Ordre des sections : types → tables → fonctions → triggers → RLS →
-- policies → vues → realtime → données initiales. Les tables suivent leurs
-- dépendances : `subscriptions` avant `pack_purchases` qui la référence,
-- `referrals` avant `referral_rewards`.
-- ============================================


-- ============================================
-- SECTION A — Exécuter seul en premier
-- ============================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TYPE user_role AS ENUM ('admin', 'coach', 'client', 'super_admin');

CREATE TYPE activity_action AS ENUM (
  'pack_purchased', 'pack_assigned', 'pack_modified',
  'booking_created', 'booking_cancelled', 'booking_assigned',
  'role_changed', 'waitlist_joined', 'waitlist_promoted',
  'user_created', 'registration_fee_paid', 'user_login',
  'trial_booked', 'check_in', 'no_show',
  'password_reset_by_admin',
  'email_change_by_admin',
  'subscription_cancelled',
  'subscription_paused',
  'subscription_resumed',
  'subscription_postponed',
  'subscription_discounted'
);


-- ============================================
-- SECTION B — Exécuter après la section A
-- ============================================

-- ============================================
-- 1. TABLES
-- ============================================

-- Catégories de membres
CREATE TABLE member_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Profils utilisateurs (extension de auth.users)
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL,
  first_name TEXT,
  last_name TEXT,
  phone TEXT,
  email TEXT,
  avatar_url TEXT,
  bio TEXT,
  member_category_id UUID REFERENCES member_categories(id),
  -- Phase 1 : champs enrichis
  date_of_birth DATE,
  address TEXT,
  emergency_contact_name TEXT,
  emergency_contact_phone TEXT,
  objectives TEXT,
  fitness_level TEXT,
  medical_conditions TEXT,
  cgv_accepted_at TIMESTAMPTZ,
  rgpd_accepted_at TIMESTAMPTZ,
  referral_code TEXT UNIQUE,
  member_status TEXT DEFAULT 'visitor'
    CHECK (member_status IN ('visitor', 'potential', 'active', 'inactive', 'former')),
  weekly_goal INTEGER DEFAULT 3,
  -- Recevoir un e-mail à chaque réservation faite par soi-même.
  email_on_self_booking BOOLEAN DEFAULT TRUE,
  -- Coach fields
  instagram_url TEXT,
  facebook_url TEXT,
  linkedin_url TEXT,
  coach_description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  last_sign_in_at TIMESTAMPTZ
);

-- Rôles utilisateurs
CREATE TABLE user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role user_role NOT NULL DEFAULT 'client',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, role)
);

-- Types de crédits
CREATE TABLE credit_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  label_fr TEXT NOT NULL,
  label_en TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Coupons de réduction
CREATE TABLE coupons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  discount_percent INTEGER CHECK (discount_percent BETWEEN 1 AND 100),
  discount_amount_cents INTEGER CHECK (discount_amount_cents > 0),
  max_uses INTEGER,
  current_uses INTEGER DEFAULT 0,
  valid_from TIMESTAMPTZ DEFAULT NOW(),
  valid_until TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT one_discount_type CHECK (
    (discount_percent IS NOT NULL AND discount_amount_cents IS NULL) OR
    (discount_percent IS NULL AND discount_amount_cents IS NOT NULL)
  )
);

-- Types de packs
-- is_unlimited : accès illimité — aucun décompte à la réservation,
-- aucun recrédit à l'annulation. credit_count reste NOT NULL > 0 : sur un
-- pack illimité il est purement indicatif (jamais consommé, jamais utilisé
-- comme diviseur — cf. booking_revenue).
CREATE TABLE pack_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  credit_type_id UUID NOT NULL REFERENCES credit_types(id),
  credit_count INTEGER NOT NULL CHECK (credit_count > 0),
  -- La gratuité est un prix légitime : le pack d'essai vaut 0 €. Seuls les
  -- montants négatifs restent interdits.
  price_cents INTEGER NOT NULL CHECK (price_cents >= 0),
  validity_days INTEGER NOT NULL CHECK (validity_days > 0),
  is_unlimited BOOLEAN NOT NULL DEFAULT FALSE,
  -- Abonnement : renouvellement automatique par Stripe.
  -- « week » x 4 = 28 jours fixes, soit 13 échéances par an ; « month » x 1 =
  -- mois calendaire, 12 échéances. Les deux ne sont PAS équivalents.
  is_recurring BOOLEAN NOT NULL DEFAULT FALSE,
  recurring_interval TEXT
    CHECK (recurring_interval IS NULL OR recurring_interval IN ('day', 'week', 'month')),
  recurring_interval_count INTEGER
    CHECK (recurring_interval_count IS NULL OR recurring_interval_count > 0),
  -- Price Stripe, distinct par mode : un prix de test n'existe pas en live.
  stripe_price_id_test TEXT,
  stripe_price_id_live TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  -- FALSE = hors catalogue, mais toujours utilisable. `is_active = FALSE`
  -- rendrait le pack inutilisable ET invisible : il faut distinguer « retiré
  -- de la vente » de « hors service ». Cas de la séance d'essai, offerte.
  is_purchasable BOOLEAN NOT NULL DEFAULT TRUE,
  -- Marque LE pack d'essai. Un seul à la fois (index unique partiel ci-dessous).
  is_trial BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT pack_types_recurring_coherent CHECK (
    NOT is_recurring
    OR (recurring_interval IS NOT NULL AND recurring_interval_count IS NOT NULL)
  )
);

-- Un seul pack d'essai : sans cette garantie, l'attribution devrait choisir
-- entre plusieurs candidats et le comportement deviendrait imprévisible.
CREATE UNIQUE INDEX pack_types_single_trial
  ON pack_types (is_trial) WHERE is_trial;

-- Junction : catégories éligibles par type de pack
CREATE TABLE pack_type_categories (
  pack_type_id UUID NOT NULL REFERENCES pack_types(id) ON DELETE CASCADE,
  member_category_id UUID NOT NULL REFERENCES member_categories(id) ON DELETE CASCADE,
  PRIMARY KEY (pack_type_id, member_category_id)
);

-- Abonnements Stripe.
-- Les crédits eux-mêmes vivent dans pack_purchases : une ligne par cycle payé.
-- Un abonnement n'est pas une entité nouvelle, c'est un pack court qui se
-- renouvelle tout seul.
CREATE TABLE subscriptions (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                 UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  pack_type_id            UUID NOT NULL REFERENCES pack_types(id),

  stripe_subscription_id  TEXT NOT NULL UNIQUE,
  stripe_customer_id      TEXT NOT NULL,
  stripe_price_id         TEXT NOT NULL,
  -- Un abonnement créé en test ne doit jamais être piloté avec la clé live.
  stripe_mode             TEXT NOT NULL DEFAULT 'test' CHECK (stripe_mode IN ('test', 'live')),

  -- 'paused' = suspension décidée par le studio.
  status                  TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'past_due', 'paused', 'canceled', 'incomplete')),

  current_period_start    TIMESTAMPTZ,
  current_period_end      TIMESTAMPTZ,
  cancel_at_period_end    BOOLEAN NOT NULL DEFAULT FALSE,
  canceled_at             TIMESTAMPTZ,
  paused_at               TIMESTAMPTZ,

  created_at              TIMESTAMPTZ DEFAULT NOW(),
  updated_at              TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX subscriptions_user_idx   ON subscriptions(user_id);
CREATE INDEX subscriptions_status_idx ON subscriptions(status);

-- Réductions ponctuelles accordées par le studio sur une échéance.
CREATE TABLE subscription_discounts (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id   UUID NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
  stripe_coupon_id  TEXT NOT NULL,
  amount_off_cents  INTEGER CHECK (amount_off_cents IS NULL OR amount_off_cents > 0),
  percent_off       INTEGER CHECK (percent_off IS NULL OR (percent_off BETWEEN 1 AND 100)),
  reason            TEXT,
  applied_by        UUID REFERENCES auth.users(id),
  applied_at        TIMESTAMPTZ DEFAULT NOW(),
  -- Renseigné par le webhook quand la facture réduite a été payée.
  consumed_at       TIMESTAMPTZ,
  CONSTRAINT one_discount_kind CHECK (
    (amount_off_cents IS NOT NULL AND percent_off IS NULL) OR
    (amount_off_cents IS NULL AND percent_off IS NOT NULL)
  )
);

CREATE INDEX subscription_discounts_sub_idx ON subscription_discounts(subscription_id);

-- Achats de packs
CREATE TABLE pack_purchases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  pack_type_id UUID NOT NULL REFERENCES pack_types(id),
  price_paid_cents INTEGER NOT NULL,
  credits_remaining INTEGER NOT NULL,
  purchased_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  stripe_payment_intent_id TEXT,
  coupon_id UUID REFERENCES coupons(id),
  -- Rempli quand la ligne provient d'une échéance d'abonnement.
  subscription_id UUID REFERENCES subscriptions(id) ON DELETE SET NULL,
  -- Facture Stripe à l'origine du cycle. L'index unique ci-dessous garantit
  -- qu'un même événement rejoué ne crédite pas deux fois.
  stripe_invoice_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX pack_purchases_stripe_invoice_uniq
  ON pack_purchases(stripe_invoice_id) WHERE stripe_invoice_id IS NOT NULL;

-- Types de cours
CREATE TABLE class_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  credit_type_id UUID NOT NULL REFERENCES credit_types(id),
  default_max_participants INTEGER DEFAULT 4,
  color TEXT DEFAULT '#3B82F6',
  image_url TEXT,
  description_md TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Cours planifiés (planning)
CREATE TABLE scheduled_classes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_type_id UUID NOT NULL REFERENCES class_types(id),
  coach_id UUID REFERENCES auth.users(id),
  starts_at TIMESTAMPTZ NOT NULL,
  duration_minutes INTEGER NOT NULL DEFAULT 60,
  max_participants INTEGER DEFAULT 4,
  is_cancelled BOOLEAN DEFAULT FALSE,
  title TEXT,
  description TEXT,
  floor TEXT CHECK (floor IS NULL OR floor IN ('haut', 'bas')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Réservations
CREATE TABLE bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scheduled_class_id UUID NOT NULL REFERENCES scheduled_classes(id),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  -- Nullable depuis le pack d'essai : couvre une régularisation faite à la
  -- main par le studio. Le cas nominal reste rempli — l'essai est payé par le
  -- crédit de son pack.
  pack_purchase_id UUID REFERENCES pack_purchases(id),
  status TEXT NOT NULL DEFAULT 'confirmed' CHECK (status IN ('confirmed', 'cancelled')),
  checked_in_at TIMESTAMPTZ,
  is_no_show BOOLEAN DEFAULT FALSE,
  -- Réservation consommant la séance d'essai offerte. Sert à l'affichage
  -- (badge) et aux statistiques de conversion.
  is_trial BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  cancelled_at TIMESTAMPTZ,
  UNIQUE(scheduled_class_id, user_id),
  CONSTRAINT bookings_pack_or_trial
    CHECK (pack_purchase_id IS NOT NULL OR is_trial)
);

-- Liste d'attente
CREATE TABLE waitlist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scheduled_class_id UUID NOT NULL REFERENCES scheduled_classes(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  position INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  notified_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting', 'offered', 'confirmed', 'expired', 'cancelled')),
  UNIQUE(scheduled_class_id, user_id)
);

-- Notifications
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT DEFAULT 'info',
  is_read BOOLEAN DEFAULT FALSE,
  link TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  -- Le membre a retiré la communication de son accueil. La ligne est
  -- conservée : elle prouve que l'information a été transmise.
  dismissed_at TIMESTAMPTZ,
  -- Template e-mail parti en parallèle, NULL si la communication n'existe que
  -- dans l'application. Sert à afficher « aussi envoyé par e-mail ».
  email_template TEXT
);

-- L'accueil demande « les communications non écartées, les plus récentes
-- d'abord » à chaque chargement.
CREATE INDEX notifications_user_active
  ON notifications (user_id, created_at DESC)
  WHERE dismissed_at IS NULL;

-- E-mails demandés par les fonctions SQL, qui ne peuvent pas appeler une Edge
-- Function. Le cas type : promote_from_waitlist offre une place valable deux
-- heures — sans e-mail, l'offre expirait sans que le membre l'ait su.
CREATE TABLE email_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  template TEXT NOT NULL,
  vars JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  sent_at TIMESTAMPTZ,
  -- Dernière erreur rencontrée. Conservée : un envoi qui échoue en silence est
  -- le pire des cas, on veut pouvoir constater la panne.
  last_error TEXT,
  attempts INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX email_queue_pending
  ON email_queue (created_at)
  WHERE sent_at IS NULL;

-- Paramètres application
CREATE TABLE app_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL UNIQUE,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by UUID REFERENCES auth.users(id)
);

-- Journal d'activité
CREATE TABLE activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action activity_action NOT NULL,
  actor_id UUID REFERENCES auth.users(id),
  target_user_id UUID REFERENCES auth.users(id),
  entity_type TEXT,
  entity_id UUID,
  details JSONB DEFAULT '{}'::jsonb,
  description TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_activity_log_created_at ON activity_log(created_at DESC);
CREATE INDEX idx_activity_log_target_user ON activity_log(target_user_id);
CREATE INDEX idx_activity_log_actor ON activity_log(actor_id);
CREATE INDEX idx_activity_log_action ON activity_log(action);

-- Phase 3 : Frais d'inscription
CREATE TABLE registration_fees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount_cents INTEGER NOT NULL DEFAULT 3000,
  paid_at TIMESTAMPTZ DEFAULT NOW(),
  stripe_payment_intent_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Phase 3 : Séances d'essai
--
-- La table `trial_sessions` a été supprimée le 2026-08-07. Une séance d'essai
-- est désormais une réservation ordinaire (bookings.is_trial), payée par le
-- crédit du pack d'essai offert à l'inscription. Elle tenait un compte séparé
-- de `bookings`, si bien que l'essai n'apparaissait ni dans « Mes réservations »
-- ni sur la liste de présence du coach.

-- Phase 9 : Demandes de factures
CREATE TABLE invoice_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  pack_purchase_id UUID REFERENCES pack_purchases(id),
  company_name TEXT NOT NULL,
  address TEXT NOT NULL,
  vat_number TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processed')),
  admin_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  processed_at TIMESTAMPTZ
);

-- Catalogue de types de performances (rameur, ski, poids…)
CREATE TABLE performance_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  unit_hint TEXT,
  color TEXT,
  display_order INTEGER NOT NULL DEFAULT 0,
  archived BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Entrées de performances par utilisateur
CREATE TABLE performances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  performance_type_id UUID NOT NULL REFERENCES performance_types(id) ON DELETE RESTRICT,
  date DATE NOT NULL,
  value TEXT NOT NULL,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_performances_user_date ON performances(user_id, date DESC);
CREATE INDEX idx_performances_type ON performances(performance_type_id);

-- ============================================
-- Parrainage et bons d'achat
-- ============================================

-- Qui a parrainé qui. Un membre ne peut avoir qu'un seul parrain.
CREATE TABLE referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id UUID NOT NULL REFERENCES auth.users(id),
  referee_id UUID NOT NULL REFERENCES auth.users(id),
  referral_code TEXT NOT NULL,
  -- 'pending' tant que le filleul n'a rien payé.
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'qualified', 'rewarded')),
  referrer_reward_cents INTEGER DEFAULT 3000,
  referee_reward_cents INTEGER DEFAULT 3000,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  qualified_at TIMESTAMPTZ,
  rewarded_at TIMESTAMPTZ,
  UNIQUE(referee_id)
);

-- Bons d'achat, quelle que soit leur origine : parrainage ou geste du studio.
-- Un bon se consomme EN ENTIER — pas de solde partiel, donc pas de champ de
-- montant consommé.
CREATE TABLE referral_rewards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  -- Nul quand le bon vient d'un geste du studio et non d'un parrainage.
  referral_id UUID REFERENCES referrals(id),
  amount_cents INTEGER NOT NULL,
  is_used BOOLEAN DEFAULT FALSE,
  used_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  -- Code lisible au téléphone (BON-4F8A), posé par trigger.
  code TEXT,
  -- 'parrainage_filleul' est distingué : seul ce bon subit le montant
  -- d'achat minimum. Le parrain est déjà client.
  origin TEXT NOT NULL DEFAULT 'parrainage',
  granted_by UUID REFERENCES auth.users(id),
  reason TEXT,
  used_on TEXT CHECK (used_on IS NULL OR used_on IN ('pack', 'subscription', 'registration_fee')),
  CONSTRAINT referral_rewards_origin_check CHECK (
    origin IN ('parrainage', 'parrainage_filleul', 'geste_commercial', 'dedommagement', 'autre')
  )
);

CREATE UNIQUE INDEX idx_referral_rewards_code ON referral_rewards(code);
CREATE INDEX idx_referral_rewards_user_usable
  ON referral_rewards(user_id) WHERE is_used = FALSE;

-- Badges de progression du membre.
CREATE TABLE member_badges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  badge_type TEXT NOT NULL,
  earned_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, badge_type)
);

-- ============================================
-- 2. FONCTIONS
-- ============================================

-- Vérifier le rôle (super_admin hérite de admin)
CREATE OR REPLACE FUNCTION has_role(check_user_id UUID, check_role user_role)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = check_user_id
      AND (role = check_role OR (check_role = 'admin' AND role = 'super_admin'))
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Packs utilisables d'un membre pour un type de crédit.
-- Un pack illimité reste utilisable quel que soit credits_remaining.
-- Ordre : packs à crédits d'abord (ils expirent et se perdent),
-- illimité en filet.
CREATE OR REPLACE FUNCTION get_available_credits(p_user_id UUID, p_credit_type_id UUID)
RETURNS TABLE(
  pack_purchase_id UUID,
  credits_remaining INTEGER,
  expires_at TIMESTAMPTZ,
  is_unlimited BOOLEAN,
  pack_name TEXT,
  subscription_id UUID,
  is_subscription BOOLEAN
) AS $$
  SELECT
    pp.id,
    pp.credits_remaining,
    pp.expires_at,
    pt.is_unlimited,
    pt.name,
    pp.subscription_id,
    (pp.subscription_id IS NOT NULL) AS is_subscription
  FROM pack_purchases pp
  JOIN pack_types pt ON pp.pack_type_id = pt.id
  WHERE pp.user_id = p_user_id
    AND pt.credit_type_id = p_credit_type_id
    AND (pt.is_unlimited OR pp.credits_remaining > 0)
    AND pp.expires_at > NOW()
  -- Abonnement d'abord : il est déjà facturé, les crédits achetés à côté
  -- restent au membre. Entre deux packs, celui qui expire le plus tôt.
  ORDER BY (pp.subscription_id IS NOT NULL) DESC, pp.expires_at ASC;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Décrémenter un crédit (réservation). Sans effet sur un pack illimité.
CREATE OR REPLACE FUNCTION consume_credit(p_pack_purchase_id UUID)
RETURNS VOID AS $$
  UPDATE pack_purchases pp
  SET credits_remaining = pp.credits_remaining - 1
  FROM pack_types pt
  WHERE pp.id = p_pack_purchase_id
    AND pp.pack_type_id = pt.id
    AND NOT pt.is_unlimited
    AND pp.credits_remaining > 0;
$$ LANGUAGE sql SECURITY DEFINER;

-- Restituer un crédit (annulation dans les délais).
-- Symétrique de consume_credit : sans effet sur un pack illimité, puisque
-- rien n'a été décompté à la réservation.
CREATE OR REPLACE FUNCTION refund_credit(p_pack_purchase_id UUID)
RETURNS VOID AS $$
  UPDATE pack_purchases pp
  SET credits_remaining = pp.credits_remaining + 1
  FROM pack_types pt
  WHERE pp.id = p_pack_purchase_id
    AND pp.pack_type_id = pt.id
    AND NOT pt.is_unlimited;
$$ LANGUAGE sql SECURITY DEFINER;

-- Revenu d'une réservation.
-- Pack à crédits : prix / credit_count.
-- Pack illimité : prix / séances réellement consommées — credit_count n'a
-- pas de sens comme diviseur et vaudrait 0 (division par zéro).
CREATE OR REPLACE FUNCTION booking_revenue(p_booking_id UUID)
RETURNS NUMERIC AS $$
  SELECT CASE
    WHEN pt.is_unlimited THEN
      (pp.price_paid_cents::NUMERIC / GREATEST(
        (SELECT COUNT(*) FROM bookings b2
          WHERE b2.pack_purchase_id = pp.id
            AND b2.status <> 'cancelled'), 1)) / 100
    WHEN pt.credit_count > 0 THEN
      (pp.price_paid_cents::NUMERIC / pt.credit_count) / 100
    ELSE 0
  END
  FROM bookings b
  JOIN pack_purchases pp ON b.pack_purchase_id = pp.id
  JOIN pack_types pt ON pp.pack_type_id = pt.id
  WHERE b.id = p_booking_id;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Incrémenter l'utilisation d'un coupon
CREATE OR REPLACE FUNCTION increment_coupon_usage(p_coupon_id UUID)
RETURNS VOID AS $$
  UPDATE coupons
  SET current_uses = current_uses + 1
  WHERE id = p_coupon_id;
$$ LANGUAGE sql SECURITY DEFINER;

-- Prochaine position liste d'attente
CREATE OR REPLACE FUNCTION next_waitlist_position(p_scheduled_class_id UUID)
RETURNS INTEGER AS $$
  SELECT COALESCE(MAX(position), 0) + 1
  FROM waitlist
  WHERE scheduled_class_id = p_scheduled_class_id
    AND status IN ('waiting', 'offered');
$$ LANGUAGE sql STABLE;

-- Déposer un e-mail à envoyer. Appelée depuis les fonctions SQL, qui ne
-- peuvent pas joindre les Edge Functions.
CREATE OR REPLACE FUNCTION queue_email(
  p_user_id UUID,
  p_template TEXT,
  p_vars JSONB DEFAULT '{}'::jsonb
)
RETURNS UUID
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $fn$
DECLARE
  v_id UUID;
BEGIN
  INSERT INTO email_queue (user_id, template, vars)
  VALUES (p_user_id, p_template, p_vars)
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$fn$;

-- Promouvoir le premier en liste d'attente.
-- Notification ET e-mail : l'offre expire en 2 h, l'application seule ne
-- suffit pas à prévenir à temps — il faudrait que le membre l'ouvre par
-- hasard dans ce créneau.
CREATE OR REPLACE FUNCTION promote_from_waitlist(p_scheduled_class_id UUID)
RETURNS UUID
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $fn$
DECLARE
  v_waitlist_entry RECORD;
  v_class          RECORD;
  v_expires_at     TIMESTAMPTZ;
BEGIN
  SELECT * INTO v_waitlist_entry
  FROM waitlist
  WHERE scheduled_class_id = p_scheduled_class_id AND status = 'waiting'
  ORDER BY position ASC LIMIT 1;

  IF v_waitlist_entry.id IS NULL THEN RETURN NULL; END IF;

  v_expires_at := NOW() + interval '2 hours';

  UPDATE waitlist
  SET status = 'offered', notified_at = NOW(), expires_at = v_expires_at
  WHERE id = v_waitlist_entry.id;

  -- De quoi nommer le cours dans l'e-mail : « une place s'est libérée » sans
  -- dire laquelle obligerait le membre à ouvrir l'application pour comprendre.
  SELECT sc.starts_at, sc.duration_minutes, sc.floor,
         COALESCE(sc.title, ct.name) AS class_name,
         co.display_name AS coach_name
    INTO v_class
  FROM scheduled_classes sc
  LEFT JOIN class_types ct ON ct.id = sc.class_type_id
  LEFT JOIN profiles co    ON co.id = sc.coach_id
  WHERE sc.id = p_scheduled_class_id;

  INSERT INTO notifications (user_id, title, message, type, link, email_template)
  VALUES (v_waitlist_entry.user_id, 'Place disponible !',
    'Une place s''est libérée pour votre cours. Vous avez 2h pour confirmer.',
    'success', '/schedule', 'waitlist_spot_offered');

  PERFORM queue_email(
    v_waitlist_entry.user_id,
    'waitlist_spot_offered',
    jsonb_build_object(
      'class_name', COALESCE(v_class.class_name, 'votre cours'),
      'class_date', to_char(v_class.starts_at AT TIME ZONE 'Europe/Brussels', 'DD/MM/YYYY à HH24:MI'),
      'coach_name', v_class.coach_name,
      'room_name', CASE v_class.floor
                     WHEN 'haut' THEN 'Étage'
                     WHEN 'bas'  THEN 'Rez-de-chaussée'
                     ELSE NULL END,
      'duration_minutes', v_class.duration_minutes,
      'expires_at', to_char(v_expires_at AT TIME ZONE 'Europe/Brussels', 'HH24:MI')
    )
  );

  RETURN v_waitlist_entry.id;
END;
$fn$;

-- Compter les réservations confirmées
CREATE OR REPLACE FUNCTION class_bookings_count(p_scheduled_class_id UUID)
RETURNS INTEGER AS $$
  SELECT COUNT(*)::INTEGER FROM bookings
  WHERE scheduled_class_id = p_scheduled_class_id AND status = 'confirmed';
$$ LANGUAGE sql STABLE;

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Phase 3 : Mettre à jour le statut d'un membre
CREATE OR REPLACE FUNCTION update_member_status(p_user_id UUID)
RETURNS TEXT
LANGUAGE plpgsql SECURITY DEFINER
AS '
DECLARE
  v_has_fee BOOLEAN;
  v_has_active_pack BOOLEAN;
  v_last_expired TIMESTAMPTZ;
  v_weeks_since INTEGER;
  v_status TEXT;
BEGIN
  SELECT EXISTS(SELECT 1 FROM registration_fees WHERE user_id = p_user_id) INTO v_has_fee;
  IF NOT v_has_fee THEN
    v_status := ''potential'';
  ELSE
    SELECT EXISTS(
      SELECT 1 FROM pack_purchases
      WHERE user_id = p_user_id AND credits_remaining > 0 AND expires_at > NOW()
    ) INTO v_has_active_pack;
    IF v_has_active_pack THEN
      v_status := ''active'';
    ELSE
      SELECT MAX(expires_at) INTO v_last_expired FROM pack_purchases WHERE user_id = p_user_id;
      IF v_last_expired IS NULL THEN
        v_status := ''active'';
      ELSE
        v_weeks_since := EXTRACT(EPOCH FROM (NOW() - v_last_expired))::INTEGER / 604800;
        IF v_weeks_since <= 13 THEN
          v_status := ''inactive'';
        ELSE
          v_status := ''former'';
        END IF;
      END IF;
    END IF;
  END IF;
  UPDATE profiles SET member_status = v_status WHERE id = p_user_id;
  RETURN v_status;
END;
';

-- Phase 3 : Vérifier frais d'inscription
CREATE OR REPLACE FUNCTION has_registration_fee(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql SECURITY DEFINER STABLE
AS $$
  SELECT EXISTS (SELECT 1 FROM registration_fees WHERE user_id = p_user_id);
$$;

-- Phase 3 : Vérifier séance d'essai
-- L'essai consommé se lit sur la réservation : une seule source de vérité.
CREATE OR REPLACE FUNCTION has_used_trial(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM bookings
    WHERE user_id = p_user_id AND is_trial AND status = 'confirmed'
  );
$$;

-- Attribuer la séance d'essai offerte.
--
-- Volontairement PAS dans handle_new_user() : ce trigger avale ses erreurs
-- (EXCEPTION WHEN OTHERS ... RAISE LOG), si bien qu'un échec d'attribution
-- passerait inaperçu. Ici la fonction est appelée explicitement et son
-- résultat est lisible. Idempotente : un second appel ne crée pas un
-- deuxième crédit.
CREATE OR REPLACE FUNCTION grant_trial_pack(p_user_id UUID)
RETURNS JSONB
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $fn$
DECLARE
  v_settings      JSONB;
  v_pack          pack_types%ROWTYPE;
  v_validity_days INTEGER;
  v_purchase_id   UUID;
BEGIN
  SELECT value INTO v_settings FROM app_settings WHERE key = 'trial_pack';

  IF COALESCE((v_settings->>'enabled')::BOOLEAN, TRUE) IS NOT TRUE THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'disabled');
  END IF;

  SELECT * INTO v_pack FROM pack_types WHERE is_trial AND is_active LIMIT 1;
  IF v_pack.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'no_trial_pack');
  END IF;

  -- Déjà attribué : on ne redonne pas un crédit à chaque appel. C'est aussi ce
  -- qui répond à « cette personne a-t-elle eu son essai ? ».
  IF EXISTS (
    SELECT 1 FROM pack_purchases
    WHERE user_id = p_user_id AND pack_type_id = v_pack.id
  ) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'already_granted');
  END IF;

  v_validity_days := COALESCE((v_settings->>'validity_days')::INTEGER, v_pack.validity_days, 30);

  INSERT INTO pack_purchases (
    user_id, pack_type_id, price_paid_cents, credits_remaining,
    purchased_at, expires_at
  ) VALUES (
    p_user_id, v_pack.id, 0, v_pack.credit_count,
    NOW(), NOW() + (v_validity_days || ' days')::INTERVAL
  )
  RETURNING id INTO v_purchase_id;

  RETURN jsonb_build_object(
    'ok', true,
    'purchase_id', v_purchase_id,
    'expires_at', NOW() + (v_validity_days || ' days')::INTERVAL
  );
END;
$fn$;

CREATE OR REPLACE FUNCTION public.grant_trial_on_profile_create()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $fn$
BEGIN
  PERFORM grant_trial_pack(NEW.id);
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Un essai non attribué ne doit pas empêcher la création du compte, mais
  -- l'incident doit rester visible : journalisé, pas avalé en silence.
  RAISE WARNING 'grant_trial_on_profile_create(%) a échoué : %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$fn$;

-- Écarter de l'accueil les communications déjà lues. Ne touche pas aux non
-- lues : les balayer ferait perdre l'information au membre.
CREATE OR REPLACE FUNCTION dismiss_read_notifications()
RETURNS INTEGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $fn$
DECLARE
  v_count INTEGER;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentification requise';
  END IF;

  WITH ecartees AS (
    UPDATE notifications
       SET dismissed_at = NOW()
     WHERE user_id = auth.uid()
       AND is_read
       AND dismissed_at IS NULL
    RETURNING 1
  )
  SELECT COUNT(*) INTO v_count FROM ecartees;

  RETURN v_count;
END;
$fn$;

-- Phase 4 : Vérifier si un membre peut réserver
CREATE OR REPLACE FUNCTION can_book_class(p_class_id UUID, p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER
AS '
DECLARE
  v_class RECORD;
  v_rules JSONB;
  v_now TIMESTAMPTZ := NOW();
  v_bookings_count INTEGER;
  v_class_hour INTEGER;
  v_cutoff TIMESTAMPTZ;
  v_class_date DATE;
BEGIN
  SELECT * INTO v_class FROM scheduled_classes WHERE id = p_class_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object(''can_book'', false, ''reason'', ''class_not_found'');
  END IF;

  SELECT value INTO v_rules FROM app_settings WHERE key = ''booking_rules'';
  IF v_rules IS NULL THEN RETURN jsonb_build_object(''can_book'', true); END IF;

  IF v_class.starts_at <= v_now THEN
    RETURN jsonb_build_object(''can_book'', false, ''reason'', ''class_past'');
  END IF;
  IF v_class.is_cancelled THEN
    RETURN jsonb_build_object(''can_book'', false, ''reason'', ''class_cancelled'');
  END IF;
  IF EXISTS(SELECT 1 FROM bookings WHERE scheduled_class_id = p_class_id AND user_id = p_user_id AND status = ''confirmed'') THEN
    RETURN jsonb_build_object(''can_book'', false, ''reason'', ''already_booked'');
  END IF;

  SELECT COUNT(*) INTO v_bookings_count FROM bookings WHERE scheduled_class_id = p_class_id AND status = ''confirmed'';
  IF v_bookings_count >= v_class.max_participants THEN
    RETURN jsonb_build_object(''can_book'', false, ''reason'', ''class_full'');
  END IF;

  v_class_hour := EXTRACT(HOUR FROM v_class.starts_at AT TIME ZONE ''Europe/Brussels'');
  v_class_date := (v_class.starts_at AT TIME ZONE ''Europe/Brussels'')::DATE;

  IF v_class_hour < COALESCE((v_rules->>''morning_class_before_hour'')::INTEGER, 12) THEN
    v_cutoff := (v_class_date - INTERVAL ''1 day''
                + (COALESCE((v_rules->>''morning_cutoff_hour'')::INTEGER, 20) || '' hours'')::INTERVAL)
                AT TIME ZONE ''Europe/Brussels'';
  ELSE
    IF v_bookings_count = 0 THEN
      v_cutoff := v_class.starts_at - (COALESCE((v_rules->>''afternoon_hours_before_no_bookings'')::INTEGER, 3) || '' hours'')::INTERVAL;
    ELSE
      v_cutoff := v_class.starts_at - (COALESCE((v_rules->>''afternoon_minutes_before_with_bookings'')::INTEGER, 30) || '' minutes'')::INTERVAL;
    END IF;
  END IF;

  IF v_now > v_cutoff THEN
    RETURN jsonb_build_object(''can_book'', false, ''reason'', ''booking_closed'');
  END IF;

  RETURN jsonb_build_object(''can_book'', true);
END;
';

-- Phase 4 : Annulation avec restitution conditionnelle
CREATE OR REPLACE FUNCTION cancel_booking_v2(p_booking_id UUID, p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER
AS $fn$
DECLARE
  v_booking RECORD;
  v_class RECORD;
  v_rules JSONB;
  v_hours_before NUMERIC;
  v_free_hours NUMERIC;
  v_refund BOOLEAN;
BEGIN
  SELECT * INTO v_booking FROM bookings
   WHERE id = p_booking_id AND user_id = p_user_id AND status = 'confirmed';
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'booking_not_found');
  END IF;

  SELECT * INTO v_class FROM scheduled_classes WHERE id = v_booking.scheduled_class_id;
  SELECT value INTO v_rules FROM app_settings WHERE key = 'booking_rules';

  v_hours_before := EXTRACT(EPOCH FROM (v_class.starts_at - NOW())) / 3600;
  v_free_hours := COALESCE((v_rules->>'cancellation_free_hours')::NUMERIC, 12);
  v_refund := v_hours_before >= v_free_hours;

  -- Hors délai : le crédit reste consommé, donc la place a été occupée.
  -- `is_no_show` en garde la trace pour les statistiques et pour repérer
  -- les désistements répétés.
  UPDATE bookings
     SET status = 'cancelled',
         cancelled_at = NOW(),
         is_no_show = NOT v_refund
   WHERE id = p_booking_id;

  -- Sans effet si le pack est illimité (cf. refund_credit).
  IF v_refund THEN
    PERFORM refund_credit(v_booking.pack_purchase_id);
  END IF;

  PERFORM promote_from_waitlist(v_booking.scheduled_class_id);

  RETURN jsonb_build_object('refunded', v_refund, 'hours_before', ROUND(v_hours_before, 1));
END;
$fn$;

-- Phase 1 : Auto-génération code parrainage
CREATE OR REPLACE FUNCTION generate_referral_code()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER
AS '
DECLARE
  v_name TEXT;
  v_code TEXT;
  v_count INTEGER;
BEGIN
  v_name := UPPER(COALESCE(NEW.first_name, SPLIT_PART(NEW.display_name, '' '', 1), ''MEMBER''));
  v_name := REGEXP_REPLACE(v_name, ''[^A-Z]'', '''', ''g'');
  v_name := LEFT(v_name, 8);
  LOOP
    v_code := v_name || LPAD(FLOOR(RANDOM() * 10000)::TEXT, 4, ''0'');
    SELECT COUNT(*) INTO v_count FROM profiles WHERE referral_code = v_code;
    EXIT WHEN v_count = 0;
  END LOOP;
  NEW.referral_code := v_code;
  RETURN NEW;
END;
';

-- ---- Annulation par le studio : le crédit revient toujours ----

CREATE OR REPLACE FUNCTION cancel_booking_by_studio(p_booking_id UUID)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER
AS $fn$
DECLARE
  v_booking RECORD;
BEGIN
  IF NOT (has_role(auth.uid(), 'coach')
          OR has_role(auth.uid(), 'admin')
          OR has_role(auth.uid(), 'super_admin')) THEN
    RAISE EXCEPTION 'Reserve au staff du studio';
  END IF;

  SELECT * INTO v_booking FROM bookings
    WHERE id = p_booking_id AND status = 'confirmed';

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'booking_not_found');
  END IF;

  UPDATE bookings
     SET status = 'cancelled', cancelled_at = NOW()
   WHERE id = p_booking_id;

  -- Toujours restituer : le membre n'est pas à l'origine de l'annulation.
  -- refund_credit est sans effet sur un pack illimité, où rien n'est décompté.
  PERFORM refund_credit(v_booking.pack_purchase_id);

  -- Libérer la place profite à la liste d'attente.
  PERFORM promote_from_waitlist(v_booking.scheduled_class_id);

  RETURN jsonb_build_object('refunded', true);
END;
$fn$;


-- ---- Bons d'achat et parrainage ----

CREATE OR REPLACE FUNCTION generate_credit_note_code()
RETURNS TEXT
LANGUAGE plpgsql
AS $fn$
DECLARE
  v_alphabet TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  v_code TEXT;
  v_exists BOOLEAN;
  v_i INTEGER;
BEGIN
  LOOP
    v_code := 'BON-';
    FOR v_i IN 1..4 LOOP
      v_code := v_code || substr(v_alphabet, floor(random() * length(v_alphabet) + 1)::INTEGER, 1);
    END LOOP;
    SELECT EXISTS(SELECT 1 FROM referral_rewards WHERE code = v_code) INTO v_exists;
    EXIT WHEN NOT v_exists;
  END LOOP;
  RETURN v_code;
END;
$fn$;

CREATE OR REPLACE FUNCTION set_credit_note_code()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $fn$
BEGIN
  IF NEW.code IS NULL THEN
    NEW.code := generate_credit_note_code();
  END IF;
  RETURN NEW;
END;
$fn$;

CREATE OR REPLACE FUNCTION check_referral_qualification(p_referee_id UUID)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER
AS $fn$
DECLARE
  v_referral RECORD;
  v_rules JSONB;
  v_validity_days INTEGER;
  v_referrer_cents INTEGER;
  v_referee_cents INTEGER;
  v_expires TIMESTAMPTZ;
BEGIN
  SELECT * INTO v_referral
  FROM referrals
  WHERE referee_id = p_referee_id AND status = 'pending';

  IF NOT FOUND THEN
    RETURN jsonb_build_object('qualified', false, 'reason', 'no_pending_referral');
  END IF;

  SELECT value INTO v_rules FROM app_settings WHERE key = 'referral_rules';
  v_validity_days := COALESCE((v_rules->>'reward_validity_days')::INTEGER, 180);
  -- Les réglages priment sur les colonnes de `referrals`, qui portent un
  -- DEFAULT 3000 figé à la création du parrainage : sans cette inversion,
  -- changer le montant dans les Réglages n'aurait aucun effet.
  v_referrer_cents := COALESCE(
    (v_rules->>'referrer_reward_cents')::INTEGER,
    v_referral.referrer_reward_cents, 3000);
  v_referee_cents := COALESCE(
    (v_rules->>'referee_reward_cents')::INTEGER,
    v_referral.referee_reward_cents, 3000);
  v_expires := NOW() + (v_validity_days || ' days')::INTERVAL;

  UPDATE referrals
  SET status = 'qualified', qualified_at = NOW()
  WHERE id = v_referral.id;

  INSERT INTO referral_rewards (user_id, referral_id, amount_cents, expires_at, origin) VALUES
    (v_referral.referrer_id, v_referral.id, v_referrer_cents, v_expires, 'parrainage'),
    (v_referral.referee_id,  v_referral.id, v_referee_cents,  v_expires, 'parrainage_filleul');

  INSERT INTO notifications (user_id, title, message, type, link) VALUES
    (v_referral.referrer_id, 'Parrainage validé',
     format('Ton filleul a effectué son premier achat. Tu as un bon de %s € sur ton prochain achat.',
            round(v_referrer_cents / 100.0, 2)),
     'success', '/referral'),
    (v_referral.referee_id, 'Bienvenue — bon de parrainage',
     format('Tu as un bon de %s € à utiliser sur ton prochain achat.',
            round(v_referee_cents / 100.0, 2)),
     'success', '/packs');

  RETURN jsonb_build_object(
    'qualified', true,
    'referral_id', v_referral.id,
    'referrer_cents', v_referrer_cents,
    'referee_cents', v_referee_cents
  );
END;
$fn$;

CREATE OR REPLACE FUNCTION get_usable_credit_notes(
  p_user_id UUID,
  p_purchase_cents INTEGER DEFAULT NULL
)
RETURNS TABLE(
  id UUID,
  code TEXT,
  amount_cents INTEGER,
  origin TEXT,
  reason TEXT,
  expires_at TIMESTAMPTZ,
  min_purchase_cents INTEGER
) AS $$
  SELECT
    r.id, r.code, r.amount_cents, r.origin, r.reason, r.expires_at,
    COALESCE(
      (SELECT (value->>'min_purchase_cents')::INTEGER
       FROM app_settings WHERE key = 'referral_rules'),
      3000)
  FROM referral_rewards r
  WHERE r.user_id = p_user_id
    AND r.is_used = FALSE
    AND (r.expires_at IS NULL OR r.expires_at > NOW())
    -- Le seuil ne vise que le bon du FILLEUL : le parrain est déjà client,
    -- et un dédommagement doit rester utilisable sans condition.
    AND (
      p_purchase_cents IS NULL
      OR r.origin <> 'parrainage_filleul'
      OR p_purchase_cents >= COALESCE(
           (SELECT (value->>'min_purchase_cents')::INTEGER
            FROM app_settings WHERE key = 'referral_rules'),
           3000)
    )
  ORDER BY r.expires_at ASC NULLS LAST, r.created_at ASC;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION credit_note_applicable(
  p_note_id UUID,
  p_user_id UUID,
  p_purchase_cents INTEGER
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER STABLE
AS $fn$
DECLARE
  v_note RECORD;
  v_min INTEGER;
BEGIN
  SELECT * INTO v_note
  FROM referral_rewards
  WHERE id = p_note_id AND user_id = p_user_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_found');
  END IF;
  IF v_note.is_used THEN
    RETURN jsonb_build_object('ok', false, 'error', 'already_used');
  END IF;
  IF v_note.expires_at IS NOT NULL AND v_note.expires_at < NOW() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'expired');
  END IF;

  v_min := COALESCE(
    (SELECT (value->>'min_purchase_cents')::INTEGER
     FROM app_settings WHERE key = 'referral_rules'),
    3000);

  IF v_note.origin = 'parrainage_filleul' AND p_purchase_cents < v_min THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error', 'below_minimum',
      'min_purchase_cents', v_min
    );
  END IF;

  RETURN jsonb_build_object('ok', true, 'amount_cents', v_note.amount_cents);
END;
$fn$;

CREATE OR REPLACE FUNCTION consume_credit_note(
  p_note_id UUID,
  p_user_id UUID,
  p_used_on TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER
AS $fn$
DECLARE
  v_updated INTEGER;
BEGIN
  UPDATE referral_rewards
  SET is_used = TRUE, used_at = NOW(), used_on = p_used_on
  WHERE id = p_note_id
    AND user_id = p_user_id      -- on ne consomme que le bon de son propriétaire
    AND is_used = FALSE;

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated > 0;
END;
$fn$;

CREATE OR REPLACE FUNCTION attach_referrer(p_referee_id UUID, p_referral_code TEXT)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER
AS $fn$
DECLARE
  v_referrer_id UUID;
BEGIN
  IF NOT (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'super_admin')) THEN
    RAISE EXCEPTION 'Reserve aux administrateurs';
  END IF;

  IF EXISTS(SELECT 1 FROM referrals WHERE referee_id = p_referee_id) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Ce membre a deja un parrain');
  END IF;

  SELECT id INTO v_referrer_id
  FROM profiles WHERE referral_code = upper(trim(p_referral_code));

  IF v_referrer_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Code de parrainage inconnu');
  END IF;

  IF v_referrer_id = p_referee_id THEN
    RETURN jsonb_build_object('ok', false, 'error', 'On ne peut pas se parrainer soi-meme');
  END IF;

  INSERT INTO referrals (referrer_id, referee_id, referral_code)
  VALUES (v_referrer_id, p_referee_id, upper(trim(p_referral_code)));

  RETURN jsonb_build_object('ok', true, 'referrer_id', v_referrer_id);
END;
$fn$;

CREATE OR REPLACE FUNCTION claim_referral_code(p_referral_code TEXT)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER
AS $fn$
DECLARE
  v_me UUID := auth.uid();
  v_referrer_id UUID;
  v_code TEXT := upper(trim(p_referral_code));
BEGIN
  IF v_me IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authenticated');
  END IF;

  IF EXISTS(SELECT 1 FROM referrals WHERE referee_id = v_me) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'already_referred');
  END IF;

  SELECT id INTO v_referrer_id FROM profiles WHERE referral_code = v_code;

  IF v_referrer_id IS NULL THEN
    -- Le code est saisi à l'inscription, mais traité à la première connexion :
    -- il n'y a plus d'écran pour afficher l'erreur. On notifie, sans quoi le
    -- filleul croirait son parrainage enregistré et le réclamerait plus tard.
    INSERT INTO notifications (user_id, title, message, type, link)
    VALUES (v_me, 'Code de parrainage non reconnu',
            format('Le code « %s » saisi à l''inscription n''existe pas. Contacte le studio pour le corriger.', v_code),
            'warning', '/referral');
    RETURN jsonb_build_object('ok', false, 'error', 'unknown_code');
  END IF;

  IF v_referrer_id = v_me THEN
    RETURN jsonb_build_object('ok', false, 'error', 'self_referral');
  END IF;

  INSERT INTO referrals (referrer_id, referee_id, referral_code)
  VALUES (v_referrer_id, v_me, v_code);

  RETURN jsonb_build_object('ok', true);
END;
$fn$;

CREATE OR REPLACE FUNCTION grant_credit_note(
  p_user_id UUID,
  p_amount_cents INTEGER,
  p_origin TEXT DEFAULT 'geste_commercial',
  p_reason TEXT DEFAULT NULL,
  p_validity_days INTEGER DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER
AS $fn$
DECLARE
  v_id UUID;
  v_code TEXT;
  v_days INTEGER;
BEGIN
  IF NOT (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'super_admin')) THEN
    RAISE EXCEPTION 'Reserve aux administrateurs';
  END IF;

  IF p_amount_cents IS NULL OR p_amount_cents <= 0 THEN
    RAISE EXCEPTION 'Montant invalide';
  END IF;

  v_days := COALESCE(
    p_validity_days,
    (SELECT (value->>'reward_validity_days')::INTEGER FROM app_settings WHERE key = 'referral_rules'),
    180);

  INSERT INTO referral_rewards (user_id, amount_cents, origin, reason, granted_by, expires_at)
  VALUES (p_user_id, p_amount_cents, p_origin, p_reason, auth.uid(),
          NOW() + (v_days || ' days')::INTERVAL)
  RETURNING id, code INTO v_id, v_code;

  INSERT INTO notifications (user_id, title, message, type, link)
  VALUES (p_user_id, 'Bon d''achat',
          format('Le studio t''offre un bon de %s €%s',
                 round(p_amount_cents / 100.0, 2),
                 CASE WHEN p_reason IS NOT NULL THEN ' — ' || p_reason ELSE '' END),
          'success', '/packs');

  RETURN jsonb_build_object('ok', true, 'id', v_id, 'code', v_code);
END;
$fn$;


-- ---- Rôles ----

CREATE OR REPLACE FUNCTION grant_user_role(p_user_id UUID, p_role TEXT)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER
AS $fn$
DECLARE
  v_is_admin BOOLEAN := has_role(auth.uid(), 'admin');
  v_is_super BOOLEAN := has_role(auth.uid(), 'super_admin');
  v_name TEXT;
BEGIN
  IF NOT (v_is_admin OR v_is_super) THEN
    RAISE EXCEPTION 'Reserve aux administrateurs';
  END IF;

  IF p_role NOT IN ('coach', 'admin', 'super_admin', 'client') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'role_inconnu');
  END IF;

  -- Un admin ne peut pas se créer un pair : seul un super admin promeut
  -- au rang d'admin ou de super admin.
  IF p_role IN ('admin', 'super_admin') AND NOT v_is_super THEN
    RETURN jsonb_build_object('ok', false, 'error', 'super_admin_requis');
  END IF;

  SELECT display_name INTO v_name FROM profiles WHERE id = p_user_id;
  IF v_name IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'membre_introuvable');
  END IF;

  INSERT INTO user_roles (user_id, role)
  VALUES (p_user_id, p_role::user_role)
  ON CONFLICT (user_id, role) DO NOTHING;

  INSERT INTO activity_log (action, actor_id, target_user_id, entity_type, entity_id, details, description)
  VALUES ('role_changed', auth.uid(), p_user_id, 'user_role', p_user_id,
          jsonb_build_object('granted', p_role),
          format('Rôle « %s » accordé à %s', p_role, v_name));

  INSERT INTO notifications (user_id, title, message, type, link)
  VALUES (p_user_id,
          CASE p_role
            WHEN 'coach' THEN 'Tu es désormais coach'
            ELSE 'Tes droits ont changé'
          END,
          CASE p_role
            WHEN 'coach' THEN 'Tu as accès à tes cours et aux participants.'
            ELSE format('Le rôle « %s » t''a été accordé.', p_role)
          END,
          'info', '/');

  RETURN jsonb_build_object('ok', true, 'role', p_role);
END;
$fn$;

CREATE OR REPLACE FUNCTION revoke_user_role(p_user_id UUID, p_role TEXT)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER
AS $fn$
DECLARE
  v_is_admin BOOLEAN := has_role(auth.uid(), 'admin');
  v_is_super BOOLEAN := has_role(auth.uid(), 'super_admin');
  v_name TEXT;
  v_remaining INTEGER;
BEGIN
  IF NOT (v_is_admin OR v_is_super) THEN
    RAISE EXCEPTION 'Reserve aux administrateurs';
  END IF;

  IF p_role IN ('admin', 'super_admin') AND NOT v_is_super THEN
    RETURN jsonb_build_object('ok', false, 'error', 'super_admin_requis');
  END IF;

  -- On ne se retire pas ses propres droits : un studio sans admin serait
  -- verrouillé, et il faudrait repasser par la base pour en sortir.
  IF p_user_id = auth.uid() AND p_role IN ('admin', 'super_admin') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'auto_retrait_interdit');
  END IF;

  -- Ni le dernier super admin : même raison.
  IF p_role = 'super_admin' THEN
    SELECT COUNT(*) INTO v_remaining
    FROM user_roles WHERE role = 'super_admin' AND user_id <> p_user_id;
    IF v_remaining = 0 THEN
      RETURN jsonb_build_object('ok', false, 'error', 'dernier_super_admin');
    END IF;
  END IF;

  SELECT display_name INTO v_name FROM profiles WHERE id = p_user_id;

  DELETE FROM user_roles WHERE user_id = p_user_id AND role = p_role::user_role;

  INSERT INTO activity_log (action, actor_id, target_user_id, entity_type, entity_id, details, description)
  VALUES ('role_changed', auth.uid(), p_user_id, 'user_role', p_user_id,
          jsonb_build_object('revoked', p_role),
          format('Rôle « %s » retiré à %s', p_role, COALESCE(v_name, '?')));

  RETURN jsonb_build_object('ok', true);
END;
$fn$;


-- ---- Outil de test ----

CREATE OR REPLACE FUNCTION reset_member_purchases(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER
AS $reset_fn$
DECLARE
  v_mode TEXT;
  v_live INTEGER;
  v_bookings INTEGER;
  v_waitlist INTEGER;
  v_invoices INTEGER;
  v_packs INTEGER;
  v_subs INTEGER;
  v_fees INTEGER;
BEGIN
  IF NOT (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'super_admin')) THEN
    RAISE EXCEPTION 'Reserve aux administrateurs';
  END IF;

  SELECT value->>'mode' INTO v_mode FROM app_settings WHERE key = 'stripe_mode';
  IF v_mode = 'live' THEN
    RAISE EXCEPTION 'Interdit en mode live';
  END IF;

  SELECT COUNT(*) INTO v_live
  FROM subscriptions WHERE user_id = p_user_id AND stripe_mode = 'live';
  IF v_live > 0 THEN
    RAISE EXCEPTION 'Ce membre a des abonnements live : suppression refusee';
  END IF;

  SELECT COUNT(*) INTO v_bookings FROM bookings WHERE user_id = p_user_id;
  SELECT COUNT(*) INTO v_waitlist FROM waitlist WHERE user_id = p_user_id;
  SELECT COUNT(*) INTO v_invoices FROM invoice_requests WHERE user_id = p_user_id;
  SELECT COUNT(*) INTO v_packs FROM pack_purchases WHERE user_id = p_user_id;
  SELECT COUNT(*) INTO v_subs FROM subscriptions WHERE user_id = p_user_id;
  SELECT COUNT(*) INTO v_fees FROM registration_fees WHERE user_id = p_user_id;

  DELETE FROM bookings WHERE user_id = p_user_id;
  DELETE FROM waitlist WHERE user_id = p_user_id;
  DELETE FROM invoice_requests WHERE user_id = p_user_id;
  DELETE FROM pack_purchases WHERE user_id = p_user_id;
  DELETE FROM subscriptions WHERE user_id = p_user_id;
  DELETE FROM registration_fees WHERE user_id = p_user_id;

  PERFORM update_member_status(p_user_id);
  -- Remis à zéro veut dire remis à neuf : la séance d'essai revient.
  PERFORM grant_trial_pack(p_user_id);

  RETURN jsonb_build_object(
    'bookings', v_bookings,
    'waitlist', v_waitlist,
    'invoice_requests', v_invoices,
    'packs', v_packs,
    'subscriptions', v_subs,
    'registration_fees', v_fees
  );
END;
$reset_fn$;

-- ---- Statistiques du membre (page Stats) ----

CREATE OR REPLACE FUNCTION member_sessions_count(p_user_id UUID, p_from DATE, p_to DATE)
RETURNS INTEGER
LANGUAGE sql SECURITY DEFINER STABLE
AS $$
  SELECT COUNT(*)::INTEGER FROM bookings b
  JOIN scheduled_classes sc ON b.scheduled_class_id = sc.id
  WHERE b.user_id = p_user_id
    AND b.status = 'confirmed'
    AND (b.checked_in_at IS NOT NULL OR sc.starts_at > NOW())
    AND sc.starts_at::DATE BETWEEN p_from AND p_to;
$$;

-- 2. Répartition par type de cours
CREATE OR REPLACE FUNCTION member_sessions_by_type(p_user_id UUID)
RETURNS TABLE(class_type_name TEXT, class_type_color TEXT, count BIGINT)
LANGUAGE sql SECURITY DEFINER STABLE
AS $$
  SELECT ct.name, ct.color, COUNT(*)
  FROM bookings b
  JOIN scheduled_classes sc ON b.scheduled_class_id = sc.id
  JOIN class_types ct ON sc.class_type_id = ct.id
  WHERE b.user_id = p_user_id
    AND b.status = 'confirmed'
    AND (b.checked_in_at IS NOT NULL OR sc.starts_at > NOW())
  GROUP BY ct.name, ct.color
  ORDER BY count DESC;
$$;

-- 3. Séances par mois (12 derniers mois)
CREATE OR REPLACE FUNCTION member_sessions_by_month(p_user_id UUID)
RETURNS TABLE(month TEXT, count BIGINT)
LANGUAGE sql SECURITY DEFINER STABLE
AS $$
  SELECT TO_CHAR(sc.starts_at, 'YYYY-MM') AS month, COUNT(*)
  FROM bookings b
  JOIN scheduled_classes sc ON b.scheduled_class_id = sc.id
  WHERE b.user_id = p_user_id
    AND b.status = 'confirmed'
    AND (b.checked_in_at IS NOT NULL OR sc.starts_at > NOW())
    AND sc.starts_at > NOW() - INTERVAL '12 months'
  GROUP BY month
  ORDER BY month;
$$;

-- 4. Streak (semaines consécutives avec au moins 1 séance)
CREATE OR REPLACE FUNCTION member_streak(p_user_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql SECURITY DEFINER STABLE
AS '
DECLARE
  v_streak INTEGER := 0;
  v_week_start DATE;
  v_has_session BOOLEAN;
BEGIN
  v_week_start := date_trunc(''week'', NOW())::DATE;
  LOOP
    SELECT EXISTS(
      SELECT 1 FROM bookings b
      JOIN scheduled_classes sc ON b.scheduled_class_id = sc.id
      WHERE b.user_id = p_user_id
        AND b.status = ''confirmed''
        AND (b.checked_in_at IS NOT NULL OR sc.starts_at > NOW())
        AND sc.starts_at::DATE BETWEEN v_week_start AND v_week_start + 6
    ) INTO v_has_session;

    IF v_has_session THEN
      v_streak := v_streak + 1;
      v_week_start := v_week_start - 7;
    ELSE
      EXIT;
    END IF;
  END LOOP;
  RETURN v_streak;
END;
';

-- 5. Jours d'entraînement (pour calendrier coloré, 3 derniers mois)
CREATE OR REPLACE FUNCTION member_training_days(p_user_id UUID)
RETURNS TABLE(training_date DATE)
LANGUAGE sql SECURITY DEFINER STABLE
AS $$
  SELECT DISTINCT sc.starts_at::DATE AS training_date
  FROM bookings b
  JOIN scheduled_classes sc ON b.scheduled_class_id = sc.id
  WHERE b.user_id = p_user_id
    AND b.status = 'confirmed'
    AND (b.checked_in_at IS NOT NULL OR sc.starts_at > NOW())
    AND sc.starts_at > NOW() - INTERVAL '3 months'
  ORDER BY training_date;
$$;

-- 6. Objectif hebdo + badges
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS weekly_goal INTEGER DEFAULT 3;



-- ---- Inscription et renoncement pilotes par le staff ----

CREATE OR REPLACE FUNCTION book_member_by_staff(
  p_class_id UUID,
  p_user_id UUID,
  p_pack_purchase_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER
AS $fn$
DECLARE
  v_is_admin BOOLEAN := has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'super_admin');
  v_is_coach BOOLEAN := has_role(auth.uid(), 'coach');
  v_class RECORD;
  v_count INTEGER;
  v_pack RECORD;
  v_booking_id UUID;
  v_member TEXT;
BEGIN
  IF NOT (v_is_admin OR v_is_coach) THEN
    RAISE EXCEPTION 'Reserve au staff du studio';
  END IF;

  SELECT * INTO v_class FROM scheduled_classes WHERE id = p_class_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'class_not_found');
  END IF;

  -- Un coach n'agit que sur ses propres cours : il est responsable de sa
  -- salle, pas de celle d'un collègue.
  IF NOT v_is_admin AND v_class.coach_id IS DISTINCT FROM auth.uid() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_your_class');
  END IF;

  IF v_class.is_cancelled THEN
    RETURN jsonb_build_object('ok', false, 'error', 'class_cancelled');
  END IF;

  -- Le cours passé reste inscriptible : un coach peut régulariser après coup
  -- quelqu'un qui est venu. Seule la capacité fait barrage.
  SELECT COUNT(*) INTO v_count
  FROM bookings WHERE scheduled_class_id = p_class_id AND status = 'confirmed';

  IF v_count >= v_class.max_participants THEN
    RETURN jsonb_build_object('ok', false, 'error', 'class_full');
  END IF;

  IF EXISTS(SELECT 1 FROM bookings
             WHERE scheduled_class_id = p_class_id
               AND user_id = p_user_id
               AND status = 'confirmed') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'already_booked');
  END IF;

  -- Source de paiement : celle qu'on nous donne, sinon la première utilisable
  -- (abonnement d'abord, cf. get_available_credits).
  IF p_pack_purchase_id IS NOT NULL THEN
    SELECT pp.id, pp.credits_remaining, pt.is_unlimited
      INTO v_pack
    FROM pack_purchases pp
    JOIN pack_types pt ON pt.id = pp.pack_type_id
    WHERE pp.id = p_pack_purchase_id
      AND pp.user_id = p_user_id
      AND pp.expires_at > NOW()
      AND (pt.is_unlimited OR pp.credits_remaining > 0);
  ELSE
    SELECT c.pack_purchase_id, c.credits_remaining, c.is_unlimited
      INTO v_pack
    FROM get_available_credits(
           p_user_id,
           (SELECT credit_type_id FROM class_types WHERE id = v_class.class_type_id)
         ) c
    LIMIT 1;
  END IF;

  IF v_pack IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'no_credit');
  END IF;

  -- Réactiver une annulation plutôt que d'en créer une seconde : la
  -- contrainte d'unicité (cours, membre) l'interdirait.
  UPDATE bookings
     SET status = 'confirmed',
         pack_purchase_id = v_pack.id,
         cancelled_at = NULL,
         is_no_show = FALSE
   WHERE scheduled_class_id = p_class_id
     AND user_id = p_user_id
     AND status = 'cancelled'
  RETURNING id INTO v_booking_id;

  IF v_booking_id IS NULL THEN
    INSERT INTO bookings (scheduled_class_id, user_id, pack_purchase_id)
    VALUES (p_class_id, p_user_id, v_pack.id)
    RETURNING id INTO v_booking_id;
  END IF;

  PERFORM consume_credit(v_pack.id);

  SELECT display_name INTO v_member FROM profiles WHERE id = p_user_id;

  INSERT INTO activity_log (action, actor_id, target_user_id, entity_type, entity_id, details, description)
  VALUES ('booking_assigned', auth.uid(), p_user_id, 'booking', v_booking_id,
          jsonb_build_object('by_staff', true, 'scheduled_class_id', p_class_id),
          format('%s inscrit(e) par le staff au cours du %s',
                 COALESCE(v_member, '?'),
                 to_char(v_class.starts_at AT TIME ZONE 'Europe/Brussels', 'DD/MM/YYYY HH24:MI')));

  RETURN jsonb_build_object('ok', true, 'booking_id', v_booking_id);
END;
$fn$;

CREATE OR REPLACE FUNCTION decline_modified_booking(p_booking_id UUID)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER
AS $fn$
DECLARE
  v_booking RECORD;
  v_class RECORD;
BEGIN
  SELECT * INTO v_booking FROM bookings
   WHERE id = p_booking_id
     AND user_id = auth.uid()          -- on ne renonce que pour soi
     AND status = 'confirmed';

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'booking_not_found');
  END IF;

  SELECT * INTO v_class FROM scheduled_classes WHERE id = v_booking.scheduled_class_id;

  IF v_class.starts_at < NOW() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'class_past');
  END IF;

  -- Le cours doit avoir été modifié APRÈS la réservation : c'est ce qui
  -- justifie la restitution hors délai.
  IF v_class.updated_at IS NULL OR v_class.updated_at <= v_booking.created_at THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_modified');
  END IF;

  UPDATE bookings
     SET status = 'cancelled', cancelled_at = NOW(), is_no_show = FALSE
   WHERE id = p_booking_id;

  -- Restitution systématique : sans effet sur un pack illimité.
  PERFORM refund_credit(v_booking.pack_purchase_id);
  PERFORM promote_from_waitlist(v_booking.scheduled_class_id);

  INSERT INTO activity_log (action, actor_id, target_user_id, entity_type, entity_id, details, description)
  VALUES ('booking_cancelled', auth.uid(), auth.uid(), 'booking', p_booking_id,
          jsonb_build_object('reason', 'class_modified', 'refunded', true),
          format('Renoncement après modification du cours du %s — crédit restitué',
                 to_char(v_class.starts_at AT TIME ZONE 'Europe/Brussels', 'DD/MM/YYYY HH24:MI')));

  RETURN jsonb_build_object('ok', true, 'refunded', true);
END;
$fn$;

-- ============================================
-- 3. TRIGGERS
-- ============================================

-- Auto-création profil à l'inscription (avec champs enrichis Phase 1)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS '
BEGIN
  INSERT INTO public.profiles (
    id, display_name, email, first_name, last_name, phone,
    date_of_birth, address, cgv_accepted_at, rgpd_accepted_at, member_status
  ) VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>''display_name'', ''Utilisateur''),
    NEW.email,
    NEW.raw_user_meta_data->>''first_name'',
    NEW.raw_user_meta_data->>''last_name'',
    NEW.raw_user_meta_data->>''phone'',
    CASE WHEN NEW.raw_user_meta_data->>''date_of_birth'' IS NOT NULL
         THEN (NEW.raw_user_meta_data->>''date_of_birth'')::DATE ELSE NULL END,
    NEW.raw_user_meta_data->>''address'',
    CASE WHEN (NEW.raw_user_meta_data->>''cgv_accepted'')::BOOLEAN = TRUE
         THEN NOW() ELSE NULL END,
    CASE WHEN (NEW.raw_user_meta_data->>''rgpd_accepted'')::BOOLEAN = TRUE
         THEN NOW() ELSE NULL END,
    ''potential''
  );
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, ''client'');
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE LOG ''handle_new_user error: %'', SQLERRM;
  RETURN NEW;
END;
';

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Séance d'essai attribuée à la création du profil. Le trigger porte sur
-- `profiles` et non sur `auth.users` : à ce moment le profil existe déjà, donc
-- la clé étrangère de pack_purchases est satisfaite.
CREATE TRIGGER on_profile_created_grant_trial
  AFTER INSERT ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.grant_trial_on_profile_create();

-- Sync profiles.email when auth.users.email changes (after confirmation)
CREATE OR REPLACE FUNCTION public.sync_profile_email()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.email IS DISTINCT FROM OLD.email THEN
    UPDATE public.profiles SET email = NEW.email WHERE id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_email_change
  AFTER UPDATE OF email ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_profile_email();

-- Code parrainage auto
CREATE TRIGGER generate_referral_code_trigger
  BEFORE INSERT ON profiles
  FOR EACH ROW
  WHEN (NEW.referral_code IS NULL)
  EXECUTE FUNCTION generate_referral_code();

-- Auto-update updated_at
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_pack_types_updated_at
  BEFORE UPDATE ON pack_types FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_scheduled_classes_updated_at
  BEFORE UPDATE ON scheduled_classes FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Permissions pour le trigger d'inscription
GRANT USAGE ON SCHEMA public TO supabase_auth_admin;
GRANT INSERT ON public.profiles TO supabase_auth_admin;
GRANT INSERT ON public.user_roles TO supabase_auth_admin;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO supabase_auth_admin;

-- Code de bon d'achat, posé à la création.
CREATE TRIGGER set_credit_note_code_trigger
  BEFORE INSERT ON referral_rewards
  FOR EACH ROW EXECUTE FUNCTION set_credit_note_code();

CREATE TRIGGER subscriptions_updated_at
  BEFORE UPDATE ON subscriptions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================
-- 4. ROW LEVEL SECURITY
-- ============================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE member_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE credit_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE pack_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE pack_type_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE pack_purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE coupons ENABLE ROW LEVEL SECURITY;
ALTER TABLE class_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE scheduled_classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE waitlist ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE registration_fees ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_requests ENABLE ROW LEVEL SECURITY;

ALTER TABLE subscriptions          ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscription_discounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE referrals              ENABLE ROW LEVEL SECURITY;
ALTER TABLE referral_rewards       ENABLE ROW LEVEL SECURITY;
ALTER TABLE member_badges          ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 5. RLS POLICIES
-- ============================================

-- PROFILES
CREATE POLICY "Profiles: public read" ON profiles FOR SELECT USING (true);
CREATE POLICY "Profiles: own update" ON profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Profiles: admin update all" ON profiles FOR UPDATE USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Profiles: insert on signup" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- USER_ROLES
CREATE POLICY "Roles: read own or admin" ON user_roles
  FOR SELECT USING (auth.uid() = user_id OR has_role(auth.uid(), 'admin'));
CREATE POLICY "Roles: admin insert" ON user_roles FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin'));
CREATE POLICY "Roles: admin update" ON user_roles FOR UPDATE USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Roles: admin delete" ON user_roles FOR DELETE USING (has_role(auth.uid(), 'admin'));

-- MEMBER_CATEGORIES
CREATE POLICY "Categories: public read" ON member_categories FOR SELECT USING (true);
CREATE POLICY "Categories: admin manage" ON member_categories FOR ALL USING (has_role(auth.uid(), 'admin'));

-- CREDIT_TYPES
CREATE POLICY "Credit types: public read" ON credit_types FOR SELECT USING (true);
CREATE POLICY "Credit types: admin manage" ON credit_types FOR ALL USING (has_role(auth.uid(), 'admin'));

-- PACK_TYPES
CREATE POLICY "Pack types: read active or admin" ON pack_types
  FOR SELECT USING (is_active = true OR has_role(auth.uid(), 'admin'));
CREATE POLICY "Pack types: admin manage" ON pack_types FOR ALL USING (has_role(auth.uid(), 'admin'));

-- PACK_TYPE_CATEGORIES
CREATE POLICY "Pack type categories: public read" ON pack_type_categories FOR SELECT USING (true);
CREATE POLICY "Pack type categories: admin manage" ON pack_type_categories FOR ALL USING (has_role(auth.uid(), 'admin'));

-- PACK_PURCHASES
CREATE POLICY "Purchases: own read" ON pack_purchases FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Purchases: admin read all" ON pack_purchases FOR SELECT USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Purchases: coach read all" ON pack_purchases FOR SELECT USING (has_role(auth.uid(), 'coach'));
CREATE POLICY "Purchases: own insert" ON pack_purchases FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Purchases: admin insert" ON pack_purchases FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin'));
CREATE POLICY "Purchases: admin update" ON pack_purchases FOR UPDATE USING (has_role(auth.uid(), 'admin'));

-- COUPONS
CREATE POLICY "Coupons: read active" ON coupons FOR SELECT USING (is_active = true);
CREATE POLICY "Coupons: admin manage" ON coupons FOR ALL USING (has_role(auth.uid(), 'admin'));

-- CLASS_TYPES
CREATE POLICY "Class types: public read" ON class_types FOR SELECT USING (true);
CREATE POLICY "Class types: admin manage" ON class_types FOR ALL USING (has_role(auth.uid(), 'admin'));

-- SCHEDULED_CLASSES
CREATE POLICY "Classes: public read" ON scheduled_classes FOR SELECT USING (true);
CREATE POLICY "Classes: admin manage" ON scheduled_classes FOR ALL USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Classes: coach update own" ON scheduled_classes FOR UPDATE USING (auth.uid() = coach_id);

-- BOOKINGS
CREATE POLICY "Bookings: own read" ON bookings FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Bookings: admin read all" ON bookings FOR SELECT USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Bookings: coach read all classes" ON bookings FOR SELECT USING (has_role(auth.uid(), 'coach'));
CREATE POLICY "Bookings: own insert" ON bookings FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Bookings: admin insert" ON bookings FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin'));
CREATE POLICY "Bookings: coach insert" ON bookings FOR INSERT WITH CHECK (has_role(auth.uid(), 'coach'));
CREATE POLICY "Bookings: own cancel" ON bookings FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Bookings: admin update" ON bookings FOR UPDATE USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Bookings: coach update" ON bookings FOR UPDATE USING (has_role(auth.uid(), 'coach'));

-- WAITLIST
CREATE POLICY "Waitlist: own read" ON waitlist FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Waitlist: admin read" ON waitlist FOR SELECT USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Waitlist: own insert" ON waitlist FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Waitlist: admin insert" ON waitlist FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin'));
CREATE POLICY "Waitlist: own update" ON waitlist FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Waitlist: admin update" ON waitlist FOR UPDATE USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Waitlist: own delete" ON waitlist FOR DELETE USING (auth.uid() = user_id);

-- NOTIFICATIONS
CREATE POLICY "Notifications: own read" ON notifications FOR SELECT USING (auth.uid() = user_id);
-- WITH CHECK indispensable : sans lui, un membre pouvait réassigner une
-- notification à quelqu'un d'autre en modifiant user_id.
CREATE POLICY "Notifications: own update" ON notifications
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Notifications: system insert" ON notifications FOR INSERT WITH CHECK (true);

-- EMAIL_QUEUE — file technique. Le membre n'y accède pas ; seul le service
-- role (Edge Functions) l'écrit et la consomme, en contournant RLS.
CREATE POLICY "Email queue: staff read" ON email_queue
  FOR SELECT USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'super_admin'));

-- APP_SETTINGS
CREATE POLICY "Settings: public read" ON app_settings FOR SELECT USING (true);
-- WITH CHECK explicite : sur un INSERT, PostgreSQL évalue WITH CHECK et non
-- USING. En son absence il retombe sur USING, mais mieux vaut ne pas dépendre
-- de ce repli implicite pour une table de configuration.
CREATE POLICY "Settings: admin manage" ON app_settings
  FOR ALL
  USING (has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'admin'));

-- ACTIVITY_LOG
CREATE POLICY "Activity log: admin read" ON activity_log FOR SELECT USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Activity log: coach read" ON activity_log FOR SELECT USING (has_role(auth.uid(), 'coach'));
CREATE POLICY "Activity log: own read" ON activity_log FOR SELECT USING (auth.uid() = target_user_id);
CREATE POLICY "Activity log: system insert" ON activity_log FOR INSERT WITH CHECK (true);

-- REGISTRATION_FEES
CREATE POLICY "Reg fees: own read" ON registration_fees FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Reg fees: admin read" ON registration_fees FOR SELECT USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Reg fees: insert" ON registration_fees FOR INSERT WITH CHECK (true);
CREATE POLICY "Reg fees: admin all" ON registration_fees FOR ALL USING (has_role(auth.uid(), 'admin'));

-- Séances d'essai : plus de table dédiée depuis le 2026-08-07. Les policies de
-- `bookings` couvrent l'essai, qui est une réservation comme une autre.

-- INVOICE_REQUESTS
CREATE POLICY "Invoice: own read" ON invoice_requests FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Invoice: own insert" ON invoice_requests FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Invoice: admin all" ON invoice_requests FOR ALL USING (has_role(auth.uid(), 'admin'));

-- PERFORMANCE_TYPES
ALTER TABLE performance_types ENABLE ROW LEVEL SECURITY;
CREATE POLICY "PerfTypes: read all" ON performance_types FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "PerfTypes: coach/admin insert" ON performance_types FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'coach') OR has_role(auth.uid(), 'admin'));
CREATE POLICY "PerfTypes: coach/admin update" ON performance_types FOR UPDATE
  USING (has_role(auth.uid(), 'coach') OR has_role(auth.uid(), 'admin'));
CREATE POLICY "PerfTypes: coach/admin delete" ON performance_types FOR DELETE
  USING (has_role(auth.uid(), 'coach') OR has_role(auth.uid(), 'admin'));

-- PERFORMANCES
ALTER TABLE performances ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Perf: own read" ON performances FOR SELECT
  USING (auth.uid() = user_id OR has_role(auth.uid(), 'coach') OR has_role(auth.uid(), 'admin'));
CREATE POLICY "Perf: insert" ON performances FOR INSERT
  WITH CHECK (auth.uid() = user_id OR has_role(auth.uid(), 'coach') OR has_role(auth.uid(), 'admin'));
CREATE POLICY "Perf: update" ON performances FOR UPDATE
  USING (auth.uid() = user_id OR has_role(auth.uid(), 'coach') OR has_role(auth.uid(), 'admin'));
CREATE POLICY "Perf: delete" ON performances FOR DELETE
  USING (auth.uid() = user_id OR has_role(auth.uid(), 'coach') OR has_role(auth.uid(), 'admin'));

-- ---- Abonnements ----
CREATE POLICY "Subscriptions: own read" ON subscriptions
  FOR SELECT USING (
    auth.uid() = user_id
    OR has_role(auth.uid(), 'coach')
    OR has_role(auth.uid(), 'admin')
  );
CREATE POLICY "Subscriptions: coach read" ON subscriptions
  FOR SELECT USING (has_role(auth.uid(), 'coach'));
CREATE POLICY "Subscriptions: admin all" ON subscriptions
  FOR ALL
  USING (has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE POLICY "Sub discounts: own read" ON subscription_discounts
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM subscriptions s
             WHERE s.id = subscription_discounts.subscription_id
               AND s.user_id = auth.uid())
    OR has_role(auth.uid(), 'admin')
  );
CREATE POLICY "Sub discounts: admin all" ON subscription_discounts
  FOR ALL
  USING (has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'admin'));

-- ---- Parrainage et bons d'achat ----
-- Aucune policy d'ÉCRITURE ouverte, volontairement : les créations passent
-- par les fonctions SECURITY DEFINER (claim_referral_code, attach_referrer,
-- grant_credit_note, check_referral_qualification) et par le webhook en
-- service_role. Une version antérieure laissait ces tables en
-- `WITH CHECK (true)` : n'importe quel membre authentifié pouvait s'attribuer
-- un parrain ou se créer un bon d'achat du montant de son choix.
CREATE POLICY "referrals_own_read" ON referrals
  FOR SELECT USING (
    auth.uid() = referrer_id
    OR auth.uid() = referee_id
    OR has_role(auth.uid(), 'admin')
  );
CREATE POLICY "referrals_admin_all" ON referrals
  FOR ALL USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "rewards_own_read" ON referral_rewards
  FOR SELECT USING (
    auth.uid() = user_id
    OR has_role(auth.uid(), 'admin')
    OR has_role(auth.uid(), 'super_admin')
  );
CREATE POLICY "rewards_admin_all" ON referral_rewards
  FOR ALL USING (has_role(auth.uid(), 'admin'));

-- ---- Badges ----
CREATE POLICY "badges_own_read" ON member_badges
  FOR SELECT USING (auth.uid() = user_id OR has_role(auth.uid(), 'admin'));
CREATE POLICY "badges_insert" ON member_badges
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- ============================================
-- 6. VUE : profils des coachs
-- ============================================

-- DISTINCT ON (p.id) + ORDER BY rang du rôle : un coach qui a plusieurs rôles
-- (ex. coach ET admin) ne sort qu'une seule fois, avec son rôle le plus élevé.
CREATE OR REPLACE VIEW coach_profiles AS
SELECT DISTINCT ON (p.id) p.id, p.display_name, p.avatar_url, p.email, p.phone, ur.role
FROM profiles p
JOIN user_roles ur ON ur.user_id = p.id
WHERE ur.role IN ('coach', 'admin', 'super_admin')
ORDER BY p.id, CASE ur.role WHEN 'super_admin' THEN 1 WHEN 'admin' THEN 2 ELSE 3 END;

GRANT SELECT ON coach_profiles TO authenticated;
GRANT SELECT ON coach_profiles TO anon;

-- ============================================
-- 7. REALTIME
-- ============================================

ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
ALTER PUBLICATION supabase_realtime ADD TABLE waitlist;

-- ============================================
-- 8. DONNÉES INITIALES
-- ============================================

-- Types de crédits
INSERT INTO credit_types (name, label_fr, label_en) VALUES
  ('semi_prive', 'Semi-privé', 'Semi-private'),
  ('personal_training', 'Personal Training', 'Personal Training');

-- Le pack d'essai : gratuit, hors catalogue, attribué à la création du profil
-- par le trigger on_profile_created_grant_trial.
--
-- Semi-privé uniquement (décision du 2026-08-07) : un essai en personal
-- training coûterait au studio le temps de coach correspondant.
INSERT INTO pack_types (
  name, description, credit_type_id, credit_count, price_cents,
  validity_days, is_active, is_purchasable, is_trial
)
SELECT
  'Séance d''essai offerte',
  'Une séance semi-privée offerte pour découvrir le studio.',
  ct.id, 1, 0, 30,
  TRUE,   -- actif : le crédit doit rester utilisable
  FALSE,  -- hors catalogue : ne s'achète pas
  TRUE
FROM credit_types ct
WHERE ct.name = 'semi_prive';

-- Paramètres
INSERT INTO app_settings (key, value) VALUES
  ('announcement', '{"content": "", "published": false}'::jsonb),
  ('stripe_mode', '{"mode": "test"}'::jsonb),
  -- Séance d'essai offerte. `validity_days` est la source de vérité, appliquée
  -- à chaque attribution : le studio l'ajuste sans passer par les packs.
  ('trial_pack', '{
    "enabled": true,
    "validity_days": 30
  }'::jsonb),
  ('payment_provider', '{"provider": "stripe", "mode": "test"}'::jsonb),
  ('referral_rules', '{
    "referrer_reward_cents": 3000,
    "referee_reward_cents": 3000,
    "reward_validity_days": 180,
    "min_purchase_cents": 3000
  }'::jsonb),
  ('booking_rules', '{
    "morning_cutoff_hour": 20,
    "morning_cutoff_is_day_before": true,
    "morning_class_before_hour": 12,
    "afternoon_hours_before_no_bookings": 3,
    "afternoon_minutes_before_with_bookings": 30,
    "cancellation_free_hours": 12,
    "cancellation_penalty": "credit_lost",
    "no_show_penalty": "credit_lost",
    "no_show_auto_minutes": 15,
    "pt_cancellation_free_hours": 24
  }'::jsonb),
  ('studio_info', '{"name": "Back On Track", "address": "", "phone": "", "email": "", "logo_url": "", "vat_number": "", "instagram_url": "", "facebook_url": "", "website_url": ""}'::jsonb),
  ('registration_fee', '{"amount_cents": 3000, "enabled": true}'::jsonb),
  ('room_names', '{"bas": "Back On Track Studio", "haut": "Back On Track Upstairs"}'::jsonb);

-- ============================================
-- 8b. STORAGE : bucket pour photos (avatars, cours, coaches)
-- ============================================
-- Note : le bucket doit aussi être créé via le Dashboard Supabase
-- (Storage → New bucket → "avatars" → Public → 5MB max)

INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Allow authenticated uploads" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'avatars');
CREATE POLICY "Allow authenticated updates" ON storage.objects
  FOR UPDATE TO authenticated USING (bucket_id = 'avatars');
CREATE POLICY "Allow authenticated deletes" ON storage.objects
  FOR DELETE TO authenticated USING (bucket_id = 'avatars');
CREATE POLICY "Allow public read" ON storage.objects
  FOR SELECT TO public USING (bucket_id = 'avatars');

-- ============================================
-- INSTALLATION TERMINÉE
-- ============================================
-- Prochaines étapes :
-- 1. Créer un compte via l'application
-- 2. Promouvoir en super_admin :
--    INSERT INTO user_roles (user_id, role)
--    SELECT id, 'super_admin' FROM auth.users WHERE email = 'votre@email.com';
-- 3. Configurer, dans cet ordre, depuis l'interface admin :
--      a. les types de crédits (semi-privé, personal training…)
--         — c'est la brique de base : un crédit ne paie que les cours de
--           son type
--      b. les types de cours, rattachés à un type de crédit
--      c. les packs et abonnements, rattachés eux aussi à un type de crédit
--      d. les catégories de membres, si l'accès à certains packs doit être
--         restreint
-- 4. Régler /admin/settings : règles de réservation, frais d'inscription,
--    parrainage, informations du studio
-- 5. Stripe : poser les secrets et déployer les Edge Functions
--      supabase secrets set STRIPE_SECRET_KEY_TEST=sk_test_...
--      supabase functions deploy create-checkout-session
--      supabase functions deploy manage-subscription
--      supabase functions deploy cancel-my-subscription
--      supabase functions deploy stripe-webhook --no-verify-jwt
--    Le drapeau --no-verify-jwt est INDISPENSABLE sur le webhook : Stripe
--    n'envoie pas de jeton Supabase, et sans lui tous ses appels sont
--    rejetés en 401 — donc plus rien n'est jamais crédité.
-- 6. Créer la destination webhook côté Stripe avec ses cinq événements
--    (voir docs/documentation-technique.md), puis poser le secret whsec_
--    et redéployer le webhook.
-- 7. Données de démonstration, si besoin : npx tsx scripts/import-demo.ts

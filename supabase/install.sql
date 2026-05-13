-- ============================================
-- Back On Track - Fitness Studio v2
-- Installation complète de la base de données
-- À exécuter dans le SQL Editor de Supabase
-- sur un projet NEUF (base vide)
--
-- IMPORTANT : exécuter en DEUX FOIS
--   1) SECTION A (enum avec super_admin)
--   2) SECTION B (tout le reste)
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
  'password_reset_by_admin'
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
CREATE TABLE pack_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  credit_type_id UUID NOT NULL REFERENCES credit_types(id),
  credit_count INTEGER NOT NULL CHECK (credit_count > 0),
  price_cents INTEGER NOT NULL CHECK (price_cents > 0),
  validity_days INTEGER NOT NULL CHECK (validity_days > 0),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Junction : catégories éligibles par type de pack
CREATE TABLE pack_type_categories (
  pack_type_id UUID NOT NULL REFERENCES pack_types(id) ON DELETE CASCADE,
  member_category_id UUID NOT NULL REFERENCES member_categories(id) ON DELETE CASCADE,
  PRIMARY KEY (pack_type_id, member_category_id)
);

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
  mollie_payment_id TEXT,
  coupon_id UUID REFERENCES coupons(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

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
  pack_purchase_id UUID NOT NULL REFERENCES pack_purchases(id),
  status TEXT NOT NULL DEFAULT 'confirmed' CHECK (status IN ('confirmed', 'cancelled')),
  checked_in_at TIMESTAMPTZ,
  is_no_show BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  cancelled_at TIMESTAMPTZ,
  UNIQUE(scheduled_class_id, user_id)
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
  created_at TIMESTAMPTZ DEFAULT NOW()
);

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
  mollie_payment_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Phase 3 : Séances d'essai
CREATE TABLE trial_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  scheduled_class_id UUID REFERENCES scheduled_classes(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

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

-- Crédits disponibles
CREATE OR REPLACE FUNCTION get_available_credits(p_user_id UUID, p_credit_type_id UUID)
RETURNS TABLE(pack_purchase_id UUID, credits_remaining INTEGER, expires_at TIMESTAMPTZ) AS $$
  SELECT pp.id, pp.credits_remaining, pp.expires_at
  FROM pack_purchases pp
  JOIN pack_types pt ON pp.pack_type_id = pt.id
  WHERE pp.user_id = p_user_id
    AND pt.credit_type_id = p_credit_type_id
    AND pp.credits_remaining > 0
    AND pp.expires_at > NOW()
  ORDER BY pp.expires_at ASC;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Décrémenter un crédit
CREATE OR REPLACE FUNCTION consume_credit(p_pack_purchase_id UUID)
RETURNS VOID AS $$
  UPDATE pack_purchases
  SET credits_remaining = credits_remaining - 1
  WHERE id = p_pack_purchase_id AND credits_remaining > 0;
$$ LANGUAGE sql SECURITY DEFINER;

-- Revenu d'une réservation
CREATE OR REPLACE FUNCTION booking_revenue(p_booking_id UUID)
RETURNS NUMERIC AS $$
  SELECT (pp.price_paid_cents::NUMERIC / pt.credit_count) / 100
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

-- Promouvoir le premier en liste d'attente
CREATE OR REPLACE FUNCTION promote_from_waitlist(p_scheduled_class_id UUID)
RETURNS UUID AS $$
DECLARE
  v_waitlist_entry RECORD;
BEGIN
  SELECT * INTO v_waitlist_entry
  FROM waitlist
  WHERE scheduled_class_id = p_scheduled_class_id AND status = 'waiting'
  ORDER BY position ASC LIMIT 1;

  IF v_waitlist_entry.id IS NULL THEN RETURN NULL; END IF;

  UPDATE waitlist
  SET status = 'offered', notified_at = NOW(), expires_at = NOW() + interval '2 hours'
  WHERE id = v_waitlist_entry.id;

  INSERT INTO notifications (user_id, title, message, type, link)
  VALUES (v_waitlist_entry.user_id, 'Place disponible !',
    'Une place s''est libérée pour votre cours. Vous avez 2h pour confirmer.', 'success', '/schedule');

  RETURN v_waitlist_entry.id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

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
CREATE OR REPLACE FUNCTION has_used_trial(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql SECURITY DEFINER STABLE
AS $$
  SELECT EXISTS (SELECT 1 FROM trial_sessions WHERE user_id = p_user_id);
$$;

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
AS '
DECLARE
  v_booking RECORD;
  v_class RECORD;
  v_rules JSONB;
  v_hours_before NUMERIC;
  v_free_hours NUMERIC;
  v_refund BOOLEAN;
BEGIN
  SELECT * INTO v_booking FROM bookings WHERE id = p_booking_id AND user_id = p_user_id AND status = ''confirmed'';
  IF NOT FOUND THEN
    RETURN jsonb_build_object(''error'', ''booking_not_found'');
  END IF;

  SELECT * INTO v_class FROM scheduled_classes WHERE id = v_booking.scheduled_class_id;
  SELECT value INTO v_rules FROM app_settings WHERE key = ''booking_rules'';

  v_hours_before := EXTRACT(EPOCH FROM (v_class.starts_at - NOW())) / 3600;
  v_free_hours := COALESCE((v_rules->>''cancellation_free_hours'')::NUMERIC, 12);
  v_refund := v_hours_before >= v_free_hours;

  UPDATE bookings SET status = ''cancelled'', cancelled_at = NOW() WHERE id = p_booking_id;

  IF v_refund THEN
    UPDATE pack_purchases SET credits_remaining = credits_remaining + 1
    WHERE id = v_booking.pack_purchase_id;
  END IF;

  PERFORM promote_from_waitlist(v_booking.scheduled_class_id);

  RETURN jsonb_build_object(''refunded'', v_refund, ''hours_before'', ROUND(v_hours_before, 1));
END;
';

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
ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE registration_fees ENABLE ROW LEVEL SECURITY;
ALTER TABLE trial_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_requests ENABLE ROW LEVEL SECURITY;

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
CREATE POLICY "Notifications: own update" ON notifications FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Notifications: system insert" ON notifications FOR INSERT WITH CHECK (true);

-- APP_SETTINGS
CREATE POLICY "Settings: public read" ON app_settings FOR SELECT USING (true);
CREATE POLICY "Settings: admin manage" ON app_settings FOR ALL USING (has_role(auth.uid(), 'admin'));

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

-- TRIAL_SESSIONS
CREATE POLICY "Trial: own read" ON trial_sessions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Trial: own insert" ON trial_sessions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Trial: admin read" ON trial_sessions FOR SELECT USING (has_role(auth.uid(), 'admin'));

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

-- Paramètres
INSERT INTO app_settings (key, value) VALUES
  ('announcement', '{"content": "", "published": false}'::jsonb),
  ('stripe_mode', '{"mode": "test"}'::jsonb),
  ('payment_provider', '{"provider": "stripe", "mode": "test"}'::jsonb),
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
-- 3. Configurer les types de crédits, packs, cours via l'interface admin
-- 4. Configurer les paramètres dans /admin/settings
-- 5. Importer les données : npx tsx scripts/import-demo.ts

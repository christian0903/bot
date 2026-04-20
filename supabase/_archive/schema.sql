-- ============================================
-- Back on Track - Fitness Studio
-- Schéma SQL complet pour Supabase
-- À exécuter dans le SQL Editor de Supabase
-- ============================================

-- ============================================
-- EXTENSIONS
-- ============================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- CATÉGORIES DE MEMBRES
-- (créée en premier car référencée par profiles)
-- ============================================
CREATE TABLE member_categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- PROFILES (extension de auth.users)
-- ============================================
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
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  last_sign_in_at TIMESTAMPTZ
);

-- ============================================
-- RÔLES UTILISATEURS
-- ============================================
CREATE TYPE user_role AS ENUM ('admin', 'coach', 'client');

CREATE TABLE user_roles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role user_role NOT NULL DEFAULT 'client',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, role)
);

-- Fonction has_role()
CREATE OR REPLACE FUNCTION has_role(check_user_id UUID, check_role user_role)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = check_user_id AND role = check_role
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ============================================
-- TYPES DE CRÉDITS
-- ============================================
CREATE TABLE credit_types (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL UNIQUE,
  label_fr TEXT NOT NULL,
  label_en TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- COUPONS (créé avant pack_purchases car référencé)
-- ============================================
CREATE TABLE coupons (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
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

-- ============================================
-- TYPES DE PACKS
-- ============================================
CREATE TABLE pack_types (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
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

-- Junction : quelles catégories peuvent acheter quel pack
CREATE TABLE pack_type_categories (
  pack_type_id UUID NOT NULL REFERENCES pack_types(id) ON DELETE CASCADE,
  member_category_id UUID NOT NULL REFERENCES member_categories(id) ON DELETE CASCADE,
  PRIMARY KEY (pack_type_id, member_category_id)
);

-- ============================================
-- ACHATS DE PACKS
-- ============================================
CREATE TABLE pack_purchases (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  pack_type_id UUID NOT NULL REFERENCES pack_types(id),
  price_paid_cents INTEGER NOT NULL,
  credits_remaining INTEGER NOT NULL,
  purchased_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  stripe_payment_intent_id TEXT,
  coupon_id UUID REFERENCES coupons(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- TYPES DE COURS
-- ============================================
CREATE TABLE class_types (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT,
  credit_type_id UUID NOT NULL REFERENCES credit_types(id),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- COURS PLANIFIÉS (planning)
-- ============================================
CREATE TABLE scheduled_classes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  class_type_id UUID NOT NULL REFERENCES class_types(id),
  coach_id UUID NOT NULL REFERENCES auth.users(id),
  starts_at TIMESTAMPTZ NOT NULL,
  duration_minutes INTEGER NOT NULL DEFAULT 60,
  max_participants INTEGER DEFAULT 10,
  is_cancelled BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- RÉSERVATIONS
-- ============================================
CREATE TABLE bookings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  scheduled_class_id UUID NOT NULL REFERENCES scheduled_classes(id),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  pack_purchase_id UUID NOT NULL REFERENCES pack_purchases(id),
  status TEXT NOT NULL DEFAULT 'confirmed' CHECK (status IN ('confirmed', 'cancelled')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  cancelled_at TIMESTAMPTZ,
  UNIQUE(scheduled_class_id, user_id)
);

-- ============================================
-- NOTIFICATIONS
-- ============================================
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT DEFAULT 'info',
  is_read BOOLEAN DEFAULT FALSE,
  link TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- PARAMÈTRES APPLICATION & ANNONCES
-- ============================================
CREATE TABLE app_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  key TEXT NOT NULL UNIQUE,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by UUID REFERENCES auth.users(id)
);

-- ============================================
-- FONCTIONS UTILITAIRES
-- ============================================

-- Crédits disponibles d'un utilisateur pour un type de crédit
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

-- Décrémenter un crédit lors d'une réservation
CREATE OR REPLACE FUNCTION consume_credit(p_pack_purchase_id UUID)
RETURNS VOID AS $$
  UPDATE pack_purchases
  SET credits_remaining = credits_remaining - 1
  WHERE id = p_pack_purchase_id AND credits_remaining > 0;
$$ LANGUAGE sql SECURITY DEFINER;

-- Revenu d'une réservation = prix du pack / nombre de crédits du pack
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

-- ============================================
-- TRIGGERS
-- ============================================

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, display_name, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'display_name', 'Utilisateur'),
    NEW.email
  );

  INSERT INTO user_roles (user_id, role)
  VALUES (NEW.id, 'client');

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_pack_types_updated_at
  BEFORE UPDATE ON pack_types
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_scheduled_classes_updated_at
  BEFORE UPDATE ON scheduled_classes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================
-- ENABLE RLS ON ALL TABLES
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
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;

-- ============================================
-- RLS POLICIES
-- ============================================

-- PROFILES
CREATE POLICY "Profiles: public read" ON profiles
  FOR SELECT USING (true);
CREATE POLICY "Profiles: own update" ON profiles
  FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Profiles: admin update all" ON profiles
  FOR UPDATE USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Profiles: insert on signup" ON profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- USER_ROLES
CREATE POLICY "Roles: own read" ON user_roles
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Roles: admin read all" ON user_roles
  FOR SELECT USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Roles: admin manage" ON user_roles
  FOR ALL USING (has_role(auth.uid(), 'admin'));

-- MEMBER_CATEGORIES
CREATE POLICY "Categories: public read" ON member_categories
  FOR SELECT USING (true);
CREATE POLICY "Categories: admin manage" ON member_categories
  FOR ALL USING (has_role(auth.uid(), 'admin'));

-- CREDIT_TYPES
CREATE POLICY "Credit types: public read" ON credit_types
  FOR SELECT USING (true);
CREATE POLICY "Credit types: admin manage" ON credit_types
  FOR ALL USING (has_role(auth.uid(), 'admin'));

-- PACK_TYPES
CREATE POLICY "Pack types: read active or admin" ON pack_types
  FOR SELECT USING (is_active = true OR has_role(auth.uid(), 'admin'));
CREATE POLICY "Pack types: admin manage" ON pack_types
  FOR ALL USING (has_role(auth.uid(), 'admin'));

-- PACK_TYPE_CATEGORIES
CREATE POLICY "Pack type categories: public read" ON pack_type_categories
  FOR SELECT USING (true);
CREATE POLICY "Pack type categories: admin manage" ON pack_type_categories
  FOR ALL USING (has_role(auth.uid(), 'admin'));

-- PACK_PURCHASES
CREATE POLICY "Purchases: own read" ON pack_purchases
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Purchases: admin read all" ON pack_purchases
  FOR SELECT USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Purchases: own insert" ON pack_purchases
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Purchases: admin update" ON pack_purchases
  FOR UPDATE USING (has_role(auth.uid(), 'admin'));

-- COUPONS
CREATE POLICY "Coupons: read active" ON coupons
  FOR SELECT USING (is_active = true);
CREATE POLICY "Coupons: admin manage" ON coupons
  FOR ALL USING (has_role(auth.uid(), 'admin'));

-- CLASS_TYPES
CREATE POLICY "Class types: public read" ON class_types
  FOR SELECT USING (true);
CREATE POLICY "Class types: admin manage" ON class_types
  FOR ALL USING (has_role(auth.uid(), 'admin'));

-- SCHEDULED_CLASSES
CREATE POLICY "Classes: public read" ON scheduled_classes
  FOR SELECT USING (true);
CREATE POLICY "Classes: admin manage" ON scheduled_classes
  FOR ALL USING (has_role(auth.uid(), 'admin'));

-- BOOKINGS
CREATE POLICY "Bookings: own read" ON bookings
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Bookings: admin read all" ON bookings
  FOR SELECT USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Bookings: coach read own classes" ON bookings
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM scheduled_classes sc
      WHERE sc.id = scheduled_class_id AND sc.coach_id = auth.uid()
    )
  );
CREATE POLICY "Bookings: own insert" ON bookings
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Bookings: own cancel" ON bookings
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Bookings: admin update" ON bookings
  FOR UPDATE USING (has_role(auth.uid(), 'admin'));

-- NOTIFICATIONS
CREATE POLICY "Notifications: own read" ON notifications
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Notifications: own update" ON notifications
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Notifications: system insert" ON notifications
  FOR INSERT WITH CHECK (true);

-- APP_SETTINGS
CREATE POLICY "Settings: public read" ON app_settings
  FOR SELECT USING (true);
CREATE POLICY "Settings: admin manage" ON app_settings
  FOR ALL USING (has_role(auth.uid(), 'admin'));

-- ============================================
-- ENABLE REALTIME FOR NOTIFICATIONS
-- ============================================
ALTER PUBLICATION supabase_realtime ADD TABLE notifications;

-- ============================================
-- SEED DATA (optionnel - exemples)
-- ============================================

-- Types de crédits par défaut
INSERT INTO credit_types (name, label_fr, label_en) VALUES
  ('semi_prive', 'Semi-privé', 'Semi-private'),
  ('personal_training', 'Personal Training', 'Personal Training');

-- Paramètres par défaut
INSERT INTO app_settings (key, value) VALUES
  ('announcement', '{"content": "", "published": false}'::jsonb),
  ('stripe_mode', '{"mode": "test"}'::jsonb);

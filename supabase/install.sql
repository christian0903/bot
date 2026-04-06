-- ============================================
-- Back on Track - Fitness Studio
-- Installation complète de la base de données
-- À exécuter dans le SQL Editor de Supabase
-- sur un projet NEUF (base vide)
-- ============================================

-- ============================================
-- EXTENSIONS
-- ============================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

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
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  last_sign_in_at TIMESTAMPTZ
);

-- Rôles utilisateurs
CREATE TYPE user_role AS ENUM ('admin', 'coach', 'client');

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
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Cours planifiés (planning)
CREATE TABLE scheduled_classes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_type_id UUID NOT NULL REFERENCES class_types(id),
  coach_id UUID REFERENCES auth.users(id),  -- nullable pour événements sans coach
  starts_at TIMESTAMPTZ NOT NULL,
  duration_minutes INTEGER NOT NULL DEFAULT 60,
  max_participants INTEGER DEFAULT 4,
  is_cancelled BOOLEAN DEFAULT FALSE,
  title TEXT,         -- titre custom pour événements spéciaux
  description TEXT,   -- description pour événements spéciaux
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
CREATE TYPE activity_action AS ENUM (
  'pack_purchased',
  'pack_assigned',
  'pack_modified',
  'booking_created',
  'booking_cancelled',
  'booking_assigned',
  'role_changed',
  'waitlist_joined',
  'waitlist_promoted'
);

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

-- ============================================
-- 2. FONCTIONS
-- ============================================

-- Vérifier le rôle d'un utilisateur
CREATE OR REPLACE FUNCTION has_role(check_user_id UUID, check_role user_role)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = check_user_id AND role = check_role
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

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

-- Prochaine position dans la liste d'attente
CREATE OR REPLACE FUNCTION next_waitlist_position(p_scheduled_class_id UUID)
RETURNS INTEGER AS $$
  SELECT COALESCE(MAX(position), 0) + 1
  FROM waitlist
  WHERE scheduled_class_id = p_scheduled_class_id
    AND status IN ('waiting', 'offered');
$$ LANGUAGE sql STABLE;

-- Promouvoir le premier en liste d'attente (appelée quand une réservation est annulée)
CREATE OR REPLACE FUNCTION promote_from_waitlist(p_scheduled_class_id UUID)
RETURNS UUID AS $$
DECLARE
  v_waitlist_entry RECORD;
BEGIN
  SELECT * INTO v_waitlist_entry
  FROM waitlist
  WHERE scheduled_class_id = p_scheduled_class_id
    AND status = 'waiting'
  ORDER BY position ASC
  LIMIT 1;

  IF v_waitlist_entry.id IS NULL THEN
    RETURN NULL;
  END IF;

  UPDATE waitlist
  SET status = 'offered',
      notified_at = NOW(),
      expires_at = NOW() + interval '2 hours'
  WHERE id = v_waitlist_entry.id;

  INSERT INTO notifications (user_id, title, message, type, link)
  VALUES (
    v_waitlist_entry.user_id,
    'Place disponible !',
    'Une place s''est libérée pour votre cours. Vous avez 2h pour confirmer.',
    'success',
    '/schedule'
  );

  RETURN v_waitlist_entry.id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Compter les réservations confirmées par cours
CREATE OR REPLACE FUNCTION class_bookings_count(p_scheduled_class_id UUID)
RETURNS INTEGER AS $$
  SELECT COUNT(*)::INTEGER
  FROM bookings
  WHERE scheduled_class_id = p_scheduled_class_id
    AND status = 'confirmed';
$$ LANGUAGE sql STABLE;

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 3. TRIGGER : auto-création profil à l'inscription
-- ============================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'display_name', 'Utilisateur'),
    NEW.email
  );

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'client');

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE LOG 'handle_new_user error: %', SQLERRM;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Permissions pour le trigger
GRANT USAGE ON SCHEMA public TO supabase_auth_admin;
GRANT INSERT ON public.profiles TO supabase_auth_admin;
GRANT INSERT ON public.user_roles TO supabase_auth_admin;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO supabase_auth_admin;

-- ============================================
-- 4. TRIGGERS : auto-update updated_at
-- ============================================

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_pack_types_updated_at
  BEFORE UPDATE ON pack_types FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_scheduled_classes_updated_at
  BEFORE UPDATE ON scheduled_classes FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================
-- 5. ROW LEVEL SECURITY
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

-- ============================================
-- 6. RLS POLICIES
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

-- USER_ROLES (policies séparées pour éviter la dépendance circulaire avec has_role)
CREATE POLICY "Roles: read own or admin" ON user_roles
  FOR SELECT USING (auth.uid() = user_id OR has_role(auth.uid(), 'admin'));
CREATE POLICY "Roles: admin insert" ON user_roles
  FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin'));
CREATE POLICY "Roles: admin update" ON user_roles
  FOR UPDATE USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Roles: admin delete" ON user_roles
  FOR DELETE USING (has_role(auth.uid(), 'admin'));

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
CREATE POLICY "Purchases: admin insert" ON pack_purchases
  FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin'));
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
CREATE POLICY "Classes: coach update own" ON scheduled_classes
  FOR UPDATE USING (auth.uid() = coach_id);

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
CREATE POLICY "Bookings: admin insert" ON bookings
  FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin'));
CREATE POLICY "Bookings: own cancel" ON bookings
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Bookings: admin update" ON bookings
  FOR UPDATE USING (has_role(auth.uid(), 'admin'));

-- WAITLIST
CREATE POLICY "Waitlist: own read" ON waitlist
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Waitlist: admin read" ON waitlist
  FOR SELECT USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Waitlist: own insert" ON waitlist
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Waitlist: admin insert" ON waitlist
  FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin'));
CREATE POLICY "Waitlist: own update" ON waitlist
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Waitlist: admin update" ON waitlist
  FOR UPDATE USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Waitlist: own delete" ON waitlist
  FOR DELETE USING (auth.uid() = user_id);

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

-- ACTIVITY_LOG
CREATE POLICY "Activity log: admin read" ON activity_log
  FOR SELECT USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Activity log: coach read" ON activity_log
  FOR SELECT USING (has_role(auth.uid(), 'coach'));
CREATE POLICY "Activity log: own read" ON activity_log
  FOR SELECT USING (auth.uid() = target_user_id);
CREATE POLICY "Activity log: admin insert" ON activity_log
  FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin'));
CREATE POLICY "Activity log: coach insert" ON activity_log
  FOR INSERT WITH CHECK (has_role(auth.uid(), 'coach'));
CREATE POLICY "Activity log: system insert" ON activity_log
  FOR INSERT WITH CHECK (true);

-- ============================================
-- 7. VUE : profils des coachs (bypass RLS circulaire)
-- ============================================

CREATE OR REPLACE VIEW coach_profiles AS
SELECT p.id, p.display_name, p.avatar_url, p.email, p.phone, ur.role
FROM profiles p
JOIN user_roles ur ON ur.user_id = p.id
WHERE ur.role IN ('coach', 'admin');

GRANT SELECT ON coach_profiles TO authenticated;
GRANT SELECT ON coach_profiles TO anon;

-- ============================================
-- 8. REALTIME
-- ============================================

ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
ALTER PUBLICATION supabase_realtime ADD TABLE waitlist;

-- ============================================
-- 9. DONNÉES INITIALES
-- ============================================

INSERT INTO app_settings (key, value) VALUES
  ('announcement', '{"content": "", "published": false}'::jsonb),
  ('stripe_mode', '{"mode": "test"}'::jsonb);

-- ============================================
-- INSTALLATION TERMINÉE
-- ============================================
-- Prochaines étapes :
-- 1. Créer un compte via l'application
-- 2. Promouvoir en admin :
--    UPDATE user_roles SET role = 'admin'
--    WHERE user_id = (SELECT id FROM auth.users WHERE email = 'votre@email.com');
-- 3. Configurer les types de crédits, packs, cours via l'interface admin

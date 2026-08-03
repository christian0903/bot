-- ============================================
-- PHASE 1 : Fondations & inscription enrichie
-- Back On Track v2
--
-- IMPORTANT : exécuter EN DEUX FOIS dans le SQL Editor Supabase
--   1) D'abord la SECTION A (l'enum)
--   2) Puis la SECTION B (tout le reste)
-- PostgreSQL exige que les nouvelles valeurs d'enum soient committées
-- avant de pouvoir les utiliser dans des fonctions.
-- ============================================


-- =============================================
-- SECTION A — Exécuter seul en premier
-- =============================================

ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'super_admin';


-- =============================================
-- SECTION B — Exécuter après la section A
-- (Sélectionner tout ci-dessous et exécuter)
-- =============================================

-- 1. Extension du profil utilisateur
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS date_of_birth DATE;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS address TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS emergency_contact_name TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS emergency_contact_phone TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS objectives TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS fitness_level TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS medical_conditions TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS cgv_accepted_at TIMESTAMPTZ;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS rgpd_accepted_at TIMESTAMPTZ;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS referral_code TEXT UNIQUE;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS member_status TEXT DEFAULT 'visitor'
  CHECK (member_status IN ('visitor', 'potential', 'active', 'inactive', 'former'));

-- 2. has_role : super_admin hérite des permissions admin
CREATE OR REPLACE FUNCTION has_role(check_user_id UUID, check_role user_role)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = check_user_id
      AND (role = check_role OR (check_role = 'admin' AND role = 'super_admin'))
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- 3. Étage pour les cours
ALTER TABLE scheduled_classes ADD COLUMN IF NOT EXISTS floor TEXT
  CHECK (floor IS NULL OR floor IN ('haut', 'bas'));

-- 4. Couleur pour les types de cours
ALTER TABLE class_types ADD COLUMN IF NOT EXISTS color TEXT DEFAULT '#3B82F6';

-- 5. Trigger auto-génération code parrainage
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

DROP TRIGGER IF EXISTS generate_referral_code_trigger ON profiles;
CREATE TRIGGER generate_referral_code_trigger
  BEFORE INSERT ON profiles
  FOR EACH ROW
  WHEN (NEW.referral_code IS NULL)
  EXECUTE FUNCTION generate_referral_code();

-- 6. Trigger inscription enrichie
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER
AS '
BEGIN
  INSERT INTO profiles (
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
  INSERT INTO user_roles (user_id, role) VALUES (NEW.id, ''client'');
  RETURN NEW;
END;
';

-- 7. Codes parrainage pour les membres existants
UPDATE profiles
SET referral_code = UPPER(
  LEFT(REGEXP_REPLACE(COALESCE(first_name, SPLIT_PART(display_name, ' ', 1), 'BOT'), '[^a-zA-Z]', '', 'g'), 6)
) || LPAD(FLOOR(RANDOM() * 9999 + 1)::TEXT, 4, '0')
WHERE referral_code IS NULL;

-- 8. Settings
INSERT INTO app_settings (key, value) VALUES
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
  }'::jsonb)
ON CONFLICT (key) DO NOTHING;

INSERT INTO app_settings (key, value) VALUES
  ('payment_provider', '{"provider": "stripe", "mode": "test"}'::jsonb)
ON CONFLICT (key) DO NOTHING;

INSERT INTO app_settings (key, value) VALUES
  ('studio_info', '{"name": "Back On Track", "address": "", "phone": "", "email": "", "logo_url": "", "vat_number": ""}'::jsonb)
ON CONFLICT (key) DO NOTHING;

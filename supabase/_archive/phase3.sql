-- ============================================
-- PHASE 3 : Frais d'inscription, statuts membre, séance d'essai
-- Back On Track v2
--
-- Exécuter en une seule fois dans le SQL Editor Supabase.
-- Tout est idempotent (IF NOT EXISTS / ON CONFLICT / DROP IF EXISTS).
-- ============================================

-- 1. Table des frais d'inscription
CREATE TABLE IF NOT EXISTS registration_fees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount_cents INTEGER NOT NULL DEFAULT 3000,
  paid_at TIMESTAMPTZ DEFAULT NOW(),
  stripe_payment_intent_id TEXT,
  mollie_payment_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Table séances d'essai (une seule par personne)
CREATE TABLE IF NOT EXISTS trial_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  scheduled_class_id UUID REFERENCES scheduled_classes(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

-- 3. RLS
ALTER TABLE registration_fees ENABLE ROW LEVEL SECURITY;
ALTER TABLE trial_sessions ENABLE ROW LEVEL SECURITY;

-- registration_fees policies (drop first pour idempotence)
DROP POLICY IF EXISTS "reg_fees_own_read" ON registration_fees;
CREATE POLICY "reg_fees_own_read" ON registration_fees
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "reg_fees_admin_read" ON registration_fees;
CREATE POLICY "reg_fees_admin_read" ON registration_fees
  FOR SELECT USING (has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "reg_fees_insert" ON registration_fees;
CREATE POLICY "reg_fees_insert" ON registration_fees
  FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "reg_fees_admin_all" ON registration_fees;
CREATE POLICY "reg_fees_admin_all" ON registration_fees
  FOR ALL USING (has_role(auth.uid(), 'admin'));

-- trial_sessions policies
DROP POLICY IF EXISTS "trial_own_read" ON trial_sessions;
CREATE POLICY "trial_own_read" ON trial_sessions
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "trial_own_insert" ON trial_sessions;
CREATE POLICY "trial_own_insert" ON trial_sessions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "trial_admin_read" ON trial_sessions;
CREATE POLICY "trial_admin_read" ON trial_sessions
  FOR SELECT USING (has_role(auth.uid(), 'admin'));

-- 4. Fonction : mettre à jour le statut d'un membre
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

-- 5. Fonctions utilitaires
CREATE OR REPLACE FUNCTION has_registration_fee(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql SECURITY DEFINER STABLE
AS $$
  SELECT EXISTS (SELECT 1 FROM registration_fees WHERE user_id = p_user_id);
$$;

CREATE OR REPLACE FUNCTION has_used_trial(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql SECURITY DEFINER STABLE
AS $$
  SELECT EXISTS (SELECT 1 FROM trial_sessions WHERE user_id = p_user_id);
$$;

-- 6. Setting montant frais d'inscription
INSERT INTO app_settings (key, value) VALUES
  ('registration_fee', '{"amount_cents": 3000, "enabled": true}'::jsonb)
ON CONFLICT (key) DO NOTHING;

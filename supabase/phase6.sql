-- ============================================
-- PHASE 6 : Parrainage
-- Back On Track v2
--
-- Exécuter en une seule fois dans le SQL Editor Supabase.
-- ============================================

-- 1. Table des parrainages
CREATE TABLE IF NOT EXISTS referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id UUID NOT NULL REFERENCES auth.users(id),
  referee_id UUID NOT NULL REFERENCES auth.users(id),
  referral_code TEXT NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'qualified', 'rewarded')),
  referrer_reward_cents INTEGER DEFAULT 3000,
  referee_reward_cents INTEGER DEFAULT 3000,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  qualified_at TIMESTAMPTZ,
  rewarded_at TIMESTAMPTZ,
  UNIQUE(referee_id)
);

-- 2. Récompenses utilisables
CREATE TABLE IF NOT EXISTS referral_rewards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  referral_id UUID NOT NULL REFERENCES referrals(id),
  amount_cents INTEGER NOT NULL,
  is_used BOOLEAN DEFAULT FALSE,
  used_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. RLS
ALTER TABLE referrals ENABLE ROW LEVEL SECURITY;
ALTER TABLE referral_rewards ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "referrals_own_read" ON referrals;
CREATE POLICY "referrals_own_read" ON referrals
  FOR SELECT USING (auth.uid() = referrer_id OR auth.uid() = referee_id);

DROP POLICY IF EXISTS "referrals_insert" ON referrals;
CREATE POLICY "referrals_insert" ON referrals
  FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "referrals_admin_all" ON referrals;
CREATE POLICY "referrals_admin_all" ON referrals
  FOR ALL USING (has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "rewards_own_read" ON referral_rewards;
CREATE POLICY "rewards_own_read" ON referral_rewards
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "rewards_insert" ON referral_rewards;
CREATE POLICY "rewards_insert" ON referral_rewards
  FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "rewards_update" ON referral_rewards;
CREATE POLICY "rewards_update" ON referral_rewards
  FOR UPDATE USING (true);

DROP POLICY IF EXISTS "rewards_admin_all" ON referral_rewards;
CREATE POLICY "rewards_admin_all" ON referral_rewards
  FOR ALL USING (has_role(auth.uid(), 'admin'));

-- 4. Settings parrainage
INSERT INTO app_settings (key, value) VALUES
  ('referral_rules', '{
    "referrer_reward_cents": 3000,
    "referee_reward_cents": 3000,
    "min_pack_sessions": 10,
    "max_referrals_per_user": null,
    "reward_validity_days": 180
  }'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- 5. Fonction : vérifier si un filleul a qualifié son parrainage
CREATE OR REPLACE FUNCTION check_referral_qualification(p_referee_id UUID)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER
AS '
DECLARE
  v_referral RECORD;
  v_has_fee BOOLEAN;
  v_has_pack BOOLEAN;
  v_rules JSONB;
  v_min_sessions INTEGER;
  v_validity_days INTEGER;
BEGIN
  SELECT * INTO v_referral FROM referrals WHERE referee_id = p_referee_id AND status = ''pending'';
  IF NOT FOUND THEN RETURN; END IF;

  SELECT value INTO v_rules FROM app_settings WHERE key = ''referral_rules'';
  v_min_sessions := COALESCE((v_rules->>''min_pack_sessions'')::INTEGER, 10);
  v_validity_days := COALESCE((v_rules->>''reward_validity_days'')::INTEGER, 180);

  SELECT EXISTS(SELECT 1 FROM registration_fees WHERE user_id = p_referee_id) INTO v_has_fee;

  SELECT EXISTS(
    SELECT 1 FROM pack_purchases pp
    JOIN pack_types pt ON pp.pack_type_id = pt.id
    WHERE pp.user_id = p_referee_id AND pt.credit_count >= v_min_sessions
  ) INTO v_has_pack;

  IF v_has_fee AND v_has_pack THEN
    UPDATE referrals SET status = ''qualified'', qualified_at = NOW() WHERE id = v_referral.id;

    INSERT INTO referral_rewards (user_id, referral_id, amount_cents, expires_at) VALUES
      (v_referral.referrer_id, v_referral.id,
       COALESCE((v_rules->>''referrer_reward_cents'')::INTEGER, 3000),
       NOW() + (v_validity_days || '' days'')::INTERVAL),
      (v_referral.referee_id, v_referral.id,
       COALESCE((v_rules->>''referee_reward_cents'')::INTEGER, 3000),
       NOW() + (v_validity_days || '' days'')::INTERVAL);

    INSERT INTO notifications (user_id, title, message, type, link) VALUES
      (v_referral.referrer_id, ''Parrainage validé !'',
       ''Votre filleul a rempli les conditions. 30€ de réduction sur votre prochain achat !'',
       ''success'', ''/referral''),
      (v_referral.referee_id, ''Récompense parrainage !'',
       ''Vous avez 30€ de réduction sur votre prochain achat !'',
       ''success'', ''/packs'');
  END IF;
END;
';

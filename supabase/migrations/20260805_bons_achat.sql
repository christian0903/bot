-- Bons d'achat — généralisation de referral_rewards
-- Cadrage : docs/cadrage-bons-achat.md (2026-08-05)
--
-- Un bon d'achat est nominatif, vaut un montant, et se consomme EN ENTIER.
-- Cette règle du tout-ou-rien épargne toute modification du cœur de la table :
-- amount_cents reste le montant accordé, is_used dit s'il a été utilisé. Pas de
-- solde à suivre.
--
-- Ce qui change :
--   * referral_id devient nullable — un bon peut venir d'un geste du studio,
--     sans parrainage derrière
--   * quatre colonnes de contexte : code, origin, granted_by, reason
--   * la qualification du parrainage, écrite en phase 6 puis archivée et jamais
--     appelée, est reprise ici avec la règle retenue : elle se déclenche au
--     PREMIER ACHAT PAYÉ du filleul (l'ancienne version exigeait un pack d'au
--     moins 10 séances, abandonné)
--
-- Les coupons collectifs gardent leur table (`coupons`) : quota global, pas de
-- bénéficiaire, logique différente.

-- ---------------------------------------------------------------------------
-- 1. Généralisation de la table
-- ---------------------------------------------------------------------------

ALTER TABLE referral_rewards ALTER COLUMN referral_id DROP NOT NULL;

ALTER TABLE referral_rewards ADD COLUMN IF NOT EXISTS code TEXT;
ALTER TABLE referral_rewards ADD COLUMN IF NOT EXISTS origin TEXT
  NOT NULL DEFAULT 'parrainage'
  CHECK (origin IN ('parrainage', 'geste_commercial', 'dedommagement', 'autre'));
ALTER TABLE referral_rewards ADD COLUMN IF NOT EXISTS granted_by UUID REFERENCES auth.users(id);
ALTER TABLE referral_rewards ADD COLUMN IF NOT EXISTS reason TEXT;
-- Sur quoi le bon a servi : utile au studio pour retracer une réclamation.
ALTER TABLE referral_rewards ADD COLUMN IF NOT EXISTS used_on TEXT
  CHECK (used_on IS NULL OR used_on IN ('pack', 'subscription', 'registration_fee'));

CREATE UNIQUE INDEX IF NOT EXISTS idx_referral_rewards_code ON referral_rewards(code);
CREATE INDEX IF NOT EXISTS idx_referral_rewards_user_usable
  ON referral_rewards(user_id) WHERE is_used = FALSE;

-- Code lisible au téléphone : pas de 0/O ni de 1/I, qu'on se fait répéter.
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

DROP TRIGGER IF EXISTS set_credit_note_code_trigger ON referral_rewards;
CREATE TRIGGER set_credit_note_code_trigger
  BEFORE INSERT ON referral_rewards
  FOR EACH ROW EXECUTE FUNCTION set_credit_note_code();

-- Codes pour les bons déjà en base, s'il y en a.
UPDATE referral_rewards SET code = generate_credit_note_code() WHERE code IS NULL;

-- ---------------------------------------------------------------------------
-- 2. Paramètres
-- ---------------------------------------------------------------------------
-- min_pack_sessions disparaît : la qualification tombe au premier achat payé.

INSERT INTO app_settings (key, value) VALUES
  ('referral_rules', '{
    "referrer_reward_cents": 3000,
    "referee_reward_cents": 3000,
    "reward_validity_days": 180
  }'::jsonb)
ON CONFLICT (key) DO UPDATE SET value = jsonb_strip_nulls(
  app_settings.value || '{"min_pack_sessions": null}'::jsonb
);

-- ---------------------------------------------------------------------------
-- 3. Qualification du parrainage
-- ---------------------------------------------------------------------------
-- Appelée par le webhook Stripe à chaque paiement réussi du filleul : frais
-- d'inscription, pack ponctuel ou échéance d'abonnement. Le premier des trois
-- déclenche les deux bons.
--
-- Idempotente : le filtre status = 'pending' garantit qu'un rejeu d'événement
-- ne crée pas de bons en double.
--
-- La version de la phase 6 renvoyait VOID : PostgreSQL refuse de changer le
-- type de retour d'une fonction existante, d'où le DROP préalable.

DROP FUNCTION IF EXISTS check_referral_qualification(UUID);

CREATE FUNCTION check_referral_qualification(p_referee_id UUID)
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
  v_referrer_cents := COALESCE(
    v_referral.referrer_reward_cents,
    (v_rules->>'referrer_reward_cents')::INTEGER, 3000);
  v_referee_cents := COALESCE(
    v_referral.referee_reward_cents,
    (v_rules->>'referee_reward_cents')::INTEGER, 3000);
  v_expires := NOW() + (v_validity_days || ' days')::INTERVAL;

  UPDATE referrals
  SET status = 'qualified', qualified_at = NOW()
  WHERE id = v_referral.id;

  INSERT INTO referral_rewards (user_id, referral_id, amount_cents, expires_at, origin) VALUES
    (v_referral.referrer_id, v_referral.id, v_referrer_cents, v_expires, 'parrainage'),
    (v_referral.referee_id,  v_referral.id, v_referee_cents,  v_expires, 'parrainage');

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

-- ---------------------------------------------------------------------------
-- 4. Bons utilisables d'un membre
-- ---------------------------------------------------------------------------
-- Triés par expiration la plus proche : c'est celui qu'on risque de perdre,
-- donc celui qu'on propose en premier.

DROP FUNCTION IF EXISTS get_usable_credit_notes(UUID);

CREATE FUNCTION get_usable_credit_notes(p_user_id UUID)
RETURNS TABLE(
  id UUID,
  code TEXT,
  amount_cents INTEGER,
  origin TEXT,
  reason TEXT,
  expires_at TIMESTAMPTZ
) AS $$
  SELECT r.id, r.code, r.amount_cents, r.origin, r.reason, r.expires_at
  FROM referral_rewards r
  WHERE r.user_id = p_user_id
    AND r.is_used = FALSE
    AND (r.expires_at IS NULL OR r.expires_at > NOW())
  ORDER BY r.expires_at ASC NULLS LAST, r.created_at ASC;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ---------------------------------------------------------------------------
-- 5. Consommation
-- ---------------------------------------------------------------------------
-- Appelée par le webhook UNIQUEMENT, une fois le paiement confirmé. Jamais au
-- moment du calcul : un client qui ferme la page de paiement perdrait son bon
-- sans rien avoir acheté.
--
-- Le UPDATE conditionnel (is_used = FALSE) rend l'opération idempotente : un
-- rejeu d'événement Stripe ne consomme pas deux fois.

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

-- ---------------------------------------------------------------------------
-- 6. Rattachement rétroactif d'un parrain (admin)
-- ---------------------------------------------------------------------------
-- Les codes oubliés à l'inscription seront fréquents et réclamés après coup.
-- L'exception se gère à la main, mais il faut l'outil.

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

-- ---------------------------------------------------------------------------
-- 6 bis. Enregistrement du parrainage par le filleul lui-même
-- ---------------------------------------------------------------------------
-- Remplace l'INSERT direct que faisait `processReferralCode` côté client : la
-- policy ouverte qui le permettait laissait n'importe qui s'attribuer un
-- parrain arbitraire. Ici l'appelant ne peut créer QUE son propre parrainage,
-- et la fonction renvoie une erreur explicite au lieu d'échouer en silence —
-- le filleul saura que son code n'a pas été reconnu.

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

-- ---------------------------------------------------------------------------
-- 7. Accorder un bon à la main (admin)
-- ---------------------------------------------------------------------------

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

-- ---------------------------------------------------------------------------
-- 8. RLS
-- ---------------------------------------------------------------------------

-- Trou de sécurité de la phase 6 : `rewards_insert WITH CHECK (true)` laissait
-- n'importe quel membre authentifié se créer un bon du montant de son choix,
-- et `rewards_update USING (true)` modifier ceux des autres. Les deux tombent.
DROP POLICY IF EXISTS "rewards_insert" ON referral_rewards;
DROP POLICY IF EXISTS "rewards_update" ON referral_rewards;

-- Même chose côté parrainages : un membre pouvait s'inscrire n'importe quel
-- parrain. Les créations passent désormais par attach_referrer (admin) ou par
-- le webhook / le code applicatif en service_role.
DROP POLICY IF EXISTS "referrals_insert" ON referrals;

DROP POLICY IF EXISTS "rewards_own_read" ON referral_rewards;
CREATE POLICY "rewards_own_read" ON referral_rewards
  FOR SELECT USING (
    auth.uid() = user_id
    OR has_role(auth.uid(), 'admin')
    OR has_role(auth.uid(), 'super_admin')
  );

-- Les écritures passent par les fonctions SECURITY DEFINER ci-dessus, et par
-- le webhook (service_role, qui contourne RLS). Aucune policy d'écriture
-- ouverte : un membre ne doit pas pouvoir se créer un bon.

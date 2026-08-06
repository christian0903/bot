-- Montant minimum d'achat pour activer un bon de FILLEUL
--
-- Sans seuil, un nouveau membre peut liquider son bon de 30 € sur une carte
-- séance unique à 25 € : il touche la valeur sans s'engager, et le studio perd
-- la marge sans rien gagner en fidélisation. Le bon devient un levier
-- d'engagement, pas seulement une remise.
--
-- Le seuil ne vise QUE le filleul (décision du 2026-08-06) :
--   * le parrain est déjà client — abonné ou acheteur de packs. Rien ne
--     justifie de conditionner sa récompense, il n'y a personne à convaincre.
--   * un dédommagement accordé par le studio reste utilisable sans condition,
--     sinon le geste se retourne contre le membre.
--
-- D'où une origine distincte pour chaque côté du parrainage : les deux bons
-- portaient jusqu'ici la même valeur 'parrainage', impossible à départager.
--
-- Paramétrable dans app_settings.referral_rules :
--   min_purchase_cents  — plancher d'achat, 3000 (30 €) par défaut
--
-- Le seuil porte sur le prix de l'achat AVANT déduction, jamais sur ce qui
-- reste à payer : c'est l'engagement qui est mesuré, pas le décaissement.

UPDATE app_settings
SET value = value || '{"min_purchase_cents": 3000}'::jsonb
WHERE key = 'referral_rules'
  AND NOT (value ? 'min_purchase_cents');

-- ---------------------------------------------------------------------------
-- Distinguer le bon du filleul de celui du parrain
-- ---------------------------------------------------------------------------

ALTER TABLE referral_rewards DROP CONSTRAINT IF EXISTS referral_rewards_origin_check;
ALTER TABLE referral_rewards ADD CONSTRAINT referral_rewards_origin_check
  CHECK (origin IN ('parrainage', 'parrainage_filleul', 'geste_commercial', 'dedommagement', 'autre'));

-- Les bons déjà créés : ceux du filleul se reconnaissent au referee_id.
UPDATE referral_rewards r
SET origin = 'parrainage_filleul'
FROM referrals f
WHERE r.referral_id = f.id
  AND r.user_id = f.referee_id
  AND r.origin = 'parrainage';

-- ---------------------------------------------------------------------------
-- Bons utilisables pour un achat donné
-- ---------------------------------------------------------------------------
-- p_purchase_cents NULL = on ne filtre pas (liste générale, page Parrainage).
-- Sinon on ne renvoie que les bons que cet achat permet d'activer.

DROP FUNCTION IF EXISTS get_usable_credit_notes(UUID);
DROP FUNCTION IF EXISTS get_usable_credit_notes(UUID, INTEGER);

CREATE FUNCTION get_usable_credit_notes(
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

-- ---------------------------------------------------------------------------
-- Contrôle serveur
-- ---------------------------------------------------------------------------
-- Le front masque déjà les bons non activables, mais create-checkout-session
-- est appelable directement : le seuil se vérifie là où il engage de l'argent.

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

-- ---------------------------------------------------------------------------
-- Qualification : chaque côté reçoit son origine
-- ---------------------------------------------------------------------------
-- Seule différence avec la version du 2026-08-05 : le bon du filleul porte
-- 'parrainage_filleul', celui du parrain reste 'parrainage'. C'est ce qui
-- permet au seuil de ne viser que le nouveau membre.

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

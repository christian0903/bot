-- ============================================================================
-- Pack d'essai — la séance offerte devient une vraie réservation
-- ----------------------------------------------------------------------------
-- Jusqu'ici, réserver un cours d'essai écrivait une ligne dans `trial_sessions`
-- et nulle part ailleurs. Or les écrans du membre (« Mes réservations », les
-- cours prévus sur l'accueil) et la liste de présence du coach lisent tous
-- `bookings`. Résultat : l'essai était invisible partout, y compris pour le
-- coach qui voyait arriver quelqu'un qu'il n'attendait pas.
--
-- La cause était structurelle : `bookings.pack_purchase_id` était NOT NULL, et
-- un essai n'a pas de pack acheté derrière lui. `trial_sessions` avait été
-- créée pour contourner l'obstacle, mais elle ne sert que de jeton d'unicité.
--
-- On ne rustine pas les écrans : on donne à l'essai un vrai pack, gratuit et
-- invisible au catalogue, attribué à la création du profil. L'essai produit
-- alors une réservation ordinaire, et tous les écrans le voient sans qu'aucun
-- ne soit modifié.
--
-- `trial_sessions` est SUPPRIMÉE (§7). Garder deux systèmes en parallèle
-- recréerait la divergence qui a produit le bug : deux sources de vérité pour
-- le même fait finissent toujours par se contredire. La question « cette
-- personne a-t-elle eu son essai ? » se répond désormais par l'existence de
-- son pack d'essai, et l'usage de l'essai par la réservation elle-même.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Un pack peut être gratuit et hors catalogue
-- ---------------------------------------------------------------------------
-- price_cents > 0 interdisait le prix nul. La gratuité est un prix légitime :
-- on l'autorise, en gardant l'interdiction des montants négatifs.
ALTER TABLE pack_types DROP CONSTRAINT IF EXISTS pack_types_price_cents_check;
ALTER TABLE pack_types ADD CONSTRAINT pack_types_price_cents_check
  CHECK (price_cents >= 0);

-- `is_active` ne suffit pas à rendre un pack invisible : un pack inactif n'est
-- ni achetable NI utilisable, et le checkout le refuse. Il faut distinguer
-- « retiré du service » de « distribué autrement qu'à la vente ».
ALTER TABLE pack_types ADD COLUMN IF NOT EXISTS is_purchasable BOOLEAN NOT NULL DEFAULT TRUE;
COMMENT ON COLUMN pack_types.is_purchasable IS
  'FALSE = le pack n''apparaît pas au catalogue et ne peut pas être acheté, mais reste actif et utilisable. Cas du pack d''essai, attribué automatiquement.';

ALTER TABLE pack_types ADD COLUMN IF NOT EXISTS is_trial BOOLEAN NOT NULL DEFAULT FALSE;
COMMENT ON COLUMN pack_types.is_trial IS
  'Marque LE pack d''essai. Un seul à la fois (index unique partiel ci-dessous).';

-- Un seul pack d'essai : sans cette garantie, l'attribution devrait choisir
-- entre plusieurs candidats et le comportement deviendrait imprévisible.
CREATE UNIQUE INDEX IF NOT EXISTS pack_types_single_trial
  ON pack_types (is_trial) WHERE is_trial;

-- ---------------------------------------------------------------------------
-- 2. Une réservation peut être un essai, donc sans pack acheté
-- ---------------------------------------------------------------------------
ALTER TABLE bookings ALTER COLUMN pack_purchase_id DROP NOT NULL;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS is_trial BOOLEAN NOT NULL DEFAULT FALSE;

-- Le pack d'essai produit malgré tout une ligne `pack_purchases` (c'est ce qui
-- porte le crédit et sa date d'expiration). `pack_purchase_id` reste donc
-- rempli dans le cas nominal ; on autorise le NULL uniquement pour un essai,
-- afin de couvrir une régularisation faite à la main par le studio.
ALTER TABLE bookings DROP CONSTRAINT IF EXISTS bookings_pack_or_trial;
ALTER TABLE bookings ADD CONSTRAINT bookings_pack_or_trial
  CHECK (pack_purchase_id IS NOT NULL OR is_trial);

COMMENT ON COLUMN bookings.is_trial IS
  'Réservation consommant la séance d''essai offerte. Sert à l''affichage (badge) et aux statistiques de conversion.';

-- ---------------------------------------------------------------------------
-- 3. Le réglage
-- ---------------------------------------------------------------------------
-- validity_days vit sur le pack_type, mais le studio doit pouvoir l'ajuster
-- sans passer par la gestion des packs : le réglage est la source de vérité,
-- appliquée à chaque attribution.
INSERT INTO app_settings (key, value) VALUES
  ('trial_pack', '{
    "enabled": true,
    "validity_days": 30
  }'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 4. Le pack d'essai lui-même
-- ---------------------------------------------------------------------------
-- Semi-privé uniquement (décision du 2026-08-07) : un essai en personal
-- training coûterait 75 € de temps coach au studio.
DO $$
DECLARE
  v_credit_type_id UUID;
BEGIN
  -- On vise le type semi-privé. `label_fr` est le libellé affiché ; on retient
  -- le plus ancien pour rester déterministe si un doublon existe.
  SELECT id INTO v_credit_type_id
  FROM credit_types
  WHERE lower(label_fr) LIKE '%semi%'
  ORDER BY created_at
  LIMIT 1;

  IF v_credit_type_id IS NULL THEN
    RAISE EXCEPTION 'Pack d''essai : aucun type de crédit « semi-privé » trouvé. Créez-le avant d''appliquer cette migration.';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pack_types WHERE is_trial) THEN
    INSERT INTO pack_types (
      name, description, credit_type_id, credit_count, price_cents,
      validity_days, is_active, is_purchasable, is_trial
    ) VALUES (
      'Séance d''essai offerte',
      'Une séance semi-privée offerte pour découvrir le studio.',
      v_credit_type_id,
      1,
      0,
      COALESCE((SELECT (value->>'validity_days')::INTEGER FROM app_settings WHERE key = 'trial_pack'), 30),
      TRUE,   -- actif : le crédit doit rester utilisable
      FALSE,  -- hors catalogue : ne s'achète pas
      TRUE
    );
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 5. L'attribution
-- ---------------------------------------------------------------------------
-- Volontairement PAS dans handle_new_user() : ce trigger avale ses erreurs
-- (EXCEPTION WHEN OTHERS ... RAISE LOG), si bien qu'un échec d'attribution
-- passerait inaperçu. C'est exactement le motif qui a produit les trois bugs
-- du 6 août. Ici, la fonction est appelée explicitement et son résultat est
-- lisible par l'appelant.
--
-- Idempotente : un second appel ne crée pas un deuxième crédit.
CREATE OR REPLACE FUNCTION grant_trial_pack(p_user_id UUID)
RETURNS JSONB
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
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
  -- qui répond à « cette personne a-t-elle eu son essai ? » — l'ancien jeton
  -- trial_sessions faisait double emploi avec cette ligne.
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
$$;

COMMENT ON FUNCTION grant_trial_pack IS
  'Attribue la séance d''essai offerte. Idempotente. Appelée à la création du profil et rejouable par un admin.';

-- Attribution automatique à la création du profil. Le trigger porte sur
-- `profiles` et non sur `auth.users` : à ce moment le profil existe déjà, donc
-- la clé étrangère de pack_purchases est satisfaite.
CREATE OR REPLACE FUNCTION public.grant_trial_on_profile_create()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  PERFORM grant_trial_pack(NEW.id);
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Un essai non attribué ne doit pas empêcher la création du compte, mais
  -- l'incident doit rester visible : il est journalisé, pas avalé en silence.
  RAISE WARNING 'grant_trial_on_profile_create(%) a échoué : %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_profile_created_grant_trial ON public.profiles;
CREATE TRIGGER on_profile_created_grant_trial
  AFTER INSERT ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.grant_trial_on_profile_create();

-- ---------------------------------------------------------------------------
-- 6. Le pack d'essai ne se vend pas
-- ---------------------------------------------------------------------------
-- Le front masque déjà les packs non achetables, mais create-checkout-session
-- est appelable directement : le refus se pose là où il engage de l'argent.
-- (Contrôle effectif côté Edge Function ; ce commentaire documente l'intention
-- pour qui lit le schéma.)
COMMENT ON TABLE pack_types IS
  'Catalogue des packs. is_purchasable = FALSE les retire de la vente sans les désactiver (pack d''essai).';

-- ---------------------------------------------------------------------------
-- 7. Retrait de l'ancien système
-- ---------------------------------------------------------------------------
-- has_used_trial() répond désormais depuis pack_purchases : une seule source
-- de vérité. La signature est conservée — d'anciens appels peuvent subsister.
CREATE OR REPLACE FUNCTION has_used_trial(p_user_id UUID)
RETURNS BOOLEAN
SECURITY DEFINER
SET search_path = public
LANGUAGE sql
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM bookings b
    WHERE b.user_id = p_user_id
      AND b.is_trial
      AND b.status = 'confirmed'
  );
$$;

COMMENT ON FUNCTION has_used_trial IS
  'TRUE si la séance d''essai a été consommée (réservation active). Distinct de « l''essai a été attribué » : un essai annulé redevient disponible.';

-- La purge des données de test : on reprend la fonction du 2026-08-05 à
-- l'identique (contrôle admin, refus en mode live, protection des abonnements
-- live, retour JSONB), en changeant seulement ce qui touche à l'essai —
-- le DELETE sur trial_sessions disparaît avec la table, et le membre remis à
-- zéro retrouve sa séance d'essai.
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

REVOKE ALL ON FUNCTION reset_member_purchases(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION reset_member_purchases(UUID) TO authenticated;

GRANT EXECUTE ON FUNCTION grant_trial_pack(UUID) TO authenticated;

-- L'ancien jeton n'a plus d'usage : deux sources de vérité pour le même fait
-- se contredisent tôt ou tard. C'est ce qui a produit le bug corrigé ici.
DROP TABLE IF EXISTS trial_sessions CASCADE;

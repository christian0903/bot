-- ============================================================================
-- Suppression de compte par le membre
-- ----------------------------------------------------------------------------
-- Apple l'exige depuis 2022 : toute application permettant de créer un compte
-- doit permettre de le supprimer DEPUIS l'application. C'est un motif de rejet
-- automatique à la revue. Le RGPD porte la même exigence (droit à l'effacement,
-- article 17).
--
-- Mais l'effacement n'est PAS absolu. L'article 17.3(b) réserve le cas d'une
-- obligation légale de conservation, et le droit comptable belge impose de
-- garder sept ans les pièces justificatives — factures, paiements, abonnements.
-- Supprimer réellement un membre effacerait ces traces : `registration_fees`,
-- `subscriptions` et `pack_purchases` partiraient en cascade.
--
-- On ANONYMISE donc : la personne disparaît, la comptabilité reste. Les lignes
-- financières perdent tout lien avec un individu identifiable, ce qui satisfait
-- le RGPD, et gardent leurs montants et leurs dates, ce qui satisfait le fisc.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Marquer un compte comme fermé
-- ---------------------------------------------------------------------------
-- Nouvelle action de journal. `IF NOT EXISTS` : une valeur d'énumération ne
-- se retire pas, et la migration doit pouvoir être rejouée.
ALTER TYPE activity_action ADD VALUE IF NOT EXISTS 'account_deleted';

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

COMMENT ON COLUMN profiles.deleted_at IS
  'Compte fermé à la demande du membre. Les données personnelles sont anonymisées ; les lignes comptables sont conservées sans lien identifiable.';

-- ---------------------------------------------------------------------------
-- 2. Ce qui empêche de fermer
-- ---------------------------------------------------------------------------
-- Un abonnement actif continuerait de prélever après la fermeture : le membre
-- se retrouverait débité sans compte pour le constater ni le résilier.
CREATE OR REPLACE FUNCTION can_delete_own_account()
RETURNS JSONB
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $fn$
DECLARE
  v_uid           UUID := auth.uid();
  v_sub_count     INTEGER;
  v_future_count  INTEGER;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_authenticated');
  END IF;

  SELECT COUNT(*) INTO v_sub_count
  FROM subscriptions
  WHERE user_id = v_uid AND status IN ('active', 'past_due', 'paused', 'incomplete');

  IF v_sub_count > 0 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'active_subscription');
  END IF;

  -- Les réservations à venir ne bloquent pas, mais le membre doit savoir
  -- qu'elles seront annulées : la place doit repartir aux autres.
  SELECT COUNT(*) INTO v_future_count
  FROM bookings b
  JOIN scheduled_classes sc ON sc.id = b.scheduled_class_id
  WHERE b.user_id = v_uid AND b.status = 'confirmed' AND sc.starts_at > NOW();

  RETURN jsonb_build_object('ok', true, 'upcoming_bookings', v_future_count);
END;
$fn$;

COMMENT ON FUNCTION can_delete_own_account IS
  'Vérifie qu''un compte peut être fermé et annonce ce qui sera perdu. Un abonnement actif bloque : sans compte, le membre ne pourrait plus le résilier.';

-- ---------------------------------------------------------------------------
-- 3. Fermer le compte
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION delete_own_account()
RETURNS JSONB
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $fn$
DECLARE
  v_uid   UUID := auth.uid();
  v_check JSONB;
  v_tag   TEXT;
BEGIN
  v_check := can_delete_own_account();
  IF NOT (v_check->>'ok')::BOOLEAN THEN
    RETURN v_check;
  END IF;

  -- Repère lisible pour le studio : « Membre supprimé #a1b2c3d4 ». Sans lui,
  -- les journaux d'activité deviendraient illisibles.
  v_tag := 'Membre supprimé #' || substr(v_uid::text, 1, 8);

  -- Les cours à venir sont libérés : la place doit servir à quelqu'un d'autre.
  -- On passe par l'annulation ordinaire pour que la liste d'attente soit
  -- prévenue et le crédit traité selon la règle du délai.
  PERFORM cancel_booking_v2(b.id, v_uid)
  FROM bookings b
  JOIN scheduled_classes sc ON sc.id = b.scheduled_class_id
  WHERE b.user_id = v_uid AND b.status = 'confirmed' AND sc.starts_at > NOW();

  DELETE FROM waitlist WHERE user_id = v_uid;

  -- Les données personnelles disparaissent. Ce qui reste dans les tables
  -- financières n'est plus rattachable à une personne identifiable.
  UPDATE profiles SET
    display_name            = v_tag,
    first_name              = NULL,
    last_name               = NULL,
    email                   = NULL,
    phone                   = NULL,
    date_of_birth           = NULL,
    address                 = NULL,
    bio                     = NULL,
    avatar_url              = NULL,
    emergency_contact_name  = NULL,
    emergency_contact_phone = NULL,
    objectives              = NULL,
    medical_conditions      = NULL,
    fitness_level           = NULL,
    instagram_url           = NULL,
    facebook_url            = NULL,
    linkedin_url            = NULL,
    coach_description       = NULL,
    -- Le code de parrainage part aussi : il désigne une personne.
    referral_code           = NULL,
    member_status           = 'former',
    deleted_at              = NOW()
  WHERE id = v_uid;

  -- Communications et file d'e-mails : sans valeur comptable, et elles
  -- contiennent des noms. Elles s'effacent.
  DELETE FROM notifications WHERE user_id = v_uid;
  DELETE FROM email_queue WHERE user_id = v_uid;

  -- Les performances sont des données de santé au sens du RGPD : traitement
  -- plus strict, aucune raison de les garder.
  DELETE FROM performances WHERE user_id = v_uid;

  -- L'accès est retiré. Les lignes comptables — registration_fees,
  -- pack_purchases, subscriptions, invoice_requests — restent en place,
  -- désormais reliées à un profil anonyme.
  DELETE FROM user_roles WHERE user_id = v_uid;

  INSERT INTO activity_log (action, actor_id, target_user_id, entity_type, entity_id, description)
  VALUES ('account_deleted', v_uid, v_uid, 'profile', v_uid,
          'Compte fermé à la demande du membre — données personnelles anonymisées');

  RETURN jsonb_build_object('ok', true);
END;
$fn$;

COMMENT ON FUNCTION delete_own_account IS
  'Ferme le compte du membre appelant : anonymise ses données personnelles, libère ses cours à venir, retire ses accès. Les pièces comptables sont conservées sans lien identifiable (droit comptable belge : sept ans).';

REVOKE ALL ON FUNCTION can_delete_own_account() FROM PUBLIC;
REVOKE ALL ON FUNCTION delete_own_account() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION can_delete_own_account() TO authenticated;
GRANT EXECUTE ON FUNCTION delete_own_account() TO authenticated;

-- ---------------------------------------------------------------------------
-- 4. Un compte fermé n'apparaît plus dans les listes
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS profiles_active
  ON profiles (member_status)
  WHERE deleted_at IS NULL;

-- ---------------------------------------------------------------------------
-- 5. Suppression par le studio
-- ---------------------------------------------------------------------------
-- `delete_own_account` ne travaille que sur l'appelant : un admin ne peut pas
-- s'en servir pour un membre qui le demande par téléphone ou au comptoir.
-- Mêmes règles, plus la traçabilité — le journal retient qui a supprimé et le
-- nom d'origine, seul endroit où il subsiste après l'anonymisation.
CREATE OR REPLACE FUNCTION delete_member_account(p_user_id UUID)
RETURNS JSONB
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $fn$
DECLARE
  v_actor  UUID := auth.uid();
  v_subs   INTEGER;
  v_tag    TEXT;
  v_name   TEXT;
BEGIN
  IF NOT (has_role(v_actor, 'admin') OR has_role(v_actor, 'super_admin')) THEN
    RAISE EXCEPTION 'Reserve aux administrateurs';
  END IF;

  IF has_role(p_user_id, 'super_admin') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'super_admin_protected');
  END IF;

  SELECT display_name INTO v_name FROM profiles WHERE id = p_user_id;
  IF v_name IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
  END IF;

  SELECT COUNT(*) INTO v_subs
  FROM subscriptions
  WHERE user_id = p_user_id AND status IN ('active', 'past_due', 'paused', 'incomplete');

  IF v_subs > 0 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'active_subscription');
  END IF;

  v_tag := 'Membre supprimé #' || substr(p_user_id::text, 1, 8);

  PERFORM cancel_booking_by_studio(b.id)
  FROM bookings b
  JOIN scheduled_classes sc ON sc.id = b.scheduled_class_id
  WHERE b.user_id = p_user_id AND b.status = 'confirmed' AND sc.starts_at > NOW();

  DELETE FROM waitlist WHERE user_id = p_user_id;

  UPDATE profiles SET
    display_name = v_tag, first_name = NULL, last_name = NULL, email = NULL,
    phone = NULL, date_of_birth = NULL, address = NULL, bio = NULL,
    avatar_url = NULL, emergency_contact_name = NULL,
    emergency_contact_phone = NULL, objectives = NULL,
    medical_conditions = NULL, fitness_level = NULL, instagram_url = NULL,
    facebook_url = NULL, linkedin_url = NULL, coach_description = NULL,
    referral_code = NULL, member_status = 'former', deleted_at = NOW()
  WHERE id = p_user_id;

  DELETE FROM notifications WHERE user_id = p_user_id;
  DELETE FROM email_queue WHERE user_id = p_user_id;
  DELETE FROM performances WHERE user_id = p_user_id;
  DELETE FROM user_roles WHERE user_id = p_user_id;

  INSERT INTO activity_log (action, actor_id, target_user_id, entity_type, entity_id, details, description)
  VALUES ('account_deleted', v_actor, p_user_id, 'profile', p_user_id,
          jsonb_build_object('deleted_by_staff', true, 'former_name', v_name),
          format('Compte de %s supprimé par le studio — données personnelles anonymisées', v_name));

  RETURN jsonb_build_object('ok', true, 'former_name', v_name);
END;
$fn$;

REVOKE ALL ON FUNCTION delete_member_account(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION delete_member_account(UUID) TO authenticated;

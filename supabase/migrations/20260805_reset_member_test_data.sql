-- Remise à zéro des achats d'un membre — OUTIL DE TEST UNIQUEMENT
--
-- Permet de rejouer un scénario complet (inscription → achat → réservation)
-- sans créer un nouveau compte à chaque fois.
--
-- Trois protections, parce que cette fonction détruit des données :
--   1. réservée aux admins ;
--   2. refuse de s'exécuter si app_settings.stripe_mode vaut 'live' ;
--   3. refuse si le membre a un abonnement créé en mode live (un paiement
--      réel a eu lieu, même si le mode a changé depuis).
--
-- L'ordre de suppression suit les clés étrangères : bookings et
-- invoice_requests référencent pack_purchases sans ON DELETE CASCADE.
-- subscription_discounts part en cascade avec l'abonnement.

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
  DELETE FROM trial_sessions WHERE user_id = p_user_id;

  PERFORM update_member_status(p_user_id);

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

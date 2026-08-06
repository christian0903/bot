-- Inscription d'un membre par le staff
--
-- Un coach ne pouvait inscrire personne : consommer un crédit demande
-- d'écrire dans pack_purchases, réservé aux admins. Or c'est lui qui est sur
-- place, et le cas de dernière minute est réel — quelqu'un se présente, il
-- reste de la place, le cours n'a pas encore commencé.
--
-- Règles retenues (2026-08-06) :
--   * un COACH inscrit dans SES cours ; un ADMIN partout
--   * le délai de fermeture des réservations est IGNORÉ — c'est justement
--     l'intérêt : le staff décide sur le terrain
--   * la salle pleine reste bloquante : on ne dépasse pas la capacité
--   * pas de crédit du bon type = refus, avec un message clair. Aucune
--     séance offerte par inadvertance.

CREATE OR REPLACE FUNCTION book_member_by_staff(
  p_class_id UUID,
  p_user_id UUID,
  p_pack_purchase_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER
AS $fn$
DECLARE
  v_is_admin BOOLEAN := has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'super_admin');
  v_is_coach BOOLEAN := has_role(auth.uid(), 'coach');
  v_class RECORD;
  v_count INTEGER;
  v_pack RECORD;
  v_booking_id UUID;
  v_member TEXT;
BEGIN
  IF NOT (v_is_admin OR v_is_coach) THEN
    RAISE EXCEPTION 'Reserve au staff du studio';
  END IF;

  SELECT * INTO v_class FROM scheduled_classes WHERE id = p_class_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'class_not_found');
  END IF;

  -- Un coach n'agit que sur ses propres cours : il est responsable de sa
  -- salle, pas de celle d'un collègue.
  IF NOT v_is_admin AND v_class.coach_id IS DISTINCT FROM auth.uid() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_your_class');
  END IF;

  IF v_class.is_cancelled THEN
    RETURN jsonb_build_object('ok', false, 'error', 'class_cancelled');
  END IF;

  -- Le cours passé reste inscriptible : un coach peut régulariser après coup
  -- quelqu'un qui est venu. Seule la capacité fait barrage.
  SELECT COUNT(*) INTO v_count
  FROM bookings WHERE scheduled_class_id = p_class_id AND status = 'confirmed';

  IF v_count >= v_class.max_participants THEN
    RETURN jsonb_build_object('ok', false, 'error', 'class_full');
  END IF;

  IF EXISTS(SELECT 1 FROM bookings
             WHERE scheduled_class_id = p_class_id
               AND user_id = p_user_id
               AND status = 'confirmed') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'already_booked');
  END IF;

  -- Source de paiement : celle qu'on nous donne, sinon la première utilisable
  -- (abonnement d'abord, cf. get_available_credits).
  IF p_pack_purchase_id IS NOT NULL THEN
    SELECT pp.id, pp.credits_remaining, pt.is_unlimited
      INTO v_pack
    FROM pack_purchases pp
    JOIN pack_types pt ON pt.id = pp.pack_type_id
    WHERE pp.id = p_pack_purchase_id
      AND pp.user_id = p_user_id
      AND pp.expires_at > NOW()
      AND (pt.is_unlimited OR pp.credits_remaining > 0);
  ELSE
    SELECT c.pack_purchase_id, c.credits_remaining, c.is_unlimited
      INTO v_pack
    FROM get_available_credits(
           p_user_id,
           (SELECT credit_type_id FROM class_types WHERE id = v_class.class_type_id)
         ) c
    LIMIT 1;
  END IF;

  IF v_pack IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'no_credit');
  END IF;

  -- Réactiver une annulation plutôt que d'en créer une seconde : la
  -- contrainte d'unicité (cours, membre) l'interdirait.
  UPDATE bookings
     SET status = 'confirmed',
         pack_purchase_id = v_pack.id,
         cancelled_at = NULL,
         is_no_show = FALSE
   WHERE scheduled_class_id = p_class_id
     AND user_id = p_user_id
     AND status = 'cancelled'
  RETURNING id INTO v_booking_id;

  IF v_booking_id IS NULL THEN
    INSERT INTO bookings (scheduled_class_id, user_id, pack_purchase_id)
    VALUES (p_class_id, p_user_id, v_pack.id)
    RETURNING id INTO v_booking_id;
  END IF;

  PERFORM consume_credit(v_pack.id);

  SELECT display_name INTO v_member FROM profiles WHERE id = p_user_id;

  INSERT INTO activity_log (action, actor_id, target_user_id, entity_type, entity_id, details, description)
  VALUES ('booking_assigned', auth.uid(), p_user_id, 'booking', v_booking_id,
          jsonb_build_object('by_staff', true, 'scheduled_class_id', p_class_id),
          format('%s inscrit(e) par le staff au cours du %s',
                 COALESCE(v_member, '?'),
                 to_char(v_class.starts_at AT TIME ZONE 'Europe/Brussels', 'DD/MM/YYYY HH24:MI')));

  RETURN jsonb_build_object('ok', true, 'booking_id', v_booking_id);
END;
$fn$;

COMMENT ON FUNCTION book_member_by_staff(UUID, UUID, UUID) IS
  'Inscrit un membre à un cours à l''initiative du staff. Ignore le délai de fermeture des réservations — le coach décide sur le terrain — mais respecte la capacité de la salle. Un coach n''agit que sur ses propres cours.';

REVOKE ALL ON FUNCTION book_member_by_staff(UUID, UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION book_member_by_staff(UUID, UUID, UUID) TO authenticated;

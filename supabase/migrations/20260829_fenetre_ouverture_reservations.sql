-- ============================================================================
-- Fenetre d'ouverture des reservations
--
-- Un cours ne se reserve que s'il commence dans les N prochains jours. Au-dela,
-- le planning le montre — un membre doit pouvoir voir ce qui l'attend — mais le
-- bouton refuse.
--
-- Fenetre GLISSANTE : a tout instant, les N prochains jours sont ouverts. Un
-- cours dans onze jours devient reservable demain a la meme heure, pas a minuit
-- ni a midi. C'est le choix de Christian (2026-08-29) contre l'ouverture par
-- paliers quotidiens, qui aurait fait courir tout le monde a la meme minute.
--
-- La limite vaut AUSSI pour le staff. Un coach qui inscrit quelqu'un au
-- telephone est soumis a la meme regle : deux regimes auraient produit des
-- plannings incoherents, et personne n'aurait su lequel faisait foi.
--
-- Reglage : `booking_rules.booking_window_days`. Absent, la fenetre est
-- desactivee — une base qui n'a pas encore ce reglage ne doit rien bloquer.
-- ============================================================================

-- Le reglage, pose sans ecraser le reste de la cle.
UPDATE app_settings
   SET value = value || '{"booking_window_days": 10}'::jsonb
 WHERE key = 'booking_rules'
   AND NOT (value ? 'booking_window_days');

-- Phase 4 : Vérifier si un membre peut réserver
CREATE OR REPLACE FUNCTION can_book_class(p_class_id UUID, p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER
AS '
DECLARE
  v_class RECORD;
  v_rules JSONB;
  v_now TIMESTAMPTZ := NOW();
  v_bookings_count INTEGER;
  v_class_hour INTEGER;
  v_cutoff TIMESTAMPTZ;
  v_class_date DATE;
  v_window_days NUMERIC;
BEGIN
  SELECT * INTO v_class FROM scheduled_classes WHERE id = p_class_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object(''can_book'', false, ''reason'', ''class_not_found'');
  END IF;

  SELECT value INTO v_rules FROM app_settings WHERE key = ''booking_rules'';
  IF v_rules IS NULL THEN RETURN jsonb_build_object(''can_book'', true); END IF;

  IF v_class.starts_at <= v_now THEN
    RETURN jsonb_build_object(''can_book'', false, ''reason'', ''class_past'');
  END IF;
  IF v_class.is_cancelled THEN
    RETURN jsonb_build_object(''can_book'', false, ''reason'', ''class_cancelled'');
  END IF;

  -- Fenetre d''ouverture : au-dela de N jours, le cours se voit mais ne se
  -- reserve pas. Fenetre glissante — les N prochains jours sont ouverts a tout
  -- instant. Absent du reglage, aucune limite : une base qui ne connait pas
  -- encore ce champ ne doit rien bloquer.
  v_window_days := (v_rules->>''booking_window_days'')::NUMERIC;
  IF v_window_days IS NOT NULL AND v_window_days > 0
     AND v_class.starts_at > v_now + (v_window_days || '' days'')::INTERVAL THEN
    RETURN jsonb_build_object(
      ''can_book'', false,
      ''reason'', ''outside_booking_window'',
      ''window_days'', v_window_days,
      ''opens_at'', v_class.starts_at - (v_window_days || '' days'')::INTERVAL
    );
  END IF;
  IF EXISTS(SELECT 1 FROM bookings WHERE scheduled_class_id = p_class_id AND user_id = p_user_id AND status = ''confirmed'') THEN
    RETURN jsonb_build_object(''can_book'', false, ''reason'', ''already_booked'');
  END IF;

  SELECT COUNT(*) INTO v_bookings_count FROM bookings WHERE scheduled_class_id = p_class_id AND status = ''confirmed'';
  IF v_bookings_count >= v_class.max_participants THEN
    RETURN jsonb_build_object(''can_book'', false, ''reason'', ''class_full'');
  END IF;

  v_class_hour := EXTRACT(HOUR FROM v_class.starts_at AT TIME ZONE ''Europe/Brussels'');
  v_class_date := (v_class.starts_at AT TIME ZONE ''Europe/Brussels'')::DATE;

  IF v_class_hour < COALESCE((v_rules->>''morning_class_before_hour'')::INTEGER, 12) THEN
    v_cutoff := (v_class_date - INTERVAL ''1 day''
                + (COALESCE((v_rules->>''morning_cutoff_hour'')::INTEGER, 20) || '' hours'')::INTERVAL)
                AT TIME ZONE ''Europe/Brussels'';
  ELSE
    IF v_bookings_count = 0 THEN
      v_cutoff := v_class.starts_at - (COALESCE((v_rules->>''afternoon_hours_before_no_bookings'')::INTEGER, 3) || '' hours'')::INTERVAL;
    ELSE
      v_cutoff := v_class.starts_at - (COALESCE((v_rules->>''afternoon_minutes_before_with_bookings'')::INTEGER, 30) || '' minutes'')::INTERVAL;
    END IF;
  END IF;

  IF v_now > v_cutoff THEN
    RETURN jsonb_build_object(''can_book'', false, ''reason'', ''booking_closed'');
  END IF;

  RETURN jsonb_build_object(''can_book'', true);
END;
';

CREATE OR REPLACE FUNCTION book_member_by_staff(
  p_class_id UUID,
  p_user_id UUID,
  p_pack_purchase_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER
AS $fn$
DECLARE
  v_window_days NUMERIC;
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

  -- La fenetre d'ouverture vaut AUSSI pour le staff (decision du 2026-08-29) :
  -- deux regimes auraient produit des plannings incoherents, et personne
  -- n'aurait su lequel faisait foi.
  --
  -- Elle ne borne que le futur : un cours passe reste inscriptible, c'est ce
  -- qui permet a un coach de regulariser quelqu'un qui est venu.
  SELECT (value->>'booking_window_days')::NUMERIC INTO v_window_days
    FROM app_settings WHERE key = 'booking_rules';
  IF v_window_days IS NOT NULL AND v_window_days > 0
     AND v_class.starts_at > NOW() + (v_window_days || ' days')::INTERVAL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'outside_booking_window');
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

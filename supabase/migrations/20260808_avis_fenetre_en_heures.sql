-- ============================================================================
-- Avis : fenêtre en heures, ouverture différée, suppression par le membre
-- ----------------------------------------------------------------------------
-- Trois changements liés :
--
--   * la fenêtre passe des JOURS aux HEURES. Mélanger « 2 heures après » et
--     « 7 jours pour » obligeait à convertir de tête pour savoir si les deux
--     bornes se recouvraient ;
--   * une borne d'OUVERTURE apparaît (`hours_before_review`) : le studio peut
--     imposer un temps de décantation avant qu'un avis soit possible. Un avis
--     donné dans la minute qui suit un cours dit surtout l'humeur du moment ;
--   * le membre peut RETIRER son avis, pas seulement le corriger. Ce qu'on
--     laisse modifier, on doit laisser effacer.
--
-- Les deux bornes se comptent depuis la FIN du cours (début + durée) : le
-- studio règle un délai sans avoir à tenir compte de la durée de chaque cours.
--
-- Réglage `app_settings.class_reviews`, piloté depuis l'écran admin :
--   { "enabled": true, "hours_before_review": 0, "hours_to_review": 168 }
--
-- 168 h = les 7 jours de l'ancien réglage : la conversion ci-dessous préserve
-- le comportement existant.
-- ============================================================================

UPDATE app_settings
SET value = jsonb_build_object(
      'enabled', COALESCE((value->>'enabled')::BOOLEAN, TRUE),
      'hours_before_review', GREATEST(0, COALESCE((value->>'hours_before_review')::NUMERIC, 0)),
      'hours_to_review', GREATEST(1, COALESCE((value->>'days_to_review')::NUMERIC * 24, 168))
    )
WHERE key = 'class_reviews';

-- ---------------------------------------------------------------------------
-- Les séances qui attendent un avis
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION pending_class_reviews()
RETURNS TABLE (
  booking_id UUID,
  scheduled_class_id UUID,
  class_name TEXT,
  starts_at TIMESTAMPTZ,
  coach_name TEXT
)
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
STABLE
AS $fn$
DECLARE
  v_settings JSONB;
  v_open     NUMERIC;
  v_close    NUMERIC;
BEGIN
  SELECT value INTO v_settings FROM app_settings WHERE key = 'class_reviews';

  IF COALESCE((v_settings->>'enabled')::BOOLEAN, TRUE) IS NOT TRUE THEN
    RETURN;
  END IF;

  v_open  := GREATEST(0, COALESCE((v_settings->>'hours_before_review')::NUMERIC, 0));
  v_close := GREATEST(1, COALESCE((v_settings->>'hours_to_review')::NUMERIC, 168));

  RETURN QUERY
  SELECT b.id,
         sc.id,
         COALESCE(sc.title, ct.name),
         sc.starts_at,
         co.display_name
  FROM bookings b
  JOIN scheduled_classes sc ON sc.id = b.scheduled_class_id
  LEFT JOIN class_types ct ON ct.id = sc.class_type_id
  LEFT JOIN profiles co ON co.id = sc.coach_id
  WHERE b.user_id = auth.uid()
    AND b.status = 'confirmed'
    AND NOT sc.is_cancelled
    -- Les deux bornes partent de la fin du cours.
    AND sc.starts_at + (sc.duration_minutes || ' minutes')::INTERVAL
        + (v_open || ' hours')::INTERVAL < NOW()
    AND sc.starts_at + (sc.duration_minutes || ' minutes')::INTERVAL
        + (v_close || ' hours')::INTERVAL > NOW()
    AND NOT EXISTS (SELECT 1 FROM class_reviews r WHERE r.booking_id = b.id)
  ORDER BY sc.starts_at DESC;
END;
$fn$;

COMMENT ON FUNCTION pending_class_reviews IS
  'Séances suivies par l''appelant qui attendent encore un avis. Ouvre `hours_before_review` heures après la fin du cours, ferme `hours_to_review` heures après cette même fin.';

-- ---------------------------------------------------------------------------
-- Déposer ou corriger un avis
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION submit_class_review(
  p_booking_id UUID,
  p_rating SMALLINT,
  p_comment TEXT DEFAULT NULL
)
RETURNS JSONB
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $fn$
DECLARE
  v_uid      UUID := auth.uid();
  v_booking  RECORD;
  v_settings JSONB;
  v_open     NUMERIC;
  v_close    NUMERIC;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_authenticated');
  END IF;

  IF p_rating IS NULL OR p_rating < 1 OR p_rating > 5 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_rating');
  END IF;

  SELECT value INTO v_settings FROM app_settings WHERE key = 'class_reviews';

  -- Coupée : ni dépôt ni correction.
  IF COALESCE((v_settings->>'enabled')::BOOLEAN, TRUE) IS NOT TRUE THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'disabled');
  END IF;

  v_open  := GREATEST(0, COALESCE((v_settings->>'hours_before_review')::NUMERIC, 0));
  v_close := GREATEST(1, COALESCE((v_settings->>'hours_to_review')::NUMERIC, 168));

  -- La réservation doit être la sienne, confirmée, et la fenêtre ouverte.
  SELECT b.id, b.scheduled_class_id INTO v_booking
  FROM bookings b
  JOIN scheduled_classes sc ON sc.id = b.scheduled_class_id
  WHERE b.id = p_booking_id
    AND b.user_id = v_uid
    AND b.status = 'confirmed'
    AND sc.starts_at + (sc.duration_minutes || ' minutes')::INTERVAL
        + (v_open || ' hours')::INTERVAL < NOW()
    AND sc.starts_at + (sc.duration_minutes || ' minutes')::INTERVAL
        + (v_close || ' hours')::INTERVAL > NOW();

  IF v_booking.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_eligible');
  END IF;

  INSERT INTO class_reviews (booking_id, user_id, scheduled_class_id, rating, comment)
  VALUES (p_booking_id, v_uid, v_booking.scheduled_class_id, p_rating, NULLIF(trim(p_comment), ''))
  ON CONFLICT (booking_id) DO UPDATE
    SET rating = EXCLUDED.rating,
        comment = EXCLUDED.comment,
        updated_at = NOW();

  RETURN jsonb_build_object('ok', true);
END;
$fn$;

COMMENT ON FUNCTION submit_class_review IS
  'Dépose ou corrige l''avis du membre. Ouvre `hours_before_review` heures après la fin du cours, ferme `hours_to_review` heures après cette même fin. La modification suit la même fenêtre que le dépôt.';

-- ---------------------------------------------------------------------------
-- Retirer son avis
-- ---------------------------------------------------------------------------
-- Même fenêtre que la modification : ce qu'on peut corriger, on peut le
-- retirer. Un avis donné à chaud se regrette, et forcer quelqu'un à vivre avec
-- une note qu'il désavoue ne rend service à personne.
CREATE OR REPLACE FUNCTION delete_class_review(p_booking_id UUID)
RETURNS JSONB
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $fn$
DECLARE
  v_uid      UUID := auth.uid();
  v_settings JSONB;
  v_close    NUMERIC;
  v_deleted  INTEGER;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_authenticated');
  END IF;

  SELECT value INTO v_settings FROM app_settings WHERE key = 'class_reviews';
  v_close := GREATEST(1, COALESCE((v_settings->>'hours_to_review')::NUMERIC, 168));

  DELETE FROM class_reviews r
  USING scheduled_classes sc
  WHERE r.booking_id = p_booking_id
    AND r.user_id = v_uid
    AND sc.id = r.scheduled_class_id
    AND sc.starts_at + (sc.duration_minutes || ' minutes')::INTERVAL
        + (v_close || ' hours')::INTERVAL > NOW();

  GET DIAGNOSTICS v_deleted = ROW_COUNT;

  IF v_deleted = 0 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_eligible');
  END IF;

  RETURN jsonb_build_object('ok', true);
END;
$fn$;

COMMENT ON FUNCTION delete_class_review IS
  'Retire l''avis du membre sur une séance. Refuse hors de la fenêtre `hours_to_review` : au-delà, l''avis est figé.';

-- ---------------------------------------------------------------------------
-- Ce que le membre relit
-- ---------------------------------------------------------------------------
-- `editable` évite à l'interface de refaire le calcul de fenêtre côté client :
-- une seule source de vérité, et pas de bouton qui échoue au clic.
DROP FUNCTION IF EXISTS my_class_reviews();

CREATE OR REPLACE FUNCTION my_class_reviews()
RETURNS TABLE (
  booking_id UUID,
  scheduled_class_id UUID,
  rating SMALLINT,
  comment TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  editable BOOLEAN
)
SECURITY DEFINER
SET search_path = public
LANGUAGE sql
STABLE
AS $fn$
  SELECT r.booking_id,
         r.scheduled_class_id,
         r.rating,
         r.comment,
         r.created_at,
         r.updated_at,
         sc.starts_at + (sc.duration_minutes || ' minutes')::INTERVAL
           + (GREATEST(1, COALESCE(
               (SELECT (value->>'hours_to_review')::NUMERIC FROM app_settings WHERE key = 'class_reviews'),
               168)) || ' hours')::INTERVAL > NOW()
  FROM class_reviews r
  JOIN scheduled_classes sc ON sc.id = r.scheduled_class_id
  WHERE r.user_id = auth.uid()
  ORDER BY r.created_at DESC;
$fn$;

COMMENT ON FUNCTION my_class_reviews IS
  'Les avis déposés par l''appelant. `editable` dit si la fenêtre `hours_to_review` est encore ouverte — au-delà, l''avis est figé.';

REVOKE ALL ON FUNCTION delete_class_review(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION my_class_reviews() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION delete_class_review(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION my_class_reviews() TO authenticated;

-- ============================================================================
-- Avis sur les cours : délai réglable et interrupteur
-- ----------------------------------------------------------------------------
-- Suite de `20260807_avis_cours.sql`, qui figeait la fenêtre de notation à
-- trente jours en dur. Le studio doit pouvoir choisir : une semaine pour avoir
-- des retours à chaud, plus large si les membres viennent moins souvent. Et
-- pouvoir couper la fonctionnalité sans qu'on touche au code.
--
-- Le réglage vit dans `app_settings` sous la clé `class_reviews`, pilotée
-- depuis l'écran admin des réglages :
--   { "enabled": true, "days_to_review": 7 }
--
-- Le délai s'applique aux DEUX bouts — la liste des séances à noter et le
-- contrôle d'éligibilité au dépôt. Sinon un membre gardant une vieille invite
-- ouverte contournerait la fenêtre.
--
-- Note : cette migration avait été appliquée directement sur la base
-- (`20260807153356 avis_delai_reglable`) sans que le fichier soit versionné.
-- Elle est reconstituée ici depuis la définition réelle des fonctions, pour
-- que le dépôt redevienne la source de vérité.
-- ============================================================================

INSERT INTO app_settings (key, value)
VALUES ('class_reviews', '{"enabled": true, "days_to_review": 7}'::JSONB)
ON CONFLICT (key) DO NOTHING;

-- ---------------------------------------------------------------------------
-- Les séances qui attendent un avis
-- ---------------------------------------------------------------------------
-- Passe en plpgsql : il faut lire le réglage avant de décider quoi renvoyer,
-- et sortir tôt si la fonctionnalité est coupée.
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
  v_days     INTEGER;
BEGIN
  SELECT value INTO v_settings FROM app_settings WHERE key = 'class_reviews';

  -- Coupée : aucune séance ne remonte, donc plus aucune invite à noter.
  IF COALESCE((v_settings->>'enabled')::BOOLEAN, TRUE) IS NOT TRUE THEN
    RETURN;
  END IF;

  -- Au moins un jour : un réglage à zéro rendrait la notation impossible.
  v_days := GREATEST(1, COALESCE((v_settings->>'days_to_review')::INTEGER, 7));

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
    -- La séance doit être finie, pas seulement commencée.
    AND sc.starts_at + (sc.duration_minutes || ' minutes')::INTERVAL < NOW()
    AND sc.starts_at > NOW() - (v_days || ' days')::INTERVAL
    AND NOT EXISTS (SELECT 1 FROM class_reviews r WHERE r.booking_id = b.id)
  ORDER BY sc.starts_at DESC;
END;
$fn$;

COMMENT ON FUNCTION pending_class_reviews IS
  'Séances suivies par l''appelant qui attendent encore un avis. La fenêtre vient du réglage `class_reviews.days_to_review` ; si `enabled` est faux, ne renvoie rien.';

-- ---------------------------------------------------------------------------
-- Déposer un avis
-- ---------------------------------------------------------------------------
-- Même fenêtre que ci-dessus : ce qui n'est plus proposé n'est plus acceptable.
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
  v_days     INTEGER;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_authenticated');
  END IF;

  IF p_rating IS NULL OR p_rating < 1 OR p_rating > 5 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_rating');
  END IF;

  SELECT value INTO v_settings FROM app_settings WHERE key = 'class_reviews';
  v_days := GREATEST(1, COALESCE((v_settings->>'days_to_review')::INTEGER, 7));

  -- La réservation doit être la sienne, confirmée, le cours terminé, et la
  -- fenêtre encore ouverte. Ces conditions ensemble rendent impossible de
  -- noter un cours auquel on n'est pas allé, ou une séance trop ancienne.
  SELECT b.id, b.scheduled_class_id INTO v_booking
  FROM bookings b
  JOIN scheduled_classes sc ON sc.id = b.scheduled_class_id
  WHERE b.id = p_booking_id
    AND b.user_id = v_uid
    AND b.status = 'confirmed'
    AND sc.starts_at + (sc.duration_minutes || ' minutes')::INTERVAL < NOW()
    AND sc.starts_at > NOW() - (v_days || ' days')::INTERVAL;

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
  'Dépose ou corrige l''avis du membre sur une séance suivie. Refuse si la réservation n''est pas la sienne, n''est pas confirmée, si le cours n''est pas terminé, ou si la fenêtre de notation est passée.';

REVOKE ALL ON FUNCTION pending_class_reviews() FROM PUBLIC;
REVOKE ALL ON FUNCTION submit_class_review(UUID, SMALLINT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION pending_class_reviews() TO authenticated;
GRANT EXECUTE ON FUNCTION submit_class_review(UUID, SMALLINT, TEXT) TO authenticated;

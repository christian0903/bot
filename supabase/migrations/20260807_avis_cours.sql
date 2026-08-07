-- ============================================================================
-- Avis sur les cours
-- ----------------------------------------------------------------------------
-- Une note de 1 à 5 étoiles et un commentaire libre, laissés par le membre
-- après une séance.
--
-- La question « qui a le droit de noter quoi » se règle en base : un avis
-- s'attache à une RÉSERVATION, pas à un cours. Il faut donc avoir été inscrit,
-- et le cours doit être passé. L'index unique fait le reste — une séance, un
-- avis.
--
-- Anonyme pour le coach, nominatif pour l'admin (décision du 2026-08-07) :
-- un membre mécontent n'ose pas noter honnêtement quelqu'un qu'il reverra
-- mardi, mais un avis intraçable n'engage personne.
-- ============================================================================

CREATE TABLE IF NOT EXISTS class_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- L'avis porte sur la réservation : c'est elle qui prouve la présence.
  booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  -- Dupliqué depuis la réservation pour que les politiques d'accès n'aient pas
  -- à faire de jointure, et pour retrouver ses avis après coup.
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  scheduled_class_id UUID NOT NULL REFERENCES scheduled_classes(id) ON DELETE CASCADE,
  rating SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- Une séance, un avis. Le membre peut le modifier, pas en empiler.
  UNIQUE (booking_id)
);

COMMENT ON TABLE class_reviews IS
  'Avis d''un membre sur une séance suivie. Rattaché à la réservation : sans inscription confirmée, pas d''avis possible.';

COMMENT ON COLUMN class_reviews.rating IS
  '1 à 5 étoiles. Le commentaire reste facultatif — exiger un texte fait chuter le taux de réponse.';

-- Moyenne par cours, et avis d'un membre : les deux lectures fréquentes.
CREATE INDEX IF NOT EXISTS class_reviews_class ON class_reviews (scheduled_class_id);
CREATE INDEX IF NOT EXISTS class_reviews_user ON class_reviews (user_id, created_at DESC);

ALTER TABLE class_reviews ENABLE ROW LEVEL SECURITY;

-- Le membre voit et gère les siens.
CREATE POLICY "Reviews: own read" ON class_reviews
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Reviews: own update" ON class_reviews
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Le staff lit tout : le coach pour ses cours, l'admin pour piloter.
-- L'anonymat côté coach se joue à l'affichage, pas ici — l'admin doit pouvoir
-- remonter à l'auteur en cas d'avis problématique.
CREATE POLICY "Reviews: staff read" ON class_reviews
  FOR SELECT USING (
    has_role(auth.uid(), 'coach')
    OR has_role(auth.uid(), 'admin')
    OR has_role(auth.uid(), 'super_admin')
  );

-- Pas de policy INSERT : l'écriture passe par `submit_class_review`, qui
-- vérifie que le cours est bien passé et que le membre y était inscrit. Une
-- policy INSERT ouverte laisserait noter n'importe quel cours.

-- ---------------------------------------------------------------------------
-- Les séances qui attendent un avis
-- ---------------------------------------------------------------------------
-- Cours terminés, réservation confirmée, pas encore notés. Bornée à trente
-- jours : proposer de noter une séance d'il y a six mois n'a pas de sens, et
-- la mémoire du membre non plus.
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
LANGUAGE sql
STABLE
AS $fn$
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
    AND sc.starts_at > NOW() - INTERVAL '30 days'
    AND NOT EXISTS (SELECT 1 FROM class_reviews r WHERE r.booking_id = b.id)
  ORDER BY sc.starts_at DESC;
$fn$;

COMMENT ON FUNCTION pending_class_reviews IS
  'Séances suivies par l''appelant qui attendent encore un avis. Bornée à trente jours : au-delà, le souvenir s''est estompé.';

-- ---------------------------------------------------------------------------
-- Déposer un avis
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
  v_uid     UUID := auth.uid();
  v_booking RECORD;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_authenticated');
  END IF;

  IF p_rating IS NULL OR p_rating < 1 OR p_rating > 5 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_rating');
  END IF;

  -- La réservation doit être la sienne, confirmée, et le cours terminé. Ces
  -- trois conditions ensemble rendent impossible de noter un cours auquel on
  -- n'est pas allé.
  SELECT b.id, b.scheduled_class_id INTO v_booking
  FROM bookings b
  JOIN scheduled_classes sc ON sc.id = b.scheduled_class_id
  WHERE b.id = p_booking_id
    AND b.user_id = v_uid
    AND b.status = 'confirmed'
    AND sc.starts_at + (sc.duration_minutes || ' minutes')::INTERVAL < NOW();

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
  'Dépose ou corrige l''avis du membre sur une séance suivie. Refuse si la réservation n''est pas la sienne, n''est pas confirmée, ou si le cours n''est pas terminé.';

REVOKE ALL ON FUNCTION pending_class_reviews() FROM PUBLIC;
REVOKE ALL ON FUNCTION submit_class_review(UUID, SMALLINT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION pending_class_reviews() TO authenticated;
GRANT EXECUTE ON FUNCTION submit_class_review(UUID, SMALLINT, TEXT) TO authenticated;

-- ---------------------------------------------------------------------------
-- Ce que le coach voit
-- ---------------------------------------------------------------------------
-- Sans le nom de l'auteur : c'est la contrepartie de la franchise. L'admin,
-- lui, lit la table directement et peut remonter à la personne.
CREATE OR REPLACE FUNCTION class_reviews_for_staff(p_scheduled_class_id UUID)
RETURNS TABLE (
  rating SMALLINT,
  comment TEXT,
  created_at TIMESTAMPTZ
)
SECURITY DEFINER
SET search_path = public
LANGUAGE sql
STABLE
AS $fn$
  SELECT r.rating, r.comment, r.created_at
  FROM class_reviews r
  WHERE r.scheduled_class_id = p_scheduled_class_id
    AND (has_role(auth.uid(), 'coach')
      OR has_role(auth.uid(), 'admin')
      OR has_role(auth.uid(), 'super_admin'))
  ORDER BY r.created_at DESC;
$fn$;

COMMENT ON FUNCTION class_reviews_for_staff IS
  'Avis d''un cours, sans le nom des auteurs. L''anonymat côté coach est ce qui rend les avis honnêtes ; l''admin garde l''accès nominatif via la table.';

REVOKE ALL ON FUNCTION class_reviews_for_staff(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION class_reviews_for_staff(UUID) TO authenticated;

-- ============================================================================
-- Avis : filtres admin par période, coach et type de cours
-- ----------------------------------------------------------------------------
-- La liste admin sans filtre de période obligeait à charger tout l'historique
-- puis à trancher côté client — la limite tronquait avant même le filtrage,
-- donc « les avis de mars » pouvait en oublier.
--
-- La période porte sur la date du COURS, pas sur celle du dépôt : « les avis de
-- cette semaine » veut dire les cours de cette semaine. Le tri suit la même
-- logique.
--
-- Le paramètre `p_max_rating` disparaît : il servait un filtre « avis
-- négatifs » dont le seuil (≤2) était arbitraire. Le filtre par étoile exacte
-- se fait côté client, sur les avis déjà chargés — c'est instantané et ça
-- laisse le jugement à qui lit.
-- ============================================================================

DROP FUNCTION IF EXISTS class_reviews_for_admin(UUID, UUID, SMALLINT, INTEGER);

CREATE OR REPLACE FUNCTION class_reviews_for_admin(
  p_coach_id UUID DEFAULT NULL,
  p_class_type_id UUID DEFAULT NULL,
  p_from TIMESTAMPTZ DEFAULT NULL,
  p_to TIMESTAMPTZ DEFAULT NULL,
  p_limit INTEGER DEFAULT 500
)
RETURNS TABLE (
  id UUID,
  rating SMALLINT,
  comment TEXT,
  created_at TIMESTAMPTZ,
  user_id UUID,
  member_name TEXT,
  member_email TEXT,
  scheduled_class_id UUID,
  class_name TEXT,
  class_type_id UUID,
  starts_at TIMESTAMPTZ,
  coach_id UUID,
  coach_name TEXT
)
SECURITY DEFINER
SET search_path = public
LANGUAGE sql
STABLE
AS $fn$
  SELECT r.id,
         r.rating,
         r.comment,
         r.created_at,
         r.user_id,
         m.display_name,
         m.email,
         r.scheduled_class_id,
         COALESCE(sc.title, ct.name),
         sc.class_type_id,
         sc.starts_at,
         sc.coach_id,
         co.display_name
  FROM class_reviews r
  JOIN scheduled_classes sc ON sc.id = r.scheduled_class_id
  LEFT JOIN class_types ct ON ct.id = sc.class_type_id
  LEFT JOIN profiles m  ON m.id = r.user_id
  LEFT JOIN profiles co ON co.id = sc.coach_id
  WHERE (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'super_admin'))
    -- Filtres facultatifs : NULL = pas de filtre.
    AND (p_coach_id IS NULL OR sc.coach_id = p_coach_id)
    AND (p_class_type_id IS NULL OR sc.class_type_id = p_class_type_id)
    AND (p_from IS NULL OR sc.starts_at >= p_from)
    AND (p_to IS NULL OR sc.starts_at <= p_to)
  ORDER BY sc.starts_at DESC
  LIMIT GREATEST(1, LEAST(COALESCE(p_limit, 500), 2000));
$fn$;

COMMENT ON FUNCTION class_reviews_for_admin IS
  'Avis avec l''identité de leur auteur, pour l''admin seul. Filtres facultatifs par coach, type de cours et période (sur la date du COURS, pas du dépôt). Triés par date de cours décroissante.';

REVOKE ALL ON FUNCTION class_reviews_for_admin(UUID, UUID, TIMESTAMPTZ, TIMESTAMPTZ, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION class_reviews_for_admin(UUID, UUID, TIMESTAMPTZ, TIMESTAMPTZ, INTEGER) TO authenticated;

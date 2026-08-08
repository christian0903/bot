-- ============================================================================
-- Consultation des avis : admin nominatif, coach restreint, membre relecture
-- ----------------------------------------------------------------------------
-- Les avis existaient mais n'étaient consultables que cours par cours, depuis
-- la fiche d'un cours passé. Trois manques, trois réponses ici :
--
--   * l'admin n'avait aucune vue d'ensemble, alors que la RLS lui donne déjà
--     l'accès nominatif — `class_reviews_for_admin` expose enfin l'auteur ;
--   * `class_reviews_for_staff` laissait n'importe quel coach lire les avis de
--     n'importe quel cours ; il est resserré à ses propres cours ;
--   * le membre ne pouvait pas relire ce qu'il avait écrit — `my_class_reviews`
--     le lui rend.
--
-- L'anonymat côté coach est conservé (décision du 2026-08-07) : un membre qui
-- reverra son coach mardi ne note pas franchement s'il se sait identifiable.
-- La levée éventuelle de cet anonymat est un choix de studio, pas un défaut à
-- corriger — d'où deux fonctions distinctes plutôt qu'un drapeau.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Ce que le coach voit : ses cours seulement, toujours anonyme
-- ---------------------------------------------------------------------------
-- Avant, la seule condition était « avoir un rôle staff » : un coach pouvait
-- lire les avis des cours d'un collègue en connaissant l'identifiant du cours.
-- L'admin garde l'accès à tout, puisque c'est son métier de piloter.
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
  JOIN scheduled_classes sc ON sc.id = r.scheduled_class_id
  WHERE r.scheduled_class_id = p_scheduled_class_id
    AND (
      -- Le coach : uniquement les cours qu'il a lui-même donnés.
      (has_role(auth.uid(), 'coach') AND sc.coach_id = auth.uid())
      OR has_role(auth.uid(), 'admin')
      OR has_role(auth.uid(), 'super_admin')
    )
  ORDER BY r.created_at DESC;
$fn$;

COMMENT ON FUNCTION class_reviews_for_staff IS
  'Avis d''un cours, sans le nom des auteurs. Le coach n''y accède que pour les cours qu''il a donnés ; l''admin voit tout. Pour l''accès nominatif, voir `class_reviews_for_admin`.';

-- ---------------------------------------------------------------------------
-- Ce que l'admin voit : tout, avec l'auteur
-- ---------------------------------------------------------------------------
-- Réservé à l'admin — un coach qui appellerait cette fonction n'obtient rien.
-- C'est ce qui permet de traiter un avis problématique : sans le nom, on ne
-- peut ni recontacter la personne ni constater un acharnement.
CREATE OR REPLACE FUNCTION class_reviews_for_admin(
  p_coach_id UUID DEFAULT NULL,
  p_class_type_id UUID DEFAULT NULL,
  p_max_rating SMALLINT DEFAULT NULL,
  p_limit INTEGER DEFAULT 200
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
    -- Sert à isoler les avis négatifs, qui sont ceux qui demandent une action.
    AND (p_max_rating IS NULL OR r.rating <= p_max_rating)
  ORDER BY r.created_at DESC
  LIMIT GREATEST(1, LEAST(COALESCE(p_limit, 200), 1000));
$fn$;

COMMENT ON FUNCTION class_reviews_for_admin IS
  'Avis avec l''identité de leur auteur, pour l''admin seul. Filtres facultatifs par coach, type de cours et note maximale.';

-- ---------------------------------------------------------------------------
-- Statistiques par coach, pour l'admin
-- ---------------------------------------------------------------------------
-- Une moyenne globale ne dit pas grand-chose ; la comparaison entre coachs, si.
-- Les coachs sans aucun avis sont exclus : afficher « — » pour quelqu'un qui
-- n'a pas encore été noté invite à conclure trop vite.
--
-- Volontairement sans compteur d'avis « négatifs » : le seuil en dessous duquel
-- une note devient un problème est un jugement de studio, pas une donnée. Le
-- filtre par étoiles laisse ce jugement à qui lit.
--
-- DROP préalable : le type de retour d'une fonction ne se change pas par un
-- simple CREATE OR REPLACE. Sur une base où une version antérieure de cette
-- migration a tourné, la fonction existe déjà avec une colonne `low_count`.
DROP FUNCTION IF EXISTS class_review_stats_by_coach();

CREATE OR REPLACE FUNCTION class_review_stats_by_coach()
RETURNS TABLE (
  coach_id UUID,
  coach_name TEXT,
  review_count BIGINT,
  average_rating NUMERIC
)
SECURITY DEFINER
SET search_path = public
LANGUAGE sql
STABLE
AS $fn$
  SELECT sc.coach_id,
         co.display_name,
         COUNT(*),
         ROUND(AVG(r.rating)::NUMERIC, 2)
  FROM class_reviews r
  JOIN scheduled_classes sc ON sc.id = r.scheduled_class_id
  LEFT JOIN profiles co ON co.id = sc.coach_id
  WHERE (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'super_admin'))
    AND sc.coach_id IS NOT NULL
  GROUP BY sc.coach_id, co.display_name
  ORDER BY AVG(r.rating) DESC;
$fn$;

COMMENT ON FUNCTION class_review_stats_by_coach IS
  'Nombre d''avis et moyenne par coach. Admin seul. Pas de notion d''avis « négatif » : le seuil est un jugement de studio, pas une donnée.';

-- ---------------------------------------------------------------------------
-- Ce que le membre relit
-- ---------------------------------------------------------------------------
-- La policy « own read » couvrait déjà la table, mais le client aurait dû
-- joindre les cours lui-même. Cette fonction rend l'historique lisible en une
-- requête, et sert à afficher sa note sous chaque séance passée.
--
-- Pas de borne de temps ici, contrairement à `pending_class_reviews` : relire
-- un avis ancien ne pose aucun problème, c'est le déposer qui a une fenêtre.
CREATE OR REPLACE FUNCTION my_class_reviews()
RETURNS TABLE (
  booking_id UUID,
  scheduled_class_id UUID,
  rating SMALLINT,
  comment TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
)
SECURITY DEFINER
SET search_path = public
LANGUAGE sql
STABLE
AS $fn$
  SELECT r.booking_id, r.scheduled_class_id, r.rating, r.comment, r.created_at, r.updated_at
  FROM class_reviews r
  WHERE r.user_id = auth.uid()
  ORDER BY r.created_at DESC;
$fn$;

COMMENT ON FUNCTION my_class_reviews IS
  'Les avis déposés par l''appelant, pour les relire depuis son historique de réservations.';

REVOKE ALL ON FUNCTION class_reviews_for_admin(UUID, UUID, SMALLINT, INTEGER) FROM PUBLIC;
REVOKE ALL ON FUNCTION class_review_stats_by_coach() FROM PUBLIC;
REVOKE ALL ON FUNCTION my_class_reviews() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION class_reviews_for_admin(UUID, UUID, SMALLINT, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION class_review_stats_by_coach() TO authenticated;
GRANT EXECUTE ON FUNCTION my_class_reviews() TO authenticated;

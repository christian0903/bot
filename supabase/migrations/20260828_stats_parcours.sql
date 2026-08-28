-- Les trois étapes du parcours, comptées sur une période : comptes créés,
-- premier essai réservé, premier pack payant acheté.
--
-- Trois chiffres bruts, sans quotient. Un taux « achats / essais » dépassait
-- 100 % en pratique : on peut acheter un pack sans être passé par l'essai, ou
-- essayer un mois et acheter le suivant — numérateur et dénominateur ne portent
-- pas sur les mêmes personnes. Trois nombres côte à côte se lisent sans piège.
--
-- On date la TRANSITION et non l'état courant : quelqu'un devenu membre en juin
-- ne compte pas dans les achats de juillet. D'où les MIN().
CREATE OR REPLACE FUNCTION stats_parcours(p_from TIMESTAMPTZ, p_to TIMESTAMPTZ)
RETURNS TABLE (inscriptions BIGINT, essais BIGINT, achats BIGINT)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $fn$
BEGIN
  -- SECURITY DEFINER : sans ce contrôle, tout membre connecté lirait les
  -- statistiques commerciales du studio.
  IF NOT has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Réservé aux administrateurs';
  END IF;

  RETURN QUERY
  WITH bascules AS (
    SELECT p.id, p.created_at AS inscrit_le,
      (SELECT MIN(b.created_at) FROM bookings b
         JOIN pack_purchases pp ON pp.id = b.pack_purchase_id
         JOIN pack_types pt ON pt.id = pp.pack_type_id
        WHERE b.user_id = p.id AND pt.is_trial) AS essaye_le,
      (SELECT MIN(pp.purchased_at) FROM pack_purchases pp
         JOIN pack_types pt ON pt.id = pp.pack_type_id
        WHERE pp.user_id = p.id AND NOT pt.is_trial) AS achete_le
    FROM profiles p
    WHERE p.deleted_at IS NULL
  )
  SELECT
    COUNT(*) FILTER (WHERE inscrit_le BETWEEN p_from AND p_to),
    COUNT(*) FILTER (WHERE essaye_le  BETWEEN p_from AND p_to),
    COUNT(*) FILTER (WHERE achete_le  BETWEEN p_from AND p_to)
  FROM bascules;
END;
$fn$;

REVOKE ALL ON FUNCTION stats_parcours(TIMESTAMPTZ, TIMESTAMPTZ) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION stats_parcours(TIMESTAMPTZ, TIMESTAMPTZ) TO authenticated;


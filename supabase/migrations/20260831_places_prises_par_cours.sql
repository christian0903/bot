-- ============================================================================
-- Le nombre de places prises, visible sans exposer QUI est inscrit
-- ----------------------------------------------------------------------------
-- Un coach a signale un cours affiche « 5 places disponibles » qui repondait
-- « Ce cours est complet » au clic. Les deux avaient raison, et c'est l'ecran
-- qui mentait.
--
-- Le front comptait les places en lisant `bookings` directement. Or la policy
-- de lecture est `auth.uid() = user_id` : un membre ne voit QUE SES PROPRES
-- reservations. Sur un cours ou il n'est pas inscrit, la requete revient vide
-- — zero place prise, donc toutes libres a l'affichage. Le serveur, lui,
-- comptait la realite et refusait.
--
-- Le defaut ne se voyait pas pour un admin ni pour un coach, qui lisent tout :
-- d'ou une anomalie invisible en interne et systematique pour les membres.
--
-- `SECURITY DEFINER` est ici le point entier : la fonction compte sous les
-- droits de son proprietaire, mais ne rend qu'un NOMBRE. Aucune identite ne
-- sort — ni nom, ni identifiant de membre.
--
-- Une fonction en LOT plutot qu'un appel par cours : une semaine de planning
-- compte une cinquantaine de seances, et cinquante allers-retours pour
-- cinquante entiers ne se justifient pas.
-- ============================================================================

CREATE OR REPLACE FUNCTION places_prises_par_cours(p_class_ids UUID[])
RETURNS TABLE (scheduled_class_id UUID, places_prises INTEGER)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  -- Le meme critere que `book_class`, au caractere pres : c'est ce qui garantit
  -- que l'ecran annonce ce que la reservation appliquera. Toute divergence ici
  -- reproduirait exactement le defaut qu'on corrige.
  SELECT b.scheduled_class_id, COUNT(*)::INTEGER
  FROM bookings b
  WHERE b.scheduled_class_id = ANY(p_class_ids)
    AND b.status = 'confirmed'
  GROUP BY b.scheduled_class_id;
$$;

COMMENT ON FUNCTION places_prises_par_cours(UUID[]) IS
  'Places prises par cours, sans exposer qui est inscrit. Le front ne peut pas les compter lui-meme : la RLS de `bookings` ne montre a un membre que ses propres reservations.';

REVOKE ALL ON FUNCTION places_prises_par_cours(UUID[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION places_prises_par_cours(UUID[]) TO anon, authenticated;

-- ============================================================================
-- Qui est inscrit a un cours, visible par les membres
-- ----------------------------------------------------------------------------
-- Dans l'ancienne application Technogym, un client voyait qui avait deja
-- reserve. C'etait motivant : « pour ce cours-la il y a Nathalie, j'y vais
-- aussi ». L'application ne le permettait plus.
--
-- Le front ne peut pas lire cette liste lui-meme. La policy de `bookings` est
-- `auth.uid() = user_id` : un membre ne voit QUE SES PROPRES reservations, et
-- la liste reviendrait vide — SANS ERREUR. Le meme piege que les places
-- prises, signale par un coach le 31 aout : invisible pour un admin ou un
-- coach qui lisent tout, systematique pour les membres.
--
-- `SECURITY DEFINER` traverse cette policy. Ce qui borne l'exposition, c'est
-- la liste des colonnes rendues : un prenom et une photo, rien d'autre. Ni
-- telephone, ni e-mail, ni `medical_conditions` — contrairement au dialogue du
-- staff, qui affiche le telephone et n'a donc rien a partager avec celui-ci.
--
-- Trois filtres, chacun pour une raison distincte :
--   `status = 'confirmed'`  une annulation ne laisse personne dans la liste
--   `deleted_at IS NULL`    un compte ferme ne reapparait pas par ce chemin
--   `visible_aux_autres`    le retrait demande par le membre lui-meme
--
-- `authenticated` seulement, jamais `anon` : le planning public montre les
-- creneaux et les places libres a un visiteur non connecte, il ne doit pas lui
-- apprendre qui frequente le studio.
-- ============================================================================

-- Se retirer de la liste des inscrits, sans se retirer des cours.
--
-- Visible par defaut : c'est le comportement attendu, celui de l'ancienne
-- application, et une colonne a FALSE aurait laisse toutes les listes vides —
-- l'effet recherche ne se serait jamais produit. Le retrait reste possible
-- d'un geste depuis la page Profil.
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS visible_aux_autres BOOLEAN NOT NULL DEFAULT TRUE;

COMMENT ON COLUMN profiles.visible_aux_autres IS
  'Apparaitre dans la liste des inscrits vue par les autres membres. Ne change rien aux reservations elles-memes.';

CREATE OR REPLACE FUNCTION participants_par_cours(p_class_id UUID)
RETURNS TABLE (user_id UUID, prenom TEXT, avatar_url TEXT)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  -- `first_name` avec repli sur `display_name` : le prenom seul suffit a
  -- l'effet recherche et expose moins, mais il est facultatif dans `profiles`
  -- — sans ce repli, les comptes qui ne l'ont pas renseigne sortiraient avec
  -- une ligne vide au lieu d'un nom.
  SELECT b.user_id,
         COALESCE(NULLIF(TRIM(p.first_name), ''), p.display_name) AS prenom,
         p.avatar_url
  FROM bookings b
  JOIN profiles p ON p.id = b.user_id
  WHERE b.scheduled_class_id = p_class_id
    AND b.status = 'confirmed'
    AND p.deleted_at IS NULL
    AND p.visible_aux_autres
  ORDER BY b.created_at;
$$;

COMMENT ON FUNCTION participants_par_cours(UUID) IS
  'Prenom et photo des inscrits a un cours, pour les membres connectes. Le front ne peut pas les lire lui-meme : la RLS de `bookings` ne montre a un membre que ses propres reservations.';

REVOKE ALL ON FUNCTION participants_par_cours(UUID) FROM PUBLIC;
-- `REVOKE ... FROM PUBLIC` ne suffit pas : Supabase pose un ALTER DEFAULT
-- PRIVILEGES qui accorde EXECUTE a `anon` des la creation de la fonction.
-- Ce droit-la est nominatif, il survit au REVOKE ci-dessus — la fonction
-- paraissait fermee aux visiteurs et ne l'etait pas. Constate le 2026-09-03
-- sur bot3, ou `anon` pouvait lire les prenoms et les photos des inscrits.
REVOKE EXECUTE ON FUNCTION participants_par_cours(UUID) FROM anon;
GRANT EXECUTE ON FUNCTION participants_par_cours(UUID) TO authenticated;

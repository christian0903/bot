-- ============================================================================
-- profiles : chacun ne lit plus que son propre profil
--
-- Deuxieme temps du correctif du 2026-08-29. Le premier fermait la table aux
-- visiteurs sans compte ; celui-ci la ferme entre membres.
--
-- Un membre connecte pouvait encore interroger `profiles` et en tirer le
-- telephone, l'adresse ou les `medical_conditions` de n'importe quel autre. Il
-- fallait un compte — donc une trace — mais tout membre du studio en a un.
--
-- ---------------------------------------------------------------------------
-- Ce qui remplace la lecture large
--
-- Un membre a besoin de trois choses sur autrui, et trois seulement : le nom
-- du coach de son cours, le nom des participants, la photo qui va avec.
-- `profils_publics` les expose, et rien d'autre — ni e-mail, ni telephone, ni
-- adresse, ni donnee de sante.
--
-- La vue est en SECURITY DEFINER (le defaut) et non `security_invoker` : c'est
-- justement ce qui lui permet de traverser la policy restrictive posee plus
-- bas. Le filtrage tient a la liste des colonnes, pas au RLS — une vue de
-- trois colonnes inoffensives n'a rien a filtrer de plus.
-- ============================================================================

CREATE OR REPLACE VIEW profils_publics AS
SELECT id, display_name, avatar_url
FROM profiles
WHERE deleted_at IS NULL;

REVOKE ALL ON profils_publics FROM anon;
GRANT SELECT ON profils_publics TO authenticated;

-- ---------------------------------------------------------------------------
-- La policy
--
-- `auth.uid() = id` : son propre profil, en entier.
-- `has_role(..., 'coach')` et `'admin'` : le staff lit tout — liste de
-- presence, fiche membre, envoi d'un e-mail. `has_role` accorde deja `admin`
-- au `super_admin`.
--
-- Le staff garde donc l'acces direct a la table ; les membres passent par la
-- vue. Aucun ecran d'administration n'est touche.
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "Profiles: read when signed in" ON profiles;
DROP POLICY IF EXISTS "Profiles: public read" ON profiles;

CREATE POLICY "Profiles: own or staff" ON profiles
  FOR SELECT TO authenticated
  USING (
    auth.uid() = id
    OR has_role(auth.uid(), 'coach')
    OR has_role(auth.uid(), 'admin')
  );

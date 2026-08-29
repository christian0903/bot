-- ============================================================================
-- profiles : fermer la lecture publique de toutes les colonnes
--
-- La policy « Profiles: public read » etait en USING (true) : n'importe qui,
-- SANS COMPTE, lisait la totalite des profils avec la seule cle publishable
-- que porte le code du site.
--
-- Releve sur bot3 le 2026-08-29 : 23 profils complets, dont 23 e-mails, 21
-- telephones, 17 adresses, des dates de naissance, des contacts d'urgence et
-- un `medical_conditions` — donnee de sante au sens de l'article 9 du RGPD.
--
--   curl ".../rest/v1/profiles?select=*" -H "apikey: <cle publishable>"
--
-- C'est la meme faille que celle de `coach_profiles`, corrigee le meme jour,
-- mais sur la table elle-meme et donc sur tous les membres.
--
-- ---------------------------------------------------------------------------
-- Ce que la nouvelle regle autorise
--
--   * chacun lit son propre profil, en entier ;
--   * le staff (coach, admin, super_admin) lit tous les profils : il en a
--     besoin pour tenir une liste de presence, joindre un membre, suivre un
--     dossier ;
--   * un membre connecte lit les profils des AUTRES — c'est indispensable au
--     planning (le nom du coach) et a la liste des participants d'un cours.
--
-- Ce dernier point merite d'etre dit franchement : la restriction porte sur
-- `anon`, pas sur `authenticated`. Un membre connecte peut donc encore
-- interroger la table et en tirer les coordonnees d'un autre membre. Fermer
-- cela demanderait une vue dediee, ou des colonnes filtrees par policy — ce
-- que Postgres ne sait pas faire directement.
--
-- Le gain est reel malgre tout : il fallait un compte, et un compte se
-- trace. Le monde entier n'y accede plus avec une cle publique.
--
-- ---------------------------------------------------------------------------
-- Ce qui n'est PAS affecte
--
--   * les Edge Functions : elles passent par la service_role key ;
--   * les fonctions SQL en SECURITY DEFINER, qui s'executent avec les droits
--     de leur proprietaire ;
--   * `coach_profiles`, qui ne porte plus que le nom, la photo et le role.
-- ============================================================================

DROP POLICY IF EXISTS "Profiles: public read" ON profiles;

-- `TO authenticated` est le coeur du correctif : sans mention de role, une
-- policy s'applique a PUBLIC, donc a `anon`. C'est ce qui rendait la table
-- lisible sans compte.
CREATE POLICY "Profiles: read when signed in" ON profiles
  FOR SELECT TO authenticated USING (true);

-- Aucun ecran public ne lit `profiles` : la page d'accueil n'en a pas besoin,
-- et le planning exige deja un compte (AuthGuard). Verifie avant d'appliquer.

-- ============================================================================
-- coach_profiles : retirer e-mail et telephone, et fermer l'acces anonyme
--
-- La vue exposait `email` et `phone` des coachs et des admins, avec un
-- `GRANT SELECT TO anon`. N'importe qui pouvait donc les lire SANS COMPTE,
-- avec la seule cle publishable — qui figure en clair dans le code du site :
--
--   curl "https://<ref>.supabase.co/rest/v1/coach_profiles?select=email,phone" \
--        -H "apikey: <cle publishable>"
--
-- Verifie sur bot3 le 2026-08-29 : trois coachs, e-mails et telephones lus
-- sans authentification. C'est une fuite de donnees personnelles au sens du
-- RGPD, presente sur toute base nee d'install.sql.
--
-- Trouve par l'advisor Supabase (`security_definer_view`, niveau ERROR), qui
-- signalait le SECURITY DEFINER de la vue. Le defaut reel n'etait pas la : une
-- vue sans `security_invoker` s'execute avec les droits de son proprietaire et
-- contourne donc le RLS de `profiles`, mais c'est le GRANT a `anon` combine
-- aux deux colonnes qui rendait la chose exploitable.
--
-- Les deux seuls ecrans qui lisent cette vue sont AdminReviewsPage et
-- AdminSchedulePage. Ils affichent `display_name` et `avatar_url` ; le type
-- `CoachRef` (src/types/index.ts) ne declare meme pas `email` ni `phone`.
-- Les retirer ne change donc rien a l'application.
-- ============================================================================

DROP VIEW IF EXISTS coach_profiles;

-- `security_invoker = true` : la vue s'execute desormais avec les droits de
-- celui qui l'interroge, donc sous le RLS de `profiles`. Sans cette option,
-- une vue contourne le RLS des tables qu'elle lit — c'est ce que l'advisor
-- signalait.
CREATE VIEW coach_profiles
WITH (security_invoker = true) AS
SELECT DISTINCT ON (p.id) p.id, p.display_name, p.avatar_url, ur.role
FROM profiles p
JOIN user_roles ur ON ur.user_id = p.id
WHERE ur.role IN ('coach', 'admin', 'super_admin')
ORDER BY p.id, CASE ur.role WHEN 'super_admin' THEN 1 WHEN 'admin' THEN 2 ELSE 3 END;

-- `anon` n'a plus rien a faire ici : les deux ecrans qui lisent cette vue sont
-- des pages d'administration. Un visiteur non connecte n'en a aucun usage.
REVOKE ALL ON coach_profiles FROM anon;
GRANT SELECT ON coach_profiles TO authenticated;

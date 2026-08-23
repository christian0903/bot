-- ============================================================================
-- Retirer à `anon` le droit d'appeler les fonctions sensibles
-- ----------------------------------------------------------------------------
-- CE QUI NE MARCHAIT PAS
--
-- Les migrations de `book_class` et de la purge du journal finissaient par :
--
--     REVOKE ALL ON FUNCTION … FROM PUBLIC;
--     GRANT EXECUTE ON FUNCTION … TO authenticated;
--
-- Sans effet. Vérifié en base le 2026-08-23 : `anon` gardait son droit
-- d'exécution, comme sur toutes les autres fonctions du projet.
--
-- La raison : Supabase pose des `ALTER DEFAULT PRIVILEGES` qui accordent
-- EXECUTE **nommément** à `anon`, `authenticated` et `service_role` sur toute
-- fonction créée dans `public`. Le droit d'`anon` ne vient donc pas de PUBLIC
-- — il lui est attribué en propre, et révoquer PUBLIC ne l'atteint pas. Les
-- ACL le montrent sans ambiguïté : `anon=X/postgres`, et non un droit hérité.
--
-- CE QUE ÇA CHANGEAIT — RIEN, ET C'EST LE POINT IMPORTANT
--
-- Aucune de ces fonctions n'était exposée pour autant : chacune vérifie
-- l'identité et le rôle dès ses premières lignes. Éprouvé le même jour depuis
-- le SQL Editor, sans identité :
--
--     purge_activity_log(12)        → {"ok":false,"reason":"not_authenticated"}
--     count_activity_log_before(12) → null
--
-- La sécurité n'a jamais reposé sur ces permissions, et ne repose toujours pas
-- sur elles. Ce REVOKE est une SECONDE barrière : il évite qu'un appel
-- anonyme atteigne seulement le corps de la fonction. La première barrière,
-- celle qui compte, reste le contrôle de rôle à l'intérieur.
--
-- POURQUOI CES TROIS-LÀ, ET PAS TOUTES
--
-- Seules les fonctions qui ÉCRIVENT ou qui divulguent sont visées. Les
-- fonctions de lecture appelées par les pages publiques (le planning avant
-- connexion, par exemple) doivent rester ouvertes à `anon` — les révoquer en
-- bloc casserait l'application.
-- ============================================================================

-- Réservation d'un membre : suppose un `auth.uid()`, donc jamais anonyme.
REVOKE EXECUTE ON FUNCTION book_class(UUID, UUID) FROM anon;

-- Purge du journal : réservée au super admin, jamais à un visiteur.
REVOKE EXECUTE ON FUNCTION purge_activity_log(INTEGER) FROM anon;
REVOKE EXECUTE ON FUNCTION count_activity_log_before(INTEGER) FROM anon;

-- Inscription d'un membre par le staff : même raison.
REVOKE EXECUTE ON FUNCTION book_member_by_staff(UUID, UUID, UUID) FROM anon;

-- ---------------------------------------------------------------------------
-- Vérification — « Appelable anonyme » doit être false partout
-- ---------------------------------------------------------------------------
SELECT
  p.proname                                                 AS "Fonction",
  has_function_privilege('authenticated', p.oid, 'EXECUTE') AS "Connecte (doit rester true)",
  has_function_privilege('anon', p.oid, 'EXECUTE')          AS "Anonyme (doit etre false)"
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN ('book_class', 'book_member_by_staff',
                    'purge_activity_log', 'count_activity_log_before')
ORDER BY p.proname;

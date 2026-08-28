-- ============================================================================
-- Rendre les tables accessibles à l'application (GRANT)
--
-- Une policy RLS ne s'applique QU'APRÈS le droit SQL. Sans `GRANT`, une table
-- protégée par RLS n'est pas verrouillée avec soin : elle est inaccessible, et
-- PostgREST répond `permission denied for table ...` sur toutes les lignes.
--
-- `install.sql` n'a jamais posé ces droits. Sur les projets Supabase créés avec
-- « Automatically expose new tables » activé — le cas de `bot` en avril — ils
-- sont posés automatiquement (`pg_default_acl`), et leur absence du fichier ne
-- se voyait pas.
--
-- Le 2026-08-28, l'installation sur une base neuve créée SANS cette option, comme
-- le recommandait `docs/strategie-base-neuve.md`, a produit une base dont les 27
-- tables refusaient toute lecture. Symptôme trompeur : l'application se chargeait
-- et la connexion réussissait, mais les écrans restaient vides et un `super_admin`
-- n'avait accès à rien — le front lisait `user_roles`, recevait un refus, et le
-- traitait comme « ce compte n'a aucun rôle ».
--
-- Cette migration ne concerne QUE les bases installées depuis `install.sql`
-- avant cette date. Sur une base issue du dashboard avec l'option activée, elle
-- est sans effet — les droits y sont déjà.
-- ============================================================================

GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO anon, authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;

-- Sans quoi le défaut réapparaîtrait table par table, au prochain ajout.
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO anon, authenticated;

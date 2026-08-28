-- Les images ne portent plus l'URL complète, seulement leur chemin.
--
-- La base stockait l'adresse entière :
--
--   https://<ref>.supabase.co/storage/v1/object/public/avatars/coaches/x.jpg
--
-- avec la référence du projet en dur. Copier les données vers une autre base
-- laissait donc les images pointer vers l'ancienne — et le défaut restait
-- invisible tant que l'ancien projet vivait, pour que toutes les images
-- disparaissent le jour de sa suppression.
--
-- Désormais la base garde `coaches/x.jpg`, et le front reconstruit l'adresse à
-- l'affichage (`src/lib/url-image.ts`). Une base devient indépendante du projet
-- qui l'héberge : plus aucune réécriture d'URL à faire lors d'une migration.
--
-- Le helper accepte les deux formes, donc rien ne casse si cette migration
-- n'est pas jouée tout de suite. Mais tant qu'elle ne l'est pas, la base
-- continue de porter la dépendance.
--
-- Concerne 7 lignes sur `bot` au 2026-08-28 : 4 photos de types de cours,
-- 3 portraits de coachs.

UPDATE class_types
   SET image_url = split_part(image_url, '/object/public/avatars/', 2)
 WHERE image_url LIKE '%/object/public/avatars/%';

UPDATE profiles
   SET avatar_url = split_part(avatar_url, '/object/public/avatars/', 2)
 WHERE avatar_url LIKE '%/object/public/avatars/%';

-- ============================================================================
-- Promouvoir un compte en super_admin
--
--   À exécuter À LA MAIN dans l'éditeur SQL du dashboard Supabase, ou par psql.
--   Remplacer l'adresse ci-dessous, rien d'autre.
--
-- POURQUOI CE FICHIER EXISTE
--
-- Depuis le 2026-08-06, `user_roles` n'a plus AUCUNE policy d'écriture : toute
-- attribution de rôle passe par `grant_user_role()`, qui exige d'être déjà
-- admin et contrôle la hiérarchie. C'était la faille où un admin pouvait se
-- créer un pair sans contrôle.
--
-- La règle ne peut donc pas s'appliquer au PREMIER compte : il n'y a encore
-- personne pour l'autoriser. Sur une base neuve, ce fichier est le seul chemin.
-- Il s'exécute avec les droits `postgres`, hors RLS — d'où l'exécution manuelle
-- par quelqu'un qui a déjà les accès au dashboard.
--
-- QUAND S'EN SERVIR
--
--   - après `install.sql` sur une base neuve, une fois le premier compte inscrit
--   - pour rendre la main sur une base de test dont on a perdu l'admin
--
-- Il est rejouable sans dommage : `ON CONFLICT DO NOTHING` sur la contrainte
-- UNIQUE(user_id, role). Le relancer sur un compte déjà super_admin ne fait rien.
-- ============================================================================

-- Tout tient dans un bloc : l'adresse ne se saisit qu'UNE fois, et le contrôle
-- comme l'insertion la reprennent de là. Volontairement sans `\set`, qui est
-- une commande psql et ne fonctionne PAS dans l'éditeur SQL du dashboard.
DO $$
DECLARE
  -- ⚠️ LA SEULE LIGNE À MODIFIER
  adresse TEXT := 'votre@email.com';

  cible UUID;
BEGIN
  -- Un compte inexistant ou mal orthographié ne doit pas passer pour un succès :
  -- sans ce contrôle, l'INSERT touche zéro ligne et ne renvoie AUCUNE erreur.
  -- C'est le piège qui a déjà produit deux bugs dans ce projet.
  SELECT id INTO cible FROM auth.users WHERE email = adresse;

  IF cible IS NULL THEN
    RAISE EXCEPTION
      'Aucun compte pour « % ». Inscrivez-vous d''abord par l''application, puis relancez.',
      adresse;
  END IF;

  -- Le rôle `client` accompagne `super_admin` : l'application le suppose présent
  -- pour tout ce qui relève de la réservation. Un compte qui n'aurait que
  -- `super_admin` ne pourrait pas réserver de cours.
  INSERT INTO user_roles (user_id, role)
  VALUES (cible, 'super_admin'), (cible, 'client')
  ON CONFLICT (user_id, role) DO NOTHING;

  RAISE NOTICE 'Compte « % » promu super_admin.', adresse;
END $$;

-- Contrôle : le compte doit ressortir avec `super_admin` parmi ses rôles.
-- (Adapter l'adresse ici aussi, ou lister tous les administrateurs.)
SELECT u.email,
       u.email_confirmed_at IS NOT NULL AS email_confirme,
       string_agg(r.role::text, ', ' ORDER BY r.role) AS roles
FROM auth.users u
JOIN user_roles r ON r.user_id = u.id
WHERE r.role IN ('super_admin', 'admin')
GROUP BY u.id, u.email, u.email_confirmed_at
ORDER BY u.email;

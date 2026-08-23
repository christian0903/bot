-- ============================================================================
-- Le verrou tient-il ? — test à DEUX onglets du SQL Editor
-- ----------------------------------------------------------------------------
-- C'est LA raison d'être de `book_class`. Sans verrou, deux membres qui
-- cliquent sur la dernière place à la même seconde lisent tous les deux
-- « une place libre » et réservent tous les deux.
--
-- Ce test ne peut pas s'écrire en un seul script : une transaction ne peut
-- pas entrer en concurrence avec elle-même. Il faut deux onglets ouverts en
-- même temps.
--
-- ⚠️ CONTRAIREMENT au test principal, ce script ÉCRIT VRAIMENT en base — le
-- décor doit survivre d'un onglet à l'autre, donc pas de ROLLBACK. La
-- PARTIE 3 nettoie tout. À faire sur la base de TEST, et à ne pas laisser
-- à moitié fait.
--
-- Exécuter en « run without RLS », comme le test principal.
-- ============================================================================


-- ############################################################################
-- PARTIE 1 — ONGLET A : poser le décor
-- ############################################################################
-- Exécuter cette partie seule, dans un premier onglet. Elle affiche deux
-- identifiants à recopier dans les parties suivantes.

DO $$
DECLARE
  v_user      UUID;
  v_other     UUID;
  v_credit_ty UUID;
  v_class_ty  UUID;
  v_class     UUID;
  v_pack_ty   UUID;
BEGIN
  SELECT id INTO v_user  FROM profiles ORDER BY created_at LIMIT 1;
  SELECT id INTO v_other FROM profiles WHERE id <> v_user LIMIT 1;

  IF v_other IS NULL THEN
    RAISE EXCEPTION 'Il faut DEUX profils en base pour ce test';
  END IF;

  SELECT id INTO v_credit_ty FROM credit_types LIMIT 1;

  INSERT INTO class_types (name, credit_type_id, default_max_participants)
  VALUES ('ZZTEST concurrence', v_credit_ty, 1)
  RETURNING id INTO v_class_ty;

  -- UNE place, deux candidats : tout le test est là.
  INSERT INTO scheduled_classes (class_type_id, starts_at, max_participants)
  VALUES (v_class_ty, NOW() + INTERVAL '10 days', 1)
  RETURNING id INTO v_class;

  INSERT INTO pack_types (name, credit_type_id, credit_count, price_cents, validity_days)
  VALUES ('ZZTEST pack concurrence', v_credit_ty, 5, 1000, 90)
  RETURNING id INTO v_pack_ty;

  -- Un pack pour chacun.
  INSERT INTO pack_purchases (user_id, pack_type_id, credits_remaining, price_paid_cents, expires_at)
  VALUES (v_user,  v_pack_ty, 5, 1000, NOW() + INTERVAL '90 days'),
         (v_other, v_pack_ty, 5, 1000, NOW() + INTERVAL '90 days');

  RAISE INFO 'cours=% membreA=% membreB=%', v_class, v_user, v_other;
END $$;

-- Les identifiants à recopier ci-dessous :
SELECT
  sc.id                                            AS "COURS (à recopier)",
  (SELECT id FROM profiles ORDER BY created_at LIMIT 1)                        AS "MEMBRE A",
  (SELECT id FROM profiles
    WHERE id <> (SELECT id FROM profiles ORDER BY created_at LIMIT 1) LIMIT 1) AS "MEMBRE B",
  sc.max_participants                              AS "Places"
FROM scheduled_classes sc
JOIN class_types ct ON ct.id = sc.class_type_id
WHERE ct.name = 'ZZTEST concurrence';


-- ############################################################################
-- PARTIE 2 — LE TEST LUI-MÊME
-- ############################################################################
-- Remplacer <COURS>, <MEMBRE_A> et <MEMBRE_B> par les valeurs ci-dessus.
--
-- ORDRE DES OPÉRATIONS — c'est tout l'intérêt, ne pas l'intervertir :
--
--   1. Onglet A : exécuter le bloc A. Il réserve MAIS NE VALIDE PAS.
--   2. Onglet B : exécuter le bloc B. Il doit RESTER EN ATTENTE (le curseur
--      tourne) — c'est le verrou qui fait son travail.
--   3. Onglet A : exécuter `COMMIT;`
--   4. Onglet B : se débloque aussitôt et doit répondre
--      {"ok": false, "reason": "class_full"}
--
-- SI B répond immédiatement `ok: true` sans attendre : le verrou ne
-- fonctionne pas, et le cours part à deux inscrits pour une place.

-- ---- ONGLET A --------------------------------------------------------------
/*
BEGIN;
SELECT set_config('request.jwt.claims',
                  json_build_object('sub', '<MEMBRE_A>', 'role', 'authenticated')::TEXT,
                  true);
SELECT book_class('<COURS>'::UUID) AS "Onglet A";
-- NE PAS VALIDER TOUT DE SUITE. Aller dans l'onglet B.
*/

-- ---- ONGLET B (pendant que A est ouvert) -----------------------------------
/*
BEGIN;
SELECT set_config('request.jwt.claims',
                  json_build_object('sub', '<MEMBRE_B>', 'role', 'authenticated')::TEXT,
                  true);
SELECT book_class('<COURS>'::UUID) AS "Onglet B";
-- Doit RESTER EN ATTENTE tant que A n'a pas validé.
*/

-- ---- ONGLET A : libérer ----------------------------------------------------
/*
COMMIT;
*/

-- ---- ONGLET B : lire la réponse, puis annuler ------------------------------
/*
-- Attendu : {"ok": false, "reason": "class_full"}
ROLLBACK;
*/


-- ############################################################################
-- PARTIE 3 — NETTOYAGE (à exécuter dans tous les cas, même si le test rate)
-- ############################################################################
-- L'ordre suit les clés étrangères : réservations, puis packs, puis cours,
-- puis les types.

BEGIN;

-- Les réservations du cours de test...
DELETE FROM bookings
 WHERE scheduled_class_id IN (
   SELECT sc.id FROM scheduled_classes sc
   JOIN class_types ct ON ct.id = sc.class_type_id
   WHERE ct.name = 'ZZTEST concurrence');

-- ...et toute réservation payée par un pack de test, où qu'elle soit.
-- `bookings.pack_purchase_id` n'est pas en cascade : une réservation oubliée
-- empêcherait la suppression du pack, et le nettoyage échouerait à mi-course.
DELETE FROM bookings
 WHERE pack_purchase_id IN (
   SELECT pp.id FROM pack_purchases pp
   JOIN pack_types pt ON pt.id = pp.pack_type_id
   WHERE pt.name = 'ZZTEST pack concurrence');

DELETE FROM pack_purchases
 WHERE pack_type_id IN (SELECT id FROM pack_types WHERE name = 'ZZTEST pack concurrence');

DELETE FROM scheduled_classes
 WHERE class_type_id IN (SELECT id FROM class_types WHERE name = 'ZZTEST concurrence');

DELETE FROM pack_types   WHERE name = 'ZZTEST pack concurrence';
DELETE FROM class_types  WHERE name = 'ZZTEST concurrence';

COMMIT;

-- Contrôle : les trois compteurs doivent être à zéro.
SELECT
  (SELECT COUNT(*) FROM class_types  WHERE name = 'ZZTEST concurrence')       AS "types de cours restants",
  (SELECT COUNT(*) FROM pack_types   WHERE name = 'ZZTEST pack concurrence')  AS "types de packs restants",
  (SELECT COUNT(*) FROM scheduled_classes sc
     JOIN class_types ct ON ct.id = sc.class_type_id
    WHERE ct.name = 'ZZTEST concurrence')                                     AS "cours restants";

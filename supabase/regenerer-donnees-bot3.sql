-- ============================================================================
-- REGENERER LES DONNEES DE TEST DE bot3, A L'IMAGE DE LA PRODUCTION
-- ----------------------------------------------------------------------------
-- A coller dans l'editeur SQL de Supabase, PROJET bot3 (cvyslqnojcgnjfgynczw).
--
-- ⚠️ VERIFIER LE PROJET AVANT DE LANCER. Ce script efface le planning et les
-- reservations. Lance sur bot-ops, il detruirait les donnees du studio. Le
-- premier bloc refuse d'ailleurs de s'executer ailleurs que sur bot3.
--
-- POURQUOI
--
-- Les donnees de test avaient derive : 551 cours pour 132 reservations, un
-- planning presque vide ou chaque ecran ment sur ce que voit un membre. La
-- production, elle, tourne a 0,87 inscrit par cours sur 225 cours. Ce script
-- reproduit CETTE FORME — pas ces donnees.
--
-- CE QUI N'EST PAS COPIE DEPUIS LA PRODUCTION
--
-- Aucune donnee personnelle. Ni nom, ni adresse e-mail, ni telephone, ni date
-- de naissance, ni adresse, ni donnee medicale, ni contact d'urgence des 102
-- membres du studio. Rien de tout cela ne traverse : bot3 vit sur une autre
-- organisation Supabase, avec ses propres acces, et y deposer des donnees
-- reelles creerait un second fichier a proteger pour aucun benefice.
--
-- Ce qui est repris, ce sont des STRUCTURES et des FORMES :
--   - le catalogue des types de credits et de cours, a l'identique (§2) ;
--   - la grille horaire hebdomadaire du studio (§3) ;
--   - le taux de remplissage, la part de seances pointees, d'annulations et
--     d'absences (§5).
--
-- LES COMPTES NE SONT PAS TOUCHES
--
-- Les 30 comptes de test gardent leurs identifiants, leurs mots de passe et
-- leurs roles. `profiles`, `auth.users` et `user_roles` ne sont pas modifies :
-- vous continuez a vous connecter comme avant. Seule l'ACTIVITE est refaite.
--
-- CONÇU POUR ETRE REJOUE
--
-- C'est son usage normal : le relancer des que les donnees de test ont derive,
-- ou simplement pour recaler le planning sur la date du jour.
--
--   1. Editeur SQL de Supabase, projet bot3 — VERIFIER LE PROJET EN HAUT.
--   2. Coller ce fichier en entier, choisir « RUN WITHOUT RLS ».
--      Avec RLS, les policies ne laisseraient passer qu'une partie des lignes
--      et le script ne ferait qu'une part du travail, sans rien signaler.
--   3. Decommenter le bloc de controle en fin de fichier et l'executer :
--      il compare bot3 a la production, mesure par mesure.
--
-- Le planning est ancre sur `now()` : chaque passage le recale, avec une
-- semaine derriere et quatre devant. Rien a modifier dans le fichier au fil du
-- temps — sauf si la grille horaire du studio change (§3) ou si un type de
-- cours est ajoute en production (§2), auquel cas relever les nouvelles
-- valeurs sur bot-ops et les reporter ici.
--
-- CE QUE CHAQUE PASSAGE PRESERVE
--
-- Les comptes, leurs mots de passe, leurs roles, les types de packs et les
-- reglages du studio. Le script ne touche qu'au planning, aux reservations,
-- aux achats de packs et au catalogue des cours.
-- ============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 0. Garde-fou : ne rien faire si ce n'est pas bot3
-- ---------------------------------------------------------------------------
-- Ce script est destine a etre rejoue regulierement : le garde-fou doit donc
-- resister au temps, et ne pas dependre d'un compte de test qu'on pourrait
-- supprimer un jour sans y penser.
--
-- Le critere retenu est le NOMBRE DE PROFILS. bot3 en porte une trentaine,
-- bot-ops plus d'une centaine, et l'ecart ne se refermera pas : la production
-- ne fait que grandir, tandis que les comptes de test restent ceux que
-- Christian utilise pour se connecter. Le seuil de 60 laisse de la marge des
-- deux cotes.
--
-- Deux indices de confirmation s'y ajoutent, sans etre bloquants a eux seuls :
-- l'un ou l'autre suffit. Les comptes `@demo.bot` n'existent que sur bot3 ; le
-- volume de reservations de la production se compte en centaines.
DO $$
DECLARE
  v_profils INTEGER;
  v_demo    INTEGER;
BEGIN
  SELECT count(*) INTO v_profils FROM profiles;
  SELECT count(*) INTO v_demo FROM profiles WHERE email LIKE '%@demo.bot';

  IF v_profils > 60 THEN
    RAISE EXCEPTION
      'ARRET : % profils. bot3 en porte une trentaine, la PRODUCTION plus de cent. Verifiez le projet avant de relancer.',
      v_profils;
  END IF;

  -- Une base vide n'est pas bot3 non plus : sans comptes, le script poserait
  -- un planning que personne ne peuplerait.
  IF v_profils = 0 THEN
    RAISE EXCEPTION
      'ARRET : aucun profil dans cette base. Rien a regenerer.';
  END IF;

  RAISE NOTICE 'Base reconnue : % profils, dont % comptes @demo.bot.', v_profils, v_demo;
END $$;

-- ---------------------------------------------------------------------------
-- 1. Faire table rase de l'activite, AVANT de toucher au catalogue
-- ---------------------------------------------------------------------------
-- Cet effacement vient en premier, et ce n'est pas un detail d'ordonnancement :
-- deux verrous l'exigent.
--
-- 1. Le trigger `class_types_protect_credit` REFUSE de changer le type de
--    credit d'un type de cours des qu'un cours planifie en depend — « Type de
--    credit verrouille : 120 cours planifie(s) et 26 reservation(s) ». Il
--    laisse passer quand le compte tombe a zero, ce que cet effacement obtient.
--    Rencontre le 2026-09-05.
-- 2. `class_types.name` n'est pas unique. Les types de bot3 portent les memes
--    NOMS que ceux de la production sous d'AUTRES identifiants (« BackOnTrack »
--    est ici 89788ddb…, la-bas 09813000…) : sans ce menage prealable, l'ecran
--    afficherait deux « BackOnTrack ».
--
-- L'ordre suit les cles etrangeres. Relevees sur bot3 le 2026-09-05, elles
-- forment cette chaine — chaque table part avant celle dont elle depend :
--
--   invoice_requests ──> pack_purchases <── bookings
--   class_reviews ──> bookings ──> scheduled_classes ──> class_types
--   waitlist ──> scheduled_classes                        └─> credit_types
--
-- `invoice_requests` est le maillon facile a oublier : il retient
-- `pack_purchases` en NO ACTION, et sa demande de facture survit a l'achat
-- qu'elle facture. Sans cette premiere ligne, le script echoue sur
-- « violates foreign key constraint invoice_requests_pack_purchase_id_fkey ».
-- Rencontre le 2026-09-05.
--
-- `class_reviews` et `waitlist` sont en CASCADE et partiraient d'elles-memes ;
-- elles sont nommees quand meme, pour que la lecture du script dise l'etat
-- obtenu sans avoir a connaitre le detail des contraintes.
DELETE FROM invoice_requests;
DELETE FROM class_reviews;
DELETE FROM waitlist;
DELETE FROM bookings;
DELETE FROM pack_purchases;
DELETE FROM scheduled_classes;
DELETE FROM class_types;

-- ---------------------------------------------------------------------------
-- 2. Le catalogue, aligne sur la production
-- ---------------------------------------------------------------------------
-- Types de credits d'abord : les types de cours s'y rattachent. Les
-- identifiants sont ceux de bot-ops, pour que les deux bases restent
-- comparables ligne a ligne — c'est ce qui a permis de reperer l'ecart du
-- rappel des presences le 2026-09-05.
--
-- ⚠️ Un simple `INSERT ... ON CONFLICT (id)` NE SUFFIT PAS : `name` porte sa
-- propre contrainte d'unicite (`credit_types_name_key`), et bot3 connait deja
-- `semi_prive` et `personal_training` sous d'AUTRES identifiants (b6f8eabb… et
-- 9b9511ef…). L'insertion echoue alors sur le NOM, pas sur l'identifiant —
-- rencontre le 2026-09-05.
--
-- On garde donc les lignes existantes et on ne change que leur identifiant,
-- pour retomber sur celui de la production. `UPDATE credit_types SET id = …`
-- est exclu : les deux cles etrangeres qui pointent ici sont NO ACTION et non
-- differables, elles casseraient au moment meme de l'ecriture. La manoeuvre
-- passe donc par une ligne intermediaire, en quatre temps.
--
-- `class_types` a ete vide au §1 : seul `pack_types` reste a repointer.
DO $$
DECLARE
  v_paires TEXT[][] := ARRAY[
    ARRAY['semi_prive',        '258f3433-e8bf-4b53-8961-38dc23958a12', 'Semi-privé',        'Semi-private'],
    ARRAY['personal_training', '9dbc251d-ffc3-4309-a225-3d7e9e593851', 'Personal Training', 'Personal Training']
  ];
  v_nom TEXT; v_cible UUID; v_fr TEXT; v_en TEXT; v_actuel UUID;
BEGIN
  FOR i IN 1 .. array_length(v_paires, 1) LOOP
    v_nom   := v_paires[i][1];
    v_cible := v_paires[i][2]::uuid;
    v_fr    := v_paires[i][3];
    v_en    := v_paires[i][4];

    SELECT id INTO v_actuel FROM credit_types WHERE name = v_nom;

    IF v_actuel IS NULL THEN
      -- Absent de bot3 : rien a renumeroter.
      INSERT INTO credit_types (id, name, label_fr, label_en)
      VALUES (v_cible, v_nom, v_fr, v_en)
      ON CONFLICT (id) DO UPDATE
        SET name = EXCLUDED.name, label_fr = EXCLUDED.label_fr, label_en = EXCLUDED.label_en;

    ELSIF v_actuel <> v_cible THEN
      -- Present sous un autre identifiant. Le nom etant unique, la nouvelle
      -- ligne ne peut pas le porter tant que l'ancienne existe : on ecarte
      -- donc le nom de l'ancienne le temps de la manoeuvre.
      UPDATE credit_types SET name = v_nom || '_ancien' WHERE id = v_actuel;
      INSERT INTO credit_types (id, name, label_fr, label_en)
      VALUES (v_cible, v_nom, v_fr, v_en);
      UPDATE pack_types SET credit_type_id = v_cible WHERE credit_type_id = v_actuel;
      DELETE FROM credit_types WHERE id = v_actuel;

    ELSE
      -- Deja au bon identifiant : on rafraichit les libelles.
      UPDATE credit_types SET label_fr = v_fr, label_en = v_en WHERE id = v_cible;
    END IF;
  END LOOP;
END $$;

-- Les types de cours de la production, avec leurs identifiants, leurs durees,
-- leurs jauges et leurs descriptions. `image_url` n'est pas repris : les
-- fichiers vivent dans le bucket de bot-ops et ne suivront pas, les vignettes
-- resteront donc vides sur bot3 — sans consequence sur ce qu'on y eprouve.
--
-- La table a ete videe au §1 : ces lignes sont donc des creations, et le
-- `ON CONFLICT` ne sert qu'a rendre le script rejouable.
INSERT INTO class_types (id, name, description, color, default_duration_minutes,
                         default_max_participants, is_active, credit_type_id)
VALUES
  ('09813000-8bb9-4278-8eda-d4f6a6f166cb', 'BackOnTrack',
   'Renforcement global, à ton rythme', '#3B82F6', 50, 5, true,
   '258f3433-e8bf-4b53-8961-38dc23958a12'),
  ('d0376870-1e7c-47eb-aff1-6e185c6df04a', 'CrossTraining',
   'Force, cardio et mouvements fonctionnels', '#3B82F6', 50, 5, true,
   '258f3433-e8bf-4b53-8961-38dc23958a12'),
  ('1f27b0dc-1b40-4392-adc5-841a49531c69', 'Ladies ',
   'Renforcement global & cardio, entre femmes', '#3B82F6', 50, 5, true,
   '258f3433-e8bf-4b53-8961-38dc23958a12'),
  ('cd7d9b39-1af4-41dc-be4b-1ef54635f5ca', 'Boxing',
   'Technique, cardio et renforcement', '#3B82F6', 50, 5, true,
   '258f3433-e8bf-4b53-8961-38dc23958a12'),
  ('d4c4ee5a-20ae-4e90-8547-bd54a2119f08', 'Mobility & Stretch ',
   'Mobilité, gainage & prévention des douleurs', '#3B82F6', 50, 5, true,
   '258f3433-e8bf-4b53-8961-38dc23958a12'),
  ('20101bf3-8327-4442-bb63-43b512e1f575', 'Adolescents ',
   'Cours dédié aux adolescents à partir de 12 ans jusque 17 ans, l''idée est d''apprendre à connaitre son corps et comment le rendre plus fort que ca soit à travers du renforcement, de la mobilité ou de l''agilité. Petits groupes de maximum 4 séparé en 2 catégories : 12/14 ans et 15/17 ans',
   '#3B82F6', 50, 4, true, '258f3433-e8bf-4b53-8961-38dc23958a12'),
  ('15078a3e-bda4-40ec-a4ae-a1b7399bb973', 'Personal Training ',
   'Une heure rien que pour vous. Un coach, un objectif, un programme. Que vous repreniez de zéro, que vous prépariez une échéance ou que vous ayez besoin d''un cadre qui s''adapte vraiment à votre vous.',
   '#3B82F6', 60, 1, true, '9dbc251d-ffc3-4309-a225-3d7e9e593851')
ON CONFLICT (id) DO UPDATE
  SET name = EXCLUDED.name,
      description = EXCLUDED.description,
      color = EXCLUDED.color,
      default_duration_minutes = EXCLUDED.default_duration_minutes,
      default_max_participants = EXCLUDED.default_max_participants,
      is_active = EXCLUDED.is_active,
      credit_type_id = EXCLUDED.credit_type_id;

-- ---------------------------------------------------------------------------
-- 2 bis. Les types de credits que la production ne connait pas
-- ---------------------------------------------------------------------------
-- Reste a solder les types de credits surnumeraires — bot3 porte un « Friends
-- and family » absent de bot-ops. Les packs qui en dependent basculent vers le
-- semi-prive, faute de quoi la suppression buterait sur la cle etrangere.
UPDATE pack_types SET credit_type_id = '258f3433-e8bf-4b53-8961-38dc23958a12'
 WHERE credit_type_id NOT IN ('258f3433-e8bf-4b53-8961-38dc23958a12',
                              '9dbc251d-ffc3-4309-a225-3d7e9e593851');
DELETE FROM credit_types
 WHERE id NOT IN ('258f3433-e8bf-4b53-8961-38dc23958a12',
                  '9dbc251d-ffc3-4309-a225-3d7e9e593851');

-- ---------------------------------------------------------------------------
-- 3. Le planning, sur la grille hebdomadaire du studio
-- ---------------------------------------------------------------------------
-- La grille est celle relevee sur bot-ops le 2026-09-05 : les creneaux qui
-- reviennent chaque semaine, avec leur type, leur duree, leur jauge et leur
-- etage. Elle est deroulee sur une semaine en arriere et quatre en avant,
-- ce qui donne un volume proche des 225 cours de la production.
--
-- Le coach est tire parmi ceux de bot3 : ses cours doivent lui appartenir pour
-- que le bandeau des presences et « mes cours » aient un sens.
WITH creneaux(jour, heure, type_id, duree, places, etage) AS (VALUES
  -- Lundi
  (1, '09:00', 'd4c4ee5a-20ae-4e90-8547-bd54a2119f08', 50, 5, 'bas'),
  (1, '10:00', 'd0376870-1e7c-47eb-aff1-6e185c6df04a', 50, 5, 'bas'),
  (1, '11:00', '15078a3e-bda4-40ec-a4ae-a1b7399bb973', 60, 1, 'bas'),
  (1, '12:20', 'd0376870-1e7c-47eb-aff1-6e185c6df04a', 50, 5, 'bas'),
  (1, '17:00', 'd0376870-1e7c-47eb-aff1-6e185c6df04a', 50, 5, 'bas'),
  (1, '18:00', 'cd7d9b39-1af4-41dc-be4b-1ef54635f5ca', 50, 5, 'bas'),
  (1, '19:00', '1f27b0dc-1b40-4392-adc5-841a49531c69', 50, 5, 'bas'),
  (1, '20:00', '09813000-8bb9-4278-8eda-d4f6a6f166cb', 50, 5, 'bas'),
  -- Mardi
  (2, '08:00', 'd0376870-1e7c-47eb-aff1-6e185c6df04a', 50, 5, 'bas'),
  (2, '09:00', '1f27b0dc-1b40-4392-adc5-841a49531c69', 50, 5, 'bas'),
  (2, '10:00', '09813000-8bb9-4278-8eda-d4f6a6f166cb', 50, 5, 'bas'),
  (2, '11:00', '15078a3e-bda4-40ec-a4ae-a1b7399bb973', 60, 1, 'bas'),
  (2, '12:15', 'd0376870-1e7c-47eb-aff1-6e185c6df04a', 50, 5, 'bas'),
  (2, '12:30', '09813000-8bb9-4278-8eda-d4f6a6f166cb', 50, 5, 'bas'),
  (2, '17:00', '09813000-8bb9-4278-8eda-d4f6a6f166cb', 50, 5, 'bas'),
  (2, '18:00', '1f27b0dc-1b40-4392-adc5-841a49531c69', 50, 5, 'bas'),
  (2, '19:00', 'd0376870-1e7c-47eb-aff1-6e185c6df04a', 50, 5, 'bas'),
  (2, '20:00', '09813000-8bb9-4278-8eda-d4f6a6f166cb', 50, 5, 'bas'),
  -- Mercredi
  (3, '08:30', 'd0376870-1e7c-47eb-aff1-6e185c6df04a', 50, 5, 'bas'),
  (3, '09:30', '1f27b0dc-1b40-4392-adc5-841a49531c69', 50, 5, 'bas'),
  (3, '10:30', 'd0376870-1e7c-47eb-aff1-6e185c6df04a', 50, 5, 'bas'),
  (3, '17:00', '09813000-8bb9-4278-8eda-d4f6a6f166cb', 50, 5, 'bas'),
  (3, '18:00', 'd0376870-1e7c-47eb-aff1-6e185c6df04a', 50, 5, 'bas'),
  (3, '19:00', 'cd7d9b39-1af4-41dc-be4b-1ef54635f5ca', 50, 5, 'bas'),
  (3, '20:00', 'd0376870-1e7c-47eb-aff1-6e185c6df04a', 50, 5, 'bas'),
  -- Jeudi
  (4, '08:00', '09813000-8bb9-4278-8eda-d4f6a6f166cb', 50, 5, 'bas'),
  (4, '09:00', '1f27b0dc-1b40-4392-adc5-841a49531c69', 50, 5, 'bas'),
  (4, '10:00', 'd0376870-1e7c-47eb-aff1-6e185c6df04a', 50, 5, 'bas'),
  (4, '11:00', '15078a3e-bda4-40ec-a4ae-a1b7399bb973', 60, 1, 'bas'),
  (4, '12:15', 'd0376870-1e7c-47eb-aff1-6e185c6df04a', 50, 5, 'bas'),
  (4, '12:30', '09813000-8bb9-4278-8eda-d4f6a6f166cb', 50, 5, 'bas'),
  (4, '17:00', '1f27b0dc-1b40-4392-adc5-841a49531c69', 50, 5, 'bas'),
  (4, '18:00', 'cd7d9b39-1af4-41dc-be4b-1ef54635f5ca', 50, 5, 'bas'),
  -- Vendredi
  (5, '08:00', '09813000-8bb9-4278-8eda-d4f6a6f166cb', 50, 5, 'bas'),
  (5, '10:15', 'd0376870-1e7c-47eb-aff1-6e185c6df04a', 50, 5, 'bas'),
  (5, '11:15', 'd4c4ee5a-20ae-4e90-8547-bd54a2119f08', 50, 5, 'bas'),
  (5, '12:15', '09813000-8bb9-4278-8eda-d4f6a6f166cb', 50, 5, 'bas'),
  (5, '12:20', 'd0376870-1e7c-47eb-aff1-6e185c6df04a', 50, 5, 'bas'),
  (5, '17:00', '09813000-8bb9-4278-8eda-d4f6a6f166cb', 50, 5, 'bas'),
  (5, '18:00', 'd0376870-1e7c-47eb-aff1-6e185c6df04a', 50, 5, 'bas'),
  (5, '19:00', 'cd7d9b39-1af4-41dc-be4b-1ef54635f5ca', 50, 5, 'bas'),
  -- Samedi
  (6, '09:30', '09813000-8bb9-4278-8eda-d4f6a6f166cb', 50, 4, 'haut'),
  (6, '10:30', '09813000-8bb9-4278-8eda-d4f6a6f166cb', 50, 4, 'bas'),
  (6, '11:30', 'cd7d9b39-1af4-41dc-be4b-1ef54635f5ca', 50, 5, 'bas'),
  (6, '12:30', 'd0376870-1e7c-47eb-aff1-6e185c6df04a', 50, 5, 'bas')
),
-- Les coachs de bot3, numerotes pour une repartition stable.
coachs AS (
  SELECT p.id, row_number() OVER (ORDER BY p.id) - 1 AS n,
         count(*) OVER () AS total
    FROM profiles p
   WHERE p.deleted_at IS NULL
     AND EXISTS (SELECT 1 FROM user_roles ur
                  WHERE ur.user_id = p.id AND ur.role IN ('coach','admin','super_admin'))
),
-- Une semaine derriere, quatre devant. La semaine 0 est celle en cours.
--
-- Ces bornes ne sont pas choisies au hasard : la production porte 35 cours
-- passes pour 190 a venir, un desequilibre marque — le studio planifie loin
-- devant et ne garde pas d'archive profonde. Avec 44 creneaux par semaine,
-- `-1` a `4` donne ~44 passes et ~176 futurs, soit 264 cours. C'est ce qui
-- approche le mieux les 225 de bot-ops. Elargir en arriere gonflerait
-- l'historique bien au-dela du reel.
semaines AS (SELECT generate_series(-1, 4) AS s),
poses AS (
  SELECT
    c.type_id::uuid AS class_type_id,
    c.duree AS duration_minutes,
    c.places AS max_participants,
    c.etage AS floor,
    -- Lundi de la semaine visee, puis le jour et l'heure du creneau, en heure
    -- de Bruxelles : c'est ainsi que le studio lit son planning.
    ((date_trunc('week', now() AT TIME ZONE 'Europe/Brussels')::date
      + (sem.s * 7) + (c.jour - 1))::text || ' ' || c.heure)::timestamp
      AT TIME ZONE 'Europe/Brussels' AS starts_at,
    row_number() OVER (ORDER BY sem.s, c.jour, c.heure) AS rang
  FROM creneaux c CROSS JOIN semaines sem
)
INSERT INTO scheduled_classes (class_type_id, coach_id, starts_at, duration_minutes,
                               max_participants, floor, is_cancelled)
SELECT p.class_type_id,
       (SELECT co.id FROM coachs co WHERE co.n = p.rang % co.total),
       p.starts_at,
       p.duration_minutes,
       p.max_participants,
       p.floor,
       -- Une poignee de cours annules, comme il s'en produit dans la vraie vie.
       (p.rang % 37 = 0)
  FROM poses p
 WHERE EXISTS (SELECT 1 FROM coachs);

-- ---------------------------------------------------------------------------
-- 4. Les achats de packs, AVANT les reservations
-- ---------------------------------------------------------------------------
-- L'ordre est impose par une contrainte metier :
--
--   CHECK ((pack_purchase_id IS NOT NULL) OR is_trial)   -- bookings_pack_or_trial
--
-- Une reservation doit etre adossee a un pack des l'insertion, ou etre marquee
-- comme seance d'essai. Il n'est donc pas possible d'inserer les reservations
-- puis de les rattacher apres coup : la contrainte est verifiee ligne a ligne,
-- au moment de l'ecriture. Rencontre le 2026-09-05.
--
-- Un pack par membre susceptible de reserver. La jauge est large — le solde
-- restant est ajuste au §5, une fois les reservations connues.
WITH pack_std AS (
  SELECT id, credit_count, validity_days, price_cents
    FROM pack_types
   WHERE is_active AND NOT is_trial AND NOT is_unlimited
     AND credit_type_id = '258f3433-e8bf-4b53-8961-38dc23958a12'
   ORDER BY credit_count DESC LIMIT 1
)
INSERT INTO pack_purchases (user_id, pack_type_id, credits_remaining,
                            purchased_at, expires_at, price_paid_cents, payment_method)
SELECT p.id, ps.id, ps.credit_count,
       now() - interval '30 days',
       -- L'achat date d'un mois : l'expiration court a partir de la, ce qui
       -- laisse un pack encore valide pour la periode couverte par le planning.
       now() - interval '30 days' + (ps.validity_days || ' days')::interval,
       ps.price_cents,
       -- `pack_purchases_payment_method_check` n'admet que ces quatre valeurs :
       -- stripe, cash, transfer, gift. « card » serait refuse.
       'stripe'
  FROM profiles p CROSS JOIN pack_std ps
 WHERE p.deleted_at IS NULL
   AND EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id = p.id AND ur.role = 'client');

-- ---------------------------------------------------------------------------
-- 5. Les reservations
-- ---------------------------------------------------------------------------
-- La production tourne a 0,87 inscrit par cours, 81 seances pointees sur 195
-- confirmees, 29 annulations et 1 absence. On vise la meme forme.
--
-- Les membres retenus sont les comptes non-staff, ceux qui reservent vraiment.
-- La repartition n'est pas uniforme : quelques habitues portent l'essentiel du
-- volume, comme au studio. Les modulos donnent un pseudo-hasard reproductible —
-- deux passages du script donnent le meme resultat, ce qui rend un ecart
-- constate a l'ecran imputable au code et non au jeu de donnees.
WITH membres AS (
  -- Chaque membre avec SON pack, pose au §4 : c'est lui qui remplira
  -- `pack_purchase_id` des l'insertion, comme l'exige la contrainte.
  SELECT p.id, pp.id AS pack_id,
         row_number() OVER (ORDER BY p.id) - 1 AS n,
         count(*) OVER () AS total
    FROM profiles p
    JOIN pack_purchases pp ON pp.user_id = p.id
   WHERE p.deleted_at IS NULL
     AND EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id = p.id AND ur.role = 'client')
),
cours AS (
  SELECT sc.id, sc.starts_at, sc.max_participants,
         row_number() OVER (ORDER BY sc.starts_at) AS rang
    FROM scheduled_classes sc
   WHERE sc.is_cancelled = false
     -- Au-dela de la fenetre de reservation (10 jours), un membre ne peut pas
     -- encore reserver : y poser des inscriptions donnerait un planning que
     -- l'application elle-meme jugerait impossible.
     AND sc.starts_at < now() + interval '10 days'
),
-- Combien d'inscrits sur ce cours : entre 0 et la jauge, resserre autour de 1.
places AS (
  SELECT c.id, c.starts_at, c.rang,
         LEAST(c.max_participants,
               CASE (c.rang * 7 + 3) % 10
                 WHEN 0 THEN 0 WHEN 1 THEN 0 WHEN 2 THEN 0 WHEN 3 THEN 0
                 WHEN 4 THEN 1 WHEN 5 THEN 1 WHEN 6 THEN 1 WHEN 7 THEN 2
                 WHEN 8 THEN 2 ELSE 3 END) AS n_inscrits
    FROM cours c
),
attributions AS (
  SELECT pl.id AS class_id, pl.starts_at, pl.rang, g.i,
         m.id AS user_id, m.pack_id
    FROM places pl
    CROSS JOIN LATERAL generate_series(1, pl.n_inscrits) AS g(i)
    LEFT JOIN membres m
      ON m.n = ((pl.rang * 13 + g.i * 29) % (SELECT count(*) FROM membres))
   WHERE pl.n_inscrits > 0
)
INSERT INTO bookings (user_id, scheduled_class_id, pack_purchase_id, status,
                      created_at, checked_in_at, is_no_show, cancelled_at)
SELECT a.user_id, a.class_id, a.pack_id,
       -- Une reservation sur huit est annulee.
       CASE WHEN (a.rang * 5 + a.i) % 8 = 0 THEN 'cancelled' ELSE 'confirmed' END,
       a.starts_at - interval '3 days',
       -- Pointage : seulement sur les cours passes, et pas tous — c'est
       -- precisement ce qui alimente le bandeau des presences.
       CASE WHEN a.starts_at < now() - interval '4 hours'
             AND (a.rang * 5 + a.i) % 8 <> 0
             AND (a.rang + a.i) % 4 <> 0
            THEN a.starts_at + interval '50 minutes' END,
       -- Une absence de temps en temps, sur du passe uniquement.
       (a.starts_at < now() AND (a.rang * 11 + a.i) % 53 = 0),
       CASE WHEN (a.rang * 5 + a.i) % 8 = 0 THEN a.starts_at - interval '1 day' END
  FROM attributions a
 WHERE a.user_id IS NOT NULL
-- Un membre ne peut pas etre inscrit deux fois au meme cours : le tirage peut
-- retomber sur lui, on laisse la base trancher.
ON CONFLICT DO NOTHING;

-- Ajuster le solde des packs : ce qui reste, c'est la jauge moins les seances
-- effectivement reservees. Fait apres coup, les reservations n'etant connues
-- qu'ici — un pack pose au §4 porte encore son compte plein.
UPDATE pack_purchases pp
   SET credits_remaining = GREATEST(
         (SELECT pt.credit_count FROM pack_types pt WHERE pt.id = pp.pack_type_id)
         - (SELECT count(*) FROM bookings b
             WHERE b.pack_purchase_id = pp.id AND b.status = 'confirmed'), 0);

-- ---------------------------------------------------------------------------
-- 6. Remettre les statuts de membre d'aplomb
-- ---------------------------------------------------------------------------
-- `member_status` est entretenu par trigger a chaque achat et reservation. Les
-- ecritures ci-dessus l'ont bouscule ; on le recalcule pour tout le monde.
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN SELECT id FROM profiles WHERE deleted_at IS NULL LOOP
    PERFORM update_member_status(r.id);
  END LOOP;
END $$;

COMMIT;

-- ============================================================================
-- CONTROLE — a executer separement, apres le COMMIT.
-- Comparer la colonne `bot3` a la colonne `production` : les ordres de grandeur
-- doivent se ressembler. L'egalite stricte n'est ni attendue ni souhaitable.
-- ============================================================================
-- SELECT 'cours (total)' AS mesure,
--        (SELECT count(*) FROM scheduled_classes)::text AS bot3, '225' AS production
-- UNION ALL SELECT 'dont passes',
--        (SELECT count(*) FROM scheduled_classes WHERE starts_at < now())::text, '35'
-- UNION ALL SELECT 'dont a venir',
--        (SELECT count(*) FROM scheduled_classes WHERE starts_at >= now())::text, '190'
-- UNION ALL SELECT 'reservations confirmees',
--        (SELECT count(*) FROM bookings WHERE status = 'confirmed')::text, '195'
-- UNION ALL SELECT 'annulees',
--        (SELECT count(*) FROM bookings WHERE status = 'cancelled')::text, '29'
-- UNION ALL SELECT 'pointees',
--        (SELECT count(*) FROM bookings WHERE checked_in_at IS NOT NULL)::text, '81'
-- UNION ALL SELECT 'absences',
--        (SELECT count(*) FROM bookings WHERE is_no_show)::text, '1'
-- UNION ALL SELECT 'membres ayant reserve',
--        (SELECT count(DISTINCT user_id) FROM bookings)::text, '73 (sur 102)'
-- UNION ALL SELECT 'inscrits par cours (moyenne)',
--        (SELECT round(avg(n), 2)::text FROM (
--           SELECT count(b.id) n FROM scheduled_classes sc
--             LEFT JOIN bookings b ON b.scheduled_class_id = sc.id AND b.status = 'confirmed'
--            GROUP BY sc.id) x), '0.87'
-- UNION ALL SELECT 'cours a pointer (bandeau)',
--        (SELECT count(*)::text FROM cours_sans_presences(false)), 'variable';

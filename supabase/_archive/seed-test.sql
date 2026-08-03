-- ============================================
-- SEED : Données de démonstration complètes
-- À exécuter APRÈS reset-test-data.sql
--
-- Crée : credit_types, class_types, pack_types,
--         6 membres, packs, cours, réservations
-- ============================================

-- ============================================
-- 1. TYPES DE CRÉDITS
-- ============================================
INSERT INTO credit_types (id, name, label_fr, label_en) VALUES
  ('b6f8eabb-467e-497a-8303-9c3dd9cacc30', 'semi_prive', 'Semi-privé', 'Semi-private'),
  ('9b9511ef-37d7-4dca-8447-099021139df2', 'personal_training', 'Personal Training', 'Personal Training')
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- 2. TYPES DE COURS
-- ============================================
INSERT INTO class_types (id, name, credit_type_id, default_max_participants, color) VALUES
  ('f5b1718d-174e-4557-82ae-a6cc9a115ba1', 'CrossTraining', 'b6f8eabb-467e-497a-8303-9c3dd9cacc30', 4, '#EF4444'),
  ('89788ddb-90a4-46f7-b468-566f5d13cc04', 'BackOnTrack', 'b6f8eabb-467e-497a-8303-9c3dd9cacc30', 4, '#3B82F6'),
  ('391581f1-3df4-4546-8e2f-c4fd5c8fede0', 'Posture', 'b6f8eabb-467e-497a-8303-9c3dd9cacc30', 4, '#8B5CF6'),
  ('89a34a9b-c98f-46ca-ad5f-e7f7869ca218', 'Ladies', 'b6f8eabb-467e-497a-8303-9c3dd9cacc30', 4, '#EC4899'),
  ('cbc01900-5003-4cf3-8869-df951f11acd0', 'Événement spécial', 'b6f8eabb-467e-497a-8303-9c3dd9cacc30', 8, '#F59E0B')
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- 3. TYPES DE PACKS
-- ============================================
INSERT INTO pack_types (id, name, description, credit_type_id, credit_count, price_cents, validity_days) VALUES
  -- Semi-privé
  ('aaa10001-0001-0001-0001-000000000001', 'Carte 3 séances', '4 semaines de validité', 'b6f8eabb-467e-497a-8303-9c3dd9cacc30', 3, 6900, 28),
  ('aaa10001-0001-0001-0001-000000000002', 'Carte 10 séances', '3 mois de validité', 'b6f8eabb-467e-497a-8303-9c3dd9cacc30', 10, 19900, 90),
  ('aaa10001-0001-0001-0001-000000000003', 'Carte 20 séances 3 mois', '3 mois de validité', 'b6f8eabb-467e-497a-8303-9c3dd9cacc30', 20, 29900, 90),
  ('aaa10001-0001-0001-0001-000000000004', 'Carte 20 séances 5 mois', '5 mois de validité', 'b6f8eabb-467e-497a-8303-9c3dd9cacc30', 20, 35900, 150),
  -- Personal Training
  ('aaa10001-0001-0001-0001-000000000005', 'PT — 1 séance', NULL, '9b9511ef-37d7-4dca-8447-099021139df2', 1, 7500, 30),
  ('aaa10001-0001-0001-0001-000000000006', 'PT — 5 séances', NULL, '9b9511ef-37d7-4dca-8447-099021139df2', 5, 35000, 90),
  ('aaa10001-0001-0001-0001-000000000007', 'PT — 10 séances', NULL, '9b9511ef-37d7-4dca-8447-099021139df2', 10, 65000, 120),
  ('aaa10001-0001-0001-0001-000000000008', 'PT — 20 séances', NULL, '9b9511ef-37d7-4dca-8447-099021139df2', 20, 120000, 180)
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- 4. CRÉER LES UTILISATEURS DE TEST
-- ============================================
INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, raw_user_meta_data, created_at, updated_at, instance_id, aud, role)
VALUES
  ('aaaa0001-0001-0001-0001-000000000001', 'ingrid@demo.bot', crypt('Demo12345678!', gen_salt('bf')), NOW(), '{"display_name":"Ingrid Van Brussel","first_name":"Ingrid","last_name":"Van Brussel","phone":"+32 472 00 01 01","date_of_birth":"1990-03-15","address":"Rue du Midi 10, 1000 Bruxelles","cgv_accepted":"true","rgpd_accepted":"true"}'::jsonb, NOW(), NOW(), '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated'),
  ('aaaa0001-0001-0001-0001-000000000002', 'sophie@demo.bot', crypt('Demo12345678!', gen_salt('bf')), NOW(), '{"display_name":"Sophie Martin","first_name":"Sophie","last_name":"Martin","phone":"+32 472 00 02 02","date_of_birth":"1988-07-22","address":"Avenue Louise 150, 1050 Ixelles","cgv_accepted":"true","rgpd_accepted":"true"}'::jsonb, NOW(), NOW(), '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated'),
  ('aaaa0001-0001-0001-0001-000000000003', 'lucas@demo.bot', crypt('Demo12345678!', gen_salt('bf')), NOW(), '{"display_name":"Lucas Petit","first_name":"Lucas","last_name":"Petit","phone":"+32 472 00 03 03","date_of_birth":"1995-11-08","address":"Chaussée de Wavre 200, 1050 Ixelles","cgv_accepted":"true","rgpd_accepted":"true"}'::jsonb, NOW(), NOW(), '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated'),
  ('aaaa0001-0001-0001-0001-000000000004', 'anouck@demo.bot', crypt('Demo12345678!', gen_salt('bf')), NOW(), '{"display_name":"Anouck Renson","first_name":"Anouck","last_name":"Renson","phone":"+32 472 00 04 04","date_of_birth":"1992-01-30","address":"Rue Haute 50, 1000 Bruxelles","cgv_accepted":"true","rgpd_accepted":"true"}'::jsonb, NOW(), NOW(), '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated'),
  ('aaaa0001-0001-0001-0001-000000000005', 'thomas@demo.bot', crypt('Demo12345678!', gen_salt('bf')), NOW(), '{"display_name":"Thomas Dupont","first_name":"Thomas","last_name":"Dupont","phone":"+32 472 00 05 05","date_of_birth":"1998-05-12","address":"Boulevard Anspach 80, 1000 Bruxelles","cgv_accepted":"true","rgpd_accepted":"true"}'::jsonb, NOW(), NOW(), '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated'),
  ('aaaa0001-0001-0001-0001-000000000006', 'simona@demo.bot', crypt('Demo12345678!', gen_salt('bf')), NOW(), '{"display_name":"Simona Costamagna","first_name":"Simona","last_name":"Costamagna","phone":"+32 472 00 06 06","date_of_birth":"1985-09-25","address":"Rue de Namur 30, 1000 Bruxelles","cgv_accepted":"true","rgpd_accepted":"true"}'::jsonb, NOW(), NOW(), '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated')
ON CONFLICT (id) DO NOTHING;

-- Attendre le trigger handle_new_user
SELECT pg_sleep(1);

-- ============================================
-- 5. FRAIS D'INSCRIPTION (5 sur 6 ont payé, Thomas non)
-- ============================================
INSERT INTO registration_fees (user_id, amount_cents) VALUES
  ('aaaa0001-0001-0001-0001-000000000001', 3000),
  ('aaaa0001-0001-0001-0001-000000000002', 3000),
  ('aaaa0001-0001-0001-0001-000000000003', 3000),
  ('aaaa0001-0001-0001-0001-000000000004', 3000),
  ('aaaa0001-0001-0001-0001-000000000006', 3000);

-- ============================================
-- 6. ACHATS DE PACKS
-- ============================================

-- Ingrid : carte 10 séances (7 crédits restants)
INSERT INTO pack_purchases (id, user_id, pack_type_id, price_paid_cents, credits_remaining, purchased_at, expires_at) VALUES
  ('bbbb0001-0001-0001-0001-000000000001', 'aaaa0001-0001-0001-0001-000000000001', 'aaa10001-0001-0001-0001-000000000002', 19900, 7, NOW() - INTERVAL '15 days', NOW() + INTERVAL '75 days');

-- Sophie : carte 20 séances 3 mois (18 crédits restants)
INSERT INTO pack_purchases (id, user_id, pack_type_id, price_paid_cents, credits_remaining, purchased_at, expires_at) VALUES
  ('bbbb0001-0001-0001-0001-000000000002', 'aaaa0001-0001-0001-0001-000000000002', 'aaa10001-0001-0001-0001-000000000003', 29900, 18, NOW() - INTERVAL '10 days', NOW() + INTERVAL '80 days');

-- Lucas : carte 10 séances (3 crédits restants, expire bientôt)
INSERT INTO pack_purchases (id, user_id, pack_type_id, price_paid_cents, credits_remaining, purchased_at, expires_at) VALUES
  ('bbbb0001-0001-0001-0001-000000000003', 'aaaa0001-0001-0001-0001-000000000003', 'aaa10001-0001-0001-0001-000000000002', 19900, 3, NOW() - INTERVAL '80 days', NOW() + INTERVAL '10 days');

-- Anouck : carte 20 séances (15 crédits) + PT 10 séances (8 crédits)
INSERT INTO pack_purchases (id, user_id, pack_type_id, price_paid_cents, credits_remaining, purchased_at, expires_at) VALUES
  ('bbbb0001-0001-0001-0001-000000000004', 'aaaa0001-0001-0001-0001-000000000004', 'aaa10001-0001-0001-0001-000000000003', 29900, 15, NOW() - INTERVAL '20 days', NOW() + INTERVAL '70 days'),
  ('bbbb0001-0001-0001-0001-000000000005', 'aaaa0001-0001-0001-0001-000000000004', 'aaa10001-0001-0001-0001-000000000007', 65000, 8, NOW() - INTERVAL '5 days', NOW() + INTERVAL '115 days');

-- Simona : PT 10 séances (10 crédits)
INSERT INTO pack_purchases (id, user_id, pack_type_id, price_paid_cents, credits_remaining, purchased_at, expires_at) VALUES
  ('bbbb0001-0001-0001-0001-000000000006', 'aaaa0001-0001-0001-0001-000000000006', 'aaa10001-0001-0001-0001-000000000007', 65000, 10, NOW() - INTERVAL '3 days', NOW() + INTERVAL '117 days');

-- Thomas : pas de pack (frais non payés)

-- ============================================
-- 7. METTRE À JOUR LES STATUTS MEMBRES
-- ============================================
SELECT update_member_status('aaaa0001-0001-0001-0001-000000000001');
SELECT update_member_status('aaaa0001-0001-0001-0001-000000000002');
SELECT update_member_status('aaaa0001-0001-0001-0001-000000000003');
SELECT update_member_status('aaaa0001-0001-0001-0001-000000000004');
SELECT update_member_status('aaaa0001-0001-0001-0001-000000000005');
SELECT update_member_status('aaaa0001-0001-0001-0001-000000000006');

-- ============================================
-- 8. COURS PLANIFIÉS (2 semaines à partir de lundi prochain)
-- ============================================
DO $$
DECLARE
  v_coach_id UUID;
  v_today DATE := CURRENT_DATE;
  v_next_mon DATE;
BEGIN
  SELECT user_id INTO v_coach_id FROM user_roles WHERE role IN ('admin', 'super_admin', 'coach') LIMIT 1;

  -- Prochain lundi
  v_next_mon := v_today + ((8 - EXTRACT(DOW FROM v_today)::INTEGER) % 7);
  IF v_next_mon <= v_today THEN v_next_mon := v_next_mon + 7; END IF;

  INSERT INTO scheduled_classes (class_type_id, coach_id, starts_at, duration_minutes, max_participants, floor) VALUES
    -- SEMAINE 1
    -- Lundi
    ('f5b1718d-174e-4557-82ae-a6cc9a115ba1', v_coach_id, v_next_mon + TIME '08:00', 50, 4, 'bas'),
    ('89788ddb-90a4-46f7-b468-566f5d13cc04', v_coach_id, v_next_mon + TIME '12:00', 50, 4, 'bas'),
    ('89a34a9b-c98f-46ca-ad5f-e7f7869ca218', v_coach_id, v_next_mon + TIME '18:00', 50, 4, 'haut'),
    -- Mardi
    ('391581f1-3df4-4546-8e2f-c4fd5c8fede0', v_coach_id, v_next_mon + INTERVAL '1 day' + TIME '08:00', 50, 4, 'bas'),
    ('f5b1718d-174e-4557-82ae-a6cc9a115ba1', v_coach_id, v_next_mon + INTERVAL '1 day' + TIME '18:00', 50, 4, 'bas'),
    ('89788ddb-90a4-46f7-b468-566f5d13cc04', v_coach_id, v_next_mon + INTERVAL '1 day' + TIME '18:00', 50, 4, 'haut'),
    -- Mercredi
    ('f5b1718d-174e-4557-82ae-a6cc9a115ba1', v_coach_id, v_next_mon + INTERVAL '2 days' + TIME '08:00', 50, 4, 'bas'),
    ('89a34a9b-c98f-46ca-ad5f-e7f7869ca218', v_coach_id, v_next_mon + INTERVAL '2 days' + TIME '12:00', 50, 4, 'haut'),
    ('391581f1-3df4-4546-8e2f-c4fd5c8fede0', v_coach_id, v_next_mon + INTERVAL '2 days' + TIME '18:00', 50, 4, 'bas'),
    -- Jeudi
    ('89788ddb-90a4-46f7-b468-566f5d13cc04', v_coach_id, v_next_mon + INTERVAL '3 days' + TIME '08:00', 50, 4, 'bas'),
    ('f5b1718d-174e-4557-82ae-a6cc9a115ba1', v_coach_id, v_next_mon + INTERVAL '3 days' + TIME '18:00', 50, 4, 'bas'),
    -- Vendredi
    ('391581f1-3df4-4546-8e2f-c4fd5c8fede0', v_coach_id, v_next_mon + INTERVAL '4 days' + TIME '08:00', 50, 4, 'haut'),
    ('f5b1718d-174e-4557-82ae-a6cc9a115ba1', v_coach_id, v_next_mon + INTERVAL '4 days' + TIME '12:00', 50, 4, 'bas'),
    ('89788ddb-90a4-46f7-b468-566f5d13cc04', v_coach_id, v_next_mon + INTERVAL '4 days' + TIME '18:00', 50, 4, 'bas'),

    -- SEMAINE 2 (mêmes cours +7 jours)
    ('f5b1718d-174e-4557-82ae-a6cc9a115ba1', v_coach_id, v_next_mon + INTERVAL '7 days' + TIME '08:00', 50, 4, 'bas'),
    ('89788ddb-90a4-46f7-b468-566f5d13cc04', v_coach_id, v_next_mon + INTERVAL '7 days' + TIME '12:00', 50, 4, 'bas'),
    ('89a34a9b-c98f-46ca-ad5f-e7f7869ca218', v_coach_id, v_next_mon + INTERVAL '7 days' + TIME '18:00', 50, 4, 'haut'),
    ('391581f1-3df4-4546-8e2f-c4fd5c8fede0', v_coach_id, v_next_mon + INTERVAL '8 days' + TIME '08:00', 50, 4, 'bas'),
    ('f5b1718d-174e-4557-82ae-a6cc9a115ba1', v_coach_id, v_next_mon + INTERVAL '8 days' + TIME '18:00', 50, 4, 'bas'),
    ('f5b1718d-174e-4557-82ae-a6cc9a115ba1', v_coach_id, v_next_mon + INTERVAL '9 days' + TIME '08:00', 50, 4, 'bas'),
    ('89a34a9b-c98f-46ca-ad5f-e7f7869ca218', v_coach_id, v_next_mon + INTERVAL '9 days' + TIME '12:00', 50, 4, 'haut');
END;
$$;

-- ============================================
-- 9. RÉSERVATIONS (sur les cours de la semaine prochaine)
-- ============================================

-- Ingrid réserve CrossTraining lundi 8h et BackOnTrack lundi 12h
INSERT INTO bookings (scheduled_class_id, user_id, pack_purchase_id)
SELECT sc.id, 'aaaa0001-0001-0001-0001-000000000001', 'bbbb0001-0001-0001-0001-000000000001'
FROM scheduled_classes sc
WHERE sc.class_type_id = 'f5b1718d-174e-4557-82ae-a6cc9a115ba1'
  AND EXTRACT(HOUR FROM sc.starts_at) = 8
  AND sc.starts_at > NOW()
ORDER BY sc.starts_at LIMIT 1;

INSERT INTO bookings (scheduled_class_id, user_id, pack_purchase_id)
SELECT sc.id, 'aaaa0001-0001-0001-0001-000000000001', 'bbbb0001-0001-0001-0001-000000000001'
FROM scheduled_classes sc
WHERE sc.class_type_id = '89788ddb-90a4-46f7-b468-566f5d13cc04'
  AND EXTRACT(HOUR FROM sc.starts_at) = 12
  AND sc.starts_at > NOW()
ORDER BY sc.starts_at LIMIT 1;

-- Sophie réserve CrossTraining lundi 8h et Ladies lundi 18h
INSERT INTO bookings (scheduled_class_id, user_id, pack_purchase_id)
SELECT sc.id, 'aaaa0001-0001-0001-0001-000000000002', 'bbbb0001-0001-0001-0001-000000000002'
FROM scheduled_classes sc
WHERE sc.class_type_id = 'f5b1718d-174e-4557-82ae-a6cc9a115ba1'
  AND EXTRACT(HOUR FROM sc.starts_at) = 8
  AND sc.starts_at > NOW()
ORDER BY sc.starts_at LIMIT 1;

INSERT INTO bookings (scheduled_class_id, user_id, pack_purchase_id)
SELECT sc.id, 'aaaa0001-0001-0001-0001-000000000002', 'bbbb0001-0001-0001-0001-000000000002'
FROM scheduled_classes sc
WHERE sc.class_type_id = '89a34a9b-c98f-46ca-ad5f-e7f7869ca218'
  AND EXTRACT(HOUR FROM sc.starts_at) = 18
  AND sc.starts_at > NOW()
ORDER BY sc.starts_at LIMIT 1;

-- Anouck réserve Posture mardi 8h et CrossTraining mardi 18h
INSERT INTO bookings (scheduled_class_id, user_id, pack_purchase_id)
SELECT sc.id, 'aaaa0001-0001-0001-0001-000000000004', 'bbbb0001-0001-0001-0001-000000000004'
FROM scheduled_classes sc
WHERE sc.class_type_id = '391581f1-3df4-4546-8e2f-c4fd5c8fede0'
  AND EXTRACT(HOUR FROM sc.starts_at) = 8
  AND sc.starts_at > NOW()
ORDER BY sc.starts_at LIMIT 1;

INSERT INTO bookings (scheduled_class_id, user_id, pack_purchase_id)
SELECT sc.id, 'aaaa0001-0001-0001-0001-000000000004', 'bbbb0001-0001-0001-0001-000000000004'
FROM scheduled_classes sc
WHERE sc.class_type_id = 'f5b1718d-174e-4557-82ae-a6cc9a115ba1'
  AND EXTRACT(HOUR FROM sc.starts_at) = 18
  AND sc.floor = 'bas'
  AND sc.starts_at > NOW()
ORDER BY sc.starts_at LIMIT 1;

-- Lucas réserve CrossTraining mercredi 8h
INSERT INTO bookings (scheduled_class_id, user_id, pack_purchase_id)
SELECT sc.id, 'aaaa0001-0001-0001-0001-000000000003', 'bbbb0001-0001-0001-0001-000000000003'
FROM scheduled_classes sc
WHERE sc.class_type_id = 'f5b1718d-174e-4557-82ae-a6cc9a115ba1'
  AND EXTRACT(HOUR FROM sc.starts_at) = 8
  AND sc.starts_at > NOW()
ORDER BY sc.starts_at
OFFSET 2 LIMIT 1;

-- Déduire les crédits des réservations
UPDATE pack_purchases SET credits_remaining = credits_remaining - 2 WHERE id = 'bbbb0001-0001-0001-0001-000000000001'; -- Ingrid: 7→5
UPDATE pack_purchases SET credits_remaining = credits_remaining - 2 WHERE id = 'bbbb0001-0001-0001-0001-000000000002'; -- Sophie: 18→16
UPDATE pack_purchases SET credits_remaining = credits_remaining - 2 WHERE id = 'bbbb0001-0001-0001-0001-000000000004'; -- Anouck: 15→13
UPDATE pack_purchases SET credits_remaining = credits_remaining - 1 WHERE id = 'bbbb0001-0001-0001-0001-000000000003'; -- Lucas: 3→2

-- ============================================
-- 10. PARRAINAGE : Ingrid a parrainé Sophie
-- ============================================
INSERT INTO referrals (referrer_id, referee_id, referral_code, status, qualified_at)
VALUES (
  'aaaa0001-0001-0001-0001-000000000001',
  'aaaa0001-0001-0001-0001-000000000002',
  (SELECT referral_code FROM profiles WHERE id = 'aaaa0001-0001-0001-0001-000000000001'),
  'qualified',
  NOW()
);

-- ============================================
-- RÉSUMÉ
-- ============================================
-- Credit types : semi_prive, personal_training
-- Class types  : CrossTraining, BackOnTrack, Posture, Ladies, Événement spécial
-- Pack types   : 4 semi-privé (3/10/20/20 séances) + 4 PT (1/5/10/20 séances)
--
-- 6 membres (mot de passe : Demo12345678!) :
--   Ingrid   : frais OK, 10 semi-privé (5 crédits), 2 résa, parraine Sophie
--   Sophie   : frais OK, 20 semi-privé (16 crédits), 2 résa, filleule d'Ingrid
--   Lucas    : frais OK, 10 semi-privé (2 crédits, expire dans 10j), 1 résa
--   Anouck   : frais OK, 20 semi-privé (13 crédits) + 10 PT (8 crédits), 2 résa
--   Thomas   : frais NON payés, 0 pack, 0 résa (peut faire séance d'essai)
--   Simona   : frais OK, 10 PT (10 crédits), 0 résa
--
-- 21 cours (2 semaines lun-ven, salles haut/bas)
-- 7 réservations
-- 1 parrainage qualifié

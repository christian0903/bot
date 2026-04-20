-- ============================================
-- SEED : Données de démonstration
-- À exécuter APRÈS reset-test-data.sql
-- Crée 6 membres, des packs, des cours et des réservations
--
-- Prérequis : les class_types et pack_types existent déjà
-- ============================================

-- ============================================
-- 1. CRÉER LES UTILISATEURS DE TEST
-- (via auth.users + trigger handle_new_user crée le profil)
-- ============================================

-- Note : on insère directement dans auth.users et profiles
-- car le trigger handle_new_user s'en charge

INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, raw_user_meta_data, created_at, updated_at, instance_id, aud, role)
VALUES
  ('aaaa0001-0001-0001-0001-000000000001', 'ingrid@demo.bot', crypt('Demo12345678!', gen_salt('bf')), NOW(), '{"display_name":"Ingrid Van Brussel","first_name":"Ingrid","last_name":"Van Brussel","phone":"+32 472 00 01 01","date_of_birth":"1990-03-15","address":"Rue du Midi 10, 1000 Bruxelles","cgv_accepted":"true","rgpd_accepted":"true"}'::jsonb, NOW(), NOW(), '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated'),
  ('aaaa0001-0001-0001-0001-000000000002', 'sophie@demo.bot', crypt('Demo12345678!', gen_salt('bf')), NOW(), '{"display_name":"Sophie Martin","first_name":"Sophie","last_name":"Martin","phone":"+32 472 00 02 02","date_of_birth":"1988-07-22","address":"Avenue Louise 150, 1050 Ixelles","cgv_accepted":"true","rgpd_accepted":"true"}'::jsonb, NOW(), NOW(), '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated'),
  ('aaaa0001-0001-0001-0001-000000000003', 'lucas@demo.bot', crypt('Demo12345678!', gen_salt('bf')), NOW(), '{"display_name":"Lucas Petit","first_name":"Lucas","last_name":"Petit","phone":"+32 472 00 03 03","date_of_birth":"1995-11-08","address":"Chaussée de Wavre 200, 1050 Ixelles","cgv_accepted":"true","rgpd_accepted":"true"}'::jsonb, NOW(), NOW(), '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated'),
  ('aaaa0001-0001-0001-0001-000000000004', 'anouck@demo.bot', crypt('Demo12345678!', gen_salt('bf')), NOW(), '{"display_name":"Anouck Renson","first_name":"Anouck","last_name":"Renson","phone":"+32 472 00 04 04","date_of_birth":"1992-01-30","address":"Rue Haute 50, 1000 Bruxelles","cgv_accepted":"true","rgpd_accepted":"true"}'::jsonb, NOW(), NOW(), '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated'),
  ('aaaa0001-0001-0001-0001-000000000005', 'thomas@demo.bot', crypt('Demo12345678!', gen_salt('bf')), NOW(), '{"display_name":"Thomas Dupont","first_name":"Thomas","last_name":"Dupont","phone":"+32 472 00 05 05","date_of_birth":"1998-05-12","address":"Boulevard Anspach 80, 1000 Bruxelles","cgv_accepted":"true","rgpd_accepted":"true"}'::jsonb, NOW(), NOW(), '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated'),
  ('aaaa0001-0001-0001-0001-000000000006', 'simona@demo.bot', crypt('Demo12345678!', gen_salt('bf')), NOW(), '{"display_name":"Simona Costamagna","first_name":"Simona","last_name":"Costamagna","phone":"+32 472 00 06 06","date_of_birth":"1985-09-25","address":"Rue de Namur 30, 1000 Bruxelles","cgv_accepted":"true","rgpd_accepted":"true"}'::jsonb, NOW(), NOW(), '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated')
ON CONFLICT (id) DO NOTHING;

-- Petite pause pour le trigger
SELECT pg_sleep(1);

-- ============================================
-- 2. FRAIS D'INSCRIPTION (5 sur 6 ont payé, Thomas non)
-- ============================================
INSERT INTO registration_fees (user_id, amount_cents) VALUES
  ('aaaa0001-0001-0001-0001-000000000001', 3000),
  ('aaaa0001-0001-0001-0001-000000000002', 3000),
  ('aaaa0001-0001-0001-0001-000000000003', 3000),
  ('aaaa0001-0001-0001-0001-000000000004', 3000),
  ('aaaa0001-0001-0001-0001-000000000006', 3000);

-- ============================================
-- 3. ACHATS DE PACKS
-- ============================================

-- Ingrid : pack 10 semi-privé (7 crédits restants)
INSERT INTO pack_purchases (id, user_id, pack_type_id, price_paid_cents, credits_remaining, purchased_at, expires_at) VALUES
  ('bbbb0001-0001-0001-0001-000000000001', 'aaaa0001-0001-0001-0001-000000000001', 'bd652580-7335-48b4-a5c0-db75edd8f86b', 25000, 7, NOW() - INTERVAL '15 days', NOW() + INTERVAL '45 days');

-- Sophie : pack 20 séances 3 mois (18 crédits restants)
INSERT INTO pack_purchases (id, user_id, pack_type_id, price_paid_cents, credits_remaining, purchased_at, expires_at) VALUES
  ('bbbb0001-0001-0001-0001-000000000002', 'aaaa0001-0001-0001-0001-000000000002', '45d59c0d-db7f-4ec6-83e4-e3f48029d4c6', 29900, 18, NOW() - INTERVAL '10 days', NOW() + INTERVAL '74 days');

-- Lucas : pack 10 semi-privé (3 crédits restants, expire bientôt)
INSERT INTO pack_purchases (id, user_id, pack_type_id, price_paid_cents, credits_remaining, purchased_at, expires_at) VALUES
  ('bbbb0001-0001-0001-0001-000000000003', 'aaaa0001-0001-0001-0001-000000000003', 'bd652580-7335-48b4-a5c0-db75edd8f86b', 25000, 3, NOW() - INTERVAL '50 days', NOW() + INTERVAL '10 days');

-- Anouck : pack 20 séances (15 crédits) + pack 10 PT (8 crédits)
INSERT INTO pack_purchases (id, user_id, pack_type_id, price_paid_cents, credits_remaining, purchased_at, expires_at) VALUES
  ('bbbb0001-0001-0001-0001-000000000004', 'aaaa0001-0001-0001-0001-000000000004', '45d59c0d-db7f-4ec6-83e4-e3f48029d4c6', 29900, 15, NOW() - INTERVAL '20 days', NOW() + INTERVAL '64 days'),
  ('bbbb0001-0001-0001-0001-000000000005', 'aaaa0001-0001-0001-0001-000000000004', 'c30296e7-b6c4-43ff-b38c-22e39ba0a417', 75000, 8, NOW() - INTERVAL '5 days', NOW() + INTERVAL '25 days');

-- Simona : pack 10 PT (10 crédits)
INSERT INTO pack_purchases (id, user_id, pack_type_id, price_paid_cents, credits_remaining, purchased_at, expires_at) VALUES
  ('bbbb0001-0001-0001-0001-000000000006', 'aaaa0001-0001-0001-0001-000000000006', 'c30296e7-b6c4-43ff-b38c-22e39ba0a417', 75000, 10, NOW() - INTERVAL '3 days', NOW() + INTERVAL '27 days');

-- Thomas : pas de pack (frais non payés)

-- ============================================
-- 4. METTRE À JOUR LES STATUTS MEMBRES
-- ============================================
SELECT update_member_status('aaaa0001-0001-0001-0001-000000000001');
SELECT update_member_status('aaaa0001-0001-0001-0001-000000000002');
SELECT update_member_status('aaaa0001-0001-0001-0001-000000000003');
SELECT update_member_status('aaaa0001-0001-0001-0001-000000000004');
SELECT update_member_status('aaaa0001-0001-0001-0001-000000000005');
SELECT update_member_status('aaaa0001-0001-0001-0001-000000000006');

-- ============================================
-- 5. COURS PLANIFIÉS (cette semaine + semaine prochaine)
-- ============================================

-- Récupérer un coach admin existant pour les cours
-- On utilise le premier admin trouvé
DO $$
DECLARE
  v_coach_id UUID;
  v_today DATE := CURRENT_DATE;
  v_next_mon DATE;
BEGIN
  SELECT user_id INTO v_coach_id FROM user_roles WHERE role IN ('admin', 'super_admin', 'coach') LIMIT 1;

  -- Prochain lundi
  v_next_mon := v_today + (7 - EXTRACT(DOW FROM v_today)::INTEGER + 1) % 7;
  IF v_next_mon = v_today AND EXTRACT(DOW FROM v_today) != 1 THEN
    v_next_mon := v_next_mon + 7;
  END IF;

  -- Semaine en cours / prochaine : lundi à vendredi
  INSERT INTO scheduled_classes (class_type_id, coach_id, starts_at, duration_minutes, max_participants, floor) VALUES
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
    -- Semaine suivante : mêmes cours +7 jours
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
-- 6. RÉSERVATIONS (quelques-unes sur les cours de la semaine prochaine)
-- ============================================

-- Ingrid réserve le cross training lundi 8h et le back on track lundi 12h
INSERT INTO bookings (scheduled_class_id, user_id, pack_purchase_id)
SELECT sc.id, 'aaaa0001-0001-0001-0001-000000000001', 'bbbb0001-0001-0001-0001-000000000001'
FROM scheduled_classes sc
JOIN class_types ct ON sc.class_type_id = ct.id
WHERE ct.name = 'cross training' AND EXTRACT(HOUR FROM sc.starts_at) = 8
ORDER BY sc.starts_at LIMIT 1;

INSERT INTO bookings (scheduled_class_id, user_id, pack_purchase_id)
SELECT sc.id, 'aaaa0001-0001-0001-0001-000000000001', 'bbbb0001-0001-0001-0001-000000000001'
FROM scheduled_classes sc
JOIN class_types ct ON sc.class_type_id = ct.id
WHERE ct.name = 'back on track' AND EXTRACT(HOUR FROM sc.starts_at) = 8
ORDER BY sc.starts_at LIMIT 1;

-- Sophie réserve le cross training lundi 8h et Ladies lundi 18h
INSERT INTO bookings (scheduled_class_id, user_id, pack_purchase_id)
SELECT sc.id, 'aaaa0001-0001-0001-0001-000000000002', 'bbbb0001-0001-0001-0001-000000000002'
FROM scheduled_classes sc
JOIN class_types ct ON sc.class_type_id = ct.id
WHERE ct.name = 'cross training' AND EXTRACT(HOUR FROM sc.starts_at) = 8
ORDER BY sc.starts_at LIMIT 1;

INSERT INTO bookings (scheduled_class_id, user_id, pack_purchase_id)
SELECT sc.id, 'aaaa0001-0001-0001-0001-000000000002', 'bbbb0001-0001-0001-0001-000000000002'
FROM scheduled_classes sc
JOIN class_types ct ON sc.class_type_id = ct.id
WHERE ct.name = 'Ladies' AND EXTRACT(HOUR FROM sc.starts_at) = 18
ORDER BY sc.starts_at LIMIT 1;

-- Anouck réserve la posture mardi 8h et cross training mardi 18h
INSERT INTO bookings (scheduled_class_id, user_id, pack_purchase_id)
SELECT sc.id, 'aaaa0001-0001-0001-0001-000000000004', 'bbbb0001-0001-0001-0001-000000000004'
FROM scheduled_classes sc
JOIN class_types ct ON sc.class_type_id = ct.id
WHERE ct.name = 'posture' AND EXTRACT(HOUR FROM sc.starts_at) = 8
ORDER BY sc.starts_at LIMIT 1;

INSERT INTO bookings (scheduled_class_id, user_id, pack_purchase_id)
SELECT sc.id, 'aaaa0001-0001-0001-0001-000000000004', 'bbbb0001-0001-0001-0001-000000000004'
FROM scheduled_classes sc
JOIN class_types ct ON sc.class_type_id = ct.id
WHERE ct.name = 'cross training' AND EXTRACT(HOUR FROM sc.starts_at) = 18 AND sc.floor = 'bas'
ORDER BY sc.starts_at LIMIT 1;

-- Lucas réserve le cross training mercredi 8h
INSERT INTO bookings (scheduled_class_id, user_id, pack_purchase_id)
SELECT sc.id, 'aaaa0001-0001-0001-0001-000000000003', 'bbbb0001-0001-0001-0001-000000000003'
FROM scheduled_classes sc
JOIN class_types ct ON sc.class_type_id = ct.id
WHERE ct.name = 'cross training' AND EXTRACT(HOUR FROM sc.starts_at) = 8
AND sc.starts_at > NOW()
ORDER BY sc.starts_at LIMIT 1;

-- Déduire les crédits pour les réservations ci-dessus
UPDATE pack_purchases SET credits_remaining = credits_remaining - 2 WHERE id = 'bbbb0001-0001-0001-0001-000000000001'; -- Ingrid: 7→5
UPDATE pack_purchases SET credits_remaining = credits_remaining - 2 WHERE id = 'bbbb0001-0001-0001-0001-000000000002'; -- Sophie: 18→16
UPDATE pack_purchases SET credits_remaining = credits_remaining - 2 WHERE id = 'bbbb0001-0001-0001-0001-000000000004'; -- Anouck: 15→13
UPDATE pack_purchases SET credits_remaining = credits_remaining - 1 WHERE id = 'bbbb0001-0001-0001-0001-000000000003'; -- Lucas: 3→2

-- ============================================
-- 7. PARRAINAGE : Ingrid a parrainé Sophie
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
-- RÉSUMÉ DES DONNÉES CRÉÉES
-- ============================================
-- 6 membres :
--   Ingrid   : frais OK, pack 10 semi-privé (5 crédits), 2 réservations
--   Sophie   : frais OK, pack 20 semi-privé (16 crédits), 2 réservations, filleule d'Ingrid
--   Lucas    : frais OK, pack 10 semi-privé (2 crédits, expire dans 10j), 1 réservation
--   Anouck   : frais OK, pack 20 semi-privé (13 crédits) + pack 10 PT (8 crédits), 2 réservations
--   Thomas   : frais NON payés, pas de pack (séance d'essai possible)
--   Simona   : frais OK, pack 10 PT (10 crédits), pas de réservation
--
-- 21 cours planifiés (2 semaines, lun-ven, salles haut/bas)
-- 7 réservations sur les cours de la semaine prochaine
-- 1 parrainage (Ingrid → Sophie, qualifié)

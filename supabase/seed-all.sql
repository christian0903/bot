-- ============================================
-- SEED COMPLET : Coaches + Types + Cours + Clients + Packs + Réservations
-- Exécuter APRÈS reset-test-data.sql
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
  ('aaa10001-0001-0001-0001-000000000001', 'Carte 3 séances', '4 semaines', 'b6f8eabb-467e-497a-8303-9c3dd9cacc30', 3, 6900, 28),
  ('aaa10001-0001-0001-0001-000000000002', 'Carte 10 séances', '3 mois', 'b6f8eabb-467e-497a-8303-9c3dd9cacc30', 10, 19900, 90),
  ('aaa10001-0001-0001-0001-000000000003', 'Carte 20 séances 3 mois', '3 mois', 'b6f8eabb-467e-497a-8303-9c3dd9cacc30', 20, 29900, 90),
  ('aaa10001-0001-0001-0001-000000000004', 'Carte 20 séances 5 mois', '5 mois', 'b6f8eabb-467e-497a-8303-9c3dd9cacc30', 20, 35900, 150),
  ('aaa10001-0001-0001-0001-000000000005', 'PT — 1 séance', NULL, '9b9511ef-37d7-4dca-8447-099021139df2', 1, 7500, 30),
  ('aaa10001-0001-0001-0001-000000000006', 'PT — 5 séances', NULL, '9b9511ef-37d7-4dca-8447-099021139df2', 5, 35000, 90),
  ('aaa10001-0001-0001-0001-000000000007', 'PT — 10 séances', NULL, '9b9511ef-37d7-4dca-8447-099021139df2', 10, 65000, 120),
  ('aaa10001-0001-0001-0001-000000000008', 'PT — 20 séances', NULL, '9b9511ef-37d7-4dca-8447-099021139df2', 20, 120000, 180)
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- 4. COACHES (admin + coach)
-- ============================================
INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, raw_user_meta_data, created_at, updated_at, instance_id, aud, role)
VALUES
  ('cccc0001-0001-0001-0001-000000000001', 'gauthier@backontrackstudio.be', crypt('Demo12345678!', gen_salt('bf')), NOW(), '{"display_name":"Gauthier Wilhelmi","first_name":"Gauthier","last_name":"Wilhelmi","phone":"+32 472 10 01 01","cgv_accepted":"true","rgpd_accepted":"true"}'::jsonb, NOW(), NOW(), '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated'),
  ('cccc0001-0001-0001-0001-000000000002', 'anselme@backontrackstudio.be', crypt('Demo12345678!', gen_salt('bf')), NOW(), '{"display_name":"Anselme Meunier","first_name":"Anselme","last_name":"Meunier","phone":"+32 472 10 02 02","cgv_accepted":"true","rgpd_accepted":"true"}'::jsonb, NOW(), NOW(), '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated'),
  ('cccc0001-0001-0001-0001-000000000003', 'joan@backontrackstudio.be', crypt('Demo12345678!', gen_salt('bf')), NOW(), '{"display_name":"Joan Rodon","first_name":"Joan","last_name":"Rodon","phone":"+32 472 10 03 03","cgv_accepted":"true","rgpd_accepted":"true"}'::jsonb, NOW(), NOW(), '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated')
ON CONFLICT (id) DO NOTHING;

SELECT pg_sleep(1);

INSERT INTO user_roles (user_id, role) VALUES
  ('cccc0001-0001-0001-0001-000000000001', 'coach'),
  ('cccc0001-0001-0001-0001-000000000002', 'coach'),
  ('cccc0001-0001-0001-0001-000000000003', 'coach'),
  ('cccc0001-0001-0001-0001-000000000001', 'admin'),
  ('cccc0001-0001-0001-0001-000000000002', 'admin'),
  ('cccc0001-0001-0001-0001-000000000003', 'admin')
ON CONFLICT (user_id, role) DO NOTHING;

UPDATE profiles SET member_status = 'active'
WHERE id IN ('cccc0001-0001-0001-0001-000000000001','cccc0001-0001-0001-0001-000000000002','cccc0001-0001-0001-0001-000000000003');

-- ============================================
-- 5. COURS PLANIFIÉS (13 avril → 13 mai 2026, lun-sam)
-- ============================================
DO $$
DECLARE
  v_coaches UUID[] := ARRAY[
    'cccc0001-0001-0001-0001-000000000001',
    'cccc0001-0001-0001-0001-000000000002',
    'cccc0001-0001-0001-0001-000000000003'
  ];
  v_class_ids UUID[] := ARRAY[
    'f5b1718d-174e-4557-82ae-a6cc9a115ba1',  -- CrossTraining
    '89788ddb-90a4-46f7-b468-566f5d13cc04',  -- BackOnTrack
    '391581f1-3df4-4546-8e2f-c4fd5c8fede0',  -- Posture
    '89a34a9b-c98f-46ca-ad5f-e7f7869ca218'   -- Ladies
  ];
  v_date DATE := '2026-04-13';
  v_end DATE := '2026-05-13';
  v_dow INTEGER;
  v_counter INTEGER := 0;
  v_floor TEXT;
BEGIN
  WHILE v_date <= v_end LOOP
    v_dow := EXTRACT(DOW FROM v_date)::INTEGER; -- 0=dim, 1=lun, ..., 6=sam

    -- Pas de cours le dimanche
    IF v_dow != 0 THEN
      v_counter := v_counter + 1;

      -- Cours du matin 8h30 (salle bas)
      INSERT INTO scheduled_classes (class_type_id, coach_id, starts_at, duration_minutes, max_participants, floor)
      VALUES (
        v_class_ids[1 + (v_counter % 4)],
        v_coaches[1 + (v_counter % 3)],
        v_date + TIME '08:30', 50, 4, 'bas'
      );

      -- Cours du midi 12h (lun-ven seulement, alternance salle)
      IF v_dow BETWEEN 1 AND 5 THEN
        v_floor := CASE WHEN v_counter % 2 = 0 THEN 'bas' ELSE 'haut' END;
        INSERT INTO scheduled_classes (class_type_id, coach_id, starts_at, duration_minutes, max_participants, floor)
        VALUES (
          v_class_ids[1 + ((v_counter + 1) % 4)],
          v_coaches[1 + ((v_counter + 1) % 3)],
          v_date + TIME '12:00', 50, 4, v_floor
        );
      END IF;

      -- Cours du soir 17h30 (lun-ven, salle bas)
      IF v_dow BETWEEN 1 AND 5 THEN
        INSERT INTO scheduled_classes (class_type_id, coach_id, starts_at, duration_minutes, max_participants, floor)
        VALUES (
          v_class_ids[1 + ((v_counter + 2) % 4)],
          v_coaches[1 + ((v_counter + 2) % 3)],
          v_date + TIME '17:30', 50, 4, 'bas'
        );
      END IF;

      -- 2e cours du soir 18h30 (lun, mer, ven → salle haut)
      IF v_dow IN (1, 3, 5) THEN
        INSERT INTO scheduled_classes (class_type_id, coach_id, starts_at, duration_minutes, max_participants, floor)
        VALUES (
          v_class_ids[1 + ((v_counter + 3) % 4)],
          v_coaches[1 + (v_counter % 3)],
          v_date + TIME '18:30', 50, 4, 'haut'
        );
      END IF;

      -- Samedi matin : 1 seul cours à 10h
      IF v_dow = 6 THEN
        INSERT INTO scheduled_classes (class_type_id, coach_id, starts_at, duration_minutes, max_participants, floor)
        VALUES (
          v_class_ids[1 + ((v_counter + 1) % 4)],
          v_coaches[1 + ((v_counter + 2) % 3)],
          v_date + TIME '10:00', 50, 4, 'bas'
        );
      END IF;
    END IF;

    v_date := v_date + 1;
  END LOOP;
END;
$$;

-- ============================================
-- 6. CLIENTS (7 membres)
-- ============================================
INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, raw_user_meta_data, created_at, updated_at, instance_id, aud, role)
VALUES
  ('aaaa0001-0001-0001-0001-000000000001', 'ingrid@demo.bot', crypt('Demo12345678!', gen_salt('bf')), NOW(), '{"display_name":"Ingrid Van Brussel","first_name":"Ingrid","last_name":"Van Brussel","phone":"+32 472 00 01 01","date_of_birth":"1990-03-15","address":"Rue du Midi 10, 1000 Bruxelles","cgv_accepted":"true","rgpd_accepted":"true"}'::jsonb, NOW(), NOW(), '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated'),
  ('aaaa0001-0001-0001-0001-000000000002', 'sophie@demo.bot', crypt('Demo12345678!', gen_salt('bf')), NOW(), '{"display_name":"Sophie Martin","first_name":"Sophie","last_name":"Martin","phone":"+32 472 00 02 02","date_of_birth":"1988-07-22","address":"Avenue Louise 150, 1050 Ixelles","cgv_accepted":"true","rgpd_accepted":"true"}'::jsonb, NOW(), NOW(), '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated'),
  ('aaaa0001-0001-0001-0001-000000000003', 'lucas@demo.bot', crypt('Demo12345678!', gen_salt('bf')), NOW(), '{"display_name":"Lucas Petit","first_name":"Lucas","last_name":"Petit","phone":"+32 472 00 03 03","date_of_birth":"1995-11-08","address":"Chaussée de Wavre 200, 1050 Ixelles","cgv_accepted":"true","rgpd_accepted":"true"}'::jsonb, NOW(), NOW(), '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated'),
  ('aaaa0001-0001-0001-0001-000000000004', 'anouck@demo.bot', crypt('Demo12345678!', gen_salt('bf')), NOW(), '{"display_name":"Anouck Renson","first_name":"Anouck","last_name":"Renson","phone":"+32 472 00 04 04","date_of_birth":"1992-01-30","address":"Rue Haute 50, 1000 Bruxelles","cgv_accepted":"true","rgpd_accepted":"true"}'::jsonb, NOW(), NOW(), '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated'),
  ('aaaa0001-0001-0001-0001-000000000005', 'thomas@demo.bot', crypt('Demo12345678!', gen_salt('bf')), NOW(), '{"display_name":"Thomas Dupont","first_name":"Thomas","last_name":"Dupont","phone":"+32 472 00 05 05","date_of_birth":"1998-05-12","address":"Boulevard Anspach 80, 1000 Bruxelles","cgv_accepted":"true","rgpd_accepted":"true"}'::jsonb, NOW(), NOW(), '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated'),
  ('aaaa0001-0001-0001-0001-000000000006', 'simona@demo.bot', crypt('Demo12345678!', gen_salt('bf')), NOW(), '{"display_name":"Simona Costamagna","first_name":"Simona","last_name":"Costamagna","phone":"+32 472 00 06 06","date_of_birth":"1985-09-25","address":"Rue de Namur 30, 1000 Bruxelles","cgv_accepted":"true","rgpd_accepted":"true"}'::jsonb, NOW(), NOW(), '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated'),
  ('aaaa0001-0001-0001-0001-000000000007', 'marie@demo.bot', crypt('Demo12345678!', gen_salt('bf')), NOW(), '{"display_name":"Marie Lecomte","first_name":"Marie","last_name":"Lecomte","phone":"+32 472 00 07 07","date_of_birth":"1993-06-18","address":"Rue de Flandre 25, 1000 Bruxelles","cgv_accepted":"true","rgpd_accepted":"true"}'::jsonb, NOW(), NOW(), '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated')
ON CONFLICT (id) DO NOTHING;

SELECT pg_sleep(1);

-- ============================================
-- 7. FRAIS D'INSCRIPTION (6 sur 7, Thomas non)
-- ============================================
INSERT INTO registration_fees (user_id, amount_cents) VALUES
  ('aaaa0001-0001-0001-0001-000000000001', 3000),
  ('aaaa0001-0001-0001-0001-000000000002', 3000),
  ('aaaa0001-0001-0001-0001-000000000003', 3000),
  ('aaaa0001-0001-0001-0001-000000000004', 3000),
  ('aaaa0001-0001-0001-0001-000000000006', 3000),
  ('aaaa0001-0001-0001-0001-000000000007', 3000);

-- ============================================
-- 8. PACKS
-- ============================================
INSERT INTO pack_purchases (id, user_id, pack_type_id, price_paid_cents, credits_remaining, purchased_at, expires_at) VALUES
  -- Ingrid : carte 10 séances, achetée le 5 avril, 7 crédits restants (3 utilisés)
  ('bbbb0001-0001-0001-0001-000000000001', 'aaaa0001-0001-0001-0001-000000000001', 'aaa10001-0001-0001-0001-000000000002', 19900, 7, '2026-04-05', '2026-07-04'),
  -- Sophie : carte 20 séances 3 mois, achetée le 10 avril, 15 crédits restants (5 utilisés)
  ('bbbb0001-0001-0001-0001-000000000002', 'aaaa0001-0001-0001-0001-000000000002', 'aaa10001-0001-0001-0001-000000000003', 29900, 15, '2026-04-10', '2026-07-09'),
  -- Lucas : carte 10 séances, expire bientôt, 2 crédits restants
  ('bbbb0001-0001-0001-0001-000000000003', 'aaaa0001-0001-0001-0001-000000000003', 'aaa10001-0001-0001-0001-000000000002', 19900, 2, '2026-02-01', '2026-05-01'),
  -- Anouck : carte 20 séances + PT 10 séances
  ('bbbb0001-0001-0001-0001-000000000004', 'aaaa0001-0001-0001-0001-000000000004', 'aaa10001-0001-0001-0001-000000000003', 29900, 13, '2026-04-01', '2026-06-30'),
  ('bbbb0001-0001-0001-0001-000000000005', 'aaaa0001-0001-0001-0001-000000000004', 'aaa10001-0001-0001-0001-000000000007', 65000, 8, '2026-04-15', '2026-08-13'),
  -- Simona : PT 10 séances
  ('bbbb0001-0001-0001-0001-000000000006', 'aaaa0001-0001-0001-0001-000000000006', 'aaa10001-0001-0001-0001-000000000007', 65000, 10, '2026-04-17', '2026-08-15'),
  -- Marie : carte 3 séances à 100€, ÉPUISÉE (0 crédits restants)
  ('bbbb0001-0001-0001-0001-000000000007', 'aaaa0001-0001-0001-0001-000000000007', 'aaa10001-0001-0001-0001-000000000001', 10000, 0, '2026-04-08', '2026-05-06');

-- ============================================
-- 9. SÉANCE D'ESSAI : Thomas a fait sa séance d'essai le 14 avril
-- ============================================
INSERT INTO trial_sessions (user_id, scheduled_class_id, created_at)
SELECT 'aaaa0001-0001-0001-0001-000000000005', sc.id, '2026-04-14 08:30:00'
FROM scheduled_classes sc
WHERE sc.starts_at::DATE = '2026-04-14' AND EXTRACT(HOUR FROM sc.starts_at) = 8
LIMIT 1;

-- ============================================
-- 10. STATUTS MEMBRES
-- ============================================
SELECT update_member_status('aaaa0001-0001-0001-0001-000000000001');
SELECT update_member_status('aaaa0001-0001-0001-0001-000000000002');
SELECT update_member_status('aaaa0001-0001-0001-0001-000000000003');
SELECT update_member_status('aaaa0001-0001-0001-0001-000000000004');
SELECT update_member_status('aaaa0001-0001-0001-0001-000000000005');
SELECT update_member_status('aaaa0001-0001-0001-0001-000000000006');
SELECT update_member_status('aaaa0001-0001-0001-0001-000000000007');

-- ============================================
-- 11. RÉSERVATIONS PASSÉES (13-19 avril, sur cours déjà passés)
-- ============================================

-- Ingrid a fait 3 cours la semaine du 14 avril (crédits déjà déduits dans le pack)
INSERT INTO bookings (scheduled_class_id, user_id, pack_purchase_id, checked_in_at)
SELECT sc.id, 'aaaa0001-0001-0001-0001-000000000001', 'bbbb0001-0001-0001-0001-000000000001', sc.starts_at + INTERVAL '5 minutes'
FROM scheduled_classes sc WHERE sc.starts_at::DATE = '2026-04-14' AND EXTRACT(HOUR FROM sc.starts_at) = 8 LIMIT 1;

INSERT INTO bookings (scheduled_class_id, user_id, pack_purchase_id, checked_in_at)
SELECT sc.id, 'aaaa0001-0001-0001-0001-000000000001', 'bbbb0001-0001-0001-0001-000000000001', sc.starts_at + INTERVAL '3 minutes'
FROM scheduled_classes sc WHERE sc.starts_at::DATE = '2026-04-16' AND EXTRACT(HOUR FROM sc.starts_at) = 8 LIMIT 1;

INSERT INTO bookings (scheduled_class_id, user_id, pack_purchase_id, checked_in_at)
SELECT sc.id, 'aaaa0001-0001-0001-0001-000000000001', 'bbbb0001-0001-0001-0001-000000000001', sc.starts_at + INTERVAL '2 minutes'
FROM scheduled_classes sc WHERE sc.starts_at::DATE = '2026-04-18' AND EXTRACT(HOUR FROM sc.starts_at) = 8 LIMIT 1;

-- Sophie a fait 5 cours entre le 13 et 19 avril
INSERT INTO bookings (scheduled_class_id, user_id, pack_purchase_id, checked_in_at)
SELECT sc.id, 'aaaa0001-0001-0001-0001-000000000002', 'bbbb0001-0001-0001-0001-000000000002', sc.starts_at + INTERVAL '4 minutes'
FROM scheduled_classes sc WHERE sc.starts_at::DATE = '2026-04-14' AND EXTRACT(HOUR FROM sc.starts_at) = 12 LIMIT 1;

INSERT INTO bookings (scheduled_class_id, user_id, pack_purchase_id, checked_in_at)
SELECT sc.id, 'aaaa0001-0001-0001-0001-000000000002', 'bbbb0001-0001-0001-0001-000000000002', sc.starts_at + INTERVAL '1 minute'
FROM scheduled_classes sc WHERE sc.starts_at::DATE = '2026-04-15' AND EXTRACT(HOUR FROM sc.starts_at) = 8 LIMIT 1;

INSERT INTO bookings (scheduled_class_id, user_id, pack_purchase_id, checked_in_at)
SELECT sc.id, 'aaaa0001-0001-0001-0001-000000000002', 'bbbb0001-0001-0001-0001-000000000002', sc.starts_at + INTERVAL '6 minutes'
FROM scheduled_classes sc WHERE sc.starts_at::DATE = '2026-04-16' AND EXTRACT(HOUR FROM sc.starts_at) = 17 LIMIT 1;

INSERT INTO bookings (scheduled_class_id, user_id, pack_purchase_id, checked_in_at)
SELECT sc.id, 'aaaa0001-0001-0001-0001-000000000002', 'bbbb0001-0001-0001-0001-000000000002', sc.starts_at + INTERVAL '2 minutes'
FROM scheduled_classes sc WHERE sc.starts_at::DATE = '2026-04-17' AND EXTRACT(HOUR FROM sc.starts_at) = 8 LIMIT 1;

INSERT INTO bookings (scheduled_class_id, user_id, pack_purchase_id, checked_in_at)
SELECT sc.id, 'aaaa0001-0001-0001-0001-000000000002', 'bbbb0001-0001-0001-0001-000000000002', sc.starts_at + INTERVAL '3 minutes'
FROM scheduled_classes sc WHERE sc.starts_at::DATE = '2026-04-18' AND EXTRACT(HOUR FROM sc.starts_at) = 12 LIMIT 1;

-- Marie a fait ses 3 cours (pack épuisé) les 14, 16 et 17 avril
INSERT INTO bookings (scheduled_class_id, user_id, pack_purchase_id, checked_in_at)
SELECT sc.id, 'aaaa0001-0001-0001-0001-000000000007', 'bbbb0001-0001-0001-0001-000000000007', sc.starts_at + INTERVAL '5 minutes'
FROM scheduled_classes sc WHERE sc.starts_at::DATE = '2026-04-14' AND EXTRACT(HOUR FROM sc.starts_at) = 17 LIMIT 1;

INSERT INTO bookings (scheduled_class_id, user_id, pack_purchase_id, checked_in_at)
SELECT sc.id, 'aaaa0001-0001-0001-0001-000000000007', 'bbbb0001-0001-0001-0001-000000000007', sc.starts_at + INTERVAL '4 minutes'
FROM scheduled_classes sc WHERE sc.starts_at::DATE = '2026-04-16' AND EXTRACT(HOUR FROM sc.starts_at) = 12 LIMIT 1;

INSERT INTO bookings (scheduled_class_id, user_id, pack_purchase_id, checked_in_at)
SELECT sc.id, 'aaaa0001-0001-0001-0001-000000000007', 'bbbb0001-0001-0001-0001-000000000007', sc.starts_at + INTERVAL '2 minutes'
FROM scheduled_classes sc WHERE sc.starts_at::DATE = '2026-04-17' AND EXTRACT(HOUR FROM sc.starts_at) = 17 LIMIT 1;

-- Anouck a fait 2 cours passés
INSERT INTO bookings (scheduled_class_id, user_id, pack_purchase_id, checked_in_at)
SELECT sc.id, 'aaaa0001-0001-0001-0001-000000000004', 'bbbb0001-0001-0001-0001-000000000004', sc.starts_at + INTERVAL '3 minutes'
FROM scheduled_classes sc WHERE sc.starts_at::DATE = '2026-04-15' AND EXTRACT(HOUR FROM sc.starts_at) = 17 LIMIT 1;

INSERT INTO bookings (scheduled_class_id, user_id, pack_purchase_id, checked_in_at)
SELECT sc.id, 'aaaa0001-0001-0001-0001-000000000004', 'bbbb0001-0001-0001-0001-000000000004', sc.starts_at + INTERVAL '1 minute'
FROM scheduled_classes sc WHERE sc.starts_at::DATE = '2026-04-17' AND EXTRACT(HOUR FROM sc.starts_at) = 12 LIMIT 1;

-- ============================================
-- 12. RÉSERVATIONS FUTURES (cours à venir)
-- ============================================

-- Ingrid : 2 cours futurs
INSERT INTO bookings (scheduled_class_id, user_id, pack_purchase_id)
SELECT sc.id, 'aaaa0001-0001-0001-0001-000000000001', 'bbbb0001-0001-0001-0001-000000000001'
FROM scheduled_classes sc WHERE sc.starts_at > NOW() ORDER BY sc.starts_at LIMIT 1;

INSERT INTO bookings (scheduled_class_id, user_id, pack_purchase_id)
SELECT sc.id, 'aaaa0001-0001-0001-0001-000000000001', 'bbbb0001-0001-0001-0001-000000000001'
FROM scheduled_classes sc WHERE sc.starts_at > NOW() ORDER BY sc.starts_at OFFSET 4 LIMIT 1;

-- Sophie : 2 cours futurs
INSERT INTO bookings (scheduled_class_id, user_id, pack_purchase_id)
SELECT sc.id, 'aaaa0001-0001-0001-0001-000000000002', 'bbbb0001-0001-0001-0001-000000000002'
FROM scheduled_classes sc WHERE sc.starts_at > NOW() ORDER BY sc.starts_at OFFSET 1 LIMIT 1;

INSERT INTO bookings (scheduled_class_id, user_id, pack_purchase_id)
SELECT sc.id, 'aaaa0001-0001-0001-0001-000000000002', 'bbbb0001-0001-0001-0001-000000000002'
FROM scheduled_classes sc WHERE sc.starts_at > NOW() ORDER BY sc.starts_at OFFSET 6 LIMIT 1;

-- Lucas : 1 cours futur
INSERT INTO bookings (scheduled_class_id, user_id, pack_purchase_id)
SELECT sc.id, 'aaaa0001-0001-0001-0001-000000000003', 'bbbb0001-0001-0001-0001-000000000003'
FROM scheduled_classes sc WHERE sc.starts_at > NOW() ORDER BY sc.starts_at OFFSET 2 LIMIT 1;

-- Anouck : 2 cours futurs
INSERT INTO bookings (scheduled_class_id, user_id, pack_purchase_id)
SELECT sc.id, 'aaaa0001-0001-0001-0001-000000000004', 'bbbb0001-0001-0001-0001-000000000004'
FROM scheduled_classes sc WHERE sc.starts_at > NOW() ORDER BY sc.starts_at OFFSET 3 LIMIT 1;

INSERT INTO bookings (scheduled_class_id, user_id, pack_purchase_id)
SELECT sc.id, 'aaaa0001-0001-0001-0001-000000000004', 'bbbb0001-0001-0001-0001-000000000004'
FROM scheduled_classes sc WHERE sc.starts_at > NOW() ORDER BY sc.starts_at OFFSET 8 LIMIT 1;

-- Déduire les crédits des réservations futures
UPDATE pack_purchases SET credits_remaining = credits_remaining - 2 WHERE id = 'bbbb0001-0001-0001-0001-000000000001'; -- Ingrid: 7→5
UPDATE pack_purchases SET credits_remaining = credits_remaining - 2 WHERE id = 'bbbb0001-0001-0001-0001-000000000002'; -- Sophie: 15→13
UPDATE pack_purchases SET credits_remaining = credits_remaining - 1 WHERE id = 'bbbb0001-0001-0001-0001-000000000003'; -- Lucas: 2→1
UPDATE pack_purchases SET credits_remaining = credits_remaining - 2 WHERE id = 'bbbb0001-0001-0001-0001-000000000004'; -- Anouck: 13→11

-- ============================================
-- 13. PARRAINAGES
-- ============================================

-- Ingrid a parrainé Sophie (qualifié)
INSERT INTO referrals (referrer_id, referee_id, referral_code, status, qualified_at)
VALUES (
  'aaaa0001-0001-0001-0001-000000000001',
  'aaaa0001-0001-0001-0001-000000000002',
  (SELECT referral_code FROM profiles WHERE id = 'aaaa0001-0001-0001-0001-000000000001'),
  'qualified', '2026-04-12'
);

-- Anouck a parrainé Lucas (en attente)
INSERT INTO referrals (referrer_id, referee_id, referral_code, status)
VALUES (
  'aaaa0001-0001-0001-0001-000000000004',
  'aaaa0001-0001-0001-0001-000000000003',
  (SELECT referral_code FROM profiles WHERE id = 'aaaa0001-0001-0001-0001-000000000004'),
  'pending'
);

-- ============================================
-- RÉSUMÉ
-- ============================================
-- 3 coaches (admin) : Gauthier, Anselme, Joan — rotation sur les cours
-- 5 types de cours : CrossTraining, BackOnTrack, Posture, Ladies, Événement
-- 8 types de packs : 4 semi-privé + 4 PT
-- ~120 cours du 13 avril au 13 mai 2026 (lun-sam)
--
-- 7 clients (mot de passe : Demo12345678!) :
--   Ingrid   : frais OK, 10 semi-privé (5cr), 3 cours passés + 2 futurs, parraine Sophie
--   Sophie   : frais OK, 20 semi-privé (13cr), 5 cours passés + 2 futurs, filleule d'Ingrid
--   Lucas    : frais OK, 10 semi-privé (1cr, expire 1er mai), 1 futur, parrainé par Anouck
--   Anouck   : frais OK, 20 semi-privé (11cr) + 10 PT (8cr), 2 passés + 2 futurs
--   Thomas   : frais NON payés, a fait sa séance d'essai le 14 avril
--   Simona   : frais OK, 10 PT (10cr), 0 réservation
--   Marie    : frais OK, carte 3 séances 100€ ÉPUISÉE (3 cours faits les 14-17 avril)
--
-- 2 parrainages : Ingrid→Sophie (qualifié), Anouck→Lucas (en attente)

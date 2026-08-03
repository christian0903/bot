-- ============================================
-- SEED DEMO PART 2 : Cours + Réservations
-- Exécuter APRÈS le script import-demo.ts
-- ============================================

-- ============================================
-- 1. COURS (13 avril → 13 mai 2026, lun-sam)
-- Les coaches sont récupérés dynamiquement depuis la base
-- ============================================
DO $$
DECLARE
  v_coaches UUID[];
  v_class_ids UUID[] := ARRAY[
    'f5b1718d-174e-4557-82ae-a6cc9a115ba1',
    '89788ddb-90a4-46f7-b468-566f5d13cc04',
    '391581f1-3df4-4546-8e2f-c4fd5c8fede0',
    '89a34a9b-c98f-46ca-ad5f-e7f7869ca218'
  ];
  v_date DATE := '2026-04-13';
  v_end DATE := '2026-05-13';
  v_dow INTEGER;
  v_counter INTEGER := 0;
  v_floor TEXT;
BEGIN
  SELECT ARRAY_AGG(user_id) INTO v_coaches FROM user_roles WHERE role = 'coach';
  WHILE v_date <= v_end LOOP
    v_dow := EXTRACT(DOW FROM v_date)::INTEGER;
    IF v_dow != 0 THEN
      v_counter := v_counter + 1;
      INSERT INTO scheduled_classes (class_type_id, coach_id, starts_at, duration_minutes, max_participants, floor)
      VALUES (v_class_ids[1 + (v_counter % 4)], v_coaches[1 + (v_counter % array_length(v_coaches, 1))], v_date + TIME '08:30', 50, 4, 'bas');
      IF v_dow BETWEEN 1 AND 5 THEN
        v_floor := CASE WHEN v_counter % 2 = 0 THEN 'bas' ELSE 'haut' END;
        INSERT INTO scheduled_classes (class_type_id, coach_id, starts_at, duration_minutes, max_participants, floor)
        VALUES (v_class_ids[1 + ((v_counter+1) % 4)], v_coaches[1 + ((v_counter+1) % array_length(v_coaches, 1))], v_date + TIME '12:00', 50, 4, v_floor);
        INSERT INTO scheduled_classes (class_type_id, coach_id, starts_at, duration_minutes, max_participants, floor)
        VALUES (v_class_ids[1 + ((v_counter+2) % 4)], v_coaches[1 + ((v_counter+2) % array_length(v_coaches, 1))], v_date + TIME '17:30', 50, 4, 'bas');
      END IF;
      IF v_dow IN (1, 3, 5) THEN
        INSERT INTO scheduled_classes (class_type_id, coach_id, starts_at, duration_minutes, max_participants, floor)
        VALUES (v_class_ids[1 + ((v_counter+3) % 4)], v_coaches[1 + (v_counter % array_length(v_coaches, 1))], v_date + TIME '18:30', 50, 4, 'haut');
      END IF;
      IF v_dow = 6 THEN
        INSERT INTO scheduled_classes (class_type_id, coach_id, starts_at, duration_minutes, max_participants, floor)
        VALUES (v_class_ids[1 + ((v_counter+1) % 4)], v_coaches[1 + ((v_counter+2) % array_length(v_coaches, 1))], v_date + TIME '10:00', 50, 4, 'bas');
      END IF;
    END IF;
    v_date := v_date + 1;
  END LOOP;
END;
$$;

-- ============================================
-- 2. RÉSERVATIONS PASSÉES (avec check-in)
-- Les user_id sont récupérés dynamiquement par email
-- ============================================

-- Ingrid : 3 cours passés (14, 16, 18 avril)
INSERT INTO bookings (scheduled_class_id, user_id, pack_purchase_id, checked_in_at)
SELECT sc.id,
  (SELECT id FROM profiles WHERE email = 'ingrid@demo.bot'),
  (SELECT id FROM pack_purchases WHERE user_id = (SELECT id FROM profiles WHERE email = 'ingrid@demo.bot') LIMIT 1),
  sc.starts_at + INTERVAL '5 minutes'
FROM scheduled_classes sc WHERE sc.starts_at::DATE = '2026-04-14' AND EXTRACT(HOUR FROM sc.starts_at) = 8 LIMIT 1;

INSERT INTO bookings (scheduled_class_id, user_id, pack_purchase_id, checked_in_at)
SELECT sc.id,
  (SELECT id FROM profiles WHERE email = 'ingrid@demo.bot'),
  (SELECT id FROM pack_purchases WHERE user_id = (SELECT id FROM profiles WHERE email = 'ingrid@demo.bot') LIMIT 1),
  sc.starts_at + INTERVAL '3 minutes'
FROM scheduled_classes sc WHERE sc.starts_at::DATE = '2026-04-16' AND EXTRACT(HOUR FROM sc.starts_at) = 8 LIMIT 1;

INSERT INTO bookings (scheduled_class_id, user_id, pack_purchase_id, checked_in_at)
SELECT sc.id,
  (SELECT id FROM profiles WHERE email = 'ingrid@demo.bot'),
  (SELECT id FROM pack_purchases WHERE user_id = (SELECT id FROM profiles WHERE email = 'ingrid@demo.bot') LIMIT 1),
  sc.starts_at + INTERVAL '2 minutes'
FROM scheduled_classes sc WHERE sc.starts_at::DATE = '2026-04-18' AND EXTRACT(HOUR FROM sc.starts_at) = 8 LIMIT 1;

-- Sophie : 5 cours passés (14-18 avril)
INSERT INTO bookings (scheduled_class_id, user_id, pack_purchase_id, checked_in_at)
SELECT sc.id,
  (SELECT id FROM profiles WHERE email = 'sophie@demo.bot'),
  (SELECT id FROM pack_purchases WHERE user_id = (SELECT id FROM profiles WHERE email = 'sophie@demo.bot') LIMIT 1),
  sc.starts_at + INTERVAL '4 minutes'
FROM scheduled_classes sc WHERE sc.starts_at::DATE = '2026-04-14' AND EXTRACT(HOUR FROM sc.starts_at) = 12 LIMIT 1;

INSERT INTO bookings (scheduled_class_id, user_id, pack_purchase_id, checked_in_at)
SELECT sc.id,
  (SELECT id FROM profiles WHERE email = 'sophie@demo.bot'),
  (SELECT id FROM pack_purchases WHERE user_id = (SELECT id FROM profiles WHERE email = 'sophie@demo.bot') LIMIT 1),
  sc.starts_at + INTERVAL '1 minute'
FROM scheduled_classes sc WHERE sc.starts_at::DATE = '2026-04-15' AND EXTRACT(HOUR FROM sc.starts_at) = 8 LIMIT 1;

INSERT INTO bookings (scheduled_class_id, user_id, pack_purchase_id, checked_in_at)
SELECT sc.id,
  (SELECT id FROM profiles WHERE email = 'sophie@demo.bot'),
  (SELECT id FROM pack_purchases WHERE user_id = (SELECT id FROM profiles WHERE email = 'sophie@demo.bot') LIMIT 1),
  sc.starts_at + INTERVAL '6 minutes'
FROM scheduled_classes sc WHERE sc.starts_at::DATE = '2026-04-16' AND EXTRACT(HOUR FROM sc.starts_at) = 17 LIMIT 1;

INSERT INTO bookings (scheduled_class_id, user_id, pack_purchase_id, checked_in_at)
SELECT sc.id,
  (SELECT id FROM profiles WHERE email = 'sophie@demo.bot'),
  (SELECT id FROM pack_purchases WHERE user_id = (SELECT id FROM profiles WHERE email = 'sophie@demo.bot') LIMIT 1),
  sc.starts_at + INTERVAL '2 minutes'
FROM scheduled_classes sc WHERE sc.starts_at::DATE = '2026-04-17' AND EXTRACT(HOUR FROM sc.starts_at) = 8 LIMIT 1;

INSERT INTO bookings (scheduled_class_id, user_id, pack_purchase_id, checked_in_at)
SELECT sc.id,
  (SELECT id FROM profiles WHERE email = 'sophie@demo.bot'),
  (SELECT id FROM pack_purchases WHERE user_id = (SELECT id FROM profiles WHERE email = 'sophie@demo.bot') LIMIT 1),
  sc.starts_at + INTERVAL '3 minutes'
FROM scheduled_classes sc WHERE sc.starts_at::DATE = '2026-04-18' AND EXTRACT(HOUR FROM sc.starts_at) = 12 LIMIT 1;

-- Marie : 3 cours passés (14, 16, 17 avril — pack épuisé)
INSERT INTO bookings (scheduled_class_id, user_id, pack_purchase_id, checked_in_at)
SELECT sc.id,
  (SELECT id FROM profiles WHERE email = 'marie@demo.bot'),
  (SELECT id FROM pack_purchases WHERE user_id = (SELECT id FROM profiles WHERE email = 'marie@demo.bot') LIMIT 1),
  sc.starts_at + INTERVAL '5 minutes'
FROM scheduled_classes sc WHERE sc.starts_at::DATE = '2026-04-14' AND EXTRACT(HOUR FROM sc.starts_at) = 17 LIMIT 1;

INSERT INTO bookings (scheduled_class_id, user_id, pack_purchase_id, checked_in_at)
SELECT sc.id,
  (SELECT id FROM profiles WHERE email = 'marie@demo.bot'),
  (SELECT id FROM pack_purchases WHERE user_id = (SELECT id FROM profiles WHERE email = 'marie@demo.bot') LIMIT 1),
  sc.starts_at + INTERVAL '4 minutes'
FROM scheduled_classes sc WHERE sc.starts_at::DATE = '2026-04-16' AND EXTRACT(HOUR FROM sc.starts_at) = 12 LIMIT 1;

INSERT INTO bookings (scheduled_class_id, user_id, pack_purchase_id, checked_in_at)
SELECT sc.id,
  (SELECT id FROM profiles WHERE email = 'marie@demo.bot'),
  (SELECT id FROM pack_purchases WHERE user_id = (SELECT id FROM profiles WHERE email = 'marie@demo.bot') LIMIT 1),
  sc.starts_at + INTERVAL '2 minutes'
FROM scheduled_classes sc WHERE sc.starts_at::DATE = '2026-04-17' AND EXTRACT(HOUR FROM sc.starts_at) = 17 LIMIT 1;

-- Anouck : 2 cours passés (15, 17 avril)
INSERT INTO bookings (scheduled_class_id, user_id, pack_purchase_id, checked_in_at)
SELECT sc.id,
  (SELECT id FROM profiles WHERE email = 'anouck@demo.bot'),
  (SELECT pp.id FROM pack_purchases pp JOIN pack_types pt ON pp.pack_type_id = pt.id JOIN credit_types ct ON pt.credit_type_id = ct.id WHERE pp.user_id = (SELECT id FROM profiles WHERE email = 'anouck@demo.bot') AND ct.name = 'semi_prive' LIMIT 1),
  sc.starts_at + INTERVAL '3 minutes'
FROM scheduled_classes sc WHERE sc.starts_at::DATE = '2026-04-15' AND EXTRACT(HOUR FROM sc.starts_at) = 17 LIMIT 1;

INSERT INTO bookings (scheduled_class_id, user_id, pack_purchase_id, checked_in_at)
SELECT sc.id,
  (SELECT id FROM profiles WHERE email = 'anouck@demo.bot'),
  (SELECT pp.id FROM pack_purchases pp JOIN pack_types pt ON pp.pack_type_id = pt.id JOIN credit_types ct ON pt.credit_type_id = ct.id WHERE pp.user_id = (SELECT id FROM profiles WHERE email = 'anouck@demo.bot') AND ct.name = 'semi_prive' LIMIT 1),
  sc.starts_at + INTERVAL '1 minute'
FROM scheduled_classes sc WHERE sc.starts_at::DATE = '2026-04-17' AND EXTRACT(HOUR FROM sc.starts_at) = 12 LIMIT 1;

-- ============================================
-- 3. RÉSERVATIONS FUTURES
-- ============================================

-- Ingrid : 2 cours futurs
INSERT INTO bookings (scheduled_class_id, user_id, pack_purchase_id)
SELECT sc.id,
  (SELECT id FROM profiles WHERE email = 'ingrid@demo.bot'),
  (SELECT id FROM pack_purchases WHERE user_id = (SELECT id FROM profiles WHERE email = 'ingrid@demo.bot') AND credits_remaining > 0 ORDER BY expires_at LIMIT 1)
FROM scheduled_classes sc WHERE sc.starts_at > NOW() ORDER BY sc.starts_at LIMIT 1;

INSERT INTO bookings (scheduled_class_id, user_id, pack_purchase_id)
SELECT sc.id,
  (SELECT id FROM profiles WHERE email = 'ingrid@demo.bot'),
  (SELECT id FROM pack_purchases WHERE user_id = (SELECT id FROM profiles WHERE email = 'ingrid@demo.bot') AND credits_remaining > 0 ORDER BY expires_at LIMIT 1)
FROM scheduled_classes sc WHERE sc.starts_at > NOW() ORDER BY sc.starts_at OFFSET 4 LIMIT 1;

-- Sophie : 2 cours futurs
INSERT INTO bookings (scheduled_class_id, user_id, pack_purchase_id)
SELECT sc.id,
  (SELECT id FROM profiles WHERE email = 'sophie@demo.bot'),
  (SELECT id FROM pack_purchases WHERE user_id = (SELECT id FROM profiles WHERE email = 'sophie@demo.bot') AND credits_remaining > 0 ORDER BY expires_at LIMIT 1)
FROM scheduled_classes sc WHERE sc.starts_at > NOW() ORDER BY sc.starts_at OFFSET 1 LIMIT 1;

INSERT INTO bookings (scheduled_class_id, user_id, pack_purchase_id)
SELECT sc.id,
  (SELECT id FROM profiles WHERE email = 'sophie@demo.bot'),
  (SELECT id FROM pack_purchases WHERE user_id = (SELECT id FROM profiles WHERE email = 'sophie@demo.bot') AND credits_remaining > 0 ORDER BY expires_at LIMIT 1)
FROM scheduled_classes sc WHERE sc.starts_at > NOW() ORDER BY sc.starts_at OFFSET 6 LIMIT 1;

-- Lucas : 1 cours futur
INSERT INTO bookings (scheduled_class_id, user_id, pack_purchase_id)
SELECT sc.id,
  (SELECT id FROM profiles WHERE email = 'lucas@demo.bot'),
  (SELECT id FROM pack_purchases WHERE user_id = (SELECT id FROM profiles WHERE email = 'lucas@demo.bot') AND credits_remaining > 0 ORDER BY expires_at LIMIT 1)
FROM scheduled_classes sc WHERE sc.starts_at > NOW() ORDER BY sc.starts_at OFFSET 2 LIMIT 1;

-- Anouck : 2 cours futurs
INSERT INTO bookings (scheduled_class_id, user_id, pack_purchase_id)
SELECT sc.id,
  (SELECT id FROM profiles WHERE email = 'anouck@demo.bot'),
  (SELECT pp.id FROM pack_purchases pp JOIN pack_types pt ON pp.pack_type_id = pt.id JOIN credit_types ct ON pt.credit_type_id = ct.id WHERE pp.user_id = (SELECT id FROM profiles WHERE email = 'anouck@demo.bot') AND ct.name = 'semi_prive' AND pp.credits_remaining > 0 ORDER BY pp.expires_at LIMIT 1)
FROM scheduled_classes sc WHERE sc.starts_at > NOW() ORDER BY sc.starts_at OFFSET 3 LIMIT 1;

INSERT INTO bookings (scheduled_class_id, user_id, pack_purchase_id)
SELECT sc.id,
  (SELECT id FROM profiles WHERE email = 'anouck@demo.bot'),
  (SELECT pp.id FROM pack_purchases pp JOIN pack_types pt ON pp.pack_type_id = pt.id JOIN credit_types ct ON pt.credit_type_id = ct.id WHERE pp.user_id = (SELECT id FROM profiles WHERE email = 'anouck@demo.bot') AND ct.name = 'semi_prive' AND pp.credits_remaining > 0 ORDER BY pp.expires_at LIMIT 1)
FROM scheduled_classes sc WHERE sc.starts_at > NOW() ORDER BY sc.starts_at OFFSET 8 LIMIT 1;

-- ============================================
-- 4. DÉDUIRE LES CRÉDITS DES RÉSERVATIONS FUTURES
-- (Les crédits des réservations passées sont déjà déduits dans import-demo.ts)
-- ============================================
UPDATE pack_purchases SET credits_remaining = credits_remaining - 2
WHERE user_id = (SELECT id FROM profiles WHERE email = 'ingrid@demo.bot') AND credits_remaining > 0;

UPDATE pack_purchases SET credits_remaining = credits_remaining - 2
WHERE user_id = (SELECT id FROM profiles WHERE email = 'sophie@demo.bot') AND credits_remaining > 0
AND pack_type_id = 'aaa10001-0001-0001-0001-000000000003';

UPDATE pack_purchases SET credits_remaining = credits_remaining - 1
WHERE user_id = (SELECT id FROM profiles WHERE email = 'lucas@demo.bot') AND credits_remaining > 0;

UPDATE pack_purchases SET credits_remaining = credits_remaining - 2
WHERE user_id = (SELECT id FROM profiles WHERE email = 'anouck@demo.bot') AND credits_remaining > 0
AND pack_type_id = 'aaa10001-0001-0001-0001-000000000003';

-- ============================================
-- RÉSUMÉ DES RÉSERVATIONS
-- ============================================
-- Ingrid  : 3 passés (check-in) + 2 futurs = 5 crédits utilisés → reste 5
-- Sophie  : 5 passés (check-in) + 2 futurs = 7 crédits utilisés → reste 13
-- Marie   : 3 passés (check-in) + 0 futur  = 3 crédits utilisés → reste 0 (épuisé)
-- Anouck  : 2 passés (check-in) + 2 futurs = 4 crédits semi utilisés → reste 11
-- Lucas   : 0 passé + 1 futur = 1 crédit utilisé → reste 1 (expire bientôt)
-- Thomas  : 0 (séance d'essai seulement)
-- Simona  : 0 (PT, pas de cours semi-privé réservé)

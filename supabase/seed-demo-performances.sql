-- Demo seed for the performance tracking feature.
-- Idempotent: clears existing demo data for these users before reseeding.
-- Run AFTER the perf tables exist (migration 20260511_performances.sql).

BEGIN;

-- Drop previously seeded demo performances for the test users
DELETE FROM performances
WHERE user_id IN (
  SELECT id FROM profiles WHERE email IN ('ingrid@demo.bot', 'thomas@demo.bot', 'marie@demo.bot')
);

-- ============================================
-- 1. Performance types (catalog)
-- ============================================
INSERT INTO performance_types (name, unit_hint, color, display_order)
SELECT v.name, v.unit_hint, v.color, v.display_order
FROM (VALUES
  ('Rameur 500m',  's',   '#ef4444', 10),
  ('Ski Erg 500m', 's',   '#3b82f6', 20),
  ('Bike Erg 1km', 's',   '#10b981', 30),
  ('Squat',        'kg',  '#a855f7', 40),
  ('Développé couché', 'kg', '#f59e0b', 50)
) AS v(name, unit_hint, color, display_order)
WHERE NOT EXISTS (
  SELECT 1 FROM performance_types pt WHERE pt.name = v.name
);

-- ============================================
-- 2. Performances for ingrid@demo.bot
-- ============================================
-- Pattern: progressive improvement on rower/ski (time decreasing),
-- progressive overload on lifts (weight increasing).
INSERT INTO performances (user_id, performance_type_id, date, value, notes, created_by)
SELECT
  u.id, pt.id, d.date::date, d.value, d.notes, u.id
FROM
  (SELECT id FROM profiles WHERE email = 'ingrid@demo.bot') u
  CROSS JOIN LATERAL (
    VALUES
      -- Rameur 500m (seconds, lower is better but stored as raw)
      ('Rameur 500m',  CURRENT_DATE - 35, '1:58', 'Échauffement tranquille'),
      ('Rameur 500m',  CURRENT_DATE - 28, '1:54', NULL),
      ('Rameur 500m',  CURRENT_DATE - 21, '1:52', 'Sensations OK'),
      ('Rameur 500m',  CURRENT_DATE - 14, '1:49', NULL),
      ('Rameur 500m',  CURRENT_DATE - 7,  '1:47', 'Nouveau record perso !'),
      ('Rameur 500m',  CURRENT_DATE - 2,  '1:48', NULL),

      -- Ski Erg
      ('Ski Erg 500m', CURRENT_DATE - 30, '2:10', NULL),
      ('Ski Erg 500m', CURRENT_DATE - 16, '2:05', NULL),
      ('Ski Erg 500m', CURRENT_DATE - 3,  '2:01', 'Progression nette'),

      -- Squat (kg)
      ('Squat',        CURRENT_DATE - 28, '60 kg',  '5x5'),
      ('Squat',        CURRENT_DATE - 21, '62.5 kg', '5x5'),
      ('Squat',        CURRENT_DATE - 14, '65 kg',  '5x5'),
      ('Squat',        CURRENT_DATE - 7,  '67.5 kg', '5x5'),
      ('Squat',        CURRENT_DATE - 1,  '70 kg',  '5x5 - costaud'),

      -- Développé couché (kg)
      ('Développé couché', CURRENT_DATE - 25, '40 kg', NULL),
      ('Développé couché', CURRENT_DATE - 18, '42.5 kg', NULL),
      ('Développé couché', CURRENT_DATE - 11, '45 kg', '5x5'),
      ('Développé couché', CURRENT_DATE - 4,  '45 kg', 'Stagnation, repos demain')
  ) AS d(type_name, date, value, notes)
  JOIN performance_types pt ON pt.name = d.type_name;

-- ============================================
-- 3. Performances for thomas@demo.bot
-- ============================================
-- Pattern: focused on Bike Erg + heavier lifts, less consistent.
INSERT INTO performances (user_id, performance_type_id, date, value, notes, created_by)
SELECT
  u.id, pt.id, d.date::date, d.value, d.notes, u.id
FROM
  (SELECT id FROM profiles WHERE email = 'thomas@demo.bot') u
  CROSS JOIN LATERAL (
    VALUES
      -- Bike Erg 1km
      ('Bike Erg 1km', CURRENT_DATE - 32, '1:42', NULL),
      ('Bike Erg 1km', CURRENT_DATE - 25, '1:38', NULL),
      ('Bike Erg 1km', CURRENT_DATE - 18, '1:35', 'Sprint final propre'),
      ('Bike Erg 1km', CURRENT_DATE - 11, '1:34', NULL),
      ('Bike Erg 1km', CURRENT_DATE - 4,  '1:32', 'PR !'),

      -- Rameur 500m
      ('Rameur 500m',  CURRENT_DATE - 27, '1:42', NULL),
      ('Rameur 500m',  CURRENT_DATE - 13, '1:39', NULL),
      ('Rameur 500m',  CURRENT_DATE - 5,  '1:37', NULL),

      -- Squat lourd
      ('Squat',        CURRENT_DATE - 30, '100 kg', '3x5'),
      ('Squat',        CURRENT_DATE - 23, '105 kg', '3x5'),
      ('Squat',        CURRENT_DATE - 16, '110 kg', '3x5'),
      ('Squat',        CURRENT_DATE - 9,  '115 kg', '3x5'),
      ('Squat',        CURRENT_DATE - 2,  '120 kg', '3x5 — gros effort'),

      -- Développé couché
      ('Développé couché', CURRENT_DATE - 28, '70 kg', NULL),
      ('Développé couché', CURRENT_DATE - 14, '75 kg', NULL),
      ('Développé couché', CURRENT_DATE - 1,  '77.5 kg', 'Nouveau max')
  ) AS d(type_name, date, value, notes)
  JOIN performance_types pt ON pt.name = d.type_name;

-- ============================================
-- 4. Performances for marie@demo.bot
-- ============================================
-- Pattern: regular cardio (rowing, bike), moderate strength.
INSERT INTO performances (user_id, performance_type_id, date, value, notes, created_by)
SELECT
  u.id, pt.id, d.date::date, d.value, d.notes, u.id
FROM
  (SELECT id FROM profiles WHERE email = 'marie@demo.bot') u
  CROSS JOIN LATERAL (
    VALUES
      -- Rameur 500m : très régulier
      ('Rameur 500m',  CURRENT_DATE - 40, '2:08', 'Reprise après pause'),
      ('Rameur 500m',  CURRENT_DATE - 33, '2:04', NULL),
      ('Rameur 500m',  CURRENT_DATE - 26, '2:02', NULL),
      ('Rameur 500m',  CURRENT_DATE - 20, '2:00', 'Premier sub-2 !'),
      ('Rameur 500m',  CURRENT_DATE - 13, '1:58', NULL),
      ('Rameur 500m',  CURRENT_DATE - 6,  '1:56', 'Progression linéaire'),

      -- Ski Erg : occasionnel
      ('Ski Erg 500m', CURRENT_DATE - 24, '2:18', 'Premier essai'),
      ('Ski Erg 500m', CURRENT_DATE - 10, '2:12', NULL),

      -- Bike Erg : son préféré
      ('Bike Erg 1km', CURRENT_DATE - 35, '1:55', NULL),
      ('Bike Erg 1km', CURRENT_DATE - 28, '1:51', NULL),
      ('Bike Erg 1km', CURRENT_DATE - 21, '1:48', NULL),
      ('Bike Erg 1km', CURRENT_DATE - 14, '1:46', 'Très bonne séance'),
      ('Bike Erg 1km', CURRENT_DATE - 7,  '1:44', NULL),

      -- Squat : volume modéré
      ('Squat',        CURRENT_DATE - 30, '40 kg',  '5x8'),
      ('Squat',        CURRENT_DATE - 16, '45 kg',  '5x8'),
      ('Squat',        CURRENT_DATE - 2,  '50 kg',  '5x8 - solide'),

      -- Développé couché
      ('Développé couché', CURRENT_DATE - 22, '25 kg', NULL),
      ('Développé couché', CURRENT_DATE - 8,  '27.5 kg', '5x5')
  ) AS d(type_name, date, value, notes)
  JOIN performance_types pt ON pt.name = d.type_name;

COMMIT;

-- Recap
SELECT
  p.email AS user,
  pt.name AS type,
  COUNT(*) AS entries,
  MIN(pf.date) AS first,
  MAX(pf.date) AS last
FROM performances pf
JOIN profiles p ON p.id = pf.user_id
JOIN performance_types pt ON pt.id = pf.performance_type_id
WHERE p.email IN ('ingrid@demo.bot', 'thomas@demo.bot', 'marie@demo.bot')
GROUP BY p.email, pt.name, pt.display_order
ORDER BY p.email, pt.display_order;

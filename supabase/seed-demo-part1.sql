-- ============================================
-- SEED DEMO PART 1 : Types + Cours
-- Exécuter AVANT le script import-demo.ts
-- ============================================

-- 1. TYPES DE CRÉDITS
INSERT INTO credit_types (id, name, label_fr, label_en) VALUES
  ('b6f8eabb-467e-497a-8303-9c3dd9cacc30', 'semi_prive', 'Semi-privé', 'Semi-private'),
  ('9b9511ef-37d7-4dca-8447-099021139df2', 'personal_training', 'Personal Training', 'Personal Training')
ON CONFLICT (id) DO NOTHING;

-- 2. TYPES DE COURS
INSERT INTO class_types (id, name, credit_type_id, default_max_participants, color) VALUES
  ('f5b1718d-174e-4557-82ae-a6cc9a115ba1', 'CrossTraining', 'b6f8eabb-467e-497a-8303-9c3dd9cacc30', 4, '#EF4444'),
  ('89788ddb-90a4-46f7-b468-566f5d13cc04', 'BackOnTrack', 'b6f8eabb-467e-497a-8303-9c3dd9cacc30', 4, '#3B82F6'),
  ('391581f1-3df4-4546-8e2f-c4fd5c8fede0', 'Posture', 'b6f8eabb-467e-497a-8303-9c3dd9cacc30', 4, '#8B5CF6'),
  ('89a34a9b-c98f-46ca-ad5f-e7f7869ca218', 'Ladies', 'b6f8eabb-467e-497a-8303-9c3dd9cacc30', 4, '#EC4899'),
  ('cbc01900-5003-4cf3-8869-df951f11acd0', 'Événement spécial', 'b6f8eabb-467e-497a-8303-9c3dd9cacc30', 8, '#F59E0B')
ON CONFLICT (id) DO NOTHING;

-- 3. TYPES DE PACKS
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

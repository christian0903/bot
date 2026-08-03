-- ============================================
-- Créer 3 coaches avec rôles coach + admin
-- Mot de passe : Demo12345678!
-- ============================================

INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, raw_user_meta_data, created_at, updated_at, instance_id, aud, role)
VALUES
  ('cccc0001-0001-0001-0001-000000000001', 'gauthier@backontrackstudio.be', crypt('Demo12345678!', gen_salt('bf')), NOW(), '{"display_name":"Gauthier Wilhelmi","first_name":"Gauthier","last_name":"Wilhelmi","phone":"+32 472 10 01 01","cgv_accepted":"true","rgpd_accepted":"true"}'::jsonb, NOW(), NOW(), '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated'),
  ('cccc0001-0001-0001-0001-000000000002', 'anselme@backontrackstudio.be', crypt('Demo12345678!', gen_salt('bf')), NOW(), '{"display_name":"Anselme Meunier","first_name":"Anselme","last_name":"Meunier","phone":"+32 472 10 02 02","cgv_accepted":"true","rgpd_accepted":"true"}'::jsonb, NOW(), NOW(), '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated'),
  ('cccc0001-0001-0001-0001-000000000003', 'joan@backontrackstudio.be', crypt('Demo12345678!', gen_salt('bf')), NOW(), '{"display_name":"Joan Rodon","first_name":"Joan","last_name":"Rodon","phone":"+32 472 10 03 03","cgv_accepted":"true","rgpd_accepted":"true"}'::jsonb, NOW(), NOW(), '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated')
ON CONFLICT (id) DO NOTHING;

-- Attendre le trigger handle_new_user
SELECT pg_sleep(1);

-- Ajouter rôle coach (en plus du client créé par le trigger)
INSERT INTO user_roles (user_id, role) VALUES
  ('cccc0001-0001-0001-0001-000000000001', 'coach'),
  ('cccc0001-0001-0001-0001-000000000002', 'coach'),
  ('cccc0001-0001-0001-0001-000000000003', 'coach')
ON CONFLICT (user_id, role) DO NOTHING;

-- Ajouter rôle admin
INSERT INTO user_roles (user_id, role) VALUES
  ('cccc0001-0001-0001-0001-000000000001', 'admin'),
  ('cccc0001-0001-0001-0001-000000000002', 'admin'),
  ('cccc0001-0001-0001-0001-000000000003', 'admin')
ON CONFLICT (user_id, role) DO NOTHING;

-- Mettre statut actif
UPDATE profiles SET member_status = 'active'
WHERE id IN (
  'cccc0001-0001-0001-0001-000000000001',
  'cccc0001-0001-0001-0001-000000000002',
  'cccc0001-0001-0001-0001-000000000003'
);

-- Vérification
SELECT p.display_name, p.email, string_agg(ur.role::text, ', ') AS roles
FROM profiles p
JOIN user_roles ur ON ur.user_id = p.id
WHERE p.id IN (
  'cccc0001-0001-0001-0001-000000000001',
  'cccc0001-0001-0001-0001-000000000002',
  'cccc0001-0001-0001-0001-000000000003'
)
GROUP BY p.display_name, p.email;

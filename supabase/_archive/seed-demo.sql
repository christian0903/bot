-- ============================================
-- Back on Track - Données de démonstration
-- À exécuter dans le SQL Editor de Supabase
-- ============================================

-- ============================================
-- 1. CRÉER 10 CLIENTS DE DÉMO + 2 COACHS
-- ============================================
-- Note : on utilise des mots de passe temporaires (Demo1234!)
-- Les users sont créés via la fonction auth de Supabase

DO $$
DECLARE
  v_user_id UUID;
  v_coach1_id UUID;
  v_coach2_id UUID;
  v_client_ids UUID[] := ARRAY[]::UUID[];
  v_pack_semi UUID := 'bd652580-7335-48b4-a5c0-db75edd8f86b';
  v_pack_pt UUID := 'c30296e7-b6c4-43ff-b38c-22e39ba0a417';
  v_class_posture UUID := '391581f1-3df4-4546-8e2f-c4fd5c8fede0';
  v_class_ladies UUID := '89a34a9b-c98f-46ca-ad5f-e7f7869ca218';
  v_class_cross UUID := 'f5b1718d-174e-4557-82ae-a6cc9a115ba1';
  v_class_bot UUID := '89788ddb-90a4-46f7-b468-566f5d13cc04';
  v_scheduled_id UUID;
  v_purchase_id UUID;
  i INTEGER;
BEGIN

  -- ============================================
  -- COACH 1 : Sophie Martin
  -- ============================================
  v_coach1_id := gen_random_uuid();
  INSERT INTO auth.users (id, instance_id, email, encrypted_password, email_confirmed_at, raw_user_meta_data, role, aud, created_at, updated_at)
  VALUES (v_coach1_id, '00000000-0000-0000-0000-000000000000', 'sophie.martin@demo.bot', crypt('Demo1234!', gen_salt('bf')), NOW(), '{"display_name":"Sophie Martin"}'::jsonb, 'authenticated', 'authenticated', NOW(), NOW());

  INSERT INTO auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
  VALUES (gen_random_uuid(), v_coach1_id, v_coach1_id::text, jsonb_build_object('sub', v_coach1_id::text, 'email', 'sophie.martin@demo.bot'), 'email', NOW(), NOW(), NOW());

  UPDATE profiles SET first_name = 'Sophie', last_name = 'Martin', phone = '+32 470 111 001' WHERE id = v_coach1_id;
  INSERT INTO user_roles (user_id, role) VALUES (v_coach1_id, 'coach') ON CONFLICT DO NOTHING;

  -- ============================================
  -- COACH 2 : Marc Dubois
  -- ============================================
  v_coach2_id := gen_random_uuid();
  INSERT INTO auth.users (id, instance_id, email, encrypted_password, email_confirmed_at, raw_user_meta_data, role, aud, created_at, updated_at)
  VALUES (v_coach2_id, '00000000-0000-0000-0000-000000000000', 'marc.dubois@demo.bot', crypt('Demo1234!', gen_salt('bf')), NOW(), '{"display_name":"Marc Dubois"}'::jsonb, 'authenticated', 'authenticated', NOW(), NOW());

  INSERT INTO auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
  VALUES (gen_random_uuid(), v_coach2_id, v_coach2_id::text, jsonb_build_object('sub', v_coach2_id::text, 'email', 'marc.dubois@demo.bot'), 'email', NOW(), NOW(), NOW());

  UPDATE profiles SET first_name = 'Marc', last_name = 'Dubois', phone = '+32 470 111 002' WHERE id = v_coach2_id;
  INSERT INTO user_roles (user_id, role) VALUES (v_coach2_id, 'coach') ON CONFLICT DO NOTHING;

  -- ============================================
  -- 10 CLIENTS
  -- ============================================
  DECLARE
    v_clients TEXT[][] := ARRAY[
      ARRAY['alice.dupont@demo.bot',    'Alice Dupont',    'Alice',    'Dupont',    '+32 470 200 001'],
      ARRAY['benoit.leroy@demo.bot',    'Benoît Leroy',    'Benoît',   'Leroy',     '+32 470 200 002'],
      ARRAY['claire.moreau@demo.bot',   'Claire Moreau',   'Claire',   'Moreau',    '+32 470 200 003'],
      ARRAY['david.lambert@demo.bot',   'David Lambert',   'David',    'Lambert',   '+32 470 200 004'],
      ARRAY['emma.bernard@demo.bot',    'Emma Bernard',    'Emma',     'Bernard',   '+32 470 200 005'],
      ARRAY['francois.petit@demo.bot',  'François Petit',  'François', 'Petit',     '+32 470 200 006'],
      ARRAY['gaelle.roux@demo.bot',     'Gaëlle Roux',     'Gaëlle',   'Roux',      '+32 470 200 007'],
      ARRAY['hugo.garcia@demo.bot',     'Hugo Garcia',     'Hugo',     'Garcia',    '+32 470 200 008'],
      ARRAY['isabelle.thomas@demo.bot', 'Isabelle Thomas', 'Isabelle', 'Thomas',    '+32 470 200 009'],
      ARRAY['julien.robert@demo.bot',   'Julien Robert',   'Julien',   'Robert',    '+32 470 200 010']
    ];
    v_row TEXT[];
  BEGIN
    FOREACH v_row SLICE 1 IN ARRAY v_clients LOOP
      v_user_id := gen_random_uuid();

      INSERT INTO auth.users (id, instance_id, email, encrypted_password, email_confirmed_at, raw_user_meta_data, role, aud, created_at, updated_at)
      VALUES (v_user_id, '00000000-0000-0000-0000-000000000000', v_row[1], crypt('Demo1234!', gen_salt('bf')), NOW(), jsonb_build_object('display_name', v_row[2]), 'authenticated', 'authenticated', NOW() - (random() * interval '60 days'), NOW());

      INSERT INTO auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
      VALUES (gen_random_uuid(), v_user_id, v_user_id::text, jsonb_build_object('sub', v_user_id::text, 'email', v_row[1]), 'email', NOW(), NOW(), NOW());

      UPDATE profiles SET first_name = v_row[3], last_name = v_row[4], phone = v_row[5] WHERE id = v_user_id;

      v_client_ids := array_append(v_client_ids, v_user_id);
    END LOOP;
  END;

  -- ============================================
  -- ACHATS DE PACKS POUR LES CLIENTS
  -- ============================================
  -- Clients 1-8 : pack semi-privé (250€, 10 crédits)
  -- Clients 3,5,9,10 : aussi pack personal training (750€, 10 crédits)

  FOR i IN 1..8 LOOP
    INSERT INTO pack_purchases (user_id, pack_type_id, price_paid_cents, credits_remaining, purchased_at, expires_at)
    VALUES (
      v_client_ids[i],
      v_pack_semi,
      25000,
      CASE WHEN i <= 4 THEN 10 - i ELSE 10 - (i - 4) END,  -- crédits variés
      NOW() - interval '10 days',
      NOW() + interval '50 days'
    );
  END LOOP;

  -- Pack personal training pour quelques clients
  FOREACH i IN ARRAY ARRAY[3, 5, 9, 10] LOOP
    INSERT INTO pack_purchases (user_id, pack_type_id, price_paid_cents, credits_remaining, purchased_at, expires_at)
    VALUES (
      v_client_ids[i],
      v_pack_pt,
      75000,
      8 + (random() * 2)::int,
      NOW() - interval '5 days',
      NOW() + interval '25 days'
    );
  END LOOP;

  -- ============================================
  -- PLANNING : 3 SEMAINES DE COURS
  -- Semaine actuelle + semaine prochaine + semaine d'après
  -- ============================================
  DECLARE
    v_week_start DATE := date_trunc('week', CURRENT_DATE)::date;  -- lundi courant
    v_day DATE;
    v_week INTEGER;
  BEGIN
    FOR v_week IN 0..2 LOOP
      -- === LUNDI ===
      v_day := v_week_start + (v_week * 7);

      -- 09:00 Posture (Sophie, 8 places)
      INSERT INTO scheduled_classes (class_type_id, coach_id, starts_at, duration_minutes, max_participants)
      VALUES (v_class_posture, v_coach1_id, v_day + time '09:00', 60, 8);

      -- 10:30 Cross Training (Marc, 10 places)
      INSERT INTO scheduled_classes (class_type_id, coach_id, starts_at, duration_minutes, max_participants)
      VALUES (v_class_cross, v_coach2_id, v_day + time '10:30', 60, 10);

      -- 18:00 Back on Track (Sophie, 8 places)
      INSERT INTO scheduled_classes (class_type_id, coach_id, starts_at, duration_minutes, max_participants)
      VALUES (v_class_bot, v_coach1_id, v_day + time '18:00', 60, 8);

      -- === MARDI ===
      v_day := v_week_start + (v_week * 7) + 1;

      -- 09:00 Ladies (Sophie, 8 places)
      INSERT INTO scheduled_classes (class_type_id, coach_id, starts_at, duration_minutes, max_participants)
      VALUES (v_class_ladies, v_coach1_id, v_day + time '09:00', 60, 8);

      -- 12:00 Cross Training (Marc, 10 places)
      INSERT INTO scheduled_classes (class_type_id, coach_id, starts_at, duration_minutes, max_participants)
      VALUES (v_class_cross, v_coach2_id, v_day + time '12:00', 60, 10);

      -- 19:00 Posture (Marc, 8 places)
      INSERT INTO scheduled_classes (class_type_id, coach_id, starts_at, duration_minutes, max_participants)
      VALUES (v_class_posture, v_coach2_id, v_day + time '19:00', 60, 8);

      -- === MERCREDI ===
      v_day := v_week_start + (v_week * 7) + 2;

      -- 09:00 Back on Track (Marc, 10 places)
      INSERT INTO scheduled_classes (class_type_id, coach_id, starts_at, duration_minutes, max_participants)
      VALUES (v_class_bot, v_coach2_id, v_day + time '09:00', 60, 10);

      -- 17:30 Ladies (Sophie, 8 places)
      INSERT INTO scheduled_classes (class_type_id, coach_id, starts_at, duration_minutes, max_participants)
      VALUES (v_class_ladies, v_coach1_id, v_day + time '17:30', 60, 8);

      -- === JEUDI ===
      v_day := v_week_start + (v_week * 7) + 3;

      -- 09:00 Posture (Sophie, 8 places)
      INSERT INTO scheduled_classes (class_type_id, coach_id, starts_at, duration_minutes, max_participants)
      VALUES (v_class_posture, v_coach1_id, v_day + time '09:00', 60, 8);

      -- 10:30 Cross Training (Marc, 10 places)
      INSERT INTO scheduled_classes (class_type_id, coach_id, starts_at, duration_minutes, max_participants)
      VALUES (v_class_cross, v_coach2_id, v_day + time '10:30', 60, 10);

      -- 18:30 Back on Track (Marc, 8 places)
      INSERT INTO scheduled_classes (class_type_id, coach_id, starts_at, duration_minutes, max_participants)
      VALUES (v_class_bot, v_coach2_id, v_day + time '18:30', 60, 8);

      -- === VENDREDI ===
      v_day := v_week_start + (v_week * 7) + 4;

      -- 09:00 Ladies (Sophie, 8 places)
      INSERT INTO scheduled_classes (class_type_id, coach_id, starts_at, duration_minutes, max_participants)
      VALUES (v_class_ladies, v_coach1_id, v_day + time '09:00', 60, 8);

      -- 11:00 Cross Training (Marc, 10 places)
      INSERT INTO scheduled_classes (class_type_id, coach_id, starts_at, duration_minutes, max_participants)
      VALUES (v_class_cross, v_coach2_id, v_day + time '11:00', 60, 10);

      -- 17:00 Posture (Sophie, 8 places)
      INSERT INTO scheduled_classes (class_type_id, coach_id, starts_at, duration_minutes, max_participants)
      VALUES (v_class_posture, v_coach1_id, v_day + time '17:00', 60, 8);

      -- === SAMEDI ===
      v_day := v_week_start + (v_week * 7) + 5;

      -- 10:00 Back on Track (Sophie, 10 places)
      INSERT INTO scheduled_classes (class_type_id, coach_id, starts_at, duration_minutes, max_participants)
      VALUES (v_class_bot, v_coach1_id, v_day + time '10:00', 60, 10);

      -- 11:30 Cross Training (Marc, 10 places)
      INSERT INTO scheduled_classes (class_type_id, coach_id, starts_at, duration_minutes, max_participants)
      VALUES (v_class_cross, v_coach2_id, v_day + time '11:30', 60, 10);

    END LOOP;
  END;

  -- ============================================
  -- RÉSERVATIONS DE DÉMO
  -- Quelques clients inscrits sur des cours passés et à venir
  -- ============================================
  DECLARE
    v_sc RECORD;
    v_pp RECORD;
    v_client_index INTEGER;
    v_count INTEGER := 0;
  BEGIN
    -- Pour chaque cours planifié, inscrire 2 à 5 clients aléatoires
    FOR v_sc IN
      SELECT id, class_type_id, starts_at
      FROM scheduled_classes
      WHERE starts_at < NOW() + interval '3 days'  -- cours passés et proches
      ORDER BY starts_at
      LIMIT 20
    LOOP
      FOR v_client_index IN 1..LEAST(3 + (random() * 3)::int, 8) LOOP
        -- Trouver un pack semi-privé valide pour ce client
        SELECT pp.id INTO v_pp
        FROM pack_purchases pp
        WHERE pp.user_id = v_client_ids[v_client_index]
          AND pp.pack_type_id = v_pack_semi
          AND pp.credits_remaining > 0
        LIMIT 1;

        IF v_pp.id IS NOT NULL THEN
          BEGIN
            INSERT INTO bookings (scheduled_class_id, user_id, pack_purchase_id, status)
            VALUES (v_sc.id, v_client_ids[v_client_index], v_pp.id, 'confirmed');

            UPDATE pack_purchases SET credits_remaining = credits_remaining - 1
            WHERE id = v_pp.id AND credits_remaining > 0;

            v_count := v_count + 1;
          EXCEPTION WHEN unique_violation THEN
            -- déjà inscrit, on skip
            NULL;
          END;
        END IF;
      END LOOP;
    END LOOP;

    RAISE NOTICE 'Réservations créées: %', v_count;
  END;

  RAISE NOTICE 'Seed terminé : 2 coachs, 10 clients, packs et réservations créés';

END $$;

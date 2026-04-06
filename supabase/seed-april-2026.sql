-- ============================================
-- Back on Track - Planning Avril 2026 complet
-- Exécuter dans le SQL Editor de Supabase
-- ============================================

-- Nettoyer les cours existants (sans toucher aux réservations orphelines)
DELETE FROM bookings;
DELETE FROM scheduled_classes;

-- IDs existants
-- Coach IDs : récupérés dynamiquement
DO $$
DECLARE
  v_coach1 UUID;
  v_coach2 UUID;
  v_posture UUID := '391581f1-3df4-4546-8e2f-c4fd5c8fede0';
  v_ladies UUID := '89a34a9b-c98f-46ca-ad5f-e7f7869ca218';
  v_cross UUID := 'f5b1718d-174e-4557-82ae-a6cc9a115ba1';
  v_bot UUID := '89788ddb-90a4-46f7-b468-566f5d13cc04';
  v_day DATE;
  v_dow INTEGER; -- 0=dimanche, 1=lundi, ..., 6=samedi
BEGIN

  -- Récupérer les 2 coachs
  SELECT user_id INTO v_coach1 FROM user_roles WHERE role = 'coach' ORDER BY created_at LIMIT 1;
  SELECT user_id INTO v_coach2 FROM user_roles WHERE role = 'coach' ORDER BY created_at OFFSET 1 LIMIT 1;

  -- Si un seul coach, utiliser le même pour les 2
  IF v_coach2 IS NULL THEN v_coach2 := v_coach1; END IF;

  -- Si aucun coach, prendre le premier admin
  IF v_coach1 IS NULL THEN
    SELECT user_id INTO v_coach1 FROM user_roles WHERE role = 'admin' LIMIT 1;
    v_coach2 := v_coach1;
  END IF;

  RAISE NOTICE 'Coach 1: %, Coach 2: %', v_coach1, v_coach2;

  -- Boucle sur chaque jour d'avril 2026
  v_day := '2026-04-01'::date;
  WHILE v_day <= '2026-04-30'::date LOOP
    v_dow := EXTRACT(DOW FROM v_day)::integer; -- 0=dim, 1=lun, ..., 6=sam

    -- ==================
    -- LUNDI (dow=1)
    -- ==================
    IF v_dow = 1 THEN
      INSERT INTO scheduled_classes (class_type_id, coach_id, starts_at, duration_minutes, max_participants)
      VALUES
        (v_posture, v_coach1, v_day::timestamp + interval '9 hours', 60, 8),
        (v_cross,   v_coach2, v_day::timestamp + interval '10 hours 30 minutes', 60, 10),
        (v_bot,     v_coach1, v_day::timestamp + interval '18 hours', 60, 8);
    END IF;

    -- ==================
    -- MARDI (dow=2)
    -- ==================
    IF v_dow = 2 THEN
      INSERT INTO scheduled_classes (class_type_id, coach_id, starts_at, duration_minutes, max_participants)
      VALUES
        (v_ladies,  v_coach1, v_day::timestamp + interval '9 hours', 60, 8),
        (v_cross,   v_coach2, v_day::timestamp + interval '12 hours', 60, 10),
        (v_posture, v_coach2, v_day::timestamp + interval '19 hours', 60, 8);
    END IF;

    -- ==================
    -- MERCREDI (dow=3)
    -- ==================
    IF v_dow = 3 THEN
      INSERT INTO scheduled_classes (class_type_id, coach_id, starts_at, duration_minutes, max_participants)
      VALUES
        (v_bot,     v_coach2, v_day::timestamp + interval '9 hours', 60, 10),
        (v_posture, v_coach1, v_day::timestamp + interval '12 hours', 60, 8),
        (v_ladies,  v_coach1, v_day::timestamp + interval '17 hours 30 minutes', 60, 8);
    END IF;

    -- ==================
    -- JEUDI (dow=4)
    -- ==================
    IF v_dow = 4 THEN
      INSERT INTO scheduled_classes (class_type_id, coach_id, starts_at, duration_minutes, max_participants)
      VALUES
        (v_posture, v_coach1, v_day::timestamp + interval '9 hours', 60, 8),
        (v_cross,   v_coach2, v_day::timestamp + interval '10 hours 30 minutes', 60, 10),
        (v_bot,     v_coach2, v_day::timestamp + interval '18 hours 30 minutes', 60, 8);
    END IF;

    -- ==================
    -- VENDREDI (dow=5)
    -- ==================
    IF v_dow = 5 THEN
      INSERT INTO scheduled_classes (class_type_id, coach_id, starts_at, duration_minutes, max_participants)
      VALUES
        (v_ladies,  v_coach1, v_day::timestamp + interval '9 hours', 60, 8),
        (v_cross,   v_coach2, v_day::timestamp + interval '11 hours', 60, 10),
        (v_posture, v_coach1, v_day::timestamp + interval '17 hours', 60, 8);
    END IF;

    -- ==================
    -- SAMEDI (dow=6)
    -- ==================
    IF v_dow = 6 THEN
      INSERT INTO scheduled_classes (class_type_id, coach_id, starts_at, duration_minutes, max_participants)
      VALUES
        (v_bot,   v_coach1, v_day::timestamp + interval '10 hours', 60, 10),
        (v_cross, v_coach2, v_day::timestamp + interval '11 hours 30 minutes', 60, 10);
    END IF;

    -- Dimanche : pas de cours

    v_day := v_day + 1;
  END LOOP;

  -- ==================
  -- Compter le résultat
  -- ==================
  DECLARE
    v_total INTEGER;
  BEGIN
    SELECT count(*) INTO v_total FROM scheduled_classes;
    RAISE NOTICE 'Planning avril 2026 créé : % cours', v_total;
  END;

END $$;

-- ============================================
-- RÉSERVATIONS DE DÉMO sur les cours passés
-- ============================================
DO $$
DECLARE
  v_sc RECORD;
  v_client RECORD;
  v_pp_id UUID;
  v_count INTEGER := 0;
  v_pack_semi UUID := 'bd652580-7335-48b4-a5c0-db75edd8f86b';
BEGIN
  -- Pour chaque cours déjà passé ou aujourd'hui, inscrire quelques clients
  FOR v_sc IN
    SELECT id FROM scheduled_classes
    WHERE starts_at <= NOW() + interval '1 day'
    ORDER BY starts_at
  LOOP
    -- Inscrire entre 3 et 6 clients aléatoires
    FOR v_client IN
      SELECT p.id as user_id
      FROM profiles p
      JOIN user_roles ur ON ur.user_id = p.id AND ur.role = 'client'
      ORDER BY random()
      LIMIT 3 + (random() * 3)::int
    LOOP
      -- Trouver un pack valide
      SELECT pp.id INTO v_pp_id
      FROM pack_purchases pp
      WHERE pp.user_id = v_client.user_id
        AND pp.credits_remaining > 0
        AND pp.expires_at > NOW()
      LIMIT 1;

      IF v_pp_id IS NOT NULL THEN
        BEGIN
          INSERT INTO bookings (scheduled_class_id, user_id, pack_purchase_id, status)
          VALUES (v_sc.id, v_client.user_id, v_pp_id, 'confirmed');

          UPDATE pack_purchases SET credits_remaining = credits_remaining - 1
          WHERE id = v_pp_id AND credits_remaining > 0;

          v_count := v_count + 1;
        EXCEPTION WHEN unique_violation THEN
          NULL; -- déjà inscrit
        END;
      END IF;
    END LOOP;
  END LOOP;

  RAISE NOTICE 'Réservations créées : %', v_count;
END $$;

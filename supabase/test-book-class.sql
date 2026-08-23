-- ============================================================================
-- Éprouver `book_class` — à exécuter dans le SQL Editor, sur la base de TEST
-- ----------------------------------------------------------------------------
-- Tout se déroule dans une transaction terminée par ROLLBACK : rien ne
-- persiste, ni les cours créés, ni les réservations, ni les crédits décomptés.
-- On peut le relancer autant de fois qu'on veut.
--
-- CE QUE CE SCRIPT NE PEUT PAS FAIRE : `book_class` lit `auth.uid()`, que le
-- SQL Editor ne renseigne pas. On la teste donc en simulant le JWT par
-- `SET LOCAL request.jwt.claims`, ce que fait déjà Supabase en interne.
--
-- Le vrai test de concurrence (deux membres sur la dernière place) ne se joue
-- pas ici : il demande deux sessions simultanées. Voir la note en fin de
-- fichier.
-- ============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- Décor : un membre, un type de cours, un cours à 1 place, un pack de 1 crédit
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  v_user       UUID;
  v_credit_ty  UUID;
  v_class_ty   UUID;
  v_pack_ty    UUID;
  v_class      UUID;
  v_pack       UUID;
  v_res        JSONB;
  v_left       INTEGER;
  v_count      INTEGER;
BEGIN
  -- Un membre réel de la base de test : on prend le premier venu plutôt que
  -- d'en créer un (auth.users est géré par Supabase, pas par nous).
  SELECT id INTO v_user FROM profiles LIMIT 1;
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Aucun profil en base : impossible de tester';
  END IF;

  SELECT id INTO v_credit_ty FROM credit_types LIMIT 1;

  INSERT INTO class_types (name, credit_type_id, default_max_participants)
  VALUES ('TEST book_class', v_credit_ty, 4)
  RETURNING id INTO v_class_ty;

  -- UNE seule place : c'est ce qui rend le test de capacité concluant.
  INSERT INTO scheduled_classes (class_type_id, starts_at, max_participants)
  VALUES (v_class_ty, NOW() + INTERVAL '7 days', 1)
  RETURNING id INTO v_class;

  INSERT INTO pack_types (name, credit_type_id, credit_count, price_cents, validity_days)
  VALUES ('TEST pack 1 credit', v_credit_ty, 1, 1000, 90)
  RETURNING id INTO v_pack_ty;

  INSERT INTO pack_purchases (user_id, pack_type_id, credits_remaining, price_paid_cents, expires_at)
  VALUES (v_user, v_pack_ty, 1, 1000, NOW() + INTERVAL '90 days')
  RETURNING id INTO v_pack;

  -- Se faire passer pour ce membre, comme le fait PostgREST.
  PERFORM set_config('request.jwt.claims',
                     json_build_object('sub', v_user, 'role', 'authenticated')::TEXT,
                     true);

  RAISE NOTICE '--- Décor posé : membre %, cours % (1 place), pack % (1 crédit)',
    v_user, v_class, v_pack;

  -- -------------------------------------------------------------------------
  -- 1. Réservation nominale
  -- -------------------------------------------------------------------------
  v_res := book_class(v_class, v_pack);
  RAISE NOTICE '1. Réservation nominale       : %', v_res;

  IF (v_res->>'ok')::BOOLEAN IS NOT TRUE THEN
    RAISE EXCEPTION 'ÉCHEC : la réservation nominale aurait dû réussir (%)', v_res;
  END IF;

  SELECT credits_remaining INTO v_left FROM pack_purchases WHERE id = v_pack;
  IF v_left <> 0 THEN
    RAISE EXCEPTION 'ÉCHEC : crédit non décompté (reste %, attendu 0)', v_left;
  END IF;
  RAISE NOTICE '   crédit décompté : 1 -> 0                          [OK]';

  -- -------------------------------------------------------------------------
  -- 2. Deuxième réservation du même membre sur le même cours
  --    Attendu : refus `already_booked`, et AUCUN crédit reperdu.
  -- -------------------------------------------------------------------------
  v_res := book_class(v_class, v_pack);
  RAISE NOTICE '2. Double réservation         : %', v_res;

  IF (v_res->>'ok')::BOOLEAN IS NOT FALSE OR v_res->>'reason' <> 'already_booked' THEN
    RAISE EXCEPTION 'ÉCHEC : attendu already_booked, reçu %', v_res;
  END IF;
  RAISE NOTICE '   refus already_booked                              [OK]';

  -- -------------------------------------------------------------------------
  -- 3. Le crédit est à zéro : une réservation sur un AUTRE cours doit être
  --    refusée, et surtout ne rien écrire.
  -- -------------------------------------------------------------------------
  INSERT INTO scheduled_classes (class_type_id, starts_at, max_participants)
  VALUES (v_class_ty, NOW() + INTERVAL '8 days', 5)
  RETURNING id INTO v_class;

  v_res := book_class(v_class, v_pack);
  RAISE NOTICE '3. Sans crédit restant        : %', v_res;

  IF (v_res->>'ok')::BOOLEAN IS NOT FALSE OR v_res->>'reason' <> 'no_credit' THEN
    RAISE EXCEPTION 'ÉCHEC : attendu no_credit, reçu %', v_res;
  END IF;

  SELECT COUNT(*) INTO v_count
    FROM bookings WHERE scheduled_class_id = v_class AND user_id = v_user;
  IF v_count <> 0 THEN
    RAISE EXCEPTION 'ÉCHEC GRAVE : réservation écrite sans crédit (% lignes)', v_count;
  END IF;
  RAISE NOTICE '   refus no_credit, aucune réservation écrite        [OK]';

  SELECT credits_remaining INTO v_left FROM pack_purchases WHERE id = v_pack;
  IF v_left <> 0 THEN
    RAISE EXCEPTION 'ÉCHEC : crédit passé en négatif ou modifié (%)', v_left;
  END IF;
  RAISE NOTICE '   crédit resté à 0, jamais négatif                  [OK]';

  -- -------------------------------------------------------------------------
  -- 4. Pack d'un AUTRE membre : ne doit jamais être consommable.
  -- -------------------------------------------------------------------------
  DECLARE
    v_other      UUID;
    v_other_pack UUID;
  BEGIN
    SELECT id INTO v_other FROM profiles WHERE id <> v_user LIMIT 1;

    IF v_other IS NOT NULL THEN
      INSERT INTO pack_purchases (user_id, pack_type_id, credits_remaining, price_paid_cents, expires_at)
      VALUES (v_other, v_pack_ty, 10, 1000, NOW() + INTERVAL '90 days')
      RETURNING id INTO v_other_pack;

      v_res := book_class(v_class, v_other_pack);
      RAISE NOTICE '4. Pack d''un autre membre     : %', v_res;

      IF (v_res->>'ok')::BOOLEAN IS NOT FALSE THEN
        RAISE EXCEPTION 'ÉCHEC DE SÉCURITÉ : pack d''autrui consommé (%)', v_res;
      END IF;

      SELECT credits_remaining INTO v_left FROM pack_purchases WHERE id = v_other_pack;
      IF v_left <> 10 THEN
        RAISE EXCEPTION 'ÉCHEC DE SÉCURITÉ : crédits d''autrui touchés (%)', v_left;
      END IF;
      RAISE NOTICE '   refusé, crédits d''autrui intacts                  [OK]';
    ELSE
      RAISE NOTICE '4. Pack d''un autre membre     : IGNORÉ (un seul profil en base)';
    END IF;
  END;

  -- -------------------------------------------------------------------------
  -- 5. Cours annulé
  -- -------------------------------------------------------------------------
  UPDATE pack_purchases SET credits_remaining = 5 WHERE id = v_pack;
  UPDATE scheduled_classes SET is_cancelled = TRUE WHERE id = v_class;

  v_res := book_class(v_class, v_pack);
  RAISE NOTICE '5. Cours annulé               : %', v_res;

  IF (v_res->>'ok')::BOOLEAN IS NOT FALSE OR v_res->>'reason' <> 'class_cancelled' THEN
    RAISE EXCEPTION 'ÉCHEC : attendu class_cancelled, reçu %', v_res;
  END IF;

  SELECT credits_remaining INTO v_left FROM pack_purchases WHERE id = v_pack;
  IF v_left <> 5 THEN
    RAISE EXCEPTION 'ÉCHEC : crédit décompté sur un refus (%)', v_left;
  END IF;
  RAISE NOTICE '   refusé, crédit non décompté                       [OK]';

  -- -------------------------------------------------------------------------
  -- 6. Cours déjà passé
  -- -------------------------------------------------------------------------
  UPDATE scheduled_classes
     SET is_cancelled = FALSE, starts_at = NOW() - INTERVAL '1 day'
   WHERE id = v_class;

  v_res := book_class(v_class, v_pack);
  RAISE NOTICE '6. Cours passé                : %', v_res;

  IF (v_res->>'ok')::BOOLEAN IS NOT FALSE THEN
    RAISE EXCEPTION 'ÉCHEC : un cours passé ne doit pas être réservable (%)', v_res;
  END IF;
  RAISE NOTICE '   refusé                                            [OK]';

  -- -------------------------------------------------------------------------
  -- 7. Sans source imposée : la fonction choisit elle-même le pack
  -- -------------------------------------------------------------------------
  INSERT INTO scheduled_classes (class_type_id, starts_at, max_participants)
  VALUES (v_class_ty, NOW() + INTERVAL '9 days', 5)
  RETURNING id INTO v_class;

  v_res := book_class(v_class);   -- p_pack_purchase_id omis
  RAISE NOTICE '7. Choix automatique du pack  : %', v_res;

  IF (v_res->>'ok')::BOOLEAN IS NOT TRUE THEN
    RAISE EXCEPTION 'ÉCHEC : la fonction aurait dû choisir un pack (%)', v_res;
  END IF;
  RAISE NOTICE '   pack choisi : %                    [OK]', v_res->>'pack_purchase_id';

  -- -------------------------------------------------------------------------
  -- 8. Réactivation d'une annulation plutôt qu'une deuxième ligne
  -- -------------------------------------------------------------------------
  UPDATE bookings
     SET status = 'cancelled', cancelled_at = NOW()
   WHERE scheduled_class_id = v_class AND user_id = v_user;

  UPDATE pack_purchases SET credits_remaining = 5 WHERE id = v_pack;

  v_res := book_class(v_class, v_pack);
  RAISE NOTICE '8. Après annulation           : %', v_res;

  IF (v_res->>'ok')::BOOLEAN IS NOT TRUE THEN
    RAISE EXCEPTION 'ÉCHEC : la réservation aurait dû être réactivée (%)', v_res;
  END IF;

  SELECT COUNT(*) INTO v_count
    FROM bookings WHERE scheduled_class_id = v_class AND user_id = v_user;
  IF v_count <> 1 THEN
    RAISE EXCEPTION 'ÉCHEC : % lignes au lieu d''une seule (réactivation ratée)', v_count;
  END IF;
  RAISE NOTICE '   réactivée, une seule ligne en base                [OK]';

  RAISE NOTICE '';
  RAISE NOTICE '=====================================================';
  RAISE NOTICE '  TOUS LES CAS SONT PASSÉS';
  RAISE NOTICE '=====================================================';
END $$;

ROLLBACK;   -- rien ne persiste

-- ============================================================================
-- LE TEST QUI MANQUE : deux réservations vraiment simultanées
-- ----------------------------------------------------------------------------
-- Le script ci-dessus vérifie la logique, pas le verrou : une transaction
-- unique ne peut pas entrer en concurrence avec elle-même.
--
-- Pour éprouver le verrou, il faut DEUX sessions SQL ouvertes en même temps
-- (deux onglets du SQL Editor), sur un cours à UNE place :
--
--   Session A                          Session B
--   ---------                          ---------
--   BEGIN;
--   SELECT book_class('<cours>');
--   -- ne pas valider tout de suite
--                                      BEGIN;
--                                      SELECT book_class('<cours>');
--                                      -- ATTEND (verrou pris par A)
--   COMMIT;
--                                      -- se débloque et répond
--                                      -- {"ok":false,"reason":"class_full"}
--                                      ROLLBACK;
--
-- Le comportement attendu est que B ATTENDE pendant que A tient le verrou,
-- puis se voie refuser la place. Sans le verrou, B répondrait immédiatement
-- `ok:true` et le cours partirait à deux inscrits pour une place.
-- ============================================================================

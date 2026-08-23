-- ============================================================================
-- Éprouver `book_class` — SQL Editor de Supabase, sur la base de TEST
-- ----------------------------------------------------------------------------
-- COMMENT LIRE LE RÉSULTAT
--
-- Le script affiche un TABLEAU à la fin — le SQL Editor de Supabase n'affiche
-- pas les messages `NOTICE`, seulement les lignes retournées. Une ligne par
-- cas, avec une colonne `verdict` qui vaut `OK` ou `ECHEC`, et une dernière
-- ligne de synthèse.
--
-- Ce qu'on veut voir : `verdict = OK` partout, et une dernière ligne
-- « TOUS LES CAS SONT PASSES ».
--
-- Tout se déroule dans une transaction terminée par ROLLBACK : rien ne
-- persiste — ni les cours créés, ni les réservations, ni les crédits
-- décomptés. Relançable autant de fois qu'on veut.
--
-- `book_class` lit `auth.uid()`, que le SQL Editor ne renseigne pas : on
-- simule le JWT par `set_config('request.jwt.claims', …)`, exactement ce que
-- fait Supabase en interne.
--
-- Le test du VERROU (deux membres sur la dernière place) ne se joue pas ici :
-- il demande deux sessions simultanées. Procédure en fin de fichier.
-- ============================================================================

BEGIN;

-- Les résultats s'accumulent ici, et sont affichés à la fin. Une table
-- temporaire disparaît d'elle-même avec la transaction.
CREATE TEMP TABLE resultat (
  ordre    INTEGER,
  cas      TEXT,
  verdict  TEXT,
  detail   TEXT
) ON COMMIT DROP;

DO $$
DECLARE
  v_user       UUID;
  v_other      UUID;
  v_credit_ty  UUID;
  v_class_ty   UUID;
  v_pack_ty    UUID;
  v_class      UUID;
  v_class2     UUID;
  v_pack       UUID;
  v_other_pack UUID;
  v_res        JSONB;
  v_left       INTEGER;
  v_count      INTEGER;
BEGIN
  -- ---------------------------------------------------------------------
  -- Décor
  -- ---------------------------------------------------------------------
  SELECT id INTO v_user FROM profiles ORDER BY created_at LIMIT 1;
  IF v_user IS NULL THEN
    INSERT INTO resultat VALUES (0, 'Décor', 'ECHEC', 'Aucun profil en base');
    RETURN;
  END IF;

  SELECT id INTO v_credit_ty FROM credit_types LIMIT 1;
  IF v_credit_ty IS NULL THEN
    INSERT INTO resultat VALUES (0, 'Décor', 'ECHEC', 'Aucun credit_type en base');
    RETURN;
  END IF;

  INSERT INTO class_types (name, credit_type_id, default_max_participants)
  VALUES ('TEST book_class', v_credit_ty, 4)
  RETURNING id INTO v_class_ty;

  -- Une seule place : c'est ce qui rendra le test de capacité concluant.
  INSERT INTO scheduled_classes (class_type_id, starts_at, max_participants)
  VALUES (v_class_ty, NOW() + INTERVAL '7 days', 1)
  RETURNING id INTO v_class;

  INSERT INTO pack_types (name, credit_type_id, credit_count, price_cents, validity_days)
  VALUES ('TEST pack 1 credit', v_credit_ty, 1, 1000, 90)
  RETURNING id INTO v_pack_ty;

  INSERT INTO pack_purchases (user_id, pack_type_id, credits_remaining, price_paid_cents, expires_at)
  VALUES (v_user, v_pack_ty, 1, 1000, NOW() + INTERVAL '90 days')
  RETURNING id INTO v_pack;

  -- Se faire passer pour ce membre, comme PostgREST le fait.
  PERFORM set_config('request.jwt.claims',
                     json_build_object('sub', v_user, 'role', 'authenticated')::TEXT,
                     true);

  INSERT INTO resultat VALUES (0, 'Décor posé', 'OK',
    'membre ' || LEFT(v_user::TEXT, 8) || ' · cours à 1 place · pack de 1 crédit');

  -- ---------------------------------------------------------------------
  -- 1. Réservation nominale
  -- ---------------------------------------------------------------------
  v_res := book_class(v_class, v_pack);
  SELECT credits_remaining INTO v_left FROM pack_purchases WHERE id = v_pack;

  INSERT INTO resultat VALUES (1, 'Réservation nominale',
    CASE WHEN (v_res->>'ok')::BOOLEAN AND v_left = 0 THEN 'OK' ELSE 'ECHEC' END,
    'retour=' || v_res::TEXT || ' · crédits restants=' || v_left || ' (attendu 0)');

  -- ---------------------------------------------------------------------
  -- 2. Le même membre, le même cours : refus, sans reperdre de crédit
  -- ---------------------------------------------------------------------
  v_res := book_class(v_class, v_pack);
  SELECT credits_remaining INTO v_left FROM pack_purchases WHERE id = v_pack;

  INSERT INTO resultat VALUES (2, 'Double réservation',
    CASE WHEN v_res->>'reason' = 'already_booked' AND v_left = 0 THEN 'OK' ELSE 'ECHEC' END,
    'attendu already_booked · reçu ' || COALESCE(v_res->>'reason', '(ok:true !)'));

  -- ---------------------------------------------------------------------
  -- 3. Plus de crédit : refus, et SURTOUT aucune réservation écrite
  -- ---------------------------------------------------------------------
  INSERT INTO scheduled_classes (class_type_id, starts_at, max_participants)
  VALUES (v_class_ty, NOW() + INTERVAL '8 days', 5)
  RETURNING id INTO v_class2;

  v_res := book_class(v_class2, v_pack);

  SELECT COUNT(*) INTO v_count
    FROM bookings WHERE scheduled_class_id = v_class2 AND user_id = v_user;
  SELECT credits_remaining INTO v_left FROM pack_purchases WHERE id = v_pack;

  INSERT INTO resultat VALUES (3, 'Sans crédit restant',
    CASE WHEN v_res->>'reason' = 'no_credit' AND v_count = 0 AND v_left = 0
         THEN 'OK' ELSE 'ECHEC' END,
    'attendu no_credit · reçu ' || COALESCE(v_res->>'reason', '(ok:true !)')
      || ' · réservations écrites=' || v_count || ' (attendu 0)'
      || ' · crédits=' || v_left || ' (attendu 0, jamais négatif)');

  -- ---------------------------------------------------------------------
  -- 4. Le pack d'un AUTRE membre ne doit jamais être consommable
  -- ---------------------------------------------------------------------
  SELECT id INTO v_other FROM profiles WHERE id <> v_user LIMIT 1;

  IF v_other IS NULL THEN
    INSERT INTO resultat VALUES (4, 'Pack d''un autre membre', 'IGNORE',
      'un seul profil en base, cas non jouable');
  ELSE
    INSERT INTO pack_purchases (user_id, pack_type_id, credits_remaining, price_paid_cents, expires_at)
    VALUES (v_other, v_pack_ty, 10, 1000, NOW() + INTERVAL '90 days')
    RETURNING id INTO v_other_pack;

    v_res := book_class(v_class2, v_other_pack);
    SELECT credits_remaining INTO v_left FROM pack_purchases WHERE id = v_other_pack;

    INSERT INTO resultat VALUES (4, 'Pack d''un autre membre',
      CASE WHEN (v_res->>'ok')::BOOLEAN IS NOT TRUE AND v_left = 10
           THEN 'OK' ELSE 'ECHEC' END,
      'refus attendu · reçu ' || COALESCE(v_res->>'reason', '(ok:true — FAILLE)')
        || ' · crédits d''autrui=' || v_left || ' (attendu 10, intacts)');
  END IF;

  -- ---------------------------------------------------------------------
  -- 5. Cours annulé : refus, sans décompter
  -- ---------------------------------------------------------------------
  UPDATE pack_purchases SET credits_remaining = 5 WHERE id = v_pack;
  UPDATE scheduled_classes SET is_cancelled = TRUE WHERE id = v_class2;

  v_res := book_class(v_class2, v_pack);
  SELECT credits_remaining INTO v_left FROM pack_purchases WHERE id = v_pack;

  INSERT INTO resultat VALUES (5, 'Cours annulé',
    CASE WHEN v_res->>'reason' = 'class_cancelled' AND v_left = 5
         THEN 'OK' ELSE 'ECHEC' END,
    'attendu class_cancelled · reçu ' || COALESCE(v_res->>'reason', '(ok:true !)')
      || ' · crédits=' || v_left || ' (attendu 5, non décomptés)');

  -- ---------------------------------------------------------------------
  -- 6. Cours déjà passé
  -- ---------------------------------------------------------------------
  UPDATE scheduled_classes
     SET is_cancelled = FALSE, starts_at = NOW() - INTERVAL '1 day'
   WHERE id = v_class2;

  v_res := book_class(v_class2, v_pack);

  INSERT INTO resultat VALUES (6, 'Cours passé',
    CASE WHEN (v_res->>'ok')::BOOLEAN IS NOT TRUE THEN 'OK' ELSE 'ECHEC' END,
    'refus attendu · reçu ' || COALESCE(v_res->>'reason', '(ok:true !)'));

  -- ---------------------------------------------------------------------
  -- 7. Sans source imposée : la fonction choisit le pack elle-même
  -- ---------------------------------------------------------------------
  INSERT INTO scheduled_classes (class_type_id, starts_at, max_participants)
  VALUES (v_class_ty, NOW() + INTERVAL '9 days', 5)
  RETURNING id INTO v_class2;

  v_res := book_class(v_class2);   -- second paramètre omis

  INSERT INTO resultat VALUES (7, 'Choix automatique du pack',
    CASE WHEN (v_res->>'ok')::BOOLEAN THEN 'OK' ELSE 'ECHEC' END,
    'pack choisi=' || COALESCE(LEFT(v_res->>'pack_purchase_id', 8), 'aucun')
      || ' · ' || COALESCE(v_res->>'reason', 'réservé'));

  -- ---------------------------------------------------------------------
  -- 8. Après annulation : réactiver, pas créer une seconde ligne
  -- ---------------------------------------------------------------------
  UPDATE bookings SET status = 'cancelled', cancelled_at = NOW()
   WHERE scheduled_class_id = v_class2 AND user_id = v_user;
  UPDATE pack_purchases SET credits_remaining = 5 WHERE id = v_pack;

  v_res := book_class(v_class2, v_pack);

  SELECT COUNT(*) INTO v_count
    FROM bookings WHERE scheduled_class_id = v_class2 AND user_id = v_user;

  INSERT INTO resultat VALUES (8, 'Réservation après annulation',
    CASE WHEN (v_res->>'ok')::BOOLEAN AND v_count = 1 THEN 'OK' ELSE 'ECHEC' END,
    'réactivation attendue · lignes en base=' || v_count || ' (attendu 1)');

EXCEPTION WHEN OTHERS THEN
  -- Une exception inattendue est un résultat comme un autre : on la consigne
  -- plutôt que de laisser le SQL Editor afficher une erreur nue.
  --
  -- À SAVOIR : un bloc `EXCEPTION` ouvre une sous-transaction. Si on arrive
  -- ici, tout ce que les cas précédents avaient écrit dans `resultat` est
  -- annulé avec le reste — le tableau n'affichera donc que CETTE ligne.
  -- C'est voulu : le message d'erreur est alors la seule chose qui compte,
  -- et il nomme le cas fautif. Les cas déjà passés se reverront au prochain
  -- lancement, une fois la cause corrigée.
  INSERT INTO resultat VALUES (99, 'ERREUR INATTENDUE', 'ECHEC',
    SQLERRM || ' (SQLSTATE ' || SQLSTATE || ')');
END $$;

-- ---------------------------------------------------------------------------
-- LE TABLEAU — c'est ce que le SQL Editor affiche
-- ---------------------------------------------------------------------------
SELECT ordre AS "#", cas AS "Cas testé", verdict AS "Verdict", detail AS "Détail"
FROM resultat

UNION ALL

SELECT 999, '── SYNTHÈSE ──',
       CASE WHEN EXISTS (SELECT 1 FROM resultat WHERE verdict = 'ECHEC')
            THEN 'ECHEC'
            ELSE 'TOUS LES CAS SONT PASSES' END,
       (SELECT COUNT(*)::TEXT FROM resultat WHERE verdict = 'OK') || ' OK · ' ||
       (SELECT COUNT(*)::TEXT FROM resultat WHERE verdict = 'ECHEC') || ' échec(s) · ' ||
       (SELECT COUNT(*)::TEXT FROM resultat WHERE verdict = 'IGNORE') || ' ignoré(s)'

ORDER BY 1;

ROLLBACK;   -- rien ne persiste

-- ============================================================================
-- LE TEST QUI MANQUE : deux réservations vraiment simultanées
-- ----------------------------------------------------------------------------
-- Le script ci-dessus vérifie la logique, pas le verrou : une transaction ne
-- peut pas entrer en concurrence avec elle-même.
--
-- Pour éprouver le verrou, il faut DEUX onglets du SQL Editor ouverts en même
-- temps, sur un cours à UNE place :
--
--   Onglet A                           Onglet B
--   --------                           --------
--   BEGIN;
--   SELECT book_class('<cours>');
--   -- ne pas valider tout de suite
--                                      BEGIN;
--                                      SELECT book_class('<cours>');
--                                      -- ATTEND (verrou tenu par A)
--   COMMIT;
--                                      -- se débloque et répond
--                                      -- {"ok":false,"reason":"class_full"}
--                                      ROLLBACK;
--
-- Le comportement attendu est que B ATTENDE pendant que A tient le verrou,
-- puis se voie refuser la place. Sans le verrou, B répondrait immédiatement
-- `ok:true` et le cours partirait à deux inscrits pour une seule place.
-- ============================================================================

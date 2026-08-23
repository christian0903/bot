-- ============================================================================
-- Réservation membre atomique : décider et écrire dans la même transaction
-- ----------------------------------------------------------------------------
-- CE QUI NE VA PAS AUJOURD'HUI
--
-- `confirmBooking()` réserve en quatre allers-retours depuis le navigateur :
--   1. `can_book_class`        — le cours est-il ouvert, reste-t-il de la place
--   2. `get_available_credits` — quelle source de paiement
--   3. INSERT dans `bookings`
--   4. `consume_credit`        — décrémenter
--
-- Entre 1 et 3, rien ne tient. Deux membres qui cliquent sur la dernière place
-- à la même seconde lisent tous les deux « une place libre » et écrivent tous
-- les deux : le cours part à 9 inscrits pour 8 places. Aucune contrainte en
-- base ne s'y oppose — `UNIQUE(scheduled_class_id, user_id)` protège de la
-- double inscription d'un MÊME membre, pas du dépassement de capacité.
--
-- L'étape 4 a son propre défaut : elle n'est pas contrôlée côté front, et
-- surtout `consume_credit` porte `AND credits_remaining > 0`. À zéro crédit,
-- elle ne touche aucune ligne et ne lève AUCUNE erreur. La réservation existe,
-- rien n'est débité. Tester `error` ne suffirait donc même pas.
--
-- Le projet connaît déjà ce raisonnement : le commentaire du trigger de quota
-- dit « les réservations partent d'un INSERT direct depuis le front, donc un
-- contrôle appelé côté client serait décoratif ». La leçon avait été appliquée
-- au quota, jamais à la capacité ni aux crédits. Cette fonction l'y applique.
--
-- CE QUE FAIT CETTE FONCTION
--
-- Le pendant membre de `book_member_by_staff` : mêmes contrôles, même écriture,
-- une seule transaction. Elle ne remplace pas les vérifications du front —
-- celles-ci restent utiles pour EXPLIQUER (« vos crédits se rechargent le 3 »,
-- « ce pack ne couvre pas ce type de cours ») ; elles cessent seulement d'être
-- ce sur quoi repose la justesse.
--
-- Le verrou est CONSULTATIF, posé sur l'identifiant du cours. Un
-- `SELECT ... FOR UPDATE` sur `scheduled_classes` marcherait aussi, mais
-- bloquerait un admin modifiant l'horaire pendant qu'un membre réserve. Ici on
-- ne sérialise que les réservations du même cours, ce qui est exactement le
-- conflit à traiter. Le verrou tombe à la fin de la transaction, quoi qu'il
-- arrive — pas de déverrouillage à écrire, donc pas de déverrouillage à
-- oublier.
-- ============================================================================

CREATE OR REPLACE FUNCTION book_class(
  p_class_id UUID,
  p_pack_purchase_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_user_id     UUID := auth.uid();
  v_check       JSONB;
  v_class       RECORD;
  v_pack        RECORD;
  v_booking_id  UUID;
  v_taken       INTEGER;
  v_consumed    INTEGER;
BEGIN
  -- On ne réserve que pour soi. Le staff inscrit un tiers par
  -- `book_member_by_staff`, qui porte ses propres contrôles de rôle.
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_authenticated');
  END IF;

  -- Le cours, lu une fois pour toutes : son type de crédit, sa date, sa
  -- capacité et son éventuelle annulation servent tous plus bas.
  SELECT class_type_id, starts_at, max_participants, is_cancelled
    INTO v_class
    FROM scheduled_classes
   WHERE id = p_class_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'class_not_found');
  END IF;

  -- Sérialiser les réservations de CE cours, et d'aucun autre.
  --
  -- Le verrou est pris avant de compter les places : le prendre après
  -- laisserait justement passer les deux lectures concurrentes qu'il existe
  -- pour empêcher. `hashtextextended` ramène l'UUID à la clé bigint attendue.
  PERFORM pg_advisory_xact_lock(hashtextextended(p_class_id::TEXT, 0));

  -- Heure de fermeture des réservations : règle d'exploitation, déléguée à
  -- `can_book_class` — la fonction que le front appelle déjà. La dupliquer
  -- garantirait qu'un jour les deux copies divergent. Ici elle s'exécute APRÈS
  -- le verrou, donc son verdict tient jusqu'à l'écriture.
  v_check := can_book_class(p_class_id, v_user_id);
  IF (v_check->>'can_book')::BOOLEAN IS NOT TRUE THEN
    RETURN jsonb_build_object('ok', false, 'reason', COALESCE(v_check->>'reason', 'not_bookable'));
  END IF;

  -- Les quatre refus qui ne se négocient pas, revérifiés ici.
  --
  -- Ce n'est pas de la méfiance envers `can_book_class` mais envers une de ses
  -- lignes : elle commence par lire le réglage `booking_rules` et, s'il est
  -- absent, retourne `can_book: true` AVANT d'avoir testé quoi que ce soit.
  -- Un réglage manquant ouvrirait alors les cours passés, annulés et complets.
  -- Le réglage est livré par `install.sql` et l'interface d'administration ne
  -- sait que le modifier — le cas est donc improbable, mais « improbable »
  -- n'est pas une garantie qu'on veut voir porter les places d'un cours.
  --
  -- Ces quatre contrôles-là sont bon marché et ne dépendent d'aucun réglage.
  IF v_class.is_cancelled THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'class_cancelled');
  END IF;

  IF v_class.starts_at <= NOW() THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'class_past');
  END IF;

  IF EXISTS (SELECT 1 FROM bookings
              WHERE scheduled_class_id = p_class_id
                AND user_id = v_user_id
                AND status = 'confirmed') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'already_booked');
  END IF;

  -- Le compte des places, sous verrou : c'est LA raison d'être de la fonction.
  SELECT COUNT(*) INTO v_taken
    FROM bookings
   WHERE scheduled_class_id = p_class_id
     AND status = 'confirmed';

  IF v_taken >= v_class.max_participants THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'class_full');
  END IF;

  -- Source de paiement : celle que le membre a choisie dans la pop-up, sinon
  -- la première utilisable (abonnement d'abord, cf. get_available_credits).
  --
  -- Le pack choisi est revalidé par le MÊME `get_available_credits` qui a
  -- servi à l'afficher : il porte déjà la couverture de la date du cours, le
  -- type de crédit et le quota du cycle. Le revérifier autrement, c'est
  -- réécrire ces règles une troisième fois.
  IF p_pack_purchase_id IS NOT NULL THEN
    SELECT c.pack_purchase_id, c.is_unlimited
      INTO v_pack
      FROM get_available_credits(
             v_user_id,
             (SELECT credit_type_id FROM class_types WHERE id = v_class.class_type_id),
             v_class.starts_at
           ) c
     WHERE c.pack_purchase_id = p_pack_purchase_id;
  ELSE
    SELECT c.pack_purchase_id, c.is_unlimited
      INTO v_pack
      FROM get_available_credits(
             v_user_id,
             (SELECT credit_type_id FROM class_types WHERE id = v_class.class_type_id),
             v_class.starts_at
           ) c
     LIMIT 1;
  END IF;

  -- Testé sur le champ plutôt que sur `NOT FOUND` : le drapeau serait écrasé
  -- par la première instruction SQL qu'on glisserait au-dessus.
  IF v_pack.pack_purchase_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'no_credit');
  END IF;

  -- DÉCOMPTE D'ABORD, RÉSERVATION ENSUITE.
  --
  -- L'ordre inverse serait plus naturel à lire, mais il obligerait à annuler
  -- une réservation déjà écrite quand le crédit manque — donc à lever une
  -- exception pour provoquer le ROLLBACK, et à faire gérer au front DEUX
  -- formes de refus pour la même fonction : un `{ok:false}` pour tous les cas,
  -- et une erreur 400 pour celui-ci. En décomptant avant, le refus sort par le
  -- même chemin que les autres.
  --
  -- `consume_credit` ne peut pas servir ici : elle renvoie VOID, donc son
  -- échec est indiscernable de son succès — c'est précisément le défaut qu'on
  -- corrige. On refait son UPDATE, à l'identique, pour pouvoir compter les
  -- lignes touchées.
  --
  -- Un pack illimité ne décompte rien par construction : attendre une ligne
  -- touchée ferait échouer toutes ses réservations.
  IF NOT v_pack.is_unlimited THEN
    UPDATE pack_purchases
       SET credits_remaining = credits_remaining - 1
     WHERE id = v_pack.pack_purchase_id
       AND credits_remaining > 0;

    GET DIAGNOSTICS v_consumed = ROW_COUNT;
    IF v_consumed = 0 THEN
      RETURN jsonb_build_object('ok', false, 'reason', 'no_credit');
    END IF;
  END IF;

  -- Réactiver une annulation plutôt que d'en créer une seconde : la contrainte
  -- UNIQUE(scheduled_class_id, user_id) l'interdirait.
  UPDATE bookings
     SET status = 'confirmed',
         pack_purchase_id = v_pack.pack_purchase_id,
         cancelled_at = NULL,
         is_no_show = FALSE
   WHERE scheduled_class_id = p_class_id
     AND user_id = v_user_id
     AND status = 'cancelled'
  RETURNING id INTO v_booking_id;

  IF v_booking_id IS NULL THEN
    INSERT INTO bookings (scheduled_class_id, user_id, pack_purchase_id)
    VALUES (p_class_id, v_user_id, v_pack.pack_purchase_id)
    RETURNING id INTO v_booking_id;
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'booking_id', v_booking_id,
    'pack_purchase_id', v_pack.pack_purchase_id
  );
END;
$fn$;

COMMENT ON FUNCTION book_class(UUID, UUID) IS
  'Réservation d''un membre pour lui-même : contrôles et écriture dans une seule transaction, sous verrou du cours. Pendant de book_member_by_staff. Renvoie {ok, booking_id, pack_purchase_id} ou {ok:false, reason}.';

REVOKE ALL ON FUNCTION book_class(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION book_class(UUID, UUID) TO authenticated;

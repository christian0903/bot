-- ============================================================================
-- Plafond de fréquentation, couverture du cycle, réservations orphelines
-- ----------------------------------------------------------------------------
-- Trois règles liées, arrêtées avec le studio le 2026-08-08 après plusieurs
-- allers-retours (un quota par cycle et un quota calendaire ont été essayés
-- puis écartés — voir plus bas pourquoi).
--
-- 1. UN PLAFOND DE FRÉQUENTATION par type de pack : N cours par D jours.
-- 2. LA VALIDITÉ D'UN PACK se juge à la date du COURS, plus à celle de la
--    réservation.
-- 3. LES RÉSERVATIONS ORPHELINES sont annulées à la résiliation.
--
-- ---------------------------------------------------------------------------
-- Pourquoi une fenêtre glissante CENTRÉE
-- ---------------------------------------------------------------------------
-- On compte les cours situés à moins de D jours AVANT ou APRÈS la séance visée.
-- Les deux côtés comptent, sinon l'ordre des réservations suffit à contourner
-- la règle : en réservant du plus lointain au plus proche, chaque fenêtre
-- arrière serait vide au moment du test et tout passerait.
--
-- Une fenêtre CALENDAIRE (« 4 par semaine », lundi-dimanche) avait été essayée :
-- plus lisible, mais elle laisse cumuler 4 le dimanche et 4 le lundi.
--
-- Un quota PAR CYCLE d'abonnement avait aussi été essayé : il se rechargeait au
-- renouvellement, mais ne valait que pour les abonnements et butait sur le fait
-- que le cycle suivant n'existe pas encore en base au moment de réserver.
--
-- ---------------------------------------------------------------------------
-- Pourquoi D est borné à 14 jours
-- ---------------------------------------------------------------------------
-- Au-delà de deux semaines, un plafond ne contraint plus le rythme : « 50 cours
-- par 28 jours » laisse en faire 50 la première semaine puis rien pendant
-- trois — exactement la surconsommation qu'on veut empêcher. Une fenêtre large
-- régule la comptabilité au lieu de la fréquentation.
--
-- Borne FIXE plutôt que calculée par pack : une borne qui suivrait
-- `validity_days` serait illisible, et n'aurait aucun sens sur un pack ponctuel
-- valable un an.
--
-- ---------------------------------------------------------------------------
-- La fenêtre ignore les cycles, volontairement
-- ---------------------------------------------------------------------------
-- Le plafond limite le rythme physique, pas la facturation : quelqu'un qui a
-- beaucoup fréquenté fin août reste bridé début septembre, même après un
-- nouveau prélèvement. Décision explicite du studio. Avec D ≤ 14 l'effet reste
-- marginal.
-- ============================================================================

ALTER TABLE pack_types
  ADD COLUMN IF NOT EXISTS quota_sessions INTEGER
    CHECK (quota_sessions IS NULL OR quota_sessions > 0),
  ADD COLUMN IF NOT EXISTS quota_days INTEGER;

ALTER TABLE pack_types DROP CONSTRAINT IF EXISTS quota_days_range;
ALTER TABLE pack_types ADD CONSTRAINT quota_days_range CHECK (
  quota_days IS NULL OR (quota_days >= 1 AND quota_days <= 14)
);

-- Les deux vont ensemble : un plafond sans fenêtre, ou l'inverse, ne veut rien
-- dire.
ALTER TABLE pack_types DROP CONSTRAINT IF EXISTS quota_both_or_none;
ALTER TABLE pack_types ADD CONSTRAINT quota_both_or_none CHECK (
  (quota_sessions IS NULL AND quota_days IS NULL)
  OR (quota_sessions IS NOT NULL AND quota_days IS NOT NULL)
);

COMMENT ON COLUMN pack_types.quota_sessions IS
  'Nombre maximal de cours sur une fenêtre glissante de `quota_days` centrée sur la séance visée. NULL = aucun plafond.';
COMMENT ON COLUMN pack_types.quota_days IS
  'Demi-largeur de la fenêtre, en jours (1 à 14). On compte les cours situés à moins de D jours avant ou après la séance visée.';

-- ---------------------------------------------------------------------------
-- Le plafond est-il atteint pour ce cours ?
-- ---------------------------------------------------------------------------
-- Compté sur le pack visé uniquement : c'est lui qui porte la règle, et un
-- membre qui possède deux packs distincts a payé deux fois.
CREATE OR REPLACE FUNCTION check_pack_quota(
  p_user_id UUID,
  p_pack_purchase_id UUID,
  p_class_starts_at TIMESTAMPTZ DEFAULT NULL
)
RETURNS JSONB
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
STABLE
AS $fn$
DECLARE
  v_quota INTEGER;
  v_days  INTEGER;
  v_used  INTEGER;
BEGIN
  SELECT pt.quota_sessions, pt.quota_days
    INTO v_quota, v_days
  FROM pack_purchases pp
  JOIN pack_types pt ON pt.id = pp.pack_type_id
  WHERE pp.id = p_pack_purchase_id;

  -- Sans plafond, ou sans date de cours (la fenêtre en dépend) : rien à dire.
  IF v_quota IS NULL OR p_class_starts_at IS NULL THEN
    RETURN jsonb_build_object('ok', true);
  END IF;

  SELECT COUNT(*) INTO v_used
  FROM bookings b
  JOIN scheduled_classes sc ON sc.id = b.scheduled_class_id
  WHERE b.user_id = p_user_id
    AND b.pack_purchase_id = p_pack_purchase_id
    AND b.status = 'confirmed'
    AND NOT sc.is_cancelled
    -- Centrée : D jours de part et d'autre.
    AND sc.starts_at > p_class_starts_at - (v_days || ' days')::INTERVAL
    AND sc.starts_at < p_class_starts_at + (v_days || ' days')::INTERVAL;

  RETURN jsonb_build_object(
    'ok', v_used < v_quota,
    'reason', CASE WHEN v_used >= v_quota THEN 'quota_reached' ELSE NULL END,
    'quota_sessions', v_quota,
    'quota_days', v_days,
    'used', v_used,
    'remaining', GREATEST(0, v_quota - v_used)
  );
END;
$fn$;

COMMENT ON FUNCTION check_pack_quota IS
  'Le plafond est-il atteint ? Compte les cours du membre situés à moins de `quota_days` avant ou après la séance visée. Sans date de cours, ne vérifie rien : la fenêtre en dépend.';

-- ---------------------------------------------------------------------------
-- Le plafond se fait respecter par un TRIGGER
-- ---------------------------------------------------------------------------
-- Les réservations partent d'un INSERT direct depuis le front (policy
-- « Bookings: own insert »). Un contrôle appelé côté client serait décoratif :
-- il suffirait d'appeler l'API sans lui.
--
-- Le STAFF passe outre, comme il ignore déjà le délai de fermeture : le coach a
-- la personne devant lui et décide. Il est identifié et ses gestes sont
-- journalisés.
CREATE OR REPLACE FUNCTION enforce_unlimited_quota()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $fn$
DECLARE
  v_starts_at TIMESTAMPTZ;
  v_check     JSONB;
BEGIN
  IF NEW.pack_purchase_id IS NULL OR NEW.status <> 'confirmed' THEN
    RETURN NEW;
  END IF;

  IF has_role(auth.uid(), 'coach')
     OR has_role(auth.uid(), 'admin')
     OR has_role(auth.uid(), 'super_admin') THEN
    RETURN NEW;
  END IF;

  SELECT starts_at INTO v_starts_at
  FROM scheduled_classes WHERE id = NEW.scheduled_class_id;

  v_check := check_pack_quota(NEW.user_id, NEW.pack_purchase_id, v_starts_at);

  IF (v_check->>'ok')::BOOLEAN IS NOT TRUE THEN
    RAISE EXCEPTION 'quota_reached: % cours par % jours',
      v_check->>'quota_sessions', v_check->>'quota_days'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$fn$;

DROP TRIGGER IF EXISTS trg_enforce_unlimited_quota ON bookings;
CREATE TRIGGER trg_enforce_unlimited_quota
  BEFORE INSERT ON bookings
  FOR EACH ROW
  EXECUTE FUNCTION enforce_unlimited_quota();

COMMENT ON FUNCTION enforce_unlimited_quota IS
  'Refuse une réservation qui dépasserait le plafond de fréquentation. Le staff n''est pas concerné.';

-- ---------------------------------------------------------------------------
-- La validité se juge à la DATE DU COURS
-- ---------------------------------------------------------------------------
-- Avant, le filtre était `expires_at > NOW()` : un membre pouvait payer un
-- cours du cycle suivant avec le cycle courant.
--
-- TOLÉRANCE : un abonnement qui se renouvelle couvre les cours au-delà de son
-- terme. Sans elle, plus aucune réservation anticipée ne serait possible en fin
-- de cycle, ce qui punirait l'abonné fidèle. Elle s'arrête là où le
-- renouvellement s'arrête — un abonnement résilié ne couvre rien au-delà.
--
-- La tolérance ne joue QUE sur la couverture, pas sur les crédits : un pack à
-- crédits épuisé reste bloqué jusqu'au renouvellement. C'est voulu — on ne
-- consomme pas un crédit qui n'existe pas encore. `why_no_credit_for_class`
-- explique alors la situation au membre plutôt que de l'envoyer en boutique.
CREATE OR REPLACE FUNCTION get_available_credits(
  p_user_id UUID,
  p_credit_type_id UUID,
  p_class_starts_at TIMESTAMPTZ
)
RETURNS TABLE(
  pack_purchase_id UUID,
  credits_remaining INTEGER,
  expires_at TIMESTAMPTZ,
  is_unlimited BOOLEAN,
  pack_name TEXT,
  subscription_id UUID,
  is_subscription BOOLEAN
) AS $$
  SELECT
    pp.id,
    pp.credits_remaining,
    pp.expires_at,
    pt.is_unlimited,
    pt.name,
    pp.subscription_id,
    (pp.subscription_id IS NOT NULL) AS is_subscription
  FROM pack_purchases pp
  JOIN pack_types pt ON pp.pack_type_id = pt.id
  LEFT JOIN subscriptions s ON s.id = pp.subscription_id
  WHERE pp.user_id = p_user_id
    AND pt.credit_type_id = p_credit_type_id
    AND (pt.is_unlimited OR pp.credits_remaining > 0)
    AND pp.expires_at > NOW()
    AND (
      p_class_starts_at IS NULL
      OR pp.expires_at > p_class_starts_at
      OR (s.id IS NOT NULL
          AND s.status = 'active'
          AND COALESCE(s.cancel_at_period_end, FALSE) = FALSE)
    )
    -- Plafond de fréquentation, fenêtre glissante centrée.
    AND (
      pt.quota_sessions IS NULL
      OR p_class_starts_at IS NULL
      OR (SELECT COUNT(*) FROM bookings b
          JOIN scheduled_classes sc ON sc.id = b.scheduled_class_id
          WHERE b.user_id = p_user_id
            AND b.pack_purchase_id = pp.id
            AND b.status = 'confirmed'
            AND NOT sc.is_cancelled
            AND sc.starts_at > p_class_starts_at - (pt.quota_days || ' days')::INTERVAL
            AND sc.starts_at < p_class_starts_at + (pt.quota_days || ' days')::INTERVAL
         ) < pt.quota_sessions
    )
  -- Abonnement d'abord : il est déjà facturé, les crédits achetés à côté
  -- restent au membre. Entre deux packs, celui qui expire le plus tôt.
  ORDER BY (pp.subscription_id IS NOT NULL) DESC, pp.expires_at ASC;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

COMMENT ON FUNCTION get_available_credits(UUID, UUID, TIMESTAMPTZ) IS
  'Sources de paiement d''un membre, abonnement en tête. Si `p_class_starts_at` est fourni, écarte les packs qui ne couvrent pas la date du cours — sauf abonnement en cours de renouvellement — et ceux dont le plafond est atteint.';

-- L'ancienne signature reste pour les appels sans cours en tête (affichage des
-- crédits, achat). Elle délègue, pour qu'il n'existe qu'une seule logique.
CREATE OR REPLACE FUNCTION get_available_credits(p_user_id UUID, p_credit_type_id UUID)
RETURNS TABLE(
  pack_purchase_id UUID,
  credits_remaining INTEGER,
  expires_at TIMESTAMPTZ,
  is_unlimited BOOLEAN,
  pack_name TEXT,
  subscription_id UUID,
  is_subscription BOOLEAN
) AS $$
  SELECT * FROM get_available_credits(p_user_id, p_credit_type_id, NULL::TIMESTAMPTZ);
$$ LANGUAGE sql SECURITY DEFINER STABLE;

COMMENT ON FUNCTION get_available_credits(UUID, UUID) IS
  'Raccourci sans date de cours : ne filtre ni sur la couverture ni sur le plafond. Pour une réservation, préférer la variante à trois arguments.';

-- ---------------------------------------------------------------------------
-- Pourquoi aucun crédit ne couvre ce cours ?
-- ---------------------------------------------------------------------------
-- Une liste vide ne dit pas pourquoi. Quatre causes très différentes se cachent
-- derrière, et les confondre sous « aucun crédit » enverrait vers la boutique
-- quelqu'un qui a déjà payé.
CREATE OR REPLACE FUNCTION why_no_credit_for_class(
  p_user_id UUID,
  p_class_id UUID
)
RETURNS JSONB
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
STABLE
AS $fn$
DECLARE
  v_class RECORD;
  v_pack  RECORD;
BEGIN
  SELECT sc.starts_at, ct.credit_type_id
    INTO v_class
  FROM scheduled_classes sc
  JOIN class_types ct ON ct.id = sc.class_type_id
  WHERE sc.id = p_class_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('reason', 'class_not_found');
  END IF;

  -- 1. Un pack du bon type, valide, couvrant le cours, mais au plafond.
  SELECT pt.quota_sessions, pt.quota_days INTO v_pack
  FROM pack_purchases pp
  JOIN pack_types pt ON pt.id = pp.pack_type_id
  WHERE pp.user_id = p_user_id
    AND pt.credit_type_id = v_class.credit_type_id
    AND pp.expires_at > NOW()
    AND pt.quota_sessions IS NOT NULL
    AND (pt.is_unlimited OR pp.credits_remaining > 0)
    AND (SELECT COUNT(*) FROM bookings b
         JOIN scheduled_classes sc2 ON sc2.id = b.scheduled_class_id
         WHERE b.user_id = p_user_id
           AND b.pack_purchase_id = pp.id
           AND b.status = 'confirmed'
           AND NOT sc2.is_cancelled
           AND sc2.starts_at > v_class.starts_at - (pt.quota_days || ' days')::INTERVAL
           AND sc2.starts_at < v_class.starts_at + (pt.quota_days || ' days')::INTERVAL
        ) >= pt.quota_sessions
  LIMIT 1;

  IF FOUND THEN
    RETURN jsonb_build_object(
      'reason', 'quota_reached',
      'quota_sessions', v_pack.quota_sessions,
      'quota_days', v_pack.quota_days
    );
  END IF;

  -- 2. Un abonnement RÉSILIÉ dont le terme tombe avant le cours.
  SELECT s.current_period_end INTO v_pack
  FROM pack_purchases pp
  JOIN pack_types pt ON pt.id = pp.pack_type_id
  JOIN subscriptions s ON s.id = pp.subscription_id
  WHERE pp.user_id = p_user_id
    AND pt.credit_type_id = v_class.credit_type_id
    AND pp.expires_at > NOW()
    AND pp.expires_at <= v_class.starts_at
    AND (s.status <> 'active' OR COALESCE(s.cancel_at_period_end, FALSE))
  LIMIT 1;

  IF FOUND THEN
    RETURN jsonb_build_object(
      'reason', 'subscription_ending',
      'detail', to_char(v_pack.current_period_end AT TIME ZONE 'Europe/Brussels', 'DD/MM/YYYY'));
  END IF;

  -- 3. Un abonnement À JOUR dont les crédits sont épuisés : le prochain cycle
  -- les rechargera. Le membre n'a rien à racheter, juste à attendre.
  SELECT pp.expires_at INTO v_pack
  FROM pack_purchases pp
  JOIN pack_types pt ON pt.id = pp.pack_type_id
  JOIN subscriptions s ON s.id = pp.subscription_id
  WHERE pp.user_id = p_user_id
    AND pt.credit_type_id = v_class.credit_type_id
    AND pp.expires_at > NOW()
    AND NOT pt.is_unlimited
    AND pp.credits_remaining <= 0
    AND s.status = 'active'
    AND COALESCE(s.cancel_at_period_end, FALSE) = FALSE
  ORDER BY pp.expires_at ASC
  LIMIT 1;

  IF FOUND THEN
    RETURN jsonb_build_object(
      'reason', 'credits_exhausted_renewal',
      'detail', to_char(v_pack.expires_at AT TIME ZONE 'Europe/Brussels', 'DD/MM/YYYY'),
      -- Le cours tombe-t-il après le renouvellement ? Si oui, il sera
      -- réservable ; sinon il faut un autre pack.
      'after_renewal', v_class.starts_at >= v_pack.expires_at);
  END IF;

  RETURN jsonb_build_object('reason', 'no_credit');
END;
$fn$;

COMMENT ON FUNCTION why_no_credit_for_class IS
  'Explique pourquoi aucun crédit ne couvre ce cours : plafond atteint, abonnement se terminant avant la séance, crédits épuisés en attente de renouvellement, ou absence réelle de crédit.';

-- ---------------------------------------------------------------------------
-- Où en est le membre sur son plafond ?
-- ---------------------------------------------------------------------------
-- Un plafond qu'on découvre en butant dessus au moment de réserver est vécu
-- comme une panne. La fenêtre étant glissante, on la calcule autour
-- d'AUJOURD'HUI — c'est celle qui parle au moment où il regarde.
CREATE OR REPLACE FUNCTION my_pack_quota_usage()
RETURNS TABLE (
  pack_purchase_id UUID,
  quota_sessions INTEGER,
  quota_days INTEGER,
  used INTEGER,
  remaining INTEGER
)
SECURITY DEFINER
SET search_path = public
LANGUAGE sql
STABLE
AS $fn$
  SELECT pp.id,
         pt.quota_sessions,
         pt.quota_days,
         COUNT(b.id)::INTEGER,
         GREATEST(0, pt.quota_sessions - COUNT(b.id))::INTEGER
  FROM pack_purchases pp
  JOIN pack_types pt ON pt.id = pp.pack_type_id
  LEFT JOIN bookings b ON b.pack_purchase_id = pp.id
    AND b.user_id = auth.uid()
    AND b.status = 'confirmed'
    AND EXISTS (SELECT 1 FROM scheduled_classes sc
                WHERE sc.id = b.scheduled_class_id
                  AND NOT sc.is_cancelled
                  AND sc.starts_at > NOW() - (pt.quota_days || ' days')::INTERVAL
                  AND sc.starts_at < NOW() + (pt.quota_days || ' days')::INTERVAL)
  WHERE pp.user_id = auth.uid()
    AND pt.quota_sessions IS NOT NULL
    AND pp.expires_at > NOW()
  GROUP BY pp.id, pt.quota_sessions, pt.quota_days;
$fn$;

COMMENT ON FUNCTION my_pack_quota_usage IS
  'Consommation du plafond sur la fenêtre glissante autour d''aujourd''hui. Vide si aucun pack de l''appelant n''a de plafond.';

-- ---------------------------------------------------------------------------
-- Réservations orphelines : annulées à la résiliation
-- ---------------------------------------------------------------------------
-- Les cours réservés au-delà du terme d'un abonnement qui ne se renouvellera
-- pas : personne ne les paiera.
--
-- POURQUOI UN TRIGGER SUR `subscriptions` plutôt qu'un appel dans
-- `cancel-my-subscription` : une résiliation arrive par au moins trois routes —
-- la fonction de l'app, le webhook Stripe (quatre endroits y écrivent
-- `cancel_at_period_end`), et le dashboard Stripe où le studio agit à la main.
-- Le seul point commun est cette table.
--
-- POURQUOI À LA RÉSILIATION et non au renouvellement : au renouvellement il n'y
-- a rien à annuler, le cycle suivant est payé. Attendre le terme préviendrait
-- le membre des semaines trop tard.
--
-- La coupure se fait à l'HEURE près, pas à la journée : un membre qui
-- s'entraîne le matin de son dernier jour garde sa séance. Cohérent avec
-- Stripe, qui raisonne aussi à l'horodatage.
CREATE OR REPLACE FUNCTION cancel_orphan_bookings_on_subscription_end()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $fn$
DECLARE
  v_cutoff  TIMESTAMPTZ;
  v_booking RECORD;
BEGIN
  IF NOT (
    (COALESCE(NEW.cancel_at_period_end, FALSE) AND NOT COALESCE(OLD.cancel_at_period_end, FALSE))
    OR (NEW.status IN ('canceled', 'unpaid', 'incomplete_expired') AND OLD.status <> NEW.status)
  ) THEN
    RETURN NEW;
  END IF;

  v_cutoff := COALESCE(NEW.current_period_end, NOW());

  -- Un abonnement résilié en fin de période garde ses droits jusqu'au terme ;
  -- un abonnement déjà mort ne couvre plus rien.
  IF NEW.status IN ('canceled', 'unpaid', 'incomplete_expired') THEN
    v_cutoff := LEAST(v_cutoff, NOW());
  END IF;

  FOR v_booking IN
    SELECT b.id, b.user_id, b.pack_purchase_id,
           sc.starts_at, COALESCE(sc.title, ct.name) AS class_name
    FROM bookings b
    JOIN pack_purchases pp ON pp.id = b.pack_purchase_id
    JOIN scheduled_classes sc ON sc.id = b.scheduled_class_id
    LEFT JOIN class_types ct ON ct.id = sc.class_type_id
    WHERE pp.subscription_id = NEW.id
      AND b.status = 'confirmed'
      AND sc.starts_at > v_cutoff
      AND NOT sc.is_cancelled
  LOOP
    UPDATE bookings
    SET status = 'cancelled', cancelled_at = NOW()
    WHERE id = v_booking.id;

    -- Aucun crédit à restituer : sur un illimité rien n'a été décompté, et le
    -- cycle qui aurait payé ce cours n'existera jamais.

    INSERT INTO notifications (user_id, type, title, message)
    VALUES (
      v_booking.user_id,
      'booking_cancelled',
      'Réservation annulée — fin d''abonnement',
      format(
        'Votre réservation pour %s du %s a été annulée : votre abonnement se termine le %s et ne couvre pas cette séance. Vous pouvez la réserver à nouveau avec un autre pack.',
        v_booking.class_name,
        to_char(v_booking.starts_at AT TIME ZONE 'Europe/Brussels', 'DD/MM/YYYY à HH24:MI'),
        to_char(v_cutoff AT TIME ZONE 'Europe/Brussels', 'DD/MM/YYYY')
      )
    );

    -- Une trace PAR réservation : chercher pourquoi un cours précis a disparu
    -- est la question qu'on se posera, pas combien il y en a eu.
    INSERT INTO activity_log (action, actor_id, target_user_id, entity_type, entity_id, description)
    VALUES (
      'booking_cancelled',
      auth.uid(),
      v_booking.user_id,
      'booking',
      v_booking.id,
      format('Annulée automatiquement — fin d''abonnement au %s : %s du %s',
             to_char(v_cutoff AT TIME ZONE 'Europe/Brussels', 'DD/MM/YYYY'),
             v_booking.class_name,
             to_char(v_booking.starts_at AT TIME ZONE 'Europe/Brussels', 'DD/MM/YYYY à HH24:MI'))
    );
  END LOOP;

  RETURN NEW;
END;
$fn$;

DROP TRIGGER IF EXISTS trg_cancel_orphan_bookings ON subscriptions;
CREATE TRIGGER trg_cancel_orphan_bookings
  AFTER UPDATE ON subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION cancel_orphan_bookings_on_subscription_end();

COMMENT ON FUNCTION cancel_orphan_bookings_on_subscription_end IS
  'Annule les réservations situées au-delà du terme d''un abonnement résilié, prévient le membre et journalise chaque annulation. Posé sur la table plutôt que dans la fonction de résiliation : Stripe et le dashboard écrivent ici aussi.';

REVOKE ALL ON FUNCTION check_pack_quota(UUID, UUID, TIMESTAMPTZ) FROM PUBLIC;
REVOKE ALL ON FUNCTION why_no_credit_for_class(UUID, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION my_pack_quota_usage() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION check_pack_quota(UUID, UUID, TIMESTAMPTZ) TO authenticated;
GRANT EXECUTE ON FUNCTION why_no_credit_for_class(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION my_pack_quota_usage() TO authenticated;

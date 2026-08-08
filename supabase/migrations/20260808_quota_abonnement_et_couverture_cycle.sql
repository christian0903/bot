-- ============================================================================
-- Abonnements : plafond de séances par cycle, et couverture réelle du cycle
-- ----------------------------------------------------------------------------
-- Deux règles liées, qui répondent au même problème : « illimité » sans
-- garde-fou laisse quelqu'un venir tous les jours et occuper les places au
-- détriment des autres, et rien n'empêchait de payer un cours du cycle suivant
-- avec le cycle courant.
--
-- LE CYCLE EST UNE LIGNE, PAS UN CALCUL. Chaque renouvellement Stripe crée une
-- ligne `pack_purchases` avec ses propres bornes. Il n'y a donc jamais à
-- deviner « dans quel cycle sommes-nous » : la ligne dont `expires_at > NOW()`
-- EST le cycle courant. C'est ce qui rend ces règles simples à écrire.
--
-- LE QUOTA SE COMPTE SUR LA DATE DES COURS, pas sur celle des réservations.
-- La nuance décide d'un cas réel : un abonné qui a consommé ses 4 séances veut
-- réserver, la veille du renouvellement, un cours de la semaine suivante. Ce
-- cours appartient au cycle suivant et ne doit pas être refusé — or le cycle
-- suivant n'existe pas encore en base (il naîtra du prélèvement Stripe), donc
-- la réservation porte forcément le cycle courant. Compter les réservations
-- l'aurait refusée ; compter les cours l'accepte.
--
-- Pas de durée à régler : la période, c'est le cycle lui-même. En saisir une
-- seconde rouvrirait un décalage (un quota sur 30 jours dans un cycle de 28).
-- ============================================================================

ALTER TABLE pack_types
  ADD COLUMN IF NOT EXISTS quota_sessions INTEGER
    CHECK (quota_sessions IS NULL OR quota_sessions > 0);

COMMENT ON COLUMN pack_types.quota_sessions IS
  'Nombre maximal de séances par cycle d''abonnement. NULL = aucun plafond. Se recharge à chaque renouvellement, puisqu''un cycle est une ligne `pack_purchases` distincte.';

-- ---------------------------------------------------------------------------
-- Le quota du cycle est-il atteint ?
-- ---------------------------------------------------------------------------
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
  v_from  TIMESTAMPTZ;
  v_to    TIMESTAMPTZ;
  v_used  INTEGER;
BEGIN
  SELECT pt.quota_sessions, pp.purchased_at, pp.expires_at
    INTO v_quota, v_from, v_to
  FROM pack_purchases pp
  JOIN pack_types pt ON pt.id = pp.pack_type_id
  WHERE pp.id = p_pack_purchase_id;

  IF v_quota IS NULL THEN
    RETURN jsonb_build_object('ok', true);
  END IF;

  -- Le cours visé sort du cycle : il relève du suivant, dont le quota est
  -- intact.
  IF p_class_starts_at IS NOT NULL AND p_class_starts_at >= v_to THEN
    RETURN jsonb_build_object('ok', true, 'next_cycle', true);
  END IF;

  SELECT COUNT(*) INTO v_used
  FROM bookings b
  JOIN scheduled_classes sc ON sc.id = b.scheduled_class_id
  WHERE b.pack_purchase_id = p_pack_purchase_id
    AND b.status = 'confirmed'
    AND NOT sc.is_cancelled
    -- Seuls les cours qui tombent DANS le cycle le consomment.
    AND sc.starts_at >= v_from
    AND sc.starts_at < v_to;

  RETURN jsonb_build_object(
    'ok', v_used < v_quota,
    'reason', CASE WHEN v_used >= v_quota THEN 'quota_reached' ELSE NULL END,
    'quota_sessions', v_quota,
    'used', v_used,
    'remaining', GREATEST(0, v_quota - v_used)
  );
END;
$fn$;

COMMENT ON FUNCTION check_pack_quota IS
  'Le quota du cycle est-il atteint ? Compte les cours dont la DATE tombe dans le cycle : une séance du cycle suivant n''entame pas le quota courant, même si elle est réservée aujourd''hui.';

-- ---------------------------------------------------------------------------
-- Le quota se fait respecter par un TRIGGER
-- ---------------------------------------------------------------------------
-- Les réservations partent d'un INSERT direct depuis le front (policy
-- « Bookings: own insert »). Un contrôle appelé côté client serait donc
-- décoratif : il suffirait d'appeler l'API sans lui.
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
    RAISE EXCEPTION 'quota_reached: % seances par cycle', v_check->>'quota_sessions'
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
  'Refuse une réservation qui dépasserait le quota du cycle. Le staff n''est pas concerné.';

-- ---------------------------------------------------------------------------
-- La validité se juge à la DATE DU COURS
-- ---------------------------------------------------------------------------
-- Avant, le filtre était `expires_at > NOW()` : un membre pouvait payer un
-- cours du cycle suivant avec le cycle courant.
--
-- TOLÉRANCE : un abonnement qui se renouvelle couvre les cours au-delà de son
-- terme. Sans elle, plus aucune réservation anticipée ne serait possible en fin
-- de cycle, ce qui punirait l'abonné fidèle. Elle s'arrête là où le
-- renouvellement s'arrête : un abonnement résilié ne couvre rien au-delà.
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
    AND (
      pt.quota_sessions IS NULL
      OR (p_class_starts_at IS NOT NULL AND p_class_starts_at >= pp.expires_at)
      OR (SELECT COUNT(*) FROM bookings b
          JOIN scheduled_classes sc ON sc.id = b.scheduled_class_id
          WHERE b.pack_purchase_id = pp.id
            AND b.status = 'confirmed'
            AND NOT sc.is_cancelled
            AND sc.starts_at >= pp.purchased_at
            AND sc.starts_at < pp.expires_at) < pt.quota_sessions
    )
  ORDER BY (pp.subscription_id IS NOT NULL) DESC, pp.expires_at ASC;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

COMMENT ON FUNCTION get_available_credits(UUID, UUID, TIMESTAMPTZ) IS
  'Sources de paiement d''un membre, abonnement en tête. Si `p_class_starts_at` est fourni, écarte les packs qui ne couvrent pas la date du cours — sauf abonnement en cours de renouvellement — et ceux dont le quota du cycle est épuisé.';

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
  'Raccourci sans date de cours : ne filtre ni sur la couverture du cycle ni sur le quota. Pour une réservation, préférer la variante à trois arguments.';

-- ---------------------------------------------------------------------------
-- Pourquoi aucun crédit ne couvre ce cours ?
-- ---------------------------------------------------------------------------
-- Une liste vide ne dit pas pourquoi. Trois causes très différentes se cachent
-- derrière : quota épuisé, abonnement se terminant avant le cours, ou absence
-- réelle de crédit. Les confondre enverrait vers la boutique quelqu'un qui a
-- déjà payé.
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

  -- Un pack du BON type, encore valide, mais dont le quota du cycle est plein.
  SELECT pt.quota_sessions, pt.name INTO v_pack
  FROM pack_purchases pp
  JOIN pack_types pt ON pt.id = pp.pack_type_id
  WHERE pp.user_id = p_user_id
    AND pt.credit_type_id = v_class.credit_type_id
    AND pp.expires_at > NOW()
    AND pt.quota_sessions IS NOT NULL
    AND v_class.starts_at < pp.expires_at
    AND (SELECT COUNT(*) FROM bookings b
         JOIN scheduled_classes sc2 ON sc2.id = b.scheduled_class_id
         WHERE b.pack_purchase_id = pp.id
           AND b.status = 'confirmed'
           AND NOT sc2.is_cancelled
           AND sc2.starts_at >= pp.purchased_at
           AND sc2.starts_at < pp.expires_at) >= pt.quota_sessions
  LIMIT 1;

  IF FOUND THEN
    RETURN jsonb_build_object(
      'reason', 'quota_reached',
      'detail', v_pack.quota_sessions || ' séances'
    );
  END IF;

  -- Un abonnement résilié dont le terme tombe avant le cours.
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
      'detail', to_char(v_pack.current_period_end AT TIME ZONE 'Europe/Brussels', 'DD/MM/YYYY')
    );
  END IF;

  RETURN jsonb_build_object('reason', 'no_credit');
END;
$fn$;

COMMENT ON FUNCTION why_no_credit_for_class IS
  'Explique pourquoi aucun crédit ne couvre ce cours : quota du cycle épuisé, abonnement se terminant avant la séance, ou absence réelle de crédit.';

-- ---------------------------------------------------------------------------
-- Où en est le membre sur son quota ?
-- ---------------------------------------------------------------------------
-- Un plafond qu'on découvre en butant dessus au moment de réserver est vécu
-- comme une panne. On le montre d'avance, à côté du pack.
CREATE OR REPLACE FUNCTION my_pack_quota_usage()
RETURNS TABLE (
  pack_purchase_id UUID,
  quota_sessions INTEGER,
  used INTEGER,
  remaining INTEGER,
  period_end TIMESTAMPTZ
)
SECURITY DEFINER
SET search_path = public
LANGUAGE sql
STABLE
AS $fn$
  SELECT pp.id,
         pt.quota_sessions,
         COUNT(b.id)::INTEGER,
         GREATEST(0, pt.quota_sessions - COUNT(b.id))::INTEGER,
         pp.expires_at
  FROM pack_purchases pp
  JOIN pack_types pt ON pt.id = pp.pack_type_id
  LEFT JOIN bookings b ON b.pack_purchase_id = pp.id
    AND b.status = 'confirmed'
    AND EXISTS (SELECT 1 FROM scheduled_classes sc
                WHERE sc.id = b.scheduled_class_id
                  AND NOT sc.is_cancelled
                  AND sc.starts_at >= pp.purchased_at
                  AND sc.starts_at < pp.expires_at)
  WHERE pp.user_id = auth.uid()
    AND pt.quota_sessions IS NOT NULL
    AND pp.expires_at > NOW()
  GROUP BY pp.id, pt.quota_sessions, pp.expires_at;
$fn$;

COMMENT ON FUNCTION my_pack_quota_usage IS
  'Consommation du quota sur les cycles en cours de l''appelant. Vide si aucun de ses packs n''a de plafond.';

-- ---------------------------------------------------------------------------
-- Réservations orphelines à la résiliation
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
-- a rien à annuler, le cycle suivant est payé. Et attendre le terme préviendrait
-- le membre des semaines trop tard — il doit l'apprendre quand il résilie.
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

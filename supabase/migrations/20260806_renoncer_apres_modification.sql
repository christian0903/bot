-- Renoncer à un cours dont l'horaire ou le type a changé
--
-- Quand le studio déplace un cours ou en change la nature, la prestation
-- n'est plus celle pour laquelle le membre s'était inscrit. On lui propose
-- de renoncer avec restitution — mais `cancel_booking_v2` applique le délai
-- de prévenance : si le cours est déplacé à moins de 12 h, le membre y
-- perdrait son crédit alors qu'il n'a rien demandé.
--
-- Cette fonction restitue toujours, comme une annulation par le studio : la
-- décision vient bien de lui, le membre ne fait que la subir.
--
-- Garde-fou : elle n'accepte que les réservations dont le cours a été modifié
-- après la réservation. Sans cela, elle deviendrait une porte de sortie sans
-- délai pour n'importe quelle annulation.

CREATE OR REPLACE FUNCTION decline_modified_booking(p_booking_id UUID)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER
AS $fn$
DECLARE
  v_booking RECORD;
  v_class RECORD;
BEGIN
  SELECT * INTO v_booking FROM bookings
   WHERE id = p_booking_id
     AND user_id = auth.uid()          -- on ne renonce que pour soi
     AND status = 'confirmed';

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'booking_not_found');
  END IF;

  SELECT * INTO v_class FROM scheduled_classes WHERE id = v_booking.scheduled_class_id;

  IF v_class.starts_at < NOW() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'class_past');
  END IF;

  -- Le cours doit avoir été modifié APRÈS la réservation : c'est ce qui
  -- justifie la restitution hors délai.
  IF v_class.updated_at IS NULL OR v_class.updated_at <= v_booking.created_at THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_modified');
  END IF;

  UPDATE bookings
     SET status = 'cancelled', cancelled_at = NOW(), is_no_show = FALSE
   WHERE id = p_booking_id;

  -- Restitution systématique : sans effet sur un pack illimité.
  PERFORM refund_credit(v_booking.pack_purchase_id);
  PERFORM promote_from_waitlist(v_booking.scheduled_class_id);

  INSERT INTO activity_log (action, actor_id, target_user_id, entity_type, entity_id, details, description)
  VALUES ('booking_cancelled', auth.uid(), auth.uid(), 'booking', p_booking_id,
          jsonb_build_object('reason', 'class_modified', 'refunded', true),
          format('Renoncement après modification du cours du %s — crédit restitué',
                 to_char(v_class.starts_at AT TIME ZONE 'Europe/Brussels', 'DD/MM/YYYY HH24:MI')));

  RETURN jsonb_build_object('ok', true, 'refunded', true);
END;
$fn$;

COMMENT ON FUNCTION decline_modified_booking(UUID) IS
  'Le membre renonce à un cours dont l''horaire ou le type a changé après sa réservation. Le crédit est TOUJOURS restitué, sans appliquer le délai de prévenance : la modification vient du studio, le membre ne fait que la subir.';

REVOKE ALL ON FUNCTION decline_modified_booking(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION decline_modified_booking(UUID) TO authenticated;

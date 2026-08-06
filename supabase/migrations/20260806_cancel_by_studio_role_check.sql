-- cancel_booking_by_studio : contrôler le rôle de l'appelant
--
-- La fonction est SECURITY DEFINER — elle contourne RLS pour pouvoir
-- restituer le crédit. Mais elle ne vérifiait aucun rôle : n'importe quel
-- membre authentifié pouvait annuler la réservation d'un autre, avec
-- restitution, en l'appelant directement.
--
-- C'est bien un geste du studio : coach ou admin, personne d'autre.

CREATE OR REPLACE FUNCTION cancel_booking_by_studio(p_booking_id UUID)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER
AS $fn$
DECLARE
  v_booking RECORD;
BEGIN
  IF NOT (has_role(auth.uid(), 'coach')
          OR has_role(auth.uid(), 'admin')
          OR has_role(auth.uid(), 'super_admin')) THEN
    RAISE EXCEPTION 'Reserve au staff du studio';
  END IF;

  SELECT * INTO v_booking FROM bookings
    WHERE id = p_booking_id AND status = 'confirmed';

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'booking_not_found');
  END IF;

  UPDATE bookings
     SET status = 'cancelled', cancelled_at = NOW()
   WHERE id = p_booking_id;

  -- Toujours restituer : le membre n'est pas à l'origine de l'annulation.
  -- refund_credit est sans effet sur un pack illimité, où rien n'est décompté.
  PERFORM refund_credit(v_booking.pack_purchase_id);

  -- Libérer la place profite à la liste d'attente.
  PERFORM promote_from_waitlist(v_booking.scheduled_class_id);

  RETURN jsonb_build_object('refunded', true);
END;
$fn$;

COMMENT ON FUNCTION cancel_booking_by_studio(UUID) IS
  'Annule une réservation à l''initiative du studio (cours annulé, retrait par un coach). Le crédit est TOUJOURS restitué, contrairement à cancel_booking_v2 qui applique au membre le délai de prévenance. Réservée au staff. Sans effet sur un pack illimité.';

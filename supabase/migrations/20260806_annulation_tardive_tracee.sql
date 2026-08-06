-- Une annulation tardive doit laisser une trace
--
-- Constat du 2026-08-06 : quelqu'un qui annule hors délai voit son crédit
-- consommé, mais sa réservation passe simplement en 'cancelled'. Elle
-- disparaît alors de tous les comptages, qui ne retiennent que 'confirmed'.
--
-- Conséquences :
--   * le remplissage est sous-estimé — la place était pourtant prise et payée
--   * un cours peut basculer « non donné » alors qu'il a bien eu lieu
--   * le studio ne voit pas qui se désiste systématiquement
--
-- Décision : une place occupée et payée compte comme inscrite ; seule la
-- présence réelle compte comme venue. L'annulation tardive est donc marquée
-- `is_no_show`, au même titre qu'une absence sans prévenir — du point de vue
-- du studio, les deux cas sont identiques.

CREATE OR REPLACE FUNCTION cancel_booking_v2(p_booking_id UUID, p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER
AS $fn$
DECLARE
  v_booking RECORD;
  v_class RECORD;
  v_rules JSONB;
  v_hours_before NUMERIC;
  v_free_hours NUMERIC;
  v_refund BOOLEAN;
BEGIN
  SELECT * INTO v_booking FROM bookings
   WHERE id = p_booking_id AND user_id = p_user_id AND status = 'confirmed';
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'booking_not_found');
  END IF;

  SELECT * INTO v_class FROM scheduled_classes WHERE id = v_booking.scheduled_class_id;
  SELECT value INTO v_rules FROM app_settings WHERE key = 'booking_rules';

  v_hours_before := EXTRACT(EPOCH FROM (v_class.starts_at - NOW())) / 3600;
  v_free_hours := COALESCE((v_rules->>'cancellation_free_hours')::NUMERIC, 12);
  v_refund := v_hours_before >= v_free_hours;

  -- Hors délai : le crédit reste consommé, donc la place a été occupée.
  -- `is_no_show` en garde la trace pour les statistiques et pour repérer
  -- les désistements répétés.
  UPDATE bookings
     SET status = 'cancelled',
         cancelled_at = NOW(),
         is_no_show = NOT v_refund
   WHERE id = p_booking_id;

  -- Sans effet si le pack est illimité (cf. refund_credit).
  IF v_refund THEN
    PERFORM refund_credit(v_booking.pack_purchase_id);
  END IF;

  PERFORM promote_from_waitlist(v_booking.scheduled_class_id);

  RETURN jsonb_build_object('refunded', v_refund, 'hours_before', ROUND(v_hours_before, 1));
END;
$fn$;

COMMENT ON FUNCTION cancel_booking_v2(UUID, UUID) IS
  'Annulation par le membre. Restitue le crédit si le délai de prévenance est respecté ; sinon le crédit reste consommé et la réservation est marquée is_no_show — la place était prise et payée, elle doit rester visible dans les statistiques.';

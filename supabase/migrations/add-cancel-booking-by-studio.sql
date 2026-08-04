-- ============================================
-- Annulation à l'initiative du studio
-- ============================================
--
-- cancel_booking_v2() applique la règle des N heures : au-delà du délai le
-- crédit revient, en deçà il est perdu. C'est juste quand c'est le MEMBRE qui
-- annule.
--
-- Mais handleCancelClass() (annulation d'un cours par un coach/admin) appelait
-- cette même fonction. Conséquence : un cours annulé à moins de 24 h — le cas
-- exact d'une annulation pour effectif insuffisant, décidée à l'heure de
-- fermeture des réservations — privait les inscrits de leur crédit alors qu'ils
-- n'y sont pour rien. Le message affiché promettait pourtant « Votre crédit a
-- été restitué ».
--
-- Cette fonction restitue TOUJOURS le crédit : l'annulation ne vient pas du
-- membre. Sans effet sur un pack illimité (refund_credit s'en charge).
--
-- Idempotent : réexécutable sans effet de bord.
-- ============================================

CREATE OR REPLACE FUNCTION cancel_booking_by_studio(p_booking_id UUID)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER
AS $fn$
DECLARE
  v_booking RECORD;
BEGIN
  SELECT * INTO v_booking FROM bookings
    WHERE id = p_booking_id AND status = 'confirmed';

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'booking_not_found');
  END IF;

  UPDATE bookings
     SET status = 'cancelled', cancelled_at = NOW()
   WHERE id = p_booking_id;

  -- Toujours restituer : le membre n'est pas à l'origine de l'annulation.
  PERFORM refund_credit(v_booking.pack_purchase_id);

  RETURN jsonb_build_object('refunded', true);
END;
$fn$;

COMMENT ON FUNCTION cancel_booking_by_studio(UUID) IS
  'Annule une réservation à l''initiative du studio (cours annulé par un coach ou faute de participants). Le crédit est TOUJOURS restitué, contrairement à cancel_booking_v2 qui applique le délai de prévenance au membre. Sans effet sur un pack illimité.';

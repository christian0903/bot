-- ============================================
-- PHASE 4 : Planning avancé & règles métier
-- Back On Track v2
--
-- Exécuter en une seule fois dans le SQL Editor Supabase.
-- ============================================

-- 1. Fonction : vérifier si un membre peut réserver un cours
-- Retourne JSON { can_book: bool, reason: string }
CREATE OR REPLACE FUNCTION can_book_class(p_class_id UUID, p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER
AS '
DECLARE
  v_class RECORD;
  v_rules JSONB;
  v_now TIMESTAMPTZ := NOW();
  v_bookings_count INTEGER;
  v_class_hour INTEGER;
  v_cutoff TIMESTAMPTZ;
  v_class_date DATE;
BEGIN
  SELECT * INTO v_class FROM scheduled_classes WHERE id = p_class_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object(''can_book'', false, ''reason'', ''class_not_found'');
  END IF;

  SELECT value INTO v_rules FROM app_settings WHERE key = ''booking_rules'';
  IF v_rules IS NULL THEN
    RETURN jsonb_build_object(''can_book'', true);
  END IF;

  -- Cours passé
  IF v_class.starts_at <= v_now THEN
    RETURN jsonb_build_object(''can_book'', false, ''reason'', ''class_past'');
  END IF;

  -- Cours annulé
  IF v_class.is_cancelled THEN
    RETURN jsonb_build_object(''can_book'', false, ''reason'', ''class_cancelled'');
  END IF;

  -- Déjà inscrit
  IF EXISTS(SELECT 1 FROM bookings WHERE scheduled_class_id = p_class_id AND user_id = p_user_id AND status = ''confirmed'') THEN
    RETURN jsonb_build_object(''can_book'', false, ''reason'', ''already_booked'');
  END IF;

  -- Complet
  SELECT COUNT(*) INTO v_bookings_count FROM bookings WHERE scheduled_class_id = p_class_id AND status = ''confirmed'';
  IF v_bookings_count >= v_class.max_participants THEN
    RETURN jsonb_build_object(''can_book'', false, ''reason'', ''class_full'');
  END IF;

  -- Règles de fermeture
  v_class_hour := EXTRACT(HOUR FROM v_class.starts_at AT TIME ZONE ''Europe/Brussels'');
  v_class_date := (v_class.starts_at AT TIME ZONE ''Europe/Brussels'')::DATE;

  IF v_class_hour < COALESCE((v_rules->>''morning_class_before_hour'')::INTEGER, 12) THEN
    -- Cours du matin : fermé la veille à Xh
    v_cutoff := (v_class_date - INTERVAL ''1 day''
                + (COALESCE((v_rules->>''morning_cutoff_hour'')::INTEGER, 20) || '' hours'')::INTERVAL)
                AT TIME ZONE ''Europe/Brussels'';
  ELSE
    -- Cours après-midi/soir
    IF v_bookings_count = 0 THEN
      v_cutoff := v_class.starts_at - (COALESCE((v_rules->>''afternoon_hours_before_no_bookings'')::INTEGER, 3) || '' hours'')::INTERVAL;
    ELSE
      v_cutoff := v_class.starts_at - (COALESCE((v_rules->>''afternoon_minutes_before_with_bookings'')::INTEGER, 30) || '' minutes'')::INTERVAL;
    END IF;
  END IF;

  IF v_now > v_cutoff THEN
    RETURN jsonb_build_object(''can_book'', false, ''reason'', ''booking_closed'');
  END IF;

  RETURN jsonb_build_object(''can_book'', true);
END;
';

-- 2. Fonction : annulation avec restitution conditionnelle
-- Retourne JSON { refunded: bool, hours_before: numeric }
CREATE OR REPLACE FUNCTION cancel_booking_v2(p_booking_id UUID, p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER
AS '
DECLARE
  v_booking RECORD;
  v_class RECORD;
  v_rules JSONB;
  v_hours_before NUMERIC;
  v_free_hours NUMERIC;
  v_refund BOOLEAN;
BEGIN
  SELECT * INTO v_booking FROM bookings WHERE id = p_booking_id AND user_id = p_user_id AND status = ''confirmed'';
  IF NOT FOUND THEN
    RETURN jsonb_build_object(''error'', ''booking_not_found'');
  END IF;

  SELECT * INTO v_class FROM scheduled_classes WHERE id = v_booking.scheduled_class_id;
  SELECT value INTO v_rules FROM app_settings WHERE key = ''booking_rules'';

  v_hours_before := EXTRACT(EPOCH FROM (v_class.starts_at - NOW())) / 3600;
  v_free_hours := COALESCE((v_rules->>''cancellation_free_hours'')::NUMERIC, 12);
  v_refund := v_hours_before >= v_free_hours;

  -- Annuler la réservation
  UPDATE bookings SET status = ''cancelled'', cancelled_at = NOW() WHERE id = p_booking_id;

  -- Restituer le crédit si dans les temps
  IF v_refund THEN
    UPDATE pack_purchases SET credits_remaining = credits_remaining + 1
    WHERE id = v_booking.pack_purchase_id;
  END IF;

  -- Promouvoir depuis la liste d''attente
  PERFORM promote_from_waitlist(v_booking.scheduled_class_id);

  RETURN jsonb_build_object(''refunded'', v_refund, ''hours_before'', ROUND(v_hours_before, 1));
END;
';

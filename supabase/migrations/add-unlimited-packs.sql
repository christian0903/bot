-- ============================================
-- Packs illimités (Phase 12 — prérequis abonnements)
-- ============================================
--
-- Un pack "illimité" donne accès aux cours sans décompte de crédits.
-- La règle est SYMÉTRIQUE dans les deux sens :
--   - réservation  → PAS de décrément
--   - annulation   → PAS de recrédit (on n'a rien décompté au départ,
--                    il n'y a donc rien à rendre)
--
-- Sans cette symétrie, annuler une réservation illimitée créerait des
-- crédits à partir de rien.
--
-- Dans tous les cas la réservation est enregistrée normalement dans
-- `bookings` : c'est elle qui alimente les statistiques de présence et
-- le compteur de désistements par membre.
--
-- Idempotent : réexécutable sans effet de bord.
-- ============================================

-- ============================================
-- 1. Marqueur sur les types de pack
-- ============================================
ALTER TABLE pack_types ADD COLUMN IF NOT EXISTS is_unlimited BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN pack_types.is_unlimited IS
  'Pack à accès illimité : aucun décompte de crédit à la réservation, aucun recrédit à l''annulation. credit_count reste indicatif (affichage/tarification) mais n''est pas consommé.';

-- ============================================
-- 2. Sélection des packs utilisables
-- ============================================
-- ATTENTION : c'est ici le point de rupture principal.
-- Le filtre `credits_remaining > 0` excluait tout pack illimité dès que
-- son compteur atteignait 0 — le membre se retrouvait sans pack
-- utilisable alors qu'il a un accès illimité valide.
--
-- DROP obligatoire : la fonction gagne une colonne (is_unlimited) dans son
-- RETURNS TABLE. PostgreSQL refuse un CREATE OR REPLACE qui change le type
-- de retour ("cannot change return type of existing function").
DROP FUNCTION IF EXISTS get_available_credits(UUID, UUID);

CREATE OR REPLACE FUNCTION get_available_credits(p_user_id UUID, p_credit_type_id UUID)
RETURNS TABLE(pack_purchase_id UUID, credits_remaining INTEGER, expires_at TIMESTAMPTZ, is_unlimited BOOLEAN) AS $$
  SELECT pp.id, pp.credits_remaining, pp.expires_at, pt.is_unlimited
  FROM pack_purchases pp
  JOIN pack_types pt ON pp.pack_type_id = pt.id
  WHERE pp.user_id = p_user_id
    AND pt.credit_type_id = p_credit_type_id
    AND (pt.is_unlimited OR pp.credits_remaining > 0)
    AND pp.expires_at > NOW()
  -- Les packs à crédits sont consommés en priorité (ils expirent et se
  -- perdent), l'illimité sert de filet. À expiration égale, l'ordre reste
  -- celui de la date la plus proche.
  ORDER BY pt.is_unlimited ASC, pp.expires_at ASC;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ============================================
-- 3. Consommation d'un crédit (réservation)
-- ============================================
-- Ne décrémente pas si le pack est illimité.
CREATE OR REPLACE FUNCTION consume_credit(p_pack_purchase_id UUID)
RETURNS VOID AS $$
  UPDATE pack_purchases pp
  SET credits_remaining = pp.credits_remaining - 1
  FROM pack_types pt
  WHERE pp.id = p_pack_purchase_id
    AND pp.pack_type_id = pt.id
    AND NOT pt.is_unlimited
    AND pp.credits_remaining > 0;
$$ LANGUAGE sql SECURITY DEFINER;

-- ============================================
-- 4. Restitution d'un crédit (annulation dans les délais)
-- ============================================
-- Symétrique du point 3 : pas de recrédit sur un pack illimité.
CREATE OR REPLACE FUNCTION refund_credit(p_pack_purchase_id UUID)
RETURNS VOID AS $$
  UPDATE pack_purchases pp
  SET credits_remaining = pp.credits_remaining + 1
  FROM pack_types pt
  WHERE pp.id = p_pack_purchase_id
    AND pp.pack_type_id = pt.id
    AND NOT pt.is_unlimited;
$$ LANGUAGE sql SECURITY DEFINER;

COMMENT ON FUNCTION refund_credit(UUID) IS
  'Restitue un crédit lors d''une annulation dans les délais. Sans effet sur un pack illimité (rien n''a été décompté à la réservation).';

-- ============================================
-- 5. cancel_booking_v2 : passer par refund_credit()
-- ============================================
-- La version d'origine (phase4.sql) faisait un `credits_remaining + 1`
-- direct, sans vérifier le type de pack : annuler une réservation
-- illimitée aurait créé un crédit à partir de rien.
-- On centralise la règle dans refund_credit() pour qu'elle ne puisse
-- plus être contournée.
--
-- Signature et comportement identiques à l'original (2 paramètres,
-- filtre sur user_id + status='confirmed') : seule la restitution change.
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
  v_free_hours   := COALESCE((v_rules->>'cancellation_free_hours')::NUMERIC, 12);
  v_refund       := v_hours_before >= v_free_hours;

  UPDATE bookings SET status = 'cancelled', cancelled_at = NOW() WHERE id = p_booking_id;

  -- Sans effet si le pack est illimité (cf. refund_credit)
  IF v_refund THEN
    PERFORM refund_credit(v_booking.pack_purchase_id);
  END IF;

  PERFORM promote_from_waitlist(v_booking.scheduled_class_id);

  RETURN jsonb_build_object('refunded', v_refund, 'hours_before', ROUND(v_hours_before, 1));
END;
$fn$;

-- ============================================
-- 6. Revenu par réservation
-- ============================================
-- booking_revenue() divisait par pack_types.credit_count. Sur un pack
-- illimité ce diviseur n'a pas de sens (et vaut 0 si le pack est saisi
-- sans crédits → division par zéro).
--
-- Pour un illimité, le revenu d'une séance = prix payé réparti sur le
-- nombre de séances RÉELLEMENT consommées sur ce pack. Le montant par
-- séance baisse donc à mesure que le membre vient — c'est le
-- comportement économique correct.
CREATE OR REPLACE FUNCTION booking_revenue(p_booking_id UUID)
RETURNS NUMERIC AS $$
  SELECT CASE
    WHEN pt.is_unlimited THEN
      (pp.price_paid_cents::NUMERIC / GREATEST(
        (SELECT COUNT(*) FROM bookings b2
          WHERE b2.pack_purchase_id = pp.id
            AND b2.status <> 'cancelled'), 1)) / 100
    WHEN pt.credit_count > 0 THEN
      (pp.price_paid_cents::NUMERIC / pt.credit_count) / 100
    ELSE 0
  END
  FROM bookings b
  JOIN pack_purchases pp ON b.pack_purchase_id = pp.id
  JOIN pack_types pt ON pp.pack_type_id = pt.id
  WHERE b.id = p_booking_id;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

COMMENT ON FUNCTION booking_revenue(UUID) IS
  'Revenu attribué à une réservation. Pack à crédits : prix / credit_count. Pack illimité : prix / nombre de séances réellement consommées (valeur qui décroît avec la fréquentation).';

-- ============================================================================
-- Un coupon ne sert qu'une fois par personne
--
-- `max_uses` compte les utilisations TOTALES, tous membres confondus — le
-- comportement d'un code promotionnel « les cinquante premiers ». Rien
-- n'empechait donc quelqu'un de reutiliser le meme code a chaque achat.
--
-- Aucune table nouvelle : `pack_purchases.coupon_id` enregistre deja quel
-- coupon a servi a quel achat. L'historique est la, il suffit de le lire.
--
-- La regle vaut pour TOUS les coupons, sans reglage. Un « une fois par
-- personne » optionnel aurait ajoute une case a cocher qu'on oublie, et un
-- coupon oublie serait alors reutilisable — l'inverse du defaut souhaitable.
--
-- La fonction est reprise TELLE QUELLE d'install.sql, un seul bloc ajoute.
-- ============================================================================

CREATE OR REPLACE FUNCTION check_coupon(p_code TEXT, p_purchase_cents INTEGER DEFAULT NULL)
RETURNS JSONB
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
STABLE
AS $fn$
DECLARE
  v_uid        UUID := auth.uid();
  v_coupon     coupons%ROWTYPE;
  v_category   UUID;
  v_restricted BOOLEAN;
  v_discount   INTEGER;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_authenticated');
  END IF;

  SELECT * INTO v_coupon FROM coupons
  WHERE code = upper(trim(p_code)) AND is_active;

  IF v_coupon.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'unknown_code');
  END IF;

  IF v_coupon.valid_from IS NOT NULL AND NOW() < v_coupon.valid_from THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_yet_valid', 'valid_from', v_coupon.valid_from);
  END IF;

  IF v_coupon.valid_until IS NOT NULL AND NOW() > v_coupon.valid_until THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'expired');
  END IF;

  -- Une fois par personne. `pack_purchases.coupon_id` garde la trace de ce qui
  -- a servi : pas besoin d'une table de plus.
  --
  -- Le motif est distinct d'`exhausted` : « vous avez deja utilise ce code » et
  -- « ce code est epuise » appellent des reactions differentes, et le second
  -- laisserait croire a une injustice.
  IF EXISTS (
    SELECT 1 FROM pack_purchases
     WHERE user_id = v_uid AND coupon_id = v_coupon.id
  ) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'already_used');
  END IF;

  IF v_coupon.max_uses IS NOT NULL AND v_coupon.current_uses >= v_coupon.max_uses THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'exhausted');
  END IF;

  -- Sans restriction déclarée, le coupon vaut pour tous.
  SELECT EXISTS (SELECT 1 FROM coupon_categories WHERE coupon_id = v_coupon.id)
    INTO v_restricted;

  IF v_restricted THEN
    SELECT member_category_id INTO v_category FROM profiles WHERE id = v_uid;
    IF v_category IS NULL OR NOT EXISTS (
      SELECT 1 FROM coupon_categories
      WHERE coupon_id = v_coupon.id AND member_category_id = v_category
    ) THEN
      RETURN jsonb_build_object('ok', false, 'reason', 'not_eligible');
    END IF;
  END IF;

  IF p_purchase_cents IS NOT NULL THEN
    v_discount := CASE
      WHEN v_coupon.discount_percent IS NOT NULL
        THEN ROUND(p_purchase_cents * v_coupon.discount_percent / 100.0)
      ELSE LEAST(COALESCE(v_coupon.discount_amount_cents, 0), p_purchase_cents)
    END;
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'code', v_coupon.code,
    'discount_percent', v_coupon.discount_percent,
    'discount_amount_cents', v_coupon.discount_amount_cents,
    'discount_cents', v_discount
  );
END;
$fn$;

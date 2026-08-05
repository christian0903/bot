-- Choix de la source de paiement à la réservation
--
-- Un membre peut détenir plusieurs sources en même temps : son abonnement et
-- un ou plusieurs packs achetés à l'unité. Jusqu'ici la réservation prenait le
-- premier crédit venu, sans que personne ne choisisse — un abonné qui invite
-- quelqu'un ne pouvait pas décider de consommer un crédit de pack.
--
-- get_available_credits expose donc ce qu'il faut pour présenter le choix :
-- le nom du pack et son rattachement éventuel à un abonnement.
--
-- L'ordre change aussi : l'abonnement passe DEVANT (décision de cadrage du
-- 2026-08-05, « priorité abonnement, le pack en complément »). L'ancien tri
-- consommait les packs à crédits d'abord, ce qui épuisait ce que le membre
-- avait payé en plus alors que son abonnement couvrait déjà la séance.

DROP FUNCTION IF EXISTS get_available_credits(UUID, UUID);

CREATE FUNCTION get_available_credits(p_user_id UUID, p_credit_type_id UUID)
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
  WHERE pp.user_id = p_user_id
    AND pt.credit_type_id = p_credit_type_id
    AND (pt.is_unlimited OR pp.credits_remaining > 0)
    AND pp.expires_at > NOW()
  -- Abonnement d'abord : il est déjà facturé, les crédits achetés à côté
  -- restent au membre. Entre deux packs, celui qui expire le plus tôt.
  ORDER BY (pp.subscription_id IS NOT NULL) DESC, pp.expires_at ASC;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

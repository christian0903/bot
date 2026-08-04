-- ============================================
-- Abonnements Stripe (Phase 12)
-- ============================================
--
-- Principe retenu (cf. docs/dossier-fonctionnel-abonnement.md) : un abonnement
-- n'est PAS une entité nouvelle, c'est un pack court qui se renouvelle tout
-- seul. À chaque échéance payée, le webhook crée une ligne `pack_purchases`
-- ordinaire — le reste de l'application (réservation, décompte, expiration)
-- ne voit aucune différence.
--
-- Une ligne pack_purchases par cycle, jamais une date prolongée : chaque cycle
-- reste une unité comptable et statistique autonome (1 ligne = 1 facture
-- Stripe = 1 période), et les compteurs d'annulations se remettent à zéro
-- d'eux-mêmes à chaque reconduction.
--
-- Idempotent : réexécutable sans effet de bord.
-- ============================================

-- ============================================
-- 1. Un type de pack peut être récurrent
-- ============================================
ALTER TABLE pack_types ADD COLUMN IF NOT EXISTS is_recurring BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE pack_types ADD COLUMN IF NOT EXISTS recurring_interval TEXT
  CHECK (recurring_interval IS NULL OR recurring_interval IN ('day', 'week', 'month'));
ALTER TABLE pack_types ADD COLUMN IF NOT EXISTS recurring_interval_count INTEGER
  CHECK (recurring_interval_count IS NULL OR recurring_interval_count > 0);
-- Price Stripe correspondant, créé à l'enregistrement du type de pack.
-- Deux colonnes : un prix de test et un prix live ne sont pas interchangeables.
ALTER TABLE pack_types ADD COLUMN IF NOT EXISTS stripe_price_id_test TEXT;
ALTER TABLE pack_types ADD COLUMN IF NOT EXISTS stripe_price_id_live TEXT;

COMMENT ON COLUMN pack_types.is_recurring IS
  'Pack vendu en abonnement : renouvellement automatique via Stripe. Le cycle est défini par recurring_interval + recurring_interval_count (ex. week x 4 = toutes les 4 semaines).';
COMMENT ON COLUMN pack_types.recurring_interval_count IS
  'Attention : "week" x 4 et "month" x 1 ne sont PAS équivalents. 4 semaines = 28 jours fixes, soit 13 échéances par an ; un mois calendaire varie de 28 à 31 jours, soit 12 échéances.';

-- Cohérence : un pack récurrent doit porter sa périodicité.
ALTER TABLE pack_types DROP CONSTRAINT IF EXISTS pack_types_recurring_coherent;
ALTER TABLE pack_types ADD CONSTRAINT pack_types_recurring_coherent CHECK (
  NOT is_recurring
  OR (recurring_interval IS NOT NULL AND recurring_interval_count IS NOT NULL)
);

-- ============================================
-- 2. Les abonnements souscrits
-- ============================================
CREATE TABLE IF NOT EXISTS subscriptions (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                 UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  pack_type_id            UUID NOT NULL REFERENCES pack_types(id),

  stripe_subscription_id  TEXT NOT NULL UNIQUE,
  stripe_customer_id      TEXT NOT NULL,
  stripe_price_id         TEXT NOT NULL,
  -- 'test' ou 'live' : un abonnement créé en test ne doit jamais être piloté
  -- avec la clé live, et inversement.
  stripe_mode             TEXT NOT NULL DEFAULT 'test' CHECK (stripe_mode IN ('test', 'live')),

  -- Reflet du statut Stripe. 'paused' = suspension décidée par le studio.
  status                  TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'past_due', 'paused', 'canceled', 'incomplete')),

  current_period_start    TIMESTAMPTZ,
  current_period_end      TIMESTAMPTZ,   -- prochaine échéance
  cancel_at_period_end    BOOLEAN NOT NULL DEFAULT FALSE,
  canceled_at             TIMESTAMPTZ,
  paused_at               TIMESTAMPTZ,

  created_at              TIMESTAMPTZ DEFAULT NOW(),
  updated_at              TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS subscriptions_user_idx   ON subscriptions(user_id);
CREATE INDEX IF NOT EXISTS subscriptions_status_idx ON subscriptions(status);

COMMENT ON TABLE subscriptions IS
  'Lien entre un membre et son abonnement Stripe. Les crédits eux-mêmes vivent dans pack_purchases : une ligne par cycle payé.';

-- ============================================
-- 3. Rattacher un cycle payé à son abonnement
-- ============================================
ALTER TABLE pack_purchases ADD COLUMN IF NOT EXISTS subscription_id UUID REFERENCES subscriptions(id) ON DELETE SET NULL;
-- Idempotence du webhook : Stripe peut livrer deux fois le même événement.
-- L'unicité de la facture empêche de créditer deux fois le même cycle.
ALTER TABLE pack_purchases ADD COLUMN IF NOT EXISTS stripe_invoice_id TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS pack_purchases_stripe_invoice_uniq
  ON pack_purchases(stripe_invoice_id) WHERE stripe_invoice_id IS NOT NULL;

COMMENT ON COLUMN pack_purchases.stripe_invoice_id IS
  'Facture Stripe à l''origine de ce cycle. Index unique : garantit qu''un même événement webhook rejoué ne crédite pas deux fois.';

-- ============================================
-- 4. Réductions ponctuelles accordées
-- ============================================
-- Trace des coupons "une seule fois" appliqués à un abonnement : sans elle,
-- impossible de savoir a posteriori pourquoi une échéance a été réduite
-- (parrainage, geste commercial, dédommagement).
CREATE TABLE IF NOT EXISTS subscription_discounts (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id   UUID NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
  stripe_coupon_id  TEXT NOT NULL,
  amount_off_cents  INTEGER CHECK (amount_off_cents IS NULL OR amount_off_cents > 0),
  percent_off       INTEGER CHECK (percent_off IS NULL OR (percent_off BETWEEN 1 AND 100)),
  reason            TEXT,
  applied_by        UUID REFERENCES auth.users(id),
  applied_at        TIMESTAMPTZ DEFAULT NOW(),
  -- Renseigné par le webhook quand la facture réduite est payée.
  consumed_at       TIMESTAMPTZ,
  CONSTRAINT one_discount_kind CHECK (
    (amount_off_cents IS NOT NULL AND percent_off IS NULL) OR
    (amount_off_cents IS NULL AND percent_off IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS subscription_discounts_sub_idx ON subscription_discounts(subscription_id);

-- ============================================
-- 5. RLS
-- ============================================
ALTER TABLE subscriptions           ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscription_discounts  ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Subscriptions: own read"    ON subscriptions;
DROP POLICY IF EXISTS "Subscriptions: admin all"   ON subscriptions;
DROP POLICY IF EXISTS "Sub discounts: admin all"   ON subscription_discounts;
DROP POLICY IF EXISTS "Sub discounts: own read"    ON subscription_discounts;

-- Le membre consulte son abonnement ; il ne le modifie jamais depuis l'app :
-- toute écriture passe par une Edge Function (service role) qui pilote Stripe.
CREATE POLICY "Subscriptions: own read" ON subscriptions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Subscriptions: admin all" ON subscriptions
  FOR ALL
  USING (has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE POLICY "Sub discounts: own read" ON subscription_discounts
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM subscriptions s
             WHERE s.id = subscription_discounts.subscription_id
               AND s.user_id = auth.uid())
  );

CREATE POLICY "Sub discounts: admin all" ON subscription_discounts
  FOR ALL
  USING (has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'admin'));

-- ============================================
-- 6. updated_at
-- ============================================
DROP TRIGGER IF EXISTS subscriptions_updated_at ON subscriptions;
CREATE TRIGGER subscriptions_updated_at
  BEFORE UPDATE ON subscriptions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

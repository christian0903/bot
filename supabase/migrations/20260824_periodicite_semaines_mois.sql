-- Périodicité d'abonnement : plus de jours, et des bornes que Stripe accepte.
--
-- Deux corrections d'un même champ.
--
-- 1. Les jours disparaissent. Un abonnement se pense en semaines ou en mois —
--    « tous les 72 jours » ne se dit pas, ne se compare pas, et n'a aucun sens
--    commercial. Le seul pack concerné, « abo 72j », n'avait aucun abonné.
--
-- 2. Les bornes de Stripe deviennent une contrainte. Stripe refuse au-delà de
--    52 semaines ou 12 mois : sans garde-fou, un « mois × 24 » était accepté à
--    la création puis refusé au premier paiement, sans que rien n'explique
--    pourquoi. Un abonnement annuel (mois × 12) reste possible — c'est
--    exactement la limite haute.

-- ---------------------------------------------------------------------------
-- 1. Convertir l'existant
-- ---------------------------------------------------------------------------

-- 72 jours ≈ 10 semaines (70 jours). L'écart de deux jours est sans
-- conséquence : aucun abonnement n'était rattaché à ce pack.
UPDATE pack_types
SET recurring_interval = 'week',
    recurring_interval_count = GREATEST(1, ROUND(recurring_interval_count / 7.0))
WHERE recurring_interval = 'day';

-- ---------------------------------------------------------------------------
-- 2. Remplacer la contrainte
-- ---------------------------------------------------------------------------

ALTER TABLE pack_types
  DROP CONSTRAINT IF EXISTS pack_types_recurring_interval_check;

ALTER TABLE pack_types
  ADD CONSTRAINT pack_types_recurring_interval_check
  CHECK (recurring_interval IS NULL OR recurring_interval IN ('week', 'month'));

-- Bornes de Stripe. Le nom dit la raison : un futur lecteur qui bute dessus
-- doit comprendre qu'elle vient du prestataire de paiement, pas d'un choix
-- arbitraire du studio.
ALTER TABLE pack_types
  DROP CONSTRAINT IF EXISTS pack_types_recurring_within_stripe_limits;

ALTER TABLE pack_types
  ADD CONSTRAINT pack_types_recurring_within_stripe_limits
  CHECK (
    recurring_interval IS NULL
    OR (recurring_interval = 'week'  AND recurring_interval_count BETWEEN 1 AND 52)
    OR (recurring_interval = 'month' AND recurring_interval_count BETWEEN 1 AND 12)
  );

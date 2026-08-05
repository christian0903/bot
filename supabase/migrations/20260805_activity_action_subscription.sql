-- Étend l'enum activity_action pour tracer les actions sur les abonnements :
-- résiliation en libre-service par le membre (cancel-my-subscription) et
-- gestes du studio (manage-subscription : remise, report, suspension, reprise).
--
-- Note : ALTER TYPE ADD VALUE ne peut pas tourner dans un bloc transactionnel
-- suivi d'un usage de la valeur. Exécuter cette migration seule, avant que le
-- code ne s'en serve.

ALTER TYPE activity_action ADD VALUE IF NOT EXISTS 'subscription_cancelled';
ALTER TYPE activity_action ADD VALUE IF NOT EXISTS 'subscription_paused';
ALTER TYPE activity_action ADD VALUE IF NOT EXISTS 'subscription_resumed';
ALTER TYPE activity_action ADD VALUE IF NOT EXISTS 'subscription_postponed';
ALTER TYPE activity_action ADD VALUE IF NOT EXISTS 'subscription_discounted';

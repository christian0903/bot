-- ============================================
-- PHASE 4b : Nouvelles actions dans le journal d'activité
-- Exécuter en UNE SEULE FOIS dans le SQL Editor
-- ============================================

ALTER TYPE activity_action ADD VALUE IF NOT EXISTS 'user_created';
ALTER TYPE activity_action ADD VALUE IF NOT EXISTS 'registration_fee_paid';
ALTER TYPE activity_action ADD VALUE IF NOT EXISTS 'user_login';
ALTER TYPE activity_action ADD VALUE IF NOT EXISTS 'trial_booked';

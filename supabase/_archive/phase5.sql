-- ============================================
-- PHASE 5 : Check-in / Présences
-- Back On Track v2
--
-- Exécuter en une seule fois dans le SQL Editor Supabase.
-- ============================================

-- 1. Colonnes check-in sur bookings
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS checked_in_at TIMESTAMPTZ;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS is_no_show BOOLEAN DEFAULT FALSE;

-- 2. Nouvelles actions dans le log
ALTER TYPE activity_action ADD VALUE IF NOT EXISTS 'check_in';
ALTER TYPE activity_action ADD VALUE IF NOT EXISTS 'no_show';

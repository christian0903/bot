-- Add 'password_reset_by_admin' to activity_action enum
-- Run in Supabase SQL Editor.
-- Note: ALTER TYPE ADD VALUE cannot run inside a transaction block alongside
-- usage of the new value, so this migration only declares it.

ALTER TYPE activity_action ADD VALUE IF NOT EXISTS 'password_reset_by_admin';

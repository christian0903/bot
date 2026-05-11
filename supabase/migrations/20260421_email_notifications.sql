-- Email notification preferences
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS email_on_self_booking BOOLEAN DEFAULT TRUE;

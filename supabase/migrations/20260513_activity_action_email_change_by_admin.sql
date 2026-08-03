-- Étend l'enum activity_action pour autoriser le log
-- "email_change_by_admin" déclenché par l'action admin de correction d'email.

ALTER TYPE activity_action ADD VALUE IF NOT EXISTS 'email_change_by_admin';

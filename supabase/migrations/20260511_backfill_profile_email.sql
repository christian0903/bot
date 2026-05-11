-- One-shot backfill: re-sync profiles.email with auth.users.email
-- for rows where they got out of sync before the trigger existed,
-- or where an email change was applied without firing the trigger.
-- Safe to run multiple times.

UPDATE public.profiles p
SET email = u.email
FROM auth.users u
WHERE p.id = u.id
  AND p.email IS DISTINCT FROM u.email;

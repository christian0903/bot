-- ============================================
-- RESET : Efface toutes les données de test
-- Garde uniquement les utilisateurs admin/super_admin
-- et les données de configuration (types de cours, packs, settings)
--
-- À exécuter dans le SQL Editor Supabase
-- ============================================

-- 1. Données transactionnelles
DELETE FROM bookings;
DELETE FROM waitlist;
DELETE FROM trial_sessions;
DELETE FROM invoice_requests;
DELETE FROM registration_fees;
DELETE FROM pack_purchases;
DELETE FROM notifications;
DELETE FROM activity_log;
DELETE FROM scheduled_classes;

-- 2. Parrainages (si tables existent)
DELETE FROM referral_rewards;
DELETE FROM referrals;

-- 3. Badges
DELETE FROM member_badges;

-- 4. Supprimer les utilisateurs non-admin
DELETE FROM profiles
WHERE id NOT IN (
  SELECT user_id FROM user_roles WHERE role IN ('admin', 'super_admin')
);

DELETE FROM user_roles
WHERE user_id NOT IN (
  SELECT user_id FROM user_roles WHERE role IN ('admin', 'super_admin')
);

DELETE FROM auth.users
WHERE id NOT IN (
  SELECT user_id FROM user_roles WHERE role IN ('admin', 'super_admin')
);

-- 5. Remettre les admins en bon statut
UPDATE profiles SET member_status = 'active';

-- Vérification
SELECT display_name, email, member_status FROM profiles;

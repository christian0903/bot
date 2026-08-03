-- ============================================
-- RESET COMPLET : Efface TOUTES les données
-- Garde uniquement les utilisateurs admin/super_admin
-- et les app_settings
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

-- 2. Parrainages
DELETE FROM referral_rewards;
DELETE FROM referrals;

-- 3. Badges
DELETE FROM member_badges;

-- 4. Types de packs (dépend de pack_type_categories)
DELETE FROM pack_type_categories;
DELETE FROM pack_types;

-- 5. Types de cours
DELETE FROM class_types;

-- 6. Types de crédits
DELETE FROM credit_types;

-- 7. Catégories de membres
DELETE FROM member_categories;

-- 8. Coupons
DELETE FROM coupons;

-- 9. Supprimer les utilisateurs non-admin
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

-- 10. Remettre les admins en bon statut
UPDATE profiles SET member_status = 'active';

-- Vérification
SELECT display_name, email, member_status FROM profiles;

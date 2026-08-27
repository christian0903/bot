-- ============================================
-- RESET COMPLET : efface TOUTES les données
--
-- Garde : les comptes admin / super_admin, et app_settings (la configuration
-- du studio — horaires, règles de réservation, noms des salles).
--
-- À exécuter dans le SQL Editor Supabase.
--
-- ⚠️ Stripe ne se vide pas avec la base. `subscriptions` porte des
-- stripe_subscription_id bien vivants chez Stripe : effacer la ligne ici
-- n'annule pas l'abonnement là-bas, qui continuera de prélever et d'envoyer
-- ses webhooks sur des membres devenus introuvables. Les annuler côté Stripe
-- AVANT ce script — ou ne l'utiliser qu'en mode test.
--
-- L'ordre ci-dessous suit les dépendances réelles relevées en base : la
-- moitié des clés étrangères vers auth.users sont en NO ACTION, pas en
-- CASCADE. Une table oubliée ne provoque donc pas un DELETE partiel mais
-- l'échec du DELETE FROM auth.users, tout à la fin.
-- ============================================

BEGIN;

-- ---- 1. Ce qui dépend d'un cours ou d'un achat ----
DELETE FROM class_reviews;
DELETE FROM bookings;
DELETE FROM waitlist;

-- ---- 2. Abonnements (remises d'abord : FK vers subscriptions) ----
DELETE FROM subscription_discounts;
DELETE FROM subscriptions;

-- ---- 3. Achats, frais, facturation ----
DELETE FROM invoice_requests;
DELETE FROM registration_fees;
DELETE FROM pack_purchases;

-- ---- 4. Suivi de performance ----
-- performances.created_by est en NO ACTION : sans ce DELETE, la suppression
-- des utilisateurs échoue.
DELETE FROM performances;
DELETE FROM performance_types;

-- ---- 5. Journal, notifications, file d'envoi ----
DELETE FROM notifications;
DELETE FROM email_queue;
DELETE FROM activity_log;

-- ---- 6. Planning ----
DELETE FROM scheduled_classes;

-- ---- 7. Parrainages et badges ----
DELETE FROM referral_rewards;
DELETE FROM referrals;
DELETE FROM member_badges;

-- ---- 8. Catalogue ----
DELETE FROM pack_type_categories;
DELETE FROM pack_types;
DELETE FROM class_types;
DELETE FROM credit_types;
DELETE FROM coupon_categories;
DELETE FROM coupons;
-- member_categories est supprimée plus bas : les admins conservés y font
-- encore référence par profiles.member_category_id.

-- ---- 9. Utilisateurs non-admin ----
-- Calculé une fois : les trois DELETE qui suivent doivent viser exactement le
-- même ensemble. Les enchaîner sur une sous-requête vivante ferait varier la
-- cible d'une instruction à l'autre — user_roles est vidée entre-temps.
CREATE TEMP TABLE _a_garder ON COMMIT DROP AS
  SELECT DISTINCT user_id FROM user_roles WHERE role IN ('admin', 'super_admin');

-- app_settings.updated_by pointe vers auth.users en NO ACTION : on neutralise
-- la référence sans toucher aux réglages eux-mêmes.
UPDATE app_settings SET updated_by = NULL
WHERE updated_by IS NOT NULL
  AND updated_by NOT IN (SELECT user_id FROM _a_garder);

DELETE FROM profiles      WHERE id      NOT IN (SELECT user_id FROM _a_garder);
DELETE FROM user_roles    WHERE user_id NOT IN (SELECT user_id FROM _a_garder);
DELETE FROM auth.users    WHERE id      NOT IN (SELECT user_id FROM _a_garder);

-- ---- 10. Catégories de membres ----
-- Après la suppression des profils, mais les admins conservés peuvent encore
-- y pointer : on détache d'abord, sinon profiles_member_category_id_fkey
-- refuse le DELETE.
UPDATE profiles SET member_category_id = NULL WHERE member_category_id IS NOT NULL;
DELETE FROM member_categories;

-- ---- 11. Remettre les admins conservés en bon statut ----
UPDATE profiles SET member_status = 'active';

COMMIT;

-- ============================================
-- Vérification : tout doit être à 0 sauf app_settings,
-- et profiles / user_roles au nombre d'admins conservés.
-- ============================================
SELECT 'profiles' AS table_name, COUNT(*) FROM profiles
UNION ALL SELECT 'user_roles', COUNT(*) FROM user_roles
UNION ALL SELECT 'auth.users', COUNT(*) FROM auth.users
UNION ALL SELECT 'app_settings (conservé)', COUNT(*) FROM app_settings
UNION ALL SELECT 'bookings', COUNT(*) FROM bookings
UNION ALL SELECT 'scheduled_classes', COUNT(*) FROM scheduled_classes
UNION ALL SELECT 'pack_purchases', COUNT(*) FROM pack_purchases
UNION ALL SELECT 'subscriptions', COUNT(*) FROM subscriptions
UNION ALL SELECT 'performances', COUNT(*) FROM performances
UNION ALL SELECT 'class_reviews', COUNT(*) FROM class_reviews
UNION ALL SELECT 'activity_log', COUNT(*) FROM activity_log
ORDER BY 1;

SELECT display_name, email, member_status FROM profiles;

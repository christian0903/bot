-- Compare les policies attendues au réel, DANS LES DEUX SENS :
--   MANQUANTE  = attendue par cette liste, absente de la base
--   EN TROP    = présente en base, non prévue ici
--
-- Le second sens est le plus important : la faille du 2026-08-06 était une
-- policy *en trop* sur user_roles. Une liste qui ne cherche que les manques
-- ne l'aurait jamais vue.
--
-- Aucune ligne = base conforme ; toute ligne est un bug en attente.
--
-- Tenir cette liste à jour est ce qui fait sa valeur : un outil qui signale
-- des problèmes inexistants finit par ne plus être lu.
-- Relevé sur la base réelle le 2026-08-27 (89 policies, schéma public).
WITH attendu(tbl, pol) AS (VALUES
  ('activity_log','Activity log: admin insert'),
  ('activity_log','Activity log: admin read'),
  ('activity_log','Activity log: coach insert'),
  ('activity_log','Activity log: coach read'),
  ('activity_log','Activity log: own read'),
  ('activity_log','Activity log: system insert'),
  ('app_settings','Settings: admin manage'),
  ('app_settings','Settings: public read'),
  ('bookings','Bookings: admin insert'),
  ('bookings','Bookings: admin read all'),
  ('bookings','Bookings: admin update'),
  ('bookings','Bookings: coach insert'),
  ('bookings','Bookings: coach read all classes'),
  ('bookings','Bookings: coach update'),
  ('bookings','Bookings: own cancel'),
  ('bookings','Bookings: own insert'),
  ('bookings','Bookings: own read'),
  ('class_reviews','Reviews: own read'),
  ('class_reviews','Reviews: own update'),
  ('class_reviews','Reviews: staff read'),
  ('class_types','Class types: admin manage'),
  ('class_types','Class types: public read'),
  ('coupon_categories','Coupon categories: admin manage'),
  ('coupon_categories','Coupon categories: public read'),
  ('coupons','Coupons: admin manage'),
  ('coupons','Coupons: read active'),
  ('credit_types','Credit types: admin manage'),
  ('credit_types','Credit types: public read'),
  ('email_queue','Email queue: staff read'),
  ('invoice_requests','invoice_admin_all'),
  ('invoice_requests','invoice_own_insert'),
  ('invoice_requests','invoice_own_read'),
  ('member_badges','badges_admin_read'),
  ('member_badges','badges_insert'),
  ('member_badges','badges_own_read'),
  ('member_categories','Categories: admin manage'),
  ('member_categories','Categories: public read'),
  ('notifications','Notifications: own read'),
  ('notifications','Notifications: own update'),
  ('notifications','Notifications: system insert'),
  ('pack_purchases','Purchases: admin insert'),
  ('pack_purchases','Purchases: admin read all'),
  ('pack_purchases','Purchases: admin update'),
  ('pack_purchases','Purchases: coach read all'),
  ('pack_purchases','Purchases: own insert'),
  ('pack_purchases','Purchases: own read'),
  ('pack_type_categories','Pack type categories: admin manage'),
  ('pack_type_categories','Pack type categories: public read'),
  ('pack_types','Pack types: admin insert'),
  ('pack_types','Pack types: admin update'),
  ('pack_types','Pack types: read active, detenu ou admin'),
  ('pack_types','Pack types: super admin delete'),
  ('performance_types','PerfTypes: coach/admin delete'),
  ('performance_types','PerfTypes: coach/admin insert'),
  ('performance_types','PerfTypes: coach/admin update'),
  ('performance_types','PerfTypes: read all'),
-- L'écart décrit ici jusqu'au 2026-08-28 est refermé : `bot` portait encore
-- `Perf: own insert / own update / own delete`, les deux dernières
-- n'autorisant PAS le coach. La migration 20260828_alignement_policies_bot.sql
-- l'a alignée sur install.sql — un coach peut désormais corriger et supprimer
-- une performance qu'il a saisie pour un membre, alors qu'il pouvait déjà la
-- créer.
  ('performances','Perf: delete'),
  ('performances','Perf: insert'),
  ('performances','Perf: own read'),
  ('performances','Perf: update'),
  ('profiles','Profiles: admin update all'),
  ('profiles','Profiles: insert on signup'),
  ('profiles','Profiles: own update'),
  ('profiles','Profiles: read when signed in'),
  ('referral_rewards','rewards_admin_all'),
  ('referral_rewards','rewards_own_read'),
  ('referrals','referrals_admin_all'),
  ('referrals','referrals_own_read'),
  ('registration_fees','reg_fees_admin_all'),
  ('registration_fees','reg_fees_admin_read'),
  ('registration_fees','reg_fees_insert'),
  ('registration_fees','reg_fees_own_read'),
  ('scheduled_classes','Classes: admin manage'),
  ('scheduled_classes','Classes: coach update own'),
  ('scheduled_classes','Classes: public read'),
  ('subscription_discounts','Sub discounts: admin all'),
  ('subscription_discounts','Sub discounts: own read'),
  ('subscriptions','Subscriptions: admin all'),
  ('subscriptions','Subscriptions: coach read'),
  ('subscriptions','Subscriptions: own read'),
-- user_roles n'a QUE des policies de lecture, volontairement : les écritures
-- passent par grant_user_role / revoke_user_role (SECURITY DEFINER), qui
-- vérifient la hiérarchie. Une policy d'écriture rouvrirait la faille corrigée
-- le 2026-08-06, où tout admin pouvait se créer un pair.
  ('user_roles','Roles: admin read all'),
  ('user_roles','Roles: read own or admin'),
  ('waitlist','Waitlist: admin insert'),
  ('waitlist','Waitlist: admin read'),
  ('waitlist','Waitlist: admin update'),
  ('waitlist','Waitlist: own delete'),
  ('waitlist','Waitlist: own insert'),
  ('waitlist','Waitlist: own read'),
  ('waitlist','Waitlist: own update')
)
SELECT 'MANQUANTE' AS anomalie, a.tbl AS tablename, a.pol AS policyname
FROM attendu a
LEFT JOIN pg_policies p
  ON p.schemaname = 'public' AND p.tablename = a.tbl AND p.policyname = a.pol
WHERE p.policyname IS NULL

UNION ALL

SELECT 'EN TROP', p.tablename, p.policyname
FROM pg_policies p
LEFT JOIN attendu a
  ON a.tbl = p.tablename AND a.pol = p.policyname
WHERE p.schemaname = 'public' AND a.pol IS NULL

ORDER BY 1, 2, 3;

-- ============================================================================
-- Droits de table (GRANT)
-- ============================================================================
--
-- Ajouté le 2026-08-28, après un bug que ce fichier ne pouvait pas voir.
--
-- Une policy ne s'applique QU'APRÈS le droit SQL. Une table protégée par RLS
-- mais sans GRANT n'est pas « verrouillée avec soin » : elle est inaccessible,
-- et PostgREST répond `permission denied for table ...` quelle que soit la
-- policy. Les 89 policies pouvaient donc être parfaites et l'application
-- entièrement vide — c'est exactement ce qui est arrivé sur une base neuve
-- créée sans « Automatically expose new tables ».
--
-- Les compteurs de contrôle (tables, policies, fonctions, triggers) étaient
-- tous justes. Aucun ne regardait les droits. D'où ce second volet.
--
-- Aucune ligne = conforme.

-- `coach_profiles` est exclue : le 2026-08-29, `anon` en a ete revoque
-- volontairement — la vue ne sert qu'a deux ecrans d'administration, et elle
-- exposait auparavant les e-mails et telephones des coachs a qui voulait les
-- lire. Un droit absent y est donc l'etat correct, pas une anomalie.
--
-- Le controle porte sur `anon` ET `authenticated` : un droit manquant pour
-- l'un des deux se voit a l'ecran comme « permission denied », symptome que
-- rien d'autre ne signale.
SELECT 'DROIT MANQUANT' AS anomalie,
       c.relname AS tablename,
       r.rolname || ' : ' || a.priv AS policyname
FROM pg_class c
CROSS JOIN (VALUES ('anon'), ('authenticated')) AS r(rolname)
CROSS JOIN (VALUES ('SELECT'), ('INSERT'), ('UPDATE'), ('DELETE')) AS a(priv)
WHERE c.relnamespace = 'public'::regnamespace
  AND c.relkind IN ('r', 'v')
  AND c.relname <> 'coach_profiles'
  AND NOT has_table_privilege(r.rolname, c.oid, a.priv)

UNION ALL

-- L'inverse : une table qui aurait perdu RLS serait, elle, réellement ouverte.
-- Le GRANT et RLS ne valent que l'un avec l'autre.
SELECT 'RLS DESACTIVE', c.relname, '(table exposee sans filtrage)'
FROM pg_class c
WHERE c.relnamespace = 'public'::regnamespace
  AND c.relkind = 'r'
  AND NOT c.relrowsecurity

ORDER BY 1, 2, 3;


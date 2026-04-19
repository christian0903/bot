-- ============================================
-- Vérification de la structure de la base
-- Back On Track v2
--
-- Exécuter dans le SQL Editor Supabase.
-- Retourne un tableau avec le statut de chaque élément.
-- Tout doit être OK. Si quelque chose est MISSING,
-- ré-exécuter le fichier phase correspondant.
-- ============================================

SELECT
  item,
  CASE WHEN found THEN 'OK' ELSE 'MISSING' END AS status
FROM (

  -- ==================
  -- TABLES
  -- ==================
  SELECT 'Table: profiles' AS item,
    EXISTS(SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'profiles') AS found
  UNION ALL
  SELECT 'Table: user_roles',
    EXISTS(SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'user_roles')
  UNION ALL
  SELECT 'Table: member_categories',
    EXISTS(SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'member_categories')
  UNION ALL
  SELECT 'Table: credit_types',
    EXISTS(SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'credit_types')
  UNION ALL
  SELECT 'Table: pack_types',
    EXISTS(SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'pack_types')
  UNION ALL
  SELECT 'Table: pack_type_categories',
    EXISTS(SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'pack_type_categories')
  UNION ALL
  SELECT 'Table: pack_purchases',
    EXISTS(SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'pack_purchases')
  UNION ALL
  SELECT 'Table: coupons',
    EXISTS(SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'coupons')
  UNION ALL
  SELECT 'Table: class_types',
    EXISTS(SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'class_types')
  UNION ALL
  SELECT 'Table: scheduled_classes',
    EXISTS(SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'scheduled_classes')
  UNION ALL
  SELECT 'Table: bookings',
    EXISTS(SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'bookings')
  UNION ALL
  SELECT 'Table: waitlist',
    EXISTS(SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'waitlist')
  UNION ALL
  SELECT 'Table: notifications',
    EXISTS(SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'notifications')
  UNION ALL
  SELECT 'Table: app_settings',
    EXISTS(SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'app_settings')
  UNION ALL
  SELECT 'Table: activity_log',
    EXISTS(SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'activity_log')
  UNION ALL
  SELECT 'Table: registration_fees (Phase 3)',
    EXISTS(SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'registration_fees')
  UNION ALL
  SELECT 'Table: trial_sessions (Phase 3)',
    EXISTS(SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'trial_sessions')

  UNION ALL

  -- ==================
  -- COLONNES PHASE 1
  -- ==================
  SELECT 'Column: profiles.date_of_birth (Phase 1)',
    EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'date_of_birth')
  UNION ALL
  SELECT 'Column: profiles.address (Phase 1)',
    EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'address')
  UNION ALL
  SELECT 'Column: profiles.emergency_contact_name (Phase 1)',
    EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'emergency_contact_name')
  UNION ALL
  SELECT 'Column: profiles.emergency_contact_phone (Phase 1)',
    EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'emergency_contact_phone')
  UNION ALL
  SELECT 'Column: profiles.objectives (Phase 1)',
    EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'objectives')
  UNION ALL
  SELECT 'Column: profiles.fitness_level (Phase 1)',
    EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'fitness_level')
  UNION ALL
  SELECT 'Column: profiles.medical_conditions (Phase 1)',
    EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'medical_conditions')
  UNION ALL
  SELECT 'Column: profiles.cgv_accepted_at (Phase 1)',
    EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'cgv_accepted_at')
  UNION ALL
  SELECT 'Column: profiles.rgpd_accepted_at (Phase 1)',
    EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'rgpd_accepted_at')
  UNION ALL
  SELECT 'Column: profiles.referral_code (Phase 1)',
    EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'referral_code')
  UNION ALL
  SELECT 'Column: profiles.member_status (Phase 1)',
    EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'member_status')
  UNION ALL
  SELECT 'Column: scheduled_classes.floor (Phase 1)',
    EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name = 'scheduled_classes' AND column_name = 'floor')
  UNION ALL
  SELECT 'Column: class_types.color (Phase 1)',
    EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name = 'class_types' AND column_name = 'color')

  UNION ALL

  -- ==================
  -- ENUM super_admin
  -- ==================
  SELECT 'Enum: user_role has super_admin (Phase 1)',
    EXISTS(SELECT 1 FROM pg_enum e JOIN pg_type t ON e.enumtypid = t.oid WHERE t.typname = 'user_role' AND e.enumlabel = 'super_admin')

  UNION ALL

  -- ==================
  -- FONCTIONS
  -- ==================
  SELECT 'Function: has_role',
    EXISTS(SELECT 1 FROM pg_proc WHERE proname = 'has_role')
  UNION ALL
  SELECT 'Function: get_available_credits',
    EXISTS(SELECT 1 FROM pg_proc WHERE proname = 'get_available_credits')
  UNION ALL
  SELECT 'Function: consume_credit',
    EXISTS(SELECT 1 FROM pg_proc WHERE proname = 'consume_credit')
  UNION ALL
  SELECT 'Function: booking_revenue',
    EXISTS(SELECT 1 FROM pg_proc WHERE proname = 'booking_revenue')
  UNION ALL
  SELECT 'Function: generate_referral_code (Phase 1)',
    EXISTS(SELECT 1 FROM pg_proc WHERE proname = 'generate_referral_code')
  UNION ALL
  SELECT 'Function: handle_new_user',
    EXISTS(SELECT 1 FROM pg_proc WHERE proname = 'handle_new_user')
  UNION ALL
  SELECT 'Function: update_member_status (Phase 3)',
    EXISTS(SELECT 1 FROM pg_proc WHERE proname = 'update_member_status')
  UNION ALL
  SELECT 'Function: has_registration_fee (Phase 3)',
    EXISTS(SELECT 1 FROM pg_proc WHERE proname = 'has_registration_fee')
  UNION ALL
  SELECT 'Function: has_used_trial (Phase 3)',
    EXISTS(SELECT 1 FROM pg_proc WHERE proname = 'has_used_trial')

  UNION ALL

  -- ==================
  -- TRIGGERS
  -- ==================
  SELECT 'Trigger: on_auth_user_created',
    EXISTS(SELECT 1 FROM information_schema.triggers WHERE trigger_name = 'on_auth_user_created')
  UNION ALL
  SELECT 'Trigger: generate_referral_code_trigger (Phase 1)',
    EXISTS(SELECT 1 FROM information_schema.triggers WHERE trigger_name = 'generate_referral_code_trigger')

  UNION ALL

  -- ==================
  -- RLS ACTIVÉ
  -- ==================
  SELECT 'RLS: profiles',
    EXISTS(SELECT 1 FROM pg_tables WHERE tablename = 'profiles' AND rowsecurity = true)
  UNION ALL
  SELECT 'RLS: user_roles',
    EXISTS(SELECT 1 FROM pg_tables WHERE tablename = 'user_roles' AND rowsecurity = true)
  UNION ALL
  SELECT 'RLS: bookings',
    EXISTS(SELECT 1 FROM pg_tables WHERE tablename = 'bookings' AND rowsecurity = true)
  UNION ALL
  SELECT 'RLS: pack_purchases',
    EXISTS(SELECT 1 FROM pg_tables WHERE tablename = 'pack_purchases' AND rowsecurity = true)
  UNION ALL
  SELECT 'RLS: notifications',
    EXISTS(SELECT 1 FROM pg_tables WHERE tablename = 'notifications' AND rowsecurity = true)
  UNION ALL
  SELECT 'RLS: registration_fees (Phase 3)',
    EXISTS(SELECT 1 FROM pg_tables WHERE tablename = 'registration_fees' AND rowsecurity = true)
  UNION ALL
  SELECT 'RLS: trial_sessions (Phase 3)',
    EXISTS(SELECT 1 FROM pg_tables WHERE tablename = 'trial_sessions' AND rowsecurity = true)

  UNION ALL

  -- ==================
  -- SETTINGS
  -- ==================
  SELECT 'Setting: booking_rules (Phase 1)',
    EXISTS(SELECT 1 FROM app_settings WHERE key = 'booking_rules')
  UNION ALL
  SELECT 'Setting: payment_provider (Phase 1)',
    EXISTS(SELECT 1 FROM app_settings WHERE key = 'payment_provider')
  UNION ALL
  SELECT 'Setting: studio_info (Phase 1)',
    EXISTS(SELECT 1 FROM app_settings WHERE key = 'studio_info')
  UNION ALL
  SELECT 'Setting: registration_fee (Phase 3)',
    EXISTS(SELECT 1 FROM app_settings WHERE key = 'registration_fee')

) AS checks
ORDER BY
  CASE WHEN found THEN 1 ELSE 0 END,  -- MISSING en premier
  item;

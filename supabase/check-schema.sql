-- ============================================
-- Vérification de la structure de la base
-- Back On Track v2 — Complet
-- Retourne un tableau : tout doit être OK.
-- ============================================

SELECT item, CASE WHEN found THEN 'OK' ELSE 'MISSING' END AS status
FROM (
  -- TABLES
  SELECT 'Table: profiles' AS item, EXISTS(SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='profiles') AS found
  UNION ALL SELECT 'Table: user_roles', EXISTS(SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='user_roles')
  UNION ALL SELECT 'Table: member_categories', EXISTS(SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='member_categories')
  UNION ALL SELECT 'Table: credit_types', EXISTS(SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='credit_types')
  UNION ALL SELECT 'Table: coupons', EXISTS(SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='coupons')
  UNION ALL SELECT 'Table: pack_types', EXISTS(SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='pack_types')
  UNION ALL SELECT 'Table: pack_type_categories', EXISTS(SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='pack_type_categories')
  UNION ALL SELECT 'Table: pack_purchases', EXISTS(SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='pack_purchases')
  UNION ALL SELECT 'Table: class_types', EXISTS(SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='class_types')
  UNION ALL SELECT 'Table: scheduled_classes', EXISTS(SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='scheduled_classes')
  UNION ALL SELECT 'Table: bookings', EXISTS(SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='bookings')
  UNION ALL SELECT 'Table: waitlist', EXISTS(SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='waitlist')
  UNION ALL SELECT 'Table: notifications', EXISTS(SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='notifications')
  UNION ALL SELECT 'Table: app_settings', EXISTS(SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='app_settings')
  UNION ALL SELECT 'Table: activity_log', EXISTS(SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='activity_log')
  UNION ALL SELECT 'Table: registration_fees', EXISTS(SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='registration_fees')
  UNION ALL SELECT 'Table: trial_sessions', EXISTS(SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='trial_sessions')
  UNION ALL SELECT 'Table: invoice_requests', EXISTS(SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='invoice_requests')

  -- COLONNES CLÉS
  UNION ALL SELECT 'Col: profiles.date_of_birth', EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='date_of_birth')
  UNION ALL SELECT 'Col: profiles.address', EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='address')
  UNION ALL SELECT 'Col: profiles.referral_code', EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='referral_code')
  UNION ALL SELECT 'Col: profiles.member_status', EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='member_status')
  UNION ALL SELECT 'Col: profiles.cgv_accepted_at', EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='cgv_accepted_at')
  UNION ALL SELECT 'Col: scheduled_classes.floor', EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='scheduled_classes' AND column_name='floor')
  UNION ALL SELECT 'Col: class_types.color', EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='class_types' AND column_name='color')
  UNION ALL SELECT 'Col: bookings.checked_in_at', EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='bookings' AND column_name='checked_in_at')
  UNION ALL SELECT 'Col: bookings.is_no_show', EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='bookings' AND column_name='is_no_show')
  UNION ALL SELECT 'Col: pack_purchases.mollie_payment_id', EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='pack_purchases' AND column_name='mollie_payment_id')
  UNION ALL SELECT 'Col: profiles.weekly_goal', EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='weekly_goal')
  UNION ALL SELECT 'Col: profiles.instagram_url', EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='instagram_url')
  UNION ALL SELECT 'Col: profiles.coach_description', EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='coach_description')
  UNION ALL SELECT 'Col: class_types.image_url', EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='class_types' AND column_name='image_url')
  UNION ALL SELECT 'Col: class_types.description_md', EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='class_types' AND column_name='description_md')

  -- ENUMS
  UNION ALL SELECT 'Enum: user_role.super_admin', EXISTS(SELECT 1 FROM pg_enum e JOIN pg_type t ON e.enumtypid=t.oid WHERE t.typname='user_role' AND e.enumlabel='super_admin')
  UNION ALL SELECT 'Enum: activity_action.check_in', EXISTS(SELECT 1 FROM pg_enum e JOIN pg_type t ON e.enumtypid=t.oid WHERE t.typname='activity_action' AND e.enumlabel='check_in')
  UNION ALL SELECT 'Enum: activity_action.user_created', EXISTS(SELECT 1 FROM pg_enum e JOIN pg_type t ON e.enumtypid=t.oid WHERE t.typname='activity_action' AND e.enumlabel='user_created')
  UNION ALL SELECT 'Enum: activity_action.trial_booked', EXISTS(SELECT 1 FROM pg_enum e JOIN pg_type t ON e.enumtypid=t.oid WHERE t.typname='activity_action' AND e.enumlabel='trial_booked')

  -- FONCTIONS
  UNION ALL SELECT 'Func: has_role', EXISTS(SELECT 1 FROM pg_proc WHERE proname='has_role')
  UNION ALL SELECT 'Func: get_available_credits', EXISTS(SELECT 1 FROM pg_proc WHERE proname='get_available_credits')
  UNION ALL SELECT 'Func: consume_credit', EXISTS(SELECT 1 FROM pg_proc WHERE proname='consume_credit')
  UNION ALL SELECT 'Func: booking_revenue', EXISTS(SELECT 1 FROM pg_proc WHERE proname='booking_revenue')
  UNION ALL SELECT 'Func: generate_referral_code', EXISTS(SELECT 1 FROM pg_proc WHERE proname='generate_referral_code')
  UNION ALL SELECT 'Func: handle_new_user', EXISTS(SELECT 1 FROM pg_proc WHERE proname='handle_new_user')
  UNION ALL SELECT 'Func: promote_from_waitlist', EXISTS(SELECT 1 FROM pg_proc WHERE proname='promote_from_waitlist')
  UNION ALL SELECT 'Func: update_member_status', EXISTS(SELECT 1 FROM pg_proc WHERE proname='update_member_status')
  UNION ALL SELECT 'Func: has_registration_fee', EXISTS(SELECT 1 FROM pg_proc WHERE proname='has_registration_fee')
  UNION ALL SELECT 'Func: has_used_trial', EXISTS(SELECT 1 FROM pg_proc WHERE proname='has_used_trial')
  UNION ALL SELECT 'Func: can_book_class', EXISTS(SELECT 1 FROM pg_proc WHERE proname='can_book_class')
  UNION ALL SELECT 'Func: cancel_booking_v2', EXISTS(SELECT 1 FROM pg_proc WHERE proname='cancel_booking_v2')

  -- TRIGGERS
  UNION ALL SELECT 'Trigger: on_auth_user_created', EXISTS(SELECT 1 FROM information_schema.triggers WHERE trigger_name='on_auth_user_created')
  UNION ALL SELECT 'Trigger: generate_referral_code', EXISTS(SELECT 1 FROM information_schema.triggers WHERE trigger_name='generate_referral_code_trigger')

  -- RLS
  UNION ALL SELECT 'RLS: profiles', EXISTS(SELECT 1 FROM pg_tables WHERE tablename='profiles' AND rowsecurity=true)
  UNION ALL SELECT 'RLS: bookings', EXISTS(SELECT 1 FROM pg_tables WHERE tablename='bookings' AND rowsecurity=true)
  UNION ALL SELECT 'RLS: registration_fees', EXISTS(SELECT 1 FROM pg_tables WHERE tablename='registration_fees' AND rowsecurity=true)
  UNION ALL SELECT 'RLS: trial_sessions', EXISTS(SELECT 1 FROM pg_tables WHERE tablename='trial_sessions' AND rowsecurity=true)
  UNION ALL SELECT 'RLS: invoice_requests', EXISTS(SELECT 1 FROM pg_tables WHERE tablename='invoice_requests' AND rowsecurity=true)

  -- SETTINGS
  UNION ALL SELECT 'Setting: booking_rules', EXISTS(SELECT 1 FROM app_settings WHERE key='booking_rules')
  UNION ALL SELECT 'Setting: studio_info', EXISTS(SELECT 1 FROM app_settings WHERE key='studio_info')
  UNION ALL SELECT 'Setting: registration_fee', EXISTS(SELECT 1 FROM app_settings WHERE key='registration_fee')
  UNION ALL SELECT 'Setting: room_names', EXISTS(SELECT 1 FROM app_settings WHERE key='room_names')
  UNION ALL SELECT 'Setting: payment_provider', EXISTS(SELECT 1 FROM app_settings WHERE key='payment_provider')

  -- VUE
  UNION ALL SELECT 'View: coach_profiles', EXISTS(SELECT 1 FROM information_schema.views WHERE table_schema='public' AND table_name='coach_profiles')
) AS checks
ORDER BY CASE WHEN found THEN 1 ELSE 0 END, item;

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
  UNION ALL SELECT 'Col: pack_purchases.stripe_payment_intent_id', EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='pack_purchases' AND column_name='stripe_payment_intent_id')
  UNION ALL SELECT 'Col: pack_types.is_unlimited', EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='pack_types' AND column_name='is_unlimited')
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
  UNION ALL SELECT 'Func: refund_credit', EXISTS(SELECT 1 FROM pg_proc WHERE proname='refund_credit')
  UNION ALL SELECT 'Func: booking_revenue', EXISTS(SELECT 1 FROM pg_proc WHERE proname='booking_revenue')
  UNION ALL SELECT 'Func: generate_referral_code', EXISTS(SELECT 1 FROM pg_proc WHERE proname='generate_referral_code')
  UNION ALL SELECT 'Func: handle_new_user', EXISTS(SELECT 1 FROM pg_proc WHERE proname='handle_new_user')
  UNION ALL SELECT 'Func: promote_from_waitlist', EXISTS(SELECT 1 FROM pg_proc WHERE proname='promote_from_waitlist')
  UNION ALL SELECT 'Func: update_member_status', EXISTS(SELECT 1 FROM pg_proc WHERE proname='update_member_status')
  UNION ALL SELECT 'Func: has_registration_fee', EXISTS(SELECT 1 FROM pg_proc WHERE proname='has_registration_fee')
  UNION ALL SELECT 'Func: has_used_trial', EXISTS(SELECT 1 FROM pg_proc WHERE proname='has_used_trial')
  UNION ALL SELECT 'Func: grant_trial_pack', EXISTS(SELECT 1 FROM pg_proc WHERE proname='grant_trial_pack')
  UNION ALL SELECT 'Func: can_book_class', EXISTS(SELECT 1 FROM pg_proc WHERE proname='can_book_class')
  UNION ALL SELECT 'Func: cancel_booking_v2', EXISTS(SELECT 1 FROM pg_proc WHERE proname='cancel_booking_v2')

  -- TRIGGERS
  UNION ALL SELECT 'Trigger: on_auth_user_created', EXISTS(SELECT 1 FROM information_schema.triggers WHERE trigger_name='on_auth_user_created')
  UNION ALL SELECT 'Trigger: generate_referral_code', EXISTS(SELECT 1 FROM information_schema.triggers WHERE trigger_name='generate_referral_code_trigger')
  UNION ALL SELECT 'Trigger: on_profile_created_grant_trial', EXISTS(SELECT 1 FROM information_schema.triggers WHERE trigger_name='on_profile_created_grant_trial')

  -- PACK D'ESSAI (2026-08-07)
  UNION ALL SELECT 'Col: bookings.is_trial', EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='bookings' AND column_name='is_trial')
  UNION ALL SELECT 'Col: bookings.pack_purchase_id nullable', EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='bookings' AND column_name='pack_purchase_id' AND is_nullable='YES')
  UNION ALL SELECT 'Col: pack_types.is_purchasable', EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='pack_types' AND column_name='is_purchasable')
  UNION ALL SELECT 'Col: pack_types.is_trial', EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='pack_types' AND column_name='is_trial')
  UNION ALL SELECT 'Data: pack d''essai present', EXISTS(SELECT 1 FROM pack_types WHERE is_trial AND is_active)
  UNION ALL SELECT 'Table: trial_sessions supprimee', NOT EXISTS(SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='trial_sessions')
  UNION ALL SELECT 'Setting: trial_pack', EXISTS(SELECT 1 FROM app_settings WHERE key='trial_pack')

  -- COMMUNICATIONS ET FILE D'E-MAILS (2026-08-07)
  UNION ALL SELECT 'Col: notifications.dismissed_at', EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='notifications' AND column_name='dismissed_at')
  UNION ALL SELECT 'Col: notifications.email_template', EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='notifications' AND column_name='email_template')
  UNION ALL SELECT 'Table: email_queue', EXISTS(SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='email_queue')
  UNION ALL SELECT 'Func: queue_email', EXISTS(SELECT 1 FROM pg_proc WHERE proname='queue_email')
  UNION ALL SELECT 'Func: dismiss_read_notifications', EXISTS(SELECT 1 FROM pg_proc WHERE proname='dismiss_read_notifications')
  UNION ALL SELECT 'Func: decline_modified_booking', EXISTS(SELECT 1 FROM pg_proc WHERE proname='decline_modified_booking')
  UNION ALL SELECT 'RLS: email_queue', EXISTS(SELECT 1 FROM pg_tables WHERE tablename='email_queue' AND rowsecurity=true)

  -- PERFORMANCES MESURABLES (2026-08-07)
  UNION ALL SELECT 'Col: performance_types.measure_kind', EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='performance_types' AND column_name='measure_kind')
  UNION ALL SELECT 'Col: performance_types.lower_is_better', EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='performance_types' AND column_name='lower_is_better')
  UNION ALL SELECT 'Col: performances.value_num', EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='performances' AND column_name='value_num')
  UNION ALL SELECT 'Func: parse_performance_value', EXISTS(SELECT 1 FROM pg_proc WHERE proname='parse_performance_value')

  -- SUPPRESSION DE COMPTE — prerequis App Store (2026-08-07)
  UNION ALL SELECT 'Col: profiles.deleted_at', EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='deleted_at')
  UNION ALL SELECT 'Func: can_delete_own_account', EXISTS(SELECT 1 FROM pg_proc WHERE proname='can_delete_own_account')
  UNION ALL SELECT 'Func: delete_own_account', EXISTS(SELECT 1 FROM pg_proc WHERE proname='delete_own_account')
  UNION ALL SELECT 'Func: delete_member_account', EXISTS(SELECT 1 FROM pg_proc WHERE proname='delete_member_account')

  -- AVIS SUR LES COURS (2026-08-07)
  UNION ALL SELECT 'Table: class_reviews', EXISTS(SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='class_reviews')
  UNION ALL SELECT 'Func: submit_class_review', EXISTS(SELECT 1 FROM pg_proc WHERE proname='submit_class_review')
  UNION ALL SELECT 'Func: pending_class_reviews', EXISTS(SELECT 1 FROM pg_proc WHERE proname='pending_class_reviews')
  UNION ALL SELECT 'RLS: class_reviews', EXISTS(SELECT 1 FROM pg_tables WHERE tablename='class_reviews' AND rowsecurity=true)
  UNION ALL SELECT 'Setting: class_reviews', EXISTS(SELECT 1 FROM app_settings WHERE key='class_reviews')
  UNION ALL SELECT 'Enum: activity_action.account_deleted', EXISTS(SELECT 1 FROM pg_enum e JOIN pg_type t ON e.enumtypid=t.oid WHERE t.typname='activity_action' AND e.enumlabel='account_deleted')

  -- RLS
  UNION ALL SELECT 'RLS: profiles', EXISTS(SELECT 1 FROM pg_tables WHERE tablename='profiles' AND rowsecurity=true)
  UNION ALL SELECT 'RLS: bookings', EXISTS(SELECT 1 FROM pg_tables WHERE tablename='bookings' AND rowsecurity=true)
  UNION ALL SELECT 'RLS: registration_fees', EXISTS(SELECT 1 FROM pg_tables WHERE tablename='registration_fees' AND rowsecurity=true)
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

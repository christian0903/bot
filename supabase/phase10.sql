-- ============================================
-- PHASE 10 : Stats membre
-- Back On Track v2
--
-- Exécuter en une seule fois dans le SQL Editor Supabase.
-- ============================================

-- 1. Séances par période
CREATE OR REPLACE FUNCTION member_sessions_count(p_user_id UUID, p_from DATE, p_to DATE)
RETURNS INTEGER
LANGUAGE sql SECURITY DEFINER STABLE
AS $$
  SELECT COUNT(*)::INTEGER FROM bookings b
  JOIN scheduled_classes sc ON b.scheduled_class_id = sc.id
  WHERE b.user_id = p_user_id
    AND b.status = 'confirmed'
    AND (b.checked_in_at IS NOT NULL OR sc.starts_at > NOW())
    AND sc.starts_at::DATE BETWEEN p_from AND p_to;
$$;

-- 2. Répartition par type de cours
CREATE OR REPLACE FUNCTION member_sessions_by_type(p_user_id UUID)
RETURNS TABLE(class_type_name TEXT, class_type_color TEXT, count BIGINT)
LANGUAGE sql SECURITY DEFINER STABLE
AS $$
  SELECT ct.name, ct.color, COUNT(*)
  FROM bookings b
  JOIN scheduled_classes sc ON b.scheduled_class_id = sc.id
  JOIN class_types ct ON sc.class_type_id = ct.id
  WHERE b.user_id = p_user_id
    AND b.status = 'confirmed'
    AND (b.checked_in_at IS NOT NULL OR sc.starts_at > NOW())
  GROUP BY ct.name, ct.color
  ORDER BY count DESC;
$$;

-- 3. Séances par mois (12 derniers mois)
CREATE OR REPLACE FUNCTION member_sessions_by_month(p_user_id UUID)
RETURNS TABLE(month TEXT, count BIGINT)
LANGUAGE sql SECURITY DEFINER STABLE
AS $$
  SELECT TO_CHAR(sc.starts_at, 'YYYY-MM') AS month, COUNT(*)
  FROM bookings b
  JOIN scheduled_classes sc ON b.scheduled_class_id = sc.id
  WHERE b.user_id = p_user_id
    AND b.status = 'confirmed'
    AND (b.checked_in_at IS NOT NULL OR sc.starts_at > NOW())
    AND sc.starts_at > NOW() - INTERVAL '12 months'
  GROUP BY month
  ORDER BY month;
$$;

-- 4. Streak (semaines consécutives avec au moins 1 séance)
CREATE OR REPLACE FUNCTION member_streak(p_user_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql SECURITY DEFINER STABLE
AS '
DECLARE
  v_streak INTEGER := 0;
  v_week_start DATE;
  v_has_session BOOLEAN;
BEGIN
  v_week_start := date_trunc(''week'', NOW())::DATE;
  LOOP
    SELECT EXISTS(
      SELECT 1 FROM bookings b
      JOIN scheduled_classes sc ON b.scheduled_class_id = sc.id
      WHERE b.user_id = p_user_id
        AND b.status = ''confirmed''
        AND (b.checked_in_at IS NOT NULL OR sc.starts_at > NOW())
        AND sc.starts_at::DATE BETWEEN v_week_start AND v_week_start + 6
    ) INTO v_has_session;

    IF v_has_session THEN
      v_streak := v_streak + 1;
      v_week_start := v_week_start - 7;
    ELSE
      EXIT;
    END IF;
  END LOOP;
  RETURN v_streak;
END;
';

-- 5. Jours d'entraînement (pour calendrier coloré, 3 derniers mois)
CREATE OR REPLACE FUNCTION member_training_days(p_user_id UUID)
RETURNS TABLE(training_date DATE)
LANGUAGE sql SECURITY DEFINER STABLE
AS $$
  SELECT DISTINCT sc.starts_at::DATE AS training_date
  FROM bookings b
  JOIN scheduled_classes sc ON b.scheduled_class_id = sc.id
  WHERE b.user_id = p_user_id
    AND b.status = 'confirmed'
    AND (b.checked_in_at IS NOT NULL OR sc.starts_at > NOW())
    AND sc.starts_at > NOW() - INTERVAL '3 months'
  ORDER BY training_date;
$$;

-- 6. Objectif hebdo + badges
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS weekly_goal INTEGER DEFAULT 3;

CREATE TABLE IF NOT EXISTS member_badges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  badge_type TEXT NOT NULL,
  earned_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, badge_type)
);

ALTER TABLE member_badges ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "badges_own_read" ON member_badges;
CREATE POLICY "badges_own_read" ON member_badges FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "badges_insert" ON member_badges;
CREATE POLICY "badges_insert" ON member_badges FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "badges_admin_read" ON member_badges;
CREATE POLICY "badges_admin_read" ON member_badges FOR SELECT USING (has_role(auth.uid(), 'admin'));

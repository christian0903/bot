-- ============================================
-- Back on Track - Activity Log (Logbook)
-- ============================================

CREATE TYPE activity_action AS ENUM (
  'pack_purchased',
  'pack_assigned',
  'pack_modified',
  'booking_created',
  'booking_cancelled',
  'booking_assigned',
  'role_changed',
  'waitlist_joined',
  'waitlist_promoted'
);

CREATE TABLE activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action activity_action NOT NULL,
  actor_id UUID REFERENCES auth.users(id),          -- qui a fait l'action (NULL = système)
  target_user_id UUID REFERENCES auth.users(id),    -- utilisateur concerné
  entity_type TEXT,                                  -- 'pack_purchase', 'booking', 'scheduled_class', 'user_roles'
  entity_id UUID,                                    -- ID de l'entité concernée
  details JSONB DEFAULT '{}'::jsonb,                 -- données structurées (avant/après, montants, etc.)
  description TEXT NOT NULL,                         -- résumé lisible
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_activity_log_created_at ON activity_log(created_at DESC);
CREATE INDEX idx_activity_log_target_user ON activity_log(target_user_id);
CREATE INDEX idx_activity_log_actor ON activity_log(actor_id);
CREATE INDEX idx_activity_log_action ON activity_log(action);

ALTER TABLE activity_log ENABLE ROW LEVEL SECURITY;

-- Admins et coachs peuvent lire
CREATE POLICY "Activity log: admin read" ON activity_log
  FOR SELECT USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Activity log: coach read" ON activity_log
  FOR SELECT USING (has_role(auth.uid(), 'coach'));

-- Admins et coachs peuvent insérer
CREATE POLICY "Activity log: admin insert" ON activity_log
  FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin'));
CREATE POLICY "Activity log: coach insert" ON activity_log
  FOR INSERT WITH CHECK (has_role(auth.uid(), 'coach'));

-- Les clients peuvent lire leur propre historique
CREATE POLICY "Activity log: own read" ON activity_log
  FOR SELECT USING (auth.uid() = target_user_id);

-- Système (via trigger) peut insérer
CREATE POLICY "Activity log: system insert" ON activity_log
  FOR INSERT WITH CHECK (true);

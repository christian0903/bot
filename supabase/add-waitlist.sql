-- ============================================
-- 1. Nombre max de participants par type de cours
-- ============================================
ALTER TABLE class_types ADD COLUMN IF NOT EXISTS default_max_participants INTEGER DEFAULT 4;

-- Mettre à jour les types existants
UPDATE class_types SET default_max_participants = 4;

-- ============================================
-- 2. Table liste d'attente
-- ============================================
CREATE TABLE IF NOT EXISTS waitlist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scheduled_class_id UUID NOT NULL REFERENCES scheduled_classes(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  position INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  notified_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,  -- délai pour confirmer après notification
  status TEXT NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting', 'offered', 'confirmed', 'expired', 'cancelled')),
  UNIQUE(scheduled_class_id, user_id)
);

ALTER TABLE waitlist ENABLE ROW LEVEL SECURITY;

-- RLS
CREATE POLICY "Waitlist: own read" ON waitlist
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Waitlist: admin read" ON waitlist
  FOR SELECT USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Waitlist: own insert" ON waitlist
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Waitlist: admin insert" ON waitlist
  FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin'));
CREATE POLICY "Waitlist: own update" ON waitlist
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Waitlist: admin update" ON waitlist
  FOR UPDATE USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Waitlist: own delete" ON waitlist
  FOR DELETE USING (auth.uid() = user_id);

-- ============================================
-- 3. Fonction : prochaine position dans la liste d'attente
-- ============================================
CREATE OR REPLACE FUNCTION next_waitlist_position(p_scheduled_class_id UUID)
RETURNS INTEGER AS $$
  SELECT COALESCE(MAX(position), 0) + 1
  FROM waitlist
  WHERE scheduled_class_id = p_scheduled_class_id
    AND status IN ('waiting', 'offered');
$$ LANGUAGE sql STABLE;

-- ============================================
-- 4. Fonction : promouvoir le premier en liste d'attente
--    Appelée quand une réservation est annulée
-- ============================================
CREATE OR REPLACE FUNCTION promote_from_waitlist(p_scheduled_class_id UUID)
RETURNS UUID AS $$
DECLARE
  v_waitlist_entry RECORD;
BEGIN
  -- Trouver le premier en attente
  SELECT * INTO v_waitlist_entry
  FROM waitlist
  WHERE scheduled_class_id = p_scheduled_class_id
    AND status = 'waiting'
  ORDER BY position ASC
  LIMIT 1;

  IF v_waitlist_entry.id IS NULL THEN
    RETURN NULL;
  END IF;

  -- Marquer comme "offert" avec un délai de 2h pour confirmer
  UPDATE waitlist
  SET status = 'offered',
      notified_at = NOW(),
      expires_at = NOW() + interval '2 hours'
  WHERE id = v_waitlist_entry.id;

  -- Envoyer une notification
  INSERT INTO notifications (user_id, title, message, type, link)
  VALUES (
    v_waitlist_entry.user_id,
    'Place disponible !',
    'Une place s''est libérée pour votre cours. Vous avez 2h pour confirmer.',
    'success',
    '/schedule'
  );

  RETURN v_waitlist_entry.id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 5. Compter les réservations confirmées par cours
-- ============================================
CREATE OR REPLACE FUNCTION class_bookings_count(p_scheduled_class_id UUID)
RETURNS INTEGER AS $$
  SELECT COUNT(*)::INTEGER
  FROM bookings
  WHERE scheduled_class_id = p_scheduled_class_id
    AND status = 'confirmed';
$$ LANGUAGE sql STABLE;

-- ============================================
-- 6. Activer le realtime sur waitlist
-- ============================================
ALTER PUBLICATION supabase_realtime ADD TABLE waitlist;

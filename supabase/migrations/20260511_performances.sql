-- Performance tracking: catalog of types (managed by coaches/admins)
-- + per-user entries (encoded by the user or staff)

CREATE TABLE IF NOT EXISTS performance_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  unit_hint TEXT,
  color TEXT,
  display_order INTEGER NOT NULL DEFAULT 0,
  archived BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS performances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  performance_type_id UUID NOT NULL REFERENCES performance_types(id) ON DELETE RESTRICT,
  date DATE NOT NULL,
  value TEXT NOT NULL,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_performances_user_date ON performances(user_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_performances_type ON performances(performance_type_id);

ALTER TABLE performance_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE performances ENABLE ROW LEVEL SECURITY;

-- performance_types: read by all authenticated, write by coach + admin
DROP POLICY IF EXISTS "PerfTypes: read all" ON performance_types;
CREATE POLICY "PerfTypes: read all" ON performance_types FOR SELECT
  USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "PerfTypes: coach/admin insert" ON performance_types;
CREATE POLICY "PerfTypes: coach/admin insert" ON performance_types FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'coach') OR has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "PerfTypes: coach/admin update" ON performance_types;
CREATE POLICY "PerfTypes: coach/admin update" ON performance_types FOR UPDATE
  USING (has_role(auth.uid(), 'coach') OR has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "PerfTypes: coach/admin delete" ON performance_types;
CREATE POLICY "PerfTypes: coach/admin delete" ON performance_types FOR DELETE
  USING (has_role(auth.uid(), 'coach') OR has_role(auth.uid(), 'admin'));

-- performances: own data, plus coach/admin see and write for all
DROP POLICY IF EXISTS "Perf: own read" ON performances;
CREATE POLICY "Perf: own read" ON performances FOR SELECT
  USING (auth.uid() = user_id OR has_role(auth.uid(), 'coach') OR has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Perf: own insert" ON performances;
CREATE POLICY "Perf: own insert" ON performances FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    OR has_role(auth.uid(), 'coach')
    OR has_role(auth.uid(), 'admin')
  );

DROP POLICY IF EXISTS "Perf: own update" ON performances;
CREATE POLICY "Perf: own update" ON performances FOR UPDATE
  USING (auth.uid() = user_id OR has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Perf: own delete" ON performances;
CREATE POLICY "Perf: own delete" ON performances FOR DELETE
  USING (auth.uid() = user_id OR has_role(auth.uid(), 'admin'));

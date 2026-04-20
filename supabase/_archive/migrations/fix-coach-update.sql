-- Permettre aux coachs de modifier leurs propres cours (max_participants, etc.)
CREATE POLICY "Classes: coach update own" ON scheduled_classes
  FOR UPDATE USING (auth.uid() = coach_id);

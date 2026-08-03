-- Align performances UPDATE/DELETE with INSERT: coach + admin can also edit.
-- Previously only the owner or an admin could update/delete, which left
-- coaches unable to fix their own typos after encoding for a member.

DROP POLICY IF EXISTS "Perf: own update" ON performances;
CREATE POLICY "Perf: update" ON performances FOR UPDATE
  USING (auth.uid() = user_id OR has_role(auth.uid(), 'coach') OR has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Perf: own delete" ON performances;
CREATE POLICY "Perf: delete" ON performances FOR DELETE
  USING (auth.uid() = user_id OR has_role(auth.uid(), 'coach') OR has_role(auth.uid(), 'admin'));

-- Fix booking RLS policies for coach/admin actions
-- Exécuter en une seule fois

-- Coach peut lire les bookings de TOUS les cours (pas seulement les siens)
-- Nécessaire pour que le coach puisse voir les inscrits depuis le planning
DROP POLICY IF EXISTS "Bookings: coach read own classes" ON bookings;
CREATE POLICY "Bookings: coach read all classes" ON bookings
  FOR SELECT USING (has_role(auth.uid(), 'coach'));

-- Admin peut insérer des bookings pour n'importe quel membre
DROP POLICY IF EXISTS "Bookings: admin insert" ON bookings;
CREATE POLICY "Bookings: admin insert" ON bookings
  FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin'));

-- Coach peut insérer des bookings (ajouter un membre à un cours)
DROP POLICY IF EXISTS "Bookings: coach insert" ON bookings;
CREATE POLICY "Bookings: coach insert" ON bookings
  FOR INSERT WITH CHECK (has_role(auth.uid(), 'coach'));

-- Coach peut mettre à jour les bookings (pour le check-in)
DROP POLICY IF EXISTS "Bookings: coach update" ON bookings;
CREATE POLICY "Bookings: coach update" ON bookings
  FOR UPDATE USING (has_role(auth.uid(), 'coach'));

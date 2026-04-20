-- Permettre aux admins d'insérer des pack_purchases pour n'importe quel utilisateur
CREATE POLICY "Purchases: admin insert" ON pack_purchases
  FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin'));

-- Permettre aux admins d'insérer des bookings pour n'importe quel utilisateur
CREATE POLICY "Bookings: admin insert" ON bookings
  FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin'));

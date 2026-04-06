-- Permettre aux admins d'insérer des pack_purchases pour n'importe quel utilisateur
CREATE POLICY "Purchases: admin insert" ON pack_purchases
  FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin'));

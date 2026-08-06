-- Un coach doit pouvoir lire les packs des membres
--
-- Constaté le 2026-08-06 : la policy « Purchases: coach read all » figurait
-- dans install.sql mais n'avait jamais été appliquée à la base. Un coach ne
-- lisait donc que ses propres achats.
--
-- Conséquence visible : l'écran « Ajouter un membre » de l'espace coach
-- balaie pack_purchases pour trouver qui a des crédits. La requête ne
-- renvoyait rien, et l'écran concluait « aucun membre avec des crédits
-- disponibles » — alors que les membres en avaient. L'écran admin, lui,
-- fonctionnait : un admin a sa policy de lecture.
--
-- La lecture seule suffit : les écritures (consommer un crédit, en rendre un)
-- passent par des fonctions SECURITY DEFINER qui contrôlent le rôle.

DROP POLICY IF EXISTS "Purchases: coach read all" ON pack_purchases;
CREATE POLICY "Purchases: coach read all" ON pack_purchases
  FOR SELECT USING (has_role(auth.uid(), 'coach'));

-- Même vérification pour les réservations : un coach doit voir qui est
-- inscrit à ses cours.
DROP POLICY IF EXISTS "Bookings: coach read all classes" ON bookings;
CREATE POLICY "Bookings: coach read all classes" ON bookings
  FOR SELECT USING (has_role(auth.uid(), 'coach'));

DROP POLICY IF EXISTS "Bookings: coach insert" ON bookings;
CREATE POLICY "Bookings: coach insert" ON bookings
  FOR INSERT WITH CHECK (has_role(auth.uid(), 'coach'));

DROP POLICY IF EXISTS "Bookings: coach update" ON bookings;
CREATE POLICY "Bookings: coach update" ON bookings
  FOR UPDATE USING (has_role(auth.uid(), 'coach'));

-- Les abonnements : un coach voit l'état d'un membre sans pouvoir y toucher.
DROP POLICY IF EXISTS "Subscriptions: coach read" ON subscriptions;
CREATE POLICY "Subscriptions: coach read" ON subscriptions
  FOR SELECT USING (has_role(auth.uid(), 'coach'));

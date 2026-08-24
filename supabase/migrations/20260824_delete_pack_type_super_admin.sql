-- Supprimer un type de pack : réservé au super admin.
--
-- L'écran masque déjà la corbeille aux admins ordinaires, mais masquer un
-- bouton ne protège rien — le projet l'a écrit noir sur blanc à propos du menu
-- du staff. La policy `Pack types: admin manage` couvrait ALL, donc DELETE
-- compris : un admin y avait accès par un autre chemin.
--
-- Le geste est irréversible et touche à l'historique des achats : c'est le même
-- niveau de responsabilité que l'effacement du journal d'activité, déjà réservé
-- au super admin. Un admin retire un pack du catalogue (`is_active`), il ne
-- l'efface pas.

DROP POLICY IF EXISTS "Pack types: admin manage" ON pack_types;

-- Créer et modifier restent ouverts à tout admin : ce sont les gestes du
-- quotidien, et ils se corrigent.
CREATE POLICY "Pack types: admin insert" ON pack_types
  FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE POLICY "Pack types: admin update" ON pack_types
  FOR UPDATE USING (has_role(auth.uid(), 'admin'));

-- Effacer, non.
CREATE POLICY "Pack types: super admin delete" ON pack_types
  FOR DELETE USING (has_role(auth.uid(), 'super_admin'));

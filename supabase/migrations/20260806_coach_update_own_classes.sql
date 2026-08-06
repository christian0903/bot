-- Un coach doit pouvoir modifier ses propres cours
--
-- Constaté le 2026-08-06, troisième écart du même type entre install.sql et
-- la base réelle : la policy « Classes: coach update own » n'avait jamais été
-- appliquée. scheduled_classes ne portait que deux policies, aucune pour le
-- coach.
--
-- Symptôme : un coach annulait son cours, le journal enregistrait l'action,
-- les crédits étaient rendus aux inscrits — mais le cours restait planifié.
-- L'écriture était refusée en silence.
--
-- Le périmètre reste étroit : `auth.uid() = coach_id` limite au coach assigné,
-- et seul UPDATE est ouvert. Un coach ne crée ni ne supprime de cours.

DROP POLICY IF EXISTS "Classes: coach update own" ON scheduled_classes;
CREATE POLICY "Classes: coach update own" ON scheduled_classes
  FOR UPDATE USING (auth.uid() = coach_id);

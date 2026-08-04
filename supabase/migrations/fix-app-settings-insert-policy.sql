-- ============================================
-- app_settings : autoriser l'INSERT aux admins
-- ============================================
--
-- La policy "Settings: admin manage" est FOR ALL avec un USING mais SANS
-- WITH CHECK. Or sur un INSERT, PostgreSQL n'évalue QUE l'expression
-- WITH CHECK : absente, la ligne est refusée.
--
-- Conséquence : impossible de créer une nouvelle clé de réglage depuis
-- l'application. Seules les clés déjà présentes en base (créées par
-- install.sql) pouvaient être modifiées. Tout nouveau paramètre
-- (unlimited_session_cost, cancellation_alert, class_given_rule…) était
-- silencieusement perdu.
--
-- Idempotent : réexécutable sans effet de bord.
-- ============================================

DROP POLICY IF EXISTS "Settings: admin manage" ON app_settings;

CREATE POLICY "Settings: admin manage" ON app_settings
  FOR ALL
  USING (has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'admin'));

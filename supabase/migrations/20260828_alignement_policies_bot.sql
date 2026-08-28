-- Aligne `bot` sur `install.sql` pour trois policies restées en arrière.
--
-- Ces écarts ne venaient pas d'un correctif éprouvé ailleurs : `install.sql` a
-- été corrigé au fil des sessions, `bot` — plus ancienne — a gardé les
-- premières versions. Une base neuve naissait donc plus juste que la base de
-- référence, ce qui est l'inverse de ce qu'on veut. Relevé le 2026-08-28 en
-- comparant le texte des policies des deux bases.
--
-- 1. performances : un coach peut CRÉER une performance pour un membre (la
--    policy d'insertion le prévoit déjà) mais ne pouvait ni la corriger ni la
--    supprimer. Une faute de frappe restait donc définitive, sauf à déranger un
--    admin. Le studio compte 5 coachs.
--
-- 2. referrals et 3. subscription_discounts : écart SANS effet fonctionnel,
--    vérifié. Les policies `*_admin_all` couvrent déjà toutes les commandes,
--    SELECT compris, et deux policies permissives s'additionnent en OR : un
--    admin voit donc déjà ces lignes sur `bot`. On aligne malgré tout, pour que
--    le texte des deux bases soit comparable — c'est la condition pour qu'un
--    écart futur se remarque au lieu de se noyer dans un bruit de fond
--    d'écarts tolérés.
--
-- Les noms changent aussi (`Perf: own delete` → `Perf: delete`) : ils ne
-- disaient plus la vérité une fois le coach admis.

-- --- performances ---------------------------------------------------------
DROP POLICY IF EXISTS "Perf: own delete" ON performances;
DROP POLICY IF EXISTS "Perf: own update" ON performances;
DROP POLICY IF EXISTS "Perf: own insert" ON performances;
DROP POLICY IF EXISTS "Perf: delete" ON performances;
DROP POLICY IF EXISTS "Perf: update" ON performances;
DROP POLICY IF EXISTS "Perf: insert" ON performances;

CREATE POLICY "Perf: insert" ON performances
  FOR INSERT WITH CHECK (
    auth.uid() = user_id
    OR has_role(auth.uid(), 'coach')
    OR has_role(auth.uid(), 'admin')
  );

CREATE POLICY "Perf: update" ON performances
  FOR UPDATE USING (
    auth.uid() = user_id
    OR has_role(auth.uid(), 'coach')
    OR has_role(auth.uid(), 'admin')
  );

CREATE POLICY "Perf: delete" ON performances
  FOR DELETE USING (
    auth.uid() = user_id
    OR has_role(auth.uid(), 'coach')
    OR has_role(auth.uid(), 'admin')
  );

-- --- referrals ------------------------------------------------------------
DROP POLICY IF EXISTS "referrals_own_read" ON referrals;

CREATE POLICY "referrals_own_read" ON referrals
  FOR SELECT USING (
    auth.uid() = referrer_id
    OR auth.uid() = referee_id
    OR has_role(auth.uid(), 'admin')
  );

-- --- subscription_discounts ----------------------------------------------
DROP POLICY IF EXISTS "Sub discounts: own read" ON subscription_discounts;

CREATE POLICY "Sub discounts: own read" ON subscription_discounts
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM subscriptions s
      WHERE s.id = subscription_discounts.subscription_id
        AND s.user_id = auth.uid()
    )
    OR has_role(auth.uid(), 'admin')
  );

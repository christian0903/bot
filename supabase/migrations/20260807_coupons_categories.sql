-- ============================================================================
-- Coupons : saisissables, et restreignables par catégorie
-- ----------------------------------------------------------------------------
-- Un coupon pouvait être créé mais jamais utilisé : AUCUN champ de saisie
-- n'existait côté membre. Le serveur savait traiter un `coupon_code`, le front
-- ne l'envoyait jamais. Signalé dès le 6 août — « coupons collectifs
-- inutilisables » — et resté tel quel.
--
-- Il manquait aussi de pouvoir viser une population : « -20 % pour les
-- étudiants », « offre de rentrée pour les nouveaux ».
--
-- Même mécanique que `pack_type_categories` : aucune ligne = ouvert à tous.
-- C'est le cas nominal d'un code promotionnel, qu'on ne doit pas avoir à
-- déclarer en cochant toutes les catégories.
--
-- Contenu appliqué : voir install.sql (table coupon_categories, fonction
-- check_coupon, policies).
-- ============================================================================

CREATE TABLE IF NOT EXISTS coupon_categories (
  coupon_id UUID NOT NULL REFERENCES coupons(id) ON DELETE CASCADE,
  member_category_id UUID NOT NULL REFERENCES member_categories(id) ON DELETE CASCADE,
  PRIMARY KEY (coupon_id, member_category_id)
);

ALTER TABLE coupon_categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Coupon categories: public read" ON coupon_categories;
CREATE POLICY "Coupon categories: public read" ON coupon_categories
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Coupon categories: admin manage" ON coupon_categories;
CREATE POLICY "Coupon categories: admin manage" ON coupon_categories
  FOR ALL USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'super_admin'));

-- Fonction check_coupon : voir install.sql.

-- Un membre doit pouvoir lire le type d'un pack qu'il détient, même retiré
-- du catalogue.
--
-- La policy ne laissait lire que les packs `is_active = true`. Or le schéma
-- dit l'inverse de ce que cette policy imposait (voir le commentaire de la
-- colonne) : « FALSE = hors catalogue, mais toujours utilisable ». Un pack
-- retiré de la vente restait donc utilisable en théorie, et invisible en
-- lecture en pratique.
--
-- Conséquence à l'écran : au planning, la jointure `pack_type:pack_types(...)`
-- renvoyait NULL, la ligne était écartée du calcul, et le membre lisait
-- « 0 crédit » alors que ses crédits étaient bien là. Relevé sur bot le
-- 2026-08-28 : 3 membres à 0 affiché avec des crédits valides, 5 autres avec
-- un total amputé.
--
-- Le pack cesse d'être achetable — ça, c'est `is_active` et le catalogue le
-- filtre déjà côté requête. Mais il ne cesse pas d'exister pour qui l'a payé :
-- son nom, son prix et son type de crédit doivent rester lisibles, sinon
-- l'achat devient orphelin à l'écran.

DROP POLICY IF EXISTS "Pack types: read active or admin" ON pack_types;

CREATE POLICY "Pack types: read active, detenu ou admin" ON pack_types
  FOR SELECT USING (
    is_active = true
    OR has_role(auth.uid(), 'admin')
    -- Détenu par le membre : un achat suffit, même expiré ou épuisé. L'écran
    -- « Mes packs » montre l'historique, il a besoin des noms.
    OR EXISTS (
      SELECT 1 FROM pack_purchases pp
      WHERE pp.pack_type_id = pack_types.id
        AND pp.user_id = auth.uid()
    )
    -- Même raison pour un abonnement : il porte le pack qui le renouvelle.
    OR EXISTS (
      SELECT 1 FROM subscriptions s
      WHERE s.pack_type_id = pack_types.id
        AND s.user_id = auth.uid()
    )
  );

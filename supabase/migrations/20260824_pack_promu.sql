-- Mettre un pack en avant.
--
-- Un champ à part, et non un troisième état de `is_active` : « actif » et
-- « promu » ne répondent pas à la même question. Un pack promu est forcément
-- actif — la promotion est une mise en avant, pas un état de vente. Les fondre
-- interdirait de dépromouvoir sans désactiver, et un pack désactivé puis
-- réactivé aurait perdu sa promotion en silence.
--
-- L'écran, lui, présente bien trois choix (Inactif / Actif / Promu) : c'est la
-- base qui garde les deux notions séparées, pas l'interface qui les impose.

ALTER TABLE pack_types
  ADD COLUMN IF NOT EXISTS is_featured BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS featured_label TEXT;

COMMENT ON COLUMN pack_types.is_featured IS
  'Pack mis en avant : bandeau, carte soulignée, et remonté en tête de sa section.';
COMMENT ON COLUMN pack_types.featured_label IS
  'Texte du bandeau. Vide = « Recommandé ».';

-- Promu implique actif : un pack retiré du catalogue ne peut pas être mis en
-- avant, il n'est visible nulle part. La contrainte évite un état que l'écran
-- afficherait sans que le membre voie quoi que ce soit.
ALTER TABLE pack_types
  DROP CONSTRAINT IF EXISTS pack_types_featured_requires_active;

ALTER TABLE pack_types
  ADD CONSTRAINT pack_types_featured_requires_active
  CHECK (NOT is_featured OR is_active);

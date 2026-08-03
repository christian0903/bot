-- ============================================
-- Support événements spéciaux
-- Champs optionnels sur scheduled_classes
-- ============================================

-- Titre custom (remplace class_type.name si rempli)
ALTER TABLE scheduled_classes ADD COLUMN IF NOT EXISTS title TEXT;

-- Description de l'événement
ALTER TABLE scheduled_classes ADD COLUMN IF NOT EXISTS description TEXT;

-- Rendre coach_id optionnel (NULL = pas de coach désigné)
ALTER TABLE scheduled_classes ALTER COLUMN coach_id DROP NOT NULL;

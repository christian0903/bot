-- Ajouter photo et description markdown aux types de cours
ALTER TABLE class_types ADD COLUMN IF NOT EXISTS image_url TEXT;
ALTER TABLE class_types ADD COLUMN IF NOT EXISTS description_md TEXT;

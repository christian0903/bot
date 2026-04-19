-- Ajouter les noms de salles dans les settings
INSERT INTO app_settings (key, value) VALUES
  ('room_names', '{"bas": "Back On Track Studio", "haut": "Back On Track Upstairs"}'::jsonb)
ON CONFLICT (key) DO NOTHING;

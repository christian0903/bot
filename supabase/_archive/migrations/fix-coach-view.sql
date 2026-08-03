-- Vue qui expose les coachs (et admins) sans dépendance RLS circulaire
-- SECURITY DEFINER bypass les policies RLS
CREATE OR REPLACE VIEW coach_profiles AS
SELECT p.id, p.display_name, p.avatar_url, p.email, p.phone, ur.role
FROM profiles p
JOIN user_roles ur ON ur.user_id = p.id
WHERE ur.role IN ('coach', 'admin');

-- Autoriser la lecture de la vue
GRANT SELECT ON coach_profiles TO authenticated;
GRANT SELECT ON coach_profiles TO anon;

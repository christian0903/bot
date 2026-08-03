-- Fix: la vue coach_profiles renvoyait un coach autant de fois qu'il avait
-- de rôles (ex. coach + admin), ce qui dédoublait les options dans les
-- dropdowns côté admin. On dédoublonne par id en gardant le rôle le plus élevé.

CREATE OR REPLACE VIEW coach_profiles AS
SELECT DISTINCT ON (p.id) p.id, p.display_name, p.avatar_url, p.email, p.phone, ur.role
FROM profiles p
JOIN user_roles ur ON ur.user_id = p.id
WHERE ur.role IN ('coach', 'admin', 'super_admin')
ORDER BY p.id, CASE ur.role WHEN 'super_admin' THEN 1 WHEN 'admin' THEN 2 ELSE 3 END;

GRANT SELECT ON coach_profiles TO authenticated;
GRANT SELECT ON coach_profiles TO anon;

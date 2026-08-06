-- Attribution des rôles depuis l'application
--
-- Jusqu'ici, désigner quelqu'un comme coach demandait une écriture directe en
-- base : le studio ne pouvait pas recruter sans développeur.
--
-- Règle retenue (2026-08-06) :
--   * un ADMIN peut donner ou retirer le rôle « coach »
--   * seul un SUPER ADMIN peut donner ou retirer « admin » et « super_admin »
--
-- Les policies existantes autorisaient tout admin à écrire n'importe quel rôle,
-- y compris à se créer un pair. Elles sont remplacées : les écritures passent
-- désormais par ces fonctions, qui appliquent la hiérarchie.

-- ---------------------------------------------------------------------------
-- Attribuer un rôle
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION grant_user_role(p_user_id UUID, p_role TEXT)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER
AS $fn$
DECLARE
  v_is_admin BOOLEAN := has_role(auth.uid(), 'admin');
  v_is_super BOOLEAN := has_role(auth.uid(), 'super_admin');
  v_name TEXT;
BEGIN
  IF NOT (v_is_admin OR v_is_super) THEN
    RAISE EXCEPTION 'Reserve aux administrateurs';
  END IF;

  IF p_role NOT IN ('coach', 'admin', 'super_admin', 'client') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'role_inconnu');
  END IF;

  -- Un admin ne peut pas se créer un pair : seul un super admin promeut
  -- au rang d'admin ou de super admin.
  IF p_role IN ('admin', 'super_admin') AND NOT v_is_super THEN
    RETURN jsonb_build_object('ok', false, 'error', 'super_admin_requis');
  END IF;

  SELECT display_name INTO v_name FROM profiles WHERE id = p_user_id;
  IF v_name IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'membre_introuvable');
  END IF;

  INSERT INTO user_roles (user_id, role)
  VALUES (p_user_id, p_role::user_role)
  ON CONFLICT (user_id, role) DO NOTHING;

  INSERT INTO activity_log (action, actor_id, target_user_id, entity_type, entity_id, details, description)
  VALUES ('role_changed', auth.uid(), p_user_id, 'user_role', p_user_id,
          jsonb_build_object('granted', p_role),
          format('Rôle « %s » accordé à %s', p_role, v_name));

  INSERT INTO notifications (user_id, title, message, type, link)
  VALUES (p_user_id,
          CASE p_role
            WHEN 'coach' THEN 'Tu es désormais coach'
            ELSE 'Tes droits ont changé'
          END,
          CASE p_role
            WHEN 'coach' THEN 'Tu as accès à tes cours et aux participants.'
            ELSE format('Le rôle « %s » t''a été accordé.', p_role)
          END,
          'info', '/');

  RETURN jsonb_build_object('ok', true, 'role', p_role);
END;
$fn$;

-- ---------------------------------------------------------------------------
-- Retirer un rôle
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION revoke_user_role(p_user_id UUID, p_role TEXT)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER
AS $fn$
DECLARE
  v_is_admin BOOLEAN := has_role(auth.uid(), 'admin');
  v_is_super BOOLEAN := has_role(auth.uid(), 'super_admin');
  v_name TEXT;
  v_remaining INTEGER;
BEGIN
  IF NOT (v_is_admin OR v_is_super) THEN
    RAISE EXCEPTION 'Reserve aux administrateurs';
  END IF;

  IF p_role IN ('admin', 'super_admin') AND NOT v_is_super THEN
    RETURN jsonb_build_object('ok', false, 'error', 'super_admin_requis');
  END IF;

  -- On ne se retire pas ses propres droits : un studio sans admin serait
  -- verrouillé, et il faudrait repasser par la base pour en sortir.
  IF p_user_id = auth.uid() AND p_role IN ('admin', 'super_admin') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'auto_retrait_interdit');
  END IF;

  -- Ni le dernier super admin : même raison.
  IF p_role = 'super_admin' THEN
    SELECT COUNT(*) INTO v_remaining
    FROM user_roles WHERE role = 'super_admin' AND user_id <> p_user_id;
    IF v_remaining = 0 THEN
      RETURN jsonb_build_object('ok', false, 'error', 'dernier_super_admin');
    END IF;
  END IF;

  SELECT display_name INTO v_name FROM profiles WHERE id = p_user_id;

  DELETE FROM user_roles WHERE user_id = p_user_id AND role = p_role::user_role;

  INSERT INTO activity_log (action, actor_id, target_user_id, entity_type, entity_id, details, description)
  VALUES ('role_changed', auth.uid(), p_user_id, 'user_role', p_user_id,
          jsonb_build_object('revoked', p_role),
          format('Rôle « %s » retiré à %s', p_role, COALESCE(v_name, '?')));

  RETURN jsonb_build_object('ok', true);
END;
$fn$;

-- ---------------------------------------------------------------------------
-- Policies : l'écriture passe par les fonctions ci-dessus
-- ---------------------------------------------------------------------------
-- Les anciennes laissaient tout admin écrire n'importe quel rôle, sans
-- hiérarchie ni garde-fou.

DROP POLICY IF EXISTS "Roles: admin insert" ON user_roles;
DROP POLICY IF EXISTS "Roles: admin update" ON user_roles;
DROP POLICY IF EXISTS "Roles: admin delete" ON user_roles;

REVOKE ALL ON FUNCTION grant_user_role(UUID, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION revoke_user_role(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION grant_user_role(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION revoke_user_role(UUID, TEXT) TO authenticated;

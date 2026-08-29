-- ============================================================================
-- « Mot de passe oublie » laisse une trace
--
-- La demande partait chez Supabase sans que l'application n'en garde rien. Des
-- coachs disaient l'avoir faite, le journal ne montrait rien, et il n'y avait
-- aucun moyen de trancher — ni de savoir si l'e-mail etait parti.
--
-- Meme forme que `log_duplicate_signup`, et pour les memes raisons :
--
--   * une adresse inconnue ne produit RIEN, et la fonction sort en silence.
--     Repondre differemment selon que l'adresse existe ou non revelerait qui
--     frequente le studio, a qui voudrait sonder ;
--   * une seule trace par heure et par adresse. Sans cette borne, un
--     formulaire soumis en boucle noierait le reste du journal.
-- ============================================================================

-- `password_reset_by_admin` existait deja : c'est le studio qui reinitialise.
-- Celle-ci est la demande du membre lui-meme, et les deux ne se lisent pas
-- pareil — l'une est un geste de support, l'autre un signal.
ALTER TYPE activity_action ADD VALUE IF NOT EXISTS 'password_reset_requested';

-- Le COMMIT est indispensable : PostgreSQL refuse d'utiliser une valeur d'enum
-- creee dans la meme transaction. C'est le meme piege que la section A/B
-- d'install.sql.
COMMIT;

CREATE OR REPLACE FUNCTION log_password_reset_request(p_email TEXT)
RETURNS VOID
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $fn$
DECLARE
  v_user_id UUID;
BEGIN
  SELECT id INTO v_user_id FROM auth.users WHERE email = lower(trim(p_email));

  -- Adresse inconnue : rien a tracer, et surtout rien a signaler a l'appelant.
  -- Une difference de comportement serait elle-meme une reponse.
  IF v_user_id IS NULL THEN
    RETURN;
  END IF;

  -- Une seule trace par heure et par adresse.
  IF EXISTS (
    SELECT 1 FROM activity_log
    WHERE action = 'password_reset_requested'
      AND target_user_id = v_user_id
      AND created_at > NOW() - INTERVAL '1 hour'
  ) THEN
    RETURN;
  END IF;

  INSERT INTO activity_log (action, actor_id, target_user_id, entity_type, entity_id, description)
  VALUES (
    'password_reset_requested',
    v_user_id,          -- le membre agit pour lui-meme
    v_user_id,
    'user',
    v_user_id,
    format('%s a demande la reinitialisation de son mot de passe',
           COALESCE((SELECT display_name FROM profiles WHERE id = v_user_id), p_email))
  );
END;
$fn$;

-- `anon` doit pouvoir l'appeler : on demande un nouveau mot de passe
-- PRECISEMENT quand on n'est pas connecte.
GRANT EXECUTE ON FUNCTION log_password_reset_request(TEXT) TO anon, authenticated;

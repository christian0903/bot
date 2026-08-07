-- ============================================================================
-- Communications sur la page d'accueil
-- ----------------------------------------------------------------------------
-- Les notifications existaient déjà (table, temps réel, is_read, cloche) mais
-- n'apparaissaient nulle part sur l'accueil : il fallait ouvrir la cloche pour
-- les voir. Et beaucoup d'e-mails partaient sans laisser de trace dans l'app —
-- or tout le monde ne lit pas ses e-mails.
--
-- Cette migration ajoute ce qui manquait côté base :
--   1. le membre peut écarter une communication de son écran
--   2. on sait quelles communications ont aussi été envoyées par e-mail
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Écarter une communication
-- ---------------------------------------------------------------------------
-- Masquage plutôt que suppression. Un e-mail envoyé est une trace : en cas de
-- contestation (« je n'ai jamais été prévenu »), la ligne doit rester
-- consultable côté studio. Le membre la retire de SON écran, il n'efface pas
-- l'historique du studio.
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS dismissed_at TIMESTAMPTZ;

COMMENT ON COLUMN notifications.dismissed_at IS
  'Le membre a écarté cette communication de son accueil. La ligne est conservée : elle prouve que l''information a été transmise.';

-- ---------------------------------------------------------------------------
-- 2. Savoir ce qui est aussi parti par e-mail
-- ---------------------------------------------------------------------------
-- Permet d'afficher « aussi envoyé par e-mail » et, côté studio, de vérifier
-- qu'une communication a bien emprunté les deux canaux.
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS email_template TEXT;

COMMENT ON COLUMN notifications.email_template IS
  'Nom du template e-mail envoyé en parallèle, NULL si la communication n''existe que dans l''application.';

-- ---------------------------------------------------------------------------
-- 3. Lecture et écarts : le membre agit sur ses propres lignes
-- ---------------------------------------------------------------------------
-- La policy UPDATE existante autorise déjà le membre à modifier ses
-- notifications (elle sert à is_read). Elle couvre dismissed_at sans
-- changement. Mais elle n'a pas de clause WITH CHECK : sans elle, un membre
-- pourrait réassigner une notification à quelqu'un d'autre en modifiant
-- user_id. On la resserre.
DROP POLICY IF EXISTS "Notifications: own update" ON notifications;
CREATE POLICY "Notifications: own update" ON notifications
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- 4. Écarter en une fois
-- ---------------------------------------------------------------------------
-- « Tout effacer » depuis l'accueil. Écarte uniquement ce qui est déjà lu :
-- une communication non lue balayée par mégarde serait perdue pour le membre.
CREATE OR REPLACE FUNCTION dismiss_read_notifications()
RETURNS INTEGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentification requise';
  END IF;

  WITH ecartees AS (
    UPDATE notifications
       SET dismissed_at = NOW()
     WHERE user_id = auth.uid()
       AND is_read
       AND dismissed_at IS NULL
    RETURNING 1
  )
  SELECT COUNT(*) INTO v_count FROM ecartees;

  RETURN v_count;
END;
$$;

COMMENT ON FUNCTION dismiss_read_notifications IS
  'Écarte de l''accueil toutes les communications déjà lues. Ne touche pas aux non lues : les balayer ferait perdre l''information au membre.';

REVOKE ALL ON FUNCTION dismiss_read_notifications() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION dismiss_read_notifications() TO authenticated;

-- ---------------------------------------------------------------------------
-- 5. Index de lecture
-- ---------------------------------------------------------------------------
-- L'accueil demande « les communications non écartées de ce membre, les plus
-- récentes d'abord » à chaque chargement.
CREATE INDEX IF NOT EXISTS notifications_user_active
  ON notifications (user_id, created_at DESC)
  WHERE dismissed_at IS NULL;

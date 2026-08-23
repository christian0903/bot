-- ============================================================================
-- Purge du journal d'activité — réservée au super admin
-- ----------------------------------------------------------------------------
-- POURQUOI UNE FONCTION PLUTÔT QU'UNE POLICY DELETE
--
-- `activity_log` n'a aucune policy DELETE : personne ne peut y effacer quoi que
-- ce soit, et c'est très bien ainsi. Ouvrir une policy `DELETE` au super admin
-- l'autoriserait à supprimer N'IMPORTE QUELLE ligne, une par une, depuis
-- n'importe quel client — un journal d'audit que son lecteur peut trafiquer
-- ligne par ligne ne vaut plus rien.
--
-- Cette fonction n'autorise qu'UNE chose : effacer en bloc ce qui est plus
-- ancien qu'un nombre de mois donné. Impossible d'y faire disparaître une
-- ligne gênante en laissant le reste.
--
-- LE GARDE-FOU N'EST PAS DANS L'INTERFACE
--
-- Le bouton sera masqué aux non-super-admins, mais un bouton caché n'est pas
-- une sécurité : l'appel RPC reste à portée de qui sait ouvrir une console.
-- Le contrôle de rôle est donc ICI, et c'est lui qui compte.
--
-- LA PURGE SE JOURNALISE ELLE-MÊME
--
-- Effacer le journal laisse une trace dans le journal — qui a purgé, quand,
-- combien de lignes, jusqu'à quelle date. Sans cela, un trou dans l'historique
-- serait indiscernable d'une panne.
--
-- MINIMUM SIX MOIS
--
-- Le paramètre est borné : on ne peut pas purger en deçà de six mois. Rien
-- n'oblige un studio à conserver ce journal, mais un « 0 mois » saisi par
-- mégarde dans un champ effacerait tout l'historique récent, celui qui sert
-- justement à comprendre ce qui vient de se passer.
-- ============================================================================

CREATE OR REPLACE FUNCTION purge_activity_log(p_months INTEGER)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_uid     UUID := auth.uid();
  v_cutoff  TIMESTAMPTZ;
  v_deleted INTEGER;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_authenticated');
  END IF;

  -- Le super admin, et lui seul. Un admin ordinaire gère le studio ; effacer
  -- la trace de ce que les admins ont fait est d'un autre ordre.
  IF NOT has_role(v_uid, 'super_admin') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'forbidden');
  END IF;

  IF p_months IS NULL OR p_months < 6 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'too_recent', 'min_months', 6);
  END IF;

  v_cutoff := NOW() - (p_months || ' months')::INTERVAL;

  DELETE FROM activity_log WHERE created_at < v_cutoff;
  GET DIAGNOSTICS v_deleted = ROW_COUNT;

  -- La trace de la purge, écrite APRÈS la suppression : la borne de coupure
  -- étant dans le passé, cette ligne-ci ne peut pas être emportée par sa
  -- propre purge.
  INSERT INTO activity_log (action, actor_id, target_user_id, entity_type, details, description)
  VALUES (
    'activity_log_purged',
    v_uid,
    v_uid,
    'activity_log',
    jsonb_build_object('months', p_months, 'deleted', v_deleted, 'cutoff', v_cutoff),
    format('Journal purgé : %s entrée(s) antérieure(s) au %s effacée(s)',
           v_deleted,
           to_char(v_cutoff AT TIME ZONE 'Europe/Brussels', 'DD/MM/YYYY'))
  );

  RETURN jsonb_build_object(
    'ok', true,
    'deleted', v_deleted,
    'cutoff', v_cutoff
  );
END;
$fn$;

COMMENT ON FUNCTION purge_activity_log(INTEGER) IS
  'Efface les entrées du journal antérieures à N mois (N >= 6). Réservée au super admin, se journalise elle-même. Renvoie {ok, deleted, cutoff} ou {ok:false, reason}.';

REVOKE ALL ON FUNCTION purge_activity_log(INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION purge_activity_log(INTEGER) TO authenticated;

-- ---------------------------------------------------------------------------
-- Combien serait effacé ? — pour annoncer avant d'agir
-- ---------------------------------------------------------------------------
-- L'écran affiche ce nombre dans sa demande de confirmation. Sans lui, on
-- confirmerait une suppression sans savoir si elle porte sur trois lignes ou
-- sur trois ans.
CREATE OR REPLACE FUNCTION count_activity_log_before(p_months INTEGER)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_count INTEGER;
BEGIN
  IF NOT has_role(auth.uid(), 'super_admin') THEN
    RETURN NULL;
  END IF;

  SELECT COUNT(*) INTO v_count
  FROM activity_log
  WHERE created_at < NOW() - (GREATEST(p_months, 0) || ' months')::INTERVAL;

  RETURN v_count;
END;
$fn$;

COMMENT ON FUNCTION count_activity_log_before(INTEGER) IS
  'Nombre d''entrées du journal antérieures à N mois. NULL si l''appelant n''est pas super admin.';

REVOKE ALL ON FUNCTION count_activity_log_before(INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION count_activity_log_before(INTEGER) TO authenticated;

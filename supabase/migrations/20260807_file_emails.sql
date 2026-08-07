-- ============================================================================
-- File d'attente d'e-mails
-- ----------------------------------------------------------------------------
-- Certaines communications naissent dans une fonction SQL, qui ne peut pas
-- appeler une Edge Function : `promote_from_waitlist` en est le cas type. Elle
-- offre une place qui expire en DEUX HEURES, et n'écrivait qu'une notification
-- dans l'application. Il fallait donc que le membre ouvre l'application par
-- hasard dans ce créneau — sinon l'offre expirait sans que personne ne le
-- sache, et la place partait au suivant.
--
-- La fonction SQL dépose ici ce qu'il faut envoyer ; l'application consomme la
-- file et envoie réellement. Le passage par une table rend aussi l'envoi
-- ré-essayable : un e-mail non parti reste visible, au lieu d'être perdu.
-- ============================================================================

CREATE TABLE IF NOT EXISTS email_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  template TEXT NOT NULL,
  vars JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  sent_at TIMESTAMPTZ,
  -- Dernière erreur rencontrée. Conservée : un envoi qui échoue en silence
  -- est le pire des cas, on veut pouvoir constater la panne.
  last_error TEXT,
  attempts INTEGER NOT NULL DEFAULT 0
);

COMMENT ON TABLE email_queue IS
  'E-mails demandés par des fonctions SQL, qui ne peuvent pas appeler d''Edge Function. Consommée côté application.';

-- Les envois en attente, les plus anciens d'abord.
CREATE INDEX IF NOT EXISTS email_queue_pending
  ON email_queue (created_at)
  WHERE sent_at IS NULL;

ALTER TABLE email_queue ENABLE ROW LEVEL SECURITY;

-- Le membre ne lit pas cette file : elle est technique. Seul le service role
-- (Edge Functions) y accède, et il contourne RLS.
CREATE POLICY "Email queue: staff read" ON email_queue
  FOR SELECT USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'super_admin'));

-- ---------------------------------------------------------------------------
-- Déposer un e-mail
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION queue_email(
  p_user_id UUID,
  p_template TEXT,
  p_vars JSONB DEFAULT '{}'::jsonb
)
RETURNS UUID
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_id UUID;
BEGIN
  INSERT INTO email_queue (user_id, template, vars)
  VALUES (p_user_id, p_template, p_vars)
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

COMMENT ON FUNCTION queue_email IS
  'Dépose un e-mail à envoyer. Appelée depuis les fonctions SQL, qui ne peuvent pas joindre les Edge Functions.';

-- ---------------------------------------------------------------------------
-- La place de liste d'attente part aussi par e-mail
-- ---------------------------------------------------------------------------
-- Seul changement : le dépôt dans la file. Le reste de la fonction est repris
-- à l'identique.
CREATE OR REPLACE FUNCTION promote_from_waitlist(p_scheduled_class_id UUID)
RETURNS UUID
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_waitlist_entry RECORD;
  v_class          RECORD;
  v_expires_at     TIMESTAMPTZ;
BEGIN
  SELECT * INTO v_waitlist_entry
  FROM waitlist
  WHERE scheduled_class_id = p_scheduled_class_id AND status = 'waiting'
  ORDER BY position ASC LIMIT 1;

  IF v_waitlist_entry.id IS NULL THEN RETURN NULL; END IF;

  v_expires_at := NOW() + interval '2 hours';

  UPDATE waitlist
  SET status = 'offered', notified_at = NOW(), expires_at = v_expires_at
  WHERE id = v_waitlist_entry.id;

  -- De quoi nommer le cours dans l'e-mail : « une place s'est libérée » sans
  -- dire laquelle obligerait le membre à ouvrir l'application pour comprendre.
  -- La salle n'est pas une table : c'est l'étage porté par le cours.
  SELECT sc.starts_at, sc.duration_minutes, sc.floor,
         COALESCE(sc.title, ct.name) AS class_name,
         co.display_name AS coach_name
    INTO v_class
  FROM scheduled_classes sc
  LEFT JOIN class_types ct ON ct.id = sc.class_type_id
  LEFT JOIN profiles co    ON co.id = sc.coach_id
  WHERE sc.id = p_scheduled_class_id;

  INSERT INTO notifications (user_id, title, message, type, link, email_template)
  VALUES (v_waitlist_entry.user_id, 'Place disponible !',
    'Une place s''est libérée pour votre cours. Vous avez 2h pour confirmer.',
    'success', '/schedule', 'waitlist_spot_offered');

  PERFORM queue_email(
    v_waitlist_entry.user_id,
    'waitlist_spot_offered',
    jsonb_build_object(
      'class_name', COALESCE(v_class.class_name, 'votre cours'),
      'class_date', to_char(v_class.starts_at AT TIME ZONE 'Europe/Brussels', 'DD/MM/YYYY à HH24:MI'),
      'coach_name', v_class.coach_name,
      'room_name', CASE v_class.floor
                     WHEN 'haut' THEN 'Étage'
                     WHEN 'bas'  THEN 'Rez-de-chaussée'
                     ELSE NULL END,
      'duration_minutes', v_class.duration_minutes,
      'expires_at', to_char(v_expires_at AT TIME ZONE 'Europe/Brussels', 'HH24:MI')
    )
  );

  RETURN v_waitlist_entry.id;
END;
$$;

COMMENT ON FUNCTION promote_from_waitlist IS
  'Offre la place libérée au premier de la liste d''attente. Notification ET e-mail : l''offre expire en 2 h, l''application seule ne suffit pas à prévenir à temps.';

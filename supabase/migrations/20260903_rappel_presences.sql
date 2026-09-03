-- ============================================================================
-- Rappeler au coach les presences qu'il n'a pas pointees
-- ----------------------------------------------------------------------------
-- Un cours passe dont personne n'a pointe les presences laisse les statistiques
-- fausses et les absences non comptees. Sur bot-ops au 2026-09-03 : quatre
-- cours dans ce cas sur les soixante derniers jours — l'oubli est occasionnel,
-- pas systematique, ce qui appelle un rappel discret et non un dispositif
-- lourd.
--
-- Le delai est un reglage (`booking_rules.attendance_reminder_hours`) : quatre
-- heures apres la fin du cours par defaut, de quoi laisser un coach pointer
-- tranquillement en fin de journee sans etre relance.
--
-- POURQUOI PAS UN CRON : ce projet n'a pas `pg_cron`. Rien ne peut partir a
-- heure fixe. Le declenchement suit donc le meme principe que la file d'e-mails
-- (cf. `flush-email-queue.ts`) : c'est l'application qui appelle, a l'ouverture
-- d'une session du staff. Le rappel arrive donc « au prochain passage de
-- quelqu'un », pas a l'heure dite — limite assumee, faute d'ordonnanceur.
-- ============================================================================

-- Le reglage, ajoute aux regles existantes sans toucher au reste.
-- `jsonb_set` avec `create_if_missing` : rejouable, et sans effet si la valeur
-- a deja ete reglee a la main par un admin.
UPDATE app_settings
   SET value = jsonb_set(value, '{attendance_reminder_hours}', '4'::jsonb, true)
 WHERE key = 'booking_rules'
   AND NOT (value ? 'attendance_reminder_hours');

-- Marque le moment ou le rappel est parti, pour ne pas le renvoyer a chaque
-- ouverture de l'application. Sur le cours et non sur la reservation : c'est le
-- cours qu'on pointe, et un seul rappel doit partir pour toute la seance.
ALTER TABLE scheduled_classes
  ADD COLUMN IF NOT EXISTS attendance_reminded_at TIMESTAMPTZ;

COMMENT ON COLUMN scheduled_classes.attendance_reminded_at IS
  'Date d''envoi du rappel de pointage des presences. Nul tant qu''aucun rappel n''est parti.';

-- ---------------------------------------------------------------------------
-- Les cours qui attendent leurs presences
-- ---------------------------------------------------------------------------
-- Sert deux usages : le bandeau dans l'application (lecture seule) et l'envoi
-- des rappels. `p_pour_rappel` distingue les deux — le bandeau montre tout ce
-- qui traine, l'envoi ne retient que ce qui n'a pas deja ete rappele.
--
-- SECURITY DEFINER : un coach ne lit pas `profiles`, et la RLS de `bookings`
-- ne lui montrerait pas les reservations des autres. Ce qui borne l'exposition,
-- c'est le filtre sur l'appelant, plus bas — un coach ne voit que SES cours.
-- `DROP` avant de recreer : `CREATE OR REPLACE` refuse de changer le type de
-- retour d'une fonction, et `coach_nom` s'y est ajoute apres coup. Sans lui,
-- rejouer cette migration echoue avec « cannot change return type ».
DROP FUNCTION IF EXISTS cours_sans_presences(BOOLEAN);

CREATE OR REPLACE FUNCTION cours_sans_presences(p_pour_rappel BOOLEAN DEFAULT FALSE)
RETURNS TABLE (
  class_id UUID,
  coach_id UUID,
  coach_nom TEXT,
  intitule TEXT,
  starts_at TIMESTAMPTZ,
  inscrits INTEGER
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  WITH delai AS (
    SELECT COALESCE((value->>'attendance_reminder_hours')::int, 4) AS heures
      FROM app_settings WHERE key = 'booking_rules'
  )
  SELECT sc.id,
         sc.coach_id,
         -- Le nom du coach, que le front ne peut pas lire lui-meme : `profiles`
         -- est protegee par RLS. Nul si le cours n'a pas de coach affecte.
         coach.display_name,
         COALESCE(sc.title, ct.name),
         sc.starts_at,
         COUNT(b.id)::INTEGER
    FROM scheduled_classes sc
    JOIN class_types ct ON ct.id = sc.class_type_id
    JOIN bookings b ON b.scheduled_class_id = sc.id AND b.status = 'confirmed'
    LEFT JOIN profiles coach ON coach.id = sc.coach_id
   CROSS JOIN delai
   WHERE sc.is_cancelled = false
     -- Le delai court a partir de la FIN du cours, pas de son debut : un cours
     -- de 50 minutes ne doit pas etre reclame pendant qu'il a encore lieu.
     AND sc.starts_at + (sc.duration_minutes || ' minutes')::interval
         < now() - (delai.heures || ' hours')::interval
     -- Au-dela de sept jours, le rappel n'a plus d'objet : le coach ne se
     -- souvient plus, et relancer sur de l'ancien noierait ce qui est encore
     -- rattrapable.
     AND sc.starts_at > now() - interval '7 days'
     AND b.checked_in_at IS NULL
     AND b.is_no_show = false
     AND (NOT p_pour_rappel OR sc.attendance_reminded_at IS NULL)
     -- Un coach ne voit que ses cours ; un admin voit tout. `has_role` porte
     -- deja cette logique ailleurs dans le schema.
     AND (has_role(auth.uid(), 'admin'::user_role)
          OR has_role(auth.uid(), 'super_admin'::user_role)
          OR sc.coach_id = auth.uid())
   GROUP BY sc.id, sc.coach_id, coach.display_name, sc.title, ct.name, sc.starts_at
   ORDER BY sc.starts_at;
$$;

COMMENT ON FUNCTION cours_sans_presences(BOOLEAN) IS
  'Cours passes dont les presences ne sont pas pointees. Un coach ne voit que les siens, un admin voit tout. `p_pour_rappel` exclut ceux deja rappeles.';

REVOKE ALL ON FUNCTION cours_sans_presences(BOOLEAN) FROM PUBLIC;
-- `REVOKE ... FROM PUBLIC` ne suffit pas : Supabase accorde EXECUTE a `anon`
-- des la creation, par ALTER DEFAULT PRIVILEGES, et ce droit nominatif survit.
-- Constate le 2026-09-03 sur `participants_par_cours`.
REVOKE EXECUTE ON FUNCTION cours_sans_presences(BOOLEAN) FROM anon;
GRANT EXECUTE ON FUNCTION cours_sans_presences(BOOLEAN) TO authenticated;

-- ---------------------------------------------------------------------------
-- Envoyer les rappels en attente
-- ---------------------------------------------------------------------------
-- Alimente la file d'e-mails, que `process-email-queue` vide ensuite. Renvoie
-- le nombre de rappels poses, pour que l'appelant puisse le journaliser.
CREATE OR REPLACE FUNCTION envoyer_rappels_presences()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cours RECORD;
  v_admin RECORD;
  v_envoyes INTEGER := 0;
BEGIN
  -- Reserve au staff : un membre n'a rien a declencher ici.
  IF NOT (has_role(auth.uid(), 'admin'::user_role)
          OR has_role(auth.uid(), 'super_admin'::user_role)
          OR has_role(auth.uid(), 'coach'::user_role)) THEN
    RETURN 0;
  END IF;

  FOR v_cours IN
    -- `cours_sans_presences` filtre sur l'appelant : un coach ne declencherait
    -- que ses propres rappels. On relit donc la table directement ici, sous les
    -- droits du proprietaire, pour qu'une ouverture par n'importe qui du staff
    -- fasse partir tout ce qui attend.
    WITH delai AS (
      SELECT COALESCE((value->>'attendance_reminder_hours')::int, 4) AS heures
        FROM app_settings WHERE key = 'booking_rules'
    )
    SELECT sc.id, sc.coach_id, COALESCE(sc.title, ct.name) AS intitule,
           sc.starts_at, COUNT(b.id) AS inscrits
      FROM scheduled_classes sc
      JOIN class_types ct ON ct.id = sc.class_type_id
      JOIN bookings b ON b.scheduled_class_id = sc.id AND b.status = 'confirmed'
     CROSS JOIN delai
     WHERE sc.is_cancelled = false
       AND sc.starts_at + (sc.duration_minutes || ' minutes')::interval
           < now() - (delai.heures || ' hours')::interval
       AND sc.starts_at > now() - interval '7 days'
       AND b.checked_in_at IS NULL
       AND b.is_no_show = false
       AND sc.attendance_reminded_at IS NULL
     GROUP BY sc.id, sc.coach_id, sc.title, ct.name, sc.starts_at
  LOOP
    -- Le coach du cours. Un cours sans coach affecte n'en a pas a prevenir :
    -- les admins, ci-dessous, restent alors le seul filet.
    IF v_cours.coach_id IS NOT NULL THEN
      PERFORM queue_email(
        v_cours.coach_id,
        'attendance_reminder',
        jsonb_build_object(
          'class_name', v_cours.intitule,
          'class_date', to_char(v_cours.starts_at AT TIME ZONE 'Europe/Brussels',
                                'DD/MM/YYYY HH24:MI'),
          'participants', v_cours.inscrits
        )
      );
      v_envoyes := v_envoyes + 1;
    END IF;

    -- Les admins, pour qu'un oubli prolonge ne passe pas inapercu.
    FOR v_admin IN
      SELECT ur.user_id FROM user_roles ur
       JOIN profiles p ON p.id = ur.user_id
      WHERE ur.role IN ('admin', 'super_admin')
        AND p.deleted_at IS NULL
        AND ur.user_id IS DISTINCT FROM v_cours.coach_id
    LOOP
      PERFORM queue_email(
        v_admin.user_id,
        'attendance_reminder',
        jsonb_build_object(
          'class_name', v_cours.intitule,
          'class_date', to_char(v_cours.starts_at AT TIME ZONE 'Europe/Brussels',
                                'DD/MM/YYYY HH24:MI'),
          'participants', v_cours.inscrits
        )
      );
    END LOOP;

    -- Marque APRES l'envoi : si la mise en file echoue, la transaction entiere
    -- est annulee et le cours reste a rappeler au passage suivant.
    UPDATE scheduled_classes
       SET attendance_reminded_at = now()
     WHERE id = v_cours.id;
  END LOOP;

  RETURN v_envoyes;
END;
$$;

COMMENT ON FUNCTION envoyer_rappels_presences() IS
  'Met en file les rappels de pointage pour les cours qui attendent leurs presences. Reserve au staff, appele a l''ouverture de l''application faute de pg_cron.';

REVOKE ALL ON FUNCTION envoyer_rappels_presences() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION envoyer_rappels_presences() FROM anon;
GRANT EXECUTE ON FUNCTION envoyer_rappels_presences() TO authenticated;

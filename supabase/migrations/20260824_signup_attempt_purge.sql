-- Tracer les inscriptions spontanées, et pouvoir effacer un compte parasite.
--
-- Jusqu'ici `user_created` n'était écrit que par AdminUsersPage, quand le studio
-- crée un membre à la main : une inscription venue du formulaire public ne
-- laissait aucune trace. Le studio ne voyait un nouveau venu qu'en parcourant la
-- liste des membres, sans savoir quand il était arrivé.

-- ---------------------------------------------------------------------------
-- 1. Nouvelle action
-- ---------------------------------------------------------------------------

-- Distincte de `user_created`, qui reste la création par le studio. Les
-- confondre effacerait la différence entre « le studio a inscrit quelqu'un » et
-- « quelqu'un s'est inscrit tout seul » — c'est justement celle qui intéresse
-- quand on cherche un parasite.
ALTER TYPE activity_action ADD VALUE IF NOT EXISTS 'signup_attempt';

-- ---------------------------------------------------------------------------
-- 2. Tracer l'inscription depuis le trigger
-- ---------------------------------------------------------------------------

-- Le trigger plutôt que le front : une inscription passe toujours par
-- `auth.users`, quel que soit son point de départ. Tracer côté navigateur
-- laisserait échapper tout ce qui ne vient pas du formulaire.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS '
BEGIN
  INSERT INTO public.profiles (
    id, display_name, email, first_name, last_name, phone,
    date_of_birth, address, cgv_accepted_at, rgpd_accepted_at, member_status
  ) VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>''display_name'', ''Utilisateur''),
    NEW.email,
    NEW.raw_user_meta_data->>''first_name'',
    NEW.raw_user_meta_data->>''last_name'',
    NEW.raw_user_meta_data->>''phone'',
    CASE WHEN NEW.raw_user_meta_data->>''date_of_birth'' IS NOT NULL
         THEN (NEW.raw_user_meta_data->>''date_of_birth'')::DATE ELSE NULL END,
    NEW.raw_user_meta_data->>''address'',
    CASE WHEN (NEW.raw_user_meta_data->>''cgv_accepted'')::BOOLEAN = TRUE
         THEN NOW() ELSE NULL END,
    CASE WHEN (NEW.raw_user_meta_data->>''rgpd_accepted'')::BOOLEAN = TRUE
         THEN NOW() ELSE NULL END,
    ''potential''
  );
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, ''client'');

  -- Bloc protégé à part : le journal est utile, l''inscription est essentielle.
  -- Une écriture de trace qui échoue ne doit pas emporter la création du compte
  -- — le EXCEPTION global du dessous avalerait l''erreur en laissant un profil
  -- a moitié construit.
  BEGIN
    INSERT INTO public.activity_log (
      action, actor_id, target_user_id, entity_type, entity_id, details, description
    ) VALUES (
      ''signup_attempt'', NEW.id, NEW.id, ''profile'', NEW.id,
      jsonb_build_object(
        ''email'', NEW.email,
        ''self_signup'', true,
        -- Un compte cree par le studio est confirme d''office : le distinguer
        -- evite de prendre une creation admin pour une inscription publique.
        ''email_confirmed'', (NEW.email_confirmed_at IS NOT NULL)
      ),
      format(''Tentative d''''inscription : %s (%s)'',
             COALESCE(NEW.raw_user_meta_data->>''display_name'', ''sans nom''),
             COALESCE(NEW.email, ''sans e-mail''))
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE LOG ''handle_new_user activity_log error: %'', SQLERRM;
  END;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE LOG ''handle_new_user error: %'', SQLERRM;
  RETURN NEW;
END;
';

-- ---------------------------------------------------------------------------
-- 2 bis. Tentative sur une adresse déjà inscrite
-- ---------------------------------------------------------------------------

-- Ce cas ne crée aucun compte : le trigger ci-dessus ne se déclenche donc pas,
-- et l'événement resterait totalement invisible. Or c'est précisément celui qui
-- fait qu'un membre « ne reçoit pas l'e-mail » sans comprendre pourquoi — le
-- studio doit pouvoir le constater quand on l'appelle.
--
-- SECURITY DEFINER et appelable sans être connecté : la personne qui s'inscrit
-- n'a par définition pas de session. La fonction n'accepte donc qu'un e-mail,
-- n'écrit qu'une ligne de journal, et ne renvoie jamais si l'adresse existe —
-- sans quoi elle deviendrait l'outil d'énumération que Supabase refuse d'être.
CREATE OR REPLACE FUNCTION log_duplicate_signup(p_email TEXT)
RETURNS VOID
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $fn$
DECLARE
  v_user_id UUID;
BEGIN
  SELECT id INTO v_user_id FROM auth.users WHERE email = lower(trim(p_email));

  -- Adresse inconnue : rien à tracer. Sortir en silence, sans rien signaler à
  -- l'appelant — la différence de comportement serait elle-même une réponse.
  IF v_user_id IS NULL THEN
    RETURN;
  END IF;

  -- Une seule trace par heure et par adresse. Sans cette borne, un formulaire
  -- soumis en boucle remplirait le journal et noierait le reste.
  IF EXISTS (
    SELECT 1 FROM activity_log
    WHERE action = 'signup_attempt'
      AND target_user_id = v_user_id
      AND details->>'duplicate' = 'true'
      AND created_at > NOW() - INTERVAL '1 hour'
  ) THEN
    RETURN;
  END IF;

  INSERT INTO activity_log (action, actor_id, target_user_id, entity_type, entity_id, details, description)
  VALUES ('signup_attempt', NULL, v_user_id, 'profile', v_user_id,
          jsonb_build_object('duplicate', true, 'email', lower(trim(p_email))),
          format('Tentative d''inscription sur une adresse déjà inscrite : %s — aucun e-mail envoyé',
                 lower(trim(p_email))));
END;
$fn$;

REVOKE ALL ON FUNCTION log_duplicate_signup(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION log_duplicate_signup(TEXT) TO anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3. Effacer un compte parasite
-- ---------------------------------------------------------------------------

-- `delete_member_account` ANONYMISE : le droit comptable belge impose sept ans
-- de conservation dès qu''il y a eu paiement. Un parasite inscrit il y a dix
-- minutes n''a produit aucune écriture comptable — l''anonymiser laisserait une
-- ligne fantôme « Membre supprimé #a1b2c3d4 » à vie, là où il n''y a rien à
-- conserver.
--
-- D''où cette purge, volontairement étroite : elle refuse tout compte ayant la
-- moindre trace financière ou un e-mail confirmé, et renvoie alors vers la
-- suppression anonymisante. Le garde-fou est côté serveur : un admin ne peut
-- pas effacer un vrai membre par mégarde, et un appel direct à la fonction
-- n''y changerait rien.
CREATE OR REPLACE FUNCTION purge_parasite_account(p_user_id UUID)
RETURNS JSONB
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $fn$
DECLARE
  v_actor UUID := auth.uid();
  v_name TEXT;
  v_email TEXT;
  v_confirmed TIMESTAMPTZ;
  v_created TIMESTAMPTZ;
  v_blocker TEXT;
BEGIN
  IF NOT (has_role(v_actor, 'admin') OR has_role(v_actor, 'super_admin')) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'forbidden');
  END IF;

  -- Un admin ne s'efface pas lui-même : la fonction serait le plus court chemin
  -- vers un studio sans administrateur.
  IF p_user_id = v_actor THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'self');
  END IF;

  SELECT display_name INTO v_name FROM profiles WHERE id = p_user_id;
  IF v_name IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
  END IF;

  SELECT email, email_confirmed_at, created_at
    INTO v_email, v_confirmed, v_created
  FROM auth.users WHERE id = p_user_id;

  -- Un e-mail confirmé signale quelqu'un qui a fait la démarche jusqu'au bout :
  -- ce n'est plus un parasite, même s'il n'a rien acheté.
  IF v_confirmed IS NOT NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'email_confirmed');
  END IF;

  -- Staff : jamais effaçable ici, quel que soit l'état du compte.
  IF EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = p_user_id AND role IN ('coach', 'admin', 'super_admin')
  ) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'staff');
  END IF;

  -- Toute trace financière ou d'usage interdit l'effacement. Le pack de séance
  -- d'essai, attribué d'office à l'inscription, ne compte pas : il est offert et
  -- présent sur TOUS les comptes, il bloquerait donc chaque purge.
  SELECT CASE
    WHEN EXISTS (SELECT 1 FROM pack_purchases
                 WHERE user_id = p_user_id AND COALESCE(price_paid_cents, 0) > 0) THEN 'purchase'
    WHEN EXISTS (SELECT 1 FROM subscriptions   WHERE user_id = p_user_id) THEN 'subscription'
    WHEN EXISTS (SELECT 1 FROM registration_fees WHERE user_id = p_user_id) THEN 'registration_fee'
    WHEN EXISTS (SELECT 1 FROM bookings        WHERE user_id = p_user_id) THEN 'booking'
    ELSE NULL
  END INTO v_blocker;

  IF v_blocker IS NOT NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'has_activity', 'blocker', v_blocker);
  END IF;

  -- La trace de l'effacement s'écrit AVANT la suppression : `activity_log`
  -- référence `auth.users`, et les lignes du parasite vont disparaître. On la
  -- rattache donc à l'admin, seul acteur qui subsistera.
  INSERT INTO activity_log (action, actor_id, target_user_id, entity_type, entity_id, details, description)
  VALUES ('account_deleted', v_actor, v_actor, 'profile', p_user_id,
          jsonb_build_object(
            'purged_parasite', true,
            'former_name', v_name,
            'former_email', v_email,
            'signed_up_at', v_created
          ),
          format('Compte parasite effacé : %s (%s) — jamais confirmé, aucun achat',
                 v_name, COALESCE(v_email, 'sans e-mail')));

  -- Les traces du compte partent avec lui : les conserver ferait mentir le
  -- journal, qui renverrait vers un membre introuvable.
  DELETE FROM activity_log WHERE target_user_id = p_user_id OR actor_id = p_user_id;
  DELETE FROM waitlist       WHERE user_id = p_user_id;
  DELETE FROM notifications  WHERE user_id = p_user_id;
  DELETE FROM email_queue    WHERE user_id = p_user_id;
  DELETE FROM performances   WHERE user_id = p_user_id;
  DELETE FROM pack_purchases WHERE user_id = p_user_id;
  DELETE FROM user_roles     WHERE user_id = p_user_id;
  DELETE FROM profiles       WHERE id      = p_user_id;
  DELETE FROM auth.users     WHERE id      = p_user_id;

  RETURN jsonb_build_object('ok', true, 'former_name', v_name, 'former_email', v_email);
END;
$fn$;

REVOKE ALL ON FUNCTION purge_parasite_account(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION purge_parasite_account(UUID) TO authenticated;

-- Effacer définitivement un membre déjà anonymisé.
--
-- `delete_member_account` anonymise sans effacer : la ligne reste pour que les
-- packs, factures et réservations passées gardent leur référence. C'est le bon
-- choix pour un membre qui a une histoire au studio.
--
-- Il l'est moins pour un compte créé par erreur, ou pour un essai : rien à
-- préserver, mais une ligne « Membre supprimé #… » à vie dans la liste, et
-- surtout une adresse e-mail qui reste prise dans auth.users — impossible de
-- recréer le compte avec la même adresse.
--
-- D'où cette seconde étape, réservée au super_admin et refusée dès qu'il reste
-- la moindre trace comptable.
--
-- Quatorze contraintes pointent vers `auth.users` en NO ACTION : la suppression
-- ne cascade pas, elle échoue. Le garde-fou couvre celles qui portent une
-- valeur comptable et refuse alors l'effacement ; les autres — journal
-- d'activité, badges, parrainages — n'ont aucun sens sans le membre et partent
-- avec lui. Le journal en particulier garde l'adresse e-mail en clair dans ses
-- descriptions : la laisser derrière un effacement « complet » serait un
-- mensonge.

CREATE OR REPLACE FUNCTION effacer_membre_anonymise(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_nom       TEXT;
  v_traces    INTEGER;
BEGIN
  -- Le super_admin seul : un admin peut anonymiser, pas effacer.
  IF NOT has_role(auth.uid(), 'super_admin') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'forbidden');
  END IF;

  SELECT display_name INTO v_nom FROM profiles WHERE id = p_user_id;
  IF v_nom IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
  END IF;

  -- Effacer un membre encore vivant ferait par la bande ce que
  -- `delete_member_account` refuse de faire : on exige l'anonymisation d'abord.
  IF v_nom NOT LIKE 'Membre supprimé #%' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'pas_anonymise');
  END IF;

  -- Rien de comptable ne doit rester : sinon la ligne a une raison d'être, et
  -- l'effacer laisserait des enregistrements pointant dans le vide.
  SELECT
    (SELECT count(*) FROM bookings          WHERE user_id = p_user_id)
  + (SELECT count(*) FROM pack_purchases    WHERE user_id = p_user_id)
  + (SELECT count(*) FROM invoice_requests  WHERE user_id = p_user_id)
  + (SELECT count(*) FROM subscriptions     WHERE user_id = p_user_id)
  + (SELECT count(*) FROM registration_fees WHERE user_id = p_user_id)
  -- Un coach qui a encadré des cours n'est pas un compte créé par erreur : on
  -- refuse plutôt que de délier des séances de celui qui les a données.
  + (SELECT count(*) FROM scheduled_classes WHERE coach_id = p_user_id)
  INTO v_traces;

  IF v_traces > 0 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'traces_comptables', 'traces', v_traces);
  END IF;

  -- Ces tables référencent auth.users sans ON DELETE CASCADE : sans ce
  -- nettoyage, le DELETE échoue sur une violation de clé étrangère.
  DELETE FROM activity_log         WHERE actor_id = p_user_id OR target_user_id = p_user_id;
  DELETE FROM member_badges        WHERE user_id = p_user_id;
  DELETE FROM referral_rewards     WHERE user_id = p_user_id OR granted_by = p_user_id;
  DELETE FROM referrals            WHERE referrer_id = p_user_id OR referee_id = p_user_id;

  -- Traces d'un compte qui aurait encadré ou saisi : un membre créé par erreur
  -- n'en a pas, mais le DELETE échouerait sans cela.
  UPDATE performances          SET created_by = NULL WHERE created_by = p_user_id;
  UPDATE app_settings          SET updated_by = NULL WHERE updated_by = p_user_id;
  UPDATE subscription_discounts SET applied_by = NULL WHERE applied_by = p_user_id;

  DELETE FROM profiles   WHERE id = p_user_id;
  DELETE FROM auth.users WHERE id = p_user_id;

  RETURN jsonb_build_object('ok', true);
END;
$$;

REVOKE ALL ON FUNCTION effacer_membre_anonymise(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION effacer_membre_anonymise(UUID) TO authenticated;

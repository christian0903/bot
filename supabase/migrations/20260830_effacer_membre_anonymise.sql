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
  INTO v_traces;

  IF v_traces > 0 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'traces_comptables', 'traces', v_traces);
  END IF;

  DELETE FROM profiles   WHERE id = p_user_id;
  DELETE FROM auth.users WHERE id = p_user_id;

  RETURN jsonb_build_object('ok', true);
END;
$$;

REVOKE ALL ON FUNCTION effacer_membre_anonymise(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION effacer_membre_anonymise(UUID) TO authenticated;

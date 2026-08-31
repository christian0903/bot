-- Retirer la séance d'essai d'un membre depuis sa fiche.
--
-- Le réglage `trial_pack` arrête la distribution à venir, mais ne fait rien
-- pour les séances déjà accordées. Six d'entre elles existent en production,
-- et chaque membre repris de l'ancien système en reçoit une qu'il a déjà
-- consommée au studio.
--
-- La suppression pure ne suffit pas : `bookings.pack_purchase_id` et
-- `invoice_requests.pack_purchase_id` référencent le pack sans ON DELETE, et
-- la base refuserait d'effacer un pack qui a servi. On distingue donc :
--   - pack intact  → supprimé, il ne laisse rien derrière lui
--   - pack utilisé → vidé et périmé, la réservation garde sa trace comptable
--
-- Effacer un pack déjà consommé détacherait sa réservation de ce qui l'a
-- payée : la séance resterait au planning sans qu'on sache d'où venait le
-- crédit. C'est une perte d'information, pas un nettoyage.

ALTER TYPE activity_action ADD VALUE IF NOT EXISTS 'pack_removed';

CREATE OR REPLACE FUNCTION retirer_pack_essai(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pack       RECORD;
  v_utilise    INTEGER;
  v_supprimes  INTEGER := 0;
  v_neutralises INTEGER := 0;
BEGIN
  -- Réservé au staff : le membre ne retire pas sa propre séance d'essai, et
  -- surtout ne retire pas celle d'un autre.
  IF NOT (has_role(auth.uid(), 'coach') OR has_role(auth.uid(), 'admin')) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'forbidden');
  END IF;

  FOR v_pack IN
    SELECT pp.id, pp.credits_remaining
      FROM pack_purchases pp
      JOIN pack_types pt ON pt.id = pp.pack_type_id
     WHERE pp.user_id = p_user_id AND pt.is_trial
  LOOP
    SELECT count(*) INTO v_utilise
      FROM (
        SELECT 1 FROM bookings WHERE pack_purchase_id = v_pack.id
        UNION ALL
        SELECT 1 FROM invoice_requests WHERE pack_purchase_id = v_pack.id
      ) AS traces;

    IF v_utilise = 0 THEN
      DELETE FROM pack_purchases WHERE id = v_pack.id;
      v_supprimes := v_supprimes + 1;
    ELSE
      UPDATE pack_purchases
         SET credits_remaining = 0,
             expires_at = LEAST(expires_at, NOW())
       WHERE id = v_pack.id;
      v_neutralises := v_neutralises + 1;
    END IF;
  END LOOP;

  IF v_supprimes = 0 AND v_neutralises = 0 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'aucun_essai');
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'supprimes', v_supprimes,
    'neutralises', v_neutralises
  );
END;
$$;

REVOKE ALL ON FUNCTION retirer_pack_essai(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION retirer_pack_essai(UUID) TO authenticated;

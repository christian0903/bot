-- ============================================================================
-- Le statut `inactive` disparait : actif quatre semaines apres l'expiration
--
-- Regle d'avant : le pack expire, le membre passait `inactive`, puis `former`
-- quatre semaines plus tard. Trois etats pour une seule realite — il n'a plus
-- de credits.
--
-- Regle voulue par Christian (2026-08-29) : un membre reste ACTIF pendant les
-- quatre semaines qui suivent l'expiration de son pack, puis devient `former`.
-- C'est plus juste commercialement : quelqu'un dont le pack vient d'expirer
-- n'a pas quitte le studio, il est entre deux achats.
--
-- `inactive` reste dans la contrainte CHECK — la retirer obligerait a reecrire
-- toutes les lignes qui la portent, pour un gain nul. Elle n'est simplement
-- plus jamais attribuee, et l'ecran ne la propose plus.
--
-- La fonction est reprise TELLE QUELLE d'install.sql, une seule ligne changee.
-- ============================================================================

CREATE OR REPLACE FUNCTION update_member_status(p_user_id UUID)
RETURNS TEXT
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_a_achete BOOLEAN;
  v_a_essaye BOOLEAN;
  v_fin_dernier_pack TIMESTAMPTZ;
  v_pack_actif BOOLEAN;
  v_status TEXT;
BEGIN
  SELECT EXISTS(
    SELECT 1 FROM pack_purchases pp
      JOIN pack_types pt ON pt.id = pp.pack_type_id
     WHERE pp.user_id = p_user_id AND NOT pt.is_trial
  ) INTO v_a_achete;

  IF NOT v_a_achete THEN
    SELECT EXISTS(
      SELECT 1 FROM bookings b
        JOIN pack_purchases pp ON pp.id = b.pack_purchase_id
        JOIN pack_types pt ON pt.id = pp.pack_type_id
       WHERE b.user_id = p_user_id AND pt.is_trial
    ) INTO v_a_essaye;

    -- La réservation suffit : la séance n'a pas à avoir eu lieu.
    v_status := CASE WHEN v_a_essaye THEN 'potential' ELSE 'visitor' END;
  ELSE
    SELECT EXISTS(
      SELECT 1 FROM pack_purchases
       WHERE user_id = p_user_id AND credits_remaining > 0 AND expires_at > NOW()
    ) INTO v_pack_actif;

    IF v_pack_actif THEN
      v_status := 'active';
    ELSE
      SELECT MAX(pp.expires_at) INTO v_fin_dernier_pack
        FROM pack_purchases pp
        JOIN pack_types pt ON pt.id = pp.pack_type_id
       WHERE pp.user_id = p_user_id AND NOT pt.is_trial;

      IF v_fin_dernier_pack IS NULL OR v_fin_dernier_pack > NOW() - INTERVAL '4 weeks' THEN
        -- Quatre semaines de grace : entre deux achats, on reste un membre.
        -- Seul changement du 2026-08-29 — la version precedente posait
        -- `inactive` ici, un troisieme etat pour dire ce que `active` disait
        -- deja : le membre n'a pas quitte le studio.
        v_status := 'active';
      ELSE
        v_status := 'former';
      END IF;
    END IF;
  END IF;

  UPDATE profiles SET member_status = v_status WHERE id = p_user_id;
  RETURN v_status;
END;
$fn$;

-- Les membres deja marques `inactive` sont recalcules : sans cela ils
-- resteraient dans un etat que plus rien ne produit.
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN SELECT id FROM profiles WHERE member_status = 'inactive' LOOP
    PERFORM update_member_status(r.id);
  END LOOP;
END $$;

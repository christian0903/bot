-- Les statuts de membre suivent le parcours réel, pas les frais d'inscription.
--
-- Définitions arrêtées avec Christian le 2026-08-28, chacune reposant sur un
-- fait daté et vérifiable :
--
--   premier contact  compte créé, aucun essai réservé
--   potentiel        a réservé son cours d'essai
--   membre           a acheté un pack payant
--   ancien membre    échéance du dernier pack + 4 semaines
--
-- Ce qui change par rapport aux règles précédentes :
--
-- 1. **Les frais d'inscription ne sont plus regardés.** On ne peut pas acheter
--    un pack sans les avoir payés — la règle est appliquée à l'achat
--    (`registration_fee_due`). Les tester à nouveau ici serait redondant, et
--    surtout trompeur : des frais offerts ou saisis en retard faisaient
--    apparaître comme « potentiel » quelqu'un qui s'entraînait depuis des
--    semaines.
--
-- 2. **`visitor` devient un vrai état** — « premier contact ». Il n'était
--    jusqu'ici que la valeur par défaut de la colonne, jamais produite par le
--    calcul : tout compte sans frais payés basculait en `potential`, ce qui
--    confondait celui qui vient de créer son compte et celui qui a déjà essayé.
--
-- 3. **`former` se calcule sur l'échéance du dernier pack + 4 semaines**, au
--    lieu de 13 semaines. Règle fixe, demandée telle quelle.
--
-- L'essai se reconnaît au PACK utilisé (`pack_types.is_trial`), pas au drapeau
-- `bookings.is_trial`. Les deux divergent en base — 4 contre 7 le 2026-08-28 —
-- parce que le drapeau est une copie qu'il faut penser à poser, là où le pack
-- est un fait. Le projet a déjà tranché ce débat pour le statut d'un cours :
-- toujours dérivé, jamais recopié. Le drapeau reste utile à l'affichage.

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
  -- Un pack payant acheté un jour : le fait est acquis, il ne se défait pas.
  SELECT EXISTS(
    SELECT 1 FROM pack_purchases pp
      JOIN pack_types pt ON pt.id = pp.pack_type_id
     WHERE pp.user_id = p_user_id AND NOT pt.is_trial
  ) INTO v_a_achete;

  IF NOT v_a_achete THEN
    -- Pas encore membre : reste à distinguer celui qui a réservé son essai de
    -- celui qui vient seulement de créer son compte.
    SELECT EXISTS(
      SELECT 1 FROM bookings b
        JOIN pack_purchases pp ON pp.id = b.pack_purchase_id
        JOIN pack_types pt ON pt.id = pp.pack_type_id
       WHERE b.user_id = p_user_id AND pt.is_trial
    ) INTO v_a_essaye;

    -- La RÉSERVATION suffit, la séance n'a pas à avoir eu lieu : c'est
    -- l'engagement qui distingue un curieux d'un prospect.
    v_status := CASE WHEN v_a_essaye THEN 'potential' ELSE 'visitor' END;
  ELSE
    SELECT EXISTS(
      SELECT 1 FROM pack_purchases
       WHERE user_id = p_user_id AND credits_remaining > 0 AND expires_at > NOW()
    ) INTO v_pack_actif;

    IF v_pack_actif THEN
      v_status := 'active';
    ELSE
      -- Tous les packs sont épuisés ou périmés : c'est l'échéance du dernier
      -- qui lance le compte à rebours. Quatre semaines de battement avant de
      -- considérer le membre comme parti — un mois sans renouveler, c'est
      -- souvent des vacances.
      SELECT MAX(pp.expires_at) INTO v_fin_dernier_pack
        FROM pack_purchases pp
        JOIN pack_types pt ON pt.id = pp.pack_type_id
       WHERE pp.user_id = p_user_id AND NOT pt.is_trial;

      IF v_fin_dernier_pack IS NULL OR v_fin_dernier_pack > NOW() - INTERVAL '4 weeks' THEN
        v_status := 'inactive';
      ELSE
        v_status := 'former';
      END IF;
    END IF;
  END IF;

  UPDATE profiles SET member_status = v_status WHERE id = p_user_id;
  RETURN v_status;
END;
$fn$;

-- --- Déclencheur manquant : la réservation de l'essai ---------------------
-- Les triggers posés plus tôt couvraient l'achat d'un pack et les frais
-- d'inscription. Or « premier contact → potentiel » se joue sur une
-- RÉSERVATION, qui est un INSERT dans `bookings` : sans ce trigger, le membre
-- restait « premier contact » jusqu'à sa prochaine connexion.
CREATE OR REPLACE FUNCTION trg_statut_apres_reservation()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $fn$
BEGIN
  PERFORM update_member_status(NEW.user_id);
  RETURN NEW;
END;
$fn$;

DROP TRIGGER IF EXISTS statut_apres_reservation ON bookings;
CREATE TRIGGER statut_apres_reservation
  AFTER INSERT ON bookings
  FOR EACH ROW EXECUTE FUNCTION trg_statut_apres_reservation();

-- `registration_fees` ne commande plus rien : son trigger devient inutile, et
-- un trigger qui ne sert à rien finit par tromper celui qui le lit.
DROP TRIGGER IF EXISTS statut_apres_frais ON registration_fees;
DROP FUNCTION IF EXISTS trg_statut_apres_frais();

-- Remise à plat : les statuts en base viennent des anciennes règles.
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN SELECT id FROM profiles WHERE deleted_at IS NULL LOOP
    PERFORM update_member_status(r.id);
  END LOOP;
END $$;

-- Le statut de membre n'était presque jamais recalculé.
--
-- `update_member_status` calcule juste, mais rien ne l'appelait sur les
-- transitions qui comptent. Ses cinq points d'appel couvrent la commande B2B,
-- le reset de données de test, le bon d'achat couvrant les frais, la case
-- « frais payés » cochée par un admin, et l'import de démonstration. Manquent :
-- l'achat d'un pack, son expiration, le paiement Stripe des frais
-- d'inscription — et surtout le simple écoulement du temps, qui fait passer
-- `active` → `inactive` → `former` sans produire le moindre événement.
--
-- Relevé sur `bot` le 2026-08-28 : **9 profils sur 23 portaient un statut
-- faux**. Trois étaient « membre actif » sans avoir payé les frais
-- d'inscription, deux « inactif » alors qu'ils avaient un pack en cours.
--
-- Ce fichier ne change AUCUNE règle de calcul : les seuils et les conditions
-- restent ceux d'aujourd'hui. Redéfinir les statuts comme les coachs le
-- demandent est un autre chantier — et il n'aurait servi à rien de le mener
-- avant celui-ci, puisque les valeurs auraient été justes le jour du calcul et
-- fausses la semaine suivante.
--
-- La voie retenue est celle que le projet a déjà choisie pour la catégorie de
-- membre (`refresh_my_category`, cf. son commentaire) : **recalcul à la
-- lecture**, au moment où la valeur sert. Un cron nocturne corrigerait après
-- coup et finirait par diverger du réel — le même débat a été tranché ainsi
-- pour le statut d'un cours, jamais stocké.

-- --- 1. Le membre remet son propre statut d'aplomb ------------------------
-- Pendant du `refresh_my_category` existant, appelé au même endroit dans
-- AuthContext.fetchProfile. `auth.uid()` borne l'appel à soi-même : un membre
-- ne peut pas déclencher le recalcul d'un autre.
CREATE OR REPLACE FUNCTION refresh_my_member_status()
RETURNS TEXT
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $fn$
DECLARE
  v_user UUID := auth.uid();
BEGIN
  IF v_user IS NULL THEN
    RETURN NULL;
  END IF;
  RETURN update_member_status(v_user);
END;
$fn$;

REVOKE ALL ON FUNCTION refresh_my_member_status() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION refresh_my_member_status() TO authenticated;

-- --- 2. L'achat d'un pack --------------------------------------------------
-- Un pack acheté fait passer à `active` immédiatement. Le trigger existe déjà
-- pour la catégorie sur cette même table ; on ajoute le statut plutôt que de
-- l'attendre de la prochaine connexion du membre — l'admin qui encode un
-- paiement au comptoir doit voir l'effet tout de suite.
CREATE OR REPLACE FUNCTION trg_statut_apres_achat_pack()
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

DROP TRIGGER IF EXISTS statut_apres_achat_pack ON pack_purchases;
CREATE TRIGGER statut_apres_achat_pack
  AFTER INSERT ON pack_purchases
  FOR EACH ROW EXECUTE FUNCTION trg_statut_apres_achat_pack();

-- --- 3. Les frais d'inscription -------------------------------------------
-- C'est le fait qui fait basculer `potential` → `active`, et la table est
-- alimentée par plusieurs chemins : webhook Stripe, saisie admin, bon d'achat.
-- Un trigger les couvre tous d'un coup, là où il aurait fallu retrouver et
-- modifier chaque appelant.
CREATE OR REPLACE FUNCTION trg_statut_apres_frais()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $fn$
BEGIN
  -- Sur DELETE (un admin retire les frais), c'est OLD qui porte le membre.
  PERFORM update_member_status(COALESCE(NEW.user_id, OLD.user_id));
  RETURN COALESCE(NEW, OLD);
END;
$fn$;

DROP TRIGGER IF EXISTS statut_apres_frais ON registration_fees;
CREATE TRIGGER statut_apres_frais
  AFTER INSERT OR DELETE ON registration_fees
  FOR EACH ROW EXECUTE FUNCTION trg_statut_apres_frais();

-- --- 4. Remise à plat de l'existant ---------------------------------------
-- Les statuts accumulés depuis avril sont faux pour 9 profils sur 23. Les
-- triggers ci-dessus ne valent que pour l'avenir : on repasse une fois sur
-- tout le monde. Les comptes supprimés gardent leur `former`, posé par
-- l'anonymisation.
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN SELECT id FROM profiles WHERE deleted_at IS NULL LOOP
    PERFORM update_member_status(r.id);
  END LOOP;
END $$;

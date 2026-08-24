-- Un pack peut accorder une catégorie de membre, et dire à quoi revenir après.
--
-- Le besoin : vendre une « séance supplémentaire » à tarif préférentiel,
-- réservée aux abonnés. Le mécanisme d'accès existait déjà
-- (`pack_type_categories` restreint qui voit quoi), mais la catégorie devait
-- être posée à la main sur chaque membre — donc oubliée, donc fausse.
--
-- Deux champs, parce que ce sont deux décisions différentes : ce que l'achat
-- donne, et ce qui reste quand le pack s'éteint.

ALTER TABLE pack_types
  ADD COLUMN IF NOT EXISTS grants_category_id UUID REFERENCES member_categories(id),
  ADD COLUMN IF NOT EXISTS reverts_to_category_id UUID REFERENCES member_categories(id);

COMMENT ON COLUMN pack_types.grants_category_id IS
  'Catégorie attribuée au membre tant que ce pack est actif. NULL = ne change rien.';
COMMENT ON COLUMN pack_types.reverts_to_category_id IS
  'Catégorie de repli quand plus aucun pack n''accorde de catégorie. NULL = aucune.';

-- ---------------------------------------------------------------------------
-- La catégorie se DÉRIVE des packs actifs
-- ---------------------------------------------------------------------------

-- Stocker la catégorie à l'achat et la « rendre » à l'expiration reviendrait à
-- tenir un compteur : deux écritures qui doivent rester d'accord, et qui
-- divergeront. Un membre peut détenir plusieurs packs à la fois — un abonnement
-- et une carte de séances — et rien ne dit dans quel ordre ils s'éteignent.
--
-- On répond donc toujours à la même question : « vu ce que ce membre détient
-- MAINTENANT, quelle catégorie mérite-t-il ? ». La colonne reste écrite, parce
-- que les filtres et les listes en ont besoin, mais une seule logique la fixe.
--
-- Priorité à l'abonnement : un abonné qui achète une séance supplémentaire ne
-- doit pas perdre son statut d'abonné — ce serait lui retirer le tarif qui l'a
-- fait acheter.
CREATE OR REPLACE FUNCTION derive_member_category(p_user_id UUID)
RETURNS UUID
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $fn$
DECLARE
  v_categorie UUID;
BEGIN
  -- 1. Un abonnement en cours l'emporte sur tout le reste.
  SELECT pt.grants_category_id INTO v_categorie
  FROM subscriptions s
  JOIN pack_types pt ON pt.id = s.pack_type_id
  WHERE s.user_id = p_user_id
    AND s.status IN ('active', 'trialing', 'past_due')
    AND pt.grants_category_id IS NOT NULL
  ORDER BY s.created_at DESC
  LIMIT 1;

  IF v_categorie IS NOT NULL THEN
    RETURN v_categorie;
  END IF;

  -- 2. Sinon, un pack ponctuel encore valide. Un illimité a souvent zéro
  -- crédit restant sans être épuisé : la date fait foi, pas le compteur.
  SELECT pt.grants_category_id INTO v_categorie
  FROM pack_purchases pp
  JOIN pack_types pt ON pt.id = pp.pack_type_id
  WHERE pp.user_id = p_user_id
    AND pp.expires_at > NOW()
    AND (pt.is_unlimited OR pp.credits_remaining > 0)
    AND pt.grants_category_id IS NOT NULL
  ORDER BY pp.created_at DESC
  LIMIT 1;

  IF v_categorie IS NOT NULL THEN
    RETURN v_categorie;
  END IF;

  -- 3. Plus rien d'actif : le repli du dernier pack qui en déclarait un. On
  -- interroge l'historique, pas l'actuel — c'est justement parce que le pack
  -- s'est éteint qu'on cherche où retomber.
  SELECT pt.reverts_to_category_id INTO v_categorie
  FROM pack_purchases pp
  JOIN pack_types pt ON pt.id = pp.pack_type_id
  WHERE pp.user_id = p_user_id
    AND pt.reverts_to_category_id IS NOT NULL
  ORDER BY pp.created_at DESC
  LIMIT 1;

  RETURN v_categorie;
END;
$fn$;

-- Applique la catégorie dérivée. Renvoie TRUE si elle a changé — l'appelant
-- peut ainsi journaliser sans avoir à comparer lui-même.
CREATE OR REPLACE FUNCTION apply_member_category(p_user_id UUID)
RETURNS BOOLEAN
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $fn$
DECLARE
  v_nouvelle UUID;
  v_actuelle UUID;
BEGIN
  SELECT member_category_id INTO v_actuelle FROM profiles WHERE id = p_user_id;
  v_nouvelle := derive_member_category(p_user_id);

  -- Aucun pack ne se prononce : on ne touche à rien. Un studio qui range ses
  -- membres à la main ne doit pas voir son classement efface par un achat.
  IF v_nouvelle IS NULL THEN
    RETURN FALSE;
  END IF;

  IF v_nouvelle IS DISTINCT FROM v_actuelle THEN
    UPDATE profiles SET member_category_id = v_nouvelle WHERE id = p_user_id;
    RETURN TRUE;
  END IF;

  RETURN FALSE;
END;
$fn$;

REVOKE ALL ON FUNCTION derive_member_category(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION apply_member_category(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION derive_member_category(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION apply_member_category(UUID) TO authenticated;

-- ---------------------------------------------------------------------------
-- Quand recalculer
-- ---------------------------------------------------------------------------

-- À l'achat : c'est l'instant où la catégorie doit être juste, le membre va
-- s'en servir tout de suite pour accéder aux packs réservés.
CREATE OR REPLACE FUNCTION trg_apply_category_on_purchase()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $fn$
BEGIN
  -- Bloc protégé : un classement qui échoue ne doit pas annuler un achat payé.
  BEGIN
    PERFORM apply_member_category(NEW.user_id);
  EXCEPTION WHEN OTHERS THEN
    RAISE LOG 'apply_member_category (achat) : %', SQLERRM;
  END;
  RETURN NEW;
END;
$fn$;

DROP TRIGGER IF EXISTS trg_category_on_purchase ON pack_purchases;
CREATE TRIGGER trg_category_on_purchase
  AFTER INSERT ON pack_purchases
  FOR EACH ROW EXECUTE FUNCTION trg_apply_category_on_purchase();

-- À la fin d'un abonnement : événement net, Stripe le signale.
CREATE OR REPLACE FUNCTION trg_apply_category_on_subscription()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $fn$
BEGIN
  BEGIN
    PERFORM apply_member_category(NEW.user_id);
  EXCEPTION WHEN OTHERS THEN
    RAISE LOG 'apply_member_category (abonnement) : %', SQLERRM;
  END;
  RETURN NEW;
END;
$fn$;

DROP TRIGGER IF EXISTS trg_category_on_subscription ON subscriptions;
CREATE TRIGGER trg_category_on_subscription
  AFTER INSERT OR UPDATE OF status ON subscriptions
  FOR EACH ROW EXECUTE FUNCTION trg_apply_category_on_subscription();

-- L'expiration d'un pack ponctuel, elle, ne produit AUCUN événement : la date
-- passe, rien ne se déclenche. Un cron corrigerait après coup et finirait par
-- diverger — le projet a déjà tranché ce débat pour le statut d'un cours.
-- Le recalcul se fait donc à la lecture, quand le front appelle
-- `refresh_my_category` : la valeur est juste au moment où elle sert.
CREATE OR REPLACE FUNCTION refresh_my_category()
RETURNS UUID
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
  PERFORM apply_member_category(v_user);
  RETURN (SELECT member_category_id FROM profiles WHERE id = v_user);
END;
$fn$;

REVOKE ALL ON FUNCTION refresh_my_category() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION refresh_my_category() TO authenticated;

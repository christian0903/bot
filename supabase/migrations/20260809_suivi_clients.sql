-- Suivi des clients : qui ralentit, qui décroche, et ce que chacun rapporte
--
-- Le studio a besoin de repérer les membres à relancer AVANT qu'ils soient
-- perdus. Trois questions, une seule fonction :
--   - qui vient moins qu'avant ?
--   - qui n'est plus venu depuis longtemps ?
--   - combien chacun a-t-il rapporté ?
--
-- ── Deux mesures de la présence, volontairement côte à côte ──────────────────
--
-- `reservations` compte les réservations confirmées sur des cours passés.
-- `pointages` compte celles qui ont été effectivement pointées.
--
-- Les deux figurent parce qu'aucune n'est fiable seule. Le pointage dit la
-- vérité du terrain mais dépend de la rigueur du coach : une séance non
-- pointée ferait passer un présent pour un absent. La réservation, elle, est
-- toujours enregistrée — et elle a consommé un crédit, donc elle compte
-- commercialement même si la personne n'est pas venue.
--
-- L'écart entre les deux colonnes est lui-même une information : sur un
-- membre qui réserve sans venir, ou sur un cours où l'on oublie de pointer.
-- C'est au studio de lire, pas à la fonction de trancher.
--
-- Le classement (`etat`) s'appuie sur la RÉSERVATION : c'est la donnée
-- toujours présente. Fonder l'alerte sur le pointage produirait des faux
-- décrocheurs tant que le pointage n'est pas systématique.
--
-- ── Le revenu ───────────────────────────────────────────────────────────────
--
-- `booking_revenue()` existe déjà et gère le cas délicat : sur un pack
-- illimité, le prix se répartit entre les séances réellement réservées. On la
-- réutilise plutôt que de recalculer.
--
-- `ca_total` additionne les achats (packs et cycles d'abonnement) — l'argent
-- réellement encaissé. `ca_par_seance` divise par les séances consommées :
-- c'est ce chiffre qui dit si un membre est rentable, pas le total.

-- ── Seuils réglables ─────────────────────────────────────────────────────────
-- Le studio ajuste selon ce qu'il observe. Valeurs par défaut calées sur un
-- cycle d'abonnement de 4 semaines : 3 semaines = un cycle presque manqué,
-- 6 = un cycle et demi, 10 = plus de deux cycles.
INSERT INTO app_settings (key, value)
VALUES ('client_tracking', jsonb_build_object(
  'ralentit_semaines', 3,
  'decroche_semaines', 6,
  'perdu_semaines', 10,
  'fenetre_comparaison_semaines', 8
))
ON CONFLICT (key) DO NOTHING;

DROP FUNCTION IF EXISTS client_tracking_stats();

-- Le contrôle de rôle est DANS la fonction, comme les autres fonctions admin
-- du schéma : elle expose e-mail, téléphone et chiffre d'affaires de toute la
-- clientèle. Un GRANT à `authenticated` sans ce garde ouvrirait la porte à
-- n'importe quel membre connecté appelant l'API directement.
--
-- ⚠ Piège PL/pgSQL : les noms déclarés dans `RETURNS TABLE (...)` sont des
-- variables dans tout le corps de la fonction, et PL/pgSQL les résout AVANT
-- les colonnes. Toute colonne de CTE portant le même nom — ici `user_id` —
-- déclenche « column reference is ambiguous » à l'exécution, jamais à la
-- création. D'où les alias `uid` dans les CTE : aucune ne porte le nom d'un
-- paramètre de sortie.
CREATE FUNCTION client_tracking_stats()
RETURNS TABLE (
  user_id UUID,
  display_name TEXT,
  email TEXT,
  phone TEXT,
  member_status TEXT,
  is_business BOOLEAN,
  derniere_seance TIMESTAMPTZ,
  jours_depuis_derniere INTEGER,
  etat TEXT,
  reservations_total BIGINT,
  pointages_total BIGINT,
  reservations_recentes BIGINT,
  reservations_precedentes BIGINT,
  tendance TEXT,
  ca_total NUMERIC,
  seances_consommees BIGINT,
  ca_par_seance NUMERIC,
  a_pack_actif BOOLEAN,
  a_abonnement BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $fn$
BEGIN
  IF NOT (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'super_admin')) THEN
    RAISE EXCEPTION 'Reserve aux administrateurs';
  END IF;

  RETURN QUERY
WITH seuils AS (
  SELECT
    COALESCE((value->>'ralentit_semaines')::INT, 3)            AS ralentit,
    COALESCE((value->>'decroche_semaines')::INT, 6)            AS decroche,
    COALESCE((value->>'perdu_semaines')::INT, 10)              AS perdu,
    COALESCE((value->>'fenetre_comparaison_semaines')::INT, 8) AS fenetre
  FROM app_settings WHERE key = 'client_tracking'
),
-- Défaut si la ligne de réglages a été supprimée : la page ne doit pas
-- devenir vide parce qu'un réglage manque.
s AS (
  SELECT
    COALESCE((SELECT ralentit FROM seuils), 3)  AS ralentit,
    COALESCE((SELECT decroche FROM seuils), 6)  AS decroche,
    COALESCE((SELECT perdu FROM seuils), 10)    AS perdu,
    COALESCE((SELECT fenetre FROM seuils), 8)   AS fenetre
),
-- Réservations sur cours PASSÉS uniquement : une réservation à venir ne dit
-- rien de la fréquentation, et fausserait la date de dernière séance.
seances AS (
  SELECT
    b.user_id AS uid,
    b.id            AS booking_id,
    sc.starts_at,
    b.checked_in_at
  FROM bookings b
  JOIN scheduled_classes sc ON sc.id = b.scheduled_class_id
  WHERE b.status <> 'cancelled'
    AND sc.starts_at < NOW()
    AND COALESCE(sc.is_cancelled, FALSE) = FALSE
),
par_membre AS (
  SELECT
    se.uid,
    MAX(se.starts_at)                                   AS derniere_seance,
    COUNT(*)                                            AS reservations_total,
    COUNT(se.checked_in_at)                             AS pointages_total,
    -- Deux fenêtres consécutives de même durée : la récente contre la
    -- précédente. C'est la comparaison qui révèle un ralentissement, pas le
    -- total cumulé — quelqu'un de très ancien garde un gros total en ayant
    -- cessé de venir.
    COUNT(*) FILTER (
      WHERE se.starts_at >= NOW() - ((SELECT fenetre FROM s) || ' weeks')::INTERVAL
    )                                                   AS reservations_recentes,
    COUNT(*) FILTER (
      WHERE se.starts_at >= NOW() - (2 * (SELECT fenetre FROM s) || ' weeks')::INTERVAL
        AND se.starts_at <  NOW() - ((SELECT fenetre FROM s) || ' weeks')::INTERVAL
    )                                                   AS reservations_precedentes,
    COALESCE(SUM(booking_revenue(se.booking_id)), 0)    AS revenu_seances
  FROM seances se
  GROUP BY se.uid
),
-- Ce qui a été encaissé, indépendamment de la consommation. Un membre qui
-- achète un pack et ne vient pas a rapporté de l'argent : le total d'achats
-- le dit, le revenu par séance ne le dirait pas.
achats AS (
  SELECT
    pp.user_id AS uid,
    COALESCE(SUM(pp.price_paid_cents), 0)::NUMERIC / 100 AS ca_total,
    BOOL_OR(pp.credits_remaining > 0 AND pp.expires_at > NOW()) AS a_pack_actif
  FROM pack_purchases pp
  GROUP BY pp.user_id
),
abos AS (
  -- Qualifier `s2.user_id` n'est pas cosmétique : `user_id` est aussi un
  -- paramètre de sortie de la fonction, et PL/pgSQL le résout en priorité.
  -- Non qualifié, il provoque « column reference user_id is ambiguous ».
  SELECT s2.user_id AS uid, TRUE AS a_abonnement
  FROM subscriptions s2
  WHERE s2.status IN ('active', 'past_due', 'paused')
  GROUP BY s2.user_id
)
SELECT
  p.id,
  p.display_name,
  p.email,
  p.phone,
  p.member_status,
  COALESCE(p.is_business, FALSE),
  pm.derniere_seance,
  CASE WHEN pm.derniere_seance IS NULL THEN NULL
       ELSE EXTRACT(EPOCH FROM (NOW() - pm.derniere_seance))::INT / 86400
  END AS jours_depuis_derniere,
  CASE
    -- Jamais venu : ni ralenti ni décroché, c'est un cas à part. Un membre
    -- inscrit qui n'est jamais venu appelle un accueil, pas une relance.
    WHEN pm.derniere_seance IS NULL THEN 'jamais_venu'
    WHEN pm.derniere_seance < NOW() - ((SELECT perdu FROM s)    || ' weeks')::INTERVAL THEN 'perdu'
    WHEN pm.derniere_seance < NOW() - ((SELECT decroche FROM s) || ' weeks')::INTERVAL THEN 'decroche'
    WHEN pm.derniere_seance < NOW() - ((SELECT ralentit FROM s) || ' weeks')::INTERVAL THEN 'ralentit'
    ELSE 'actif'
  END AS etat,
  COALESCE(pm.reservations_total, 0),
  COALESCE(pm.pointages_total, 0),
  COALESCE(pm.reservations_recentes, 0),
  COALESCE(pm.reservations_precedentes, 0),
  CASE
    -- Sans passé, il n'y a pas de tendance à lire : un nouveau membre n'est
    -- pas « en baisse » parce que sa fenêtre précédente est vide.
    WHEN COALESCE(pm.reservations_precedentes, 0) = 0
     AND COALESCE(pm.reservations_recentes, 0) = 0 THEN 'aucune'
    WHEN COALESCE(pm.reservations_precedentes, 0) = 0 THEN 'nouveau'
    WHEN pm.reservations_recentes = 0 THEN 'arret'
    WHEN pm.reservations_recentes < pm.reservations_precedentes THEN 'baisse'
    WHEN pm.reservations_recentes > pm.reservations_precedentes THEN 'hausse'
    ELSE 'stable'
  END AS tendance,
  COALESCE(a.ca_total, 0),
  COALESCE(pm.reservations_total, 0) AS seances_consommees,
  CASE WHEN COALESCE(pm.reservations_total, 0) > 0
       THEN ROUND(COALESCE(a.ca_total, 0) / pm.reservations_total, 2)
       ELSE NULL
  END AS ca_par_seance,
  COALESCE(a.a_pack_actif, FALSE),
  COALESCE(ab.a_abonnement, FALSE)
FROM profiles p
LEFT JOIN par_membre pm ON pm.uid = p.id
LEFT JOIN achats a      ON a.uid  = p.id
LEFT JOIN abos ab       ON ab.uid = p.id
WHERE p.deleted_at IS NULL
  -- Le staff n'est pas une clientèle : il fausserait les moyennes.
  AND NOT EXISTS (
    SELECT 1 FROM user_roles ur
    WHERE ur.user_id = p.id AND ur.role IN ('admin', 'super_admin', 'coach')
  )
ORDER BY
  -- Les plus urgents d'abord : décrochés récents avant perdus de longue date.
  CASE
    WHEN pm.derniere_seance IS NULL THEN 3
    WHEN pm.derniere_seance < NOW() - ((SELECT perdu FROM s)    || ' weeks')::INTERVAL THEN 2
    WHEN pm.derniere_seance < NOW() - ((SELECT decroche FROM s) || ' weeks')::INTERVAL THEN 0
    WHEN pm.derniere_seance < NOW() - ((SELECT ralentit FROM s) || ' weeks')::INTERVAL THEN 1
    ELSE 4
  END,
  pm.derniere_seance DESC NULLS LAST;
END;
$fn$;

REVOKE ALL ON FUNCTION client_tracking_stats() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION client_tracking_stats() TO authenticated;

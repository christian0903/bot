-- ============================================================================
-- Garder le nombre de seances suivies AVANT l'application
--
-- Les coachs veulent accorder les badges d'assiduite en tenant compte du passe.
-- Un client qui s'entraine depuis deux ans repartirait sinon a zero le jour de
-- la bascule, et devrait refaire cent seances pour retrouver son badge.
--
-- Une COLONNE, pas une table. Les sept badges comptent des seances tout court
-- — 10, 25, 50, 100 — aucun ne distingue le semi-prive du personal training.
-- Decouper l'historique par type serait du travail pour une information que
-- rien n'utilise. Le detail pourra s'ajouter le jour ou un badge le demandera ;
-- retirer une table devenue inutile est plus rare.
--
-- ---------------------------------------------------------------------------
-- Ce que cette reprise ne peut pas faire
--
-- Les series de semaines consecutives (`member_streak`) repartent de zero.
-- Sans les dates, une regularite ne se reconstitue pas — c'est une limite du
-- procede, pas un oubli. Les graphiques par mois et par type ne montreront eux
-- aussi que ce qui se passe dans l'application.
-- ============================================================================

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS seances_anterieures INTEGER NOT NULL DEFAULT 0
  CHECK (seances_anterieures >= 0);

COMMENT ON COLUMN profiles.seances_anterieures IS
  'Seances suivies avant la mise en service, reprises de l''ancien systeme. '
  'Ajoutees au total pour les badges ; sans effet sur les periodes recentes.';

-- ---------------------------------------------------------------------------
-- Le comptage
--
-- La fonction sert a trois usages depuis le meme ecran : le total de toujours,
-- la semaine, le mois. L'historique ne doit s'ajouter qu'au PREMIER — sinon un
-- client repris afficherait quarante-sept seances « cette semaine ».
--
-- Le test porte sur `p_from` : l'ecran demande le total depuis 2020, bien avant
-- l'ouverture du studio. Une date recente signifie qu'on interroge une periode,
-- et le passe n'y a pas sa place.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION member_sessions_count(p_user_id UUID, p_from DATE, p_to DATE)
RETURNS INTEGER
LANGUAGE sql SECURITY DEFINER STABLE
AS $$
  SELECT (
    SELECT COUNT(*)::INTEGER FROM bookings b
    JOIN scheduled_classes sc ON b.scheduled_class_id = sc.id
    WHERE b.user_id = p_user_id
      AND b.status = 'confirmed'
      AND (b.checked_in_at IS NOT NULL OR sc.starts_at > NOW())
      AND sc.starts_at::DATE BETWEEN p_from AND p_to
  ) + COALESCE((
    -- Le seuil de 2021 est arbitraire mais sur : le studio n'existait pas, et
    -- aucune periode d'interet ne commence avant.
    --
    -- Le COALESCE exterieur couvre le profil absent : une sous-requete sans
    -- ligne renvoie NULL, et NULL + n'importe quoi vaut NULL. La fonction
    -- retournerait alors NULL au lieu du compte des reservations, et l'ecran
    -- afficherait un vide la ou il attend un nombre.
    SELECT CASE WHEN p_from <= DATE '2021-01-01'
                THEN seances_anterieures ELSE 0 END
      FROM profiles WHERE id = p_user_id
  ), 0);
$$;

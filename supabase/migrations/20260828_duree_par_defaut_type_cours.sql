-- Une durée par défaut sur le type de cours, comme il y a déjà un nombre de
-- participants par défaut.
--
-- Demande des coachs (2026-08-28) : « cours semi-privés = 50 min, personal
-- training = 1 h ». À chaque création de cours il fallait corriger le 60 posé
-- en dur dans le formulaire — geste répété, donc oublié.
--
-- Le mécanisme existe déjà pour `default_max_participants` : le formulaire de
-- planification le reprend au choix du type de cours. On se greffe au même
-- endroit.
--
-- 60 par défaut, la valeur que le formulaire posait jusqu'ici : aucune bascule
-- de comportement pour les types existants tant que personne n'y touche.

ALTER TABLE class_types
  ADD COLUMN IF NOT EXISTS default_duration_minutes INTEGER NOT NULL DEFAULT 60;

-- Les valeurs demandées, posées sur un critère qui existe en base plutôt que
-- sur les noms : aucun type ne s'appelle « semi-privé »: ce que les coachs
-- désignent ainsi, ce sont les cours de groupe (BackOnTrack, Boxing,
-- CrossTraining, Ladies, Posture — 5 places), par opposition au personal
-- training (2 places). `default_max_participants > 2` traduit donc la
-- distinction sans dépendre d'un libellé qui peut être renommé demain.
--
-- « Événement spécial » (20 places) garde 60 : sa durée varie, et une valeur
-- par défaut n'y veut rien dire.
UPDATE class_types
   SET default_duration_minutes = 50
 WHERE default_max_participants BETWEEN 3 AND 10;

UPDATE class_types
   SET default_duration_minutes = 60
 WHERE default_max_participants <= 2;

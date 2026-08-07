-- ============================================================================
-- Performances : des valeurs comparables
-- ----------------------------------------------------------------------------
-- `performances.value` est un texte libre. Les coachs y écrivent trois choses
-- différentes — « 1:55 » (un temps), « 50 kg » (une charge), « 22,5 » (un
-- nombre nu) — parfois pour le même mouvement. Sur 57 valeurs saisies, 2
-- seulement sont des nombres purs : aucun graphique n'est traçable en l'état.
--
-- Deux informations manquaient, et elles se décident au niveau du MOUVEMENT,
-- une fois pour toutes :
--   1. la NATURE de la mesure (charge, temps, répétitions, distance)
--   2. le SENS du progrès — pour une charge, monter c'est mieux ; pour un
--      chrono, descendre c'est mieux. Sans cela un graphique ne peut pas dire
--      « tu progresses » sans risquer de se tromper.
--
-- Le texte saisi est CONSERVÉ : `value` reste la source de vérité affichée.
-- On ajoute `value_num`, la même chose en nombre, pour calculer et tracer.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Ce qu'on mesure, et dans quel sens
-- ---------------------------------------------------------------------------
ALTER TABLE performance_types
  ADD COLUMN IF NOT EXISTS measure_kind TEXT NOT NULL DEFAULT 'number'
    CHECK (measure_kind IN ('weight', 'time', 'reps', 'distance', 'number'));

COMMENT ON COLUMN performance_types.measure_kind IS
  'Nature de la mesure. Commande le formulaire de saisie (deux champs min/sec pour un temps, un champ kg pour une charge) et le format d''affichage.';

-- Le sens du progrès découle presque toujours de la nature — un temps
-- s'améliore en baissant — mais pas toujours : un gainage se mesure en temps
-- et s'améliore en montant. D'où une colonne distincte.
ALTER TABLE performance_types
  ADD COLUMN IF NOT EXISTS lower_is_better BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN performance_types.lower_is_better IS
  'TRUE quand descendre est un progrès (chrono). FALSE quand monter est un progrès (charge, répétitions). Un gainage est un temps où monter est mieux : les deux colonnes sont donc indépendantes.';

-- ---------------------------------------------------------------------------
-- 2. La valeur, en nombre
-- ---------------------------------------------------------------------------
-- Unité canonique par nature : kilogrammes, SECONDES, répétitions, mètres.
-- Stocker « 1:55 » en 115 secondes permet de comparer, trier et tracer ; le
-- texte d'origine reste affiché tel que le coach l'a écrit.
ALTER TABLE performances
  ADD COLUMN IF NOT EXISTS value_num NUMERIC;

COMMENT ON COLUMN performances.value_num IS
  'La valeur en nombre, unité canonique selon measure_kind : kg, SECONDES, répétitions, mètres. NULL si la saisie n''a pas pu être interprétée — la ligne reste lisible via `value`.';

CREATE INDEX IF NOT EXISTS performances_user_type_date
  ON performances (user_id, performance_type_id, date)
  WHERE value_num IS NOT NULL;

-- ---------------------------------------------------------------------------
-- 3. Convertir une saisie en nombre
-- ---------------------------------------------------------------------------
-- Utilisée pour rattraper l'existant, et réutilisable si une saisie libre
-- réapparaît un jour.
CREATE OR REPLACE FUNCTION parse_performance_value(p_value TEXT, p_kind TEXT)
RETURNS NUMERIC
LANGUAGE plpgsql
IMMUTABLE
AS $fn$
DECLARE
  v_clean TEXT;
  v_parts TEXT[];
BEGIN
  IF p_value IS NULL THEN RETURN NULL; END IF;

  -- Virgule décimale française, espaces superflus.
  v_clean := trim(replace(p_value, ',', '.'));

  -- Format m:ss ou h:mm:ss → secondes. Reconnu quel que soit `p_kind` : une
  -- valeur écrite « 1:55 » est un temps, peu importe ce qu'annonce le type.
  IF v_clean ~ '^[0-9]+:[0-5][0-9]$' THEN
    v_parts := string_to_array(v_clean, ':');
    RETURN v_parts[1]::NUMERIC * 60 + v_parts[2]::NUMERIC;
  END IF;

  IF v_clean ~ '^[0-9]+:[0-5][0-9]:[0-5][0-9]$' THEN
    v_parts := string_to_array(v_clean, ':');
    RETURN v_parts[1]::NUMERIC * 3600 + v_parts[2]::NUMERIC * 60 + v_parts[3]::NUMERIC;
  END IF;

  -- Nombre suivi d'une unité facultative : « 50 kg », « 6kg », « 22.5 ».
  -- L'unité est ignorée — c'est `measure_kind` qui fait foi, pas ce que le
  -- coach a tapé à côté du chiffre.
  IF v_clean ~ '^[0-9]+(\.[0-9]+)?\s*[a-zA-Z]*$' THEN
    RETURN (regexp_match(v_clean, '^([0-9]+(?:\.[0-9]+)?)'))[1]::NUMERIC;
  END IF;

  -- Non interprétable : on renonce plutôt que de deviner. La ligne reste
  -- lisible par son texte, elle est simplement absente des graphiques.
  RETURN NULL;
END;
$fn$;

COMMENT ON FUNCTION parse_performance_value IS
  'Convertit une saisie libre en nombre (secondes pour un temps). Renvoie NULL si la valeur est ininterprétable — mieux vaut un point manquant qu''un point faux.';

-- ---------------------------------------------------------------------------
-- 4. Qualifier les mouvements existants
-- ---------------------------------------------------------------------------
-- Déduit de ce qui a réellement été saisi, pas du nom du mouvement : un type
-- dont la majorité des valeurs contient « : » mesure un temps.
UPDATE performance_types pt
SET measure_kind = 'time',
    lower_is_better = TRUE
WHERE EXISTS (
  SELECT 1 FROM performances p
  WHERE p.performance_type_id = pt.id AND p.value ~ ':'
  GROUP BY p.performance_type_id
  HAVING COUNT(*) FILTER (WHERE p.value ~ ':') > COUNT(*) / 2.0
);

-- Les autres, dont l'unité annoncée ou les valeurs évoquent une charge.
UPDATE performance_types pt
SET measure_kind = 'weight',
    lower_is_better = FALSE
WHERE measure_kind = 'number'
  AND (
    lower(coalesce(pt.unit_hint, '')) LIKE '%kg%'
    OR EXISTS (
      SELECT 1 FROM performances p
      WHERE p.performance_type_id = pt.id AND lower(p.value) LIKE '%kg%'
    )
  );

-- ---------------------------------------------------------------------------
-- 5. Rattraper les valeurs déjà saisies
-- ---------------------------------------------------------------------------
UPDATE performances p
SET value_num = parse_performance_value(p.value, pt.measure_kind)
FROM performance_types pt
WHERE pt.id = p.performance_type_id
  AND p.value_num IS NULL;

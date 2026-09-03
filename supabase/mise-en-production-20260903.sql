-- ============================================================================
-- MISE EN PRODUCTION — bot-ops (app.backontrackstudio.be)
-- Prepare le 2026-09-03. A coller dans l'editeur SQL de Supabase, projet
-- xgwrxbkrfypklrnqbftv. NE PAS passer par `supabase db push` (regle 5).
--
-- Contenu : la migration 20260903 (fiche de cours + inscrits), deja eprouvee
-- sur bot3, puis les descriptions des types de cours.
--
-- Tout est dans UNE transaction : en cas d'erreur, rien ne reste a moitie fait.
-- Le SELECT de controle s'affiche AVANT le COMMIT — le relire, puis valider.
-- ============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. Migration : qui est inscrit a un cours
-- ---------------------------------------------------------------------------
-- Se retirer de la liste des inscrits, sans se retirer des cours.
--
-- Visible par defaut : c'est le comportement attendu, celui de l'ancienne
-- application, et une colonne a FALSE aurait laisse toutes les listes vides —
-- l'effet recherche ne se serait jamais produit. Le retrait reste possible
-- d'un geste depuis la page Profil.
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS visible_aux_autres BOOLEAN NOT NULL DEFAULT TRUE;

COMMENT ON COLUMN profiles.visible_aux_autres IS
  'Apparaitre dans la liste des inscrits vue par les autres membres. Ne change rien aux reservations elles-memes.';

CREATE OR REPLACE FUNCTION participants_par_cours(p_class_id UUID)
RETURNS TABLE (user_id UUID, prenom TEXT, avatar_url TEXT)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  -- `first_name` avec repli sur `display_name` : le prenom seul suffit a
  -- l'effet recherche et expose moins, mais il est facultatif dans `profiles`
  -- — sans ce repli, les comptes qui ne l'ont pas renseigne sortiraient avec
  -- une ligne vide au lieu d'un nom.
  SELECT b.user_id,
         COALESCE(NULLIF(TRIM(p.first_name), ''), p.display_name) AS prenom,
         p.avatar_url
  FROM bookings b
  JOIN profiles p ON p.id = b.user_id
  WHERE b.scheduled_class_id = p_class_id
    AND b.status = 'confirmed'
    AND p.deleted_at IS NULL
    AND p.visible_aux_autres
  ORDER BY b.created_at;
$$;

COMMENT ON FUNCTION participants_par_cours(UUID) IS
  'Prenom et photo des inscrits a un cours, pour les membres connectes. Le front ne peut pas les lire lui-meme : la RLS de `bookings` ne montre a un membre que ses propres reservations.';

REVOKE ALL ON FUNCTION participants_par_cours(UUID) FROM PUBLIC;
-- `REVOKE ... FROM PUBLIC` ne suffit pas : Supabase pose un ALTER DEFAULT
-- PRIVILEGES qui accorde EXECUTE a `anon` des la creation de la fonction.
-- Ce droit-la est nominatif, il survit au REVOKE ci-dessus — la fonction
-- paraissait fermee aux visiteurs et ne l'etait pas. Constate le 2026-09-03
-- sur bot3, ou `anon` pouvait lire les prenoms et les photos des inscrits.
REVOKE EXECUTE ON FUNCTION participants_par_cours(UUID) FROM anon;
GRANT EXECUTE ON FUNCTION participants_par_cours(UUID) TO authenticated;


-- ---------------------------------------------------------------------------
-- 2. Descriptions des types de cours
-- ---------------------------------------------------------------------------
-- « Personal Training » n'est pas traite : aucune page du site ne le decrit.

-- BackOnTrack
UPDATE class_types
   SET description    = 'Renforcement global, à ton rythme',
       description_md = '### Pour qui ?
Ce cours s''adresse à tout le monde : de la personne qui souhaite se remettre en
mouvement au sportif confirmé. Adapté à différents niveaux, il permet à chacun
de progresser en sécurité grâce à des exercices de renforcement fonctionnel
variés.

### Pourquoi ce programme ?
BackOnTrack est pensé comme un entraînement complet et accessible. En groupe de
5 participants maximum, tu bénéficies d''un coaching attentif qui s''adapte à ton
rythme et à tes besoins. L''objectif : améliorer ta force, ta mobilité et ton
énergie au quotidien, tout en profitant de la dynamique d''un collectif motivant.

### Recommandation santé
L''OMS recommande au moins deux séances de renforcement musculaire par semaine
pour rester en bonne santé.'
 WHERE TRIM(name) = 'BackOnTrack';

-- Boxing
UPDATE class_types
   SET description    = 'Technique, cardio et renforcement',
       description_md = '### Pour qui ?
Ce cours de boxe est ouvert à une grande variété de profils : tous ceux qui
souhaitent améliorer leur condition physique, apprendre à se défendre et
développer leur mental, tout en s''amusant et en se défoulant.

### Pourquoi ce programme ?
Tu viens découvrir les bases de la boxe dans un environnement bienveillant.
Débutant ou expert, le coach s''adapte pour te challenger.

### Recommandation santé
L''OMS recommande aux adultes au moins 150 minutes d''activité physique modérée
par semaine pour prévenir les maladies cardiovasculaires.'
 WHERE TRIM(name) = 'Boxing';

-- CrossTraining
UPDATE class_types
   SET description    = 'Force, cardio et mouvements fonctionnels',
       description_md = '### Pour qui ?
Le CrossTraining s''adresse à tous ceux qui veulent bouger différemment :
débutant ou confirmé, chacun avance à son rythme et selon ses ambitions. Un
entraînement complet et ultra dynamique, où tu découvres la puissance du
renforcement, de la mobilité et du cardio dans une ambiance bienveillante axée
sur la progression technique et le mouvement fonctionnel.

### Pourquoi ce programme ?
Encadré par des coachs passionnés, le CrossTraining propose des exercices
adaptés à chaque profil, y compris en cas de douleurs ou de limitations. Tu
gagnes en force, en cardio et en mobilité, tout en évitant la monotonie : chaque
séance t''apporte plus d''assurance et d''efficacité au quotidien.'
 WHERE TRIM(name) = 'CrossTraining';

-- Ladies
UPDATE class_types
   SET description    = 'Renforcement global & cardio, entre femmes',
       description_md = '### Pour qui ?
Ce cours est conçu pour toutes les femmes désireuses de reprendre le sport ou
d''aller plus loin, quel que soit leur niveau. Débutantes, vous trouvez ici un
espace doux où (re)commencer, sans pression ni jugement. Déjà active ou envie de
progresser ? Le programme s''adapte à chacune, pour renforcer et tonifier tout le
corps dans une énergie exclusivement féminine.

### Pourquoi ce programme ?
Ladies, c''est ton booster de confiance : on cible les fessiers, la sangle
abdominale et les bras à travers des exercices simples, efficaces et variés.
Chaque séance te pousse à te dépasser à ton rythme, dans une ambiance motivante
et bienveillante.

### Recommandation santé
Une à trois fois par semaine, selon ton envie et ton emploi du temps. Pour
pimenter ta routine, combine ce cours avec des activités plus intenses.'
 WHERE TRIM(name) = 'Ladies';

-- Mobility & Stretch
UPDATE class_types
   SET description    = 'Mobilité, tronc & prévention des douleurs',
       description_md = '### Pour qui ?
Cette séance s''adresse à qui veut retrouver de l''amplitude, relâcher les
tensions et bouger plus librement. C''est le complément d''un corps qui
s''entraîne — comme de celui qui reste assis toute la journée.

### Pourquoi ce programme ?
Mobilité articulaire, étirements et respiration. La séance combine renforcement
et mobilité par une méthode douce, centrée sur le tronc — colonne vertébrale et
bassin — pour maintenir une amplitude de mouvement fonctionnelle et sans
douleur, avec de la relaxation en fin de séance.'
 WHERE TRIM(name) = 'Mobility & Stretch';


-- ---------------------------------------------------------------------------
-- 3. CONTROLE — a relire avant de valider
-- ---------------------------------------------------------------------------
-- Attendu : colonne=1, fonction=1, anon_execute=false, authenticated_execute=true
SELECT 'colonne visible_aux_autres' AS objet,
       COUNT(*)::text AS valeur
  FROM information_schema.columns
 WHERE table_schema='public' AND table_name='profiles'
   AND column_name='visible_aux_autres'
UNION ALL
SELECT 'fonction participants_par_cours', COUNT(*)::text
  FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
 WHERE n.nspname='public' AND p.proname='participants_par_cours'
UNION ALL
SELECT 'anon peut executer (doit etre false)',
       COALESCE(bool_or(has_function_privilege('anon', p.oid, 'EXECUTE'))::text, 'fonction absente')
  FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
 WHERE n.nspname='public' AND p.proname='participants_par_cours'
UNION ALL
SELECT 'authenticated peut executer (doit etre true)',
       COALESCE(bool_or(has_function_privilege('authenticated', p.oid, 'EXECUTE'))::text, 'fonction absente')
  FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
 WHERE n.nspname='public' AND p.proname='participants_par_cours';

-- Attendu : 5 lignes, chacune avec une taille non nulle.
-- Une ligne manquante = un nom different de celui attendu.
SELECT name,
       LENGTH(description)    AS def_courte,
       LENGTH(description_md) AS def_longue
  FROM class_types
 WHERE TRIM(name) IN ('BackOnTrack','Boxing','CrossTraining','Ladies','Mobility & Stretch')
 ORDER BY name;

-- ---------------------------------------------------------------------------
-- Les deux SELECT sont bons ? Executer :
COMMIT;
-- Sinon :
-- ROLLBACK;
-- ---------------------------------------------------------------------------

-- ============================================================================
-- Definitions et descriptions des types de cours
-- ----------------------------------------------------------------------------
-- Textes repris des pages du WordPress du studio (sauvegarde du 2026-09-02) :
-- ce sont les mots du studio, resserres pour un membre deja inscrit qui
-- consulte une seance au planning. Detail et provenance dans
-- `docs/descriptions-cours.md`.
--
-- Les intertitres sont des titres markdown (`###`) et non du gras : markdown ne
-- coupe un paragraphe que sur une ligne vide, un `**titre**` suivi de son texte
-- se retrouvait colle sur la meme ligne.
--
-- `TRIM(name)` parce que la production porte des espaces en fin de nom
-- (`'Ladies '`, `'Mobility & Stretch '`) que le test n'a pas. Comparer le nom
-- brut ne toucherait aucune ligne — et un UPDATE qui ne touche rien ne renvoie
-- AUCUNE erreur (regle 6).
--
-- Rejouable : ecrit les memes valeurs si on le repasse.
--
-- NON TRAITE : « Personal Training », dont aucune page du site ne parle. Sa
-- description longue reste a ecrire par les coachs.
-- ============================================================================

BEGIN;


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


-- Controle avant de valider : chaque cours vise doit afficher une taille non
-- nulle. Une ligne manquante signale un nom different de celui attendu — ce que
-- l'UPDATE seul n'aurait pas signale.
SELECT name,
       LENGTH(description)    AS def_courte,
       LENGTH(description_md) AS def_longue
  FROM class_types
 WHERE TRIM(name) IN ('BackOnTrack','Boxing','CrossTraining','Ladies','Mobility & Stretch')
 ORDER BY name;

-- Relire le SELECT ci-dessus, puis :
COMMIT;
-- (ou ROLLBACK; si une ligne manque a l'appel)

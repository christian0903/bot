# Descriptions des cours

> **État au 2026-09-03 : brouillon, rien n'est encore écrit en base.**
> Cinq descriptions longues sur six sont prêtes, et les six définitions
> courtes. « Personal Training » n'a aucune page sur le site : sa description
> longue reste à écrire par les coachs.

**D'où viennent ces textes.** Des pages de cours du WordPress du studio,
récupérées dans la sauvegarde du 2026-09-02 (`backup site wordpress bot/site
statique sucker-wp.backontrackstudio.be/`). Ce sont donc les mots du studio,
pas les nôtres.

**Ce qu'ils deviennent.** La colonne `class_types.description_md`, affichée
dans la fiche d'un cours au planning — le bouton « Informations ». Tant qu'elle
est vide, la fiche ne montre que l'image et le nom du cours.

**Les deux bases n'ont pas les mêmes cours.** La production fait foi : c'est
elle que les coachs ont remplie.

| Cours | bot3 (test) | bot-ops (production) |
|---|---|---|
| BackOnTrack | oui | oui |
| Boxing | oui | oui |
| CrossTraining | oui | oui |
| Ladies | oui | `"Ladies "` |
| Posture | oui | absent |
| Mobility & Stretch | absent | oui |
| Personal Training | `"personal training"` | `"Personal Training "` |
| Événement spécial | oui | absent |

Noter les espaces en fin de nom en production (`"Ladies "`) : sans effet
aujourd'hui, mais toute comparaison de nom s'y cassera.

**« Rush » écarté.** Le WordPress a une page « Rush », sans équivalent dans
aucune des deux bases. Décision de Christian le 2026-09-03 : ne pas le reprendre
— usage inconnu, besoin des coachs non établi.

**Comment écrire ces textes.** Les intertitres sont des titres markdown
(`### Pour qui ?`), pas du gras. Ce n'est pas cosmétique : markdown ne coupe un
paragraphe que sur une **ligne vide**, donc un `**titre**` suivi du texte à la
ligne se retrouve collé sur la même ligne à l'écran — constaté le 2026-09-03.
Un `###` coupe toujours, et donne au passage la hiérarchie. Les styles
correspondants sont dans `src/index.css`, classe `.md-annonce`.

---

## Les textes


Reprises des pages du WordPress du studio (sauvegarde du 2026-09-02), resserrées
pour un membre déjà inscrit qui consulte une séance au planning. Le tutoiement
est conservé — c'est la voix du studio. Les appels « réserve ta séance d'essai »
sont retirés : ils n'ont pas de sens dans l'application.

---

## BackOnTrack

**Définition courte** (`description`) :
Renforcement global, à ton rythme

### Pour qui ?
Ce cours s'adresse à tout le monde : de la personne qui souhaite se remettre en
mouvement au sportif confirmé. Adapté à différents niveaux, il permet à chacun
de progresser en sécurité grâce à des exercices de renforcement fonctionnel
variés.

### Pourquoi ce programme ?
BackOnTrack est pensé comme un entraînement complet et accessible. En groupe de
5 participants maximum, tu bénéficies d'un coaching attentif qui s'adapte à ton
rythme et à tes besoins. L'objectif : améliorer ta force, ta mobilité et ton
énergie au quotidien, tout en profitant de la dynamique d'un collectif motivant.

### Recommandation santé
L'OMS recommande au moins deux séances de renforcement musculaire par semaine
pour rester en bonne santé.

---

## Boxing

**Définition courte** (`description`) :
Technique, cardio et renforcement

### Pour qui ?
Ce cours de boxe est ouvert à une grande variété de profils : tous ceux qui
souhaitent améliorer leur condition physique, apprendre à se défendre et
développer leur mental, tout en s'amusant et en se défoulant.

### Pourquoi ce programme ?
Tu viens découvrir les bases de la boxe dans un environnement bienveillant.
Débutant ou expert, le coach s'adapte pour te challenger.

### Recommandation santé
L'OMS recommande aux adultes au moins 150 minutes d'activité physique modérée
par semaine pour prévenir les maladies cardiovasculaires.

---

## CrossTraining

**Définition courte** (`description`) :
Force, cardio et mouvements fonctionnels

### Pour qui ?
Le CrossTraining s'adresse à tous ceux qui veulent bouger différemment :
débutant ou confirmé, chacun avance à son rythme et selon ses ambitions. Un
entraînement complet et ultra dynamique, où tu découvres la puissance du
renforcement, de la mobilité et du cardio dans une ambiance bienveillante axée
sur la progression technique et le mouvement fonctionnel.

### Pourquoi ce programme ?
Encadré par des coachs passionnés, le CrossTraining propose des exercices
adaptés à chaque profil, y compris en cas de douleurs ou de limitations. Tu
gagnes en force, en cardio et en mobilité, tout en évitant la monotonie : chaque
séance t'apporte plus d'assurance et d'efficacité au quotidien.

---

## Ladies

**Définition courte** (`description`) :
Renforcement global & cardio, entre femmes

### Pour qui ?
Ce cours est conçu pour toutes les femmes désireuses de reprendre le sport ou
d'aller plus loin, quel que soit leur niveau. Débutantes, vous trouvez ici un
espace doux où (re)commencer, sans pression ni jugement. Déjà active ou envie de
progresser ? Le programme s'adapte à chacune, pour renforcer et tonifier tout le
corps dans une énergie exclusivement féminine.

### Pourquoi ce programme ?
Ladies, c'est ton booster de confiance : on cible les fessiers, la sangle
abdominale et les bras à travers des exercices simples, efficaces et variés.
Chaque séance te pousse à te dépasser à ton rythme, dans une ambiance motivante
et bienveillante.

### Recommandation santé
Une à trois fois par semaine, selon ton envie et ton emploi du temps. Pour
pimenter ta routine, combine ce cours avec des activités plus intenses.

---

## Personal Training

> ⚠️ **À écrire.** Aucune page WordPress ne correspond directement. Une page
> « cours-semi-prives » existe et parle peut-être de ce format, mais je ne l'ai
> pas reprise sans confirmation : un cours particulier et un cours semi-privé
> ne sont pas la même offre, et le prix non plus.

---

## Mobility & Stretch

**Définition courte** (`description`) :
Mobilité, tronc & prévention des douleurs

### Pour qui ?
Cette séance s'adresse à qui veut retrouver de l'amplitude, relâcher les
tensions et bouger plus librement. C'est le complément d'un corps qui
s'entraîne — comme de celui qui reste assis toute la journée.

### Pourquoi ce programme ?
Mobilité articulaire, étirements et respiration. La séance combine renforcement
et mobilité par une méthode douce, centrée sur le tronc — colonne vertébrale et
bassin — pour maintenir une amplitude de mouvement fonctionnelle et sans
douleur, avec de la relaxation en fin de séance.

---

## Personal Training

**Définition courte** (`description`) :
Coach privé, séance sur-mesure

> ⚠️ **Description longue : à écrire.** Le site n'a aucune page pour ce format —
> il n'apparaît que dans les tarifs (75 € la séance, packs de 5 et 10). La page
> « cours-semi-prives » ne le décrit pas : elle porte sur les séances en petit
> groupe, ce qui est une autre offre. Écrire une description longue ici
> reviendrait à inventer ce que le studio n'a jamais écrit.

---

## Adolescent — cours absent des deux bases

> ℹ️ Le site décrit un cours « Adolescent » (12-17 ans, groupes de 4 maximum,
> séparés en 12/14 et 15/17) qui n'existe ni sur bot3 ni sur bot-ops. Signalé
> pour information : rien à écrire tant que le type de cours n'est pas créé.

**Définition courte, si créé** :
Renforcement, souplesse, agilité — 12 à 17 ans

### Pour qui ?
Cours dédié aux adolescents, de 12 à 17 ans, en petits groupes de 4 maximum
séparés en deux catégories : 12-14 ans et 15-17 ans.

### Pourquoi ce programme ?
Apprendre à connaître son corps et à le rendre plus fort, par le renforcement,
la mobilité et l'agilité.

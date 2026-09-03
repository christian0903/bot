# Descriptions des cours

> **État au 2026-09-03 : brouillon, rien n'est encore écrit en base.**
> Quatre descriptions sur six sont prêtes ; deux attendent une décision des
> coachs, signalées plus bas.

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

> ⚠️ **À confirmer.** Ce cours n'existe qu'en production ; le test a « Posture »,
> absent de la production. S'il s'agit du même cours renommé, le texte ci-dessous
> (page WordPress « Posture ») convient — il parle bien de mobilité articulaire
> et se termine sur des étirements. Si c'est un cours différent, il est à écrire.

### Pour qui ?
Cette séance est recommandée si tu souhaites améliorer ta posture au quotidien,
notamment en raison d'un travail de bureau, d'un mode de vie sédentaire ou de
douleurs cervicales, thoraciques ou lombaires. Elle s'adresse également à ceux
qui veulent gagner en mobilité articulaire, et reste accessible à tous les
niveaux.

### Pourquoi ce programme ?
Ce programme combine des exercices de renforcement et de mobilité, basés sur une
méthode douce, ciblant principalement le tronc — colonne vertébrale et bassin.
L'objectif est de maintenir une amplitude de mouvement fonctionnelle et sans
douleur, avec des exercices de relaxation en fin de séance.

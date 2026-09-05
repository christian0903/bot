# Le prix à payer pour être sur l'App Store

> Note destinée aux coachs. Elle explique ce que la publication nous coûte, et
> pourquoi nous avons désormais besoin d'un suivi des demandes.
>
> **À transmettre par courriel** — le texte prêt à envoyer est à la fin.

---

Publier sur l'App Store est certes très attractif, mais cela comporte
également pas mal d'inconvénients, que je vais vous décrire ici. **Le principal
concerne le fait que nous ne pourrons plus produire de changements aussi
rapidement qu'auparavant.**

Revenons d'abord sur ce qui s'est passé jusqu'ici.

## Ce qui s'est passé jusqu'ici

Depuis le début du projet, l'application a changé **145 fois**. Ce n'est pas une
image : chaque modification porte un numéro, et nous en sommes à la version
**3.145**. Une demande formulée le matin pouvait être en ligne l'après-midi.

Cette vitesse tenait à une raison simple : l'application vivait **sur le web**.
Modifier un site, c'est déposer les nouveaux fichiers sur le serveur — les
personnes qui l'ouvrent ensuite voient la nouvelle version. Personne à
prévenir, personne à attendre.

## Ce qui a changé le 4 septembre

Depuis cette date, l'application existe **sur l'App Store**. Elle s'installe
depuis le téléphone comme n'importe quelle autre, elle a son icône sur l'écran
d'accueil, elle est visible de tous. Pour un membre, c'est plus simple et plus
crédible qu'une adresse à retenir dans un navigateur. C'est là tout
l'attrait — et il est réel.

## Le prix à payer

Mais publier sur un magasin d'applications, ce n'est pas déposer un fichier
quelque part. C'est **confier notre application à Apple**, qui décide de ce qui
paraît et quand. Cela se paie de quatre façons, et aucune n'est négociable.

Les trois premières se subissent. La quatrième, elle, se travaille — et c'est
celle qui pèse le plus sur notre rythme.

### 1. Le temps — le vrai coût

**Apple examine chaque nouvelle version avant de la laisser paraître.** Comptez
24 à 48 heures d'examen, auxquelles s'ajoutent la fabrication, l'envoi et le
téléchargement sur chaque téléphone.

Une correction qui prenait **quelques minutes** en prend maintenant **une à
deux semaines**. C'est le point le plus important de cette note.

### 2. Le droit de refus

Apple peut dire non. **Il l'a déjà fait deux fois** pour notre application,
pour des motifs qu'il a fallu comprendre et corriger avant de resoumettre.
Chaque refus fait repartir le délai à zéro.

Nous ne choisissons ni les règles, ni le moment où elles s'appliquent.

### 3. La perte de maîtrise sur la mise à jour

Même une fois publiée, **la nouvelle version ne s'installe pas d'elle-même chez
tout le monde.** Apple prévient les téléphones ; ensuite chacun se met à jour
selon ses réglages et sa connexion. Pendant plusieurs jours, nous n'aurons pas
tous la même version — et donc pas tous le même écran sous les yeux.

### 4. L'argent, et surtout le travail qu'il ne paie pas

**L'abonnement est la part facile.** Un compte développeur Apple coûte
**99 $ par an**, à renouveler faute de quoi l'application disparaît de l'App
Store. Google demande **25 $, une seule fois**. Quelques dizaines d'euros par
an : ce n'est pas là que le bât blesse.

**Le vrai coût, c'est le travail que cela m'ajoute** — et il revient à chaque
publication, indéfiniment.

Sur le site, mettre à jour tenait en une commande. Publier une version sur
l'App Store demande, à chaque fois :

- **fabriquer l'enveloppe iPhone** et vérifier qu'elle embarque la bonne
  version — l'erreur ne se voit pas avant d'être chez Apple ;
- **rédiger les notes de version**, obligatoires, ainsi que les remarques
  destinées à l'examinateur ;
- **suivre la soumission**, guetter la réponse d'Apple, et **traiter un refus**
  s'il arrive : comprendre le motif, corriger, resoumettre, réattendre ;
- **distribuer aux testeurs**, avec ce qu'il faut regarder ;
- **publier au bon moment**, la version approuvée restant invisible tant que je
  ne clique pas ;
- **maintenir la fiche App Store** — captures d'écran, description, politique
  de confidentialité, conformité — que je dois reprendre à chaque changement
  d'écran un peu visible.

À quoi s'ajoute ce qui ne se voit jamais : suivre les règles d'Apple, qui
changent sans prévenir, et refaire les enveloppes quand une nouvelle version
d'iOS l'exige, **même si notre application, elle, n'a pas bougé**.

Comptez **une demi-journée de travail par publication**, sans compter les
refus. C'est autant de temps qui ne va pas à développer ce que vous demandez.

**C'est la raison de fond du ralentissement.** Ce n'est pas seulement qu'Apple
prend 24 à 48 heures : c'est qu'une publication coûte assez cher en travail
pour qu'on ne puisse plus en faire une par jour. **Il faudra grouper les
modifications** et publier par lots, là où chaque correction partait seule.

### Ce qui ne change pas

**Le site reste libre et immédiat.** L'application ouverte dans le navigateur
n'appartient qu'à nous : pas d'examen, pas d'attente, pas de règles
extérieures. C'est notre soupape.

---

## Les deux parcours, côte à côte

### Avant — le parcours web, en quelques minutes

```
Vous demandez
      │
      ▼
Je développe
      │
      ▼
Je dépose sur JAG  ──────►  Vous testez
(le site d'essai)                │
                                 ▼
                          Je passe en production
                                 │
                                 ▼
                     C'est en ligne pour tout le monde

        ⏱  quelques minutes entre le test et la mise en ligne
```

**Ce parcours existe toujours.** Il reste le plus rapide, et c'est encore lui
qui sert pour l'application ouverte dans le navigateur.

### Maintenant — le parcours App Store, en une à deux semaines

```
Vous demandez
      │
      ▼
Je développe
      │
      ▼
Je dépose sur JAG  ──────►  Vous testez
(le site d'essai)                │
                                 ▼
                          Je passe en production          ← le web s'arrête ici
                                 │
                                 ▼
                   ┌─────────────────────────────┐
                   │   ET ENSUITE, POUR L'APP    │
                   └─────────────────────────────┘
                                 │
                                 ▼
              Je fabrique une « enveloppe » iPhone
                                 │
                                 ▼
                    Je l'envoie chez Apple
                                 │
                                 ▼
                Apple vérifie qu'elle fonctionne
                                 │
                                 ▼
              Vous l'essayez sur votre téléphone
                        (par TestFlight)
                                 │
                                 ▼
                   Je la soumets pour publication
                                 │
                                 ▼
                        Apple l'examine
                                 │
                                 ▼
                      Je clique « Publier »
                                 │
                                 ▼
             Chacun reçoit la mise à jour, à son rythme
```

---

## Le détail des étapes, et ce qu'elles coûtent en temps

| # | Étape | Qui | Délai |
|---|---|---|---|
| 1 | Vous formulez la demande | Vous | — |
| 2 | Je développe | Moi | selon la demande |
| 3 | Je dépose sur **JAG** (site d'essai) | Moi | quelques minutes |
| 4 | **Vous testez sur JAG** | Vous | à votre rythme |
| 5 | Je passe en **production** sur `app.` | Moi | quelques minutes |
| 6 | Je fabrique l'enveloppe iPhone et l'envoie chez Apple | Moi | ~1 heure |
| 7 | Apple vérifie l'envoi (traitement automatique) | Apple | **10 à 30 min** |
| 8 | Vous l'essayez sur votre téléphone (TestFlight) | Vous | à votre rythme |
| 9 | Je soumets pour publication | Moi | quelques minutes |
| 10 | **Apple examine la version** | Apple | **24 à 48 h** en général |
| 11 | Je publie | Moi | immédiat |
| 12 | Votre téléphone télécharge la mise à jour | Votre téléphone | **de quelques heures à plusieurs jours** |

**Total réaliste : une à deux semaines** entre votre demande et l'application à
jour sur le téléphone de tout le monde.

### Où se cache le temps

Les étapes 1 à 5 sont les nôtres : elles vont aussi vite qu'avant.

**Ce sont les étapes 6 à 12 qui coûtent** — et sur les sept, quatre ne
dépendent pas de nous : la vérification d'Apple, son examen, son droit de
refus, et le rythme auquel chaque téléphone télécharge.

En cas d'urgence, la voie courte reste `app.backontrackstudio.be` dans le
navigateur : même service, mise à jour immédiate.

---

## Et Android ?

**Rien n'est encore configuré.** L'application n'existe pas sur le Play Store
de Google, et il n'y a pas de date.

Quand elle y sera, **le prix sera le même par nature** : une enveloppe à
fabriquer, un envoi, un examen que Google mène à sa guise, une publication, et
des téléphones qui se mettent à jour chacun à son rythme. Google est réputé un
peu plus rapide, mais **ce ne sera pas instantané non plus**.

Et cela veut dire deux magasins à satisfaire au lieu d'un : deux envois, deux
examens, deux calendriers qui ne coïncideront pas forcément.

Nous ajouterons ces étapes au suivi le moment venu.

---

## Ce que cela implique pour nous

Tant que tout partait en quelques minutes, on pouvait se dire les choses de
vive voix et les voir faites le lendemain. Ce n'est plus vrai : entre le moment
où vous demandez et celui où vous voyez le résultat sur votre téléphone, il se
passe assez de temps pour qu'on oublie qui avait demandé quoi, et où ça en est.

D'où **un suivi des demandes**, dans un tableau que nous partagerons.

Il sert à trois choses :

1. **Ne rien perdre.** Une demande écrite ne se dilue pas dans une
   conversation.
2. **Choisir ensemble.** Une demande avance quand au moins deux d'entre vous la
   portent — ce qui distingue un besoin partagé d'une préférence personnelle.
3. **Voir où on en est.** Sans avoir à me le demander : proposé, accepté, en
   cours, développé, en production.
4. **Composer les lots.** Puisqu'une publication coûte une demi-journée, elle
   emportera plusieurs modifications à la fois. Le tableau sert à décider
   lesquelles partent ensemble — et à voir ce qui attend le prochain envoi.

Le tableau sera sur **Notion**, puisque vous vous en servez déjà. Je vous
proposerai un fonctionnement ; il n'est pas gravé dans le marbre, et nous
l'ajusterons à l'usage.

---

# Le courriel à envoyer

> À copier tel quel. Objet suggéré : **« L'application est sur l'App Store —
> et ce que ça nous coûte »**
>
> **Markdown.** MailMate rédige en Markdown : le texte ci-dessous se colle tel
> quel, gras et listes compris. Les deux schémas sont dans des blocs de code
> (` ``` `), ce qui les fait rendre en police à chasse fixe — c'est ce qui tient
> l'alignement des flèches. Ne pas retirer ces blocs : en police
> proportionnelle, les schémas se déformeraient.

Bonjour à tous,

L'application est disponible sur l'App Store depuis le 4 septembre. Elle
s'installe maintenant comme n'importe quelle autre, avec son icône sur l'écran
d'accueil. C'est une étape importante, et pour un membre c'est bien plus simple
qu'une adresse à retenir.

Publier sur l'App Store est certes très attractif, mais cela comporte aussi pas
mal d'inconvénients, que je voudrais vous décrire. **Le principal est que nous
ne pourrons plus produire de changements aussi rapidement qu'auparavant.**

Revenons d'abord sur ce qui s'est passé jusqu'ici.

**On allait très vite.** L'application a changé 145 fois depuis le début du
projet — nous en sommes à la version 3.145. Quand l'un de vous
signalait quelque chose le matin, c'était souvent corrigé l'après-midi.
C'était possible parce que l'application vivait sur le web : je déposais la
modification sur le serveur, et vous l'aviez à l'ouverture suivante.

**Publier sur l'App Store, c'est confier notre application à Apple**, qui
décide de ce qui paraît et quand. Cela se paie de quatre façons.

**1. Le temps, et c'est le vrai prix.** Apple examine chaque nouvelle version
avant de la laisser paraître : 24 à 48 heures en général. Avec la fabrication,
l'envoi et le téléchargement sur vos téléphones, comptez **une à deux semaines**
entre votre demande et l'application à jour chez tout le monde — là où c'était
quelques minutes.

Voici les deux parcours, côte à côte.

```
AVANT — le site                    MAINTENANT — l'App Store

Vous demandez                      Vous demandez
      │                                  │
      ▼                                  ▼
Je développe                       Je développe
      │                                  │
      ▼                                  ▼
Je dépose sur JAG                  Je dépose sur JAG
      │                                  │
      ▼                                  ▼
Vous testez                        Vous testez
      │                                  │
      ▼                                  ▼
Je passe en production             Je passe en production
      │                                  │
      ▼                                  ▼
EN LIGNE POUR TOUS                 Je fabrique la version iPhone
                                         │
  ⏱ quelques minutes                     ▼
                                   Je l'envoie chez Apple
                                         │
                                         ▼
                                   Apple vérifie l'envoi
                                         │
                                         ▼
                                   Vous l'essayez (TestFlight)
                                         │
                                         ▼
                                   Je soumets pour publication
                                         │
                                         ▼
                                   APPLE EXAMINE  ← 24 à 48 h
                                         │           et il peut refuser
                                         ▼
                                   Je publie
                                         │
                                         ▼
                                   Votre téléphone se met à jour

                                     ⏱ une à deux semaines
```

Le détail, avec les délais de chaque étape :

**AVANT — le parcours du site, en quelques minutes**

1. Vous demandez
2. Je développe
3. Je dépose sur JAG, le site d'essai
4. **Vous testez sur JAG**
5. Je passe en production → **c'est en ligne pour tout le monde**

Ce parcours existe toujours : c'est celui de l'application ouverte dans le
navigateur.

**MAINTENANT — le parcours de l'App Store, en une à deux semaines**

Les cinq premières étapes sont les mêmes :

1. Vous demandez
2. Je développe
3. Je dépose sur JAG, le site d'essai
4. **Vous testez sur JAG**
5. Je passe en production → *le site est à jour, mais pas l'application*

Et c'est seulement là que commence le chemin vers votre téléphone :

6. Je fabrique une version iPhone et je l'envoie chez Apple — *environ 1 h*
7. Apple vérifie l'envoi — *10 à 30 min*
8. **Vous l'essayez sur votre téléphone**, via TestFlight
9. Je la soumets pour publication
10. **Apple l'examine — 24 à 48 h**, et il peut refuser
11. Je publie
12. Votre téléphone télécharge la mise à jour — *de quelques heures à
    plusieurs jours*

Sur ces sept étapes ajoutées, **quatre ne dépendent pas de nous** : la
vérification d'Apple, son examen, son droit de refus, et le rythme auquel
chaque téléphone se met à jour.

**2. Apple peut dire non.** C'est l'étape 10 ci-dessus, et il l'a déjà fait
deux fois pour notre application. Il faut alors comprendre le motif, corriger,
et resoumettre : le délai repart à zéro.

**3. Nous ne maîtrisons plus la mise à jour.** Une fois publiée, la nouvelle
version ne s'installe pas d'elle-même chez tout le monde : chaque téléphone se
met à jour selon ses réglages et sa connexion. Pendant plusieurs jours, **nous
n'aurons pas tous la même version sous les yeux** — c'est normal, ne vous en
inquiétez pas.

**4. L'argent, et surtout le travail que cela m'ajoute.** L'abonnement est la
part facile : 99 $ par an chez Apple, à renouveler faute de quoi l'application
disparaît, et 25 $ une seule fois chez Google.

Le vrai coût est ailleurs. Là où mettre à jour le site tenait en une commande,
chaque publication sur l'App Store me demande de fabriquer l'enveloppe iPhone,
d'écrire les notes de version, de suivre la soumission, de traiter un refus
s'il arrive, de distribuer aux testeurs, de publier au bon moment, et de tenir
à jour la fiche de l'application — captures d'écran comprises. Sans compter les
règles d'Apple qui changent sans prévenir, et les enveloppes à refaire quand
une nouvelle version d'iOS l'exige, même si notre application n'a pas bougé.

Comptez une demi-journée de travail par publication, refus non compris.

**C'est la vraie raison du ralentissement** : ce n'est pas seulement qu'Apple
prend 24 à 48 heures, c'est qu'une publication coûte assez cher pour qu'on ne
puisse plus en faire une par jour. Concrètement, **je regrouperai les
modifications** et publierai par lots, là où chaque correction partait seule.

**Ce qui ne change pas** : le site reste libre et immédiat. En ouvrant
`app.backontrackstudio.be` dans votre navigateur, vous avez toujours la
dernière version, sans attendre Apple. En cas de correction urgente, c'est par
là que ça arrivera en premier.

Pour Android, rien n'est encore en place — l'application n'est pas sur le Play
Store et je n'ai pas de date. Le prix sera de même nature, et cela fera deux
magasins à satisfaire au lieu d'un.

**Ce que je vous propose.** Avec des délais pareils, on ne peut plus se
contenter de se dire les choses en passant : on oublierait qui a demandé quoi,
et où ça en est. J'ai préparé un tableau de suivi sur **Notion**, puisque vous
l'utilisez déjà. Vous y écrirez vos demandes, vous appuierez celles de vos
collègues — une demande avance quand deux d'entre vous au moins la portent — et
vous verrez à tout moment où chacune en est.

Je vous l'envoie séparément avec le mode d'emploi. C'est une proposition : si
quelque chose ne va pas dans la façon dont je l'ai pensé, dites-le, on
l'ajustera.

À bientôt,
Christian

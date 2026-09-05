# Suivre les demandes des coachs — la base Notion

> Comment une idée de coach devient une version installée sur les téléphones.
> Ce document décrit le dispositif ; la page destinée aux coachs, plus courte,
> est à la fin.
>
> **La base existe depuis le 2026-09-05** — prototype dans l'espace Notion
> privé de Christian, à porter vers l'espace des coachs une fois éprouvé.

Notion a été retenu pour une seule raison, mais elle est décisive : **les
coachs s'en servent déjà**. Un outil qu'il faut apprendre ne filtre rien — les
demandes reviendraient par message, et le dispositif serait mort en trois
semaines.

Trello a été réexaminé le 2026-09-05, sur l'argument du Kanban. Écarté : Notion
a déjà la vue tableau qu'on lui cherchait, et Trello n'aurait pas les champs
typés — trois colonnes de test nominatives, une estimation, des dates de
publication — qui font le reste du dispositif. Ses Custom Fields sont un
Power-Up payant, et une carte ne porte pas de vues multiples.

---

## Ce que le dispositif doit obtenir

**Filtrer.** Une demande venue d'un seul coach ne doit pas déclencher un
développement. Il faut qu'au moins un autre l'appuie — c'est ce qui distingue
un besoin partagé d'une préférence personnelle.

**Coûter peu de temps.** Le suivi doit se tenir en déplaçant une carte dans un
tableau, pas en rédigeant des comptes rendus.

**Montrer où en est chaque chose.** Les coachs doivent voir sans demander ce
qui est proposé, adopté, en cours, à tester, et livré — jusqu'à savoir si la
version qui porte leur demande est arrivée sur leur téléphone.

---

## Une seule base de données

Tout tient dans **une base Notion**, affichée de plusieurs façons. Ne pas en
créer plusieurs : les demandes se perdraient entre elles.

### Les colonnes, dans l'ordre du parcours

| Propriété | Type | À quoi elle sert |
|---|---|---|
| **Demande** | Titre | Une phrase qui dit le besoin, pas la solution |
| **Étape** | Sélection | Où en est la demande — voir le parcours ci-dessous |
| **Demandé par** | Texte | Qui a soulevé le besoin |
| **Appuyé par** | Multi-sélection | **Le cœur du dispositif** — voir plus bas |
| **Pourquoi** | Texte | Ce que ça change au quotidien, en une ou deux phrases |
| **Temps estimé** | Texte | La charge de développement pressentie (`2 h`, `1 j`) |
| **Développé le** | Date + heure | Quand la modification est partie sur JAG |
| **Joan**, **Gauthier**, **Anselme** | Date | La date à laquelle chacun a éprouvé sur JAG |
| **Version** | Texte | La version du dépôt qui la livre : `3.142.0` |
| **Build iOS** | Nombre | `CURRENT_PROJECT_VERSION` de l'envoi qui l'embarque |
| **Version App Store** | Texte | Le numéro vu du public : `1.0`, `1.1` |
| **Soumis le** | Date | L'envoi du build chez Apple |
| **iPhone** | Sélection | Où en est la publication sur l'App Store |
| **Android** | Sélection | Où en est la publication sur le Play Store |
| **En ligne le** | Date | La publication effective sur l'App Store |
| **Ouvert le** | Création | Automatique |

> **`Appuyé par` matérialise le consensus.** Un coach qui trouve la demande
> utile s'y ajoute lui-même. Deux noms visibles = la demande peut avancer.
> Notion ne compte rien tout seul, mais deux noms se voient d'un coup d'œil, et
> le coach qui s'ajoute fait un geste conscient — plus engageant qu'un
> « j'aime ».
>
> C'est une **multi-sélection** et non une propriété « Personne », faute de
> comptes Notion pour les coachs dans l'espace privé du prototype. **À
> convertir en type Personne au portage** : c'est le seul point du dispositif
> qui ne se transpose pas tel quel.

### Trois colonnes de test, une par coach

`Joan`, `Gauthier` et `Anselme` portent chacune une **date**, pas une case à
cocher : celle du jour où ce coach a éprouvé la modification sur JAG.

Une seule colonne « Testé par » avait été posée d'abord, puis remplacée le
2026-09-05. Trois colonnes nominatives disent en un coup d'œil **qui a déjà
regardé et qui doit encore le faire** — ce qu'une liste de noms dans une seule
cellule ne montre pas.

Rien ne passe en production tant qu'aucune date n'y figure.

---

## Le parcours, en sept étapes

La propriété **Étape** ne prend que ces valeurs :

| Étape | Ce qu'elle signifie | Qui la fait avancer |
|---|---|---|
| **Proposé** | La demande existe, elle attend l'avis des autres | Le coach qui la crée |
| **Adopté** | Au moins deux coachs la portent | Christian, quand `Appuyé par` contient 2 noms |
| **En cours** | En développement | Christian |
| **À tester sur JAG** | Livrée sur `jag.backontrackstudio.be` | Christian |
| **En production** | Validée sur JAG, passée sur `app.` | Christian |
| **Déjà fait** | Livrée **avant** la mise en place de ce suivi | Christian |
| **Écarté** | Ne se fera pas | Christian |

**« Déjà fait » n'est pas « En production ».** La distinction est volontaire :
*En production* marque ce qui a traversé le parcours complet, appuis et tests
compris ; *Déjà fait* recueille ce qui était livré avant que la base existe. Le
tableau montre ainsi, dès l'ouverture, ce qui est acquis à gauche du travail
restant.

**« Écarté » vaut mieux qu'une suppression.** Une demande refusée sans trace
revient tous les trois mois.

> **Une seule règle à tenir** : rien ne passe de *Proposé* à *Adopté* sans deux
> noms dans `Appuyé par`. Notion ne l'imposera pas — c'est une discipline, pas
> un verrou. Mais elle est visible de tous, et c'est ce qui la rend tenable :
> un coach voit que sa demande attend, et va en parler à ses collègues plutôt
> qu'à vous.

---

## Le suivi de la publication sur les téléphones

**Le point qui justifie tout ce bloc : « en production » ne veut pas dire « sur
les téléphones ».** Une modification déployée sur `app.` est visible
immédiatement de qui ouvre le site ; sur mobile, elle attend un build, un
examen, et une publication qui peut rester en attente. Les deux mondes avancent
à des rythmes différents, et l'écart se compte en jours ou en semaines.

Au 2026-09-05, l'écart est réel : l'agenda (3.130.0) et la liste des inscrits
(3.128.0) sont **en production sur `app.`**, mais l'App Store en est encore à
la **1.0 (build 7, code 3.123.0)**. Les membres qui ont l'application depuis
l'App Store ne les ont pas ; seuls les testeurs TestFlight les voient.

D'où **deux colonnes de statut, une par plateforme** — Android arrivant après
iOS, la même demande peut être en ligne sur un magasin et pas sur l'autre.

**`iPhone`** prend sept valeurs :

| Valeur | Ce qu'elle dit |
|---|---|
| **Pas concerné** | Modification serveur ou base : rien ne passe par Apple |
| **Pas encore soumis** | Livrée sur `app.`, aucun build ne l'embarque encore |
| **TestFlight** | Dans un build distribué aux testeurs, pas au public |
| **En attente d'examen** | Soumise, Apple ne s'est pas prononcé |
| **Refusé** | Apple a rejeté — voir `docs/apple/` |
| **Prête pour la publication** | **Approuvée mais invisible** |
| **En ligne** | Sur l'App Store, installable par les membres |

**`Android`** en prend six, le Play Store n'ayant pas d'équivalent de la
publication manuelle différée :

| Valeur | Ce qu'elle dit |
|---|---|
| **Pas concerné** | Modification serveur ou base |
| **Pas encore soumis** | Aucun build ne l'embarque encore |
| **Test interne** | Distribuée aux testeurs, pas au public |
| **En cours d'examen** | Soumise, Google ne s'est pas prononcé |
| **Refusé** | Google a rejeté |
| **En ligne** | Sur le Play Store |

### Une version acceptée n'arrive pas seule sur les téléphones

Apple **notifie** l'App Store d'une nouvelle version ; c'est le réglage du
téléphone qui décide de la suite. « Mises à jour automatiques des apps » est
actif par défaut sur iOS, mais chacun peut le couper, et même actif il attend
en général le Wi-Fi et la charge : le déploiement s'étale sur plusieurs jours.
Un membre qui l'a coupé ne verra rien tant qu'il ne va pas chercher la mise à
jour lui-même.

**Conséquence pour le suivi** : `En ligne` veut dire « disponible », pas
« installée chez tout le monde ». Ne jamais supposer qu'un correctif publié est
partout.

**La PWA échappe à cela.** `app.backontrackstudio.be`, installée depuis l'écran
d'accueil, sert le même code et se met à jour au rechargement — sans Apple ni
délai. Pour un correctif urgent, c'est la voie courte : l'App Store n'a pas de
procédure sous 24 h. `capacitor.config.ts` porte d'ailleurs, en commentaire, la
possibilité de faire charger à l'application native l'URL de production
directement — l'enveloppe se mettrait alors à jour comme le site, sans repasser
par les stores.

> ⚠️ **« Prête pour la publication » est le piège du 2026-09-03.** La version
> 1.0 avait été approuvée par Apple à 04:49 et n'était visible de personne : la
> sortie était réglée en **manuelle**, et rien ne le signalait. Approuvé ne
> veut pas dire en ligne. D'où deux valeurs distinctes, et une date `En ligne
> le` séparée de `Soumis le`.

**Trois numéros à ne pas confondre**, tous présents dans la base :

- **`Version`** — la version du dépôt (`3.130.0`), celle de `package.json` et
  des étiquettes git ;
- **`Build iOS`** — `CURRENT_PROJECT_VERSION`, qui **ne redescend jamais** :
  Apple refuse deux envois portant le même numéro ;
- **`Version App Store`** — le numéro vu du public (`1.0`), **indépendant** des
  deux autres.

La procédure complète d'envoi vit dans `mettre-a-jour-app-store.md`, qui reste
la source de vérité ; la base n'en retient que l'état.

### La limite assumée

Le build est un attribut de la **livraison**, pas de la **demande** : un même
build en embarque plusieurs, et le numéro se ressaisit sur chaque ligne
concernée. Une seconde base « Versions » liée par relation l'éviterait — mais
elle romprait la règle d'une base unique, et le coût de la double saisie reste
inférieur à celui de demandes qui se perdent entre deux tables. À reconsidérer
si la ressaisie devient pénible.

---

## Les quatre vues

Une même base, quatre façons de la regarder.

**1. « Le tableau » — vue Tableau (*Board*), groupée par `Étape`**

La vue principale. Les étapes se lisent de gauche à droite comme un parcours ;
faire glisser une carte d'une colonne à l'autre suffit à la faire avancer.
C'est le geste que Christian répétera le plus — il doit rester le plus simple.

**2. « À valider par vous » — vue Liste, filtrée sur `Étape = À tester sur JAG`**

Ce que les coachs doivent éprouver, avec les trois colonnes de dates. C'est la
vue à leur envoyer quand une livraison part sur JAG.

**3. « Par version » — vue Tableau, groupée par `Version`**

L'historique côté dépôt. Ce que chaque version a apporté, dans l'ordre.

**4. « Publication App Store » — vue Tableau (*Board*), groupée par `iPhone`**

Ce qui attend chez Apple, et à quel stade. Triée par build. Une vue symétrique
groupée par `Android` sera à créer quand l'application Android existera.

---

## Comment cela s'articule avec le dépôt

`docs/nouveautes.md` reste la source de vérité de ce qui est livré : il est
versionné, il accompagne le code, et il survivra à Notion si Notion est
abandonné un jour.

**Notion sert à décider, le dépôt à livrer.** Concrètement :

- une demande passe en *En production* → sa propriété `Version` reçoit le
  numéro (`3.142.0`) ;
- `docs/nouveautes.md` reçoit la même chose, dite du point de vue du membre.

C'est une double saisie, assumée : dix secondes, et elle évite de faire
dépendre l'historique du projet d'un outil externe.

---

## Ce que ce dispositif ne fait pas

**Il n'empêche rien.** Notion ne bloquera pas un passage en *Adopté* sans les
deux appuis, ni une mise en production sans date de test. Si la règle est
contournée au bout de deux mois, ce n'est pas l'outil qu'il faut changer :
c'est que le filtre n'était pas le vrai besoin.

**Il ne remplace pas la conversation.** Deux noms dans `Appuyé par` disent
qu'un besoin est partagé, pas qu'on sait quoi faire. La solution se discute
ensuite.

**Il ne dit rien du délai.** Une demande adoptée n'a pas de date d'échéance.
`Temps estimé` dit une charge, pas une promesse. En ajouter une créerait une
attente qu'on ne pourrait pas tenir ; l'ordre du tableau suffit à dire ce qui
vient ensuite.

**Il ne se remplit pas tout seul.** Aucune synchronisation entre le dépôt et
Notion : `Version`, `Build iOS` et les statuts se saisissent à la main.

---

## Ce qui reste à faire

- **Porter la base vers l'espace Notion des coachs**, une fois le prototype
  éprouvé. Convertir alors `Appuyé par` en propriété **Personne**.
- **Réordonner les colonnes** dans l'interface : l'API Notion les ajoute
  toujours en fin de table, sans pouvoir choisir la position.
- **Vérifier qu'il ne reste qu'une vue « À valider par vous »** : une seconde a
  été créée le 2026-09-05 pour y ajouter les colonnes de test, l'API ne sachant
  pas reconfigurer une vue existante. La première est à supprimer si elle est
  encore là.

---

# La page à donner aux coachs

> À recopier dans une page Notion placée **au-dessus de la base**, pour qu'ils
> la lisent avant de s'en servir. C'est ce qui est en place au 2026-09-05.

## Proposer une amélioration de l'application

Vous voyez tous les jours ce qui manque ou ce qui gêne. Cette base sert à le
dire, et à suivre ce que ça devient.

### Pour demander quelque chose

Ajoutez une ligne. Trois choses à remplir, ça prend deux minutes :

- **Demande** — le besoin en une phrase. Dites ce qui vous gêne, pas comment le
  résoudre : « on ne voit pas qui a payé son pack » vaut mieux que « ajouter
  une colonne verte ».
- **Demandé par** — votre nom.
- **Pourquoi** — ce que ça change dans votre journée. C'est ce qui permet de
  comprendre l'urgence.

Laissez **Étape** sur *Proposé*. Le reste ne vous concerne pas.

### Pour appuyer la demande d'un collègue

**C'est le geste le plus important de tout le dispositif.**

Parcourez les demandes en *Proposé*. Quand l'une d'elles vous paraît utile,
ajoutez votre nom dans **Appuyé par**.

Une demande avance quand **deux coachs au moins** la portent. Ce n'est pas une
formalité : cela évite que l'application parte dans une direction voulue par
une seule personne, et cela dit clairement ce qui compte pour l'équipe.

Si personne n'appuie votre demande, ce n'est pas un refus — c'est que le besoin
n'est pas partagé. Parlez-en à vos collègues.

### Pour suivre ce qui se passe

Le tableau se lit de gauche à droite :

**Proposé** → **Adopté** (deux appuis) → **En cours** (en développement) →
**À tester sur JAG** → **En production**

### Quand une demande arrive en « À tester sur JAG »

C'est le moment où on a besoin de vous.

Ouvrez **`jag.backontrackstudio.be`** — le site avec le bandeau orange, où les
données sont fausses et où vous pouvez tout essayer sans conséquence. Vérifiez
que la modification fait bien ce que vous attendiez.

Quand c'est bon, **inscrivez la date du jour dans votre colonne** — `Joan`,
`Gauthier` ou `Anselme`. Chacun a la sienne : on voit ainsi d'un coup d'œil qui
a déjà éprouvé la modification et qui doit encore le faire.

Si quelque chose ne va pas, ne mettez pas de date : dites ce qui cloche, la
demande retourne en développement.

Tant qu'aucune date n'apparaît, rien ne passe en production.

> ⚠️ **JAG, pas l'application de votre téléphone.** Sur JAG les données sont
> inventées : essayez, cassez, recommencez. L'application de votre téléphone
> travaille sur les vrais membres — voir le guide TestFlight.

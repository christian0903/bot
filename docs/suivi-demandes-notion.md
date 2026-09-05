# Suivre les demandes des coachs — la base Notion

> Comment une idée de coach devient une version installée sur les téléphones.
> Ce document décrit le dispositif ; la page destinée aux coachs, plus courte,
> est à la fin.

Notion a été retenu pour une seule raison, mais elle est décisive : **les
coachs s'en servent déjà**. Un outil qu'il faut apprendre ne filtre rien — les
demandes reviendraient par message, et le dispositif serait mort en trois
semaines.

---

## Ce que le dispositif doit obtenir

**Filtrer.** Une demande venue d'un seul coach ne doit pas déclencher un
développement. Il faut qu'au moins un autre l'appuie — c'est ce qui distingue
un besoin partagé d'une préférence personnelle.

**Coûter peu de temps.** Le suivi doit se tenir en déplaçant une valeur dans
une liste, pas en rédigeant des comptes rendus.

**Montrer où en est chaque chose.** Les coachs doivent voir sans demander ce
qui est proposé, adopté, en cours, à tester, et livré.

---

## Une seule base de données

Tout tient dans **une base Notion**, affichée de plusieurs façons. Ne pas en
créer plusieurs : les demandes se perdraient entre elles.

### Les colonnes (« propriétés » dans Notion)

| Propriété | Type | À quoi elle sert |
|---|---|---|
| **Demande** | Titre | Une phrase qui dit le besoin, pas la solution |
| **Étape** | Sélection | Où en est la demande — voir le parcours ci-dessous |
| **Demandé par** | Personne | Qui a soulevé le besoin |
| **Appuyé par** | Personne *(plusieurs)* | **Le cœur du dispositif** — voir plus bas |
| **Pourquoi** | Texte | Ce que ça change au quotidien, en une ou deux phrases |
| **Version** | Texte | Remplie à la livraison : `3.142.0` |
| **Ouvert le** | Date | Automatique (« Date de création ») |

> **`Appuyé par` est une propriété « Personne » à choix multiple.** C'est elle
> qui matérialise le consensus : un coach qui trouve la demande utile s'y
> ajoute lui-même. Deux noms visibles = la demande peut avancer. Notion ne
> compte rien tout seul, mais deux noms se voient d'un coup d'œil, et le coach
> qui s'ajoute fait un geste conscient — plus engageant qu'un « j'aime ».

### Le parcours, en cinq étapes

La propriété **Étape** ne prend que ces valeurs, dans cet ordre :

| Étape | Ce qu'elle signifie | Qui la fait avancer |
|---|---|---|
| **Proposé** | La demande existe, elle attend l'avis des autres | Le coach qui la crée |
| **Adopté** | Au moins deux coachs la portent — elle entrera dans un développement | Christian, quand `Appuyé par` contient 2 noms |
| **En cours** | En développement | Christian |
| **À tester sur JAG** | Livrée sur `jag.backontrackstudio.be`, les coachs doivent l'éprouver | Christian |
| **En production** | Validée sur JAG, passée sur `app.` et dans l'application iPhone | Christian |

Une sixième valeur est utile : **Écarté**, pour ce qui ne se fera pas. Une
demande refusée sans trace revient tous les trois mois.

> **Une seule règle à tenir** : rien ne passe de *Proposé* à *Adopté* sans deux
> noms dans `Appuyé par`. Notion ne l'imposera pas — c'est une discipline, pas
> un verrou. Mais elle est visible de tous, et c'est ce qui la rend tenable :
> un coach voit que sa demande attend, et va en parler à ses collègues plutôt
> qu'à vous.

---

## Les trois vues à créer

Une même base, trois façons de la regarder. Dans Notion : bouton **+** à côté
du nom de la vue en haut.

**1. « Le tableau » — vue Tableau (*Board*), groupée par `Étape`**

La vue principale, celle qu'on ouvre par défaut. Cinq colonnes qu'on lit de
gauche à droite comme un parcours. Faire glisser une carte d'une colonne à
l'autre suffit à la faire avancer — c'est le geste qui doit rester le plus
simple, puisque c'est celui que Christian répétera.

**2. « À valider par vous » — vue Liste, filtrée sur `Étape = À tester sur JAG`**

Ce que les coachs doivent éprouver. C'est la vue à leur envoyer quand une
livraison part sur JAG : ils y trouvent la liste de ce qu'il faut regarder,
sans le reste.

**3. « Par version » — vue Tableau simple, groupée par `Version`**

L'historique. Ce que chaque version a apporté, dans l'ordre. Se remplit tout
seul si `Version` est renseignée au passage en production.

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
deux appuis. Si la règle est contournée au bout de deux mois, ce n'est pas
l'outil qu'il faut changer : c'est que le filtre n'était pas le vrai besoin.

**Il ne remplace pas la conversation.** Deux noms dans `Appuyé par` disent
qu'un besoin est partagé, pas qu'on sait quoi faire. La solution se discute
ensuite.

**Il ne dit rien du délai.** Une demande adoptée n'a pas de date. En ajouter
une créerait une attente qu'on ne pourrait pas tenir ; l'ordre du tableau
suffit à dire ce qui vient ensuite.

---

# La page à donner aux coachs

> À recopier dans une page Notion placée **au-dessus de la base**, pour qu'ils
> la lisent avant de s'en servir.

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
que la modification fait bien ce que vous attendiez, et dites-le.

Tant que vous n'avez pas validé, rien ne passe en production.

> ⚠️ **JAG, pas l'application de votre téléphone.** Sur JAG les données sont
> inventées : essayez, cassez, recommencez. L'application de votre téléphone
> travaille sur les vrais membres — voir le guide TestFlight.

# Pour Gauthier — Raconte-nous le système d'abonnement que tu veux

> **Comment ça marche** : tu t'enregistres en t'expliquant à voix haute (5 à 20 min, comme tu le sens). Pas besoin de préparer un texte ni de répondre à un formulaire. Parle comme si tu m'expliquais en face. On transcrira ton audio et on en tirera le cahier des fonctionnalités. Plus tu donnes d'exemples concrets (« par exemple, si un client… »), mieux c'est.
>
> **Astuce d'enregistrement** : ton téléphone (appli Dictaphone / Mémo vocal) suffit. Tu peux faire plusieurs prises si tu préfères. Inutile d'être parfait — on s'occupe de remettre en ordre.

---

## D'abord, le point de départ — ce que l'app fait AUJOURD'HUI

Pour que tu n'aies pas à redécrire l'existant, voici comment ça marche actuellement. **Dis-nous surtout ce qui CHANGE par rapport à ça.**

- Les clients achètent des **packs de séances** à l'unité (3, 10, 20 séances), valables quelques semaines/mois, et consomment jusqu'à épuisement. Crédits perdus à l'expiration.
- **Annulation** : gratuite si plus de 12h avant le cours (crédit rendu) ; sinon crédit perdu.
- **No-show** : absent non pointé 15 min après le début → crédit perdu.
- **Réservations** : cours du matin ferment la veille à 20h ; cours de l'aprèm 3h avant (ou 30 min s'il y a déjà des inscrits).
- Cours en **semi-privé** (max 4, parfois 5) et **Personal Training** séparé.
- Paiement par **Mollie**, compta dans **Odoo**.

Le projet : **passer (ou ajouter) un modèle d'ABONNEMENT mensuel récurrent**, où le mois = **4 semaines** (pas le mois calendaire).

---

## Les 3 choses les PLUS importantes à nous dire (le reste découle de là)

Si tu ne devais répondre qu'à trois questions, ce sont celles-ci — elles déterminent tout le reste :

1. **La "semaine", c'est quoi ?** Quand un client prend « 1 séance par semaine », est-ce la semaine du calendrier (lundi→dimanche) ou 7 jours glissants à partir du jour où il s'abonne ? *(Donne un exemple : un client s'abonne un samedi — peut-il venir le samedi ET le lundi d'après ?)*

2. **Une séance pas utilisée, elle devient quoi ?** S'il a droit à 1 séance/semaine et qu'il ne vient pas cette semaine : c'est perdu (comme Netflix), ou ça se reporte sur la semaine d'après ? Et s'il y a report, jusqu'où on accepte d'accumuler ?

3. **L'annulation par le client** : jusqu'à combien de temps avant le cours il peut annuler sans rien perdre ? Et dans ce cas, sa séance revient dans son quota, oui ou non ?

---

## Ensuite, raconte-nous le reste — dans l'ordre que tu veux

Voici les sujets à balayer. Prends-les comme une checklist mentale, pas comme un interrogatoire. Saute ce qui ne te parle pas, insiste sur ce qui compte pour vous.

**Les formules**
- Tu veux proposer un rythme **par semaine** (1, 2, 3/sem, illimité) ? Un volume **par mois** (4, 8, 12/mois, illimité) ? Les deux ? Autre chose ?

**Le cycle et le paiement**
- L'abonnement se renouvelle tout seul à la fin des 4 semaines ?
- Le client peut résilier quand il veut, ou il finit la période en cours ?
- Engagement minimum (3 mois…) ou sans engagement, mois par mois ?
- Le prélèvement tombe quel jour ?

**Quand un COACH annule un cours** (vous, côté admin)
- On recrédite tout le monde automatiquement ? On propose un rattrapage ? Au cas par cas ?
- Une séance de rattrapage offerte : elle compte en plus du quota (donc 2 séances la même semaine possibles), ou elle respecte quand même le quota ?
- Le rattrapage a une date limite ?

**La réservation au quotidien**
- Jusqu'à combien de temps à l'avance un client peut réserver ?
- Peut-il réserver une séance qui tombe après la fin de son abonnement (en pariant qu'il renouvellera) ?
- Un illimité, on lui met une limite de réservations d'avance (genre max 5) ?
- Des cours réservés à certaines formules (premium pour les illimités) ?
- La liste d'attente avec les abonnements : si une place se libère, ça réserve tout seul et ça consomme le quota ?

**La cohabitation avec les packs actuels**
- On garde les packs à l'unité à la vente, ou on les retire ?
- Un client peut avoir un abonnement ET un pack en même temps ? Si oui, on consomme lequel en premier ?
- Les clients qui ont encore des séances en stock : on garde leur stock tel quel ? On leur propose de basculer en abonnement ?

**Changer de formule**
- Upgrader (1/sem → 2/sem) en cours de route : effet tout de suite avec ajustement du prix, ou au prochain cycle ?
- Downgrader, pareil ?
- Mettre en pause (vacances, blessure) : possible ? Combien de temps, combien de fois par an ?

**Les prix**
- L'abonnement revient moins cher que les séances à l'unité ?
- Réduction si engagement long (3 mois, à l'année) ?
- Tarifs spéciaux (étudiants, seniors, couples, parrainage) ?

**Les cas pénibles mais inévitables**
- Un paiement mensuel échoue : on suspend tout de suite ? Délai de grâce ?
- Un client peut offrir une séance à un proche (transfert) ?
- Jours fériés / studio fermé : on recrédite ? On prolonge le cycle ?

**Ce que vous voulez voir, vous, en tant qu'admins**
- Par client : quota restant, prochain prélèvement, présences… quoi d'autre ?
- Pour piloter le studio : nombre d'abonnés par formule, taux de remplissage, churn, séances payées-non-venues… qu'est-ce qui vous serait utile ?

---

## Pour finir

- Y a-t-il quelque chose dans votre réalité quotidienne que ce questionnaire ne couvre pas ?
- Y a-t-il un point sur lequel vous, les 3 coachs, n'êtes **pas encore d'accord** ? (utile à savoir — on le mettra en évidence)

Merci Gauthier. Une fois ton enregistrement transcrit, on en tire un cahier clair, on repère ce qui manque, et on revient vers toi seulement sur les points encore flous.

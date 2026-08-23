# Réservations : les règles, et comment les vérifier dans l'app

> Ce que j'ai mis en place après notre échange de ce matin (8/8) pour les abonnements et les plafonds de fréquentation.
> J'ai préparé quatre clients de test dans l'application : vous pouvez tout vérifier vous-mêmes, écran par écran.
> À valider avant qu'on ouvre aux vrais clients.

---

## 1. Le plafond de fréquentation

**Le problème.** Un abonnement illimité sans garde-fou, c'est quelqu'un qui vient trois fois par jour et qui prend les places des autres.

**Ce que j'ai fait.** Sur chaque type de pack, on peut poser un plafond : **N cours par D jours**. Par exemple *2 cours par jour*, ou *10 cours par 7 jours*. Laissé vide, il n'y a aucune limite — c'est le cas aujourd'hui sur tous les packs sauf ceux du test.

### Comment ça compte

La fenêtre est **glissante** et **centrée sur le cours qu'on veut réserver**. On regarde les séances situées à moins de D jours avant *ou après*.

Concrètement, avec un plafond de 4 cours / 7 jours, quelqu'un qui veut réserver le mercredi 19 :

```
On regarde du 12 au 26 août.
  4 cours déjà réservés dedans  →  refusé
  3 cours                       →  accepté
```

Rien ne se remet jamais à zéro. J'ai écarté la semaine calendaire (lundi→dimanche) pour cette raison : elle laisse prendre 4 cours le dimanche et 4 le lundi, soit 8 en deux jours.

### Trois choses à retenir

**Maximum 14 jours.** Au-delà, un plafond ne sert plus à rien : « 50 cours par 28 jours » laisse en faire 50 la première semaine puis rien pendant trois. C'est exactement ce qu'on veut éviter.

**Sur un pack à crédits, le plafond ne sert que s'il est plus bas que le nombre de séances.** Un plafond de 10 sur un pack de 4, ça ne bloquera jamais — les crédits partent avant. Pour étaler un pack de 4, il faut poser *1 cours par 7 jours*.

**Vous pouvez passer outre.** Quand un coach ou un admin inscrit quelqu'un à la main, le plafond ne s'applique pas. Vous avez la personne devant vous, c'est vous qui décidez.

---

## 2. Ce qu'un abonnement couvre

**La règle.** Un abonnement paie les cours de son cycle. Tant qu'il **se renouvelle**, on peut réserver au-delà de la date d'échéance : le cycle suivant paiera.

**Dès qu'il est résilié**, les réservations postérieures au terme sont **annulées automatiquement**, et le client reçoit un message qui nomme le cours et la date de fin.

La coupure se fait **à l'heure près**, pas à la journée. Un abonnement qui se termine le 1er septembre à 12h : les cours du matin sont gardés, celui de 12h30 saute.

---

## 3. Les quatre clients de test

Ils sont dans l'application, avec de vrais types de packs du catalogue. Aucun n'a été payé — ce sont des abonnements offerts pour le test.

Pour vérifier : **Administration → Membres →** le client **→** onglets *Réservations*, *Packs* et *Abonnement*.

Les deux formules utilisées, telles qu'elles existent dans **Administration → Types de packs** :

| Formule | Séances | Prix | Cycle | Plafond posé pour le test |
|---|---|---|---|---|
| **abonnement mini** | 4 séances | 100 € | 4 semaines (28 j) | 10 cours / 7 jours |
| **Pack illimité** | illimité | 219 € | 4 semaines (28 j) | 10 cours / 7 jours |

Les deux sont en crédit **Semi-privé**.

Les cas 1 et 2 démarrent le 10/08, les cas 3 et 4 le 27/07 — il fallait que leur échéance tombe avant, pour montrer ce qui se passe en fin de cycle. Tous les cycles font bien **28 jours**, comme les vraies formules.

### Cas 1 — Thomas Dupont : les crédits s'épuisent avant le plafond

| | |
|---|---|
| Client | Thomas Dupont · `thomas@demo.bot` |
| Formule | **abonnement mini** — 4 séances, 100 € |
| Cycle | du **10/08/2026** au **07/09/2026 à 10h00** (28 jours) |
| Plafond | 10 cours / 7 jours |
| État | **0 crédit restant**, abonnement actif |

Il a réservé ses 4 séances : lundi 10/08 (Ladies 18h), mardi 11/08 (Posture 8h), mercredi 12/08 (BackOnTrack 17h), jeudi 13/08 (BackOnTrack 12h30).

S'il tente un 5ᵉ cours, il lit : *« Vos crédits sont épuisés pour ce cycle. Votre abonnement se renouvelle le 07/09/2026, mais cette séance a lieu avant : il vous faudrait un autre pack. »*

→ **Ce que ça montre :** sur une formule à crédits, ce sont les crédits qui bloquent. Le plafond de 10 n'entre jamais en jeu — il faudrait le descendre à 1 ou 2 pour qu'il serve.

### Cas 2 — Simona Costamagna : le plafond mord, puis se libère

| | |
|---|---|
| Client | Simona Costamagna · `simona@demo.bot` |
| Formule | **Pack illimité** — illimité, 219 € |
| Cycle | du **10/08/2026** au **07/09/2026 à 10h00** (28 jours) |
| Plafond | 10 cours / 7 jours |
| État | 10 cours réservés, abonnement actif |

Ses 10 réservations sont concentrées **du 10 au 12 août**.

- Un cours le **13/08** → refusé : *« Votre pack ne permet pas plus de 10 cours sur 7 jours. »*
- Un cours le **25/08** → **accepté** : la fenêtre a glissé, aucun de ses cours n'y figure plus.

→ **Ce que ça montre :** le plafond limite le rythme, pas le total. Il se libère tout seul en s'éloignant.

### Cas 3 — Anselme Meunier : attendre le renouvellement

| | |
|---|---|
| Client | Anselme Meunier · `anselme.meunier@gmail.com` |
| Formule | **abonnement mini** — 4 séances, 100 € |
| Cycle | du **27/07/2026** au **24/08/2026 à 10h00** (28 jours) |
| Plafond | 10 cours / 7 jours |
| État | **0 crédit restant**, abonnement actif |

Ses 4 séances sont espacées : 11/08, 14/08, 18/08 et 21/08 — le plafond n'a donc jamais joué.

Pour réserver un cours le **26/08**, il lit : *« Vos crédits sont épuisés. Votre abonnement se renouvelle le 24/08/2026 : vous pourrez réserver cette séance à partir de cette date. »*

→ **Ce que ça montre :** le message dit « attendez, ça se recharge » et non « rachetez un pack ». Avant, les deux cas affichaient la même chose et on envoyait en boutique quelqu'un qui avait déjà payé.

### Cas 4 — joan rodon : la résiliation nettoie derrière elle

| | |
|---|---|
| Client | joan rodon · `joan.rodon@hotmail.fr` |
| Formule | **Pack illimité** — illimité, 219 € |
| Cycle | du **27/07/2026** au **24/08/2026 à 10h00** (28 jours) |
| Plafond | 10 cours / 7 jours |
| État | **résilié** — pas de renouvellement après le 24/08 |

Il avait 6 réservations, de part et d'autre de l'échéance. Dès la résiliation :

| Cours réservé | Statut |
|---|---|
| mer 12/08 17h | ✅ confirmé |
| sam 15/08 09h30 | ✅ confirmé |
| mer 19/08 17h | ✅ confirmé |
| mer 26/08 17h | ❌ **annulé** |
| ven 28/08 08h | ❌ **annulé** |
| mer 02/09 17h | ❌ **annulé** |

Trois notifications lui ont été envoyées, et chaque annulation est tracée dans le journal d'activité.

→ **Ce que ça montre :** ce que personne ne paiera disparaît tout seul, et le client est prévenu tout de suite — pas trois semaines plus tard.

---

## 4. Ce que je voudrais que vous validiez

1. **Le principe du plafond** : *N cours par D jours*, fenêtre glissante. Est-ce que ça correspond à ce que vous vouliez ?
2. **Les valeurs.** Pour le test j'ai mis 10 cours / 7 jours. 
		vous pouvez définir un plafond pour chaque pack/abonnement
3. **Les messages** affichés aux clients : assez clairs, ou trop techniques ?
4. **Le staff qui passe outre** : d'accord pour que vous puissiez inscrire quelqu'un au-delà de son plafond ?

Un point à savoir : le plafond de test est actif sur **« abonnement mini »** et **« Pack illimité »**, donc pour tous les clients qui les ont, pas seulement les quatre du test. 

---

*Christian — 8 août 2026*

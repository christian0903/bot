# Reprendre les soldes de séances — comment ça marche

> Une page pour les coachs. Elle explique comment donner à chaque client les
> séances qu'il lui reste, **que ce soit à la main ou par un tableur** : la
> méthode est la même, seule la vitesse change.

---

## Le principe, en deux idées

L'application distingue deux choses qu'on confond facilement :

| | |
|---|---|
| **Une formule** | Ce que le studio vend. « 10 séances semi-privé, valables 3 mois » |
| **Un achat** | Ce qu'un client détient. Ses séances à lui, sa date à lui |

Quand vous vendez une formule à quelqu'un, l'application crée un achat à son
nom. **C'est l'achat qui porte le nombre de séances restantes et la date
limite** — pas la formule.

C'est ce qui rend la reprise possible : deux clients peuvent avoir la même
formule avec 3 et 17 séances restantes, et des dates différentes. Chacun a son
achat.

---

## Ce qu'il faut faire

### 1. Créer deux formules de reprise

Une fois pour toutes, dans **Administration → Types de packs** :

| Nom | Type de crédit | Séances | Prix | Validité |
|---|---|---|---|---|
| Reprise — semi-privé | semi-privé | 1 | 0 € | 1 jour |
| Reprise — personal training | personal training | 1 | 0 € | 1 jour |

Les valeurs n'ont pas d'importance : on les remplacera pour chaque client. Ce
qui compte, c'est le **type de crédit** — c'est lui qui détermine quels cours la
personne pourra réserver, et il ne se change plus ensuite.

> **Décochez « En vente ».** Ces formules ne doivent pas apparaître dans la
> boutique : elles servent à la reprise, pas à la vente. Elles restent
> utilisables sans encombrer le catalogue des membres.

### 2. Pour chaque client, deux gestes

Depuis sa fiche, dans **Administration → Utilisateurs** :

**Attribuer** la formule de reprise qui correspond à son type de séances.
Choisissez « virement » ou « offert » comme mode de paiement, jamais « carte » —
sinon la comptabilité ferait état d'encaissements qui n'ont pas eu lieu. Et
laissez le prix à 0 € : ces séances ont été payées ailleurs.

**Corriger** ensuite les deux valeurs sur l'achat qui vient d'apparaître : le
nombre de séances restantes, et la date jusqu'à laquelle elles sont valables.

C'est tout. La personne voit désormais son solde exact quand elle se connecte.

> **Un client qui a les deux types de séances** reçoit deux achats : un de
> chaque formule, avec ses propres valeurs. C'est normal.

---

## Et si on passe par un tableur

**Rien ne change au principe.** L'ordinateur fait exactement les mêmes gestes,
cent fois de suite au lieu d'une : il attribue la formule de reprise, puis
corrige les séances et la date.

Vous préparez un fichier avec une ligne par client — nom, adresse e-mail,
séances restantes, date limite — et l'application s'occupe du reste. Elle vous
montre d'abord ce qu'elle a compris, et n'écrit rien tant que vous n'avez pas
validé.

**Ce n'est utile qu'au-delà d'une cinquantaine de clients.** En dessous, la
saisie à la main est plus rapide que la préparation du fichier.

---

## Les séances déjà suivies

Si vous voulez que les badges d'assiduité tiennent compte du passé — « 50
séances », « 100 séances » —, il y a un champ pour ça sur la fiche du membre,
sous les frais d'inscription : **« Séances avant l'application »**.

Saisissez le nombre total de séances suivies avant la bascule, tous types
confondus. Un client repris avec 47 séances décrochera son badge des 50 après
trois cours chez vous.

> **Les badges de régularité repartent de zéro** — les séries de 4, 8 ou 12
> semaines consécutives. Sans les dates de chaque séance passée, il n'y a pas
> moyen de reconstituer une assiduité.

---

## Ce qui se passe ensuite, tout seul

Une fois les séances attribuées, l'application se charge du reste :

- Le **statut** de chaque membre se met à jour — « Actif » s'il lui reste des
  séances valables ;
- Le **solde diminue** à chaque réservation, et remonte si la personne annule à
  temps ;
- **À l'échéance**, les séances non utilisées expirent, comme pour n'importe
  quelle formule.

Vous n'avez rien à surveiller.

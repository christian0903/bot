Idem pour coupons et parrainage

Ci dessous les règles implémentés et qui seront modifiées en fonction de vos retours.
J’ai besoin d’une version unique (pas de vos versions individuelles)

# Règles actuelles — Coupons & Parrainage

> Document de travail à soumettre aux coaches pour validation/évolution.
> État du système au **13 mai 2026** (app v2.15.0).

Le studio dispose aujourd'hui de **deux systèmes distincts** qui ne sont pas connectés entre eux :

1. les **coupons de réduction** (créés par l'admin, utilisables par n'importe qui)
2. le **programme de parrainage** (un code propre à chaque client, lié à son profil)

---

## 1. Coupons de réduction

### Qui crée le coupon ?

L'**administrateur** uniquement, depuis l'écran *Admin → Coupons*.

### Caractéristiques d'un coupon

| Paramètre | Description |
|---|---|
| **Code** | Texte libre en majuscules (ex. `RENTREE2026`). Unique. |
| **Réduction** | Soit un pourcentage (1 à 100 %), soit un montant fixe en € — pas les deux à la fois. |
| **Nombre d'utilisations maximum** | Optionnel. Limite **globale** (tous clients confondus), pas par client. Si non renseigné : utilisations illimitées. |
| **Période de validité** | Date de début + date de fin facultatives. |
| **Actif / inactif** | Switch pour désactiver le coupon sans le supprimer. |

### Comment ça fonctionne pour le client

1. Le client choisit un pack à acheter sur la page *Achat de packs*.
2. Au moment du paiement, il peut **entrer un code coupon** (champ libre).
3. Si le code est valide et actif, la réduction (% ou €) est **appliquée immédiatement** au prix du pack.
4. Une fois le paiement réussi (via Stripe), le compteur d'utilisations du coupon est incrémenté de 1.

### Règles de validité au moment de l'achat

Un coupon est rejeté si :
- il n'existe pas ou est désactivé,
- la date du jour est avant `valid_from` ou après `valid_until`,
- le nombre maximum d'utilisations a déjà été atteint.

### Ce que le système ne fait **pas** aujourd'hui

- ❌ Pas de limite "un seul usage par client". Si le coupon a `max_uses = 50` et que le même client l'utilise 10 fois, c'est accepté.
- ❌ Pas de réduction différente selon le pack acheté : un coupon `-10%` s'applique à tous les packs de la même manière.
- ❌ Pas de lien avec un parrain ou un client en particulier.

---

## 2. Programme de parrainage

### Le code de parrainage

- **Tout client** dispose automatiquement d'un code unique généré à sa création (visible dans *Parrainage* dans son menu).
- Le client peut le **copier ou le partager** depuis l'app.
- Ce code n'est **pas** un coupon — il sert uniquement à enregistrer un parrainage à l'inscription d'un nouveau membre.

### Comment ça fonctionne

1. **Inscription du filleul** : le nouveau membre saisit le code du parrain dans le champ "Code de parrainage" lors de son inscription.
2. **Création du lien** : à sa première connexion, le système enregistre le parrainage (statut *en attente*).
3. **Qualification** : le parrainage passe en *qualifié* dès que le filleul remplit **les deux conditions** suivantes :
   - il a payé ses **frais d'inscription**,
   - il a acheté un pack d'**au moins 10 séances**.
4. **Récompenses** : au moment de la qualification, le parrain **et** le filleul reçoivent chacun **un avoir de 30 €**, valable **180 jours**.

> Tous ces paramètres (montant, nombre de séances minimum, durée de validité) sont 
> **configurables côté admin** dans les paramètres `referral_rules`, mais aujourd'hui ils sont 
> uniformes pour tous les packs.

### Statuts d'un parrainage

| Statut | Signification |
|---|---|
| **En attente** | Le filleul s'est inscrit avec le code mais n'a pas encore acheté un pack suffisant. |
| **Qualifié** | Les conditions sont remplies, les deux avoirs ont été générés. |
| **Récompensé** | (état terminal, peu utilisé aujourd'hui) |

### Ce que le système ne fait **pas** aujourd'hui

- ❌ **Pas d'utilisation automatique** de l'avoir de 30 €. La page *Parrainage* affiche bien "Tu as 30 € de réduction disponible", mais l'avoir n'est **pas appliqué automatiquement** au prochain achat de pack. Il existe seulement comme "promesse" affichée — son utilisation effective doit être gérée manuellement (par exemple via la création d'un coupon ad hoc pour le client concerné).
- ❌ Pas de récompense différente selon le pack acheté par le filleul : que le filleul prenne un pack de 10 séances ou de 30, le parrain reçoit toujours 30 €.
- ❌ Pas de limite explicite "un seul pack avec le code" — la qualification se déclenche au premier pack ≥ 10 séances, mais rien n'empêche le filleul de continuer à utiliser quoi que ce soit ensuite.
- ❌ Un même filleul ne peut être parrainé qu'**une seule fois** (le système refuse un deuxième code de parrainage pour le même utilisateur — ça, c'est déjà en place).

---

## 3. Synthèse pour discussion avec les coaches

### Points à clarifier ou faire évoluer

1. **Doit-on 
- garder deux systèmes séparés** (coupons admin + parrainage), 
- un seul système (le parrainage)
	NB: avec le système par abonnement, les coupons à l’achat de packs perdent leur utilité
	 (puisque paiement automatique chaque mois)
- ou autre système ?

2. **Récompense parrain : fixe ou variable selon le pack acheté par le filleul ?**
   Exemple si variable :
   - Pack 5 séances → 0 € au parrain
   - Pack 10 séances → 30 € au parrain
   - Pack 20 séances → 60 € au parrain
   - Pack annuel → 100 € au parrain
(Montants doivent pouvoir être modifiés dans les paramètres de l’app)

3. **Récompense filleul : remise immédiate ou avoir différé ?**
   Aujourd'hui c'est un avoir différé (30 €) — mais qui n'est pas consommé automatiquement. Le rendre immédiat (remise au checkout) simplifierait l'usage.

4. **Limite "un seul pack par code parrain" ?**
   À confirmer : un filleul ne peut utiliser le code de son parrain **qu'une seule fois**, peu importe combien de packs il achète ensuite.

5. **Avoir de 30 € existants : que faire ?**
   Si on change les règles, on hérite d'avoirs déjà promis en base. Garder, convertir, ou annuler ?

6. **Frais d'inscription comme condition de qualification : on garde ?**
   Aujourd'hui la qualification exige *frais d'inscription* + *pack ≥ 10 séances*. À ré-évaluer.

7. **Durée de validité des avoirs : 180 jours, on garde ?**


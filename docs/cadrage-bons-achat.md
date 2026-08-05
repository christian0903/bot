# Bons d'achat — cadrage

> Cadrage du **2026-08-05**. Remplace la partie « coupons & parrainage » de `regles-coupons-parrainage.md`, dont plusieurs affirmations ne correspondent pas au code.
> Décisions prises avec Christian. Les questions restantes sont signalées en fin de document.

---

## Le constat qui justifie ce chantier

Trois vérifications dans le code ont montré que **les deux systèmes de réduction existants ne fonctionnent pas** :

| Système | État réel |
|---|---|
| **Coupons** | L'admin peut en créer, le serveur sait les traiter. Mais **aucun écran ne permet de saisir un code** : zéro occurrence de `coupon_code` dans `src/`. Un coupon créé aujourd'hui est inutilisable. |
| **Parrainage** | Le code est généré pour chaque membre, la saisie à l'inscription crée bien une ligne `referrals`. Mais **rien ne fait jamais passer un parrainage en `qualified`**. Rien n'écrit dans `referral_rewards`. |

Aucune donnée en circulation, aucun client habitué à un fonctionnement : le moment est idéal pour décider de la cible.

---

## Le fonctionnement, en clair

### Trois objets, trois rôles

| Objet | À qui | Combien | Se consomme ? |
|---|---|---|---|
| **Coupon collectif** (`RENTREE2026`) | À tout le monde | Un code, N utilisateurs | Non — quota global |
| **Code de parrainage** (`MARC7X2`) | Un par membre, à vie | Partagé à autant de filleuls qu'il veut | Non — permanent |
| **Bon d'achat** (`BON-4F8A`) | À une personne | Autant que de bons gagnés | **Oui — une fois, en entier** |

> Le **code de parrainage** n'est pas un bon. Il est permanent et sert à identifier le parrain. Le **bon** représente de l'argent : il est unique et disparaît une fois utilisé.

### Le parcours, du début à la fin

**1. Le filleul s'inscrit et achète.**
Il saisit le code de parrainage de son parrain (`MARC7X2`), à l'inscription ou au moment de l'achat. Le champ existe aux deux endroits, parce que beaucoup l'oublieront à l'inscription.

**2. Le paiement réussit.** Le webhook Stripe le détecte et crée **deux bons de 30 €** :
- un pour le filleul,
- un pour le parrain.

**3. Chacun utilise son bon quand il veut.**
Au moment de payer, l'application voit que le membre a un bon disponible et lui demande : *« Tu as un bon de 30 € — l'utiliser sur cet achat ? »*. Il répond oui ou non. S'il refuse, le bon reste pour la prochaine fois.

**4. Un bon utilisé disparaît.** Pas de solde, pas de reliquat.

**5. Un parrain avec trois filleuls a trois bons.** Il les utilise sur trois achats différents — **un seul bon par achat**.

### Ce que le membre voit

Aucun code à retenir. L'application propose, le membre confirme. Le code du bon n'apparaît que sur sa page Parrainage, comme référence en cas de réclamation au studio.

Quand plusieurs bons sont disponibles, proposer **celui dont l'expiration est la plus proche** — c'est celui qu'on risque de perdre.

---

## Les règles

| Règle | Décision |
|---|---|
| Un bon s'utilise **en entier** | Pas de solde partiel, pas de champ « montant consommé » |
| **Un seul bon par achat** | Pas de cumul entre plusieurs bons |
| **Pas de cumul bon + coupon** | Un seul code par achat, le client choisit |
| Le bon est **proposé**, pas imposé | Le membre confirme ; s'il refuse, le bon reste |
| Les **coupons restent hors de cette table** | Ils gardent leur mécanisme actuel (`coupons`), il leur manque seulement un champ de saisie |

### L'achat plus petit que le bon — tranché

Le bon est **toujours proposé**, même si l'achat coûte moins. L'avertissement annonce ce qui sera perdu :

> *« Ton bon vaut 30 €, cet achat coûte 25 €. Tu perdrais 5 €. L'utiliser quand même ? »*

Le membre décide : il accepte la perte, ou il reporte sur un achat plus gros où il ne perdra rien. Le choix lui appartient en connaissance de cause, et personne ne découvre la perte après coup.

Cette règle vaut pour le parrain comme pour le filleul.

En pratique le cas restera rare : sur neuf produits du catalogue, **un seul** est en dessous de 30 € (carte séance unique à 25 €).

---

## Le pont avec les réductions d'abonnement existantes

L'admin dispose déjà d'une **réduction ponctuelle sur abonnement** (`manage-subscription`, action `discount`) : elle crée un coupon Stripe `duration: once`, l'attache à l'abonnement, et trace l'opération dans `subscription_discounts`. La remise s'applique à la prochaine échéance puis Stripe retire le coupon de lui-même.

**C'est déjà la moitié du mécanisme de bons d'achat** — mais réservé aux abonnements et déclenché à la main.

Le pont à faire, dans les deux sens :

**Un bon utilisé sur un abonnement** emprunte ce chemin : au lieu d'une réduction au checkout, on crée un coupon Stripe `duration: once` sur l'abonnement en cours. Le code existe, il suffit de l'appeler depuis la consommation d'un bon.

> **Le prix récurrent n'est jamais modifié.** Un bon de 30 € sur un abonnement à 100 € donne une première échéance à 70 €, puis **toutes les suivantes à 100 €**. C'est le rôle de `duration: 'once'` : Stripe applique la réduction à une facture, puis retire le coupon de lui-même. Le **Price** de l'abonnement n'est pas touché.
>
> **À ne jamais faire** : créer un Price réduit ou modifier le montant de l'abonnement pour appliquer un bon — la réduction deviendrait permanente. Rappel du journal de projet : *« Un Price Stripe est immuable »*, le modifier crée un nouveau prix et casse les abonnements existants.
>
> Les variantes `duration: 'repeating'` (N échéances) et `duration: 'forever'` ne conviennent pas ici.

**Une réduction accordée par l'admin devient un bon** quand le membre n'a pas d'abonnement. Aujourd'hui, un coach ne peut rien offrir à quelqu'un qui achète des packs : l'action `discount` exige un abonnement. Avec les bons, le geste devient possible pour tout le monde.

À terme, `subscription_discounts` pourrait fusionner dans la table des bons — même objet, même trace, même origine. À évaluer au moment de coder.

---

## Modèle de données

Reprendre `referral_rewards` en la généralisant. La table existe, elle est vide, rien ne la consomme : la migration est triviale aujourd'hui.

**La règle du tout-ou-rien épargne toute modification du cœur de la table.** `amount_cents` reste le montant accordé, `is_used` dit s'il a été consommé — pas de solde à suivre, pas de champ « montant restant ». Les colonnes existantes (`id`, `user_id`, `amount_cents`, `is_used`, `used_at`, `expires_at`, `created_at`) sont conservées telles quelles ; `referral_id` devient simplement nullable. Le reste n'est **que de l'ajout** : `code`, `origin`, `granted_by`, `reason`, qui servent à la traçabilité et aux gestes des coaches, jamais au calcul.

```
credit_notes  (ex-referral_rewards)
  id
  code           TEXT UNIQUE     -- BON-4F8A, référence et saisie de secours
  user_id        UUID NOT NULL   -- le bénéficiaire (toujours nominatif)
  amount_cents   INTEGER         -- montant accordé, jamais décrémenté
  origin         TEXT            -- 'parrainage' | 'geste_commercial' | 'dedommagement'
  referral_id    UUID NULL       -- le parrainage d'origine, NULL pour un geste
  granted_by     UUID NULL       -- l'admin qui l'a accordé
  reason         TEXT NULL       -- motif libre
  is_used        BOOLEAN
  used_at        TIMESTAMPTZ
  used_on        TEXT NULL       -- 'pack' | 'subscription' — sur quoi il a servi
  expires_at     TIMESTAMPTZ
  created_at
```

Les **coupons collectifs gardent leur table** (`coupons`) : quota global, pas de bénéficiaire, logique différente. Deux objets distincts pour deux usages distincts, plutôt qu'une table à colonnes nulles.

> **Point de vigilance** : `expires_at`. Un bon « tout ou rien » qui expire sans avoir trouvé d'achat assez gros, c'est une promesse qui s'évapore et un client mécontent. À surveiller à l'usage.

---

## À construire

Par ordre de dépendance :

1. **Migration** de `referral_rewards` vers `credit_notes`
2. **Qualification du parrainage** dans le webhook Stripe — n'existe pas aujourd'hui ; crée les deux bons au premier paiement du filleul
3. **Proposition du bon** au moment du paiement, avec confirmation
4. **Consommation** : sur un paiement ponctuel (`create-checkout-session`) et sur une échéance d'abonnement (réutiliser le `duration: once` de `manage-subscription`)
5. **Champ de saisie** sur les écrans d'achat — pour le code de parrainage, les coupons collectifs et, en secours, le code d'un bon
6. **Bouton admin « accorder un bon »** sur la fiche membre, à côté des actions d'abonnement
7. **Rattachement rétroactif d'un parrain** par l'admin — les codes oubliés seront fréquents et réclamés après coup
8. **Message d'erreur** quand un code saisi n'existe pas : aujourd'hui l'échec est silencieux, le filleul croit son parrainage enregistré

---

## Questions ouvertes pour les coachs

1. **Quand le parrainage se qualifie-t-il ?** Au premier achat payé du filleul (position de Christian : les frais d'inscription valant 30 € comme le bon, **le parrainage rend l'inscription gratuite**), au paiement des frais seulement, ou frais + premier pack ?
2. **Garde-t-on les coupons collectifs ?** Le mécanisme est presque terminé, il ne manque que le champ de saisie. À noter : avec l'abonnement, un coupon ne peut jouer qu'à la souscription.
3. **Quels gestes commerciaux faites-vous déjà à la main ?** C'est ce qui déterminera les origines à prévoir.
4. **Montant du bon** : 30 € pour les deux, ou variable selon ce qu'achète le filleul ?
5. **Durée de validité** d'un bon.

# Bons d'achat — cadrage

> Document de cadrage du **2026-08-05**. Remplace la partie « coupons & parrainage » de `regles-coupons-parrainage.md`, dont plusieurs affirmations ne correspondent pas au code.
> Décisions prises avec Christian. À soumettre aux coachs pour ce qui touche au commercial.

---

## Le constat qui justifie ce chantier

Trois vérifications dans le code ont montré que **les deux systèmes de réduction existants ne fonctionnent pas** :

| Système | État réel |
|---|---|
| **Coupons** | L'admin peut en créer, le serveur sait les traiter (`create-checkout-session` accepte `coupon_code`). Mais **aucun écran ne permet de saisir un code** : zéro occurrence de `coupon_code` dans `src/`. Un coupon créé aujourd'hui est inutilisable. |
| **Parrainage** | Le code est généré pour chaque membre, la saisie à l'inscription crée bien une ligne `referrals`. Mais **rien ne fait jamais passer un parrainage en `qualified`** — vérifié dans le webhook, le code applicatif et les triggers SQL. Rien n'écrit dans `referral_rewards`. |

`regles-coupons-parrainage.md` (13 mai) décrit une qualification automatique et un champ de saisie qui n'existent pas. Ce document décrivait une intention.

**Conséquence heureuse** : aucune donnée en circulation, aucun client habitué à un fonctionnement. C'est le meilleur moment pour décider de la cible plutôt que de rafistoler deux moitiés.

---

## Le principe retenu

Un **bon d'achat** unique, quelle que soit son origine. Le parrainage devient un producteur de bons parmi d'autres, au lieu d'être un système clos.

Trois natures de code cohabitent dans **un seul champ de saisie** :

| Ce qui est saisi | Nature | Effet |
|---|---|---|
| `RENTREE2026` | **Coupon collectif** | Remise immédiate. Quota global, tout le monde peut l'utiliser. |
| `MARC7X2` | **Code de parrainage** (permanent, `profiles.referral_code`) | Remise immédiate pour le filleul **+ création d'un bon pour le parrain** |
| `BON-4F8A` | **Bon nominatif** | Remise immédiate, consommé. |

> **Distinction à ne pas perdre** : le code de parrainage n'est **pas** un bon d'achat. Il est permanent et réutilisable par plusieurs filleuls. Le confondre avec un bon le ferait consommer au premier filleul.

Un parrain peut détenir **plusieurs bons** (un par filleul qualifié) — d'où un code propre à chaque bon.

---

## Décisions prises

### Tout ou rien, pas de solde partiel

Un bon s'utilise **en entier ou pas du tout**. Si l'achat coûte moins que le bon, le bon reste intact pour la prochaine fois.

Pas de champ « montant consommé » : la table existante (`amount_cents` + `is_used`) convient telle quelle.

**Justification** : sur les neuf produits du catalogue, **un seul** est en dessous de 30 € (carte séance unique à 25 €). Le solde partiel résoudrait un cas marginal au prix d'une logique plus complexe. Règle d'arbitrage du projet : *« l'exception ne s'inscrit pas dans le code »* — si un client se retrouve bloqué, le studio applique la remise à la main.

### Le bon du parrain est proposé, puis confirmé

Au moment du paiement, l'application détecte que le membre a un bon utilisable et l'affiche : *« Tu as un bon de 30 € — l'utiliser ? »*. Le code existe et reste saisissable, mais personne ne l'oublie.

**Justification** : le défaut documenté du système actuel est qu'un avoir affiché comme promesse n'est jamais consommé. Un code purement manuel déplacerait le problème au lieu de le résoudre.

### Un seul code par achat

Pas de cumul entre coupon collectif et bon nominatif. Le client choisit lequel il utilise.

### Qualification du parrainage

**À trancher avec les coachs** — trois options :
- au premier achat payé du filleul, quel qu'il soit (frais d'inscription, pack ou abonnement) ;
- au paiement des frais d'inscription seulement ;
- frais d'inscription **+** un premier pack (comme le prévoyait la doc de mai, sans le seuil des 10 séances).

Christian penchait pour le **premier achat payé**, avec cet argument commercial : les frais d'inscription valant 30 € comme le bon, **le parrainage rend l'inscription gratuite**.

La détection se fera dans le **webhook Stripe** — seul endroit qui sait qu'un paiement a réussi.

---

## Modèle de données

Reprendre `referral_rewards` en la généralisant. La table existe, elle est vide, rien ne la consomme : la migration est triviale aujourd'hui, elle ne le sera plus dans six mois.

```
credit_notes  (ex-referral_rewards)
  id
  code              TEXT UNIQUE     -- saisissable par le membre
  user_id           UUID            -- bénéficiaire (NULL = coupon collectif)
  amount_cents      INTEGER         -- montant accordé, jamais décrémenté
  percent_off       INTEGER         -- alternative au montant (coupons)
  origin            TEXT            -- 'parrainage' | 'coupon' | 'geste_commercial' | 'dedommagement'
  referral_id       UUID NULL       -- le parrainage d'origine, NULL sinon
  granted_by        UUID NULL       -- l'admin qui l'a accordé (gestes manuels)
  reason            TEXT NULL       -- motif libre
  max_uses          INTEGER NULL    -- coupons collectifs uniquement
  current_uses      INTEGER
  is_used           BOOLEAN         -- bons nominatifs
  used_at           TIMESTAMPTZ
  valid_from        TIMESTAMPTZ
  expires_at        TIMESTAMPTZ
  created_at
```

Un seul objet couvre les deux usages : `user_id` renseigné = bon nominatif, `user_id` nul = coupon collectif.

> **Point de vigilance** : `expires_at`. La doc parlait de 180 jours. Un bon « tout ou rien » qui expire sans avoir trouvé d'achat assez gros, c'est une promesse qui s'évapore et un client mécontent. À surveiller à l'usage.

---

## À construire

Par ordre de dépendance :

1. **Migration** de `referral_rewards` vers le modèle unifié
2. **Champ de saisie** sur les écrans d'achat (page Packs, frais d'inscription) — il n'en existe aucun aujourd'hui, ni pour les coupons ni pour les bons
3. **Proposition automatique** du bon disponible au moment du paiement
4. **Qualification du parrainage** dans le webhook Stripe — n'existe pas
5. **Consommation** : appliquer un bon à un paiement ponctuel (`create-checkout-session`) et à une échéance d'abonnement (le mécanisme `duration: once` existe déjà dans `manage-subscription`)
6. **Bouton admin « accorder un bon »** sur la fiche membre, à côté des actions d'abonnement
7. **Rattachement rétroactif d'un parrain** par l'admin — les codes oubliés à l'inscription seront fréquents et réclamés après coup
8. **Message d'erreur** quand un code saisi n'existe pas : aujourd'hui `processReferralCode` abandonne en silence, le filleul croit son parrainage enregistré

---

## Questions ouvertes pour les coachs

1. **Garde-t-on les coupons collectifs ?** Une campagne publique type « RENTREE2026 » vous serait-elle utile ? Le mécanisme est presque terminé (il ne manque que le champ de saisie), ce serait dommage de le supprimer sans le demander. À noter : avec l'abonnement, un coupon ne peut jouer qu'à la souscription, puisque les prélèvements suivants sont automatiques.
2. **Quels gestes commerciaux faites-vous déjà à la main ?** C'est ce qui déterminera les origines à prévoir. Mieux vaut deux ou trois origines nommées qu'un système générique paramétrable pour des besoins qu'on n'a pas encore rencontrés.
3. **Montant du bon de parrainage** : 30 € pour les deux, ou variable selon ce qu'achète le filleul ?
4. **Durée de validité** d'un bon.
5. **Que deviennent les avoirs déjà promis en base**, s'il y en a ?

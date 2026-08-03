# Dossier fonctionnel — Abonnements (Phase 12)

> **Statut** : proposition de cadrage, 2026-08-03.
> **Sources** : `questionnaire-abonnement.md` (44 questions), `grille-analyse-abonnement.md` (réunion à 3 voix), vérifications API Stripe en doc officielle.
> **À valider par Christian** avant écriture du code.

---

## 1. Contexte et principe directeur

Le studio vend aujourd'hui des **packs de séances** : achat ponctuel, N crédits, validité en jours, consommation à la réservation. Ça fonctionne (phases 1-10 livrées).

Le problème n'est pas fonctionnel, il est commercial : **rien ne se renouvelle**. Les clients laissent passer des semaines entre deux packs, ce qui coûte à la fois en fidélisation et en trésorerie.

> « Le problème qu'on dirait que vous avez, c'est qu'il n'y a pas le renouvellement automatique. Ça ne fidélise pas et ça fait des rentrées en moins. »

**La décision structurante de la réunion est de ne PAS créer un système d'abonnement.** Un abonnement, ici, c'est un pack court qui se renouvelle tout seul.

> « Il suffit de dire qu'on ne prend plus les packs longs, on prend les packs courts et on fait un renouvellement automatique. »
> « Vous faites un pack mensuel, 4 séances, renouvelable automatique. C'est un abonnement. Mais c'est un pack. »

Il n'y a donc **ni nouveau moteur de quota, ni nouvelle logique de consommation, ni nouveau parcours de réservation**. Tout cela existe et reste inchangé. Ce qui s'ajoute : Stripe en mode `subscription`, un webhook qui recharge le pack à chaque échéance, et les écrans admin pour piloter les cas particuliers.

### Règle d'arbitrage permanente

Une ligne traverse toute la réunion et doit gouverner chaque décision de conception :

> « Une application complexe, c'est une fabrique à emmerdes. »
> « Il faut réfléchir à ce qui va se passer souvent et ce qui se passera exceptionnellement. L'exception, il ne faut pas l'inscrire. »

**Traduction opérationnelle : l'exception se gère à la main, par un admin, pas par du code.** Chaque fois qu'une règle métier devient conditionnelle, on préfère un bouton admin à un automatisme. Cette règle a déjà produit trois décisions dans ce dossier (pas de congés en libre-service, pas de pénalité no-show, pas de restriction de réservation par formule).

---

## 2. Le produit

### 2.1 Formules retenues

Quatre niveaux, sur un cycle de **28 jours** :

| Formule | Crédits / cycle | Nature |
|---|---|---|
| 1× / semaine | 4 | décompte normal |
| 2× / semaine | 8 | décompte normal |
| 3× / semaine | 12 | décompte normal |
| Illimité | — | pas de décompte |

Les libellés « 1× / semaine » sont **commerciaux**, pas techniques : le client reçoit 4 crédits pour 28 jours et les répartit librement. Aucune contrainte hebdomadaire n'est appliquée.

> Décision : la **Formule A** du questionnaire (quota hebdomadaire strict) est **abandonnée**. Elle imposait une définition de « semaine » (glissante ? calendaire ?) et un moteur de contrôle — complexité pure, sans bénéfice.

### 2.2 Cycle de 28 jours, pas de mois calendaire

> « Reconduction tous les 28 jours. Ou toutes les 4 semaines. »
> « 28, ça représente 4 semaines. Tu sais que tu as un pack de 4 crédits pour 4 semaines. »

Le prélèvement tombe à la **date anniversaire de la souscription**, pas à date fixe du mois.

> « Ils viennent le 15, ils prennent le 15. Ils viennent le 23, c'est le 23. Et puis tous les 23, ça va être payé. »

**Conséquence commerciale à assumer : 13 prélèvements par an, pas 12.** C'est mathématique (365 / 28 = 13,04). Deux implications :
- La communication client doit dire « toutes les 4 semaines », jamais « par mois » — sinon litige garanti.
- Le calcul de marge doit se faire sur 13 échéances, et les frais Stripe se comptent 13 fois (voir §8).

### 2.3 Coexistence avec les packs ponctuels

Les packs à l'unité sont **conservés**, et l'orientation vers l'abonnement se fait **par le prix**, pas par des restrictions.

> « Vous avez le pack 4 séances, mais ça coûte 100 euros. Par contre, si vous prenez un abonnement, c'est 60 euros par mois. »
> « Sur le délai pour s'inscrire, je ne le ferais pas. Par contre, je le jouerais sur le prix. »

Le raisonnement derrière ce choix mérite d'être conservé, parce qu'il resservira : brider les réservations des clients ponctuels est à la fois contournable et contre-productif.

> « J'ai un travail, je suis infirmière, j'ai des horaires de con. Je ne peux pas me permettre le truc mensuel […] et tu m'empêches en plus de réserver. Moi, je ne prends pas la carte. […] L'inconvénient, tu le reportes sur le prix. »

> ⚠️ Seul désaccord de la réunion (7.1) : Sp3 penchait pour le tout-abonnement, Sp1 et Sp2 tiennent aux cartes de séances. Sans impact technique — les deux produits sont le même objet en base. **Décision proposée : garder les deux, écart de prix marqué.**

---

## 3. Règles métier

### 3.1 Consommation des crédits — inchangée

| Règle | Décision | Source |
|---|---|---|
| Réservation | −1 crédit (sauf illimité) | existant |
| Illimité | pas de décompte, mais **la réservation est enregistrée** | « Tu as un pack illimité, je ne fais pas moins 1 […] mais j'enregistre la réservation » |
| Annulation > 24 h | crédit recrédité | existant, `app_settings` |
| Annulation < 24 h | crédit **perdu**, client prévenu | « annulation en tout 24 heures, tu perds d'office le crédit » |
| No-show | crédit perdu (pas d'annulation = pas de recrédit) | conséquence de la règle précédente |
| Délai minimum d'inscription | paramétrable | existant |

**Crédits non consommés en fin de cycle : perdus.** Ils ne se reportent pas sur le cycle suivant.

> ⚠️ Cette règle n'a jamais été formulée explicitement en réunion — c'est la continuité du système actuel. **À faire confirmer** (relance n° 4), car c'est commercialement sensible.

### 3.2 Pas de pénalité automatique — une statistique à la place

Le système de pénalités no-show évoqué en réunion a été explicitement écarté.

> « En cas d'abus, ça vous devez le gérer manuellement, parce qu'il n'y a pas de système qui va faire ça. »
> « Il faut contacter la personne et en parler avec elle. A priori, c'est un bon client. »

D'autant que le problème est marginal : « les no-show, c'est arrivé très rarement ».

**Ce qu'il faut construire à la place : un compteur d'annulations et de désistements par client**, visible par l'admin, pour objectiver la conversation quand elle a lieu.

> « Tu devrais pouvoir demander une statistique qui dit : cette personne-là, combien de fois elle s'est désinscrite. »

Les données existent déjà (log d'activité). Il reste à les agréger et les afficher.

### 3.3 Congés, blessures, absences — le décalage d'échéance

Pas de fonction « mise en pause » en libre-service. Décision nette.

> « L'option de vacances, il faut la supprimer. »
> « Je ne crois pas qu'un système puisse implémenter un truc où les gens, unilatéralement, vont dire : tiens, je prends des jours de congé […] ça devient incontrôlable. »

**Le mécanisme retenu : l'admin décale l'échéance suivante.** Le cycle en cours est prolongé, et tous les cycles ultérieurs suivent la nouvelle date.

> « Vous changez le renouvellement du pack en disant : ton pack mensuel va fonctionner pendant six semaines. Après, ça continue tous les mois à partir de six semaines. Et ça, c'est l'équivalent de tes jours de congé. »

Techniquement : `billing_cycle_anchor` sur l'abonnement Stripe (voir §5.3). Le client demande, l'admin arbitre et exécute.

### 3.4 Engagement long — payé d'avance, jamais mensualisé

> « Prendre un système d'un an où tu payes chaque mois, c'est de la blague. Parce que s'ils bloquent le paiement, vous êtes couillonné. »
> « S'ils prennent un truc d'un an, ils payent l'année tout de suite. À ce moment-là, s'ils veulent s'arrêter, c'est leur problème. »

Donc : **abonnement 28 jours sans engagement** (le produit courant), ou **pack long payé intégralement d'avance** avec remise (~10 %). Jamais d'engagement annuel mensualisé.

Le remboursement partiel en cas d'arrêt anticipé reste un **geste commercial discrétionnaire**, décidé au cas par cas — pas une règle codée.

> « C'est vous qui décidez. Et le système ne peut pas décider ça. »

### 3.5 Parrainage

Priorité forte exprimée en réunion.

> « Pour les parrainages, je trouve que c'est hyper important. Il faut que le parrain ait une réduction de 20 ou 30 euros et que le filleul en ait aussi. »

**Déclencheur** : le filleul s'inscrit, paie ses frais d'inscription, et souscrit son premier abonnement.
**Effet** : une réduction ponctuelle sur **l'échéance suivante** du parrain **et** du filleul. Les échéances ultérieures repartent au tarif plein.

Techniquement : coupon Stripe `duration: "once"` (voir §5.2). Les tables `referrals` et `referral_rewards` existent déjà.

### 3.6 Changement de formule et résiliation

| Cas | Règle proposée | Statut |
|---|---|---|
| Upgrade (4 → 8 crédits) | effet **au cycle suivant**, pas de prorata | 🟡 à confirmer |
| Downgrade | effet **au cycle suivant** | 🟡 à confirmer |
| Résiliation | arrêt du renouvellement ; droits conservés jusqu'à la fin du cycle payé | 🟡 à confirmer |

Le « pas de prorata » est un choix de simplicité assumé, cohérent avec la règle d'arbitrage. Le changement de formule était d'ailleurs présenté en réunion comme la façon normale d'anticiper une absence :

> « Si tu sais que le mois d'après tu pars en vacances, que tu puisses passer à un abonnement où tu as moins de séances. »

### 3.7 Échec de paiement

❌ Non abordé en réunion. **Proposition à valider** (relance n° 3) :

1. Stripe relance automatiquement (relances intelligentes, ~3-4 tentatives sur 2 semaines).
2. Pendant cette période : le client **conserve** ses crédits et peut réserver.
3. Après échec définitif : **suspension du droit de réserver**, notification au client et à l'admin, abonnement laissé en `past_due` — **pas d'annulation automatique**.
4. L'admin décide : relancer, arranger, ou résilier.

Ce choix suit la règle d'arbitrage : le système signale, l'humain tranche. Il évite surtout le scénario Mollie (annulation sèche après 5 échecs) qui transformerait une carte expirée en perte de client.

---

## 4. Modèle de données

### 4.1 Ce qui existe déjà et ne bouge pas

```
pack_types      (id, name, credit_type_id, credit_count, price_cents,
                 validity_days, is_active, …)
pack_purchases  (id, user_id, pack_type_id, price_paid_cents,
                 credits_remaining, purchased_at, expires_at,
                 stripe_payment_intent_id, coupon_id, …)
coupons         (id, code, discount_percent, discount_amount_cents,
                 max_uses, current_uses, valid_from, valid_until, …)
bookings, scheduled_classes, profiles, app_settings,
referrals, referral_rewards, notifications, activity_log
```

**Point capital pour l'estimation** : `pack_types` porte déjà `credit_count` **et** `validity_days`. Un « abonnement 4 séances / 28 jours » se crée donc **sans une ligne de code** — c'est une saisie dans l'admin existante.

### 4.2 Ce qui s'ajoute

Une seule table nouvelle, plus deux colonnes.

```sql
-- Nouveau : le lien entre un client et son abonnement Stripe
CREATE TABLE subscriptions (
  id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id                 UUID NOT NULL REFERENCES auth.users(id),
  pack_type_id            UUID NOT NULL REFERENCES pack_types(id),
  stripe_subscription_id  TEXT UNIQUE NOT NULL,
  stripe_customer_id      TEXT NOT NULL,
  stripe_price_id         TEXT NOT NULL,
  status                  TEXT NOT NULL,   -- active | past_due | canceled | paused
  current_period_start    TIMESTAMPTZ,
  current_period_end      TIMESTAMPTZ,     -- = prochaine échéance
  cancel_at_period_end    BOOLEAN DEFAULT FALSE,
  created_at              TIMESTAMPTZ DEFAULT NOW(),
  updated_at              TIMESTAMPTZ DEFAULT NOW()
);

-- pack_types : distinguer un abonnement d'un pack ponctuel
ALTER TABLE pack_types ADD COLUMN is_subscription BOOLEAN DEFAULT FALSE;
ALTER TABLE pack_types ADD COLUMN stripe_price_id TEXT;  -- Price récurrent Stripe

-- pack_purchases : tracer quel cycle a généré ce rechargement
ALTER TABLE pack_purchases ADD COLUMN subscription_id UUID REFERENCES subscriptions(id);
ALTER TABLE pack_purchases ADD COLUMN stripe_invoice_id TEXT;
```

**Le principe** : à chaque échéance payée, le webhook crée une **nouvelle ligne `pack_purchases`** exactement comme pour un achat ponctuel. Le reste de l'application — réservation, décompte, expiration, affichage — ne voit aucune différence. C'est ce qui rend la Phase 12 légère.

### 4.3 Illimité — à développer, rien n'existe

> **Vérifié dans le code le 2026-08-03 : l'illimité n'est pas implémenté.** Aucune occurrence de `unlimited` en base ; `pack_purchases.credits_remaining` est `NOT NULL` ; `get_available_pack()` filtre sur `credits_remaining > 0` ; `consume_credit()` fait un `-1` sec. C'est donc du développement, pas de la réutilisation.

**La règle, symétrique dans les deux sens :**

| Action | Pack normal | Pack illimité |
|---|---|---|
| Réservation | −1 crédit | **pas de décompte**, réservation enregistrée |
| Annulation (dans les délais) | +1 crédit | **pas de recrédit** |
| Annulation (hors délai) | crédit perdu | sans objet |

Le second point mérite d'être explicite, parce qu'il est facile à rater à l'implémentation : **si on n'a rien décompté à la réservation, il n'y a rien à rendre à l'annulation.** Un `+1` appliqué sans condition sur un pack illimité créerait des crédits à partir de rien.

> « Tu as un pack traditionnel, je fais moins 1. Tu as un pack illimité, je ne fais pas moins 1. C'est aussi con que ça. Mais j'enregistre la réservation. »

**Implémentation** : un booléen `is_unlimited` sur `pack_types` (plus lisible qu'un `credit_count NULL`, et sans toucher à la contrainte `NOT NULL` existante).

```sql
ALTER TABLE pack_types ADD COLUMN is_unlimited BOOLEAN DEFAULT FALSE;
```

Trois fonctions SQL à adapter :
- `get_available_pack()` — le filtre `credits_remaining > 0` doit laisser passer les packs illimités non expirés
- `consume_credit()` — ne décrémente pas si le pack est illimité
- la fonction de recrédit à l'annulation (`phase4.sql:111`, `install.sql:523`) — ne réincrémente pas si le pack est illimité

Dans tous les cas, la **réservation reste enregistrée normalement** dans `bookings` : c'est elle qui alimente le compteur de désistements du §3.2.

---

## 5. Intégration Stripe

**L'infrastructure existe déjà** : `create-checkout-session` et `stripe-webhook` sont en place, avec bascule test/live via `app_settings.stripe_mode`, et les clés en variables d'environnement. Tout ce qui suit est une **extension** de l'existant, pas une construction.

> **Reliquat Mollie.** Les tables `pack_purchases` et `registration_fees` portent une colonne `mollie_payment_id`, créée d'avance pour une migration abandonnée. Elle n'a jamais été ni écrite ni lue. Elle a été retirée des scripts d'installation (`install.sql`) et du type TypeScript, **mais volontairement pas supprimée des bases existantes** : un `DROP COLUMN` est irréversible et n'apporte rien ici. Elle disparaîtra d'elle-même à la prochaine installation propre. Le script historique `phase3.sql` la mentionne encore — c'est normal, il décrit un état passé déjà appliqué.

### 5.1 Cycle de 4 semaines

```ts
const price = await stripe.prices.create({
  currency: 'eur',
  unit_amount: packType.price_cents,
  recurring: { interval: 'week', interval_count: 4 },
  product_data: { name: packType.name },
})
```

> **`week` × 4, surtout pas `day` × 28.** Les deux font 28 jours, mais seul `week` garantit que l'échéance retombe toujours le même jour de la semaine — ce qui compte pour un studio à cours hebdomadaires. Plafond Stripe : 3 ans, sans rapport avec nos besoins.

Puis en Checkout : `mode: 'subscription'` au lieu de `mode: 'payment'`.

### 5.2 Réduction ponctuelle (parrainage)

```ts
const coupon = await stripe.coupons.create({
  duration: 'once',
  amount_off: 2000,      // 20 €
  currency: 'eur',
})
await stripe.subscriptions.update(subId, {
  discounts: [{ coupon: coupon.id }],
})
```

S'applique à la prochaine facture, puis Stripe le retire **automatiquement** de l'abonnement. Aucune logique de nettoyage à écrire.

**Variante pour un avoir calculé** (dédommagement de cours annulés) : `InvoiceItem` à montant négatif, sans `invoice` — il s'accroche à la prochaine facture et le motif apparaît dessus.

> À noter : la solution de repli imaginée en réunion — prélever la prime du parrain sur le paiement du filleul — devient **inutile**. Stripe fait ça nativement.

### 5.3 Décalage d'échéance (congés, blessure)

```ts
await stripe.subscriptions.update(subId, {
  billing_cycle_anchor: nouveauTimestamp,
  proration_behavior: 'none',   // l'intervalle est offert
})
```

Tous les cycles suivants suivent la nouvelle date. `'create_prorations'` si l'on veut facturer l'intervalle au prorata ; `trial_end` est une variante qui décale sans facturer.

### 5.4 Sécurité — non négociable

La **clé secrète Stripe ne doit jamais se trouver dans le bundle React**. Toutes les opérations ci-dessus passent par une Edge Function authentifiée avec contrôle du rôle admin :

```
bouton admin React → Edge Function (vérifie le rôle) → API Stripe
                                  ↓
              webhook Stripe → mise à jour des tables Supabase
```

C'est déjà l'architecture en place pour les paiements ponctuels. On la prolonge.

### 5.5 Événements webhook à traiter

| Événement | Action |
|---|---|
| `checkout.session.completed` (mode subscription) | créer `subscriptions` + 1re ligne `pack_purchases` |
| `invoice.paid` | **recharger** : nouvelle ligne `pack_purchases`, notification client |
| `invoice.payment_failed` | passer en `past_due`, notifier client + admin |
| `customer.subscription.updated` | synchroniser statut, dates, formule |
| `customer.subscription.deleted` | passer en `canceled` |

Le handler existant traite déjà `checkout.session.completed` pour les packs ; on ajoute les branches.

---

## 6. Écrans

### 6.1 Client

- **Page Packs** : les abonnements apparaissent à côté des packs, avec mention explicite du renouvellement automatique. C'est un point de vigilance commercial, pas seulement d'interface — « Chez le client, il faut qu'il comprenne que c'est un abonnement et que ça se renouvelle automatiquement. »
- **Mes packs** : afficher l'abonnement en cours, la date de prochaine échéance, les crédits restants, et un bouton « résilier » (= arrêt du renouvellement en fin de cycle).

### 6.2 Admin — fiche client

Trois actions nouvelles sur un abonnement :

1. **Décaler la prochaine échéance** (sélecteur de date) → congés, blessure
2. **Accorder une réduction ponctuelle** (montant ou %) → parrainage, geste commercial
3. **Résilier** l'abonnement

Plus, en consultation : statut de l'abonnement, historique des échéances, **compteur d'annulations et de désistements** (§3.2).

### 6.3 Admin — vue d'ensemble

Liste des abonnés actifs par formule, échéances à venir, abonnements en échec de paiement.

---

## 7. Périmètre — ce qui N'EST PAS dans cette phase

Sorti explicitement, à traiter ailleurs :

- **Personal training** — chantier distinct, non urgent. « Ce n'est pas le plus urgent, le reste est avant ça. Je gère tout sur WhatsApp. » Deux tensions non résolues (liberté d'agenda du coach vs auto-réservation ; premier contact humain). Piste si on le fait : créneaux d'1 h posés manuellement et répétables.
- **Granularité horaire au quart d'heure** — petit correctif technique, indépendant. « Il suffit que l'application propose de travailler par quarts d'heure. » Motif : éviter les chevauchements de cours.
- **Import TechnoGym** — action côté coachs (export CSV des membres, agendas, cours) pour tester sur données réelles.
- **Statistiques globales** — Phase 11 (admin avancé), hors sujet ici sauf le compteur d'annulations du §3.2.

---

## 8. Points ouverts

### Bloquants avant mise en production (pas avant le développement)

1. **Grille tarifaire** — prix des 4 formules, prix des packs ponctuels équivalents, frais d'inscription. Rien ne peut être mis en vente sans. Repères connus : 3 séances = 69 €, pack 10 séances / 3 mois.
2. **Migration des clients actuels** — que deviennent les crédits en cours au jour de la bascule ? Conservés jusqu'à épuisement (recommandé), convertis, ou délai de consommation ? Volonté exprimée : « Même les personnes [existantes], on devrait les passer en abonnement. »
3. **Échec de paiement** — valider la proposition du §3.7.
4. **Coût Stripe récurrent** — chiffrer l'impact des **13 prélèvements annuels** sur la marge de chaque formule, avant de figer les prix. Soulevé en réunion : « quand c'est récurrent, on paye un supplément pour chaque transaction ».

### À confirmer d'une phrase (le développement peut avancer sur l'hypothèse)

5. Crédits non consommés **perdus** en fin de cycle (§3.1)
6. Changement de formule = effet au cycle suivant, sans prorata (§3.6)
7. Résiliation = fin du renouvellement, droits jusqu'à la fin du cycle payé (§3.6)
8. Abonnement + pack ponctuel simultanés autorisés ? Si oui, ordre de consommation
9. Réserver au-delà de la fin du cycle en cours — hypothèse : oui, puisque le renouvellement est automatique

### Faible priorité

10. Annulation d'un cours par un coach : recrédit automatique ou geste admin
11. Jours fériés, fermetures exceptionnelles — hypothèse : décalage d'échéance à la main
12. Cours réservés à certaines formules, liste d'attente, transfert de séance, tarifs étudiants/seniors/couples

---

## 9. Critères d'acceptation

**Souscription**
- [ ] Un client souscrit un abonnement 4 crédits / 28 jours via Stripe Checkout en mode `subscription`
- [ ] `subscriptions` est créée, une ligne `pack_purchases` est générée avec 4 crédits et 28 jours de validité
- [ ] Le client voit son abonnement et sa prochaine échéance dans « Mes packs »

**Renouvellement**
- [ ] À l'échéance, `invoice.paid` génère une nouvelle ligne `pack_purchases` de 4 crédits
- [ ] Le client reçoit une notification
- [ ] Les crédits non consommés du cycle précédent ne sont pas reportés

**Consommation**
- [ ] Réserver décrémente d'un crédit ; annuler à plus de 24 h le recrédite ; à moins de 24 h, non

**Illimité** (symétrie des deux sens)
- [ ] Réserver avec un pack illimité **ne décrémente rien**, et la réservation apparaît dans l'historique
- [ ] Annuler une réservation illimitée **ne recrédite rien** (pas de crédit créé à partir de rien)
- [ ] Un pack illimité reste utilisable tant qu'il n'est pas expiré, quel que soit `credits_remaining`
- [ ] Les réservations et désistements d'un illimité alimentent bien le compteur de la fiche client

**Actions admin**
- [ ] Décaler l'échéance de 2 semaines : la date suivante est bonne, et **les cycles ultérieurs suivent la nouvelle date**
- [ ] Accorder 20 € de réduction : la prochaine facture est réduite, **la suivante revient au tarif plein**
- [ ] Résilier : plus de renouvellement, crédits conservés jusqu'à la fin du cycle payé
- [ ] La fiche client affiche le nombre d'annulations et de désistements

**Échec de paiement**
- [ ] `invoice.payment_failed` passe l'abonnement en `past_due` et notifie client + admin
- [ ] Aucune annulation automatique n'est déclenchée

**Sécurité**
- [ ] Aucune clé secrète Stripe dans le bundle React (vérifier le build)
- [ ] Les Edge Functions d'administration refusent un appel sans rôle admin

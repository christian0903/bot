---
type: handoff
agent: cowork
session-machine: mac-mini
session-date: 2026-08-05
domaine: "[[_developpement]]"
auteur: "[[@Christian Vanhenten]]"
statut: actif
created: 2026-08-05
tags:
  - claude/handoff
  - handoff
  - bot
  - stripe
  - abonnements
  - parrainage
---

# Handoff — App Bot : abonnements livrés, parrainage à tester

> Session du 2026-08-05. **14 commits poussés.** Les abonnements Stripe sont livrés et éprouvés en test. Le parrainage et les bons d'achat sont écrits et déployés, **mais rien n'a encore été testé** — c'est le premier travail de la prochaine session.

---

## Reprendre la session

```bash
cd ~/bot && claude
```

Puis : « on reprend le handoff bot ».

**Point de reprise : tester le parrainage de bout en bout** (scénario détaillé plus bas).

Le projet est sur **`/Users/christian/bot`** (disque interne). L'ancien emplacement `/Volumes/Sandisk2TB/_LocalSites/bot` est abandonné. `main` est aligné sur `origin/main`.

---

## Le premier travail : tester le parrainage

Tout est en place et déployé, rien n'est éprouvé. Le scénario, dans l'ordre :

**1. Récupérer un code de parrainage**
```sql
SELECT display_name, referral_code FROM profiles LIMIT 5;
```

**2. Inscrire un nouveau compte avec ce code**, puis payer les frais d'inscription (carte `4242 4242 4242 4242`).

**3. Vérifier la qualification** — c'est le cœur de ce qui a été construit :
```sql
SELECT status, qualified_at FROM referrals ORDER BY created_at DESC LIMIT 1;
SELECT code, user_id, amount_cents, origin, is_used, expires_at
FROM referral_rewards ORDER BY created_at DESC LIMIT 2;
```
Attendu : statut `qualified`, et **deux bons de 3000 centimes** (parrain + filleul).

**4. Utiliser un bon** sur un achat de pack : il doit être proposé avec le détail du calcul.

**5. Le cas nominal** — un bon de 30 € sur des frais d'inscription à 30 € : aucun paiement, tout se règle sans passer par Stripe (qui refuse les sessions à 0 €). C'est l'argument commercial retenu : **le parrainage rend l'inscription gratuite**.

**6. Le cas de la perte** — un bon de 30 € sur la carte séance unique à 25 € : l'avertissement doit annoncer les 5 € perdus, et le membre doit pouvoir reporter.

**7. Bon sur abonnement** — **le point le plus important** : première échéance réduite, **les suivantes au tarif plein**. Si le prix récurrent baissait, ce serait une perte permanente.

**8. Saisie du code au paiement** par un membre sans parrain.

**9. Outils admin** : rattacher un parrain, accorder un bon d'achat.

### Points de vigilance

- Un bon ne doit être consommé **qu'après paiement confirmé** : abandonner la page Stripe ne doit pas le faire disparaître
- Le rejeu d'un événement Stripe ne doit créer ni bons en double ni double consommation (les fonctions sont idempotentes, à vérifier)
- Un membre ne peut avoir qu'un seul parrain

---

## Restent aussi à tester (abonnements)

- **Renouvellement automatique** via *test clock* Stripe — jamais éprouvé
- **Suspension / reprise** d'abonnement
- **Bouton de remise à zéro** : la fonction `reset_member_purchases` **n'a pas encore été créée en base**. Le SQL est dans `supabase/migrations/20260805_reset_member_test_data.sql`, à exécuter dans le SQL Editor. C'est l'outil qui permet de rejouer un scénario proprement.

---

## Ce qui a été livré aujourd'hui

### Le pont Stripe — opérationnel

Bac à sable **`bot2`** isolé de l'autre application en production. Cinq Edge Functions déployées, webhook configuré, `stripe_mode = test`.

> **Le webhook n'avait jamais été déployé** — c'était le « maillon manquant » du 4 août. Il crédite désormais réellement.

**Validé en test** : frais d'inscription, achat de pack, souscription d'abonnement, réduction ponctuelle, report d'échéance, résiliation immédiate.

### Trois bugs préexistants corrigés

1. **API Stripe récente** (`2026-07-29.dahlia`) : `current_period_*` a migré vers `items.data[0]`, `invoice.subscription` sous `invoice.parent`. D'où une erreur 500 `"Invalid time value"` et aucun crédit.
2. **Ordre de livraison non garanti** : `invoice.paid` est arrivé une seconde **avant** `checkout.session.completed`, n'a pas trouvé l'abonnement, et est sorti en 200 sans créditer.
3. **Facture à 0 €** : le report d'échéance passe par `trial_end`, Stripe émet une facture à 0 € — comptée comme un cycle payé, elle créait **un second pack**.

### Écrans d'abonnement

- Page Packs regroupée par **type de crédit**, abonnements puis packs
- Mes packs : carte d'abonnement avec les crédits du cycle intégrés
- Résiliation en libre-service, un seul abonnement à la fois
- Fiche membre admin : réduction ponctuelle, report, suspension/reprise, résiliation

Deux décisions de fond : le **report prolonge le pack d'autant** (une maladie se compense, elle ne se met pas en pause), et la **résiliation immédiate clôture aussi les accès** (l'avertissement affiché était jusque-là mensonger).

### Réservation

Pop-up de confirmation à chaque réservation, avec choix de la source quand plusieurs existent. Message de refus explicite quand le type de crédit ne correspond pas.

### Parrainage et bons d'achat

**Le constat** : la qualification n'existait pas. Rien ne faisait passer un parrainage de `pending` à `qualified`, nulle part. La fonction avait pourtant été écrite en phase 6, puis archivée et jamais appelée. Reprise avec la règle : **qualification au premier achat payé**.

**Même constat pour les coupons** : l'admin peut en créer, le serveur sait les traiter, mais **aucun écran ne permet d'en saisir un**. Ils sont inutilisables depuis toujours.

**Deux trous de sécurité fermés** : `rewards_insert` et `referrals_insert` étaient en `WITH CHECK (true)` — n'importe quel membre pouvait **se créer un bon du montant de son choix**.

Le modèle unifié est cadré dans **`docs/cadrage-bons-achat.md`**.

---

## Ce qui n'est pas fait

- **Champ de saisie d'un coupon collectif** — les coupons restent inutilisables. À décider avec les coachs : les gardez-vous ?
- **Affichage des bons sur la page Parrainage client** — l'écran ignore les nouveaux champs
- **`regles-coupons-parrainage.md`** décrit encore l'ancienne règle et une qualification qui n'existait pas
- **Configuration Stripe pour super admin** (état de la connexion, bascule test/live)

---

## Demandes des coachs — analyse du 2026-08-05

### Déjà en place, à vérifier avant de développer

- **Bouton « aujourd'hui »** dans le planning : existe. Problème de visibilité.
- **Cases CGV / RGPD** : existent. Ce qui manque, ce sont les **documents** derrière (Christian les fournit).
- **Séparer semi-privé / personal training à l'achat** : **fait**.

### Simple, sans risque

| Demande | Remarque |
|---|---|
| Bloquer la consultation du passé | Le staff a besoin de l'historique → réserver aux clients |
| Crédits restants dans le planning | Dépend du type de crédit du cours |
| Garder la vue « jour » seule | La vue semaine sert sans doute aux coachs → distinguer par rôle |
| Message après inscription | Réel manque : on retombe sur la connexion sans rien dire |

### À cadrer

- **Demande de facture** : la reformulation en change la nature — demander un pack **avant** paiement, réglé par QR code, ajouté à la main. C'est un **second circuit de vente** parallèle à Stripe.
- **Accueil** : réseaux sociaux, WhatsApp, avis Google, blocs de cours, blocs-liens. Cela revient à une **page d'accueil éditable depuis l'administration**. À découper.

### Bloqué en attente de matière

Descriptions des cours, documents CGV.

---

## À nettoyer / vigilance

- **Faire tourner les clés de `bot2`** : le `sk_test_` et le `whsec_` ont transité en clair dans la conversation du 5 août. Sans danger (bac à sable), mais à renouveler avant la production. Le jour du passage en live, `sk_live_` et son `whsec_` ne doivent **jamais** apparaître nulle part.
- **CLI Supabase 2.84.2** : `supabase functions logs` n'existe pas dans cette version. Passer par le dashboard.
- **Le webhook est le seul endroit qui crédite** — et le seul qui consomme un bon.
- **Un Price Stripe est immuable** : le modifier casse les abonnements existants.

---

## Décisions bloquantes avant mise en production

1. **Grille tarifaire** — rien ne peut être mis en vente sans.
2. **Migration des clients actuels** — sort des crédits en cours.
3. **Bancontact en récurrent** — non vérifié chez Stripe, alors que la description fonctionnelle le donne pour obligatoire.
4. **Coût des transactions** — un cycle de 4 semaines produit **13 prélèvements par an**, pas 12.

### Questions pour les coachs sur les bons d'achat

Listées en fin de `docs/cadrage-bons-achat.md` : déclencheur de qualification, maintien des coupons collectifs, gestes commerciaux réellement pratiqués, montant du bon, durée de validité.

---

## Rappels de conception (ne pas les réinventer)

- **Un abonnement est un pack court qui se renouvelle tout seul.** Chaque échéance payée crée une ligne `pack_purchases` ordinaire.
- **Mollie est abandonné** (2026-08-03).
- **Une catégorie par client** — confirmé le 2026-08-05, ne pas passer au multiple.
- **Un bon s'utilise en entier**, jamais de solde partiel.
- **Sur un abonnement, Stripe soustrait** via `duration: 'once'` ; sur un achat ponctuel, c'est l'application. Ne **jamais** modifier le Price pour appliquer une remise.
- **Règle d'arbitrage** : « Une application complexe, c'est une fabrique à emmerdes. » L'exception se gère à la main.

---

## Documents de référence dans le projet

- `docs/journal-projet.md` — mis à jour ce jour, état des lieux complet
- `docs/cadrage-bons-achat.md` — le modèle des bons, écrit aujourd'hui
- `docs/stripe-deploiement.md` — procédure de déploiement (faite)
- `docs/dossier-fonctionnel-abonnement.md` — règles métier des abonnements
- `docs/regles-coupons-parrainage.md` — **périmé sur le parrainage**, à reprendre

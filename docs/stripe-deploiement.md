# Stripe — déploiement et test

> Procédure à suivre une fois, en mode **test**. Rien de ce qui suit ne touche à de l'argent réel.
> Projet Supabase : `aojguoqxbzqcganxgqem`

---

## Vue d'ensemble

```
Client clique « Acheter »
   ↓
create-checkout-session  (Edge Function, clé secrète)
   ↓  renvoie une URL
Page de paiement Stripe
   ↓  paiement confirmé
stripe-webhook           ← Stripe appelle cette URL
   ↓
pack_purchases créé, notification envoyée
```

Le webhook est le **seul** endroit où l'on crédite. Sans lui déployé, un paiement réussi ne donne aucun crédit.

---

## 1. Récupérer les clés Stripe (mode test)

Sur [dashboard.stripe.com](https://dashboard.stripe.com), **basculez en mode Test** (interrupteur en haut à droite).

Développeurs → Clés API → copiez la **clé secrète** : `sk_test_...`

---

## 2. Poser les secrets Supabase

```bash
cd /Volumes/Sandisk2TB/_LocalSites/bot

supabase login
supabase link --project-ref aojguoqxbzqcganxgqem

supabase secrets set STRIPE_SECRET_KEY_TEST=sk_test_VOTRE_CLE
```

Le secret du webhook viendra à l'étape 4 — il n'existe pas encore.

---

## 3. Déployer les trois fonctions

```bash
supabase functions deploy create-checkout-session
supabase functions deploy manage-subscription

# --no-verify-jwt est INDISPENSABLE ici : Stripe n'envoie pas de jeton
# Supabase. L'authenticité est garantie par la signature du webhook, vérifiée
# dans le code. Sans ce drapeau, Supabase rejetterait tous les appels de Stripe.
supabase functions deploy stripe-webhook --no-verify-jwt
```

Vérification :

```bash
supabase functions list
```

Les quatre doivent apparaître en `ACTIVE` : `create-checkout-session`, `stripe-webhook`, `manage-subscription`, plus les fonctions existantes.

---

## 4. Créer le webhook côté Stripe

Toujours en **mode Test** : Développeurs → Webhooks → **Ajouter un point de terminaison**.

**URL** :
```
https://aojguoqxbzqcganxgqem.supabase.co/functions/v1/stripe-webhook
```

**Événements à sélectionner** (exactement ces cinq) :

| Événement | Ce qu'il déclenche |
|---|---|
| `checkout.session.completed` | frais d'inscription payés, pack ponctuel crédité, abonnement créé |
| `invoice.paid` | échéance payée → recharge le pack (y compris le 1er cycle) |
| `invoice.payment_failed` | échec → statut `past_due`, membre et admins notifiés |
| `customer.subscription.updated` | statut, dates, suspension, résiliation programmée |
| `customer.subscription.deleted` | abonnement terminé |

Après création, Stripe affiche un **secret de signature** `whsec_...` :

```bash
supabase secrets set STRIPE_WEBHOOK_SECRET_TEST=whsec_VOTRE_SECRET
supabase functions deploy stripe-webhook --no-verify-jwt   # relancer après le secret
```

---

## 5. Vérifier le mode dans l'application

Réglages → le mode Stripe doit être sur **test**. En base :

```sql
SELECT value FROM app_settings WHERE key = 'stripe_mode';
-- attendu : {"mode": "test"}
```

> Ce réglage pilote **à la fois** le checkout et le webhook. Passer en `live` bascule les deux d'un coup.

---

## 6. Tester

### Cartes de test Stripe

| Carte | Résultat |
|---|---|
| `4242 4242 4242 4242` | paiement accepté |
| `4000 0000 0000 9995` | refusé (fonds insuffisants) |
| `4000 0000 0000 0341` | accepté puis échec au renouvellement |

Date d'expiration : n'importe quelle date future. CVC : trois chiffres au choix.

### Scénario 1 — frais d'inscription

1. Compte de test sans frais payés → page Packs → « Payer les frais d'inscription »
2. Carte `4242…`
3. Vérifier :

```sql
SELECT * FROM registration_fees ORDER BY created_at DESC LIMIT 1;
```

### Scénario 2 — pack ponctuel

1. Acheter un pack non récurrent
2. Vérifier :

```sql
SELECT pp.credits_remaining, pp.expires_at, pt.name
FROM pack_purchases pp JOIN pack_types pt ON pt.id = pp.pack_type_id
ORDER BY pp.created_at DESC LIMIT 1;
```

### Scénario 3 — abonnement

Prérequis : un type de pack avec `is_recurring = true` et sa périodicité. En attendant l'écran d'administration :

```sql
UPDATE pack_types
SET is_recurring = true,
    recurring_interval = 'week',
    recurring_interval_count = 4     -- 4 semaines = 28 jours
WHERE name = 'Abo illimité Gold';
```

1. Souscrire depuis la page Packs
2. Vérifier :

```sql
SELECT s.status, s.current_period_end, pt.name
FROM subscriptions s JOIN pack_types pt ON pt.id = s.pack_type_id
ORDER BY s.created_at DESC LIMIT 1;

-- le premier cycle doit avoir été crédité par invoice.paid
SELECT credits_remaining, expires_at, stripe_invoice_id
FROM pack_purchases WHERE subscription_id IS NOT NULL
ORDER BY created_at DESC LIMIT 1;
```

### Scénario 4 — renouvellement, sans attendre 4 semaines

Dans le dashboard Stripe (mode test) : Facturation → Abonnements → votre abonnement → **Actions** → « Faire avancer l'horloge » (*test clock*), ou créez l'abonnement avec une horloge de test dès le départ.

Une nouvelle ligne `pack_purchases` doit apparaître, avec un `stripe_invoice_id` différent.

---

## 7. En cas de problème

**Voir ce que le webhook a reçu** :
```bash
supabase functions logs stripe-webhook
```

**Côté Stripe** : Développeurs → Webhooks → votre point de terminaison → onglet « Tentatives ». Chaque appel y figure avec sa réponse. Le bouton « Renvoyer » permet de rejouer un événement — sans risque, le code est protégé contre le double crédit (index unique sur `stripe_invoice_id`).

| Symptôme | Cause probable |
|---|---|
| `401` sur toutes les tentatives | `--no-verify-jwt` oublié au déploiement du webhook |
| `Signature invalide` | mauvais `STRIPE_WEBHOOK_SECRET_TEST`, ou secret d'un autre point de terminaison |
| Paiement OK mais aucun crédit | webhook non déployé, ou événement non coché dans Stripe |
| `Clé Stripe test absente` | `supabase secrets set` non fait, ou fonction non redéployée depuis |
| Crédit en double | ne devrait pas arriver — signalez-le, l'index unique aurait dû l'empêcher |

---

## 8. Passage en production, plus tard

1. Refaire les étapes 1 à 4 en **mode Live** : clés `sk_live_...`, nouveau webhook, secret `whsec_...` distinct
   ```bash
   supabase secrets set STRIPE_SECRET_KEY_LIVE=sk_live_...
   supabase secrets set STRIPE_WEBHOOK_SECRET_LIVE=whsec_...
   ```
2. Basculer `stripe_mode` sur `live` dans les Réglages

> Les `stripe_price_id_test` et `stripe_price_id_live` sont stockés séparément sur chaque type de pack : les prix créés en test ne sont **pas** réutilisés en production. Les premiers achats en live créeront les prix correspondants automatiquement.

> Les abonnements créés en test n'existent pas côté live. Ils gardent `stripe_mode = 'test'` et resteront pilotés avec la clé de test — ils ne seront jamais facturés réellement.

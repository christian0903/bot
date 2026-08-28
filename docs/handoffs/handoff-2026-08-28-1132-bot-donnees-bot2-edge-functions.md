---
type: handoff
projet:
domaine:
session-machine: mac-mini
session-date: 2026-08-28
session-heure: "11:32"
auteur: "[[@Christian Vanhenten]]"
statut: actif
created: 2026-08-28
tags:
  - claude/handoff
  - bot
  - base-de-donnees
  - edge-functions
  - stripe
  - pg-dump
---

# Handoff — App Bot : les données dans bot2, les Edge Functions en attente

> Session du 2026-08-28, matinée. **v3.17.0**, un commit (`96a9cb2`) **poussé**,
> build vert, lint stable à 37 signalements React Compiler. Arbre de travail
> propre.
> **Interrompue volontairement** : des corrections urgentes remontées par les
> coachs passent devant.

---

## Où on en est

La copie des données de `bot` vers `bot2` est **terminée et vérifiée**. C'était
le point resté ouvert du handoff de la veille.

`bot2` contient 23 comptes, 23 profils, 28 rôles, 553 cours, 142 réservations,
36 achats de packs, 158 performances — tous les comptes correspondent au dump,
et six contrôles d'intégrité relationnelle ne trouvent aucun orphelin, malgré
les triggers désactivés pendant l'import.

**La connexion à `bot2` se fait désormais avec les identifiants de `bot`** :
`christian@aikicom.eu` y est `super_admin` et `admin`. Les deux comptes créés le
27 août ont été effacés par le vidage. L'application tourne sur `bot2`
(`.env` → `VITE_BASE=test`).

## Ce que la session a livré

Commit `96a9cb2`, six fichiers :

- `scripts/sauvegarder-bot.sh` — **nouveau**. Export seul, en lecture pure,
  aucune écriture sur aucune base. Sauvegarder ne doit pas obliger à accepter
  l'effacement de `bot2`.
- `scripts/copier-bot-vers-bot2.sh` — corrigé sur quatre points (pooler,
  `--table=public.*`, `app_settings` au vidage, garde-fou avant l'étape
  destructrice).
- `supabase/install.sql` + `supabase/migrations/20260828_invoice_requests_statuts_b2b.sql`
- `docs/journal-projet.md`, `package.json` (3.17.0)

## Les quatre pièges rencontrés

Le détail est au journal ; l'essentiel pour ne pas les rejouer :

1. **`bot` n'accepte plus la connexion directe.** `db.<ref>.supabase.co` refuse
   le port 5432 alors que le projet est `ACTIVE_HEALTHY` ; `bot2`, créée le
   27 août, répond encore en direct. Passer par le **pooler**, qui change l'hôte
   *et* l'utilisateur (`postgres.<ref>`). Le préfixe `aws-0`/`aws-1` ne se
   devine pas — les deux répondent au ping, un seul accepte le projet : il se
   lit dans Project Settings → Database → Connection string → Session pooler.
   Le script l'attend en variable `POOLER`.
2. **`--schema=public` est neutralisé par un `--table`.** Le dump ne sortait que
   les deux tables `auth`, pesait 28 Ko et s'annonçait comme un succès. Écrire
   `--table='public.*'`.
3. **Trois échecs d'import, trois causes.** `app_settings` en doublon (table de
   configuration préservée par le reset) ; contrainte
   `invoice_requests_status_check` trop étroite (migration du 7 août jamais
   reportée dans `install.sql`) ; colonne `mollie_payment_id` absente de
   `install.sql` (vestige du chantier abandonné le 3 août, vide sur ses
   11 lignes, retirée du fichier d'import).
4. **L'écran blanc après import venait de Vite**, pas de la base : le serveur
   gardait le `.env` lu à son démarrage, et la session pointait un compte
   effacé. **Redémarrer Vite après tout changement de `.env` ou de contenu de
   base** ; `localStorage.clear()` en console si l'interface ne répond plus.

---

## Prochaine action — Edge Functions sur `bot2`

**Bloquée sur une décision de Christian**, pas sur une difficulté technique.

**État** : 0 fonction déployée sur `bot2`. `bot` en a **8** (et non 10 comme
l'indiquait le journal — `create-user` et `send-notification` existent dans le
dépôt mais ne sont déployées nulle part).

> ⚠️ **La CLI est liée à `aojguoqxbzqcganxgqem`, c'est-à-dire `bot`, la
> production.** Un `supabase functions deploy` lancé tel quel partirait sur
> `bot`. Vérifier la cible avant toute commande.

**La décision en suspens — quelles clés Stripe sur `bot2` ?**

| | Effet |
|---|---|
| **(a) Clés de test seules** *(recommandé)* | `STRIPE_SECRET_KEY_TEST` renseignée, `..._LIVE` vide. Paiements en mode test, aucun encaissement réel possible. |
| **(b) Mêmes clés que `bot`, live comprises** | `bot2` devient capable de créer de vrais paiements et de créditer via le webhook. Risque disproportionné sur une base de dev. |
| **(c) Sans Stripe** | Seules 5 fonctions déployées (`admin-update-password`, `admin-update-email`, `process-email-queue`, `send-notification`, `create-user`). Paiements indisponibles. |

**Les secrets ne sont dans aucun fichier local** — ni `.env`, ni `.env.ops`, ni
`.env.test`. Ils vivent dans les secrets Supabase de `bot`, non lisibles. C'est
donc à Christian de les poser sur `bot2` :

```bash
# dashboard : Project Settings → Edge Functions → Secrets
# ou, sans coller la valeur dans la conversation :
supabase secrets set --project-ref dcfzupyzdrndqegyeafg STRIPE_SECRET_KEY_TEST=sk_test_...
```

Secrets requis selon les fonctions : `STRIPE_SECRET_KEY_TEST` / `_LIVE`,
`STRIPE_WEBHOOK_SECRET_TEST` / `_LIVE`, `RESEND_API_KEY`, `EMAIL_FROM`,
`EMAIL_REPLY_TO`, `APP_URL`. Les trois `SUPABASE_*` sont fournis
automatiquement.

**Deux points à ne pas oublier au déploiement** :

- `stripe-webhook` se déploie avec `--no-verify-jwt` (règle n° 4 du CLAUDE.md),
  et le drapeau se redemande à **chaque** déploiement. Contrôler ensuite avec
  `supabase functions list` que `VERIFY JWT = false`.
- Même avec les clés de test, le webhook ne recevra rien tant qu'un endpoint
  pointant vers `bot2` n'est pas déclaré dans le dashboard Stripe, avec son
  propre `STRIPE_WEBHOOK_SECRET_TEST`. Configuration côté Stripe, à faire
  manuellement.

---

## À refaire depuis zéro — la procédure n'est pas encore éprouvée

**La chaîne complète n'a jamais tourné d'un bout à l'autre sans intervention.**
Les trois échecs d'import ont été corrigés *en cours de route*, sur une base
déjà partiellement traitée : `app_settings` a été vidée à la main, la contrainte
`invoice_requests` élargie par une migration appliquée en séance, la colonne
`mollie_payment_id` retirée d'un fichier d'import bricolé dans le scratchpad, et
le chargement final lancé par un `psql` manuel — **pas par le script**.

Autrement dit : le résultat est bon, mais il ne prouve pas que
`copier-bot-vers-bot2.sh` fonctionne. Ce script, dans sa version corrigée, n'a
jamais été exécuté avec succès du début à la fin.

**Ce qu'il faut refaire, dans cet ordre** :

1. Réinstaller une base neuve depuis `install.sql` (celui corrigé, avec les cinq
   statuts `invoice_requests`) — ou repartir d'un projet vierge.
2. Promouvoir le premier `super_admin` avec `supabase/promouvoir-super-admin.sql`.
3. Lancer **le script seul**, sans aucune intervention manuelle :
   `POOLER=aws-N-eu-west-1.pooler.supabase.com ./scripts/copier-bot-vers-bot2.sh`
4. Ne rien corriger en cours de route. **Tout arrêt est un défaut de la
   procédure à consigner**, pas un incident à contourner — c'est précisément ce
   qu'on cherche à savoir.

**Ce qui reste incertain** : `mollie_payment_id` fera **échouer le script à
nouveau**. Le contournement de la session vivait dans un fichier temporaire, il
n'est pas dans le script. Deux issues possibles, à trancher à ce moment-là :
retirer la colonne de `bot` (elle est vide), ou apprendre au script à ignorer
les colonnes absentes de la cible. La première est plus propre, la seconde plus
tolérante aux divergences futures.

Tant que ce test n'a pas eu lieu, considérer la procédure comme **non
reproductible** : elle a produit un bon résultat une fois, avec un opérateur
qui corrigeait au fil de l'eau.

## Points ouverts

- **Bucket Storage `avatars` absent de `bot2`** : les avatars des 23 profils
  pointent vers des fichiers inexistants. Affichage dégradé, pas bloquant.
  À créer (public, 5 Mo) si besoin en dev.
- **`bot` traîne encore `mollie_payment_id`** sur `registration_fees`. Ici
  `install.sql` a raison de ne plus la créer et c'est `bot` qui est en retard.
  La retirer est une décision à prendre à froid, pas au détour d'un import.
- **Un contrôle systématique `bot` ↔ `install.sql` manque.** La migration du
  7 août non reportée n'a été découverte que parce qu'un import a buté dessus.
  La comparaison des 31 contraintes `CHECK` et des colonnes faite en séance
  n'a montré aucun autre écart, mais elle a été manuelle et ponctuelle.
- **Dumps dans `.dumps/`** (ignoré par git) : `bot-20260828-104047.sql` et
  `bot-20260828-105052.sql`, identiques. Le second est celui qui a été importé.

## Contexte de l'interruption

Christian enchaîne sur des **corrections urgentes remontées par les coachs**,
dans l'application elle-même. Le chantier Edge Functions reprend après.

# Créer la base opérationnelle — marche à suivre guidée

> **À copier-coller au début d'une nouvelle conversation Claude Code**, dans le
> dépôt `bot`. Ce document est écrit pour être lu par Claude autant que par
> Christian : il dit quoi faire, dans quel ordre, et ce qui a déjà mordu.
>
> Il a été établi le 2026-08-29 en créant `bot3` (base de test, Paris) de bout
> en bout. Tous les pièges qu'il signale ont réellement été rencontrés ce
> jour-là — ce ne sont pas des précautions théoriques.

---

## Consigne à Claude

**Guide-moi pas à pas. Attends mon retour après chaque étape avant de passer à
la suivante.** Ne lance pas plusieurs étapes d'affilée, même si elles
paraissent enchaînables.

Pour chaque étape : dis ce qu'on va faire et pourquoi, donne la commande ou le
geste exact, dis ce que j'attends comme résultat, et attends que je réponde.

Quand un contrôle échoue, **ne corrige pas à la main dans la foulée** :
c'est un défaut de la procédure, à consigner et à corriger dans le script ou
la documentation. C'est ce qui rend la prochaine installation plus sûre.

**Ne commite ni ne pousse rien sans mon accord explicite.**

---

## Ce que la répétition sur `bot3` a établi

Ces cinq points ont coûté du temps le 2026-08-29. Ils sont déjà corrigés dans
les scripts et la documentation ; les rappeler évite de les redécouvrir.

| Piège | Ce qu'il faut savoir |
|---|---|
| **Guillemets dans `.env.migration`** | Le fichier est lu par `source`, donc interprété par le shell. Un mot de passe contenant une parenthèse provoque `parse error`. Entourer de guillemets **simples** toute valeur qui n'est pas alphanumérique. |
| **Clé Resend** | Une clé « Sending access » répond **401 sur `/domains`** : elle autorise l'envoi, pas la lecture. Ne jamais tester une clé Resend autrement que par un **envoi réel** (`POST /emails`). |
| **Un secret n'est vu qu'au déploiement suivant** | Après `supabase secrets set`, **redéployer** la fonction qui l'utilise. Sinon elle tourne avec l'ancienne valeur, sans le dire. |
| **Le compte doit exister avant d'être promu** | `super_admin` se pose en SQL sur un compte déjà inscrit **et confirmé**. S'inscrire par l'application d'abord. |
| **La confirmation d'e-mail** | Le lien pointe vers le domaine configuré. S'il n'est pas encore déployé, la page sera introuvable — mais le clic confirme quand même. Sinon, confirmer en SQL (voir étape 6). |

---

## Avant de commencer — ce qu'il faut avoir sous la main

- [ ] Le **mot de passe Postgres** du nouveau projet (généré à sa création)
- [ ] La **clé publishable** du projet (Project Settings → API Keys)
- [ ] Une **clé Resend** (resend.com → API Keys → Create, permission *Sending access*)
- [ ] Le **code d'accès Stripe** — sans lui, les étapes 8 et 9 sont bloquées
- [ ] Le **sous-domaine** décidé, et son `.env` correspondant

---

## Étape 0 — Créer le projet Supabase

Dashboard Supabase → **New project**, dans l'organisation **Pro**.

| Réglage | Valeur | Pourquoi |
|---|---|---|
| Région | **Paris** (`eu-west-3`) | ~10 ms depuis la Belgique. **La région ne se change pas après coup.** |
| Mot de passe | bouton « Generate a password » | À conserver dans un gestionnaire. Ne sert qu'à `psql`. |
| « Automatically expose new tables » | **décoché** | `install.sql` pose ses propres `GRANT` (section 8). Décocher est sûr, et plus prudent : rien n'est exposé avant d'être protégé. |

> Une base tout juste créée met une minute à accepter les connexions.

**Noter la référence du projet** — les 20 lettres de son URL :
`https://supabase.com/dashboard/project/<ref>`

---

## Étape 1 — Le fichier de configuration

```bash
cd ~/bot
cp .env.migration.example .env.migration
```

Remplir **seulement** ces deux lignes pour l'instant :

```
CIBLE_REF=<ref du projet>
CIBLE_PASSWORD='<mot de passe postgres>'
```

⚠️ **Guillemets simples obligatoires** dès que le mot de passe contient autre
chose que des lettres et des chiffres.

**Contrôle** :

```bash
cd ~/bot && bash -c '
set -a; source .env.migration; set +a
echo "ref: $CIBLE_REF"; echo "mdp: ${CIBLE_PASSWORD:+renseigné}"'
```

Attendu : la référence, puis `renseigné`. Une erreur `parse error` signale un
problème de guillemets.

---

## Étape 2 — La base répond, et elle est vide

```bash
cd ~/bot && bash -c '
set -a; source .env.migration; set +a
PGPASSWORD="$CIBLE_PASSWORD" PGCONNECT_TIMEOUT=10 \
  /opt/homebrew/opt/libpq/bin/psql \
  -h "db.$CIBLE_REF.supabase.co" -p 5432 -U postgres -d postgres \
  -c "SELECT current_database(), COUNT(*) AS tables FROM pg_class WHERE relnamespace='"'"'public'"'"'::regnamespace AND relkind='"'"'r'"'"';"'
```

Attendu : **`postgres | 0`**.

Si « Connection refused » : le projet est trop récent pour être en cause —
vérifier la référence et le mot de passe. (Seuls les projets antérieurs à 2024
exigent le pooler.)

---

## Étape 3 — Installer le schéma et les fonctions

```bash
cd ~/bot && ./scripts/creer-espace-application.sh
```

Le script enchaîne : contrôles, `install.sql`, comptage des objets, contrôle
des droits, bucket Storage, déploiement des 10 Edge Functions, secrets,
super_admin. Puis il pose des questions de confirmation.

**Ce qui est normal en cours de route** :

- des `NOTICE: ... does not exist, skipping` — ce sont les `DROP IF EXISTS`
- sur `check-policies.sql`, **six lignes attendues sur `performances`**

**Compteurs attendus** — les relever et les signaler à Claude :

| | |
|---|---|
| tables | 27 |
| policies | 89 |
| fonctions | 80 |
| triggers | 14 |
| droits | les 27 tables lisibles par `authenticated` |

**Aux questions finales** : répondre honnêtement. `N` à ce qui n'est pas fait —
le récapitulatif sert à savoir ce qui reste ouvert.

> Le script réclamera `APP_URL`. Répondre avec l'URL du domaine visé
> (`https://<sous-domaine>.backontrackstudio.be`), même si le sous-domaine
> n'existe pas encore.

---

## Étape 4 — Authentication

Dashboard → **Authentication** → **Sign In / Providers** → carte **Email** :

| Réglage | Valeur | Pourquoi |
|---|---|---|
| Enable email provider | activé | |
| **Secure email change** | **OFF** | Sinon le membre doit cliquer **deux** liens ; l'application prévient elle-même l'ancienne adresse |
| Minimum password length | **12** | |

Puis **Save**.

Ensuite **URL Configuration** :

- **Site URL** : `https://<sous-domaine>.backontrackstudio.be`
- **Redirect URLs** : `https://<sous-domaine>.backontrackstudio.be/**`
  et `http://localhost:5173/**`

> Les `**` comptent : sans eux, seule la racine est autorisée et les liens de
> confirmation échouent.

**Pour la base de production, activer aussi Attack Protection** (CAPTCHA) :
`/auth` est publique et l'inscription ouverte à tous. À faire **avant**
l'ouverture aux vrais membres — après, le ménage des faux comptes se fait à la
main, sur des comptes qui portent déjà des données liées.

---

## Étape 5 — Brancher l'application

Récupérer la **clé publishable** : Project Settings → API Keys.

```bash
cd ~/bot
cat > .env.<nom> <<'FIN'
VITE_BASE=ops                      # 'ops' UNIQUEMENT pour la production
VITE_BASE_LIBELLE=<nom> — Paris    # ignoré si VITE_BASE=ops
VITE_SUPABASE_URL=https://<ref>.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=<clé publishable>
VITE_APP_URL=https://<sous-domaine>.backontrackstudio.be
FIN

cp .env.<nom> .env && npm run dev
```

Ouvrir `http://localhost:5173`.

- Sur une base de **test** (`VITE_BASE` ≠ `ops`) : le bandeau orange s'affiche
- Sur la **production** (`VITE_BASE=ops`) : aucun bandeau

> Si la page se charge, les `GRANT` sont en place — c'est déjà un contrôle.

---

## Étape 6 — Le premier super_admin

**S'inscrire par l'application** : Connexion → créer un compte. Mot de passe de
12 caractères minimum.

> Si le message « cet e-mail existe déjà » apparaît, c'est qu'une tentative
> précédente a réussi. Vérifier en base plutôt que de recréer.

Puis confirmer et promouvoir :

```bash
cd ~/bot && bash -c '
set -a; source .env.migration; set +a
ADRESSE="<votre@email>"
PGPASSWORD="$CIBLE_PASSWORD" /opt/homebrew/opt/libpq/bin/psql \
  -h "db.$CIBLE_REF.supabase.co" -p 5432 -U postgres -d postgres -qAt -v ON_ERROR_STOP=1 \
  -c "UPDATE auth.users SET email_confirmed_at = now() WHERE email = '"'"'$ADRESSE'"'"' AND email_confirmed_at IS NULL;" \
  -c "INSERT INTO user_roles (user_id, role) SELECT id, '"'"'super_admin'"'"' FROM auth.users WHERE email='"'"'$ADRESSE'"'"' ON CONFLICT DO NOTHING;" \
  -c "INSERT INTO user_roles (user_id, role) SELECT id, '"'"'client'"'"' FROM auth.users WHERE email='"'"'$ADRESSE'"'"' ON CONFLICT DO NOTHING;"
echo "--- controle ---"
PGPASSWORD="$CIBLE_PASSWORD" /opt/homebrew/opt/libpq/bin/psql \
  -h "db.$CIBLE_REF.supabase.co" -p 5432 -U postgres -d postgres -qAt \
  -c "SELECT u.email, u.email_confirmed_at IS NOT NULL, string_agg(r.role::text, '"'"', '"'"')
      FROM auth.users u LEFT JOIN user_roles r ON r.user_id = u.id
      WHERE u.email='"'"'$ADRESSE'"'"' GROUP BY u.id, u.email, u.email_confirmed_at;"'
```

Attendu : `<adresse>|t|client, super_admin`

> **Les deux rôles comptent.** Un compte qui n'aurait que `super_admin` ne
> pourrait pas réserver de cours : l'application suppose `client` présent pour
> tout ce qui relève de la réservation.

---

## Étape 7 — Resend et les e-mails

Créer une clé sur **resend.com → API Keys → Create API key**, permission
**Sending access**. **La copier immédiatement** : la valeur ne s'affiche
qu'une fois.

Ajouter à `.env.migration` (pas de guillemets nécessaires pour la clé) :

```
RESEND_API_KEY=re_...
EMAIL_FROM='Back On Track <no-reply@backontrackstudio.be>'
EMAIL_REPLY_TO='info@backontrackstudio.be'
APP_URL='https://<sous-domaine>.backontrackstudio.be'
```

**Contrôler la clé par un envoi réel** — jamais par `/domains`, qui répond 401
avec une clé pourtant valide :

```bash
cd ~/bot && bash -c '
set -a; source .env.migration; set +a
curl -s -X POST https://api.resend.com/emails \
  -H "Authorization: Bearer $RESEND_API_KEY" -H "Content-Type: application/json" \
  -d "{\"from\":\"$EMAIL_FROM\",\"to\":[\"<votre@email>\"],\"subject\":\"Test cle\",\"html\":\"<p>ok</p>\"}" \
  -w "\nHTTP %{http_code}\n"'
```

Attendu : **HTTP 200** avec un identifiant.

Poser les secrets **puis redéployer** — un secret n'est vu qu'au déploiement
suivant :

```bash
cd ~/bot && bash -c '
set -a; source .env.migration; set +a
npx supabase secrets set --project-ref "$CIBLE_REF" \
  RESEND_API_KEY="$RESEND_API_KEY" EMAIL_FROM="$EMAIL_FROM" \
  EMAIL_REPLY_TO="$EMAIL_REPLY_TO" APP_URL="$APP_URL"
npx supabase functions deploy send-email --project-ref "$CIBLE_REF"'
```

**Éprouver la chaîne complète** — c'est ce qui valide que les liens des
e-mails pointent au bon endroit :

```bash
cd ~/bot && bash -c '
set -a; source .env.migration; set +a
ANON=$(grep "^VITE_SUPABASE_PUBLISHABLE_KEY=" .env | cut -d= -f2- | tr -d "'"'"'\"")
read -rsp "Mot de passe du compte : " PW; echo
TOKEN=$(curl -s -X POST "https://$CIBLE_REF.supabase.co/auth/v1/token?grant_type=password" \
  -H "apikey: $ANON" -H "Content-Type: application/json" \
  -d "{\"email\":\"<votre@email>\",\"password\":\"$PW\"}" \
  | python3 -c "import sys,json; print(json.load(sys.stdin).get(\"access_token\",\"\"))")
[ -z "$TOKEN" ] && { echo "connexion refusee"; exit 1; }
curl -s -X POST "https://$CIBLE_REF.supabase.co/functions/v1/send-email" \
  -H "Authorization: Bearer $TOKEN" -H "apikey: $ANON" -H "Content-Type: application/json" \
  -d "{\"template\":\"booking_confirmed\",\"to\":\"<votre@email>\",\"vars\":{\"user_name\":\"Test\",\"class_name\":\"Test\",\"class_date\":\"demain 10:00\",\"coach_name\":\"Test\"}}" \
  -w "\nHTTP %{http_code}\n"'
```

Attendu : `{"ok":true,...}` et **HTTP 200**.

**Puis, dans l'e-mail reçu, survoler le bouton « Voir mes réservations »** :
l'adresse doit être `https://<sous-domaine>.backontrackstudio.be/my-bookings`.
Un lien sans domaine signifie qu'`APP_URL` n'est pas lu.

---

## Étape 8 — Stripe : la clé secrète

> **Bac à sable.** Le mode test standard est partagé entre tous les projets
> d'un compte Stripe : sans bac à sable, les webhooks se croisent. Christian a
> une autre application en production sur ce compte. Réutiliser un bac à sable
> existant, ou en créer un.

Dashboard Stripe → **Developers → API keys** → *Secret key* → **Reveal**.

Pour la **production**, c'est la clé `sk_live_` qu'il faut, prise hors du bac à
sable.

Ajouter à `.env.migration` :

```
STRIPE_SECRET_KEY_TEST=sk_test_...
STRIPE_SECRET_KEY_LIVE=sk_live_...     # production seulement
```

> Les clés API **appartiennent au compte Stripe** : elles se réutilisent d'une
> base à l'autre. Seul le `whsec_` de l'étape 9 ne se recycle pas.

---

## Étape 9 — Stripe : le webhook

**C'est ici que rate un déménagement.** Un webhook oublié coupe les
encaissements sans aucun signal visible.

Dashboard Stripe → **Developers → Webhooks → Add endpoint**.

**URL** :
```
https://<ref>.supabase.co/functions/v1/stripe-webhook
```

**Les cinq événements** — relevés du `switch` de `stripe-webhook/index.ts` :

```
checkout.session.completed
invoice.paid                      ← crédite les abonnements
invoice.payment_failed
customer.subscription.updated
customer.subscription.deleted
```

> Un événement non coché = « paiement accepté mais aucun crédit ». Et
> `invoice.paid` est celui qui crédite les abonnements, y compris le premier
> cycle — le confondre avec `invoice.payment_succeeded` est une erreur qui ne
> se voit qu'à la première vente perdue.

**Relever le `whsec_`** que Stripe affiche, l'ajouter à `.env.migration` :

```
STRIPE_WEBHOOK_SECRET_TEST=whsec_...
STRIPE_WEBHOOK_SECRET_LIVE=whsec_...   # production seulement
```

Puis poser les secrets et **redéployer avec le drapeau** :

```bash
cd ~/bot && bash -c '
set -a; source .env.migration; set +a
npx supabase secrets set --project-ref "$CIBLE_REF" \
  STRIPE_SECRET_KEY_TEST="$STRIPE_SECRET_KEY_TEST" \
  STRIPE_WEBHOOK_SECRET_TEST="$STRIPE_WEBHOOK_SECRET_TEST"
npx supabase functions deploy stripe-webhook --project-ref "$CIBLE_REF" --no-verify-jwt
npx supabase functions list --project-ref "$CIBLE_REF" | grep stripe-webhook'
```

> **`--no-verify-jwt` se redemande à chaque déploiement.** Stripe n'envoie
> aucun JWT Supabase ; sans ce drapeau, la plateforme rejette tous ses appels
> en 401 et plus rien n'est jamais crédité. L'authenticité est garantie par la
> signature du webhook, que la fonction vérifie elle-même.

**Contrôle du drapeau** — la sortie tabulaire ne montre pas toujours la
colonne ; la lire en JSON est sans ambiguïté :

```bash
cd ~/bot && bash -c '
set -a; source .env.migration; set +a
npx supabase functions list --project-ref "$CIBLE_REF" --output json 2>/dev/null | python3 -c "
import sys, json
for f in json.load(sys.stdin):
    if \"stripe\" in f.get(\"name\",\"\"):
        print(\"verify_jwt :\", f.get(\"verify_jwt\"), \"| statut :\", f.get(\"status\"))"'
```

Attendu : **`verify_jwt : False`**.

**Contrôle de la chaîne** — un appel sans JWT, avec une signature volontairement
fausse. C'est le test le plus parlant, et il ne touche à rien :

```bash
curl -s -X POST "https://<ref>.supabase.co/functions/v1/stripe-webhook" \
  -H "stripe-signature: t=1,v1=faux" -H "Content-Type: application/json" \
  -d '{"type":"test"}' -w "\nHTTP %{http_code}\n"
```

Comment lire la réponse :

| Réponse | Ce que ça dit |
|---|---|
| **400 « Signature invalide »** | ✅ Tout est en place : la plateforme laisse passer (drapeau OK) et la fonction lit son secret |
| 401 | ❌ Le drapeau `--no-verify-jwt` manque — redéployer |
| 500 « Configuration Stripe incomplète » | ❌ Le secret du webhook n'est pas posé, ou la fonction n'a pas été redéployée depuis |

**Enfin, un vrai événement** : sur la page du webhook, bouton **« Envoyer des
événements de test »** → `checkout.session.completed` → attendu **200**.

> Le bouton renvoie vers la CLI Stripe (`stripe trigger`), qui demande une
> installation. L'API `/v1/test_helpers/.../send_event`, elle, n'existe pas.

**Sans rien installer**, on peut signer un événement soi-même avec le `whsec_`,
exactement comme le fait Stripe. Le type `ping.test` est inconnu du `switch` de
la fonction : elle répond 200 par sa branche `default`, **sans rien écrire en
base**.

```bash
cd ~/bot && bash -c '
set -a; source .env.migration; set +a
python3 - <<PY
import hmac, hashlib, json, os, time, urllib.request
secret = os.environ["STRIPE_WEBHOOK_SECRET_TEST"]
ts = int(time.time())
corps = json.dumps({"id":"evt_test","object":"event","type":"ping.test",
                    "data":{"object":{}}}, separators=(",",":"))
signe = hmac.new(secret.encode(), f"{ts}.{corps}".encode(), hashlib.sha256).hexdigest()
req = urllib.request.Request(
    f"https://{os.environ[\"CIBLE_REF\"]}.supabase.co/functions/v1/stripe-webhook",
    data=corps.encode(),
    headers={"Content-Type":"application/json","stripe-signature":f"t={ts},v1={signe}"},
    method="POST")
try:
    with urllib.request.urlopen(req) as r: print("HTTP", r.status, "|", r.read(200).decode())
except urllib.error.HTTPError as e: print("HTTP", e.code, "|", e.read(200).decode())
PY'
```

Attendu : **`HTTP 200 | {"received":true}`**. C'est la preuve des trois maillons
à la fois — le drapeau laisse passer, le secret est lu, la signature est
vérifiée.

---

## Étape 10 — Le mode de paiement

`install.sql` amorce `stripe_mode` à **`test`** — le bon défaut pour une base
neuve.

Pour la **production**, le basculer en `live` : Administration → Réglages →
Mode paiement (réservé au `super_admin`).

> C'est une décision commerciale, pas un réglage technique : elle bascule
> **d'un coup** le paiement et le webhook. Ne la prendre qu'une fois tout le
> reste vérifié.

---

## Étape 11 — Le diagnostic

Se connecter à l'application, puis ouvrir **`/admin/diagnostic`** (menu
Administration, réservé au `super_admin`).

Sept contrôles. **Sur une base neuve correctement installée** :

| Bloc | Attendu |
|---|---|
| Environnement | la bonne référence, le bon libellé, `APP_URL` renseignée |
| Droits de lecture | **les 27 tables répondent** |
| Rôles | `client, super_admin` |
| Réglages | les 9 posés, mode de paiement conforme |
| Encaissements | « aucun achat en base » — normal |
| Storage | « accessible mais vide » — normal |
| Edge Functions | les 10 répondent |

Les `attention` sur « base de test » et « tables sans aucune ligne » sont
normaux sur une base neuve.

> Cette page voit la base **avec les yeux de l'application**. Elle ne remplace
> pas `check-policies.sql`, qui compte les policies une par une.

---

## Étape 12 — Déployer l'application

```bash
cd ~/bot
cp .env.<nom> .env && npm run build
```

Puis envoyer `dist/` vers le sous-domaine (rsync o2switch — voir
`guide-installation.md`).

**Contrôle** : ouvrir le site, vérifier la version affichée dans l'en-tête, et
que le bandeau correspond au rôle de la base.

---

## Point d'arrêt — la base est installée

À ce stade, la base est **opérationnelle et vide**. Elle porte sa structure,
ses droits, ses fonctions, ses secrets — et aucune donnée.

Récapitulatif à vérifier avant de la déclarer prête :

- [ ] Les 27 tables répondent (diagnostic)
- [ ] Les 10 Edge Functions répondent
- [ ] Un e-mail réel est parti, son lien pointe au bon endroit
- [ ] `stripe-webhook` porte `VERIFY JWT = false`
- [ ] Un événement de test Stripe répond 200
- [ ] `stripe_mode` est au bon réglage
- [ ] Le super_admin a bien ses deux rôles
- [ ] L'application est déployée et affiche la bonne version

---

## Ce qui vient après

**La configuration métier.** `install.sql` ne pose que le pack d'essai gratuit
et les deux types de crédits. Il reste à créer : types de cours, packs
vendables, coachs, planning. Deux voies — les ressaisir par l'interface admin,
ou migrer depuis une base existante puis effacer les données de vie.

**Les données**, le cas échéant : `./scripts/migrer-donnees.sh`. Il refuse de
tourner sur une cible habitée, et ne vide jamais rien de lui-même.

**Les fichiers du Storage** : `./scripts/copier-storage.sh`, avec les deux
clés `service_role`. Sans lui, les photos de cours et de coachs restent
introuvables.

---

## Documents liés

| | |
|---|---|
| `docs/strategie-base-neuve.md` | Pourquoi cet ordre, les trois sous-domaines, l'anti-robot |
| `docs/guide-installation.md` | L'installation dans le détail |
| `docs/stripe-deploiement.md` | La procédure Stripe complète |
| `docs/journal-projet.md` | L'historique des incidents cités ici |

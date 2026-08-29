# Monter une base neuve prête à devenir opérationnelle

> Ce document dit **comment passer d'une base de test à une base de production**,
> et pourquoi dans cet ordre. Il a été écrit le 2026-08-27, au terme d'une
> session qui a éprouvé chacune de ses étapes sur une base réelle.
>
> Il complète `guide-installation.md`, qui décrit *comment* installer.
> Celui-ci dit *dans quel ordre* et *avec quel filet*.

---

## Le principe

**On ne touche jamais à la base opérationnelle avant d'avoir vérifié la
nouvelle.** Chaque étape se valide sur une base jetable ; la production ne
bouge qu'en dernier, et l'ancienne reste vivante tant que la nouvelle n'a pas
fait ses preuves.

Ce n'est pas de la prudence excessive. `install.sql` a décrit pendant des
semaines des policies jamais appliquées — trois bugs du 6 août avaient cette
cause. Un fichier de reconstruction qu'on n'a jamais exécuté ne prouve rien
sur ce qu'il produit.

---

## Les trois bases

| Base | Rôle | Région | Plan |
|---|---|---|---|
| `bot` | production actuelle, données de test | Irlande | Pro |
| `bot2` | développement local, image de `bot` | Francfort | Free |
| *(à créer)* | production définitive | Francfort | Pro |

**Pourquoi Francfort.** Depuis la Belgique, Francfort est à ~10-15 ms contre
~20-30 ms pour l'Irlande. Les deux régions font tourner le même matériel : ce
n'est pas une question de puissance mais de distance. L'écart est mince, mais
la région **ne se change pas après coup** — autant la choisir juste quand la
base est neuve, c'est gratuit à ce moment-là et coûteux ensuite.

**Ce qui pèse davantage sur la vitesse ressentie**, dans l'ordre : le nombre
d'allers-retours par page, les index, la taille du compute. La région arrive
loin derrière. Ne pas migrer une base existante pour 15 ms.

---

## La marche à suivre

### 1. Créer le projet

Dashboard Supabase → New project, dans l'organisation **Pro**.

- Région : **Europe Central (Frankfurt)** — `eu-central-1`
- Mot de passe : le bouton « Generate a password », conservé dans un
  gestionnaire. Il ne sert qu'à `psql` ; l'application, elle, utilise les clés.
- Décocher **« Automatically expose new tables »** : Supabase le recommande
  lui-même, et `install.sql` pose ses propres policies. Laisser cette option
  exposerait des tables avant qu'elles ne soient protégées.

  > **Depuis le 2026-08-28, `install.sql` pose lui-même les `GRANT`** (section 8),
  > ce qui rend cette case sans effet sur le résultat final. Ce n'était pas le
  > cas avant : le fichier ne posait aucun droit de table, et la base installée
  > refusait toute lecture sur ses 27 tables — `permission denied for table`.
  > Le symptôme était trompeur : l'application se chargeait, la connexion
  > réussissait, mais tout écran restait vide et un `super_admin` n'avait
  > accès à rien. Aucun compteur de contrôle ne le voyait ; `check-policies.sql`
  > vérifie désormais aussi les droits.

### 2. Installer le schéma

Le fichier passe **d'un seul bloc** par `psql` — le découpage en sections A et
B ne vaut que pour l'éditeur SQL du dashboard, qui exécute tout dans une
transaction unique.

```bash
PGPASSWORD='<mot-de-passe>' /opt/homebrew/opt/libpq/bin/psql \
  -h db.<ref>.supabase.co -p 5432 -U postgres -d postgres \
  -v ON_ERROR_STOP=1 -f supabase/install.sql
```

`ON_ERROR_STOP=1` n'est pas facultatif : sans lui, `psql` continue après une
erreur et produit une base incomplète qui *paraît* installée.

Les `NOTICE` du type « trigger does not exist, skipping » sont normaux : ce
sont les `DROP ... IF EXISTS` qui ne trouvent rien sur une base vierge.

**Contrôle attendu** — ces chiffres sont ceux d'une base saine au 2026-08-27 :

```sql
SELECT
 (SELECT COUNT(*) FROM pg_class WHERE relnamespace='public'::regnamespace AND relkind='r') AS tables,      -- 27
 (SELECT COUNT(*) FROM pg_policies WHERE schemaname='public') AS policies,                                  -- 89
 (SELECT COUNT(*) FROM pg_proc WHERE pronamespace='public'::regnamespace) AS fonctions,                     -- 76
 (SELECT COUNT(*) FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid
   WHERE NOT t.tgisinternal AND c.relnamespace='public'::regnamespace) AS triggers;                         -- 12
```

Puis `supabase/check-policies.sql`, qui doit ne rien retourner — à l'exception
connue des six lignes sur `performances`, expliquées dans le fichier lui-même.

### 3. Le bucket Storage

`install.sql` crée le bucket `avatars` **et** ses policies — l'`INSERT INTO
storage.buckets` est en section 8b. Rien à faire à la main.

> *Corrigé le 2026-08-29 : ce paragraphe demandait de créer le bucket au
> dashboard. Le geste était inoffensif (`ON CONFLICT DO NOTHING`) mais inutile.*

Une seule chose échappe à cet `INSERT` : la **limite de 5 Mo par fichier**,
que `file_size_limit` ne renseigne pas. `creer-espace-application.sh` la pose ;
à la main, c'est Storage → `avatars` → Settings.

### 4. Authentication

Dashboard → Authentication :

- **Email provider** activé
- **Secure email change : OFF** — sinon le membre doit cliquer deux liens ;
  l'application envoie elle-même l'avertissement à l'ancienne adresse
- **Minimum password length : 12**
- **Site URL** : l'URL de production
- **Redirect URLs** : `https://<domaine>/**`, plus `http://localhost:5173/**`
  pour le développement

### 5. Edge Functions et secrets

```bash
npx supabase link --project-ref <ref>
npx supabase functions deploy send-email
npx supabase functions deploy admin-update-password
npx supabase functions deploy stripe-webhook --no-verify-jwt
supabase functions list    # contrôler : VERIFY JWT = false sur stripe-webhook
```

Le `--no-verify-jwt` du webhook **se redemande à chaque déploiement**.
L'oublier coupe les encaissements sans aucun signal visible.

Secrets à poser dans Dashboard → Edge Functions → Settings :
`RESEND_API_KEY`, le `whsec_` du webhook Stripe, et éventuellement
`EMAIL_FROM` / `EMAIL_REPLY_TO`.

### 6. Le premier super_admin

1. S'inscrire via l'application
2. Confirmer l'e-mail
3. Puis, en SQL :

```sql
INSERT INTO user_roles (user_id, role)
SELECT id, 'super_admin' FROM auth.users WHERE email = 'votre@email.com';
```

Ce `INSERT` direct est **le seul chemin** : depuis le 2026-08-06, `user_roles`
n'a plus aucune policy d'écriture, et `grant_user_role()` exige d'être déjà
admin. Le premier compte doit donc être posé en SQL, avant que la règle ne
puisse s'appliquer à lui-même.

### 7. Basculer l'application

`.env` de production :

```
VITE_SUPABASE_URL=https://<ref>.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=<clé publishable>
VITE_APP_URL=https://<domaine>
```

Puis `npm run build` et déploiement.

**Ne pas supprimer l'ancienne base tout de suite.** La garder quelques
semaines comme filet, puis la supprimer avec un dump conservé en local.

---

## Changer le domaine de l'application

Prévu avec la base neuve : `desk.backontrackstudio.be` devient
`app.backontrackstudio.be`.

**Ce qui n'est PAS affecté** : le webhook Stripe, dont l'URL pointe sur
`<ref>.supabase.co` et non sur le domaine. Le piège habituel ne joue pas ici.

**Ce qui l'est** :

| Où | Quoi |
|---|---|
| Secret `APP_URL` | Les liens de tous les e-mails. **Obligatoire** depuis le 2026-08-29 |
| `.env` de production | `VITE_APP_URL` — était vide, ce qui cassait déjà les liens de confirmation |
| Réglages Auth | Site URL et Redirect URLs, sinon la confirmation d'inscription échoue |
| `capacitor.config.ts` | Ligne commentée, mais elle sert au prochain build iOS |
| Déploiement | Le chemin rsync vers o2switch |

> **Garder `desk.` vivant quelques semaines**, en redirection vers `app.`. Les
> e-mails déjà partis portent l'ancienne adresse, et un membre peut cliquer un
> lien reçu la semaine précédente.

Le domaine n'est plus écrit en dur nulle part dans le code : les gabarits
d'e-mails repliaient dessus, et **aucun des onze appels à `sendEmail()` ne
passe `app_url`** — tous les liens transactionnels en dépendaient donc. Un
changement de domaine les aurait laissés pointer sur l'ancien, sans que rien
ne le signale tant que celui-ci répondait.

---

## Ce qui ne se copie pas avec une base

Une base neuve ne rapatrie rien de ce qui vit **à côté** d'elle. À refaire à
chaque fois :

- le bucket `avatars`
- les Edge Functions et leurs secrets
- les réglages Authentication
- le webhook Stripe, repointé sur la nouvelle URL, avec son nouveau `whsec_`

Et surtout : les **abonnements Stripe** portent le `stripe_customer_id` de
chaque client. Une base neuve les ignore. Tant que tout est en mode test, cela
ne coûte rien — mais **basculer avant le premier vrai client**, sinon il faut
traiter la reprise des abonnements existants, ce qui est un chantier à part.

---

## Développer sans toucher à la production

`bot2` sert à cela : l'application locale pointe sur elle, la production reste
intacte.

```
VITE_SUPABASE_URL=https://dcfzupyzdrndqegyeafg.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=<clé publishable de bot2>
```

Conseil : garder un `.env.production` avec les valeurs de la vraie base, et
travailler avec `.env` sur la base de développement. Basculer devient une copie
de fichier, sans risque de se tromper au moment de builder.

Pour charger `bot2` avec les données de la production :
`scripts/copier-bot-vers-bot2.sh`. Il demande les deux mots de passe à la
saisie, exporte, vide la cible, importe en une transaction, puis affiche les
compteurs.

> ⚠️ **Ce script ne convient qu'à des données de test.** Le jour où la
> production portera de vrais membres, il emporterait leurs noms, e-mails,
> téléphones, adresses et `medical_conditions` — des données de santé au sens
> de l'article 9 du RGPD. Il faudrait alors anonymiser à l'import : remplacer
> les champs identifiants par des valeurs factices en gardant structure et
> volumes.

Deux détails techniques que ce script règle, et qu'il faut connaître si on
refait la manipulation à la main :

- **`auth.users` et `auth.identities` doivent être du voyage.** Un dump du seul
  schéma `public` produirait des profils sans compte de connexion : plus
  personne ne pourrait se connecter.
- **Les triggers doivent être désactivés à l'import**, sinon
  `on_auth_user_created` recrée un profil pour chaque compte importé, en
  conflit avec ceux du dump. `--disable-triggers` de `pg_restore` **ne marche
  pas** sur Supabase : il exige d'être superutilisateur, ce que `postgres` n'y
  est pas. La voie qui fonctionne est `SET session_replication_role = 'replica'`
  autour de l'import.

---

## Remettre une base à zéro

`supabase/reset-test-data.sql` vide toutes les données en conservant les
comptes admin et `app_settings`.

Trois pièges qu'il traite, et qu'il faut connaître avant d'écrire quoi que ce
soit d'approchant :

1. **La moitié des clés étrangères vers `auth.users` sont en `NO ACTION`**, pas
   en `CASCADE`. Une table oubliée ne provoque donc pas une suppression
   partielle : elle fait échouer le `DELETE FROM auth.users`, tout à la fin.
2. **`app_settings.updated_by`** pointe vers un compte : il faut le détacher
   sans toucher aux réglages eux-mêmes.
3. **`member_categories`** ne peut pas être vidée avant les profils — les
   admins conservés y font encore référence par `profiles.member_category_id`.
   Ce piège-là n'a été trouvé qu'en exécutant réellement le script.

Le reset ne touche pas au schéma : après son passage, la base reste
structurellement identique, seules les données ont disparu.

---

## Pourquoi ne pas migrer une base existante

La tentation est de vouloir déplacer `bot` vers Francfort. À éviter :

- le gain est de ~15 ms par requête, imperceptible à l'usage ;
- la manipulation touche aux comptes de connexion, aux abonnements Stripe et
  aux secrets des Edge Functions ;
- un webhook Stripe qui arrive pendant la bascule, c'est un encaissement perdu
  sans aucun signal.

**Le bon moment pour choisir une région, c'est à la création.** Ensuite, on ne
migre que si un besoin réel l'impose — pas pour une optimisation marginale.

À noter : la mise en pause manuelle d'un projet est une fonction du plan
**Free**. Un projet Pro ne se met pas en pause ; il se garde (et se facture) ou
se supprime.

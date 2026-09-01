# Documentation développeur — Back On Track

> **À quoi sert ce document.** Reprendre le développement après plusieurs
> semaines sans avoir à fouiller : ce qui existe, où ça se trouve, et quelle
> commande lancer.
>
> Il **n'explique pas le fonctionnement métier** — cela vit dans
> `documentation-technique.md`. Ici, on répond à « où est-ce ? » et
> « comment je fais ? ».
>
> Il n'est **pas servi par l'application** : `/help` ne sert que `public/`, et
> ce fichier vit dans `docs/`.

---

## Les cinq commandes à connaître

Si vous ne deviez retenir que celles-là :

```bash
npm run dev                      # travailler en local
npm run build                    # vérifier que tout compile — AVANT tout commit
./deploiement.sh jag             # mettre en ligne sur le site de test
./deploiement.sh ops             # mettre en ligne en PRODUCTION
./scripts/version.sh             # quelle version est où, et dans quel commit
```

`npm run build` est le contrôle qui compte : il enchaîne TypeScript puis Vite,
et échoue sur la moindre erreur de type.

---

## Où est quoi

### À la racine

| | |
|---|---|
| `src/` | tout le code de l'application |
| `public/` | ce qui est servi tel quel (guides, icônes, images de la vitrine) |
| `supabase/` | la base : structure, migrations, Edge Functions |
| `docs/` | toute la documentation, dont ce fichier |
| `scripts/` | les outils de maintenance (voir plus bas) |
| `serveur/` | les fichiers `.htaccess`, versionnés mais **jamais déployés** |
| `dist/` | le résultat de la construction — jamais modifié à la main |
| `android/`, `ios/` | les enveloppes Capacitor pour les stores |
| `deploiement.sh` | **le seul script de mise en ligne** |
| `CLAUDE.md` | les règles de travail sur ce dépôt |

> `README.md` est le template Vite d'origine, **jamais adapté**. Il ne dit rien
> de ce projet — ne pas s'y fier.

### Dans `src/`

```
src/
├── App.tsx            toutes les routes, et la bascule vitrine / application
├── main.tsx           le point d'entrée
├── index.css          le style de l'application
├── vitrine.css        le style du site public — AUTONOME, ne dépend de rien
├── components/
│   ├── ui/            shadcn/ui — code généré, à ne pas remanier à la main
│   ├── common/        les briques partagées (états vides, chargement, dialogues)
│   ├── layout/        en-têtes, menus, pieds de page, sélecteur de mode
│   ├── admin/         les composants propres à l'administration
│   ├── auth/          connexion, inscription, gardes de route
│   └── vitrine/       les blocs du site public
├── contexts/          AuthContext, ModeContext — l'état partagé
├── lib/               supabase, utilitaires, journal d'activité
├── pages/
│   ├── (racine)       les écrans membres
│   ├── admin/         les écrans d'administration
│   ├── coach/         les écrans coach
│   └── vitrine/       les pages du site public
├── types/index.ts     tous les types de données
└── i18n/              les traductions FR / EN
```

**Le raccourci `@/`** pointe vers `src/` : `import { supabase } from '@/lib/supabase'`.

---

## La base de données

C'est le point qui coûte le plus cher quand on l'oublie.

### `install.sql` — la source de vérité

`supabase/install.sql` (5 400 lignes environ) doit pouvoir **reconstruire une
base complète à partir de rien** : 28 tables, 84 fonctions, les policies, les
triggers, les index.

> **Règle absolue** : toute migration appliquée se reporte dans `install.sql`
> **dans le même commit**. Une migration oubliée rend le fichier faux *en
> silence* — il paraît fonctionner et produit une base incomplète.
>
> Le rattrapage différé échoue systématiquement : le 7 août, douze migrations
> reprises en fin de session avaient laissé passer une table, cinq fonctions,
> un trigger, quatre colonnes, deux index et un réglage.

Une policy RLS se reporte **aussi** dans `check-policies.sql`.

### Les migrations — oui, elles existent encore

`supabase/migrations/` contient **72 fichiers**. Chacun est un bout de SQL qui
fait évoluer la structure : ajouter une table, une colonne, une fonction, une
policy. Ensemble, ils racontent comment la base est passée de rien à son état
actuel.

**Deux façons de les appliquer**, et une seule est utilisable ici :

| | |
|---|---|
| **L'éditeur SQL de Supabase** | On ouvre le fichier, on colle son contenu, on exécute. C'est **la méthode de ce projet**. |
| **Le CLI (`supabase db push`)** | Le CLI compare les migrations locales à ce que la base dit avoir reçu, et applique celles qui manquent. **Inutilisable ici** — voir ci-dessous. |

#### `supabase db push`, et pourquoi il est interdit ici

**Ce que la commande fait.** Supabase tient dans chaque base une table
`supabase_migrations.schema_migrations` : la liste des migrations déjà
appliquées, identifiées par un **numéro de version** extrait du nom de fichier.
`db push` compare cette liste au dossier local et applique ce qui manque, dans
l'ordre. Sur un projet normalement nommé, c'est la bonne façon de faire.

**Ce qui cloche ici.** Le CLI attend un horodatage à **14 chiffres** —
`20260805143022_nom.sql`, soit date + heure + minute + seconde. Il ne lit que
ce préfixe pour en déduire la version.

Or, sur les 72 migrations de ce projet :

| Format | Nombre |
|---|---|
| 14 chiffres — ce que le CLI attend | **1** |
| 8 chiffres — `20260805_nom.sql` | **67** |
| Sans date du tout — `add-unlimited-packs.sql` | **4** |

**Conséquence directe** : le CLI tronque à 14 caractères, donc toutes les
migrations d'une même journée portent la **même version** à ses yeux. Le
2026-08-28 en compte **dix**, le 2026-08-07 également. Il en voit une, croit
les neuf autres absentes de la base — et veut les rejouer.

Les quatre sans date, il ne sait pas les ordonner du tout.

> **Ce que `db push --dry-run` annonce aujourd'hui** : rejouer **50 migrations
> déjà appliquées**, dont `20260805_reset_member_test_data.sql` — sur une
> production de 64 comptes réels.

**Ce n'est pas théorique.** Le 31 août, un `db push` a été lancé : il en a
appliqué **trois avant d'échouer**, dont `20260830_retirer_pack_essai.sql`, un
chantier dont la décision n'était même pas prise. La fonction existe désormais
en base et il faudra une suppression pour la défaire.

**Cause première de cet incident** : un `supabase migration repair --status
reverted` lancé sur une hypothèse non vérifiée. D'où le corollaire :

> `migration repair` **ne se lance jamais sur une supposition**. Vérifier
> d'abord *en base* ce que la migration visée a réellement créé.

#### Comment appliquer une migration, concrètement

1. Ouvrir le tableau de bord Supabase du projet visé → **SQL Editor**
2. Coller le contenu du fichier
3. Exécuter, et **lire le résultat** — une erreur y est silencieuse si on ne
   regarde pas
4. **Reporter la migration dans `install.sql`**, dans le même commit
5. Si elle crée une policy RLS, la reporter **aussi** dans `check-policies.sql`

> **Pourquoi ce détour reste vivable.** Une migration se joue une fois, sur
> deux bases (test puis production). Le coût est faible ; celui d'un `db push`
> qui rejoue cinquante migrations sur la production ne l'est pas.

**Ce qui rendrait `db push` de nouveau utilisable** : renommer les 72
migrations avec un horodatage à 14 chiffres, à froid, en synchronisant la table
`schema_migrations` des deux bases. C'est un chantier inscrit au journal, pas
une opération de passage.

#### Vérifier qu'une base est conforme

Après toute migration, deux outils disent si les bases divergent :

```bash
psql "$URL" -f supabase/check-schema.sql     # la structure
./scripts/comparer-bases.sh                  # compare deux bases entre elles
```

> **La méthode qui a servi le 31 août** : comparer les **empreintes MD5 de
> `prosrc`** entre les deux bases après chaque migration appliquée à la main.
> C'est ce qui confirme que les deux portent la même fonction, au caractère
> près.

### Les autres fichiers de `supabase/`

| | |
|---|---|
| `check-schema.sql` | vérifier qu'une base est conforme |
| `check-policies.sql` | l'inventaire des policies RLS |
| `seed-demo-*.sql` | jeux de données de démonstration |
| `reset-test-data.sql` | remettre les données de test à zéro |
| `promouvoir-super-admin.sql` | donner le rôle super admin |
| `test-book-class*.sql` | éprouver la réservation, y compris en concurrence |
| `_archive/` | ce qui ne sert plus, gardé pour mémoire |

### Les Edge Functions

#### Ce que c'est, et pourquoi il y en a

Ce projet **n'a pas de serveur applicatif** : le navigateur parle directement à
Supabase. C'est simple et rapide, mais cela pose une limite — **tout ce que le
front sait, le visiteur peut le lire**. Une clé secrète Stripe placée dans le
code de la page serait lisible par n'importe qui.

Les Edge Functions sont la réponse : de petits programmes en **Deno**
(TypeScript côté serveur) hébergés par Supabase, appelés par le front mais
exécutés **chez Supabase**. Leurs secrets n'atteignent jamais le navigateur.

**Trois raisons de passer par une Edge Function** :

| | Exemple ici |
|---|---|
| **Un secret ne doit pas fuir** | La clé Stripe, la clé Resend, la clé de service Supabase |
| **Une décision ne doit pas être prise par le client** | Créditer un pack après paiement : le front n'est pas digne de confiance |
| **Un tiers doit nous appeler** | Stripe appelle `stripe-webhook` quand un paiement aboutit |

> **La règle qui en découle.** Si un traitement peut être fait dans le front
> sans risque, il y reste : une Edge Function ajoute un aller-retour réseau et
> un déploiement à ne pas oublier. On n'en crée une que pour l'une des trois
> raisons ci-dessus.

#### Les onze fonctions

**Argent et abonnements**

| | |
|---|---|
| `create-checkout-session` | Ouvre une page de paiement Stripe. **Ne crédite rien** — elle prépare, c'est tout. 545 lignes : elle porte packs, abonnements, coupons et démarrage différé. |
| `stripe-webhook` | **Le seul endroit qui crédite.** Stripe l'appelle quand un paiement aboutit. 719 lignes, la plus grosse du projet. |
| `manage-subscription` | Changer, suspendre ou reprendre un abonnement. |
| `cancel-my-subscription` | L'annulation, demandée par le membre lui-même. |

**Comptes** — elles utilisent `auth.admin.*`, réservé à la clé de service, donc
impossible depuis le front.

| | |
|---|---|
| `create-user` | Crée un compte depuis l'administration. Vérifie que l'appelant est admin ou coach. |
| `admin-update-email` | Change l'adresse d'un membre, et lui envoie le lien de confirmation. |
| `admin-update-password` | Réinitialise un mot de passe. |

**Courriels et notifications**

| | |
|---|---|
| `send-email` | L'envoi proprement dit, par **Resend**. |
| `process-email-queue` | Vide la file d'attente — les envois sont différés plutôt qu'immédiats. |
| `send-notification` | Écrit une notification dans l'application. |
| `contact` | Le formulaire du site vitrine. Limite de cinq envois par heure et par IP, comptée en base. |

#### Déployer une fonction

```bash
supabase functions deploy <nom>
supabase functions list          # contrôler ce qui est en ligne
```

> ### ⚠️ Le webhook Stripe redemande son drapeau à chaque déploiement
>
> ```bash
> supabase functions deploy stripe-webhook --no-verify-jwt
> supabase functions list    # contrôler : VERIFY JWT = false
> ```
>
> **Pourquoi.** Par défaut, Supabase exige un jeton d'authentification valide.
> C'est la bonne règle pour une fonction appelée par un membre connecté — mais
> **Stripe n'est pas connecté** : c'est un serveur tiers qui appelle depuis
> l'extérieur, sans jeton. Sans `--no-verify-jwt`, Supabase le refuse.
>
> **Ce que ça coûte de l'oublier** : Stripe encaisse, mais l'appel est rejeté.
> Le paiement passe, **les crédits n'arrivent jamais**, et rien ne le signale.
> Le membre a payé pour rien, et personne ne le sait avant sa réclamation.
>
> Le drapeau ne se retient pas d'un déploiement à l'autre : **il est à
> repasser à chaque fois**.

> **La sécurité du webhook ne repose pas sur le JWT** mais sur la **signature
> Stripe** : chaque appel est signé, et la fonction vérifie cette signature
> avant d'agir. Un faux appel est rejeté.

#### Les secrets

Ils ne vivent pas dans le dépôt mais dans Supabase :

```bash
supabase secrets list
supabase secrets set NOM=valeur
```

**Ne jamais les mettre dans un `.env` du front** : tout ce qui commence par
`VITE_` finit dans le navigateur, par construction.

#### Voir ce qui s'est passé

Une Edge Function qui échoue ne dit rien à l'écran. Ses journaux sont dans le
tableau de bord Supabase → **Edge Functions** → la fonction → **Logs**.

> C'est le premier endroit à regarder quand un paiement n'a pas crédité ou
> qu'un courriel n'est pas parti.

---

## Publier sur l'App Store et le Play Store

L'application est une **PWA** : elle s'installe déjà sur un écran d'accueil
sans passer par un store. Les stores sont l'étape d'après, et **Capacitor** est
ce qui la rend possible sans réécrire l'application.

### Comment ça marche

Capacitor enveloppe le site dans une application native : une coquille Android
ou iOS qui affiche l'application web en plein écran. C'est **le même code** —
`android/` et `ios/` ne contiennent que l'enveloppe et sa configuration
(`capacitor.config.ts` à la racine).

```bash
npm run cap:sync        # construit, puis recopie dans android/ et ios/
npm run cap:android     # ouvre le projet dans Android Studio
npm run cap:ios         # ouvre le projet dans Xcode
```

> **`cap:sync` lance `npm run build` avant de recopier.** Une modification non
> construite ne part donc jamais dans l'enveloppe.

### Savoir ce qui manque

```bash
./scripts/verifier-mobile.sh
```

Ce script dit ce qui est prêt et ce qui bloque : icônes, écrans de démarrage,
identifiants d'application, versions. **À lancer en premier** — il évite de
découvrir un manque une fois dans Xcode.

### Ce qu'il faut avant de commencer

| | |
|---|---|
| **Compte développeur Apple** | 99 $/an. **Pas encore ouvert** au 2026-09-01. |
| **Compte Google Play** | 25 $ une fois. **Pas encore ouvert.** |
| **Un Mac** | Obligatoire pour iOS — Xcode n'existe pas ailleurs. |
| **Android Studio** | Pour la version Android. |

> Ces deux comptes sont **le premier chantier** : leur ouverture prend quelques
> jours côté Apple (vérification d'identité, parfois d'entreprise). Rien ne
> peut être soumis avant.

> **Côté Android, une clé de signature reste à créer.** Elle n'existe pas
> encore, et elle est irremplaçable : **la perdre interdit définitivement de
> mettre à jour l'application publiée** — il faudrait en republier une autre,
> sous un nouveau nom, en perdant les installations existantes. Sa création et
> sa sauvegarde sont détaillées dans `publier-app-store.md`.

### Ce qui bloque le plus souvent, et qu'on découvre tard

**Apple refuse les applications qui ne sont qu'un site web** — règle 4.2,
« Minimum Functionality ». C'est le motif de rejet le plus fréquent pour une
application construite ainsi. `publier-app-store.md` explique pourquoi le
risque est ici **modéré**, et ce qu'il faut mettre en avant : notifications,
écran d'accueil, fonctionnement hors ligne.

**Les paiements — le point est déjà tranché, et dans le bon sens.** Apple exige
son achat intégré (15 à 30 % de commission) pour le contenu **numérique**, mais
en **exempte** les services physiques. Back on Track vend des **séances en
salle**, consommées par un pointage au studio : c'est l'exemption
**3.1.3(e)**, et elle est solide.

Deux précautions en découlent :

- **Le dire dans la fiche et les notes de soumission.** Un évaluateur sans ce
  contexte pourrait classer les packs en contenu numérique.
- **Ne jamais écrire dans l'application qu'on peut payer moins cher ailleurs**,
  ni renvoyer vers un site de paiement : c'est la règle anti-steering, et elle
  se sanctionne durement.

L'argumentaire complet est dans `publier-app-store.md`.

**La politique de confidentialité** doit être accessible depuis une URL
publique. Elle existe : `/confidentialite`.

**Les captures d'écran** sont demandées dans plusieurs tailles, et refaites à
chaque changement d'allure notable.

### La procédure détaillée

`publier-app-store.md` porte le pas-à-pas : création des fiches, certificats,
profils de provisionnement, envoi, réponses aux rejets.

Ce chapitre-ci ne dit que **ce qu'il faut savoir avant de s'y mettre**.

---

---

## Mettre en ligne

**`./deploiement.sh` est le seul script de mise en ligne.** Il prend une cible :

| Commande | Va sur | Base | Rôle |
|---|---|---|---|
| `./deploiement.sh jag` | `jag.backontrackstudio.be` | bot3 | test |
| `./deploiement.sh ops` | `app.backontrackstudio.be` | bot-ops | **production** |
| `./deploiement.sh site` | `site.backontrackstudio.be` | bot-ops (lecture) | vitrine, démonstration |
| `./deploiement.sh prod-site` | `backontrackstudio.be` | bot-ops (lecture) | **la vitrine publique** |

Ce qu'il fait, dans l'ordre : copie le bon `.env`, **vérifie que la
construction vise la bonne base**, construit, contrôle la version, envoie, puis
relit le site en ligne pour confirmer.

**Les cibles de production demandent de taper `OUI`.** Pour enchaîner sans
invite : `echo "OUI" | ./deploiement.sh prod-site`.

> **L'envoi se fait en deux temps** — les fichiers construits d'abord, la page
> ensuite. Sans cela, `index.html` pouvait être remplacé avant les fichiers
> qu'il nomme : le visiteur qui chargeait à cet instant recevait un écran
> blanc, que le service worker mettait ensuite en cache. Un client l'a signalé
> le 31 août.

**Les `.htaccess` ne sont jamais déployés** : ils vivent dans `serveur/` et se
recopient à la main (`scp`), sinon `--delete` les emporterait à chaque envoi.

### Les fichiers d'environnement

Un par cible. `.env` est **écrasé** à chaque déploiement par celui de la cible
choisie — c'est voulu, mais il faut le savoir : après un `deploiement.sh
prod-site`, `.env` pointe sur la vitrine.

```
.env.jag          test              .env.ops       production
.env.site         vitrine démo      .env.prod-site vitrine publique
.env.migration    les migrations de données
.env.example      le modèle, sans secrets
```

Les fichiers `*.perime` sont d'anciennes configurations, conservées pour
mémoire.

---

## Les scripts de `scripts/`

| Script | Ce qu'il fait |
|---|---|
| `version.sh` | **Le lien version ↔ commit.** Sans argument, les dix dernières versions ; avec un numéro, son commit et **s'il touche la base** |
| `sauvegarder-bot.sh` | Sauvegarde les données de production dans un fichier local |
| `comparer-bases.sh` | Compare le **schéma** de deux bases et dit ce qui diverge |
| `creer-espace-application.sh` | Étape 1 — crée la structure complète sur un projet Supabase neuf |
| `migrer-donnees.sh` | Étape 2 — copie les données vers une base déjà structurée |
| `copier-bot-vers-bot2.sh` | Copie la production vers une base de développement |
| `copier-storage.sh` | Copie les fichiers du bucket `avatars` d'une base à l'autre |
| `verifier-mobile.sh` | Ce qui est prêt, et ce qui manque, pour soumettre aux stores |
| `import-demo.ts` | Charge un jeu de démonstration |

---

## Versions et retour en arrière

**Chaque commit incrémente la version mineure** dans `package.json`
(`3.115.0` → `3.116.0`), et depuis la v3.116.0 pose une **étiquette git**.

```bash
./scripts/version.sh              # les dix dernières versions
./scripts/version.sh 3.109.0      # son commit, et si elle touche la base
git checkout v3.116.0             # s'y replacer (versions ≥ 3.116.0)
```

**Trois domaines peuvent porter trois versions différentes** — c'est le
fonctionnement normal, et c'est ce qui permet d'éprouver longuement sur `jag.`
sans que les membres en voient rien.

La procédure complète de retour en arrière est dans
`versions-et-retour-arriere.md`. Le point à retenir : **le code revient en
arrière, la base non**. Vérifier avec `./scripts/version.sh <version>` si un
retour est sans conséquence.

---

## Avant de livrer

```bash
npm run build     # tsc + vite — doit passer
npm run lint      # doit rester à 37
```

> **Le lint sort 37 signalements résiduels**, tous du React Compiler. Ils
> portent sur du code qui tourne et qui a été validé à l'écran ; les corriger
> change le comportement au runtime. C'est un chantier à mener page par page,
> **pas** un nettoyage de lint.
>
> **Ne pas les traiter au passage, et ne pas laisser ce nombre augmenter.**

Pour une modification touchant Stripe ou les crédits, l'écran ne suffit pas :
éprouver au **test clock** (procédure dans `documentation-technique.md`).

---

## Les six règles qui coûtent cher

Elles sont détaillées dans `CLAUDE.md`, chacune correspondant à un incident
réel. En résumé :

1. **Toute migration se reporte dans `install.sql`**, dans le même commit
2. **Version mineure incrémentée** à chaque commit, plus l'entrée dans
   `nouveautes.md` et l'étiquette git
3. **Un guide modifié dans `docs/` se recopie dans `public/`** — `/help` sert
   `public/`, rien ne les synchronise
4. **Le webhook est le seul endroit qui crédite**, et son déploiement redemande
   `--no-verify-jwt`
5. **Ne jamais lancer `supabase db push`**
6. **Toujours tester `error` après une écriture Supabase** — un refus d'écriture
   ne lève pas d'exception, et un `UPDATE` qui ne touche aucune ligne ne renvoie
   pas d'erreur (utiliser `upsert` pour écrire-ou-créer)

---

## Conventions de code

**Architecture.** Pas de serveur applicatif : le front parle directement à
Supabase, et les opérations sensibles passent par les Edge Functions.

**Langue.** Tout en français — code, commentaires, commits, documentation. Les
commentaires expliquent *pourquoi*, jamais *quoi*.

**Bilingue.** Deux styles coexistent : `useTranslation()` avec `src/i18n/*.json`
pour les textes durables, et `const isFr = i18n.language === 'fr'` en ligne pour
les libellés ponctuels. **Suivre ce que fait déjà le fichier ouvert.**

**Types.** Deux pièges appris à leurs dépens :

- Une jointure PostgREST peut arriver comme un **objet ou un tableau d'un
  élément**. Passer par `one()` de `@/lib/supabase-joins`, jamais par un
  `as any` — le cast éteint aussi le contrôle sur le champ lu, et une faute de
  frappe ne se voit alors qu'à l'écran, en `undefined`.
- `ScheduledClass.coach` est un `CoachRef`, pas un `Profile` : `profiles` est
  protégée par RLS et ne peut pas être jointe.

**Statut d'un cours.** Toujours **dérivé** (date + `is_cancelled` + nombre
d'inscrits), jamais stocké.

**Le mode ≠ les droits.** `ModeContext` choisit ce qu'on affiche ; les
autorisations restent portées par `RoleGuard` et les policies RLS.

---

## Où trouver le reste

| Question | Document |
|---|---|
| Où en est le projet, ce qui reste à faire | `journal-projet.md` — **à lire en premier** |
| Comment ça marche, quels pièges | `documentation-technique.md` |
| Installer une base neuve | `guide-installation.md`, `creer-base-operationnelle.md` |
| Ce que voit l'utilisateur, l'admin | `guide-membre.md`, `guide-admin.md` |
| Ce qui change à chaque version | `nouveautes.md` — destiné aux coachs |
| Revenir à une version antérieure | `versions-et-retour-arriere.md` |
| Confier la vitrine à un designer | `confier-la-vitrine.md` |
| Déployer Stripe | `stripe-deploiement.md` |
| Publier sur les stores, le pas-à-pas | `publier-app-store.md` |
| Reprendre une session interrompue | `handoffs/` |

---

## L'état de l'environnement

- **Les données en base sont des données de test**, assumées comme telles. Les
  statistiques paraîtront anormalement basses : le seed a produit beaucoup de
  cours sans participants.
- L'application tourne sur **Stripe**. La migration vers Mollie inscrite au plan
  initial a été **abandonnée** le 2026-08-03 — le plan la mentionne encore par
  endroits, ne pas s'y fier.
- `VITE_APP_URL` figure dans `.env.example` mais **pas** dans `.env` — à
  vérifier avant de dépendre de cette variable.

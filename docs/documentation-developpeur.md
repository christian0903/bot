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

`supabase/migrations/` contient **72 fichiers**. Elles restent la trace de ce
qui a été appliqué, dans l'ordre.

> ### ⚠️ Ne jamais lancer `supabase db push`
>
> Supabase attend un horodatage à **14 chiffres** (`20260805143022_nom.sql`) ;
> les migrations de ce projet n'en portent que **8** (`20260805_nom.sql`). Le
> CLI ne retient que ce préfixe : les migrations d'un même jour partagent donc
> la même version, et il les croit absentes de la base.
>
> `db push --dry-run` veut aujourd'hui rejouer **50 migrations déjà
> appliquées**, dont un `reset_member_test_data` — sur une production de
> 64 comptes.
>
> Le 31 août, un `db push` en a appliqué **trois** avant d'échouer, dont un
> chantier dont la décision n'était pas prise.
>
> **Comment appliquer une migration** : l'éditeur SQL du tableau de bord
> Supabase, ou l'outil `apply_migration`. Jamais le CLI.
>
> Corollaire : `migration repair` ne se lance **jamais sur une hypothèse**.
> Vérifier d'abord en base ce que la migration visée a réellement créé — c'est
> un `repair` hasardeux qui a déclenché ce `db push`.

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

`supabase/functions/` — **onze fonctions** en Deno. Ce sont elles qui portent
les opérations sensibles : les clés secrètes ne quittent jamais ce périmètre.

```
admin-update-email        admin-update-password     cancel-my-subscription
contact                   create-checkout-session   create-user
manage-subscription       process-email-queue       send-email
send-notification         stripe-webhook
```

**Déploiement** :

```bash
supabase functions deploy <nom>
```

> ### ⚠️ Le webhook Stripe redemande son drapeau à chaque fois
>
> ```bash
> supabase functions deploy stripe-webhook --no-verify-jwt
> supabase functions list    # contrôler : VERIFY JWT = false
> ```
>
> L'oublier **coupe les encaissements sans aucun signal visible**.
>
> Et rappel : **le webhook est le seul endroit qui crédite**. Jamais le front,
> jamais `create-checkout-session` — créditer ailleurs, c'est offrir des
> crédits à qui ferme la page avant de payer.

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
| Publier sur les stores | `publier-app-store.md` |
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

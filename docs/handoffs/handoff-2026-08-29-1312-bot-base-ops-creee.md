---
type: handoff
projet:
domaine:
session-machine: mac-mini
session-date: 2026-08-29
session-heure: "13:12"
auteur: "[[@Christian Vanhenten]]"
statut: actif
created: 2026-08-29
tags:
  - claude/handoff
  - bot
  - base-de-donnees
  - migration
  - securite
  - app-store
---

# Handoff — App Bot : bot3 en service, bot-ops créée et vide

> Session du 2026-08-29, journée entière. **v3.53.0**, onze commits poussés
> (`ac80010..d6fbb29`), build vert, lint stable à 36.

---

## Où on en est

### Les bases

| Base | Référence | Région | Rôle | État |
|---|---|---|---|---|
| `bot3` | `cvyslqnojcgnjfgynczw` | Paris | test et développement, sur `jag.` | **en service, chargée** |
| `bot-ops` | `xgwrxbkrfypklrnqbftv` | Paris | production future, sur `app.` | **créée, VIDE** |
| ~~`bot`~~ | — | — | ancienne base de développement | **supprimée** le 29/08 |

> `bot` n'a jamais été une production. Sa sauvegarde est dans
> `.dumps/bot-20260829-120547.sql` (388 Ko, 27 tables + les comptes,
> vérifiée) — **elle ne vit que sur le Mac mini**, `.dumps/` étant ignoré par
> git. C'est désormais la seule trace de cette base.

> ⚠️ **Le plan Pro n'inclut qu'un seul projet actif.** Un second coûte 10 $/mois
> (vérifié auprès de l'API). D'où la suppression de `bot` avant la création de
> `bot-ops`. `bot3` vit sur une **autre organisation**, en plan Free — un projet
> Free se met en pause après une semaine d'inactivité.

### `bot-ops` — ce qui reste à faire

Rien n'y est installé. La marche à suivre est
`docs/creer-base-operationnelle.md`, éprouvée le jour même sur `bot3` : douze
étapes, un point d'arrêt après chacune.

Deux points propres à cette installation-ci :

- **`APP_URL` vaut `https://app.backontrackstudio.be`**, pas `jag.`
- **Les secrets de `.env.migration` sont ceux de `bot3`** : clé Resend `jag`,
  clés Stripe du bac à sable BackOnTrack. Pour la production, il faudra une
  clé Resend distincte, les clés Stripe **live** et un webhook sur le compte
  réel. Installer d'abord en mode test, basculer ensuite — une base qui tourne
  en test vaut mieux qu'une base à moitié configurée en live.

---

## Ce que la journée a livré

### La procédure de migration, éprouvée de bout en bout

Deux scripts remplacent les quatre qui s'étaient empilés :

| Script | Rôle |
|---|---|
| `scripts/creer-espace-application.sh` | Étape 1 — schéma, droits, Storage, 10 Edge Functions, secrets, super_admin, puis checklist des points manuels |
| `scripts/migrer-donnees.sh` | Étape 2 — concordance des structures, refus si la cible est habitée, export, import, Storage |
| `scripts/sauvegarder-bot.sh` | Inchangé dans son rôle : le seul qui ne fait que lire |

**La chaîne complète est passée sans une seule intervention** — ce que le
handoff du 28 août posait comme objectif en notant que ça n'avait jamais été
obtenu. Onze compteurs identiques de part et d'autre, 8 fichiers du bucket
copiés, aucun orphelin, soldes de crédits concordants membre par membre.

**Zéro image en URL absolue** : le correctif du 28 août tient. C'était le
défaut que le journal redoutait le plus.

### Une page de diagnostic dans l'application

`/admin/diagnostic`, réservée au `super_admin`. Sept contrôles, chacun avec son
remède. Elle regarde la base **avec les yeux de l'application** — le point de
vue qui manquait le 28 août, quand une base paraissait installée et refusait
toute lecture.

### Deux fuites de données personnelles, trouvées et fermées

Ni l'une ni l'autre n'est venue d'une revue de sécurité : la première d'une
alerte du dashboard, la seconde d'une demande de lien de menu.

**`coach_profiles`** exposait `email` et `phone` des coachs, avec un `GRANT` à
`anon` — lisibles par n'importe qui avec la clé publishable du site.

**`profiles`** exposait **tout** : 23 profils complets, 23 e-mails, 21
téléphones, 17 adresses, des dates de naissance, des contacts d'urgence et un
`medical_conditions` — donnée de santé au sens de l'article 9 du RGPD.

**État final** : un membre ne lit que son propre profil ; le staff lit tout ;
la vue `profils_publics` (id, nom, photo) sert le planning et les listes.
Vérifié avec l'identité d'un membre simple — 1 profil lisible, 1 téléphone
visible, le sien.

> **Un défaut d'ordre dans `install.sql`** aurait annulé tout cela sur une base
> neuve : le `REVOKE` d'`anon` était posé en section 6, alors que la section 8
> refait `GRANT ... ON ALL TABLES TO anon` — et `ALL TABLES` inclut les vues.
> Les deux `REVOKE` sont désormais en fin de fichier.

> **La leçon, à rejouer sur `bot-ops`** : ce qu'un écran affiche ne dit rien de
> ce qu'il rapatrie. Le seul test qui prouve quelque chose est un `curl` avec la
> clé publishable, sur chaque table, après toute modification de policy.

### Le reste

- **Le logo sort du code** : déposer `public/logo.svg` suffit, sans
  reconstruction. `docs/adapter-le-style.md` dit ce qui se change et ce que ça
  coûte.
- **Les guides revus** : une consigne fausse retirée (la validité d'un
  abonnement, qui invitait à corriger une situation normale), un tableau cassé
  réparé, le diagnostic expliqué. Trois sections techniques périmées retirées de
  la version anglaise.
- **`/profile/:id` supprimée** — aucun lien n'y menait.
- **`/stats` a enfin un lien** de menu.
- **Packs hors catalogue** : même couleur ambre partout où ils apparaissent.

---

## Le programme

### Immédiat — l'App Store

Christian veut publier l'application sur l'App Store iPhone, puis Android.
L'application est déjà une PWA installable et `capacitor.config.ts` existe
(`appId: be.backontrackstudio.app`). **Chantier non commencé.**

### Ensuite — installer `bot-ops`

Avec `docs/creer-base-operationnelle.md`, puis basculer `app.` dessus.

### Les sous-domaines

| | |
|---|---|
| `jag.backontrackstudio.be` | `bot3` — test, **en service** |
| `app.backontrackstudio.be` | `bot-ops` — production, à venir |
| `desk.backontrackstudio.be` | redirection 301 vers `app.` à la bascule |

---

## Points ouverts

- **Le dump de `bot` ne vit que sur le Mac mini.** À copier ailleurs.
- **L'accès SSH à o2switch est refusé depuis cette machine** (`Permission
  denied (publickey)`). Christian déploie lui-même ; la clé
  `~/.ssh/bot_o2switch` existe mais le serveur la rejette — à réautoriser dans
  cPanel si le déploiement doit se faire d'ici.
- **`bio` et `coach_description`** restent saisissables dans le profil mais ne
  s'affichent plus nulle part depuis la suppression de `/profile/:id`. Les
  retirer effacerait des textes déjà écrits — décision à prendre.
- **La version anglaise des guides** a 621 lignes contre 1147 en français. Un
  avertissement en tête dit laquelle fait foi ; la remettre à niveau est un
  chantier à part.
- **La clé `service_role` de `bot` avait fuité dans l'historique git.** Sans
  objet depuis la suppression de la base, mais le réflexe vaut pour `bot-ops` :
  ne jamais mettre de clé dans un fichier versionné.
- **La protection anti-robot (CAPTCHA)** n'est activée sur aucune base.
  `/auth` est publique et l'inscription ouverte à tous. À poser sur `bot-ops`
  **avant** l'ouverture aux vrais membres.

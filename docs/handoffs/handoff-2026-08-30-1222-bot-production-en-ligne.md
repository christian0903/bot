---
type: handoff
projet:
domaine:
session-machine: mac-mini
session-date: 2026-08-30
session-heure: "12:22"
auteur: "[[@Christian Vanhenten]]"
statut: actif
created: 2026-08-30
tags:
  - claude/handoff
  - bot
  - production
  - app-store
  - securite
---

# Handoff — App Bot : la production existe, elle attend son contenu

> Deux journées enchaînées (29 et 30 août). **v3.74.0**, une trentaine de
> commits poussés (`ac80010..849acac`), build vert, lint stable à 36, arbre
> propre.

---

## Où on en est

| Base | Référence | Sert | État |
|---|---|---|---|
| `bot-ops` | `xgwrxbkrfypklrnqbftv` | `app.backontrackstudio.be` | **production — installée, VIDE** |
| `bot3` | `cvyslqnojcgnjfgynczw` | `jag.backontrackstudio.be` | test, chargée |
| ~~`bot`~~ | — | — | supprimée le 29/08 |

Les deux sites servent **la v3.74.0**, chacun sur sa base.

> `bot` n'a jamais été une production. Sa sauvegarde,
> `.dumps/bot-20260829-120547.sql`, **ne vit que sur le Mac mini** — `.dumps/`
> est ignoré par git. C'est la seule trace de cette base.

---

## Le programme

### 1. Les coachs encodent — c'est ce qui bloque tout le reste

`bot-ops` est vide. L'ordre est décrit dans le guide admin, section « Démarrer
sur une base neuve » : **les catégories de membres avant les packs**, un pack ne
pouvant désigner qu'une catégorie existante.

**C'est aussi ce qui bloque l'App Store** : un évaluateur qui ouvre un planning
vide coche « minimum functionality ». `./scripts/verifier-mobile.sh` le
contrôle.

### 2. Puis la soumission

- Compte Apple **acheté**, au nom propre de Christian
- Projet iOS et Android **à niveau**, visant `bot-ops`
- Reste : le contenu, un **compte de démonstration avec le rôle coach** — sans
  lui, l'évaluateur ne verra jamais le scanner de QR — et la fiche
- Tout est dans `docs/publier-app-store.md`

### 3. Avant l'ouverture aux vrais membres

| | |
|---|---|
| **SPF** | ne mentionne pas Resend — les e-mails partent avec un signal négatif, surtout chez Outlook et Hotmail |
| **hCaptcha** | reporté : il exige aussi le widget côté code. L'activer à moitié casserait toutes les inscriptions |
| **Stripe live** | endpoint sur le compte réel, clés `_LIVE`, redéploiement avec `--no-verify-jwt`, puis bascule de `stripe_mode` |

---

## Ce qu'il faut savoir pour reprendre

### Le déploiement

```bash
./deploiement.sh jag     # test
./deploiement.sh ops     # production, confirmation écrite demandée
```

Bascule du `.env`, build, contrôle que `dist/` ne porte aucune trace de l'autre
base, envoi, relecture du site en ligne.

> **`.env` n'est jamais déployé, mais Vite grave ses valeurs dans `dist/`** :
> l'URL de la base apparaît dans onze fichiers minifiés. Un `dist` est lié à une
> base avant d'être envoyé — le même dossier ne peut pas servir les deux
> sous-domaines.

L'en-tête affiche `-dev` hors production, rien en production. Le pied de page
nomme les deux cas.

### Ce qui ne voyage ni avec `install.sql` ni avec un dump

Le SMTP en est l'exemple coûteux : un coach n'a pas pu créer son compte le 29,
faute de ce réglage — Supabase limite à **deux e-mails par heure** sans serveur
propre. Il est désormais dans la checklist du script.

Idem : réglages Auth, secrets, webhook Stripe, fichiers du bucket.

### Le contrôle qui prouve quelque chose

Après toute modification de policy, sur chaque table :

```bash
curl "https://<ref>.supabase.co/rest/v1/<table>?select=*" -H "apikey: <clé publishable>"
```

**Ce qu'un écran affiche ne dit rien de ce qu'il rapatrie.** Les deux fuites du
29 août ont été trouvées ainsi, pas en lisant le code.

---

## Points ouverts

- **Le dump de `bot` ne vit que sur le Mac mini.** À copier ailleurs.
- **`bio` et `coach_description`** restent saisissables mais ne s'affichent plus
  nulle part depuis la suppression de `/profile/:id`. Décision à prendre.
- **Les guides anglais** ont 621 lignes contre 1147 en français. Un
  avertissement en tête dit laquelle fait foi.
- **Reprise des clients** : étude faite, rien développé. Cent clients, deux
  types de crédits. `docs/coachs-reprise-clients.md` explique la solution aux
  coachs. Le format dépendra de ce que TechnoGym sait exporter.
- **Notifications push** : non faites, non nécessaires à la soumission. Le cas
  qui les justifie est la place libérée en liste d'attente, valable deux heures.

---

## Les documents à connaître

| | |
|---|---|
| `docs/creer-base-operationnelle.md` | Créer une base de zéro, douze étapes éprouvées |
| `docs/publier-app-store.md` | Soumettre aux stores, Apple et Google |
| `docs/coachs-mise-en-ligne-app.md` | À transmettre aux coachs |
| `docs/coachs-reprise-clients.md` | À transmettre aussi, si l'import les intéresse |
| `docs/adapter-le-style.md` | Logo et couleurs |
| `docs/strategie-base-neuve.md` | Sous-domaines, anti-robot, ce qui ne se copie pas |

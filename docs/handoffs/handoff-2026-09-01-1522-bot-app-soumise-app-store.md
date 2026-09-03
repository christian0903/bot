---
type: handoff
projet:
domaine:
session-machine: mac-mini
session-date: 2026-09-01
session-heure: "15:22"
auteur: "[[@Christian Vanhenten]]"
statut: actif
created: 2026-09-01
tags:
  - claude/handoff
  - bot
  - app-store
  - ios
  - vitrine
---

# Handoff — L'application part chez Apple, la vitrine imite le WordPress

> **v3.124.0**, **39 commits non poussés** (`eaa7bc9` → `82c563b`).
> Build vert, arbre propre, lint à **37**.
> `.env` est propre — pas de `VITE_VITRINE` résiduel.

---

## Où on en est

| Domaine | Sert | Version |
|---|---|---|
| `backontrackstudio.be` | la vitrine | **3.112.0** — douze versions de retard |
| `app.` | production (bot-ops) | 3.123.0 |
| `jag.` | test (bot3) | 3.123.0 |
| `wp.` | l'ancien WordPress, consultable | — |

Le retard de la vitrine ne porte que sur de la documentation et du mobile :
rien de visible pour un visiteur. À déployer quand même, pour ne pas
laisser diverger.

**L'app iOS est soumise** — build 7, en attente de vérification depuis le
1ᵉʳ septembre 15h10. Réponse sous 48 h, **sortie manuelle** : elle ne
paraîtra que le jour où Christian cliquera sur « Publier ».

---

## Ce qui a été livré

**La vitrine copie la page d'accueil du WordPress** — hero vidéo, fond
noir, Bebas Neue, onze sections, les six questions d'origine, la grille
de cours du page-builder. Demande répétée trois fois par Christian :
*une copie fidèle, texte et style*.

Les valeurs ont été relevées en **mesurant les deux sites côte à côte**
dans le navigateur, pas en lisant le HTML archivé. C'est ce qui a révélé
le conteneur à 1072 px (Bricks imbrique deux fois 90 %), l'absence de
`min-width` sur l'iframe, et l'en-tête transparent.

**Le WordPress est de nouveau consultable** sur `wp.backontrackstudio.be`,
par **deux lignes** dans `wp-config.php`. Aucune réécriture de base :
elle porte 32 755 URLs, dont des chaînes **PHP sérialisées** (`s:29:"…"`)
qu'un `sed` aurait détruites en silence — la longueur déclarée ne
correspondrait plus.

**Le planning suit le mode choisi** — un admin ou un coach qui bascule en
mode Membre voit ce que voit un client. Éprouvé sur `jag.`, puis porté
sur `app.`.

**Un super admin peut créer un membre** — `create-user` ne testait que
`['admin','coach']` ; `super_admin` était absent de la liste. Corrigé
dans le code plutôt qu'en accordant un rôle de plus à Christian.
Déployée sur les **deux** bases.

**L'app iOS est prête et soumise** : iPhone seul, version reportée depuis
le dépôt, compte de démo, captures, description, tarif, cinq pays.

**Trois outils** :
- `scripts/version.sh` — version ↔ commit, et signale si une version
  touche la base
- `scripts/version-mobile.sh` — reporte la version dans iOS et Android
- `docs/documentation-developpeur.md` — 578 lignes : ce qui existe, où,
  quelle commande

---

## Quatre pièges rencontrés

### 1. L'app mobile a été construite avec la vitrine

Christian l'a vu à l'émulateur : « on dirait que c'est la page vitrine ».

`deploiement.sh prod-site` **écrase `.env`** avec `VITE_VITRINE=oui` ; le
`cap:sync` suivant a embarqué le site public dans l'enveloppe iOS. Rejet
assuré sous la **règle 4.2** (Minimum Functionality) — une app qui n'est
qu'un site web.

`version-mobile.sh` **refuse maintenant de tourner** si le drapeau est
posé. C'est le garde-fou, pas la vigilance.

### 2. Premier refus d'Apple, deux motifs

- **Captures iPad manquantes** — Capacitor pose
  `TARGETED_DEVICE_FAMILY = "1,2"` par défaut. Choix retenu : **iPhone
  seul** plutôt que produire des captures iPad.
- **Aucun prix choisi** — la fiche peut être complète et la tarification
  vide ; ce sont deux écrans distincts.

### 3. `cap sync` ne reporte pas la version

Contrairement à ce que j'avais écrit dans le guide. Christian l'a lancé,
la version est restée à 3.69.0. D'où `version-mobile.sh`, et la
correction du message trompeur de `verifier-mobile.sh`.

### 4. TestFlight externe est fermé avant la première approbation

Demandé en fin de session pour montrer l'app aux coachs. Les
**informations de test sont enregistrées** (description bêta, contact,
compte de démo, URL) — mais la section « Tests externes » n'apparaît
qu'une fois **un premier build approuvé par App Review**.

Rien à corriger : il faut attendre la réponse d'Apple. En attendant, la
**PWA sur `app.`** montre exactement le même code.

---

## Prochaine action

**Pousser les 39 commits**, si validé. Rien n'a été poussé depuis le 31
août au matin.

Puis, à la réponse d'Apple : créer le groupe TestFlight externe et
inviter les coachs.

---

## Points ouverts

### À décider

- **Montrer l'app aux coachs** : PWA maintenant, ou attendre TestFlight ?
- **`/cours-2`** — deux présentations des cours coexistent, le temps que
  les coachs tranchent. À supprimer ensuite (page +
  `VitrineCoursListePage.tsx`).
- **Les textes de la fiche App Store** n'ont pas été soumis aux coachs.
  Modifiables à tout moment.

### À faire

- **Déployer la vitrine** (douze versions de retard)
- **D-U-N-S** pour AikiCom Perspectives SRL, puis le message au support
  Apple (`docs/apple/message-support-conversion-organisation.md`) —
  conversion du compte en organisation, et demande de remboursement de la
  licence au nom propre, rien n'ayant été publié
- **Clé de signature Android** — bloque le Play Store, pas l'App Store
- Menu vitrine : « Nos coachs » et « Séance d'essai » manquent par
  rapport à l'original ; le fond des témoignages est noir au lieu de la
  photo `DSC00930`
- **Vidéo du hero** : YouTube conservé sur décision de Christian. Un
  `.mp4` auto-hébergé reste préférable si le fichier source est
  retrouvé — un coach a signalé un chargement peu fluide sur son Mac.

### Reliquat du 31 août

- Sitemap à soumettre à Google Search Console
- `~/wordpress-archive-20260831` à supprimer (7,2 Go), dans 2-3 semaines
- **Renommer les 67 migrations** en horodatage à 14 chiffres — c'est ce
  qui rendrait `db push` de nouveau utilisable
- SPF ne mentionne pas Resend ; hCaptcha
- Copier les dumps hors du Mac mini
- **Technogym** : la question RGPD de fond reste — reste-t-il des données
  chez eux ?

---

## Méthode qui a servi

**Mesurer plutôt que lire.** Comparer les styles calculés des deux sites
à largeur de fenêtre égale a donné en une fois ce que la lecture du HTML
archivé n'avait pas trouvé en plusieurs essais. C'est Christian qui l'a
demandé — « pourquoi tu ne le fais pas ? » — et il avait raison.

**Vérifier chaque écran avant d'avancer**, dans le questionnaire de
confidentialité : les boîtes de dialogue se déplacent avec le
défilement, et deux réponses avaient été cochées à l'envers. Un zoom sur
les boutons radio avant chaque validation a réglé la question.

**Corriger le code plutôt que contourner par les droits.** Pour le super
admin qui ne pouvait pas créer de membre, la demande était « fais un
query pour me donner le droit d'admin » — c'était un bug, pas un manque
de permission.

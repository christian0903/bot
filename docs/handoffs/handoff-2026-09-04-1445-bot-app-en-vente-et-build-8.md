---
type: handoff
projet:
domaine:
session-machine: mac-mini
session-date: 2026-09-04
session-heure: "14:45"
auteur: "[[@Christian Vanhenten]]"
statut: actif
created: 2026-09-04
tags:
  - claude/handoff
  - bot
  - app-store
  - ios
  - testflight
---

# Handoff — L'app est en vente, le build 8 attend ses testeurs

> **v3.139.0**, arbre propre, tout poussé (étiquettes comprises).
> `.env` pointe sur **ops** (production) — basculé aujourd'hui, voir plus bas.
> Aucun déploiement lancé cette session : rien n'a bougé sur `app.` ni `jag.`

---

## Où on en est

| Domaine | Sert | Version |
|---|---|---|
| `app.` | production (bot-ops) | 3.130.0 |
| `jag.` | test (bot3) | 3.135.0 |
| **App Store** | **en vente** | 1.0 (build 7, code 3.123.0) |
| **TestFlight** | build 8 envoyé, **distribué à personne** | 3.137.0 (build 8) |

`apps.apple.com/app/back-on-track-studio/id6807375775`

---

## À VÉRIFIER À LA REPRISE

**1. L'app est-elle réellement visible sur l'App Store ?**

Publiée le 2026-09-04 vers 13h. Apple annonce jusqu'à 24 h, et l'indexation
dans la recherche prend souvent davantage. Deux contrôles distincts :

- **La fiche répond-elle** à l'URL ci-dessus, depuis un appareil non connecté
  au compte développeur (le navigateur d'un téléphone quelconque suffit) ?
- **Une recherche « Back on Track Studio »** dans l'App Store la retrouve-t-elle ?
  Ce second point peut rester faux plusieurs jours sans que ce soit anormal.

Si la fiche ne répond toujours pas passé 24 h, regarder l'état sur la page de
la version (`/distribution/ios/version/inflight`) : c'est le seul endroit qui
dise le réel, le mail d'Apple ne suffit pas.

**2. Quel est le statut du build 8 ?**

Au moment de la clôture : *Prêt à soumettre*, expire dans 90 jours, aucune
invitation, aucune installation.

⚠️ Le libellé **« Prêt à soumettre » ne veut pas dire qu'il manque quelque
chose** : il dit que ce build pourrait être soumis à l'App Store si on le
voulait. Le point orange signale seulement qu'il n'est distribué à personne.
C'est normal tant qu'aucun groupe de test n'existe.

À regarder : le statut a-t-il changé, et la **vérification DSA** est-elle
passée (voir ci-dessous) ?

---

## Ce qui a été fait aujourd'hui

- **La 1.0 est passée en vente.** Acceptée le 03/09 à 04:49 (Pacifique),
  elle est restée « Prête pour la publication » — approuvée mais invisible —
  jusqu'au clic de Christian sur « Publier cette version » le 04.
- **Build 8 envoyé** (3.137.0), *Uploaded to Apple*. Il porte quatorze versions
  livrées depuis le 1er septembre, **dont le rappel des présences**.
- **Documentation** : `docs/mettre-a-jour-app-store.md` couvre désormais les
  mises à jour **et** l'invitation des testeurs.
- Journal et nouveautés à jour ; dix étiquettes git poussées, dont `v3.123.0`.

---

## Les deux blocages TestFlight

Le but était le **lien public** à partager aux coachs. Il est hors d'atteinte
pour l'instant, et l'alternative interne bute sur autre chose.

### Tests externes — vérification DSA en cours

La section « Tests externes » **n'apparaît pas** dans App Store Connect. Apple
la masque sans rien expliquer.

Cause trouvée dans **Business → Contrats**, section *Conformité* :

> La législation sur les services numériques — 27 pays ou régions —
> **En cours de vérification** (déposée le 2026-09-01)

Rien à corriger, seulement à attendre — quelques jours à deux semaines.

⚠️ **Surveiller les courriels d'Apple** : une demande de pièce justificative
non traitée laisse la vérification en suspens **indéfiniment**.

**Ce qui n'était pas en cause**, tout vérifié : les contrats (celui des
applications gratuites est actif jusqu'au 2027-08-29), le rôle du compte
(Titulaire + Admin), les informations de test (complètes), le questionnaire de
chiffrement (déjà dans l'`Info.plist`).

### Tests internes — l'adresse du compte Apple manque

Ouverts, mais un testeur ne s'invite qu'à l'adresse de **son compte Apple**.
Envoyée ailleurs, l'invitation part vers un compte inexistant : aucune erreur,
aucun message, rien ne se passe.

**Christian ne connaît pas celle de ses coachs.** Elle se lit sur leur iPhone
dans **Réglages**, tout en haut, sous leur nom.

**Prochaine action** : la leur demander, puis *Utilisateurs et accès* → **+**
(rôle Développeur), et enfin le groupe interne dans TestFlight.

---

## Le piège du jour : le `.env` visait la base de TEST

Au moment du report de version, `.env` portait `cvyslqnojcgnjfgynczw` — bot3,
celle de `jag.` Un archivage lancé ainsi aurait envoyé chez Apple une
application branchée sur les **données de démonstration**.

Basculé sur `.env.ops` avant la construction ; l'ancien est gardé en
`.env.sauvegarde-jag-20260904`. **Pour repasser en développement :
`cp .env.jag .env`.**

Le garde-fou de `version-mobile.sh` ne couvre **que** le drapeau vitrine, posé
après l'incident du 1er septembre. La base visée n'arrête rien — seul
`verifier-mobile.sh` l'affiche. **Deux fois en quatre jours, le même fichier a
failli faire partir la mauvaise application.** Un second garde-fou serait
justifié.

---

## ⚠️ Avant que les coachs ouvrent le build 8

Le rappel des présences part avec. Il se déclenche à l'ouverture d'une session
du staff : le premier coach qui ouvre l'app enverra **un e-mail par cours non
pointé des sept derniers jours, multiplié par le nombre d'administrateurs**.

C'est précisément ce que la session du 03/09 voulait éviter en ne le déployant
pas. Christian a tranché de le publier — mais si les coachs n'ont pas soldé
leur pointage, allonger le délai dans *Administration → Réglages* avant de les
inviter.

---

## Ouvert, non traité

| Sujet | Détail |
|---|---|
| **Rappel des présences en production** | Toujours pas déployé sur `app.` (migration `20260903_rappel_presences.sql`). La procédure en quatre étapes est dans le handoff du 03/09. Il part en revanche dans le build 8. |
| **78 fonctions `SECURITY DEFINER`** | Exécutables par `anon` sur bot3. Audit à mener. |
| **Android** | Bloqué par la clé de signature, jamais créée. |
| **D-U-N-S / compte organisation** | Non entamés. Le compte reste au nom propre — n'empêche ni la vente ni les mises à jour. |
| **Vitrine** | Déployée en 3.112.0, vingt-sept versions de retard. Rien de visible pour un visiteur. |
| **Lint à 799** | `CLAUDE.md` en annonce 37 — chiffre périmé, pas une régression. |

---

## Pour reprendre

Arbre propre, rien en cours. Trois fils, par ordre :

1. **Vérifier la visibilité de la fiche** et le **statut du build 8** (en tête
   de ce document).
2. **Demander aux coachs l'adresse de leur compte Apple**, puis les ajouter et
   créer le groupe interne — procédure dans `docs/mettre-a-jour-app-store.md`.
3. **Surveiller la vérification DSA** dans Business → Contrats, qui débloquera
   le lien public.

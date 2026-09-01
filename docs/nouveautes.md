# Nouveautés

Ce qui change à chaque version, dit du point de vue de qui utilise
l'application — pas de qui l'écrit. Destiné à être transmis aux coachs.

La version la plus récente est en haut. Le détail technique, lui, vit dans
`journal-projet.md` ; ici, on ne parle que de ce qui se voit à l'écran.

> **Retrouver le code d'une version** : `./scripts/version.sh 3.115.0` en donne
> le commit, et `git checkout v3.115.0` s'y replace directement. La procédure de
> retour en arrière est dans `versions-et-retour-arriere.md`.

---

## v3.124.0 — 1er septembre 2026

- Aucun changement visible : l'application iOS ne se déclare plus compatible
  iPad. Elle y reste installable, en fenêtre iPhone.

---

## v3.123.0 — 1er septembre 2026

- **Le planning suit enfin le mode choisi en production.** Un administrateur ou
  un coach qui bascule en mode Membre voit désormais ce que voit un client :
  ses crédits, les noms de salles lisibles, la réservation au clic.
- **Correction** : l'application mobile pouvait être construite avec le site
  vitrine au lieu de l'espace membres.

---

## v3.122.0 — 1er septembre 2026

- **Correction** : un super administrateur ne pouvait pas créer de membre.
  Le bouton s'affichait, le formulaire se remplissait, et l'enregistrement
  échouait sur « Admin or coach role required ».

---

## v3.120.0 — 1er septembre 2026

- L'application iOS est prête à être soumise : le numéro de version des
  enveloppes suit désormais celui du dépôt.

---

## v3.119.0 — 1er septembre 2026

- Aucun changement visible : un guide pas à pas pour soumettre l'application à
  l'App Store, le compte développeur Apple venant d'être ouvert.

---

## v3.118.0 — 1er septembre 2026

- Aucun changement visible : la documentation développeur explique ce qu'est
  `db push` et pourquoi il est interdit ici, ce que sont les Edge Functions, et
  ce qu'il faut savoir avant de publier sur l'App Store et le Play Store.

---

## v3.117.0 — 1er septembre 2026

- Aucun changement visible : une **documentation développeur** rassemble ce qui
  existe dans le dépôt, où le trouver et quelle commande lancer.

---

## v3.116.0 — 1er septembre 2026

**Le suivi des nouveautés commence ici.** Les versions antérieures ne sont pas
reprises : leur histoire est dans le journal du projet.

- Chaque version reçoit désormais son **étiquette** dans le dépôt : revenir à
  une version précédente se fait par son numéro, sans chercher un identifiant
  de commit.

---

## v3.115.0 — 1er septembre 2026

- **Le guide administrateur** explique ce que change le sélecteur
  Membre / Coach / Admin sur le planning, et à quoi il sert : voir l'écran tel
  qu'un membre le voit.
- La section sur le site du studio est réécrite — elle décrivait encore le
  WordPress et son cadre à coller.
- **Correction** : le guide envoyait installer l'application depuis une adresse
  qui n'existait pas (`desk.backontrackstudio.be`). C'est
  `app.backontrackstudio.be`.

---

## v3.114.0 — 31 août 2026

- Aucun changement visible : documentation d'un incident (une erreur 403 chez
  un visiteur, due au réseau de son poste et non au site).

---

## v3.113.0 — 31 août 2026

- **La page des cours** adopte la présentation de l'ancien site : une grille de
  six cartes, chacune avec sa photo, son nom et une pastille de couleur par
  famille de cours.
- L'ancienne présentation reste consultable sur `/cours-2`, le temps de
  recueillir l'avis des coachs.

---

## v3.111.0 — 31 août 2026

- **Les questions fréquentes** passent de douze à six, celles de l'ancien site,
  avec leurs réponses d'origine — dont les indications de stationnement.
- Le bas de la page d'accueil est allégé : le texte y était présenté comme un
  grand titre.

---

## v3.110.0 — 31 août 2026

- **Correction** : sur la page du planning, le menu recouvrait le sélecteur de
  jours.
- Le bouton « Se connecter » retrouve une taille normale.
- **Les tarifs quittent la page d'accueil** — elle portait trop d'informations.
  Ils restent sur leur page.
- La vidéo d'accueil démarre plus tôt.

---

## v3.109.0 — 31 août 2026

- **Le planning suit maintenant le mode choisi.** En mode Membre, un
  administrateur ou un coach voit exactement ce que voit un client : ses
  crédits, les noms de salles lisibles, la réservation au clic — et non les
  outils de gestion.

  > C'est le moyen de vérifier ce que vivent les membres. Le 31 août, un cours
  > complet s'annonçait « 5 places disponibles » aux clients, sans qu'aucun
  > écran interne ne puisse le montrer.

  **Cette version est sur `jag.` (test), pas encore en production.**

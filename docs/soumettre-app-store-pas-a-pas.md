# Soumettre à l'App Store — pas à pas

> Écrit le 2026-09-01, le compte développeur Apple venant d'être acheté.
>
> `publier-app-store.md` explique **pourquoi** (le rejet 4.2, l'exemption sur
> les paiements, les arguments à tenir). **Ce document-ci dit quoi faire**, dans
> l'ordre, sans rien supposer.

## Vérifié avant d'écrire ce guide

| | |
|---|---|
| Xcode | **26.4**, installé |
| Identifiant de l'app | `be.backontrackstudio.app` |
| Icône 1024×1024 sans transparence | prête |
| Permission caméra, déclaration de chiffrement | déclarées |
| L'app vise `bot-ops` (production) | oui |
| Page de confidentialité | en ligne, répond |
| Version dans l'enveloppe iOS | à jour depuis le 2026-09-01 |

**Le bloc iOS du script de vérification est entièrement vert.** Reste à
refaire l'étape 1 avant chaque envoi, pour reporter la version du moment.

---

## Étape 1 — Mettre l'enveloppe à jour

**Deux commandes, dans cet ordre** :

```bash
cd ~/bot
./scripts/version-mobile.sh     # reporte le numéro de version
npm run cap:sync                # recopie l'application construite
```

> **Pourquoi deux commandes et pas une.** `cap sync` recopie les fichiers web
> dans les enveloppes, mais **ne touche jamais à leur numéro de version** :
> celui-ci vit dans `project.pbxproj` (iOS) et `build.gradle` (Android), des
> fichiers natifs que Capacitor ne génère pas.
>
> Sans la première commande, vous enverriez à Apple une application qui
> s'annonce en **3.69.0** quand le dépôt est en 3.119.0 — cinquante versions de
> retard, sans qu'aucun message ne le signale.
>
> `version-mobile.sh` incrémente aussi le **numéro de build**. Apple refuse
> deux envois portant le même, y compris pour corriger un rejet sans rien
> changer d'autre.

**Contrôler que c'est passé :**

```bash
./scripts/verifier-mobile.sh
```

Le bloc **iOS** doit être entièrement vert. Un « MANQUE aucune clé de
signature » sous Android est normal et **ne bloque pas** la soumission Apple —
c'est pour le Play Store, plus tard.

---

## Étape 2 — Déclarer l'application chez Apple

Dans un navigateur, sur **developer.apple.com**, puis
**Certificates, Identifiers & Profiles → Identifiers**.

1. Bouton **+**, choisir **App IDs**, puis **App**
2. **Description** : `Back on Track`
3. **Bundle ID** : sélectionner *Explicit* et saisir **exactement**
   `be.backontrackstudio.app`
4. Dans la liste des capacités, cocher **Push Notifications**
5. **Continue**, puis **Register**

> **Le Bundle ID ne se change jamais** après création. Une faute de frappe ici
> se paie par un nouvel identifiant et une fiche à refaire. Recopiez-le depuis
> `capacitor.config.ts` plutôt que de le retaper.

---

## Étape 3 — Créer la fiche de l'application

Sur **appstoreconnect.apple.com** → **Mes apps** → **+** → **Nouvelle app**.

| Champ | Quoi mettre |
|---|---|
| Plateformes | **iOS** |
| Nom | `Back on Track` — c'est le nom visible dans le store |
| Langue principale | **Français** |
| Bundle ID | `be.backontrackstudio.app` (celui créé à l'étape 2) |
| SKU | `backontrack-ios` — un code interne, invisible du public |
| Accès utilisateur | Accès complet |

> **Le nom peut être déjà pris.** Si Apple le refuse, `Back on Track Studio`
> reste disponible et convient.

---

## Étape 4 — Remplir la fiche

C'est la partie longue, et **celle qui décide du sort de l'examen**.

### Description

Elle doit dire clairement qu'il s'agit de **cours en salle**, pour éviter que
l'évaluateur ne classe les packs en contenu numérique. Une base :

> Back on Track est l'application du studio de fitness Back on Track, à
> Rixensart. Elle vous permet de réserver vos cours semi-privés, de suivre vos
> crédits et vos abonnements, et de consulter votre progression.
>
> Les séances se déroulent **au studio, Avenue de Mérode 64 à Rixensart**, en
> petits groupes de cinq personnes maximum, encadrées par nos coachs.
>
> Réservez votre place, annulez si besoin, pointez votre présence à l'arrivée,
> et retrouvez l'historique de vos séances.

### Mot-clés, catégorie, URL

| | |
|---|---|
| Mots-clés | `fitness,coaching,rixensart,cours,réservation,sport,studio` |
| Catégorie principale | **Forme et santé** |
| URL de l'assistance | `https://app.backontrackstudio.be/help` |
| URL marketing | `https://backontrackstudio.be` |
| Politique de confidentialité | `https://app.backontrackstudio.be/confidentialite` |

### Captures d'écran

Apple en exige pour **iPhone 6,9 pouces** (1290×2796) au minimum. Le plus
simple :

1. Dans Xcode, lancer l'app sur le simulateur **iPhone 16 Pro Max**
2. Se connecter avec un compte de démonstration
3. `Cmd + S` capture l'écran affiché
4. Prendre **3 à 5 écrans** : le planning, un cours, ses crédits, sa
   progression

> Ne pas photographier un écran vide : un planning sans cours donne l'image
> d'une application inutilisée. La production compte 206 cours à venir.

### Confidentialité des données

Apple demande de déclarer ce qui est collecté. Pour cette application :

- **Coordonnées** (nom, e-mail) → lié à l'identité, pour le fonctionnement
- **Identifiants** (compte) → lié à l'identité
- **Données d'usage** → non utilisé pour le suivi publicitaire

**Ne pas cocher « Suivi publicitaire »** : l'application n'en fait pas.

---

## Étape 5 — Envoyer une version depuis Xcode

```bash
cd ~/bot
npm run cap:ios
```

Xcode s'ouvre sur le projet. Ensuite, dans Xcode :

1. Sélectionner le projet **App** dans le panneau de gauche
2. Onglet **Signing & Capabilities** → cocher **Automatically manage signing**
3. **Team** : choisir votre compte développeur
4. En haut, à côté du bouton ▶, choisir **Any iOS Device (arm64)**
   — pas un simulateur, sinon l'archivage est grisé
5. Menu **Product → Archive**, puis attendre (quelques minutes)
6. La fenêtre **Organizer** s'ouvre → **Distribute App**
7. Choisir **App Store Connect**, puis **Upload**
8. Laisser les options par défaut, **Next** jusqu'à **Upload**

> **Le premier archivage échoue souvent** sur un problème de signature. Le
> message est explicite ; le plus fréquent est un compte non sélectionné à
> l'étape 3.

Comptez **10 à 30 minutes** avant que la version apparaisse dans App Store
Connect : Apple la traite en arrière-plan. Un courriel arrive quand elle est
prête.

---

## Étape 6 — Soumettre pour examen

De retour dans App Store Connect, sur la fiche de l'app :

1. Section **Version iOS**, choisir la version envoyée
2. Remplir **Nouveautés de cette version** — pour une première, « Première
   version » suffit
3. Section **Informations de connexion** : **cocher que l'app nécessite une
   connexion**, et fournir **un compte de démonstration** (identifiant + mot
   de passe) avec des données réalistes

   > **C'est le point qui fait rejeter le plus souvent.** Un évaluateur qui ne
   > peut pas entrer refuse sans regarder plus loin. Créez ce compte à
   > l'avance et vérifiez qu'il fonctionne.

4. Dans **Notes pour l'examen**, écrire :

   > Back on Track est l'application d'un studio de fitness situé à Rixensart,
   > en Belgique. Les crédits vendus dans l'application donnent accès à des
   > **cours en salle**, dispensés physiquement au studio. Aucun contenu
   > numérique n'est vendu.
   >
   > Compte de démonstration : [identifiant] / [mot de passe]

5. **Add for Review**, puis **Submit to App Review**

---

## Ce qui se passe ensuite

| Délai | Quoi |
|---|---|
| Quelques heures à 2 jours | Passage en *In Review* |
| 24 à 48 h après | Accepté, ou rejeté avec un motif |

**Un rejet n'est pas un échec** : Apple indique le motif, on corrige, on
resoumet. Les deux motifs à anticiper, et les réponses, sont dans
`publier-app-store.md`.

---

## Avant de commencer, deux choses à préparer

1. **Un compte de démonstration** dans la production, avec des crédits et
   quelques réservations — pour les captures **et** pour l'évaluateur.
2. **Une heure devant vous.** L'étape 4 est longue, et App Store Connect
   n'enregistre pas toujours les brouillons entre deux sessions.

# Publier sur l'App Store

> Marche à suivre pour la première soumission de Back on Track sur l'App Store
> iPhone. Écrit le 2026-08-29, au moment de l'achat du compte développeur.
>
> Le compte est **individuel**, au nom de Christian Vanhenten : c'est ce nom
> qui apparaîtra comme éditeur sur la fiche. Un transfert vers un compte
> d'organisation reste possible plus tard, sous conditions à revérifier le
> moment venu.

---

## Ce qui est déjà prêt

| | |
|---|---|
| Projet Capacitor iOS | `ios/`, identifiant `be.backontrackstudio.app` |
| Icône 1024×1024 | sans transparence, comme Apple l'exige |
| Permission caméra | `NSCameraUsageDescription`, pour le scanner de QR |
| `ITSAppUsesNonExemptEncryption` | à `false` — évite la question à chaque envoi |
| Suppression de compte | dans le profil, exigée par Apple depuis 2022 |
| Politique de confidentialité | `https://app.backontrackstudio.be/confidentialite`, publique |
| `server.url` | **commenté** — voir plus bas, c'est capital |

---

## Le rejet 4.2, et pourquoi le risque est modéré

Apple refuse les applications qui ne sont qu'un site web dans une coquille.
Back on Track est une PWA empaquetée, elle entre donc dans la catégorie
regardée de près.

Trois choses jouent en sa faveur :

- **Le scanner de QR code** utilise la caméra de l'appareil — c'est la
  capacité native la plus visible, et elle sert un usage réel : le pointage
  des présences par le coach ;
- **L'application est liée à un lieu physique**. Un studio, un planning, une
  présence à pointer : c'est le cas type qu'Apple accepte, à la différence
  d'une vitrine ;
- **Le paiement s'ouvre en vue intégrée** (`ouvrir-paiement.ts`), pas dans un
  navigateur externe.

> **Ne jamais décommenter `server.url` dans `capacitor.config.ts`.** Une
> application qui charge une URL distante est le cas le plus reconnaissable du
> rejet 4.2. Le binaire doit embarquer son propre `dist/`.

---

## Les paiements : pourquoi Stripe est légitime

Apple exige son achat intégré — 15 à 30 % de commission — pour le contenu
**numérique**. Il en **exempte** les services physiques.

Back on Track vend des **séances en salle** : un crédit s'échange contre une
réservation, consommée par un pointage physique au studio. Aucun contenu
numérique n'est vendu — pas de vidéos, pas de programmes téléchargeables. Les
statistiques et le suivi de performance sont gratuits et inclus.

C'est l'exemption **3.1.3(e), « Goods and Services Outside of the App »**, et
elle est solide.

> **Le dire clairement dans la fiche et les notes de soumission.** Un
> évaluateur qui n'a pas ce contexte pourrait classer les packs en contenu
> numérique. La description doit mentionner « cours en salle » sans ambiguïté.

> **Ne jamais écrire dans l'application qu'on peut payer moins cher ailleurs**,
> ni renvoyer vers un site de paiement : c'est la règle anti-steering, et elle
> se sanctionne durement.

---

## Avant de soumettre

### 1. Le binaire doit viser la production

```bash
cp .env.ops .env && npm run build && npx cap sync ios
```

**Contrôler** que le build embarque bien `bot-ops` :

```bash
grep -oh "xgwrxbkrfypklrnqbftv\|cvyslqnojcgnjfgynczw" ios/App/App/public/assets/*.js | sort -u
```

Une seule référence, celle de la production.

### 2. La base ne doit pas être vide

**C'est le point qui décide du rejet.** Un évaluateur ouvre l'application,
tombe sur un planning sans cours et coche « minimum functionality ».

Il faut donc, sur `bot-ops`, avant de soumettre :

- des **types de cours** et des **packs** réels ;
- un **planning rempli** sur les semaines à venir ;
- au moins un **coach** avec sa photo.

### 3. Un compte de démonstration

Apple teste avec le compte qu'on lui donne. Sans lui, rejet automatique.

Il faut le créer **sur la production**, et le renseigner dans App Store
Connect → *Informations de connexion*. Ce compte doit avoir :

- des **crédits** disponibles, pour que l'évaluateur puisse réserver ;
- des **réservations à venir et passées**, pour que les écrans ne soient pas
  vides ;
- **le rôle coach** — sans quoi l'évaluateur ne verra jamais le scanner de QR,
  qui est le meilleur argument contre le rejet 4.2.

> Un seul compte suffit s'il porte les deux casquettes : le sélecteur de mode
> lui permet de passer de Membre à Coach.

### 4. Les notes de soumission

À écrire dans App Store Connect. Trois points à expliquer :

> **Paiements.** Les packs donnent accès à des cours de fitness dispensés en
> salle, dans un studio physique situé en Belgique. Il ne s'agit pas de contenu
> numérique. Exemption 3.1.3(e).
>
> **Fonctions natives.** L'application utilise la caméra pour scanner le QR
> code des membres à leur arrivée (mode Coach). Le compte de démonstration
> fourni a le rôle coach : ouvrir un cours du jour, puis « Scanner ».
>
> **Suppression de compte.** Disponible dans Profil. Elle est bloquée tant
> qu'un abonnement est actif — le membre doit le résilier d'abord, ce qui se
> fait depuis l'application, sans quoi il continuerait d'être prélevé sans
> pouvoir arrêter.

---

## Les éléments de la fiche

| Élément | Contrainte |
|---|---|
| Nom | 30 caractères. « Back on Track » |
| Sous-titre | 30 caractères |
| Description | 4000 caractères. **Mentionner « cours en salle »** |
| Mots-clés | 100 caractères, séparés par des virgules, sans espaces |
| Captures | iPhone 6,7" **obligatoire** ; 6,5" et 5,5" selon les appareils visés |
| URL de confidentialité | `https://app.backontrackstudio.be/confidentialite` |
| URL de support | une page ou une adresse e-mail qui répond |
| Catégorie | Santé et remise en forme |
| Classification d'âge | questionnaire — sans contenu sensible, 4+ |

### Le questionnaire App Privacy

Apple demande de déclarer ce qui est collecté. Pour Back on Track :

| Donnée | Collectée | Liée à l'identité | Suivi publicitaire |
|---|---|---|---|
| Nom, e-mail, téléphone | oui | oui | **non** |
| Adresse postale | oui | oui | non |
| Données de santé (`medical_conditions`) | oui | oui | non |
| Achats | oui | oui | non |
| Identifiants | oui | oui | non |

**Aucun suivi publicitaire, aucun partage avec des tiers à cette fin.** C'est
vrai, et cela simplifie beaucoup le questionnaire.

> Les **données de santé** demandent une attention particulière : le champ
> `medical_conditions` du profil en relève. Il faut le déclarer.

---

## Après la soumission

L'examen prend en général 24 à 48 h. Trois issues :

- **Accepté** — l'application est publiée, ou reste en attente si vous avez
  choisi la publication manuelle ;
- **Rejeté** — le motif est précis et se conteste dans le Resolution Center.
  Un premier rejet est courant, ce n'est pas un échec définitif ;
- **En attente d'informations** — répondre dans le Resolution Center.

> **Ne pas promettre de date aux coachs avant l'acceptation.** L'examen garde
> une part d'arbitraire.

---

## Ce qui n'est pas fait, et peut attendre

**Les notifications push.** Elles ne sont pas nécessaires à l'acceptation, mais
ce serait le premier ajout utile : une place libérée en liste d'attente n'a que
deux heures de validité, et un e-mail se rate. Environ trois jours de travail,
plan détaillé dans `plan-implementation-v2.md`, phase 8.

---

# Publier sur le Play Store (Android)

Le projet est prêt : `android/`, identifiant `be.backontrackstudio.app`,
permissions `INTERNET` et `CAMERA`, `targetSdk 36` — conforme aux exigences
actuelles de Google.

## Ce qui manque, et qui n'existe pas encore : la clé de signature

Google exige que chaque envoi soit signé. **Cette clé ne se remplace jamais** :
la perdre, c'est ne plus jamais pouvoir mettre l'application à jour — il
faudrait la republier sous un autre identifiant, et les membres devraient la
réinstaller.

```bash
keytool -genkey -v -keystore ~/backontrack-release.keystore \
  -alias backontrack -keyalg RSA -keysize 2048 -validity 10000
```

> **Sauvegarder ce fichier ET son mot de passe hors de cette machine.** Un
> gestionnaire de mots de passe, un disque externe. `.dumps/` et le dépôt ne
> conviennent pas — le second partirait dans un commit.

Puis, dans `android/app/build.gradle`, un bloc `signingConfigs` qui le
référence. Les valeurs se lisent depuis un fichier hors dépôt, jamais écrites
en dur.

> **Google Play App Signing** peut prendre le relais : Google conserve alors la
> clé finale, et une clé perdue se récupère. C'est proposé à la création de
> l'application dans la console, et **c'est le choix à faire** — il retire
> précisément le risque décrit plus haut.

## Le compte développeur

**25 $, une seule fois** — pas d'abonnement annuel, à la différence d'Apple.

Depuis 2023, un compte individuel doit avoir **testé l'application avec 12
personnes pendant 14 jours** avant de pouvoir publier. Cette exigence ne
s'applique pas aux comptes d'organisation.

> À vérifier avant de s'engager sur une date : c'est deux semaines
> incompressibles, et les règles de Google changent souvent.

## Ce qui diffère d'Apple

| | Apple | Google |
|---|---|---|
| Coût | 99 $/an | 25 $ une fois |
| Examen | 24-48 h | quelques heures à 7 jours |
| Règle « site web emballé » | stricte (4.2) | bien plus souple |
| Test préalable | non | 12 testeurs, 14 jours (compte individuel) |
| Paiements | exemption à justifier | même principe, moins scruté |

**Le rejet 4.2 n'a pas d'équivalent chez Google.** L'obstacle principal côté
Android est administratif, pas technique.

## La marche à suivre

1. Créer la clé de signature, **et la sauvegarder ailleurs**
2. Ouvrir un compte développeur Google Play (25 $)
3. Activer **Google Play App Signing**
4. `cp .env.ops .env && npm run build && npx cap sync android`
5. Générer un **Android App Bundle** (`.aab`) — le `.apk` n'est plus accepté
6. Fiche : mêmes éléments qu'Apple, avec ses propres formats de captures
7. Questionnaire *Data safety* — l'équivalent d'App Privacy, à remplir avec
   les mêmes réponses (données de santé comprises)

> **Faire Apple d'abord.** Ses contraintes sont plus strictes : ce qui passe
> chez Apple passe chez Google, l'inverse n'est pas vrai.

# Mettre à jour l'application sur l'App Store

> Ce document sert **après** la première publication. Le parcours du premier
> dépôt — compte développeur, création de la fiche, captures, questionnaire de
> confidentialité, tarification — est dans `soumettre-app-store-pas-a-pas.md`
> et **ne se refait pas**.
>
> La version 1.0 est en vente depuis le **2026-09-04** :
> `apps.apple.com/app/back-on-track-studio/id6807375775`

---

## En un mot : c'est beaucoup plus court

Le premier dépôt a demandé trois jours et deux refus. Ce n'était pas
l'application qui posait problème, mais tout ce qui l'entoure et qui n'existait
pas encore. Une mise à jour ne rejoue rien de cela.

| | Premier dépôt | Mise à jour |
|---|---|---|
| Compte développeur, contrats, fiscalité | à créer | acquis |
| Fiche : nom, description, mots-clés, catégorie | à écrire | inchangée |
| Captures d'écran | à produire | inchangées, sauf si l'écran a changé |
| Questionnaire App Privacy | à remplir | inchangé, sauf nouvelle donnée collectée |
| Tarification et pays | à choisir | inchangés |
| Compte de démonstration | à créer | à **vérifier** qu'il fonctionne encore |
| Notes pour l'examen | à rédiger | conservées dans *Remarques* |
| Examen | quelques jours, deux refus | **24 à 48 h** en général |

Restent : monter la version, archiver, envoyer, écrire deux phrases de
nouveautés, soumettre. Comptez **une petite heure**, dont l'essentiel est de
l'attente.

---

## La marche à suivre

### 1. Vérifier ce qui part

**C'est l'étape qui a failli tout gâcher deux fois en quatre jours.** Le `.env`
sert à tous les usages du dépôt, et rien ne dit lequel est actif.

```bash
cd ~/bot
cat .env                      # regarder les DEUX lignes ci-dessous
cp .env.ops .env              # si besoin
```

Deux choses à contrôler :

| Ligne | Doit valoir | Sinon |
|---|---|---|
| `VITE_SUPABASE_URL` | `xgwrxbkrfypklrnqbftv` (**bot-ops**, production) | l'app part branchée sur les données de test |
| `VITE_VITRINE` | absente, ou `non` | l'app affiche le site public — rejet règle 4.2 |

`version-mobile.sh` **refuse de tourner** si le drapeau vitrine est posé. Mais
il ne regarde **pas** la base visée : le 2026-09-04, le `.env` pointait sur
bot3 et rien ne l'a arrêté. C'est `verifier-mobile.sh`, à l'étape suivante, qui
affiche la base — d'où l'importance de lire sa sortie plutôt que de la
survoler.

### 2. Monter la version et le build

```bash
./scripts/version-mobile.sh
npm run cap:sync
./scripts/verifier-mobile.sh
```

`version-mobile.sh` reporte le numéro de `package.json` dans
`project.pbxproj` et **incrémente le build**. C'est indispensable : Apple
refuse deux envois portant le même numéro de build, y compris pour corriger un
rejet sans rien changer d'autre.

`cap sync` recopie les fichiers web mais **ne touche jamais** au numéro de
version — d'où les deux commandes séparées.

Le bloc **iOS** de `verifier-mobile.sh` doit être vert. Le « MANQUE aucune clé
de signature » sous Android est normal et ne concerne que le Play Store.

> **Repère** : la 1.0 en vente porte `MARKETING_VERSION = 3.123.0` et
> `CURRENT_PROJECT_VERSION = 7`. Le build **8** (3.137.0) est parti le
> 2026-09-04 pour TestFlight. Le numéro de build ne redescend jamais, quelle
> que soit la version App Store à laquelle il se rattache.

### 3. Archiver et envoyer depuis Xcode

```bash
npm run cap:ios
```

Dans Xcode :

1. En haut, à côté de ▶, choisir **Any iOS Device (arm64)** — pas un
   simulateur, sinon l'archivage est grisé
2. **Product → Archive**, puis attendre
3. Dans **Organizer** : **Distribute App** → **App Store Connect** → **Upload**
4. Options par défaut, **Next** jusqu'à **Upload**

Comptez **10 à 30 minutes** avant que le build apparaisse dans App Store
Connect. Un courriel arrive quand il est prêt.

### 4. Créer la version dans App Store Connect

Sur la page *Distribution* de l'app, cliquer le **+** à côté de « App iOS »
dans la colonne de gauche, et saisir le numéro de version (`1.1`, `1.2`…).

> Le numéro de version **App Store** est indépendant de celui du dépôt. L'app
> en vente est la « 1.0 » côté Apple et la 3.123.0 côté code. Ne pas chercher à
> les aligner : Apple attend une suite courte et croissante.

Puis :

1. **Nouveautés de cette version** — deux ou trois phrases, du point de vue de
   qui utilise l'app. `docs/nouveautes.md` en contient déjà la matière.
2. **Build** : choisir celui qui vient d'être envoyé
3. Vérifier que les **Informations de connexion** portent toujours le compte de
   démonstration, et que **Remarques** contient encore les réponses aux
   questions de la Guideline 2.1
4. **Ajouter pour vérification**, puis **Soumettre**

### 5. Avant de cliquer « Soumettre », deux contrôles

Ce sont les deux causes des refus déjà essuyés.

- **Le compte de démonstration se connecte-t-il ?** Essayer réellement. Filmer
  la suppression de compte le détruit — c'est arrivé deux fois le 2026-09-02.
  La remise en service est dans `docs/apple/restaurer-compte-demo.md`.
- **Le planning a-t-il des places libres dans les jours à venir ?** Sans cela
  l'évaluateur ne peut pas réserver, et « App Completeness » retombe.

---

## Sortie automatique ou manuelle

Le réglage se trouve en bas de la page de la version.

**Manuelle** (réglage actuel) : la version approuvée reste invisible jusqu'à un
clic sur **« Publier cette version »**. C'est ce qui a laissé la 1.0 approuvée
mais absente de l'App Store pendant une journée — **rien ne le signale**, et le
mail d'Apple annonce « eligible for distribution », pas « en vente ».

**Automatique** : la version paraît dès l'approbation.

Garder le manuel a du sens quand les coachs doivent être prévenus le jour de la
sortie. Mais il faut alors aller cliquer — et penser à regarder la page de la
version, seul endroit qui dise l'état réel.

---

## Ce qui exige de repasser par la fiche

Une mise à jour ordinaire n'y touche pas. Ces cas-là, si :

- **Un écran a changé d'aspect** → refaire les captures concernées
- **Une donnée nouvelle est collectée** → reprendre le questionnaire App Privacy
- **Un achat intégré apparaît** → déclaration séparée, et la question de la
  commission se rouvre (aujourd'hui hors commission au titre de la règle
  3.1.3(e) : les crédits donnent accès à des cours en salle)
- **La description ou les mots-clés changent** → modifiables librement tant que
  la version n'est pas « Prête pour la publication »

---

## Faire tester une version avant de la publier

Un build envoyé chez Apple n'est pas obligé d'être soumis. Il peut d'abord être
distribué par **TestFlight** : mêmes étapes 1 à 3, puis onglet **TestFlight**
au lieu de la soumission. C'est la bonne façon de faire voir une version aux
coachs avant de l'ouvrir aux membres.

Les **Informations sur les tests** (description bêta, contact, compte de
démonstration, remarques d'examen) sont déjà remplies et servent à tous les
builds. Rien à refaire à chaque fois.

TestFlight propose deux sortes de groupes, et **ils ne se valent pas ici**.

### Groupe interne — disponible tout de suite

Jusqu'à 100 testeurs, **aucun examen d'Apple**, distribution immédiate.

La contrainte : chaque testeur doit d'abord exister dans **Utilisateurs et
accès** de l'équipe App Store Connect.

**1. Ajouter la personne** — *Utilisateurs et accès* → **+** :

| Champ | Valeur |
|---|---|
| Prénom, Nom | ceux du testeur |
| E-mail | **son identifiant Apple** — voir l'encadré ci-dessous |
| Rôle | Développeur |
| Apps | Back on Track Studio |

> **L'adresse doit être celle de son compte Apple**, celui qui ouvre son
> iPhone — pas une adresse professionnelle choisie au hasard. Apple envoie
> l'invitation à un compte qui n'existe pas, et **rien ne se passe** : aucune
> erreur, aucun message. C'est ce qui a bloqué l'invitation des coachs le
> 2026-09-04.
>
> La question à leur poser : *« quelle adresse e-mail utilises-tu pour ton
> compte Apple / ton iPhone ? »* Beaucoup l'ignorent — elle se lit sur
> l'iPhone dans **Réglages**, tout en haut, sous leur nom.

La personne reçoit un e-mail d'invitation qu'elle doit **accepter** avant de
pouvoir être ajoutée comme testeuse.

**2. Créer le groupe** — onglet *TestFlight* → le **+** à côté de **TESTS
INTERNES** → nommer (« Coachs ») → laisser **Activer la distribution
automatique** coché, pour que les builds suivants leur parviennent seuls.

**3. Garnir le groupe** — onglet *Testeurs* → **+** → cocher les personnes ;
onglet *Builds* → **+** → choisir le build (déjà présent si la distribution
automatique est active).

### Groupe externe — débloqué depuis le 2026-09-05

Jusqu'à 10 000 testeurs, invitation par **lien public** à partager librement —
sans que personne ait besoin d'un compte App Store Connect, ni que nous
connaissions l'adresse de son compte Apple. C'est la bonne voie pour les
coachs, et elle est désormais ouverte.

**Ce qui l'avait bloquée quatre jours durant** : la vérification **DSA**
(*Digital Services Act*), qu'Apple exige avant d'autoriser une distribution
large dans l'UE. Déposée le 2026-09-01, elle est restée « En cours de
vérification » jusqu'au 2026-09-05, date à laquelle elle est passée à
**Active** — *Business → Contrats*, section *Conformité*.

Tant qu'elle était en cours, la section « Tests externes » **n'apparaissait pas
du tout** dans la colonne de gauche de TestFlight. Apple la masque au lieu de
l'expliquer : rien ne disait qu'il fallait attendre, ni quoi.

> **La leçon, si le cas se reproduit** : une fonction absente d'App Store
> Connect n'est pas forcément indisponible — elle peut être masquée par une
> vérification en cours. Regarder *Business → Contrats* avant de chercher
> ailleurs.

Ce qui n'était **pas** en cause, tout vérifié le 2026-09-04 : les contrats (le
*Contrat relatif aux applications gratuites* est actif jusqu'au 2027-08-29),
le rôle du compte (Titulaire + Admin), et les informations de test (complètes).

**La marche à suivre, une fois le groupe externe créé :**

1. **Ajouter des builds** → choisir le build voulu.
2. Remplir les **Éléments à tester** — le champ est obligatoire, et c'est lui
   que le coach lira dans TestFlight. Y dire ce qui a changé et ce qu'on veut
   voir éprouvé, pas « corrections diverses ».
3. **Soumettre pour vérification.** Apple examine le premier build distribué en
   externe (24 à 48 h en pratique). Les suivants passent sans nouvel examen.
4. **Inviter des testeurs** → activer le **lien public**, à envoyer aux coachs.

> La case *« Notifier automatiquement les testeurs »* est cochée par défaut :
> à l'approbation, l'invitation part toute seule. En tenir compte avant de
> soumettre — voir « Le réflexe avant d'inviter » ci-dessous.

### Ce que le testeur fait de son côté

> **À leur transmettre** : `docs/coachs-tester-testflight.md` dit tout cela du
> point de vue du coach — installation, ce qu'il faut regarder, comment
> signaler un problème. Ce qui suit en est le résumé technique.

1. Installer l'app **TestFlight** depuis l'App Store (gratuite, éditée par Apple)
2. Ouvrir l'invitation **sur son iPhone** → *View in TestFlight*
3. **Installer**

L'application apparaît avec un **point orange** à côté de son nom, distincte de
celle de l'App Store — les deux cohabitent. Le testeur s'y connecte avec son
compte Back on Track habituel.

Un build TestFlight **expire après 90 jours** : l'app cesse alors de s'ouvrir.
C'est normal, ce n'est pas une panne.

### Le réflexe avant d'inviter

Regarder ce que la version va déclencher chez ceux qui l'ouvrent. Une version
de test n'est pas inerte : elle tourne sur la **production**.

Exemple vécu — le build 8 embarque le rappel des présences, qui part à
l'ouverture d'une session du staff. Le premier coach qui ouvre l'app déclenche
un e-mail par cours non pointé des sept derniers jours, **multiplié par le
nombre d'administrateurs**. Le délai se règle dans *Administration →
Réglages* ; l'allonger le temps du test évite la volée.

---

## Rappel : la PWA reste le canal rapide

L'application installée depuis l'écran d'accueil (`app.backontrackstudio.be`)
sert **le même code**, et se met à jour sans passer par Apple. Pour un correctif
urgent, c'est la voie courte — l'App Store n'a pas de procédure d'urgence en
dessous de 24 h.

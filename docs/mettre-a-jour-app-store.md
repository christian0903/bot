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

Le `.env` doit viser l'**application**, pas la vitrine. `deploiement.sh
prod-site` l'écrase avec `VITE_VITRINE=oui`, et un `cap:sync` lancé ensuite
embarquerait le site public dans l'enveloppe iOS — rejet assuré au titre de la
règle 4.2.

```bash
cd ~/bot
grep VITE_VITRINE .env        # ne doit rien renvoyer, ou 'non'
cp .env.ops .env              # si besoin
```

`version-mobile.sh` refuse désormais de tourner si le drapeau est posé, mais
autant le savoir avant.

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
> `CURRENT_PROJECT_VERSION = 7`. La prochaine partira donc en build 8.

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

## TestFlight, maintenant disponible

Les tests **externes** étaient fermés tant qu'aucun build n'avait été approuvé.
Ce verrou est levé depuis le 2026-09-03.

Un build envoyé peut donc être distribué aux coachs **avant** sa publication :
même parcours jusqu'à l'étape 3, puis onglet **TestFlight** plutôt que
soumission. Les informations de test sont déjà enregistrées. Un examen léger
s'applique au premier build distribué en externe, puis plus rien.

C'est la bonne façon de faire voir une version avant de l'ouvrir à tous.

---

## Rappel : la PWA reste le canal rapide

L'application installée depuis l'écran d'accueil (`app.backontrackstudio.be`)
sert **le même code**, et se met à jour sans passer par Apple. Pour un correctif
urgent, c'est la voie courte — l'App Store n'a pas de procédure d'urgence en
dessous de 24 h.

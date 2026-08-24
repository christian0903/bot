# Tester Back on Track sur iPhone

Guide de la première installation, pour Christian puis pour les testeurs.
Compter dix minutes en tout, dont l'essentiel pour le déploiement.

---

## Avant tout : déployer

**Le code est sur GitHub, mais `desk.backontrackstudio.be` sert encore l'ancienne
version.** Rien ne déploie tout seul — sans cette étape, l'installation posera
une icône générique sur l'écran d'accueil et vous croirez à un bug.

```bash
cd ~/bot
npm run build
```

Puis envoyer **tout le contenu de `dist/`** vers la racine web du sous-domaine,
par FTP/SFTP (Transmit, FileZilla). Écraser ce qui s'y trouve.

> **Ne pas oublier les fichiers cachés.** `.htaccess` commence par un point :
> beaucoup de clients FTP le masquent par défaut. Sans lui, la navigation dans
> l'application renvoie des erreurs 404 dès qu'on recharge une page.

### Vérifier que le déploiement a pris

Trois commandes, dans un terminal. Chacune doit donner le résultat annoncé.

```bash
# 1. La version livree — doit afficher 2.85.0 ou superieur
curl -s https://desk.backontrackstudio.be/sw.js | sed -n '3p'

# 2. L'icone iPhone — doit repondre 200 et image/png
curl -sI https://desk.backontrackstudio.be/icons/apple-touch-icon.png | head -3

# 3. Le manifest — doit contenir des .png, pas seulement des .webp
curl -s https://desk.backontrackstudio.be/manifest.json | head -12
```

Si la deuxième répond `content-type: text/html`, le `.htaccess` n'est pas monté :
c'est exactement le défaut corrigé aujourd'hui, et l'icône ne fonctionnera pas.

---

## Installer sur l'iPhone

**Dans Safari.** Chrome et Firefox sur iPhone ne savent pas installer une
application — ils n'affichent pas l'option. C'est une limite d'iOS, pas un
oubli.

1. Ouvrir **Safari** et aller sur `desk.backontrackstudio.be`
2. Toucher le bouton **Partager** — le carré avec une flèche vers le haut, en bas
   de l'écran
3. Faire défiler la liste et choisir **Sur l'écran d'accueil**
4. Le nom proposé est *Back on Track* — toucher **Ajouter**, en haut à droite

L'icône rejoint l'écran d'accueil, avec les autres applications.

### Ce qu'il faut vérifier tout de suite

| Point | Ce qu'on doit voir |
|---|---|
| **L'icône** | Le logo Back on Track, pas une miniature de la page ni un rond gris |
| **À l'ouverture** | Plein écran, **sans la barre d'adresse Safari** en haut |
| **Le bas de l'écran** | La barre de navigation de l'app, pas les boutons de Safari |

Si la barre d'adresse Safari reste visible, l'application s'est ouverte comme un
simple raccourci web : le manifest n'a pas été lu. Vérifier le déploiement.

> **L'icône est fausse ?** iOS garde en cache l'ancienne. Supprimer l'icône de
> l'écran d'accueil, fermer complètement Safari (glisser vers le haut depuis le
> multitâche), puis recommencer.

---

## Éprouver la mise à jour

C'est le mécanisme livré aujourd'hui, et celui qui fera gagner du temps pendant
les tests. Il vaut la peine de le voir fonctionner une fois.

1. Garder l'application **ouverte** sur l'iPhone
2. Sur le Mac : changer quelque chose de visible, puis

   ```bash
   npm run build
   ```

   en ayant incrémenté la version mineure dans `package.json` — c'est elle qui
   nomme le cache et déclenche la détection.
3. Redéployer `dist/`
4. Sur l'iPhone : fermer l'application et la rouvrir

Un bandeau **« Nouvelle version disponible »** apparaît en bas de l'écran.
Toucher **Recharger** : la page se recharge sur la nouvelle version, le bandeau
disparaît.

> Le bandeau peut mettre une ouverture à apparaître : le navigateur télécharge la
> nouvelle version en arrière-plan pendant que l'ancienne s'affiche. C'est normal,
> et c'est justement ce qui évite de couper l'application en pleine réservation.

**Le numéro de version est en pied de page.** C'est le premier réflexe à avoir
quand un testeur signale un problème : lui demander ce numéro. S'il est inférieur
à celui déployé, le bug est probablement déjà corrigé.

---

## Ce qu'il faut dire aux testeurs

Un message court suffit. Par exemple :

> Pour installer l'application : ouvre **desk.backontrackstudio.be** dans
> **Safari** (pas Chrome), touche le bouton **Partager** en bas, puis **Sur
> l'écran d'accueil**. L'icône se pose comme une vraie application.
>
> Sur **Android**, ouvre le même lien dans **Chrome** : une invitation
> d'installation apparaît, ou passe par le menu **⋮** → **Installer
> l'application**.
>
> Quand je corrige quelque chose, un bandeau « Nouvelle version disponible »
> s'affiche : touche **Recharger**. Rien à réinstaller.

Une invitation à installer apparaît aussi sur leur tableau de bord après
connexion, avec le mode d'emploi illustré pour iPhone.

---

## Ce qui peut surprendre

**Supprimer l'icône déconnecte.** Sur iOS, retirer l'application de l'écran
d'accueil efface son stockage local, donc la session. Il faudra se reconnecter
après réinstallation. Rien n'est perdu côté données — tout vit dans Supabase.

**Les notifications push** ne fonctionnent sur iPhone **que** si l'application a
été installée sur l'écran d'accueil, et restent moins fiables qu'en natif. Un
testeur qui reste dans Safari n'en recevra aucune.

**iOS décharge l'application de la mémoire** assez vite quand elle n'est pas au
premier plan. C'est sans gravité : elle se recharge à l'ouverture — et c'est même
ce qui fait passer les mises à jour plus vite que sur Android.

**Le paiement Stripe ouvre un navigateur** et revient ensuite dans
l'application. Ce va-et-vient est normal ; c'est un des points à éprouver
pendant les tests.

---

## Ce que cette PWA ne remplace pas

Le dépôt sur l'App Store reste à faire — c'est le chantier suivant : fiche,
captures aux formats imposés, icône 1024 × 1024, questionnaire App Privacy,
classification d'âge.

La PWA sert **la phase de test** : elle donne quelque chose de très proche d'une
application native, installable en trois gestes, corrigeable en quelques minutes
sans validation Apple. C'est ce qui permet de faire tourner l'application entre
de vraies mains avant de figer une première version publique.

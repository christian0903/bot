# Faire tourner l'ancien WordPress sur `wp.backontrackstudio.be`

> Écrit le 2026-08-31, à la demande de Christian, après que les coachs ont
> souhaité revoir l'ancien site.
>
> **Une autre voie existe** — garder WordPress sur son domaine et commuter avec
> un `.htaccess` — décrite dans `remettre-le-wordpress.md`. Christian a choisi
> le sous-domaine : ce document décrit **cette** voie, correctement.
>
> **Rien ici ne touche `app.backontrackstudio.be`.** L'application des membres
> est sur un autre domaine et n'est pas concernée.

## Ce qu'il faut savoir avant de commencer

Déplacer les fichiers **ne suffit pas**. WordPress garde son adresse en base de
données : servi depuis `wp.`, il renverrait le visiteur vers
`backontrackstudio.be` — c'est-à-dire vers la vitrine React. Les coachs ne
verraient jamais l'ancien site.

Il faut donc, en plus des fichiers, **réécrire les URL en base**. Deux chiffres
mesurés sur le dump du 2026-08-31 :

| Mesure | Nombre |
|---|---|
| Occurrences du domaine dans la base | **32 755** |
| Dont **sérialisées** (Bricks, réglages de plugins) | **13 982** |

> **Pourquoi `sed` est exclu.** Une chaîne sérialisée PHP porte sa longueur :
> `s:28:"https://backontrackstudio.be"`. Remplacer le texte sans corriger le
> nombre rend la valeur invalide, et **PHP la jette en silence** — pas d'erreur,
> juste des blocs de page vides. Ici, ce sont **13 982 valeurs** qui
> disparaîtraient, l'essentiel des mises en page Bricks.
>
> `wp search-replace` recalcule ces longueurs. C'est la seule méthode sûre.

**Le préfixe des tables est `wpbot_`**, pas `wp_`. Une requête sur `wp_options`
échoue.

---

## Étape 0 — Le certificat SSL, avant tout le reste

**Constaté le 2026-08-31 : `wp.backontrackstudio.be` n'a pas encore de
certificat.** Le DNS résout bien (109.234.165.117) et le sous-domaine répond en
HTTP, mais rien en HTTPS.

L'ordre compte. Écrire `https://` en base sans certificat rendrait le site
inaccessible derrière une alerte de sécurité — et la cause serait cherchée du
mauvais côté.

Dans **cPanel → SSL/TLS Status**, cocher `wp.backontrackstudio.be` et lancer
**Run AutoSSL**. Quelques minutes. Puis vérifier :

```bash
curl -sI https://wp.backontrackstudio.be/ | head -3
```

Une réponse — même une redirection — suffit : elle prouve que le certificat
répond. **Ne pas continuer tant que cette commande ne renvoie rien.**

---

## Étape 1 — Vérifier les fichiers déplacés

Les fichiers sont en place (déplacés par Christian le 2026-08-31). Contrôler
qu'ils sont complets :

```bash
ls ~/wp.backontrackstudio.be/wp-config.php
ls ~/wp.backontrackstudio.be/wp-content/themes/
ls ~/wp.backontrackstudio.be/index.php
```

> **`wp-config.php` doit être là.** Sans lui, WordPress ne connaît plus sa base
> et propose de réinstaller — écran qu'il ne faut surtout pas valider.

**État constaté au 2026-08-31**, avant tout remplacement :

```
http://wp.backontrackstudio.be/  ->  301  ->  https://backontrackstudio.be/
```

C'est le symptôme attendu, et la preuve que seuls les fichiers ont bougé :
WordPress lit son adresse en base, y voit le domaine principal, et y renvoie
tout le monde — c'est-à-dire vers la vitrine. L'étape 2 corrige cela.

### Le piège à écarter tout de suite

Si `wp-config.php` **force les URL en dur**, aucun remplacement en base n'aura
d'effet visible — WordPress lira la constante et ignorera la valeur enregistrée.

```bash
grep -nE "WP_HOME|WP_SITEURL" ~/wp.backontrackstudio.be/wp-config.php
```

- **Rien ne sort** → cas normal, continuer.
- **Deux lignes sortent** → y mettre `https://wp.backontrackstudio.be`. Elles
  prennent le pas sur la base pour l'adresse du site, mais **ne dispensent pas**
  du remplacement de l'étape 2 : les liens internes et les images restent
  écrits en base.

---

## Étape 2 — Sauvegarder la base, puis réécrire les URL

### 2a. La sauvegarde d'abord

Non négociable : l'étape suivante modifie 32 755 valeurs.

```bash
cd ~/wp.backontrackstudio.be

# Les identifiants sont dans wp-config.php ; wp les lit tout seul.
wp db export ~/wp-avant-bascule.sql
ls -lh ~/wp-avant-bascule.sql
```

Si `wp` n'est pas trouvé, il est présent chez o2switch sous un autre nom
(`wp-cli`, ou via `php ~/wp-cli.phar`). Le tester avant d'aller plus loin :

```bash
wp --info
```

### 2b. Le remplacement, à blanc d'abord

`--dry-run` ne modifie rien et annonce ce qui serait fait :

```bash
cd ~/wp.backontrackstudio.be

wp search-replace 'https://backontrackstudio.be' 'https://wp.backontrackstudio.be' \
  --all-tables-with-prefix --precise --recurse-objects --dry-run
```

Lire le tableau : il doit annoncer **des milliers de remplacements**, répartis
sur `wpbot_options`, `wpbot_posts`, `wpbot_postmeta`. Un total proche de zéro
signifie que le domaine cherché ne correspond pas — s'arrêter et vérifier.

### 2c. Le remplacement réel

La même commande, sans `--dry-run` :

```bash
wp search-replace 'https://backontrackstudio.be' 'https://wp.backontrackstudio.be' \
  --all-tables-with-prefix --precise --recurse-objects
```

Puis la variante sans protocole, pour les liens écrits en `//domaine` :

```bash
wp search-replace '//backontrackstudio.be' '//wp.backontrackstudio.be' \
  --all-tables-with-prefix --precise --recurse-objects
```

Vérifier :

```bash
wp option get siteurl    # https://wp.backontrackstudio.be
wp option get home       # https://wp.backontrackstudio.be
```

> **`--recurse-objects` est ce qui traite le sérialisé**, et `--precise` force
> le passage par PHP plutôt que par MySQL. Les deux sont nécessaires ici :
> ce sont eux qui protègent les 13 982 valeurs.

---

## Étape 3 — Vider les caches

Les plugins de cache gardent des pages entières avec les anciennes URL. Tant
qu'ils ne sont pas vidés, le site paraît n'avoir pas changé — et on croit le
remplacement raté alors qu'il a réussi.

Deux caches sont présents dans cette installation : **W3 Total Cache** et
**LiteSpeed** (o2switch tourne sur LiteSpeed).

```bash
cd ~/wp.backontrackstudio.be
wp cache flush
wp rewrite flush

# Les deux caches de cette installation, s'ils sont encore actifs.
wp w3-total-cache flush all 2>/dev/null || true
wp litespeed-purge all      2>/dev/null || true

# Et le cache disque, que les commandes ci-dessus ne couvrent pas toujours.
rm -rf wp-content/cache/*
```

> **Le plus simple, en fait** : désactiver les deux caches le temps de la
> relecture. Le site n'a que quelques visiteurs internes, la performance n'a
> aucune importance ici, et un cache actif est la première cause de « ça ne
> marche pas » sur ce genre de bascule.
>
> ```bash
> wp plugin deactivate w3-total-cache litespeed-cache 2>/dev/null || true
> ```

---

## Étape 4 — Ne pas se faire indexer deux fois

Deux sites au contenu identique à deux adresses : Google choisit lui-même
lequel garder, et ce peut être le mauvais.

Poser dans `~/wp.backontrackstudio.be/.htaccess`, **avant** les règles
WordPress :

```apache
# Site de relecture interne : il ne doit pas être indexé, et surtout pas
# concurrencer backontrackstudio.be sur son propre contenu.
<IfModule mod_headers.c>
  Header set X-Robots-Tag "noindex, nofollow"
</IfModule>
```

Vérifier :

```bash
curl -sI https://wp.backontrackstudio.be/ | grep -i x-robots-tag
```

---

## Étape 5 — Vérifier

```bash
# La page d'accueil répond sans rediriger vers le domaine principal
curl -sI https://wp.backontrackstudio.be/ | head -3

# Aucune URL du domaine principal ne subsiste dans la page servie
curl -s https://wp.backontrackstudio.be/ \
  | grep -o 'https://backontrackstudio\.be[^"]*' | head
```

La seconde commande **ne doit rien renvoyer**. Si elle renvoie des liens, c'est
qu'un cache n'a pas été vidé (étape 3) ou qu'une variante d'URL a échappé au
remplacement (`http://` sans `s`, ou `www.`) :

```bash
wp search-replace 'http://backontrackstudio.be' 'https://wp.backontrackstudio.be' \
  --all-tables-with-prefix --precise --recurse-objects
wp search-replace 'https://www.backontrackstudio.be' 'https://wp.backontrackstudio.be' \
  --all-tables-with-prefix --precise --recurse-objects
```

Puis ouvrir dans un navigateur : la page d'accueil, `/cours-semi-prives`,
`/tarifs`, et **`/wp-admin`** (la connexion doit aboutir).

---

## Revenir en arrière

Si quelque chose tourne mal, la sauvegarde de l'étape 2a rend l'état exact :

```bash
cd ~/wp.backontrackstudio.be
wp db import ~/wp-avant-bascule.sql
```

---

## Le jour où l'ancien site n'a plus lieu d'être

Les fichiers se suppriment, mais **la base a été réécrite** : elle pointe
désormais vers `wp.`. Si l'idée est un jour de remettre ce WordPress en
production, il faudra refaire le remplacement en sens inverse.

C'est le coût de cette voie, et c'est ce qui la distingue de celle décrite dans
`remettre-le-wordpress.md`, où la base n'est jamais touchée.

---

## Ce que les coachs vont trouver

L'archive n'est pas un site en bon état — c'est la raison pour laquelle il a été
remplacé. À dire avant qu'ils comparent, sans quoi ils compareront la vitrine à
un souvenir plutôt qu'au site réel :

1. **`/seance-dessai` est cassée** — « Google reCaptcha : Clé de site invalide ».
   La page censée capter les prospects ne fonctionne pas.
2. **`/horaire` renvoie vers Technogym**, que l'application a remplacé.
3. **Le délai d'annulation se contredit** : 12 h sur `/tarifs`, 24 h sur
   `/horaire`. C'est une clause contractuelle.
4. **Les tarifs sont figés dans le page-builder** — ils ne suivent pas la base,
   et c'est ce qui a produit la contradiction ci-dessus.

Sur `wp.`, deux effets supplémentaires, dus au sous-domaine lui-même :

- **Le formulaire de contact restera cassé**, et le reCaptcha le sera plus
  encore : sa clé est enregistrée pour le domaine d'origine.
- **Les paiements et connexions éventuels ne fonctionneront pas** — clés
  d'API et domaines déclarés ne correspondent plus. Sans importance pour une
  relecture visuelle.

# Remettre le WordPress, et rebasculer sur la vitrine

> Écrit le 2026-08-31, après que les coachs ont demandé à revoir l'ancien site.
> **Rien dans cette procédure ne touche `app.backontrackstudio.be`** : l'application
> des membres est sur un autre domaine et n'est pas concernée.
>
> **Christian a finalement retenu l'autre voie** — WordPress sur
> `desk.backontrackstudio.be`, décrite dans `wordpress-sur-desk.md`. Ce
> document reste : il documente une solution sans réécriture de base, utile si
> l'ancien site devait un jour reprendre sa place en production.

## Le principe, et pourquoi celui-là

La demande de départ était : « je déplace les fichiers WordPress dans
`desk.backontrackstudio.be` ». C'est faisable, mais ça coûte cher pour rien.

**Les URL de WordPress sont écrites en base de données**, pas dans les fichiers :
dans `wpbot_options` (`siteurl`, `home`), dans chaque lien de chaque page, et —
c'est le point qui pique — **sous forme sérialisée** dans les données Bricks.
Servir WordPress depuis un autre domaine oblige donc à réécrire la base, puis à
la réécrire en sens inverse le jour où on veut le remettre en production.

> Une chaîne sérialisée PHP porte la longueur du texte : `s:29:"https://backontrackstudio.be"`.
> Un `sed` sur le dump change le texte sans changer le nombre — et PHP jette
> alors la valeur **en silence**. Des blocs de page se vident sans une erreur.
> C'est pour ça qu'on utilise `wp search-replace`, jamais un remplacement texte.

**Donc : WordPress ne bouge pas de domaine.** Il reste sur
`backontrackstudio.be`, avec ses URL intactes, et un `.htaccess` décide lequel
des deux sites Apache doit servir. Basculer = déplacer un `#`.

Bénéfice secondaire : les coachs jugent l'ancien site **à son vrai emplacement**,
avec ses vraies URL — pas une copie sur un sous-domaine qui se comporterait
différemment.

## L'organisation visée

```
~/backontrackstudio.be/
   .htaccess       <- le commutateur (serveur/htaccess-bascule-wordpress)
   vitrine/        <- le dist/ React, ce qui est servi aujourd'hui
   wordpress/      <- les fichiers WordPress, wp-config.php compris
```

---

## Étape 0 — Vérifier avant de toucher

> **Confirmé par Christian le 2026-08-31 : la base n'a pas été supprimée.**
> Le cas « la base n'existe plus » ci-dessous ne devrait donc pas se présenter ;
> il reste écrit parce que cette procédure servira encore dans plusieurs
> semaines, quand ce ne sera plus frais.

Un contrôle malgré tout, avant de déplacer quoi que ce soit — il coûte trente
secondes et confirme que `siteurl` pointe bien encore vers le domaine d'origine.

```bash
ssh -i ~/.ssh/o2switch vach5679@109.234.165.117

# 1. L'archive WordPress est-elle bien là, et complète ?
ls -la ~/wordpress-archive-20260831/ | head
ls -l  ~/wordpress-archive-20260831/wp-config.php
du -sh ~/wordpress-archive-20260831/

# 2. La base WordPress existe-t-elle ENCORE ?
#    (c'est LA question : les fichiers sans la base ne servent à rien)
grep -E "DB_NAME|DB_USER|DB_HOST" ~/wordpress-archive-20260831/wp-config.php
```

Puis, avec le nom de base et l'utilisateur lus ci-dessus :

```bash
# Attention au préfixe : les tables sont en `wpbot_`, pas en `wp_`.
mysql -u LE_USER -p LA_BASE -e "SELECT option_name, option_value
  FROM wpbot_options WHERE option_name IN ('siteurl','home');"
```

**Trois cas.**

- **La requête répond `https://backontrackstudio.be`** → tout est intact,
  continuer à l'étape 1. **C'est le cas attendu**, et celui qui est confirmé.
- **La base n'existe plus** → la recréer dans cPanel, puis importer le dump :
  `zcat ~/wp-backontrack-20260831.sql.gz | mysql -u LE_USER -p LA_BASE`
  (le dump est aussi sur le Mac mini : `.dumps/wp-backontrack-20260831.sql.gz`).
- **`siteurl` répond autre chose** → s'arrêter et me le dire : quelqu'un a déjà
  modifié la base, et la suite de cette procédure ne s'applique plus telle quelle.

> **Ne pas se fier à UpdraftPlus comme filet.** Ses sauvegardes sont sur le
> même serveur : elles ne protègent pas d'une perte du compte.

---

## Étape 1 — Ranger les deux sites côte à côte

Toujours en SSH. Aucune suppression : tout est un déplacement, donc réversible.

```bash
cd ~

# Un filet, avant de commencer.
cp backontrackstudio.be/.htaccess ~/htaccess-vitrine-avant-bascule.sauvegarde

# La vitrine descend d'un cran, dans son propre dossier.
mkdir -p backontrackstudio.be/vitrine
cd backontrackstudio.be
# `.` et `..` exclus, et le nouveau dossier `vitrine` avec. Le `2>/dev/null`
# couvre le cas ou `.[!.]*` ne correspond a rien : le motif reste alors
# litteral, et `mv` se plaint d'un fichier nomme « .[!.]* » qui n'existe pas.
for f in * .[!.]*; do
  [ "$f" = "vitrine" ] && continue
  [ "$f" = ".htaccess" ] && continue
  mv "$f" vitrine/ 2>/dev/null
done
cd ~

# WordPress prend sa place à côté, SANS être déplacé de domaine.
mv ~/wordpress-archive-20260831 ~/backontrackstudio.be/wordpress
```

Contrôler :

```bash
ls ~/backontrackstudio.be/                    # .htaccess  vitrine  wordpress
ls ~/backontrackstudio.be/vitrine/index.html  # doit exister
ls ~/backontrackstudio.be/wordpress/wp-config.php
```

---

## Étape 2 — Poser le commutateur

Depuis le Mac mini, dans le dépôt :

```bash
scp -i ~/.ssh/o2switch serveur/htaccess-bascule-wordpress \
    vach5679@109.234.165.117:~/backontrackstudio.be/.htaccess
```

**À ce stade, rien n'a changé pour le visiteur** : le fichier est réglé sur la
vitrine. C'est voulu — on vérifie que le rangement n'a rien cassé *avant* de
basculer.

```bash
curl -sI https://backontrackstudio.be/ | head -3        # 200
curl -s  https://backontrackstudio.be/ | grep -o '<title>[^<]*'
```

Si la vitrine ne répond plus, remettre l'ancien `.htaccess` et s'arrêter :

```bash
cp ~/htaccess-vitrine-avant-bascule.sauvegarde ~/backontrackstudio.be/.htaccess
```

---

## Étape 3 — Basculer sur WordPress

Une seule ligne à commenter dans `~/backontrackstudio.be/.htaccess` :

```apache
  # RewriteRule ^ vitrine/index.html [QSA,L]
```

Et, deux lignes plus haut dans le fichier, faire suivre le repère de lecture :

```apache
# SetEnv SITE_ACTIF vitrine
SetEnv SITE_ACTIF wordpress
```

L'effet est **immédiat**, sans redémarrage. Vérifier :

```bash
curl -s https://backontrackstudio.be/ | grep -o '<title>[^<]*'
curl -sI https://backontrackstudio.be/wp-admin/ | head -3
```

### Rebasculer sur la vitrine

L'inverse, exactement : décommenter `RewriteRule ^ vitrine/index.html`.
**Dix secondes, et aucune base de données touchée.** C'est tout l'intérêt.

---

## Ce à quoi il faut s'attendre côté WordPress

L'archive n'est pas un site en bon état — c'est la raison pour laquelle il a
été remplacé. Les coachs doivent le savoir avant de comparer, sans quoi ils
compareront la vitrine à un souvenir plutôt qu'au site réel :

1. **`/seance-dessai` est cassée** — « Google reCaptcha : Clé de site invalide ».
   Le formulaire censé capter les prospects ne fonctionne pas.
2. **`/horaire` renvoie vers Technogym**, remplacé par l'application.
3. **Le délai d'annulation se contredit** : 12 h sur `/tarifs`, 24 h sur
   `/horaire`. C'est une clause contractuelle.
4. **Les tarifs sont figés dans le page-builder** : ils ne suivent pas la base,
   et c'est ce qui a produit la contradiction ci-dessus.

## Pendant que WordPress est en ligne

- **L'indexation.** Google voit deux sites différents à la même adresse. Sur
  quelques jours, sans conséquence. Au-delà d'une semaine ou deux, prévenir —
  il faudra un `noindex` le temps de la comparaison.
- **Le déploiement.** `./deploiement.sh prod-site` envoie vers
  `~/backontrackstudio.be/` et non `~/backontrackstudio.be/vitrine/`. **Ne pas
  le lancer** tant que le rangement de l'étape 1 est en place, sans avoir
  d'abord corrigé `DOMAINE` dans le script. `app.` et `jag.` ne sont pas
  concernés.

## Ce qui reste vrai

- Le dump `.dumps/wp-backontrack-20260831.sql.gz` **n'est toujours pas sorti du
  Mac mini**. Tant qu'il n'a pas de copie ailleurs, il ne protège de rien.
- Les 6,1 Go de sauvegardes UpdraftPlus reviennent avec les fichiers. Il sera
  temps de les purger quand la question de l'ancien site sera tranchée.

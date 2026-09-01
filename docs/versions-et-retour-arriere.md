# Versions différentes par domaine, et retour en arrière

> Écrit le 2026-09-01, en réponse à deux questions de Christian : peut-on avoir
> des versions différentes sur `jag.` et `app.` — et si celle de `jag.` ne
> convient pas, comment revient-on à la précédente ?

## Oui, et c'est déjà le cas

Relevé le 2026-09-01 au matin :

| Domaine | Version en ligne | Sert |
|---|---|---|
| `jag.backontrackstudio.be` | **3.109.0** | test (base bot3) |
| `app.backontrackstudio.be` | **3.92.0** | production (base bot-ops) |
| `backontrackstudio.be` | **3.112.0** | la vitrine |

**Dix-sept versions séparent `jag.` de `app.`** en ce moment. Rien ne les lie :
ce sont trois dossiers distincts sur le serveur, alimentés par trois commandes
distinctes.

```
~/jag.backontrackstudio.be/    <- ./deploiement.sh jag
~/app.backontrackstudio.be/    <- ./deploiement.sh ops
~/backontrackstudio.be/        <- ./deploiement.sh prod-site
```

Déployer sur l'un ne touche jamais les autres. C'est ce qui permet d'éprouver
une modification sur `jag.` pendant des jours sans que les membres en voient
quoi que ce soit.

> **Chaque cible a aussi sa base de données.** `jag.` écrit dans bot3 (test),
> `app.` dans bot-ops (production). Le script refuse de partir si le `.env` ne
> vise pas la bonne : c'est le contrôle « vise bien … » affiché au démarrage.
> Un déploiement de test qui écrirait dans la base des membres est impossible
> par construction.

---

## Revenir à la version précédente

**Le principe** : on ne « défait » pas un déploiement, on **redéploie** l'état
d'avant. Le dépôt garde chaque version ; il suffit de s'y replacer et de
relancer la commande.

### Étape 1 — Trouver la version voulue

**Depuis la v3.116.0, chaque version porte une étiquette** dans le dépôt :
`v3.116.0`, `v3.117.0`, et ainsi de suite. Il n'y a donc rien à chercher —
le numéro de version suffit.

Pour voir ce qui existe :

```bash
cd ~/bot
./scripts/version.sh
```

Et pour le détail d'une version précise :

```bash
./scripts/version.sh 3.109.0
```

Cette commande donne son commit, sa date, son sujet — et surtout **si elle
touche la base de données**, ce qui décide si le retour en arrière est sans
risque.

> Les versions antérieures à la v3.116.0 n'ont pas d'étiquette : le script
> donne alors leur identifiant de commit, qui fonctionne aussi bien.

### Étape 2 — S'y replacer, sans rien perdre

```bash
git stash                 # met de côté le travail en cours, s'il y en a
git checkout v3.116.0     # on se place sur cette version
```

> Pour une version antérieure à la v3.116.0, mettre son identifiant de commit
> à la place — `git checkout bec78f9` — que `./scripts/version.sh` a donné.

L'écran annonce alors « detached HEAD ». **Ce n'est pas une erreur** : cela veut
dire qu'on regarde une version passée sans être sur une branche. Rien n'est
supprimé, rien n'est perdu.

### Étape 3 — Redéployer

```bash
./deploiement.sh jag
```

Le script reconstruit **depuis les fichiers présents**, donc depuis la version
sur laquelle on s'est placé. `jag.` sert à nouveau cette version-là.

### Étape 4 — Revenir au présent

```bash
git checkout main
git stash pop             # si un `git stash` a été fait à l'étape 2
```

Et pour remettre `jag.` à jour : `./deploiement.sh jag` de nouveau.

**Compter deux minutes en tout.**

---

## Ce qui rend l'opération sûre — et les deux limites

### Le code revient en arrière sans risque

Un déploiement n'envoie que des fichiers construits. Redéployer une version
antérieure les remplace par les précédents, et il ne reste aucune trace de
l'aller-retour.

### Limite 1 — La base de données ne revient pas, elle

**C'est la seule vraie précaution.** Si la version à annuler a appliqué une
**migration** — une modification de la structure de la base — revenir au code
d'avant ne défait pas cette migration.

Cela ne pose problème que si la migration est *destructrice* (une colonne
supprimée, par exemple). Une migration qui ajoute quelque chose est sans
danger : l'ancien code l'ignore simplement.

> **Comment savoir ?** Regarder si le commit touche `supabase/` :
>
> ```bash
> git show --stat bec78f9
> ```
>
> S'il ne liste que des fichiers de `src/`, le retour est sans conséquence.
> C'est le cas du correctif du planning : il ne touche que trois fichiers de
> code, aucune migration.

### Limite 2 — Le serveur ne garde que 7 jours

Le script purge les fichiers construits de plus de sept jours. **Le serveur
n'est donc pas une archive** : au-delà d'une semaine, seul le dépôt permet de
reconstruire une version.

Ce n'est pas une gêne — reconstruire depuis git prend quelques secondes — mais
il ne faut pas compter sur le serveur pour retrouver un état ancien.

---

## Un cas particulier : le membre déjà connecté

L'application pose un **service worker** dans le navigateur des membres, qui
garde une copie de la version en cours. Après un retour en arrière, un membre
peut donc voir l'ancienne version quelques minutes de plus.

Elle se remplace seule à la visite suivante. Pour forcer tout de suite :
`Cmd + Shift + R` (Mac) ou `Ctrl + Shift + R` (Windows).

> Si un navigateur reste bloqué sur un écran blanc, c'est « Effacer les données
> de site » qu'il faut — **pas** l'historique, qui ne touche ni au service
> worker ni au cache.

---

## En résumé

| Question | Réponse |
|---|---|
| Des versions différentes par domaine ? | **Oui**, c'est le fonctionnement normal |
| `jag.` peut-il rester en avance ? | **Oui**, sans limite de durée |
| Revenir en arrière est-il facile ? | **Oui** — deux minutes, quatre commandes |
| Y a-t-il un risque ? | **Seulement si le commit touche `supabase/`** |
| Le serveur garde-t-il les anciennes versions ? | **Sept jours.** Le vrai filet est le dépôt |

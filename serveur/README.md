# Fichiers qui vivent sur le serveur

`deploiement.sh` exclut `.htaccess` du rsync : sans cette exclusion, `--delete`
emporterait la configuration Apache a chaque envoi. Ces fichiers ne sont donc
**jamais deployes automatiquement** — ils sont ici pour etre relus et versionnes,
et se recopient a la main quand ils changent.

| Fichier | Destination |
|---|---|
| `htaccess-vitrine` | `~/site.backontrackstudio.be/.htaccess` |

```bash
scp -i ~/.ssh/o2switch serveur/htaccess-vitrine \
    vach5679@109.234.165.117:~/site.backontrackstudio.be/.htaccess
```

## Ce que fait celui de la vitrine, en plus de celui de app.

- **`Options -Indexes`** — sans lui, `/assets/` renvoie l'inventaire complet des
  fichiers construits. Ce ne sont pas des donnees, mais la liste nomme chaque
  page de l'administration. **Le defaut existe encore sur `app.` et `jag.`.**
- **`X-Robots-Tag: noindex`** — le temps de la demonstration, en plus de
  `robots.txt`. **A retirer le jour de la bascule.**
- **`frame-ancestors 'self'`** au lieu de la liste d'origines : la vitrine n'a
  pas a etre integrable, contrairement a `app.` dont le WordPress affiche le
  planning en iframe.
- **`robots.txt` en `no-cache`** : il dit `Disallow` pendant la demonstration et
  `Allow` apres la bascule. Un cache d'un an laisserait le site desindexe
  longtemps apres qu'on ait ouvert l'indexation, sans le moindre signal.

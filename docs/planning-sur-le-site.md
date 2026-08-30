# Afficher le planning sur le site public

> Comment remplacer le widget Technogym de `backontrackstudio.be/horaire/` par
> le planning de l'application. Écrit le 2026-08-30.

---

## Ce que ça donne

Une page `/planning-public` dans l'application, faite pour vivre dans un cadre :
ni menu, ni pied de page, ni bouton de réservation. Juste la semaine, avec la
navigation d'une semaine à l'autre et un lien vers l'application pour réserver.

Elle remplace l'`<iframe>` vers `widgets.mywellness.com` actuellement en place.

---

## Le code à mettre dans la page WordPress

```html
<iframe
  src="https://app.backontrackstudio.be/planning-public"
  width="100%"
  height="1200"
  style="border:0"
  title="Planning des cours"
  loading="lazy"></iframe>
```

La hauteur est fixe — un cadre ne s'ajuste pas tout seul au contenu qu'il
affiche. 1200 px couvrent une semaine ordinaire ; à ajuster une fois le
planning rempli.

---

## L'étape qu'on oublie : autoriser le cadre

**Sans elle, le cadre reste blanc et rien n'explique pourquoi.**

L'application interdisait à tout site tiers de l'afficher dans un cadre
(`X-Frame-Options: SAMEORIGIN`). C'est la bonne règle par défaut : elle empêche
qu'une page piégée superpose un bouton invisible au-dessus des nôtres et fasse
cliquer un membre à son insu.

`public/.htaccess` la remplace désormais par une règle qui nomme les origines
admises — le site du studio, et lui seul.

> **`.htaccess` n'est PAS déployé par `./deploiement.sh`.** Il est exclu
> volontairement : il vit sur le serveur, indépendamment des versions. Il faut
> donc le copier à la main, une fois :
>
> ```bash
> scp -i ~/.ssh/o2switch public/.htaccess \
>   vach5679@109.234.165.117:~/app.backontrackstudio.be/.htaccess
> ```
>
> Puis vérifier que l'application répond toujours — une erreur dans ce fichier
> met tout le site hors service, pas seulement le planning.

---

## Ce que la page montre, et ce qu'elle tait

| | |
|---|---|
| Le nom du cours, l'heure, la durée | ✅ |
| La couleur du type de cours | ✅ |
| **Les places restantes** | ❌ — volontaire |
| Le nom du coach | ❌ |
| Un bouton pour réserver | ❌ — un lien vers l'application |

**Pourquoi pas les places restantes** : affichées publiquement, elles racontent
le taux de remplissage du studio à qui passe — un concurrent compris. Elles sont
utiles à un membre connecté, pas à un visiteur.

**Les cours annulés ne s'affichent pas.** Un planning parsemé d'« Annulé » donne
une mauvaise image à qui découvre le studio.

---

## Ce qui reste à faire côté site

- Retirer l'`<iframe>` vers `widgets.mywellness.com`
- Mettre à jour les textes qui renvoient encore à Technogym — la page en
  compte plusieurs, dont la marche à suivre pour la séance d'essai

---

## Une limite à connaître

**Le style ne suit pas celui du site.** Le cadre garde l'apparence de
l'application — ses couleurs, sa typographie. C'est cohérent avec ce que voient
les membres, mais ce n'est pas la charte du site vitrine.

Si les coachs veulent l'harmoniser lors du lifting, c'est possible : les
couleurs vivent dans des variables CSS (voir `adapter-le-style.md`).

# Adapter le style de l'application

> Ce que les coachs peuvent faire changer, et ce que ça coûte. Écrit le
> 2026-08-29, en prévision du lifting du site.

---

## En un mot

**Le logo se remplace sans toucher au code.** Les couleurs demandent une
recompilation — trois minutes, pas un chantier.

---

## Le logo

Déposer un fichier **`logo.svg`** dans `public/`, et c'est fait. L'application
le sert à la place de l'icône d'origine, aux trois endroits où il apparaît :
l'en-tête, l'écran de connexion, la page d'accueil.

```bash
cp <le-logo-des-coachs>.svg public/logo.svg
```

Un `logo.png` fonctionne aussi — le SVG est simplement cherché en premier.

**Sans ce fichier, rien ne casse** : l'icône haltère d'origine s'affiche.
L'application ne montre jamais une image brisée, même si le nom est mal
orthographié.

Sur une application déjà déployée, il suffit de transférer le fichier dans le
dossier du site. Aucune reconstruction.

> **Format conseillé** : SVG carré, dessin lisible à 24 px de côté — c'est la
> taille dans l'en-tête. Un logo horizontal avec le nom du studio y sera
> illisible ; le nom est de toute façon écrit à côté.

---

## Les couleurs

Tout vit dans `src/index.css`, en variables. La couleur principale du studio,
celle des boutons et des liens :

```css
:root {
  --primary: oklch(0.541 0.213 264);   /* la teinte actuelle */
}
```

Les thèmes clair et sombre sont définis séparément : `:root` pour le clair,
`.dark` pour le sombre. Changer l'un ne touche pas l'autre.

Les autres variables utiles :

| Variable | Ce qu'elle commande |
|---|---|
| `--primary` | boutons, liens, éléments actifs |
| `--background` / `--foreground` | fond de page et couleur du texte |
| `--card` | fond des cartes |
| `--muted-foreground` | textes secondaires |
| `--border` | traits de séparation |
| `--radius` | arrondi des angles |

> Les couleurs sont en **oklch**, pas en hexadécimal — un format où la
> luminosité se règle indépendamment de la teinte, ce qui évite qu'un texte
> devienne illisible en changeant de couleur. Un convertisseur en ligne suffit
> à traduire un `#RRGGBB` fourni par un graphiste.

**Après modification** :

```bash
npm run build
```

puis déployer `dist/`. Le CSS est figé à la construction : il n'y a pas moyen
d'y échapper aujourd'hui.

---

## Si les coachs veulent essayer beaucoup de teintes

Deux voies, non faites à ce jour :

**Un `theme.css` dans `public/`**, chargé après le reste, qui surcharge les
variables. Il se modifie par simple transfert de fichier, sans reconstruction.
Une demi-journée de travail.

**Les couleurs dans `app_settings`**, comme les autres réglages du studio.
Les coachs les changeraient eux-mêmes depuis l'écran Réglages. Plus long, mais
c'est la seule voie qui les rend autonomes.

> À n'entreprendre que si le besoin se confirme. Une charte se pose une fois,
> et un build de trois minutes est rarement le goulot.

---

## Ce qui ne relève pas du style

- **Le nom du studio** : `src/i18n/fr.json` et `en.json`, clé `app.name`
- **Le favicon** : `public/favicon.svg` et `public/icons/`
- **Les couleurs de l'écran d'accueil PWA** : `public/manifest.json`

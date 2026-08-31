# Confier la vitrine à quelqu'un d'autre

> À qui donner quoi, selon ce qu'on lui demande. Trois cas très différents :
> corriger un texte, retoucher le style, ou refondre la page.

---

## En un coup d'œil

| Ce qu'on veut faire | Fichiers à donner | Compétence requise |
|---|---|---|
| Corriger un texte, changer une photo | `VitrineAccueilPage.tsx` | savoir éditer un fichier texte |
| Retoucher le style | `src/vitrine.css` **seul** | CSS |
| Refondre la page | tout `src/**/vitrine*` + `public/vitrine/` | React |

**Le point qui rassure** : `src/vitrine.css` est **autonome**. Il ne dépend de
rien d'autre dans le projet — sa seule référence externe est la police Bebas
Neue, chargée depuis Google Fonts. Un designer peut donc travailler dessus sans
rien connaître de l'application.

---

## Cas 1 — Changer un texte ou une photo

**Un seul fichier suffit** : `src/pages/vitrine/VitrineAccueilPage.tsx`

Tous les contenus sont regroupés **en haut du fichier**, avant le balisage.
C'est délibéré : corriger une phrase ne demande pas de lire une ligne de React.

| Ligne | Contenu |
|---|---|
| `ARGUMENTS` | les quatre arguments du bloc « Le studio à taille humaine » |
| `FORMULES` | les trois formules, leur texte, leur photo et leur lien |
| `COACHS` | les trois coachs, leur photo et leur objectif |
| `PHOTOS_STUDIO` | les huit photos du carrousel |
| `TEMOIGNAGES` | les six avis clients |

Chaque entrée est du texte entre guillemets. Pour changer une photo, remplacer
le nom du fichier et déposer la nouvelle image dans `public/vitrine/`.

> **Deux pièges à signaler à la personne.**
>
> Une apostrophe dans un texte entouré d'apostrophes casse le fichier. Utiliser
> `"L'énergie…"` (guillemets droits autour) plutôt que `'L'énergie…'`.
>
> Les virgules entre les entrées comptent. En retirer une par mégarde suffit à
> empêcher le site de se construire.

Les titres de sections, eux, sont dans le balisage plus bas, entre
`<h2 className="v-titre-section">` et `</h2>`.

---

## Cas 2 — Confier le style à un designer

**Un seul fichier à donner** : `src/vitrine.css` — 1 611 lignes, autonome.

Il ne contient **que** l'apparence : aucune logique, aucun texte, aucune
donnée. Le designer peut le modifier de bout en bout sans risque de casser le
fonctionnement du site.

### Ce qu'il faut lui dire

**Les réglages sont groupés en haut**, dans le bloc `.vitrine { … }` : couleurs,
espacements, tailles de titres, largeur du contenu. Changer une valeur là
suffit souvent — le reste du fichier s'y adapte.

```css
--v-encre        #ffffff    la couleur des titres
--v-encre-douce  #dddedf    la couleur des textes courants
--v-fond         #000000    le fond des sections
--v-largeur      1180px     la largeur du contenu
```

**Les classes sont préfixées `v-`** et nommées en français : `.v-hero`,
`.v-titre-section`, `.v-formule`, `.v-temoignage`, `.v-bouton`. Le préfixe
évite toute collision avec l'application.

**Les commentaires expliquent le pourquoi**, pas le quoi. Beaucoup citent les
identifiants du site WordPress d'origine (`#brxe-uxxmxn`, `#brxe-emojml`) : ce
sont les valeurs relevées sur l'ancien site, dont la page actuelle est une
reprise fidèle. Un designer qui veut s'en écarter peut les ignorer — mais
qu'il sache qu'elles ont été choisies, pas improvisées.

**Ne pas toucher** aux noms de classes : le balisage React s'en sert. Changer
`.v-hero__titre` en `.hero-title` casse la page sans message d'erreur.

### Comment il travaille sans installer le projet

Le plus simple : lui donner **l'adresse du site en ligne** et le fichier CSS.
Il retouche le fichier, vous le remettez en place, vous déployez, il regarde.

S'il veut voir ses modifications en direct, il lui faut le projet complet et
`npm install` puis `npm run dev` — ce qui suppose Node installé.

---

## Cas 3 — Refondre la page

Là, il faut donner davantage :

```
src/pages/vitrine/          les 4 pages
src/components/vitrine/     les 5 blocs réutilisés
src/vitrine.css             le style
public/vitrine/             les 28 photos
```

**Ce qu'il faut savoir avant de confier ce travail** : trois blocs **lisent la
base de données** et ne sont donc pas de simples textes.

| Bloc | Ce qu'il lit |
|---|---|
| `BlocTarifs.tsx` | les sept packs, leurs prix, les délais d'annulation |
| `BlocFaq.tsx` | les questions fréquentes |
| `VitrineContactPage.tsx` | envoie le formulaire de contact |

C'est **voulu**, et c'est la raison d'être de la vitrine : le WordPress
figeait ses tarifs dans le page-builder, et avait fini par annoncer deux délais
d'annulation contradictoires — 12 h sur une page, 24 h sur l'autre, sur une
clause contractuelle. Ici, les chiffres viennent de l'application : ils ne
peuvent pas diverger.

**Un designer peut changer leur apparence sans rien casser.** Ce qu'il ne faut
pas faire, c'est remplacer ces blocs par des valeurs écrites en dur — le site
recommencerait à mentir sur les prix dès la première modification de tarif.

---

## Ce qu'il ne faut donner à personne

- **Les fichiers `.env*`** — ils contiennent les clés d'accès à la base et à
  Stripe. Un designer n'en a aucun besoin.
- **Le dossier `.dumps/`** — les sauvegardes de base, avec les données des
  membres.
- **`deploiement.sh`** — il contient l'adresse du serveur et sait écrire en
  production.

Le reste du dépôt (l'application des membres, les Edge Functions, les
migrations) n'a rien à voir avec la vitrine et n'a pas à être partagé pour ce
travail.

---

## Comment récupérer son travail

Le plus simple, s'il ne travaille pas avec git : il vous renvoie les fichiers
modifiés, vous les remettez à leur place, et vous lancez

```bash
./deploiement.sh prod-site
```

Le script reconstruit le site et l'envoie. **Toujours regarder le résultat
avant de valider** : il demande de taper `OUI` avant d'écrire en production,
et c'est le bon moment pour vérifier.

En cas de problème, `git diff` montre ce qui a changé, et `git checkout` annule
tout.

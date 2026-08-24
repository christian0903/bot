# CLAUDE.md — Back On Track (projet « bot »)

> Ce fichier dit **comment travailler sur ce dépôt**. Il ne décrit ni le
> fonctionnement de l'application ni son modèle de données : cela vit dans
> `docs/`, qui reste la source de vérité. Quand les deux divergent, `docs/`
> a raison — et ce fichier est à corriger.

**Langue : tout en français.** Code, commentaires, messages de commit,
documentation, échanges. Les commentaires expliquent *pourquoi*, jamais *quoi*.

---

## Par où commencer

| Question | Fichier |
|---|---|
| Où en est le projet, que reste-t-il à faire | `docs/journal-projet.md` — **à lire en premier à chaque reprise** |
| Comment ça marche techniquement, quels pièges | `docs/documentation-technique.md` |
| Installer une base neuve, importer des données | `docs/guide-installation.md` |
| Ce que voit l'utilisateur, ce que voit l'admin | `docs/guide-membre.md`, `docs/guide-admin.md` |

Le `README.md` est le template Vite d'origine, jamais adapté : il ne dit rien
de ce projet.

---

## Les cinq règles qui coûtent cher quand on les oublie

Chacune correspond à un incident réel, raconté dans le journal.

### 1. Toute migration se reporte dans `install.sql`, dans le même commit

`supabase/install.sql` doit pouvoir reconstruire une base complète à partir de
rien. Une migration appliquée sans y être reportée le rend faux **en silence** :
il paraît fonctionner et produit une base incomplète.

Le rattrapage différé échoue de façon répétée — le 7 août, douze migrations
reprises en fin de session avaient laissé passer une table, cinq fonctions, un
trigger, quatre colonnes, deux index et un réglage.

Une policy RLS se reporte **aussi** dans `check-policies.sql`. Le détail du
quoi-va-où est dans `documentation-technique.md`, section « Déploiement ».

### 2. Version mineure incrémentée à chaque commit

`package.json` : `2.62.1` → `2.63.0`. Sauf indication contraire de Christian.

### 3. Un guide modifié dans `docs/` doit être recopié dans `public/`

La page `/help` sert `public/`, pas `docs/`. Rien ne les synchronise.

```bash
cp docs/guide-admin.md   public/guide-admin.md
cp docs/guide-membre.md  public/guide-utilisateur.md   # noter le renommage
```

Sans cette copie, la modification est **invisible pour l'utilisateur**. Deux
journées de documentation avaient ainsi disparu.

### 4. Le webhook est le seul endroit qui crédite

Jamais depuis le front, jamais depuis `create-checkout-session`. Créditer
ailleurs, c'est offrir des crédits à qui ferme la page avant de payer.

Et son déploiement redemande le drapeau à chaque fois :

```bash
supabase functions deploy stripe-webhook --no-verify-jwt
supabase functions list    # contrôler : VERIFY JWT = false
```

L'oublier coupe les encaissements sans aucun signal visible.

### 5. Toujours tester `error` après une écriture Supabase

Un refus d'écriture **ne lève pas d'exception** : l'erreur arrive dans l'objet
de réponse, que le code peut ignorer sans rien remarquer. Un coach annulait son
cours, le journal s'écrivait, les crédits partaient — et le cours restait
planifié.

Corollaire : un `UPDATE` qui ne touche aucune ligne **ne renvoie pas d'erreur**.
Pour écrire-ou-créer, utiliser `upsert`. Ce piège a produit deux bugs distincts.

---

## Conventions de code

**Architecture.** Pas de serveur applicatif : le front parle directement à
Supabase, et les opérations sensibles passent par des Edge Functions (Deno).
Les clés secrètes ne quittent jamais ces fonctions.

**Imports.** Alias `@/` vers `src/` (`import { supabase } from '@/lib/supabase'`).

**Composants.** shadcn/ui dans `src/components/ui/` — code généré, à ne pas
remanier à la main : une régénération l'écraserait.

**Bilingue.** Deux styles coexistent : `useTranslation()` avec `src/i18n/*.json`
pour les textes durables, et `const isFr = i18n.language === 'fr'` en ligne pour
les libellés ponctuels. Suivre ce que fait déjà le fichier ouvert.

**Types.** `src/types/index.ts`. Deux points appris à leurs dépens :

- Une jointure PostgREST peut arriver comme un objet **ou** comme un tableau
  d'un élément. Passer par `one()` de `@/lib/supabase-joins`, jamais par un
  `as any` — le cast éteint aussi le contrôle sur le champ lu, et une faute de
  frappe dans un nom de colonne ne se voit alors qu'à l'écran, en `undefined`.
- `ScheduledClass.coach` est un `CoachRef` (`id`, `display_name`,
  `avatar_url`), pas un `Profile` : `profiles` est protégée par RLS et ne peut
  pas être jointe, les pages chargent donc les coachs à part et n'en prennent
  que ce qu'elles affichent.

**Statut d'un cours.** Toujours **dérivé** (date + `is_cancelled` + nombre
d'inscrits), jamais stocké. Une colonne devrait être entretenue par un cron et
finirait par diverger du réel.

---

## Vérifier avant de livrer

```bash
npm run build    # tsc + vite — doit passer
npm run lint     # voir la note ci-dessous
```

Le lint sort **37 signalements résiduels**, tous du React Compiler
(`set-state-in-effect`, `static-components`, `exhaustive-deps`). Ils portent sur
du code qui tourne et qui a été validé à l'écran ; les corriger change le
comportement au runtime. C'est un chantier à mener page par page, **pas** un
nettoyage de lint. Ne pas les traiter au passage, et ne pas laisser ce nombre
augmenter.

Pour une modification touchant Stripe ou les crédits, l'écran ne suffit pas :
éprouver au *test clock* (procédure dans `documentation-technique.md`).

---

## Commits

Le dépôt a un style constant, à conserver : **un sujet qui dit l'effet obtenu,
pas l'action menée**, puis un corps qui explique le problème et pourquoi cette
solution-là.

```
Suivi des clients : reperer qui ralentit avant de le perdre
Abonnement : vendre en aout ce qui commence en septembre
Pack ponctuel : la duree de validite suffit, pas de starts_at
```

Les sujets s'écrivent **sans accents** (contrainte d'affichage) ; le corps du
message, lui, est accentué normalement.

Terminer par :

```
Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
```

**Ne jamais commiter ni pousser sans validation explicite de Christian**, ni
déployer quoi que ce soit — fonctions, migrations, front.

---

## Handoffs

Les passages de relais entre sessions (Mac mini ↔ MacBook) s'écrivent dans
`docs/handoffs/` — plus dans le vault Obsidian, depuis le 2026-08-23. Le skill
`handoff` connaît l'exception. Dire « handoff » à la clôture, « handoff
reprise » au démarrage.

La daily note du vault garde un résumé de la journée, mais renvoie ici par un
chemin plutôt que par un `[[wikilink]]`.

---

## Tenir le journal

`docs/journal-projet.md` est ce qui rend le projet reprenable après une
interruption. Une session qui livre quelque chose s'y inscrit : ce qui a été
fait, **ce qui a été décidé et pourquoi**, ce qui reste ouvert. Les décisions
écartées valent d'être notées autant que celles retenues — elles évitent de
refaire le même détour six semaines plus tard.

---

## État de l'environnement

- `.env` est présent (Supabase). `VITE_APP_URL` figure dans `.env.example`
  mais **pas** dans `.env` — à vérifier avant de dépendre de cette variable.
- Les données en base sont **des données de test**, assumées comme telles. Les
  statistiques paraîtront anormalement basses : le seed a produit beaucoup de
  cours sans participants.
- L'application tourne sur **Stripe**. La migration vers Mollie inscrite au
  plan initial a été **abandonnée** le 2026-08-03 — le plan mentionne encore
  Mollie par endroits, ne pas s'y fier.

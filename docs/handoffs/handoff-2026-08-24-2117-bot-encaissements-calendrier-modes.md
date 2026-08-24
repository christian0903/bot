---
type: handoff
projet:
domaine:
session-machine: mac-mini
session-date: 2026-08-24
session-heure: "21:17"
auteur: "[[@Christian Vanhenten]]"
statut: actif
created: 2026-08-24
tags:
  - claude/handoff
  - bot
  - encaissements
  - planning-calendrier
  - modes-utilisation
  - pwa
---

# Handoff — App Bot : encaissements, calendrier, modes d'utilisation

> Journée du 2026-08-24, **deux sessions successives** : la matinée (`e3af6f5a`,
> 24 commits, jusqu'à la v3.5.0) puis l'après-midi et la soirée (8 commits,
> `f33de65..9f91f0d`). **v3.12.0** au total. Arbre propre, build vert, lint
> stable à 37 signalements React Compiler.
> **`dist/` compilé en 3.12.0 mais non uploadé.**

---

## Où on en est

Séance ouverte sur une fausse alerte : une session Claude bloquée dans un
terminal figé, que Christian craignait de perdre. Vérification faite, tout son
travail était commité et poussé (`f33de65`, la fiche de cours du coach). Rien
de perdu. Aucune session `tmux` ne tournait — les deux sessions vivaient nues
dans des onglets Terminal.

Elle a ensuite enchaîné sept chantiers, tous nés d'un usage réel : Christian
testait l'application sur son iPhone et signalait ce qui coinçait — c'est aussi
ce qui avait mené la matinée.

## La matinée — 24 commits, session `e3af6f5a` (08h39 → 16h33)

Cette session-là a tenu le journal projet au fil de l'eau : le détail y est,
en ordre antéchronologique. Résumé de ce qu'elle a livré, pour que la journée
se lise d'un bloc :

| Sujet | Commit |
|---|---|
| PWA installable sur l'écran d'accueil, bandeau de mise à jour | `6db884a`, `beda56f` |
| Redemander l'e-mail de confirmation | `511c0c7` |
| Version visible dans l'en-tête + guide de test iPhone | `3884a65` |
| Tentatives d'inscription au journal, effacer un parasite | `50e9ed8` |
| Planning : séparer semi-privé et Personal Training | `aac864f`, `b3a526d` |
| Filtres du planning lisibles, conflits annoncés | `6b9621e` |
| Ranger plusieurs membres d'un coup, catégorie dans la liste | `27a23d3`, `fc53370` |
| Pack qui attribue une catégorie à l'achat, rendue à l'expiration | `80a30de` |
| **Inscription : cesser d'annoncer un e-mail qui ne part pas** | **`358987f`** |
| Documentation du B2B, expliquée et non plus mentionnée | `484f288` |
| Notifications descendues sous l'encoche de l'iPhone | `5331956` |
| Paiement Stripe qui n'ouvrait rien sur le web | `1f2dd6c` |
| Abonnements en semaines ou mois, suppression expliquée | `70f1027` |
| Types de packs : trois statuts, corbeille au super admin | `4d2ae75` |
| Fiche de cours : liste d'attente, boutons présent/absent | `f33de65` |

**`358987f` mérite d'être retenu** — c'est le défaut le plus visible pour un
nouveau membre. Sur une adresse déjà inscrite, l'écran affichait « Un e-mail
vient d'être envoyé à… » **et**, plus bas, « Tu as déjà un compte ». La
première affirmation était fausse : Supabase n'envoie rien dans ce cas, et la
personne attendait un message qui ne viendrait jamais. Le front *savait* qu'il
s'agissait d'un doublon mais jetait l'information. Corrigé sans lever la
protection anti-énumération : le message devient conditionnel, le bouton
« Renvoyer l'e-mail » disparaît (Supabase le refuserait), et le bouton
principal devient « Me connecter ».

## L'après-midi et la soirée — session courante

**`7899ae0` — Encaissement d'un pack : dire d'où vient l'argent.**
Les boutons « Cadeau » et « Paiement manuel » ne faisaient que préremplir le
champ prix : l'information mourait à l'écran. Un pack offert au tarif plein
ressemblait à une recette. Colonne `payment_method` (`stripe`, `cash`,
`transfer`, `gift`) sur `pack_purchases`. Confirmation obligatoire avant tout
encaissement, fond ambre dans le journal d'activité, colonne « Mode de
paiement » à l'export. Corrigé au passage : l'`INSERT` sans `select()` (règle 5).

**`88dd663` — Grille hebdomadaire du planning admin.**
Bascule Liste / Calendrier. Une case vide crée un cours, jour et heure
préremplis — ce qu'une liste ne permet pas. Aucune requête ajoutée : les données
couvraient déjà ±1-2 mois. Repli sur une seule journée sous 768 px.

**`70e17fd` — Sélecteur Membre / Coach / Admin.**
`MobileBottomNav` supposait que « le staff ne s'entraîne pas au studio », et
l'en-tête masquait quatre entrées au staff. Un admin n'atteignait ni ses
réservations, ni ses packs, ni la boutique — sur aucun support.

**`b40facb` — Allègement du chargement initial.**
349,6 → 305,0 ko gzip (−12,8 %). `HomePage`, seule page non différée,
importait `react-markdown` en statique pour une annonce conditionnelle.

**`a3ffa6e` — Le mode Membre n'est plus effacé par une redirection.**
Le clic menait à `/`, `HomePage` redirigeait vers `/admin/dashboard`, et l'URL
— qui fait foi — écrasait le choix. Coach y échappait : `/coach/my-classes` est
une vraie page.

**`3600b6c` — Ce qu'on ouvre le plus vient en premier.**
Stats coach repliées par défaut ; Gestion du planning en 2ᵉ position du menu.

**`52029e9` — Mise à jour PWA : sortir de la boucle.**
`recharger()` faisait un `reload()` quand aucun worker n'attendait — or un
rechargement ne remplace jamais un worker actif. Et `cache.addAll` rejetait en
bloc : une requête ratée bloquait l'installation *définitivement*.

## Ce qui a été appliqué en production

| | État |
|---|---|
| Migration `payment_method` | ✅ appliquée (31 lignes : 8 `stripe`, 15 `gift`, 8 `NULL`) |
| `install.sql` | ✅ reporté, même commit |
| `stripe-webhook` | ✅ déployé v13, `verify_jwt: false` vérifié |
| Front en ligne | ⚠️ **3.11.0** — la 3.12.0 n'est pas uploadée |

## Décisions

- **Pas de séparation client / staff façon Technogym.** Mesuré : cela
  économiserait **2,2 ko** sur le démarrage d'un membre, le lazy-loading par
  route protégeant déjà tout le reste. Sans commune mesure avec le coût.
- **Colonne en base plutôt que journal seul** pour le mode de paiement : le
  journal d'activité est purgeable dès six mois, la colonne survit.
- **Espèces et virement séparés**, pas un « manuel » unique : caisse et compte
  bancaire se rapprochent séparément.
- **Les 8 lignes `NULL` ne sont pas devinées.** Un identifiant Stripe prouve un
  paiement en ligne, un prix nul un cadeau ; le reste reste `NULL` plutôt que
  de fabriquer une recette en caisse qui n'a peut-être jamais existé.
- **Deux commits séparés** pour la grille et le sélecteur : un effet par commit.

## Prochaine action

**Uploader `dist/` (v3.12.0)** vers `desk.backontrackstudio.be` par FTP/SFTP,
`.htaccess` compris. La 3.11.0 y est déjà — quelqu'un avait uploadé en cours de
journée — mais le correctif PWA n'atteindra personne sans cet upload.

Contrôle après upload :

```bash
curl -s https://desk.backontrackstudio.be/sw.js | sed -n '3p'   # doit dire 3.12.0
```

## Points ouverts

- **iPhone de Christian bloqué en 3.2.** Les correctifs PWA ne le débloqueront
  pas : pour recevoir le nouveau code, il faudrait qu'il sache se mettre à jour.
  Sortie manuelle : Réglages → Safari → Effacer historique et données.
- **8 lignes `payment_method NULL`** (2 125 €) à qualifier si Christian sait ce
  qu'elles étaient.
- **Un membre en base n'apparaît pas dans la liste d'ajout à un cours** —
  signalé le 24/08 à 15h56, jamais repris.
- **Contraste du bloc annonce en thème sombre** : il faut zoomer pour le voir.
- **Non éprouvé à l'écran** : la grille calendrier, le repli des stats coach et
  la correction du mode Membre. La session de test Chrome était ouverte sur un
  compte membre (Ingrid), sans accès aux espaces coach et admin. Prévoir une
  session admin pour les prochaines vérifications visuelles.

## Fichiers créés dans la session de l'après-midi

- `src/components/admin/WeekGrid.tsx` — la grille hebdomadaire
- `src/contexts/ModeContext.tsx` — le mode d'utilisation (dérivé, pas d'effet)
- `src/components/layout/ModeSwitcher.tsx` — la bascule
- `src/components/common/AnnonceMarkdown.tsx` + `RenduMarkdown.tsx` — markdown différé
- `supabase/migrations/20260824_mode_paiement_pack.sql`

---
type: handoff
projet:
domaine:
session-machine: mac-mini
session-date: 2026-08-28
session-heure: "18:23"
auteur: "[[@Christian Vanhenten]]"
statut: actif
created: 2026-08-28
tags:
  - claude/handoff
  - bot
  - base-de-donnees
  - migration
  - install-sql
  - remarques-coachs
---

# Handoff — App Bot : vers une base neuve opérationnelle

> Session du 2026-08-28, journée entière. **v3.33.0**, onze commits poussés
> (`ca7c803..079aae0`), build vert, lint stable à 36, arbre propre.
> `dist/` construit en 3.33.0 et déployé sur o2switch.

---

## Le programme de demain

**Migrer les données de test de `bot` vers une base neuve**, pour éprouver la
procédure avant de s'en servir en production. Deux étapes, dans cet ordre :

1. **Les coachs testent la version 3.33.0** en ligne. Ils confirment que tout
   fonctionne.
2. **Une fois leur retour obtenu**, créer une base opérationnelle **vide** mais
   portant la structure exacte d'aujourd'hui, puis y importer les données de
   test pour vérifier que la chaîne complète tient debout.

C'est cette répétition qui autorisera ensuite le vrai passage en production.

### `install.sql` est-il à jour ? — vérifié, oui

Contrôle fait en fin de session, objet par objet et non au compteur :

| | `install.sql` | Base `bot` | Verdict |
|---|---|---|---|
| Tables | 27 | 27 | identique |
| Policies | 93 | 89 | **cohérent** — 4 portent sur `storage.objects`, hors schéma `public` |
| Fonctions | 79 déclarations | 80 | **cohérent** — `get_available_credits` a deux signatures, toutes deux déclarées (l. 791 et 850) |
| Triggers | 16 | 14 | **cohérent** — 2 sont sur `auth.users`, hors `public` |
| Colonnes | — | 275 | — |

Et les **sept migrations du jour** sont toutes reportées dans `install.sql` :
`pack_types_lecture_detenteurs`, `alignement_policies_bot`,
`duree_par_defaut_type_cours`, `recalcul_statut_membre`,
`statuts_membre_parcours`, `stats_parcours`. La septième
(`chemins_images_relatifs`) ne touche que des données, rien à reporter.

`check-policies.sql` liste 89 policies — le compte exact.

> **Aucun écart réel entre `install.sql` et `bot`.** Le fichier peut servir de
> référence pour créer la base neuve.

### Ce qui n'est PAS dans `install.sql`, et qu'il faudra faire à la main

`install.sql` couvre les tables, policies, fonctions, triggers, index, GRANT
**et le bucket Storage**. Restent hors de sa portée, parce que ce sont des
réglages de projet et non du SQL :

| À refaire sur la base neuve | Automatisable ? |
|---|---|
| Déployer les 10 Edge Functions | ✅ `supabase functions deploy` — `stripe-webhook` avec `--no-verify-jwt` |
| Poser les 8 secrets (Stripe, Resend, URL) | ⚠️ scriptable, mais les valeurs appartiennent à Christian |
| Réglages Auth (redirections, gabarits d'e-mails) | ✅ via `config.toml`, **absent du dépôt** |
| Repointer le webhook Stripe | ❌ manuel — vit chez Stripe, pointe sur l'URL du projet |
| Promouvoir le premier `super_admin` | `supabase/promouvoir-super-admin.sql` |
| **Cocher « Automatically expose new tables »** à la création | Sinon la base refuse toute lecture (incident du 27 août) |

> **Le webhook Stripe est le piège du déménagement.** Un déménagement rate
> rarement sur le SQL ; il rate sur un webhook oublié, qui coupe les
> encaissements sans aucun signal. C'est la règle n° 4 du dépôt.

### Les scripts prêts

| Script | Rôle |
|---|---|
| `scripts/sauvegarder-bot.sh` | Export seul, lecture pure — ne touche à rien |
| `scripts/copier-bot-vers-bot2.sh` | Copie des données |
| `scripts/copier-storage.sh` | Copie les 8 fichiers du bucket. Plus aucune URL à réécrire depuis le passage aux chemins relatifs |
| `scripts/comparer-bases.sh` | Compare le **texte** des policies, fonctions, colonnes, contraintes et droits entre deux bases |

> ⚠️ **`copier-bot-vers-bot2.sh` et `comparer-bases.sh` visent en dur
> `dcfzupyzdrndqegyeafg`** — la base de développement supprimée. Premier geste de
> demain : y mettre la référence de la nouvelle base, sinon ils s'adressent à un
> projet qui n'existe plus.

> **La chaîne complète n'a jamais tourné d'un bout à l'autre sans
> intervention.** Les trois échecs d'import du matin ont été corrigés en cours
> de route, et le chargement final est passé par un `psql` manuel — pas par le
> script. C'est précisément ce que la répétition de demain doit établir.
>
> **Protocole** : base neuve, script seul, **aucune correction en cours de
> route**. Tout arrêt est un défaut de la procédure à consigner, pas un
> incident à contourner.

**Rappel** : `bot` est la **référence absolue**. La base de test ne sert qu'à
éprouver la migration ; rien ne doit y rester qui n'existe pas dans `bot`.

---

## Ce que la journée a livré

Onze commits, de `ca7c803` à `079aae0`. Le détail est au journal ; l'essentiel :

**Deux bugs signalés par les coachs**, aucun à l'endroit supposé. Le bouton
« Enregistrer » était mort sur les performances chrono (une condition exigeait
un champ que le formulaire n'affiche pas). Et « 0 crédit » venait d'une policy
RLS qui cachait au membre un pack retiré de la vente — six membres ont retrouvé
leur solde.

**Le planning annonçait un travail sans offrir le moyen de le faire** : le badge
« Présence à confirmer » et le bandeau qui porte le bouton de pointage
appliquaient deux règles différentes. Ils partagent désormais la même fonction.

**Les statuts de membre** suivent le parcours réel — premier contact, potentiel,
membre, inactif, ancien — et se recalculent enfin : la fonction existait, presque
rien ne l'appelait, et 9 profils sur 23 portaient un statut faux.

**Le tableau de bord** passe à neuf chiffres sur trois lignes, dont la valeur
consommée, les crédits perdus et la valeur produite.

**Les coachs lisent les performances de leurs membres**, par la fiche d'un cours
ou par une nouvelle page « Membres ». En lecture seule.

**Les images ne dépendent plus du projet qui les héberge** : la base ne stocke
que le chemin, le front reconstruit l'adresse. Sans cela, la migration de demain
aurait laissé les images pointer vers l'ancienne base — un défaut invisible
jusqu'au jour où on supprime le projet.

---

## Points ouverts

**En attente des coachs** — deux e-mails envoyés, sans réponse :

- le seuil « ancien membre » (4 semaines est court : vacances, blessure) et la
  question du membre à pack actif sans frais payés. **Partiellement tranché**
  depuis : Christian a arrêté les définitions, seuls les seuils restent à
  confirmer à l'usage ;
- la formule du « € par heure de cours ». **Devenu sans objet** : le tableau de
  bord raisonne désormais par cours, pas par heure.

**Non traité** — `registration_fees` ne garde aucune trace de suppression. Un
admin peut retirer les frais d'un membre sans que rien ne l'enregistre. Sans
effet sur les statuts (ils ne regardent plus les frais), mais fausserait un
historique de conversion.

**Question laissée ouverte** — le bandeau des cours à pointer liste **19 cours**
sur les données de test, sans limite d'affichage. Faut-il le plafonner ? La
question ne se posera plus avec des données réelles.

**À signaler aux coachs** — leur barre du bas remplace « Perfs » (les *types* de
performance) par « Membres ». Les types restent au menu du haut.

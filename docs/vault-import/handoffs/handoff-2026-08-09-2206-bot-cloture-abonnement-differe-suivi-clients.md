---
type: handoff
agent: claude-code
session-machine: mac-mini
session-date: 2026-08-09
session-heure: "22:06"
projet:
domaine: "[[_developpement]]"
auteur: "[[@Christian Vanhenten]]"
statut: actif
created: 2026-08-09
tags:
  - claude/handoff
  - handoff
  - bot
  - abonnement
  - suivi-clients
---

# Handoff — App Bot : démarrage différé, suivi des clients, guides remis d'aplomb

> Session du 2026-08-09. **v2.62.0 déployée** sur o2switch. Tout est poussé, l'arbre de travail est propre.
> Prend la suite de [[handoff-2026-08-08-2128-bot-quota-frequentation-et-avis]].

---

## Reprendre

```bash
cd ~/bot && claude
```

---

## Ce qui a été livré

**Vendre en août un abonnement qui commence en septembre.** Un champ « Démarrer plus tard » sur la confirmation d'abonnement, appuyé sur `trial_end` de Stripe. La carte est enregistrée le jour de la vente, rien n'est prélevé avant la date choisie, et surtout **aucun crédit n'existe avant** — impossible de s'entraîner en août avec un abonnement de septembre.

Le changement est resté minuscule parce que le webhook ignorait déjà les factures à 0 €, garde-fou écrit le 5 août contre un autre bug. Éprouvé au *test clock* Stripe : aucun pack à la souscription, pack créé au jour dit, cycle suivant enchaîné à la seconde près.

**Pour le pack ponctuel, décision de ne rien développer** : on choisit un pack dont la durée de validité couvre la période visée. `pack_purchases` n'a pas de `starts_at`, et lui en ajouter un pour un cas rare qu'une phrase au client règle mieux n'avait pas de sens.

**Page « Suivi clients »** (`/admin/client-tracking`) — qui ralentit, qui décroche, qui rapporte quoi. Trois décisions de conception :

- **La tendance, pas le cumul.** Un total reste élevé chez quelqu'un qui a cessé de venir. La page compare la période récente à la précédente, de même durée.
- **Deux colonnes de présence.** « Réservé » est toujours fiable (le crédit a été consommé), « pointé » dépend de la rigueur du coach. L'écart entre les deux est lui-même une information. Le classement s'appuie sur la réservation — fonder l'alerte sur le pointage produirait de faux décrocheurs.
- **Le revenu par séance, pas le total.** `booking_revenue()` existait déjà et gère le cas du pack illimité : réutilisée plutôt que recalculée.

Les « jamais venus » sont exclus de l'onglet « À relancer » : un inscrit jamais présent appelle un accueil, pas une relance.

**Guides remis d'aplomb.** Un tableau d'orientation en tête de chaque guide, avec les entrées du menu dans l'ordre. Six libellés étaient faux — « Membres » s'appelle en réalité *Utilisateurs*, « Réglages » est *Paramètres*, « Planning » est *Gestion du planning*.

---

## Le piège de la double copie

**Les guides vivent en double** : `docs/` pour le travail, `public/` pour ce que la page d'aide affiche réellement. J'éditais le premier depuis deux jours — l'application servait donc une version antérieure de 62 lignes.

C'est le troisième écart du même type en trois jours. La règle : **toute modification de guide doit toucher `public/`**, FR et EN, sinon elle n'existe pas pour l'utilisateur.

---

## Deux pièges techniques consignés

**PL/pgSQL et `RETURNS TABLE`.** Les noms déclarés y deviennent des variables résolues avant les colonnes. Une CTE portant le même nom déclenche une ambiguïté qui ne se manifeste **qu'au premier appel**, jamais à la création — la fonction se crée sans broncher et casse à l'exécution.

**Le CLI Obsidian n'est pas un outil tiers.** Cherché en vain pendant des semaines : il est livré avec Obsidian depuis la version 1.12.7. Installé sur le MacBook et le Mac mini, ce qui débloque les opérations de fichiers du vault en autonomie.

---

## État des données

**La base ne contient que des données de test** — arbitrage de Christian ce jour. Rien à nettoyer :

- Le plafond **10 cours / 7 jours** reste actif sur « abonnement mini » et « Pack illimité ».
- Les **quatre clients de test** (Thomas Dupont, Simona Costamagna, Anselme Meunier, joan rodon) restent en place avec leurs abonnements fictifs `sub_demo_cas1` à `4`.
- 67 avis de démonstration, 9 créneaux Personal Training.

---

## Prochaine action

**Faire valider par les coachs** le document [[2026-08-08-reservations-regles-et-cas-de-test]] — règles de réservation et quatre cas concrets, vérifiables dans l'application avec noms, dates et montants exacts. Ajuster les valeurs du plafond selon leur retour.

---

## Chantiers ouverts

**Parrainage & bons d'achat** : livrés, toujours pas testés de bout en bout.

**Phase 13 (RGPD)** : non entamée. Les deux prérequis App Store sont levés depuis le 7 août.

**Commercialisation multi-studio** : question posée le 8 août, écartée. Trois pistes d'architecture (base par studio, base partagée avec `studio_id` + RLS, schéma par studio) ; le vrai obstacle sera probablement **Stripe Connect** — chaque studio devant encaisser chez lui — plus que la base elle-même.

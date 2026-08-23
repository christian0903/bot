---
type: handoff
agent: cowork
session-machine: mac-mini
session-date: 2026-08-06
domaine: "[[_developpement]]"
auteur: "[[@Christian Vanhenten]]"
statut: actif
created: 2026-08-06
tags:
  - claude/handoff
  - handoff
  - bot
  - stripe
  - parrainage
---

# Handoff — App Bot : espace coach autonome, statuts de cours, parrainage

> Session du 2026-08-06, **33 commits poussés**. Journée d'usage réel : Christian teste, signale, on corrige. Le parrainage reste **non testé de bout en bout** — c'est le premier travail de la prochaine session.

---

## Reprendre

```bash
cd ~/bot && claude
```

Puis : « on reprend le handoff bot ». Le projet est sur `/Users/christian/bot`, `main` aligné sur `origin/main`.

**Point de reprise : tester le parrainage** (scénario complet plus bas).

---

## À vérifier en premier — les migrations

Huit migrations ont été écrites le 6 août. Christian en a appliqué plusieurs au fil de l'eau, mais **il faut confirmer qu'elles y sont toutes** :

```sql
SELECT routine_name FROM information_schema.routines
WHERE routine_schema = 'public' AND routine_name IN (
  'book_member_by_staff', 'decline_modified_booking', 'grant_user_role',
  'revoke_user_role', 'credit_note_applicable', 'get_usable_credit_notes',
  'cancel_booking_by_studio', 'check_referral_qualification')
ORDER BY routine_name;
```

Huit lignes attendues. Puis **l'audit des policies**, qui est l'outil clé de cette session :

```sql
-- contenu de supabase/check-policies.sql
```

Aucune ligne renvoyée = base conforme. Toute ligne est un bug en attente.

---

## Le fil rouge de la journée

**Trois écrans cassés, une seule cause** : une policy décrite dans `install.sql` mais **jamais appliquée à la base**.

| Symptôme | Policy manquante |
|---|---|
| « Aucun membre avec des crédits » | `Purchases: coach read all` |
| Le coach annule, rien ne se passe | `Classes: coach update own` |
| — | `Subscriptions: coach read` |

Le mécanisme est identique à chaque fois : requête refusée, **code qui n'écoute pas l'erreur**, écran qui conclut « aucun résultat ». Pour l'annulation c'était pire : le journal s'écrivait et les crédits partaient pendant que le cours restait planifié.

> **Deux réflexes à garder** : toujours tester `error` après une écriture Supabase, et lancer `check-policies.sql` dès qu'un écran affiche une liste vide sans raison.

---

## Ce qui a été livré

### Gestion des rôles

Impossible jusqu'ici de désigner un coach depuis l'application. Un admin désigne les coachs, seul un super admin promeut un admin. Hiérarchie appliquée **côté base** — les anciennes policies laissaient tout admin se créer un pair. On ne retire pas ses propres droits, et le dernier super admin est intouchable.

### Espace coach autonome

- **Inscrire un membre** dans ses cours (`book_member_by_staff`) — **ignore le délai de fermeture** : quelqu'un se présente, il reste de la place, le coach décide. Inscription possible même après le cours, pour régulariser.
- **Annuler un de ses cours**, avec confirmation qui nomme les inscrits
- **Périodes calendaires** : cette semaine (du lundi), ce mois-ci, avec flèches
- Chiffres `présents/inscrits/capacité` et filtres par statut

### Sept statuts de cours

> planifié · effectif à surveiller · **exécuté** · présences à valider · **décision attendue** · sans inscrit · annulé

Recalculés à chaque affichage, jamais stockés.

**« Exécuté » exige le pointage** (décision de Christian) : sans présence pointée, personne ne sait si le cours a eu lieu. L'absence de confirmation devient l'information utile.

**« Décision attendue »** — seul badge rouge. Un cours passé avec des inscrits sous le seuil, sans pointage ni annulation : des gens ont consommé un crédit sans qu'on sache s'ils ont eu leur cours. Un bandeau dans le planning force le choix.

### Les places payées comptent

Question de Christian : *« une personne désinscrite trop tard mais pas venue, on la compte où ? »* Elle disparaissait de tous les comptages.

Règle retenue : **une place occupée et payée compte comme inscrite, seule la présence réelle compte comme venue**. `cancel_booking_v2` marque désormais `is_no_show` quand le crédit n'est pas restitué.

> Les annulations tardives **déjà passées** ne sont pas rattrapées : elles n'ont pas gardé la trace.

### Modification d'un cours

L'e-mail nomme ce qui change (coach, salle, horaire, durée). Pour un changement **d'horaire ou de type**, l'admin est averti avant de sauver, et le membre reçoit une proposition de renoncer **avec restitution quel que soit le délai** (`decline_modified_booking`).

### Performance

Le planning admin chargeait **tous les cours de la base** avant de filtrer côté navigateur. Il ne charge plus que la période affichée, avec un mois de marge.

---

## Le premier travail : tester le parrainage

Écrit et déployé, **jamais éprouvé**.

1. Récupérer un code : `SELECT display_name, referral_code FROM profiles LIMIT 5;`
2. Inscrire un compte **avec ce code**, payer les frais (carte `4242 4242 4242 4242`)
3. Vérifier la qualification :

```sql
SELECT status, qualified_at FROM referrals ORDER BY created_at DESC LIMIT 1;
SELECT code, amount_cents, origin, is_used FROM referral_rewards ORDER BY created_at DESC LIMIT 2;
```

Attendu : statut `qualified`, **deux bons de 3000 centimes** — `parrainage` pour le parrain, `parrainage_filleul` pour le filleul.

4. **Cas nominal** : bon de 30 € sur frais d'inscription à 30 € → rien à payer, aucun passage par Stripe
5. **Seuil minimum** : le bon du filleul ne s'applique qu'à partir de 30 € d'achat (réglable 30–100 € dans les Réglages). Celui du parrain n'a pas de seuil — il est déjà client.
6. **Perte assumée** : bon de 30 € sur la carte à 25 € → l'avertissement doit annoncer les 5 € perdus
7. **CRITIQUE — bon sur abonnement** : première échéance réduite, **les suivantes au tarif plein**
8. Saisie du code au paiement par un membre sans parrain
9. Outils admin : rattacher un parrain, accorder un bon

---

## Restent aussi à tester

- **Renouvellement automatique** d'abonnement via *test clock* Stripe — jamais éprouvé
- **Suspension / reprise** d'abonnement
- **Bouton de remise à zéro** — vérifier que `reset_member_purchases` existe en base

---

## Reporté : rémunération des coachs

Module à part, sans urgence — **la gestion se fait hors application** (décision du 6 août).

Le besoin : un prix par cours donné, distinct selon le type de crédit (personal training / semi-privé), avec historique pour produire un rapport de facturation par période.

**Recommandation retenue : figer le montant sur chaque cours** plutôt que gérer une table de périodes tarifaires. Trois raisons : le rapport devient une simple somme, l'historique ne bouge plus rétroactivement, et un cas particulier se corrige sur le cours concerné. Le prix par défaut vivrait dans les Réglages, par type de crédit.

**Deux questions ouvertes** : le tarif varie-t-il d'un coach à l'autre ? Le montant se fige-t-il à la création du cours ou au moment où il est donné ?

---

## Non fait, à décider

- **Coupons collectifs inutilisables** : l'admin peut en créer, le serveur sait les traiter, mais **aucun écran ne permet d'en saisir un**. Les garder ou les retirer ?
- **Affichage des bons sur la page Parrainage client** — l'écran ignore les nouveaux champs
- **`regles-coupons-parrainage.md`** décrit encore l'ancienne règle
- **Configuration Stripe pour super admin** (état de la connexion, bascule test/live)
- **Deux réglages sans effet** : annulation personal training et no-show automatique. Signalés dans l'écran, à implémenter ou retirer.

---

## Demandes des coachs — encore en attente

Analysées le 5 août, non traitées :

| Demande | État |
|---|---|
| Bloquer la consultation du passé (clients) | À faire — le staff garde l'historique |
| Crédits restants dans le planning | À faire |
| Message après inscription | Réel manque : on retombe sur la connexion sans rien dire |
| Demande de facture reformulée | **À cadrer** — c'est un second circuit de vente |
| Page d'accueil éditable | **À cadrer** — le plus gros morceau |

Bloqué en attente de matière : descriptions des cours, documents CGV.

---

## Vigilance

- **Faire tourner les clés de `bot2`** : `sk_test_` et `whsec_` ont transité en clair le 5 août. Sans danger (bac à sable), à renouveler avant la production.
- **Le webhook est le seul endroit qui crédite** — et le seul qui consomme un bon.
- **Un Price Stripe est immuable** : le modifier casse les abonnements existants.
- **La même règle métier est parfois réécrite à plusieurs endroits** : corriger la fonction SQL centrale ne suffit pas toujours. À consolider.

---

## Décisions bloquantes avant production

1. **Grille tarifaire** — rien ne peut être mis en vente sans
2. **Migration des clients actuels** — sort des crédits en cours
3. **Bancontact en récurrent** — non vérifié chez Stripe
4. **13 prélèvements par an** sur un cycle de 4 semaines — à chiffrer sur la marge

---

## Documents de référence

- `docs/journal-projet.md` — état des lieux complet, à jour
- `docs/documentation-technique.md` — architecture, Stripe, diagnostic, pièges
- `public/guide-admin.md` et `public/guide-utilisateur.md` — servis dans l'application, éditables directement
- `docs/cadrage-bons-achat.md` — le modèle des bons
- `supabase/check-policies.sql` — **l'outil clé** : compare les policies attendues au réel

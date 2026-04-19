# Back On Track — Guide Administrateur & Super Admin

## Rôles

| Rôle | Qui | Accès |
|------|-----|-------|
| **Super Admin** | Christian | Tout ce que fait l'admin + mode paiement (test/live), ID technique des cours |
| **Admin** | Les 3 associés | Gestion membres, planning, finances, paramètres, parrainages, factures |

---

## 1. Tableau de bord (`/admin/dashboard`)

- Ventes de packs par période (semaine, mois, trimestre, année)
- Recettes totales
- Cours par coach (nombre de cours, réservations)
- Filtres par période personnalisée

## 2. Gestion des utilisateurs (`/admin/users`)

### Liste des membres
- Recherche par nom, prénom, email
- Filtres par rôle : Client, Coach, Admin (inclut Super Admin)
- Colonnes : nom, rôle, crédits restants, dernière connexion, actions
- Export CSV

### Créer un utilisateur
- Bouton "Créer un utilisateur"
- Champs : email, mot de passe, nom d'affichage, prénom, nom, téléphone, rôle
- Le compte est actif immédiatement (pas de confirmation email)

### Fiche membre détaillée (`/admin/users/:id`)
- Informations personnelles, photo, statut membre
- **Onglet Packs** : liste des packs achetés avec barre de progression des crédits. Cliquer sur un pack affiche :
  - Crédits restants (modifiable)
  - Date d'expiration (modifiable)
  - Liste des réservations faites avec ce pack
- **Onglet Réservations** : à venir et passées, avec bouton "Inscrire à un cours"
- **Attribuer un pack** : sélection du type de pack, prix modifiable (cadeau possible à 0€)

## 3. Gestion du planning (`/admin/schedule`)

### Vue tableau
- Colonnes : date, heure, salle (slug `bas`/`haut`), type de cours, coach, places max, actions
- Filtres : période (du/au), coach, type de cours
- Tri par date

### Ajouter un cours
- Type de cours, coach, salle (`bas` ou `haut`), date (défaut: aujourd'hui), heure (défaut: 10h00)
- Places max, durée en minutes
- **Répéter pour X semaines** (0 à 10) : crée automatiquement le même cours chaque semaine
- Contrôle de doublon : si un cours existe déjà au même créneau + même salle, il est ignoré avec avertissement

### Modifier un cours
- Mêmes champs que la création
- Le champ "Répéter" n'apparaît pas en mode édition

### Supprimer un cours
- Confirmation avec nom du cours, date/heure et salle

### Actions en masse (cocher plusieurs cours)
- **Assigner coach** : change le coach pour tous les cours sélectionnés
- **Max participants** : change le nombre de places
- **Dupliquer semaine suivante** : copie les cours sélectionnés à J+7, mêmes conditions. Contrôle de doublon automatique (même créneau + même salle = ignoré)

### Détail d'un cours (icône œil)
- Ouvre la page `/coach/class/:id` avec :
  - Liste des inscrits (nom, téléphone/email)
  - Check-in : cases à cocher + scanner QR
  - Ajouter un membre : dropdown des membres ayant des crédits du bon type
  - Retirer un membre : annule la réservation, restitue le crédit, notifie le membre
  - Marquer absent (no-show)
  - Annuler le cours entier : annule toutes les réservations, restitue tous les crédits, notifie tous les membres

## 4. Types de cours (`/admin/class-types`)

- Créer, modifier, désactiver des types de cours
- Chaque type est lié à un type de crédit (semi-privé ou PT)
- Nombre max de participants par défaut
- Couleur du cours (affichée dans le planning)

## 5. Types de packs (`/admin/pack-types`)

- Créer, modifier, activer/désactiver des packs
- Nom, description, type de crédit, nombre de crédits, prix, validité en jours
- Catégories éligibles (quels membres peuvent acheter)
- Modifier un pack n'affecte pas les achats existants

## 6. Types de crédits (`/admin/credit-types`)

- Semi-privé et Personal Training par défaut
- Ajouter de nouveaux types si besoin
- Labels FR et EN

## 7. Catégories de membres (`/admin/categories`)

- Créer des catégories pour segmenter les membres
- Utilisé pour restreindre l'accès à certains packs

## 8. Coupons (`/admin/coupons`)

- Créer des codes promo : code, réduction (% ou montant fixe), dates de validité, max utilisations
- Activer/désactiver

## 9. Annonces (`/admin/announcements`)

- Publier des annonces en markdown
- Affichées sur la page d'accueil publique

## 10. Journal d'activité (`/admin/activity-log`)

- Toutes les actions enregistrées :
  - Nouveau membre, connexion, séance d'essai
  - Achat de pack, attribution manuelle, modification
  - Réservation, annulation (avec info crédit restitué ou non)
  - Check-in, no-show
  - Changement de rôle
  - Liste d'attente (inscription, promotion)
- Filtres par type d'action et période

## 11. Demandes de factures (`/admin/invoice-requests`)

- Liste des demandes avec filtres (en attente / traitées / toutes)
- Détail : nom/raison sociale, adresse, n° entreprise, paiement concerné, membre
- Bouton "Marquer comme traitée" (la facture est créée dans Odoo)

## 12. Parrainages (`/admin/referrals`)

- Vue de tous les parrainages : parrain → filleul, code utilisé, date, statut
- Stats : total, en attente, qualifiés, montant des récompenses
- Le parrainage est qualifié automatiquement quand le filleul paie les frais d'inscription ET achète un pack de 10+ séances
- Les récompenses (30€ chacun) sont créées automatiquement et valables 180 jours

### Paramètres de parrainage (dans `/admin/settings` via `referral_rules`)
- Montant récompense parrain (défaut 30€)
- Montant récompense filleul (défaut 30€)
- Minimum séances dans le pack du filleul (défaut 10)
- Plafond de parrainages par membre (défaut illimité)
- Durée de validité des récompenses (défaut 180 jours)

## 13. Paramètres (`/admin/settings`)

### Informations du studio
- Nom, adresse, téléphone, email, n° TVA

### Noms des salles
- `bas` → nom complet (ex: "Back On Track Studio")
- `haut` → nom complet (ex: "Back On Track Upstairs")
- Les clients voient le nom complet, l'admin voit le slug

### Règles de réservation
- **Cours du matin** : heure seuil (défaut 12h), fermeture la veille à (défaut 20h)
- **Cours après-midi** : fermeture si 0 inscrit (défaut 3h avant), fermeture si inscrits (défaut 30 min avant)
- **Annulation** : gratuite si > X heures (défaut 12h), PT séparément (défaut 24h)
- **No-show auto** : minutes après début du cours (défaut 15 min)

### Frais d'inscription
- Activer/désactiver
- Montant (défaut 30€)

### Mode paiement (Super Admin uniquement)
- Toggle test/production (Stripe)

## 14. Stats des membres

Les membres ont accès à leur page `/stats` avec :
- Compteurs : séances total, ce mois, cette semaine, streak
- Objectif hebdomadaire personnalisable (1-7 séances)
- Graphiques : répartition par type de cours, évolution mensuelle
- Calendrier d'entraînement (3 mois)
- 7 badges automatiques (10/25/50/100 séances, 4/8/12 semaines streak)

Les admins peuvent voir les stats d'un membre via sa fiche utilisateur (historique réservations, packs, no-shows).

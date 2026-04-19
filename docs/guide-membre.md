# Back On Track — Guide Membre (Client)

## 1. Inscription (`/auth`)

### Étape 1 — Informations personnelles
- Prénom, nom (obligatoire)
- Téléphone (obligatoire)
- Date de naissance (obligatoire)
- Adresse (obligatoire)
- Code de parrainage (optionnel) — si un ami vous a donné un code, entrez-le ici

### Étape 2 — Compte et mentions légales
- Email et mot de passe (minimum 12 caractères)
- Question de vérification anti-spam
- Acceptation CGV (obligatoire)
- Acceptation politique RGPD (obligatoire, case séparée)

Un email de confirmation est envoyé. Cliquez sur le lien pour activer votre compte.

### Lien de parrainage
Si vous arrivez via un lien de parrainage (`/auth?ref=CODE`), le code est automatiquement pré-rempli.

## 2. Connexion (`/auth`)

- Email + mot de passe
- Mot de passe oublié : un lien de réinitialisation est envoyé par email

## 3. Page d'accueil (`/dashboard`)

Après connexion, vous voyez :
- **Mes prochains cours** : liste compacte de vos réservations à venir avec labels intelligents :
  - "Dans 45min" (si le cours est imminent, surligné)
  - "Aujourd'hui" (bloc date coloré)
  - "Demain"
  - Date (jours suivants)
- **Actions rapides** : boutons "Voir le planning" et "Acheter un pack"
- **Mes crédits** : barre de progression pour chaque pack actif, crédits restants, jours avant expiration

## 4. Frais d'inscription

Avant de pouvoir acheter un pack de cours, vous devez payer les **frais d'inscription** (30€, configurable). Un bandeau jaune s'affiche sur la page des packs si les frais ne sont pas encore payés.

La **séance d'essai gratuite** est accessible sans payer les frais — un bouton vert "Essai gratuit" apparaît sur le planning si vous n'avez pas encore utilisé votre essai.

## 5. Acheter un pack (`/packs`)

- Liste des packs disponibles avec prix, crédits, validité
- Prix par crédit affiché
- Pack "Populaire" mis en avant
- Paiement sécurisé via Stripe (Bancontact, carte, Apple Pay, Google Pay)
- Les crédits sont activés immédiatement après le paiement

### Types de crédits
- **Semi-privé** : pour les cours collectifs (CrossTraining, Boxing, Posture, etc.)
- **Personal Training** : pour les séances individuelles
- Les crédits d'un type ne peuvent pas être utilisés pour l'autre

## 6. Planning des cours (`/schedule`)

### 3 vues
- **Jour** (par défaut) : onglets par jour de la semaine avec compteur de cours
- **Semaine** : grille compacte 7 colonnes, clic pour aller au jour
- **Liste** : liste chronologique avec en-tête par jour

### Filtres
- Par type de cours (avec pastille couleur)
- Par coach

### Chaque cours affiche
- Nom du cours, coach, salle (nom complet), heure, durée
- Barre de progression des places (x/max)
- Bordure colorée selon le type de cours

### Réserver
- Cliquer sur "Réserver" consomme 1 crédit du bon type
- Si pas de crédits : message d'erreur
- Si cours complet : bouton "Liste d'attente"
- Si réservations fermées : cadenas "Fermé"

### Règles de fermeture
- **Cours du matin** (avant 12h) : réservation fermée la veille à 20h
- **Cours après-midi/soir** : fermé 3h avant s'il n'y a aucun inscrit, ou 30 min avant s'il y a déjà des inscrits

### Séance d'essai
Si vous n'avez pas encore de pack et n'avez jamais fait d'essai, un bouton vert **"Essai gratuit"** apparaît. Une seule séance d'essai par personne, sans consommer de crédit.

## 7. Liste d'attente

- Si un cours est complet, cliquez sur "Liste d'attente" pour vous inscrire
- Vous voyez votre position (ex: "En attente (2)")
- Si une place se libère, vous recevez une notification
- Vous avez 2 heures pour confirmer (bouton orange "Confirmer ma place")
- Vous pouvez quitter la liste d'attente à tout moment

## 8. Mes réservations (`/my-bookings`)

### À venir
- Liste des cours réservés avec date, heure, coach
- Bouton "Annuler" sur chaque réservation :
  - **Plus de 12h avant** : annulation gratuite, crédit restitué
  - **Moins de 12h avant** : avertissement orange "Crédit non restitué", l'annulation est quand même possible mais le crédit est perdu

### Passées
- Historique de toutes les réservations (confirmées et annulées)

## 9. Mes packs (`/my-packs`)

- Liste des packs actifs avec barre de progression
- Crédits restants / total
- Date d'expiration (rouge si < 14 jours)

## 10. Profil (`/profile`)

### Informations affichées
- Photo, nom, badge de statut (Visiteur, Membre potentiel, Actif, Inactif, Ancien)

### QR code check-in
- QR code unique affiché dans le profil
- Le coach le scanne avec son téléphone pour pointer votre présence

### Code de parrainage
- Code unique auto-généré (ex: INGRID4827)
- Boutons copier et partager (via WhatsApp, SMS, email ou lien)

### Demander une facture
- Bouton "Demander une facture" → formulaire avec nom/raison sociale, adresse, n° entreprise
- Sélection du paiement concerné
- Historique des demandes avec statut (en attente / traitée)

### Informations modifiables
- Nom d'affichage, prénom, nom
- Téléphone, date de naissance, adresse
- Contact d'urgence (nom + téléphone)
- Objectifs, niveau (débutant/intermédiaire/avancé), conditions médicales
- Bio
- Catégorie de membre

## 11. Parrainage (`/referral`)

### Mon code
- Code unique affiché en grand, avec boutons copier et partager
- Lien de parrainage : `backontrack.../auth?ref=MONCODE`

### Comment ça marche
1. Partagez votre code à un ami
2. Il s'inscrit avec votre code
3. Il paie ses frais d'inscription + achète un pack de 10 séances minimum
4. Vous recevez chacun 30€ de réduction sur votre prochain achat

### Suivi
- Nombre de filleuls, qualifiés, montant gagné
- Liste des filleuls avec statut (en attente / qualifié / récompensé)
- Récompenses actives avec date d'expiration

## 12. Notifications (`/notifications`)

- Liste de toutes les notifications reçues
- Types : confirmation réservation, annulation, place disponible (liste d'attente), parrainage, messages de l'équipe
- Bouton "Tout marquer comme lu"
- Cloche avec compteur dans le header

## 13. Statuts membre

Votre statut évolue automatiquement :

| Statut | Signification |
|--------|---------------|
| **Visiteur** | Pas encore inscrit |
| **Membre potentiel** | Inscrit, frais non payés |
| **Membre actif** | A un pack ou abonnement en cours |
| **Membre inactif** | Pack expiré depuis moins de 3 mois |
| **Ancien membre** | Inactif depuis plus de 3 mois — doit repayer les frais d'inscription |

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
- **Email** (avec confirmation, voir ci-dessous)
- Téléphone, date de naissance, adresse
- Contact d'urgence (nom + téléphone)
- Objectifs, niveau (débutant/intermédiaire/avancé), conditions médicales
- Bio
- Catégorie de membre

### Changer l'adresse email
1. Modifier le champ "Email" dans le profil et cliquer "Enregistrer"
2. Un email avec un lien de confirmation est envoyé à la **nouvelle** adresse
3. Un avertissement (sans lien d'action) est envoyé à l'**ancienne** adresse pour information / sécurité
4. Cliquer sur le lien dans la nouvelle adresse → page "Adresse email mise à jour"
5. Tant que le clic n'est pas fait, un bandeau jaune "Changement d'email en attente" reste visible sur le profil

Le nouvel email devient l'identifiant de connexion immédiatement après la confirmation.

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

## 12. Mes statistiques (`/stats`)

### Compteurs
- **Séances total** : nombre de séances depuis le début
- **Ce mois** : nombre de séances ce mois-ci
- **Cette semaine** : nombre de séances cette semaine
- **Streak** : nombre de semaines consécutives avec au moins 1 séance (icône flamme si >= 4 semaines)

### Objectif hebdomadaire
- Objectif modifiable de 1 à 7 séances par semaine (défaut : 3)
- Barre de progression : ex. 2/3 = 66%
- "Objectif atteint !" s'affiche en vert quand l'objectif est complété

### Graphiques
- **Répartition par type de cours** : graphique camembert avec les couleurs de chaque type
- **Évolution mensuelle** : graphique barres sur les 12 derniers mois

### Calendrier d'entraînement
- Vue des 3 derniers mois
- Les jours où vous avez eu un cours sont colorés
- Aujourd'hui est bordé

### Badges
Badges automatiquement débloqués quand vous atteignez un palier :

| Badge | Condition |
|-------|-----------|
| 🥉 10 séances | 10 séances effectuées |
| 🥈 25 séances | 25 séances effectuées |
| 🥇 50 séances | 50 séances effectuées |
| 💎 100 séances | 100 séances effectuées |
| 🔥 4 semaines | 4 semaines consécutives |
| ⚡ 8 semaines | 8 semaines consécutives |
| 🌟 12 semaines | 12 semaines consécutives |

Les badges non encore débloqués apparaissent en grisé.

## 13. Notifications (`/notifications`)

- Liste de toutes les notifications reçues
- Types : confirmation réservation, annulation, place disponible (liste d'attente), parrainage, messages de l'équipe
- Bouton "Tout marquer comme lu"
- Cloche avec compteur dans le header

## 14. Performances (`/performances`)

Encodez et suivez vos performances (rameur, ski erg, soulevés de terre, etc.).

### Encoder une performance
- Bouton "Nouvelle performance" (ou icône `+` sur mobile)
- **Type** : choisir parmi le catalogue défini par les coaches (Rameur 500m, Squat, etc.)
- **Date** : par défaut aujourd'hui
- **Valeur** : texte libre — ex. `13 kg`, `250 kg`, `1:47`, `1500m`. Le format reste libre, vous écrivez ce qui a du sens pour vous
- **Notes** (optionnel) : commentaire libre (ex. "5x5 facile", "PR ! ")

### Voir mes performances
- Liste chronologique (plus récent en haut)
- **Filtres par type** : boutons colorés en haut de la page, "Tous" pour ne pas filtrer
- Bouton crayon : éditer une perf existante
- Bouton corbeille : supprimer une perf (sans limite de temps)

### Graphique de progression
Quand un **type est sélectionné** dans le filtre, une carte chart apparaît :
- **3 vues** : Jour / Semaine / Mois
- **Navigation** : flèches `<` `>` pour se déplacer dans le temps
- **Barres** : valeur numérique extraite (ex. `13 kg` → 13). Les valeurs non numériques sont affichées dans la liste mais pas dans le chart
- **Durées** : `1:47` est interprété comme 1.7 minute pour le chart
- **Résumé** : nombre d'entrées + meilleur score sur la période

### Limites actuelles
- Pas encore de comparaison multi-types sur un même graphe
- Pas de marquage automatique des records personnels (PR)
- La vue "Mois" affiche jusqu'à 31 barres, c'est dense sur petit écran

## 15. Statuts membre

Votre statut évolue automatiquement :

| Statut | Signification |
|--------|---------------|
| **Visiteur** | Pas encore inscrit |
| **Membre potentiel** | Inscrit, frais non payés |
| **Membre actif** | A un pack ou abonnement en cours |
| **Membre inactif** | Pack expiré depuis moins de 3 mois |
| **Ancien membre** | Inactif depuis plus de 3 mois — doit repayer les frais d'inscription |

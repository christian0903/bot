# Back On Track — Guide Coach

## Accès

Le coach accède à ses fonctionnalités via le menu "Espace coach" dans la navigation.

---

## 1. Planning des cours (`/schedule`)

### Vue du planning
- 3 vues : Jour (défaut), Semaine (grille compacte), Liste
- Filtres par type de cours et par coach
- Chaque cours affiche : nom, coach, salle, heure, durée, places (x/max)
- Code couleur par type de cours (bordure gauche colorée)
- Cadenas "Fermé" quand les réservations sont fermées

### Détail d'un cours (bouton "Détail")
Le coach voit un bouton **"Détail"** à la place du bouton "Réserver" sur chaque carte de cours. Un clic ouvre un dialog avec :

- **Infos du cours** : nom, date/heure, coach, salle, durée
- **Liste des inscrits** : nom, téléphone ou email
- **Ajouter un membre** : dropdown des membres qui ont des crédits du bon type, les membres déjà inscrits sont exclus
- **Retirer un membre** : annule la réservation, restitue le crédit, envoie une notification au membre
- **Annuler le cours** : annule toutes les réservations, restitue les crédits, notifie tous les inscrits

## 2. Mes cours (`/coach/my-classes`)

- Liste des cours assignés au coach
- Pour chaque cours : type, date/heure, nombre d'inscrits / places max

## 3. Détail d'un cours (`/coach/class/:id`)

### Check-in / Présences
- **Cases à cocher** : cocher chaque participant à son arrivée. La case devient verte avec l'heure de check-in.
- **Scanner QR** : ouvrir la caméra et scanner le QR code du membre (affiché dans son profil). Check-in automatique.
- **Annuler un check-in** : recliquer sur la case verte pour annuler

### Gestion des absences
- **Marquer absent** : bouton "Absent" sur chaque inscrit non pointé (après le début du cours)
- **Marquer absents restants** : bouton en haut pour marquer tous les non-pointés comme absents en une fois
- Le no-show est enregistré dans le journal d'activité

### Ajouter un membre
- Bouton "Ajouter un membre" : même fonctionnement que dans le dialog du planning
- Dropdown large (min 350px) avec nom + nombre de crédits restants
- L'inscription consomme 1 crédit et envoie une notification au membre

### Retirer un membre
- Icône de suppression sur chaque inscrit (cours futurs uniquement)
- Annule la réservation via `cancel_booking_v2` : crédit restitué si > 12h avant, perdu sinon
- Le membre reçoit une notification

### Modifier les places
- Bouton "Places" : modifier le nombre max de participants pour ce cours

### Informations affichées
- Compteur inscrits / places max
- Badges : nombre de présents (vert), nombre d'absents (rouge)
- Salle (slug)
- Coach
- ID du cours (visible uniquement pour le Super Admin)

## 4. Types de performances (`/performance-types`)

Page partagée avec les admins, accessible via le bouton "Gérer les types" depuis `/performances`.

### Définir le catalogue
- Créer les types que vos membres pourront encoder (ex. `Rameur 500m`, `Bike Erg 1km`, `Squat`, `Développé couché`)
- Pour chaque type : nom, unité indicative (`kg`, `min`, etc.), couleur, ordre, archivé
- Les types sont visibles par tous les membres dès leur création

### Encoder pour un membre
Vous pouvez encoder une performance pour un membre (RLS coach + admin). L'UI dédiée dans la fiche membre admin n'est pas encore en place — passer par la page `/performances` connecté comme le membre, ou via l'API.

### Corriger une perf
Depuis v2.7.0, le coach peut éditer ou supprimer **n'importe quelle** performance (alignement RLS avec l'INSERT). Utile pour corriger une faute de frappe.

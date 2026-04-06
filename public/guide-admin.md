# Guide Coach & Administrateur — Back on Track

Ce guide couvre les fonctionnalités réservées aux coachs et administrateurs.

---

## Rôles et permissions

| Fonction | Client | Coach | Admin |
|---|:---:|:---:|:---:|
| Voir le planning et réserver | ✅ | ✅ | ✅ |
| Acheter un pack | ✅ | ✅ | ✅ |
| Voir ses propres cours (coach) | — | ✅ | ✅ |
| Modifier le nombre de places de ses cours | — | ✅ | ✅ |
| Voir la liste des participants de ses cours | — | ✅ | ✅ |
| Accéder à l'administration | — | — | ✅ |
| Gérer les utilisateurs | — | — | ✅ |
| Configurer packs, cours, planning | — | — | ✅ |
| Attribuer des packs | — | — | ✅ |
| Modifier les packs des clients | — | — | ✅ |
| Inscrire un client à un cours | — | — | ✅ |
| Voir le tableau de bord financier | — | — | ✅ |
| Consulter le journal d'activité | — | ✅ | ✅ |
| Gérer les annonces | — | — | ✅ |

---

## Espace Coach

### Mes cours
**Menu : Espace coach**

Liste de tous vos cours à venir avec :
- Nom du cours et date/heure
- Nombre de places

Cliquez sur un cours pour voir le détail.

### Détail d'un cours
- **Liste des participants** numérotée avec nom, email et téléphone
- **Badge de statut** pour chaque inscription (Confirmée / Annulée)
- **Nombre de places** : affiché avec un indicateur visuel
  - Badge "X place(s) restante(s)" quand presque complet
  - Badge rouge "Complet" quand plein

### Modifier le nombre de places
1. Sur la page de détail d'un cours, cliquez sur **Modifier places**
2. Un champ de saisie apparaît avec le nombre actuel
3. Modifiez le nombre (ne peut pas être inférieur au nombre de participants déjà inscrits)
4. Validez avec ✓ ou annulez avec ✕

> Cas d'usage : réduire les places un jour où la salle est plus petite, ou augmenter pour une séance spéciale.

---

## Administration

L'administration est accessible via le menu **Administration** dans le header (ou l'icône bouclier dans le menu utilisateur). Une **sidebar de navigation** à gauche donne accès à toutes les sections.

---

### Gestion des utilisateurs

**Admin → Utilisateurs**

#### Liste des utilisateurs
- **Filtres par rôle** : boutons Client / Coach / Admin / Tout (Client par défaut), chacun avec un compteur
- Colonnes : Nom (cliquable), Crédits restants, Dernière connexion, Actions
- **Icône cadeau** 🎁 : attribuer un pack
- **Icône corbeille** 🗑️ : supprimer l'utilisateur

#### Page détail d'un utilisateur
Cliquez sur le nom d'un utilisateur pour voir sa fiche complète :

**En-tête** : avatar, nom, email (lien mailto:), téléphone (lien tel:)

**3 cartes statistiques** :
- Crédits restants
- Packs actifs
- Réservations à venir

**Onglet Packs** :
- Historique complet de tous les packs (actifs et expirés)
- Barre de progression pour chaque pack
- Badge "Offert" pour les packs gratuits, "Expiré" ou "Épuisé" le cas échéant
- **Cliquez sur un pack** pour le modifier :
  - Changer le nombre de **crédits restants** (ex : rajouter des crédits en compensation)
  - Changer la **date de fin de validité** (ex : prolonger pour un client fidèle)
  - Les modifications sont enregistrées dans le journal d'activité

**Onglet Réservations** :
- Réservations à venir et passées
- Bouton **Inscrire à un cours** :
  1. Choisissez un cours futur dans la liste
  2. Choisissez le pack à débiter (filtré par type de crédit compatible)
  3. Confirmez — le crédit est consommé automatiquement

#### Attribuer un pack
1. Dans la liste des utilisateurs, cliquez sur l'icône **🎁** du client
2. Sélectionnez le type de pack
3. Les détails s'affichent : type de crédit, nombre de crédits, durée de validité
4. Choisissez le prix :
   - **Cadeau / offert** : 0€ (pack gratuit)
   - **Paiement manuel** : prix normal (le client a payé en espèces ou virement)
   - Ou saisissez un montant personnalisé
5. Confirmez — le client reçoit une notification automatique

#### Exporter la liste des utilisateurs
Bouton **Exporter CSV** en haut à droite. Le fichier contient : nom, email, rôle, crédits, date d'inscription.

---

### Configuration métier

#### Catégories de membres
**Admin → Catégories**

Les catégories permettent de segmenter les membres (ex : Adulte, Étudiant, Senior) et de restreindre l'accès à certains packs.
- Ajouter, modifier ou supprimer des catégories
- Chaque catégorie a un nom et une description optionnelle

#### Types de crédits
**Admin → Types de crédits**

Les types de crédits définissent les différentes "monnaies" du studio.
- **Identifiant** : nom technique unique (ex : `semi_prive`)
- **Libellé FR** : nom affiché en français (ex : "Semi-privé")
- **Libellé EN** : nom affiché en anglais (ex : "Semi-private")

> Exemples : Semi-privé, Personal Training. Vous pouvez en créer d'autres selon vos besoins.

#### Types de packs
**Admin → Types de packs**

Configurez les offres de packs vendus aux membres :
- **Nom** : nom commercial (ex : "Pack 10 séances Semi-privé")
- **Type de crédit** : quel crédit est fourni
- **Nombre de crédits** : combien de séances le pack offre
- **Prix** : en euros (saisissez 250 pour 250€, la conversion en centimes est automatique)
- **Validité** : durée en jours après l'achat
- **Catégories éligibles** : cliquez sur les badges des catégories pour les activer/désactiver
- **Actif** : désactiver un pack le retire du catalogue sans le supprimer

#### Types de cours
**Admin → Types de cours**

Définissez les types de cours proposés :
- **Nom** : nom du cours (ex : Posture, Ladies, Cross Training)
- **Description** : description détaillée
- **Type de crédit** : quel crédit est consommé pour réserver
- **Participants max par défaut** : nombre de places pré-rempli lors de la création d'un cours au planning
- **Actif** : désactiver un type de cours

---

### Gestion du planning

**Admin → Gestion du planning**

#### Filtres
Barre de filtres en haut :
- **Date du / au** : filtrer par plage de dates
- **Coach** : filtrer par coach
- **Type de cours** : filtrer par type
- Bouton **Réinitialiser**
- Compteur en bas : nombre de cours affichés / total

#### Ajouter un cours
1. Cliquez sur **Ajouter un cours**
2. Remplissez le formulaire :
   - **Type de cours** : sélectionnez dans la liste (le nombre max de participants est pré-rempli)
   - **Titre** (optionnel) : pour les événements spéciaux (conférences, ateliers). Si rempli, le champ description apparaît
   - **Description** (optionnel) : détails de l'événement
   - **Coach** (optionnel) : sélectionnez un coach ou "Aucun coach" pour les événements
   - **Date et heure**
   - **Places max** et **Durée**
3. Enregistrez

#### Actions en lot (bulk)
1. **Cochez** les cours souhaités (checkbox sur chaque ligne, ou "tout sélectionner" dans l'en-tête)
2. Une barre d'actions apparaît avec le nombre de cours sélectionnés
3. Deux actions disponibles :
   - **Assigner coach** : choisissez un coach dans le menu déroulant → **Assigner**
   - **Changer max participants** : saisissez le nombre → **Appliquer**

> Toutes les actions en lot sont enregistrées dans le journal d'activité avec le détail des cours concernés.

#### Modifier / Supprimer un cours
- Icône ✏️ pour modifier
- Icône 🗑️ pour supprimer (confirmation demandée)

---

### Réservations

**Admin → Réservations**

Vue en lecture seule de toutes les réservations :
- Nom du cours et date
- Client
- Pack utilisé
- Statut (Confirmée / Annulée)
- Revenu calculé (prix du pack ÷ nombre de crédits)

---

### Coupons de réduction

**Admin → Coupons**

Gérez les codes de réduction pour les achats de packs :
- **Code** : code unique (automatiquement en majuscules)
- **Type de réduction** : pourcentage OU montant fixe en euros (l'un ou l'autre)
- **Utilisations max** : limite d'utilisation (optionnel)
- **Validité** : dates de début et fin
- **Actif** : activer/désactiver

---

### Annonces

**Admin → Annonces**

Publiez une annonce visible sur la page d'accueil pour tous les visiteurs :
1. Rédigez le contenu en **Markdown** (titres, listes, gras, liens supportés)
2. Utilisez l'onglet **Aperçu** pour visualiser le rendu
3. Activez le toggle **Publier** pour rendre l'annonce visible
4. Désactivez pour la masquer

---

### Journal d'activité

**Admin → Journal d'activité**

Historique chronologique de toutes les opérations importantes :

| Type | Icône | Description |
|---|---|---|
| Achat pack | 🛍️ | Achat d'un pack via Stripe |
| Pack attribué | 🎁 | Attribution manuelle par admin |
| Pack modifié | ✏️ | Modification des crédits ou de la date d'expiration |
| Réservation | 📅 | Réservation d'un cours par un client |
| Annulation | ❌ | Annulation d'une réservation |
| Inscription admin | 👤 | Inscription d'un client par l'admin |
| Coach assigné | 🔄 | Changement de coach sur un ou plusieurs cours |
| Liste d'attente | ⏳ | Inscription en liste d'attente |
| Promu (attente) | ✅ | Promotion depuis la liste d'attente |

Chaque entrée affiche :
- Le type d'opération (badge coloré)
- La date et l'heure
- La description détaillée (ex : cours concernés avec type, jour et heure)
- **Qui** a fait l'action → **pour qui**

**Filtres** : par type d'opération et par plage de dates.

---

### Tableau de bord

**Admin → Tableau de bord**

#### Sélection de la période
5 options : **Cette semaine** | **Ce mois** | **Ce trimestre** | **Cette année** | **Personnalisé** (dates libres)

#### Indicateurs clés (KPI)

3 cartes cliquables :

| KPI | Détail au clic |
|---|---|
| **Recettes encaissées** (€) : total des ventes de packs + nombre de packs vendus | Tableau : date, client, pack, crédits, montant (packs offerts = badge "Offert") avec ligne de total |
| **Crédits consommés** : nombre de réservations + valeur en € | Tableau : date, cours, client, pack utilisé, valeur du crédit avec ligne de total |
| **Cours donnés** : nombre total + nombre de coachs | — |

#### Cours par coach
Tableau récapitulatif par coach :
- Nombre de cours
- Nombre de réservations
- Valeur totale des crédits consommés

Cliquez sur un coach pour voir le **détail de chaque cours** : date, type, nombre de réservations et valeur.

#### Exports CSV
Deux boutons d'export sous le sélecteur de période :
- **Export ventes packs** : date, client, pack, crédits, montant
- **Export cours-réservations** : date, heure, type de cours, titre événement, coach, client, pack utilisé, valeur crédit

Les fichiers sont au format CSV avec séparateur `;` et encodage UTF-8 (compatible Excel). Le nom du fichier inclut la période sélectionnée.

> Les données exportées permettent de créer des tableaux croisés dynamiques dans Excel pour des analyses personnalisées.

---

### Paramètres

**Admin → Paramètres**

- **Mode Stripe** : basculer entre mode test et mode production
  - Mode test : utilise les clés Stripe de test (pas de vrai paiement)
  - Mode production : utilise les clés Stripe live (vrais paiements)

---

## Sécurité

### Clés et secrets
- Les clés Stripe sont stockées dans les **Supabase Secrets**, jamais dans le code client
- Le fichier `.env` ne contient que l'URL Supabase et la clé anon (publique par design)
- Les Edge Functions utilisent la clé `SUPABASE_SERVICE_ROLE_KEY` côté serveur uniquement

### Row Level Security (RLS)
- Toutes les tables ont RLS activé
- Les policies utilisent `has_role(auth.uid(), 'admin')` pour les opérations admin
- Aucune table n'est accessible sans policy
- La vue `coach_profiles` contourne la dépendance circulaire RLS pour l'affichage des coachs

### Protection anti-bot à l'inscription
- Champ honeypot invisible (détecte les bots)
- Question de vérification mathématique
- Validation du nom d'affichage (pas de chiffres seuls, URLs, caractères spéciaux)
- Confirmation email obligatoire

---

## Edge Functions Supabase

Trois fonctions serveur :

| Fonction | Rôle |
|---|---|
| `create-checkout-session` | Crée une session Stripe Checkout pour l'achat d'un pack |
| `stripe-webhook` | Reçoit les événements Stripe et crée le pack_purchase après paiement |
| `send-notification` | Envoie des notifications in-app |

### Configuration des secrets Supabase
```bash
supabase secrets set STRIPE_SECRET_KEY_TEST=sk_test_...
supabase secrets set STRIPE_SECRET_KEY_LIVE=sk_live_...
supabase secrets set STRIPE_WEBHOOK_SECRET_TEST=whsec_...
supabase secrets set STRIPE_WEBHOOK_SECRET_LIVE=whsec_...
```

---

## Installation à blanc

Pour installer l'application sur un nouveau projet Supabase :

1. Créer un projet Supabase
2. Exécuter **`supabase/install.sql`** dans le SQL Editor (fichier unique, 581 lignes)
3. Configurer le `.env` avec l'URL et la clé anon
4. Créer un compte via l'application
5. Promouvoir en admin :
```sql
UPDATE user_roles SET role = 'admin'
WHERE user_id = (SELECT id FROM auth.users WHERE email = 'votre@email.com');
```
6. Configurer les types de crédits, packs et cours via l'interface admin

---

## PWA

L'application est installable en tant que Progressive Web App :
- `manifest.json` configure le nom, l'icône et les couleurs
- `sw.js` utilise une stratégie network-first avec cache fallback
- Les requêtes vers Supabase ne sont pas interceptées par le service worker

---

## Analytics (Umami)

Analytics open source, sans cookies, conforme RGPD :
- Aucun bandeau de consentement nécessaire
- Pour activer : décommenter la ligne dans `index.html` et remplacer l'URL et l'ID du site

---

## Déploiement

Le projet est déployé sur un VPS OVH avec Nginx :
```bash
git pull && npm install && npm run build
```
Nginx sert les fichiers statiques du dossier `dist/` avec `try_files $uri $uri/ /index.html` pour le routing SPA. HTTPS via Let's Encrypt / Certbot.

# Guide Administrateur - Back on Track

## Accès administration

L'accès aux pages admin est réservé aux utilisateurs ayant le rôle **admin**. Le menu **Administration** apparaît dans la navigation et dans le menu utilisateur.

## Gestion des utilisateurs

**Page : Admin → Utilisateurs**

- Voir la liste de tous les utilisateurs avec nom, email, rôle, date d'inscription et dernière connexion
- **Changer le rôle** : Sélectionnez un nouveau rôle (admin, coach, client) dans le menu déroulant
- **Supprimer** : Supprime l'utilisateur (confirmation requise)
- **Exporter CSV** : Télécharge la liste complète des utilisateurs au format CSV (encodage UTF-8 avec BOM pour Excel)

## Catégories de membres

**Page : Admin → Catégories**

Les catégories permettent de segmenter les membres (ex : Étudiant, Adulte, Senior) et de restreindre l'accès à certains packs.

- Ajouter, modifier ou supprimer des catégories
- Chaque catégorie a un nom et une description optionnelle

## Types de crédits

**Page : Admin → Types de crédits**

Les types de crédits définissent les différentes "monnaies" du studio (ex : Semi-privé, Personal Training).

- **Identifiant** : Nom technique unique (ex : `semi_prive`)
- **Libellé FR/EN** : Nom affiché dans l'interface selon la langue

## Types de packs

**Page : Admin → Types de packs**

Configurez les offres de packs vendus aux membres.

- **Nom** : Nom commercial du pack
- **Type de crédit** : Le type de crédit fourni par ce pack
- **Nombre de crédits** : Combien de sessions le pack offre
- **Prix** : En euros (stocké en centimes pour précision)
- **Validité** : Durée en jours après l'achat
- **Catégories éligibles** : Quelles catégories de membres peuvent acheter ce pack
- **Actif** : Désactiver un pack le retire du catalogue sans le supprimer

## Types de cours

**Page : Admin → Types de cours**

Définissez les types de cours proposés par le studio.

- **Nom** : Nom du cours (ex : Posture, HIIT, Pilates)
- **Description** : Description détaillée
- **Type de crédit** : Quel type de crédit est consommé pour réserver ce cours
- **Actif** : Désactiver un type de cours

## Gestion du planning

**Page : Admin → Planning**

Programmez les cours avec date, heure, coach et nombre de places.

- **Type de cours** : Sélectionnez le type de cours
- **Coach** : Sélectionnez parmi les utilisateurs ayant le rôle coach
- **Date et heure** : Programmation du cours
- **Places max** : Nombre maximum de participants
- **Durée** : En minutes (défaut : 60)

## Réservations

**Page : Admin → Réservations**

Vue en lecture seule de toutes les réservations avec :

- Nom du cours et date
- Client
- Pack utilisé
- Statut (confirmé/annulé)
- **Revenu** : Calculé automatiquement (prix du pack / nombre de crédits)

## Coupons

**Page : Admin → Coupons**

Gérez les codes de réduction pour les achats de packs.

- **Code** : Code unique (automatiquement en majuscules)
- **Réduction** : Soit un pourcentage, soit un montant fixe en euros
- **Utilisations max** : Limite d'utilisation (optionnel)
- **Validité** : Dates de début et fin
- **Actif** : Activer/désactiver le coupon

## Annonces

**Page : Admin → Annonces**

Publiez une annonce visible sur la page d'accueil.

- Éditeur Markdown avec aperçu en temps réel
- Toggle publier/dépublier
- Support du Markdown enrichi (titres, listes, liens, gras, italique)

## Paramètres

**Page : Admin → Paramètres**

- **Mode Stripe** : Basculer entre mode test et mode production
  - En mode test : utilise les clés Stripe de test
  - En mode production : utilise les clés Stripe live

## Sécurité

### Clés et secrets

- Les clés Stripe sont stockées dans les **Supabase Secrets**, jamais dans le code client
- Le fichier `.env` ne contient que `VITE_SUPABASE_URL` et `VITE_SUPABASE_PUBLISHABLE_KEY` (clé anon publique)
- Les Edge Functions utilisent `SUPABASE_SERVICE_ROLE_KEY` côté serveur

### RLS (Row Level Security)

- Toutes les tables ont RLS activé
- Les policies utilisent `has_role(auth.uid(), 'admin')` pour les opérations admin
- Aucune table n'est accessible sans policy

### Protection anti-bot

- Champ honeypot invisible à l'inscription
- Question de vérification mathématique
- Validation du nom d'affichage (pas de chiffres seuls, URLs, caractères spéciaux)
- Confirmation email obligatoire

## Edge Functions Supabase

Les fonctions s'exécutent côté serveur :

- **create-checkout-session** : Crée une session Stripe Checkout
- **stripe-webhook** : Reçoit les événements Stripe et crée les achats de packs
- **send-notification** : Envoie des notifications in-app

### Configuration des secrets Supabase

```bash
supabase secrets set STRIPE_SECRET_KEY_TEST=sk_test_...
supabase secrets set STRIPE_SECRET_KEY_LIVE=sk_live_...
supabase secrets set STRIPE_WEBHOOK_SECRET_TEST=whsec_...
supabase secrets set STRIPE_WEBHOOK_SECRET_LIVE=whsec_...
```

## PWA

L'application est installable en tant que PWA :
- `manifest.json` configure le nom, l'icône et les couleurs
- `sw.js` utilise une stratégie network-first avec cache fallback
- Les requêtes vers Supabase ne sont pas interceptées par le service worker

## Analytics (Umami)

- Analytics open source, sans cookies, conforme RGPD
- Aucun bandeau de consentement nécessaire
- Décommenter la ligne dans `index.html` et remplacer l'URL et l'ID du site

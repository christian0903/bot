# Back On Track — Guide d'installation et import des données

## 1. Installation fraîche (nouvelle base Supabase)

### Prérequis
- Un projet Supabase (gratuit)
- Node.js 18+
- Le code source cloné depuis GitHub

### Étapes

#### 1.1 Base de données

Exécuter dans le **SQL Editor** de Supabase, en 2 temps :

1. **Section A** de `supabase/install.sql` (les 2 lignes `CREATE TYPE`)
2. **Section B** de `supabase/install.sql` (tout le reste)

PostgreSQL exige que les valeurs d'enum soient committées avant utilisation.

#### 1.2 Storage

Dans le **Supabase Dashboard** :
1. Aller dans **Storage → New bucket**
2. Nom : `avatars`
3. Public : oui
4. Taille max : 5 MB

Les policies de storage sont créées par le `install.sql`.

#### 1.3 Authentication

Dans **Supabase Dashboard → Authentication** :
- **Settings → Password Requirements** : minimum 12 caractères
- **Email Templates** : personnaliser en français (voir `docs/guide-admin.md`)

#### 1.4 Premier compte super_admin

1. S'inscrire via l'application
2. Confirmer l'email
3. Exécuter dans le SQL Editor :
```sql
INSERT INTO user_roles (user_id, role)
SELECT id, 'super_admin' FROM auth.users WHERE email = 'votre@email.com';
```

#### 1.5 Variables d'environnement

Créer `.env` à la racine :
```
VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbG...
```

#### 1.6 Lancer l'application

```bash
npm install
npm run dev
```

---

## 2. Import de données (migration ou données demo)

### 2.1 Principe

Le script `scripts/import-demo.ts` crée les utilisateurs via l'**API Admin Supabase** (`supabase.auth.admin.createUser`), ce qui garantit des comptes fonctionnels (contrairement au INSERT direct dans `auth.users` qui ne crée pas les identités auth).

### 2.2 Prérequis

- La **service_role key** de Supabase (Dashboard → Settings → API)
- Les types de cours, crédits et packs déjà créés en base (via l'interface admin ou SQL)
- `tsx` installé : `npm install tsx`

### 2.3 Lancer l'import demo

```bash
npx tsx scripts/import-demo.ts
```

Ce script crée :
- 4 coaches (3 admin+coach, 1 coach seul)
- 7 clients avec packs, frais d'inscription, séance d'essai
- 2 parrainages

Mot de passe de tous les comptes : `Demo12345678!`

### 2.4 Créer les cours

Après l'import des utilisateurs, exécuter `supabase/seed-demo-part2.sql` dans le SQL Editor (cours + réservations).

### 2.5 Reset complet

Pour repartir de zéro (garde le super_admin et la config) :

```bash
# 1. Exécuter dans le SQL Editor :
supabase/reset-test-data.sql

# 2. Relancer l'import :
npx tsx scripts/import-demo.ts
```

---

## 3. Migration depuis une application existante (Technogym, Notion, etc.)

### 3.1 Préparer le fichier de données

Exporter les données au format CSV avec les colonnes :
- `email` (obligatoire)
- `first_name`, `last_name`
- `phone`
- `date_of_birth` (format YYYY-MM-DD)
- `address`
- `pack_name` (nom du pack acheté)
- `credits_remaining` (crédits restants)
- `pack_purchased_at` (date d'achat)
- `pack_expires_at` (date d'expiration)
- `registration_fee_paid` (oui/non)

### 3.2 Adapter le script

Dupliquer `scripts/import-demo.ts` en `scripts/import-migration.ts` et :

1. Remplacer le tableau `USERS` par la lecture du CSV :
```typescript
import { readFileSync } from 'fs'
import { parse } from 'csv-parse/sync'

const csv = readFileSync('data/members.csv', 'utf-8')
const rows = parse(csv, { columns: true })

const USERS = rows.map(row => ({
  email: row.email,
  first_name: row.first_name,
  last_name: row.last_name,
  phone: row.phone,
  // ... mapper les colonnes
}))
```

2. Mapper les noms de packs vers les `pack_type_id` de la base

3. Générer un mot de passe aléatoire ou utiliser un mot de passe par défaut que le membre changera à la première connexion

### 3.3 Points d'attention

- **Emails** : vérifier qu'il n'y a pas de doublons
- **Packs expirés** : les importer quand même (avec `credits_remaining = 0`) pour garder l'historique
- **Crédits** : vérifier la cohérence entre crédits restants et historique de réservations
- **Période de transition** : faire tourner les 2 systèmes en parallèle 2-4 semaines
- **Communication** : prévenir les membres par email avec un guide + leur nouveau mot de passe

### 3.4 Après la migration

1. Vérifier les données dans l'interface admin
2. Demander aux membres de changer leur mot de passe
3. Configurer les paramètres (règles de réservation, noms des salles, etc.)
4. Créer le planning des cours pour les semaines à venir

---

## 4. Fichiers SQL de référence

| Fichier | Usage |
|---------|-------|
| `supabase/install.sql` | Installation complète (tables, fonctions, RLS, settings) |
| `supabase/check-schema.sql` | Vérification de la structure de la base |
| `supabase/reset-test-data.sql` | Efface toutes les données sauf admin et config |
| `supabase/seed-demo-part1.sql` | Types de crédits, cours et packs |
| `scripts/import-demo.ts` | Import users via API Admin (coaches + clients + packs) |
| `supabase/seed-demo-part2.sql` | Cours planifiés + réservations passées/futures |

---

## 5. Déploiement

### 5.1 Build

```bash
npm run build
```

Le dossier `dist/` contient l'application prête à déployer.

### 5.2 Hébergement

Uploader le contenu de `dist/` vers le serveur web (o2switch, OVH, etc.) via FTP/SFTP (Transmit, FileZilla).

S'assurer que le `.htaccess` est uploadé pour le routing SPA :
```apache
RewriteEngine On
RewriteBase /
RewriteRule ^index\.html$ - [L]
RewriteCond %{REQUEST_FILENAME} !-f
RewriteCond %{REQUEST_FILENAME} !-d
RewriteRule . /index.html [L]
```

### 5.3 Mobile (Capacitor)

L'application charge l'URL de production (`desk.backontrackstudio.be`) via Capacitor. Les mises à jour web sont automatiques sans passer par les stores.

```bash
npm run cap:sync
npm run cap:ios    # ouvre Xcode
npm run cap:android # ouvre Android Studio
```

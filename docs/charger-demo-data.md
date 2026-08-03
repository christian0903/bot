# Charger les données de démonstration

## Prérequis

- Accès au SQL Editor de Supabase
- Terminal ouvert dans le dossier `/Users/christian/bot`

---

## Procédure (4 étapes)

### Étape 1 : Reset complet

SQL Editor → copier-coller le contenu de :
```
supabase/reset-test-data.sql
```

### Étape 2 : Créer les types (crédits, cours, packs)

SQL Editor → copier-coller le contenu de :
```
supabase/seed-demo-part1.sql
```

### Étape 3 : Créer les utilisateurs (coaches + clients + packs + parrainages)

Terminal :
```bash
cd /Users/christian/bot
npx tsx scripts/import-demo.ts
```

### Étape 4 : Créer les cours + réservations

SQL Editor → copier-coller le contenu de :
```
supabase/seed-demo-part2.sql
```

### Étape 5 (optionnelle) : Performances de démo

Une cinquantaine d'entrées sur 6 semaines pour Ingrid, Thomas et Marie, avec 5 types (Rameur, Ski Erg, Bike Erg, Squat, Développé) et 3 profils de progression distincts. Idempotent.

SQL Editor → copier-coller le contenu de :
```
supabase/seed-demo-performances.sql
```

À la fin, un SELECT affiche un récap par user × type.

---

## Vérification

1. **Login** : `ingrid@demo.bot` / `Demo12345678!` → dashboard avec cours à venir
2. **Planning** : cours visibles du 13 avril au 13 mai
3. **Admin → Membres** : 7 clients
4. **Admin → Coaches** : 4 coaches
5. **Admin → Parrainages** : 2 (Ingrid→Sophie qualifié, Anouck→Lucas en attente)
6. **Admin → Réservations** : réservations passées et futures visibles
7. (Étape 5) **Perfs** : `/performances` connecté en ingrid → 18 entrées, chart visible sur le type "Rameur 500m"

---

## Données créées

| Membre | Email | Frais | Pack | Crédits | Résa passées | Résa futures |
|--------|-------|:-----:|------|:-------:|:------------:|:------------:|
| Ingrid | ingrid@demo.bot | OK | 10 semi | 5 | 3 | 2 |
| Sophie | sophie@demo.bot | OK | 20 semi | 13 | 5 | 2 |
| Lucas | lucas@demo.bot | OK | 10 semi | 1 | 0 | 1 |
| Anouck | anouck@demo.bot | OK | 20 semi + 10 PT | 11 + 8 | 2 | 2 |
| Thomas | thomas@demo.bot | Non | Aucun | 0 | 0 | 0 |
| Simona | simona@demo.bot | OK | 10 PT | 10 | 0 | 0 |
| Marie | marie@demo.bot | OK | 3 séances | **0** | 3 | 0 |

| Coach | Email | Rôles |
|-------|-------|-------|
| Gauthier | gauthier@backontrackstudio.be | coach + admin |
| Anselme | anselme@backontrackstudio.be | coach + admin |
| Joan | joan@backontrackstudio.be | coach + admin |
| Jonasz | jonasz@backontrackstudio.be | coach seul |

**Mot de passe de tous : `Demo12345678!`**

Thomas a fait sa séance d'essai. Marie a épuisé son pack de 3 séances.

---

## Pour refaire un reset

Reprendre à l'étape 1.

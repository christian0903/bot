# Charger les données de démonstration

## Prérequis

- Accès au SQL Editor de Supabase
- Terminal ouvert dans le dossier `/Users/christian/bot`
- `tsx` installé (`npm install tsx`)

---

## Étape 1 : Reset complet

Exécuter dans le **SQL Editor** de Supabase :

→ Copier-coller le contenu de `supabase/reset-test-data.sql`

Cela efface toutes les données (utilisateurs, packs, cours, réservations, parrainages) sauf les comptes admin/super_admin et les app_settings.

---

## Étape 2 : Créer les types (crédits, cours, packs)

Exécuter dans le **SQL Editor** les sections 1, 2 et 3 de `supabase/seed-all.sql` :

```sql
-- Copier-coller depuis seed-all.sql :
-- Section 1 : TYPES DE CRÉDITS
-- Section 2 : TYPES DE COURS
-- Section 3 : TYPES DE PACKS
```

Cela crée :
- 2 types de crédits (semi-privé, personal training)
- 5 types de cours (CrossTraining, BackOnTrack, Posture, Ladies, Événement spécial)
- 8 types de packs (4 semi-privé + 4 PT)

---

## Étape 3 : Créer les utilisateurs (coaches + clients)

Dans le **terminal** :

```bash
cd /Users/christian/bot
npx tsx scripts/import-demo.ts
```

Le script crée via l'API Admin Supabase :
- 4 coaches : Gauthier (admin), Anselme (admin), Joan (admin), Jonasz (coach seul)
- 7 clients : Ingrid, Sophie, Lucas, Anouck, Thomas, Simona, Marie

Avec pour chacun : profil, rôles, frais d'inscription, packs, parrainages.

**Mot de passe de tous les comptes : `Demo12345678!`**

---

## Étape 4 : Créer les cours (13 avril → 13 mai)

Exécuter dans le **SQL Editor** :

```sql
DO $$
DECLARE
  v_coaches UUID[];
  v_class_ids UUID[] := ARRAY[
    'f5b1718d-174e-4557-82ae-a6cc9a115ba1',
    '89788ddb-90a4-46f7-b468-566f5d13cc04',
    '391581f1-3df4-4546-8e2f-c4fd5c8fede0',
    '89a34a9b-c98f-46ca-ad5f-e7f7869ca218'
  ];
  v_date DATE := '2026-04-13';
  v_end DATE := '2026-05-13';
  v_dow INTEGER;
  v_counter INTEGER := 0;
  v_floor TEXT;
BEGIN
  SELECT ARRAY_AGG(user_id) INTO v_coaches FROM user_roles WHERE role = 'coach';
  WHILE v_date <= v_end LOOP
    v_dow := EXTRACT(DOW FROM v_date)::INTEGER;
    IF v_dow != 0 THEN
      v_counter := v_counter + 1;
      INSERT INTO scheduled_classes (class_type_id, coach_id, starts_at, duration_minutes, max_participants, floor)
      VALUES (v_class_ids[1 + (v_counter % 4)], v_coaches[1 + (v_counter % array_length(v_coaches, 1))], v_date + TIME '08:30', 50, 4, 'bas');
      IF v_dow BETWEEN 1 AND 5 THEN
        v_floor := CASE WHEN v_counter % 2 = 0 THEN 'bas' ELSE 'haut' END;
        INSERT INTO scheduled_classes (class_type_id, coach_id, starts_at, duration_minutes, max_participants, floor)
        VALUES (v_class_ids[1 + ((v_counter+1) % 4)], v_coaches[1 + ((v_counter+1) % array_length(v_coaches, 1))], v_date + TIME '12:00', 50, 4, v_floor);
        INSERT INTO scheduled_classes (class_type_id, coach_id, starts_at, duration_minutes, max_participants, floor)
        VALUES (v_class_ids[1 + ((v_counter+2) % 4)], v_coaches[1 + ((v_counter+2) % array_length(v_coaches, 1))], v_date + TIME '17:30', 50, 4, 'bas');
      END IF;
      IF v_dow IN (1, 3, 5) THEN
        INSERT INTO scheduled_classes (class_type_id, coach_id, starts_at, duration_minutes, max_participants, floor)
        VALUES (v_class_ids[1 + ((v_counter+3) % 4)], v_coaches[1 + (v_counter % array_length(v_coaches, 1))], v_date + TIME '18:30', 50, 4, 'haut');
      END IF;
      IF v_dow = 6 THEN
        INSERT INTO scheduled_classes (class_type_id, coach_id, starts_at, duration_minutes, max_participants, floor)
        VALUES (v_class_ids[1 + ((v_counter+1) % 4)], v_coaches[1 + ((v_counter+2) % array_length(v_coaches, 1))], v_date + TIME '10:00', 50, 4, 'bas');
      END IF;
    END IF;
    v_date := v_date + 1;
  END LOOP;
END;
$$;
```

Cela crée ~120 cours :
- Lun-ven : 8h30 + 12h + 17h30
- Lun/mer/ven : + 18h30 (salle haut)
- Samedi : 8h30 + 10h
- Dimanche : pas de cours
- Les 4 coaches tournent sur tous les créneaux

---

## Vérification

Après les 4 étapes, vérifier dans l'application :

1. **Se connecter** avec `ingrid@demo.bot` / `Demo12345678!` → doit voir le dashboard
2. **Planning** → cours visibles du 13 avril au 13 mai
3. **Admin → Membres** → 7 clients listés
4. **Admin → Coaches & Admins** → 4 coaches listés
5. **Admin → Parrainages** → 2 parrainages (Ingrid→Sophie qualifié, Anouck→Lucas en attente)

---

## Données créées

| Membre | Email | Frais | Pack | Crédits | Spécial |
|--------|-------|:-----:|------|:-------:|---------|
| Ingrid | ingrid@demo.bot | OK | 10 semi-privé | 5 | Parraine Sophie |
| Sophie | sophie@demo.bot | OK | 20 semi-privé | 13 | Filleule d'Ingrid |
| Lucas | lucas@demo.bot | OK | 10 semi-privé | 1 | Expire 1er mai |
| Anouck | anouck@demo.bot | OK | 20 semi + 10 PT | 11 + 8 | Parraine Lucas |
| Thomas | thomas@demo.bot | Non | Aucun | 0 | Séance d'essai faite |
| Simona | simona@demo.bot | OK | 10 PT | 10 | — |
| Marie | marie@demo.bot | OK | 3 séances | **0** | Pack épuisé |

| Coach | Email | Rôles |
|-------|-------|-------|
| Gauthier | gauthier@backontrackstudio.be | coach + admin |
| Anselme | anselme@backontrackstudio.be | coach + admin |
| Joan | joan@backontrackstudio.be | coach + admin |
| Jonasz | jonasz@backontrackstudio.be | coach seul |

---

## Pour refaire un reset complet

Reprendre à l'étape 1. Le script `import-demo.ts` détecte les users existants et les skip (message "existe déjà"). Pour forcer la recréation, supprimer d'abord les users via le reset SQL.

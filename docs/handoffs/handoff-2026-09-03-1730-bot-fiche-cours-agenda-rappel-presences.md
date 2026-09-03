---
type: handoff
projet:
domaine:
session-machine: mac-mini
session-date: 2026-09-03
session-heure: "17:30"
auteur: "[[@Christian Vanhenten]]"
statut: actif
created: 2026-09-03
tags:
  - claude/handoff
  - bot
  - app-store
  - ios
  - presences
  - agenda
---

# Handoff — Fiche de cours, agenda, rappel des présences

> **v3.135.0**, arbre propre, build vert.
> Lint à **799** — voir la note plus bas, ce n'est pas une régression.
> `.env` pointe sur **jag** (dernier déploiement).

---

## Où on en est

| Domaine | Sert | Version |
|---|---|---|
| `app.` | production (bot-ops) | **3.130.0** |
| `jag.` | test (bot3) | **3.135.0** |
| App iOS | en vérification chez Apple | 3.123.0 (build 7) |

**Cinq versions séparent `jag.` de `app.`** — c'est voulu, voir la décision
ci-dessous.

---

## Ce qui est en production

Migration `20260903_participants_par_cours.sql` appliquée sur bot-ops, contrôles
au vert (`anon` fermé, empreinte identique à bot3), plus les descriptions des
types de cours.

- La **fiche d'un cours** au planning, avec la liste des inscrits (prénom et
  photo).
- Le **retrait de cette liste** depuis le profil, section « Visibilité ».
- **« Ajouter à mon agenda »** — un .ics à trois endroits.
- Les **descriptions des cours**, reprises du WordPress du studio.
- Les **deux guides** à jour, recopiés dans `public/`.

---

## Ce qui attend, et pourquoi

### Le rappel des présences — v3.135.0, sur jag seulement

Éprouvé sur `jag.` et validé par Christian. **Non déployé en production, sur sa
décision** : les coachs ont été priés de rattraper leur pointage d'abord.

Sans ce rattrapage, la mise en service enverrait d'un coup **un rappel par cours
non pointé des sept derniers jours, multiplié par le nombre d'administrateurs**.
Une volée d'e-mails pour un retard qu'on peut solder avant.

**Reprise** — quand les coachs auront pointé :

1. Vérifier qu'il ne reste presque rien à rappeler :
   ```sql
   SELECT COUNT(DISTINCT sc.id)
     FROM scheduled_classes sc
     JOIN bookings b ON b.scheduled_class_id = sc.id AND b.status='confirmed'
    WHERE sc.is_cancelled = false
      AND sc.starts_at > now() - interval '7 days'
      AND sc.starts_at < now() - interval '4 hours'
      AND b.checked_in_at IS NULL AND b.is_no_show = false;
   ```
2. Appliquer `supabase/migrations/20260903_rappel_presences.sql` sur **bot-ops**,
   par l'éditeur SQL (règle 5).
3. `supabase functions deploy send-email --project-ref xgwrxbkrfypklrnqbftv`
   — le gabarit `attendance_reminder` y est **déjà déployé**, mais le redéployer
   ne coûte rien si le fichier a bougé.
4. `./deploiement.sh ops`, confirmer par `OUI`.

> **Le CLI Supabase est lié à bot-ops.** Un `supabase functions deploy` sans
> `--project-ref` vise donc la **production**. Constaté aujourd'hui : le gabarit
> est parti sur bot-ops avant bot3. Sans conséquence — aucune fonction de
> production ne l'appelait — mais toujours passer `--project-ref` pour bot3.

### L'app iOS — en vérification

Resoumise aujourd'hui, état **En attente de vérification**.

Le piège, s'il se reproduit : une version **refusée sort de la file**, et
répondre dans le fil ne l'y remet pas. Le bouton « Soumettre à nouveau » de la
page *Soumission* reste **grisé** ; celui qui marche est **« Mettre à jour la
vérification »**, en haut de la page de la **version**
(`/distribution/ios/version/inflight`), qu'on atteint par « Modifier » sur la
ligne refusée.

Avant toute resoumission : vérifier que le compte de démo répond et que le
planning a des places libres — sans quoi « App Completeness » retombe.

---

## Ouvert, non traité

| Sujet | Détail |
|---|---|
| **78 fonctions `SECURITY DEFINER`** | Exécutables par `anon` sur bot3 — dont `book_class`, `delete_own_account`, `grant_user_role`. Défaut Supabase pour tout le schéma `public` ; la plupart se protègent par `auth.uid()`, mais aucune **par ses droits**. Audit à mener. |
| **`no_show_auto_minutes`** | Réglage présent dans l'écran et en base, **aucun code ne s'en sert**. Donne l'illusion d'un automatisme. À implémenter ou à retirer. |
| **Personal Training** | Sans description longue — aucune page du site ne le décrit. À écrire par les coachs. |
| **Cours « Adolescent »** | Décrit sur le site (12-17 ans), absent des deux bases. |
| **Lint à 799** | `CLAUDE.md` en annonce 37. Vérifié identique avant et après les changements du jour : chiffre du CLAUDE.md périmé, pas une régression. |
| **Message aux membres** | Ils apparaissent dans la liste des inscrits **sans l'avoir demandé** (visible par défaut). Le texte aux coachs est prêt ; rien n'est parti aux membres. |
| **Homonymes** | 16 prénoms partagés sur 97 membres. `display_name` écarté (il vaut le nom complet pour 93 d'entre eux) ; « Prénom + initiale » proposé, **non retenu**. Rouvrir si l'usage le réclame. |

---

## Deux pièges appris aujourd'hui

**`REVOKE ... FROM PUBLIC` ne ferme pas `anon`.** Supabase pose un
`ALTER DEFAULT PRIVILEGES` qui accorde `EXECUTE` à `anon` dès la création d'une
fonction ; ce droit **nominatif** survit au REVOKE sur `PUBLIC`. Toute nouvelle
fonction `SECURITY DEFINER` doit porter un `REVOKE EXECUTE ... FROM anon`
explicite.

**Changer le type de retour d'une fonction exige un `DROP`.**
`CREATE OR REPLACE` échoue avec « cannot change return type ». Rencontré en
ajoutant `coach_nom` à `cours_sans_presences`.

---

## Pour reprendre

Rien n'est en cours, l'arbre est propre et tout est poussé. Les deux fils à
suivre sont l'**app iOS** (attendre la réponse d'Apple) et le **rappel des
présences** (attendre le rattrapage des coachs, puis dérouler les quatre étapes
ci-dessus).

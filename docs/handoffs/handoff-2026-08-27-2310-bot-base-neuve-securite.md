---
type: handoff
projet:
domaine:
session-machine: mac-mini
session-date: 2026-08-27
session-heure: "23:10"
auteur: "[[@Christian Vanhenten]]"
statut: actif
created: 2026-08-27
tags:
  - claude/handoff
  - bot
  - base-de-donnees
  - securite-rls
  - install-sql
  - migration-francfort
---

# Handoff — App Bot : éprouver install.sql, fermer la faille des rôles

> Session du 2026-08-27, soirée. **v3.13.0**, un commit (`7cf0377`), build vert,
> lint stable à 37 signalements React Compiler.
> Trois fichiers modifiés non commités : `check-policies.sql`, `.gitignore`,
> et le nouveau `scripts/copier-bot-vers-bot2.sh`.
> **Échéance : demain, présenter une base vierge prête à devenir opérationnelle.**

---

## Où on en est

La session est partie d'une question simple — « comment vider la base de test
pour la recharger, et que faire des utilisateurs ? » — et a fini par découvrir
que `install.sql` réintroduisait une faille de sécurité corrigée le 6 août.

Elle a aussi produit ce qui manquait depuis le début du projet : **la preuve
que `install.sql` reconstruit vraiment une base complète**. Le fichier n'avait
jamais été exécuté de bout en bout ; il l'a été ce soir, sur une base neuve, et
il passe.

## Ce qui a été trouvé

**Une régression de sécurité dans `install.sql`.** Le fichier recréait les
trois policies d'écriture sur `user_roles` que la migration
`20260806_gestion_roles.sql` avait supprimées — la faille où tout admin pouvait
se créer un pair sans passer par `grant_user_role()` et son contrôle de
hiérarchie. La base `bot` ne les a plus ; mais toute installation faite depuis
ce fichier serait née avec. Les `REVOKE ALL ... FROM PUBLIC` sur les deux
fonctions manquaient aussi : laissées ouvertes, elles rendaient à un visiteur
non authentifié ce qu'on venait de fermer aux admins.

**Un bug réel en production, non corrigé.** La base `bot` porte encore
`Perf: own update` et `Perf: own delete`, qui **n'autorisent pas le coach**. La
migration `20260511_perf_rls_coach_update.sql` n'y a jamais été appliquée : un
coach encode une performance pour un membre, puis ne peut plus corriger sa
faute de frappe. Décidé de **ne pas l'appliquer** — `bot` va être remplacée, la
nouvelle base portera la version corrigée nativement.

**`reset-test-data.sql` laissait passer huit tables** apparues depuis le
7 août. Deux d'entre elles portent une clé étrangère en `NO ACTION` vers
`auth.users` : le script n'effaçait donc pas à moitié, il **échouait** à la
dernière instruction. En l'exécutant réellement, un neuvième oubli est apparu
qu'aucune lecture n'avait vu — les admins conservés pointent encore vers
`member_categories`, qu'on ne peut donc pas vider avant eux.

**`check-policies.sql` ne pouvait pas voir la faille qu'il était censé
détecter.** Il ne cherchait que les policies *manquantes* ; or celle du 6 août
était une policy *en trop*. Réécrit pour comparer dans les deux sens, sur les
89 policies réellement relevées en base.

**Deux trouvailles en chemin.** La clé `service_role` était en clair dans
`scripts/import-demo.ts`, fichier versionné — sortie vers `.env`, mais **elle
reste dans l'historique git et doit être régénérée**. Et ce même script
écrivait encore dans `trial_sessions`, table supprimée le 7 août : l'écriture
échouait en silence, Supabase ne levant pas d'exception sur un refus. Thomas
n'a jamais eu sa séance d'essai.

## Ce qui a été éprouvé, et comment

Rien n'a été validé par lecture seule. Chaque fichier a été exécuté :

| Fichier | Épreuve | Résultat |
|---|---|---|
| `install.sql` | rejoué d'un bloc sur `bot2` vierge, `ON_ERROR_STOP=1` | passe — 27 tables, 89 policies, 76 fonctions, 12 triggers, identiques à `bot` |
| `reset-test-data.sql` | exécuté **réellement** sur `bot2` chargée d'un jeu reproduisant les trois pièges de FK | admin conservé, réglages intacts, reste à zéro, schéma inchangé |
| `check-policies.sql` | lancé sur `bot` puis sur `bot2` | aucune anomalie sur `bot` ; six sur `bot2`, toutes attendues et documentées |

Sur `bot2`, `user_roles` n'a que deux policies de lecture et les fonctions de
rôles sont réservées à `authenticated` — **plus strict que `bot`**, où `anon`
figure encore.

## Ce qui a été décidé

**Ne pas migrer `bot` vers Francfort.** Le gain est de ~15 ms par requête,
imperceptible ; la manipulation toucherait aux comptes de connexion, aux
abonnements Stripe et aux secrets. La région se choisira **à la création** de
la nouvelle base, où c'est gratuit.

**Ne pas faire le reset de `bot`.** Puisqu'une base neuve la remplacera, vider
`bot` serait une manipulation destructive sans bénéfice. Elle sera gardée
quelques semaines comme filet, puis supprimée avec un dump local.

**Ne pas appliquer la migration `20260511` sur `bot`**, pour la même raison.

**`bot2` devient la base de développement local.** L'application locale
pointera sur elle ; la production ne sera plus jamais touchée en développement,
ce qui était le cas auparavant.

## La stratégie, en sept étapes

Écrite en détail dans **`docs/strategie-base-neuve.md`**, créé ce soir. En
résumé :

1. Copier les données de `bot` vers `bot2` (`scripts/copier-bot-vers-bot2.sh`)
2. Faire tourner l'application en local sur `bot2`, tout vérifier
3. Créer la base de production à Francfort, plan Pro
4. Y exécuter `install.sql` seul — structure, aucune donnée
5. Reconfigurer : bucket `avatars`, Edge Functions, secrets, Authentication,
   webhook Stripe avec `--no-verify-jwt`
6. Basculer l'application
7. Garder `bot` quelques semaines, puis la supprimer avec un dump

**Pour l'échéance de demain**, seules les étapes 3 et 4 sont sur le chemin
critique — plus le bucket (étape 5) pour que la base soit réellement complète.
Les étapes 1 et 2 servent au développement local et peuvent attendre.

## L'état des bases

| Base | Ref | Région | Plan | État |
|---|---|---|---|---|
| `bot` | `aojguoqxbzqcganxgqem` | Irlande | Pro | production, données de test — **intacte** |
| `bot2` | `dcfzupyzdrndqegyeafg` | Francfort | Free | schéma installé, vidé, 1 admin d'essai résiduel |

`bot2` vit dans une **organisation séparée** (`test-bot`, plan Free) : le plan
Pro ne propose pas de projet gratuit, il faut une organisation Free pour cela.

> ⚠️ **Le connecteur MCP Supabase ne voit qu'une organisation à la fois**, celle
> sélectionnée dans le dashboard. Pour que Claude accède à `bot`, il faut
> rebasculer le sélecteur sur `christian0903's Org`. À la clôture, il était
> resté sur `test-bot`.

## La prochaine action

Créer le projet de production à Francfort, dans l'organisation Pro, et y
exécuter `install.sql`. La marche à suivre complète est dans
`docs/strategie-base-neuve.md`, section « La marche à suivre ».

## Restes ouverts

- **Régénérer la clé `service_role` de `bot`** — elle est dans l'historique
  git. Dashboard → Settings → API.
- **Changer le mot de passe de `bot2`** : il est passé en clair dans le
  terminal lors du premier essai de `psql`.
- **Commiter** `check-policies.sql`, `.gitignore` et
  `scripts/copier-bot-vers-bot2.sh` — modifiés mais pas encore versionnés.
- **`scripts/copier-bot-vers-bot2.sh` n'a pas été exécuté.** Il est écrit et
  vérifié syntaxiquement, deux défauts y ont été corrigés avant livraison
  (`--disable-triggers` qui exige un superutilisateur, un chemin relatif
  fragile), mais il reste à éprouver.
- **`import-demo.ts` est inopérant** tant que `SUPABASE_SERVICE_ROLE_KEY`
  n'est pas renseignée dans `.env`. C'est voulu — plus de clé en clair dans le
  dépôt — mais l'import demo ne tournera pas d'ici là.

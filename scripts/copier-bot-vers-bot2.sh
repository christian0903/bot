#!/usr/bin/env bash
# ============================================================================
# Copie les données de bot (production) vers bot2 (développement local)
#
#   ./scripts/copier-bot-vers-bot2.sh
#
# Les deux mots de passe sont demandés à la saisie — ils ne transitent ni par
# la ligne de commande, ni par l'historique du shell, ni par un fichier.
#
# ⚠️ Ne copie QUE des données de test. Le jour où bot contiendra de vrais
# membres, ce script emporterait leurs noms, e-mails, téléphones, adresses et
# `medical_conditions` — des données de santé au sens de l'article 9 du RGPD.
# Il faudrait alors anonymiser à l'import, pas copier tel quel.
#
# Le schéma n'est PAS copié : bot2 le tient déjà de install.sql, dans sa
# version corrigée (policies user_roles fermées, performances ouvertes au
# coach). Réimporter la structure de bot y réintroduirait ses écarts.
# ============================================================================
set -euo pipefail

PG_BIN="/opt/homebrew/opt/libpq/bin"

# bot ne répond plus en connexion directe : db.<ref>.supabase.co refuse le
# port 5432 (« Connection refused », 2026-08-28) alors que le projet est
# ACTIVE_HEALTHY. Il faut passer par le pooler, ce qui change l'hôte ET
# l'utilisateur (postgres.<ref> et non postgres). bot2, créé le 27 août,
# accepte encore la connexion directe : les deux ne se traitent pas pareil.
#
# Le préfixe aws-0 / aws-1 ne se devine pas — les deux répondent au ping,
# un seul accepte le projet. Project Settings → Database → Connection string
# → onglet « Session pooler ».
SOURCE_REF="aojguoqxbzqcganxgqem"                   # bot  — production, eu-west-1
SOURCE_HOST="${POOLER:-}"                            # pooler de bot, à fournir
SOURCE_USER="postgres.$SOURCE_REF"
CIBLE_HOST="db.dcfzupyzdrndqegyeafg.supabase.co"    # bot2 — développement
CIBLE_USER="postgres"

RACINE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DUMP_DIR="$RACINE/.dumps"
DUMP="$DUMP_DIR/bot-$(date +%Y%m%d-%H%M%S).sql"

# auth.users porte les comptes de connexion, auth.identities le lien vers le
# fournisseur (email). Sans ces deux tables, les profils importés n'auraient
# plus de compte et personne ne pourrait se connecter. Le reste du schéma auth
# (sessions, jetons) ne vaut que pour l'instance d'origine : on le laisse.
#
# public s'écrit --table=public.* et NON --schema=public : dès qu'un --table
# est présent, pg_dump ignore --schema. Écrit --schema, le dump ne sortait que
# les deux tables auth, sans une ligne de public — et sans la moindre erreur.
SCHEMAS=(--table='public.*' --table=auth.users --table=auth.identities)

if [[ -z "$SOURCE_HOST" ]]; then
  echo "Hôte du pooler de bot introuvable."
  echo
  echo "Dashboard → projet bot → Project Settings → Database"
  echo "  → Connection string → onglet « Session pooler »"
  echo
  echo "  POOLER=aws-0-eu-west-1.pooler.supabase.com $0"
  echo
  exit 1
fi

mkdir -p "$DUMP_DIR"

echo "=== 1/3  Export de bot (données seules) ==="
echo "    hôte : $SOURCE_HOST  (user $SOURCE_USER)"
read -rsp "Mot de passe de bot  : " PW_SOURCE; echo
export PGPASSWORD="$PW_SOURCE"
"$PG_BIN/pg_dump" \
  -h "$SOURCE_HOST" -p 5432 -U "$SOURCE_USER" -d postgres \
  --data-only --no-owner --no-privileges \
  "${SCHEMAS[@]}" \
  -f "$DUMP"
unset PGPASSWORD PW_SOURCE
echo "    → $DUMP  ($(du -h "$DUMP" | cut -f1))"

# Sans public, le dump ne porte que les comptes : l'importer après avoir vidé
# bot2 la laisserait avec 23 comptes et aucune donnée applicative. On s'arrête
# donc AVANT l'étape destructrice.
if ! grep -q '^COPY public\.' "$DUMP"; then
  echo
  echo "⚠️  AUCUNE table public dans le dump — bot2 n'a PAS été touchée."
  exit 1
fi

echo
echo "=== 2/3  Reset de bot2 ==="
read -rsp "Mot de passe de bot2 : " PW_CIBLE; echo
export PGPASSWORD="$PW_CIBLE"

# Le reset conserve les admins ; ici on veut une table rase, les comptes de
# bot arrivant à l'étape suivante. D'où la suppression complète qui suit.
"$PG_BIN/psql" -h "$CIBLE_HOST" -p 5432 -U "$CIBLE_USER" -d postgres \
  -v ON_ERROR_STOP=1 -q -f "$RACINE/supabase/reset-test-data.sql" > /dev/null
#
# app_settings est une table de CONFIGURATION : reset-test-data.sql la
# préserve volontairement, et c'est bien ainsi pour un reset. Mais ici le dump
# apporte sa propre version complète, et `key` est unique — les lignes déjà en
# place font échouer l'import sur un doublon (vu le 2026-08-28 :
# « duplicate key ... Key (key)=(payment_provider) already exists »).
# Toute table de configuration ajoutée un jour au dump devra être vidée ici.
"$PG_BIN/psql" -h "$CIBLE_HOST" -p 5432 -U "$CIBLE_USER" -d postgres \
  -v ON_ERROR_STOP=1 -q \
  -c "DELETE FROM profiles; DELETE FROM user_roles; DELETE FROM auth.users; DELETE FROM app_settings;"
echo "    → bot2 vidée"

echo
echo "=== 3/3  Import dans bot2 ==="
# session_replication_role = 'replica' désactive les triggers le temps de
# l'import. Sans cela, on_auth_user_created recréerait un profil pour chaque
# compte importé, en conflit avec les profils que porte déjà le dump.
#
# C'est la seule voie ici : --disable-triggers de pg_restore exige d'être
# superutilisateur, ce que `postgres` n'est PAS sur Supabase.
#
# Le tout dans une seule transaction : un import à moitié fait laisserait une
# base incohérente, avec des profils sans compte ou l'inverse.
{
  echo "BEGIN;"
  echo "SET session_replication_role = 'replica';"
  cat "$DUMP"
  echo "SET session_replication_role = 'origin';"
  echo "COMMIT;"
} | "$PG_BIN/psql" -h "$CIBLE_HOST" -p 5432 -U "$CIBLE_USER" -d postgres \
      -v ON_ERROR_STOP=1 -q

echo "    → import terminé"

echo
echo "=== Contrôle ==="
"$PG_BIN/psql" -h "$CIBLE_HOST" -p 5432 -U "$CIBLE_USER" -d postgres -q -c "
SELECT 'auth.users' AS table_name, COUNT(*) FROM auth.users
UNION ALL SELECT 'profiles', COUNT(*) FROM profiles
UNION ALL SELECT 'user_roles', COUNT(*) FROM user_roles
UNION ALL SELECT 'scheduled_classes', COUNT(*) FROM scheduled_classes
UNION ALL SELECT 'bookings', COUNT(*) FROM bookings
UNION ALL SELECT 'pack_purchases', COUNT(*) FROM pack_purchases
UNION ALL SELECT 'performances', COUNT(*) FROM performances
UNION ALL SELECT 'app_settings', COUNT(*) FROM app_settings
ORDER BY 1;"
unset PGPASSWORD PW_CIBLE

echo
echo "Dump conservé : $DUMP"
echo
echo "Pour que l'application locale utilise bot2, dans .env :"
echo "  VITE_SUPABASE_URL=https://dcfzupyzdrndqegyeafg.supabase.co"
echo "  VITE_SUPABASE_PUBLISHABLE_KEY=<clé publishable de bot2>"
echo
echo "Restent à créer manuellement sur bot2 si besoin en dev :"
echo "  - le bucket Storage 'avatars' (public, 5 MB)"
echo "  - les Edge Functions et leurs secrets"

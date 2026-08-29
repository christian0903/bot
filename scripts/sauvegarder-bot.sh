#!/usr/bin/env bash
# ============================================================================
# Sauvegarde les données de bot (production) dans un fichier local.
#
#   ./scripts/sauvegarder-bot.sh
#
# Ne fait QUE lire : aucune écriture, sur aucune base. C'est la différence
# avec copier-bot-vers-bot2.sh, qui vide bot2 avant d'y importer.
#
# Passe par le POOLER et non par db.<ref>.supabase.co : la connexion directe
# de bot ne répond plus (« Connection refused » le 2026-08-28, alors que le
# projet est ACTIVE_HEALTHY et que bot2, plus récent, répond encore en
# direct). Le pooler impose deux écarts au format habituel :
#   - l'hôte porte un préfixe aws-0 / aws-1 que seul le dashboard donne ;
#     les deux répondent au ping, mais un seul accepte le projet ;
#   - l'utilisateur devient postgres.<ref> et non postgres.
# Project Settings → Database → Connection string → onglet Session pooler.
#
# ⚠️ Le fichier produit contient les données. .dumps/ est ignoré par git —
# ne pas déplacer le dump hors de ce dossier.
# ============================================================================
set -euo pipefail

PG_BIN="/opt/homebrew/opt/libpq/bin"

# `.env.migration` porte deja la reference, le pooler et le mot de passe :
# les redemander a chaque sauvegarde est une invitation a se tromper de base.
# Ce qui vient de l'environnement reste prioritaire — on sauvegarde parfois
# une autre base que celle du fichier.
CONF="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/.env.migration"
if [[ -f "$CONF" ]]; then
  set -a; source "$CONF"; set +a
fi

REF="${REF:-${SOURCE_REF:-aojguoqxbzqcganxgqem}}"
POOLER="${POOLER:-${SOURCE_POOLER:-}}"
PW_FICHIER="${SOURCE_PASSWORD:-}"     # evite la saisie si le fichier le porte

RACINE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DUMP_DIR="$RACINE/.dumps"
DUMP="$DUMP_DIR/bot-$(date +%Y%m%d-%H%M%S).sql"

# Sans auth.users et auth.identities, les profils sauvegardés n'auraient plus
# de compte de connexion. Le reste du schéma auth (sessions, jetons) ne vaut
# que pour l'instance d'origine.
#
# public s'écrit --table=public.* et NON --schema=public : dès qu'un --table
# est présent, pg_dump ignore --schema. Écrit --schema, le dump ne sortait que
# les deux tables auth, sans une ligne de public — sans la moindre erreur.
SCHEMAS=(--table='public.*' --table=auth.users --table=auth.identities)

if [[ -z "$POOLER" ]]; then
  echo "Hôte du pooler introuvable."
  echo
  echo "Dashboard → projet bot → Project Settings → Database"
  echo "  → Connection string → onglet « Session pooler »"
  echo
  echo "Y lire l'hôte (aws-0 ou aws-1 — les deux existent, un seul marche) :"
  echo
  echo "  POOLER=aws-0-eu-west-1.pooler.supabase.com $0"
  echo
  exit 1
fi

mkdir -p "$DUMP_DIR"

echo "=== Export de bot (données seules) ==="
echo "    hôte : $POOLER"
echo "    user : postgres.$REF"
if [[ -n "$PW_FICHIER" ]]; then
  PW="$PW_FICHIER"
  echo "    mot de passe lu dans .env.migration"
else
  read -rsp "Mot de passe de bot : " PW; echo
fi
export PGPASSWORD="$PW"

# Le pooler ferme les connexions inactives ; sur une base volumineuse le dump
# peut être coupé en cours de route. Si cela arrive, passer par
#   supabase db dump --linked --data-only -f <fichier>
# qui gère la connexion lui-même.
"$PG_BIN/pg_dump" \
  -h "$POOLER" -p 5432 -U "postgres.$REF" -d postgres \
  --data-only --no-owner --no-privileges \
  "${SCHEMAS[@]}" \
  -f "$DUMP"

unset PGPASSWORD PW

# Un pg_dump interrompu ne laisse pas toujours de fichier : sans ce controle,
# le `du` qui suit echoue en « syntax error », message qui n'a aucun rapport
# avec la cause et envoie chercher un defaut dans le script (2026-08-29).
if [[ ! -s "$DUMP" ]]; then
  echo "    ECHEC : aucun dump produit — l'export a ete interrompu." >&2
  exit 1
fi
echo "    → $DUMP  ($(du -h "$DUMP" | cut -f1))"
echo
echo "=== Contrôle : lignes par table dans le dump ==="
# Compte les COPY du dump plutôt que d'interroger la base : c'est le fichier
# produit qu'on veut vérifier, pas la source.
awk '/^COPY /{t=$2; n=0; next} /^\\\.$/{if(t){printf "    %-40s %6d lignes\n", t, n; t=""}} t{n++}' "$DUMP"

# Un dump sans public serait silencieusement vide de tout l'applicatif.
if ! grep -q '^COPY public\.' "$DUMP"; then
  echo
  echo "⚠️  AUCUNE table public dans le dump — sauvegarde inutilisable."
  exit 1
fi

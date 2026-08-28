#!/usr/bin/env bash
# ============================================================================
# Compare le SCHÉMA de deux bases et dit ce qui diverge.
#
#   ./scripts/comparer-bases.sh
#   POOLER=aws-0-eu-west-1.pooler.supabase.com ./scripts/comparer-bases.sh
#
# Ne fait que lire, sur les deux bases. N'écrit rien, ne corrige rien.
#
# Pourquoi cet outil : compter les tables, les policies et les fonctions ne
# suffit pas. Le 2026-08-28, `bot` et la base de développement affichaient
# exactement les mêmes compteurs — 27 tables, 89 policies, 76 fonctions — alors
# que la policy de lecture de `pack_types` différait dans son texte et faisait
# lire « 0 crédit » à six membres. Un compteur identique ne prouve rien : c'est
# la DÉFINITION qu'il faut comparer.
#
# Ce script compare donc le texte : définitions de policies, signatures de
# fonctions, colonnes, contraintes CHECK, droits de table.
# ============================================================================
set -euo pipefail

PG_BIN="/opt/homebrew/opt/libpq/bin"

SOURCE_REF="aojguoqxbzqcganxgqem"                   # bot  — opérationnelle
SOURCE_HOST="${POOLER:-}"                            # pooler de bot, à fournir
SOURCE_USER="postgres.$SOURCE_REF"
SOURCE_NOM="bot (opérationnelle)"

CIBLE_HOST="db.dcfzupyzdrndqegyeafg.supabase.co"    # bot2 — développement
CIBLE_USER="postgres"
CIBLE_NOM="bot2 (développement)"

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

if [[ -z "$SOURCE_HOST" ]]; then
  echo "Hôte du pooler de bot introuvable."
  echo
  echo "Dashboard → projet bot → Project Settings → Database"
  echo "  → Connection string → onglet « Session pooler »"
  echo
  echo "  POOLER=aws-0-eu-west-1.pooler.supabase.com $0"
  exit 1
fi

# Chaque requête sort une ligne par objet, triée : un `diff` suffit ensuite.
# `-At` (sans alignement ni en-tête) rend la sortie directement comparable.
lire() {
  local host="$1" user="$2" sortie="$3" sql="$4"
  "$PG_BIN/psql" -h "$host" -p 5432 -U "$user" -d postgres \
    -At -F '|' -v ON_ERROR_STOP=1 -c "$sql" | sort > "$sortie"
}

echo "=== Comparaison de schéma ==="
echo "    $SOURCE_NOM  ↔  $CIBLE_NOM"
echo
read -rsp "Mot de passe de bot  : " PW; echo
export PGPASSWORD="$PW"
# psql ne prend qu'un PGPASSWORD à la fois : on lit bot d'abord, puis bot2.
# D'où la structure ci-dessous, qui relit tout par base plutôt que par objet.

# --- Colonnes -------------------------------------------------------------
SQL_COLONNES="SELECT table_name||'.'||column_name||' '||data_type
  FROM information_schema.columns WHERE table_schema='public'"

# --- Policies : la DÉFINITION, pas seulement le nom ----------------------
SQL_POLICIES="SELECT c.relname||' | '||p.polname||' | '||p.polcmd||' | '||
    COALESCE(pg_get_expr(p.polqual, p.polrelid),'-')||' | '||
    COALESCE(pg_get_expr(p.polwithcheck, p.polrelid),'-')
  FROM pg_policy p JOIN pg_class c ON c.oid=p.polrelid
  JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public'"

# --- Fonctions : signature + type de retour ------------------------------
SQL_FONCTIONS="SELECT p.proname||'('||pg_get_function_identity_arguments(p.oid)||') -> '||
    pg_get_function_result(p.oid)||' | '||
    CASE WHEN p.prosecdef THEN 'definer' ELSE 'invoker' END
  FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public'"

# --- Contraintes CHECK ----------------------------------------------------
SQL_CHECKS="SELECT conrelid::regclass::text||' | '||conname||' | '||pg_get_constraintdef(oid)
  FROM pg_constraint WHERE contype='c' AND connamespace='public'::regnamespace"

# --- Droits de table (le défaut du 27 août) ------------------------------
SQL_GRANTS="SELECT c.relname||' | authenticated:'||
    has_table_privilege('authenticated', c.oid, 'SELECT')::text||' | anon:'||
    has_table_privilege('anon', c.oid, 'SELECT')::text||' | rls:'||c.relrowsecurity::text
  FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
  WHERE n.nspname='public' AND c.relkind='r'"

# --- Triggers -------------------------------------------------------------
SQL_TRIGGERS="SELECT c.relname||' | '||t.tgname
  FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid
  JOIN pg_namespace n ON n.oid=c.relnamespace
  WHERE n.nspname='public' AND NOT t.tgisinternal"

for item in "colonnes:$SQL_COLONNES" "policies:$SQL_POLICIES" \
            "fonctions:$SQL_FONCTIONS" "checks:$SQL_CHECKS" \
            "grants:$SQL_GRANTS" "triggers:$SQL_TRIGGERS"; do
  nom="${item%%:*}"; sql="${item#*:}"
  lire "$SOURCE_HOST" "$SOURCE_USER" "$TMP/$nom.source" "$sql"
done
unset PGPASSWORD PW

read -rsp "Mot de passe de bot2 : " PW2; echo
export PGPASSWORD="$PW2"
for item in "colonnes:$SQL_COLONNES" "policies:$SQL_POLICIES" \
            "fonctions:$SQL_FONCTIONS" "checks:$SQL_CHECKS" \
            "grants:$SQL_GRANTS" "triggers:$SQL_TRIGGERS"; do
  nom="${item%%:*}"; sql="${item#*:}"
  lire "$CIBLE_HOST" "$CIBLE_USER" "$TMP/$nom.cible" "$sql"
done
unset PGPASSWORD PW2

echo
echo "=== Résultat ==="
ECARTS=0
for nom in colonnes policies fonctions checks grants triggers; do
  if diff -q "$TMP/$nom.source" "$TMP/$nom.cible" > /dev/null; then
    printf "  ✅  %-12s identique\n" "$nom"
  else
    printf "  ⚠️   %-12s DIVERGE\n" "$nom"
    diff "$TMP/$nom.source" "$TMP/$nom.cible" | grep '^[<>]' \
      | sed 's/^< /      bot  : /; s/^> /      bot2 : /' | cut -c1-170
    echo
    ECARTS=$((ECARTS + 1))
  fi
done

echo
if [[ $ECARTS -eq 0 ]]; then
  echo "Les deux schémas sont alignés."
else
  echo "$ECARTS catégorie(s) divergent."
  echo
  echo "Rappel : une divergence n'est pas toujours un défaut — la base de"
  echo "développement peut porter un correctif en cours d'épreuve, pas encore"
  echo "reporté sur bot. Lire chaque écart avant de corriger."
fi

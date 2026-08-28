#!/usr/bin/env bash
# ============================================================================
# Copie les fichiers du bucket `avatars` d'une base vers une autre, et
# réécrit les URL que la base porte en dur.
#
#   SOURCE_REF=xxx SOURCE_KEY=xxx CIBLE_REF=yyy CIBLE_KEY=yyy \
#     ./scripts/copier-storage.sh
#
# Les clés sont les SERVICE ROLE keys (Project Settings → API). Elles
# contournent RLS : indispensable pour lire et écrire le Storage d'un bout à
# l'autre. Ne pas les laisser dans un fichier — les passer à la commande.
#
# ---------------------------------------------------------------------------
# Pourquoi ce script
#
# `install.sql` crée le bucket `avatars`, mais pas son contenu. Sur `bot` au
# 2026-08-28 : 8 fichiers, 2,4 Mo — 4 photos de types de cours et 4 portraits
# de coachs. Le nom du bucket dit « avatars », son usage est plus large.
#
# La base ne stocke que le CHEMIN des images (`coaches/x.jpg`) depuis le
# 2026-08-28 ; le front reconstruit l'adresse à l'affichage. Copier les
# fichiers suffit donc, sans aucune URL à réécrire.
# ============================================================================
set -euo pipefail

: "${SOURCE_REF:?SOURCE_REF manquant (ref du projet source)}"
: "${SOURCE_KEY:?SOURCE_KEY manquant (service role key de la source)}"
: "${CIBLE_REF:?CIBLE_REF manquant (ref du projet cible)}"
: "${CIBLE_KEY:?CIBLE_KEY manquant (service role key de la cible)}"

BUCKET="${BUCKET:-avatars}"
SOURCE_URL="https://$SOURCE_REF.supabase.co"
CIBLE_URL="https://$CIBLE_REF.supabase.co"

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

echo "=== Copie du bucket « $BUCKET » ==="
echo "    $SOURCE_REF  →  $CIBLE_REF"
echo

# --- 1. Lister les fichiers de la source ---------------------------------
# L'API storage liste par préfixe et ne descend pas dans les sous-dossiers
# toute seule : on interroge la table storage.objects via PostgREST, qui donne
# les chemins complets en une fois.
echo "=== 1/3  Inventaire ==="
curl -sS "$SOURCE_URL/rest/v1/rpc/lister_fichiers_storage" \
  -H "apikey: $SOURCE_KEY" -H "Authorization: Bearer $SOURCE_KEY" \
  -H "Content-Type: application/json" -d "{\"p_bucket\":\"$BUCKET\"}" \
  > "$TMP/liste.json" 2>/dev/null || true

# Repli : si la fonction n'existe pas sur la source, on passe par l'API
# storage, dossier par dossier. Les deux préfixes connus suffisent ici.
if ! grep -q '"name"' "$TMP/liste.json" 2>/dev/null; then
  echo "    (RPC absente — passage par l'API storage)"
  : > "$TMP/fichiers.txt"
  for prefixe in "" "class-types" "coaches"; do
    curl -sS "$SOURCE_URL/storage/v1/object/list/$BUCKET" \
      -H "apikey: $SOURCE_KEY" -H "Authorization: Bearer $SOURCE_KEY" \
      -H "Content-Type: application/json" \
      -d "{\"prefix\":\"$prefixe\",\"limit\":1000}" \
    | python3 -c "
import json,sys
prefixe = '$prefixe'
try:
    for o in json.load(sys.stdin):
        nom = o.get('name')
        # Un dossier n'a pas de metadata : on ne le télécharge pas.
        if nom and o.get('metadata'):
            print(f'{prefixe}/{nom}' if prefixe else nom)
except Exception:
    pass
" >> "$TMP/fichiers.txt"
  done
else
  python3 -c "
import json
for o in json.load(open('$TMP/liste.json')):
    print(o['name'])
" > "$TMP/fichiers.txt"
fi

NB=$(grep -c . "$TMP/fichiers.txt" || echo 0)
echo "    $NB fichier(s) à copier"
if [[ "$NB" -eq 0 ]]; then
  echo "    Rien à faire."
  exit 0
fi
sed 's/^/      /' "$TMP/fichiers.txt"

# --- 2. Télécharger puis téléverser --------------------------------------
echo
echo "=== 2/3  Transfert ==="
mkdir -p "$TMP/f"
ERREURS=0
while IFS= read -r chemin; do
  [[ -z "$chemin" ]] && continue
  local_fichier="$TMP/f/$(echo "$chemin" | tr '/' '_')"

  if ! curl -sSf "$SOURCE_URL/storage/v1/object/public/$BUCKET/$chemin" \
       -o "$local_fichier" 2>/dev/null; then
    echo "    ⚠️  lecture impossible : $chemin"
    ERREURS=$((ERREURS + 1)); continue
  fi

  # x-upsert : rejouer le script ne doit pas échouer sur « déjà présent ».
  code=$(curl -sS -o /dev/null -w '%{http_code}' \
    -X POST "$CIBLE_URL/storage/v1/object/$BUCKET/$chemin" \
    -H "apikey: $CIBLE_KEY" -H "Authorization: Bearer $CIBLE_KEY" \
    -H "x-upsert: true" \
    --data-binary "@$local_fichier")

  if [[ "$code" =~ ^2 ]]; then
    echo "    ✅  $chemin"
  else
    echo "    ⚠️  envoi refusé ($code) : $chemin"
    ERREURS=$((ERREURS + 1))
  fi
done < "$TMP/fichiers.txt"

# --- 3. Rien à réécrire ---------------------------------------------------
# La base ne stocke plus que le chemin des images (`coaches/x.jpg`), le front
# reconstruit l'adresse à l'affichage. Copier les fichiers suffit donc : aucune
# URL à corriger, quelle que soit la base d'arrivée.

echo
if [[ "$ERREURS" -eq 0 ]]; then
  echo "Transfert terminé : $NB fichier(s)."
else
  echo "Transfert terminé avec $ERREURS erreur(s) sur $NB."
fi

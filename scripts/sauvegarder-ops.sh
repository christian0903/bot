#!/usr/bin/env bash
# ============================================================================
# Sauvegarde bot-ops — la base de PRODUCTION — dans un fichier local.
#
#   ./scripts/sauvegarder-ops.sh              # sauvegarde, puis purge
#   ./scripts/sauvegarder-ops.sh --garder 90  # conserve 90 jours au lieu de 30
#   ./scripts/sauvegarder-ops.sh --sans-purge # ne supprime aucune ancienne copie
#
# Ne fait QUE lire : aucune écriture, sur aucune base.
#
# POURQUOI CE FICHIER EXISTE, ALORS QUE SUPABASE SAUVEGARDE DÉJÀ
#
# Le plan Pro conserve une sauvegarde quotidienne pendant SEPT JOURS. Cela
# couvre la panne d'infrastructure, pas les trois risques qui menacent
# réellement ce projet :
#
#   - l'erreur découverte tard. Un UPDATE malheureux repéré au bout de dix
#     jours n'est plus rattrapable côté Supabase. Le `db push` du 31 août et
#     le `repair` hasardeux qui l'a déclenché montrent que ce n'est pas une
#     crainte théorique ;
#   - la perte de l'accès au compte. La sauvegarde de Supabase vit au même
#     endroit que la donnée qu'elle protège ;
#   - le besoin de CONSULTER un état passé sans restaurer quoi que ce soit.
#
# La base fait une quinzaine de mégaoctets : la copie coûte quelques secondes.
#
# OÙ ATTERRISSENT LES FICHIERS
#
#   .dumps/dump bot ops/
#     ├── 20260905-143000/donnees.sql     ← une sauvegarde
#     ├── 20260906-091500/donnees.sql     ← la suivante
#     └── …
#
# Un sous-dossier par sauvegarde, nommé par la date et l'heure : deux copies
# du même jour ne s'écrasent pas, et ce qui accompagne un dump se range à côté
# de lui.
#
# ⚠️ CES FICHIERS CONTIENNENT DES DONNÉES PERSONNELLES — adresses e-mail,
# téléphones, dates de naissance, adresses, et quelques dossiers médicaux de
# vrais membres. Le dossier est exclu de git à deux titres (`.dumps/` et
# `dump bot ops/`), pour que la protection survive à un déplacement. Ne pas le
# déposer dans le vault ni dans un dossier synchronisé en clair : un disque
# chiffré, sinon rien.
# ============================================================================
set -euo pipefail

PG_BIN="/opt/homebrew/opt/libpq/bin"
REF_OPS="xgwrxbkrfypklrnqbftv"        # bot-ops, eu-west-3 (Paris)
JOURS_DEFAUT=30

RACINE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# Toutes les sauvegardes de bot-ops vivent sous ce dossier, chacune dans un
# sous-dossier date. `.dumps/` reste au voisinage : il porte les dumps de
# l'ancienne base et du WordPress, que ce script ne touche jamais.
DUMP_DIR="$RACINE/.dumps/dump bot ops"

garder="$JOURS_DEFAUT"
purger=1
while [[ $# -gt 0 ]]; do
  case "$1" in
    --garder)     garder="${2:?--garder attend un nombre de jours}"; shift 2 ;;
    --sans-purge) purger=0; shift ;;
    -h|--help)    sed -n '2,30p' "$0"; exit 0 ;;
    *)            echo "Option inconnue : $1" >&2; exit 1 ;;
  esac
done

# ---------------------------------------------------------------------------
# La connexion
# ---------------------------------------------------------------------------
# Passe par le POOLER et non par db.<ref>.supabase.co : la connexion directe
# ne répond plus sur les projets de ce compte (« Connection refused » constaté
# le 2026-08-28 sur une base pourtant ACTIVE_HEALTHY). Le pooler impose deux
# écarts au format habituel :
#   - l'hôte porte un préfixe aws-0 / aws-1 que seul le dashboard donne ;
#     les deux répondent au ping, un seul accepte le projet ;
#   - l'utilisateur devient postgres.<ref> et non postgres.
# Project Settings → Database → Connection string → onglet « Session pooler ».
#
# `.env.migration` porte déjà des identifiants, mais ceux de l'ANCIENNE base
# (SOURCE_*) et de la cible d'alors. On lit donc des variables qui lui sont
# propres — OPS_POOLER, OPS_PASSWORD — pour qu'aucune confusion ne soit
# possible avec la sauvegarde de `bot`, que fait `sauvegarder-bot.sh`.
CONF="$RACINE/.env.migration"
if [[ -f "$CONF" ]]; then
  set -a; source "$CONF"; set +a
fi

POOLER="${OPS_POOLER:-}"
PW="${OPS_PASSWORD:-}"

# Repli sur les variables CIBLE_* de `.env.migration`. Lors de la migration
# d'aout 2026, la « cible » etait precisement bot-ops : `CIBLE_PASSWORD` porte
# donc deja le bon mot de passe. On ne s'en sert QUE si CIBLE_REF designe bien
# bot-ops — sans ce controle, un jour ou la cible aurait change, le script
# tenterait de se connecter a une autre base avec des identifiants qui ne lui
# correspondent pas.
if [[ -z "$PW" && "${CIBLE_REF:-}" == "$REF_OPS" ]]; then
  PW="${CIBLE_PASSWORD:-}"
  [[ -n "$PW" ]] && echo "    mot de passe repris de CIBLE_PASSWORD (.env.migration)"
fi

# L'hote du pooler, si `.env.migration` ne le porte pas. bot-ops est a Paris,
# donc eu-west-3 ; le prefixe est **aws-1** — verifie le 2026-09-05, aws-0
# repondant « tenant/user postgres.<ref> not found ». Les deux hotes existent
# et resolvent en DNS, seul celui-ci accepte le projet.
POOLER_DEVINE=0
if [[ -z "$POOLER" ]]; then
  POOLER="aws-1-eu-west-3.pooler.supabase.com"
  POOLER_DEVINE=1
fi

# ---------------------------------------------------------------------------
# Ce qu'on sauvegarde
# ---------------------------------------------------------------------------
# ⚠️ PIÈGE COÛTEUX, appris le 2026-08-29 : dès qu'un `--table` est présent,
# pg_dump IGNORE tous les `--schema`. Écrit `--schema=public --table=auth.users`,
# le dump ne sortait que les deux tables auth, sans une ligne de public — et
# sans la moindre erreur. Tout s'écrit donc en `--table`.
#
# `auth.users` et `auth.identities` sont indispensables : sans eux, les profils
# restaurés n'auraient plus de compte de connexion et personne ne pourrait
# entrer. Le reste du schéma auth (sessions, jetons de rafraîchissement) ne
# vaut que pour l'instance d'origine et se régénère à la reconnexion.
#
# `storage.objects` note quels fichiers existent, mais PAS leur contenu : les
# images vivent dans le bucket, hors de la base. Voir l'avertissement final.
TABLES=(
  --table='public.*'
  --table=auth.users
  --table=auth.identities
  --table='storage.buckets'
  --table='storage.objects'
)

# Un sous-dossier par sauvegarde, nomme par la date et l'heure. Deux
# sauvegardes le meme jour ne s'ecrasent donc pas, et tout ce qui accompagne
# un dump — le present fichier, plus tard les images du bucket — se range
# naturellement a cote de lui.
HORODATAGE="$(date +%Y%m%d-%H%M%S)"
DOSSIER="$DUMP_DIR/$HORODATAGE"
mkdir -p "$DOSSIER"
DUMP="$DOSSIER/donnees.sql"

echo "=== Sauvegarde de bot-ops (PRODUCTION) ==="
echo "    projet : $REF_OPS"
echo "    hôte   : $POOLER"
echo "    user   : postgres.$REF_OPS"

if [[ -n "$PW" ]]; then
  echo "    mot de passe lu dans .env.migration"
else
  read -rsp "    Mot de passe de bot-ops : " PW; echo
fi
export PGPASSWORD="$PW"

# --data-only : le schéma se reconstruit par `supabase/install.sql`, qui est
# versionné et fait autorité. Sauvegarder la structure ici en ferait une
# seconde source de vérité, qui divergerait.
#
# Le pooler ferme les connexions inactives ; si le dump est coupé en route,
# passer par `supabase db dump --linked --data-only -f <fichier>`, qui gère
# la connexion lui-même.
if ! "$PG_BIN/pg_dump" \
  -h "$POOLER" -p 5432 -U "postgres.$REF_OPS" -d postgres \
  --data-only --no-owner --no-privileges \
  "${TABLES[@]}" \
  -f "$DUMP"
then
  echo >&2
  if (( POOLER_DEVINE )); then
    # L'hote n'a pas ete fourni : le prefixe aws-0 etait une supposition.
    cat >&2 <<MSG
L'hote « $POOLER » n'a pas ete fourni : c'est celui qui marchait au
2026-09-05. Si Supabase a depuis deplace le projet, essayer l'autre prefixe :

  OPS_POOLER=aws-0-eu-west-3.pooler.supabase.com $0

Ou lire la valeur exacte : Dashboard → bot-ops → Project Settings → Database
→ Connection string → onglet « Session pooler ». Puis la fixer dans
.env.migration pour ne plus avoir a y penser :

  OPS_POOLER=<l'hote lu dans le dashboard>
MSG
  else
    echo "Echec de connexion a « $POOLER »." >&2
    echo "Verifier l'hote et le mot de passe : Dashboard → bot-ops →" >&2
    echo "Project Settings → Database → Connection string → Session pooler." >&2
  fi
  unset PGPASSWORD PW
  rmdir "$DOSSIER" 2>/dev/null || true
  exit 1
fi

unset PGPASSWORD PW

# Un pg_dump interrompu ne laisse pas toujours de fichier : sans ce contrôle,
# le `du` qui suit échoue en « syntax error », message sans rapport avec la
# cause et qui envoie chercher un défaut dans le script (2026-08-29).
if [[ ! -s "$DUMP" ]]; then
  echo "    ÉCHEC : aucun dump produit — l'export a été interrompu." >&2
  exit 1
fi

echo "    → $DUMP  ($(du -h "$DUMP" | cut -f1))"
echo
echo "=== Contrôle : lignes par table dans le dump ==="
# On compte les COPY du FICHIER plutôt que d'interroger la base : c'est le
# dump produit qu'on veut vérifier, pas la source dont il sort.
awk '/^COPY /{t=$2; n=0; next} /^\\\.$/{if(t){printf "    %-42s %6d lignes\n", t, n; t=""}} t{n++}' "$DUMP"

# ---------------------------------------------------------------------------
# Les garde-fous qui font la valeur du fichier
# ---------------------------------------------------------------------------
echo
manque=0

# Un dump sans public serait silencieusement vide de tout l'applicatif.
if ! grep -q '^COPY public\.' "$DUMP"; then
  echo "⚠️  AUCUNE table public — sauvegarde inutilisable." >&2
  manque=1
fi

# Sans auth.users, les profils restaurés n'ont plus de compte : la base
# paraîtrait complète et personne ne pourrait s'y connecter.
if ! grep -q '^COPY auth\.users' "$DUMP"; then
  echo "⚠️  auth.users ABSENT — personne ne pourrait se reconnecter." >&2
  manque=1
fi

# Le nombre de profils est le signe le plus simple d'un dump tronqué.
profils_dump="$(awk '/^COPY public\.profiles /{n=0; f=1; next} f&&/^\\\.$/{print n; exit} f{n++}' "$DUMP")"
if [[ -n "${profils_dump:-}" ]] && (( profils_dump < 50 )); then
  echo "⚠️  Seulement $profils_dump profils dans le dump — la production en porte plus de cent." >&2
  echo "    Export vraisemblablement tronqué : NE PAS se fier à ce fichier." >&2
  manque=1
fi

if (( manque )); then
  echo >&2
  echo "Sauvegarde CONSERVÉE pour analyse, mais à considérer comme inutilisable." >&2
  exit 1
fi

echo "✓ Dump complet : public, auth.users et auth.identities présents."

# ---------------------------------------------------------------------------
# Purge des anciennes copies
# ---------------------------------------------------------------------------
# Ne touche QUE les sous-dossiers horodates de « dump bot ops ». Les dumps de
# l'ancienne base `bot` et ceux du WordPress vivent dans `.dumps/` a cote, et
# ne sont jamais concernes.
#
# Le motif [0-9]* borne la casse : un dossier que vous auriez cree a la main
# sous un autre nom — « avant-migration », « a-garder » — survit a la purge.
if (( purger )); then
  echo
  echo "=== Purge des sauvegardes de plus de $garder jours ==="
  supprimes=0
  while IFS= read -r vieux; do
    echo "    supprimé : $(basename "$vieux")  ($(du -sh "$vieux" | cut -f1))"
    rm -rf "$vieux"
    supprimes=$((supprimes + 1))
  done < <(find "$DUMP_DIR" -mindepth 1 -maxdepth 1 -type d -name '[0-9]*' -mtime "+$garder")
  if (( supprimes == 0 )); then
    echo "    (rien à supprimer)"
  fi
fi

# ---------------------------------------------------------------------------
# Ce que ce fichier ne couvre PAS
# ---------------------------------------------------------------------------
cat <<'FIN'

────────────────────────────────────────────────────────────────────────────
Ce dump porte les DONNÉES. Pour restaurer une base complète il faut aussi :

  1. le schéma — `supabase/install.sql`, versionné, qui fait autorité ;
  2. les fichiers du bucket `class-types` (images des types de cours), qui
     vivent hors de la base. `scripts/copier-storage.sh` sait les récupérer ;
  3. les secrets des Edge Functions (Stripe, Resend), qui ne sont dans aucune
     base — ils se reposent depuis `.env.migration`.

Et un rappel : ce fichier contient les données personnelles de vrais membres.
Il reste dans .dumps/, que git ignore. Ne pas le déposer ailleurs en clair.
────────────────────────────────────────────────────────────────────────────
FIN

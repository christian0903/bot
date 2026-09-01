#!/usr/bin/env bash
#
# Retrouve le commit d'une version, ou la version d'un commit.
#
#   ./scripts/version.sh 3.109.0     -> le commit qui porte cette version
#   ./scripts/version.sh bec78f9     -> la version que porte ce commit
#   ./scripts/version.sh             -> les dix dernieres versions
#
# Pourquoi ce script : `git log -S '"version": "3.109.0"' -- package.json` fait
# le travail, mais personne ne retient cette ligne. Le retour en arriere est
# une manoeuvre qu'on fait rarement, souvent sous pression — elle doit tenir en
# une commande qu'on lit sans reflechir.
#
# Depuis la v3.116.0, chaque version porte aussi une etiquette : `git checkout
# v3.109.0` suffit alors, sans passer par ici. Ce script reste utile pour les
# versions anterieures, qui n'en ont pas.

set -euo pipefail
cd "$(dirname "$0")/.."

VERT=$'\033[32m'; GRAS=$'\033[1m'; GRIS=$'\033[90m'; RAZ=$'\033[0m'

# ── Sans argument : les dix dernieres versions ──────────────────────────────
if [[ $# -eq 0 ]]; then
  echo
  echo "${GRAS}Les dix dernieres versions${RAZ}"
  echo
  git log -20 --format='%h|%ad|%s' --date=format:'%d/%m/%Y' -- package.json |
  while IFS='|' read -r sha date sujet; do
    v=$(git show "$sha:package.json" 2>/dev/null |
        sed -n 's/.*"version": "\([^"]*\)".*/\1/p' | head -1)
    [[ -n "$v" ]] && printf "  ${VERT}%-10s${RAZ} %s  ${GRIS}%s${RAZ}  %s\n" \
      "v$v" "$sha" "$date" "${sujet:0:52}"
  done | awk '!vu[$1]++' | head -10
  echo
  echo "  ${GRIS}Detail d'une version :  ./scripts/version.sh 3.109.0${RAZ}"
  echo
  exit 0
fi

CIBLE="$1"

# ── Un numero de version ────────────────────────────────────────────────────
if [[ "$CIBLE" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  # `tail -1` et non `head -1` : `-S` liste du plus recent au plus ancien, et
  # c'est le commit qui a INTRODUIT la version qui nous interesse.
  LIGNE=$(git log --format='%h|%ad|%s' --date=format:'%d/%m/%Y' \
            -S "\"version\": \"$CIBLE\"" -- package.json | tail -1)

  if [[ -z "$LIGNE" ]]; then
    echo "Version $CIBLE introuvable dans l'historique." >&2
    echo "Les versions connues :  ./scripts/version.sh" >&2
    exit 1
  fi

  IFS='|' read -r sha date sujet <<< "$LIGNE"
  echo
  echo "  ${GRAS}v$CIBLE${RAZ}"
  echo "  commit  ${VERT}$sha${RAZ}"
  echo "  date    $date"
  echo "  sujet   $sujet"
  echo

  # L'etiquette, si elle existe, est plus lisible qu'un identifiant de commit.
  if git rev-parse "v$CIBLE" >/dev/null 2>&1; then
    echo "  ${GRAS}Y revenir :${RAZ}  git checkout v$CIBLE"
  else
    echo "  ${GRAS}Y revenir :${RAZ}  git checkout $sha"
    echo "  ${GRIS}(pas d'etiquette pour cette version : elle est anterieure a la v3.116.0)${RAZ}"
  fi
  echo "  ${GRIS}puis ./deploiement.sh jag — et 'git checkout main' pour revenir${RAZ}"
  echo
  echo "  ${GRAS}Touche-t-elle la base de donnees ?${RAZ}"
  if git show --stat "$sha" 2>/dev/null | grep -q "supabase/"; then
    echo "  ${GRAS}OUI${RAZ} — revenir en arriere ne defera PAS la migration."
    echo "  ${GRIS}Verifier ce qu'elle change :  git show --stat $sha${RAZ}"
  else
    echo "  Non : que du code. Le retour en arriere est sans consequence."
  fi
  echo
  exit 0
fi

# ── Un identifiant de commit ────────────────────────────────────────────────
if ! git rev-parse --verify "$CIBLE^{commit}" >/dev/null 2>&1; then
  echo "« $CIBLE » n'est ni un numero de version ni un commit connu." >&2
  exit 1
fi

V=$(git show "$CIBLE:package.json" 2>/dev/null |
    sed -n 's/.*"version": "\([^"]*\)".*/\1/p' | head -1)
echo
echo "  commit  ${VERT}$(git rev-parse --short "$CIBLE")${RAZ}"
echo "  version ${GRAS}v${V:-inconnue}${RAZ}"
echo "  sujet   $(git log -1 --format='%s' "$CIBLE")"
echo

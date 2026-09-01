#!/usr/bin/env bash
#
# Reporte la version de `package.json` dans les enveloppes iOS et Android.
#
#   ./scripts/version-mobile.sh
#
# Pourquoi ce script existe : `npx cap sync` recopie les fichiers WEB dans les
# enveloppes, mais ne touche JAMAIS a leur numero de version. Celui-ci vit dans
# `project.pbxproj` (iOS) et `build.gradle` (Android), des fichiers natifs que
# Capacitor ne genere pas.
#
# Consequence si on l'oublie : on envoie a Apple une application qui s'annonce
# en 3.69.0 alors que le depot est en 3.119.0. Apple refuse une version deja
# soumise, et une version qui recule n'a aucun sens pour un utilisateur.
#
# `CURRENT_PROJECT_VERSION` (iOS) et `versionCode` (Android) sont le numero de
# BUILD : Apple et Google exigent qu'il augmente a chaque envoi, meme pour
# corriger un rejet sans rien changer d'autre. Il s'incremente donc ici aussi.

set -euo pipefail
cd "$(dirname "$0")/.."

VERT=$'\033[32m'; GRAS=$'\033[1m'; GRIS=$'\033[90m'; RAZ=$'\033[0m'

V=$(node -p "require('./package.json').version")

# ── Garde-fou : le `.env` doit viser l'APPLICATION, pas la vitrine ──────────
#
# `deploiement.sh` ECRASE `.env` avec celui de la cible choisie. Apres un
# `./deploiement.sh prod-site`, `.env` porte donc `VITE_VITRINE=oui` — et un
# `npm run cap:sync` lance dans la foulee construit l'app mobile AVEC la
# vitrine. L'application s'ouvre alors sur le site public au lieu de l'ecran de
# connexion.
#
# C'est arrive le 2026-09-01, decouvert par Christian dans le simulateur. Une
# app soumise ainsi serait rejetee d'emblee : afficher un site vitrine est
# exactement ce que la regle 4.2 d'Apple sanctionne.
if grep -q '^VITE_VITRINE=oui' .env 2>/dev/null; then
  echo
  echo "  ${GRAS}Arret :${RAZ} .env est configure pour la VITRINE (VITE_VITRINE=oui)."
  echo "  Construire l'app mobile ainsi lui ferait afficher le site public."
  echo
  echo "  ${GRIS}Corriger :  cp .env.ops .env${RAZ}"
  echo
  exit 1
fi

echo
echo "  ${GRAS}Report de la version $V dans les enveloppes${RAZ}"
echo

# ── iOS ─────────────────────────────────────────────────────────────────────
PBX="ios/App/App.xcodeproj/project.pbxproj"
if [[ -f "$PBX" ]]; then
  AVANT=$(grep -m1 "MARKETING_VERSION" "$PBX" | grep -oE "[0-9]+\.[0-9]+\.[0-9]+")
  BUILD=$(grep -m1 "CURRENT_PROJECT_VERSION" "$PBX" | grep -oE "[0-9]+")
  BUILD=$(( ${BUILD:-0} + 1 ))

  sed -i '' "s/MARKETING_VERSION = [0-9.]*;/MARKETING_VERSION = $V;/g" "$PBX"
  sed -i '' "s/CURRENT_PROJECT_VERSION = [0-9]*;/CURRENT_PROJECT_VERSION = $BUILD;/g" "$PBX"

  printf "  iOS      ${GRIS}%-9s${RAZ} -> ${VERT}%-9s${RAZ}  build %s\n" "$AVANT" "$V" "$BUILD"
else
  echo "  iOS      ${GRIS}enveloppe absente${RAZ}"
fi

# ── Android ─────────────────────────────────────────────────────────────────
GRADLE="android/app/build.gradle"
if [[ -f "$GRADLE" ]]; then
  AVANT=$(grep -m1 "versionName" "$GRADLE" | grep -oE "[0-9]+\.[0-9]+\.[0-9]+")
  CODE=$(grep -m1 "versionCode" "$GRADLE" | grep -oE "[0-9]+")
  CODE=$(( ${CODE:-0} + 1 ))

  sed -i '' "s/versionName \"[0-9.]*\"/versionName \"$V\"/" "$GRADLE"
  sed -i '' "s/versionCode [0-9]*/versionCode $CODE/" "$GRADLE"

  printf "  Android  ${GRIS}%-9s${RAZ} -> ${VERT}%-9s${RAZ}  code %s\n" "$AVANT" "$V" "$CODE"
else
  echo "  Android  ${GRIS}enveloppe absente${RAZ}"
fi

echo
echo "  ${GRIS}Puis : npm run cap:sync, et ./scripts/verifier-mobile.sh${RAZ}"
echo

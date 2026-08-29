#!/usr/bin/env bash
# ============================================================================
# Ce qui est pret, et ce qui manque, pour soumettre aux stores.
#
#   ./scripts/verifier-mobile.sh
#
# Ne modifie rien. Repond a une seule question : peut-on envoyer aujourd'hui ?
#
# Les projets natifs vivent a cote du web et se desynchronisent en silence —
# le projet iOS est reste trois semaines en 2.12.0 pendant que le depot
# avancait, et personne ne l'a vu.
# ============================================================================
set -uo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."

if [[ -t 1 ]]; then
  GRAS=$'\033[1m'; ROUGE=$'\033[31m'; VERT=$'\033[32m'; JAUNE=$'\033[33m'; RAZ=$'\033[0m'
else GRAS=''; ROUGE=''; VERT=''; JAUNE=''; RAZ=''; fi
ok()     { echo "  ${VERT}OK${RAZ}    $*"; }
manque() { echo "  ${ROUGE}MANQUE${RAZ} $*"; MANQUANTS=$((MANQUANTS+1)); }
note()   { echo "  ${JAUNE}!${RAZ}     $*"; }
MANQUANTS=0

VERSION=$(node -p "require('./package.json').version")
echo
echo "${GRAS}=== Depot en $VERSION ===${RAZ}"

echo
echo "${GRAS}iOS${RAZ}"
V_IOS=$(grep -m1 "MARKETING_VERSION" ios/App/App.xcodeproj/project.pbxproj | grep -oE "[0-9]+\.[0-9]+\.[0-9]+")
[[ "$V_IOS" == "$VERSION" ]] && ok "version $V_IOS" || manque "version $V_IOS — lancer npx cap sync"

# La base embarquee : un binaire qui interroge la base de test ferait tester
# des donnees fictives a l'evaluateur.
B=$(grep -oh "xgwrxbkrfypklrnqbftv\|cvyslqnojcgnjfgynczw" ios/App/App/public/assets/*.js 2>/dev/null | sort -u | head -1)
case "$B" in
  xgwrxbkrfypklrnqbftv) ok "vise bot-ops (production)" ;;
  cvyslqnojcgnjfgynczw) manque "vise bot3 — cp .env.ops .env && npm run build && npx cap sync" ;;
  *) manque "aucune base detectee — lancer npx cap sync" ;;
esac

grep -q "NSCameraUsageDescription" ios/App/App/Info.plist \
  && ok "permission camera declaree" || manque "NSCameraUsageDescription absent — le scanner ne marchera pas"
grep -q "ITSAppUsesNonExemptEncryption" ios/App/App/Info.plist \
  && ok "declaration de chiffrement" || note "ITSAppUsesNonExemptEncryption absent — question a chaque envoi"

# Le cas le plus reconnaissable du rejet 4.2 : charger une URL distante.
grep -qE "^\s*server:\s*\{" capacitor.config.ts \
  && manque "server.url ACTIF — rejet 4.2 assure" || ok "server.url commente"

I=ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png
if [[ -f "$I" ]]; then
  python3 - "$I" <<'PY' 2>/dev/null || echo "  icone illisible"
import struct, sys
d = open(sys.argv[1], 'rb').read(33)
w, h = struct.unpack('>II', d[16:24])
alpha = d[25] in (4, 6)
if w == h == 1024 and not alpha: print("  \033[32mOK\033[0m    icone 1024x1024, sans transparence")
elif alpha: print("  \033[31mMANQUE\033[0m icone avec canal alpha — Apple refuse")
else: print(f"  \033[31mMANQUE\033[0m icone {w}x{h}, il faut 1024x1024")
PY
else manque "icone 1024 absente"; fi

echo
echo "${GRAS}Android${RAZ}"
V_AND=$(grep "versionName" android/app/build.gradle | grep -oE "[0-9]+\.[0-9]+\.[0-9]+")
[[ "$V_AND" == "$VERSION" ]] && ok "version $V_AND" || manque "version $V_AND"

B=$(grep -oh "xgwrxbkrfypklrnqbftv\|cvyslqnojcgnjfgynczw" android/app/src/main/assets/public/assets/*.js 2>/dev/null | sort -u | head -1)
[[ "$B" == "xgwrxbkrfypklrnqbftv" ]] && ok "vise bot-ops (production)" || manque "ne vise pas la production"

grep -q "android.permission.CAMERA" android/app/src/main/AndroidManifest.xml \
  && ok "permission camera" || manque "permission CAMERA absente"

# Sans cle de signature, aucun envoi possible. Et elle ne se remplace pas.
grep -q "signingConfigs" android/app/build.gradle \
  && ok "signature configuree" \
  || manque "aucune cle de signature — voir docs/publier-app-store.md"

echo
echo "${GRAS}Contenu de la production${RAZ}"
# Une base vide fait rejeter pour « minimum functionality » : l'evaluateur
# ouvre un planning sans cours et n'a rien a tester.
if [[ -f .env.migration ]]; then
  set -a; source .env.migration 2>/dev/null; set +a
  R=$(PGPASSWORD="$CIBLE_PASSWORD" PGCONNECT_TIMEOUT=10 /opt/homebrew/opt/libpq/bin/psql \
      -h "db.$CIBLE_REF.supabase.co" -p 5432 -U postgres -d postgres -qAt -F: -c "
      SELECT (SELECT COUNT(*) FROM class_types) || ':' ||
             (SELECT COUNT(*) FROM pack_types WHERE is_active AND is_purchasable) || ':' ||
             (SELECT COUNT(*) FROM scheduled_classes WHERE starts_at > NOW()) || ':' ||
             (SELECT COUNT(*) FROM user_roles WHERE role = 'coach');" 2>/dev/null)
  if [[ -n "$R" ]]; then
    IFS=: read -r NC NP NS NCO <<< "$R"
    [[ "$NC" -gt 0 ]] && ok "$NC type(s) de cours"        || manque "aucun type de cours"
    [[ "$NP" -gt 0 ]] && ok "$NP pack(s) vendable(s)"     || manque "aucun pack en vente"
    [[ "$NS" -gt 0 ]] && ok "$NS cours a venir"           || manque "planning vide — rejet « minimum functionality »"
    [[ "$NCO" -gt 0 ]] && ok "$NCO coach(s)"              || manque "aucun coach — l'evaluateur ne verra pas le scanner"
  else note "bot-ops injoignable — controle du contenu impossible"; fi
else note ".env.migration absent — controle du contenu impossible"; fi

echo
if [[ "$MANQUANTS" -eq 0 ]]; then
  echo "  ${VERT}${GRAS}Rien ne manque.${RAZ} Reste le compte de demonstration et la fiche."
else
  echo "  ${ROUGE}${GRAS}$MANQUANTS point(s) a regler avant de soumettre.${RAZ}"
fi
echo

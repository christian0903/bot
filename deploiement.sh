#!/usr/bin/env bash
# ============================================================================
# Prepare `dist/` pour un sous-domaine, et rien d'autre.
#
#   ./deploiement.sh jag     -> bot3, base de test, sur jag.backontrackstudio.be
#   ./deploiement.sh ops     -> bot-ops, production, sur app.backontrackstudio.be
#
# ---------------------------------------------------------------------------
# Pourquoi ce script existe
#
# `.env` n'est jamais deploye, mais Vite grave ses valeurs DANS les fichiers
# construits : l'URL de la base apparait dans onze fichiers de `dist/`, tous
# minifies. Un `dist` est donc deja lie a une base avant d'etre envoye, et le
# meme dossier ne peut pas servir les deux sous-domaines.
#
# Le geste est court — copier le bon `.env`, reconstruire — mais il s'oublie.
# Envoyer sur `app.` un build fait pour `jag.` ferait pointer la production
# vers la base de test, sans que rien ne le signale : meme apparence, memes
# ecrans, donnees fantomes.
#
# Ce script enchaine la bascule, la construction et le CONTROLE. C'est le
# controle qui compte : il refuse de rendre la main si `dist/` porte une trace
# de la mauvaise base.
# ============================================================================
set -euo pipefail

RACINE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$RACINE"

if [[ -t 1 ]]; then
  GRAS=$'\033[1m'; ROUGE=$'\033[31m'; VERT=$'\033[32m'
  JAUNE=$'\033[33m'; RAZ=$'\033[0m'
else
  GRAS=''; ROUGE=''; VERT=''; JAUNE=''; RAZ=''
fi
ok()     { echo "  ${VERT}OK${RAZ}    $*"; }
info()   { echo "        $*"; }
alerte() { echo "  ${JAUNE}!${RAZ}     $*"; }
echec()  { echo "  ${ROUGE}ECHEC${RAZ} $*" >&2; }

# Les references sont ecrites ici plutot que devinees : c'est ce qui permet au
# controle final d'affirmer quelque chose. Une base ajoutee un jour se declare
# sur ces trois lignes.
REF_JAG='cvyslqnojcgnjfgynczw'
REF_OPS='xgwrxbkrfypklrnqbftv'

CIBLE="${1:-}"
case "$CIBLE" in
  jag) FICHIER='.env.jag'; REF_ATTENDUE="$REF_JAG"; REF_INTERDITE="$REF_OPS"
       DOMAINE='jag.backontrackstudio.be'; ROLE='base de TEST' ;;
  ops) FICHIER='.env.ops'; REF_ATTENDUE="$REF_OPS"; REF_INTERDITE="$REF_JAG"
       DOMAINE='app.backontrackstudio.be'; ROLE='PRODUCTION' ;;
  *)
    echo
    echo "${GRAS}Usage :${RAZ} ./deploiement.sh [jag|ops]"
    echo
    echo "  jag   base de test    -> jag.backontrackstudio.be"
    echo "  ops   PRODUCTION      -> app.backontrackstudio.be"
    echo
    exit 1 ;;
esac

echo
echo "${GRAS}=== Preparation pour $DOMAINE — $ROLE ===${RAZ}"
echo

# ── 1. Le fichier de configuration existe et est complet ────────────────────
[[ -f "$FICHIER" ]] || { echec "$FICHIER introuvable."; exit 1; }

REF_FICHIER="$(grep '^VITE_SUPABASE_URL=' "$FICHIER" | grep -oE '[a-z]{20}' || true)"
if [[ "$REF_FICHIER" != "$REF_ATTENDUE" ]]; then
  echec "$FICHIER ne vise pas la base attendue."
  info "  attendu : $REF_ATTENDUE"
  info "  trouve  : ${REF_FICHIER:-aucune}"
  exit 1
fi

# Une cle absente produit un build qui se charge et refuse toute donnee : le
# defaut ne se voit qu'a l'ecran, sur une page vide.
grep -q '^VITE_SUPABASE_PUBLISHABLE_KEY=.\+' "$FICHIER" \
  || { echec "$FICHIER n'a pas de cle publishable."; exit 1; }

ok "$FICHIER vise bien $REF_ATTENDUE"

# ── 2. Bascule et construction ──────────────────────────────────────────────
cp "$FICHIER" .env
ok "$FICHIER copie en .env"

info "construction..."
npm run build > /tmp/build-$$.log 2>&1 || {
  echec "le build a echoue :"
  tail -20 /tmp/build-$$.log >&2
  rm -f /tmp/build-$$.log
  exit 1
}
rm -f /tmp/build-$$.log
ok "build termine"

# ── 3. Le controle qui justifie ce script ───────────────────────────────────
# Compter les deux references separement : une seule doit apparaitre. Un build
# qui porterait les deux signalerait un cache mal vide.
# `|| true` : sans lui, un grep sans correspondance renvoie 1 et `set -e`
# interrompt le script AVANT le message d'erreur — on ne saurait rien de ce
# qui cloche. C'est le compte qui doit parler, pas le code de sortie de grep.
N_ATTENDUE=$(grep -oh "$REF_ATTENDUE" dist/assets/*.js 2>/dev/null | wc -l | tr -d ' ' || true)
N_INTERDITE=$(grep -oh "$REF_INTERDITE" dist/assets/*.js 2>/dev/null | wc -l | tr -d ' ' || true)
N_ATTENDUE=${N_ATTENDUE:-0}
N_INTERDITE=${N_INTERDITE:-0}

if [[ "$N_INTERDITE" != "0" ]]; then
  echec "dist/ porte $N_INTERDITE reference(s) a la MAUVAISE base."
  info "NE PAS ENVOYER. Relancer ce script."
  exit 1
fi
if [[ "$N_ATTENDUE" == "0" ]]; then
  echec "dist/ ne porte AUCUNE reference a $REF_ATTENDUE."
  info "Le build n'a pas pris le bon .env — ne pas envoyer."
  exit 1
fi
ok "dist/ vise $REF_ATTENDUE, et elle seule ($N_ATTENDUE references)"

VERSION=$(node -p "require('./package.json').version")
VERSION_SW=$(grep -oE "APP_VERSION = '[0-9.]+'" dist/sw.js | grep -oE "[0-9.]+" || echo '?')
if [[ "$VERSION" == "$VERSION_SW" ]]; then
  ok "version $VERSION"
else
  alerte "version du depot $VERSION, du build $VERSION_SW"
fi

# Le bandeau d'avertissement se decide sur VITE_BASE : toute valeur autre que
# `ops` l'affiche. Le controler evite de mettre en ligne une production qui
# s'annonce comme un environnement de test — ou l'inverse, plus grave.
BASE=$(grep '^VITE_BASE=' "$FICHIER" | cut -d= -f2)
if [[ "$CIBLE" == "ops" && "$BASE" != "ops" ]]; then
  alerte "VITE_BASE=$BASE : le bandeau « base de test » s'affichera en PRODUCTION"
elif [[ "$CIBLE" == "jag" && "$BASE" == "ops" ]]; then
  echec "VITE_BASE=ops sur la base de test : aucun bandeau n'avertira."
  exit 1
else
  ok "bandeau : $([[ "$BASE" == "ops" ]] && echo 'aucun (production)' || echo "affiche ($BASE)")"
fi

# ── 4. Ce qu'il reste a faire ───────────────────────────────────────────────
echo
echo "${GRAS}=== Pret pour $DOMAINE ===${RAZ}"
echo
info "Envoyer le contenu de ${GRAS}dist/${RAZ} dans le dossier ${GRAS}$DOMAINE${RAZ}"
info "(Transmit, ou tout autre client de transfert)"
echo
info "Apres l'envoi, controler :"
info "  curl -s https://$DOMAINE/sw.js | sed -n '3p'"
info "  -> doit afficher : const APP_VERSION = '$VERSION'"
echo
if [[ "$CIBLE" == "ops" ]]; then
  alerte "C'est la PRODUCTION. Verifier a l'ecran qu'aucun bandeau orange ne s'affiche."
  echo
fi

# `.env` reste sur la derniere cible construite. Le dire evite qu'un
# `npm run build` lance a la main plus tard produise un dist pour la mauvaise
# base sans que personne ne s'en apercoive.
info "${GRAS}.env pointe maintenant sur $CIBLE.${RAZ} Relancer ce script pour changer."
echo

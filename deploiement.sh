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

# o2switch. La cle `~/.ssh/o2switch` est sans phrase de passe : c'est ce qui
# permet a rsync de tourner sans rien demander. L'ancienne (`bot_o2switch`)
# en avait une, oubliee — le serveur acceptait la cle et refusait quand meme.
SERVEUR='vach5679@109.234.165.117'
CLE_SSH="$HOME/.ssh/o2switch"

CIBLE="${1:-}"
case "$CIBLE" in
  jag) FICHIER='.env.jag'; REF_ATTENDUE="$REF_JAG"; REF_INTERDITE="$REF_OPS"
       DOMAINE='jag.backontrackstudio.be'; ROLE='base de TEST' ;;
  ops) FICHIER='.env.ops'; REF_ATTENDUE="$REF_OPS"; REF_INTERDITE="$REF_JAG"
       DOMAINE='app.backontrackstudio.be'; ROLE='PRODUCTION' ;;
  # La vitrine lit la base de production — le planning et les tarifs qu'elle
  # affiche sont les vrais. Elle n'ecrit rien.
  #
  # Tant que les coachs n'ont pas tranche, elle se deploie sur `site.` et le
  # WordPress reste en place sur le domaine principal. Le jour de la bascule,
  # une seule ligne change : DOMAINE devient 'backontrackstudio.be'.
  site) FICHIER='.env.site'; REF_ATTENDUE="$REF_OPS"; REF_INTERDITE="$REF_JAG"
       DOMAINE='site.backontrackstudio.be'; ROLE='vitrine (demonstration)' ;;
  # Le domaine principal, en remplacement du WordPress. Difference avec `site` :
  # l'indexation est OUVERTE (VITE_VITRINE_PUBLIQUE=oui), et le `.htaccess` du
  # serveur porte les redirections 301 des anciennes URL.
  prod-site) FICHIER='.env.prod-site'; REF_ATTENDUE="$REF_OPS"; REF_INTERDITE="$REF_JAG"
       DOMAINE='backontrackstudio.be'; ROLE='VITRINE PUBLIQUE' ;;
  *)
    echo
    echo "${GRAS}Usage :${RAZ} ./deploiement.sh [jag|ops|site|prod-site]"
    echo
    echo "  jag   base de test    -> jag.backontrackstudio.be"
    echo "  ops   PRODUCTION      -> app.backontrackstudio.be"
    echo "  site  vitrine (demo)  -> site.backontrackstudio.be"
    echo "  prod-site  VITRINE    -> backontrackstudio.be"
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
if [[ "$CIBLE" == "site" || "$CIBLE" == "prod-site" ]]; then
  # La vitrine n'a pas de bandeau : il vit dans le layout de l'application, et
  # la vitrine a le sien. En revanche, c'est `VITE_VITRINE` qui decide de ce que
  # sert la racine — sans lui, `site.` afficherait l'application. Le controler
  # ici evite de mettre en ligne une vitrine qui n'en est pas une.
  if [[ "$(grep '^VITE_VITRINE=' "$FICHIER" | cut -d= -f2)" != "oui" ]]; then
    echec "VITE_VITRINE n'est pas a 'oui' dans $FICHIER."
    info "Sans lui, $DOMAINE servirait l'application au lieu de la vitrine."
    exit 1
  fi
  if ! grep -q 'VITE_VITRINE' dist/assets/*.js 2>/dev/null && \
     ! grep -qi 'v-entete\|v-titre-section' dist/assets/*.css 2>/dev/null; then
    echec "dist/ ne porte aucune trace de la vitrine."
    info "Le build n'a pas pris .env.site — ne pas envoyer."
    exit 1
  fi
  ok "vitrine : la racine sert le site public"
elif [[ "$CIBLE" == "ops" && "$BASE" != "ops" ]]; then
  alerte "VITE_BASE=$BASE : le bandeau « base de test » s'affichera en PRODUCTION"
elif [[ "$CIBLE" == "jag" && "$BASE" == "ops" ]]; then
  echec "VITE_BASE=ops sur la base de test : aucun bandeau n'avertira."
  exit 1
else
  ok "bandeau : $([[ "$BASE" == "ops" ]] && echo 'aucun (production)' || echo "affiche ($BASE)")"
fi

# ── 4. Ce qu'il reste a faire ───────────────────────────────────────────────
# ── 4. Envoi ────────────────────────────────────────────────────────────────
echo
if [[ ! -f "$CLE_SSH" ]]; then
  alerte "Cle SSH introuvable ($CLE_SSH) — envoi manuel."
  info "Deposer le contenu de dist/ dans le dossier $DOMAINE"
  exit 0
fi

# Un dernier mot avant d'ecrire sur la production. `--delete` efface sur le
# serveur ce qui n'est pas dans dist/ : c'est voulu pour un site construit,
# mais le dossier vise doit etre le bon.
if [[ "$CIBLE" == "ops" || "$CIBLE" == "prod-site" ]]; then
  echo "  ${ROUGE}${GRAS}Cible : PRODUCTION ($DOMAINE)${RAZ}"
  read -rp "  taper OUI pour envoyer : " REPONSE
  [[ "$REPONSE" == "OUI" ]] || { info "envoi annule — dist/ reste pret."; exit 0; }
fi

# ── L'ENVOI SE FAIT EN DEUX TEMPS, ET L'ORDRE EST TOUT ──────────────────────
#
# En un seul rsync, `index.html` pouvait etre remplace AVANT que les fichiers
# `assets/` qu'il nomme soient arrives. Un client qui chargeait la page a cet
# instant recevait un index.html neuf pointant vers des bundles absents : 404,
# aucune erreur affichee, ECRAN BLANC.
#
# Pire, le service worker mettait cette page cassee en cache. Le membre restait
# alors bloque bien apres la fin du deploiement, et vider l'historique n'y
# changeait rien — l'historique ne touche pas au Cache Storage. Un client l'a
# signale le 31 aout : « c'est comme si le lien etait valide jusqu'au moment ou
# il y a un bug ».
#
# 1. `assets/` D'ABORD, SANS --delete. Les anciens bundles restent en place :
#    pendant tout le transfert, l'ancien index.html continue de trouver les
#    siens, et l'application ne cesse jamais de fonctionner.
# 2. LE RESTE ENSUITE, index.html compris. Quand il bascule, les nouveaux
#    bundles sont deja tous la.
#
# Il n'existe donc plus d'instant ou la page est cassee — sans page de
# maintenance, et sans une seconde d'indisponibilite.

info "envoi vers $DOMAINE — 1/2 : les fichiers construits..."

# Pas de `--delete` ici : c'est le coeur du dispositif. Les anciens bundles
# survivent au deploiement, et un navigateur qui garde un vieil index.html en
# cache trouve encore ce qu'il demande. La purge se fait plus bas, une fois la
# bascule faite.
if rsync -az \
     -e "ssh -i $CLE_SSH -o StrictHostKeyChecking=accept-new" \
     dist/assets/ "$SERVEUR:~/$DOMAINE/assets/" > /tmp/rsync-$$.log 2>&1; then
  ok "fichiers construits en place"
else
  echec "l'envoi des fichiers construits a echoue :"
  tail -12 /tmp/rsync-$$.log >&2
  rm -f /tmp/rsync-$$.log
  exit 1
fi

info "envoi vers $DOMAINE — 2/2 : la page et les ressources..."

# `--exclude` protege ce qui vit sur le serveur et n'a pas d'equivalent local :
# la configuration Apache, les certificats, les scripts CGI. Sans eux,
# `--delete` les emporterait.
#
# `--exclude=assets` : ce dossier vient d'etre envoye, et surtout `--delete`
# effacerait ici les anciens bundles qu'on veut justement conserver.
if rsync -avz --delete \
     --exclude=cgi-bin --exclude=.htaccess --exclude=.well-known \
     --exclude=assets \
     -e "ssh -i $CLE_SSH -o StrictHostKeyChecking=accept-new" \
     dist/ "$SERVEUR:~/$DOMAINE/" >> /tmp/rsync-$$.log 2>&1; then
  ok "envoi termine"
else
  echec "l'envoi a echoue :"
  tail -12 /tmp/rsync-$$.log >&2
  rm -f /tmp/rsync-$$.log
  exit 1
fi
rm -f /tmp/rsync-$$.log

# ── Purge differee des vieux fichiers construits ────────────────────────────
# Conserver les anciens bundles indefiniment finirait par peser. Sept jours
# suffisent largement : au-dela, un navigateur qui garde encore un index.html
# de la semaine passee a de toute facon recu la proposition de mise a jour.
#
# `-mtime +7` porte sur la date du FICHIER SUR LE SERVEUR, que rsync met a jour
# a chaque envoi : un bundle inchange d'un deploiement a l'autre n'est donc
# jamais considere comme vieux.
ssh -i "$CLE_SSH" -o StrictHostKeyChecking=accept-new "$SERVEUR" \
  "find ~/$DOMAINE/assets -type f -mtime +7 -delete 2>/dev/null" 2>/dev/null \
  && ok "anciens fichiers construits purges (plus de 7 jours)" \
  || alerte "purge des anciens fichiers non effectuee (sans gravite)"

# ── 5. Controle sur le site en ligne ────────────────────────────────────────
# Ce que le serveur sert reellement, et non ce qu'on croit lui avoir envoye.
sleep 2
VERSION_LIGNE=$(curl -s --max-time 15 "https://$DOMAINE/sw.js" 2>/dev/null | grep -oE "APP_VERSION = '[0-9.]+'" | grep -oE "[0-9.]+" || echo '')
# La reference de la base, lue dans les fichiers SERVIS. C'est le seul controle
# qui prouve que le bon build est arrive au bon endroit : la version seule ne
# distingue pas deux dist construits le meme jour pour des bases differentes.
REF_LIGNE=$(curl -s --max-time 20 "https://$DOMAINE/" 2>/dev/null | grep -oE 'assets/index-[A-Za-z0-9_-]+\.js' | head -1)
if [[ -n "$REF_LIGNE" ]]; then
  if curl -s --max-time 25 "https://$DOMAINE/$REF_LIGNE" 2>/dev/null | grep -q "$REF_INTERDITE"; then
    echec "$DOMAINE sert un build qui vise la MAUVAISE base."
    info "Renvoyer immediatement : ./deploiement.sh $CIBLE"
    exit 1
  fi
  ok "$DOMAINE vise bien $REF_ATTENDUE"
fi

if [[ "$VERSION_LIGNE" == "$VERSION" ]]; then
  ok "$DOMAINE sert bien la version $VERSION"
else
  alerte "le site annonce « ${VERSION_LIGNE:-rien} » et non $VERSION"
  info "Le cache du serveur met parfois une minute. Recontroler :"
  info "  curl -s https://$DOMAINE/sw.js | sed -n '3p'"
fi

echo
echo "${GRAS}=== $DOMAINE est a jour ===${RAZ}"
echo
if [[ "$CIBLE" == "ops" ]]; then
  alerte "C'est la PRODUCTION. Verifier a l'ecran qu'aucun bandeau orange ne s'affiche."
  echo
fi
info "Un navigateur qui a deja visite le site peut servir l'ancienne version :"
info "le service worker garde son cache. Forcer avec Cmd+Shift+R."
echo

# `.env` reste sur la derniere cible construite. Le dire evite qu'un
# `npm run build` lance a la main plus tard produise un dist pour la mauvaise
# base sans que personne ne s'en apercoive.
info "${GRAS}.env pointe maintenant sur $CIBLE.${RAZ} Relancer ce script pour changer."
echo

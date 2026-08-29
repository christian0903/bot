#!/usr/bin/env bash
# ============================================================================
# ETAPE 1 — Cree l'espace applicatif complet sur un projet Supabase NEUF.
#
#   ./scripts/creer-espace-application.sh
#
# Produit une base VIDE mais entierement operationnelle : schema, droits,
# Storage, Edge Functions, secrets. A l'issue, l'application tourne — il n'y a
# simplement aucune donnee dedans.
#
# ---------------------------------------------------------------------------
# Pourquoi ce script existe
#
# `install.sql` s'arrete au SQL. Tout ce qui vit A COTE de la base — les dix
# Edge Functions, leurs secrets, les reglages Auth, le webhook Stripe — ne
# voyage avec aucun dump et se refait a chaque nouvelle base. Cet eparpillement
# est ce qui rate un demenagement : le SQL passe, et l'application ne marche
# pas pour une raison qu'aucun compteur ne montre.
#
# Ce script rassemble tout ce qui s'automatise, et refuse de laisser croire
# que le reste est fait : les points manuels s'affichent en fin de course, un
# par un, et demandent confirmation.
#
# ---------------------------------------------------------------------------
# Ce qu'il ne fait pas, et pourquoi
#
#   * les reglages Authentication  — vivent dans le dashboard, pas en SQL, et
#     `supabase/config.toml` est absent du depot ;
#   * le webhook cote Stripe       — vit chez Stripe, pointe sur l'URL du
#     projet et produit un `whsec_` qu'on ne connait qu'apres l'avoir cree.
#
# Configuration : `.env.migration` (voir `.env.migration.example`). Ce qui y
# manque est demande a la saisie.
# ============================================================================
set -euo pipefail

PG_BIN="/opt/homebrew/opt/libpq/bin"
RACINE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CONF="$RACINE/.env.migration"

# Sans cela, psql attend deux minutes avant d'admettre qu'un hote ne repond
# pas — assez pour croire a un blocage plutot qu'a une adresse fautive.
export PGCONNECT_TIMEOUT="${PGCONNECT_TIMEOUT:-10}"

# ── Mise en forme ───────────────────────────────────────────────────────────
if [[ -t 1 ]]; then
  GRAS=$'\033[1m'; ROUGE=$'\033[31m'; VERT=$'\033[32m'
  JAUNE=$'\033[33m'; RAZ=$'\033[0m'
else
  GRAS=''; ROUGE=''; VERT=''; JAUNE=''; RAZ=''
fi
titre()   { echo; echo "${GRAS}=== $* ===${RAZ}"; }
ok()      { echo "  ${VERT}OK${RAZ}   $*"; }
info()    { echo "       $*"; }
alerte()  { echo "  ${JAUNE}!${RAZ}    $*"; }
echec()   { echo "  ${ROUGE}ECHEC${RAZ} $*" >&2; }

# `set -e` seul laisse le script mourir sans un mot sur l'endroit. Une base a
# moitie installee qui parait installee est precisement ce qu'on veut eviter.
trap 'echec "interruption ligne $LINENO — la base est dans un etat INCOMPLET."' ERR

# ── Configuration ───────────────────────────────────────────────────────────
# `set -a` exporte tout ce que le fichier definit. Il est lu avant toute
# question : ce qui est rempli ne sera pas redemande.
if [[ -f "$CONF" ]]; then
  set -a; source "$CONF"; set +a
  ok "configuration lue depuis .env.migration"
else
  alerte "pas de .env.migration — tout sera demande a la saisie"
  info "cp .env.migration.example .env.migration"
fi

demander() {           # demander VARIABLE "question"
  local var="$1" question="$2"
  if [[ -z "${!var:-}" ]]; then
    read -rp "  $question : " "$var"
    export "$var"
  fi
}
demander_secret() {    # idem, sans echo a l'ecran
  local var="$1" question="$2"
  if [[ -z "${!var:-}" ]]; then
    read -rsp "  $question : " "$var"; echo
    export "$var"
  fi
}

titre "Espace applicatif — creation"
demander CIBLE_REF "Reference du projet Supabase neuf"
demander_secret CIBLE_PASSWORD "Mot de passe postgres de $CIBLE_REF"

HOTE="db.$CIBLE_REF.supabase.co"
export PGPASSWORD="$CIBLE_PASSWORD"

# Toutes les requetes de controle passent par la : -q silencieux, -A sans
# alignement, -t sans en-tete — la sortie est directement exploitable.
sql() { "$PG_BIN/psql" -h "$HOTE" -p 5432 -U postgres -d postgres -qAt -v ON_ERROR_STOP=1 -c "$1"; }

# ── 1. La base repond, et elle est vide ─────────────────────────────────────
titre "1/7  Controles prealables"

if ! sql "SELECT 1" > /dev/null 2>&1; then
  echec "$HOTE ne repond pas."
  info "Verifier la reference et le mot de passe. Une base tout juste creee"
  info "met une minute a accepter les connexions."
  exit 1
fi
ok "connexion a $CIBLE_REF"

# Installer par-dessus une base habitee melangerait deux etats sans le dire.
# install.sql commence par des DROP : le refus n'est pas de la prudence, il
# evite une destruction silencieuse.
NB_TABLES="$(sql "SELECT COUNT(*) FROM pg_class WHERE relnamespace='public'::regnamespace AND relkind='r'")"
if [[ "$NB_TABLES" -gt 0 ]]; then
  echec "la base porte deja $NB_TABLES table(s) — ce script exige une base VIERGE."
  info "install.sql commence par des DROP : l'executer ici detruirait ce qui existe."
  info "Pour ne remettre que les donnees a zero : supabase/reset-test-data.sql"
  exit 1
fi
ok "base vierge (aucune table)"

command -v npx > /dev/null || { echec "npx introuvable — necessaire aux Edge Functions."; exit 1; }
[[ -x "$PG_BIN/psql" ]]    || { echec "psql introuvable dans $PG_BIN (brew install libpq)."; exit 1; }
ok "outils presents"

# ── 2. Le schema ────────────────────────────────────────────────────────────
titre "2/7  Installation du schema"
info "install.sql — 5000 lignes, compter une minute"

# ON_ERROR_STOP=1 n'est pas facultatif : sans lui psql continue apres une
# erreur et produit une base incomplete qui PARAIT installee.
#
# Les NOTICE « trigger does not exist, skipping » sont normaux sur une base
# vierge — ce sont les DROP ... IF EXISTS qui ne trouvent rien.
if ! "$PG_BIN/psql" -h "$HOTE" -p 5432 -U postgres -d postgres \
       -v ON_ERROR_STOP=1 -q -f "$RACINE/supabase/install.sql" 2>&1 \
       | grep -v "^NOTICE:" | grep -v "^$" | head -20; then
  echec "install.sql a echoue"
  exit 1
fi
ok "schema installe"

# ── 3. Controle objet par objet ─────────────────────────────────────────────
titre "3/7  Controle du schema"

# Un compteur ne prouve pas qu'une base est juste, mais un compteur faux prouve
# qu'elle ne l'est pas. Reperes releves sur `bot` au 2026-08-28.
controler() {          # controler "libelle" requete attendu
  local libelle="$1" requete="$2" attendu="$3" obtenu
  obtenu="$(sql "$requete")"
  if [[ "$obtenu" == "$attendu" ]]; then
    ok "$libelle : $obtenu"
  else
    alerte "$libelle : $obtenu (attendu $attendu)"
    ECART=1
  fi
}
ECART=0
# Reperes releves sur install.sql au 2026-08-29, verifies objet par objet.
# Les fonctions se comptent en DECLARATIONS : get_available_credits en a deux
# (surcharge a 2 et 3 arguments), toutes deux voulues.
controler "tables   " "SELECT COUNT(*) FROM pg_class WHERE relnamespace='public'::regnamespace AND relkind='r'" 27
controler "policies " "SELECT COUNT(*) FROM pg_policies WHERE schemaname='public'" 89
controler "fonctions" "SELECT COUNT(*) FROM pg_proc WHERE pronamespace='public'::regnamespace" 80
controler "triggers " "SELECT COUNT(*) FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid WHERE NOT t.tgisinternal AND c.relnamespace='public'::regnamespace" 14

# Une table sans GRANT se lit « permission denied » a l'ecran, mais aucun
# compteur d'objets ne la signale : l'application se charge, la connexion
# reussit, et tout ecran reste vide (incident du 2026-08-27).
SANS_DROITS="$(sql "
  SELECT COUNT(*) FROM pg_class c
  WHERE c.relnamespace='public'::regnamespace AND c.relkind='r'
    AND NOT has_table_privilege('authenticated', c.oid, 'SELECT')")"
if [[ "$SANS_DROITS" == "0" ]]; then
  ok "droits    : les 27 tables lisibles par authenticated"
else
  alerte "droits    : $SANS_DROITS table(s) sans SELECT pour authenticated"
  ECART=1
fi

info ""
info "check-policies.sql :"
"$PG_BIN/psql" -h "$HOTE" -p 5432 -U postgres -d postgres -q \
  -f "$RACINE/supabase/check-policies.sql" 2>&1 | sed 's/^/       /'
info "(seules les six lignes sur `performances` sont attendues)"

if [[ "$ECART" != "0" ]]; then
  echo
  alerte "Des compteurs s'ecartent des reperes. Poursuivre quand meme ?"
  read -rp "  taper OUI pour continuer : " REPONSE
  [[ "$REPONSE" == "OUI" ]] || { echec "interrompu."; exit 1; }
fi

# ── 4. Storage ──────────────────────────────────────────────────────────────
titre "4/7  Bucket Storage"

# install.sql pose le bucket ET ses quatre policies (section 8b, l. 4733) —
# contrairement a ce qu'affirment encore guide-installation.md et
# strategie-base-neuve.md, qui demandent de le creer a la main.
#
# Une seule chose manque a son INSERT : `file_size_limit`. Sans elle le bucket
# accepte des fichiers de n'importe quelle taille. C'est le seul geste utile
# ici, le reste n'est qu'un controle.
if [[ "$(sql "SELECT COUNT(*) FROM storage.buckets WHERE id='avatars'")" == "1" ]]; then
  ok "bucket 'avatars' present"
  sql "UPDATE storage.buckets SET public=true, file_size_limit=5242880 WHERE id='avatars'" > /dev/null
  ok "public, 5 Mo"
else
  alerte "bucket 'avatars' absent — a creer a la main"
  info "Dashboard > Storage > New bucket > 'avatars', Public, 5 MB"
fi

# ── 5. Edge Functions ───────────────────────────────────────────────────────
titre "5/7  Edge Functions"
info "liaison au projet $CIBLE_REF"
npx supabase link --project-ref "$CIBLE_REF" > /dev/null 2>&1 || {
  echec "npx supabase link a echoue — se connecter d'abord : npx supabase login"
  exit 1
}
ok "projet lie"

# stripe-webhook est appele par Stripe, qui ne porte aucun JWT Supabase : sans
# --no-verify-jwt la plateforme rejette l'appel avant meme d'entrer dans la
# fonction. Elle verifie elle-meme la signature `stripe-signature`, ce qui est
# le controle qui compte ici.
#
# Le drapeau se redemande A CHAQUE deploiement. L'oublier coupe les
# encaissements sans aucun signal visible — regle n. 4 du depot.
FONCTIONS_JWT=(
  admin-update-email admin-update-password cancel-my-subscription
  create-checkout-session create-user manage-subscription
  process-email-queue send-email send-notification
)
for f in "${FONCTIONS_JWT[@]}"; do
  printf "       %-26s" "$f"
  if npx supabase functions deploy "$f" --project-ref "$CIBLE_REF" > /dev/null 2>&1; then
    echo "${VERT}deployee${RAZ}"
  else
    echo "${ROUGE}ECHEC${RAZ}"; ECHEC_FN=1
  fi
done

printf "       %-26s" "stripe-webhook"
if npx supabase functions deploy stripe-webhook --project-ref "$CIBLE_REF" --no-verify-jwt > /dev/null 2>&1; then
  echo "${VERT}deployee${RAZ} (--no-verify-jwt)"
else
  echo "${ROUGE}ECHEC${RAZ}"; ECHEC_FN=1
fi

# Le drapeau se controle, il ne se suppose pas : c'est le seul moyen de savoir
# qu'il a effectivement pris.
info ""
info "Controle du drapeau JWT :"
if npx supabase functions list --project-ref "$CIBLE_REF" 2>/dev/null \
     | grep -i "stripe-webhook" | grep -qi "false"; then
  ok "stripe-webhook : VERIFY JWT = false"
else
  alerte "stripe-webhook : drapeau JWT NON confirme — a verifier a la main"
  info "npx supabase functions list --project-ref $CIBLE_REF"
fi
[[ "${ECHEC_FN:-0}" == "0" ]] || alerte "des fonctions n'ont pas ete deployees (voir ci-dessus)"

# ── 6. Secrets ──────────────────────────────────────────────────────────────
titre "6/7  Secrets des Edge Functions"

# SUPABASE_URL, SUPABASE_ANON_KEY et SUPABASE_SERVICE_ROLE_KEY sont fournis
# par la plateforme a chaque fonction : les poser ici est inutile, et Supabase
# refuse d'ailleurs les noms prefixes SUPABASE_.
#
# Les quatre valeurs Stripe coexistent sans se gener : le choix entre test et
# live se fait en base, sur app_settings.stripe_mode, pas sur la presence d'un
# secret. install.sql amorce ce reglage a « test » — c'est le bon defaut pour
# une base neuve, a basculer explicitement le jour de la vraie production.
SECRETS=(
  RESEND_API_KEY EMAIL_FROM EMAIL_REPLY_TO APP_URL
  STRIPE_SECRET_KEY_TEST STRIPE_WEBHOOK_SECRET_TEST
  STRIPE_SECRET_KEY_LIVE STRIPE_WEBHOOK_SECRET_LIVE
)
A_POSER=()
for s in "${SECRETS[@]}"; do
  [[ -n "${!s:-}" ]] && A_POSER+=("$s=${!s}") || alerte "$s absent — non pose"
done

if [[ ${#A_POSER[@]} -gt 0 ]]; then
  # Les valeurs passent par l'argument de la commande : elles n'apparaissent
  # ni dans un fichier temporaire, ni dans l'historique du shell (le script
  # n'est pas interactif).
  if npx supabase secrets set --project-ref "$CIBLE_REF" "${A_POSER[@]}" > /dev/null 2>&1; then
    ok "${#A_POSER[@]} secret(s) pose(s)"
    for s in "${A_POSER[@]}"; do info "  ${s%%=*}"; done
  else
    echec "la pose des secrets a echoue"
  fi
else
  alerte "aucun secret a poser — les fonctions ne marcheront pas"
fi

# STRIPE_WEBHOOK_SECRET ne peut PAS etre connu maintenant : il nait avec
# l'endpoint, qu'on ne cree qu'une fois l'URL du projet connue. D'ou l'ordre
# impose — deployer, puis creer l'endpoint chez Stripe, puis revenir poser le
# secret. C'est la seule dependance circulaire de la procedure.
if [[ -z "${STRIPE_WEBHOOK_SECRET_TEST:-}" && -z "${STRIPE_WEBHOOK_SECRET_LIVE:-}" ]]; then
  info ""
  alerte "Aucun secret de webhook : normal a ce stade."
  info "Il nait avec l'endpoint Stripe, cree a l'etape manuelle ci-dessous."
  info "Y revenir ensuite : remplir .env.migration et relancer ce script,"
  info "ou npx supabase secrets set STRIPE_WEBHOOK_SECRET_TEST=whsec_..."
fi

# ── 7. Premier super_admin ──────────────────────────────────────────────────
titre "7/7  Premier super_admin"

# Depuis le 2026-08-06, `user_roles` n'a plus aucune policy d'ecriture et
# grant_user_role() exige d'etre deja admin. Le premier compte ne peut donc
# etre pose qu'en SQL : la regle ne sait pas s'appliquer a elle-meme.
demander SUPER_ADMIN_EMAIL "Adresse du premier super_admin (vide = plus tard)"

if [[ -n "${SUPER_ADMIN_EMAIL:-}" ]]; then
  if [[ "$(sql "SELECT COUNT(*) FROM auth.users WHERE email='$SUPER_ADMIN_EMAIL'")" == "1" ]]; then
    sql "INSERT INTO user_roles (user_id, role)
         SELECT id, 'super_admin' FROM auth.users WHERE email='$SUPER_ADMIN_EMAIL'
         ON CONFLICT DO NOTHING" > /dev/null
    ok "$SUPER_ADMIN_EMAIL promu super_admin"
  else
    alerte "aucun compte pour $SUPER_ADMIN_EMAIL"
    info "S'inscrire d'abord par l'application, puis relancer ce script,"
    info "ou jouer supabase/promouvoir-super-admin.sql"
  fi
else
  info "reporte — voir supabase/promouvoir-super-admin.sql"
fi

unset PGPASSWORD

# ── Ce qui reste a faire a la main ──────────────────────────────────────────
titre "Reste a faire dans les dashboards"
echo
echo "  Ces points ne s'automatisent pas : ils vivent dans les dashboards"
echo "  Supabase et Stripe, pas dans du SQL. Chacun demande confirmation —"
echo "  repondre non laisse la liste affichee pour y revenir."
echo

confirmer() {          # confirmer "titre" "detail..."
  echo "${GRAS}  $1${RAZ}"
  shift
  for ligne in "$@"; do echo "      $ligne"; done
  read -rp "      fait ? [o/N] " R
  if [[ "$R" =~ ^[oOyY]$ ]]; then echo "      ${VERT}confirme${RAZ}"; else
    echo "      ${JAUNE}EN ATTENTE${RAZ}"; RESTE+=("$1"); fi
  echo
}
RESTE=()

confirmer "Authentication" \
  "Dashboard > Authentication > Providers, puis URL Configuration" \
  "  - Email provider : active" \
  "  - Secure email change : OFF (l'app previent elle-meme l'ancienne adresse)" \
  "  - Minimum password length : 12" \
  "  - Site URL : ${APP_URL:-<URL de l application>}" \
  "  - Redirect URLs : ${APP_URL:-<URL>}/**  et  http://localhost:5173/**"

confirmer "Webhook Stripe" \
  "Stripe > Developers > Webhooks > Add endpoint" \
  "  - URL : https://$CIBLE_REF.supabase.co/functions/v1/stripe-webhook" \
  "  - Evenements : checkout.session.completed, customer.subscription.*," \
  "                 invoice.payment_succeeded, invoice.payment_failed" \
  "  - Relever le 'whsec_' et le poser en secret (voir ci-dessus)" \
  "  C'est ICI que rate un demenagement : un webhook oublie coupe les" \
  "  encaissements sans aucun signal visible."

confirmer "Fichiers du Storage" \
  "Le bucket est cree, mais il est VIDE." \
  "  Photos de cours et portraits de coachs :" \
  "  SOURCE_REF=... SOURCE_KEY=... CIBLE_REF=$CIBLE_REF CIBLE_KEY=... \\" \
  "    ./scripts/copier-storage.sh" \
  "  (inutile si cette base doit rester vide)"

confirmer "Fichier .env de l'application" \
  "VITE_SUPABASE_URL=https://$CIBLE_REF.supabase.co" \
  "VITE_SUPABASE_PUBLISHABLE_KEY=<cle publishable du projet>" \
  "VITE_APP_URL=${APP_URL:-<URL de l application>}" \
  "VITE_BASE=test          # 'ops' UNIQUEMENT pour la vraie production :" \
  "                        # toute autre valeur affiche le bandeau d'avertissement" \
  "VITE_BASE_LIBELLE=<nom de la base — region>"

titre "Etat final"
if [[ ${#RESTE[@]} -eq 0 ]]; then
  ok "espace applicatif complet sur $CIBLE_REF"
  echo
  info "La base est operationnelle et VIDE."
  info "Pour y charger des donnees : ./scripts/migrer-donnees.sh"
else
  alerte "${#RESTE[@]} point(s) en attente :"
  for r in "${RESTE[@]}"; do echo "         - $r"; done
  echo
  info "L'application ne tournera pas correctement tant qu'ils restent ouverts."
fi
echo

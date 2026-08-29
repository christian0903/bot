#!/usr/bin/env bash
# ============================================================================
# ETAPE 2 — Copie les donnees d'une base vers une autre, DEJA structuree.
#
#   ./scripts/migrer-donnees.sh
#
# Suppose que la cible a recu creer-espace-application.sh : ce script ne
# touche PAS au schema, il ne deplace que des donnees.
#
# ---------------------------------------------------------------------------
# Le principe : la cible doit etre VIDE
#
# Ce script ne vide jamais rien. Il refuse de tourner sur une base habitee.
#
# C'est la difference avec copier-bot-vers-bot2.sh, qui vidait la cible avant
# d'importer — utile pour une base de developpement qu'on recharge sans
# cesse, dangereux pour une base qu'on met en service. Ici la destruction
# n'est pas un prealable a l'import : c'est un geste separe, qui se decide.
#
# Pour repartir de zero sur une base de test : supabase/reset-test-data.sql,
# puis ce script.
#
# ---------------------------------------------------------------------------
# ⚠️ Donnees personnelles
#
# Le dump emporte les noms, e-mails, telephones, adresses et
# `medical_conditions` — des donnees de sante au sens de l'article 9 du RGPD.
# Tant que la source ne porte que des donnees de test, cela ne coute rien. Le
# jour ou elle portera de vrais membres, il faudra anonymiser a l'import.
#
# Configuration : `.env.migration` (voir `.env.migration.example`).
# ============================================================================
set -euo pipefail

PG_BIN="/opt/homebrew/opt/libpq/bin"
RACINE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CONF="$RACINE/.env.migration"
DUMP_DIR="$RACINE/.dumps"

# Sans cela, psql attend deux minutes avant d'admettre qu'un hote ne repond
# pas — assez pour croire a un blocage plutot qu'a une adresse fautive.
export PGCONNECT_TIMEOUT="${PGCONNECT_TIMEOUT:-10}"

if [[ -t 1 ]]; then
  GRAS=$'\033[1m'; ROUGE=$'\033[31m'; VERT=$'\033[32m'
  JAUNE=$'\033[33m'; RAZ=$'\033[0m'
else
  GRAS=''; ROUGE=''; VERT=''; JAUNE=''; RAZ=''
fi
titre()  { echo; echo "${GRAS}=== $* ===${RAZ}"; }
ok()     { echo "  ${VERT}OK${RAZ}   $*"; }
info()   { echo "       $*"; }
alerte() { echo "  ${JAUNE}!${RAZ}    $*"; }
echec()  { echo "  ${ROUGE}ECHEC${RAZ} $*" >&2; }

trap 'echec "interruption ligne $LINENO."' ERR

if [[ -f "$CONF" ]]; then
  set -a; source "$CONF"; set +a
  ok "configuration lue depuis .env.migration"
else
  alerte "pas de .env.migration — tout sera demande a la saisie"
fi

demander()        { local v="$1"; [[ -n "${!v:-}" ]] || { read -rp "  $2 : " "$v"; export "$v"; }; }
demander_secret() { local v="$1"; [[ -n "${!v:-}" ]] || { read -rsp "  $2 : " "$v"; echo; export "$v"; }; }

titre "Migration de donnees"
demander SOURCE_REF "Reference de la base SOURCE (celle a copier)"
demander CIBLE_REF  "Reference de la base CIBLE  (celle a remplir)"

if [[ "$SOURCE_REF" == "$CIBLE_REF" ]]; then
  echec "source et cible sont la meme base."
  exit 1
fi

demander_secret SOURCE_PASSWORD "Mot de passe de $SOURCE_REF"
demander_secret CIBLE_PASSWORD  "Mot de passe de $CIBLE_REF"

# Les projets anterieurs a la fin de l'IPv4 gratuite (janvier 2024) ont perdu
# la connexion directe sur le port 5432 : db.<ref>.supabase.co repond
# « Connection refused » alors que le projet est ACTIVE_HEALTHY. Il faut alors
# passer par le pooler, qui change DEUX choses a la fois — l'hote ET
# l'utilisateur (postgres.<ref> au lieu de postgres).
#
# Le prefixe aws-0 / aws-1 ne se devine pas : les deux repondent au ping, un
# seul accepte le projet. Project Settings > Database > Connection string >
# onglet « Session pooler ».
if [[ -n "${SOURCE_POOLER:-}" ]]; then
  SOURCE_HOST="$SOURCE_POOLER"; SOURCE_USER="postgres.$SOURCE_REF"
else
  SOURCE_HOST="db.$SOURCE_REF.supabase.co"; SOURCE_USER="postgres"
fi
CIBLE_HOST="db.$CIBLE_REF.supabase.co"; CIBLE_USER="postgres"

sql_source() { PGPASSWORD="$SOURCE_PASSWORD" "$PG_BIN/psql" -h "$SOURCE_HOST" -p 5432 -U "$SOURCE_USER" -d postgres -qAt -v ON_ERROR_STOP=1 -c "$1"; }
sql_cible()  { PGPASSWORD="$CIBLE_PASSWORD"  "$PG_BIN/psql" -h "$CIBLE_HOST"  -p 5432 -U "$CIBLE_USER"  -d postgres -qAt -v ON_ERROR_STOP=1 -c "$1"; }

# ── 1. Les deux bases repondent ─────────────────────────────────────────────
titre "1/6  Controles prealables"

if ! sql_source "SELECT 1" > /dev/null 2>&1; then
  echec "la source $SOURCE_HOST ne repond pas."
  if [[ -z "${SOURCE_POOLER:-}" ]]; then
    info "Cette base refuse peut-etre la connexion directe. Renseigner"
    info "SOURCE_POOLER dans .env.migration :"
    info "  Project Settings > Database > Connection string > Session pooler"
  fi
  exit 1
fi
ok "source  $SOURCE_REF joignable"

sql_cible "SELECT 1" > /dev/null 2>&1 || { echec "la cible $CIBLE_HOST ne repond pas."; exit 1; }
ok "cible   $CIBLE_REF joignable"

# ── 2. Meme structure de part et d'autre ────────────────────────────────────
titre "2/6  Concordance des structures"

# Importer dans une structure differente produit soit une erreur franche, soit
# — bien pire — un import partiel qui passe inapercu. On compare donc avant.
for objet in \
  "tables:SELECT COUNT(*) FROM pg_class WHERE relnamespace='public'::regnamespace AND relkind='r'" \
  "colonnes:SELECT COUNT(*) FROM information_schema.columns WHERE table_schema='public'" \
  "fonctions:SELECT COUNT(*) FROM pg_proc WHERE pronamespace='public'::regnamespace" \
  "policies:SELECT COUNT(*) FROM pg_policies WHERE schemaname='public'"
do
  nom="${objet%%:*}"; requete="${objet#*:}"
  a="$(sql_source "$requete")"; b="$(sql_cible "$requete")"
  if [[ "$a" == "$b" ]]; then
    ok "$(printf '%-9s' "$nom") $a de part et d'autre"
  else
    alerte "$(printf '%-9s' "$nom") source $a / cible $b"
    DIVERGENCE=1
  fi
done

# La liste nommee attrape ce qu'un compteur egal masquerait : une table
# renommee laisse le total inchange.
MANQUANTES="$(sql_cible "
  SELECT string_agg(t, ', ') FROM (
    SELECT unnest(ARRAY[$(sql_source "SELECT string_agg(quote_literal(relname), ',') FROM pg_class WHERE relnamespace='public'::regnamespace AND relkind='r'")]) AS t
    EXCEPT
    SELECT relname FROM pg_class WHERE relnamespace='public'::regnamespace AND relkind='r'
  ) x")"
if [[ -n "$MANQUANTES" ]]; then
  echec "tables absentes de la cible : $MANQUANTES"
  info "La cible n'a pas recu install.sql, ou pas dans la meme version."
  exit 1
fi
ok "aucune table manquante"

if [[ "${DIVERGENCE:-0}" != "0" ]]; then
  echo
  alerte "Les structures different. Un import peut echouer a mi-parcours."
  info "Pour comparer le detail : ./scripts/comparer-bases.sh"
  read -rp "  taper OUI pour continuer malgre tout : " R
  [[ "$R" == "OUI" ]] || { echec "interrompu."; exit 1; }
fi

# ── 3. La cible est vide ────────────────────────────────────────────────────
titre "3/6  La cible est-elle vide ?"

# app_settings et les tables de reference sont peuplees par install.sql : leur
# presence est normale et ne signifie pas que la base est habitee. Ce qui
# compte, ce sont les donnees de vie.
declare -a HABITEE=()
for t in profiles bookings scheduled_classes pack_purchases performances subscriptions; do
  n="$(sql_cible "SELECT COUNT(*) FROM $t" 2>/dev/null || echo 0)"
  [[ "$n" != "0" ]] && HABITEE+=("$t: $n")
done
NB_COMPTES="$(sql_cible "SELECT COUNT(*) FROM auth.users")"

if [[ ${#HABITEE[@]} -gt 0 ]]; then
  echec "la cible porte deja des donnees :"
  for h in "${HABITEE[@]}"; do info "  $h"; done
  info ""
  info "Ce script n'ecrase rien : il refuse d'importer par-dessus."
  info "Pour la remettre a zero d'abord :"
  info "  psql -h $CIBLE_HOST -U postgres -d postgres -f supabase/reset-test-data.sql"
  exit 1
fi
ok "aucune donnee de vie dans la cible"

# Les comptes meritent un mot a part : le dump en apporte, et un compte deja
# la ferait echouer l'import sur un doublon d'adresse.
if [[ "$NB_COMPTES" != "0" ]]; then
  alerte "$NB_COMPTES compte(s) dans auth.users — sans doute le super_admin"
  info "L'import apporte les comptes de la source. Un doublon d'adresse le"
  info "ferait echouer, et la transaction serait annulee en entier."
  read -rp "  taper OUI pour continuer : " R
  [[ "$R" == "OUI" ]] || { echec "interrompu."; exit 1; }
fi

# ── 4. Export ───────────────────────────────────────────────────────────────
titre "4/6  Export de $SOURCE_REF"

mkdir -p "$DUMP_DIR"
DUMP="$DUMP_DIR/$SOURCE_REF-$(date +%Y%m%d-%H%M%S).sql"

# auth.users porte les comptes de connexion, auth.identities le lien vers le
# fournisseur. Sans ces deux tables, les profils importes n'auraient plus de
# compte et personne ne pourrait se connecter. Le reste du schema auth
# (sessions, jetons) ne vaut que pour l'instance d'origine.
#
# public s'ecrit --table='public.*' et NON --schema=public : des qu'un --table
# est present, pg_dump ignore --schema. Ecrit --schema, le dump ne sortait que
# les deux tables auth, sans une ligne de public — et sans la moindre erreur.
info "hote : $SOURCE_HOST (utilisateur $SOURCE_USER)"
PGPASSWORD="$SOURCE_PASSWORD" "$PG_BIN/pg_dump" \
  -h "$SOURCE_HOST" -p 5432 -U "$SOURCE_USER" -d postgres \
  --data-only --no-owner --no-privileges \
  --table='public.*' --table=auth.users --table=auth.identities \
  -f "$DUMP"
ok "$(basename "$DUMP")  ($(du -h "$DUMP" | cut -f1))"

# Un dump sans public ne porterait que les comptes : l'importer laisserait la
# cible avec des utilisateurs et aucune donnee applicative. On controle AVANT
# d'ecrire quoi que ce soit — ce garde-fou a deja servi le 2026-08-28.
grep -q '^COPY public\.' "$DUMP" || {
  echec "aucune table public dans le dump — la cible n'a PAS ete touchee."
  info "Dump conserve pour examen : $DUMP"
  exit 1
}
ok "le dump contient bien des donnees de public"

# ── 5. Import ───────────────────────────────────────────────────────────────
titre "5/6  Import dans $CIBLE_REF"

# session_replication_role = 'replica' desactive les triggers le temps de
# l'import. Sans cela on_auth_user_created recreerait un profil pour chaque
# compte importe, en conflit avec ceux du dump — et le trigger d'attribution
# du pack d'essai distribuerait des credits a tout le monde.
#
# C'est la seule voie ici : --disable-triggers de pg_restore exige d'etre
# superutilisateur, ce que `postgres` n'est PAS sur Supabase.
#
# Le tout dans UNE transaction : un import a moitie fait laisserait des
# profils sans compte, ou l'inverse. ON_ERROR_STOP=1 garantit le ROLLBACK.
info "triggers desactives, une seule transaction"
{
  echo "BEGIN;"
  echo "SET session_replication_role = 'replica';"
  cat "$DUMP"
  echo "SET session_replication_role = 'origin';"
  echo "COMMIT;"
} | PGPASSWORD="$CIBLE_PASSWORD" "$PG_BIN/psql" \
      -h "$CIBLE_HOST" -p 5432 -U "$CIBLE_USER" -d postgres \
      -v ON_ERROR_STOP=1 -q
ok "import termine"

# ── 6. Controle ─────────────────────────────────────────────────────────────
titre "6/6  Controle source / cible"

printf "       %-22s %10s %10s\n" "TABLE" "SOURCE" "CIBLE"
ECART=0
for t in auth.users profiles user_roles class_types scheduled_classes \
         bookings pack_types pack_purchases performances subscriptions app_settings; do
  a="$(sql_source "SELECT COUNT(*) FROM $t" 2>/dev/null || echo '?')"
  b="$(sql_cible  "SELECT COUNT(*) FROM $t" 2>/dev/null || echo '?')"
  if [[ "$a" == "$b" ]]; then
    printf "       %-22s %10s %10s  ${VERT}=${RAZ}\n" "$t" "$a" "$b"
  else
    printf "       %-22s %10s %10s  ${JAUNE}!${RAZ}\n" "$t" "$a" "$b"
    ECART=1
  fi
done

# app_settings peut differer legitimement : install.sql pose ses propres
# reglages sur la cible, et le dump apporte ceux de la source. Les autres
# ecarts, eux, meritent un examen.
if [[ "$ECART" != "0" ]]; then
  echo
  alerte "Des comptages different."
  info "app_settings : normal — install.sql pose les siens, le dump les siens."
  info "Ailleurs : examiner avant de mettre cette base en service."
fi

# ── Storage ─────────────────────────────────────────────────────────────────
titre "Fichiers du Storage"

# Les fichiers sont des objets binaires : aucun dump SQL ne les emporte. La
# base ne garde que le CHEMIN de chaque image depuis le 2026-08-28, si bien
# qu'il n'y a plus aucune URL a reecrire apres la copie.
NB_FICHIERS="$(sql_source "SELECT COUNT(*) FROM storage.objects WHERE bucket_id='avatars'" 2>/dev/null || echo '?')"
info "la source porte $NB_FICHIERS fichier(s) dans 'avatars'"

if [[ -n "${SOURCE_SERVICE_KEY:-}" && -n "${CIBLE_SERVICE_KEY:-}" ]]; then
  info "copie en cours..."
  SOURCE_REF="$SOURCE_REF" SOURCE_KEY="$SOURCE_SERVICE_KEY" \
  CIBLE_REF="$CIBLE_REF"   CIBLE_KEY="$CIBLE_SERVICE_KEY" \
    "$RACINE/scripts/copier-storage.sh" 2>&1 | sed 's/^/       /'
else
  alerte "cles service_role absentes — fichiers NON copies"
  info "Les images resteront introuvables. Renseigner SOURCE_SERVICE_KEY et"
  info "CIBLE_SERVICE_KEY dans .env.migration, ou lancer a la main :"
  info "  SOURCE_REF=$SOURCE_REF SOURCE_KEY=... \\"
  info "  CIBLE_REF=$CIBLE_REF CIBLE_KEY=... ./scripts/copier-storage.sh"
fi

titre "Termine"
info "Dump conserve : $DUMP"
info "(.dumps/ est ignore par git — il contient des donnees de membres)"
echo
info "A verifier avant de mettre cette base en service :"
info "  - se connecter avec un compte importe"
info "  - les images des cours et des coachs s'affichent"
info "  - le solde de credits d'un membre est juste"
echo

-- ============================================================================
-- Index sur les deux tables les plus sollicitées
-- ----------------------------------------------------------------------------
-- CE QUI MANQUAIT
--
-- `bookings` et `scheduled_classes` n'avaient AUCUN index — pas un seul, en
-- dehors des clés primaires et de la contrainte d'unicité. Ce sont pourtant
-- les deux tables que tout interroge : 65 requêtes dans les fonctions de la
-- base, et autant depuis l'application.
--
-- Sans index, PostgreSQL parcourt la table entière à chaque fois. Sur les
-- données de test, cela ne se voit pas. À 10 000 réservations, chaque
-- affichage du planning, chaque contrôle de disponibilité, chaque statistique
-- lira les 10 000 lignes pour en retenir quatre.
--
-- Un index change ce coût d'échelle : parcourir 10 000 lignes ou en chercher
-- dans 1 000 000 revient presque au même prix, la recherche se faisant en
-- arbre. C'est la réponse à la question « faut-il archiver au bout de six
-- mois » — le volume n'est pas le problème, l'absence d'index l'était.
--
-- CE QUE ÇA NE CHANGE PAS
--
-- Aucune donnée n'est touchée, aucun comportement modifié. Un index est une
-- structure d'accès : il accélère la lecture, et coûte un peu à l'écriture
-- (chaque INSERT doit le tenir à jour). Sur ces volumes, l'échange est
-- largement favorable — on lit ces tables des dizaines de fois pour une
-- écriture.
--
-- CHOIX DES COLONNES
--
-- Chaque index ci-dessous répond à des requêtes réellement présentes dans le
-- code, relevées une par une. Aucun n'est posé « au cas où » : un index
-- inutile occupe de la place et ralentit les écritures sans rien rendre.
--
-- `CREATE INDEX IF NOT EXISTS` : rejouable sans erreur.
--
-- NOTE SUR CONCURRENTLY — un `CREATE INDEX` ordinaire verrouille la table en
-- écriture le temps de sa construction. Sur les volumes actuels, c'est
-- l'affaire de quelques dizaines de millisecondes. `CONCURRENTLY` éviterait ce
-- verrou mais interdit d'être dans une transaction, ce que le SQL Editor
-- impose. À reconsidérer seulement si ces tables atteignent un jour des
-- centaines de milliers de lignes ET que le studio ne peut pas s'offrir une
-- seconde d'indisponibilité.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- bookings
-- ---------------------------------------------------------------------------

-- « Combien d'inscrits sur ce cours ? » — la requête la plus fréquente de
-- toute l'application : contrôle de capacité, affichage du planning, statut
-- dérivé d'un cours, revenu d'une séance.
--
-- La contrainte `UNIQUE(scheduled_class_id, user_id)` porte déjà un index qui
-- commence par `scheduled_class_id` : il sert donc ces requêtes en partie.
-- Mais toutes ajoutent `AND status = 'confirmed'`, et l'index d'unicité oblige
-- alors à lire chaque ligne pour écarter les annulations. Sur un cours isolé
-- l'écart est négligeable — sur les statistiques et les exports, qui agrègent
-- des centaines de cours d'un coup, il ne l'est plus.
CREATE INDEX IF NOT EXISTS bookings_class_status
  ON bookings (scheduled_class_id, status);

-- « Les réservations de ce membre » — son tableau de bord, ses séances à
-- venir, son historique, ses statistiques, le suivi clients.
--
-- `created_at DESC` termine l'index : les écrans affichent systématiquement du
-- plus récent au plus ancien, et l'ordre stocké évite un tri.
CREATE INDEX IF NOT EXISTS bookings_user_status
  ON bookings (user_id, status, created_at DESC);

-- « Ce pack a-t-il déjà servi ? » — la valorisation d'une séance divise le
-- prix payé par le nombre de réservations rattachées au pack, et la
-- suppression d'un pack doit retrouver ce qui en dépend.
CREATE INDEX IF NOT EXISTS bookings_pack_purchase
  ON bookings (pack_purchase_id)
  WHERE pack_purchase_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- scheduled_classes
-- ---------------------------------------------------------------------------

-- « Les cours de telle période » — le planning, les exports, le tableau de
-- bord, les statistiques. Toujours un intervalle sur `starts_at`.
CREATE INDEX IF NOT EXISTS scheduled_classes_starts_at
  ON scheduled_classes (starts_at);

-- « Les cours de ce coach » — son espace, sa fiche admin, ses chiffres.
-- Partiel : un cours sans coach n'est jamais cherché par coach, et les exclure
-- garde l'index plus compact.
CREATE INDEX IF NOT EXISTS scheduled_classes_coach
  ON scheduled_classes (coach_id, starts_at)
  WHERE coach_id IS NOT NULL;

-- « Les cours de ce type » — la protection d'un type de cours à la
-- suppression, et le filtre par type dans le planning admin.
CREATE INDEX IF NOT EXISTS scheduled_classes_type
  ON scheduled_classes (class_type_id, starts_at);

-- ---------------------------------------------------------------------------
-- pack_purchases — les crédits d'un membre, lus à chaque réservation
-- ---------------------------------------------------------------------------
-- `get_available_credits` s'exécute avant CHAQUE réservation, et filtre sur le
-- membre puis sur la date d'expiration. La table portait un index unique sur
-- `stripe_invoice_id` (idempotence du webhook), rien pour cette lecture-là.
CREATE INDEX IF NOT EXISTS pack_purchases_user_expiry
  ON pack_purchases (user_id, expires_at DESC);

-- ---------------------------------------------------------------------------
-- waitlist — consultée à chaque affichage du planning
-- ---------------------------------------------------------------------------
-- Seulement par membre. La recherche par cours est déjà servie par la
-- contrainte `UNIQUE(scheduled_class_id, user_id)`, dont l'index commence par
-- `scheduled_class_id` ; et une liste d'attente reste courte, si bien que
-- filtrer le statut en lisant les quelques lignes trouvées ne coûte rien.
CREATE INDEX IF NOT EXISTS waitlist_user
  ON waitlist (user_id, status);

-- ---------------------------------------------------------------------------
-- Vérification — à lire après exécution
-- ---------------------------------------------------------------------------
-- Les huit index doivent apparaître. `taille` restera à quelques kilo-octets
-- sur les données actuelles : un index ne grossit qu'avec la table.
SELECT
  tablename                                    AS "Table",
  indexname                                    AS "Index",
  pg_size_pretty(pg_relation_size(indexname::regclass)) AS "Taille"
FROM pg_indexes
WHERE schemaname = 'public'
  AND indexname IN (
    'bookings_class_status', 'bookings_user_status', 'bookings_pack_purchase',
    'scheduled_classes_starts_at', 'scheduled_classes_coach', 'scheduled_classes_type',
    'pack_purchases_user_expiry',
    'waitlist_user'
  )
ORDER BY tablename, indexname;

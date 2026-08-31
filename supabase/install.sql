-- ============================================
-- Back On Track — Fitness Studio v2
-- Installation complète de la base de données
--
-- À exécuter dans le SQL Editor de Supabase, sur un projet NEUF (base vide).
--
-- IMPORTANT : exécuter en DEUX FOIS
--   1) SECTION A (les types énumérés)
--   2) SECTION B (tout le reste)
-- PostgreSQL refuse d'utiliser une valeur d'enum créée dans la même
-- transaction : d'où la coupure.
--
-- Dernière mise à jour : 2026-08-06 (soir) — remise à niveau complète, puis
-- rattrapage des migrations du jour : rôles, bons d'achat, inscription par le
-- staff, renoncement après modification, et les policies coach qui manquaient.
-- Ce fichier avait pris du retard sur les migrations : il lui manquait les
-- abonnements, le parrainage, les bons d'achat, les badges et une douzaine
-- de fonctions. Il contenait aussi deux policies trop permissives, retirées
-- ici (voir la section 5).
--
-- Ordre des sections : types → tables → fonctions → triggers → RLS →
-- policies → vues → realtime → données initiales. Les tables suivent leurs
-- dépendances : `subscriptions` avant `pack_purchases` qui la référence,
-- `referrals` avant `referral_rewards`.
-- ============================================


-- ============================================
-- SECTION A — Exécuter seul en premier
-- ============================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TYPE user_role AS ENUM ('admin', 'coach', 'client', 'super_admin');

CREATE TYPE activity_action AS ENUM (
  'pack_purchased', 'pack_assigned', 'pack_modified', 'pack_removed',
  'booking_created', 'booking_cancelled', 'booking_assigned',
  'role_changed', 'waitlist_joined', 'waitlist_promoted',
  'user_created', 'signup_attempt', 'registration_fee_paid', 'user_login',
  'trial_booked', 'check_in', 'no_show', 'account_deleted',
  'password_reset_by_admin',
  -- Demande par le MEMBRE lui-meme, a distinguer de la precedente : l'une est
  -- un geste de support, l'autre un signal.
  'password_reset_requested',
  'email_change_by_admin',
  'subscription_cancelled',
  'subscription_paused',
  'subscription_resumed',
  'subscription_postponed',
  'subscription_discounted'
);


-- ============================================
-- SECTION B — Exécuter après la section A
-- ============================================

-- ============================================
-- 1. TABLES
-- ============================================

-- Catégories de membres
CREATE TABLE member_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Profils utilisateurs (extension de auth.users)
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL,
  first_name TEXT,
  last_name TEXT,
  phone TEXT,
  email TEXT,
  avatar_url TEXT,
  bio TEXT,
  member_category_id UUID REFERENCES member_categories(id),
  -- Phase 1 : champs enrichis
  date_of_birth DATE,
  address TEXT,
  emergency_contact_name TEXT,
  emergency_contact_phone TEXT,
  objectives TEXT,
  fitness_level TEXT,
  medical_conditions TEXT,
  cgv_accepted_at TIMESTAMPTZ,
  rgpd_accepted_at TIMESTAMPTZ,
  -- Compte fermé à la demande du membre : données personnelles anonymisées,
  -- pièces comptables conservées sans lien identifiable.
  deleted_at TIMESTAMPTZ,
  -- Client professionnel : commande sur facture au lieu de payer par carte.
  -- Positionné par un ADMIN uniquement — un client qui se déclarerait
  -- entreprise obtiendrait des séances sans payer.
  is_business BOOLEAN NOT NULL DEFAULT FALSE,
  company_name TEXT,
  company_vat TEXT,
  company_address TEXT,
  referral_code TEXT UNIQUE,
  -- Seances suivies AVANT la mise en service, reprises de l'ancien systeme.
  -- Ajoutees au total pour les badges d'assiduite ; sans effet sur les periodes
  -- recentes. Sans elle, un client qui s'entraine depuis deux ans repartirait a
  -- zero le jour de la bascule.
  seances_anterieures INTEGER NOT NULL DEFAULT 0 CHECK (seances_anterieures >= 0),
  member_status TEXT DEFAULT 'visitor'
    CHECK (member_status IN ('visitor', 'potential', 'active', 'inactive', 'former')),
  weekly_goal INTEGER DEFAULT 3,
  -- Recevoir un e-mail à chaque réservation faite par soi-même.
  email_on_self_booking BOOLEAN DEFAULT TRUE,
  -- Coach fields
  instagram_url TEXT,
  facebook_url TEXT,
  linkedin_url TEXT,
  coach_description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  last_sign_in_at TIMESTAMPTZ
);

-- Rôles utilisateurs
CREATE TABLE user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role user_role NOT NULL DEFAULT 'client',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, role)
);

-- Types de crédits
CREATE TABLE credit_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  label_fr TEXT NOT NULL,
  label_en TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Coupons de réduction
CREATE TABLE coupons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  discount_percent INTEGER CHECK (discount_percent BETWEEN 1 AND 100),
  discount_amount_cents INTEGER CHECK (discount_amount_cents > 0),
  max_uses INTEGER,
  current_uses INTEGER DEFAULT 0,
  valid_from TIMESTAMPTZ DEFAULT NOW(),
  valid_until TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT one_discount_type CHECK (
    (discount_percent IS NOT NULL AND discount_amount_cents IS NULL) OR
    (discount_percent IS NULL AND discount_amount_cents IS NOT NULL)
  )
);

-- Types de packs
-- is_unlimited : accès illimité — aucun décompte à la réservation,
-- aucun recrédit à l'annulation. credit_count reste NOT NULL > 0 : sur un
-- pack illimité il est purement indicatif (jamais consommé, jamais utilisé
-- comme diviseur — cf. booking_revenue).
CREATE TABLE pack_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  credit_type_id UUID NOT NULL REFERENCES credit_types(id),
  credit_count INTEGER NOT NULL CHECK (credit_count > 0),
  -- La gratuité est un prix légitime : le pack d'essai vaut 0 €. Seuls les
  -- montants négatifs restent interdits.
  price_cents INTEGER NOT NULL CHECK (price_cents >= 0),
  validity_days INTEGER NOT NULL CHECK (validity_days > 0),
  is_unlimited BOOLEAN NOT NULL DEFAULT FALSE,
  -- Plafond de fréquentation : N cours par D jours, sur une fenêtre glissante
  -- centrée sur la séance visée. NULL = aucun plafond. « Illimité » sans
  -- garde-fou laisse quelqu'un venir plusieurs fois par jour et occuper les
  -- places au détriment des autres.
  --
  -- D est borné à 14 jours : au-delà, un plafond ne contraint plus le rythme.
  -- « 50 cours par 28 jours » laisse en faire 50 la première semaine puis rien
  -- pendant trois — exactement ce qu'on veut empêcher.
  quota_sessions INTEGER CHECK (quota_sessions IS NULL OR quota_sessions > 0),
  quota_days INTEGER CHECK (quota_days IS NULL OR (quota_days >= 1 AND quota_days <= 14)),
  -- Un plafond sans fenêtre, ou l'inverse, ne veut rien dire.
  CONSTRAINT quota_both_or_none CHECK (
    (quota_sessions IS NULL AND quota_days IS NULL)
    OR (quota_sessions IS NOT NULL AND quota_days IS NOT NULL)
  ),
  -- Abonnement : renouvellement automatique par Stripe.
  -- « week » x 4 = 28 jours fixes, soit 13 échéances par an ; « month » x 1 =
  -- mois calendaire, 12 échéances. Les deux ne sont PAS équivalents.
  is_recurring BOOLEAN NOT NULL DEFAULT FALSE,
  -- Semaines ou mois : « tous les 72 jours » ne se dit pas, ne se compare pas,
  -- et n'a aucun sens commercial. Un abonnement annuel se fait en mois x 12.
  recurring_interval TEXT
    CHECK (recurring_interval IS NULL OR recurring_interval IN ('week', 'month')),
  recurring_interval_count INTEGER
    CHECK (recurring_interval_count IS NULL OR recurring_interval_count > 0),
  -- Bornes de Stripe, pas un choix du studio : au-delà, le Price est refusé au
  -- premier paiement et rien n'explique pourquoi.
  CONSTRAINT pack_types_recurring_within_stripe_limits CHECK (
    recurring_interval IS NULL
    OR (recurring_interval = 'week'  AND recurring_interval_count BETWEEN 1 AND 52)
    OR (recurring_interval = 'month' AND recurring_interval_count BETWEEN 1 AND 12)
  ),
  -- Price Stripe, distinct par mode : un prix de test n'existe pas en live.
  stripe_price_id_test TEXT,
  stripe_price_id_live TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  -- FALSE = hors catalogue, mais toujours utilisable. `is_active = FALSE`
  -- rendrait le pack inutilisable ET invisible : il faut distinguer « retiré
  -- de la vente » de « hors service ». Cas de la séance d'essai, offerte.
  is_purchasable BOOLEAN NOT NULL DEFAULT TRUE,
  -- Marque LE pack d'essai. Un seul à la fois (index unique partiel ci-dessous).
  is_trial BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT pack_types_recurring_coherent CHECK (
    NOT is_recurring
    OR (recurring_interval IS NOT NULL AND recurring_interval_count IS NOT NULL)
  ),
  -- Ce que l'achat attribue comme catégorie, et à quoi revenir ensuite. Sert à
  -- ouvrir des tarifs réservés (une séance supplémentaire à prix abonné).
  -- NULL = ce pack ne se prononce pas sur la catégorie.
  grants_category_id UUID REFERENCES member_categories(id),
  reverts_to_category_id UUID REFERENCES member_categories(id),
  -- Mise en avant. Un champ à part et non un troisième état de `is_active` :
  -- un pack promu est forcément actif, la promotion est une mise en avant et
  -- non un état de vente. Les fondre interdirait de dépromouvoir sans
  -- désactiver.
  is_featured BOOLEAN NOT NULL DEFAULT FALSE,
  featured_label TEXT,
  CONSTRAINT pack_types_featured_requires_active CHECK (NOT is_featured OR is_active)
);

-- Un seul pack d'essai : sans cette garantie, l'attribution devrait choisir
-- entre plusieurs candidats et le comportement deviendrait imprévisible.
CREATE UNIQUE INDEX pack_types_single_trial
  ON pack_types (is_trial) WHERE is_trial;

-- Junction : catégories éligibles par coupon. Aucune ligne = ouvert à tous.
CREATE TABLE coupon_categories (
  coupon_id UUID NOT NULL REFERENCES coupons(id) ON DELETE CASCADE,
  member_category_id UUID NOT NULL REFERENCES member_categories(id) ON DELETE CASCADE,
  PRIMARY KEY (coupon_id, member_category_id)
);

-- Junction : catégories éligibles par type de pack
CREATE TABLE pack_type_categories (
  pack_type_id UUID NOT NULL REFERENCES pack_types(id) ON DELETE CASCADE,
  member_category_id UUID NOT NULL REFERENCES member_categories(id) ON DELETE CASCADE,
  PRIMARY KEY (pack_type_id, member_category_id)
);

-- Abonnements Stripe.
-- Les crédits eux-mêmes vivent dans pack_purchases : une ligne par cycle payé.
-- Un abonnement n'est pas une entité nouvelle, c'est un pack court qui se
-- renouvelle tout seul.
CREATE TABLE subscriptions (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                 UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  pack_type_id            UUID NOT NULL REFERENCES pack_types(id),

  stripe_subscription_id  TEXT NOT NULL UNIQUE,
  stripe_customer_id      TEXT NOT NULL,
  stripe_price_id         TEXT NOT NULL,
  -- Un abonnement créé en test ne doit jamais être piloté avec la clé live.
  stripe_mode             TEXT NOT NULL DEFAULT 'test' CHECK (stripe_mode IN ('test', 'live')),

  -- 'paused' = suspension décidée par le studio.
  status                  TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'past_due', 'paused', 'canceled', 'incomplete')),

  current_period_start    TIMESTAMPTZ,
  current_period_end      TIMESTAMPTZ,
  cancel_at_period_end    BOOLEAN NOT NULL DEFAULT FALSE,
  canceled_at             TIMESTAMPTZ,
  paused_at               TIMESTAMPTZ,

  created_at              TIMESTAMPTZ DEFAULT NOW(),
  updated_at              TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX subscriptions_user_idx   ON subscriptions(user_id);
CREATE INDEX subscriptions_status_idx ON subscriptions(status);

-- Réductions ponctuelles accordées par le studio sur une échéance.
CREATE TABLE subscription_discounts (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id   UUID NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
  stripe_coupon_id  TEXT NOT NULL,
  amount_off_cents  INTEGER CHECK (amount_off_cents IS NULL OR amount_off_cents > 0),
  percent_off       INTEGER CHECK (percent_off IS NULL OR (percent_off BETWEEN 1 AND 100)),
  reason            TEXT,
  applied_by        UUID REFERENCES auth.users(id),
  applied_at        TIMESTAMPTZ DEFAULT NOW(),
  -- Renseigné par le webhook quand la facture réduite a été payée.
  consumed_at       TIMESTAMPTZ,
  CONSTRAINT one_discount_kind CHECK (
    (amount_off_cents IS NOT NULL AND percent_off IS NULL) OR
    (amount_off_cents IS NULL AND percent_off IS NOT NULL)
  )
);

CREATE INDEX subscription_discounts_sub_idx ON subscription_discounts(subscription_id);

-- Achats de packs
CREATE TABLE pack_purchases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  pack_type_id UUID NOT NULL REFERENCES pack_types(id),
  price_paid_cents INTEGER NOT NULL,
  credits_remaining INTEGER NOT NULL,
  purchased_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  stripe_payment_intent_id TEXT,
  coupon_id UUID REFERENCES coupons(id),
  -- Rempli quand la ligne provient d'une échéance d'abonnement.
  subscription_id UUID REFERENCES subscriptions(id) ON DELETE SET NULL,
  -- Facture Stripe à l'origine du cycle. L'index unique ci-dessous garantit
  -- qu'un même événement rejoué ne crédite pas deux fois.
  stripe_invoice_id TEXT,
  -- Canal d'encaissement. Le montant seul ne dit pas d'où vient l'argent :
  -- 139 € en espèces et 139 € par carte seraient sinon indiscernables.
  payment_method TEXT CHECK (payment_method IN ('stripe', 'cash', 'transfer', 'gift')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX pack_purchases_stripe_invoice_uniq
  ON pack_purchases(stripe_invoice_id) WHERE stripe_invoice_id IS NOT NULL;

-- Retrouver les encaissements hors ligne d'une période sans balayer la table.
CREATE INDEX pack_purchases_payment_method_idx
  ON pack_purchases(payment_method, purchased_at)
  WHERE payment_method IN ('cash', 'transfer');

-- Types de cours
CREATE TABLE class_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  credit_type_id UUID NOT NULL REFERENCES credit_types(id),
  default_max_participants INTEGER DEFAULT 4,
  -- Préremplit la durée à la création d'un cours, comme le fait déjà
  -- default_max_participants pour la capacité. 60 par défaut : la valeur que le
  -- formulaire posait en dur avant que ce réglage existe.
  default_duration_minutes INTEGER NOT NULL DEFAULT 60,
  color TEXT DEFAULT '#3B82F6',
  image_url TEXT,
  description_md TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Cours planifiés (planning)
CREATE TABLE scheduled_classes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_type_id UUID NOT NULL REFERENCES class_types(id),
  coach_id UUID REFERENCES auth.users(id),
  starts_at TIMESTAMPTZ NOT NULL,
  duration_minutes INTEGER NOT NULL DEFAULT 60,
  max_participants INTEGER DEFAULT 4,
  is_cancelled BOOLEAN DEFAULT FALSE,
  title TEXT,
  description TEXT,
  floor TEXT CHECK (floor IS NULL OR floor IN ('haut', 'bas')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Réservations
CREATE TABLE bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scheduled_class_id UUID NOT NULL REFERENCES scheduled_classes(id),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  -- Nullable depuis le pack d'essai : couvre une régularisation faite à la
  -- main par le studio. Le cas nominal reste rempli — l'essai est payé par le
  -- crédit de son pack.
  pack_purchase_id UUID REFERENCES pack_purchases(id),
  status TEXT NOT NULL DEFAULT 'confirmed' CHECK (status IN ('confirmed', 'cancelled')),
  checked_in_at TIMESTAMPTZ,
  is_no_show BOOLEAN DEFAULT FALSE,
  -- Réservation consommant la séance d'essai offerte. Sert à l'affichage
  -- (badge) et aux statistiques de conversion.
  is_trial BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  cancelled_at TIMESTAMPTZ,
  UNIQUE(scheduled_class_id, user_id),
  CONSTRAINT bookings_pack_or_trial
    CHECK (pack_purchase_id IS NOT NULL OR is_trial)
);

-- Liste d'attente
CREATE TABLE waitlist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scheduled_class_id UUID NOT NULL REFERENCES scheduled_classes(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  position INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  notified_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting', 'offered', 'confirmed', 'expired', 'cancelled')),
  UNIQUE(scheduled_class_id, user_id)
);

-- Notifications
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT DEFAULT 'info',
  is_read BOOLEAN DEFAULT FALSE,
  link TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  -- Le membre a retiré la communication de son accueil. La ligne est
  -- conservée : elle prouve que l'information a été transmise.
  dismissed_at TIMESTAMPTZ,
  -- Template e-mail parti en parallèle, NULL si la communication n'existe que
  -- dans l'application. Sert à afficher « aussi envoyé par e-mail ».
  email_template TEXT
);

-- L'accueil demande « les communications non écartées, les plus récentes
-- d'abord » à chaque chargement.
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

CREATE INDEX notifications_user_active
  ON notifications (user_id, created_at DESC)
  WHERE dismissed_at IS NULL;

-- E-mails demandés par les fonctions SQL, qui ne peuvent pas appeler une Edge
-- Function. Le cas type : promote_from_waitlist offre une place valable deux
-- heures — sans e-mail, l'offre expirait sans que le membre l'ait su.
CREATE TABLE email_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  template TEXT NOT NULL,
  vars JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  sent_at TIMESTAMPTZ,
  -- Dernière erreur rencontrée. Conservée : un envoi qui échoue en silence est
  -- le pire des cas, on veut pouvoir constater la panne.
  last_error TEXT,
  attempts INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX email_queue_pending
  ON email_queue (created_at)
  WHERE sent_at IS NULL;

-- Paramètres application
CREATE TABLE app_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL UNIQUE,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by UUID REFERENCES auth.users(id)
);

-- Journal d'activité
CREATE TABLE activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action activity_action NOT NULL,
  actor_id UUID REFERENCES auth.users(id),
  target_user_id UUID REFERENCES auth.users(id),
  entity_type TEXT,
  entity_id UUID,
  details JSONB DEFAULT '{}'::jsonb,
  description TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_activity_log_created_at ON activity_log(created_at DESC);
CREATE INDEX idx_activity_log_target_user ON activity_log(target_user_id);
CREATE INDEX idx_activity_log_actor ON activity_log(actor_id);
CREATE INDEX idx_activity_log_action ON activity_log(action);

-- Phase 3 : Frais d'inscription
CREATE TABLE registration_fees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount_cents INTEGER NOT NULL DEFAULT 3000,
  paid_at TIMESTAMPTZ DEFAULT NOW(),
  stripe_payment_intent_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Phase 3 : Séances d'essai
--
-- La table `trial_sessions` a été supprimée le 2026-08-07. Une séance d'essai
-- est désormais une réservation ordinaire (bookings.is_trial), payée par le
-- crédit du pack d'essai offert à l'inscription. Elle tenait un compte séparé
-- de `bookings`, si bien que l'essai n'apparaissait ni dans « Mes réservations »
-- ni sur la liste de présence du coach.

-- Phase 9 : Demandes de factures
CREATE TABLE invoice_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  -- Pack commandé sur facture. NULL quand la demande porte sur un achat déjà
  -- réglé par carte (usage d'origine de cette table).
  pack_type_id UUID REFERENCES pack_types(id),
  amount_cents INTEGER,
  -- Encaissement pointé à la main par le studio. NULL = en attente. Sans
  -- effet sur les crédits : ils sont donnés dès la commande.
  paid_at TIMESTAMPTZ,
  invoice_number TEXT,
  -- Date de la facture émise dans Odoo, où la comptabilité est tenue.
  -- Distincte de created_at (la commande) et de paid_at (l'encaissement) :
  -- le numéro est connu bien avant le règlement.
  invoice_date DATE,
  pack_purchase_id UUID REFERENCES pack_purchases(id),
  company_name TEXT NOT NULL,
  address TEXT NOT NULL,
  vat_number TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'paid', 'cancelled', 'processed')),
  admin_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  processed_at TIMESTAMPTZ
);

-- Catalogue de types de performances (rameur, ski, poids…)
CREATE TABLE performance_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  unit_hint TEXT,
  color TEXT,
  display_order INTEGER NOT NULL DEFAULT 0,
  archived BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- Nature de la mesure : commande la forme du formulaire (deux champs
  -- min/sec pour un temps, un champ chiffré pour une charge) et l'affichage.
  measure_kind TEXT NOT NULL DEFAULT 'number'
    CHECK (measure_kind IN ('weight', 'time', 'reps', 'distance', 'number')),
  -- TRUE quand descendre est un progrès (chrono). Indépendant de
  -- `measure_kind` : un gainage se mesure en temps et s'améliore en montant.
  lower_is_better BOOLEAN NOT NULL DEFAULT FALSE
);

-- Entrées de performances par utilisateur
CREATE TABLE performances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  performance_type_id UUID NOT NULL REFERENCES performance_types(id) ON DELETE RESTRICT,
  date DATE NOT NULL,
  -- Ce que le membre voit : « 1:55 », « 50 kg ». Reste la source affichée.
  value TEXT NOT NULL,
  -- La même valeur en nombre, unité canonique : kg, SECONDES, répétitions,
  -- mètres. NULL si la saisie est ininterprétable — la ligne reste lisible,
  -- elle est simplement absente des courbes et des records.
  value_num NUMERIC,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_performances_user_date ON performances(user_id, date DESC);
CREATE INDEX idx_performances_type ON performances(performance_type_id);
-- Série d'un membre sur un mouvement : la requête des courbes.
CREATE INDEX performances_user_type_date
  ON performances (user_id, performance_type_id, date)
  WHERE value_num IS NOT NULL;

-- Convertit une saisie libre en nombre (secondes pour un temps). Renvoie NULL
-- si la valeur est ininterprétable : mieux vaut un point manquant qu'un point
-- faux. Sert au rattrapage de l'existant ; la saisie courante produit
-- directement les deux formes.
CREATE OR REPLACE FUNCTION parse_performance_value(p_value TEXT, p_kind TEXT)
RETURNS NUMERIC
LANGUAGE plpgsql
IMMUTABLE
AS $fn$
DECLARE
  v_clean TEXT;
  v_parts TEXT[];
BEGIN
  IF p_value IS NULL THEN RETURN NULL; END IF;

  v_clean := trim(replace(p_value, ',', '.'));

  IF v_clean ~ '^[0-9]+:[0-5][0-9]$' THEN
    v_parts := string_to_array(v_clean, ':');
    RETURN v_parts[1]::NUMERIC * 60 + v_parts[2]::NUMERIC;
  END IF;

  IF v_clean ~ '^[0-9]+:[0-5][0-9]:[0-5][0-9]$' THEN
    v_parts := string_to_array(v_clean, ':');
    RETURN v_parts[1]::NUMERIC * 3600 + v_parts[2]::NUMERIC * 60 + v_parts[3]::NUMERIC;
  END IF;

  IF v_clean ~ '^[0-9]+(\.[0-9]+)?\s*[a-zA-Z]*$' THEN
    RETURN (regexp_match(v_clean, '^([0-9]+(?:\.[0-9]+)?)'))[1]::NUMERIC;
  END IF;

  RETURN NULL;
END;
$fn$;

-- ============================================
-- Parrainage et bons d'achat
-- ============================================

-- Qui a parrainé qui. Un membre ne peut avoir qu'un seul parrain.
CREATE TABLE referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id UUID NOT NULL REFERENCES auth.users(id),
  referee_id UUID NOT NULL REFERENCES auth.users(id),
  referral_code TEXT NOT NULL,
  -- 'pending' tant que le filleul n'a rien payé.
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'qualified', 'rewarded')),
  referrer_reward_cents INTEGER DEFAULT 3000,
  referee_reward_cents INTEGER DEFAULT 3000,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  qualified_at TIMESTAMPTZ,
  rewarded_at TIMESTAMPTZ,
  UNIQUE(referee_id)
);

-- Bons d'achat, quelle que soit leur origine : parrainage ou geste du studio.
-- Un bon se consomme EN ENTIER — pas de solde partiel, donc pas de champ de
-- montant consommé.
CREATE TABLE referral_rewards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  -- Nul quand le bon vient d'un geste du studio et non d'un parrainage.
  referral_id UUID REFERENCES referrals(id),
  amount_cents INTEGER NOT NULL,
  is_used BOOLEAN DEFAULT FALSE,
  used_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  -- Code lisible au téléphone (BON-4F8A), posé par trigger.
  code TEXT,
  -- 'parrainage_filleul' est distingué : seul ce bon subit le montant
  -- d'achat minimum. Le parrain est déjà client.
  origin TEXT NOT NULL DEFAULT 'parrainage',
  granted_by UUID REFERENCES auth.users(id),
  reason TEXT,
  used_on TEXT CHECK (used_on IS NULL OR used_on IN ('pack', 'subscription', 'registration_fee')),
  CONSTRAINT referral_rewards_origin_check CHECK (
    origin IN ('parrainage', 'parrainage_filleul', 'geste_commercial', 'dedommagement', 'autre')
  )
);

CREATE UNIQUE INDEX idx_referral_rewards_code ON referral_rewards(code);
CREATE INDEX idx_referral_rewards_user_usable
  ON referral_rewards(user_id) WHERE is_used = FALSE;

-- Badges de progression du membre.
CREATE TABLE member_badges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  badge_type TEXT NOT NULL,
  earned_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, badge_type)
);

-- ============================================
-- 2. FONCTIONS
-- ============================================

-- Vérifier le rôle (super_admin hérite de admin)
CREATE OR REPLACE FUNCTION has_role(check_user_id UUID, check_role user_role)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = check_user_id
      AND (role = check_role OR (check_role = 'admin' AND role = 'super_admin'))
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Packs utilisables d'un membre pour un type de crédit.
-- Un pack illimité reste utilisable quel que soit credits_remaining.
-- Ordre : packs à crédits d'abord (ils expirent et se perdent),
-- illimité en filet.
-- La validité se juge à la DATE DU COURS quand elle est connue : sans cela, un
-- membre paierait un cours du cycle suivant avec le cycle courant.
--
-- TOLÉRANCE : un abonnement qui se renouvelle couvre les cours au-delà de son
-- terme. Sans elle, plus aucune réservation anticipée ne serait possible en fin
-- de cycle. Elle s'arrête là où le renouvellement s'arrête — un abonnement
-- résilié ne couvre rien au-delà.
CREATE OR REPLACE FUNCTION get_available_credits(
  p_user_id UUID,
  p_credit_type_id UUID,
  p_class_starts_at TIMESTAMPTZ
)
RETURNS TABLE(
  pack_purchase_id UUID,
  credits_remaining INTEGER,
  expires_at TIMESTAMPTZ,
  is_unlimited BOOLEAN,
  pack_name TEXT,
  subscription_id UUID,
  is_subscription BOOLEAN
) AS $$
  SELECT
    pp.id,
    pp.credits_remaining,
    pp.expires_at,
    pt.is_unlimited,
    pt.name,
    pp.subscription_id,
    (pp.subscription_id IS NOT NULL) AS is_subscription
  FROM pack_purchases pp
  JOIN pack_types pt ON pp.pack_type_id = pt.id
  LEFT JOIN subscriptions s ON s.id = pp.subscription_id
  WHERE pp.user_id = p_user_id
    AND pt.credit_type_id = p_credit_type_id
    AND (pt.is_unlimited OR pp.credits_remaining > 0)
    AND pp.expires_at > NOW()
    AND (
      p_class_starts_at IS NULL
      OR pp.expires_at > p_class_starts_at
      OR (s.id IS NOT NULL
          AND s.status = 'active'
          AND COALESCE(s.cancel_at_period_end, FALSE) = FALSE)
    )
    -- Plafond de fréquentation, fenêtre glissante centrée sur le cours visé.
    AND (
      pt.quota_sessions IS NULL
      OR p_class_starts_at IS NULL
      OR (SELECT COUNT(*) FROM bookings b
          JOIN scheduled_classes sc ON sc.id = b.scheduled_class_id
          WHERE b.user_id = p_user_id
            AND b.pack_purchase_id = pp.id
            AND b.status = 'confirmed'
            AND NOT sc.is_cancelled
            AND sc.starts_at > p_class_starts_at - (pt.quota_days || ' days')::INTERVAL
            AND sc.starts_at < p_class_starts_at + (pt.quota_days || ' days')::INTERVAL
         ) < pt.quota_sessions
    )
  -- Abonnement d'abord : il est déjà facturé, les crédits achetés à côté
  -- restent au membre. Entre deux packs, celui qui expire le plus tôt.
  ORDER BY (pp.subscription_id IS NOT NULL) DESC, pp.expires_at ASC;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

COMMENT ON FUNCTION get_available_credits(UUID, UUID, TIMESTAMPTZ) IS
  'Sources de paiement d''un membre, abonnement en tête. Si `p_class_starts_at` est fourni, écarte les packs qui ne couvrent pas la date du cours — sauf abonnement en cours de renouvellement — et ceux dont le quota du cycle est épuisé.';

-- Raccourci sans date de cours : affichage des crédits, achat.
CREATE OR REPLACE FUNCTION get_available_credits(p_user_id UUID, p_credit_type_id UUID)
RETURNS TABLE(
  pack_purchase_id UUID,
  credits_remaining INTEGER,
  expires_at TIMESTAMPTZ,
  is_unlimited BOOLEAN,
  pack_name TEXT,
  subscription_id UUID,
  is_subscription BOOLEAN
) AS $$
  SELECT * FROM get_available_credits(p_user_id, p_credit_type_id, NULL::TIMESTAMPTZ);
$$ LANGUAGE sql SECURITY DEFINER STABLE;

COMMENT ON FUNCTION get_available_credits(UUID, UUID) IS
  'Raccourci sans date de cours : ne filtre ni sur la couverture du cycle ni sur le quota. Pour une réservation, préférer la variante à trois arguments.';

-- Décrémenter un crédit (réservation). Sans effet sur un pack illimité.
CREATE OR REPLACE FUNCTION consume_credit(p_pack_purchase_id UUID)
RETURNS VOID AS $$
  UPDATE pack_purchases pp
  SET credits_remaining = pp.credits_remaining - 1
  FROM pack_types pt
  WHERE pp.id = p_pack_purchase_id
    AND pp.pack_type_id = pt.id
    AND NOT pt.is_unlimited
    AND pp.credits_remaining > 0;
$$ LANGUAGE sql SECURITY DEFINER;

-- Restituer un crédit (annulation dans les délais).
-- Symétrique de consume_credit : sans effet sur un pack illimité, puisque
-- rien n'a été décompté à la réservation.
CREATE OR REPLACE FUNCTION refund_credit(p_pack_purchase_id UUID)
RETURNS VOID AS $$
  UPDATE pack_purchases pp
  SET credits_remaining = pp.credits_remaining + 1
  FROM pack_types pt
  WHERE pp.id = p_pack_purchase_id
    AND pp.pack_type_id = pt.id
    AND NOT pt.is_unlimited;
$$ LANGUAGE sql SECURITY DEFINER;

-- ---------------------------------------------------------------------------
-- Plafond de fréquentation : N cours par D jours
-- ---------------------------------------------------------------------------
-- FENÊTRE GLISSANTE CENTRÉE sur la séance visée : on compte les cours situés à
-- moins de D jours AVANT ou APRÈS. Les deux côtés comptent, sinon l'ordre des
-- réservations suffit à contourner la règle — réserver du plus lointain au plus
-- proche laisserait chaque fenêtre arrière vide au moment du test.
--
-- D EST BORNÉ À 14 JOURS (contrainte sur la table) : au-delà, un plafond ne
-- contraint plus le rythme, il déplace la surconsommation.
--
-- LA FENÊTRE IGNORE LES CYCLES, volontairement : le plafond limite le rythme
-- physique, pas la facturation.
CREATE OR REPLACE FUNCTION check_pack_quota(
  p_user_id UUID,
  p_pack_purchase_id UUID,
  p_class_starts_at TIMESTAMPTZ DEFAULT NULL
)
RETURNS JSONB
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
STABLE
AS $fn$
DECLARE
  v_quota INTEGER;
  v_days  INTEGER;
  v_used  INTEGER;
BEGIN
  SELECT pt.quota_sessions, pt.quota_days
    INTO v_quota, v_days
  FROM pack_purchases pp
  JOIN pack_types pt ON pt.id = pp.pack_type_id
  WHERE pp.id = p_pack_purchase_id;

  -- Sans plafond, ou sans date de cours (la fenêtre en dépend) : rien à dire.
  IF v_quota IS NULL OR p_class_starts_at IS NULL THEN
    RETURN jsonb_build_object('ok', true);
  END IF;

  SELECT COUNT(*) INTO v_used
  FROM bookings b
  JOIN scheduled_classes sc ON sc.id = b.scheduled_class_id
  WHERE b.user_id = p_user_id
    AND b.pack_purchase_id = p_pack_purchase_id
    AND b.status = 'confirmed'
    AND NOT sc.is_cancelled
    AND sc.starts_at > p_class_starts_at - (v_days || ' days')::INTERVAL
    AND sc.starts_at < p_class_starts_at + (v_days || ' days')::INTERVAL;

  RETURN jsonb_build_object(
    'ok', v_used < v_quota,
    'reason', CASE WHEN v_used >= v_quota THEN 'quota_reached' ELSE NULL END,
    'quota_sessions', v_quota,
    'quota_days', v_days,
    'used', v_used,
    'remaining', GREATEST(0, v_quota - v_used)
  );
END;
$fn$;

COMMENT ON FUNCTION check_pack_quota IS
  'Le plafond est-il atteint ? Compte les cours du membre situés à moins de `quota_days` avant ou après la séance visée.';

-- Le quota se fait respecter par un TRIGGER : les réservations partent d'un
-- INSERT direct depuis le front, donc un contrôle appelé côté client serait
-- décoratif. Le STAFF passe outre, comme il ignore déjà le délai de fermeture.
CREATE OR REPLACE FUNCTION enforce_unlimited_quota()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $fn$
DECLARE
  v_starts_at TIMESTAMPTZ;
  v_check     JSONB;
BEGIN
  IF NEW.pack_purchase_id IS NULL OR NEW.status <> 'confirmed' THEN
    RETURN NEW;
  END IF;

  IF has_role(auth.uid(), 'coach')
     OR has_role(auth.uid(), 'admin')
     OR has_role(auth.uid(), 'super_admin') THEN
    RETURN NEW;
  END IF;

  SELECT starts_at INTO v_starts_at
  FROM scheduled_classes WHERE id = NEW.scheduled_class_id;

  v_check := check_pack_quota(NEW.user_id, NEW.pack_purchase_id, v_starts_at);

  IF (v_check->>'ok')::BOOLEAN IS NOT TRUE THEN
    RAISE EXCEPTION 'quota_reached: % cours par % jours',
      v_check->>'quota_sessions', v_check->>'quota_days'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$fn$;

DROP TRIGGER IF EXISTS trg_enforce_unlimited_quota ON bookings;
CREATE TRIGGER trg_enforce_unlimited_quota
  BEFORE INSERT ON bookings
  FOR EACH ROW
  EXECUTE FUNCTION enforce_unlimited_quota();

-- Pourquoi aucun crédit ne couvre ce cours ? Une liste vide ne dit pas
-- pourquoi. Quatre causes se cachent derrière, et les confondre sous « aucun
-- crédit » enverrait vers la boutique quelqu'un qui a déjà payé.
CREATE OR REPLACE FUNCTION why_no_credit_for_class(
  p_user_id UUID,
  p_class_id UUID
)
RETURNS JSONB
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
STABLE
AS $fn$
DECLARE
  v_class RECORD;
  v_pack  RECORD;
BEGIN
  SELECT sc.starts_at, ct.credit_type_id
    INTO v_class
  FROM scheduled_classes sc
  JOIN class_types ct ON ct.id = sc.class_type_id
  WHERE sc.id = p_class_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('reason', 'class_not_found');
  END IF;

  -- 1. Un pack du bon type, valide, couvrant le cours, mais au plafond.
  SELECT pt.quota_sessions, pt.quota_days INTO v_pack
  FROM pack_purchases pp
  JOIN pack_types pt ON pt.id = pp.pack_type_id
  WHERE pp.user_id = p_user_id
    AND pt.credit_type_id = v_class.credit_type_id
    AND pp.expires_at > NOW()
    AND pt.quota_sessions IS NOT NULL
    AND (pt.is_unlimited OR pp.credits_remaining > 0)
    AND (SELECT COUNT(*) FROM bookings b
         JOIN scheduled_classes sc2 ON sc2.id = b.scheduled_class_id
         WHERE b.user_id = p_user_id
           AND b.pack_purchase_id = pp.id
           AND b.status = 'confirmed'
           AND NOT sc2.is_cancelled
           AND sc2.starts_at > v_class.starts_at - (pt.quota_days || ' days')::INTERVAL
           AND sc2.starts_at < v_class.starts_at + (pt.quota_days || ' days')::INTERVAL
        ) >= pt.quota_sessions
  LIMIT 1;

  IF FOUND THEN
    RETURN jsonb_build_object('reason', 'quota_reached',
                              'quota_sessions', v_pack.quota_sessions,
                              'quota_days', v_pack.quota_days);
  END IF;

  -- 2. Un abonnement RÉSILIÉ dont le terme tombe avant le cours.
  SELECT s.current_period_end INTO v_pack
  FROM pack_purchases pp
  JOIN pack_types pt ON pt.id = pp.pack_type_id
  JOIN subscriptions s ON s.id = pp.subscription_id
  WHERE pp.user_id = p_user_id
    AND pt.credit_type_id = v_class.credit_type_id
    AND pp.expires_at > NOW()
    AND pp.expires_at <= v_class.starts_at
    AND (s.status <> 'active' OR COALESCE(s.cancel_at_period_end, FALSE))
  LIMIT 1;

  IF FOUND THEN
    RETURN jsonb_build_object(
      'reason', 'subscription_ending',
      'detail', to_char(v_pack.current_period_end AT TIME ZONE 'Europe/Brussels', 'DD/MM/YYYY'));
  END IF;

  -- 3. Un abonnement À JOUR dont les crédits sont épuisés : le prochain cycle
  -- les rechargera. Le membre n'a rien à racheter, juste à attendre.
  SELECT pp.expires_at INTO v_pack
  FROM pack_purchases pp
  JOIN pack_types pt ON pt.id = pp.pack_type_id
  JOIN subscriptions s ON s.id = pp.subscription_id
  WHERE pp.user_id = p_user_id
    AND pt.credit_type_id = v_class.credit_type_id
    AND pp.expires_at > NOW()
    AND NOT pt.is_unlimited
    AND pp.credits_remaining <= 0
    AND s.status = 'active'
    AND COALESCE(s.cancel_at_period_end, FALSE) = FALSE
  ORDER BY pp.expires_at ASC
  LIMIT 1;

  IF FOUND THEN
    RETURN jsonb_build_object(
      'reason', 'credits_exhausted_renewal',
      'detail', to_char(v_pack.expires_at AT TIME ZONE 'Europe/Brussels', 'DD/MM/YYYY'),
      'after_renewal', v_class.starts_at >= v_pack.expires_at);
  END IF;

  RETURN jsonb_build_object('reason', 'no_credit');
END;
$fn$;

COMMENT ON FUNCTION why_no_credit_for_class IS
  'Explique pourquoi aucun crédit ne couvre ce cours : plafond atteint, abonnement se terminant avant la séance, crédits épuisés en attente de renouvellement, ou absence réelle de crédit.';

-- Où en est le membre sur son plafond ? Un plafond qu'on découvre en butant
-- dessus au moment de réserver est vécu comme une panne. La fenêtre étant
-- glissante, on la calcule autour d'AUJOURD'HUI.
CREATE OR REPLACE FUNCTION my_pack_quota_usage()
RETURNS TABLE (
  pack_purchase_id UUID,
  quota_sessions INTEGER,
  quota_days INTEGER,
  used INTEGER,
  remaining INTEGER
)
SECURITY DEFINER
SET search_path = public
LANGUAGE sql
STABLE
AS $fn$
  SELECT pp.id,
         pt.quota_sessions,
         pt.quota_days,
         COUNT(b.id)::INTEGER,
         GREATEST(0, pt.quota_sessions - COUNT(b.id))::INTEGER
  FROM pack_purchases pp
  JOIN pack_types pt ON pt.id = pp.pack_type_id
  LEFT JOIN bookings b ON b.pack_purchase_id = pp.id
    AND b.user_id = auth.uid()
    AND b.status = 'confirmed'
    AND EXISTS (SELECT 1 FROM scheduled_classes sc
                WHERE sc.id = b.scheduled_class_id
                  AND NOT sc.is_cancelled
                  AND sc.starts_at > NOW() - (pt.quota_days || ' days')::INTERVAL
                  AND sc.starts_at < NOW() + (pt.quota_days || ' days')::INTERVAL)
  WHERE pp.user_id = auth.uid()
    AND pt.quota_sessions IS NOT NULL
    AND pp.expires_at > NOW()
  GROUP BY pp.id, pt.quota_sessions, pt.quota_days;
$fn$;

COMMENT ON FUNCTION my_pack_quota_usage IS
  'Consommation du plafond sur la fenêtre glissante autour d''aujourd''hui. Vide si aucun pack de l''appelant n''a de plafond.';

REVOKE ALL ON FUNCTION check_pack_quota(UUID, UUID, TIMESTAMPTZ) FROM PUBLIC;
REVOKE ALL ON FUNCTION why_no_credit_for_class(UUID, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION my_pack_quota_usage() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION check_pack_quota(UUID, UUID, TIMESTAMPTZ) TO authenticated;
GRANT EXECUTE ON FUNCTION why_no_credit_for_class(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION my_pack_quota_usage() TO authenticated;

-- Revenu d'une réservation.
-- Pack à crédits : prix / credit_count.
-- Pack illimité : prix / séances réellement consommées — credit_count n'a
-- pas de sens comme diviseur et vaudrait 0 (division par zéro).
CREATE OR REPLACE FUNCTION booking_revenue(p_booking_id UUID)
RETURNS NUMERIC AS $$
  SELECT CASE
    WHEN pt.is_unlimited THEN
      (pp.price_paid_cents::NUMERIC / GREATEST(
        (SELECT COUNT(*) FROM bookings b2
          WHERE b2.pack_purchase_id = pp.id
            AND b2.status <> 'cancelled'), 1)) / 100
    WHEN pt.credit_count > 0 THEN
      (pp.price_paid_cents::NUMERIC / pt.credit_count) / 100
    ELSE 0
  END
  FROM bookings b
  JOIN pack_purchases pp ON b.pack_purchase_id = pp.id
  JOIN pack_types pt ON pp.pack_type_id = pt.id
  WHERE b.id = p_booking_id;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Incrémenter l'utilisation d'un coupon
CREATE OR REPLACE FUNCTION increment_coupon_usage(p_coupon_id UUID)
RETURNS VOID AS $$
  UPDATE coupons
  SET current_uses = current_uses + 1
  WHERE id = p_coupon_id;
$$ LANGUAGE sql SECURITY DEFINER;

-- Prochaine position liste d'attente
CREATE OR REPLACE FUNCTION next_waitlist_position(p_scheduled_class_id UUID)
RETURNS INTEGER AS $$
  SELECT COALESCE(MAX(position), 0) + 1
  FROM waitlist
  WHERE scheduled_class_id = p_scheduled_class_id
    AND status IN ('waiting', 'offered');
$$ LANGUAGE sql STABLE;

-- Déposer un e-mail à envoyer. Appelée depuis les fonctions SQL, qui ne
-- peuvent pas joindre les Edge Functions.
CREATE OR REPLACE FUNCTION queue_email(
  p_user_id UUID,
  p_template TEXT,
  p_vars JSONB DEFAULT '{}'::jsonb
)
RETURNS UUID
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $fn$
DECLARE
  v_id UUID;
BEGIN
  INSERT INTO email_queue (user_id, template, vars)
  VALUES (p_user_id, p_template, p_vars)
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$fn$;

-- Promouvoir le premier en liste d'attente.
-- Notification ET e-mail : l'offre expire en 2 h, l'application seule ne
-- suffit pas à prévenir à temps — il faudrait que le membre l'ouvre par
-- hasard dans ce créneau.
CREATE OR REPLACE FUNCTION promote_from_waitlist(p_scheduled_class_id UUID)
RETURNS UUID
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $fn$
DECLARE
  v_waitlist_entry RECORD;
  v_class          RECORD;
  v_expires_at     TIMESTAMPTZ;
BEGIN
  SELECT * INTO v_waitlist_entry
  FROM waitlist
  WHERE scheduled_class_id = p_scheduled_class_id AND status = 'waiting'
  ORDER BY position ASC LIMIT 1;

  IF v_waitlist_entry.id IS NULL THEN RETURN NULL; END IF;

  v_expires_at := NOW() + interval '2 hours';

  UPDATE waitlist
  SET status = 'offered', notified_at = NOW(), expires_at = v_expires_at
  WHERE id = v_waitlist_entry.id;

  -- De quoi nommer le cours dans l'e-mail : « une place s'est libérée » sans
  -- dire laquelle obligerait le membre à ouvrir l'application pour comprendre.
  SELECT sc.starts_at, sc.duration_minutes, sc.floor,
         COALESCE(sc.title, ct.name) AS class_name,
         co.display_name AS coach_name
    INTO v_class
  FROM scheduled_classes sc
  LEFT JOIN class_types ct ON ct.id = sc.class_type_id
  LEFT JOIN profiles co    ON co.id = sc.coach_id
  WHERE sc.id = p_scheduled_class_id;

  INSERT INTO notifications (user_id, title, message, type, link, email_template)
  VALUES (v_waitlist_entry.user_id, 'Place disponible !',
    'Une place s''est libérée pour votre cours. Vous avez 2h pour confirmer.',
    'success', '/schedule', 'waitlist_spot_offered');

  PERFORM queue_email(
    v_waitlist_entry.user_id,
    'waitlist_spot_offered',
    jsonb_build_object(
      'class_name', COALESCE(v_class.class_name, 'votre cours'),
      'class_date', to_char(v_class.starts_at AT TIME ZONE 'Europe/Brussels', 'DD/MM/YYYY à HH24:MI'),
      'coach_name', v_class.coach_name,
      'room_name', CASE v_class.floor
                     WHEN 'haut' THEN 'Étage'
                     WHEN 'bas'  THEN 'Rez-de-chaussée'
                     ELSE NULL END,
      'duration_minutes', v_class.duration_minutes,
      'expires_at', to_char(v_expires_at AT TIME ZONE 'Europe/Brussels', 'HH24:MI')
    )
  );

  RETURN v_waitlist_entry.id;
END;
$fn$;

-- Compter les réservations confirmées
CREATE OR REPLACE FUNCTION class_bookings_count(p_scheduled_class_id UUID)
RETURNS INTEGER AS $$
  SELECT COUNT(*)::INTEGER FROM bookings
  WHERE scheduled_class_id = p_scheduled_class_id AND status = 'confirmed';
$$ LANGUAGE sql STABLE;

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Phase 3 : Mettre à jour le statut d'un membre
-- Statut de membre : suit le parcours réel (défini le 2026-08-28).
--
--   visitor    premier contact — compte créé, aucun essai réservé
--   potential  a réservé son cours d'essai
--   active     a acheté un pack payant, et en a un en cours
--   inactive   a acheté, plus de pack valide, échéance de moins de 4 semaines
--   former     échéance du dernier pack dépassée de plus de 4 semaines
--
-- Les frais d'inscription ne sont PAS regardés : on ne peut pas acheter un pack
-- sans les avoir payés (contrôle à l'achat), donc les tester ici serait
-- redondant — et trompeur, des frais offerts ou saisis en retard faisant
-- apparaître comme « potentiel » quelqu'un qui s'entraîne depuis des semaines.
--
-- L'essai se reconnaît au PACK utilisé (`pack_types.is_trial`) et non au
-- drapeau `bookings.is_trial` : le premier est un fait, le second une copie
-- qu'il faut penser à poser. Les deux divergeaient en base.
CREATE OR REPLACE FUNCTION update_member_status(p_user_id UUID)
RETURNS TEXT
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_a_achete BOOLEAN;
  v_a_essaye BOOLEAN;
  v_fin_dernier_pack TIMESTAMPTZ;
  v_pack_actif BOOLEAN;
  v_status TEXT;
BEGIN
  SELECT EXISTS(
    SELECT 1 FROM pack_purchases pp
      JOIN pack_types pt ON pt.id = pp.pack_type_id
     WHERE pp.user_id = p_user_id AND NOT pt.is_trial
  ) INTO v_a_achete;

  IF NOT v_a_achete THEN
    SELECT EXISTS(
      SELECT 1 FROM bookings b
        JOIN pack_purchases pp ON pp.id = b.pack_purchase_id
        JOIN pack_types pt ON pt.id = pp.pack_type_id
       WHERE b.user_id = p_user_id AND pt.is_trial
    ) INTO v_a_essaye;

    -- La réservation suffit : la séance n'a pas à avoir eu lieu.
    v_status := CASE WHEN v_a_essaye THEN 'potential' ELSE 'visitor' END;
  ELSE
    SELECT EXISTS(
      SELECT 1 FROM pack_purchases
       WHERE user_id = p_user_id AND credits_remaining > 0 AND expires_at > NOW()
    ) INTO v_pack_actif;

    IF v_pack_actif THEN
      v_status := 'active';
    ELSE
      SELECT MAX(pp.expires_at) INTO v_fin_dernier_pack
        FROM pack_purchases pp
        JOIN pack_types pt ON pt.id = pp.pack_type_id
       WHERE pp.user_id = p_user_id AND NOT pt.is_trial;

      IF v_fin_dernier_pack IS NULL OR v_fin_dernier_pack > NOW() - INTERVAL '4 weeks' THEN
        -- Quatre semaines de grace : entre deux achats, on reste un membre.
        -- Seul changement du 2026-08-29 — la version precedente posait
        -- `inactive` ici, un troisieme etat pour dire ce que `active` disait
        -- deja : le membre n'a pas quitte le studio.
        v_status := 'active';
      ELSE
        v_status := 'former';
      END IF;
    END IF;
  END IF;

  UPDATE profiles SET member_status = v_status WHERE id = p_user_id;
  RETURN v_status;
END;
$fn$;

-- Les trois étapes du parcours, comptées sur une période : comptes créés,
-- premier essai réservé, premier pack payant acheté.
--
-- Trois chiffres bruts, sans quotient. Un taux « achats / essais » dépassait
-- 100 % en pratique : on peut acheter un pack sans être passé par l'essai, ou
-- essayer un mois et acheter le suivant — numérateur et dénominateur ne portent
-- pas sur les mêmes personnes. Trois nombres côte à côte se lisent sans piège.
--
-- On date la TRANSITION et non l'état courant : quelqu'un devenu membre en juin
-- ne compte pas dans les achats de juillet. D'où les MIN().
CREATE OR REPLACE FUNCTION stats_parcours(p_from TIMESTAMPTZ, p_to TIMESTAMPTZ)
RETURNS TABLE (inscriptions BIGINT, essais BIGINT, achats BIGINT)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $fn$
BEGIN
  -- SECURITY DEFINER : sans ce contrôle, tout membre connecté lirait les
  -- statistiques commerciales du studio.
  IF NOT has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Réservé aux administrateurs';
  END IF;

  RETURN QUERY
  WITH bascules AS (
    SELECT p.id, p.created_at AS inscrit_le,
      (SELECT MIN(b.created_at) FROM bookings b
         JOIN pack_purchases pp ON pp.id = b.pack_purchase_id
         JOIN pack_types pt ON pt.id = pp.pack_type_id
        WHERE b.user_id = p.id AND pt.is_trial) AS essaye_le,
      (SELECT MIN(pp.purchased_at) FROM pack_purchases pp
         JOIN pack_types pt ON pt.id = pp.pack_type_id
        WHERE pp.user_id = p.id AND NOT pt.is_trial) AS achete_le
    FROM profiles p
    WHERE p.deleted_at IS NULL
  )
  SELECT
    COUNT(*) FILTER (WHERE inscrit_le BETWEEN p_from AND p_to),
    COUNT(*) FILTER (WHERE essaye_le  BETWEEN p_from AND p_to),
    COUNT(*) FILTER (WHERE achete_le  BETWEEN p_from AND p_to)
  FROM bascules;
END;
$fn$;

REVOKE ALL ON FUNCTION stats_parcours(TIMESTAMPTZ, TIMESTAMPTZ) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION stats_parcours(TIMESTAMPTZ, TIMESTAMPTZ) TO authenticated;

-- Phase 3 : Vérifier frais d'inscription
CREATE OR REPLACE FUNCTION has_registration_fee(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql SECURITY DEFINER STABLE
AS $$
  SELECT EXISTS (SELECT 1 FROM registration_fees WHERE user_id = p_user_id);
$$;

-- Phase 3 : Vérifier séance d'essai
-- L'essai consommé se lit sur la réservation : une seule source de vérité.
CREATE OR REPLACE FUNCTION has_used_trial(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM bookings
    WHERE user_id = p_user_id AND is_trial AND status = 'confirmed'
  );
$$;

-- Attribuer la séance d'essai offerte.
--
-- Volontairement PAS dans handle_new_user() : ce trigger avale ses erreurs
-- (EXCEPTION WHEN OTHERS ... RAISE LOG), si bien qu'un échec d'attribution
-- passerait inaperçu. Ici la fonction est appelée explicitement et son
-- résultat est lisible. Idempotente : un second appel ne crée pas un
-- deuxième crédit.
CREATE OR REPLACE FUNCTION grant_trial_pack(p_user_id UUID)
RETURNS JSONB
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $fn$
DECLARE
  v_settings      JSONB;
  v_pack          pack_types%ROWTYPE;
  v_validity_days INTEGER;
  v_purchase_id   UUID;
BEGIN
  SELECT value INTO v_settings FROM app_settings WHERE key = 'trial_pack';

  IF COALESCE((v_settings->>'enabled')::BOOLEAN, TRUE) IS NOT TRUE THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'disabled');
  END IF;

  SELECT * INTO v_pack FROM pack_types WHERE is_trial AND is_active LIMIT 1;
  IF v_pack.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'no_trial_pack');
  END IF;

  -- Déjà attribué : on ne redonne pas un crédit à chaque appel. C'est aussi ce
  -- qui répond à « cette personne a-t-elle eu son essai ? ».
  IF EXISTS (
    SELECT 1 FROM pack_purchases
    WHERE user_id = p_user_id AND pack_type_id = v_pack.id
  ) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'already_granted');
  END IF;

  v_validity_days := COALESCE((v_settings->>'validity_days')::INTEGER, v_pack.validity_days, 30);

  INSERT INTO pack_purchases (
    user_id, pack_type_id, price_paid_cents, credits_remaining,
    purchased_at, expires_at
  ) VALUES (
    p_user_id, v_pack.id, 0, v_pack.credit_count,
    NOW(), NOW() + (v_validity_days || ' days')::INTERVAL
  )
  RETURNING id INTO v_purchase_id;

  RETURN jsonb_build_object(
    'ok', true,
    'purchase_id', v_purchase_id,
    'expires_at', NOW() + (v_validity_days || ' days')::INTERVAL
  );
END;
$fn$;

-- Retirer la séance d'essai d'un membre, depuis sa fiche (espace admin).
-- Un essai intact est supprimé ; un essai déjà utilisé est vidé et périmé —
-- `bookings.pack_purchase_id` le référence sans ON DELETE, et l'effacer
-- détacherait la réservation de ce qui l'a payée.

CREATE OR REPLACE FUNCTION retirer_pack_essai(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pack       RECORD;
  v_utilise    INTEGER;
  v_supprimes  INTEGER := 0;
  v_neutralises INTEGER := 0;
BEGIN
  -- Réservé au staff : le membre ne retire pas sa propre séance d'essai, et
  -- surtout ne retire pas celle d'un autre.
  IF NOT (has_role(auth.uid(), 'coach') OR has_role(auth.uid(), 'admin')) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'forbidden');
  END IF;

  FOR v_pack IN
    SELECT pp.id, pp.credits_remaining
      FROM pack_purchases pp
      JOIN pack_types pt ON pt.id = pp.pack_type_id
     WHERE pp.user_id = p_user_id AND pt.is_trial
  LOOP
    SELECT count(*) INTO v_utilise
      FROM (
        SELECT 1 FROM bookings WHERE pack_purchase_id = v_pack.id
        UNION ALL
        SELECT 1 FROM invoice_requests WHERE pack_purchase_id = v_pack.id
      ) AS traces;

    IF v_utilise = 0 THEN
      DELETE FROM pack_purchases WHERE id = v_pack.id;
      v_supprimes := v_supprimes + 1;
    ELSE
      UPDATE pack_purchases
         SET credits_remaining = 0,
             expires_at = LEAST(expires_at, NOW())
       WHERE id = v_pack.id;
      v_neutralises := v_neutralises + 1;
    END IF;
  END LOOP;

  IF v_supprimes = 0 AND v_neutralises = 0 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'aucun_essai');
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'supprimes', v_supprimes,
    'neutralises', v_neutralises
  );
END;
$$;

REVOKE ALL ON FUNCTION retirer_pack_essai(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION retirer_pack_essai(UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.grant_trial_on_profile_create()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $fn$
BEGIN
  PERFORM grant_trial_pack(NEW.id);
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Un essai non attribué ne doit pas empêcher la création du compte, mais
  -- l'incident doit rester visible : journalisé, pas avalé en silence.
  RAISE WARNING 'grant_trial_on_profile_create(%) a échoué : %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$fn$;

-- Écarter de l'accueil les communications déjà lues. Ne touche pas aux non
-- lues : les balayer ferait perdre l'information au membre.
CREATE OR REPLACE FUNCTION dismiss_read_notifications()
RETURNS INTEGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $fn$
DECLARE
  v_count INTEGER;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentification requise';
  END IF;

  WITH ecartees AS (
    UPDATE notifications
       SET dismissed_at = NOW()
     WHERE user_id = auth.uid()
       AND is_read
       AND dismissed_at IS NULL
    RETURNING 1
  )
  SELECT COUNT(*) INTO v_count FROM ecartees;

  RETURN v_count;
END;
$fn$;


-- ---------------------------------------------------------------------------
-- Suppression de compte par le membre (Apple l'exige depuis 2022, RGPD art. 17)
-- ---------------------------------------------------------------------------
-- On ANONYMISE plutôt qu'on efface : le droit comptable belge impose sept ans
-- de conservation des pièces justificatives. La personne disparaît, la
-- comptabilité reste, sans lien identifiable.
CREATE OR REPLACE FUNCTION can_delete_own_account()
RETURNS JSONB
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $fn$
DECLARE
  v_uid           UUID := auth.uid();
  v_sub_count     INTEGER;
  v_future_count  INTEGER;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_authenticated');
  END IF;

  SELECT COUNT(*) INTO v_sub_count
  FROM subscriptions
  WHERE user_id = v_uid AND status IN ('active', 'past_due', 'paused', 'incomplete');

  -- Un abonnement actif bloque : sans compte, le membre ne pourrait plus le
  -- résilier et continuerait d'être prélevé.
  IF v_sub_count > 0 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'active_subscription');
  END IF;

  SELECT COUNT(*) INTO v_future_count
  FROM bookings b
  JOIN scheduled_classes sc ON sc.id = b.scheduled_class_id
  WHERE b.user_id = v_uid AND b.status = 'confirmed' AND sc.starts_at > NOW();

  RETURN jsonb_build_object('ok', true, 'upcoming_bookings', v_future_count);
END;
$fn$;

CREATE OR REPLACE FUNCTION delete_own_account()
RETURNS JSONB
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $fn$
DECLARE
  v_uid   UUID := auth.uid();
  v_check JSONB;
  v_tag   TEXT;
BEGIN
  v_check := can_delete_own_account();
  IF NOT (v_check->>'ok')::BOOLEAN THEN
    RETURN v_check;
  END IF;

  v_tag := 'Membre supprimé #' || substr(v_uid::text, 1, 8);

  -- Les cours à venir sont libérés par l'annulation ordinaire : la liste
  -- d'attente est prévenue et le crédit traité selon la règle du délai.
  PERFORM cancel_booking_v2(b.id, v_uid)
  FROM bookings b
  JOIN scheduled_classes sc ON sc.id = b.scheduled_class_id
  WHERE b.user_id = v_uid AND b.status = 'confirmed' AND sc.starts_at > NOW();

  DELETE FROM waitlist WHERE user_id = v_uid;

  UPDATE profiles SET
    display_name            = v_tag,
    first_name              = NULL,
    last_name               = NULL,
    email                   = NULL,
    phone                   = NULL,
    date_of_birth           = NULL,
    address                 = NULL,
    bio                     = NULL,
    avatar_url              = NULL,
    emergency_contact_name  = NULL,
    emergency_contact_phone = NULL,
    objectives              = NULL,
    medical_conditions      = NULL,
    fitness_level           = NULL,
    instagram_url           = NULL,
    facebook_url            = NULL,
    linkedin_url            = NULL,
    coach_description       = NULL,
    referral_code           = NULL,
    member_status           = 'former',
    deleted_at              = NOW()
  WHERE id = v_uid;

  DELETE FROM notifications WHERE user_id = v_uid;
  DELETE FROM email_queue WHERE user_id = v_uid;
  -- Données de santé au sens du RGPD : aucune raison de les garder.
  DELETE FROM performances WHERE user_id = v_uid;
  DELETE FROM user_roles WHERE user_id = v_uid;

  INSERT INTO activity_log (action, actor_id, target_user_id, entity_type, entity_id, description)
  VALUES ('account_deleted', v_uid, v_uid, 'profile', v_uid,
          'Compte fermé à la demande du membre — données personnelles anonymisées');

  RETURN jsonb_build_object('ok', true);
END;
$fn$;

REVOKE ALL ON FUNCTION can_delete_own_account() FROM PUBLIC;
REVOKE ALL ON FUNCTION delete_own_account() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION can_delete_own_account() TO authenticated;
GRANT EXECUTE ON FUNCTION delete_own_account() TO authenticated;

CREATE INDEX IF NOT EXISTS profiles_active
  ON profiles (member_status)
  WHERE deleted_at IS NULL;


-- Suppression d'un compte par le studio, à la demande du membre.
-- Mêmes règles que la version libre-service ; la différence tient à la
-- traçabilité : le journal retient QUI a supprimé et le nom d'origine, seul
-- endroit où il subsiste.
CREATE OR REPLACE FUNCTION delete_member_account(p_user_id UUID)
RETURNS JSONB
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $fn$
DECLARE
  v_actor  UUID := auth.uid();
  v_subs   INTEGER;
  v_tag    TEXT;
  v_name   TEXT;
BEGIN
  IF NOT (has_role(v_actor, 'admin') OR has_role(v_actor, 'super_admin')) THEN
    RAISE EXCEPTION 'Reserve aux administrateurs';
  END IF;

  -- Personne ne supprime un super admin : le studio perdrait son accès.
  IF has_role(p_user_id, 'super_admin') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'super_admin_protected');
  END IF;

  SELECT display_name INTO v_name FROM profiles WHERE id = p_user_id;
  IF v_name IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
  END IF;

  SELECT COUNT(*) INTO v_subs
  FROM subscriptions
  WHERE user_id = p_user_id AND status IN ('active', 'past_due', 'paused', 'incomplete');

  -- Stripe ne sait rien de la suppression : il continuerait de prélever.
  IF v_subs > 0 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'active_subscription');
  END IF;

  v_tag := 'Membre supprimé #' || substr(p_user_id::text, 1, 8);

  PERFORM cancel_booking_by_studio(b.id)
  FROM bookings b
  JOIN scheduled_classes sc ON sc.id = b.scheduled_class_id
  WHERE b.user_id = p_user_id AND b.status = 'confirmed' AND sc.starts_at > NOW();

  DELETE FROM waitlist WHERE user_id = p_user_id;

  UPDATE profiles SET
    display_name = v_tag, first_name = NULL, last_name = NULL, email = NULL,
    phone = NULL, date_of_birth = NULL, address = NULL, bio = NULL,
    avatar_url = NULL, emergency_contact_name = NULL,
    emergency_contact_phone = NULL, objectives = NULL,
    medical_conditions = NULL, fitness_level = NULL, instagram_url = NULL,
    facebook_url = NULL, linkedin_url = NULL, coach_description = NULL,
    referral_code = NULL, member_status = 'former', deleted_at = NOW()
  WHERE id = p_user_id;

  DELETE FROM notifications WHERE user_id = p_user_id;
  DELETE FROM email_queue WHERE user_id = p_user_id;
  DELETE FROM performances WHERE user_id = p_user_id;
  DELETE FROM user_roles WHERE user_id = p_user_id;

  INSERT INTO activity_log (action, actor_id, target_user_id, entity_type, entity_id, details, description)
  VALUES ('account_deleted', v_actor, p_user_id, 'profile', p_user_id,
          jsonb_build_object('deleted_by_staff', true, 'former_name', v_name),
          format('Compte de %s supprimé par le studio — données personnelles anonymisées', v_name));

  RETURN jsonb_build_object('ok', true, 'former_name', v_name);
END;
$fn$;

REVOKE ALL ON FUNCTION delete_member_account(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION delete_member_account(UUID) TO authenticated;

-- Seconde étape, pour le super_admin : effacer pour de bon un compte déjà
-- anonymisé sur lequel il ne reste aucune trace comptable. Libère l'adresse
-- e-mail, que `delete_member_account` laisse prise dans auth.users.
CREATE OR REPLACE FUNCTION effacer_membre_anonymise(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_nom       TEXT;
  v_traces    INTEGER;
BEGIN
  -- Le super_admin seul : un admin peut anonymiser, pas effacer.
  IF NOT has_role(auth.uid(), 'super_admin') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'forbidden');
  END IF;

  SELECT display_name INTO v_nom FROM profiles WHERE id = p_user_id;
  IF v_nom IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
  END IF;

  -- Effacer un membre encore vivant ferait par la bande ce que
  -- `delete_member_account` refuse de faire : on exige l'anonymisation d'abord.
  IF v_nom NOT LIKE 'Membre supprimé #%' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'pas_anonymise');
  END IF;

  -- Rien de comptable ne doit rester : sinon la ligne a une raison d'être, et
  -- l'effacer laisserait des enregistrements pointant dans le vide.
  SELECT
    (SELECT count(*) FROM bookings          WHERE user_id = p_user_id)
  + (SELECT count(*) FROM pack_purchases    WHERE user_id = p_user_id)
  + (SELECT count(*) FROM invoice_requests  WHERE user_id = p_user_id)
  + (SELECT count(*) FROM subscriptions     WHERE user_id = p_user_id)
  + (SELECT count(*) FROM registration_fees WHERE user_id = p_user_id)
  -- Un coach qui a encadré des cours n'est pas un compte créé par erreur : on
  -- refuse plutôt que de délier des séances de celui qui les a données.
  + (SELECT count(*) FROM scheduled_classes WHERE coach_id = p_user_id)
  INTO v_traces;

  IF v_traces > 0 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'traces_comptables', 'traces', v_traces);
  END IF;

  -- Ces tables référencent auth.users sans ON DELETE CASCADE : sans ce
  -- nettoyage, le DELETE échoue sur une violation de clé étrangère.
  DELETE FROM activity_log         WHERE actor_id = p_user_id OR target_user_id = p_user_id;
  DELETE FROM member_badges        WHERE user_id = p_user_id;
  DELETE FROM referral_rewards     WHERE user_id = p_user_id OR granted_by = p_user_id;
  DELETE FROM referrals            WHERE referrer_id = p_user_id OR referee_id = p_user_id;

  -- Traces d'un compte qui aurait encadré ou saisi : un membre créé par erreur
  -- n'en a pas, mais le DELETE échouerait sans cela.
  UPDATE performances          SET created_by = NULL WHERE created_by = p_user_id;
  UPDATE app_settings          SET updated_by = NULL WHERE updated_by = p_user_id;
  UPDATE subscription_discounts SET applied_by = NULL WHERE applied_by = p_user_id;

  DELETE FROM profiles   WHERE id = p_user_id;
  DELETE FROM auth.users WHERE id = p_user_id;

  RETURN jsonb_build_object('ok', true);
END;
$$;

REVOKE ALL ON FUNCTION effacer_membre_anonymise(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION effacer_membre_anonymise(UUID) TO authenticated;

-- ---------------------------------------------------------------------------
-- Inscriptions : tracer les tentatives, effacer les parasites
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION log_duplicate_signup(p_email TEXT)
RETURNS VOID
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $fn$
DECLARE
  v_user_id UUID;
BEGIN
  SELECT id INTO v_user_id FROM auth.users WHERE email = lower(trim(p_email));

  -- Adresse inconnue : rien à tracer. Sortir en silence, sans rien signaler à
  -- l'appelant — la différence de comportement serait elle-même une réponse.
  IF v_user_id IS NULL THEN
    RETURN;
  END IF;

  -- Une seule trace par heure et par adresse. Sans cette borne, un formulaire
  -- soumis en boucle remplirait le journal et noierait le reste.
  IF EXISTS (
    SELECT 1 FROM activity_log
    WHERE action = 'signup_attempt'
      AND target_user_id = v_user_id
      AND details->>'duplicate' = 'true'
      AND created_at > NOW() - INTERVAL '1 hour'
  ) THEN
    RETURN;
  END IF;

  INSERT INTO activity_log (action, actor_id, target_user_id, entity_type, entity_id, details, description)
  VALUES ('signup_attempt', NULL, v_user_id, 'profile', v_user_id,
          jsonb_build_object('duplicate', true, 'email', lower(trim(p_email))),
          format('Tentative d''inscription sur une adresse déjà inscrite : %s — aucun e-mail envoyé',
                 lower(trim(p_email))));
END;
$fn$;

REVOKE ALL ON FUNCTION log_duplicate_signup(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION log_duplicate_signup(TEXT) TO anon, authenticated;

CREATE OR REPLACE FUNCTION log_password_reset_request(p_email TEXT)
RETURNS VOID
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $fn$
DECLARE
  v_user_id UUID;
BEGIN
  SELECT id INTO v_user_id FROM auth.users WHERE email = lower(trim(p_email));

  -- Adresse inconnue : rien a tracer, et surtout rien a signaler a l'appelant.
  -- Une difference de comportement serait elle-meme une reponse.
  IF v_user_id IS NULL THEN
    RETURN;
  END IF;

  -- Une seule trace par heure et par adresse.
  IF EXISTS (
    SELECT 1 FROM activity_log
    WHERE action = 'password_reset_requested'
      AND target_user_id = v_user_id
      AND created_at > NOW() - INTERVAL '1 hour'
  ) THEN
    RETURN;
  END IF;

  INSERT INTO activity_log (action, actor_id, target_user_id, entity_type, entity_id, description)
  VALUES (
    'password_reset_requested',
    v_user_id,          -- le membre agit pour lui-meme
    v_user_id,
    'user',
    v_user_id,
    format('%s a demande la reinitialisation de son mot de passe',
           COALESCE((SELECT display_name FROM profiles WHERE id = v_user_id), p_email))
  );
END;
$fn$;

-- `anon` doit pouvoir l'appeler : on demande un nouveau mot de passe
-- PRECISEMENT quand on n'est pas connecte.
GRANT EXECUTE ON FUNCTION log_password_reset_request(TEXT) TO anon, authenticated;

CREATE OR REPLACE FUNCTION purge_parasite_account(p_user_id UUID)
RETURNS JSONB
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $fn$
DECLARE
  v_actor UUID := auth.uid();
  v_name TEXT;
  v_email TEXT;
  v_confirmed TIMESTAMPTZ;
  v_created TIMESTAMPTZ;
  v_blocker TEXT;
BEGIN
  IF NOT (has_role(v_actor, 'admin') OR has_role(v_actor, 'super_admin')) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'forbidden');
  END IF;

  -- Un admin ne s'efface pas lui-même : la fonction serait le plus court chemin
  -- vers un studio sans administrateur.
  IF p_user_id = v_actor THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'self');
  END IF;

  SELECT display_name INTO v_name FROM profiles WHERE id = p_user_id;
  IF v_name IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
  END IF;

  SELECT email, email_confirmed_at, created_at
    INTO v_email, v_confirmed, v_created
  FROM auth.users WHERE id = p_user_id;

  -- Un e-mail confirmé signale quelqu'un qui a fait la démarche jusqu'au bout :
  -- ce n'est plus un parasite, même s'il n'a rien acheté.
  IF v_confirmed IS NOT NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'email_confirmed');
  END IF;

  -- Staff : jamais effaçable ici, quel que soit l'état du compte.
  IF EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = p_user_id AND role IN ('coach', 'admin', 'super_admin')
  ) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'staff');
  END IF;

  -- Toute trace financière ou d'usage interdit l'effacement. Le pack de séance
  -- d'essai, attribué d'office à l'inscription, ne compte pas : il est offert et
  -- présent sur TOUS les comptes, il bloquerait donc chaque purge.
  SELECT CASE
    WHEN EXISTS (SELECT 1 FROM pack_purchases
                 WHERE user_id = p_user_id AND COALESCE(price_paid_cents, 0) > 0) THEN 'purchase'
    WHEN EXISTS (SELECT 1 FROM subscriptions   WHERE user_id = p_user_id) THEN 'subscription'
    WHEN EXISTS (SELECT 1 FROM registration_fees WHERE user_id = p_user_id) THEN 'registration_fee'
    WHEN EXISTS (SELECT 1 FROM bookings        WHERE user_id = p_user_id) THEN 'booking'
    ELSE NULL
  END INTO v_blocker;

  IF v_blocker IS NOT NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'has_activity', 'blocker', v_blocker);
  END IF;

  -- La trace de l'effacement s'écrit AVANT la suppression : `activity_log`
  -- référence `auth.users`, et les lignes du parasite vont disparaître. On la
  -- rattache donc à l'admin, seul acteur qui subsistera.
  INSERT INTO activity_log (action, actor_id, target_user_id, entity_type, entity_id, details, description)
  VALUES ('account_deleted', v_actor, v_actor, 'profile', p_user_id,
          jsonb_build_object(
            'purged_parasite', true,
            'former_name', v_name,
            'former_email', v_email,
            'signed_up_at', v_created
          ),
          format('Compte parasite effacé : %s (%s) — jamais confirmé, aucun achat',
                 v_name, COALESCE(v_email, 'sans e-mail')));

  -- Les traces du compte partent avec lui : les conserver ferait mentir le
  -- journal, qui renverrait vers un membre introuvable.
  DELETE FROM activity_log WHERE target_user_id = p_user_id OR actor_id = p_user_id;
  DELETE FROM waitlist       WHERE user_id = p_user_id;
  DELETE FROM notifications  WHERE user_id = p_user_id;
  DELETE FROM email_queue    WHERE user_id = p_user_id;
  DELETE FROM performances   WHERE user_id = p_user_id;
  DELETE FROM pack_purchases WHERE user_id = p_user_id;
  DELETE FROM user_roles     WHERE user_id = p_user_id;
  DELETE FROM profiles       WHERE id      = p_user_id;
  DELETE FROM auth.users     WHERE id      = p_user_id;

  RETURN jsonb_build_object('ok', true, 'former_name', v_name, 'former_email', v_email);
END;
$fn$;

REVOKE ALL ON FUNCTION purge_parasite_account(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION purge_parasite_account(UUID) TO authenticated;

-- ---------------------------------------------------------------------------
-- Catégorie de membre : dérivée des packs actifs
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION derive_member_category(p_user_id UUID)
RETURNS UUID
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $fn$
DECLARE
  v_categorie UUID;
BEGIN
  -- 1. Un abonnement en cours l'emporte sur tout le reste.
  SELECT pt.grants_category_id INTO v_categorie
  FROM subscriptions s
  JOIN pack_types pt ON pt.id = s.pack_type_id
  WHERE s.user_id = p_user_id
    AND s.status IN ('active', 'trialing', 'past_due')
    AND pt.grants_category_id IS NOT NULL
  ORDER BY s.created_at DESC
  LIMIT 1;

  IF v_categorie IS NOT NULL THEN
    RETURN v_categorie;
  END IF;

  -- 2. Sinon, un pack ponctuel encore valide. Un illimité a souvent zéro
  -- crédit restant sans être épuisé : la date fait foi, pas le compteur.
  SELECT pt.grants_category_id INTO v_categorie
  FROM pack_purchases pp
  JOIN pack_types pt ON pt.id = pp.pack_type_id
  WHERE pp.user_id = p_user_id
    AND pp.expires_at > NOW()
    AND (pt.is_unlimited OR pp.credits_remaining > 0)
    AND pt.grants_category_id IS NOT NULL
  ORDER BY pp.created_at DESC
  LIMIT 1;

  IF v_categorie IS NOT NULL THEN
    RETURN v_categorie;
  END IF;

  -- 3. Plus rien d'actif : le repli du dernier pack qui en déclarait un. On
  -- interroge l'historique, pas l'actuel — c'est justement parce que le pack
  -- s'est éteint qu'on cherche où retomber.
  SELECT pt.reverts_to_category_id INTO v_categorie
  FROM pack_purchases pp
  JOIN pack_types pt ON pt.id = pp.pack_type_id
  WHERE pp.user_id = p_user_id
    AND pt.reverts_to_category_id IS NOT NULL
  ORDER BY pp.created_at DESC
  LIMIT 1;

  RETURN v_categorie;
END;
$fn$;

-- Applique la catégorie dérivée. Renvoie TRUE si elle a changé — l'appelant
-- peut ainsi journaliser sans avoir à comparer lui-même.
CREATE OR REPLACE FUNCTION apply_member_category(p_user_id UUID)
RETURNS BOOLEAN
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $fn$
DECLARE
  v_nouvelle UUID;
  v_actuelle UUID;
BEGIN
  SELECT member_category_id INTO v_actuelle FROM profiles WHERE id = p_user_id;
  v_nouvelle := derive_member_category(p_user_id);

  -- Aucun pack ne se prononce : on ne touche à rien. Un studio qui range ses
  -- membres à la main ne doit pas voir son classement efface par un achat.
  IF v_nouvelle IS NULL THEN
    RETURN FALSE;
  END IF;

  IF v_nouvelle IS DISTINCT FROM v_actuelle THEN
    UPDATE profiles SET member_category_id = v_nouvelle WHERE id = p_user_id;
    RETURN TRUE;
  END IF;

  RETURN FALSE;
END;
$fn$;

REVOKE ALL ON FUNCTION derive_member_category(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION apply_member_category(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION derive_member_category(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION apply_member_category(UUID) TO authenticated;

-- ---------------------------------------------------------------------------
-- Quand recalculer
-- ---------------------------------------------------------------------------

-- À l'achat : c'est l'instant où la catégorie doit être juste, le membre va
-- s'en servir tout de suite pour accéder aux packs réservés.
CREATE OR REPLACE FUNCTION trg_apply_category_on_purchase()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $fn$
BEGIN
  -- Bloc protégé : un classement qui échoue ne doit pas annuler un achat payé.
  BEGIN
    PERFORM apply_member_category(NEW.user_id);
  EXCEPTION WHEN OTHERS THEN
    RAISE LOG 'apply_member_category (achat) : %', SQLERRM;
  END;
  RETURN NEW;
END;
$fn$;

DROP TRIGGER IF EXISTS trg_category_on_purchase ON pack_purchases;
CREATE TRIGGER trg_category_on_purchase
  AFTER INSERT ON pack_purchases
  FOR EACH ROW EXECUTE FUNCTION trg_apply_category_on_purchase();

-- À la fin d'un abonnement : événement net, Stripe le signale.
CREATE OR REPLACE FUNCTION trg_apply_category_on_subscription()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $fn$
BEGIN
  BEGIN
    PERFORM apply_member_category(NEW.user_id);
  EXCEPTION WHEN OTHERS THEN
    RAISE LOG 'apply_member_category (abonnement) : %', SQLERRM;
  END;
  RETURN NEW;
END;
$fn$;

DROP TRIGGER IF EXISTS trg_category_on_subscription ON subscriptions;
CREATE TRIGGER trg_category_on_subscription
  AFTER INSERT OR UPDATE OF status ON subscriptions
  FOR EACH ROW EXECUTE FUNCTION trg_apply_category_on_subscription();

-- L'expiration d'un pack ponctuel, elle, ne produit AUCUN événement : la date
-- passe, rien ne se déclenche. Un cron corrigerait après coup et finirait par
-- diverger — le projet a déjà tranché ce débat pour le statut d'un cours.
-- Le recalcul se fait donc à la lecture, quand le front appelle
-- `refresh_my_category` : la valeur est juste au moment où elle sert.
CREATE OR REPLACE FUNCTION refresh_my_category()
RETURNS UUID
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $fn$
DECLARE
  v_user UUID := auth.uid();
BEGIN
  IF v_user IS NULL THEN
    RETURN NULL;
  END IF;
  PERFORM apply_member_category(v_user);
  RETURN (SELECT member_category_id FROM profiles WHERE id = v_user);
END;
$fn$;

REVOKE ALL ON FUNCTION refresh_my_category() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION refresh_my_category() TO authenticated;

-- Le statut de membre suit la même mécanique, et pour la même raison : les
-- triggers ci-dessous couvrent l'achat d'un pack et les frais d'inscription,
-- mais le passage `active` → `inactive` → `former` ne tient qu'à l'écoulement
-- du temps, qui ne produit aucun événement. D'où le recalcul à la lecture,
-- appelé par AuthContext.fetchProfile à côté de refresh_my_category.
--
-- Sans ces trois déclencheurs, la fonction calculait juste et n'était presque
-- jamais appelée : 9 profils sur 23 portaient un statut faux sur `bot` au
-- 2026-08-28.
CREATE OR REPLACE FUNCTION refresh_my_member_status()
RETURNS TEXT
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $fn$
DECLARE
  v_user UUID := auth.uid();
BEGIN
  IF v_user IS NULL THEN
    RETURN NULL;
  END IF;
  RETURN update_member_status(v_user);
END;
$fn$;

REVOKE ALL ON FUNCTION refresh_my_member_status() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION refresh_my_member_status() TO authenticated;

-- Un pack acheté fait passer à `active` immédiatement : l'admin qui encode un
-- paiement au comptoir doit voir l'effet sans attendre la prochaine connexion
-- du membre.
CREATE OR REPLACE FUNCTION trg_statut_apres_achat_pack()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $fn$
BEGIN
  PERFORM update_member_status(NEW.user_id);
  RETURN NEW;
END;
$fn$;

DROP TRIGGER IF EXISTS statut_apres_achat_pack ON pack_purchases;
CREATE TRIGGER statut_apres_achat_pack
  AFTER INSERT ON pack_purchases
  FOR EACH ROW EXECUTE FUNCTION trg_statut_apres_achat_pack();

-- « Premier contact → potentiel » se joue sur une RÉSERVATION d'essai : sans ce
-- trigger, le membre garderait son statut jusqu'à sa prochaine connexion.
CREATE OR REPLACE FUNCTION trg_statut_apres_reservation()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $fn$
BEGIN
  PERFORM update_member_status(NEW.user_id);
  RETURN NEW;
END;
$fn$;

DROP TRIGGER IF EXISTS statut_apres_reservation ON bookings;
CREATE TRIGGER statut_apres_reservation
  AFTER INSERT ON bookings
  FOR EACH ROW EXECUTE FUNCTION trg_statut_apres_reservation();

-- ---------------------------------------------------------------------------
-- Avis sur les cours
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS class_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- L'avis porte sur la réservation : c'est elle qui prouve la présence.
  booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  -- Dupliqué depuis la réservation pour que les politiques d'accès n'aient pas
  -- à faire de jointure, et pour retrouver ses avis après coup.
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  scheduled_class_id UUID NOT NULL REFERENCES scheduled_classes(id) ON DELETE CASCADE,
  rating SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- Une séance, un avis. Le membre peut le modifier, pas en empiler.
  UNIQUE (booking_id)
);

COMMENT ON TABLE class_reviews IS
  'Avis d''un membre sur une séance suivie. Rattaché à la réservation : sans inscription confirmée, pas d''avis possible.';

COMMENT ON COLUMN class_reviews.rating IS
  '1 à 5 étoiles. Le commentaire reste facultatif — exiger un texte fait chuter le taux de réponse.';

-- Moyenne par cours, et avis d'un membre : les deux lectures fréquentes.
CREATE INDEX IF NOT EXISTS class_reviews_class ON class_reviews (scheduled_class_id);
CREATE INDEX IF NOT EXISTS class_reviews_user ON class_reviews (user_id, created_at DESC);

ALTER TABLE class_reviews ENABLE ROW LEVEL SECURITY;

-- Le membre voit et gère les siens.
CREATE POLICY "Reviews: own read" ON class_reviews
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Reviews: own update" ON class_reviews
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Le staff lit tout : le coach pour ses cours, l'admin pour piloter.
-- L'anonymat côté coach se joue à l'affichage, pas ici — l'admin doit pouvoir
-- remonter à l'auteur en cas d'avis problématique.
CREATE POLICY "Reviews: staff read" ON class_reviews
  FOR SELECT USING (
    has_role(auth.uid(), 'coach')
    OR has_role(auth.uid(), 'admin')
    OR has_role(auth.uid(), 'super_admin')
  );

-- Pas de policy INSERT : l'écriture passe par `submit_class_review`, qui
-- vérifie que le cours est bien passé et que le membre y était inscrit. Une
-- policy INSERT ouverte laisserait noter n'importe quel cours.

-- ---------------------------------------------------------------------------
-- Les séances qui attendent un avis
-- ---------------------------------------------------------------------------
-- Cours terminés, réservation confirmée, pas encore notés. Bornée à trente
-- jours : proposer de noter une séance d'il y a six mois n'a pas de sens, et
-- la mémoire du membre non plus.
CREATE OR REPLACE FUNCTION pending_class_reviews()
RETURNS TABLE (
  booking_id UUID,
  scheduled_class_id UUID,
  class_name TEXT,
  starts_at TIMESTAMPTZ,
  coach_name TEXT
)
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
STABLE
AS $fn$
DECLARE
  v_settings JSONB;
  v_open     NUMERIC;
  v_close    NUMERIC;
BEGIN
  SELECT value INTO v_settings FROM app_settings WHERE key = 'class_reviews';

  IF COALESCE((v_settings->>'enabled')::BOOLEAN, TRUE) IS NOT TRUE THEN
    RETURN;
  END IF;

  v_open  := GREATEST(0, COALESCE((v_settings->>'hours_before_review')::NUMERIC, 0));
  v_close := GREATEST(1, COALESCE((v_settings->>'hours_to_review')::NUMERIC, 168));

  RETURN QUERY
  SELECT b.id,
         sc.id,
         COALESCE(sc.title, ct.name),
         sc.starts_at,
         co.display_name
  FROM bookings b
  JOIN scheduled_classes sc ON sc.id = b.scheduled_class_id
  LEFT JOIN class_types ct ON ct.id = sc.class_type_id
  LEFT JOIN profiles co ON co.id = sc.coach_id
  WHERE b.user_id = auth.uid()
    AND b.status = 'confirmed'
    AND NOT sc.is_cancelled
    -- Les deux bornes partent de la fin du cours.
    AND sc.starts_at + (sc.duration_minutes || ' minutes')::INTERVAL
        + (v_open || ' hours')::INTERVAL < NOW()
    AND sc.starts_at + (sc.duration_minutes || ' minutes')::INTERVAL
        + (v_close || ' hours')::INTERVAL > NOW()
    AND NOT EXISTS (SELECT 1 FROM class_reviews r WHERE r.booking_id = b.id)
  ORDER BY sc.starts_at DESC;
END;
$fn$;

COMMENT ON FUNCTION pending_class_reviews IS
  'Séances suivies par l''appelant qui attendent encore un avis. Ouvre `hours_before_review` heures après la fin du cours, ferme `hours_to_review` heures après cette même fin.';

-- ---------------------------------------------------------------------------
-- Déposer ou corriger un avis
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION submit_class_review(
  p_booking_id UUID,
  p_rating SMALLINT,
  p_comment TEXT DEFAULT NULL
)
RETURNS JSONB
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $fn$
DECLARE
  v_uid      UUID := auth.uid();
  v_booking  RECORD;
  v_settings JSONB;
  v_open     NUMERIC;
  v_close    NUMERIC;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_authenticated');
  END IF;

  IF p_rating IS NULL OR p_rating < 1 OR p_rating > 5 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_rating');
  END IF;

  SELECT value INTO v_settings FROM app_settings WHERE key = 'class_reviews';

  -- Coupée : ni dépôt ni correction.
  IF COALESCE((v_settings->>'enabled')::BOOLEAN, TRUE) IS NOT TRUE THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'disabled');
  END IF;

  v_open  := GREATEST(0, COALESCE((v_settings->>'hours_before_review')::NUMERIC, 0));
  v_close := GREATEST(1, COALESCE((v_settings->>'hours_to_review')::NUMERIC, 168));

  -- La réservation doit être la sienne, confirmée, et la fenêtre ouverte. Ces
  -- conditions ensemble rendent impossible de noter un cours auquel on n'est
  -- pas allé, ou une séance trop ancienne.
  SELECT b.id, b.scheduled_class_id INTO v_booking
  FROM bookings b
  JOIN scheduled_classes sc ON sc.id = b.scheduled_class_id
  WHERE b.id = p_booking_id
    AND b.user_id = v_uid
    AND b.status = 'confirmed'
    AND sc.starts_at + (sc.duration_minutes || ' minutes')::INTERVAL
        + (v_open || ' hours')::INTERVAL < NOW()
    AND sc.starts_at + (sc.duration_minutes || ' minutes')::INTERVAL
        + (v_close || ' hours')::INTERVAL > NOW();

  IF v_booking.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_eligible');
  END IF;

  INSERT INTO class_reviews (booking_id, user_id, scheduled_class_id, rating, comment)
  VALUES (p_booking_id, v_uid, v_booking.scheduled_class_id, p_rating, NULLIF(trim(p_comment), ''))
  ON CONFLICT (booking_id) DO UPDATE
    SET rating = EXCLUDED.rating,
        comment = EXCLUDED.comment,
        updated_at = NOW();

  RETURN jsonb_build_object('ok', true);
END;
$fn$;

COMMENT ON FUNCTION submit_class_review IS
  'Dépose ou corrige l''avis du membre. Ouvre `hours_before_review` heures après la fin du cours, ferme `hours_to_review` heures après cette même fin. La modification suit la même fenêtre que le dépôt.';

-- ---------------------------------------------------------------------------
-- Retirer son avis
-- ---------------------------------------------------------------------------
-- Même fenêtre que la modification : ce qu'on peut corriger, on peut le
-- retirer. Un avis donné à chaud se regrette, et forcer quelqu'un à vivre avec
-- une note qu'il désavoue ne rend service à personne.
CREATE OR REPLACE FUNCTION delete_class_review(p_booking_id UUID)
RETURNS JSONB
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $fn$
DECLARE
  v_uid      UUID := auth.uid();
  v_settings JSONB;
  v_close    NUMERIC;
  v_deleted  INTEGER;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_authenticated');
  END IF;

  SELECT value INTO v_settings FROM app_settings WHERE key = 'class_reviews';
  v_close := GREATEST(1, COALESCE((v_settings->>'hours_to_review')::NUMERIC, 168));

  DELETE FROM class_reviews r
  USING scheduled_classes sc
  WHERE r.booking_id = p_booking_id
    AND r.user_id = v_uid
    AND sc.id = r.scheduled_class_id
    AND sc.starts_at + (sc.duration_minutes || ' minutes')::INTERVAL
        + (v_close || ' hours')::INTERVAL > NOW();

  GET DIAGNOSTICS v_deleted = ROW_COUNT;

  IF v_deleted = 0 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_eligible');
  END IF;

  RETURN jsonb_build_object('ok', true);
END;
$fn$;

COMMENT ON FUNCTION delete_class_review IS
  'Retire l''avis du membre sur une séance. Refuse hors de la fenêtre `hours_to_review` : au-delà, l''avis est figé.';

REVOKE ALL ON FUNCTION pending_class_reviews() FROM PUBLIC;
REVOKE ALL ON FUNCTION submit_class_review(UUID, SMALLINT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION delete_class_review(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION pending_class_reviews() TO authenticated;
GRANT EXECUTE ON FUNCTION submit_class_review(UUID, SMALLINT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION delete_class_review(UUID) TO authenticated;

-- ---------------------------------------------------------------------------
-- Ce que le coach voit : ses cours seulement, toujours anonyme
-- ---------------------------------------------------------------------------
-- Sans le nom de l'auteur : c'est la contrepartie de la franchise. Un membre
-- qui reverra son coach mardi ne note pas franchement s'il se sait identifiable.
-- L'admin, lui, a l'accès nominatif via `class_reviews_for_admin`.
--
-- Le coach est borné à SES cours : sans la jointure, n'importe quel coach
-- pouvait lire les avis d'un collègue en connaissant l'identifiant du cours.
CREATE OR REPLACE FUNCTION class_reviews_for_staff(p_scheduled_class_id UUID)
RETURNS TABLE (
  rating SMALLINT,
  comment TEXT,
  created_at TIMESTAMPTZ
)
SECURITY DEFINER
SET search_path = public
LANGUAGE sql
STABLE
AS $fn$
  SELECT r.rating, r.comment, r.created_at
  FROM class_reviews r
  JOIN scheduled_classes sc ON sc.id = r.scheduled_class_id
  WHERE r.scheduled_class_id = p_scheduled_class_id
    AND (
      (has_role(auth.uid(), 'coach') AND sc.coach_id = auth.uid())
      OR has_role(auth.uid(), 'admin')
      OR has_role(auth.uid(), 'super_admin')
    )
  ORDER BY r.created_at DESC;
$fn$;

COMMENT ON FUNCTION class_reviews_for_staff IS
  'Avis d''un cours, sans le nom des auteurs. Le coach n''y accède que pour les cours qu''il a donnés ; l''admin voit tout. Pour l''accès nominatif, voir `class_reviews_for_admin`.';

-- ---------------------------------------------------------------------------
-- Ce que l'admin voit : tout, avec l'auteur
-- ---------------------------------------------------------------------------
-- Réservé à l'admin — un coach qui appellerait cette fonction n'obtient rien.
-- C'est ce qui permet de traiter un avis problématique : sans le nom, on ne
-- peut ni recontacter la personne ni constater un acharnement.
--
-- La période porte sur la date du COURS, pas sur celle du dépôt : « les avis
-- de cette semaine » veut dire les cours de cette semaine.
CREATE OR REPLACE FUNCTION class_reviews_for_admin(
  p_coach_id UUID DEFAULT NULL,
  p_class_type_id UUID DEFAULT NULL,
  p_from TIMESTAMPTZ DEFAULT NULL,
  p_to TIMESTAMPTZ DEFAULT NULL,
  p_limit INTEGER DEFAULT 500
)
RETURNS TABLE (
  id UUID,
  rating SMALLINT,
  comment TEXT,
  created_at TIMESTAMPTZ,
  user_id UUID,
  member_name TEXT,
  member_email TEXT,
  scheduled_class_id UUID,
  class_name TEXT,
  class_type_id UUID,
  starts_at TIMESTAMPTZ,
  coach_id UUID,
  coach_name TEXT
)
SECURITY DEFINER
SET search_path = public
LANGUAGE sql
STABLE
AS $fn$
  SELECT r.id,
         r.rating,
         r.comment,
         r.created_at,
         r.user_id,
         m.display_name,
         m.email,
         r.scheduled_class_id,
         COALESCE(sc.title, ct.name),
         sc.class_type_id,
         sc.starts_at,
         sc.coach_id,
         co.display_name
  FROM class_reviews r
  JOIN scheduled_classes sc ON sc.id = r.scheduled_class_id
  LEFT JOIN class_types ct ON ct.id = sc.class_type_id
  LEFT JOIN profiles m  ON m.id = r.user_id
  LEFT JOIN profiles co ON co.id = sc.coach_id
  WHERE (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'super_admin'))
    -- Filtres facultatifs : NULL = pas de filtre.
    AND (p_coach_id IS NULL OR sc.coach_id = p_coach_id)
    AND (p_class_type_id IS NULL OR sc.class_type_id = p_class_type_id)
    AND (p_from IS NULL OR sc.starts_at >= p_from)
    AND (p_to IS NULL OR sc.starts_at <= p_to)
  ORDER BY sc.starts_at DESC
  LIMIT GREATEST(1, LEAST(COALESCE(p_limit, 500), 2000));
$fn$;

COMMENT ON FUNCTION class_reviews_for_admin IS
  'Avis avec l''identité de leur auteur, pour l''admin seul. Filtres facultatifs par coach, type de cours et période (sur la date du COURS, pas du dépôt). Triés par date de cours décroissante.';

-- ---------------------------------------------------------------------------
-- Statistiques par coach, pour l'admin
-- ---------------------------------------------------------------------------
-- Une moyenne globale ne dit pas grand-chose ; la comparaison entre coachs, si.
-- Les coachs sans aucun avis sont exclus : afficher « — » pour quelqu'un qui
-- n'a pas encore été noté invite à conclure trop vite.
--
-- Volontairement sans compteur d'avis « négatifs » : le seuil en dessous duquel
-- une note devient un problème est un jugement de studio, pas une donnée. Le
-- filtre par étoiles laisse ce jugement à qui lit.
CREATE OR REPLACE FUNCTION class_review_stats_by_coach()
RETURNS TABLE (
  coach_id UUID,
  coach_name TEXT,
  review_count BIGINT,
  average_rating NUMERIC
)
SECURITY DEFINER
SET search_path = public
LANGUAGE sql
STABLE
AS $fn$
  SELECT sc.coach_id,
         co.display_name,
         COUNT(*),
         ROUND(AVG(r.rating)::NUMERIC, 2)
  FROM class_reviews r
  JOIN scheduled_classes sc ON sc.id = r.scheduled_class_id
  LEFT JOIN profiles co ON co.id = sc.coach_id
  WHERE (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'super_admin'))
    AND sc.coach_id IS NOT NULL
  GROUP BY sc.coach_id, co.display_name
  ORDER BY AVG(r.rating) DESC;
$fn$;

COMMENT ON FUNCTION class_review_stats_by_coach IS
  'Nombre d''avis et moyenne par coach. Admin seul. Pas de notion d''avis « négatif » : le seuil est un jugement de studio, pas une donnée.';

-- ---------------------------------------------------------------------------
-- Ce que le membre relit
-- ---------------------------------------------------------------------------
-- Relire un avis ancien ne pose aucun problème : pas de borne de lecture. En
-- revanche `editable` dit si la fenêtre de correction est encore ouverte, pour
-- que l'interface n'affiche pas des boutons qui échoueraient au clic.
CREATE OR REPLACE FUNCTION my_class_reviews()
RETURNS TABLE (
  booking_id UUID,
  scheduled_class_id UUID,
  rating SMALLINT,
  comment TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  editable BOOLEAN
)
SECURITY DEFINER
SET search_path = public
LANGUAGE sql
STABLE
AS $fn$
  SELECT r.booking_id,
         r.scheduled_class_id,
         r.rating,
         r.comment,
         r.created_at,
         r.updated_at,
         sc.starts_at + (sc.duration_minutes || ' minutes')::INTERVAL
           + (GREATEST(1, COALESCE(
               (SELECT (value->>'hours_to_review')::NUMERIC FROM app_settings WHERE key = 'class_reviews'),
               168)) || ' hours')::INTERVAL > NOW()
  FROM class_reviews r
  JOIN scheduled_classes sc ON sc.id = r.scheduled_class_id
  WHERE r.user_id = auth.uid()
  ORDER BY r.created_at DESC;
$fn$;

COMMENT ON FUNCTION my_class_reviews IS
  'Les avis déposés par l''appelant. `editable` dit si la fenêtre `hours_to_review` est encore ouverte — au-delà, l''avis est figé.';

REVOKE ALL ON FUNCTION class_reviews_for_staff(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION class_reviews_for_admin(UUID, UUID, TIMESTAMPTZ, TIMESTAMPTZ, INTEGER) FROM PUBLIC;
REVOKE ALL ON FUNCTION class_review_stats_by_coach() FROM PUBLIC;
REVOKE ALL ON FUNCTION my_class_reviews() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION class_reviews_for_staff(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION class_reviews_for_admin(UUID, UUID, TIMESTAMPTZ, TIMESTAMPTZ, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION class_review_stats_by_coach() TO authenticated;
GRANT EXECUTE ON FUNCTION my_class_reviews() TO authenticated;


-- ---------------------------------------------------------------------------
-- Paiement sur facture — clients professionnels
-- ---------------------------------------------------------------------------
-- Une entreprise reçoit une facture et la règle selon ses propres délais. Le
-- pack est crédité tout de suite : l'employé doit pouvoir s'entraîner sans
-- attendre le circuit comptable de son employeur. Le studio porte donc le
-- risque d'impayé — décision assumée du 2026-08-07, aucun automatisme.
CREATE OR REPLACE FUNCTION order_pack_on_invoice(p_pack_type_id UUID)
RETURNS JSONB
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $fn$
DECLARE
  v_uid      UUID := auth.uid();
  v_profile  RECORD;
  v_pack     pack_types%ROWTYPE;
  v_fee      JSONB;
  v_expires  TIMESTAMPTZ;
  v_purchase UUID;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_authenticated');
  END IF;

  SELECT is_business, company_name, company_address, company_vat, display_name
    INTO v_profile
  FROM profiles WHERE id = v_uid;

  -- Le contrôle décisif : sans lui, n'importe quel particulier obtiendrait des
  -- séances sans payer.
  IF NOT COALESCE(v_profile.is_business, FALSE) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_business');
  END IF;

  IF COALESCE(trim(v_profile.company_name), '') = '' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'company_missing');
  END IF;

  SELECT * INTO v_pack FROM pack_types
  WHERE id = p_pack_type_id AND is_active AND is_purchasable;

  IF v_pack.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'pack_not_found');
  END IF;

  -- Un abonnement se prélève automatiquement : sans objet sur facture.
  IF v_pack.is_recurring THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'recurring_not_supported');
  END IF;

  -- Les frais d'inscription valent pour tous : c'est leur paiement qui
  -- déclenche la couverture d'assurance.
  SELECT value INTO v_fee FROM app_settings WHERE key = 'registration_fee';
  IF COALESCE((v_fee->>'enabled')::BOOLEAN, TRUE)
     AND NOT EXISTS (SELECT 1 FROM registration_fees WHERE user_id = v_uid) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'registration_fee_due');
  END IF;

  v_expires := NOW() + (v_pack.validity_days || ' days')::INTERVAL;

  INSERT INTO pack_purchases (
    user_id, pack_type_id, price_paid_cents, credits_remaining,
    purchased_at, expires_at
  ) VALUES (
    v_uid, p_pack_type_id, v_pack.price_cents, v_pack.credit_count,
    NOW(), v_expires
  )
  RETURNING id INTO v_purchase;

  INSERT INTO invoice_requests (
    user_id, pack_purchase_id, pack_type_id, amount_cents,
    company_name, address, vat_number, status
  ) VALUES (
    v_uid, v_purchase, p_pack_type_id, v_pack.price_cents,
    v_profile.company_name,
    COALESCE(v_profile.company_address, ''),
    v_profile.company_vat,
    'pending'
  );

  PERFORM update_member_status(v_uid);

  INSERT INTO notifications (user_id, title, message, type, link)
  VALUES (v_uid, 'Commande enregistrée',
    format('Ton pack %s est activé. La facture sera envoyée à %s.',
           v_pack.name, v_profile.company_name),
    'success', '/my-packs');

  RETURN jsonb_build_object('ok', true, 'purchase_id', v_purchase, 'expires_at', v_expires);
END;
$fn$;

-- Le studio pointe une facture comme encaissée. Sans effet sur les crédits :
-- ils ont été donnés à la commande.
CREATE OR REPLACE FUNCTION mark_invoice_paid(p_invoice_id UUID, p_invoice_number TEXT DEFAULT NULL)
RETURNS JSONB
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $fn$
BEGIN
  IF NOT (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'super_admin')) THEN
    RAISE EXCEPTION 'Reserve aux administrateurs';
  END IF;

  UPDATE invoice_requests
     SET paid_at = NOW(),
         status = 'paid',
         invoice_number = COALESCE(NULLIF(trim(p_invoice_number), ''), invoice_number),
         processed_at = COALESCE(processed_at, NOW())
   WHERE id = p_invoice_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
  END IF;

  RETURN jsonb_build_object('ok', true);
END;
$fn$;

REVOKE ALL ON FUNCTION order_pack_on_invoice(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION mark_invoice_paid(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION order_pack_on_invoice(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION mark_invoice_paid(UUID, TEXT) TO authenticated;

CREATE INDEX IF NOT EXISTS invoice_requests_unpaid
  ON invoice_requests (created_at)
  WHERE paid_at IS NULL AND status <> 'cancelled';


-- Enregistre le numéro et la date de la facture émise dans Odoo. Séparé de
-- l'encaissement : ces informations sont connues dès l'émission, souvent des
-- semaines avant le paiement.
CREATE OR REPLACE FUNCTION set_invoice_details(
  p_invoice_id UUID,
  p_invoice_number TEXT,
  p_invoice_date DATE DEFAULT NULL
)
RETURNS JSONB
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $fn$
BEGIN
  IF NOT (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'super_admin')) THEN
    RAISE EXCEPTION 'Reserve aux administrateurs';
  END IF;

  IF COALESCE(trim(p_invoice_number), '') = '' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'number_required');
  END IF;

  UPDATE invoice_requests
     SET invoice_number = trim(p_invoice_number),
         invoice_date = COALESCE(p_invoice_date, CURRENT_DATE),
         status = CASE WHEN paid_at IS NULL THEN 'sent' ELSE status END
   WHERE id = p_invoice_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
  END IF;

  RETURN jsonb_build_object('ok', true);
EXCEPTION WHEN unique_violation THEN
  -- Un numéro est unique par construction comptable : le dupliquer signale
  -- une erreur de saisie, pas une situation valable.
  RETURN jsonb_build_object('ok', false, 'reason', 'duplicate_number');
END;
$fn$;

REVOKE ALL ON FUNCTION set_invoice_details(UUID, TEXT, DATE) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION set_invoice_details(UUID, TEXT, DATE) TO authenticated;

CREATE UNIQUE INDEX IF NOT EXISTS invoice_requests_number
  ON invoice_requests (invoice_number)
  WHERE invoice_number IS NOT NULL;


-- Vérifie un code promotionnel et annonce la remise, sans rien consommer.
-- Le membre doit savoir ce que vaut son code AVANT d'être envoyé sur Stripe :
-- découvrir un refus sur la page de paiement fait abandonner l'achat.
CREATE OR REPLACE FUNCTION check_coupon(p_code TEXT, p_purchase_cents INTEGER DEFAULT NULL)
RETURNS JSONB
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
STABLE
AS $fn$
DECLARE
  v_uid        UUID := auth.uid();
  v_coupon     coupons%ROWTYPE;
  v_category   UUID;
  v_restricted BOOLEAN;
  v_discount   INTEGER;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_authenticated');
  END IF;

  SELECT * INTO v_coupon FROM coupons
  WHERE code = upper(trim(p_code)) AND is_active;

  IF v_coupon.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'unknown_code');
  END IF;

  IF v_coupon.valid_from IS NOT NULL AND NOW() < v_coupon.valid_from THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_yet_valid', 'valid_from', v_coupon.valid_from);
  END IF;

  IF v_coupon.valid_until IS NOT NULL AND NOW() > v_coupon.valid_until THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'expired');
  END IF;

  -- Une fois par personne. `pack_purchases.coupon_id` garde la trace de ce qui
  -- a servi : pas besoin d'une table de plus.
  --
  -- Le motif est distinct d'`exhausted` : « vous avez deja utilise ce code » et
  -- « ce code est epuise » appellent des reactions differentes, et le second
  -- laisserait croire a une injustice.
  IF EXISTS (
    SELECT 1 FROM pack_purchases
     WHERE user_id = v_uid AND coupon_id = v_coupon.id
  ) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'already_used');
  END IF;

  IF v_coupon.max_uses IS NOT NULL AND v_coupon.current_uses >= v_coupon.max_uses THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'exhausted');
  END IF;

  -- Sans restriction déclarée, le coupon vaut pour tous.
  SELECT EXISTS (SELECT 1 FROM coupon_categories WHERE coupon_id = v_coupon.id)
    INTO v_restricted;

  IF v_restricted THEN
    SELECT member_category_id INTO v_category FROM profiles WHERE id = v_uid;
    IF v_category IS NULL OR NOT EXISTS (
      SELECT 1 FROM coupon_categories
      WHERE coupon_id = v_coupon.id AND member_category_id = v_category
    ) THEN
      RETURN jsonb_build_object('ok', false, 'reason', 'not_eligible');
    END IF;
  END IF;

  IF p_purchase_cents IS NOT NULL THEN
    v_discount := CASE
      WHEN v_coupon.discount_percent IS NOT NULL
        THEN ROUND(p_purchase_cents * v_coupon.discount_percent / 100.0)
      ELSE LEAST(COALESCE(v_coupon.discount_amount_cents, 0), p_purchase_cents)
    END;
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'code', v_coupon.code,
    'discount_percent', v_coupon.discount_percent,
    'discount_amount_cents', v_coupon.discount_amount_cents,
    'discount_cents', v_discount
  );
END;
$fn$;

REVOKE ALL ON FUNCTION check_coupon(TEXT, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION check_coupon(TEXT, INTEGER) TO authenticated;


-- ---------------------------------------------------------------------------
-- Types de cours : protéger ce qui est déjà engagé
-- ---------------------------------------------------------------------------
-- Tous les champs ne se valent pas. Nom, description, image et places par
-- défaut se modifient librement. Le TYPE DE CRÉDIT, non : le changer rendrait
-- incompatibles les packs qui ont déjà payé les réservations de ce cours — le
-- membre a consommé un crédit d'un type, le cours en réclamerait un autre.
--
-- Verrouillé dès qu'un cours est PLANIFIÉ, pas seulement réservé : un cours
-- annoncé au planning est une promesse commerciale.
CREATE OR REPLACE FUNCTION protect_class_type_credit()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $fn$
DECLARE
  v_classes  INTEGER;
  v_bookings INTEGER;
BEGIN
  IF NEW.credit_type_id = OLD.credit_type_id THEN
    RETURN NEW;
  END IF;

  SELECT COUNT(*) INTO v_classes
  FROM scheduled_classes WHERE class_type_id = OLD.id;

  IF v_classes = 0 THEN
    RETURN NEW;
  END IF;

  SELECT COUNT(*) INTO v_bookings
  FROM bookings b
  JOIN scheduled_classes sc ON sc.id = b.scheduled_class_id
  WHERE sc.class_type_id = OLD.id AND b.status = 'confirmed';

  RAISE EXCEPTION
    'Type de credit verrouille : % cours planifie(s) et % reservation(s) en dependent. Creez un nouveau type de cours plutot que de modifier celui-ci.',
    v_classes, v_bookings
    USING ERRCODE = 'check_violation';
END;
$fn$;

DROP TRIGGER IF EXISTS class_types_protect_credit ON class_types;
CREATE TRIGGER class_types_protect_credit
  BEFORE UPDATE ON class_types
  FOR EACH ROW EXECUTE FUNCTION protect_class_type_credit();

-- Ce qui dépend d'un type de cours. Renseigne l'écran AVANT modification :
-- l'admin doit le savoir, pas le découvrir sur un refus.
CREATE OR REPLACE FUNCTION class_type_usage(p_class_type_id UUID)
RETURNS JSONB
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
STABLE
AS $fn$
DECLARE
  v_total    INTEGER;
  v_future   INTEGER;
  v_bookings INTEGER;
BEGIN
  IF NOT (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'super_admin')) THEN
    RAISE EXCEPTION 'Reserve aux administrateurs';
  END IF;

  SELECT COUNT(*), COUNT(*) FILTER (WHERE starts_at > NOW())
    INTO v_total, v_future
  FROM scheduled_classes WHERE class_type_id = p_class_type_id;

  SELECT COUNT(*) INTO v_bookings
  FROM bookings b
  JOIN scheduled_classes sc ON sc.id = b.scheduled_class_id
  WHERE sc.class_type_id = p_class_type_id
    AND b.status = 'confirmed' AND sc.starts_at > NOW();

  RETURN jsonb_build_object(
    'total_classes', v_total,
    'future_classes', v_future,
    'future_bookings', v_bookings,
    'credit_locked', v_total > 0
  );
END;
$fn$;

REVOKE ALL ON FUNCTION class_type_usage(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION class_type_usage(UUID) TO authenticated;

-- Phase 4 : Vérifier si un membre peut réserver
CREATE OR REPLACE FUNCTION can_book_class(p_class_id UUID, p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER
AS '
DECLARE
  v_class RECORD;
  v_rules JSONB;
  v_now TIMESTAMPTZ := NOW();
  v_bookings_count INTEGER;
  v_class_hour INTEGER;
  v_cutoff TIMESTAMPTZ;
  v_class_date DATE;
  v_window_days NUMERIC;
BEGIN
  SELECT * INTO v_class FROM scheduled_classes WHERE id = p_class_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object(''can_book'', false, ''reason'', ''class_not_found'');
  END IF;

  SELECT value INTO v_rules FROM app_settings WHERE key = ''booking_rules'';
  IF v_rules IS NULL THEN RETURN jsonb_build_object(''can_book'', true); END IF;

  IF v_class.starts_at <= v_now THEN
    RETURN jsonb_build_object(''can_book'', false, ''reason'', ''class_past'');
  END IF;
  IF v_class.is_cancelled THEN
    RETURN jsonb_build_object(''can_book'', false, ''reason'', ''class_cancelled'');
  END IF;

  -- Fenetre d''ouverture : au-dela de N jours, le cours se voit mais ne se
  -- reserve pas. Fenetre glissante — les N prochains jours sont ouverts a tout
  -- instant. Absent du reglage, aucune limite : une base qui ne connait pas
  -- encore ce champ ne doit rien bloquer.
  v_window_days := (v_rules->>''booking_window_days'')::NUMERIC;
  IF v_window_days IS NOT NULL AND v_window_days > 0
     AND v_class.starts_at > v_now + (v_window_days || '' days'')::INTERVAL THEN
    RETURN jsonb_build_object(
      ''can_book'', false,
      ''reason'', ''outside_booking_window'',
      ''window_days'', v_window_days,
      ''opens_at'', v_class.starts_at - (v_window_days || '' days'')::INTERVAL
    );
  END IF;
  IF EXISTS(SELECT 1 FROM bookings WHERE scheduled_class_id = p_class_id AND user_id = p_user_id AND status = ''confirmed'') THEN
    RETURN jsonb_build_object(''can_book'', false, ''reason'', ''already_booked'');
  END IF;

  SELECT COUNT(*) INTO v_bookings_count FROM bookings WHERE scheduled_class_id = p_class_id AND status = ''confirmed'';
  IF v_bookings_count >= v_class.max_participants THEN
    RETURN jsonb_build_object(''can_book'', false, ''reason'', ''class_full'');
  END IF;

  v_class_hour := EXTRACT(HOUR FROM v_class.starts_at AT TIME ZONE ''Europe/Brussels'');
  v_class_date := (v_class.starts_at AT TIME ZONE ''Europe/Brussels'')::DATE;

  IF v_class_hour < COALESCE((v_rules->>''morning_class_before_hour'')::INTEGER, 12) THEN
    v_cutoff := (v_class_date - INTERVAL ''1 day''
                + (COALESCE((v_rules->>''morning_cutoff_hour'')::INTEGER, 20) || '' hours'')::INTERVAL)
                AT TIME ZONE ''Europe/Brussels'';
  ELSE
    IF v_bookings_count = 0 THEN
      v_cutoff := v_class.starts_at - (COALESCE((v_rules->>''afternoon_hours_before_no_bookings'')::INTEGER, 3) || '' hours'')::INTERVAL;
    ELSE
      v_cutoff := v_class.starts_at - (COALESCE((v_rules->>''afternoon_minutes_before_with_bookings'')::INTEGER, 30) || '' minutes'')::INTERVAL;
    END IF;
  END IF;

  IF v_now > v_cutoff THEN
    RETURN jsonb_build_object(''can_book'', false, ''reason'', ''booking_closed'');
  END IF;

  RETURN jsonb_build_object(''can_book'', true);
END;
';

-- ---------------------------------------------------------------------------
-- Réservations orphelines : annulées à la résiliation de l'abonnement
-- ---------------------------------------------------------------------------
-- Les cours réservés au-delà du terme d'un abonnement qui ne se renouvellera
-- pas : personne ne les paiera.
--
-- POURQUOI UN TRIGGER SUR `subscriptions` plutôt qu'un appel dans
-- `cancel-my-subscription` : une résiliation arrive par au moins trois routes —
-- la fonction de l'app, le webhook Stripe (quatre endroits y écrivent
-- `cancel_at_period_end`), et le dashboard Stripe où le studio agit à la main.
-- Le seul point commun est cette table.
--
-- POURQUOI À LA RÉSILIATION et non au renouvellement : au renouvellement il n'y
-- a rien à annuler, le cycle suivant est payé. Attendre le terme préviendrait
-- le membre des semaines trop tard.
CREATE OR REPLACE FUNCTION cancel_orphan_bookings_on_subscription_end()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $fn$
DECLARE
  v_cutoff  TIMESTAMPTZ;
  v_booking RECORD;
BEGIN
  IF NOT (
    (COALESCE(NEW.cancel_at_period_end, FALSE) AND NOT COALESCE(OLD.cancel_at_period_end, FALSE))
    OR (NEW.status IN ('canceled', 'unpaid', 'incomplete_expired') AND OLD.status <> NEW.status)
  ) THEN
    RETURN NEW;
  END IF;

  v_cutoff := COALESCE(NEW.current_period_end, NOW());

  -- Un abonnement résilié en fin de période garde ses droits jusqu'au terme ;
  -- un abonnement déjà mort ne couvre plus rien.
  IF NEW.status IN ('canceled', 'unpaid', 'incomplete_expired') THEN
    v_cutoff := LEAST(v_cutoff, NOW());
  END IF;

  FOR v_booking IN
    SELECT b.id, b.user_id, b.pack_purchase_id,
           sc.starts_at, COALESCE(sc.title, ct.name) AS class_name
    FROM bookings b
    JOIN pack_purchases pp ON pp.id = b.pack_purchase_id
    JOIN scheduled_classes sc ON sc.id = b.scheduled_class_id
    LEFT JOIN class_types ct ON ct.id = sc.class_type_id
    WHERE pp.subscription_id = NEW.id
      AND b.status = 'confirmed'
      AND sc.starts_at > v_cutoff
      AND NOT sc.is_cancelled
  LOOP
    UPDATE bookings
    SET status = 'cancelled', cancelled_at = NOW()
    WHERE id = v_booking.id;

    -- Aucun crédit à restituer : sur un illimité rien n'a été décompté, et le
    -- cycle qui aurait payé ce cours n'existera jamais.

    INSERT INTO notifications (user_id, type, title, message)
    VALUES (
      v_booking.user_id,
      'booking_cancelled',
      'Réservation annulée — fin d''abonnement',
      format(
        'Votre réservation pour %s du %s a été annulée : votre abonnement se termine le %s et ne couvre pas cette séance. Vous pouvez la réserver à nouveau avec un autre pack.',
        v_booking.class_name,
        to_char(v_booking.starts_at AT TIME ZONE 'Europe/Brussels', 'DD/MM/YYYY à HH24:MI'),
        to_char(v_cutoff AT TIME ZONE 'Europe/Brussels', 'DD/MM/YYYY')
      )
    );

    -- Une trace PAR réservation : chercher pourquoi un cours précis a disparu
    -- est la question qu'on se posera, pas combien il y en a eu.
    INSERT INTO activity_log (action, actor_id, target_user_id, entity_type, entity_id, description)
    VALUES (
      'booking_cancelled',
      auth.uid(),
      v_booking.user_id,
      'booking',
      v_booking.id,
      format('Annulée automatiquement — fin d''abonnement au %s : %s du %s',
             to_char(v_cutoff AT TIME ZONE 'Europe/Brussels', 'DD/MM/YYYY'),
             v_booking.class_name,
             to_char(v_booking.starts_at AT TIME ZONE 'Europe/Brussels', 'DD/MM/YYYY à HH24:MI'))
    );
  END LOOP;

  RETURN NEW;
END;
$fn$;

DROP TRIGGER IF EXISTS trg_cancel_orphan_bookings ON subscriptions;
CREATE TRIGGER trg_cancel_orphan_bookings
  AFTER UPDATE ON subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION cancel_orphan_bookings_on_subscription_end();

COMMENT ON FUNCTION cancel_orphan_bookings_on_subscription_end IS
  'Annule les réservations situées au-delà du terme d''un abonnement résilié, prévient le membre et journalise chaque annulation.';

-- Phase 4 : Annulation avec restitution conditionnelle
CREATE OR REPLACE FUNCTION cancel_booking_v2(p_booking_id UUID, p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER
AS $fn$
DECLARE
  v_booking RECORD;
  v_class RECORD;
  v_rules JSONB;
  v_hours_before NUMERIC;
  v_free_hours NUMERIC;
  v_refund BOOLEAN;
BEGIN
  SELECT * INTO v_booking FROM bookings
   WHERE id = p_booking_id AND user_id = p_user_id AND status = 'confirmed';
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'booking_not_found');
  END IF;

  SELECT * INTO v_class FROM scheduled_classes WHERE id = v_booking.scheduled_class_id;
  SELECT value INTO v_rules FROM app_settings WHERE key = 'booking_rules';

  v_hours_before := EXTRACT(EPOCH FROM (v_class.starts_at - NOW())) / 3600;
  v_free_hours := COALESCE((v_rules->>'cancellation_free_hours')::NUMERIC, 12);
  v_refund := v_hours_before >= v_free_hours;

  -- Hors délai : le crédit reste consommé, donc la place a été occupée.
  -- `is_no_show` en garde la trace pour les statistiques et pour repérer
  -- les désistements répétés.
  UPDATE bookings
     SET status = 'cancelled',
         cancelled_at = NOW(),
         is_no_show = NOT v_refund
   WHERE id = p_booking_id;

  -- Sans effet si le pack est illimité (cf. refund_credit).
  IF v_refund THEN
    PERFORM refund_credit(v_booking.pack_purchase_id);
  END IF;

  PERFORM promote_from_waitlist(v_booking.scheduled_class_id);

  RETURN jsonb_build_object('refunded', v_refund, 'hours_before', ROUND(v_hours_before, 1));
END;
$fn$;

-- Phase 1 : Auto-génération code parrainage
CREATE OR REPLACE FUNCTION generate_referral_code()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER
AS '
DECLARE
  v_name TEXT;
  v_code TEXT;
  v_count INTEGER;
BEGIN
  v_name := UPPER(COALESCE(NEW.first_name, SPLIT_PART(NEW.display_name, '' '', 1), ''MEMBER''));
  v_name := REGEXP_REPLACE(v_name, ''[^A-Z]'', '''', ''g'');
  v_name := LEFT(v_name, 8);
  LOOP
    v_code := v_name || LPAD(FLOOR(RANDOM() * 10000)::TEXT, 4, ''0'');
    SELECT COUNT(*) INTO v_count FROM profiles WHERE referral_code = v_code;
    EXIT WHEN v_count = 0;
  END LOOP;
  NEW.referral_code := v_code;
  RETURN NEW;
END;
';

-- ---- Annulation par le studio : le crédit revient toujours ----

CREATE OR REPLACE FUNCTION cancel_booking_by_studio(p_booking_id UUID)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER
AS $fn$
DECLARE
  v_booking RECORD;
BEGIN
  IF NOT (has_role(auth.uid(), 'coach')
          OR has_role(auth.uid(), 'admin')
          OR has_role(auth.uid(), 'super_admin')) THEN
    RAISE EXCEPTION 'Reserve au staff du studio';
  END IF;

  SELECT * INTO v_booking FROM bookings
    WHERE id = p_booking_id AND status = 'confirmed';

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'booking_not_found');
  END IF;

  UPDATE bookings
     SET status = 'cancelled', cancelled_at = NOW()
   WHERE id = p_booking_id;

  -- Toujours restituer : le membre n'est pas à l'origine de l'annulation.
  -- refund_credit est sans effet sur un pack illimité, où rien n'est décompté.
  PERFORM refund_credit(v_booking.pack_purchase_id);

  -- Libérer la place profite à la liste d'attente.
  PERFORM promote_from_waitlist(v_booking.scheduled_class_id);

  RETURN jsonb_build_object('refunded', true);
END;
$fn$;


-- ---- Bons d'achat et parrainage ----

CREATE OR REPLACE FUNCTION generate_credit_note_code()
RETURNS TEXT
LANGUAGE plpgsql
AS $fn$
DECLARE
  v_alphabet TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  v_code TEXT;
  v_exists BOOLEAN;
  v_i INTEGER;
BEGIN
  LOOP
    v_code := 'BON-';
    FOR v_i IN 1..4 LOOP
      v_code := v_code || substr(v_alphabet, floor(random() * length(v_alphabet) + 1)::INTEGER, 1);
    END LOOP;
    SELECT EXISTS(SELECT 1 FROM referral_rewards WHERE code = v_code) INTO v_exists;
    EXIT WHEN NOT v_exists;
  END LOOP;
  RETURN v_code;
END;
$fn$;

CREATE OR REPLACE FUNCTION set_credit_note_code()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $fn$
BEGIN
  IF NEW.code IS NULL THEN
    NEW.code := generate_credit_note_code();
  END IF;
  RETURN NEW;
END;
$fn$;

CREATE OR REPLACE FUNCTION check_referral_qualification(p_referee_id UUID)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER
AS $fn$
DECLARE
  v_referral RECORD;
  v_rules JSONB;
  v_validity_days INTEGER;
  v_referrer_cents INTEGER;
  v_referee_cents INTEGER;
  v_expires TIMESTAMPTZ;
BEGIN
  SELECT * INTO v_referral
  FROM referrals
  WHERE referee_id = p_referee_id AND status = 'pending';

  IF NOT FOUND THEN
    RETURN jsonb_build_object('qualified', false, 'reason', 'no_pending_referral');
  END IF;

  SELECT value INTO v_rules FROM app_settings WHERE key = 'referral_rules';
  v_validity_days := COALESCE((v_rules->>'reward_validity_days')::INTEGER, 180);
  -- Les réglages priment sur les colonnes de `referrals`, qui portent un
  -- DEFAULT 3000 figé à la création du parrainage : sans cette inversion,
  -- changer le montant dans les Réglages n'aurait aucun effet.
  v_referrer_cents := COALESCE(
    (v_rules->>'referrer_reward_cents')::INTEGER,
    v_referral.referrer_reward_cents, 3000);
  v_referee_cents := COALESCE(
    (v_rules->>'referee_reward_cents')::INTEGER,
    v_referral.referee_reward_cents, 3000);
  v_expires := NOW() + (v_validity_days || ' days')::INTERVAL;

  UPDATE referrals
  SET status = 'qualified', qualified_at = NOW()
  WHERE id = v_referral.id;

  INSERT INTO referral_rewards (user_id, referral_id, amount_cents, expires_at, origin) VALUES
    (v_referral.referrer_id, v_referral.id, v_referrer_cents, v_expires, 'parrainage'),
    (v_referral.referee_id,  v_referral.id, v_referee_cents,  v_expires, 'parrainage_filleul');

  INSERT INTO notifications (user_id, title, message, type, link) VALUES
    (v_referral.referrer_id, 'Parrainage validé',
     format('Ton filleul a effectué son premier achat. Tu as un bon de %s € sur ton prochain achat.',
            round(v_referrer_cents / 100.0, 2)),
     'success', '/referral'),
    (v_referral.referee_id, 'Bienvenue — bon de parrainage',
     format('Tu as un bon de %s € à utiliser sur ton prochain achat.',
            round(v_referee_cents / 100.0, 2)),
     'success', '/packs');

  RETURN jsonb_build_object(
    'qualified', true,
    'referral_id', v_referral.id,
    'referrer_cents', v_referrer_cents,
    'referee_cents', v_referee_cents
  );
END;
$fn$;

CREATE OR REPLACE FUNCTION get_usable_credit_notes(
  p_user_id UUID,
  p_purchase_cents INTEGER DEFAULT NULL
)
RETURNS TABLE(
  id UUID,
  code TEXT,
  amount_cents INTEGER,
  origin TEXT,
  reason TEXT,
  expires_at TIMESTAMPTZ,
  min_purchase_cents INTEGER
) AS $$
  SELECT
    r.id, r.code, r.amount_cents, r.origin, r.reason, r.expires_at,
    COALESCE(
      (SELECT (value->>'min_purchase_cents')::INTEGER
       FROM app_settings WHERE key = 'referral_rules'),
      3000)
  FROM referral_rewards r
  WHERE r.user_id = p_user_id
    AND r.is_used = FALSE
    AND (r.expires_at IS NULL OR r.expires_at > NOW())
    -- Le seuil ne vise que le bon du FILLEUL : le parrain est déjà client,
    -- et un dédommagement doit rester utilisable sans condition.
    AND (
      p_purchase_cents IS NULL
      OR r.origin <> 'parrainage_filleul'
      OR p_purchase_cents >= COALESCE(
           (SELECT (value->>'min_purchase_cents')::INTEGER
            FROM app_settings WHERE key = 'referral_rules'),
           3000)
    )
  ORDER BY r.expires_at ASC NULLS LAST, r.created_at ASC;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION credit_note_applicable(
  p_note_id UUID,
  p_user_id UUID,
  p_purchase_cents INTEGER
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER STABLE
AS $fn$
DECLARE
  v_note RECORD;
  v_min INTEGER;
BEGIN
  SELECT * INTO v_note
  FROM referral_rewards
  WHERE id = p_note_id AND user_id = p_user_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_found');
  END IF;
  IF v_note.is_used THEN
    RETURN jsonb_build_object('ok', false, 'error', 'already_used');
  END IF;
  IF v_note.expires_at IS NOT NULL AND v_note.expires_at < NOW() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'expired');
  END IF;

  v_min := COALESCE(
    (SELECT (value->>'min_purchase_cents')::INTEGER
     FROM app_settings WHERE key = 'referral_rules'),
    3000);

  IF v_note.origin = 'parrainage_filleul' AND p_purchase_cents < v_min THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error', 'below_minimum',
      'min_purchase_cents', v_min
    );
  END IF;

  RETURN jsonb_build_object('ok', true, 'amount_cents', v_note.amount_cents);
END;
$fn$;

CREATE OR REPLACE FUNCTION consume_credit_note(
  p_note_id UUID,
  p_user_id UUID,
  p_used_on TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER
AS $fn$
DECLARE
  v_updated INTEGER;
BEGIN
  UPDATE referral_rewards
  SET is_used = TRUE, used_at = NOW(), used_on = p_used_on
  WHERE id = p_note_id
    AND user_id = p_user_id      -- on ne consomme que le bon de son propriétaire
    AND is_used = FALSE;

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated > 0;
END;
$fn$;

CREATE OR REPLACE FUNCTION attach_referrer(p_referee_id UUID, p_referral_code TEXT)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER
AS $fn$
DECLARE
  v_referrer_id UUID;
BEGIN
  IF NOT (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'super_admin')) THEN
    RAISE EXCEPTION 'Reserve aux administrateurs';
  END IF;

  IF EXISTS(SELECT 1 FROM referrals WHERE referee_id = p_referee_id) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Ce membre a deja un parrain');
  END IF;

  SELECT id INTO v_referrer_id
  FROM profiles WHERE referral_code = upper(trim(p_referral_code));

  IF v_referrer_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Code de parrainage inconnu');
  END IF;

  IF v_referrer_id = p_referee_id THEN
    RETURN jsonb_build_object('ok', false, 'error', 'On ne peut pas se parrainer soi-meme');
  END IF;

  INSERT INTO referrals (referrer_id, referee_id, referral_code)
  VALUES (v_referrer_id, p_referee_id, upper(trim(p_referral_code)));

  RETURN jsonb_build_object('ok', true, 'referrer_id', v_referrer_id);
END;
$fn$;

CREATE OR REPLACE FUNCTION claim_referral_code(p_referral_code TEXT)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER
AS $fn$
DECLARE
  v_me UUID := auth.uid();
  v_referrer_id UUID;
  v_code TEXT := upper(trim(p_referral_code));
BEGIN
  IF v_me IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authenticated');
  END IF;

  IF EXISTS(SELECT 1 FROM referrals WHERE referee_id = v_me) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'already_referred');
  END IF;

  SELECT id INTO v_referrer_id FROM profiles WHERE referral_code = v_code;

  IF v_referrer_id IS NULL THEN
    -- Le code est saisi à l'inscription, mais traité à la première connexion :
    -- il n'y a plus d'écran pour afficher l'erreur. On notifie, sans quoi le
    -- filleul croirait son parrainage enregistré et le réclamerait plus tard.
    INSERT INTO notifications (user_id, title, message, type, link)
    VALUES (v_me, 'Code de parrainage non reconnu',
            format('Le code « %s » saisi à l''inscription n''existe pas. Contacte le studio pour le corriger.', v_code),
            'warning', '/referral');
    RETURN jsonb_build_object('ok', false, 'error', 'unknown_code');
  END IF;

  IF v_referrer_id = v_me THEN
    RETURN jsonb_build_object('ok', false, 'error', 'self_referral');
  END IF;

  INSERT INTO referrals (referrer_id, referee_id, referral_code)
  VALUES (v_referrer_id, v_me, v_code);

  RETURN jsonb_build_object('ok', true);
END;
$fn$;

CREATE OR REPLACE FUNCTION grant_credit_note(
  p_user_id UUID,
  p_amount_cents INTEGER,
  p_origin TEXT DEFAULT 'geste_commercial',
  p_reason TEXT DEFAULT NULL,
  p_validity_days INTEGER DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER
AS $fn$
DECLARE
  v_id UUID;
  v_code TEXT;
  v_days INTEGER;
BEGIN
  IF NOT (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'super_admin')) THEN
    RAISE EXCEPTION 'Reserve aux administrateurs';
  END IF;

  IF p_amount_cents IS NULL OR p_amount_cents <= 0 THEN
    RAISE EXCEPTION 'Montant invalide';
  END IF;

  v_days := COALESCE(
    p_validity_days,
    (SELECT (value->>'reward_validity_days')::INTEGER FROM app_settings WHERE key = 'referral_rules'),
    180);

  INSERT INTO referral_rewards (user_id, amount_cents, origin, reason, granted_by, expires_at)
  VALUES (p_user_id, p_amount_cents, p_origin, p_reason, auth.uid(),
          NOW() + (v_days || ' days')::INTERVAL)
  RETURNING id, code INTO v_id, v_code;

  INSERT INTO notifications (user_id, title, message, type, link)
  VALUES (p_user_id, 'Bon d''achat',
          format('Le studio t''offre un bon de %s €%s',
                 round(p_amount_cents / 100.0, 2),
                 CASE WHEN p_reason IS NOT NULL THEN ' — ' || p_reason ELSE '' END),
          'success', '/packs');

  RETURN jsonb_build_object('ok', true, 'id', v_id, 'code', v_code);
END;
$fn$;


-- ---- Rôles ----

CREATE OR REPLACE FUNCTION grant_user_role(p_user_id UUID, p_role TEXT)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER
AS $fn$
DECLARE
  v_is_admin BOOLEAN := has_role(auth.uid(), 'admin');
  v_is_super BOOLEAN := has_role(auth.uid(), 'super_admin');
  v_name TEXT;
BEGIN
  IF NOT (v_is_admin OR v_is_super) THEN
    RAISE EXCEPTION 'Reserve aux administrateurs';
  END IF;

  IF p_role NOT IN ('coach', 'admin', 'super_admin', 'client') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'role_inconnu');
  END IF;

  -- Un admin ne peut pas se créer un pair : seul un super admin promeut
  -- au rang d'admin ou de super admin.
  IF p_role IN ('admin', 'super_admin') AND NOT v_is_super THEN
    RETURN jsonb_build_object('ok', false, 'error', 'super_admin_requis');
  END IF;

  SELECT display_name INTO v_name FROM profiles WHERE id = p_user_id;
  IF v_name IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'membre_introuvable');
  END IF;

  INSERT INTO user_roles (user_id, role)
  VALUES (p_user_id, p_role::user_role)
  ON CONFLICT (user_id, role) DO NOTHING;

  INSERT INTO activity_log (action, actor_id, target_user_id, entity_type, entity_id, details, description)
  VALUES ('role_changed', auth.uid(), p_user_id, 'user_role', p_user_id,
          jsonb_build_object('granted', p_role),
          format('Rôle « %s » accordé à %s', p_role, v_name));

  INSERT INTO notifications (user_id, title, message, type, link)
  VALUES (p_user_id,
          CASE p_role
            WHEN 'coach' THEN 'Tu es désormais coach'
            ELSE 'Tes droits ont changé'
          END,
          CASE p_role
            WHEN 'coach' THEN 'Tu as accès à tes cours et aux participants.'
            ELSE format('Le rôle « %s » t''a été accordé.', p_role)
          END,
          'info', '/');

  RETURN jsonb_build_object('ok', true, 'role', p_role);
END;
$fn$;

CREATE OR REPLACE FUNCTION revoke_user_role(p_user_id UUID, p_role TEXT)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER
AS $fn$
DECLARE
  v_is_admin BOOLEAN := has_role(auth.uid(), 'admin');
  v_is_super BOOLEAN := has_role(auth.uid(), 'super_admin');
  v_name TEXT;
  v_remaining INTEGER;
BEGIN
  IF NOT (v_is_admin OR v_is_super) THEN
    RAISE EXCEPTION 'Reserve aux administrateurs';
  END IF;

  IF p_role IN ('admin', 'super_admin') AND NOT v_is_super THEN
    RETURN jsonb_build_object('ok', false, 'error', 'super_admin_requis');
  END IF;

  -- On ne se retire pas ses propres droits : un studio sans admin serait
  -- verrouillé, et il faudrait repasser par la base pour en sortir.
  IF p_user_id = auth.uid() AND p_role IN ('admin', 'super_admin') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'auto_retrait_interdit');
  END IF;

  -- Ni le dernier super admin : même raison.
  IF p_role = 'super_admin' THEN
    SELECT COUNT(*) INTO v_remaining
    FROM user_roles WHERE role = 'super_admin' AND user_id <> p_user_id;
    IF v_remaining = 0 THEN
      RETURN jsonb_build_object('ok', false, 'error', 'dernier_super_admin');
    END IF;
  END IF;

  SELECT display_name INTO v_name FROM profiles WHERE id = p_user_id;

  DELETE FROM user_roles WHERE user_id = p_user_id AND role = p_role::user_role;

  INSERT INTO activity_log (action, actor_id, target_user_id, entity_type, entity_id, details, description)
  VALUES ('role_changed', auth.uid(), p_user_id, 'user_role', p_user_id,
          jsonb_build_object('revoked', p_role),
          format('Rôle « %s » retiré à %s', p_role, COALESCE(v_name, '?')));

  RETURN jsonb_build_object('ok', true);
END;
$fn$;

-- Ces deux fonctions sont le SEUL chemin d'écriture dans user_roles : elles
-- portent le contrôle de hiérarchie que les policies ne font plus. Laissées
-- exécutables par PUBLIC, elles ouvriraient à un visiteur non authentifié ce
-- qu'on vient de fermer aux admins.
REVOKE ALL ON FUNCTION grant_user_role(UUID, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION revoke_user_role(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION grant_user_role(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION revoke_user_role(UUID, TEXT) TO authenticated;


-- ---- Outil de test ----

CREATE OR REPLACE FUNCTION reset_member_purchases(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER
AS $reset_fn$
DECLARE
  v_mode TEXT;
  v_live INTEGER;
  v_bookings INTEGER;
  v_waitlist INTEGER;
  v_invoices INTEGER;
  v_packs INTEGER;
  v_subs INTEGER;
  v_fees INTEGER;
BEGIN
  IF NOT (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'super_admin')) THEN
    RAISE EXCEPTION 'Reserve aux administrateurs';
  END IF;

  SELECT value->>'mode' INTO v_mode FROM app_settings WHERE key = 'stripe_mode';
  IF v_mode = 'live' THEN
    RAISE EXCEPTION 'Interdit en mode live';
  END IF;

  SELECT COUNT(*) INTO v_live
  FROM subscriptions WHERE user_id = p_user_id AND stripe_mode = 'live';
  IF v_live > 0 THEN
    RAISE EXCEPTION 'Ce membre a des abonnements live : suppression refusee';
  END IF;

  SELECT COUNT(*) INTO v_bookings FROM bookings WHERE user_id = p_user_id;
  SELECT COUNT(*) INTO v_waitlist FROM waitlist WHERE user_id = p_user_id;
  SELECT COUNT(*) INTO v_invoices FROM invoice_requests WHERE user_id = p_user_id;
  SELECT COUNT(*) INTO v_packs FROM pack_purchases WHERE user_id = p_user_id;
  SELECT COUNT(*) INTO v_subs FROM subscriptions WHERE user_id = p_user_id;
  SELECT COUNT(*) INTO v_fees FROM registration_fees WHERE user_id = p_user_id;

  DELETE FROM bookings WHERE user_id = p_user_id;
  DELETE FROM waitlist WHERE user_id = p_user_id;
  DELETE FROM invoice_requests WHERE user_id = p_user_id;
  DELETE FROM pack_purchases WHERE user_id = p_user_id;
  DELETE FROM subscriptions WHERE user_id = p_user_id;
  DELETE FROM registration_fees WHERE user_id = p_user_id;

  PERFORM update_member_status(p_user_id);
  -- Remis à zéro veut dire remis à neuf : la séance d'essai revient.
  PERFORM grant_trial_pack(p_user_id);

  RETURN jsonb_build_object(
    'bookings', v_bookings,
    'waitlist', v_waitlist,
    'invoice_requests', v_invoices,
    'packs', v_packs,
    'subscriptions', v_subs,
    'registration_fees', v_fees
  );
END;
$reset_fn$;

-- ---- Statistiques du membre (page Stats) ----

CREATE OR REPLACE FUNCTION member_sessions_count(p_user_id UUID, p_from DATE, p_to DATE)
RETURNS INTEGER
LANGUAGE sql SECURITY DEFINER STABLE
AS $$
  -- L'historique repris ne s'ajoute qu'au total de TOUJOURS. La fonction sert a
  -- trois usages depuis le meme ecran — le total, la semaine, le mois — et un
  -- client repris afficherait sinon quarante-sept seances « cette semaine ».
  --
  -- Le seuil de 2021 est arbitraire mais sur : le studio n'existait pas, et
  -- aucune periode d'interet ne commence avant.
  SELECT (
    SELECT COUNT(*)::INTEGER FROM bookings b
    JOIN scheduled_classes sc ON b.scheduled_class_id = sc.id
    WHERE b.user_id = p_user_id
      AND b.status = 'confirmed'
      AND (b.checked_in_at IS NOT NULL OR sc.starts_at > NOW())
      AND sc.starts_at::DATE BETWEEN p_from AND p_to
  ) + COALESCE((
    -- Le COALESCE couvre le profil absent : sans lui, NULL + n'importe quoi
    -- vaut NULL, et l'ecran afficherait un vide la ou il attend un nombre.
    SELECT CASE WHEN p_from <= DATE '2021-01-01'
                THEN seances_anterieures ELSE 0 END
      FROM profiles WHERE id = p_user_id
  ), 0);
$$;

-- 2. Répartition par type de cours
CREATE OR REPLACE FUNCTION member_sessions_by_type(p_user_id UUID)
RETURNS TABLE(class_type_name TEXT, class_type_color TEXT, count BIGINT)
LANGUAGE sql SECURITY DEFINER STABLE
AS $$
  SELECT ct.name, ct.color, COUNT(*)
  FROM bookings b
  JOIN scheduled_classes sc ON b.scheduled_class_id = sc.id
  JOIN class_types ct ON sc.class_type_id = ct.id
  WHERE b.user_id = p_user_id
    AND b.status = 'confirmed'
    AND (b.checked_in_at IS NOT NULL OR sc.starts_at > NOW())
  GROUP BY ct.name, ct.color
  ORDER BY count DESC;
$$;

-- 3. Séances par mois (12 derniers mois)
CREATE OR REPLACE FUNCTION member_sessions_by_month(p_user_id UUID)
RETURNS TABLE(month TEXT, count BIGINT)
LANGUAGE sql SECURITY DEFINER STABLE
AS $$
  SELECT TO_CHAR(sc.starts_at, 'YYYY-MM') AS month, COUNT(*)
  FROM bookings b
  JOIN scheduled_classes sc ON b.scheduled_class_id = sc.id
  WHERE b.user_id = p_user_id
    AND b.status = 'confirmed'
    AND (b.checked_in_at IS NOT NULL OR sc.starts_at > NOW())
    AND sc.starts_at > NOW() - INTERVAL '12 months'
  GROUP BY month
  ORDER BY month;
$$;

-- 4. Streak (semaines consécutives avec au moins 1 séance)
CREATE OR REPLACE FUNCTION member_streak(p_user_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql SECURITY DEFINER STABLE
AS '
DECLARE
  v_streak INTEGER := 0;
  v_week_start DATE;
  v_has_session BOOLEAN;
BEGIN
  v_week_start := date_trunc(''week'', NOW())::DATE;
  LOOP
    SELECT EXISTS(
      SELECT 1 FROM bookings b
      JOIN scheduled_classes sc ON b.scheduled_class_id = sc.id
      WHERE b.user_id = p_user_id
        AND b.status = ''confirmed''
        AND (b.checked_in_at IS NOT NULL OR sc.starts_at > NOW())
        AND sc.starts_at::DATE BETWEEN v_week_start AND v_week_start + 6
    ) INTO v_has_session;

    IF v_has_session THEN
      v_streak := v_streak + 1;
      v_week_start := v_week_start - 7;
    ELSE
      EXIT;
    END IF;
  END LOOP;
  RETURN v_streak;
END;
';

-- 5. Jours d'entraînement (pour calendrier coloré, 3 derniers mois)
CREATE OR REPLACE FUNCTION member_training_days(p_user_id UUID)
RETURNS TABLE(training_date DATE)
LANGUAGE sql SECURITY DEFINER STABLE
AS $$
  SELECT DISTINCT sc.starts_at::DATE AS training_date
  FROM bookings b
  JOIN scheduled_classes sc ON b.scheduled_class_id = sc.id
  WHERE b.user_id = p_user_id
    AND b.status = 'confirmed'
    AND (b.checked_in_at IS NOT NULL OR sc.starts_at > NOW())
    AND sc.starts_at > NOW() - INTERVAL '3 months'
  ORDER BY training_date;
$$;

-- 6. Objectif hebdo + badges
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS weekly_goal INTEGER DEFAULT 3;



-- ---- Inscription et renoncement pilotes par le staff ----

CREATE OR REPLACE FUNCTION book_member_by_staff(
  p_class_id UUID,
  p_user_id UUID,
  p_pack_purchase_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER
AS $fn$
DECLARE
  v_is_admin BOOLEAN := has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'super_admin');
  v_is_coach BOOLEAN := has_role(auth.uid(), 'coach');
  v_class RECORD;
  v_count INTEGER;
  v_pack RECORD;
  v_booking_id UUID;
  v_member TEXT;
  v_window_days NUMERIC;
BEGIN
  IF NOT (v_is_admin OR v_is_coach) THEN
    RAISE EXCEPTION 'Reserve au staff du studio';
  END IF;

  SELECT * INTO v_class FROM scheduled_classes WHERE id = p_class_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'class_not_found');
  END IF;

  -- Un coach n'agit que sur ses propres cours : il est responsable de sa
  -- salle, pas de celle d'un collègue.
  IF NOT v_is_admin AND v_class.coach_id IS DISTINCT FROM auth.uid() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_your_class');
  END IF;

  IF v_class.is_cancelled THEN
    RETURN jsonb_build_object('ok', false, 'error', 'class_cancelled');
  END IF;

  -- La fenetre d'ouverture vaut AUSSI pour le staff (decision du 2026-08-29) :
  -- deux regimes auraient produit des plannings incoherents, et personne
  -- n'aurait su lequel faisait foi.
  --
  -- Elle ne borne que le futur : un cours passe reste inscriptible, c'est ce
  -- qui permet a un coach de regulariser quelqu'un qui est venu.
  SELECT (value->>'booking_window_days')::NUMERIC INTO v_window_days
    FROM app_settings WHERE key = 'booking_rules';
  IF v_window_days IS NOT NULL AND v_window_days > 0
     AND v_class.starts_at > NOW() + (v_window_days || ' days')::INTERVAL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'outside_booking_window');
  END IF;

  -- Le cours passé reste inscriptible : un coach peut régulariser après coup
  -- quelqu'un qui est venu. Seule la capacité fait barrage.
  SELECT COUNT(*) INTO v_count
  FROM bookings WHERE scheduled_class_id = p_class_id AND status = 'confirmed';

  IF v_count >= v_class.max_participants THEN
    RETURN jsonb_build_object('ok', false, 'error', 'class_full');
  END IF;

  IF EXISTS(SELECT 1 FROM bookings
             WHERE scheduled_class_id = p_class_id
               AND user_id = p_user_id
               AND status = 'confirmed') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'already_booked');
  END IF;

  -- Source de paiement : celle qu'on nous donne, sinon la première utilisable
  -- (abonnement d'abord, cf. get_available_credits).
  IF p_pack_purchase_id IS NOT NULL THEN
    SELECT pp.id, pp.credits_remaining, pt.is_unlimited
      INTO v_pack
    FROM pack_purchases pp
    JOIN pack_types pt ON pt.id = pp.pack_type_id
    WHERE pp.id = p_pack_purchase_id
      AND pp.user_id = p_user_id
      AND pp.expires_at > NOW()
      AND (pt.is_unlimited OR pp.credits_remaining > 0);
  ELSE
    SELECT c.pack_purchase_id, c.credits_remaining, c.is_unlimited
      INTO v_pack
    FROM get_available_credits(
           p_user_id,
           (SELECT credit_type_id FROM class_types WHERE id = v_class.class_type_id)
         ) c
    LIMIT 1;
  END IF;

  IF v_pack IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'no_credit');
  END IF;

  -- Réactiver une annulation plutôt que d'en créer une seconde : la
  -- contrainte d'unicité (cours, membre) l'interdirait.
  UPDATE bookings
     SET status = 'confirmed',
         pack_purchase_id = v_pack.id,
         cancelled_at = NULL,
         is_no_show = FALSE
   WHERE scheduled_class_id = p_class_id
     AND user_id = p_user_id
     AND status = 'cancelled'
  RETURNING id INTO v_booking_id;

  IF v_booking_id IS NULL THEN
    INSERT INTO bookings (scheduled_class_id, user_id, pack_purchase_id)
    VALUES (p_class_id, p_user_id, v_pack.id)
    RETURNING id INTO v_booking_id;
  END IF;

  PERFORM consume_credit(v_pack.id);

  SELECT display_name INTO v_member FROM profiles WHERE id = p_user_id;

  INSERT INTO activity_log (action, actor_id, target_user_id, entity_type, entity_id, details, description)
  VALUES ('booking_assigned', auth.uid(), p_user_id, 'booking', v_booking_id,
          jsonb_build_object('by_staff', true, 'scheduled_class_id', p_class_id),
          format('%s inscrit(e) par le staff au cours du %s',
                 COALESCE(v_member, '?'),
                 to_char(v_class.starts_at AT TIME ZONE 'Europe/Brussels', 'DD/MM/YYYY HH24:MI')));

  RETURN jsonb_build_object('ok', true, 'booking_id', v_booking_id);
END;
$fn$;

-- Inscription d'un tiers par le staff : jamais anonyme. Voir la note sur
-- `anon` plus bas — `FROM PUBLIC` ne l'atteindrait pas.
REVOKE EXECUTE ON FUNCTION book_member_by_staff(UUID, UUID, UUID) FROM anon;

-- ============================================================================
-- Réservation membre atomique : décider et écrire dans la même transaction
-- ----------------------------------------------------------------------------
-- CE QUI NE VA PAS AUJOURD'HUI
--
-- `confirmBooking()` réserve en quatre allers-retours depuis le navigateur :
--   1. `can_book_class`        — le cours est-il ouvert, reste-t-il de la place
--   2. `get_available_credits` — quelle source de paiement
--   3. INSERT dans `bookings`
--   4. `consume_credit`        — décrémenter
--
-- Entre 1 et 3, rien ne tient. Deux membres qui cliquent sur la dernière place
-- à la même seconde lisent tous les deux « une place libre » et écrivent tous
-- les deux : le cours part à 9 inscrits pour 8 places. Aucune contrainte en
-- base ne s'y oppose — `UNIQUE(scheduled_class_id, user_id)` protège de la
-- double inscription d'un MÊME membre, pas du dépassement de capacité.
--
-- L'étape 4 a son propre défaut : elle n'est pas contrôlée côté front, et
-- surtout `consume_credit` porte `AND credits_remaining > 0`. À zéro crédit,
-- elle ne touche aucune ligne et ne lève AUCUNE erreur. La réservation existe,
-- rien n'est débité. Tester `error` ne suffirait donc même pas.
--
-- Le projet connaît déjà ce raisonnement : le commentaire du trigger de quota
-- dit « les réservations partent d'un INSERT direct depuis le front, donc un
-- contrôle appelé côté client serait décoratif ». La leçon avait été appliquée
-- au quota, jamais à la capacité ni aux crédits. Cette fonction l'y applique.
--
-- CE QUE FAIT CETTE FONCTION
--
-- Le pendant membre de `book_member_by_staff` : mêmes contrôles, même écriture,
-- une seule transaction. Elle ne remplace pas les vérifications du front —
-- celles-ci restent utiles pour EXPLIQUER (« vos crédits se rechargent le 3 »,
-- « ce pack ne couvre pas ce type de cours ») ; elles cessent seulement d'être
-- ce sur quoi repose la justesse.
--
-- Le verrou est CONSULTATIF, posé sur l'identifiant du cours. Un
-- `SELECT ... FOR UPDATE` sur `scheduled_classes` marcherait aussi, mais
-- bloquerait un admin modifiant l'horaire pendant qu'un membre réserve. Ici on
-- ne sérialise que les réservations du même cours, ce qui est exactement le
-- conflit à traiter. Le verrou tombe à la fin de la transaction, quoi qu'il
-- arrive — pas de déverrouillage à écrire, donc pas de déverrouillage à
-- oublier.
-- ============================================================================

CREATE OR REPLACE FUNCTION book_class(
  p_class_id UUID,
  p_pack_purchase_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_user_id     UUID := auth.uid();
  v_check       JSONB;
  v_class       RECORD;
  v_pack        RECORD;
  v_booking_id  UUID;
  v_taken       INTEGER;
  v_consumed    INTEGER;
BEGIN
  -- On ne réserve que pour soi. Le staff inscrit un tiers par
  -- `book_member_by_staff`, qui porte ses propres contrôles de rôle.
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_authenticated');
  END IF;

  -- Le cours, lu une fois pour toutes : son type de crédit, sa date, sa
  -- capacité et son éventuelle annulation servent tous plus bas.
  SELECT class_type_id, starts_at, max_participants, is_cancelled
    INTO v_class
    FROM scheduled_classes
   WHERE id = p_class_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'class_not_found');
  END IF;

  -- Sérialiser les réservations de CE cours, et d'aucun autre.
  --
  -- Le verrou est pris avant de compter les places : le prendre après
  -- laisserait justement passer les deux lectures concurrentes qu'il existe
  -- pour empêcher. `hashtextextended` ramène l'UUID à la clé bigint attendue.
  PERFORM pg_advisory_xact_lock(hashtextextended(p_class_id::TEXT, 0));

  -- Heure de fermeture des réservations : règle d'exploitation, déléguée à
  -- `can_book_class` — la fonction que le front appelle déjà. La dupliquer
  -- garantirait qu'un jour les deux copies divergent. Ici elle s'exécute APRÈS
  -- le verrou, donc son verdict tient jusqu'à l'écriture.
  v_check := can_book_class(p_class_id, v_user_id);
  IF (v_check->>'can_book')::BOOLEAN IS NOT TRUE THEN
    RETURN jsonb_build_object('ok', false, 'reason', COALESCE(v_check->>'reason', 'not_bookable'));
  END IF;

  -- Les quatre refus qui ne se négocient pas, revérifiés ici.
  --
  -- Ce n'est pas de la méfiance envers `can_book_class` mais envers une de ses
  -- lignes : elle commence par lire le réglage `booking_rules` et, s'il est
  -- absent, retourne `can_book: true` AVANT d'avoir testé quoi que ce soit.
  -- Un réglage manquant ouvrirait alors les cours passés, annulés et complets.
  -- Le réglage est livré par `install.sql` et l'interface d'administration ne
  -- sait que le modifier — le cas est donc improbable, mais « improbable »
  -- n'est pas une garantie qu'on veut voir porter les places d'un cours.
  --
  -- Ces quatre contrôles-là sont bon marché et ne dépendent d'aucun réglage.
  IF v_class.is_cancelled THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'class_cancelled');
  END IF;

  IF v_class.starts_at <= NOW() THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'class_past');
  END IF;

  IF EXISTS (SELECT 1 FROM bookings
              WHERE scheduled_class_id = p_class_id
                AND user_id = v_user_id
                AND status = 'confirmed') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'already_booked');
  END IF;

  -- Le compte des places, sous verrou : c'est LA raison d'être de la fonction.
  SELECT COUNT(*) INTO v_taken
    FROM bookings
   WHERE scheduled_class_id = p_class_id
     AND status = 'confirmed';

  IF v_taken >= v_class.max_participants THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'class_full');
  END IF;

  -- Source de paiement : celle que le membre a choisie dans la pop-up, sinon
  -- la première utilisable (abonnement d'abord, cf. get_available_credits).
  --
  -- Le pack choisi est revalidé par le MÊME `get_available_credits` qui a
  -- servi à l'afficher : il porte déjà la couverture de la date du cours, le
  -- type de crédit et le quota du cycle. Le revérifier autrement, c'est
  -- réécrire ces règles une troisième fois.
  IF p_pack_purchase_id IS NOT NULL THEN
    SELECT c.pack_purchase_id, c.is_unlimited
      INTO v_pack
      FROM get_available_credits(
             v_user_id,
             (SELECT credit_type_id FROM class_types WHERE id = v_class.class_type_id),
             v_class.starts_at
           ) c
     WHERE c.pack_purchase_id = p_pack_purchase_id;
  ELSE
    SELECT c.pack_purchase_id, c.is_unlimited
      INTO v_pack
      FROM get_available_credits(
             v_user_id,
             (SELECT credit_type_id FROM class_types WHERE id = v_class.class_type_id),
             v_class.starts_at
           ) c
     LIMIT 1;
  END IF;

  -- Testé sur le champ plutôt que sur `NOT FOUND` : le drapeau serait écrasé
  -- par la première instruction SQL qu'on glisserait au-dessus.
  IF v_pack.pack_purchase_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'no_credit');
  END IF;

  -- DÉCOMPTE D'ABORD, RÉSERVATION ENSUITE.
  --
  -- L'ordre inverse serait plus naturel à lire, mais il obligerait à annuler
  -- une réservation déjà écrite quand le crédit manque — donc à lever une
  -- exception pour provoquer le ROLLBACK, et à faire gérer au front DEUX
  -- formes de refus pour la même fonction : un `{ok:false}` pour tous les cas,
  -- et une erreur 400 pour celui-ci. En décomptant avant, le refus sort par le
  -- même chemin que les autres.
  --
  -- `consume_credit` ne peut pas servir ici : elle renvoie VOID, donc son
  -- échec est indiscernable de son succès — c'est précisément le défaut qu'on
  -- corrige. On refait son UPDATE, à l'identique, pour pouvoir compter les
  -- lignes touchées.
  --
  -- Un pack illimité ne décompte rien par construction : attendre une ligne
  -- touchée ferait échouer toutes ses réservations.
  IF NOT v_pack.is_unlimited THEN
    UPDATE pack_purchases
       SET credits_remaining = credits_remaining - 1
     WHERE id = v_pack.pack_purchase_id
       AND credits_remaining > 0;

    GET DIAGNOSTICS v_consumed = ROW_COUNT;
    IF v_consumed = 0 THEN
      RETURN jsonb_build_object('ok', false, 'reason', 'no_credit');
    END IF;
  END IF;

  -- Réactiver une annulation plutôt que d'en créer une seconde : la contrainte
  -- UNIQUE(scheduled_class_id, user_id) l'interdirait.
  UPDATE bookings
     SET status = 'confirmed',
         pack_purchase_id = v_pack.pack_purchase_id,
         cancelled_at = NULL,
         is_no_show = FALSE
   WHERE scheduled_class_id = p_class_id
     AND user_id = v_user_id
     AND status = 'cancelled'
  RETURNING id INTO v_booking_id;

  IF v_booking_id IS NULL THEN
    INSERT INTO bookings (scheduled_class_id, user_id, pack_purchase_id)
    VALUES (p_class_id, v_user_id, v_pack.pack_purchase_id)
    RETURNING id INTO v_booking_id;
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'booking_id', v_booking_id,
    'pack_purchase_id', v_pack.pack_purchase_id
  );
END;
$fn$;

COMMENT ON FUNCTION book_class(UUID, UUID) IS
  'Réservation d''un membre pour lui-même : contrôles et écriture dans une seule transaction, sous verrou du cours. Pendant de book_member_by_staff. Renvoie {ok, booking_id, pack_purchase_id} ou {ok:false, reason}.';

-- `FROM PUBLIC` serait sans effet : Supabase accorde EXECUTE NOMMEMENT a
-- `anon` sur toute fonction du schema public, via ses DEFAULT PRIVILEGES.
-- Le droit ne vient pas de PUBLIC, il faut donc viser le role lui-meme.
REVOKE EXECUTE ON FUNCTION book_class(UUID, UUID) FROM anon;
GRANT EXECUTE ON FUNCTION book_class(UUID, UUID) TO authenticated;

-- ============================================================================
-- Purge du journal d'activité — réservée au super admin
-- ----------------------------------------------------------------------------
-- POURQUOI UNE FONCTION PLUTÔT QU'UNE POLICY DELETE
--
-- `activity_log` n'a aucune policy DELETE : personne ne peut y effacer quoi que
-- ce soit, et c'est très bien ainsi. Ouvrir une policy `DELETE` au super admin
-- l'autoriserait à supprimer N'IMPORTE QUELLE ligne, une par une, depuis
-- n'importe quel client — un journal d'audit que son lecteur peut trafiquer
-- ligne par ligne ne vaut plus rien.
--
-- Cette fonction n'autorise qu'UNE chose : effacer en bloc ce qui est plus
-- ancien qu'un nombre de mois donné. Impossible d'y faire disparaître une
-- ligne gênante en laissant le reste.
--
-- LE GARDE-FOU N'EST PAS DANS L'INTERFACE
--
-- Le bouton sera masqué aux non-super-admins, mais un bouton caché n'est pas
-- une sécurité : l'appel RPC reste à portée de qui sait ouvrir une console.
-- Le contrôle de rôle est donc ICI, et c'est lui qui compte.
--
-- LA PURGE SE JOURNALISE ELLE-MÊME
--
-- Effacer le journal laisse une trace dans le journal — qui a purgé, quand,
-- combien de lignes, jusqu'à quelle date. Sans cela, un trou dans l'historique
-- serait indiscernable d'une panne.
--
-- MINIMUM SIX MOIS
--
-- Le paramètre est borné : on ne peut pas purger en deçà de six mois. Rien
-- n'oblige un studio à conserver ce journal, mais un « 0 mois » saisi par
-- mégarde dans un champ effacerait tout l'historique récent, celui qui sert
-- justement à comprendre ce qui vient de se passer.
-- ============================================================================

CREATE OR REPLACE FUNCTION purge_activity_log(p_months INTEGER)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_uid     UUID := auth.uid();
  v_cutoff  TIMESTAMPTZ;
  v_deleted INTEGER;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_authenticated');
  END IF;

  -- Le super admin, et lui seul. Un admin ordinaire gère le studio ; effacer
  -- la trace de ce que les admins ont fait est d'un autre ordre.
  IF NOT has_role(v_uid, 'super_admin') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'forbidden');
  END IF;

  IF p_months IS NULL OR p_months < 6 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'too_recent', 'min_months', 6);
  END IF;

  v_cutoff := NOW() - (p_months || ' months')::INTERVAL;

  DELETE FROM activity_log WHERE created_at < v_cutoff;
  GET DIAGNOSTICS v_deleted = ROW_COUNT;

  -- La trace de la purge, écrite APRÈS la suppression : la borne de coupure
  -- étant dans le passé, cette ligne-ci ne peut pas être emportée par sa
  -- propre purge.
  INSERT INTO activity_log (action, actor_id, target_user_id, entity_type, details, description)
  VALUES (
    'activity_log_purged',
    v_uid,
    v_uid,
    'activity_log',
    jsonb_build_object('months', p_months, 'deleted', v_deleted, 'cutoff', v_cutoff),
    format('Journal purgé : %s entrée(s) antérieure(s) au %s effacée(s)',
           v_deleted,
           to_char(v_cutoff AT TIME ZONE 'Europe/Brussels', 'DD/MM/YYYY'))
  );

  RETURN jsonb_build_object(
    'ok', true,
    'deleted', v_deleted,
    'cutoff', v_cutoff
  );
END;
$fn$;

COMMENT ON FUNCTION purge_activity_log(INTEGER) IS
  'Efface les entrées du journal antérieures à N mois (N >= 6). Réservée au super admin, se journalise elle-même. Renvoie {ok, deleted, cutoff} ou {ok:false, reason}.';

-- `FROM PUBLIC` serait sans effet : Supabase accorde EXECUTE NOMMEMENT a
-- `anon` sur toute fonction du schema public, via ses DEFAULT PRIVILEGES.
-- Le droit ne vient pas de PUBLIC, il faut donc viser le role lui-meme.
REVOKE EXECUTE ON FUNCTION purge_activity_log(INTEGER) FROM anon;
GRANT EXECUTE ON FUNCTION purge_activity_log(INTEGER) TO authenticated;

-- ---------------------------------------------------------------------------
-- Combien serait effacé ? — pour annoncer avant d'agir
-- ---------------------------------------------------------------------------
-- L'écran affiche ce nombre dans sa demande de confirmation. Sans lui, on
-- confirmerait une suppression sans savoir si elle porte sur trois lignes ou
-- sur trois ans.
CREATE OR REPLACE FUNCTION count_activity_log_before(p_months INTEGER)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_count INTEGER;
BEGIN
  IF NOT has_role(auth.uid(), 'super_admin') THEN
    RETURN NULL;
  END IF;

  SELECT COUNT(*) INTO v_count
  FROM activity_log
  WHERE created_at < NOW() - (GREATEST(p_months, 0) || ' months')::INTERVAL;

  RETURN v_count;
END;
$fn$;

COMMENT ON FUNCTION count_activity_log_before(INTEGER) IS
  'Nombre d''entrées du journal antérieures à N mois. NULL si l''appelant n''est pas super admin.';

-- `FROM PUBLIC` serait sans effet : Supabase accorde EXECUTE NOMMEMENT a
-- `anon` sur toute fonction du schema public, via ses DEFAULT PRIVILEGES.
-- Le droit ne vient pas de PUBLIC, il faut donc viser le role lui-meme.
REVOKE EXECUTE ON FUNCTION count_activity_log_before(INTEGER) FROM anon;
GRANT EXECUTE ON FUNCTION count_activity_log_before(INTEGER) TO authenticated;

CREATE OR REPLACE FUNCTION decline_modified_booking(p_booking_id UUID)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER
AS $fn$
DECLARE
  v_booking RECORD;
  v_class RECORD;
BEGIN
  SELECT * INTO v_booking FROM bookings
   WHERE id = p_booking_id
     AND user_id = auth.uid()          -- on ne renonce que pour soi
     AND status = 'confirmed';

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'booking_not_found');
  END IF;

  SELECT * INTO v_class FROM scheduled_classes WHERE id = v_booking.scheduled_class_id;

  IF v_class.starts_at < NOW() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'class_past');
  END IF;

  -- Le cours doit avoir été modifié APRÈS la réservation : c'est ce qui
  -- justifie la restitution hors délai.
  IF v_class.updated_at IS NULL OR v_class.updated_at <= v_booking.created_at THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_modified');
  END IF;

  UPDATE bookings
     SET status = 'cancelled', cancelled_at = NOW(), is_no_show = FALSE
   WHERE id = p_booking_id;

  -- Restitution systématique : sans effet sur un pack illimité.
  PERFORM refund_credit(v_booking.pack_purchase_id);
  PERFORM promote_from_waitlist(v_booking.scheduled_class_id);

  INSERT INTO activity_log (action, actor_id, target_user_id, entity_type, entity_id, details, description)
  VALUES ('booking_cancelled', auth.uid(), auth.uid(), 'booking', p_booking_id,
          jsonb_build_object('reason', 'class_modified', 'refunded', true),
          format('Renoncement après modification du cours du %s — crédit restitué',
                 to_char(v_class.starts_at AT TIME ZONE 'Europe/Brussels', 'DD/MM/YYYY HH24:MI')));

  RETURN jsonb_build_object('ok', true, 'refunded', true);
END;
$fn$;

-- ============================================
-- 3. TRIGGERS
-- ============================================

-- Auto-création profil à l'inscription (avec champs enrichis Phase 1)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS '
BEGIN
  INSERT INTO public.profiles (
    id, display_name, email, first_name, last_name, phone,
    date_of_birth, address, cgv_accepted_at, rgpd_accepted_at, member_status
  ) VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>''display_name'', ''Utilisateur''),
    NEW.email,
    NEW.raw_user_meta_data->>''first_name'',
    NEW.raw_user_meta_data->>''last_name'',
    NEW.raw_user_meta_data->>''phone'',
    CASE WHEN NEW.raw_user_meta_data->>''date_of_birth'' IS NOT NULL
         THEN (NEW.raw_user_meta_data->>''date_of_birth'')::DATE ELSE NULL END,
    NEW.raw_user_meta_data->>''address'',
    CASE WHEN (NEW.raw_user_meta_data->>''cgv_accepted'')::BOOLEAN = TRUE
         THEN NOW() ELSE NULL END,
    CASE WHEN (NEW.raw_user_meta_data->>''rgpd_accepted'')::BOOLEAN = TRUE
         THEN NOW() ELSE NULL END,
    ''potential''
  );
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, ''client'');

  -- Bloc protégé à part : le journal est utile, l''inscription est essentielle.
  -- Une écriture de trace qui échoue ne doit pas emporter la création du compte
  -- — le EXCEPTION global du dessous avalerait l''erreur en laissant un profil
  -- à moitié construit.
  BEGIN
    INSERT INTO public.activity_log (
      action, actor_id, target_user_id, entity_type, entity_id, details, description
    ) VALUES (
      ''signup_attempt'', NEW.id, NEW.id, ''profile'', NEW.id,
      jsonb_build_object(
        ''email'', NEW.email,
        ''self_signup'', true,
        ''email_confirmed'', (NEW.email_confirmed_at IS NOT NULL)
      ),
      format(''Tentative d''''inscription : %s (%s)'',
             COALESCE(NEW.raw_user_meta_data->>''display_name'', ''sans nom''),
             COALESCE(NEW.email, ''sans e-mail''))
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE LOG ''handle_new_user activity_log error: %'', SQLERRM;
  END;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE LOG ''handle_new_user error: %'', SQLERRM;
  RETURN NEW;
END;
';

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Séance d'essai attribuée à la création du profil. Le trigger porte sur
-- `profiles` et non sur `auth.users` : à ce moment le profil existe déjà, donc
-- la clé étrangère de pack_purchases est satisfaite.
CREATE TRIGGER on_profile_created_grant_trial
  AFTER INSERT ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.grant_trial_on_profile_create();

-- Sync profiles.email when auth.users.email changes (after confirmation)
CREATE OR REPLACE FUNCTION public.sync_profile_email()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.email IS DISTINCT FROM OLD.email THEN
    UPDATE public.profiles SET email = NEW.email WHERE id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_email_change
  AFTER UPDATE OF email ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_profile_email();

-- Code parrainage auto
CREATE TRIGGER generate_referral_code_trigger
  BEFORE INSERT ON profiles
  FOR EACH ROW
  WHEN (NEW.referral_code IS NULL)
  EXECUTE FUNCTION generate_referral_code();

-- Auto-update updated_at
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_pack_types_updated_at
  BEFORE UPDATE ON pack_types FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_scheduled_classes_updated_at
  BEFORE UPDATE ON scheduled_classes FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Permissions pour le trigger d'inscription
GRANT USAGE ON SCHEMA public TO supabase_auth_admin;
GRANT INSERT ON public.profiles TO supabase_auth_admin;
GRANT INSERT ON public.user_roles TO supabase_auth_admin;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO supabase_auth_admin;

-- Code de bon d'achat, posé à la création.
CREATE TRIGGER set_credit_note_code_trigger
  BEFORE INSERT ON referral_rewards
  FOR EACH ROW EXECUTE FUNCTION set_credit_note_code();

CREATE TRIGGER subscriptions_updated_at
  BEFORE UPDATE ON subscriptions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================
-- 4. ROW LEVEL SECURITY
-- ============================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE member_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE credit_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE pack_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE pack_type_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE pack_purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE coupons ENABLE ROW LEVEL SECURITY;
ALTER TABLE class_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE scheduled_classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE waitlist ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE coupon_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE registration_fees ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_requests ENABLE ROW LEVEL SECURITY;

ALTER TABLE subscriptions          ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscription_discounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE referrals              ENABLE ROW LEVEL SECURITY;
ALTER TABLE referral_rewards       ENABLE ROW LEVEL SECURITY;
ALTER TABLE member_badges          ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 5. RLS POLICIES
-- ============================================

-- PROFILES
-- Deux precautions, chacune payee d'une fuite le 2026-08-29 :
--
-- `TO authenticated` — sans mention de role, une policy vaut pour PUBLIC, donc
-- pour `anon`. La table se lisait SANS COMPTE avec la cle publishable que
-- porte le code du site : 23 profils complets, telephones, adresses et un
-- `medical_conditions`.
--
-- `auth.uid() = id` — un membre ne lit que SON profil. Le staff lit tout, il
-- en a besoin pour une liste de presence ou une fiche membre. Les autres
-- passent par la vue `profils_publics`, qui ne porte que le nom et la photo :
-- c'est tout ce dont on a besoin sur autrui.
CREATE POLICY "Profiles: own or staff" ON profiles
  FOR SELECT TO authenticated
  USING (
    auth.uid() = id
    OR has_role(auth.uid(), 'coach')
    OR has_role(auth.uid(), 'admin')
  );
CREATE POLICY "Profiles: own update" ON profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Profiles: admin update all" ON profiles FOR UPDATE USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Profiles: insert on signup" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- USER_ROLES
-- Lecture seule, volontairement : aucune policy d'écriture. Les écritures
-- passent par grant_user_role / revoke_user_role (SECURITY DEFINER), qui
-- vérifient la hiérarchie. Une policy d'écriture rouvrirait la faille corrigée
-- le 2026-08-06, où tout admin pouvait se créer un pair.
CREATE POLICY "Roles: read own or admin" ON user_roles
  FOR SELECT USING (auth.uid() = user_id OR has_role(auth.uid(), 'admin'));
CREATE POLICY "Roles: admin read all" ON user_roles
  FOR SELECT USING (has_role(auth.uid(), 'admin'));

-- MEMBER_CATEGORIES
CREATE POLICY "Categories: public read" ON member_categories FOR SELECT USING (true);
CREATE POLICY "Categories: admin manage" ON member_categories FOR ALL USING (has_role(auth.uid(), 'admin'));

-- CREDIT_TYPES
CREATE POLICY "Credit types: public read" ON credit_types FOR SELECT USING (true);
CREATE POLICY "Credit types: admin manage" ON credit_types FOR ALL USING (has_role(auth.uid(), 'admin'));

-- PACK_TYPES
-- Lire : le catalogue actif, plus tout pack que le membre détient — même
-- retiré de la vente. `is_active = FALSE` veut dire « hors catalogue, mais
-- toujours utilisable » (cf. le commentaire de la colonne) ; sans cette
-- ouverture, la jointure du planning renvoyait NULL et le membre lisait
-- « 0 crédit » avec des crédits bien valides.
CREATE POLICY "Pack types: read active, detenu ou admin" ON pack_types
  FOR SELECT USING (
    is_active = true
    OR has_role(auth.uid(), 'admin')
    OR EXISTS (
      SELECT 1 FROM pack_purchases pp
      WHERE pp.pack_type_id = pack_types.id AND pp.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM subscriptions s
      WHERE s.pack_type_id = pack_types.id AND s.user_id = auth.uid()
    )
  );
-- Créer et modifier : tout admin. Ce sont les gestes du quotidien, et ils se
-- corrigent. Effacer, non : c'est irréversible et cela touche à l'historique des
-- achats — même niveau de responsabilité que l'effacement du journal d'activité.
CREATE POLICY "Pack types: admin insert" ON pack_types FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin'));
CREATE POLICY "Pack types: admin update" ON pack_types FOR UPDATE USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Pack types: super admin delete" ON pack_types FOR DELETE USING (has_role(auth.uid(), 'super_admin'));

-- PACK_TYPE_CATEGORIES
CREATE POLICY "Pack type categories: public read" ON pack_type_categories FOR SELECT USING (true);
CREATE POLICY "Pack type categories: admin manage" ON pack_type_categories FOR ALL USING (has_role(auth.uid(), 'admin'));

-- PACK_PURCHASES
CREATE POLICY "Purchases: own read" ON pack_purchases FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Purchases: admin read all" ON pack_purchases FOR SELECT USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Purchases: coach read all" ON pack_purchases FOR SELECT USING (has_role(auth.uid(), 'coach'));
CREATE POLICY "Purchases: own insert" ON pack_purchases FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Purchases: admin insert" ON pack_purchases FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin'));
CREATE POLICY "Purchases: admin update" ON pack_purchases FOR UPDATE USING (has_role(auth.uid(), 'admin'));

-- COUPONS
CREATE POLICY "Coupon categories: public read" ON coupon_categories FOR SELECT USING (true);
CREATE POLICY "Coupon categories: admin manage" ON coupon_categories FOR ALL USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Coupons: read active" ON coupons FOR SELECT USING (is_active = true);
CREATE POLICY "Coupons: admin manage" ON coupons FOR ALL USING (has_role(auth.uid(), 'admin'));

-- CLASS_TYPES
CREATE POLICY "Class types: public read" ON class_types FOR SELECT USING (true);
CREATE POLICY "Class types: admin manage" ON class_types FOR ALL USING (has_role(auth.uid(), 'admin'));

-- SCHEDULED_CLASSES
CREATE POLICY "Classes: public read" ON scheduled_classes FOR SELECT USING (true);
CREATE POLICY "Classes: admin manage" ON scheduled_classes FOR ALL USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Classes: coach update own" ON scheduled_classes FOR UPDATE USING (auth.uid() = coach_id);

-- BOOKINGS
CREATE POLICY "Bookings: own read" ON bookings FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Bookings: admin read all" ON bookings FOR SELECT USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Bookings: coach read all classes" ON bookings FOR SELECT USING (has_role(auth.uid(), 'coach'));
CREATE POLICY "Bookings: own insert" ON bookings FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Bookings: admin insert" ON bookings FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin'));
CREATE POLICY "Bookings: coach insert" ON bookings FOR INSERT WITH CHECK (has_role(auth.uid(), 'coach'));
CREATE POLICY "Bookings: own cancel" ON bookings FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Bookings: admin update" ON bookings FOR UPDATE USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Bookings: coach update" ON bookings FOR UPDATE USING (has_role(auth.uid(), 'coach'));

-- WAITLIST
CREATE POLICY "Waitlist: own read" ON waitlist FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Waitlist: admin read" ON waitlist FOR SELECT USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Waitlist: own insert" ON waitlist FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Waitlist: admin insert" ON waitlist FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin'));
CREATE POLICY "Waitlist: own update" ON waitlist FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Waitlist: admin update" ON waitlist FOR UPDATE USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Waitlist: own delete" ON waitlist FOR DELETE USING (auth.uid() = user_id);

-- NOTIFICATIONS
CREATE POLICY "Notifications: own read" ON notifications FOR SELECT USING (auth.uid() = user_id);
-- WITH CHECK indispensable : sans lui, un membre pouvait réassigner une
-- notification à quelqu'un d'autre en modifiant user_id.
CREATE POLICY "Notifications: own update" ON notifications
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Notifications: system insert" ON notifications FOR INSERT WITH CHECK (true);

-- EMAIL_QUEUE — file technique. Le membre n'y accède pas ; seul le service
-- role (Edge Functions) l'écrit et la consomme, en contournant RLS.
CREATE POLICY "Email queue: staff read" ON email_queue
  FOR SELECT USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'super_admin'));

-- APP_SETTINGS
CREATE POLICY "Settings: public read" ON app_settings FOR SELECT USING (true);
-- WITH CHECK explicite : sur un INSERT, PostgreSQL évalue WITH CHECK et non
-- USING. En son absence il retombe sur USING, mais mieux vaut ne pas dépendre
-- de ce repli implicite pour une table de configuration.
CREATE POLICY "Settings: admin manage" ON app_settings
  FOR ALL
  USING (has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'admin'));

-- ACTIVITY_LOG
CREATE POLICY "Activity log: admin read" ON activity_log FOR SELECT USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Activity log: coach read" ON activity_log FOR SELECT USING (has_role(auth.uid(), 'coach'));
CREATE POLICY "Activity log: own read" ON activity_log FOR SELECT USING (auth.uid() = target_user_id);
CREATE POLICY "Activity log: system insert" ON activity_log FOR INSERT WITH CHECK (true);
CREATE POLICY "Activity log: admin insert" ON activity_log FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin'));
CREATE POLICY "Activity log: coach insert" ON activity_log FOR INSERT WITH CHECK (has_role(auth.uid(), 'coach'));

-- REGISTRATION_FEES
CREATE POLICY "reg_fees_own_read" ON registration_fees FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "reg_fees_admin_read" ON registration_fees FOR SELECT USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "reg_fees_insert" ON registration_fees FOR INSERT WITH CHECK (true);
CREATE POLICY "reg_fees_admin_all" ON registration_fees FOR ALL USING (has_role(auth.uid(), 'admin'));

-- Séances d'essai : plus de table dédiée depuis le 2026-08-07. Les policies de
-- `bookings` couvrent l'essai, qui est une réservation comme une autre.

-- INVOICE_REQUESTS
CREATE POLICY "invoice_own_read" ON invoice_requests FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "invoice_own_insert" ON invoice_requests FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "invoice_admin_all" ON invoice_requests FOR ALL USING (has_role(auth.uid(), 'admin'));

-- PERFORMANCE_TYPES
ALTER TABLE performance_types ENABLE ROW LEVEL SECURITY;
CREATE POLICY "PerfTypes: read all" ON performance_types FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "PerfTypes: coach/admin insert" ON performance_types FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'coach') OR has_role(auth.uid(), 'admin'));
CREATE POLICY "PerfTypes: coach/admin update" ON performance_types FOR UPDATE
  USING (has_role(auth.uid(), 'coach') OR has_role(auth.uid(), 'admin'));
CREATE POLICY "PerfTypes: coach/admin delete" ON performance_types FOR DELETE
  USING (has_role(auth.uid(), 'coach') OR has_role(auth.uid(), 'admin'));

-- PERFORMANCES
ALTER TABLE performances ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Perf: own read" ON performances FOR SELECT
  USING (auth.uid() = user_id OR has_role(auth.uid(), 'coach') OR has_role(auth.uid(), 'admin'));
CREATE POLICY "Perf: insert" ON performances FOR INSERT
  WITH CHECK (auth.uid() = user_id OR has_role(auth.uid(), 'coach') OR has_role(auth.uid(), 'admin'));
-- Le coach corrige ses propres fautes de frappe après encodage pour un membre :
-- sans lui, il encode mais ne peut plus rien reprendre (migration
-- 20260511_perf_rls_coach_update.sql).
CREATE POLICY "Perf: update" ON performances FOR UPDATE
  USING (auth.uid() = user_id OR has_role(auth.uid(), 'coach') OR has_role(auth.uid(), 'admin'));
CREATE POLICY "Perf: delete" ON performances FOR DELETE
  USING (auth.uid() = user_id OR has_role(auth.uid(), 'coach') OR has_role(auth.uid(), 'admin'));

-- ---- Abonnements ----
CREATE POLICY "Subscriptions: own read" ON subscriptions
  FOR SELECT USING (
    auth.uid() = user_id
    OR has_role(auth.uid(), 'coach')
    OR has_role(auth.uid(), 'admin')
  );
CREATE POLICY "Subscriptions: coach read" ON subscriptions
  FOR SELECT USING (has_role(auth.uid(), 'coach'));
CREATE POLICY "Subscriptions: admin all" ON subscriptions
  FOR ALL
  USING (has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE POLICY "Sub discounts: own read" ON subscription_discounts
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM subscriptions s
             WHERE s.id = subscription_discounts.subscription_id
               AND s.user_id = auth.uid())
    OR has_role(auth.uid(), 'admin')
  );
CREATE POLICY "Sub discounts: admin all" ON subscription_discounts
  FOR ALL
  USING (has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'admin'));

-- ---- Parrainage et bons d'achat ----
-- Aucune policy d'ÉCRITURE ouverte, volontairement : les créations passent
-- par les fonctions SECURITY DEFINER (claim_referral_code, attach_referrer,
-- grant_credit_note, check_referral_qualification) et par le webhook en
-- service_role. Une version antérieure laissait ces tables en
-- `WITH CHECK (true)` : n'importe quel membre authentifié pouvait s'attribuer
-- un parrain ou se créer un bon d'achat du montant de son choix.
CREATE POLICY "referrals_own_read" ON referrals
  FOR SELECT USING (
    auth.uid() = referrer_id
    OR auth.uid() = referee_id
    OR has_role(auth.uid(), 'admin')
  );
CREATE POLICY "referrals_admin_all" ON referrals
  FOR ALL USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "rewards_own_read" ON referral_rewards
  FOR SELECT USING (
    auth.uid() = user_id
    OR has_role(auth.uid(), 'admin')
    OR has_role(auth.uid(), 'super_admin')
  );
CREATE POLICY "rewards_admin_all" ON referral_rewards
  FOR ALL USING (has_role(auth.uid(), 'admin'));

-- ---- Badges ----
CREATE POLICY "badges_own_read" ON member_badges
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "badges_admin_read" ON member_badges
  FOR SELECT USING (has_role(auth.uid(), 'admin'));
-- Les badges sont attribués par des fonctions serveur, pas par le membre.
CREATE POLICY "badges_insert" ON member_badges
  FOR INSERT WITH CHECK (true);

-- ============================================
-- 6. VUE : profils des coachs
-- ============================================

-- DISTINCT ON (p.id) + ORDER BY rang du rôle : un coach qui a plusieurs rôles
-- (ex. coach ET admin) ne sort qu'une seule fois, avec son rôle le plus élevé.
-- Ni `email` ni `phone` : la vue les exposait, avec un GRANT a `anon`. Ces
-- deux colonnes se lisaient donc SANS COMPTE, avec la seule cle publishable
-- que porte le code du site (verifie sur bot3 le 2026-08-29 — fuite de
-- donnees personnelles au sens du RGPD). Aucun ecran ne les affichait : les
-- deux pages qui lisent cette vue montrent le nom et la photo, et le type
-- `CoachRef` ne declare que `id`, `display_name` et `avatar_url`.
--
-- `security_invoker = true` : sans cette option, une vue s'execute avec les
-- droits de son proprietaire et contourne le RLS des tables qu'elle lit.
-- C'est ce que l'advisor Supabase signalait en ERROR.
CREATE OR REPLACE VIEW coach_profiles
WITH (security_invoker = true) AS
SELECT DISTINCT ON (p.id) p.id, p.display_name, p.avatar_url, ur.role
FROM profiles p
JOIN user_roles ur ON ur.user_id = p.id
WHERE ur.role IN ('coach', 'admin', 'super_admin')
ORDER BY p.id, CASE ur.role WHEN 'super_admin' THEN 1 WHEN 'admin' THEN 2 ELSE 3 END;

-- Le retrait des droits d'`anon` sur cette vue ne peut PAS se faire ici : la
-- section 8, plus bas, redonne tout a `anon` sur ON ALL TABLES — les vues
-- comprises. Il est donc pose apres elle, en fin de fichier.
GRANT SELECT ON coach_profiles TO authenticated;

-- ============================================
-- 6b. VUE : ce qu'un membre voit des autres
-- ============================================
-- Trois colonnes, et rien d'autre. Un membre a besoin du nom du coach de son
-- cours et de celui des participants ; il n'a jamais besoin de leur telephone,
-- de leur adresse ni de leurs `medical_conditions`.
--
-- La policy de `profiles` ne laisse un membre lire que son propre profil. Sans
-- cette vue, le planning n'afficherait plus aucun nom de coach.
--
-- SECURITY DEFINER (le defaut, pas `security_invoker`) : c'est ce qui lui
-- permet de traverser cette policy. Le filtrage tient ici a la liste des
-- colonnes — trois champs inoffensifs n'ont rien de plus a filtrer.
CREATE OR REPLACE VIEW profils_publics AS
SELECT id, display_name, avatar_url
FROM profiles
WHERE deleted_at IS NULL;

GRANT SELECT ON profils_publics TO authenticated;

-- ============================================
-- 7. REALTIME
-- ============================================

ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
ALTER PUBLICATION supabase_realtime ADD TABLE waitlist;

-- ============================================
-- 8. DONNÉES INITIALES
-- ============================================

-- Types de crédits
INSERT INTO credit_types (name, label_fr, label_en) VALUES
  ('semi_prive', 'Semi-privé', 'Semi-private'),
  ('personal_training', 'Personal Training', 'Personal Training');

-- Ranger un ancien membre sans l'effacer. Une catégorie et non un statut :
-- `member_status` est recalculé par `update_member_status` à partir des faits,
-- un archivage posé à la main y serait écrasé sans prévenir. Les autres
-- catégories restent à la main du studio, celle-ci sert l'archivage.
INSERT INTO member_categories (name, description) VALUES
  ('archives', 'Anciens membres, conservés pour l''historique mais plus actifs');

-- Le pack d'essai : gratuit, hors catalogue, attribué à la création du profil
-- par le trigger on_profile_created_grant_trial.
--
-- Semi-privé uniquement (décision du 2026-08-07) : un essai en personal
-- training coûterait au studio le temps de coach correspondant.
INSERT INTO pack_types (
  name, description, credit_type_id, credit_count, price_cents,
  validity_days, is_active, is_purchasable, is_trial
)
SELECT
  'Séance d''essai offerte',
  'Une séance semi-privée offerte pour découvrir le studio.',
  ct.id, 1, 0, 30,
  TRUE,   -- actif : le crédit doit rester utilisable
  FALSE,  -- hors catalogue : ne s'achète pas
  TRUE
FROM credit_types ct
WHERE ct.name = 'semi_prive';

-- Paramètres
INSERT INTO app_settings (key, value) VALUES
  ('announcement', '{"content": "", "published": false}'::jsonb),
  ('stripe_mode', '{"mode": "test"}'::jsonb),
  -- Séance d'essai offerte. `validity_days` est la source de vérité, appliquée
  -- à chaque attribution : le studio l'ajuste sans passer par les packs.
  ('trial_pack', '{
    "enabled": true,
    "validity_days": 30
  }'::jsonb),
  -- Demande d'avis après un cours. Les deux bornes se comptent en heures
  -- depuis la FIN du cours, pour que le studio règle un délai sans avoir à
  -- tenir compte de la durée de chaque cours :
  --   * `hours_before_review` — temps de décantation avant qu'un avis soit
  --     possible. À 0, la séance est notable dès qu'elle se termine ;
  --   * `hours_to_review` — au-delà, la séance n'est plus notable et l'avis
  --     déjà donné se fige (ni modifiable ni supprimable). 168 h = 7 jours,
  --     le souvenir est encore net et la demande n'a pas eu le temps d'agacer.
  ('class_reviews', '{
    "enabled": true,
    "hours_before_review": 0,
    "hours_to_review": 168
  }'::jsonb),
  ('payment_provider', '{"provider": "stripe", "mode": "test"}'::jsonb),
  ('referral_rules', '{
    "referrer_reward_cents": 3000,
    "referee_reward_cents": 3000,
    "reward_validity_days": 180,
    "min_purchase_cents": 3000
  }'::jsonb),
  ('booking_rules', '{
    "morning_cutoff_hour": 20,
    "morning_cutoff_is_day_before": true,
    "morning_class_before_hour": 12,
    "afternoon_hours_before_no_bookings": 3,
    "afternoon_minutes_before_with_bookings": 30,
    "booking_window_days": 10,
    "cancellation_free_hours": 12,
    "cancellation_penalty": "credit_lost",
    "no_show_penalty": "credit_lost",
    "no_show_auto_minutes": 15,
    "pt_cancellation_free_hours": 24
  }'::jsonb),
  ('studio_info', '{"name": "Back On Track", "address": "", "phone": "", "email": "", "logo_url": "", "vat_number": "", "instagram_url": "", "facebook_url": "", "website_url": ""}'::jsonb),
  ('registration_fee', '{"amount_cents": 3000, "enabled": true}'::jsonb),
  ('room_names', '{"bas": "Back On Track Studio", "haut": "Back On Track Upstairs"}'::jsonb);

-- ============================================
-- 8b. STORAGE : bucket pour photos (avatars, cours, coaches)
-- ============================================
-- Le bucket est créé ICI : `storage.buckets` est une table ordinaire, et
-- l'INSERT ci-dessous suffit. Trois documents ont longtemps demandé de le
-- créer au dashboard — geste inoffensif mais inutile (corrigé le 2026-08-29).
--
-- `file_size_limit` reste à poser hors de ce fichier : la colonne existe,
-- mais la renseigner ici figerait dans le SQL une limite que le studio peut
-- vouloir ajuster sans migration. C'est `creer-espace-application.sh` qui
-- l'applique, à 5 Mo.
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Allow authenticated uploads" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'avatars');
CREATE POLICY "Allow authenticated updates" ON storage.objects
  FOR UPDATE TO authenticated USING (bucket_id = 'avatars');
CREATE POLICY "Allow authenticated deletes" ON storage.objects
  FOR DELETE TO authenticated USING (bucket_id = 'avatars');
CREATE POLICY "Allow public read" ON storage.objects
  FOR SELECT TO public USING (bucket_id = 'avatars');

-- ============================================
-- SUIVI DES CLIENTS (2026-08-09)
-- ============================================
-- Suivi des clients : qui ralentit, qui décroche, et ce que chacun rapporte
--
-- Le studio a besoin de repérer les membres à relancer AVANT qu'ils soient
-- perdus. Trois questions, une seule fonction :
--   - qui vient moins qu'avant ?
--   - qui n'est plus venu depuis longtemps ?
--   - combien chacun a-t-il rapporté ?
--
-- ── Deux mesures de la présence, volontairement côte à côte ──────────────────
--
-- `reservations` compte les réservations confirmées sur des cours passés.
-- `pointages` compte celles qui ont été effectivement pointées.
--
-- Les deux figurent parce qu'aucune n'est fiable seule. Le pointage dit la
-- vérité du terrain mais dépend de la rigueur du coach : une séance non
-- pointée ferait passer un présent pour un absent. La réservation, elle, est
-- toujours enregistrée — et elle a consommé un crédit, donc elle compte
-- commercialement même si la personne n'est pas venue.
--
-- L'écart entre les deux colonnes est lui-même une information : sur un
-- membre qui réserve sans venir, ou sur un cours où l'on oublie de pointer.
-- C'est au studio de lire, pas à la fonction de trancher.
--
-- Le classement (`etat`) s'appuie sur la RÉSERVATION : c'est la donnée
-- toujours présente. Fonder l'alerte sur le pointage produirait des faux
-- décrocheurs tant que le pointage n'est pas systématique.
--
-- ── Le revenu ───────────────────────────────────────────────────────────────
--
-- `booking_revenue()` existe déjà et gère le cas délicat : sur un pack
-- illimité, le prix se répartit entre les séances réellement réservées. On la
-- réutilise plutôt que de recalculer.
--
-- `ca_total` additionne les achats (packs et cycles d'abonnement) — l'argent
-- réellement encaissé. `ca_par_seance` divise par les séances consommées :
-- c'est ce chiffre qui dit si un membre est rentable, pas le total.

-- ── Seuils réglables ─────────────────────────────────────────────────────────
-- Le studio ajuste selon ce qu'il observe. Valeurs par défaut calées sur un
-- cycle d'abonnement de 4 semaines : 3 semaines = un cycle presque manqué,
-- 6 = un cycle et demi, 10 = plus de deux cycles.
INSERT INTO app_settings (key, value)
VALUES ('client_tracking', jsonb_build_object(
  'ralentit_semaines', 3,
  'decroche_semaines', 6,
  'perdu_semaines', 10,
  'fenetre_comparaison_semaines', 8
))
ON CONFLICT (key) DO NOTHING;

DROP FUNCTION IF EXISTS client_tracking_stats();

-- Le contrôle de rôle est DANS la fonction, comme les autres fonctions admin
-- du schéma : elle expose e-mail, téléphone et chiffre d'affaires de toute la
-- clientèle. Un GRANT à `authenticated` sans ce garde ouvrirait la porte à
-- n'importe quel membre connecté appelant l'API directement.
--
-- ⚠ Piège PL/pgSQL : les noms déclarés dans `RETURNS TABLE (...)` sont des
-- variables dans tout le corps de la fonction, et PL/pgSQL les résout AVANT
-- les colonnes. Toute colonne de CTE portant le même nom — ici `user_id` —
-- déclenche « column reference is ambiguous » à l'exécution, jamais à la
-- création. D'où les alias `uid` dans les CTE : aucune ne porte le nom d'un
-- paramètre de sortie.
CREATE FUNCTION client_tracking_stats()
RETURNS TABLE (
  user_id UUID,
  display_name TEXT,
  email TEXT,
  phone TEXT,
  member_status TEXT,
  is_business BOOLEAN,
  derniere_seance TIMESTAMPTZ,
  jours_depuis_derniere INTEGER,
  etat TEXT,
  reservations_total BIGINT,
  pointages_total BIGINT,
  reservations_recentes BIGINT,
  reservations_precedentes BIGINT,
  tendance TEXT,
  ca_total NUMERIC,
  seances_consommees BIGINT,
  ca_par_seance NUMERIC,
  a_pack_actif BOOLEAN,
  a_abonnement BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $fn$
BEGIN
  IF NOT (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'super_admin')) THEN
    RAISE EXCEPTION 'Reserve aux administrateurs';
  END IF;

  RETURN QUERY
WITH seuils AS (
  SELECT
    COALESCE((value->>'ralentit_semaines')::INT, 3)            AS ralentit,
    COALESCE((value->>'decroche_semaines')::INT, 6)            AS decroche,
    COALESCE((value->>'perdu_semaines')::INT, 10)              AS perdu,
    COALESCE((value->>'fenetre_comparaison_semaines')::INT, 8) AS fenetre
  FROM app_settings WHERE key = 'client_tracking'
),
-- Défaut si la ligne de réglages a été supprimée : la page ne doit pas
-- devenir vide parce qu'un réglage manque.
s AS (
  SELECT
    COALESCE((SELECT ralentit FROM seuils), 3)  AS ralentit,
    COALESCE((SELECT decroche FROM seuils), 6)  AS decroche,
    COALESCE((SELECT perdu FROM seuils), 10)    AS perdu,
    COALESCE((SELECT fenetre FROM seuils), 8)   AS fenetre
),
-- Réservations sur cours PASSÉS uniquement : une réservation à venir ne dit
-- rien de la fréquentation, et fausserait la date de dernière séance.
seances AS (
  SELECT
    b.user_id AS uid,
    b.id            AS booking_id,
    sc.starts_at,
    b.checked_in_at
  FROM bookings b
  JOIN scheduled_classes sc ON sc.id = b.scheduled_class_id
  WHERE b.status <> 'cancelled'
    AND sc.starts_at < NOW()
    AND COALESCE(sc.is_cancelled, FALSE) = FALSE
),
par_membre AS (
  SELECT
    se.uid,
    MAX(se.starts_at)                                   AS derniere_seance,
    COUNT(*)                                            AS reservations_total,
    COUNT(se.checked_in_at)                             AS pointages_total,
    -- Deux fenêtres consécutives de même durée : la récente contre la
    -- précédente. C'est la comparaison qui révèle un ralentissement, pas le
    -- total cumulé — quelqu'un de très ancien garde un gros total en ayant
    -- cessé de venir.
    COUNT(*) FILTER (
      WHERE se.starts_at >= NOW() - ((SELECT fenetre FROM s) || ' weeks')::INTERVAL
    )                                                   AS reservations_recentes,
    COUNT(*) FILTER (
      WHERE se.starts_at >= NOW() - (2 * (SELECT fenetre FROM s) || ' weeks')::INTERVAL
        AND se.starts_at <  NOW() - ((SELECT fenetre FROM s) || ' weeks')::INTERVAL
    )                                                   AS reservations_precedentes,
    COALESCE(SUM(booking_revenue(se.booking_id)), 0)    AS revenu_seances
  FROM seances se
  GROUP BY se.uid
),
-- Ce qui a été encaissé, indépendamment de la consommation. Un membre qui
-- achète un pack et ne vient pas a rapporté de l'argent : le total d'achats
-- le dit, le revenu par séance ne le dirait pas.
achats AS (
  SELECT
    pp.user_id AS uid,
    COALESCE(SUM(pp.price_paid_cents), 0)::NUMERIC / 100 AS ca_total,
    BOOL_OR(pp.credits_remaining > 0 AND pp.expires_at > NOW()) AS a_pack_actif
  FROM pack_purchases pp
  GROUP BY pp.user_id
),
abos AS (
  -- Qualifier `s2.user_id` n'est pas cosmétique : `user_id` est aussi un
  -- paramètre de sortie de la fonction, et PL/pgSQL le résout en priorité.
  -- Non qualifié, il provoque « column reference user_id is ambiguous ».
  SELECT s2.user_id AS uid, TRUE AS a_abonnement
  FROM subscriptions s2
  WHERE s2.status IN ('active', 'past_due', 'paused')
  GROUP BY s2.user_id
)
SELECT
  p.id,
  p.display_name,
  p.email,
  p.phone,
  p.member_status,
  COALESCE(p.is_business, FALSE),
  pm.derniere_seance,
  CASE WHEN pm.derniere_seance IS NULL THEN NULL
       ELSE EXTRACT(EPOCH FROM (NOW() - pm.derniere_seance))::INT / 86400
  END AS jours_depuis_derniere,
  CASE
    -- Jamais venu : ni ralenti ni décroché, c'est un cas à part. Un membre
    -- inscrit qui n'est jamais venu appelle un accueil, pas une relance.
    WHEN pm.derniere_seance IS NULL THEN 'jamais_venu'
    WHEN pm.derniere_seance < NOW() - ((SELECT perdu FROM s)    || ' weeks')::INTERVAL THEN 'perdu'
    WHEN pm.derniere_seance < NOW() - ((SELECT decroche FROM s) || ' weeks')::INTERVAL THEN 'decroche'
    WHEN pm.derniere_seance < NOW() - ((SELECT ralentit FROM s) || ' weeks')::INTERVAL THEN 'ralentit'
    ELSE 'actif'
  END AS etat,
  COALESCE(pm.reservations_total, 0),
  COALESCE(pm.pointages_total, 0),
  COALESCE(pm.reservations_recentes, 0),
  COALESCE(pm.reservations_precedentes, 0),
  CASE
    -- Sans passé, il n'y a pas de tendance à lire : un nouveau membre n'est
    -- pas « en baisse » parce que sa fenêtre précédente est vide.
    WHEN COALESCE(pm.reservations_precedentes, 0) = 0
     AND COALESCE(pm.reservations_recentes, 0) = 0 THEN 'aucune'
    WHEN COALESCE(pm.reservations_precedentes, 0) = 0 THEN 'nouveau'
    WHEN pm.reservations_recentes = 0 THEN 'arret'
    WHEN pm.reservations_recentes < pm.reservations_precedentes THEN 'baisse'
    WHEN pm.reservations_recentes > pm.reservations_precedentes THEN 'hausse'
    ELSE 'stable'
  END AS tendance,
  COALESCE(a.ca_total, 0),
  COALESCE(pm.reservations_total, 0) AS seances_consommees,
  CASE WHEN COALESCE(pm.reservations_total, 0) > 0
       THEN ROUND(COALESCE(a.ca_total, 0) / pm.reservations_total, 2)
       ELSE NULL
  END AS ca_par_seance,
  COALESCE(a.a_pack_actif, FALSE),
  COALESCE(ab.a_abonnement, FALSE)
FROM profiles p
LEFT JOIN par_membre pm ON pm.uid = p.id
LEFT JOIN achats a      ON a.uid  = p.id
LEFT JOIN abos ab       ON ab.uid = p.id
WHERE p.deleted_at IS NULL
  -- Le staff n'est pas une clientèle : il fausserait les moyennes.
  AND NOT EXISTS (
    SELECT 1 FROM user_roles ur
    WHERE ur.user_id = p.id AND ur.role IN ('admin', 'super_admin', 'coach')
  )
ORDER BY
  -- Les plus urgents d'abord : décrochés récents avant perdus de longue date.
  CASE
    WHEN pm.derniere_seance IS NULL THEN 3
    WHEN pm.derniere_seance < NOW() - ((SELECT perdu FROM s)    || ' weeks')::INTERVAL THEN 2
    WHEN pm.derniere_seance < NOW() - ((SELECT decroche FROM s) || ' weeks')::INTERVAL THEN 0
    WHEN pm.derniere_seance < NOW() - ((SELECT ralentit FROM s) || ' weeks')::INTERVAL THEN 1
    ELSE 4
  END,
  pm.derniere_seance DESC NULLS LAST;
END;
$fn$;

REVOKE ALL ON FUNCTION client_tracking_stats() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION client_tracking_stats() TO authenticated;

-- ============================================
-- 8. DROITS DE TABLE (GRANT)
-- ============================================
--
-- RLS ne sert à rien sans ces GRANT : ce sont deux contrôles superposés, et le
-- droit SQL s'applique AVANT la policy. Une table protégée par RLS mais sans
-- GRANT n'est pas « sécurisée », elle est inaccessible — PostgREST répond
-- `permission denied for table ...`, sur toutes les lignes.
--
-- Sur un projet Supabase créé avec « Automatically expose new tables » activé,
-- ces droits sont posés automatiquement (`pg_default_acl`) et install.sql n'a
-- jamais eu à les porter. C'est ce qui a masqué leur absence : la base `bot`
-- les a reçus à sa création en avril, et le fichier paraissait complet.
--
-- Le 2026-08-28, une installation faite sur une base neuve avec cette option
-- DÉCOCHÉE — comme le recommande `docs/strategie-base-neuve.md`, pour ne pas
-- exposer une table avant qu'elle soit protégée — a produit une base dont les
-- 27 tables refusaient toute lecture. Les compteurs de contrôle (tables,
-- policies, fonctions, triggers) étaient pourtant tous justes : aucun ne
-- regardait les droits.
--
-- Accorder ces droits n'expose rien tant que RLS est actif sur chaque table et
-- que chaque table porte ses policies — c'est fait aux sections 4 et 5.
-- C'est le modèle de Supabase : le GRANT ouvre la porte, la policy décide qui
-- passe et sur quelles lignes.
--
-- Ce bloc vient EN DERNIER, une fois tous les objets créés : `ON ALL TABLES`
-- ne vaut que pour ce qui existe déjà, et la vue `coach_profiles` de la
-- section 6 serait sautée s'il était placé plus haut.
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO anon, authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;

-- ...a une exception pres, et elle doit venir APRES le bloc ci-dessus.
--
-- `coach_profiles` n'a rien a faire entre les mains d'un visiteur non
-- connecte : la vue ne sert qu'a deux ecrans d'administration, et elle a
-- expose les e-mails et telephones des coachs jusqu'au 2026-08-29. Pose plus
-- haut, ce REVOKE serait efface par le `ON ALL TABLES` qui precede — une base
-- neuve renaitrait avec la fuite.
REVOKE ALL ON coach_profiles FROM anon;
REVOKE ALL ON profils_publics FROM anon;

-- Les tables créées PLUS TARD (migration, nouvelle fonctionnalité) doivent
-- hériter des mêmes droits, sans quoi le défaut réapparaîtrait table par table
-- et le bug se rejouerait au prochain ajout.
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO anon, authenticated;

-- ============================================
-- FORMULAIRE DE CONTACT — limitation du débit
-- ============================================
-- Le site vitrine expose un formulaire ouvert, sans authentification. Sa
-- protection anti-abus a besoin d'un compteur PARTAGÉ : la première version
-- comptait en mémoire de l'Edge Function, et dix envois consécutifs sont
-- passés sans être refusés — Supabase répartit les requêtes sur plusieurs
-- instances, chacune repartant de zéro.

CREATE TABLE IF NOT EXISTS contact_envois (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Donnée personnelle au sens du RGPD : d'où la purge automatique ci-dessous.
  ip TEXT NOT NULL,
  envoye_le TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_contact_envois_ip_date
  ON contact_envois (ip, envoye_le DESC);

-- Aucune policy : seule la clé de service accède à cette table, et RLS activé
-- sans policy refuse tout le monde d'autre. C'est l'effet recherché.
ALTER TABLE contact_envois ENABLE ROW LEVEL SECURITY;

-- Compte, enregistre et tranche en un seul aller-retour : deux requêtes
-- séparées laisseraient passer deux envois simultanés.
CREATE OR REPLACE FUNCTION contact_debit_depasse(
  p_ip TEXT,
  p_max INTEGER DEFAULT 5,
  p_fenetre INTERVAL DEFAULT INTERVAL '1 hour'
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_recents INTEGER;
BEGIN
  SELECT count(*) INTO v_recents
  FROM contact_envois
  WHERE ip = p_ip AND envoye_le > now() - p_fenetre;

  IF v_recents >= p_max THEN
    RETURN TRUE;
  END IF;

  INSERT INTO contact_envois (ip) VALUES (p_ip);

  -- Purge opportuniste, une fois sur vingt environ : les IP ne sont pas
  -- conservées au-delà de ce que la protection exige.
  IF random() < 0.05 THEN
    DELETE FROM contact_envois WHERE envoye_le < now() - INTERVAL '24 hours';
  END IF;

  RETURN FALSE;
END;
$$;

REVOKE ALL ON FUNCTION contact_debit_depasse(TEXT, INTEGER, INTERVAL) FROM PUBLIC, anon, authenticated;

-- ============================================
-- INSTALLATION TERMINÉE
-- ============================================
-- Prochaines étapes :
-- 1. Créer un compte via l'application
-- 2. Promouvoir en super_admin :
--    INSERT INTO user_roles (user_id, role)
--    SELECT id, 'super_admin' FROM auth.users WHERE email = 'votre@email.com';
-- 3. Configurer, dans cet ordre, depuis l'interface admin :
--      a. les types de crédits (semi-privé, personal training…)
--         — c'est la brique de base : un crédit ne paie que les cours de
--           son type
--      b. les types de cours, rattachés à un type de crédit
--      c. les packs et abonnements, rattachés eux aussi à un type de crédit
--      d. les catégories de membres, si l'accès à certains packs doit être
--         restreint
-- 4. Régler /admin/settings : règles de réservation, frais d'inscription,
--    parrainage, informations du studio
-- 5. Stripe : poser les secrets et déployer les Edge Functions
--      supabase secrets set STRIPE_SECRET_KEY_TEST=sk_test_...
--      supabase functions deploy create-checkout-session
--      supabase functions deploy manage-subscription
--      supabase functions deploy cancel-my-subscription
--      supabase functions deploy stripe-webhook --no-verify-jwt
--    Le drapeau --no-verify-jwt est INDISPENSABLE sur le webhook : Stripe
--    n'envoie pas de jeton Supabase, et sans lui tous ses appels sont
--    rejetés en 401 — donc plus rien n'est jamais crédité.
-- 6. Créer la destination webhook côté Stripe avec ses cinq événements
--    (voir docs/documentation-technique.md), puis poser le secret whsec_
--    et redéployer le webhook.
-- 7. Données de démonstration, si besoin : npx tsx scripts/import-demo.ts

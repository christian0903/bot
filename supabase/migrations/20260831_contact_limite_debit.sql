-- ============================================================================
-- Formulaire de contact : limiter le debit, pour de vrai
-- ----------------------------------------------------------------------------
-- La premiere version comptait les envois dans une Map en memoire de l'Edge
-- Function. Eprouve en ligne : DIX envois consecutifs sont passes sans jamais
-- etre refuses. Supabase repartit les requetes sur plusieurs instances, et
-- chacune demarrait son compteur a zero — la protection n'existait que sur le
-- papier.
--
-- Un compteur en base est partage par toutes les instances. C'est le seul
-- endroit ou l'etat peut etre commun.
-- ============================================================================

CREATE TABLE IF NOT EXISTS contact_envois (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- L'adresse IP de l'expediteur. Donnee personnelle au sens du RGPD : d'ou la
  -- purge automatique plus bas, et la duree de conservation reduite au strict
  -- necessaire pour la protection elle-meme.
  ip TEXT NOT NULL,
  envoye_le TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- L'index sert l'unique requete faite sur cette table : compter les envois
-- recents d'une IP.
CREATE INDEX IF NOT EXISTS idx_contact_envois_ip_date
  ON contact_envois (ip, envoye_le DESC);

ALTER TABLE contact_envois ENABLE ROW LEVEL SECURITY;

-- Aucune policy : la table n'est accessible qu'a la cle de service, dont
-- l'Edge Function dispose. Un visiteur ne doit ni la lire ni l'ecrire, et RLS
-- active sans policy refuse tout le monde d'autre — c'est exactement l'effet
-- recherche.

-- Compte les envois d'une IP sur la fenetre, enregistre le nouveau, et dit si
-- le plafond est atteint. Le tout en une seule aller-retour : deux requetes
-- separees laisseraient passer deux envois simultanes.
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

  -- Purge opportuniste : une ligne sur vingt environ, plutot qu'un cron pour
  -- une table qui ne pesera jamais lourd. Les IP ne sont donc pas conservees
  -- au-dela de ce que la protection exige.
  IF random() < 0.05 THEN
    DELETE FROM contact_envois WHERE envoye_le < now() - INTERVAL '24 hours';
  END IF;

  RETURN FALSE;
END;
$$;

REVOKE ALL ON FUNCTION contact_debit_depasse(TEXT, INTEGER, INTERVAL) FROM PUBLIC, anon, authenticated;

-- ============================================================================
-- Corriger l'adresse e-mail du studio
-- ----------------------------------------------------------------------------
-- `studio_info.email` portait `info@backotrackstudio.be` — sans le « n » de
-- « track ». Ce n'est pas cosmetique : ce reglage alimente les CGV et la
-- politique de confidentialite, ou il apparait TROIS fois, dont deux comme
-- point de contact pour l'exercice des droits RGPD. Un membre qui ecrivait a
-- cette adresse n'atteignait personne.
--
-- `jsonb_set` plutot qu'un remplacement de l'objet entier : les treize autres
-- champs — adresse, numero d'entreprise, reseaux sociaux — restent intacts.
UPDATE app_settings
SET value = jsonb_set(value, '{email}', '"info@backontrackstudio.be"')
WHERE key = 'studio_info'
  AND value->>'email' = 'info@backotrackstudio.be';

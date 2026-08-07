-- ============================================================================
-- Clients professionnels : paiement sur facture
-- ----------------------------------------------------------------------------
-- Une entreprise ne paie pas par carte au moment de l'achat : elle reçoit une
-- facture et la règle par virement, selon ses propres délais. Le pack est
-- crédité tout de suite — l'employé doit pouvoir s'entraîner sans attendre le
-- circuit comptable de son employeur.
--
-- C'est un paiement à terme, la norme en B2B, et cela veut dire que le studio
-- porte le risque d'impayé. Décision du 2026-08-07 : aucun automatisme, le
-- studio suit ses factures et relance hors application.
--
-- Seul un admin qualifie un profil en B2B. Le client ne peut pas se déclarer
-- entreprise lui-même : ce serait le moyen le plus simple d'obtenir des
-- séances sans payer.
--
-- Le contenu exact appliqué se trouve dans install.sql (colonnes profiles et
-- invoice_requests, fonctions order_pack_on_invoice et mark_invoice_paid).
-- ============================================================================

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_business BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS company_name TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS company_vat TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS company_address TEXT;

ALTER TABLE invoice_requests ADD COLUMN IF NOT EXISTS pack_type_id UUID REFERENCES pack_types(id);
ALTER TABLE invoice_requests ADD COLUMN IF NOT EXISTS amount_cents INTEGER;
ALTER TABLE invoice_requests ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ;
ALTER TABLE invoice_requests ADD COLUMN IF NOT EXISTS invoice_number TEXT;

ALTER TABLE invoice_requests DROP CONSTRAINT IF EXISTS invoice_requests_status_check;
ALTER TABLE invoice_requests ADD CONSTRAINT invoice_requests_status_check
  CHECK (status IN ('pending', 'sent', 'paid', 'cancelled', 'processed'));

CREATE INDEX IF NOT EXISTS invoice_requests_unpaid
  ON invoice_requests (created_at)
  WHERE paid_at IS NULL AND status <> 'cancelled';

-- Les fonctions order_pack_on_invoice et mark_invoice_paid sont définies dans
-- install.sql — elles y ont été portées au même commit, selon la règle du
-- 2026-08-07.

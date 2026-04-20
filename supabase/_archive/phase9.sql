-- ============================================
-- PHASE 9 : Demande de facture
-- Back On Track v2
--
-- Exécuter en une seule fois dans le SQL Editor Supabase.
-- ============================================

CREATE TABLE IF NOT EXISTS invoice_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  pack_purchase_id UUID REFERENCES pack_purchases(id),
  company_name TEXT NOT NULL,
  address TEXT NOT NULL,
  vat_number TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processed')),
  admin_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  processed_at TIMESTAMPTZ
);

ALTER TABLE invoice_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "invoice_own_read" ON invoice_requests;
CREATE POLICY "invoice_own_read" ON invoice_requests
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "invoice_own_insert" ON invoice_requests;
CREATE POLICY "invoice_own_insert" ON invoice_requests
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "invoice_admin_all" ON invoice_requests;
CREATE POLICY "invoice_admin_all" ON invoice_requests
  FOR ALL USING (has_role(auth.uid(), 'admin'));

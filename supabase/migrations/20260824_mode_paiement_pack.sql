-- Mode d'encaissement d'un pack.
--
-- Le montant seul ne dit pas d'où vient l'argent : 139 € encaissés en espèces
-- et 139 € payés par carte étaient jusqu'ici indiscernables, et un pack offert
-- au tarif plein ressemblait à une recette. Le canal est désormais choisi
-- explicitement par l'admin, plus déduit du prix.
ALTER TABLE pack_purchases
  ADD COLUMN IF NOT EXISTS payment_method TEXT
  CHECK (payment_method IN ('stripe', 'cash', 'transfer', 'gift'));

COMMENT ON COLUMN pack_purchases.payment_method IS
  'Canal d''encaissement : stripe (en ligne), cash (espèces), transfer (virement), gift (offert). NULL = ligne antérieure à cette colonne.';

-- Les lignes existantes : on ne devine que ce qui est certain. Un
-- `stripe_payment_intent_id` ou un `stripe_invoice_id` prouve un paiement en
-- ligne ; un prix nul est un cadeau. Le reste reste NULL — l'inventer
-- fabriquerait une recette en espèces qui n'a peut-être jamais existé.
UPDATE pack_purchases
   SET payment_method = 'stripe'
 WHERE payment_method IS NULL
   AND (stripe_payment_intent_id IS NOT NULL OR stripe_invoice_id IS NOT NULL);

UPDATE pack_purchases
   SET payment_method = 'gift'
 WHERE payment_method IS NULL
   AND price_paid_cents = 0;

-- Retrouver les encaissements hors ligne d'une période sans balayer la table.
CREATE INDEX IF NOT EXISTS pack_purchases_payment_method_idx
  ON pack_purchases(payment_method, purchased_at)
  WHERE payment_method IN ('cash', 'transfer');

-- Élargit les statuts de invoice_requests aux cinq valeurs du suivi
-- d'encaissement B2B.
--
-- La migration 20260807_clients_b2b.sql avait fait cet élargissement sur bot
-- sans le reporter dans install.sql. Toute base installée depuis ce fichier
-- n'admettait donc que 'pending' et 'processed', et refusait les données de
-- bot à l'import : « new row for relation "invoice_requests" violates check
-- constraint » sur une facture au statut 'paid' (2026-08-28).
--
-- install.sql est corrigé dans le même commit.

ALTER TABLE invoice_requests DROP CONSTRAINT IF EXISTS invoice_requests_status_check;
ALTER TABLE invoice_requests ADD CONSTRAINT invoice_requests_status_check
  CHECK (status IN ('pending', 'sent', 'paid', 'cancelled', 'processed'));

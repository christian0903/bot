-- Retire `registration_fees.mollie_payment_id`, dernier vestige de la
-- migration Mollie abandonnée le 2026-08-03.
--
-- La colonne n'a jamais rien porté : 11 lignes, 0 valeur non nulle. Aucun code
-- ne la lit — ni le front, ni les Edge Functions, ni les scripts. L'application
-- encaisse par Stripe, et `stripe_payment_intent_id` juste à côté fait le
-- travail.
--
-- Pourquoi maintenant : `install.sql`, réécrit depuis l'abandon, ne la crée
-- plus. Toute base neuve naissait donc sans elle, et la copie des données de
-- `bot` vers une telle base échouait sur « column mollie_payment_id does not
-- exist » — après avoir vidé la cible (constaté le 2026-08-28).
--
-- Deux réponses étaient possibles : apprendre au script à élaguer les colonnes
-- absentes de la cible, ou aligner la source sur le fichier d'installation.
-- La seconde a été retenue : `bot` est la référence, et une référence ne
-- devrait pas traîner ce qu'`install.sql` a cessé de décrire. Un script
-- tolérant aurait masqué l'écart au lieu de le fermer.

ALTER TABLE registration_fees DROP COLUMN IF EXISTS mollie_payment_id;

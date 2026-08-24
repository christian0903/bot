-- Catégorie « Archives » : ranger les anciens membres sans les effacer.
--
-- Pourquoi une catégorie et non un statut : `member_status` est **calculé** par
-- `update_member_status` à partir des faits (frais payés, pack actif,
-- ancienneté du dernier pack expiré). Un statut posé à la main y serait écrasé
-- au prochain recalcul — le studio croirait avoir rangé ses anciens membres et
-- les retrouverait actifs sans comprendre pourquoi.
--
-- La catégorie, elle, est un champ **choisi** : rien ne la recalcule.
--
-- Effet de bord à connaître : la catégorie commande les packs proposés à
-- l'achat (`pack_type_categories`). Un membre archivé ne verra donc que les
-- packs ouverts à cette catégorie — c'est-à-dire aucun, tant qu'aucun pack ne
-- la déclare. C'est cohérent avec l'archivage, mais il faut le savoir avant
-- d'archiver quelqu'un qui reviendrait.

INSERT INTO member_categories (name, description)
SELECT 'archives', 'Anciens membres, conservés pour l''historique mais plus actifs'
WHERE NOT EXISTS (SELECT 1 FROM member_categories WHERE name = 'archives');

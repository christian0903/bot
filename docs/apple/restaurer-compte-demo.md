# Restaurer le compte de démonstration d'Apple

Le compte `demo@backontrackstudio.be` sert à l'évaluateur d'Apple. Filmer la
suppression de compte pour la Guideline 2.1 le détruit — c'est arrivé deux
fois le 2026-09-02. Ce document dit comment le remettre en service.

**Sans cette restauration, Apple ne peut plus se connecter** : second refus
assuré, au motif « Accessing the app ».

---

## Ce que la suppression fait vraiment

`delete_own_account()` **anonymise**, elle ne détruit pas. Le profil reste,
vidé de ses données personnelles ; la ligne `auth.users` garde l'adresse et
le mot de passe. C'est ce qui rend la restauration possible.

Sont perdus définitivement : les performances (effacées), les notifications,
la file d'e-mails, le code de parrainage. Sont conservés : les packs et
toutes les lignes comptables — la loi belge impose de les garder sept ans.

Les réservations à venir sont annulées, mais **le crédit est restitué** au
pack : après suppression, les crédits sont donc intacts.

---

## Remettre le compte en service

Identifiant du compte : `b59be296-79a3-4e28-b047-6d5da31f3ad6`.

```sql
UPDATE profiles SET
  display_name  = 'Démo Apple',
  first_name    = 'Compte',
  last_name     = 'Démo Apple',
  email         = 'demo@backontrackstudio.be',
  member_status = 'active',
  deleted_at    = NULL
WHERE id = 'b59be296-79a3-4e28-b047-6d5da31f3ad6';

INSERT INTO user_roles (user_id, role)
SELECT 'b59be296-79a3-4e28-b047-6d5da31f3ad6', 'client'::user_role
WHERE NOT EXISTS (SELECT 1 FROM user_roles
  WHERE user_id = 'b59be296-79a3-4e28-b047-6d5da31f3ad6' AND role = 'client');
```

Le mot de passe n'est jamais touché : `demoapple2026BOT` reste valable, et la
fiche App Store Connect n'a rien à changer.

**Le rôle est `client`**, pas `member` : l'énumération `user_role` ne connaît
que `admin`, `coach`, `client` et `super_admin`. Sans rôle, la connexion
réussit mais l'application reste sans droits.

---

## Remettre des performances

Elles sont supprimées pour de bon — l'écran « Mes performances » serait vide,
et la vidéo moins parlante. Deux courbes suffisent : une qui monte (des
kilos), une qui descend (un chrono), pour montrer que l'app interprète les
deux dans le sens du progrès.

```sql
INSERT INTO performances (user_id, performance_type_id, date, value, value_num, created_by)
VALUES
 ('b59be296-79a3-4e28-b047-6d5da31f3ad6','b63040e8-d526-452d-9d33-eae5e9aadf48','2026-06-10','40 Kg',40,'b59be296-79a3-4e28-b047-6d5da31f3ad6'),
 ('b59be296-79a3-4e28-b047-6d5da31f3ad6','b63040e8-d526-452d-9d33-eae5e9aadf48','2026-06-28','45 Kg',45,'b59be296-79a3-4e28-b047-6d5da31f3ad6'),
 ('b59be296-79a3-4e28-b047-6d5da31f3ad6','b63040e8-d526-452d-9d33-eae5e9aadf48','2026-07-15','47.5 Kg',47.5,'b59be296-79a3-4e28-b047-6d5da31f3ad6'),
 ('b59be296-79a3-4e28-b047-6d5da31f3ad6','b63040e8-d526-452d-9d33-eae5e9aadf48','2026-08-05','50 Kg',50,'b59be296-79a3-4e28-b047-6d5da31f3ad6'),
 ('b59be296-79a3-4e28-b047-6d5da31f3ad6','b63040e8-d526-452d-9d33-eae5e9aadf48','2026-08-26','55 Kg',55,'b59be296-79a3-4e28-b047-6d5da31f3ad6'),
 ('b59be296-79a3-4e28-b047-6d5da31f3ad6','5f415e58-fa75-4434-8165-e48356fa94a7','2026-06-12','128 secondes',128,'b59be296-79a3-4e28-b047-6d5da31f3ad6'),
 ('b59be296-79a3-4e28-b047-6d5da31f3ad6','5f415e58-fa75-4434-8165-e48356fa94a7','2026-07-08','122 secondes',122,'b59be296-79a3-4e28-b047-6d5da31f3ad6'),
 ('b59be296-79a3-4e28-b047-6d5da31f3ad6','5f415e58-fa75-4434-8165-e48356fa94a7','2026-08-01','118 secondes',118,'b59be296-79a3-4e28-b047-6d5da31f3ad6'),
 ('b59be296-79a3-4e28-b047-6d5da31f3ad6','5f415e58-fa75-4434-8165-e48356fa94a7','2026-08-24','112 secondes',112,'b59be296-79a3-4e28-b047-6d5da31f3ad6');
```

Les deux identifiants de type sont « Développé couché à la barre » et
« Rameur - 500m ». La liste complète est dans `performance_types`.

---

## Contrôler avant de laisser Apple examiner

```sql
SELECT p.display_name, p.member_status, p.deleted_at,
       (SELECT string_agg(role::text,',') FROM user_roles r WHERE r.user_id=p.id) AS roles,
       (SELECT coalesce(sum(credits_remaining),0) FROM pack_purchases pp WHERE pp.user_id=p.id) AS credits,
       (SELECT count(*) FROM performances pf WHERE pf.user_id=p.id) AS perfs
FROM profiles p WHERE p.id='b59be296-79a3-4e28-b047-6d5da31f3ad6';
```

Attendu : `Démo Apple`, `active`, `deleted_at` nul, rôle `client`, des
crédits, neuf performances.

Vérifier aussi qu'il reste des cours réservables dans les jours qui viennent,
sinon l'évaluateur ne pourra pas réserver :

```sql
SELECT sc.starts_at, sc.max_participants,
       (SELECT count(*) FROM bookings b
        WHERE b.scheduled_class_id = sc.id AND b.status='confirmed') AS inscrits
FROM scheduled_classes sc
WHERE sc.starts_at > now() AND sc.is_cancelled = false
ORDER BY sc.starts_at LIMIT 8;
```

---

## Mieux : ne pas avoir à restaurer

Créer un compte jetable au début de la vidéo (étape « inscription »), le
confirmer, puis se connecter avec **lui** pour la partie suppression. Le
compte de démo n'est alors jamais touché.

C'est plus long à filmer, mais il n'y a rien à réparer après — et rien à
oublier de réparer.

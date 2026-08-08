# Documentation technique — super admin

Ce qui tourne derrière l'application : comment c'est branché, ce qui se passe à chaque paiement, et où regarder quand ça casse.

> Document destiné à qui administre l'infrastructure. Pour l'usage de l'application, voir le **guide coach & administrateur** et le **guide du membre**.

---

## Le principe à retenir

**Le webhook Stripe est le seul endroit qui crédite.**

Rien n'est jamais écrit au moment où le client clique sur « Payer ». La fonction qui ouvre la page de paiement ne fait qu'ouvrir une page de paiement. C'est Stripe qui, une fois l'argent reçu, appelle notre webhook — et c'est lui, et lui seul, qui crédite un pack, active un abonnement ou consomme un bon.

Sans cette règle, un client fermant la page avant de payer obtiendrait ses crédits.

Corollaire : **si un paiement n'a rien crédité, le problème est presque toujours dans le webhook.** C'est le premier endroit à regarder.

---

## Architecture

| Couche | Technologie |
|---|---|
| Interface | React 19, TypeScript, Vite, Tailwind |
| Base de données, auth, API | Supabase (PostgreSQL) |
| Logique serveur | Edge Functions Supabase (Deno) |
| Paiement | Stripe |
| E-mails | Resend |
| Application mobile | Capacitor (iOS, Android) |

**Ce qui n'existe pas** : il n'y a pas de serveur applicatif. Le front parle directement à Supabase, et les opérations sensibles passent par des Edge Functions. Les clés secrètes ne quittent jamais ces fonctions.

---

## Stripe

### Deux mondes étanches

Stripe fournit un **mode test** et un **mode production**, totalement séparés : clés distinctes, données distinctes, webhooks distincts. Un abonnement créé en test n'existe pas en production et ne sera jamais facturé.

L'application suit cette séparation :

- `pack_types.stripe_price_id_test` et `stripe_price_id_live` — deux colonnes, jamais interchangeables
- `subscriptions.stripe_mode` — chaque abonnement porte le mode dans lequel il est né, et sera toujours piloté avec la clé correspondante
- `app_settings.stripe_mode` — le commutateur global, réglable dans l'écran Réglages

> **Ce commutateur bascule le paiement ET le webhook d'un seul coup.** Vérifiez-le avant toute vente réelle.

Un **bac à sable** (`bot2`) a été créé sur le compte Stripe pour isoler ce projet d'une autre application en production. Le mode test standard est partagé entre tous les projets d'un compte : sans bac à sable, les webhooks se croisent.

### Les secrets

Posés côté Supabase, jamais dans le dépôt :

```bash
supabase secrets set STRIPE_SECRET_KEY_TEST=sk_test_...
supabase secrets set STRIPE_WEBHOOK_SECRET_TEST=whsec_...
supabase secrets set STRIPE_SECRET_KEY_LIVE=sk_live_...
supabase secrets set STRIPE_WEBHOOK_SECRET_LIVE=whsec_...
```

Plus `RESEND_API_KEY`, `EMAIL_FROM`, `EMAIL_REPLY_TO`, `APP_URL` pour les e-mails.

`supabase secrets list` montre une empreinte, jamais la valeur.

> **Après avoir posé un secret, redéployez la fonction qui l'utilise** : elle ne le voit qu'au déploiement suivant.

### Les cinq événements du webhook

Le point de terminaison est configuré côté Stripe sur :

```
https://<projet>.supabase.co/functions/v1/stripe-webhook
```

| Événement | Ce qu'il déclenche |
|---|---|
| `checkout.session.completed` | Frais d'inscription enregistrés · pack crédité · abonnement créé |
| `invoice.paid` | Échéance payée → recharge le pack. **Y compris le premier cycle** |
| `invoice.payment_failed` | Statut `past_due`, membre et admins notifiés. Pas de résiliation |
| `customer.subscription.updated` | Statut, dates, suspension, résiliation programmée |
| `customer.subscription.deleted` | Abonnement terminé. Si la fin est anticipée, les accès sont clôturés |

Un événement manquant dans cette liste = un maillon qui ne se déclenchera jamais.

---

## Les Edge Functions

| Fonction | Appelée par | Rôle | Écrit en base ? |
|---|---|---|---|
| `create-checkout-session` | Le front, au clic sur Payer | Ouvre la session Stripe. Applique coupon et bon | **Non** — sauf si un bon couvre tout (voir plus bas) |
| `stripe-webhook` | **Stripe** | Crédite, active, consomme, qualifie | **Oui, c'est le seul** |
| `manage-subscription` | Le front admin | Remise, report, suspension, résiliation | Trace et clôture d'accès |
| `cancel-my-subscription` | Le front membre | Résiliation en libre-service | Non (le webhook suit) |
| `create-user` | Le front admin | Crée un compte sans inscription | Oui |
| `admin-update-email` / `admin-update-password` | Le front admin | Corrige un compte | Oui |
| `send-email` / `send-notification` | Divers | Envoi via Resend | Oui (notifications) |

### `stripe-webhook` — déploiement particulier

```bash
supabase functions deploy stripe-webhook --no-verify-jwt
```

**Ce drapeau est indispensable.** Stripe appelle cette URL depuis ses serveurs, sans jeton Supabase. Sans lui, tous les appels sont rejetés en 401 et rien n'est jamais crédité. L'authenticité est garantie autrement : par la signature cryptographique que le code vérifie lui-même.

Les autres fonctions se déploient normalement.

> **Le drapeau ne colle pas à la fonction : il est redonné à chaque déploiement.** L'oublier une seule fois remet `verify_jwt` à `true` et coupe les encaissements. C'est arrivé le 7 août : le webhook a rejeté tous les appels pendant une heure, Stripe encaissait, l'application ne créditait plus rien.

**Vérifier juste après, systématiquement :**

```bash
supabase functions list --project-ref <ref>
```

La colonne `VERIFY JWT` doit afficher `false` pour `stripe-webhook`, et `true` partout ailleurs.

Ce contrôle vaut d'être fait à chaque fois, parce que la panne est **silencieuse** : rien ne casse visiblement, aucune alerte ne part, l'application continue de fonctionner. Seul un client qui paie sans être crédité finit par le signaler — et il faut alors rejouer à la main tous les événements perdus.

### Le cas du paiement à zéro

Stripe refuse une session de paiement à 0 €. Quand un bon couvre la totalité — 30 € de bon sur 30 € de frais d'inscription, le cas nominal du parrainage — `create-checkout-session` enregistre directement, sans passer par Stripe : elle crée la ligne, consomme le bon, qualifie le parrainage.

C'est la seule exception au principe « seul le webhook écrit », et elle est sûre : il n'y a pas de paiement à attendre.

---

## Modèle de données

### L'idée directrice

> **Un abonnement n'est pas une entité nouvelle. C'est un pack court qui se renouvelle tout seul.**

À chaque échéance payée, le webhook crée une ligne `pack_purchases` ordinaire. Le reste de l'application — réservations, crédits, statistiques — ne voit aucune différence entre un pack acheté et un cycle d'abonnement.

C'est ce qui a évité d'écrire un moteur de quota, une table de formules et un second parcours de réservation.

### Les tables qui comptent

| Table | Contenu |
|---|---|
| `profiles` | Le membre. Porte son `referral_code`, généré à la création |
| `user_roles` | Un rôle par ligne. Un membre peut être coach **et** admin |
| `credit_types` | Semi-privé, personal training… **La brique de base** |
| `pack_types` | Le catalogue. `is_unlimited`, `is_recurring` et sa périodicité |
| `pack_purchases` | Un achat **ou un cycle d'abonnement**. `stripe_invoice_id` en index unique |
| `subscriptions` | Le lien avec Stripe. Les crédits, eux, vivent dans `pack_purchases` |
| `bookings` | Une réservation, rattachée au pack qui l'a payée |
| `referrals` | Qui a parrainé qui, et où en est la qualification |
| `referral_rewards` | Les bons d'achat, quelle que soit leur origine |
| `invoice_requests` | Commandes B2B à facturer, et leur encaissement |
| `class_reviews` | Avis sur une séance, rattachés à la **réservation** |
| `email_queue` | E-mails déposés par les fonctions SQL, consommés par l'application |
| `app_settings` | Tous les réglages, en JSON, une ligne par clé |
| `activity_log` | Tout ce qui a été fait, avec l'auteur |

### Deux protections contre le double crédit

**L'index unique sur `pack_purchases.stripe_invoice_id`.** Stripe peut livrer deux fois le même événement, et le bouton « Renvoyer » du dashboard le permet aussi. La seconde tentative viole l'index, le code la reconnaît comme un rejeu et sort proprement.

**Les fonctions idempotentes.** `consume_credit_note` ne consomme que si le bon est encore libre ; `check_referral_qualification` ne qualifie que si le parrainage est en attente.

### Le statut d'un cours n'est jamais stocké

`getClassStatus()` le recalcule à chaque affichage, à partir de la date, des inscrits, des présences pointées et du minimum réglé. Une colonne entretenue par une tâche planifiée finirait par diverger du réel — c'était une décision explicite du 3 août.

Sept états : planifié, effectif à surveiller, exécuté, présences à valider, décision attendue, sans inscrit, annulé. **« Exécuté » exige des présences pointées** : sans elles, personne ne sait si le cours a eu lieu.

**Un cours entièrement pointé en absences est « exécuté ».** Le coach s'est déplacé et a constaté que personne n'était venu : le cours a bien eu lieu, et les absents n'ayant pas annulé à temps, leurs crédits restent acquis au studio. Sans ce cas, `getClassStatus` ne comptait que les présents et rangeait un tel cours en « décision attendue » — l'écran réclamait alors un arbitrage que le pointage avait déjà tranché, sans offrir aucun bouton pour le rendre (`disabled={isNoShow}`). D'où le paramètre `noShows`, à passer partout où `attended` l'est.

### Les fonctions SQL notables

- `get_available_credits(user, credit_type)` — les sources de paiement d'un membre, **abonnement en tête**
- `can_book_class(class, user)` — applique les règles de fermeture
- `cancel_booking_v2(booking, user)` — annulation par le membre, avec ou sans restitution selon le délai
- `cancel_booking_by_studio(booking)` — annulation par le studio : **restitue toujours**
- `check_referral_qualification(referee)` — crée les deux bons au premier paiement
- `get_usable_credit_notes(user, montant)` — les bons applicables, seuil compris
- `grant_user_role` / `revoke_user_role` — hiérarchie des rôles : un admin gère les coachs, seul un super admin promeut un admin
- `book_member_by_staff(class, user, pack)` — inscription par le staff. **Ignore le délai de fermeture**, respecte la capacité. Un coach n'agit que sur ses cours
- `decline_modified_booking(booking)` — le membre renonce à un cours modifié après sa réservation : **restitue toujours**, sans délai
- `reset_member_purchases(user)` — remise à zéro, **refuse de s'exécuter en mode live**
- `grant_trial_pack(user)` — attribue la séance d'essai. Idempotente, appelée par trigger à la création du profil
- `order_pack_on_invoice(pack)` — commande B2B. **Refuse un profil non qualifié** : c'est le seul rempart contre des séances gratuites
- `set_invoice_details(id, numéro, date)` — enregistre l'émission Odoo, **indépendamment du paiement**
- `mark_invoice_paid(id)` — pointe l'encaissement. Aucun effet sur les crédits
- `submit_class_review(booking, note, texte)` — dépose **ou corrige** un avis. Exige une réservation confirmée et une fenêtre ouverte
- `delete_class_review(booking)` — retire son avis, dans la même fenêtre que la correction
- `pending_class_reviews()` — les séances de l'appelant qui attendent un avis
- `my_class_reviews()` — ses avis, avec un champ `editable` calculé en base
- `class_reviews_for_staff(class)` — avis d'un cours, **anonymes**. Un coach n'accède qu'à ses propres cours
- `class_reviews_for_admin(coach, type, du, au, limite)` — avis **nominatifs**, admin seul
- `class_review_stats_by_coach()` — nombre d'avis et moyenne par coach, admin seul
- `delete_own_account()` / `delete_member_account(user)` — **anonymisent**, ne suppriment pas
- `queue_email(user, template, vars)` — dépose un e-mail quand on est dans une fonction SQL

---

## Facturation B2B

### Le principe

> **La facture ne se crée pas ici. Elle se crée dans Odoo.**

L'application enregistre la commande, crédite le pack, et garde trace du numéro et de la date que **vous** lui donnez après coup. Elle ne calcule aucun numéro, ne génère aucun document.

Ce partage est délibéré : la comptabilité a un système, on ne le duplique pas.

### Trois moments, trois colonnes

| Moment | Colonne | Qui l'écrit |
|---|---|---|
| La commande | `created_at` | `order_pack_on_invoice`, à l'achat |
| L'émission dans Odoo | `invoice_number` + `invoice_date` | L'admin, quand il veut |
| L'encaissement | `paid_at` | L'admin, quand l'argent arrive |

Les séparer était nécessaire : le numéro est connu à l'émission, souvent des semaines avant le règlement. Les confondre obligeait à attendre le paiement pour noter une information déjà disponible.

`invoice_number` porte un **index unique partiel** — un doublon signale une erreur de saisie, pas une situation valable.

### Le crédit précède le paiement

`order_pack_on_invoice` crée la ligne `pack_purchases` **immédiatement**. C'est un choix commercial : l'employé s'entraîne sans attendre le circuit comptable de son employeur.

Conséquence à connaître : **rien ne distingue en base un pack payé d'un pack facturé impayé**. Le suivi se fait dans `invoice_requests`, pas dans `pack_purchases`.

### Le garde-fou

```sql
IF NOT COALESCE(v_profile.is_business, FALSE) THEN
  RETURN jsonb_build_object('ok', false, 'reason', 'not_business');
END IF;
```

Sans ce contrôle **côté serveur**, n'importe qui appellerait la fonction et obtiendrait des séances gratuites. Le front masque le bouton, mais un front ne protège rien.

`is_business` est aussi ce qui masque les abonnements au B2B — pas une catégorie de membre. Deux marqueurs pour le même fait finiraient par diverger, et un membre oublié en catégorie tomberait sur un paiement Stripe inattendu.

---

## Avis sur les cours

### L'avis porte sur la réservation, pas sur le cours

`class_reviews` référence `booking_id` en **clé unique**. C'est ce qui rend la question « qui a le droit de noter quoi » réglable en base plutôt qu'à l'écran : sans réservation confirmée, pas d'avis possible ; une séance, un avis, modifiable mais non empilable.

### Aucune policy INSERT

L'écriture passe exclusivement par `submit_class_review`. Une policy ouverte laisserait noter n'importe quel cours, y compris ceux auxquels on n'a jamais assisté.

### Les deux bornes se comptent depuis la fin du cours

```sql
sc.starts_at + (sc.duration_minutes || ' minutes')::INTERVAL
  + (v_open || ' hours')::INTERVAL < NOW()   -- ouverture
sc.starts_at + (sc.duration_minutes || ' minutes')::INTERVAL
  + (v_close || ' hours')::INTERVAL > NOW()  -- fermeture
```

Réglage `app_settings.class_reviews` : `hours_before_review` (temps de décantation, 0 par défaut) et `hours_to_review` (fermeture, 168 h = 7 jours). **Les deux en heures** — mélanger les unités obligeait à convertir de tête pour savoir si les bornes se recouvraient. Partir de la **fin** du cours dispense de tenir compte de la durée de chaque séance.

La même fenêtre gouverne le dépôt, la correction et la suppression : ce qu'on laisse modifier, on doit laisser effacer.

### Anonyme pour le coach, nominatif pour l'admin

Deux fonctions distinctes plutôt qu'un drapeau, parce que la levée de l'anonymat est un choix de studio, pas un défaut à corriger :

- `class_reviews_for_staff` — sans le nom des auteurs, et **bornée aux cours du coach appelant**. Sans la jointure sur `scheduled_classes.coach_id`, un rôle staff suffisait à lire les avis d'un collègue en connaissant l'identifiant du cours.
- `class_reviews_for_admin` — avec nom et e-mail. Sans le nom, on ne peut ni recontacter la personne ni distinguer un mécontentement isolé d'un acharnement.

### `editable` est calculé en base

`my_class_reviews` renvoie ce booléen plutôt que de laisser le client refaire le calcul de fenêtre. Une seule source de vérité, et l'interface n'affiche jamais un bouton qui échouerait au clic.

### Pas de notion d'« avis négatif »

Un premier jet exposait un compteur d'avis à 2 étoiles ou moins. **Le seuil était arbitraire** et le mot laissait croire à une catégorie objective. Le filtre par étoile exacte, côté client, laisse ce jugement à qui lit.

---

## Sécurité

**Row Level Security actif sur toutes les tables.** Un membre ne voit que ses données, un coach voit les achats et les réservations, un admin voit tout.

**Les écritures sensibles passent par des fonctions `SECURITY DEFINER`** plutôt que par des policies ouvertes. Motif : une policy en `WITH CHECK (true)` laisse n'importe quel membre authentifié écrire ce qu'il veut. Deux trous de ce type ont été trouvés et fermés le 5 août — n'importe qui pouvait se créer un bon d'achat du montant de son choix, ou s'attribuer un parrain.

**La règle générale** : si une opération engage de l'argent ou des droits, elle se contrôle côté serveur. Masquer un bouton ne protège de rien — les fonctions sont appelables directement.

**Le motif employé partout** : plutôt que d'élargir les droits d'un rôle, on ouvre une porte étroite et gardée. Un coach ne peut pas écrire dans `pack_purchases` ; il appelle `book_member_by_staff`, qui vérifie qu'il est bien coach **de ce cours-là** avant d'agir. Ajouter une policy `coach update` aurait laissé n'importe quel coach modifier n'importe quel pack, y compris s'ajouter des crédits.

> **Toute fonction `SECURITY DEFINER` doit vérifier le rôle de l'appelant.** Elle contourne RLS par construction : sans ce contrôle, elle devient une porte ouverte. Deux fonctions ont été trouvées sans vérification et corrigées le 6 août.

**Les clés secrètes** ne sont jamais dans le front. Le navigateur ne connaît que l'URL Supabase et la clé publique, dont les droits sont bornés par RLS.

---

## Déploiement

### Migrations

Les fichiers vivent dans `supabase/migrations/`. Ils s'exécutent dans le SQL Editor du dashboard, dans l'ordre chronologique de leur nom.

> **Toute migration se reporte dans `install.sql` — dans le même commit.**
>
> `install.sql` doit reconstruire une base complète à partir de rien. Une migration appliquée sans y être reportée le rend faux en silence : il paraît fonctionner et produit une base incomplète.
>
> Le rattrapage différé échoue de façon répétée. Le 7 août, douze migrations ont été appliquées dans la journée et le fichier n'a été repris qu'en fin de session : il manquait une table, cinq fonctions, un trigger, quatre colonnes, deux index et un réglage.

À reporter à chaque fois :

| Ce que la migration ajoute | Où le reporter |
|---|---|
| Table, colonne, index, contrainte | `install.sql`, dans le bloc de la table concernée |
| Fonction, trigger | `install.sql`, près des fonctions de même domaine |
| Policy RLS | `install.sql` **et** `check-policies.sql` |
| Réglage (`app_settings`), donnée initiale | `install.sql`, bloc des données de départ |
| N'importe lequel des précédents | Un contrôle dans `check-schema.sql` |

**Vérifier plutôt que supposer.** La présence d'un objet se contrôle contre la base réelle :

```sql
-- Les tables déclarées vs les tables réelles
select table_name from information_schema.tables
where table_schema='public' and table_type='BASE TABLE' order by table_name;

-- Idem pour les fonctions
select routine_name from information_schema.routines
where routine_schema='public' and routine_type='FUNCTION' order by routine_name;
```

**Valider la syntaxe sans rien casser ni rien payer** : exécuter les blocs ajoutés sur un schéma jetable, dans une transaction annulée.

```sql
BEGIN;
CREATE SCHEMA verif;
-- ... les CREATE TABLE / CREATE FUNCTION ajoutés, préfixés verif.
ROLLBACK;   -- rien ne persiste
```

Et tester que les garde-fous **refusent** bien ce qu'ils doivent refuser (un `DO $$ ... EXCEPTION WHEN unique_violation ... $$` suffit) : une contrainte qu'on ne teste pas est une contrainte qu'on croit avoir.

### Fonctions

```bash
supabase link --project-ref <ref>
supabase functions deploy <nom>
supabase functions deploy stripe-webhook --no-verify-jwt   # drapeau à redonner À CHAQUE FOIS
supabase functions list                                    # contrôler : VERIFY JWT = false pour stripe-webhook
```

> Le `supabase functions list` n'est pas décoratif. Le drapeau n'est pas mémorisé d'un déploiement à l'autre, et l'oublier coupe les encaissements sans aucun signal visible.

### Front

```bash
npm run build          # web
npm run cap:ios        # application iOS
npm run cap:android    # application Android
```

---

## Diagnostic

### Un paiement n'a rien crédité

1. **Stripe → Développeurs → Webhooks → Tentatives.** Chaque appel y figure avec sa réponse.
   - **401** sur tout → le `--no-verify-jwt` a été oublié au déploiement
   - **400 signature invalide** → mauvais `STRIPE_WEBHOOK_SECRET`, ou secret d'une autre destination
   - **500** → lire le message, puis les logs de la fonction
   - **200 mais rien en base** → le webhook a bien répondu sans rien faire. Cause fréquente : un événement arrivé avant celui qui crée l'objet attendu
   - **Événement absent** → il n'est pas coché dans la destination
2. **Logs de la fonction** : dashboard Supabase → Edge Functions → `stripe-webhook` → Logs.
3. **Rejouer** l'événement depuis Stripe : le bouton « Renvoyer ». Sans risque, les protections contre le double crédit s'appliquent.

### Symptômes déjà rencontrés

| Symptôme | Cause | Correctif |
|---|---|---|
| 500 `"Invalid time value"` | L'API Stripe récente a déplacé `current_period_*` dans les items, et `invoice.subscription` sous `invoice.parent` | Lecture des deux emplacements |
| 200 mais aucun crédit | `invoice.paid` arrivé **avant** `checkout.session.completed` : l'abonnement n'existait pas encore | Les deux événements créent l'abonnement si besoin |
| Deux packs pour un paiement | Un report d'échéance passe par `trial_end`, ce qui fait émettre une facture à 0 € comptée comme un cycle | Les factures à 0 € sont ignorées |
| Membre absent d'une liste | Filtre `credits_remaining > 0` excluant les illimités | Tester `is_unlimited` d'abord |
| 401 sur tous les appels, plus rien n'est crédité | `--no-verify-jwt` oublié au dernier déploiement — le drapeau est à redonner à chaque fois | Redéployer avec le drapeau, puis rejouer les événements perdus depuis Stripe |
| Abonnement qui paraît échu le jour de la souscription | `invoice.period_start` / `period_end` datent la **facture**, pas le cycle : sur une souscription, les deux valent l'instant d'émission | Lire `lines.data[0].period`, qui porte le vrai cycle |
| Crédits d'un renouvellement expirés d'avance | `expires_at` calculé depuis l'heure du serveur au lieu du cycle facturé | Le cycle facturé fait foi ; sans période, la validité s'applique depuis l'achat |

---

## Pièges à connaître

**Un Price Stripe est immuable.** Changer le prix ou la périodicité d'un abonnement crée un nouveau Price ; les abonnés existants gardent l'ancien. Il n'y a pas de « changement de tarif » rétroactif.

**Ne jamais modifier le Price pour appliquer une remise.** Elle deviendrait permanente. Une remise ponctuelle passe par un coupon Stripe `duration: 'once'` : Stripe l'applique à une facture puis retire le coupon lui-même.

**L'ordre de livraison des événements n'est pas garanti.** Ne jamais supposer que `checkout.session.completed` précède `invoice.paid`.

**Un `UPDATE` qui ne touche aucune ligne ne renvoie pas d'erreur.** Il échoue en silence. Ce piège a produit deux bugs distincts dans ce projet.

**Un cycle de 4 semaines produit 13 échéances par an**, pas 12.

**La même règle métier est parfois réécrite à plusieurs endroits.** Corriger la fonction SQL centrale ne suffit pas toujours : certains écrans font leur propre requête. À consolider.

**`install.sql` peut décrire des policies absentes de la base.** Trois bugs du 6 août avaient cette cause : une règle d'accès écrite dans le fichier d'installation, jamais appliquée. Le symptôme est toujours le même — une requête refusée en silence, un écran qui conclut « aucun résultat » alors que les données existent.

> **`supabase/check-policies.sql`** compare les policies attendues à celles réellement présentes. À exécuter après toute migration, et dès qu'un écran affiche une liste vide sans raison.

**Un refus d'écriture ne lève pas d'exception.** Supabase renvoie une erreur dans l'objet de réponse, que le code peut ignorer sans rien remarquer. Un coach annulait son cours, le journal s'écrivait, les crédits partaient — et le cours restait planifié. **Toujours tester `error` après une écriture.**

**Les options de déploiement ne sont pas mémorisées.** `--no-verify-jwt` doit être redonné à chaque `deploy` du webhook. Un déploiement qui l'oublie coupe les encaissements sans le moindre signal. Vérifier avec `supabase functions list` fait partie du déploiement, pas du dépannage.

**Un timestamp Stripe ne dit pas toujours ce que son nom suggère.** `invoice.period_start` / `period_end` datent la facture, pas le cycle d'abonnement — le cycle vit sur `lines.data[0].period`. De même, `current_period_*` a migré de la racine de l'abonnement vers ses items. **Vérifier sur un objet réel plutôt que se fier au nom du champ**, surtout quand une durée calculée tombe à zéro.

> Corollaire : `??` ne bascule que sur `null`/`undefined`. Mettre le mauvais champ en premier dans un `a ?? b` suffit à ce que `b` ne soit **jamais** lu, si `a` est renseigné mais faux sémantiquement. C'est ce qui a masqué le bug de cycle.

**Le temps du serveur n'est pas celui de la facturation.** Un pack d'abonnement doit couvrir la période payée, pas les N jours qui suivent l'instant où le webhook s'exécute. Un événement rejoué avec retard produit sinon un pack décalé — voire, sous *test clock*, des crédits qui expirent avant le cycle qu'ils couvrent.

---

## Environnement de test

Un bac à sable Stripe permet de tout éprouver sans argent réel.

**Cartes** : `4242 4242 4242 4242` (accepté), `4000 0000 0000 9995` (refusé), `4000 0000 0000 0341` (accepté puis échec au renouvellement). N'importe quelle date future, n'importe quel CVC.

### Test clock — éprouver un renouvellement sans attendre 28 jours

Procédure suivie le 7 août, qui a mis au jour deux défauts réels. Le MCP Stripe n'expose pas les `test_helpers` : il faut appeler l'API directement, avec une clé `sk_test_` ou une clé restreinte (Test clocks, Customers, Subscriptions en écriture ; Invoices en lecture).

1. **Créer l'horloge**, figée à maintenant :
   `POST /v1/test_helpers/test_clocks` avec `frozen_time`
2. **Créer un client rattaché à l'horloge** (`test_clock=clock_...`), lui attacher un moyen de paiement (`tok_visa`) et le poser en `invoice_settings[default_payment_method]`
3. **Créer un profil applicatif réel** et reporter son identifiant dans les métadonnées de l'abonnement : `user_id`, `pack_type_id`, `kind=subscription`, `credit_count`, `validity_days`. Sans elles, le webhook n'a aucune cible et sort sans rien créditer.
4. **Créer l'abonnement** sur ce client
5. **Avancer l'horloge** au-delà de l'échéance : `POST /v1/test_helpers/test_clocks/{id}/advance`. L'opération est asynchrone — attendre `status: ready`.

> **Viser l'heure, pas seulement le jour.** L'échéance tombe à l'heure exacte de la souscription : avancer au bon jour mais treize minutes trop tôt ne déclenche rien, et laisse croire à une panne.

6. **Vérifier** qu'une seconde facture `billing_reason: subscription_cycle` est émise et payée, puis **en base** que le cycle s'enchaîne sans trou ni recouvrement :

```sql
select pp.stripe_invoice_id, pp.credits_remaining,
       pp.purchased_at::date, pp.expires_at::date,
       (pp.expires_at::date - pp.purchased_at::date) as jours
from pack_purchases pp
where pp.user_id = '<uuid>' order by pp.purchased_at;
```

7. **Nettoyer** : supprimer l'horloge emporte client, abonnement et factures. Puis retirer le profil de test de la base.

Si le webhook ne réagit pas, contrôler d'abord `verify_jwt` (voir plus haut) : c'est la cause la plus fréquente, et la plus silencieuse. Les événements manqués se rejouent depuis Stripe sans risque de double crédit.

**Remise à zéro d'un membre** : le bouton sur sa fiche efface tous ses achats pour rejouer un scénario. Il n'apparaît qu'en mode test, refuse de s'exécuter si `stripe_mode = live`, et refuse aussi si le membre a un abonnement créé en production.

> **Avant la mise en production** : faire tourner les clés de test qui auraient pu transiter en clair, poser les clés live, créer la destination webhook de production, basculer `stripe_mode`, et vérifier le comportement de Bancontact en paiement récurrent — point non tranché à ce jour.

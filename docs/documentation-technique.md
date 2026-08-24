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
| Installation sans store | PWA — manifest + service worker |

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

### Abonnement à démarrage différé

Vendre le 15 août un abonnement qui commence le 1er septembre : la carte est enregistrée tout de suite, le premier prélèvement attend la date.

C'est **`trial_end`** qui porte ce report — le nom trompe, il ne s'agit pas d'une période d'essai commerciale mais du mécanisme Stripe qui décale la première facture. Le champ « Démarrer plus tard » de la confirmation d'abonnement envoie une date à `create-checkout-session`, qui la pose en `subscription_data.trial_end`.

**Rien n'est crédité avant le paiement.** C'est la propriété qui compte commercialement : un client qui achète en août ne peut pas venir s'entraîner avant septembre. Elle tient à deux mécanismes déjà en place :

- le webhook ne crédite que sur `invoice.paid` ;
- il **ignore les factures à 0 €**, or Stripe en émet une à la souscription (`billing_reason: subscription_create`, montant 0). Sans ce filtre, elle passerait pour un cycle payé et créerait le pack un mois trop tôt.

> Ce filtre existait déjà, écrit le 5 août après le bug du second pack créé lors d'un report d'échéance. Le démarrage différé en hérite sans une ligne de code supplémentaire.

Pendant l'attente, l'abonnement est en statut `trialing`, que le webhook traite comme actif. La notification distingue les deux cas : « Abonnement enregistré » avec la date de début si le démarrage est différé, « Abonnement activé » sinon. Annoncer « actif » ferait chercher au membre des crédits qui n'existent pas encore.

**Bornes de saisie** : au moins 48 h (contrainte Stripe, sous laquelle le report est refusé), au plus un an (garde-fou maison — au-delà, c'est une faute de frappe plus probablement qu'une intention). Le champ du front porte le même minimum, pour que l'erreur se voie à la saisie plutôt qu'au retour serveur.

**Vérifié au test clock le 2026-08-09**, sur un abonnement de 4 semaines souscrit avec `trial_end` à J+7 :

| Moment | Facture | Pack en base |
|---|---|---|
| Souscription | 0 €, `subscription_create` | **aucun** |
| À `trial_end` | 100 €, `subscription_cycle`, période J+7 → J+35 | créé, 4 crédits, expire à la fin du cycle |
| Cycle suivant | 100 €, période J+35 → J+63 | créé, enchaîné **sans trou** — `expires_at` du premier = `purchased_at` du second |

> **Point de vigilance** : la carte est validée à la souscription mais débitée à la date de début. Si elle expire entre-temps, on l'apprend le jour du prélèvement. L'e-mail « paiement refusé » couvre ce cas.

**Le pack ponctuel n'a pas d'équivalent, et n'en a pas besoin.** `pack_purchases` porte un `expires_at` mais pas de `starts_at`, et `get_available_credits` ne filtre que sur l'expiration : un pack est consommable dès qu'il existe.

La réponse est commerciale, pas technique : **vendre un pack dont la durée de validité couvre la période visée**. Un pack de trois mois acheté le 15 août reste valable jusqu'à mi-novembre — le client a sa période de septembre-octobre sans qu'on ait rien à décaler. Décision du 2026-08-09.

> La limite est connue et assumée : rien n'empêche le client de consommer des séances en août. Elle ne gêne que si le pack est vendu au tarif d'une période précise et que la consommation anticipée doit être exclue — cas rare, qu'une phrase au client règle mieux qu'une colonne en base.

Si ce besoin devenait réel, il faudrait une colonne `starts_at` ajoutée au filtre de `get_available_credits`. Côté Stripe il n'y a de toute façon rien à attendre : un paiement ponctuel est encaissé ou ne l'est pas, la notion de date d'entrée en vigueur n'existe pas.

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
| `pack_types` | Le catalogue. `is_unlimited`, `is_recurring` et sa périodicité, et la catégorie que l'achat attribue |
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

## Plafond de fréquentation et couverture du cycle

### Un plafond, deux colonnes

`pack_types.quota_sessions` et `quota_days` : **N cours par D jours**. Les deux vont ensemble (contrainte `quota_both_or_none`), `NULL` désactive le plafond.

### La fenêtre est glissante et centrée

On compte les cours situés à moins de D jours **avant ou après** la séance visée. Les deux côtés comptent, et c'est essentiel : en ne regardant que vers l'arrière, il suffirait de réserver du plus lointain au plus proche pour que chaque fenêtre soit vide au moment du test, et tout passerait.

Deux formes ont été essayées puis écartées :

- **Quota par cycle d'abonnement** — se rechargeait au renouvellement, mais ne valait que pour les abonnements, et butait sur le fait que le cycle suivant n'existe pas encore en base au moment de réserver.
- **Fenêtre calendaire** (« 4 par semaine », lundi→dimanche) — plus lisible, mais laisse cumuler 4 le dimanche et 4 le lundi.

### D est borné à 14 jours

Au-delà de deux semaines, un plafond ne contraint plus le rythme : « 50 cours par 28 jours » laisse en faire 50 la première semaine puis rien pendant trois — exactement la surconsommation qu'on veut empêcher.

Borne **fixe** plutôt que calculée par pack : une borne qui suivrait `validity_days` serait illisible, et n'aurait aucun sens sur un pack ponctuel valable un an.

### La fenêtre ignore les cycles, volontairement

Le plafond limite le rythme physique, pas la facturation. Quelqu'un qui a beaucoup fréquenté fin août reste bridé début septembre, même après un nouveau prélèvement. Décision explicite du studio ; avec D ≤ 14 l'effet reste marginal.

### Le trigger, pas le client

Les réservations partent d'un `INSERT` direct depuis le front (policy `Bookings: own insert`). Un contrôle appelé côté client serait décoratif : il suffirait d'appeler l'API sans lui. `trg_enforce_unlimited_quota` s'exécute quoi qu'il arrive.

Le staff passe outre, comme il ignore déjà le délai de fermeture.

### La validité se juge à la date du cours

`get_available_credits` acceptait tout pack valide au moment de la réservation — on pouvait donc payer un cours du cycle suivant avec le cycle courant. La variante à trois arguments filtre sur `p_class_starts_at`.

**Tolérance** : un abonnement `active` et non résilié couvre les cours au-delà de son terme. Sans elle, plus aucune réservation anticipée ne serait possible en fin de cycle. Elle s'arrête où le renouvellement s'arrête.

La tolérance ne joue **que sur la couverture, pas sur les crédits** : un pack à crédits épuisé reste bloqué jusqu'au renouvellement — on ne consomme pas un crédit qui n'existe pas encore.

### `why_no_credit_for_class` : quatre causes, pas une

Une liste vide de crédits ne dit pas pourquoi. La fonction distingue :

| Cause | Message au membre |
|---|---|
| `quota_reached` | le plafond du pack, avec sa fenêtre |
| `subscription_ending` | l'abonnement se termine avant le cours, avec la date |
| `credits_exhausted_renewal` | crédits épuisés, renouvellement le JJ/MM — rien à racheter |
| `no_credit` | absence réelle de crédit → boutique |

Sans cette distinction, un abonné à jour dont les crédits sont épuisés voyait le même message que quelqu'un qui n'a jamais rien acheté.

### Réservations orphelines : trigger sur `subscriptions`

Une résiliation arrive par au moins trois routes — la fonction de l'app, le webhook Stripe (**quatre endroits** y écrivent `cancel_at_period_end`), et le dashboard Stripe. Le seul point commun est la table. Un déclencheur posé dans `cancel-my-subscription` raterait les deux autres.

Déclenché **à la résiliation**, pas au renouvellement : au renouvellement il n'y a rien à annuler, et attendre le terme préviendrait le membre des semaines trop tard.

La coupure se fait à **l'heure près**, pas à la journée : un membre dont l'abonnement expire le 1er septembre à 12h00 garde ses cours du matin et perd celui de 12h30. Cohérent avec Stripe, qui raisonne aussi à l'horodatage.

---

## Réserver : une seule transaction

`book_class(p_class_id, p_pack_purchase_id)` décide **et** écrit, sous verrou du cours. C'est le pendant membre de `book_member_by_staff`.

**Ce qu'elle remplace** (jusqu'au 2026-08-23) : quatre allers-retours depuis le navigateur — vérifier les places, choisir la source, insérer, décompter. Entre le premier et le troisième, rien ne tenait. Deux conséquences, jamais constatées faute de trafic simultané mais bien réelles :

- **Dépassement de capacité.** Le compteur de places venait d'un état React chargé à l'ouverture de la page. Deux membres cliquant sur la dernière place à la même seconde passaient tous les deux. `UNIQUE(scheduled_class_id, user_id)` protège de la double inscription d'un **même** membre, pas du dépassement.
- **Réservation sans débit.** `consume_credit` renvoie `VOID` et porte `AND credits_remaining > 0` : à zéro crédit, elle ne touche aucune ligne et **ne lève aucune erreur**. Tester `error` n'y aurait rien changé.

**Comment elle s'y prend :**

```
pg_advisory_xact_lock(cours)        -- sérialise les réservations de CE cours
  → can_book_class()                -- passé, annulé, complet, déjà inscrit, fermé
  → contrôles directs               -- les quatre qui ne se négocient pas
  → get_available_credits()         -- la source, avec sa couverture et son quota
  → décompte du crédit, CONTRÔLÉ    -- ROW_COUNT vérifié
  → écriture de la réservation
```

Trois choix à connaître :

- **Le verrou est consultatif**, pas un `SELECT FOR UPDATE` : il ne sérialise que les réservations du même cours, sans bloquer un admin qui modifierait l'horaire au même moment. Il tombe avec la transaction, quoi qu'il arrive.
- **Le décompte précède l'écriture.** L'ordre inverse obligerait à lever une exception pour annuler une réservation déjà écrite, et le front devrait gérer deux formes de refus. L'atomicité garantit qu'un crédit ne peut pas partir sans réservation : si l'INSERT échoue ensuite, tout est annulé.
- **Elle réutilise `can_book_class` et `get_available_credits`** au lieu de réécrire leurs règles. Dupliquer garantissait qu'un jour les copies divergeraient.

**Deux chemins ne passent pas par elle, volontairement** : la séance d'essai (doit poser `is_trial`, et son pack ne remonte pas par `get_available_credits`) et l'inscription par le staff (`book_class` réserve pour `auth.uid()` — elle inscrirait l'admin au lieu du membre).

> **Les contrôles du front restent utiles**, mais ils ont changé de rôle : ils **expliquent** au membre ce qui bloque (« vos crédits se rechargent le 3 », « ce pack ne couvre pas ce type de cours »). Ils ne sont plus ce sur quoi repose la justesse.

**Éprouvée** : `supabase/test-book-class.sql` joue neuf cas dans une transaction annulée — rien ne persiste, relançable. Le verrou lui-même demande deux sessions simultanées, que le SQL Editor ne sait pas tenir : voir `test-book-class-concurrence.sql`.

---

## Index — ce qui rend les requêtes rapides

`bookings` et `scheduled_classes` n'avaient **aucun index** jusqu'au 2026-08-23, en dehors de leur clé primaire et d'une contrainte d'unicité. Ce sont pourtant les deux tables que tout interroge : 65 requêtes dans les fonctions de la base.

Invisible sur les données de test. À 10 000 réservations, chaque affichage du planning aurait lu les 10 000 lignes pour en retenir quatre.

**Huit index posés**, chacun répondant à des requêtes relevées une par une :

| Table | Index | Sert |
|---|---|---|
| bookings | `(scheduled_class_id, status)` | « combien d'inscrits sur ce cours » |
| bookings | `(user_id, status, created_at DESC)` | les réservations d'un membre |
| bookings | `(pack_purchase_id)` | la valorisation d'une séance |
| scheduled_classes | `(starts_at)` | planning, exports, statistiques |
| scheduled_classes | `(coach_id, starts_at)` | l'espace coach |
| scheduled_classes | `(class_type_id, starts_at)` | le filtre par type |
| pack_purchases | `(user_id, expires_at DESC)` | les crédits, lus avant chaque réservation |
| waitlist | `(user_id, status)` | la liste d'attente d'un membre |

> **Faut-il archiver les vieilles données ?** Non. Mesuré le 2026-08-23 : la base entière pèse **1,1 Mo**, quand le plan Pro en offre 8 Go. Même dix fois plus dense, une année réelle tiendrait dans 10–15 Mo — le plan gratuit suffirait trente ans. Le volume n'a jamais été le problème de performance ; l'absence d'index l'était. Et archiver amputerait le suivi clients et l'historique des revenus, quand l'obligation comptable belge est de sept ans.

**Avant d'ajouter un index**, vérifier qu'il n'est pas déjà servi par une contrainte `UNIQUE` — celle-ci crée son propre index. Un neuvième index a été écarté pour cette raison : la recherche par cours dans `waitlist` était déjà couverte.

**Après toute création d'index**, exécuter `ANALYZE` sur les tables concernées : sans statistiques à jour, le planificateur peut ignorer un index tout neuf.

---

## Sécurité

**Row Level Security actif sur toutes les tables.** Un membre ne voit que ses données, un coach voit les achats et les réservations, un admin voit tout.

**Les écritures sensibles passent par des fonctions `SECURITY DEFINER`** plutôt que par des policies ouvertes. Motif : une policy en `WITH CHECK (true)` laisse n'importe quel membre authentifié écrire ce qu'il veut. Deux trous de ce type ont été trouvés et fermés le 5 août — n'importe qui pouvait se créer un bon d'achat du montant de son choix, ou s'attribuer un parrain.

**La règle générale** : si une opération engage de l'argent ou des droits, elle se contrôle côté serveur. Masquer un bouton ne protège de rien — les fonctions sont appelables directement.

**Le motif employé partout** : plutôt que d'élargir les droits d'un rôle, on ouvre une porte étroite et gardée. Un coach ne peut pas écrire dans `pack_purchases` ; il appelle `book_member_by_staff`, qui vérifie qu'il est bien coach **de ce cours-là** avant d'agir. Ajouter une policy `coach update` aurait laissé n'importe quel coach modifier n'importe quel pack, y compris s'ajouter des crédits.

> **Toute fonction `SECURITY DEFINER` doit vérifier le rôle de l'appelant.** Elle contourne RLS par construction : sans ce contrôle, elle devient une porte ouverte. Deux fonctions ont été trouvées sans vérification et corrigées le 6 août.

**Les clés secrètes** ne sont jamais dans le front. Le navigateur ne connaît que l'URL Supabase et la clé publique, dont les droits sont bornés par RLS.

> **`REVOKE ... FROM PUBLIC` ne fait rien sur une fonction Supabase.** Le projet applique des `ALTER DEFAULT PRIVILEGES` qui accordent `EXECUTE` **nommément** à `anon`, `authenticated` et `service_role` sur toute fonction créée dans `public`. Le droit ne vient donc pas de `PUBLIC`, et le révoquer ne l'atteint pas. Les ACL le disent sans ambiguïté : `anon=X/postgres`.
>
> La forme qui fonctionne : `REVOKE EXECUTE ON FUNCTION nom(args) FROM anon;`
>
> Vérifier avec `has_function_privilege('anon', 'nom(args)', 'EXECUTE')` — et non en supposant. Constaté le 2026-08-23 : trois fonctions portaient un `REVOKE` inopérant depuis leur création.
>
> **Ce n'est jamais la barrière principale.** Le contrôle de rôle à l'intérieur de la fonction l'est. Le `REVOKE` évite seulement qu'un appel anonyme atteigne le corps.

---

## Les guides existent en double — et divergent

Les guides membre et administrateur vivent à **deux endroits**, et rien ne les synchronise :

| Emplacement | Rôle |
|---|---|
| `docs/guide-admin.md`, `docs/guide-membre.md` | La version de travail, celle qu'on édite |
| `public/guide-admin.md`, `public/guide-utilisateur.md` | **Ce que la page `/help` affiche réellement** |

Noter le renommage : `guide-membre.md` devient `guide-utilisateur.md` dans `public/`.

> **Éditer `docs/` sans recopier dans `public/` ne change rien pour l'utilisateur.** Constaté le 2026-08-09 : deux journées de documentation étaient invisibles dans l'application, la page d'aide servant une version antérieure de 62 lignes.

Après toute modification d'un guide :

```bash
cp docs/guide-admin.md   public/guide-admin.md
cp docs/guide-membre.md  public/guide-utilisateur.md
npm run build
```

**Les versions anglaises** (`public/guide-admin-en.md`, `public/guide-utilisateur-en.md`) sont traduites à la main et **accusent du retard** : au 2026-08-09, elles ignorent le suivi des clients, le démarrage différé, la séance d'essai, la suppression de compte et les tableaux d'orientation.

---

## PWA — l'application installable

Le front est une PWA : `public/manifest.json`, `public/sw.js`, et l'enregistrement du service worker dans `index.html`. Un membre l'installe sur son écran d'accueil et l'ouvre en plein écran, sans barre d'adresse.

### Le cache porte la version

`CACHE_NAME` était figé à `'bot-v1'` : un testeur pouvait rester indéfiniment sur une version périmée et **signaler un bug déjà corrigé**.

Le nom du cache porte désormais la version de `package.json`, injectée à la construction par le plugin `versionner-le-sw` de `vite.config.ts`. Il faut un plugin parce que **Vite recopie `public/` sans le transformer** : `__APP_VERSION__` n'atteint pas `sw.js`.

`activate` purge tout cache dont le nom diffère — l'ancien part de lui-même.

### La bascule est proposée, pas imposée

`skipWaiting()` a été **retiré de `install`**. Il faisait basculer le nouveau service worker immédiatement, ce qui remplace le code sous les pieds du membre : un formulaire à moitié rempli ou une réservation en cours de validation part avec.

Le worker attend en réserve et ne s'active que sur le message `ACTIVER_MAINTENANT`, envoyé par le bouton « Recharger » de `UpdatePrompt`.

Trois détails séparent une bannière qui marche d'une qui ment (`src/lib/pwa-update.ts`) :

- **Le rechargement vient de `controllerchange`**, pas du clic — le déclencher tout de suite rechargerait l'**ancienne** version, le nouveau worker n'ayant pas encore pris la main.
- **Un worker déjà en attente au chargement** est détecté explicitement. Sans ce test, un membre revenu après un déploiement ne verrait la bannière qu'au déploiement *suivant* : `updatefound` s'est déclenché avant que la page existe.
- **`navigator.serviceWorker.controller` absent = première visite.** Annoncer une « nouvelle version » à quelqu'un qui découvre le site n'aurait aucun sens.

Une vérification horaire couvre l'onglet laissé ouvert — le cas le plus fréquent sur ordinateur.

### Installer : quatre situations, une seule réponse

`useInstallationPWA` (`src/lib/pwa-install.ts`) ramène les navigateurs à quatre états : `prompt` (Chrome sait le faire), `ios-manuel` (montrer le geste), `installee`, `impossible`.

- **Le hook répond `installee` en natif** (Capacitor) : proposer une installation dans l'app native n'a aucun sens, et Apple rejette une app qui pousse vers un autre canal de distribution.
- **Seul Safari reçoit le mode iOS.** Chrome et Firefox y sont des habillages de WebKit et n'exposent pas « Sur l'écran d'accueil ».

### Pièges rencontrés

**L'`apple-touch-icon` pointait vers un PNG absent**, et le `.htaccess` renvoyait `index.html` pour toute URL inconnue : iOS recevait du **HTML en HTTP 200** là où il attendait une image, et posait une icône générique sans rien signaler. Le `.htaccess` exclut désormais les extensions statiques de la réécriture SPA — une image absente répond 404, ce qui se voit.

**Toutes les icônes étaient déclarées `"any maskable"`** : Android applique alors un masque circulaire et rogne le logo. Les deux usages sont séparés.

**`sw.js` et `manifest.json` passent en `no-cache`** dans le `.htaccess` : ils ne portent pas de hash dans leur nom, et un cache long les figerait sur une version périmée sans recours.

> Les **notifications push** ne fonctionnent sur iOS **que** si l'application a été installée sur l'écran d'accueil. Un membre resté dans Safari n'en reçoit aucune.

Procédure de test complète : `docs/guide-test-iphone.md`.

---

## Inscriptions — ce que le journal enregistre

`signup_attempt` couvre deux cas que rien ne traçait.

**L'inscription spontanée.** `user_created` n'était écrit que par `AdminUsersPage`, quand le studio crée un membre à la main : une inscription venue du formulaire public ne laissait aucune trace. Les deux actions restent distinctes — les confondre effacerait la différence entre « le studio a inscrit quelqu'un » et « quelqu'un s'est inscrit tout seul ».

Écrite depuis le trigger `handle_new_user`, pas depuis le front : toute création passe par `auth.users`, quelle qu'en soit l'origine. Dans un bloc `BEGIN/EXCEPTION` à part, car le trigger avale déjà ses erreurs — une trace qui échoue ne doit pas emporter la création du compte.

**La tentative sur une adresse déjà inscrite.** Ce cas ne crée aucun compte, donc le trigger ne se déclenche pas — et c'est pourtant celui qui fait qu'un membre « ne reçoit jamais l'e-mail » sans comprendre pourquoi.

> **Supabase répond sans erreur et n'envoie rien.** C'est sa protection contre l'énumération des comptes : répondre franchement permettrait de tester des adresses pour savoir qui fréquente le studio.

La détection se fait sur l'**ancienneté de `created_at`** (seuil : 10 secondes), pas sur `identities` vide. Ce dernier critère ne vaut que si la confirmation d'e-mail est **désactivée** ; confirmation activée — notre cas — Supabase renvoie le compte existant **avec** ses identités, et le test ne voit jamais rien. Vérifié contre l'API : compte neuf à 1,3 s d'écart, compte existant à plusieurs minutes.

`log_duplicate_signup(p_email)` est appelable **sans session** — la personne qui s'inscrit n'en a pas — mais ne révèle jamais si l'adresse existe, et se borne à une trace par heure et par adresse pour qu'un formulaire soumis en boucle ne noie pas le journal.

Côté écran, l'application ne l'affirme pas non plus : elle décrit le cas (« Tu as déjà un compte avec cette adresse ? ») et propose « Mot de passe oublié », adresse pré-remplie.

### Renvoyer l'e-mail de confirmation

Deux points d'entrée, parce qu'il y a deux situations : l'écran affiché juste après l'inscription, et le **refus de connexion pour non-confirmation** — c'est le cas de celui qui a fermé la première page, et il n'avait auparavant aucun recours.

`signUp` passe désormais `emailRedirectTo`, comme `resetPassword` : le lien partait sinon vers l'URL configurée côté Supabase, pas forcément l'origine réelle. `urlApplication()` reprend le motif de `ProfilePage` — toujours `VITE_APP_URL` quand elle est connue, sans quoi une inscription depuis le serveur de développement enverrait un lien vers `localhost`, inutilisable depuis le téléphone qui reçoit l'e-mail.

La seule erreur montrée est la **limite de cadence** (une minute entre deux envois) : sans ce message, le membre reclique en croyant que rien ne part.

### Effacer un compte parasite

`purge_parasite_account(p_user_id)` efface **réellement**, contrairement à `delete_member_account` qui anonymise. Le droit comptable belge impose sept ans dès qu'il y a eu paiement — mais un compte inscrit il y a dix minutes n'a produit aucune écriture, et l'anonymiser laisserait une ligne fantôme « Membre supprimé #a1b2c3d4 » à vie.

Refusé dès que le compte est autre chose qu'un parasite : e-mail confirmé, membre du staff, ou trace financière (pack payé, abonnement, frais d'inscription, réservation). Le garde-fou est **côté serveur**, et le refus nomme son motif plutôt que d'afficher un « impossible » qui ferait croire à une panne.

> **La séance d'essai ne bloque pas.** Offerte d'office à toute inscription, elle est présente sur *tous* les comptes et interdirait sinon chaque purge. Le filtre porte sur `price_paid_cents > 0`.

La trace d'effacement s'écrit **avant** la suppression et se rattache à l'admin : `activity_log` référence `auth.users`, et les lignes du parasite vont disparaître.

---

## Catégorie de membre — dérivée des packs actifs

Un pack peut attribuer une catégorie (`grants_category_id`) et dire à quoi revenir ensuite (`reverts_to_category_id`). C'est ce qui permet de vendre une **séance supplémentaire à tarif abonné**, invisible pour les autres — le mécanisme d'accès étant `pack_type_categories`, qui restreint qui voit quel pack.

> **Deux réglages globaux avaient été envisagés**, déduits de `is_recurring`. Écarté : cela suppose que tous les abonnements se valent. Le jour où un premium coexiste avec un mini, les deux donneraient le même tarif préférentiel ; et un pack ponctuel ne pourrait jamais accorder de catégorie. `is_recurring` (comment on paie) et la catégorie (quel tarif on mérite) ne sont pas le même fait.

**La catégorie se dérive, elle ne se comptabilise pas.** Stocker à l'achat et « rendre » à l'expiration reviendrait à tenir un compteur : deux écritures qui doivent rester d'accord, et qui divergeront. Un membre peut détenir un abonnement **et** une carte de séances, sans qu'on sache dans quel ordre ils s'éteignent.

`derive_member_category(p_user_id)` répond toujours à la même question — *vu ce que ce membre détient maintenant, quelle catégorie mérite-t-il ?* :

```
1. abonnement actif (active/trialing/past_due)  → sa catégorie
2. sinon, pack ponctuel encore valide            → sa catégorie
3. sinon, repli du dernier pack qui en déclarait un
```

**Priorité à l'abonnement** : un abonné qui achète une séance supplémentaire ne perd pas son statut — ce serait lui retirer le tarif qui l'a fait acheter.

`apply_member_category` écrit le résultat, et **sort sans rien faire quand aucun pack ne se prononce** : un studio qui range ses membres à la main ne doit pas voir son classement effacé par un achat.

**Trois moments de recalcul**, dont un qui méritait réflexion :

| Quand | Comment |
|---|---|
| À l'achat | Trigger `trg_category_on_purchase` sur `pack_purchases` |
| Fin d'abonnement | Trigger `trg_category_on_subscription` sur `subscriptions` |
| À la connexion | `refresh_my_category()`, appelée par `fetchProfile` |

Le troisième existe parce que **l'expiration d'un pack ponctuel ne produit aucun événement** : la date passe, rien ne se déclenche. Un cron nocturne corrigerait après coup et finirait par diverger — le projet a déjà tranché ce débat pour le statut d'un cours. On recalcule au moment où la valeur sert.

Les deux triggers sont dans un bloc `BEGIN/EXCEPTION` : un classement qui échoue ne doit pas annuler un achat payé.

> **`member_status` ne se règle pas à la main.** Il est calculé par `update_member_status` à partir des faits — frais payés, pack actif, ancienneté du dernier pack expiré. Un statut posé manuellement serait écrasé au prochain recalcul. Pour ranger d'anciens membres, utiliser la **catégorie** « archives ».

---

## Conflits de planning

`analyserConflits` (`src/lib/conflits-planning.ts`) est appelée avant toute écriture en masse — duplication, création avec répétition. Elle sort la logique de la page, où elle était dupliquée à deux endroits.

Elle confronte les candidats aux cours existants **et entre eux** : dupliquer deux cours vers le même créneau doit se voir, alors qu'aucun des deux n'est encore en base.

Deux natures de conflit, qui n'appellent pas la même réponse :

| Conflit | Traitement |
|---|---|
| Même minute, **même salle** | **Bloquant** — deux cours ne tiennent pas dans une salle |
| Même minute, **même coach**, salles différentes | **Avertissement** — le cours est créé |

Le conflit de coach n'était pas vérifié, et c'est pourtant le plus coûteux : il ne se découvre que le jour même, avec des membres inscrits des deux côtés. Bloquer interdirait des plannings valides — un coach peut superviser deux salles.

> **Une salle vide ne bloque pas.** La clé était `heure|salle`, et une salle absente devenait `heure|` : deux cours sans salle se bloquaient mutuellement, ce qui interdisait deux Personal Training simultanés avec deux coachs différents.

La comparaison se fait à la **minute** : deux cours saisis à la même heure peuvent différer de quelques millisecondes selon leur origine.

Sept cas de test couvrent la logique — salle occupée, deux salles, salle vide, conflit de coach, candidats entre eux, précision à la minute, cas nominal.

> **Aucune contrainte en base** n'empêche deux cours au même créneau : la vérification est applicative, et l'admin peut passer outre l'avertissement de coach. Un `EXCLUDE` sur `(starts_at, floor)` fermerait la porte, mais interdirait aussi les corrections légitimes.

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

**L'écran ne doit jamais attendre un appel accessoire.** `confirmBooking` fermait sa pop-up en DERNIER, après le journal d'activité et la notification. Il suffisait que l'un des deux échoue pour que la fenêtre reste ouverte sur une réservation pourtant enregistrée — le membre voyait un bouton figé et pouvait cliquer deux fois. **Ce qui est acquis s'affiche d'abord ; la trace et l'e-mail suivent, isolés dans un `try`.** Le même défaut existait sur trois autres chemins (liste d'attente, inscription en attente, séance d'essai).

**Un pack de formule récurrente n'est pas un abonnement.** La table `subscriptions` n'est alimentée que par le webhook Stripe, après un vrai paiement. Un pack attribué à la main depuis l'admin — même d'un `pack_type` marqué `is_recurring` — donne des crédits utilisables mais **aucun prélèvement programmé**, et `pack_purchases.subscription_id` reste `NULL`. Conséquence à l'écran : ni carte d'abonnement, ni bouton de résiliation, puisqu'il n'y a rien à résilier. Se fier à `pack_type.is_recurring` pour qualifier la **nature** d'un pack, et à `subscription_id` pour savoir s'il est **réellement rattaché** à un abonnement vivant — les deux ne disent pas la même chose.

**Une validité de pack ne veut rien dire sur un abonnement.** `validity_days` n'est lu que pour un achat ponctuel : sur un abonnement, `creditPack` cale l'expiration sur `periodEnd`, la fin du cycle facturé par Stripe. Un avertissement du formulaire exigeait pourtant que les deux concordent — il annonçait un problème impossible, et devenait insoluble sur un cycle qui n'est pas un multiple de 7 jours, la validité se saisissant en semaines. Un abonnement de 72 jours ne pouvait donc jamais le satisfaire.

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

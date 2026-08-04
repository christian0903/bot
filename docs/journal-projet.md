# Journal du projet — Back On Track v2

> Trace de l'évolution du projet et de ce qui reste à faire.
> Dernière mise à jour : **2026-08-04**

---

## Où en est le projet

**Phases 1 à 10 livrées** (v2.0.0 et suivantes, jusqu'à v2.16.0) : comptes, packs, planning, réservations, liste d'attente, annulations, check-in, statistiques, parrainage, notifications, e-mails.

**Phase 11** (admin avancé) : non entamée.
**Phase 12** (abonnements récurrents) : **socle complet, pont Stripe à brancher**.
**Phase 13** (RGPD & sécurité) : non entamée.

L'application tourne sur **Stripe** — la migration vers Mollie prévue au plan a été abandonnée le 2026-08-03.

---

## Session du 2026-08-03 / 04

Point de départ : le dossier local était figé depuis juin, le dépôt distant avait 50 commits d'avance. 68 commits produits sur ces deux jours.

### 1. Cadrage des abonnements

La réunion avec les deux coachs-associés a produit **un renversement de conception** :

> Un abonnement n'est pas une entité nouvelle. C'est **un pack court qui se renouvelle tout seul**.

Conséquence : pas de moteur de quota à écrire, pas de table `subscription_plans`, pas de nouveau parcours de réservation. À chaque échéance payée, on crée une ligne `pack_purchases` ordinaire, et le reste de l'application ne voit aucune différence.

Cela a réduit la Phase 12 de moitié par rapport à ce que le questionnaire laissait craindre.

**Règle d'arbitrage retenue, valable pour toute la suite :**

> « Une application complexe, c'est une fabrique à emmerdes. »
> « Il faut réfléchir à ce qui va se passer souvent et ce qui se passera exceptionnellement. L'exception, il ne faut pas l'inscrire. »

Traduction : **l'exception se gère à la main, pas dans le code.** Trois décisions en découlent directement — pas de congés en libre-service (l'admin décale l'échéance), pas de pénalité no-show automatique (mais une statistique), pas d'annulation automatique des cours sous le seuil (une proposition à valider).

Documents produits : `questionnaire-abonnement.md`, `grille-analyse-abonnement.md` (26 questions tranchées sur 44), `dossier-fonctionnel-abonnement.md` (règles métier, modèle de données, critères d'acceptation).

### 2. Décision Stripe

Vérifié dans la documentation officielle des deux prestataires. Stripe couvre les trois besoins de la Phase 12 ; Mollie n'en couvre correctement qu'un.

| Besoin | Stripe | Mollie |
|---|---|---|
| Cycle de 4 semaines | ✅ `interval=week` × 4 | ✅ `"4 weeks"` |
| Réduction ponctuelle sur une échéance | ✅ coupon `duration: once` | ❌ pas de coupon sur abonnement |
| Décaler l'échéance | ✅ `billing_cycle_anchor` | ❌ `nextPaymentDate` en lecture seule |

La Phase 2 du plan (« Migration Stripe vers Mollie ») est marquée **abandonnée**. La Phase 12 du plan est remplacée par `dossier-fonctionnel-abonnement.md`.

> Point resté ouvert : **Bancontact**. La description fonctionnelle le donnait pour « obligatoire — majorité de clients belges ». Stripe le propose, mais son comportement en paiement **récurrent** n'a pas été vérifié. À trancher avant la mise en vente des abonnements.

### 3. Packs illimités

N'existaient nulle part. Ajout de `pack_types.is_unlimited` et réécriture de cinq fonctions SQL.

La règle est **symétrique** : pas de décompte à la réservation, donc **pas de recrédit à l'annulation**. Sans cette symétrie, annuler une réservation illimitée aurait créé un crédit à partir de rien.

Piège principal rencontré : `get_available_credits()` filtrait sur `credits_remaining > 0` — un illimité n'aurait jamais été trouvé, le membre n'aurait pas pu réserver du tout.

### 4. Corrections de fond découvertes en chemin

Ces bugs préexistaient et n'ont été trouvés qu'en travaillant sur autre chose :

| Bug | Conséquence |
|---|---|
| `saveSetting()` faisait un `UPDATE` puis un `INSERT` de secours *en cas d'erreur* | Un `UPDATE` sur une clé absente ne renvoie **pas** d'erreur : il touche zéro ligne. Aucun nouveau paramètre n'était enregistré, et le message « Paramètres enregistrés » s'affichait quand même. Remplacé par un `upsert`. |
| `handleCancelClass()` appelait `cancel_booking_v2` | Un cours annulé **par le studio** à moins de 24 h privait les inscrits de leur crédit, alors que le message affiché promettait la restitution. Nouvelle fonction `cancel_booking_by_studio()` qui restitue toujours. |
| `canUseTrial` ne testait pas la possession d'un pack | Un membre à qui l'admin attribuait un pack restait bloqué sur « Essai gratuit » et **ne pouvait pas réserver**. |
| Le tableau de bord divisait le prix par `credit_count` (4 endroits) | Sur un pack illimité, le prix **entier** du pack était attribué à chaque séance. |
| « Cours par coach » comptait les cours à venir | 306 cours affichés pour Gauthier dont 153 non encore donnés. |
| Les frais d'inscription n'étaient gérés par aucune version de `create-checkout-session` | Le front envoyait `type: 'registration_fee'`, la fonction répondait « pack_type_id is required ». |
| `stripe-webhook` n'avait **jamais été déployé** | Un paiement réussi ne créditait rien. Maillon manquant de toute la chaîne. |

### 5. Autres livraisons

- **Validité en semaines** dans toute l'interface (la base continue de stocker des jours — aucune migration, aucun risque sur les packs vendus)
- **Onglet Annulations** (admin et client), compté **par cycle** et non sur tout l'historique — sur un abonnement reconduit 13 fois par an, cumuler tout ne dit rien d'utile
- **Statut de cours** dérivé : planifié / effectif insuffisant / exécuté / non donné / annulé. Jamais stocké — une colonne devrait être entretenue par un cron et divergerait du réel
- **Revue des cours sous le seuil** : bandeau admin proposant d'annuler, avec restitution des crédits et notification
- **Cours annulés visibles par le staff**, masqués côté client
- **Redirection par rôle** à la connexion (admin → `/admin/dashboard`, coach → ses cours, client → son tableau de bord)
- **Tableau de bord personnel du coach** : ses chiffres à lui, sur 30 jours
- **Trois paramètres** : coût moyen d'une séance illimitée (18 €), seuil d'alerte annulations (4/cycle), minimum de participants (2)

---

## État de la Phase 12 — abonnements

### Fait

**Base de données** (migrations appliquées) :
- `pack_types` : `is_recurring`, `recurring_interval`, `recurring_interval_count`, `stripe_price_id_test`, `stripe_price_id_live`
- `subscriptions` : lien membre ↔ abonnement Stripe, avec le mode (test/live) et le statut
- `subscription_discounts` : trace des réductions ponctuelles accordées
- `pack_purchases` : `subscription_id`, `stripe_invoice_id` (**index unique** → webhook idempotent)

**Edge Functions écrites** (dans le dépôt, **pas encore déployées**) :
- `create-checkout-session` — réécrite : frais d'inscription, pack ponctuel, abonnement
- `stripe-webhook` — 5 événements, idempotent de bout en bout
- `manage-subscription` — réduction ponctuelle, décalage d'échéance, suspension, reprise, résiliation

**Interface** :
- Formulaire de pack : interrupteur « Abonnement » + périodicité, avec deux garde-fous (rappel des 13 prélèvements par an, alerte si la validité ne colle pas au cycle)

**Un pack de test est prêt** : « Abo illimité Gold », 250 €, illimité, cycle de 4 semaines, validité 28 jours.

### Reste à faire — le pont Stripe

> **C'est ici qu'on s'est arrêté.** Rien de ce qui suit n'est commencé.
> Procédure détaillée : **`docs/stripe-deploiement.md`**

**1. Déploiement** (~15 min, à faire une fois)
```bash
supabase login
supabase link --project-ref aojguoqxbzqcganxgqem
supabase secrets set STRIPE_SECRET_KEY_TEST=sk_test_...
supabase functions deploy create-checkout-session
supabase functions deploy manage-subscription
supabase functions deploy stripe-webhook --no-verify-jwt   # ← indispensable
```

**2. Webhook côté Stripe** (mode Test)
URL : `https://aojguoqxbzqcganxgqem.supabase.co/functions/v1/stripe-webhook`
Cinq événements : `checkout.session.completed`, `invoice.paid`, `invoice.payment_failed`, `customer.subscription.updated`, `customer.subscription.deleted`
Puis `supabase secrets set STRIPE_WEBHOOK_SECRET_TEST=whsec_...` et redéployer le webhook.

**3. Tests** — carte `4242 4242 4242 4242`
Quatre scénarios avec leurs requêtes SQL de vérification dans la procédure : frais d'inscription, pack ponctuel, souscription d'abonnement, renouvellement (via *test clock*, sans attendre 28 jours).

### Reste à faire — écrans, après le pont

- **Configuration Stripe pour super admin** : état de la connexion, mode test/live, bouton « tester la connexion ». Les clés restent des secrets Supabase, jamais affichées.
- **Fiche membre admin** : trois boutons sur un abonnement — accorder une réduction ponctuelle, décaler l'échéance, suspendre / résilier. Les Edge Functions existent déjà, il manque l'interface.
- **Page « Mes packs » côté client** : afficher l'abonnement en cours, sa prochaine échéance, et un bouton de résiliation.
- **Page Packs** : mention explicite du renouvellement automatique. Point commercial autant que technique — « il faut que le client comprenne que ça se renouvelle ».

---

## Décisions à trancher avant la mise en production

**Bloquantes :**
1. **Grille tarifaire** — prix des formules 4 / 8 / 12 / illimité, prix des packs ponctuels équivalents, frais d'inscription. Rien ne peut être mis en vente sans.
2. **Migration des clients actuels** — que deviennent les crédits en cours au jour de la bascule ? Conservés jusqu'à épuisement (recommandé), convertis, ou délai de consommation ?
3. **Bancontact en récurrent** — à vérifier chez Stripe (cf. § 2).
4. **Coût des transactions récurrentes** — un cycle de 4 semaines produit **13 prélèvements par an**, pas 12. À chiffrer sur la marge de chaque formule avant de figer les prix.

**À confirmer d'une phrase** (le développement peut avancer sur l'hypothèse) :
5. Crédits non consommés **perdus** en fin de cycle
6. Changement de formule = effet **au cycle suivant**, sans prorata
7. Résiliation = arrêt du renouvellement, droits jusqu'à la fin du cycle payé
8. Abonnement + pack ponctuel simultanés autorisés ? Si oui, ordre de consommation

**Faible priorité :** jours fériés et fermetures exceptionnelles, cours réservés à certaines formules, transfert de séance, tarifs étudiants/seniors/couples.

---

## Chantiers hors Phase 12

- **Personal training** — chantier distinct, jugé non urgent par les coachs (« je gère tout sur WhatsApp »). Deux tensions non résolues : liberté d'agenda du coach contre auto-réservation, et le premier contact humain.
- **Granularité horaire au quart d'heure** — petit correctif technique, indépendant.
- **Import TechnoGym** — action côté coachs : export CSV des membres, agendas et cours, pour tester sur des données réelles.
- **Phase 11** (admin avancé) et **Phase 13** (RGPD) — non entamées.

---

## Points de vigilance pour la reprise

**Le seuil de 2 participants est sévère.** Avec ce réglage, un cours en tête-à-tête ne compte jamais comme donné, alors qu'il a eu lieu et que le client a consommé son crédit. Sur les données actuelles, un seul cours sur 152 atteint le seuil pour Gauthier. À reconsidérer selon la réalité du studio.

**Les données de démonstration faussent les statistiques.** Le seed a généré beaucoup de cours sans participants. Les chiffres du tableau de bord paraîtront anormalement bas jusqu'à l'import de données réelles.

**Le webhook est le seul endroit qui crédite.** Ne jamais créditer depuis le front ou depuis `create-checkout-session` : un utilisateur pourrait obtenir des crédits en fermant la page avant de payer.

**Un Price Stripe est immuable.** Changer le prix ou la périodicité d'un pack efface les identifiants mémorisés ; un nouveau prix sera créé au prochain achat. Les abonnements déjà souscrits gardent l'ancien tarif.

**Les modes test et live sont étanches.** Les `stripe_price_id` sont stockés séparément, et chaque abonnement porte son mode : un abonnement créé en test ne sera jamais facturé réellement.

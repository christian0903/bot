---
type: handoff
projet:
domaine:
session-machine: mac-mini
session-date: 2026-08-30
session-heure: "22:29"
auteur: "[[@Christian Vanhenten]]"
statut: actif
created: 2026-08-30
tags:
  - claude/handoff
  - bot
  - production
  - stripe
  - rgpd
---

# Handoff — App Bot : Stripe encaisse, et un compte peut enfin s'effacer

> Fin de la journée du 30 août. **Le studio est en production réelle** : Stripe
> live, 64 comptes, 72 réservations, un premier paiement encaissé. Build vert,
> lint stable à 36.

---

## Où on en est

| Base | Référence | Sert | En ligne |
|---|---|---|---|
| bot3 | `cvyslqnojcgnjfgynczw` | `jag.` — test | 3.86.0 |
| bot-ops | `xgwrxbkrfypklrnqbftv` | `app.` — production | 3.86.0 |

Le dépôt est en **3.87.0** (documentation), poussé mais **pas déployé** —
personne ne l'a demandé. `.env` pointe sur jag.

**Réglages de production** : Stripe **live**, séance d'essai **désactivée**.

---

## Stripe est passé en live

Le compte qui encaisse est **Aikicom Perspectives SRL**
(`acct_1RyvQUFXRrGYb9N4`), confirmé par Christian comme l'entité qui exploite
le studio. Le compte « BackOnTrack » (`acct_1U0dZrFYb8OueUJg`) n'a **jamais été
activé** — il n'existe qu'en test, et son onboarding en est resté au premier
écran. Ne pas s'y tromper : c'est celui qui s'ouvre par défaut.

**Webhook créé** : `we_1UAERwFXRrGYb9N49NuwCuRt`, vers
`https://xgwrxbkrfypklrnqbftv.supabase.co/functions/v1/stripe-webhook`, avec
les cinq événements que la fonction traite — `checkout.session.completed`,
`customer.subscription.updated`, `customer.subscription.deleted`,
`invoice.paid`, `invoice.payment_failed`.

Stripe impose la version d'API `2025-07-30.basil` alors que le code déclare
`2023-10-16`. **Sans conséquence** : `stripe-webhook` lit les deux emplacements
du champ `subscription` d'une facture, avec un troisième recours par les lignes
— le cas avait déjà été rencontré et corrigé.

Les secrets `STRIPE_SECRET_KEY_LIVE` et `STRIPE_WEBHOOK_SECRET_LIVE` sont posés
sur bot-ops, empreintes distinctes des clés test. Les deux fonctions relisent
mode et secrets **à chaque requête** : aucun redéploiement n'est nécessaire
pour basculer.

> Les prix live se créent tout seuls à la première vente, dans
> `stripe_price_id_live` — colonne distincte du test. Rien à préparer.

---

## Effacer un compte créé par erreur

**Le problème** : un coach a supprimé un compte de test, a vu apparaître
« Membre supprimé #1ddf3cd3 », et n'a trouvé aucun moyen de s'en débarrasser.
L'adresse e-mail restait prise dans `auth.users`.

`delete_member_account` **anonymise sans effacer** — délibérément : la ligne
porte les références des packs, factures et réservations passées.

**Livré** : `effacer_membre_anonymise(p_user_id)`, réservée au super_admin.
Elle exige que le compte soit déjà anonymisé, et refuse s'il reste une
réservation, un pack, une facture, un abonnement, des frais d'inscription ou
**un cours encadré** — un coach n'est pas un compte créé par erreur. Le message
annonce le nombre d'enregistrements concernés.

Les fiches anonymisées **ne s'affichent plus** aux coachs ni aux admins ; le
super_admin les garde, puisque lui seul peut les effacer.

**Éprouvé sur `app.`** : le compte est parti en entier — profil, connexion,
traces du journal — et `joan.rodon2112+test9@gmail.com` est redevenu libre.
Zéro ligne anonymisée reste en production.

### Deux bugs trouvés en chemin

**Le bouton corbeille ne supprimait rien.** Il faisait un `DELETE` direct sur
`profiles`, table sans policy `DELETE` : RLS refusait **sans lever d'erreur**,
et l'écran annonçait une suppression qui n'avait pas eu lieu. Exactement le
piège que le CLAUDE.md documente.

**Les `h4` n'avaient pas d'ancre** dans `MarkdownDoc.tsx` — les renvois entre
chapitres du guide pointaient dans le vide sur `/help`.

### L'erreur d'analyse à ne pas refaire

J'ai d'abord affirmé que toutes les clés étrangères étaient en `CASCADE`, sur
la foi d'une requête `information_schema` revenue **vide**. Or
`information_schema` **ne voit pas le schéma `auth`** : il y a en réalité
**quatorze contraintes en `NO ACTION`** vers `auth.users`. La première version
de la fonction échouait donc sur `activity_log_actor_id_fkey`.

> **Pour toute question de clés étrangères touchant `auth` : interroger
> `pg_constraint`, jamais `information_schema`.** Et se méfier d'un résultat
> vide là où il devrait forcément y avoir des lignes.

La version corrigée traite les quatorze : cinq refusent, quatre sont
supprimées (journal, badges, parrainages, récompenses), trois déliées
(`performances.created_by`, `app_settings.updated_by`,
`subscription_discounts.applied_by`), puis `profiles` et `auth.users`.

Le journal comptait particulièrement : ses descriptions gardent **l'adresse
e-mail en clair**, que l'anonymisation ne touche pas. La laisser derrière un
effacement « complet » aurait été un mensonge.

---

## Le chantier toujours ouvert

**Retirer la séance d'essai d'un membre** (demande du 30 au soir). Front écrit
et compilant, migration écrite — **rien n'est appliqué, rien n'est commité** :

| Fichier | État |
|---|---|
| `supabase/migrations/20260830_retirer_pack_essai.sql` | écrit, appliqué nulle part |
| `src/pages/admin/AdminUserDetailPage.tsx` | bouton + handler |
| `src/lib/activity-log.ts`, `AdminActivityLogPage.tsx`, `types/index.ts` | action `pack_removed`, `PackType.is_trial` |

C'est **la seule migration non reportée dans `install.sql`** — vérifié fichier
par fichier sur les dix du 29 et du 30.

Reste à : l'appliquer (**deux exécutions** — `ALTER TYPE ADD VALUE` ne tolère
pas l'usage de la valeur dans la même transaction), la reporter dans
`install.sql`, documenter, tester.

> Sa décision de conception est la même que pour l'effacement : un essai intact
> est supprimé, un essai **déjà utilisé** est vidé et périmé — l'effacer
> détacherait sa réservation de ce qui l'a payée.

---

## À décider demain : le retrait de la séance d'essai

**Christian a demandé de ne rien appliquer** ce soir — trop tard pour juger si
ce chantier vaut d'être terminé. Tout est prêt, rien n'est commité ni déployé.

### La question à trancher

Le réglage global **fonctionne et est en production** : la distribution est
coupée, les 56 comptes repris le 30 août n'ont reçu aucune séance d'essai.
C'est peut-être suffisant.

Ce qui reste ne concerne que les séances **déjà accordées avant** la coupure —
**six** en production :

| Membre | Crédit | Réservée ? |
|---|---|---|
| Christian Vht | 1 | non |
| Joan Rodon | 1 | non |
| Gauthier Wilhelmi | 1 | non |
| Arnaud Bogaert | 1 | non |
| Jonas Trine | 1 | non |
| Anselme Meunier | 0 | **oui, déjà utilisée** |

Deux sont des comptes de l'équipe. Restent **quatre membres** avec un essai en
attente, et un qui l'a déjà consommé.

**Si ces quatre essais ne dérangent pas** (ils expirent le 28-29 septembre), le
chantier peut être abandonné : il suffira de supprimer les fichiers et de
retirer le report de `install.sql`. **S'ils dérangent**, il reste une migration
à appliquer et un déploiement.

> Une troisième voie, plus économique : les retirer **à la main** en base une
> seule fois, et ne jamais livrer la fonctionnalité. Six lignes, un cas
> particulier — mais alors le geste n'existera pas si le besoin revient.

### Ce qui est écrit et prêt

| Fichier | État |
|---|---|
| `supabase/migrations/20260830_retirer_pack_essai.sql` | écrit, **appliqué nulle part** |
| `supabase/install.sql` | report **fait** (enum `pack_removed` + fonction) |
| `src/pages/admin/AdminUserDetailPage.tsx` | bouton + handler dans le dialogue de pack |
| `src/lib/activity-log.ts`, `AdminActivityLogPage.tsx`, `types/index.ts` | action `pack_removed`, `PackType.is_trial` |
| `docs/guide-admin.md` + `public/` | section « Retirer une séance déjà accordée » **écrite** |

`tsc` passe, build vert, lint à 36. **Rien n'est commité.**

### Si on termine

1. Appliquer la migration sur bot3 puis bot-ops, **en deux exécutions** —
   `ALTER TYPE ADD VALUE` ne tolère pas l'usage de la valeur dans la même
   transaction, et l'éditeur Supabase enveloppe tout.
2. Comparer les empreintes MD5 de `prosrc` entre les deux bases.
3. Commiter, déployer sur `jag.`, tester, puis `app.`

### Si on abandonne

Supprimer `20260830_retirer_pack_essai.sql`, annuler les modifications des
quatre fichiers `src/`, retirer du guide la section « Retirer une séance déjà
accordée », et **défaire le report dans `install.sql`** (l'enum `pack_removed`
et la fonction `retirer_pack_essai`) — sinon une base neuve porterait une
fonction que l'application n'appelle pas.

### La conception, pour ne pas la re-débattre

Un essai **intact** est supprimé ; un essai **déjà utilisé** est vidé et
périmé. Vérifié cette fois avec `pg_constraint` : `bookings.pack_purchase_id`
et `invoice_requests.pack_purchase_id` référencent le pack **en NO ACTION**,
la base refuserait donc de l'effacer. Et l'effacer détacherait la séance de ce
qui l'a payée — elle resterait au planning sans qu'on sache d'où venait le
crédit.

---

## Demandé pour demain : pas d'écran blanc pendant un déploiement

Pendant le `rsync`, `index.html` est déjà remplacé alors que les fichiers
`assets/` qu'il nomme ne le sont pas encore — un client qui charge la page à
cet instant tombe sur un **écran blanc de quelques secondes**.

Christian veut une **page d'attente** annonçant une mise à jour en cours.
« C'est déjà de trop », dit-il de ces quelques secondes.

Pistes à examiner (rien n'est décidé) :

- **Déploiement atomique** : envoyer dans un dossier neuf, puis basculer d'un
  coup (lien symbolique ou `mv`). Supprime le problème plutôt qu'il ne
  l'habille — et ne demande rien au navigateur.
- **Page de maintenance** posée par `.htaccess` le temps du transfert, retirée
  ensuite. Simple, mais coupe le site pour tout le monde, y compris ceux qui
  ne rechargent pas.
- Envoyer **`assets/` d'abord et `index.html` en dernier** : les anciens
  fichiers restent en place pendant le transfert, l'ancienne page continue
  donc de fonctionner. Peu coûteux, à évaluer en premier.

Le service worker complique le tableau : il sert déjà une version en cache et
annonce les mises à jour. À regarder avant de choisir.

---

## Ce qui reste ouvert par ailleurs

- Déployer la **3.87.0** (documentation) sur `jag.` puis `app.`
- SPF ne mentionne pas Resend, à corriger dans la zone DNS
- hCaptcha — le widget côté code, une demi-journée
- Clé de signature Android + compte développeur Google Play
- Compte développeur Apple, sous nom individuel
- Copier `.dumps/bot-20260829-120547.sql` hors du Mac mini
- « Offrir un pack » — reporté ; recommandation d'un **code cadeau** plutôt
  qu'une création de compte (CGV/RGPD)

---

## Méthode qui a bien servi

**Comparer les empreintes MD5** de `prosrc` entre `install.sql`, jag et
bot-ops : c'est ce qui a confirmé que les trois portaient la même fonction, au
caractère près. À refaire après chaque migration appliquée à la main.

**Lire le bundle que la page nomme**, jamais celui du `dist/` local : chaque
build produit ses propres empreintes, et relancer `deploiement.sh jag` après un
`ops` reconstruit `dist/` pour la base de test. J'avais cru un déploiement
incomplet pour cette raison.

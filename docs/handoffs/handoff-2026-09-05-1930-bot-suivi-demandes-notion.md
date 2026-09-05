---
type: handoff
projet:
domaine:
session-machine: mac-mini
session-date: 2026-09-05
session-heure: "19:30"
auteur: "[[@Christian Vanhenten]]"
statut: actif
created: 2026-09-05
tags:
  - claude/handoff
  - bot
  - notion
  - suivi-demandes
---

# Handoff — Les demandes des coachs ont une base, et un parcours jusqu'à l'App Store

> **v3.143.0**, arbre propre, tout poussé (étiquette comprise).
> Aucun déploiement cette session : rien n'a bougé sur `app.` ni sur `jag.`
> Aucune migration, aucune Edge Function. **Session documentaire et Notion.**

---

## Où on en est

| Domaine | Sert | Version |
|---|---|---|
| `app.` | production (bot-ops) | 3.130.0 |
| `jag.` | test (bot3) | 3.135.0 |
| **App Store** | **en vente** | 1.0 (build 7, code 3.123.0) |
| **TestFlight** | build 8 envoyé | 3.137.0 (build 8) |
| **Dépôt** | — | **3.143.0** |

Rien de tout cela n'a changé aujourd'hui : le dépôt avance seul.

---

## Ce qui a été fait

### La base Notion existe

Le dispositif conçu la veille n'était qu'un document. Il est en place :

- **Page** « Back On Track — demandes des coachs » — l'explication destinée aux
  coachs, au-dessus de la base.
- **Base** « Demandes » — 19 entrées, 16 propriétés.
- **Quatre vues** : Le tableau (Kanban par étape), À valider par vous,
  Par version, Publication App Store.

> **C'est un prototype, dans l'espace Notion PRIVÉ de Christian.** Rien n'est
> partagé. Le portage vers l'espace des coachs reste à faire.

Le lien : la base s'ouvre depuis la page, elle-même dans les pages privées.

### Les 19 demandes de Gauthier Wilhelm

Le PDF `Application BackOnTrack notes.pdf` (reçu par courriel, lu depuis le
cache MailMate) est analysé et versé. Chaque entrée porte sa citation d'origine
et sa section du document.

**Trois relevés qui ne se voient pas à la lecture :**

- **Contradiction sur l'annulation** : le texte dit **12 h** à l'avance,
  l'image des tarifs dit **24 h**. À trancher avant de développer l'abonnement.
- **« Réserver plusieurs places sur un même compte »** paraît petite et ne
  l'est pas : elle remet en cause *une inscription = une personne*, et touche
  les crédits, la capacité du cours, le pointage, l'affichage des inscrits.
- **« Supprimer la vue liste »** suppose d'abord que le calendrier sache tout
  faire. Retirer la liste avant priverait les coachs de gestes utilisés.

**Deux demandes étaient déjà livrées**, vérifiées dans le dépôt avant d'être
marquées — passées en *Déjà fait* :

| Demande | Version | Commit |
|---|---|---|
| Ajouter ses séances à son agenda | 3.130.0 | `5e7a3e1` |
| Voir qui est inscrit au cours | 3.128.0 | `93a78dc` |

Deux réserves inscrites dans leurs fiches : le **nom de famille n'est pas
affiché** alors que le PDF le demandait (seuls prénom et photo), et la
migration des inscrits **n'était pas appliquée sur bot-ops** au moment du
commit — à vérifier.

### Le parrainage vérifié dans le code

Christian voulait s'assurer que le parrainage fait une réduction **ponctuelle**
sur le prochain montant, et non récurrente sur un abonnement.

**C'est déjà le cas.** Le bon devient un coupon Stripe créé avec
`duration: 'once'` (`supabase/functions/create-checkout-session/index.ts:403`) :
remise sur la première facture, puis Stripe retire le coupon de lui-même. Le
commentaire du code nomme le piège évité :

> Baisser le Price rendrait la réduction permanente.

Sur un **pack ponctuel**, c'est l'application qui soustrait — pas de récurrence
à protéger.

> ⚠️ **Cela dit ce que le code veut faire, pas ce que Stripe fait.** Le seul
> contrôle qui vaut est le **test clock**. Les trois étapes à éprouver sont
> écrites dans la fiche Notion : première facture réduite, **deuxième au plein
> tarif**, non-cumul bon + coupon.

Le journal note toujours le parrainage comme **livré mais non testé de bout en
bout** — cette lecture de code ne change pas ce statut.

---

## Ce qui a été décidé

**Notion plutôt que Trello.** Réexaminé en séance sur l'argument du Kanban.
Écarté : Notion a déjà la vue tableau qu'on lui cherchait, et Trello n'aurait
pas les champs typés qui font le reste — Custom Fields payants, pas de vues
multiples par carte.

**Trois colonnes de test nominatives** (`Joan`, `Gauthier`, `Anselme`), chacune
portant une **date**, à la place du couple `Testé par` / `Testé le` posé
d'abord. Elles disent qui a déjà regardé et qui doit encore le faire.

**Une étape « Déjà fait », distincte de « En production »** : la première
recueille ce qui était livré avant la base, la seconde ce qui aura traversé le
parcours complet.

**Deux colonnes de statut mobile, une par plateforme** : `iPhone` (sept
valeurs) et `Android` (six — le Play Store n'a pas d'équivalent de la
publication manuelle différée), plus `Build iOS`, `Version App Store`,
`Soumis le`, `En ligne le`.

Deux raisons. **« Prête pour la publication » n'est pas « En ligne »** — c'est
ce qui a laissé la 1.0 approuvée et invisible le 3 septembre. Et surtout,
**« en production » ne veut pas dire « sur les téléphones »** : au 5 septembre
l'agenda et la liste des inscrits sont sur `app.` mais l'App Store en est
encore à la 1.0. Android arrivant après iOS, une demande pourra être en ligne
sur un magasin et pas sur l'autre.

**Une seule base, malgré la redondance du build.** Le build est un attribut de
la livraison, pas de la demande : le numéro se ressaisit sur chaque ligne. Une
base « Versions » liée l'éviterait, mais romprait la règle d'une base unique —
écarté tant que la ressaisie reste supportable.

---

## La prochaine action

**Trois gestes manuels dans Notion**, qu'aucune API ne peut faire :

1. **Réordonner les colonnes** — l'API les ajoute toujours en fin de table.
2. **Supprimer la vue « À valider par vous » en double** — une seconde a été
   créée pour y ajouter les colonnes de test, l'API ne sachant pas reconfigurer
   une vue existante. Garder celle qui montre `Joan` / `Gauthier` / `Anselme`.
3. **Éprouver le dispositif** en faisant avancer une ou deux demandes.

**Puis, quand le prototype tient** : porter la base vers l'espace Notion des
coachs, et convertir `Appuyé par` en propriété **Personne** (impossible ici,
faute de comptes coachs dans l'espace privé).

---

## Une question tranchée en séance

**Une version acceptée par Apple ne met pas l'application à jour d'office.**
Apple la notifie ; c'est le réglage du téléphone qui décide. « Mises à jour
automatiques » est actif par défaut mais peut être coupé, et même actif il
attend le Wi-Fi et la charge — le déploiement s'étale sur des jours.

`En ligne` veut donc dire **disponible**, pas **installée partout**.

**La PWA échappe à cela** : `app.backontrackstudio.be` sert le même code et se
met à jour au rechargement. C'est la voie courte pour un correctif urgent.
`capacitor.config.ts` porte en commentaire la possibilité de faire charger
l'URL de production à l'application native — l'enveloppe se mettrait alors à
jour comme le site.

---

## Ce qui reste ouvert

- **Deux points à préciser avec Gauthier** : ce qu'il entendait par « le
  calendrier » — c'est l'agenda personnel qui a été livré, pas le calendrier
  d'entraînement interne — et si la photo de profil est toujours impossible
  (son constat datait de la 3.92).
- **Le délai d'annulation** : 12 h ou 24 h. Bloquant pour l'abonnement du
  1er octobre.
- **La migration des inscrits sur bot-ops** — appliquée sur bot3, à vérifier
  côté production.
- **Le parrainage au test clock**, toujours pas fait.

---

## Pièges rencontrés (pour la prochaine fois)

**L'API Notion ne sait pas tout faire.** Trois limites rencontrées :

- une multi-sélection refuse une valeur qui n'existe pas encore dans ses
  options — il faut l'ajouter au schéma d'abord ;
- `create_view` ne reconfigure pas une vue existante : il en crée une seconde
  du même nom ;
- les colonnes s'ajoutent toujours en fin de table, sans position choisie.

**Notion réécrit le gras.** Un `update_content` qui cherche une chaîne exacte
peut échouer alors que le texte paraît identique : Notion avait stocké
`**ajoutez votre nom dans ****\`Testé par\`**`. Relire la page avec `fetch`
avant de remplacer.

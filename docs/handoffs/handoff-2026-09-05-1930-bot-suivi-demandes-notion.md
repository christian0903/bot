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
  - app-store
---

# Handoff — Les demandes des coachs ont une base, et les coachs savent pourquoi ça ralentit

> **v3.151.0**, arbre propre, tout poussé (étiquettes comprises).
> Aucun déploiement cette session : rien n'a bougé sur `app.` ni sur `jag.`
> Aucune migration, aucune Edge Function. **Session Notion et documentaire.**

---

## Où on en est

| Domaine | Sert | Version |
|---|---|---|
| `app.` | production (bot-ops) | 3.130.0 |
| `jag.` | test (bot3) | 3.135.0 |
| **App Store** | **en vente** | 1.0 (build 7, code 3.123.0) |
| **TestFlight** | build 8 envoyé | 3.137.0 (build 8) |
| **Dépôt** | — | **3.151.0** |

Rien de cela n'a changé aujourd'hui : le dépôt avance seul.

---

## Ce qui a été fait

### 1. La base Notion existe

Le dispositif conçu la veille n'était qu'un document. Il est en place, dans
**l'espace Notion privé de Christian** :

- **Page** « Back On Track — demandes des coachs » — le mode d'emploi des coachs.
- **Base** « Demandes » — 19 entrées, 18 propriétés.
- **Quatre vues** — Le tableau (Kanban), À valider par vous, Par version,
  Publication App Store.

**Les 19 demandes d'un PDF de Gauthier Wilhelm** y sont versées, chacune avec sa
citation d'origine et sa section. **Deux étaient déjà livrées** et ont été
vérifiées dans le dépôt avant d'être marquées *Déjà fait* : l'agenda
(**3.130.0**, `5e7a3e1`) et la liste des inscrits (**3.128.0**, `93a78dc`).

**Trois relevés qui ne se voient pas à la lecture du PDF :**

- **Contradiction sur l'annulation** — le texte dit 12 h, l'image des tarifs
  dit 24 h. Bloquant pour l'abonnement du 1er octobre.
- **« Réserver plusieurs places sur un même compte »** remet en cause *une
  inscription = une personne*, et touche crédits, capacité, pointage, affichage
  des inscrits.
- **« Supprimer la vue liste »** suppose d'abord la parité du calendrier.

### 2. Le parrainage vérifié dans le code

Christian voulait s'assurer que la réduction est **ponctuelle** et non
récurrente sur un abonnement. **C'est déjà le cas** : le bon devient un coupon
Stripe `duration: 'once'` (`create-checkout-session/index.ts:403`) — première
facture réduite, prix récurrent intact. Le commentaire du code nomme le piège
évité : *baisser le Price rendrait la réduction permanente*.

> ⚠️ Cela dit ce que le code veut faire, **pas ce que Stripe fait**. Le contrôle
> reste le **test clock**, et les trois étapes à éprouver sont dans la fiche
> Notion. Le journal continue de noter le parrainage comme non testé de bout en
> bout.

### 3. Les coachs sont prévenus du changement de rythme

**Le courriel est parti le 2026-09-05 à 10:22** depuis `christian@aikicom.eu`.
Sa copie conforme est à la fin de `coachs-pourquoi-ca-va-moins-vite.md` — c'est
elle qui fait foi de ce que les coachs ont lu, non la version de travail qui la
précède.

Le message dit l'attrait de l'App Store, puis le prix : le temps (une à deux
semaines contre quelques minutes), le droit de refus d'Apple, la perte de
maîtrise sur la mise à jour, et **le travail que chaque publication ajoute**,
chiffré à une demi-journée. Il annonce le regroupement par lots et le tableau
Notion.

Christian a inséré les deux schémas **en images** : en caractères, ils ne
rendaient pas bien.

### 4. Les deux documentations

- **`guide-admin.md`** — une section « Les demandes des coachs — le tableau
  Notion » : le parcours, la règle des deux appuis, les colonnes de test, le
  suivi de publication, les lots, les quatre vues. **Recopiée dans `public/`.**
- **`documentation-developpeur.md`** — une section « Le suivi des demandes —
  hors du dépôt » : la frontière Notion/dépôt, le geste de double saisie à la
  mise en production, et **les pièges de l'API Notion**.

---

## Ce qui a été décidé

**Notion plutôt que Trello**, réexaminé en séance sur l'argument du Kanban.
Écarté : Notion a déjà la vue tableau, et Trello n'aurait pas les champs typés —
Custom Fields payants, pas de vues multiples par carte.

**Les étapes portent le vocabulaire de Christian** : *Proposé, Accepté, En
cours, Développé, En production*, plus *Déjà fait* et *Écarté*.

**Trois colonnes de test nominatives** (`Joan`, `Gauthier`, `Anselme`) portant
une date, plutôt qu'un couple `Testé par` / `Testé le`.

**Deux colonnes de statut mobile**, `iPhone` (sept valeurs) et `Android` (six).
Parce que « en production » ne veut pas dire « sur les téléphones », et parce
que **« Prête pour la publication » n'est pas « En ligne »** — ce qui a laissé
la 1.0 approuvée et invisible le 3 septembre.

**On publiera par lots.** Une publication coûte une demi-journée quel que soit
le nombre de modifications : elles partent groupées, et les lignes d'un lot
partagent le `Build iOS`. C'est un quatrième usage du tableau.

**Une seule base**, malgré la ressaisie du build sur chaque ligne.

---

## La prochaine action

**Partager le tableau aux coachs.** Christian veut qu'ils l'examinent dans leur
propre Notion. Trois voies lui ont été présentées ; **la décision n'est pas
prise** :

1. **Publier sur le web avec duplication autorisée** — un lien, ils dupliquent
   page et base chez eux. Le plus simple et le plus fidèle.
2. **Exporter en Markdown & CSV** — rien de publié, mais **les vues sont
   perdues**.
3. **Inviter en lecteur** — ils voient sans pouvoir emporter.

**Deux points à trancher avant de partager :**

- **Les tarifs du 1er octobre** sont détaillés dans une fiche de la base. Les
  publier sur le web les rendrait accessibles à qui a le lien, alors qu'ils ne
  sont pas encore publics. Les retirer de la version d'exemple ?
- **Ajouter un encadré « exemple »** en tête de page — une page dupliquée
  voyage sans le courriel qui l'accompagnait.

---

## Ce qui reste ouvert

- **La règle des deux appuis n'a pas été annoncée.** Le courriel du matin
  présente le tableau mais ne dit pas qu'une demande avance quand deux coachs
  la portent — c'est le cœur du dispositif. **À dire dans le message qui
  accompagnera le partage.**
- **Trois gestes manuels dans Notion**, qu'aucune API ne fait : réordonner les
  colonnes, supprimer les vues « À valider par vous » en double (garder celle
  filtrée sur *Développé* qui montre les trois colonnes de coachs), et éprouver
  le dispositif en faisant avancer une demande.
- **Au portage** : convertir `Appuyé par` en propriété **Personne**, ce qui
  suppose des comptes Notion pour les coachs.
- **Deux points à préciser avec Gauthier** : ce qu'il entendait par « le
  calendrier » — c'est l'agenda personnel qui a été livré — et si la photo de
  profil est toujours impossible (son constat datait de la 3.92).
- **Le délai d'annulation** : 12 h ou 24 h.
- **La migration des inscrits sur bot-ops** — appliquée sur bot3 seulement.
- **Le parrainage au test clock**, toujours pas fait.
- **Le repère d'une demi-journée par publication** est parti dans le courriel :
  il vaut désormais engagement vis-à-vis des coachs.

---

## Pièges rencontrés (pour la prochaine fois)

**L'API Notion ne sait pas tout faire.** Ces limites sont maintenant écrites
dans `documentation-developpeur.md` :

- `ALTER COLUMN` sur une sélection **vide la valeur des fiches** qui portaient
  l'ancien libellé. Une entrée a dû être reclassée à la main après le
  renommage des étapes.
- `create_view` **ne reconfigure pas** une vue : il en crée une seconde du même
  nom.
- Les colonnes s'ajoutent **toujours en fin de table**.
- Une multi-sélection **refuse une valeur** absente de ses options.
- **Notion réécrit le gras** : un `update_content` cherchant une chaîne exacte
  peut échouer sur un texte identique à l'œil. Relire avec `fetch` d'abord.

**Les schémas ASCII ne survivent pas au courriel.** Ils n'alignent qu'en chasse
fixe. Christian les a mis en images — c'est la seule voie fiable.

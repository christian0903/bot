# Questionnaire — Mise en place du système d'abonnement

> Document de cadrage à compléter avant développement.
> Objectif : trancher toutes les ambiguïtés métier pour éviter les retours en arrière coûteux.

---

## Présentation de la formule envisagée

Le studio passe d'un modèle **"pack de séances"** (achat à l'unité, consommation jusqu'à épuisement) à un modèle **"abonnement mensuel"** récurrent.

**Définition retenue :** un mois d'abonnement = **4 semaines** (et non un mois calendaire). Un abonnement souscrit le 5 mars court jusqu'au 1er avril (5 mars + 28 jours).

**Deux formules d'abonnement sont envisagées, qui peuvent coexister :**

### Formule A — Quota hebdomadaire
Le client choisit un rythme de fréquentation par semaine :
- 1 séance / semaine
- 2 séances / semaine
- 3 séances / semaine
- Illimité

Contrainte : impossible de cumuler plusieurs séances la même semaine au-delà du quota.

### Formule B — Quota mensuel (sur 4 semaines)
Le client choisit un volume total sur 4 semaines :
- 4 séances / mois
- 8 séances / mois
- 12 séances / mois
- Illimité

Pas de contrainte hebdomadaire — flexibilité totale dans la répartition.

**Les anciens packs à l'unité** (10 séances par exemple) restent disponibles ou sont retirés ? → voir question 7.1.

---

## Questions à trancher

### 1. Définition de la "semaine" (Formule A uniquement)

- [ ] **1.1** La semaine est-elle :
  - [ ] Calendaire fixe (lundi 00h00 → dimanche 23h59)
  - [ ] Glissante à partir de la date de souscription (jour J → J+6)
  - [ ] Glissante à partir de la dernière réservation
- [ ] **1.2** Si calendaire fixe : quel jour démarre la semaine ? (lundi, dimanche, autre)
- [ ] **1.3** Si un client souscrit un samedi avec "1 séance/semaine", peut-il réserver le samedi ET le lundi suivant ? (Oui si semaine calendaire, non si glissante.)

### 2. Cycle d'abonnement (mois = 4 semaines)

- [ ] **2.1** L'abonnement se renouvelle-t-il automatiquement à la fin des 4 semaines ?
- [ ] **2.2** Le client peut-il résilier à tout moment, ou doit-il attendre la fin de la période en cours ?
- [ ] **2.3** Y a-t-il un engagement minimum (3 mois, 6 mois) ou est-ce du mois en mois sans engagement ?
- [ ] **2.4** Si un client annule en cours de cycle, conserve-t-il ses droits jusqu'à la fin des 4 semaines payées ?
- [ ] **2.5** Le prélèvement / paiement se fait à quelle date ? (jour de souscription, début de mois calendaire, autre)

### 3. Séances non consommées

- [ ] **3.1** Si un client a "1 séance/semaine" et ne vient pas une semaine, sa séance est-elle :
  - [ ] Perdue (modèle Netflix)
  - [ ] Reportée sur la semaine suivante (cumul possible)
  - [ ] Reportée avec un plafond (ex. max 2 séances en réserve)
- [ ] **3.2** Même question pour la Formule B (quota mensuel) : les séances non consommées sont-elles perdues à la fin des 4 semaines, ou reportées sur le cycle suivant ?
- [ ] **3.3** Si report autorisé : les séances reportées ont-elles une date d'expiration ?

### 4. Annulation par le client

- [ ] **4.1** Existe-t-il un délai limite pour annuler une réservation sans pénalité ? (24h, 12h, 6h avant le cours)
- [ ] **4.2** Si annulation **dans les délais** : la séance est-elle recréditée au quota du client ?
- [ ] **4.3** Si annulation **hors délai** : la séance est-elle considérée comme consommée ?
- [ ] **4.4** Y a-t-il un nombre maximum d'annulations tardives tolérées par mois avant blocage ou avertissement ?
- [ ] **4.5** En cas d'absence non signalée (no-show), la séance est-elle systématiquement consommée ?

### 5. Annulation / report par les coaches (admin manuel)

- [ ] **5.1** Quand un coach annule un cours, l'admin doit pouvoir :
  - [ ] Recréditer automatiquement tous les participants inscrits
  - [ ] Proposer une session de remplacement à une date donnée
  - [ ] Les deux (à la discrétion de l'admin au cas par cas)
- [ ] **5.2** Une séance de "rattrapage" accordée par l'admin doit-elle :
  - [ ] S'ajouter au quota normal sans contrainte hebdomadaire (la personne pourrait donc faire 2 séances la même semaine avec un abonnement "1/sem")
  - [ ] Respecter quand même le quota hebdomadaire
- [ ] **5.3** Le rattrapage a-t-il une date limite d'utilisation ? (ex. dans les 4 semaines)
- [ ] **5.4** Faut-il tracer dans un historique "ces séances ont été offertes en compensation de l'annulation du cours X" ?

### 6. Réservation et fonctionnement

- [ ] **6.1** Jusqu'à quand à l'avance un client peut-il réserver ? (1 semaine, 2 semaines, illimité dans la durée de son abonnement)
- [ ] **6.2** Peut-il réserver des séances qui tombent **après la fin de son cycle** ? (Si son abonnement se termine le 1er avril, peut-il réserver une séance du 5 avril en partant du principe qu'il renouvellera ?)
- [ ] **6.3** Un client en abonnement illimité a-t-il une limite de réservations simultanées en attente ? (ex. max 5 séances réservées d'avance)
- [ ] **6.4** Y a-t-il des cours réservés à certaines formules (cours premium accessibles uniquement aux illimités, par exemple) ?
- [ ] **6.5** Liste d'attente : comment fonctionne-t-elle avec les abonnements ? Si une place se libère, le système réserve automatiquement et "consomme" le quota du client ?

### 7. Cohabitation avec l'ancien système (packs)

- [ ] **7.1** Les packs à l'unité (10 séances) restent-ils disponibles à la vente ou sont-ils supprimés ?
- [ ] **7.2** Un client peut-il avoir **simultanément** un abonnement ET un pack de séances ?
- [ ] **7.3** Si oui, dans quel ordre les séances sont-elles consommées ? (Priorité abonnement, puis pack en complément ? L'inverse ? Au choix du client ?)
- [ ] **7.4** Les clients actuels qui ont encore des séances en stock dans leur pack : leur stock est-il conservé tel quel ? Migration vers un abonnement proposée ? Date limite pour consommer ?

### 8. Modification de formule en cours d'abonnement

- [ ] **8.1** Un client peut-il **upgrader** sa formule (passer de "1/sem" à "2/sem") en cours de cycle ? Si oui :
  - Effet immédiat avec ajustement tarifaire au prorata ?
  - Effet au prochain cycle uniquement ?
- [ ] **8.2** Un client peut-il **downgrader** ? Quand l'effet s'applique-t-il ?
- [ ] **8.3** Un client peut-il **suspendre / mettre en pause** son abonnement (vacances, blessure) ? Combien de temps, combien de fois par an ?

### 9. Tarification

- [ ] **9.1** Le prix au mois est-il dégressif par rapport au pack à l'unité ? (Un abonnement "4 séances/mois" coûte-t-il moins cher que 4 séances achetées à l'unité ?)
- [ ] **9.2** Y a-t-il une réduction "engagement long" (3 mois payés d'avance, abonnement annuel) ?
- [ ] **9.3** Tarifs étudiants, seniors, couples, parrainage ?

### 10. Cas limites et règles à clarifier

- [ ] **10.1** Que se passe-t-il si un paiement mensuel échoue ? (Suspension immédiate, délai de grâce, annulation automatique au bout de X jours)
- [ ] **10.2** Un client peut-il offrir une séance de son abonnement à un proche ? (transfert)
- [ ] **10.3** Comment gérer les jours fériés où le studio est fermé ? Les séances dues sont-elles automatiquement recréditées ?
- [ ] **10.4** En cas de fermeture exceptionnelle du studio (force majeure, travaux), les cycles sont-ils prolongés ?

### 11. Reporting et vision admin

- [ ] **11.1** Quels indicateurs l'admin doit-il voir par client ? (Quota restant cette semaine / ce mois, date de prochain prélèvement, historique de consommation, taux de présence...)
- [ ] **11.2** Quels indicateurs globaux pour piloter le studio ? (Nombre d'abonnés actifs par formule, taux de remplissage des cours, taux de churn mensuel, séances "perdues" = payées non consommées...)

---

## Synthèse — décisions structurantes à valider en priorité

Trois décisions conditionnent toute l'architecture du code. Sans elles, impossible d'avancer :

1. **Semaine glissante ou calendaire ?** (Question 1.1)
2. **Séances non consommées : perdues ou reportées ?** (Question 3.1 et 3.2)
3. **Politique d'annulation client : délai limite et recrédit ?** (Questions 4.1, 4.2, 4.3)

Les autres questions peuvent être tranchées dans un second temps, mais elles devront l'être avant la mise en production.

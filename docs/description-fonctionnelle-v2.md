# Back On Track - Description fonctionnelle

**Version 2.0 - Avril 2026**
**Document destiné aux coaches pour validation**

> Ce document décrit ce que l'application fait et comment elle se comporte dans chaque situation.
> Lisez-le, annotez-le, et dites-nous si quelque chose ne correspond pas à votre façon de travailler.

---

## Table des matières

1. [Les utilisateurs et leurs droits](#1-les-utilisateurs-et-leurs-droits)
2. [Inscription et connexion](#2-inscription-et-connexion)
3. [Frais d'inscription et statut membre](#3-frais-dinscription-et-statut-membre)
4. [Séance d'essai](#4-séance-dessai)
5. [Acheter un pack de séances](#5-acheter-un-pack-de-séances)
6. [Le planning et la réservation](#6-le-planning-et-la-réservation)
7. [Règles de fermeture des réservations](#7-règles-de-fermeture-des-réservations)
8. [Annulation et pénalités](#8-annulation-et-pénalités)
9. [Liste d'attente](#9-liste-dattente)
10. [Personal Training](#10-personal-training)
11. [Check-in et présences](#11-check-in-et-présences)
12. [Parrainage](#12-parrainage)
13. [Notifications et rappels](#13-notifications-et-rappels)
14. [Demande de facture](#14-demande-de-facture)
15. [Statistiques du membre](#15-statistiques-du-membre)
16. [Abonnements récurrents](#16-abonnements-récurrents)
17. [Ce que voit le coach](#17-ce-que-voit-le-coach)
18. [Ce que voit l'admin](#18-ce-que-voit-ladmin)
19. [Paiement (Mollie)](#19-paiement-mollie)
20. [Codes promo](#20-codes-promo)

---

## 1. Les utilisateurs et leurs droits

L'application distingue 5 types d'utilisateurs :

| Qui | Ce qu'il peut faire |
|-----|---------------------|
| **Visiteur** | Voir le planning et les tarifs, s'inscrire, réserver une séance d'essai |
| **Membre** | Réserver / annuler des cours, acheter des packs, voir ses stats, parrainer |
| **Coach** | Voir son planning, pointer les présences, voir ses participants |
| **Admin** (les 3 associés) | Gérer les membres, le planning, les finances, les paramètres |
| **Super Admin** (Christian) | Tout ce que fait l'admin + configuration technique et serveurs |

### Cas pratique

> **Wilhelmi** est coach étudiant. Il ouvre l'app le matin et voit ses 3 cours du jour avec la liste des inscrits. Il peut cocher les présents au fur et à mesure qu'ils arrivent. Il ne peut PAS modifier le planning ni voir les finances.

> **Joan** est associé-coach. Il a le rôle Admin ET Coach. Il peut gérer le planning de tous les coachs, voir le chiffre d'affaires, ET pointer les présences de ses propres cours.

---

## 2. Inscription et connexion

### Créer un compte

Pour s'inscrire, le nouveau membre doit renseigner :

**Obligatoire :**
- Prénom, nom
- Email
- Téléphone
- Date de naissance
- Adresse
- Mot de passe (minimum 12 caractères)
- Accepter les CGV (case à cocher)
- Accepter la politique RGPD (case à cocher séparée)

**Optionnel :**
- Photo de profil
- Contact d'urgence (nom + téléphone)
- Objectifs personnels
- Niveau de forme
- Conditions médicales
- Code de parrainage

L'inscription est confirmée par un email de vérification (clic sur un lien).

### Se connecter

- Email + mot de passe
- Option "Rester connecté"
- Mot de passe oublié : un lien de réinitialisation est envoyé par email
- Sur mobile : possibilité d'utiliser Face ID ou l'empreinte digitale après la première connexion

### Cas pratique

> **Sophie** s'inscrit sur son téléphone. Elle remplit ses infos, coche les CGV et le RGPD, et entre le code parrainage "INGRID2026" que son amie Ingrid lui a donné. Elle reçoit un email pour confirmer son compte. Après confirmation, elle peut se connecter mais ne peut pas encore réserver de cours semi-privés — il faut d'abord payer les frais d'inscription.

---

## 3. Frais d'inscription et statut membre

### La règle

Avant de pouvoir acheter un pack de cours semi-privés ou de Personal Training, un nouveau membre doit payer ses **frais d'inscription de 30 EUR**. Ces frais sont considérés comme un pack (ils apparaissent dans l'historique d'achats).

### Les statuts

Chaque membre a un statut qui évolue automatiquement :

| Statut | Signification |
|--------|---------------|
| **Visiteur** | Pas encore inscrit ou inscrit mais pas de frais payés |
| **Membre potentiel** | Inscrit, frais non payés |
| **Membre actif** | A un pack ou abonnement en cours |
| **Membre inactif** | Pack expiré depuis moins de 6 semaines |
| **Ancien membre** | Inactif depuis plus de 3 mois — doit repayer les frais d'inscription |

### Cas pratique

> **Lucas** s'inscrit en janvier et paie ses 30 EUR de frais d'inscription. Il achète un pack de 10 séances. Il est "Membre actif". Son pack expire fin mars et il ne rachète pas. En avril, il passe "Membre inactif". En juillet (3 mois plus tard), il passe "Ancien membre". S'il veut revenir, il devra repayer les 30 EUR de frais d'inscription.

> **Amina** vient pour la première fois. Elle fait sa séance d'essai gratuite (pas besoin de frais d'inscription pour ça). Si elle veut continuer et acheter un pack, elle devra alors payer les frais d'inscription.

---

## 4. Séance d'essai

### La règle

Toute personne peut bénéficier d'**une seule séance d'essai gratuite**. Pas besoin de payer les frais d'inscription ni d'avoir un pack.

### Fonctionnement

1. Le visiteur s'inscrit (compte gratuit)
2. Sur le planning, il voit un bouton "Séance d'essai gratuite"
3. Il réserve un créneau disponible
4. Après sa séance, le bouton disparait — il ne peut plus en faire

### Cas pratique

> **Thomas** veut tester la salle. Il crée un compte, et réserve le cours de CrossTraining de jeudi 18h comme séance d'essai. Il vient, il aime. Le vendredi, il ne voit plus le bouton "Séance d'essai" — il doit maintenant payer ses frais d'inscription et acheter un pack pour continuer.

> **Thomas** essaie de se créer un deuxième compte avec un autre email pour avoir une deuxième séance gratuite. L'admin peut le détecter (même nom, même téléphone) et bloquer le compte.

---

## 5. Acheter un pack de séances

### Les packs disponibles — Cours semi-privés

| Pack | Validité | Prix |
|------|----------|------|
| 3 séances | 4 semaines | 69 EUR |
| 10 séances | 3 mois | 199 EUR |
| 20 séances | 3 mois | 299 EUR |
| 20 séances | 5 mois | 359 EUR |

### Les packs disponibles — Personal Training

| Pack | Prix / séance | Prix total |
|------|--------------|------------|
| 1 séance | 75 EUR | 75 EUR |
| 5 séances | 70 EUR | 350 EUR |
| 10 séances | 65 EUR | 650 EUR |
| 20 séances | 60 EUR | 1 200 EUR |

### Fonctionnement

- Le membre choisit un pack et paye via Mollie (Bancontact, carte bancaire, Apple Pay, Google Pay)
- Les crédits sont ajoutés immédiatement à son compte
- Les crédits semi-privés ne peuvent être utilisés que pour des cours semi-privés
- Les crédits PT ne peuvent être utilisés que pour du Personal Training
- Un pack a une date d'expiration : passé ce délai, les crédits restants sont perdus

### Cas pratique

> **Ingrid** achète un pack de 10 séances (199 EUR, valable 3 mois). Elle paye par Bancontact. Ses 10 crédits apparaissent immédiatement dans l'app. Elle a jusqu'au 19 juillet pour les utiliser. Si le 19 juillet il lui reste 3 crédits, ils sont perdus.

> **Ingrid** a aussi un pack PT de 5 séances. Elle ne peut PAS utiliser un crédit PT pour un cours semi-privé, et vice versa.

---

## 6. Le planning et la réservation

### Ce que le membre voit

- **Vue jour** (par défaut) : tous les cours du jour sélectionné
- **Vue semaine** : vue d'ensemble de la semaine
- **Vue liste** : liste chronologique

Pour chaque créneau :
- Nom du cours (ex: CrossTraining, Boxing, Posture...)
- Coach
- Heure et durée
- Étage (haut ou bas)
- Places disponibles (ex: "2/4")
- **Code couleur** par type de cours
- Visuel clair : complet = grisé, places dispo = couleur vive, ma réservation = surbrillance

Le membre peut **filtrer** par type de cours et par coach.

**Si 2 cours ont lieu en même temps** (un en haut, un en bas), les 2 sont affichés côte à côte.

### Réserver un cours

1. Le membre clique sur un créneau disponible
2. Un récapitulatif s'affiche : cours, coach, date/heure, étage, durée, places restantes
3. L'app vérifie automatiquement :
   - Le membre a des crédits du bon type (semi-privé ou PT)
   - Le membre n'est pas déjà inscrit à ce cours
   - Le membre n'est pas bloqué/suspendu
   - Le cours n'est pas fermé aux réservations (voir règles ci-dessous)
4. Confirmation en 1 clic : 1 crédit est déduit
5. Le membre reçoit une confirmation (dans l'app + par email)
6. Option : ajouter le cours à son calendrier (fichier .ics)

### Règle des 5 participants (exception)

Normalement, un cours accueille maximum 4 personnes. **Exception** : si le coach le souhaite ET que la salle de l'étage du haut n'est pas utilisée au même moment, il peut accepter jusqu'à 5 participants.

### Cas pratique

> **Anouck** ouvre l'app mardi matin. Elle voit la vue jour avec 3 cours : CrossTraining 8h30 (Wilhelmi, bas, 3/4), BackOnTrack 12h (Joan, haut, 1/4), Boxing 18h (Anassim, bas, 4/4 COMPLET). Elle filtre sur "CrossTraining" pour ne voir que ce type de cours. Elle clique sur le créneau de 8h30, voit le récap, confirme. Son crédit est déduit (il lui en reste 7). Elle reçoit un email de confirmation.

> **Wilhelmi** donne un cours à 8h30 en bas. Il y a déjà 4 inscrits. Personne n'utilise la salle du haut à 8h30. Il décide d'accepter un 5e participant. L'admin a configuré le cours pour permettre 5 places dans ce cas.

---

## 7. Règles de fermeture des réservations

C'est une règle importante et spécifique à Back On Track.

### Cours du matin (ex: 8h)

La réservation ferme **la veille à 20h**.

Après 20h la veille, on ne peut plus s'inscrire au cours du lendemain matin.

### Cours de l'après-midi / soir (ex: 18h)

- **S'il n'y a aucun inscrit** : réservation possible jusqu'à **3h avant** le cours
- **S'il y a déjà au moins 1 inscrit** : réservation possible jusqu'à **30 minutes avant** le cours

### Configurabilité

L'admin peut modifier ces délais depuis le back-office (heure de fermeture pour le matin, nombre d'heures avant pour l'après-midi, etc.)

### Cas pratique

> Lundi soir 20h15, **Sophie** veut réserver le cours de CrossTraining de mardi 8h. C'est trop tard — la réservation a fermé à 20h. Elle devra venir au cours de l'après-midi.

> Mardi 14h, **Sophie** veut réserver le Boxing de 18h. Personne n'est inscrit. Elle peut encore s'inscrire (18h - 3h = OK jusqu'à 15h). A 15h01, si toujours personne n'est inscrit, le créneau se ferme.

> Mardi 14h, **Lucas** veut réserver le BackOnTrack de 18h. Il y a déjà 2 inscrits. Il peut s'inscrire jusqu'à 17h30 (30 min avant).

---

## 8. Annulation et pénalités

### Annulation gratuite

Si le membre annule **plus de 12 heures avant** le cours : annulation gratuite, le crédit est restitué.

### Annulation tardive

Si le membre annule **moins de 12 heures avant** le cours : le crédit est **perdu** (non restitué). C'est comme s'il avait fait la séance.

### No-show (absence)

Si le membre est inscrit mais ne vient pas au cours : **même pénalité** qu'une annulation tardive. Le crédit est perdu.

### Délai configurable

L'admin peut modifier le délai de 12 heures (par exemple le passer à 6h ou 24h).

### Rappels automatiques

Pour éviter les oublis, l'app envoie des rappels :
- **24 heures avant** le cours (notification push)
- **2 heures avant** le cours (notification push)

### Cas pratique

> **Ingrid** est inscrite au cours de jeudi 18h. Mercredi soir à 22h (20h avant le cours), elle se rend compte qu'elle ne pourra pas venir. Elle annule dans l'app. C'est plus de 12h avant : son crédit est restitué. Tout va bien.

> **Lucas** est inscrit au cours de vendredi 8h. Vendredi matin à 7h (1h avant), il a un empêchement. Il annule dans l'app. C'est moins de 12h avant : son crédit est perdu. Il reçoit un message "Annulation tardive — crédit non restitué".

> **Anouck** est inscrite au cours de samedi 10h mais elle oublie de venir. 15 minutes après le début du cours, le coach la marque absente (ou le système le fait automatiquement). Son crédit est perdu. Elle reçoit une notification "Vous avez été marquée absente".

---

## 9. Liste d'attente

### Quand un cours est complet

Si les 4 places sont prises, le bouton "Réserver" est remplacé par "Rejoindre la liste d'attente".

### Fonctionnement

1. Le membre rejoint la liste d'attente (il voit sa position : 1er, 2e, etc.)
2. Si quelqu'un annule, **tous les inscrits sur la liste d'attente** reçoivent une notification
3. **Premier arrivé, premier servi** : le premier à cliquer sur "Confirmer" obtient la place
4. Il a **2 heures** pour confirmer, sinon l'offre expire
5. Le membre peut se retirer de la liste d'attente à tout moment

### Important

Rejoindre la liste d'attente ne consomme **aucun crédit**. Le crédit n'est déduit que quand la place est confirmée.

### Cas pratique

> Le cours de Boxing vendredi 18h est complet (4/4). **Sophie** rejoint la liste d'attente en position 1, **Thomas** en position 2. Jeudi soir, **Lucas** annule sa place. Sophie et Thomas reçoivent tous les deux une notification "Une place s'est libérée !". Sophie clique immédiatement sur "Confirmer" : elle obtient la place, 1 crédit est déduit. Thomas voit que la place est partie.

> **Sophie** est en liste d'attente mais change d'avis. Elle appuie sur "Se retirer" et quitte la liste. Pas de pénalité.

---

## 10. Personal Training

### Section séparée

Le Personal Training a sa propre section dans l'app, séparée du planning des cours semi-privés.

### Choisir un coach

Le membre voit la liste des coachs avec :
- Photo
- Spécialités (ex: musculation, remise en forme, perte de poids)
- Bio / présentation
- Disponibilités

### Réserver une séance PT

1. Le membre choisit un coach
2. Il voit les créneaux disponibles du coach
3. Il réserve un créneau (1 crédit PT est déduit)
4. La séance apparait dans le planning du membre ET dans l'agenda du coach

### Annulation PT

La politique d'annulation PT est configurable séparément des cours semi-privés (peut être plus stricte, ex: 24h au lieu de 12h).

### Cas pratique

> **Simona** veut faire du PT avec Anassim. Elle va dans la section "Personal Training", clique sur le profil d'Anassim, voit qu'il est dispo mercredi 14h et vendredi 10h. Elle réserve mercredi 14h. 1 crédit PT est déduit (il lui en reste 4). Anassim voit la séance apparaitre dans son agenda.

> **Simona** veut annuler sa séance PT de mercredi. La politique PT est de 24h avant. On est mardi 15h (23h avant). C'est trop tard : si elle annule, son crédit PT est perdu.

---

## 11. Check-in et présences

### Pour le coach / admin

Quand un cours commence, le coach ouvre la vue "Présences" de son cours. Il voit la liste des inscrits et peut :
- **Cocher** chaque participant présent
- **Scanner un QR code** : chaque membre a un QR code unique dans son profil. Le coach le scanne avec son téléphone.

### No-show automatique

**15 minutes après le début du cours**, tous les inscrits qui n'ont pas été pointés comme présents sont automatiquement marqués "Absent" (no-show). Leur crédit est perdu.

### Historique

Les présences sont enregistrées dans la fiche du membre (visible par l'admin et le coach).

### Cas pratique

> **Wilhelmi** donne le cours de 8h30. 4 personnes sont inscrites. Ingrid et Anouck arrivent : Wilhelmi scanne leur QR code ou coche leur nom. A 8h45, Lucas et Sophie ne sont toujours pas là. Le système les marque automatiquement absents. Leur crédit est perdu.

> **Joan** (admin) ouvre la fiche d'**Anouck**. Il voit qu'elle a assisté à 18 cours sur les 20 réservés ce mois-ci, avec 2 no-shows. Son taux de présence est de 90%.

---

## 12. Parrainage

### Le principe

Chaque membre a un **code de parrainage unique** (ex: "INGRID2026"). Il peut le personnaliser. Il peut le partager par lien, WhatsApp, SMS, email, ou simplement le copier-coller.

### Conditions pour déclencher la récompense

Le filleul (la personne parrainée) doit :
1. Avoir payé ses **frais d'inscription** (30 EUR)
2. Avoir acheté au minimum un **pack de 10 séances**

Quand ces 2 conditions sont remplies, la récompense est déclenchée.

### Récompenses

- Le **parrain** reçoit **30 EUR de réduction** sur son prochain achat de pack
- Le **filleul** reçoit **30 EUR de réduction** sur son prochain achat (pas le premier)

### Tableau de suivi

Le parrain voit dans l'app :
- La liste de ses filleuls
- Le statut de chacun (en attente, qualifié, récompensé)
- Ses récompenses gagnées

### Configuration admin

L'admin peut modifier :
- Les montants des récompenses
- Le nombre minimum de séances pour qualifier
- Un plafond par parrain (ex: max 5 parrainages)
- La durée de validité des récompenses

### Cas pratique

> **Ingrid** partage son code "INGRID2026" à son amie Sophie via WhatsApp. Sophie s'inscrit avec le code, paie ses frais d'inscription (30 EUR), puis achète un pack de 10 séances (199 EUR). Les 2 conditions sont remplies. Ingrid reçoit une notification "Sophie a validé son parrainage ! 30 EUR de réduction sur votre prochain achat". Quand Sophie achètera son 2e pack, elle aura aussi 30 EUR de réduction.

> **Ingrid** a déjà parrainé 5 personnes. L'admin a configuré un plafond à 5. Le code d'Ingrid ne fonctionne plus pour de nouveaux filleuls.

---

## 13. Notifications et rappels

### Ce que le membre reçoit

| Événement | Notification push | Email |
|-----------|:-:|:-:|
| Réservation confirmée | Oui | Oui |
| Rappel de cours (24h avant) | Oui | - |
| Rappel de cours (2h avant) | Oui | - |
| Annulation confirmée | Oui | Oui |
| Place libérée (liste d'attente) | Oui | Oui |
| Carte bientôt vide (2 crédits restants) | Oui | - |
| Carte expirée | Oui | Oui |
| Renouvellement d'abonnement à venir | - | Oui |
| Échec de paiement | Oui | Oui |
| Nouveau filleul inscrit | Oui | - |
| Récompense parrainage débloquée | Oui | Oui |
| Message du coach / de la salle | Oui | - |
| Nouveau cours ajouté au planning | Oui | - |

### Préférences

Le membre peut choisir quelles notifications il souhaite recevoir dans ses paramètres.

### Messages automatiques

L'app envoie automatiquement :
- **Bienvenue** : à l'inscription
- **Anniversaire** : le jour de l'anniversaire du membre
- **Relance inactivité** : si le membre n'a pas réservé depuis 2 semaines
- **Félicitations** : quand le membre atteint un palier (10e séance, 50e séance, etc.)

### Cas pratique

> **Lucas** réserve le cours de mardi 18h. Il reçoit immédiatement une notification "Réservation confirmée - Boxing mardi 18h avec Anassim". Lundi à 18h (24h avant), il reçoit "Rappel : Boxing demain 18h". Mardi à 16h (2h avant), il reçoit "N'oublie pas : Boxing dans 2h !".

> **Sophie** n'a plus que 2 crédits. Après sa prochaine réservation, elle reçoit "Il te reste 2 crédits. Pense à recharger !".

---

## 14. Demande de facture

### Le principe

L'app ne génère pas de factures (la comptabilité est gérée dans Odoo). Mais le membre peut **demander une facture** à tout moment.

### Fonctionnement

1. Le membre va dans son profil > "Demander une facture"
2. Il remplit un formulaire :
   - Nom ou raison sociale
   - Adresse complète
   - Numéro d'entreprise (optionnel, pour les indépendants/sociétés)
   - Pack ou paiement concerné (sélection dans la liste)
3. La demande arrive dans le back-office admin
4. L'admin traite la demande dans Odoo et la marque comme "traitée"

### Demandes B2B

Pour toute facturation professionnelle (société, indépendant), le processus ne passe pas par l'app. Un message redirige vers le contact de la salle.

### Cas pratique

> **Simona** est indépendante et veut déduire ses séances PT. Elle va dans "Demander une facture", entre "Simona Costamagna - Consultante", son adresse, et son numéro d'entreprise BE0xxx.xxx.xxx. Elle sélectionne son achat PT de 650 EUR. Joan reçoit la demande dans le back-office, crée la facture dans Odoo, et marque la demande comme traitée. Simona n'a rien d'autre à faire.

---

## 15. Statistiques du membre

### Ce que le membre voit

Dans sa section "Mes stats" :

- **Séances effectuées** : total + par période (semaine, mois, année)
- **Répartition par type de cours** : graphique visuel (ex: 60% CrossTraining, 25% Boxing, 15% Posture)
- **Fréquence** : nombre de séances par semaine et par mois
- **Streak** : nombre de semaines consécutives avec au moins 1 séance
- **Calendrier coloré** : les jours d'entraînement sont mis en couleur
- **Objectif personnel** : le membre se fixe un objectif (ex: 3 séances/semaine) et voit sa barre de progression
- **Badges** : récompenses visuelles pour les paliers (10e séance, 50e séance, 100e séance, etc.)

### Cas pratique

> **Anouck** ouvre ses stats. Elle voit qu'elle a fait 47 séances depuis le début. Son streak est à 8 semaines consécutives. Son objectif est de 3 séances/semaine et elle en a fait 2 cette semaine — la barre est à 66%. Elle a débloqué le badge "10 séances" et "25 séances", il lui manque 3 séances pour le badge "50 séances".

> **Ingrid** regarde son calendrier du mois. Les jours verts sont les jours où elle s'est entraînée. Elle voit qu'elle a surtout fait du CrossTraining (70%) et veut diversifier.

---

## 16. Abonnements récurrents

> **Note : les montants ne sont pas encore fixés. Ce qui suit décrit le fonctionnement prévu.**

### Le principe

En plus des packs (achat ponctuel), le membre peut souscrire un **abonnement mensuel** qui se renouvelle automatiquement.

### Formules prévues

| Formule | Prix / mois (indicatif) |
|---------|------------------------|
| 1 séance / semaine | 89 EUR |
| 2 séances / semaine | 129 EUR |
| 3 séances / semaine | 189 EUR |
| 4 séances / semaine | 219 EUR |

### Fonctionnement

- Renouvellement automatique toutes les 4 semaines
- Paiement automatique via Mollie
- Email envoyé 7 jours avant le renouvellement
- En cas d'échec de paiement : relance automatique à J+3, puis J+7, puis suspension
- Le membre peut annuler son abonnement à tout moment (effectif à la fin de la période en cours)

### Combiner pack et abonnement

Si un membre veut faire 5-6 séances dans la semaine, il peut combiner un abonnement avec une carte de séances supplémentaire.

### Cas pratique

> **Lucas** souscrit à l'abonnement "3 séances/semaine" à 189 EUR/mois. Chaque mois, le paiement est prélevé automatiquement. La semaine 3, il veut faire une 4e séance : il peut acheter un pack de 3 séances en complément.

> Le paiement de **Lucas** échoue le 1er du mois. Le système réessaye à J+3 : toujours en échec. A J+7 : même chose. Son abonnement est suspendu. Il reçoit un email "Votre abonnement est suspendu — veuillez mettre à jour votre moyen de paiement".

---

## 17. Ce que voit le coach

### Son planning

- Liste de ses cours du jour / de la semaine
- Pour chaque cours : heure, type, étage, nombre d'inscrits, liste des participants

### Pointer les présences

- Vue dédiée avec la liste des inscrits et des cases à cocher
- Scanner le QR code d'un membre
- Voir qui est marqué absent (no-show)

### Personal Training

- Voir ses séances PT réservées
- Voir ses disponibilités configurées

### Ce que le coach ne peut PAS faire

- Modifier le planning global (seulement l'admin)
- Voir les finances ou le chiffre d'affaires
- Gérer les comptes des membres
- Modifier les tarifs

### Cas pratique

> **Anassim** ouvre l'app à 7h. Il voit ses 2 cours du jour : CrossTraining 8h30 (3 inscrits) et Boxing 18h (4 inscrits, complet). Il clique sur le cours de 8h30, voit la liste : Ingrid, Lucas, Anouck. Quand ils arrivent, il scanne leur QR code. A 8h45, le système marque les absents.

> **Anassim** a aussi une séance PT à 14h avec Simona. Ça apparait dans son agenda entre les deux cours collectifs.

---

## 18. Ce que voit l'admin

### Dashboard (page d'accueil admin)

Vue d'ensemble avec :
- Membres actifs / inactifs / nouveaux ce mois
- Taux de remplissage des cours (aujourd'hui + semaine)
- Chiffre d'affaires HTVA du mois (cartes, abos, PT)
- Graphique d'évolution (membres, CA, séances)
- Cours du jour : remplissage + liste des inscrits
- Activité récente (inscriptions, réservations, paiements)
- Boutons rapides pour ajouter des cours

### Gestion des membres

- Recherche par nom, email, téléphone
- Filtres : statut, type de forfait, date d'inscription, dernier check-in
- Fiche membre complète : infos, statut, forfait, solde crédits, historique réservations + paiements, notes privées (conditions médicales, remarques), parrainages, statistiques
- Actions : ajouter/retirer des séances, activer/désactiver/suspendre un compte, prolonger un pack, envoyer un message, exporter la fiche en PDF
- Export CSV/Excel de la liste des membres
- Vue "à relancer" : cartes expirées, inactifs depuis X semaines

### Gestion du planning

- Créer un cours : nom, type, coach, étage, capacité (défaut 4), durée, description, couleur
- Semaine type récurrente (dupliquer pour les semaines suivantes)
- Modifier/annuler un créneau sans casser la récurrence
- Créneaux exceptionnels (stages, événements)
- Bloquer des créneaux (vacances, fermeture) avec message
- Vue détaillée : inscrits, liste d'attente, no-shows par créneau
- Remplacement de coach avec notification aux inscrits

### Gestion des coachs

- Fiche coach : nom, photo, spécialités, bio, disponibilités
- Attribution des cours
- Stats par coach (séances données, taux de remplissage)

### Finances

- CA du jour / semaine / mois / année
- Répartition par produit (cartes, abos, PT)
- Graphiques d'évolution + comparaison avec l'année précédente
- Liste des transactions avec filtres
- Suivi des paiements échoués + relances
- Export CSV pour Odoo
- Gestion des codes promo

### Communication

- Envoyer un message push et/ou email à :
  - Tous les membres
  - Un segment (actifs, inactifs, inscrits à un cours...)
  - Un membre individuel
- Bannière d'annonce sur le dashboard client
- Messages automatiques configurables (bienvenue, anniversaire, relance, félicitations)

### Paramètres

- Infos de la salle (nom, adresse, tél, email, logo, n° TVA)
- Horaires d'ouverture
- Types de cours (ajouter, modifier, désactiver)
- Tarifs (modifiables — les clients existants gardent leur tarif)
- Règles d'annulation (délai, pénalité)
- Règles de parrainage (montants, paliers, plafond)
- Règles de liste d'attente
- Templates d'emails personnalisables
- CGV modifiables

### Cas pratique

> **Joan** ouvre le dashboard admin lundi matin. Il voit que 3 nouveaux membres se sont inscrits cette semaine, le taux de remplissage est de 75%, et le CA du mois est de 4 200 EUR. Le cours de 8h30 a 3/4 inscrits. Il crée un nouveau cours "Ladies" pour vendredi 10h avec Wilhelmi, étage haut, 4 places.

> **Joan** va dans "Membres" et filtre sur "carte expirée". Il voit qu'Anouck n'a plus de crédits depuis 10 jours. Il lui envoie un message push : "Anouck, ton pack est terminé ! Recharge tes crédits pour continuer à t'entraîner".

> **Joan** remplace Wilhelmi (malade) par Anassim pour le cours de mercredi 18h. Les 3 inscrits reçoivent une notification : "Changement de coach : votre cours de mercredi 18h sera donné par Anassim".

---

## 19. Paiement (Mollie)

### Moyens de paiement acceptés

- **Bancontact** (obligatoire — majorité de clients belges)
- Visa / Mastercard
- Apple Pay
- Google Pay

### Processus

1. Le membre choisit un pack
2. Il est redirigé vers la page de paiement sécurisée Mollie
3. Il choisit son moyen de paiement et confirme
4. Retour automatique dans l'app avec confirmation
5. Aucune donnée de carte n'est stockée dans l'app (conformité PCI-DSS via Mollie)

### Abonnements

Pour les abonnements récurrents, Mollie gère le prélèvement automatique (mandat SEPA ou carte enregistrée chez Mollie).

---

## 20. Codes promo

### Fonctionnement

L'admin peut créer des codes promo avec :
- Un code texte (ex: "SUMMER2026")
- Une réduction en pourcentage (ex: -20%) OU un montant fixe (ex: -30 EUR)
- Une date de début et de fin de validité
- Un nombre maximum d'utilisations
- Usage unique ou multiple par personne
- Applicable à un produit spécifique ou à tous

### Cas pratique

> **Joan** crée le code "RENTRÉE" : -15% sur tous les packs, valable du 1er au 30 septembre, max 50 utilisations. **Sophie** achète un pack de 10 séances (199 EUR) avec le code. Elle paie 169,15 EUR. Le compteur passe à 1/50 utilisations.

---

## Résumé des questions pour les coaches

Avant de commencer le développement, merci de valider les points suivants :

1. **Règles de fermeture** : Cours du matin fermé à 20h la veille, cours de l'après-midi 3h avant (ou 30 min si déjà des inscrits). Ça correspond bien à votre fonctionnement actuel ?

2. **Annulation 12h** : La pénalité (crédit perdu) à moins de 12 heures, c'est le bon délai ? Pas 6h ou 24h ?

3. **No-show auto 15 min** : On marque automatiquement absent après 15 minutes. C'est suffisant ? Trop tôt ?

4. **5 participants exception** : La règle "5 si l'autre salle est libre" est-elle bien comprise ? Qui décide : le coach ou l'admin ?

5. **Personal Training** : La politique d'annulation PT doit-elle être différente (ex: 24h au lieu de 12h) ?

6. **Parrainage 30 EUR** : Les montants et conditions vous conviennent ?

7. **Abonnements** : Les formules 1-4 séances/semaine sont-elles confirmées ? Les prix ?

8. **Autre chose** qui manque ou qui ne correspond pas à votre réalité quotidienne ?

# Guide coach & administrateur

Administration du studio. Pour l'usage courant de l'application — réserver, acheter un pack, gérer son profil — voir le **guide du membre**.

---

## Qui peut faire quoi

| | Coach | Admin |
|---|:---:|:---:|
| Voir ses cours, les participants, pointer les présences | ✅ | ✅ |
| **Inscrire un membre à un de ses cours** | ✅ | ✅ |
| Retirer un membre d'un cours | ✅ | ✅ |
| **Annuler un de ses cours** | ✅ | ✅ |
| Modifier le nombre de places de ses cours | ✅ | ✅ |
| Suivre les performances des membres | ✅ | ✅ |
| Accéder à l'espace Administration | — | ✅ |
| Gérer les membres, leurs packs, leurs abonnements | — | ✅ |
| Créer cours, packs, abonnements, réglages | — | ✅ |
| **Désigner un coach** | — | ✅ |
| **Désigner un admin ou un super admin** | — | super admin |
| Tableau de bord financier et exports | — | ✅ |
| Gestes commerciaux (remises, bons, reports) | — | ✅ |

Un coach n'agit que sur **ses propres cours** : il ne peut ni inscrire ni annuler dans le cours d'un collègue.

Un coach qui n'est pas admin ne voit pas le menu Administration. S'il tente d'y accéder, il est renvoyé à l'accueil.

Le **super admin** a tous les droits d'un admin, plus la configuration technique (mode Stripe, changement de mot de passe d'un membre).

---

## Au quotidien

### Le planning — Administration → Planning

C'est l'écran le plus utilisé. Chaque cours peut être ouvert pour :

- **assigner ou changer le coach**
- **modifier l'horaire, la durée, la salle** (haut ou bas)
- **changer le nombre de places**
- **voir et gérer les inscrits**

**Créer une série de cours.** Le formulaire propose de **répéter pour X semaines** : le cours est dupliqué à l'identique. Pour dupliquer autrement, le bouton **Dupliquer…** permet de choisir un décalage en jours.

**Modifier une série.** Quand un cours fait partie d'une série, l'application demande si le changement vaut pour **ce cours uniquement** ou pour toute la suite. Vérifiez ce choix : c'est l'erreur la plus fréquente.

**Modifier un cours qui a des inscrits.** Les membres sont prévenus, et le message **nomme ce qui change** : coach, salle, horaire, durée.

Si vous changez **l'horaire ou le type de cours**, un avertissement s'affiche avant d'enregistrer : ces personnes s'étaient inscrites à autre chose. Elles reçoivent alors une proposition explicite d'annuler **avec restitution de leur crédit**, quel que soit le délai — elles subissent votre décision, elles ne l'ont pas prise.

Changer le coach ou la salle ne déclenche pas cette proposition : le cours a lieu au même moment.

**Annuler un cours.** Utilisez toujours l'annulation depuis l'écran plutôt que la suppression : les inscrits sont prévenus et **leurs crédits leur sont rendus quoi qu'il arrive**, même en dessous du délai normal — ce n'est pas eux qui annulent.

**Cours sous le seuil.** Un bandeau signale les cours qui n'atteignent pas le minimum de participants. Le studio décide : annuler et rembourser, ou maintenir. Rien n'est automatique.

**Cours passés sans décision.** Un second bandeau signale les cours passés où des gens étaient inscrits sans que personne ait dit si le cours avait eu lieu. Deux issues, pas d'autre : pointer les présences, ou annuler pour rendre les crédits. Ne pas trancher laisse des membres avec un crédit consommé pour rien.

**Naviguer dans le temps.** Les flèches de part et d'autre des dates décalent la période d'une longueur équivalente. Un bouton « Aujourd'hui » ramène au présent. La période reste en mémoire quand vous ouvrez un cours puis revenez.

### Lire le statut d'un cours

Chaque cours porte un badge qui dit où il en est :

| Badge | Signification |
|---|---|
| *(rien)* | Cours à venir, rien à signaler |
| **Effectif à surveiller** | À venir, effectif faible, échéance proche |
| **Exécuté** *(vert)* | Passé, **présences pointées** — c'est établi |
| **Présences à valider** *(orange)* | Passé, effectif suffisant, mais rien de pointé |
| **Décision attendue** *(rouge)* | Passé, des inscrits sous le seuil, rien de pointé — **à traiter** |
| **Sans inscrit** *(gris)* | Passé, personne inscrit — rien à faire |
| **Annulé** | Décision du studio |

> **« Exécuté » exige le pointage.** Sans lui, personne ne sait si le cours a eu lieu : le badge reste orange. C'est ce qui permet de repérer les coachs qui ne pointent pas.

> **« Décision attendue » est le seul badge rouge.** Des membres ont consommé un crédit sans qu'on sache s'ils ont eu leur cours. C'est la seule situation qui exige une intervention.

### Inscrire ou désinscrire quelqu'un

Depuis le planning (admin) ou depuis la fiche du cours (coach), ouvrez le cours et ajoutez le membre. L'application demande **quelle source de crédit utiliser** : abonnement ou pack. Elle affiche pour chacun ce qu'il reste et sa date d'expiration.

> **Le type de crédit doit correspondre.** Un crédit personal training ne paie pas un cours semi-privé. Seules les sources compatibles apparaissent dans la liste.

**L'inscription par le staff ignore le délai de fermeture.** C'est son intérêt : quelqu'un se présente à la dernière minute, il reste de la place, vous décidez. Seule la capacité de la salle fait barrage. Vous pouvez aussi inscrire quelqu'un **après** le cours, pour régulariser une personne venue sans être inscrite.

Le membre est prévenu par notification et par e-mail, à l'inscription comme au retrait.

**Retirer quelqu'un rend toujours son crédit** — le retrait vient du studio, pas de lui, donc le délai de prévenance ne s'applique pas.

### Check-in et absences

Dans **Mes cours** (coach) ou depuis le planning, pointez les présents. Un membre qui n'est pas venu se marque en **absent** — à la main : il n'y a pas de marquage automatique aujourd'hui.

Ces données alimentent le taux de présence et les statistiques d'annulation.

---

## L'espace coach

Un coach y trouve ses cours et ses chiffres.

**Un admin y accède aussi**, par le lien **Coach** du menu principal — au même titre qu'un coach simple. Il y voit les cours dont **il est lui-même le coach**, pas ceux de toute l'équipe : pour la vue d'ensemble, c'est Administration → Planning. Utile quand on cumule les deux casquettes et qu'on donne des cours.

**Ses chiffres, sur 30 jours** : cours donnés sur planifiés (avec le détail des cours sans inscrit et annulés), participants venus, et deux taux distincts — **remplissage** (inscrits sur places) et, entre parenthèses, **présence** (venus sur inscrits). Le second tourne autour de 100 % en temps normal ; s'en écarter signale des absences répétées.

Ces chiffres portent toujours sur 30 jours, quelle que soit la période affichée dans la liste en dessous.

**Sa liste de cours**, filtrable :

- **Période** : à venir, cette semaine (du lundi), ce mois-ci. Des flèches reculent ou avancent d'une semaine ou d'un mois selon la vue.
- **Statut**, sur les périodes passées : exécutés, présences à valider, décision attendue, sans inscrit, annulés.

Chaque ligne affiche `2/5` pour un cours à venir, `3/4/5` pour un cours passé — présents, inscrits, capacité.

**Sur la fiche d'un cours**, le coach pointe les présences, ajoute ou retire un membre, et peut annuler le cours entier. L'annulation demande confirmation et **nomme les inscrits concernés** avant de valider.

> **Le pointage se fait à la main.** Le lecteur de code QR est une option à côté, ignorable : avec peu de participants qu'on connaît, cocher une liste va plus vite.

---

## Les membres — Administration → Membres

La fiche d'un membre regroupe tout ce qui le concerne, en plusieurs onglets.

### Ce qu'on voit en tête

Statut, catégorie, frais d'inscription, et trois compteurs : crédits restants, packs actifs, réservations.

**La catégorie** détermine les packs auxquels le membre a droit. Un membre a une seule catégorie.

**Les frais d'inscription** se valident ou se retirent à la main — utile quand quelqu'un a payé autrement que par l'application.

### Onglet Packs

Tous ses packs, actifs et expirés. Chacun peut être **modifié** : nombre de crédits restants, date d'expiration. Sert à corriger une erreur ou à faire un geste.

**Attribuer un pack** sans paiement : le bouton est là. À utiliser pour un paiement reçu en espèces, par virement, ou pour offrir des séances.

### Onglet Réservations et onglet Annulations

L'historique du membre. Les annulations sont comptées **par cycle**, pas sur tout l'historique : sur un abonnement reconduit treize fois par an, un cumul ne dirait rien d'utile.

Un seuil d'alerte (réglable) signale les membres qui annulent beaucoup. C'est une information, pas une sanction : la décision reste humaine.

### Onglet Abonnement

Visible quand le membre a un abonnement. Il affiche son état, la prochaine échéance, et quatre actions.

**Réduction ponctuelle** — en euros ou en pourcentage, avec un motif. Elle s'applique à **la prochaine échéance seulement** ; les suivantes reviennent au tarif plein automatiquement. Le montant réel de la prochaine échéance s'affiche ensuite, l'ancien prix barré.

**Décaler l'échéance** — pour des congés, une blessure. Des raccourcis proposent +7, +14, +21 ou +28 jours. La période offerte n'est pas facturée, **et l'accès du membre est prolongé d'autant** : une maladie se compense, elle ne se met pas en pause. Une date antérieure à l'échéance actuelle est refusée.

**Suspendre / Reprendre** — arrête les prélèvements sans résilier.

**Résilier** — en fin de période par défaut : le membre garde ses droits jusqu'au terme qu'il a payé. L'option **immédiate** coupe tout sur-le-champ, accès compris, sans remboursement automatique.

Un historique des réductions accordées figure en bas de l'onglet.

### Onglet Bons

**L'état du parrainage** du membre : parrainé par qui, et si le parrainage est qualifié ou en attente du premier paiement.

**Rattacher un parrain** — pour les codes oubliés à l'inscription, réclamés après coup. Le parrainage est enregistré comme s'il avait été saisi au départ ; les bons seront créés au prochain paiement du membre.

**Accorder un bon d'achat** — montant libre, avec un motif (geste commercial, dédommagement, autre). Le bon est proposé au membre à son prochain achat. Il s'utilise **en une fois, en entier**.

La liste montre tous ses bons, leur origine, leur état et leur expiration.

### Désigner un coach ou un admin

Les boutons sont sur la fiche membre, sous le statut. Les rôles actuels s'affichent en badges à côté.

- Un **admin** désigne ou retire un **coach**
- Seul un **super admin** désigne ou retire un **admin**, et promeut au rang de **super admin**

Le membre reçoit une notification quand il devient coach, et chaque changement est tracé au journal.

> **Plusieurs super admins sont possibles**, et c'est prudent : si l'un perd l'accès à son compte, l'autre peut le rétablir. Deux garde-fous : on ne retire pas ses propres droits d'admin, et le dernier super admin ne peut pas être retiré — sinon le studio se verrouillerait.

### Autres actions sur la fiche

Corriger le nom, l'adresse e-mail (avec confirmation du membre), réinitialiser le mot de passe (super admin), inscrire le membre à un cours.

En mode test uniquement, un bouton de **remise à zéro** efface tous les achats d'un membre pour rejouer un scénario. Il disparaît dès que Stripe passe en production.

---

## Vendre — ce qu'il faut régler

### Types de crédit — Administration → Types de crédits

C'est la brique de base : « semi-privé », « personal training »… **Un crédit d'un type ne paie que les cours du même type.** Tout part de là.

### Types de packs — Administration → Types de packs

L'écran est regroupé par type de crédit, abonnements d'abord, packs à l'unité ensuite — comme le voit le membre.

Pour chaque pack :

| Réglage | Effet |
|---|---|
| **Type de crédit** | Détermine les cours réservables. **Le vérifier en premier** : un pack mal rattaché est inutilisable. |
| **Nombre de séances** | Le compteur. Sans objet si illimité. |
| **Illimité** | Aucun décompte à la réservation, donc aucun recrédit à l'annulation. |
| **Prix** | En euros. |
| **Validité** | Durée pendant laquelle les crédits restent utilisables. |
| **Abonnement** | Renouvellement automatique. Demande une périodicité. |
| **Catégories éligibles** | Restreint la vente à certaines catégories. Vide = ouvert à tous. |

> **Sur un abonnement, la validité doit correspondre au cycle.** Un cycle de 4 semaines va avec une validité de 28 jours. L'application vous alerte si les deux divergent.

> **Attention aux 13 échéances.** Un cycle de 4 semaines revient **13 fois par an**, pas 12. À prendre en compte dans vos prix.

> **Un prix est figé une fois vendu.** Modifier le prix ou la périodicité d'un abonnement crée un nouveau tarif côté Stripe ; les abonnés existants gardent l'ancien. Pour changer le prix de tout le monde, il faut les faire résilier et se réabonner.

### Types de cours — Administration → Types de cours

Nom, description, couleur, nombre de places par défaut, image, et **type de crédit exigé**. La description longue accepte le Markdown et s'affiche aux membres.

### Catégories de membres — Administration → Catégories

Servent à réserver certains packs à certains publics.

### Coupons — Administration → Coupons

Codes de réduction collectifs, avec quota et période de validité.

> **En l'état, un coupon créé ici n'est pas utilisable** : aucun écran ne permet au membre d'en saisir un. À traiter avant d'en créer.

---

## Réglages — Administration → Réglages

### Règles de réservation

Chaque paramètre est décrit dans l'écran, avec sa valeur en clair. En résumé :

- **Fermeture des réservations** : les cours du matin ferment la veille au soir (le coach doit savoir s'il se lève) ; ceux de l'après-midi ferment le jour même, plus tôt si personne n'est inscrit, plus tard s'il y a du monde.
- **Annulation** : au-delà du délai, le crédit revient ; en deçà, la séance est décomptée.

Deux réglages — annulation personal training et absence automatique — sont **signalés comme sans effet** : la logique correspondante n'est pas encore écrite.

### Parrainage

Montant du bon du parrain, du bon du filleul, **achat minimum** pour que le filleul puisse utiliser le sien (entre 30 et 100 €), et durée de validité.

Le seuil ne vise que le filleul : le parrain est déjà client, et un dédommagement du studio reste utilisable sans condition.

Ces montants s'appliquent aux futurs parrainages ; les bons déjà créés gardent leur valeur.

### Autres réglages

- **Frais d'inscription** : montant, activation
- **Coût moyen d'une séance illimitée** : sert à valoriser les statistiques, puisqu'un illimité ne décompte rien
- **Seuil d'alerte annulations** : à partir de combien d'annulations par cycle un membre est signalé
- **Minimum de participants** : en dessous, un cours est signalé pour revue
- **Demande d'avis après les cours** : interrupteur, plus deux délais **en heures, comptés à partir de la fin du cours**. Le premier impose un temps d'attente avant qu'un avis soit possible (à 0, la séance est notable dès qu'elle se termine) ; le second ferme la fenêtre — au-delà, plus personne ne peut noter, et les avis déjà donnés se figent. 168 heures valent une semaine. Couper la demande ne supprime aucun avis existant
- **Informations du studio**, **noms des salles**
- **Mode Stripe** (super admin) : test ou production. Bascule le paiement **et** le webhook d'un coup

---

## Suivre l'activité

### Tableau de bord — Administration → Tableau de bord

Sur une période au choix (semaine, mois, trimestre, année, ou dates libres) :

- **Recettes encaissées** et nombre de packs vendus
- **Crédits consommés** et leur valeur
- **Cours donnés / planifiés**
- **Cours par coach** — seuls les cours **déjà donnés** sont comptés
- **Exports CSV** : ventes de packs, et cours avec leurs réservations

> Sur un pack illimité, aucun crédit n'est décompté : la valeur d'une séance vient du réglage « coût moyen d'une séance illimitée ».

### Évaluations — Administration → Évaluations

Les avis laissés par les membres après leurs séances : une note de 1 à 5 étoiles et un commentaire facultatif.

**La liste** affiche une ligne par avis — le cours, sa date et son heure, les étoiles. Le bouton **Détails** déplie le reste sans quitter la page : le coach, le membre **avec son nom et son e-mail**, la date de dépôt, et le commentaire s'il y en a un. Plusieurs lignes peuvent rester ouvertes en même temps.

**Filtrer :**

- **Période** — champs *Du* et *Au*, flèches ◀ ▶ pour décaler d'une durée équivalente, raccourcis *Cette semaine* et *Ce mois*. Même fonctionnement que le planning. La période porte sur la date **du cours**, pas sur celle du dépôt de l'avis.
- **Coach** et **Type de cours** — listes déroulantes.
- **Étoiles** — un bouton par note, avec le nombre d'avis concernés. Une note que personne n'a donnée n'est pas cliquable.

**Moyenne par coach** — en bas de page, sur **tout l'historique** et non sur la période affichée : c'est une tendance de fond, elle n'a de sens que dans la durée. Cliquer sur un coach filtre la liste.

> **L'admin est le seul à voir qui a écrit quoi.** Les coachs voient les avis de leurs cours de façon anonyme — un membre qui revoit son coach la semaine suivante ne note pas franchement s'il se sait identifiable. L'accès nominatif de l'admin sert à recontacter quelqu'un, ou à distinguer un mécontentement isolé d'un acharnement.

### Parrainages — Administration → Parrainages

Qui a parrainé qui, et où en est chaque parrainage.

### Demandes de facture — Administration → Demandes de facture

Les demandes des membres, à traiter et à marquer comme traitées.

### Journal d'activité — Administration → Journal

Tout ce qui a été fait : achats, réservations, annulations, gestes commerciaux, changements de rôle. Utile pour retrouver qui a fait quoi, et quand.

### Annonces — Administration → Annonces

Le message affiché en haut de la page d'accueil des membres.

---

## Points de vigilance

**Le paiement fait foi.** Un pack n'est crédité qu'après confirmation du paiement par Stripe. Si un membre dit avoir payé sans que rien n'apparaisse, vérifiez d'abord côté Stripe avant d'attribuer à la main.

**Les gestes commerciaux sont tracés.** Réductions, bons, reports d'échéance : tout est enregistré au journal, avec l'auteur. C'est une protection, pas une surveillance — elle permet de répondre à un membre qui conteste.

**Le mode test et le mode production sont étanches.** Un abonnement créé en test ne sera jamais facturé réellement. Vérifiez le mode avant de vendre.

**En cas de doute sur un paiement**, le tableau de bord Stripe montre l'historique complet : ce qui a été payé, refusé, remboursé.

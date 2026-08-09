# Guide coach & administrateur

Administration du studio. Pour l'usage courant de l'application — réserver, acheter un pack, gérer son profil — voir le **guide du membre**.

---

## Où trouver quoi

Tout passe par le **menu Administration**, dans la barre latérale à gauche (sur mobile, par le bouton menu en haut). Les entrées apparaissent dans cet ordre :

| Entrée du menu | À quoi ça sert | Détail |
|---|---|---|
| **Utilisateurs** | La fiche de chaque membre : packs, réservations, abonnement, rôles | [§](#les-membres--administration--utilisateurs) |
| **Coaches & Admins** | Les membres du staff et leurs cours | [§](#lespace-coach) |
| **Catégories de membres** | Qui a droit à quels packs | [§](#catégories-de-membres--administration--catégories-de-membres) |
| **Types de crédits** | La brique de base : semi-privé, personal training… | [§](#types-de-crédit--administration--types-de-crédits) |
| **Types de packs** | Les formules vendues, leur prix, leur durée | [§](#types-de-packs--administration--types-de-packs) |
| **Types de cours** | Les cours proposés et leur type de crédit | [§](#types-de-cours--administration--types-de-cours) |
| **Types de perfs** | Les mesures suivies (charge, temps, répétitions…) | — |
| **Gestion du planning** | Créer, modifier, annuler les cours | [§](#le-planning--administration--gestion-du-planning) |
| **Réservations** | Toutes les réservations, tous membres confondus | — |
| **Coupons** | Codes de réduction collectifs | [§](#coupons--administration--coupons) |
| **Annonces** | Messages diffusés aux membres | — |
| **Journal d'activité** | Qui a fait quoi, quand | — |
| **Demandes de factures** | Les demandes des membres à traiter | — |
| **Parrainages** | Qui a parrainé qui, et les bons émis | — |
| **Évaluations** | Les avis laissés sur les cours | [§](#évaluations--administration--évaluations) |
| **Suivi clients** | **Qui vient moins, qui ne vient plus, qui rapporte quoi** | [§](#suivi-des-clients--administration--suivi-clients) |
| **Tableau de bord** | Les chiffres de l'activité | [§](#tableau-de-bord--administration--tableau-de-bord) |
| **Paramètres** | Tous les réglages du studio | [§](#réglages--administration--paramètres) |
| **Aide** | Ce guide, consultable dans l'application | — |

> **Le menu s'adapte au rôle.** Un coach ne voit que ses cours et son planning ; les entrées de configuration et de vente sont réservées aux administrateurs.

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

### Le planning — Administration → Gestion du planning

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

**Un admin y accède aussi**, par le lien **Coach** du menu principal — au même titre qu'un coach simple. Il y voit les cours dont **il est lui-même le coach**, pas ceux de toute l'équipe : pour la vue d'ensemble, c'est Administration → Gestion du planning. Utile quand on cumule les deux casquettes et qu'on donne des cours.

### Le menu du staff n'affiche pas les écrans membres

Un coach ou un admin ne voit ni *Mes cours*, ni *Mes packs*, ni *Performances*, ni *Packs* : le staff ne s'entraîne pas au studio, ces écrans n'auraient rien à lui montrer.

Le **planning** reste dans son menu — c'est aussi son outil de travail : lui seul y voit les cours à surveiller et les décisions en attente.

**Pour consulter les réservations ou les packs d'un membre**, passez par Administration → Utilisateurs → sa fiche. Les onglets *Packs*, *Réservations*, *Annulations*, *Abonnement* et *Crédits* montrent tout ce que le membre voit de son côté — et davantage, puisqu'on peut aussi l'inscrire à un cours ou lui créditer un geste commercial. Aucune raison de se connecter à sa place.

**Ses chiffres, sur 30 jours** : cours donnés sur planifiés (avec le détail des cours sans inscrit et annulés), participants venus, et deux taux distincts — **remplissage** (inscrits sur places) et, entre parenthèses, **présence** (venus sur inscrits). Le second tourne autour de 100 % en temps normal ; s'en écarter signale des absences répétées.

Ces chiffres portent toujours sur 30 jours, quelle que soit la période affichée dans la liste en dessous.

**Sa liste de cours**, filtrable :

- **Période** : à venir, cette semaine (du lundi), ce mois-ci. Des flèches reculent ou avancent d'une semaine ou d'un mois selon la vue.
- **Statut**, sur les périodes passées : exécutés, présences à valider, décision attendue, sans inscrit, annulés. Un cours où **tous les inscrits ont été pointés absents** compte comme **exécuté** : le coach s'est déplacé, et les absents n'ayant pas annulé à temps, leurs crédits restent acquis.

Chaque ligne affiche `2/5` pour un cours à venir, `3/4/5` pour un cours passé — présents, inscrits, capacité.

**Sur la fiche d'un cours**, le coach pointe les présences, ajoute ou retire un membre, et peut annuler le cours entier. L'annulation demande confirmation et **nomme les inscrits concernés** avant de valider.

> **Le pointage se fait à la main.** Le lecteur de code QR est une option à côté, ignorable : avec peu de participants qu'on connaît, cocher une liste va plus vite.

---

## Les membres — Administration → Utilisateurs

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

> **Où** : **Administration → Utilisateurs**, ouvrir la fiche du membre. Les boutons sont sous son statut.

Les boutons sont sur la fiche membre, sous le statut. Les rôles actuels s'affichent en badges à côté.

- Un **admin** désigne ou retire un **coach**
- Seul un **super admin** désigne ou retire un **admin**, et promeut au rang de **super admin**

Le membre reçoit une notification quand il devient coach, et chaque changement est tracé au journal.

> **Plusieurs super admins sont possibles**, et c'est prudent : si l'un perd l'accès à son compte, l'autre peut le rétablir. Deux garde-fous : on ne retire pas ses propres droits d'admin, et le dernier super admin ne peut pas être retiré — sinon le studio se verrouillerait.

### Supprimer un compte

> **Où** : **Administration → Utilisateurs**, ouvrir la fiche, en bas de page. Le membre peut aussi le faire lui-même depuis son profil.

Deux chemins mènent au même résultat : le membre le fait depuis son profil, ou vous depuis sa fiche.

**La suppression anonymise, elle n'efface pas.** Le nom, l'e-mail, le téléphone et la photo disparaissent ; les paiements restent, détachés de toute identité. C'est une contrainte comptable belge — sept ans de conservation — et c'est aussi ce que prévoit le RGPD lorsqu'une obligation légale s'oppose à l'effacement complet.

Concrètement : le membre ne peut plus se connecter, il sort de vos listes, mais votre chiffre d'affaires reste juste.

> **Un abonnement actif bloque l'opération.** Il faut le résilier d'abord — sans compte, le membre ne pourrait plus l'arrêter et continuerait d'être prélevé.

L'opération est tracée au journal d'activité.

### Autres actions sur la fiche

Corriger le nom, l'adresse e-mail (avec confirmation du membre), réinitialiser le mot de passe (super admin), inscrire le membre à un cours.

En mode test uniquement, un bouton de **remise à zéro** efface tous les achats d'un membre pour rejouer un scénario. Il disparaît dès que Stripe passe en production.

---

## Vendre — ce qu'il faut régler

### Types de crédit — Administration → Types de crédits

C'est la brique de base : « semi-privé », « personal training »… **Un crédit d'un type ne paie que les cours du même type.** Tout part de là.

### Plafond de fréquentation — Administration → Types de packs

Sur n'importe quel pack, deux champs facultatifs limitent le rythme : **N cours par D jours**. Laissés vides, aucun plafond ne s'applique — c'est le cas de tous les packs aujourd'hui.

Exemples : *2 cours par 1 jour*, *10 cours par 7 jours*, *12 cours par 14 jours*.

**Comment se compte la fenêtre.** Elle est *glissante* et *centrée sur le cours qu'on veut réserver* : on regarde les séances situées à moins de D jours avant ou après. Rien ne se remet jamais à zéro — contrairement à une semaine calendaire, où quelqu'un pourrait cumuler 4 cours le dimanche et 4 le lundi.

**Maximum 14 jours.** Au-delà, un plafond ne contraint plus le rythme : « 50 cours par 28 jours » laisse en faire 50 la première semaine puis rien pendant trois.

**Le plafond ne sert que s'il est plus bas que les crédits.** Sur un pack de 4 séances, un plafond de 10 ne bloquera jamais — les crédits s'épuisent avant. Pour étaler la consommation d'un pack de 4, posez plutôt *1 cours par 7 jours*. Le formulaire vous prévient si le plafond est sans effet.

**Le staff n'est pas concerné.** Un coach ou un admin peut inscrire quelqu'un au-delà de son plafond, comme il peut déjà passer outre le délai de fermeture.

Le membre voit sa consommation dans *Mes packs* (« 3 / 10 cours sur 7 jours »), et un message explicite s'il tente de dépasser.

### Vendre en août un abonnement qui commence en septembre

> **Où** : le membre (ou vous avec lui) passe par **Packs**, choisit un abonnement, et le champ « Démarrer plus tard » apparaît dans la fenêtre de confirmation.

Le cas commercial classique : vous rencontrez un prospect à la mi-août, il signe, mais il ne reprendra qu'à la rentrée.

Sur la fenêtre de confirmation d'abonnement, le champ **« Démarrer plus tard »** règle exactement cela. Le client saisit la date de début — ou vous la saisissez avec lui.

Ce qui se passe alors :

- **la carte est enregistrée le jour de la vente**, l'engagement est pris ;
- **rien n'est prélevé avant la date choisie**, et la première facture tombe ce jour-là ;
- **aucun crédit n'existe avant** : le client ne peut pas venir s'entraîner en août ;
- les échéances suivantes se calent sur la nouvelle date.

> La date doit être au moins 48 heures plus tard — contrainte de Stripe. Au-delà d'un an, l'application refuse : c'est presque toujours une faute de frappe.

**Point à surveiller.** La carte est validée à la vente mais débitée à la date de début. Si elle expire entre-temps, l'échec apparaît le jour du prélèvement — le client reçoit l'e-mail « paiement refusé », et vous le voyez dans son abonnement.

**Pour un pack ponctuel, il n'y a pas d'équivalent** — et ce n'est pas nécessaire : vendez un pack dont la durée de validité couvre la période. Trois mois achetés le 15 août portent jusqu'à mi-novembre. Seule limite, rien n'empêche le client de consommer des séances avant la date prévue ; si cela compte, dites-le-lui.

### La séance d'essai

> **Où** : rien à faire, elle est attribuée automatiquement à l'inscription. Le réglage de sa durée est dans **Administration → Paramètres**.

Tout nouveau compte reçoit **une séance d'essai gratuite**, attribuée automatiquement à l'inscription. Le membre la voit en tête de son accueil et la réserve depuis le planning, sans payer.

C'est un **vrai pack**, gratuit et hors catalogue. Conséquence pratique : la réservation qui en découle est une réservation ordinaire — elle apparaît dans « Mes réservations », **et sur votre liste de présence**. Personne ne se présente au studio sans que vous le sachiez.

Trois règles fixées : **semi-privé uniquement**, **30 jours de validité** (réglable), et **nouveaux profils seulement** — un membre existant n'en reçoit pas.

### Fin d'abonnement et réservations

Un abonnement couvre les cours de son cycle. Tant qu'il **se renouvelle**, le membre peut réserver au-delà de la date d'échéance : le cycle suivant paiera.

Dès qu'il est **résilié**, les réservations situées après le terme sont **annulées automatiquement**, et le membre est prévenu par une notification qui nomme le cours et la date de fin. Cela vaut aussi pour les résiliations faites depuis le tableau de bord Stripe.

Un membre déjà en cours de résiliation ne peut plus réserver au-delà de son terme : un message le lui indique, avec la date.

### Quatre situations, et ce que le membre voit

Ces quatre cas couvrent l'essentiel de ce qui peut bloquer une réservation. Utile pour comprendre un appel du type « je n'arrive pas à réserver ».

**1. Formule à crédits, crédits épuisés — le plafond n'y est pour rien.**
Un membre a un abonnement de 4 séances avec un plafond de 10 cours / 7 jours. Il consomme ses 4 séances. Au 5ᵉ cours il est refusé : *« Vos crédits sont épuisés pour ce cycle… »*
→ Sur une formule à crédits, ce sont les crédits qui bloquent. Un plafond supérieur au nombre de séances ne sert jamais.

**2. Formule illimitée, plafond atteint — puis libéré.**
Un membre en illimité, plafond 10 cours / 7 jours, réserve 10 cours sur trois jours. Un cours le lendemain est refusé : *« Votre pack ne permet pas plus de 10 cours sur 7 jours. »* Le même cours deux semaines plus tard passe sans problème.
→ La fenêtre glisse. Le plafond bride le rythme, pas le total.

**3. Crédits épuisés, mais le renouvellement approche.**
Même formule à crédits, cycle qui se termine dans quelques jours. Pour un cours situé **après** le renouvellement, le membre lit : *« Vos crédits sont épuisés. Votre abonnement se renouvelle le JJ/MM : vous pourrez réserver cette séance à partir de cette date. »*
→ Il n'a rien à racheter, juste à attendre. Ce message évite un appel inutile.

**4. Abonnement résilié — les réservations postérieures disparaissent.**
Un membre en illimité a réservé des cours de part et d'autre de son échéance, puis résilie. Les cours antérieurs au terme sont conservés ; ceux d'après sont **annulés d'office**, avec une notification par cours annulé et une trace au journal d'activité.
→ Personne ne paiera ces séances : elles ne restent pas à bloquer des places.

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

### Catégories de membres — Administration → Catégories de membres

Servent à réserver certains packs à certains publics.

### Coupons — Administration → Coupons

Codes de réduction collectifs, avec quota, période de validité et **restriction par catégorie de pack**. Sans restriction, le coupon vaut pour tout — c'est le cas courant, qu'on n'a pas à déclarer.

Le membre saisit le code **sur la fenêtre de confirmation, au moment de payer**. La remise est vérifiée et affichée **avant** le paiement : un refus est expliqué sur place plutôt que découvert sur la page Stripe, où il ferait abandonner l'achat.

> **Un seul code par achat** : coupon *ou* bon d'achat, jamais les deux.

Le champ n'apparaît pas chez un client professionnel — non par une règle dédiée, mais parce qu'il paie sur facture et ne passe pas par cet écran.

---

## Réglages — Administration → Paramètres

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
- **Noms des salles**
- **Mode Stripe** (super admin) : test ou production. Bascule le paiement **et** le webhook d'un coup

### Coordonnées légales du studio — à remplir en premier

> **Où** : **Administration → Paramètres**, section Informations du studio.

Nom, forme juridique, adresse, numéro d'entreprise, TVA, e-mail et téléphone de contact.

**Ces champs bloquent trois choses tant qu'ils sont vides** : les conditions générales, la politique de confidentialité et les factures. Un document dont le champ manque affiche « (à compléter dans les Réglages) », et l'écran liste ce qui reste à saisir.

Ils ne sont écrits qu'ici. Les documents portent des repères qui vont chercher la valeur au moment de l'affichage — une adresse qui change se corrige **à un seul endroit**.

### Conditions générales et confidentialité

> **Où** : les pages publiques sont à `/cgv` et `/privacy`. Leur contenu s'édite dans les fichiers du site, les coordonnées viennent des Paramètres.

Les CGV sont publiques, à l'adresse `/cgv`, et le lien figure en pied de page. Leur contenu vit dans un fichier texte éditable sans développeur.

L'inscription **exige déjà** que le membre les accepte, et la date est enregistrée sur son profil.

> L'article sur l'assurance est rédigé et applicable. Le reste attend le contenu du studio — à compléter avant la mise en vente réelle.

La politique de confidentialité suit le même principe. Elle a une URL publique, condition posée par Apple pour publier l'application.

### Réseaux sociaux

> **Où** : **Administration → Paramètres**.

Sept liens configurables (Instagram, Facebook, site web, et autres). Renseignés, ils s'affichent sur les deux pages d'accueil — celle des visiteurs et celle des membres. Laissés vides, rien n'apparaît.

---

## Suivi des clients — Administration → Suivi clients

La page qui répond à « qui faut-il relancer ». Elle classe chaque client selon le temps écoulé depuis sa dernière séance, et montre s'il vient moins qu'avant.

### Les quatre états

| État | Ce que ça veut dire |
|---|---|
| **Actif** | Venu récemment, rien à signaler |
| **Ralentit** | Premier signal — un cycle presque manqué |
| **Décroche** | Absent depuis un moment, c'est le bon moment pour appeler |
| **Perdu** | Longue absence, la reconquête sera plus difficile |
| **Jamais venu** | Inscrit mais jamais présent — un accueil, pas une relance |

L'onglet **À relancer** réunit les trois états du milieu. Les « jamais venus » en sont exclus volontairement : ce n'est pas le même geste commercial.

Le tri place les **décrochés récents en premier** — ceux qu'on peut encore rattraper — avant les perdus de longue date.

### Réservé / pointé — pourquoi deux colonnes

La première compte les séances **réservées et non annulées**, la seconde celles qui ont été **pointées**.

Les deux figurent parce qu'aucune n'est fiable seule. Le pointage dit la vérité du terrain, mais il dépend de la rigueur avec laquelle on le fait : une séance oubliée ferait passer un présent pour un absent. La réservation, elle, est toujours enregistrée — et elle a consommé un crédit, donc elle compte commercialement.

**L'écart entre les deux se lit** : soit un membre réserve sans venir, soit le pointage a été négligé sur ces cours. À vous de savoir lequel des deux.

> Le classement s'appuie sur la **réservation**, la donnée toujours présente. Fonder l'alerte sur le pointage produirait de faux décrocheurs.

### La tendance

Elle compare la période récente à la précédente, de même durée : « 2/5 » signifie deux séances récemment contre cinq avant.

C'est cette comparaison qui révèle un ralentissement — **un total cumulé reste élevé chez quelqu'un qui a cessé de venir**, et ne dit donc rien.

Une flèche descendante rouge signale une baisse, une flèche montante verte une hausse.

### Le chiffre d'affaires

**CA** additionne ce que le client a réellement payé — packs et cycles d'abonnement.

**€ / séance** divise ce total par les séances consommées. C'est ce chiffre qui dit si un client est rentable, pas le total : quelqu'un qui achète un pack illimité et vient trois fois vous rapporte plus par séance que celui qui vient quinze fois.

### Régler les seuils

Dans **Réglages → Suivi des clients** : trois durées en semaines, plus la fenêtre de comparaison de la tendance.

Les valeurs par défaut (3, 6, 10 semaines) sont calées sur un cycle d'abonnement de 4 semaines. Ajustez selon ce que vous observez — un studio où l'on vient trois fois par semaine détecte un décrochage plus vite qu'un studio à une séance hebdomadaire.

> **La fenêtre de comparaison mérite réflexion.** Trop courte, elle réagit au moindre congé ; trop longue, elle masque un décrochage récent. Huit semaines par défaut.

Les seuils doivent aller croissant — l'écran refuse d'enregistrer sinon.

### Ce que la page ne fait pas

Elle **ne relance personne**. Elle signale, vous décidez. Un clic sur un nom ouvre la fiche du membre, où vous trouverez son téléphone et son historique complet.

Le staff n'apparaît pas dans la liste : coachs et administrateurs ne sont pas une clientèle et fausseraient les moyennes.

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

### Demandes de facture — Administration → Demandes de factures

Les demandes des membres, à traiter et à marquer comme traitées.

### Journal d'activité — Administration → Journal d'activité

Tout ce qui a été fait : achats, réservations, annulations, gestes commerciaux, changements de rôle. Utile pour retrouver qui a fait quoi, et quand.

### Annonces — Administration → Annonces

Le message affiché en haut de la page d'accueil des membres.

---

## Points de vigilance

**Le paiement fait foi.** Un pack n'est crédité qu'après confirmation du paiement par Stripe. Si un membre dit avoir payé sans que rien n'apparaisse, vérifiez d'abord côté Stripe avant d'attribuer à la main.

**Les gestes commerciaux sont tracés.** Réductions, bons, reports d'échéance : tout est enregistré au journal, avec l'auteur. C'est une protection, pas une surveillance — elle permet de répondre à un membre qui conteste.

**Le mode test et le mode production sont étanches.** Un abonnement créé en test ne sera jamais facturé réellement. Vérifiez le mode avant de vendre.

**En cas de doute sur un paiement**, le tableau de bord Stripe montre l'historique complet : ce qui a été payé, refusé, remboursé.

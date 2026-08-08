# Journal du projet — Back On Track v2

> Trace de l'évolution du projet et de ce qui reste à faire.
> Dernière mise à jour : **2026-08-08**

---

## Où en est le projet

**Phases 1 à 10 livrées** (v2.0.0 et suivantes, jusqu'à v2.53.0) : comptes, packs, planning, réservations, liste d'attente, annulations, check-in, statistiques, notifications, e-mails.

**Phase 11** (admin avancé) : **largement livrée** — rôles, statuts de cours, espace coach autonome.
**Phase 12** (abonnements récurrents) : **livrée et éprouvée**. Renouvellement vérifié au *test clock* Stripe le 2026-08-07.
**Séance d'essai** : **livrée** — vrai pack gratuit attribué à l'inscription (2026-08-07).
**Communications** : **livrées** — tout e-mail laisse une trace dans l'application.
**Parrainage & bons d'achat** : livré, **toujours non testé de bout en bout**.
**Avis sur les cours** : **livré et vu à l'écran** — étoiles et commentaire, consultation admin nominative, correction et suppression par le membre. 67 avis de démonstration en base depuis le 2026-08-08.
**Plafond de fréquentation** : **livré** — N cours par D jours, fenêtre glissante centrée, D borné à 14. **Actif sur deux formules pour la démonstration**, à retirer après validation.
**Clients professionnels** : **livré** — commande sur facture, suivi des encaissements.
**Performances** : étapes 1 et 2 livrées (valeurs comparables, courbes). Paliers et régularité à faire.
**Phase 13** (RGPD & sécurité) : non entamée. Les CGV existent, à compléter. **Deux de ses éléments deviennent bloquants pour l'App Store** — voir ci-dessous.
**Rémunération des coachs** : reportée — module à part, la gestion se fait hors application (décision du 2026-08-06).

L'application tourne sur **Stripe** — la migration vers Mollie prévue au plan a été abandonnée le 2026-08-03.

Une version de test tourne sur iPhone depuis le 2026-08-07 (signature de développement, valable 7 jours).

### Publication sur l'App Store

Compte Apple Developer pris **au nom propre de Christian** (99 $/an) — décision du 2026-08-07.

**La commission de 30 % ne s'applique pas** : règle 3.1.3(e), biens et services physiques. Un cours se consomme au studio, pas dans l'application. Les packs et abonnements restent vendus par Stripe.

**Deux prérequis bloquants avant toute soumission :**

1. **Suppression de compte depuis l'application** — obligatoire depuis 2022, motif de rejet automatique. La fonction doit **anonymiser** plutôt qu'effacer : les données comptables se conservent.
2. **Politique de confidentialité avec URL publique** — à créer sur le modèle de `public/cgv.md`.

---

## Session du 2026-08-08 — après-midi

### Le quota : trois versions avant la bonne

Le chantier a coûté trois implémentations parce que la règle n'était pas arrêtée avant de coder. Les deux premières sont parties à la poubelle :

| Forme | Pourquoi écartée |
|---|---|
| Quota **par cycle** d'abonnement | Ne valait que pour les abonnements, et butait sur le fait que le cycle suivant n'existe pas encore en base au moment de réserver |
| Fenêtre **calendaire** (lundi→dimanche) | Plus lisible, mais laisse cumuler 4 cours le dimanche et 4 le lundi |
| **Fenêtre glissante centrée** ✅ | Retenue |

**Christian a interrompu le travail** au moment où j'allais écrire la troisième version : « tu codes trop vite, on n'a pas fixé les règles ». La méthode qui a fonctionné ensuite — décider, simuler sur papier, coder une fois — est celle qu'il fallait appliquer d'emblée.

### La règle retenue

`quota_sessions` / `quota_days` sur `pack_types` : **N cours par D jours**, fenêtre glissante **centrée sur la séance visée**. Les deux côtés comptent, sinon l'ordre des réservations suffit à contourner la règle — réserver du plus lointain au plus proche laisserait chaque fenêtre arrière vide au moment du test.

**D borné à 14 jours**, en dur. Au-delà, un plafond ne contraint plus le rythme : « 50 cours par 28 jours » laisse en faire 50 la première semaine puis rien pendant trois. Borne fixe et non calculée par pack — une borne suivant `validity_days` serait illisible sur un pack ponctuel valable un an.

La fenêtre **ignore les cycles**, volontairement : le plafond limite le rythme physique, pas la facturation.

### Quatre cas simulés, puis implantés

Simulés d'abord en transaction annulée, puis montés pour de vrai sur quatre clients (Thomas Dupont, Simona Costamagna, Anselme Meunier, joan rodon) avec abonnements offerts et identifiants Stripe fictifs en mode test.

Ce que chaque cas a révélé :

1. **Pack à crédits + plafond 10/7j** — les crédits bloquent, le plafond ne sert jamais. Un avertissement a été ajouté au formulaire admin quand le plafond dépasse le nombre de crédits.
2. **Illimité + plafond 10/7j** — le glissement se vérifie : refusé le lendemain, accepté deux semaines plus tard.
3. **Crédits épuisés, cours du cycle suivant** — bloqué, mais le message disait « aucun crédit » comme si rien n'avait été acheté. Nouveau cas `credits_exhausted_renewal` : « votre abonnement se renouvelle le JJ/MM ».
4. **Résiliation la veille de l'échéance** — la coupure tombe **à l'heure près** : échéance à 12h00, les cours de 8h et 9h sont gardés, celui de 12h30 annulé.

### Autres travaux

- **Avis** : consultation admin nominative, fenêtre en heures, correction et suppression par le membre. 67 avis de démonstration créés sur 31 cours (moyenne 4,09), avec commentaires — les écrans avaient été livrés sans jamais être vus avec des données.
- **Menu du staff** : les écrans membres (Mes cours, Mes packs, Performances, Packs) disparaissent pour coachs et admins. Le planning reste : c'est leur outil de travail.
- **Cours tout en absences** : compte désormais comme *exécuté* et non « décision attendue ». `getClassStatus` ne comptait que les présents, et l'écran réclamait un arbitrage que le pointage avait déjà tranché.
- **Refus silencieux** : une policy RLS qui refuse un UPDATE ne renvoie aucune erreur, elle met à jour zéro ligne. Les trois écritures de pointage annonçaient « pointé ! » sur un pointage inexistant. Elles lisent maintenant ce que la base a écrit.
- **Planning** : 6 cours vides supprimés, 9 créneaux Personal Training créés (3 après-midis × 3 séances, un coach par après-midi, 1 place).

### Point de vigilance

**Le plafond 10 cours / 7 jours est actif** sur « abonnement mini » et « Pack illimité » — donc pour *tous* leurs détenteurs, pas seulement les quatre clients de test. À retirer après validation par les coachs.

Un document de validation est dans le vault : `_cowork-atelier-pnl/drafts/2026-08-08-reservations-regles-et-cas-de-test.md`.

---

## Session du 2026-08-08 — matin

Un seul commit (v2.55.0) : la **consultation** des avis, restée en friche la veille. Les avis se déposaient depuis le 7 août mais ne se lisaient que cours par cours, depuis la fiche d'un cours passé — ni vue d'ensemble, ni accès nominatif, ni possibilité pour le membre de relire ce qu'il avait écrit.

### Une divergence dépôt / base, et sa cause

En ouvrant le chantier, `install.sql` et `supabase/migrations/` ne disaient pas la même chose : le premier connaissait un réglage `app_settings.class_reviews` que le second ignorait.

**Ce n'était pas une négligence sur `install.sql`** — la règle avait été respectée. La migration `20260807153356 avis_delai_reglable` existait bel et bien **en base**, appliquée directement via `apply_migration` du MCP Supabase, mais aucun fichier n'avait été redescendu dans le dépôt. Le fichier a été reconstitué depuis la définition réelle des fonctions.

**Cause structurelle, toujours ouverte** : `apply_migration` écrit en base sans créer de fichier local. Chaque usage exige de descendre le fichier à la main, dans le même commit. Deux autres migrations sont dans ce cas (`suppression_compte_par_admin`, `facture_numero_et_date`) mais leur contenu se retrouve dans d'autres fichiers — bruit de nommage, pas trou fonctionnel.

### Un seuil arbitraire déguisé en donnée

La première version de l'écran admin proposait un filtre « avis négatifs », défini à 2 étoiles ou moins. **Ce seuil n'avait aucun fondement métier** — il avait été inventé au moment d'écrire l'écran. Le mot « négatif » laissait croire à une catégorie objective.

Remplacé par un filtre par étoile exacte, qui laisse le jugement à qui lit. Le compteur `low_count` a été retiré de `class_review_stats_by_coach` pour la même raison : une notion arbitraire n'a pas à se figer en base.

### Le coach voyait trop

`class_reviews_for_staff` n'exigeait qu'un rôle staff. **Un coach pouvait lire les avis des cours d'un collègue** en connaissant l'identifiant du cours — l'écran ne le proposait pas, la fonction l'autorisait. Resserré aux cours dont il est le coach.

L'anonymat côté coach est conservé (décision du 2026-08-07) : un membre qui revoit son coach mardi ne note pas franchement s'il se sait identifiable. L'admin garde l'accès nominatif — sans le nom, on ne peut ni recontacter la personne ni distinguer un mécontentement isolé d'un acharnement.

### Les délais passent en heures

Le réglage mélangeait deux unités : une ouverture en heures, une fermeture en jours. **Les deux bornes se comptent maintenant en heures, depuis la FIN du cours** — le studio règle un délai sans avoir à tenir compte de la durée de chaque cours.

| Réglage | Rôle | Valeur |
|---|---|---|
| `hours_before_review` | Temps de décantation avant qu'un avis soit possible | 0 |
| `hours_to_review` | Fermeture de la fenêtre | 168 (= les 7 jours précédents) |

Le point de départ a changé au passage : la fenêtre partait du **début** du cours, elle part désormais de sa **fin**.

### Ce qu'on laisse modifier, on doit laisser effacer

Le membre retrouve son avis sous la séance dans *Mes réservations*, et peut le corriger **ou le retirer** tant que la fenêtre est ouverte. Un avis donné à chaud se regrette ; forcer quelqu'un à vivre avec une note qu'il désavoue ne rend service à personne.

`my_class_reviews` renvoie un champ `editable` **calculé en base** : l'interface n'a pas à refaire le calcul de fenêtre, et n'affiche jamais un bouton qui échouerait au clic.

### Livré

- **Admin** — entrée « Évaluations » : une ligne par avis (cours, date et heure, étoiles), bouton *Détails* qui déplie **en place** l'auteur, son e-mail et le texte. Filtres par période (flèches et raccourcis semaine/mois, même mécanique que le planning, période dans l'URL), par coach, par type de cours, par étoile. Moyenne par coach sur tout l'historique.
- **Membre** — relecture, correction et suppression depuis *Mes réservations*.
- **Coach** — inchangé à l'écran, mais borné à ses propres cours en base.
- **Réglages** — deux champs en heures, avec garde-fou si la fermeture précède l'ouverture.

### Point de vigilance

**Rien n'a été vu avec des données réelles.** La table `class_reviews` est vide, et l'insertion d'avis de test a été refusée par le classificateur de permissions. Les fonctions sont en place, les signatures concordent avec la base, le build passe — mais **le rendu des trois écrans reste à confirmer** dès qu'un premier avis existera.

---

## Session du 2026-08-07

37 commits (v2.17.0 → v2.53.0), tous poussés. Journée nourrie par les retours de **deux coachs**, l'un récent, l'autre plus ancien. L'après-midi a ouvert deux chantiers neufs : les avis sur les cours et la facturation B2B.

### Le fil rouge — ce que le code promet, ce que la base fait

Quatre bugs distincts, une même forme : **le code croyait avoir écrit, la base disait non, et personne n'écoutait**. Aucun ne se voyait à l'écran.

| Symptôme | Cause réelle |
|---|---|
| Le cours d'essai n'apparaît nulle part | Écrit dans `trial_sessions`, une table que les écrans ne lisent pas |
| L'abonnement paraît échu le jour même | `invoice.period_*` date la **facture**, pas le cycle d'abonnement |
| Bouton « Annuler » sur une réservation déjà annulée | `cancel_booking_v2` renvoie son refus **dans** son retour, sans lever d'erreur |
| Le webhook rejette tout pendant une heure | `--no-verify-jwt` perdu au redéploiement |

Le troisième cas est le plus instructif : `error` restait `null`, le code passait dans la branche de succès, l'écran affichait « annulée » — alors que rien n'avait bougé. **Tester le retour autant que `error`** est désormais consigné dans la documentation technique.

### La séance d'essai devient une vraie réservation

Elle était écrite dans une table à part que ni « Mes réservations », ni l'accueil, **ni la liste de présence du coach** ne consultaient. Des personnes étaient attendues au studio sans que personne ne le sache.

La cause était structurelle : `bookings.pack_purchase_id` était `NOT NULL`, et un essai n'a pas de pack derrière lui. `trial_sessions` contournait l'obstacle, au prix d'une seconde source de vérité.

L'essai est maintenant un **vrai pack** — gratuit, hors catalogue, attribué à la création du profil. Il produit une réservation ordinaire, donc visible partout sans qu'aucun écran soit modifié. `trial_sessions` est supprimée : garder deux systèmes aurait recréé la divergence.

> Décisions : semi-privé uniquement, 30 jours configurables, nouveaux profils seulement.

### Les communications remontent sur l'accueil

Un audit des 14 points d'envoi d'e-mail a montré que **6 ne laissaient aucune trace** dans l'application — or tout le monde ne lit pas ses e-mails.

Un bloc en tête d'accueil rassemble désormais tout : la séance d'essai en avant, puis les communications reçues, lu et non lu distingués, écartables à l'unité pour ne pas saturer la page.

Le helper `notifyMember` inverse l'ordre : **la notification part toujours, l'e-mail n'est qu'un rappel**. C'est le contraire de ce qui se faisait — l'e-mail était le canal principal et la notification un ajout écrit à la main juste à côté, d'où les six oublis.

> Écarter n'est pas supprimer. `dismissed_at` retire la ligne de l'écran du membre mais la conserve : en cas de contestation (« je n'ai jamais été prévenu »), elle prouve la transmission.

### Deux e-mails qui manquaient vraiment

**« Place disponible »** offre une place qui expire en **deux heures**, et n'existait qu'en notification : il fallait que le membre ouvre l'application par hasard dans ce créneau. **« Paiement refusé »** lui faisait risquer de perdre son abonnement sans le savoir.

L'offre naît dans une fonction SQL, qui ne peut pas appeler d'Edge Function. D'où une file `email_queue` : la fonction dépose, une fonction dédiée envoie. Le passage par une table rend l'envoi **ré-essayable** — un e-mail qui échoue reste visible au lieu d'être perdu.

Découvert au passage : `send-email` **refusait les appels serveur-à-serveur**. Elle exigeait un utilisateur authentifié, or le webhook se présente avec la clé de service, qui ne correspond à personne. Les deux e-mails ne seraient jamais partis.

### Le renouvellement d'abonnement, éprouvé

*Test clock* Stripe sur 28 jours : souscription, avance du temps, renouvellement. **Le mécanisme est sain** — seconde facture émise et payée, cycle crédité.

Mais le test a trouvé deux défauts réels :

1. **Le webhook rejetait tout depuis une heure** (401). Le déploiement du correctif de cycle avait remis `verify_jwt` à `true`. Entre 11 h et midi, tout paiement aurait été encaissé sans rien créditer — panne totalement silencieuse.
2. **Les crédits d'un renouvellement expiraient avant leur propre cycle** : `expires_at` était calculé depuis l'heure du serveur au lieu de la période facturée.

Un troisième défaut avait été trouvé juste avant, en cherchant pourquoi un abonnement paraissait échu : `invoicePeriod` lisait `invoice.period_start/end`, qui datent la **facture** et non le cycle. Sur une souscription, les deux valent l'instant d'émission — on enregistrait donc une période de durée nulle. Conséquence plus grave que l'affichage : à la résiliation, `endedEarly` était toujours faux, donc une résiliation immédiate ne clôturait pas les packs.

### Performances — rendre les valeurs comparables, puis tracer

Le coach demandait des graphiques. L'obstacle n'était pas technique — Recharts était déjà installé — mais dans les données : `value` est un texte libre où trois choses se mélangeaient. Sur 57 valeurs saisies, **2 seulement** étaient des nombres purs.

Deux informations manquaient, décidées au niveau du **mouvement** : la nature de la mesure (charge, temps, répétitions, distance) et le sens du progrès. Pour une charge, monter c'est mieux ; pour un chrono, descendre. Les deux sont indépendants — un gainage se mesure en temps et s'améliore en montant.

`value_num` porte la valeur en unité canonique, `value` reste le texte affiché ; les deux sont posés ensemble, donc ne divergent jamais. La saisie est contrainte : deux champs min/sec pour un chrono, un champ chiffré pour une charge.

Les courbes suivent : historique complet, record marqué, progression annoncée en clair (« +25 kg depuis mars »), et **axe inversé sur un chrono** pour que « ça monte » veuille toujours dire « je progresse ».

### Le reste

**Conditions générales** — page publique `/cgv`, contenu dans `public/cgv.md` éditable sans développeur. L'inscription **exigeait** déjà de les accepter et enregistrait la date, mais aucune page ne les présentait : le membre cochait une case pour un document inexistant. L'article 1 sur l'assurance est rédigé et applicable ; le reste attend le contenu du studio.

**Réseaux sociaux** — sept liens configurables, affichés sur les deux accueils. Instagram, Facebook et le site web existaient déjà dans les Réglages mais n'étaient affichés nulle part.

**Planning** — bouton « Aujourd'hui » (il existait, mais caché derrière la plage de dates), passé masqué aux clients, crédits restants visibles.

**Mes réservations** — liste strictement chronologique, pack rappelé sur chaque ligne. Le regroupement par pack dispersait les dates : une séance pouvait passer inaperçue sous un pack plus bas dans la page.

**Inscription** — un écran de confirmation remplace le message fugace. Le membre voyait un toast de quelques secondes puis retombait sur la connexion, essayait de se connecter, échouait, et concluait à une panne.

### Avis sur les cours

Demande des coachs. La question « qui peut noter quoi » se règle en base : l'avis s'attache à une **réservation**, pas à un cours. Il faut avoir été inscrit, la réservation doit être confirmée, le cours terminé — trois conditions qui rendent impossible de noter une séance à laquelle on n'est pas allé.

Anonyme pour le coach, nominatif pour l'admin. Un membre qui reverra son coach mardi ne note pas franchement s'il sait être identifié ; mais un avis intraçable n'engage personne.

La demande vit dans le bloc communications de l'accueil et disparaît d'elle-même passé un délai réglable — sept jours par défaut. Il était d'abord figé à trente dans le code : une demande qui insiste un mois se fait ignorer, puis agace.

### Suppression de compte

Exigée par Apple depuis 2022 pour publier, et par le RGPD. Deux versions : le membre depuis son profil, le studio depuis la fiche membre.

La cartographie des clés étrangères a montré qu'une vraie suppression était impossible : `registration_fees`, `subscriptions` et `performances` sont en `CASCADE` — les traces de paiement seraient parties avec le compte, ce que le droit comptable belge interdit (sept ans).

**On anonymise donc.** La personne disparaît, la comptabilité reste, détachée de toute identité. C'est exactement ce que prévoit l'article 17.3(b) du RGPD. Un abonnement actif bloque la fermeture : sans compte, le membre ne pourrait plus le résilier et continuerait d'être prélevé.

### Clients professionnels — paiement sur facture

Une entreprise ne paie pas par carte : elle commande, reçoit une facture, règle selon ses délais. **Le pack est crédité immédiatement** — l'employé doit pouvoir s'entraîner sans attendre le circuit comptable de son employeur.

C'est un paiement à terme, la norme en B2B, et cela veut dire que le studio porte le risque d'impayé. Décision assumée : aucun automatisme de relance ni de suspension.

Seul un admin qualifie un profil en B2B, et le contrôle est côté serveur — un particulier qui appellerait la fonction directement obtiendrait sinon des séances gratuitement.

Deux choix de conception méritent d'être notés :

**Pas de catégorie « B2B ».** Le filtre suit `is_business`, sans catégorie dédiée. Deux marqueurs pour le même fait auraient fini par diverger, et un membre oublié en catégorie serait tombé sur un paiement Stripe inattendu.

**Pas de verrouillage de la bascule.** Passer de B2B à B2C ne casse rien : les packs restent valides, les factures restent dues, seul le mode de paiement des futures commandes change. Verrouiller aurait empêché de corriger une simple erreur de saisie. Un avertissement signale les factures ouvertes, sans bloquer.

L'écran de suivi filtre sur ce qui compte quand on facture — payée ou non, pas « traitée ». Le numéro et la date de facture, attribués dans Odoo, se saisissent **à tout moment** : ils sont connus à l'émission, souvent des semaines avant le règlement.

> **La facture ne se crée pas dans l'application.** Elle se crée dans Odoo, qui tient la comptabilité. L'application enregistre la commande, crédite le pack, et garde trace de ce qu'Odoo lui dit. La suite attendue est un **export** vers Odoo, pas une génération de document ici.

### Prérequis App Store

Compte Apple Developer au nom propre de Christian. La commission de 30 % ne s'applique pas à Back On Track — règle 3.1.3(e), biens et services physiques : un cours se consomme au studio.

Les deux prérequis bloquants sont levés : suppression de compte depuis l'application, et politique de confidentialité avec URL publique.

### Mentions légales : saisies une fois, injectées partout

Les coordonnées du studio manquaient depuis le début, et bloquaient trois choses à la fois : les CGV, la politique de confidentialité et la facturation.

Elles ne sont pas codées en dur ni répétées dans chaque document : elles vivent dans les Réglages, et les documents portent des repères `{{studio_address}}` remplacés à l'affichage. Une adresse qui change se corrige **à un seul endroit** — les répéter dans deux fichiers aurait garanti qu'un des deux finisse par mentir.

Un champ vide affiche « (à compléter dans les Réglages) », et l'écran liste ce qui manque. Sans cela, un document afficherait un trou sans que personne le sache.

### Coupons : enfin utilisables

Le champ de saisie **n'existait nulle part**. On pouvait créer des coupons avec dates et limite d'usage, le serveur savait traiter un code — mais aucun écran ne permettait d'en entrer un. Le défaut était signalé depuis le 6 août.

Il vit désormais dans la confirmation d'achat, au moment de payer. Il n'apparaît donc jamais chez un client professionnel : ce n'est pas une règle codée, c'est une conséquence de l'endroit où le champ est placé.

Le code est **vérifié avant** le paiement. Découvrir un refus sur la page Stripe, sans explication, fait abandonner l'achat : `check_coupon` annonce la remise et nomme la raison d'un refus.

Restriction par catégorie ajoutée — aucune ligne = ouvert à tous, le cas nominal qu'on ne doit pas avoir à déclarer.

### Types de cours : un seul champ dangereux

L'édition existait et fonctionnait. Ce qui manquait, ce sont les garde-fous — et un seul champ le méritait.

Changer le **type de crédit** rendrait incompatibles les packs qui ont déjà payé les réservations : le membre a consommé un crédit d'un type, le cours en réclamerait un autre. Les données le confirmaient : 157 cours planifiés sur « BackOnTrack », 58 à venir.

Le verrou est posé **en base**, par trigger, et ne touche que ce champ : renommer ou redécrire un cours très utilisé reste possible sans condition. L'écran affiche le champ grisé avec le nombre de cours concernés — l'admin le sait avant, il ne le découvre pas sur un refus.

> Verrouillé dès qu'un cours est **planifié**, pas seulement réservé : un cours annoncé au planning est une promesse commerciale.

### Communications : marquer lu sans ouvrir

Une communication ne se marquait lue qu'en la **cliquant** — ce qui navigue ailleurs. Celle qu'on a lue en diagonale emmenait donc le membre sur une autre page pour être classée.

Une coche par ligne, un filtre « Tout / Non lues », et « Tout marquer lu ». Les boutons n'apparaissent que s'ils servent.

### Documentation et outillage

`install.sql` avait pris du retard sur toute la journée : une table, cinq fonctions, un trigger, quatre colonnes, deux index et un réglage manquaient. Remis à niveau, vérifié objet par objet contre la base — 25 tables, 42 fonctions, aucun écart.

> **Règle posée** : toute migration se reporte dans `install.sql` **au même commit**. Le rattrapage différé a échoué deux jours de suite.

`check-schema.sql` et `check-policies.sql` couvrent désormais les objets du jour. L'audit des policies signalait 13 manques — après vérification, **aucun n'était réel** : trois tables avaient des policies renommées, et `user_roles` n'a volontairement que des policies de lecture depuis le durcissement du 6 août.

---

## Session du 2026-08-06

33 commits. Journée d'usage réel : Christian teste, signale, on corrige. La plupart des trouvailles viennent de là.

### Le fil rouge — trois bugs, une seule cause

Trois écrans cassés dans la journée, tous pour la même raison : **une policy décrite dans `install.sql` mais jamais appliquée à la base**.

| Symptôme | Policy manquante |
|---|---|
| « Aucun membre avec des crédits » alors qu'ils en ont | `Purchases: coach read all` |
| Un coach annule son cours, rien ne se passe | `Classes: coach update own` |
| — | `Subscriptions: coach read` |

Le mécanisme est toujours le même : la requête est refusée, **le code n'écoute pas l'erreur**, l'écran conclut « aucun résultat ». Dans le cas de l'annulation, c'était pire — le journal s'écrivait et les crédits partaient pendant que le cours restait planifié.

Deux enseignements consignés dans la documentation technique : **toujours tester `error` après une écriture**, et l'outil `supabase/check-policies.sql` qui compare l'attendu au réel.

### Les rôles

Impossible jusqu'ici de désigner un coach depuis l'application : il fallait écrire en base. Un studio ne pouvait pas recruter sans développeur.

Un admin désigne les coachs, seul un super admin promeut un admin. La hiérarchie est appliquée **côté base** — les anciennes policies laissaient tout admin se créer un pair. Deux garde-fous : on ne retire pas ses propres droits, et le dernier super admin est intouchable.

### L'espace coach devient autonome

- **Inscrire un membre** dans ses cours, via `book_member_by_staff` qui **ignore le délai de fermeture** : quelqu'un se présente, il reste de la place, le coach décide
- **Annuler un de ses cours**, avec confirmation qui nomme les inscrits
- **Périodes calendaires** — cette semaine (du lundi), ce mois-ci — avec flèches de navigation
- **Filtres par statut** et chiffres `présents/inscrits/capacité`

### Les statuts de cours

Sept états, recalculés à chaque affichage, jamais stockés :

> planifié · effectif à surveiller · **exécuté** · présences à valider · **décision attendue** · sans inscrit · annulé

Deux décisions de Christian ont façonné cette liste :

**« Exécuté » exige le pointage.** Sans présence pointée, personne ne sait si le cours a eu lieu — le badge reste orange. L'absence de confirmation devient l'information utile.

**« Décision attendue » n'est pas un statut, c'est une anomalie.** Un cours passé avec des inscrits sous le seuil, sans pointage ni annulation : des gens ont consommé un crédit sans qu'on sache s'ils ont eu leur cours. Seul badge rouge, et un bandeau dans le planning force le choix — pointer ou annuler.

### Ce que les places payées révèlent

Question de Christian : *« une personne qui s'est désinscrite trop tard mais n'est pas venue, on la compte où ? »*

Elle disparaissait de tous les comptages, qui ne retenaient que `confirmed`. Résultat : remplissage sous-estimé, cours pouvant basculer « non donné » alors qu'il avait eu lieu, désistements invisibles.

Règle retenue : **une place occupée et payée compte comme inscrite, seule la présence réelle compte comme venue**. `cancel_booking_v2` marque désormais `is_no_show` quand le crédit n'est pas restitué.

### Modifier un cours qui a des inscrits

Le membre recevait « un cours a été modifié » sans savoir quoi. Le code détectait pourtant précisément le changement — il ne le disait pas.

L'e-mail nomme désormais ce qui change. Et pour un changement **d'horaire ou de type** — la prestation n'est plus la même — l'admin est averti avant de sauver, et le membre reçoit une proposition explicite de renoncer **avec restitution quel que soit le délai** (`decline_modified_booking`). Sans cette fonction dédiée, la promesse aurait été fausse : l'annulation ordinaire aurait appliqué le délai de prévenance.

### Performance

Le planning admin chargeait **tous les cours de la base** sans borne de date, puis toutes leurs réservations, avant de filtrer côté navigateur. Il ne charge plus que la période affichée, avec un mois de marge.

### Documentation

Les trois documents sont à jour : guide du membre, guide coach & admin (fortement remanié), documentation technique. `install.sql` a été remis à niveau deux fois — une reconstruction complète, puis un rattrapage des migrations du jour.

### Reporté

**Rémunération des coachs.** Prix par cours donné, distinct selon le type de crédit, avec historique pour produire un rapport de facturation. Recommandation retenue : **figer le montant sur chaque cours** plutôt que gérer des périodes tarifaires — le rapport devient une somme, l'historique ne bouge plus, et les cas particuliers se corrigent au cas par cas. Deux questions restent ouvertes : le tarif varie-t-il d'un coach à l'autre, et le montant se fige-t-il à la création du cours ou quand il est donné ?

Module à part, sans urgence : la gestion se fait hors application aujourd'hui.

---

## Session du 2026-08-05

13 commits (`45c54f1` → `537a0f7`), tous poussés. Deux chantiers : les abonnements branchés de bout en bout, puis le parrainage.

### 1. Le pont Stripe — enfin opérationnel

Bac à sable **`bot2`** créé sur le compte Stripe existant, isolé de l'autre application en production. Cinq Edge Functions déployées, destination webhook configurée, `stripe_mode = test`.

> **Le webhook n'avait jamais été déployé.** C'était le « maillon manquant » noté le 4 août : un paiement réussi ne créditait rien. Il crédite désormais réellement.

**Validé en test réel** : frais d'inscription, achat de pack, souscription d'abonnement, réduction ponctuelle, report d'échéance, résiliation immédiate.

### 2. Trois bugs préexistants, trouvés en testant

| Bug | Conséquence |
|---|---|
| **API Stripe récente** (`2026-07-29.dahlia`) : `current_period_*` a migré vers `items.data[0]`, `invoice.subscription` sous `invoice.parent` | Erreur 500 `"Invalid time value"`, aucun crédit. Le code lisait la racine des objets, vide depuis. |
| **Ordre de livraison non garanti** : `invoice.paid` est arrivé **une seconde avant** `checkout.session.completed` | L'abonnement n'existait pas encore, le webhook est sorti en 200 sans rien créditer. Même piège que le `saveSetting()` du 4 août : un `UPDATE` sans ligne ne renvoie pas d'erreur. |
| **Facture à 0 €** émise par `trial_end` lors d'un report d'échéance | Comptée comme un cycle payé → **un second pack** créé pour un seul paiement. |

### 3. Écrans d'abonnement

- **Page Packs** regroupée par **type de crédit** (semi-privé, personal training…), abonnements puis packs à l'intérieur. Le type est rappelé sur chaque carte : Christian avait lui-même acheté un pack PT là où il fallait du semi-privé, sans que rien ne le signale.
- **Mes packs** : carte d'abonnement avec les crédits du cycle **intégrés dedans** — affichés à côté, ils passaient pour un doublon.
- **Résiliation en libre-service**, un seul abonnement à la fois (refus serveur en 409).
- **Fiche membre admin**, onglet Abonnement : réduction ponctuelle, report d'échéance, suspension/reprise, résiliation.

Deux décisions de fond :
- **Le report d'échéance prolonge le pack d'autant.** Une maladie déclarée en milieu de cycle ne se met pas en pause, elle se compense — couper l'accès ne protège rien, la personne empêchée ne vient pas.
- **La résiliation immédiate clôture aussi les accès.** L'avertissement affiché à l'admin (« le membre perd immédiatement l'accès ») était jusque-là mensonger.

### 4. Réservation : choix de la source

Le code prenait `credits[0]` sans que personne ne choisisse. Une **pop-up de confirmation** s'ouvre désormais à chaque réservation ; quand plusieurs sources du même type existent, le membre choisit laquelle consommer — un abonné qui invite quelqu'un prend un crédit de pack.

Le message de refus est explicite : « tes crédits X sont épuisés » ou « ce cours demande un crédit X », au lieu d'un « aucun crédit » trompeur.

`get_available_credits` place maintenant **l'abonnement en tête** : l'ancien tri épuisait les packs payés en plus alors que l'abonnement couvrait déjà.

### 5. Parrainage — la qualification n'existait pas

Vérification faite dans le webhook, le code applicatif et les triggers : **rien ne faisait jamais passer un parrainage de `pending` à `qualified`**, et rien n'écrivait dans `referral_rewards`. Les écrans affichaient des compteurs voués à rester à zéro. `regles-coupons-parrainage.md` décrivait une intention, pas le code.

Même constat pour les **coupons** : l'admin peut en créer, le serveur sait les traiter, mais **aucun écran ne permet d'en saisir un**. Ils sont inutilisables depuis toujours.

La fonction `check_referral_qualification()` existait pourtant, complète, dans `supabase/_archive/phase6.sql` — écrite puis archivée et jamais appelée. Reprise avec la règle retenue : **qualification au premier achat payé** (l'ancienne exigeait un pack d'au moins 10 séances).

**Deux trous de sécurité fermés.** La phase 6 laissait `rewards_insert` et `referrals_insert` en `WITH CHECK (true)` : n'importe quel membre authentifié pouvait **se créer un bon d'achat du montant de son choix**, ou s'attribuer un parrain arbitraire.

### 6. Bons d'achat — le modèle unifié

Cadrage complet dans **`docs/cadrage-bons-achat.md`**. Le parrainage devient un producteur de bons parmi d'autres.

Trois objets distincts : le **coupon collectif** (`RENTREE2026`, quota global), le **code de parrainage** (permanent, réutilisable), le **bon d'achat** (nominatif, consommé en une fois).

Règles : tout ou rien (pas de solde partiel), un seul bon par achat, bon **proposé et non imposé**, avec un avertissement chiffré s'il vaut plus que l'achat — le membre choisit de perdre la différence ou de reporter.

Le cas nominal fonctionne : **30 € de bon sur 30 € de frais d'inscription** → rien à payer, et l'enregistrement se fait sans Stripe, qui refuse les sessions à 0 €.

Sur un abonnement, c'est Stripe qui soustrait via un coupon `duration: 'once'` : **le prix récurrent n'est jamais modifié**.

Le filleul peut saisir le code à trois moments : à l'inscription, **au moment de payer** (nouveau — beaucoup l'oublient à l'inscription), ou par le studio après coup.

Nouvel onglet **Bons** sur la fiche membre : état du parrainage, rattachement d'un parrain, et **attribution d'un bon à la main**. Un coach ne pouvait rien offrir à quelqu'un sans abonnement — l'action `discount` en exigeait un.

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

## État de la Phase 12 — abonnements : LIVRÉE

Tout est en place et poussé. Ce qui a été validé en test réel le 2026-08-05 :
frais d'inscription, achat de pack, souscription d'abonnement, réduction
ponctuelle, report d'échéance, résiliation immédiate.

### Reste à tester

- **Renouvellement automatique** (scénario 4) via *test clock* Stripe — jamais éprouvé
- **Suspension / reprise** d'abonnement
- **Bouton de remise à zéro** : la fonction `reset_member_purchases` n'a pas encore été créée en base (SQL dans `supabase/migrations/20260805_reset_member_test_data.sql`)

### Non fait, à décider

- **Configuration Stripe pour super admin** : état de la connexion, mode test/live, bouton « tester la connexion ». Les clés restent des secrets Supabase, jamais affichées.

---

## État du parrainage & des bons d'achat : LIVRÉ, NON TESTÉ

Migration appliquée en base, fonctions déployées, écrans en place. **Rien n'a
encore été testé** — c'est le premier travail de la prochaine session.

### Le scénario complet à jouer

1. Récupérer un code : `SELECT display_name, referral_code FROM profiles LIMIT 5;`
2. Inscrire un nouveau compte **avec ce code**
3. Payer les frais d'inscription (carte `4242 4242 4242 4242`)
4. Vérifier la qualification :

```sql
SELECT status, qualified_at FROM referrals ORDER BY created_at DESC LIMIT 1;
SELECT code, user_id, amount_cents, origin, is_used, expires_at
FROM referral_rewards ORDER BY created_at DESC LIMIT 2;
```

Attendu : statut `qualified`, et **deux bons** de 3000 centimes (parrain + filleul).

5. **Utiliser un bon** sur un achat de pack : il doit être proposé avec le détail du calcul
6. **Cas nominal du parrainage** : un bon de 30 € sur des frais d'inscription à 30 € → aucun paiement, tout se règle sans Stripe
7. **Cas de la perte** : un bon de 30 € sur la carte séance unique à 25 € → l'avertissement doit annoncer les 5 € perdus
8. **Bon sur abonnement** : première échéance réduite, **les suivantes au tarif plein** (c'est le point le plus important à vérifier)
9. **Saisie du code au paiement** par un membre sans parrain
10. **Outils admin** : rattacher un parrain, accorder un bon d'achat

### Points de vigilance pour ces tests

- Un bon ne doit être consommé **qu'après paiement confirmé** : abandonner la page de paiement Stripe ne doit pas le faire disparaître
- Le rejeu d'un événement Stripe ne doit pas créer de bons en double ni consommer deux fois (les fonctions sont idempotentes, à vérifier)
- Un membre ne peut avoir qu'un seul parrain

### Non fait

- **Champ de saisie d'un coupon collectif** — les coupons restent inutilisables : l'admin peut en créer, le serveur sait les traiter, mais aucun écran ne permet d'en saisir un. À décider avec les coachs (cf. `docs/cadrage-bons-achat.md`).
- **Affichage des bons sur la page Parrainage client** : l'écran lit `referral_rewards` mais ignore les nouveaux champs (`code`, `origin`).
- **Mise à jour de `regles-coupons-parrainage.md`**, qui décrit encore l'ancienne règle (pack ≥ 10 séances) et une qualification qui n'existait pas.

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

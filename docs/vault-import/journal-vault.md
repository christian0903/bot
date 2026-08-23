---
type: journal
role-fichier: journal
parent-projet: "[[__P-website-bot]]"
domaine: "[[_Back on Track]]"
statut: en-cours
date-creation: 2026-08-08
date-maj: 2026-08-08
auteur: "[[@Christian Vanhenten]]"
tags:
  - app
  - back-on-track
  - developpement
  - journal
---

# Journal — App Back On Track

> Chronologie du projet côté vault. Le détail technique session par session vit avec le code, dans `~/bot/docs/journal-projet.md` : ce fichier donne la vue d'ensemble et retient les décisions.

## Vue d'ensemble

246 commits, version 2.54.0 au 2026-08-07. Le développement s'est fait par vagues serrées plutôt qu'en continu : quatre journées denses en avril-mai, puis une semaine intensive début août qui a porté 106 commits à elle seule.

| Période | Commits | Ce qui s'y est joué |
|---|---|---|
| 2026-04-06 → 04-08 | 34 | Socle : comptes, packs, planning, réservations, liste d'attente |
| 2026-04-19 → 04-20 | 88 | Admin, statistiques, notifications, journal d'activité, événements |
| 2026-05-11 → 05-13 | 18 | Consolidation |
| 2026-06-02 | — | Recueil du besoin abonnement auprès des coachs |
| 2026-08-03 → 08-07 | 106 | Stripe, abonnements, B2B, avis, performances, App Store |

## 2026-06-02 — Le recueil du besoin abonnement

Dispositif monté pour recueillir le besoin des trois coachs sur le passage à un modèle d'abonnement mensuel récurrent (mois = 4 semaines) : questionnaire en 11 thèmes et 3 décisions structurantes, consigne d'enregistrement pour Gauthier, grille d'analyse en 44 points.

**Cette phase est close.** Le dossier fonctionnel abonnement en est issu (`~/bot/docs/dossier-fonctionnel-abonnement.md`), et le système a été développé, livré et éprouvé en août.

## 2026-08-03 / 04 — Le socle de paiement

**Mollie abandonné au profit de Stripe.** Décision structurante : le plan d'implémentation prévoyait une migration vers Mollie, elle n'aura pas lieu.

Sept bugs préexistants découverts en travaillant sur autre chose, tous de la même famille — le code croyait avoir écrit, la base disait non, personne n'écoutait. Le plus lourd : **`stripe-webhook` n'avait jamais été déployé**. Un paiement réussi ne créditait rien. Maillon manquant de toute la chaîne.

Autres trouvailles notables : `saveSetting()` faisait un `UPDATE` puis un `INSERT` de secours *en cas d'erreur* — or un `UPDATE` sur une clé absente ne renvoie pas d'erreur, il touche zéro ligne. Aucun nouveau paramètre n'était enregistré, et « Paramètres enregistrés » s'affichait quand même. Et un cours annulé par le studio à moins de 24 h privait les inscrits de leur crédit, alors que le message promettait la restitution.

Livré au passage : validité en semaines dans l'interface, onglet Annulations compté par cycle, statuts de cours dérivés (jamais stockés), redirection par rôle à la connexion, tableau de bord personnel du coach.

## 2026-08-05 — Le pont Stripe opérationnel

Bac à sable **`bot2`** créé sur le compte Stripe, isolé de l'autre application en production — sans quoi les webhooks se croisent, le mode test étant partagé entre tous les projets d'un compte. Cinq Edge Functions déployées, webhook configuré.

**Validé en test réel** : frais d'inscription, achat de pack, souscription d'abonnement, réduction ponctuelle, report d'échéance, résiliation immédiate.

Trois bugs trouvés en testant, dont deux instructifs : l'API Stripe récente (`2026-07-29.dahlia`) a déplacé `current_period_*` vers `items.data[0]` — le code lisait une racine devenue vide ; et **l'ordre de livraison des événements n'est pas garanti** : `invoice.paid` est arrivé une seconde avant `checkout.session.completed`, l'abonnement n'existait pas encore, le webhook est sorti en 200 sans rien créditer.

**Deux trous de sécurité fermés** : la phase 6 laissait `rewards_insert` et `referrals_insert` en `WITH CHECK (true)` — n'importe quel membre authentifié pouvait se créer un bon d'achat du montant de son choix, ou s'attribuer un parrain arbitraire.

Décisions de fond : le report d'échéance **prolonge le pack d'autant** (couper l'accès ne protège rien, la personne empêchée ne vient pas) ; la résiliation immédiate clôture aussi les accès (l'avertissement affiché à l'admin était jusque-là mensonger).

## 2026-08-06 — Les rôles et l'autonomie du coach

33 commits. Journée d'usage réel : Christian teste, signale, on corrige.

Trois écrans cassés, une seule cause — **une policy décrite dans `install.sql` mais jamais appliquée à la base**. Le mécanisme est toujours le même : la requête est refusée, le code n'écoute pas l'erreur, l'écran conclut « aucun résultat ». Dans le cas de l'annulation, c'était pire : le journal s'écrivait et les crédits partaient pendant que le cours restait planifié.

**Gestion des rôles depuis l'application** — il fallait jusque-là écrire en base : un studio ne pouvait pas recruter sans développeur. Un admin désigne les coachs, seul un super admin promeut un admin, hiérarchie appliquée côté base. Deux garde-fous : on ne retire pas ses propres droits, et le dernier super admin est intouchable.

**L'espace coach devient autonome** : inscrire un membre (en ignorant le délai de fermeture — quelqu'un se présente, il reste de la place, le coach décide), annuler son cours, périodes calendaires, filtres par statut.

**Sept statuts de cours**, recalculés à chaque affichage, jamais stockés. Deux décisions les ont façonnés : « exécuté » exige le pointage — sans présence pointée, personne ne sait si le cours a eu lieu, et l'absence de confirmation devient l'information utile. Et « décision attendue » n'est pas un statut mais une **anomalie** : un cours passé, avec des inscrits sous le seuil, ni pointé ni annulé — des gens ont consommé un crédit sans qu'on sache s'ils ont eu leur cours.

Question de Christian ce jour-là : *« une personne qui s'est désinscrite trop tard mais n'est pas venue, on la compte où ? »* Elle disparaissait de tous les comptages. Règle retenue : **une place occupée et payée compte comme inscrite, seule la présence réelle compte comme venue.**

**Rémunération des coachs reportée** — module à part, la gestion se fait hors application.

## 2026-08-07 — La journée la plus dense

37 commits (v2.17.0 → v2.53.0). Journée nourrie par les retours de deux coachs, l'un récent, l'autre plus ancien.

**Le fil rouge** : quatre bugs distincts, une même forme — le code croyait avoir écrit, la base disait non. Aucun ne se voyait à l'écran. Le plus instructif : `cancel_booking_v2` renvoyait son refus *dans* son retour sans lever d'erreur — `error` restait `null`, le code passait dans la branche de succès, l'écran affichait « annulée » alors que rien n'avait bougé. D'où la règle : **tester le retour autant que `error`**.

**La séance d'essai refondue.** Elle était écrite dans une table à part que ni « Mes réservations », ni l'accueil, **ni la liste de présence du coach** ne consultaient : des personnes étaient attendues au studio sans que personne ne le sache. La cause était structurelle — `bookings.pack_purchase_id` était `NOT NULL`, et un essai n'a pas de pack derrière lui. L'essai est devenu un vrai pack gratuit, donc une réservation ordinaire, visible partout sans qu'aucun écran soit modifié.

**Les communications remontent sur l'accueil.** Un audit des 14 points d'envoi d'e-mail a montré que **6 ne laissaient aucune trace** dans l'application — or tout le monde ne lit pas ses e-mails. Le helper `notifyMember` inverse l'ordre : la notification part toujours, l'e-mail n'est qu'un rappel. Écarter n'est pas supprimer : `dismissed_at` retire la ligne de l'écran du membre mais la conserve — en cas de contestation, elle prouve la transmission.

**Le renouvellement d'abonnement éprouvé au test clock** sur 28 jours. Le mécanisme est sain, mais le test a trouvé deux défauts réels, dont un grave : le webhook rejetait tout depuis une heure (401), `verify_jwt` ayant été remis à `true` au redéploiement. Entre 11 h et midi, tout paiement aurait été encaissé sans rien créditer — **panne totalement silencieuse**.

**Performances.** Le coach demandait des graphiques ; l'obstacle n'était pas technique mais dans les données — sur 57 valeurs saisies, **2 seulement** étaient des nombres purs. Deux informations manquaient au niveau du mouvement : la nature de la mesure et le sens du progrès. Pour une charge, monter c'est mieux ; pour un chrono, descendre. Les courbes inversent l'axe sur un chrono pour que « ça monte » veuille toujours dire « je progresse ».

**Suppression de compte** — exigée par Apple depuis 2022 et par le RGPD. La cartographie des clés étrangères a montré qu'une vraie suppression était impossible : `registration_fees`, `subscriptions` et `performances` sont en `CASCADE`, les traces de paiement seraient parties avec le compte — ce que le droit comptable belge interdit (sept ans). **On anonymise donc** : la personne disparaît, la comptabilité reste, détachée de toute identité (article 17.3(b) du RGPD).

**Clients professionnels.** Une entreprise ne paie pas par carte : elle commande, reçoit une facture, règle selon ses délais. Le pack est crédité immédiatement — l'employé doit pouvoir s'entraîner sans attendre le circuit comptable de son employeur. Le studio porte donc le risque d'impayé : décision assumée, aucun automatisme de relance ni de suspension. **La facture ne se crée pas dans l'application** : elle se crée dans Odoo. La suite attendue est un export, pas une génération de document.

**Coupons enfin utilisables** — le champ de saisie n'existait nulle part. On pouvait en créer, le serveur savait les traiter, mais aucun écran ne permettait d'en entrer un.

**Mentions légales** — les coordonnées du studio manquaient depuis le début et bloquaient trois choses à la fois : CGV, politique de confidentialité, facturation. Elles vivent désormais dans les Réglages, injectées par repères `{{studio_address}}` : une adresse qui change se corrige à un seul endroit.

**Prérequis App Store levés.** Compte Apple Developer au nom propre de Christian. La commission de 30 % ne s'applique pas — règle 3.1.3(e), biens et services physiques.

En fin de journée, `install.sql` avait pris du retard sur toute la journée : une table, cinq fonctions, un trigger, quatre colonnes, deux index et un réglage manquaient. **Règle posée** : toute migration se reporte dans `install.sql` au même commit.

## 2026-08-08 — Remise en ordre de la documentation vault

Le fichier maître du projet datait du 2 juillet et décrivait un projet au stade « recueil du besoin auprès des coachs », alors que le système d'abonnement était livré, éprouvé et suivi de six autres chantiers. Il indiquait par ailleurs un chemin de code (`/Volumes/TERRAMASTER-2Tb/_LocalSites/bot/`) qui n'existe plus.

Fichier maître réécrit à l'état réel, ce journal créé, et le projet rattaché au domaine [[_Back on Track]] — les deux volets, l'accompagnement organisationnel du studio et l'application, se rejoignent désormais depuis un point d'entrée unique.

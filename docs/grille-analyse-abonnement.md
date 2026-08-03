# Grille d'analyse — transcription(s) coach → couverture du questionnaire abonnement

> **Usage (pour Christian + Claude analyste).** Une fois la transcription de Gauthier (et/ou des 3 coachs) disponible, on remplit cette grille : chaque point du `questionnaire-abonnement.md` reçoit un statut et la citation/source qui le justifie. Objectif : voir d'un coup d'œil ce qui est **tranché**, ce qui est **flou**, ce qui **manque**, et générer les relances ciblées — sans reposer 44 questions.

> **État : remplie le 2026-08-03** à partir de la transcription de la réunion à 3 voix (Christian = Speaker 3, et les deux coachs-associés = Speakers 1 et 2). Les réponses Stripe (vérifiées en doc officielle le même jour) sont intégrées là où elles débloquent une décision.

## Légende des statuts
- ✅ **Répondu** — décision claire, exploitable telle quelle pour le dev.
- 🟡 **Partiel** — sujet abordé mais incomplet, ambigu, ou une seule des sous-options couverte.
- ❌ **Manquant** — pas évoqué du tout.
- ⚠️ **Conflit** — les coachs ne sont pas d'accord entre eux (à arbitrer par Christian).

## Méthode
1. Lire la (les) transcription(s).
2. Pour chaque ligne : statut + **citation** (verbatim court) ou note de synthèse + source (quel coach, si plusieurs).
3. Traiter EN PRIORITÉ le bloc « Décisions structurantes » — si l'une est ❌ ou ⚠️, c'est bloquant.
4. Compiler les lignes 🟡/❌/⚠️ → liste de **relances** (pour Christian, ou à renvoyer au(x) coach(s)).
5. Quand le taux de ✅ est suffisant sur les structurantes → produire le **dossier fonctionnel** (cf. bas de page).

---

## Le basculement principal de la réunion

Avant le détail : la réunion a produit **un renversement de conception** qui rend une partie du questionnaire caduque.

L'abonnement n'est **pas une nouvelle entité** à côté des packs. C'est **un pack court avec renouvellement automatique**. Le système de packs existant (déjà développé, phases 1-10) est conservé tel quel ; on lui ajoute le renouvellement Stripe et on crée des packs de 4 semaines.

> Speaker 3 : « Il suffit de dire qu'on ne prend plus les packs longs, on prend les packs courts et on fait un renouvellement automatique. »
> Speaker 3 : « Vous faites un pack, les personnes veulent une fois par semaine, vous faites un pack mensuel, 4 séances et renouvelable automatique. C'est un abonnement. Mais c'est un pack. »

Conséquence directe sur le dev : **pas de nouveau moteur de quota**. Le décompte de crédits existe déjà et fonctionne. Ce qui est à construire, c'est la couche Stripe (abonnement récurrent + webhook qui recharge le pack) et les écrans admin qui vont avec.

> Speaker 3 : « c'est le système actuel avec presque rien de plus. La seule chose est que vous construisez des packs et vous l'appelez abonnement mensuel à la place de l'appeler pack. »

Principe directeur affiché tout au long de la réunion, à garder en tête pour arbitrer les cas limites :

> Speaker 3 : « une application complexe, c'est une fabrique à emmerdes »
> Speaker 3 : « il faut vraiment réfléchir à c'est quoi qui va se passer souvent et qu'est-ce qui se passera exceptionnellement. Alors l'exception, il ne faut pas l'inscrire. »

**L'exception se gère à la main, pas dans le code.** C'est la règle d'arbitrage de tout ce document.

---

## A. Décisions structurantes (bloquantes — à traiter d'abord)

| # | Décision | Statut | Ce qui a été dit (citation / synthèse + source) | Relance éventuelle |
|---|----------|:--:|---|---|
| S1 | Semaine **glissante ou calendaire** (Q1.1) | ✅ | **Question dissoute par le basculement pack.** Il n'y a plus de quota hebdomadaire à faire respecter : c'est un pack de N crédits valable 28 jours, consommables librement. Sp1 : « Reconduction tous les 28 jours. Ou toutes les 4 semaines. » Sp1 : « 28, ça représente 4 semaines. Tu sais que tu as un bac de 4 crédits pour 4 semaines. » → **Formule B retenue, Formule A abandonnée.** | — |
| S2 | Séances non consommées **perdues ou reportées** (Q3.1 + 3.2) | ✅ | **Perdues.** C'est le comportement actuel des packs (crédits valables sur la durée du pack), conservé tel quel. Confirmé indirectement : Sp2 anticipe la réclamation — « moi j'ai 4 séances sur un mois mais finalement ce mois-ci j'en ai fait que 2 » — et la réponse retenue n'est pas le report mais la gestion humaine au cas par cas, arbitrée avec l'historique d'annulations. | Confirmer explicitement auprès des coachs que rien ne se reporte (jamais formulé en une phrase). |
| S3 | Annulation client : **délai limite + recrédit** (Q4.1/4.2/4.3) | ✅ | **Déjà développé et en place.** Sp2 : « on avait expliqué le système annulation en tout 24 heures, tu perds l'office de crédit » — Sp3 : « ça c'est déjà dedans ». Délai paramétrable dans les settings. Annulation > 24h = recrédit ; < 24h = séance consommée, le client étant prévenu. | — |

**Les trois structurantes sont tranchées.** La Phase 12 est débloquée.

---

## B. Couverture détaillée des 11 thèmes

### 1. Définition de la "semaine" (Formule A)
| # | Point | Statut | Dit (citation/synthèse + source) | Relance |
|---|---|:--:|---|---|
| 1.1 | Calendaire / glissante souscription / glissante dernière résa | ✅ | **Sans objet — Formule A abandonnée.** Le produit retenu est un pack de N crédits sur 28 jours, sans contrainte de répartition hebdomadaire. Sp1 : « 1, 2, 3 et illimités. Donc 4, 8, 12 et illimités » — un quota total, pas un rythme imposé. | — |
| 1.2 | Si calendaire : jour de départ de la semaine | ✅ | Sans objet (idem 1.1). | — |
| 1.3 | Souscription samedi → samedi + lundi possible ? | ✅ | Sans objet — oui par construction, le client répartit ses crédits comme il veut sur les 28 jours. | — |

### 2. Cycle d'abonnement (mois = 4 semaines)
| # | Point | Statut | Dit | Relance |
|---|---|:--:|---|---|
| 2.1 | Renouvellement automatique à 4 semaines | ✅ | **Oui — c'est le cœur du besoin.** Sp3 : « le problème qu'on dirait que vous avez, c'est qu'il n'y a pas le renouvellement automatique. Ça ne fidélise pas et ça fait des rentrées en moins. » Sp1 : « C'est sur une durée trop longue et pas renouvelé automatiquement. » Sp1 : « Chez le client, il faut qu'il comprenne que c'est un abonnement et que ça se renouvelle automatiquement. » Cycle = **28 jours** (Sp1 : « je vote 28 »). **Stripe : `interval=week`, `interval_count=4` — validé.** | — |
| 2.2 | Résiliation à tout moment vs fin de période | 🟡 | Implicite : sans engagement, donc résiliable, avec droits jusqu'à la fin du cycle payé (cf. 2.4). Jamais formulé explicitement. | Confirmer : résiliation = arrêt du renouvellement, effet fin de cycle en cours. |
| 2.3 | Engagement minimum vs mois-le-mois | ✅ | **Mois le mois, sans engagement.** L'engagement long est explicitement rejeté sauf s'il est **payé d'avance en totalité** — Sp3 : « prendre un système d'un an où tu payes chaque mois, c'est de la blague. Parce que s'ils bloquent le paiement, vous êtes couillonné. » Sp3 : « si vous faites des conditions, c'est parce que les gens payent [d'avance] le paquet ». | — |
| 2.4 | Annulation en cours : droits jusqu'à fin payée | 🟡 | Cohérent avec le modèle pack (le pack payé reste consommable), mais non discuté. | Confirmer. |
| 2.5 | Date de prélèvement | ✅ | **Date anniversaire de la souscription**, pas date fixe du mois. Sp3 : « ils viennent le 15, ils prennent le 15. Ils viennent le 23, c'est le 23. Et puis tous les 23, ça va être payé. » | — |

### 3. Séances non consommées
| # | Point | Statut | Dit | Relance |
|---|---|:--:|---|---|
| 3.1 | Formule A : perdue / reportée / reportée avec plafond | ✅ | Sans objet (Formule A abandonnée). | — |
| 3.2 | Formule B : perdue à 4 sem / reportée cycle suivant | 🟡 | **Perdues** par continuité du système de packs actuel, mais jamais énoncé noir sur blanc. Le sujet est abordé par l'angle de la réclamation client, traitée humainement. | Faire confirmer en une phrase par les coachs — c'est une règle commerciale sensible. |
| 3.3 | Si report : date d'expiration des séances reportées | ✅ | Sans objet si pas de report. | — |

### 4. Annulation par le client
| # | Point | Statut | Dit | Relance |
|---|---|:--:|---|---|
| 4.1 | Délai limite sans pénalité (24/12/6h…) | ✅ | **24h, déjà paramétrable et en place.** Sp2 : « annulation en tout 24 heures, tu perds l'office de crédit ». Existe aussi un délai plancher pour s'inscrire — Sp2 : « si tu veux t'inscrire pour le lendemain à 8 heures c'est maximum plus que 20 heures » ; Sp3 : « il y a aussi un délai dans les paramètres, c'est dedans ». | — |
| 4.2 | Dans les délais : recrédit au quota | ✅ | Oui — comportement actuel confirmé. | — |
| 4.3 | Hors délai : séance consommée | ✅ | Oui — « tu perds d'office le crédit », le client étant prévenu. | — |
| 4.4 | Plafond d'annulations tardives/mois avant sanction | ✅ | **Pas de sanction automatique — décision explicite.** Sp3 : « en cas d'abus, ça vous devez gérer manuellement, parce qu'il n'y a pas de système qui va faire ça. » Sp1 : « il faut contacter la personne et juste qu'on en parle avec elle […] a priori, c'est un bon client. » **À la place : une statistique.** Sp3 : « tu devrais pouvoir demander une statistique qui dit tiens, cette personne-là, combien de fois elle s'est désinscrite ». → besoin de **reporting**, pas de blocage. | — |
| 4.5 | No-show : séance systématiquement consommée | ✅ | Oui (conséquence de 4.3 : pas d'annulation = crédit perdu). Le système de pénalité no-show évoqué par Sp2 (« tu peux plus réserver pendant X temps ») est **écarté** au profit du traitement humain (Sp3 : « c'est une emmerde »), d'autant que Sp2 constate : « les no-show, c'est quand même arrivé très rarement ». | — |

### 5. Annulation / report par les coaches (admin)
| # | Point | Statut | Dit | Relance |
|---|---|:--:|---|---|
| 5.1 | Recrédit auto / remplacement / les deux au cas par cas | ❌ | Non abordé dans cette réunion. | À poser — mais faible risque, le geste admin manuel est la position par défaut de la réunion. |
| 5.2 | Rattrapage : hors quota hebdo vs respecte le quota | ✅ | Sans objet — plus de quota hebdomadaire. Un rattrapage = un crédit ajouté au pack. | — |
| 5.3 | Rattrapage : date limite d'utilisation | ❌ | Non abordé. | À poser (probablement : validité du pack en cours). |
| 5.4 | Historique "offert en compensation du cours X" | ✅ | Couvert par le log existant. Sp3 : « j'ai mis un log file, un petit historique qui permettrait à la limite même de reconstituer toute opération ». | — |

### 6. Réservation et fonctionnement
| # | Point | Statut | Dit | Relance |
|---|---|:--:|---|---|
| 6.1 | Horizon de réservation à l'avance | ✅ | Paramétrable, déjà en place. | — |
| 6.2 | Réserver après la fin du cycle (pari renouvellement) | ❌ | Non abordé. Devient pertinent avec le renouvellement auto. | À poser. Défaut raisonnable : autorisé, puisque le renouvellement est automatique. |
| 6.3 | Illimité : limite de résas simultanées en attente | ✅ | **Non, pas de limite — décision explicite.** Sp2 : « on s'en fiche qu'un abonnement soit illimité […] si tout le monde paye mensuellement, ce n'est plus mon problème. Il faut juste que les gens puissent réserver des cours. » Implémentation confirmée par Sp3 : « Tu as un pack traditionnel, je fais moins 1. Tu as un pack illimité, je ne fais pas moins 1. […] mais j'enregistre la réservation. » → **l'illimité réserve et se désiste normalement, sans décompte, mais la trace est conservée** (pour la statistique de 4.4). | — |
| 6.4 | Cours réservés à certaines formules (premium) | ❌ | Non abordé. | À poser (faible priorité). |
| 6.5 | Liste d'attente + abonnement : auto-résa et conso quota | ❌ | Non abordé. | À poser si la liste d'attente existe déjà dans l'app. |

### 7. Cohabitation avec les packs
| # | Point | Statut | Dit | Relance |
|---|---|:--:|---|---|
| 7.1 | Packs à l'unité : maintenus ou retirés | ⚠️ | **Désaccord.** Sp3 : « Moi, je passerais sincèrement au système d'abonnement 1, 2, 3, illimité. » Sp2 : « Non, on garde toujours des cartes séances. » Sp1 : « J'ai la possibilité de payer les séances uniques. Donc une seule séance, tu la paies. » → **En pratique, la position convergente est : les deux coexistent, l'arbitrage se fait par le PRIX.** Sp3 : « rien n'empêcherait de faire un pack mensuel 4 séances ponctuel qui coûterait peut-être deux fois le prix de l'autre » ; « l'inconvénient, tu le reportes sur le prix ». | Arbitrage Christian : le désaccord porte sur l'existence du pack ponctuel, pas sur le mécanisme. Trancher le principe (garder) et laisser le prix faire le tri. |
| 7.2 | Abonnement + pack simultanés possibles | ❌ | Non abordé. | À poser — impacte l'ordre de consommation (7.3). |
| 7.3 | Ordre de consommation (abo puis pack ? choix ?) | ❌ | Non abordé. | À poser si 7.2 = oui. |
| 7.4 | Stock existant des clients : conservé / migré / délai | 🟡 | Volonté de migrer tout le monde — Sp1 : « on doit changer tout notre système. Même les personnes [existantes], on devrait les passer en abonnement. » Mais aucune modalité définie (stock restant, délai, geste commercial). | **Relance importante** : que fait-on des crédits en cours au jour de la bascule ? |

### 8. Modification de formule en cours
| # | Point | Statut | Dit | Relance |
|---|---|:--:|---|---|
| 8.1 | Upgrade : prorata immédiat vs prochain cycle | 🟡 | Le changement de formule est vu comme un moyen de gérer les vacances — Sp1 : « si tu sais que le mois d'après tu pars en vacances, que tu puisses passer à un abonnement où tu as moins de séances ». Donc effet **au prochain cycle**, pas de prorata. Jamais dit explicitement pour l'upgrade. | Confirmer : tout changement de formule prend effet au cycle suivant (simple, et cohérent avec « pas d'exception dans le code »). |
| 8.2 | Downgrade : quand l'effet s'applique | 🟡 | Idem 8.1. | Idem. |
| 8.3 | Pause (vacances/blessure) : durée, fréquence/an | ✅ | **Décision nette : pas de fonction "congés" en libre-service.** Sp1 : « l'option de vacances, il faut la supprimer. » Sp3 : « je ne crois pas beaucoup qu'un système peut implémenter un système où les gens, d'une manière unilatérale, vont dire tiens, je vais prendre des jours de congé […] ça devient incontrôlable. » **À la place : décalage d'échéance décidé par l'admin**, sur demande du client. Sp3 : « Vous changez le renouvellement du pack en disant, ton pack mensuel va fonctionner pendant six semaines. Après c'est un pack mensuel, donc ça continue tous les mois à partir de six semaines. Et ça, c'est l'équivalent de tes jours de congé. » **Stripe : `billing_cycle_anchor` — validé.** | — |

### 9. Tarification
| # | Point | Statut | Dit | Relance |
|---|---|:--:|---|---|
| 9.1 | Dégressivité abonnement vs unité | ✅ | **Oui, c'est le levier central du modèle.** Sp3 : « vous avez le pack 4 séances mais ça coûte 100 euros. Par contre si vous prenez un abonnement, c'est 60 euros par mois. » Logique assumée : « il paye moins cher, mais vous avez des rentrées fixes. Ou bien il paye plus cher et c'est aléatoire. » **Le prix, et non les restrictions de réservation, est l'outil d'orientation client** — Sp3 : « Sur le délai pour s'inscrire, je ne le ferais pas. Par contre, je le jouerais sur le prix. » (montants cités = exemples, pas des décisions) | Fixer la grille tarifaire réelle (4/8/12/illimité + ponctuel). Existant connu : 3 séances = 69 €, pack 10 séances sur 3 mois. |
| 9.2 | Réduction engagement long (3 mois, annuel) | ✅ | **Uniquement si payé intégralement d'avance.** Sp2 : « si tu t'engages un an, tu as peut-être un geste qui est fait par cours » ; Sp3 : « Un geste et 10 % de réduction […] mais s'ils prennent un truc d'un an, ils payent d'un an tout de suite. » Le remboursement partiel en cas d'arrêt reste un **geste commercial discrétionnaire**, pas une règle système. | — |
| 9.3 | Tarifs étudiants / seniors / couples / parrainage | ✅ | **Parrainage = priorité forte.** Sp1 : « pour les parrainages, je trouve que c'est hyper important. Il faut que le parrain ait une réduction de 20 ou 30 euros et que le filleul en ait aussi. » Condition : le filleul s'inscrit, paie ses frais d'inscription et prend un premier abonnement → **réduction sur l'abonnement suivant des deux**. Mécanisme : réduction ponctuelle sur une échéance récurrente. **Stripe : coupon `duration=once` — validé** (Sp2 le confirme aussi de mémoire : « Sur Stripe, on peut faire des réductions ponctuelles […] et tu peux mettre la durée »). Étudiants/seniors/couples : non abordés. | Poser la question étudiants/seniors/couples (faible priorité). |

### 10. Cas limites
| # | Point | Statut | Dit | Relance |
|---|---|:--:|---|---|
| 10.1 | Échec de paiement : suspension / grâce / annulation | ❌ | Non abordé — mais Sp3 y touche indirectement en rejetant l'engagement annuel mensualisé : « s'ils bloquent le paiement, vous êtes couillonné. » | **Relance nécessaire.** Stripe permet de configurer l'issue (relances intelligentes, puis suspendre / laisser impayé / annuler). Proposer : 3-4 relances puis suspension du droit de réserver, sans annulation automatique. |
| 10.2 | Transfert d'une séance à un proche | ❌ | Non abordé. | À poser (faible priorité — probablement non). |
| 10.3 | Jours fériés / studio fermé : recrédit | ❌ | Non abordé. | À poser. Traitement cohérent avec 8.3 : décalage d'échéance à la main. |
| 10.4 | Fermeture exceptionnelle : prolongation du cycle | ❌ | Non abordé. | Idem 10.3 — même mécanisme (`billing_cycle_anchor`). |

### 11. Reporting / vision admin
| # | Point | Statut | Dit | Relance |
|---|---|:--:|---|---|
| 11.1 | Indicateurs par client | ✅ | **Besoin explicite : compteur de désistements/annulations par personne.** Sp3 : « tu devrais pouvoir demander une statistique qui dit, cette personne-là, combien de fois elle s'est désinscrite » ; Sp2 : « c'est intéressant d'avoir les annulations des gens ». Les données existent déjà (log d'activité) — reste à les agréger et les afficher. Sp3 : « une fois que c'est noté, c'est facile de rassembler des informations. » | — |
| 11.2 | Indicateurs globaux studio (churn, remplissage, séances perdues…) | 🟡 | Chantier reconnu comme ouvert. Sp3 : « améliorer le système de statistiques. Il y a déjà tous les chiffres dedans, donc tout est gérable » ; « sur les statistiques, il y a déjà pas mal de choses, notamment les chiffres par coach ». Aucune liste d'indicateurs arrêtée. | Faire lister aux coachs les 5 indicateurs qu'ils veulent voir en priorité. |

---

## C. Points hors questionnaire soulevés par le(s) coach(s)
> Ce que la réunion fait émerger et qui n'était PAS prévu dans le questionnaire — souvent le plus précieux.

- **C1 — Le renversement pack/abonnement (majeur).** L'abonnement n'est pas une entité nouvelle : c'est un pack court auto-renouvelé. Réduit massivement le périmètre de la Phase 12. Voir en tête de document.

- **C2 — Le coût des paiements récurrents Stripe.** Sp3 : « ce n'est pas l'application qui fait les paiements récurrents, c'est Stripe […] quand c'est récurrent, on paye un supplément pour chaque transaction. » **À chiffrer** : impact sur la marge selon le prix des formules — surtout avec un cycle de 28 jours, qui produit **13 prélèvements par an au lieu de 12**.

- **C3 — Personal training : chantier distinct, et non urgent.** Longue discussion. Position d'arrivée : Sp2 « le personal training, ce n'est pas le plus urgent, le reste est avant ça. Je gère tout sur WhatsApp. » Deux tensions non résolues : la liberté d'agenda du coach (Sp2 : « ma liberté personnelle, d'abord ») contre l'auto-réservation (Sp1 : « idéalement, la séance d'essai doit être facilement réservable »), et la question du premier contact (Sp3 : « le personal training, c'est un service personnalisé. Et la qualité, c'est ça »). Piste retenue si on le fait : créneaux d'1 h posés manuellement par le coach, répétables — « on peut tenter d'abord de mettre des créneaux d'une heure et on voit comment ça se passe ». **À sortir de la Phase 12.**

- **C4 — Granularité horaire des cours : passer au quart d'heure.** Sp2 signale que l'app ne permet pas de placer un cours à n'importe quelle heure (pas de 10h00 « clair », granularité à 10 min ?). Décision : **travailler par quart d'heure**. Sp3 : « il suffit simplement que l'application propose de travailler par quarts d'heure. » Motif : éviter les chevauchements de cours. **Petit correctif technique, à vérifier dans le code et à faire hors Phase 12.**

- **C5 — Import des données TechnoGym.** Sp3 demande un export (CSV) des membres, agendas et cours depuis TechnoGym, pour tester l'app sur des données réelles. « C'est beaucoup plus réaliste que des données [fictives]. » **Action côté coachs**, pas côté dev.

- **C6 — Solution de repli au parrainage (devenue inutile).** Sp3 avait imaginé, au cas où Stripe ne saurait pas réduire ponctuellement une échéance : prélever la prime du parrain sur le paiement du filleul. **Sans objet** — Stripe sait le faire nativement. À noter pour mémoire seulement.

- **C7 — L'app est en attente de test réel.** Sp3 : « ce qui est vraiment important, c'est que vous jouiez avec l'application actuelle, parce que je ne sais pas si c'est bon ou pas. » Le périmètre déjà livré est jugé équivalent à TechnoGym. **Retour d'usage des coachs à obtenir en parallèle du dev.**

## D. Désaccords entre coachs (si plusieurs transcriptions)
> Lignes ⚠️ ci-dessus, regroupées ici pour arbitrage par Christian.

- **7.1 — Faut-il garder les packs à l'unité ?** Sp3 pousse au tout-abonnement ; Sp1 et Sp2 veulent conserver les cartes de séances et la séance à l'unité. **Résolution proposée** : les garder, et les tarifer nettement plus cher que l'abonnement équivalent. Personne ne s'y oppose sur le fond, et cela suit la logique « jouer sur le prix » que Sp3 défend par ailleurs. Pas de blocage pour le dev — les deux produits sont techniquement le même objet.

- **(mineur) 6.3 / no-show** — Sp2 envisageait un système de pénalités automatiques ; Sp3 l'écarte comme source de complexité, et Sp1 rejoint sur le traitement humain. **Tranché : pas de pénalité automatique, mais une statistique.**

## E. Synthèse de couverture
- ✅ Répondu : **26** / 44
- 🟡 Partiel : **8**
- ❌ Manquant : **9**
- ⚠️ Conflit : **1**
- **Structurantes tranchées** : S1 ☑  S2 ☑  S3 ☑
- **Prêt pour le dossier fonctionnel ?** ☑ oui — les 3 structurantes sont vertes et le modèle produit est clair. Les ❌ restants sont des cas limites qui n'engagent pas l'architecture ; ils peuvent être tranchés pendant le développement.

## F. Relances à faire (compilées)
> Liste finale, courte, des seules questions encore nécessaires.

**Bloquantes avant mise en production (pas avant le dev) :**
1. **Grille tarifaire réelle** (9.1) — prix des formules 4 / 8 / 12 / illimité, prix du pack ponctuel équivalent, frais d'inscription. Rien ne peut être mis en vente sans ça.
2. **Migration des clients actuels** (7.4) — que fait-on des crédits en cours au jour de la bascule ? Conservés jusqu'à épuisement, convertis, ou délai de consommation ?
3. **Échec de paiement** (10.1) — proposer : relances Stripe puis suspension du droit de réserver, sans annulation automatique. À valider.

**À confirmer d'une phrase (le dev peut avancer sur l'hypothèse par défaut) :**
4. Séances non consommées **perdues** en fin de cycle (3.2) — hypothèse retenue.
5. Changement de formule = effet **au cycle suivant**, sans prorata (8.1/8.2) — hypothèse retenue.
6. Résiliation = arrêt du renouvellement, droits jusqu'à la fin du cycle payé (2.2/2.4) — hypothèse retenue.
7. Abonnement + pack simultanés autorisés ? Si oui, ordre de consommation (7.2/7.3).
8. Réservation possible au-delà de la fin du cycle en cours (6.2) — hypothèse retenue : oui.

**Faible priorité :**
9. Annulation d'un cours par un coach : recrédit auto ou geste admin (5.1/5.3).
10. Jours fériés et fermetures exceptionnelles (10.3/10.4) — hypothèse : décalage d'échéance à la main.
11. Cours réservés à certaines formules (6.4), liste d'attente (6.5), transfert de séance (10.2), tarifs étudiants/seniors/couples (9.3).

---

## G. Capacités Stripe vérifiées (doc officielle, 2026-08-03)

Les trois questions posées en réunion — et leur réponse.

| Besoin | Réponse | Mécanisme Stripe |
|---|---|---|
| Cycle de 4 semaines / 28 jours | ✅ Oui | `Price` avec `recurring.interval = "week"` et `interval_count = 4`. **Utiliser `week`×4, pas `day`×28** : seul `week` garantit que l'échéance retombe toujours le même jour de la semaine — indispensable pour un studio à cours hebdomadaires. |
| Réduction ponctuelle sur la prochaine échéance, tarif plein ensuite (parrainage) | ✅ Oui, deux voies | **(a)** Coupon `duration: "once"` (`percent_off` ou `amount_off`) attaché à l'abonnement : s'applique à la prochaine facture, puis Stripe le retire automatiquement. **(b)** `InvoiceItem` à montant **négatif** sans `invoice` : s'accroche à la prochaine facture. → **(a) pour le parrainage** (geste commercial), **(b) pour un avoir calculé** (dédommagement de cours annulés, motif inscrit sur la facture). |
| Décaler l'échéance (congés, blessure) | ✅ Oui | `billing_cycle_anchor` sur l'abonnement existant → **tous les cycles suivants suivent la nouvelle date**. `proration_behavior = "none"` pour offrir l'intervalle, `"create_prorations"` pour le facturer au prorata. Variante `trial_end` pour décaler sans facturer. Correspond exactement au scénario de Sp3 : « ton pack mensuel va fonctionner pendant six semaines, après ça continue tous les mois à partir de six semaines ». |

**Contrainte d'architecture.** Ces trois opérations exigent la **clé secrète Stripe**, qui ne doit jamais se trouver dans le bundle React. Elles passent obligatoirement par une **Edge Function Supabase** (authentifiée, avec contrôle du rôle admin) :

> bouton admin React → Edge Function → API Stripe → webhook Stripe → mise à jour des tables Supabase

L'admin peut donc bien piloter tout cela depuis l'app ; l'instruction transite simplement par le backend.

**Point ouvert (C2)** : le surcoût par transaction récurrente, et l'effet des **13 prélèvements annuels** (cycle de 28 jours) sur la marge. À chiffrer avant de figer les prix.

---

> **Étape suivante** → produire `dossier-fonctionnel-abonnement.md` (contexte, fonctionnalité, règles métier, droits, données, parcours, cas limites, critères d'acceptation), exploitable pour faire évoluer le code et alimenter `plan-implementation-v2.md`.

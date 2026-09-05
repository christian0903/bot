# Journal du projet — Back On Track v2

> Trace de l'évolution du projet et de ce qui reste à faire.
> Dernière mise à jour : **2026-09-05**

---

## Où en est le projet

**Phases 1 à 10 livrées** (v2.0.0 et suivantes ; **v3.12.0** au 2026-08-24) : comptes, packs, planning, réservations, liste d'attente, annulations, check-in, statistiques, notifications, e-mails.

**Phase 11** (admin avancé) : **largement livrée** — rôles, statuts de cours, espace coach autonome.
**Phase 12** (abonnements récurrents) : **livrée et éprouvée**. Renouvellement vérifié au *test clock* Stripe le 2026-08-07.
**Séance d'essai** : **livrée** — vrai pack gratuit attribué à l'inscription (2026-08-07). **Désactivable depuis l'administration** (2026-08-30) : le réglage existait en base depuis l'origine, aucun écran ne le proposait. Le **retrait individuel** sur la fiche d'un membre est écrit mais **pas encore appliqué** — voir la session du 30.
**Stripe** : **en live depuis le 2026-08-30**. Le compte qui encaisse est **Aikicom Perspectives SRL** — le compte « BackOnTrack » n'a jamais été activé, ne pas s'y tromper. Premier paiement réel encaissé le soir même.
**Suppression de compte** : anonymisation (inchangée), plus un **effacement définitif** réservé au super admin pour les comptes créés par erreur (2026-08-30).
**Communications** : **livrées** — tout e-mail laisse une trace dans l'application.
**Parrainage & bons d'achat** : livré, **toujours non testé de bout en bout**.
**Avis sur les cours** : **livré et vu à l'écran** — étoiles et commentaire, consultation admin nominative, correction et suppression par le membre. 67 avis de démonstration en base depuis le 2026-08-08.
**Plafond de fréquentation** : **livré** — N cours par D jours, fenêtre glissante centrée, D borné à 14. Actif à 10 cours / 7 jours sur « abonnement mini » et « Pack illimité » (vérifié le 2026-08-09). **Rien à défaire** : la base ne contient que des données de test, ce réglage en fait partie.
**Clients professionnels** : **livré** — commande sur facture, suivi des encaissements.
**Performances** : étapes 1 et 2 livrées (valeurs comparables, courbes). Paliers et régularité à faire.
**Démarrage différé d'abonnement** : **livré et éprouvé au test clock** (2026-08-09) — vendre en août ce qui commence en septembre, via `trial_end`.
**Suivi des clients** : **livré** (2026-08-09) — page admin qui classe les clients par fréquentation (actif / ralentit / décroche / perdu) et calcule le revenu par séance. Seuils réglables.
**Réservation atomique** : **livrée** (2026-08-23) — `book_class` décide et écrit dans une seule transaction, sous verrou du cours. Ferme le dépassement de capacité et la réservation sans débit. Neuf cas éprouvés en base ; le verrou lui-même reste à voir en conditions réelles.
**Exports CSV** : **livrés** (2026-08-23) — page dédiée, huit sorties, plus l'export du journal d'activité et sa purge réservée au super admin.
**Index** : **posés** (2026-08-23) — `bookings` et `scheduled_classes` n'en avaient aucun. L'archivage n'est pas nécessaire : la base pèse 1,1 Mo pour 8 Go disponibles.
**Site vitrine** : **livré et en ligne** (2026-08-31) — `backontrackstudio.be` sert désormais une page unique construite avec l'application, en remplacement du WordPress (Bricks + AutomaticCSS, 7,2 Go, quinze plugins). Tarifs, délais d'annulation et frais d'inscription **lus en base** : plus de divergence possible entre le site et l'application. Formulaire de contact par Edge Function + Resend, éprouvé. Le WordPress est écarté dans `~/wordpress-archive-20260831`, pas supprimé. La page d'accueil **copie celle du WordPress** depuis le 2026-09-01, styles
relevés en mesurant les deux sites côte à côte. Le WordPress reste consultable
sur `wp.backontrackstudio.be`. **La vitrine déployée est en 3.112.0** — douze
versions de retard, sans effet visible.
**Rappel des présences** : **en production depuis le 2026-09-05**. Un cours passé dont les présences ne sont pas pointées déclenche un rappel au coach et aux administrateurs, quatre heures après la fin du cours par défaut. Faute de `pg_cron`, le déclenchement suit l'ouverture d'une session du staff.

**Sauvegarde de la production** : `scripts/sauvegarder-ops.sh` (2026-09-05). Supabase conserve 7 jours de copies quotidiennes (plan Pro, PITR **non** souscrit) ; ce script en pose une locale dans `.dumps/dump bot ops/<date>/`, hors git. À lancer avant toute opération touchant la structure.

**Documentation** : **à jour au 2026-08-23** en français, `public/` compris. Les versions **anglaises accusent un retard important** et attendent un chantier à part.
**PWA** : **livrée** (2026-08-24) — l'application s'installe sur l'écran d'accueil iPhone et Android, sans passer par un store, et annonce ses mises à jour au lieu de les imposer. Sert la phase de test avant l'App Store.
**Durée d'abonnement** : **libre** — jours, semaines ou mois, un nombre au choix. Un garde-fou infondé qui bloquait les durées non multiples de 7 a été levé.
**Phase 13** (RGPD & sécurité) : non entamée. Les CGV existent, à compléter. **Deux de ses éléments deviennent bloquants pour l'App Store** — voir ci-dessous.
**Rémunération des coachs** : reportée — module à part, la gestion se fait hors application (décision du 2026-08-06).

L'application tourne sur **Stripe** — la migration vers Mollie prévue au plan a été abandonnée le 2026-08-03.

Une version de test tourne sur iPhone depuis le 2026-08-07 (signature de développement, valable 7 jours).

**L'application iOS est EN VENTE sur l'App Store** depuis le 2026-09-04 —
version 1.0 (build 7, code 3.123.0), **iPhone seul**, gratuite, cinq pays
(Belgique, France, Pays-Bas, Luxembourg, Allemagne).
`apps.apple.com/app/back-on-track-studio/id6807375775`. Acceptée le 2026-09-03,
publiée au clic de Christian le lendemain — la sortie était réglée en
**manuelle**. Deux refus avaient précédé : captures iPad manquantes et prix non
choisi le 2026-09-01, puis Guideline 2.1 le 2026-09-03.

**TestFlight** : les tests **internes** sont possibles (100 testeurs, sans
examen), mais chaque testeur doit exister dans *Utilisateurs et accès* et être
invité **à l'adresse de son compte Apple** — inconnue des coachs au 2026-09-04,
ce qui bloque l'invitation. Les tests **externes**, eux, sont indisponibles :
la vérification **DSA** (Digital Services Act) déposée le 2026-09-01 est encore
« En cours de vérification » chez Apple. Ce n'était donc pas l'approbation du
premier build qui manquait.

### Les bases et les sous-domaines, au 2026-08-30

| Base | Référence | Sert | État |
|---|---|---|---|
| `bot-ops` | `xgwrxbkrfypklrnqbftv` | `app.backontrackstudio.be` | **production, installée et VIDE** |
| `bot3` | `cvyslqnojcgnjfgynczw` | `jag.backontrackstudio.be` | test et développement, chargée |
| ~~`bot`~~ | — | — | supprimée le 2026-08-29 |

`bot` n'a jamais été une production : c'était la base de développement,
remplacée par `bot3`. Sa sauvegarde est dans `.dumps/`, **sur le Mac mini
seulement**.

**Le déploiement passe par `./deploiement.sh jag|ops`** — un `dist/` est lié à
une base avant même d'être envoyé, le même dossier ne peut pas servir les deux
sous-domaines.

**Ce qui reste avant l'ouverture** : la configuration métier sur `bot-ops` (les
coachs encodent), le SPF qui ne mentionne pas Resend, hCaptcha, et le passage de
Stripe en mode live.

### Publication sur l'App Store

Compte Apple Developer pris **au nom propre de Christian** (99 $/an) — décision du 2026-08-07.

**La commission de 30 % ne s'applique pas** : règle 3.1.3(e), biens et services physiques. Un cours se consomme au studio, pas dans l'application. Les packs et abonnements restent vendus par Stripe.

**Les deux prérequis bloquants sont levés** (2026-08-07) :

1. **Suppression de compte depuis l'application** — obligatoire depuis 2022, motif de rejet automatique. Livrée : elle **anonymise** plutôt qu'elle n'efface, les traces comptables se conservant sept ans par obligation légale belge. Un abonnement actif bloque l'opération, sinon le membre ne pourrait plus l'arrêter.
2. **Politique de confidentialité avec URL publique** — livrée, page `/confidentialite` (et non `/privacy`, corrigé le 2026-08-29 : c'est cette URL qu'App Store Connect attend, une adresse fausse dans la fiche vaut rejet).

---

## Session du 2026-09-05 — la production reçoit le rappel des présences, bot3 redevient crédible

### Ce qui a été fait

**Le rappel des présences est en production.** La migration
`20260903_rappel_presences.sql` manquait à `bot-ops` alors qu'elle partait déjà
dans le build 8 de l'App Store : les deux fonctions, la colonne
`attendance_reminded_at` et le réglage `attendance_reminder_hours` étaient
absents. Le bandeau serait resté inerte — sans casse, `BandeauPresences.tsx`
avalant l'erreur, mais sans rien afficher non plus.

Appliquée par l'éditeur SQL. Contrôle après coup : `anon` n'a pas conservé le
droit d'exécution sur les deux fonctions.

**Les deux bases sont alignées.** Comparaison objet par objet — tables,
colonnes, fonctions (empreinte MD5 du corps), triggers, vues, policies. Après
la migration, le seul écart restant est `contact_envois` et
`contact_debit_depasse`, propres à la production (formulaire de contact de la
vitrine). Les 89 policies RLS sont identiques.

> Cinq fonctions paraissaient diverger — `book_member_by_staff`,
> `can_book_class`, `check_coupon`, `member_sessions_count`,
> `update_member_status`. Empreintes recalculées **commentaires neutralisés**,
> elles sont identiques : la production est simplement mieux commentée. Comparer
> `md5(prosrc)` brut fait crier au loup.

**`supabase/` rangé.** Deux scripts de mise en production consommés retirés
(`mise-en-production-20260903.sql`, et le fichier du jour). Le reste est
référencé par les guides et sert encore : seeds, tests, contrôles.

**`supabase/migrations/README.md`** — les 74 migrations en séquence, avec pour
chacune la version de `package.json` du commit qui l'a ajoutée. Généré depuis
git, contrôlé exhaustif.

**`supabase/regenerer-donnees-bot3.sql`** — refait l'activité de bot3 à la
forme de la production, sans en copier aucune donnée personnelle.

**`scripts/sauvegarder-ops.sh`** — sauvegarde locale de la production.
Éprouvé : deux dumps réels produits, 102 profils et 102 comptes `auth`.

**Guides** : `guide-admin.md` explique ce qui est sauvegardé et ce qui ne l'est
pas ; `guide-installation.md` documente les deux nouveaux scripts. Recopie dans
`public/` faite (règle 3).

### Ce qui a été décidé, et pourquoi

**Ne pas renommer les migrations.** L'index les remet en ordre, les fichiers ne
bougent pas. Les préfixes portent 8 chiffres là où le CLI en attend 14 — c'est
la cause de la règle 5. Renommer ferait recalculer au CLI ce qu'il croit
appliqué, et un `db push` ultérieur rejouerait des migrations déjà passées,
dont `20260805_reset_member_test_data.sql`, sur 102 comptes réels. Le README
porte cette explication, pour que personne ne « répare » ça plus tard.

**Garder les 30 comptes de test de bot3.** Créer des comptes exige d'écrire
dans `auth.users` (mots de passe chiffrés, `identities`) : laborieux, et
Christian perdrait les identifiants qu'il connaît. Seule l'activité était
irréaliste — 551 cours pour 132 réservations, contre 0,87 inscrit par cours en
production.

**Aligner les identifiants du catalogue sur la production.** Les types de
crédits et de cours de bot3 portaient les mêmes noms sous d'autres
identifiants. Les aligner rend les deux bases comparables ligne à ligne —
c'est exactement ce qui a permis de repérer l'écart du jour.

**Garder les seeds et les scripts de test.** La demande était de ne laisser que
les contrôles et l'installation ; `guide-installation.md` et
`charger-demo-data.md` les référencent nommément, les retirer aurait cassé
trois guides.

### Le pooler de bot-ops est `aws-1`, pas `aws-0`

`aws-0-eu-west-3` répond « tenant/user postgres.<ref> not found ». Les deux
hôtes existent et résolvent en DNS, un seul accepte le projet. Fixé dans
`.env.migration` (`OPS_POOLER`).

Le mot de passe n'a pas eu à être ressaisi : `CIBLE_REF` de `.env.migration`
**est** bot-ops depuis la migration d'août, `CIBLE_PASSWORD` porte donc le bon.
Le script s'en sert en repli, après avoir vérifié que `CIBLE_REF` désigne bien
bot-ops.

### Six contraintes rencontrées en écrivant le script de bot3

Elles valent d'être notées : elles se retrouveront à chaque script qui écrit en
masse dans cette base.

| Obstacle | Ce qu'il impose |
|---|---|
| `credit_types_name_key` | `name` est unique : un `ON CONFLICT (id)` ne suffit pas, il faut renuméroter en quatre temps |
| `class_types_protect_credit` | Refuse de changer le type de crédit tant qu'un cours en dépend — **effacer l'activité d'abord** |
| `class_types.name` non unique | Insérer sans nettoyer laisse deux « BackOnTrack » à l'écran |
| `invoice_requests_pack_purchase_id_fkey` | Retient `pack_purchases` : la demande de facture survit à l'achat |
| `bookings_pack_or_trial` | `pack_purchase_id IS NOT NULL OR is_trial`, vérifié **ligne à ligne** — les packs se créent avant les réservations, pas après |
| `pack_purchases_payment_method_check` | `stripe`, `cash`, `transfer`, `gift` — pas `card` |

**La leçon de méthode** : les cinq premières ont été découvertes une par une, à
l'exécution. Relever d'emblée toutes les contraintes CHECK, UNIQUE, NOT NULL et
les clés étrangères des tables visées aurait tout donné en une requête — c'est
ce qui a permis d'attraper la sixième avant qu'elle ne se produise.

### Ouvert, non traité

| Sujet | Détail |
|---|---|
| **`regenerer-donnees-bot3.sql` jamais mené à terme** | Corrigé six fois, jamais exécuté jusqu'au bout. À relancer sur bot3, « Run without RLS ». |
| **PITR non activé** | Le plan Pro conserve 7 jours de sauvegardes quotidiennes. Le *Point-in-Time Recovery* est une option payante, non souscrite. |
| **Sauvegarde non planifiée** | `sauvegarder-ops.sh` se lance à la main. Aucun automatisme. |
| **`contact_envois` sans policy RLS** | Écrite uniquement par une Edge Function, mais la table n'a aucune policy. À regarder. |
| **78 fonctions `SECURITY DEFINER`** | Toujours exécutables par `anon` sur bot3. Audit à mener. |
| **Rappel des présences : première volée** | 3 cours non pointés × 4 admins ≈ 12 e-mails au premier passage du staff. Volume mesuré, jugé acceptable. |

---

### Fin de journée — TestFlight externe débloqué, les coachs sont invités

**La vérification DSA est passée.** *Business → Contrats*, section
*Conformité* : « La législation sur les services numériques — 27 pays ou
régions — **Active** ». Elle était « En cours de vérification » depuis le
2026-09-01. C'est elle qui masquait la section « Tests externes » de
TestFlight — Apple ne l'annonce pas, la section apparaît simplement.

> **La leçon** : une fonction absente d'App Store Connect n'est pas forcément
> indisponible. Elle peut être masquée par une vérification en cours. Regarder
> *Business → Contrats* avant de chercher ailleurs.

**Le groupe externe « Vérificateurs » est créé**, avec les trois coachs
(Gauthier, Anselme, Joan) et le build 8. Le lien public est généré :
`testflight.apple.com/join/6bztv1F1`. Avec ce lien, **l'adresse du compte Apple
de chacun n'est plus nécessaire** — c'était le blocage des quatre derniers
jours, il tombe.

**Le build 8 est en examen depuis aujourd'hui**, pas depuis son chargement.
Distinction qui a prêté à confusion : la page du build affiche « Date de
chargement : 4 sept. 14 h 22 » et « État du binaire : Validé », mais aucun des
deux ne dit que l'examen a commencé. Un build chargé dort dans le compte tant
qu'on ne le soumet pas ; « Validé » ne désigne que le contrôle technique
automatique à la réception. L'examen TestFlight externe n'a démarré qu'au clic
sur « Soumettre pour vérification », le 2026-09-05. Compter 24 à 48 h, une
seule fois — les builds suivants passeront sans nouvel examen.

**Les « Éléments à tester »** sont rédigés : cinq points dans l'ordre de ce que
le build apporte, plus ce qui est normal et comment signaler un problème.

### Le mode de paiement, deux réglages qui se contredisent

En rédigeant le guide des coachs, une erreur a failli partir : « aucun paiement
n'est prélevé pendant les tests ». **C'est faux.** En base :

| Réglage | Valeur | Utilisé par |
|---|---|---|
| `stripe_mode` | **`live`** | `create-checkout-session`, l'écran d'administration |
| `payment_provider` | `mode: test` | **rien** — sauf l'affichage du diagnostic |

C'est `stripe_mode` qui décide, et il vaut `live`. Un pack acheté depuis
TestFlight **débite réellement la carte**. Le guide dit maintenant l'inverse de
ce qui avait été écrit, et renvoie vers JAG pour éprouver un achat.

`payment_provider` est à nettoyer : il n'est lu nulle part et affiche une
information fausse au diagnostic.

### Documentation

- **`docs/coachs-tester-testflight.md`** — comment installer TestFlight, ce
  qu'il faut regarder, comment signaler. En tête, la distinction **JAG /
  TestFlight** : sur JAG les données sont fausses et on peut tout casser ; sur
  TestFlight ce sont les vrais membres et les vrais paiements. Le repère est le
  **bandeau orange** — présent sur JAG, absent en production.
- **`docs/suivi-demandes-notion.md`** — le dispositif de suivi des demandes des
  coachs. Notion retenu contre GitHub sur un seul argument, décisif : **les
  coachs s'en servent déjà**, et un outil qu'il faut apprendre ne filtre rien.
  Le consensus repose sur une propriété `Appuyé par` où le coach s'ajoute
  lui-même ; deux noms = la demande avance. Notion ne l'imposera pas — c'est
  une discipline visible, pas un verrou. Le verrou demanderait de développer
  cela dans l'application, ce que Christian voulait éviter.
- **`docs/mettre-a-jour-app-store.md`** — la section « Groupe externe » ne dit
  plus « bloqué » : elle décrit l'état réel et la marche à suivre en quatre
  étapes.

**Connecteur MCP Notion ajouté** (`https://mcp.notion.com/mcp`, OAuth), au
niveau global. **Non authentifié à la clôture** : les serveurs MCP se chargent
au démarrage de la session, celle-ci ne le voyait donc pas. À faire au
redémarrage : `/mcp` → notion → *Authenticate*, en ne donnant accès qu'à la
page du projet.

---

## Session du 2026-09-04 — l'application est en vente

### Ce qui a été fait

Apple a accepté la version 1.0 le 2026-09-03 à 04:49 (heure Pacifique),
soumission `a28d840f-32c0-4870-868c-fc08812973b3`. La version est passée en
**« Prête pour la publication »** — approuvée mais invisible, la sortie ayant
été réglée en **manuelle** au moment de la soumission.

Christian a cliqué sur **« Publier cette version »** le 2026-09-04. Le statut
est devenu **« Prête pour la distribution »** : la mise en ligne est lancée.
Apple annonce jusqu'à **24 h** avant que la fiche soit publiquement accessible,
et l'indexation dans la recherche de l'App Store prend souvent davantage.

`apps.apple.com/app/back-on-track-studio/id6807375775`

### Ce que « sortie manuelle » a coûté, et ce qu'il faut en retenir

Rien n'avertit qu'une version approuvée attend un clic. Le mail d'Apple
annonce « eligible for distribution » — pas « en vente ». Entre l'acceptation
et la publication, l'application est restée **une journée invisible** sans
qu'aucun écran ne le signale.

C'est le deuxième silence de ce type en trois jours, après la version refusée
qui ne repartait pas toute seule (session du 2026-09-03). **Chez Apple, un
état d'attente ne se manifeste jamais de lui-même** : c'est à nous d'aller
regarder la page de la version.

La sortie manuelle reste le bon réglage — elle laisse choisir le jour de la
mise en vente, ce qui compte quand les coachs doivent être prévenus. Mais elle
demande d'aller cliquer.

### Les mises à jour : ce qui ne se refera pas

Les upgrades en attente partiront **sans repasser par le parcours du premier
dépôt**. Ce qui était à faire une fois est fait : compte développeur, fiche,
captures, questionnaire de confidentialité, tarification, compte de
démonstration, notes d'examen. Une mise à jour n'y touche pas.

Ce qui reste, à chaque version : incrémenter la version et le build
(`version-mobile.sh`), archiver dans Xcode, envoyer, écrire les nouveautés,
soumettre. Le compte de démonstration doit être **vivant** et le planning
garder des places libres — c'est ce qui a valu le refus du 2026-09-03.

L'examen d'une mise à jour est **plus court** que celui d'un premier dépôt :
l'app est connue, la fiche est stable, et les questions de la Guideline 2.1
ont déjà reçu leurs réponses, conservées dans le champ *Remarques*.

La procédure est écrite dans `docs/mettre-a-jour-app-store.md`.

### Le build 8 est parti

Envoyé chez Apple le 2026-09-04, **version 3.137.0 (build 8)**, statut
*Uploaded to Apple*. Il porte tout ce qui a été livré depuis la soumission du
1er septembre — **quatorze versions**, dont le rappel des présences.

Destination : **TestFlight d'abord**, pour faire voir la version aux coachs
avant de la soumettre. Le verrou des tests externes est levé depuis
l'approbation du premier build.

**L'enveloppe visait la base de TEST au moment du report.** `.env` portait
`cvyslqnojcgnjfgynczw` — bot3, celle de `jag.` — et non `bot-ops`. Un
archivage lancé ainsi aurait envoyé chez Apple une application branchée sur
les données de démonstration : l'évaluateur comme les coachs auraient vu un
studio fictif. Basculé sur `.env.ops` avant la construction, l'ancien gardé en
`.env.sauvegarde-jag-20260904`.

Le garde-fou de `version-mobile.sh` ne couvre **que** le drapeau vitrine, posé
après l'incident du 1er septembre. La base visée, elle, n'arrête rien — c'est
`verifier-mobile.sh` qui l'affiche, et c'est lui qui l'a montré. **Deux fois en
quatre jours, le `.env` a failli faire partir la mauvaise application.** Le
même fichier sert à trop d'usages ; un second garde-fou dans
`version-mobile.sh` serait justifié.

Le report de version ne touche que des fichiers natifs : `cap sync` recopie le
web mais jamais `project.pbxproj` ni `build.gradle`. L'enveloppe était restée
en 3.123.0 depuis le 1er septembre.

**Les étiquettes n'étaient pas poussées.** Dix d'un coup, dont `v3.123.0` — le
code en vente chez les utilisateurs. Un `git push` ordinaire ne les emporte
pas : sans `--tags`, la règle 2 du CLAUDE.md ne produit son effet que sur la
machine où l'étiquette a été posée. Depuis le MacBook, retrouver le code
publié aurait demandé de chercher un identifiant de commit.

### Ce qui reste ouvert

- **TestFlight est bloqué des deux côtés**, et pour deux raisons distinctes.
  L'**externe** — le lien public, celui qu'on voulait — attend la vérification
  **DSA** d'Apple, déposée le 2026-09-01, toujours en cours. Rien à corriger,
  seulement à attendre ; surveiller les courriels d'Apple, une demande de pièce
  non traitée laisserait la vérification en suspens indéfiniment.
  L'**interne** est ouvert mais bute sur autre chose : un testeur ne s'invite
  qu'à l'adresse de **son compte Apple**, que les coachs ne connaissent pas.
  Elle se lit sur leur iPhone dans Réglages, tout en haut, sous leur nom.

  Ce qui n'était **pas** en cause, vérifié le 2026-09-04 : les contrats (celui
  des applications gratuites est actif jusqu'au 2027-08-29), le rôle du compte
  (Titulaire + Admin), et les informations de test, complètes. Le questionnaire
  de chiffrement ne se pose pas non plus — `ITSAppUsesNonExemptEncryption` est
  déjà dans l'`Info.plist`.

  **Apple masque la section « Tests externes » au lieu de dire pourquoi.**
  Troisième silence de la semaine, après la version refusée qui ne repartait
  pas et la version approuvée qui attendait un clic.
- **Le rappel des présences part avec le build 8**, sur décision de Christian
  — il était jusqu'ici retenu le temps que les coachs soldent leur pointage.
  Dès qu'un membre du staff ouvrira cette version, les rappels des cours non
  pointés des sept derniers jours partiront : un e-mail par cours et par
  administrateur. Le délai se règle dans Administration → Réglages.
- **Android** reste bloqué par la clé de signature, jamais créée.
- **D-U-N-S et conversion du compte Apple en organisation** : non entamés. Le
  compte reste au nom propre de Christian, ce qui n'empêche ni la vente ni les
  mises à jour.

---

## Session du 2026-09-03 — fiche de cours, agenda, et la resoumission qui n'était pas partie

### Le rappel des présences non pointées

Demandé en fin de session : prévenir un coach qui n'a pas validé ses présences,
avec un délai réglable.

**Ce que le réel a dit avant qu'on code.** Quatre cours non pointés sur soixante
jours en production — l'oubli est occasionnel. D'où un bandeau discret sur
l'accueil plutôt qu'un dispositif lourd, et un seul rappel par cours.

**Le délai court depuis la FIN du cours**, pas son début : sinon un cours de
cinquante minutes serait réclamé pendant qu'il a encore lieu. Rien au-delà de
sept jours — passé une semaine, le coach ne se souvient plus, et relancer sur de
l'ancien noierait ce qui reste rattrapable.

**Pas de `pg_cron` sur ce projet.** Rien ne peut partir à heure fixe. Le
déclenchement reprend donc le principe de la file d'e-mails : l'application
appelle à l'ouverture d'une session du staff. Le rappel part « au prochain
passage », pas à l'heure dite. Le bandeau, lui, est immédiat — c'est lui qui
fait le vrai travail, l'e-mail n'est qu'un filet.

**Éprouvé sur `jag.` et validé.** Non déployé en production, sur décision de
Christian : les coachs rattrapent d'abord leur pointage. Sans cela, la mise en
service enverrait d'un coup un rappel par cours des sept derniers jours,
multiplié par le nombre d'administrateurs — une volée d'e-mails pour un retard
qu'on peut solder avant.

### `display_name` pour la liste des inscrits : proposition écartée

Le prénom seul paraissait insuffisant, et `display_name` semblait rendre la main
au membre. Les chiffres ont dit l'inverse : sur 97 comptes, **97 ont un
`display_name` contenant un espace et 93 valent exactement « Prénom Nom »**.
Personne ne s'en sert comme surnom — c'est le nom complet, rempli à
l'inscription.

Basculer dessus aurait donc **publié le nom de famille de 93 membres sur 97**,
sans qu'aucun l'ait choisi. Le contrôle promis était fictif.

Le besoin, lui, est réel : **16 prénoms sont partagés** (quatre Catherine, trois
Caroline, Fabienne, Laurence), soit environ 37 membres sur 97. « Prénom +
initiale » a été proposé comme réponse proportionnée. **Christian a tranché : on
garde le prénom seul**, et la question reste ouverte si les homonymes gênent à
l'usage.

### D'où venait la demande

Trois chantiers du jour répondent aux **demandes de Gauthier** : voir qui a
réservé un cours, ajouter une séance à son agenda personnel, et pouvoir écrire
confortablement la description longue d'un type de cours.

La publication sur l'App Store, restée en attente sans que rien ne l'indique, a
été relancée le même jour.

### Une version refusée ne repart pas toute seule

Le 2 septembre, la réponse aux six questions d'Apple et la vidéo ont bien été
postées dans le fil de discussion. Le lendemain : aucune nouvelle. Motif — la
version était passée en **1.0 Refusée** (2.1.0 Performance: App Completeness),
et le refus était tombé **avant** la réponse, à 5h55 contre 11h54.

Une version refusée **sort de la file**. Répondre dans le fil ne l'y remet pas :
App Store Connect l'écrit lui-même, « aucun autre élément soumis ne peut être
accepté ni approuvé ». Sans un geste explicite, l'attente est indéfinie.

**Le piège de l'interface** : sur la page *Soumission iOS*, le bouton
« Soumettre à nouveau à l'équipe de vérification des apps » est **grisé**, ce
qui laisse croire qu'il n'y a rien à faire. Le bouton actif est ailleurs —
**« Mettre à jour la vérification »**, en haut à droite de la page de la
*version* (`/distribution/ios/version/inflight`), qu'on atteint par le lien
« Modifier » de la ligne refusée. C'est lui qui relance l'examen.

Vérifié avant de resoumettre : le compte de démo restauré le 2 septembre est en
service, et le planning garde des places libres — sans quoi l'évaluateur ne peut
pas réserver, et « App Completeness » retomberait pour la même raison.

### Livré en production

- **La fiche d'un cours au planning** : date, horaire, coach, salle, places,
  description — et la liste des inscrits (prénom et photo). `SECURITY DEFINER`
  parce que la RLS de `bookings` ne montre à un membre que ses propres
  réservations : le front ne peut pas lire cette liste lui-même.
- **Le retrait de la liste** depuis le profil (`visible_aux_autres`), visible
  par défaut — à `false`, l'effet recherché ne se serait jamais produit.
- **« Ajouter à mon agenda »** : un .ics produit dans le navigateur, à trois
  endroits (après réservation, fiche du cours, Mes réservations).
- **Les descriptions des types de cours**, reprises des pages du WordPress.
- **Les deux guides** — `guide-membre.md` et `guide-admin.md` — décrivent
  l'agenda, la liste des inscrits et l'éditeur agrandi, avec leurs copies dans
  `public/`. Le guide admin dit aussi aux coachs ce que voient leurs membres :
  un membre retiré de la liste reste inscrit, et une séance déplacée ne bouge
  pas dans l'agenda personnel de qui l'y avait ajoutée.

### Le REVOKE qui ne révoquait rien

`REVOKE ALL ON FUNCTION ... FROM PUBLIC` **ne suffit pas** chez Supabase : un
`ALTER DEFAULT PRIVILEGES` accorde `EXECUTE` à `anon` dès la création de la
fonction, et ce droit **nominatif** survit au REVOKE sur `PUBLIC`. La fonction
paraissait fermée aux visiteurs et ne l'était pas — un non-connecté pouvait lire
qui fréquente le studio.

Constaté sur bot3, corrigé par un `REVOKE EXECUTE ... FROM anon` explicite,
reporté dans la migration et `install.sql`. La production a reçu la version
corrigée d'emblée.

**Reste ouvert** : **78 fonctions `SECURITY DEFINER` sont exécutables par
`anon`** sur bot3 — dont `book_class`, `delete_own_account`, `grant_user_role`.
C'est le défaut Supabase pour tout le schéma `public`, et la plupart se
protègent par `auth.uid()`, NULL pour un visiteur. Mais aucune ne le fait *par
ses droits*. Audit à mener, non entrepris.

### Deux constats à recaler

- **Le lint sort 799 signalements**, pas les 37 qu'annonce `CLAUDE.md`. Vérifié
  identique avant et après les changements du jour. Le chiffre du CLAUDE.md est
  périmé.
- **Les deux bases divergent** : `Posture` et `Événement spécial` n'existent que
  sur bot3, `Mobility & Stretch` que sur bot-ops. La production porte aussi des
  espaces en fin de nom (`'Ladies '`) — d'où le `TRIM(name)` dans le SQL des
  descriptions, sans quoi l'UPDATE n'aurait touché aucune ligne **sans erreur**.
- **« Personal Training » n'a pas de description longue** : aucune page du site
  ne le décrit, il n'apparaît que dans les tarifs. À écrire par les coachs.
- Le site décrit un cours **« Adolescent »** (12-17 ans) absent des deux bases.

---

## Session du 2026-09-01 — l'application part chez Apple

> **v3.124.0**, 39 commits non poussés (`eaa7bc9` → `82c563b`).
> Build vert, lint stable à 37.

### Ce qui a été livré

**L'application iOS est soumise à l'App Store** — build 7, en attente de
vérification depuis 15h10. Sortie **manuelle** : elle ne paraîtra que le jour où
Christian cliquera sur « Publier ».

**La vitrine copie la page d'accueil du WordPress** — hero vidéo, fond noir,
Bebas Neue, onze sections, les six questions d'origine, la grille de cours du
page-builder. Demande formulée trois fois : *une copie fidèle, texte et style*.

**Le planning suit le mode choisi**, en production cette fois. Un administrateur
ou un coach qui bascule en mode Membre voit ce que voit un client — c'était
livré sur `jag.` la veille, ce n'est qu'aujourd'hui que `app.` l'a reçu.

**Un super administrateur peut créer un membre.** `create-user` ne testait que
`['admin','coach']` : `super_admin` était absent de la liste. Le bouton
s'affichait, le formulaire se remplissait, et l'enregistrement échouait sur
« Admin or coach role required ».

**Trois outils** : `scripts/version.sh` (version ↔ commit),
`scripts/version-mobile.sh` (report vers iOS et Android),
`docs/documentation-developpeur.md` (578 lignes).

### Le style relevé en mesurant, pas en lisant

Plusieurs tentatives de copie du WordPress à partir du **HTML archivé** ont
échoué : la vidéo débordait, les titres étaient trop fins, le conteneur trop
large. Christian a demandé pourquoi le navigateur n'était pas utilisé pour
comparer les deux sites — la question était juste.

Comparer les **styles calculés** des deux pages à largeur de fenêtre égale a
donné en une fois ce que la lecture du fichier n'avait pas trouvé en plusieurs
essais :

- le conteneur fait **1072 px**, pas 1177 : Bricks imbrique deux fois 90 %
- l'iframe de la vidéo n'a **aucun `min-width`** — c'est lui qui l'étirait
- l'en-tête est **transparent**, posé au-dessus du hero, pas au-dessus de lui
- `-webkit-font-smoothing: antialiased` **amincit** le texte sur macOS

> **Leçon** : pour reproduire un rendu, mesurer le rendu. Le source dit ce que
> la page déclare, pas ce que le navigateur en fait.

### Le WordPress redevient consultable, sans toucher à sa base

Il est servi sur `wp.backontrackstudio.be` par **deux lignes** ajoutées à
`wp-config.php`.

L'option envisagée d'abord — réécrire les URLs en base — aurait porté sur
**32 755 occurrences**, dont des chaînes **PHP sérialisées** de la forme
`s:29:"https://backontrackstudio.be"`. Le nombre y déclare la longueur de la
chaîne : un `sed` l'aurait laissée fausse, et PHP aurait cessé de lire ces
réglages **sans message d'erreur**. Écarté.

### Quatre pièges, et ce qu'ils apprennent

#### 1. L'application mobile a été construite avec la vitrine

Repéré par Christian à l'émulateur : « on dirait que c'est la page vitrine ».

`deploiement.sh prod-site` **écrase `.env`** avec `VITE_VITRINE=oui`. Le
`cap:sync` lancé ensuite a embarqué le site public dans l'enveloppe iOS. Apple
l'aurait refusée sous la **règle 4.2** — une application qui n'est qu'un site
web.

`version-mobile.sh` **refuse désormais de tourner** si le drapeau est posé. Le
garde-fou vaut mieux que la vigilance : c'est le même `.env` qui sert aux deux
usages.

#### 2. Premier refus d'Apple, deux motifs

- **Captures iPad manquantes.** Capacitor pose `TARGETED_DEVICE_FAMILY = "1,2"`
  par défaut : l'application se déclarait compatible iPad sans l'avoir jamais
  été éprouvée. Choix retenu : **iPhone seul**.
- **Aucun prix choisi.** La fiche peut être complète et la tarification vide —
  ce sont deux écrans distincts, et rien ne le signale avant le refus.

#### 3. `cap sync` ne reporte pas la version

Contrairement à ce que le guide affirmait. Christian l'a lancé, la version est
restée à 3.69.0. D'où `version-mobile.sh`, et la correction du message trompeur
de `verifier-mobile.sh`.

#### 4. TestFlight externe est fermé avant la première approbation

Demandé en fin de session pour montrer l'application aux coachs. Les
**informations de test sont enregistrées** — description bêta, contact, compte
de démonstration, URL. Mais la section « Tests externes » n'apparaît qu'une fois
**un premier build approuvé par App Review**.

Rien à corriger, seulement à attendre. En attendant, la **PWA sur `app.`**
montre exactement le même code.

### Une correction dans le code plutôt que dans les droits

Pour le super administrateur qui ne pouvait pas créer de membre, la demande
était : « fais un query pour me donner le droit d'admin ». C'était un bug, pas
un manque de permission — accorder le rôle aurait masqué le défaut, qui aurait
frappé le prochain super administrateur.

### Ce qui reste ouvert au 2026-09-01

- **La vitrine est douze versions en retard** (3.112.0). Rien de visible pour un
  visiteur — de la documentation et du mobile — mais à déployer.
- **D-U-N-S** pour AikiCom Perspectives SRL, puis le message au support Apple :
  conversion du compte en organisation, et remboursement de la licence au nom
  propre, rien n'ayant été publié.
- **Clé de signature Android** — bloque le Play Store, pas l'App Store.
- **`/cours-2`** : deux présentations des cours coexistent le temps que les
  coachs tranchent.
- **Vidéo du hero** : YouTube conservé sur décision de Christian. Un `.mp4`
  auto-hébergé reste préférable si le fichier source est retrouvé — un coach a
  signalé un chargement peu fluide.
- Menu de la vitrine : « Nos coachs » et « Séance d'essai » manquent ; le fond
  des témoignages est noir au lieu de la photo d'origine.

---

## Session du 2026-08-31 — le site vitrine remplace WordPress

> **v3.90.0**, deux commits locaux (`eaa7bc9`, `5da3a04`), build vert, lint
> stable à 36. `backontrackstudio.be` sert désormais la vitrine ; le WordPress
> est écarté, pas supprimé.

### Ce qui a changé

Le site tournait sur **WordPress + Bricks + AutomaticCSS** — deux licences
payantes, quinze plugins et **7,2 Go** pour cinq pages qui portaient du
contenu. Les neuf autres étaient des doublons, des restes de l'ancien espace
membre ou des essais (`zdzdz`, `test`,
`cours-semi-prives-copier-copier-copier`).

Sur ces 7,2 Go : **6,1 de sauvegardes UpdraftPlus** empilées depuis août 2025
et jamais purgées, 629 Mo d'images, et **99 Mo d'Amelia + myCRED** — l'ancien
système de réservation avec crédits, que l'application a remplacé mais dont le
plugin est resté installé.

**Trois choses y étaient cassées, en public :**

1. Le formulaire de contact affichait « Google reCaptcha : Clé de site
   invalide » et **n'envoyait rien**. La page censée capter les prospects était
   hors service.
2. `/horaire` renvoyait vers **Technogym** — « la réservation se fait uniquement
   via notre application Technogym ».
3. Le délai d'annulation se contredisait : **12 h** sur `/tarifs`, **24 h** sur
   `/horaire`. Une clause contractuelle.

### La vitrine est une route de l'application

`VITE_VITRINE` décide de ce que sert la racine, et le **même `dist/`** part sur
les deux domaines : une seule construction, un seul design, un seul
déploiement.

**Le surcoût pour un membre qui charge l'application est de 345 octets
compressés** — mesuré en construisant avec et sans le branchement. Les pages
vitrine sont en chargement différé : leur code n'est jamais téléchargé sur
`app.`, et le CSS vitrine (5,7 Ko) vit dans un fichier séparé.

### Ce qui compte le plus : les prix sont lus en base

Ils étaient figés dans le page-builder — et c'est ainsi que le site avait fini
par annoncer deux délais d'annulation différents. Les **sept packs**, les
**deux délais** (12 h collectif, 24 h personal training) et les **frais
d'inscription** viennent maintenant de `pack_types` et d'`app_settings`.

Un montant modifié dans l'administration apparaît au rechargement suivant. **Il
ne peut plus y avoir deux vérités.**

### Le formulaire de contact, et la protection qui n'en était pas une

Edge Function `contact`, **la seule du projet ouverte sans authentification** :
un visiteur qui écrit n'a pas de compte. Elle se défend par un champ-piège, des
bornes de longueur, un échappement HTML et une limite de cinq envois par heure
et par IP.

**Cette limite comptait d'abord en mémoire de l'instance.** Éprouvé en ligne :
**dix envois consécutifs sont passés sans jamais être refusés** — Supabase
répartit les requêtes sur plusieurs instances, chacune repartant de zéro. Le
compteur vit donc en base (`contact_envois`), seul endroit où l'état est
partagé, avec purge des IP après 24 h.

> **Leçon générale** : un état qui doit être partagé ne peut pas vivre en
> mémoire d'une Edge Function. Et une protection ne vaut que ce que vaut son
> épreuve — celle-ci semblait fonctionner tant qu'on ne l'avait pas testée.

**Second défaut** : `supabase.functions.invoke` remplit `error` mais **jette le
corps de la réponse**. Le visiteur lisait « L'envoi a échoué » là où la fonction
disait « Trop de messages envoyés, réessayez dans un moment » — un message qui,
lui, indique quoi faire. Remplacé par `fetch`.

Chaîne éprouvée de bout en bout le 31 au matin : les messages arrivent.

### L'adresse e-mail du studio était fausse

`app_settings.studio_info.email` portait **`info@backotrackstudio.be`** — sans
le « n » de « track ». Ce n'était pas cosmétique : ce réglage alimente les CGV
et la politique de confidentialité, où il apparaît **trois fois**, dont deux
comme point de contact pour l'exercice des droits RGPD. Un membre qui écrivait
à cette adresse n'atteignait personne.

Corrigée en `info@backontrackstudio.be`, qui remplace aussi l'ancienne boîte
Gmail partout sur le site.

### Les images

**95 Mo → 5 Mo.** Les photos étaient servies telles que sorties de l'appareil,
jusqu'à 5590×4472 et 14 Mo pièce, pour des vignettes affichées à quelques
centaines de pixels. Ramenées à 1600 px de large en WebP.

Les originaux sont dans `.vitrine-source/` (ignoré par git), avec le HTML brut
des sept pages et leurs textes en markdown.

### Le design

Tout tient dans **`src/vitrine.css`**, variables en tête. Les pages ne portent
que du balisage : changer une couleur ou un espacement ne demande pas de lire
le JSX.

L'en-tête est **sombre par obligation** — le logo est un aplat blanc sans
contour, il disparaît sur fond clair. Le vert lime n'est pas un choix
d'humeur : c'est le `--primary` du thème sombre de l'application, et la couleur
des poignées d'élastiques sur les photos du studio.

Les six cours s'ouvrent en **fenêtre de détail**, bâtie sur `<dialog>` : le
navigateur apporte le fond assombri, le piège du focus, la fermeture par Échap
et le retour du focus au bouton d'origine.

### La bascule

Le WordPress n'est **pas supprimé** : il est écarté dans
`~/wordpress-archive-20260831`, intact, avec son `wp-config.php`. Un `mv` le
remet en place. À garder deux ou trois semaines.

**Vingt-deux redirections 301**, dans `serveur/htaccess-domaine-principal` —
vérifiées une par une. Sans elles, le référencement local sur « studio fitness
Rixensart » se serait dilué et tout lien existant serait tombé en 404.

`serveur/` est un dossier nouveau : `deploiement.sh` exclut `.htaccess` du
rsync (sinon `--delete` emporterait la configuration Apache), ces fichiers ne
sont donc **jamais déployés automatiquement** et se recopient à la main.

---

## Deux incidents de cette session, et ce qu'ils apprennent

### `db push` est devenu dangereux, et l'ignorer a coûté

**Ne plus jamais lancer `supabase db push` sur ce dépôt.**

Supabase attend un horodatage à **14 chiffres** (`20260805143022_nom.sql`). Les
67 migrations du projet n'en portent que **8** (`20260805_nom.sql`). Le CLI ne
garde que ce préfixe comme identifiant : les huit migrations du 5 août portent
donc toutes la version `20260805`, et sept d'entre elles lui paraissent
absentes de la base.

`db push --dry-run` veut aujourd'hui rejouer **50 migrations déjà
appliquées** — dont `20260805_reset_member_test_data.sql`, sur une production
de 64 comptes réels.

Ce piège est resté invisible tant que les migrations s'appliquaient à la main
par l'éditeur Supabase, comme le décrit la documentation technique. Il s'est
révélé quand `db push` a été lancé : **trois migrations ont été appliquées
avant l'échec**, dont `20260830_retirer_pack_essai.sql` — un chantier dont la
décision n'était pas prise.

**Cause première** : un `migration repair --status reverted` lancé sur une
hypothèse non vérifiée, pour réparer une divergence d'historique. Le CLI a
alors considéré l'historique comme incomplet et voulu tout rejouer.

> **Règle** : ne jamais lancer `migration repair` sans avoir vérifié en base ce
> que la migration visée a réellement créé. Et pour appliquer une migration :
> l'éditeur SQL de Supabase, pas `db push`.

Le renommage des 67 fichiers avec un horodatage complet reste à faire, **à
froid**.

### `install.sql` amputé de 713 lignes, rattrapé au contrôle

En séparant les deux chantiers pour faire deux commits distincts, le découpage
d'`install.sql` a supprimé **713 lignes** — vingt fonctions, dont `has_role`,
`get_available_credits`, `promote_from_waitlist` et `update_member_status`. Le
premier commit est parti avec ce fichier amputé.

Détecté au contrôle qui suivait, restauré depuis la copie prise avant
découpage, commit corrigé par `--amend`. Le fichier porte **5426 lignes, 28
tables, 84 fonctions**, vérifiées.

> C'est exactement le scénario que la règle n°1 du `CLAUDE.md` décrit : un
> `install.sql` faux **en silence**, qui paraît fonctionner et produit une base
> incomplète. Rien n'avait été déployé entre-temps.

---

## Ce qui reste ouvert au 2026-08-31

- Soumettre le **sitemap** à Google Search Console
- Supprimer `~/wordpress-archive-20260831` dans deux ou trois semaines (7,2 Go)
- **Renommer les 67 migrations** avec un horodatage à 14 chiffres, à froid
- La **décision sur le retrait de séance d'essai** : la fonction existe en base
  (appliquée par accident), le front est commité mais **pas déployé**
- SPF ne mentionne pas Resend ; hCaptcha ; comptes développeurs Apple et Google
- Copier `.dumps/bot-20260829-120547.sql` et `wp-backontrack-20260831.sql.gz`
  hors du Mac mini
- La page `/rgpd` du WordPress déclarait **Technogym responsable conjoint** du
  traitement, avec transfert vers les États-Unis. Elle disparaît avec le
  WordPress (301 vers `/confidentialite`), mais la question de fond reste :
  reste-t-il des données chez Technogym / mywellness ?

---

## Session du 2026-08-31 (soir, suite) — arrêter la redirection sans toucher la base

> **v3.99.0**. Documentation seule.

**Retour de Christian : « je ne comprends rien à tout ce que tu viens de me
décrire ».** La procédure précédente était juste, mais trop technique pour ce
qui était demandé — arrêter une redirection, pas migrer un site.

`docs/arreter-la-redirection-wp.md` : **deux lignes dans `wp-config.php`**
(`WP_HOME` et `WP_SITEURL`), et la redirection s'arrête. Ces constantes priment
sur ce qui est écrit en base **sans le modifier** — donc sans risque, et
réversible en supprimant les deux lignes.

C'est exactement le « piège » signalé dans la procédure longue, retourné en
solution : ce qui empêchait un remplacement de base d'avoir un effet devient ici
le moyen le plus court d'obtenir le résultat voulu.

**Ce que le raccourci ne fait pas** : les 32 755 URL restent en base. Des images
manqueront, des liens ramèneront à la vitrine. Pour une relecture de la
présentation par les coachs, c'est suffisant — la réécriture complète reste
documentée si le besoin se précise.

### Le certificat SSL est auto-signé

Christian a créé un certificat, mais le serveur présente encore un
**auto-signé** (`issuer=CN=wp.backontrackstudio.be`) : les navigateurs
afficheront « Connexion non privée ». **Sans rapport avec la redirection** —
c'est AutoSSL qui reste à lancer dans cPanel. Pour une relecture interne, on
peut passer outre l'alerte.

**Boucle de redirection écartée** : `backontrackstudio.be` répond 200 et ne
renvoie pas vers `wp.`. La manipulation est sans risque.

---

## Session du 2026-08-31 (fin de journée) — la vitrine imite le WordPress, le planning suit le mode

> **v3.113.0**, vingt commits depuis le handoff de 13h15. Build vert, lint
> stable à **37**. La vitrine a été déployée plusieurs fois dans la journée ;
> **les derniers commits ne le sont pas** — ni le correctif du planning.

### Le point de méthode de la journée

Christian, après plusieurs allers-retours : **« tu peux activer l'extension
Chrome pour analyser le style des deux pages. Pourquoi tu ne le fais pas ? »**

Le travail se faisait sur le HTML archivé (`.vitrine-source/`) alors que
l'ancien site tournait sur `wp.backontrackstudio.be` depuis le début de
l'après-midi. **Comparer les valeurs calculées des deux pages, à fenêtre
égale, révèle des écarts que le fichier archivé ne peut pas montrer** — parce
que le CSS d'AutomaticCSS et les règles de Bricks n'y figurent pas.

Tout ce qui a été corrigé après cette remarque l'a été par mesure, pas par
lecture. C'est la leçon à retenir : **quand l'original est en ligne, on le
mesure ; on ne lit son archive que faute de mieux.**

### La vitrine reprend l'accueil du WordPress

Demande initiale : remettre le hero à vidéo. Elle s'est élargie, à la demande
répétée de Christian, à **une copie fidèle de la page d'accueil**, texte et
style compris.

**La structure.** Les onze sections du WordPress, dans l'ordre : hero vidéo,
« Le studio à taille humaine », carrousel de huit photos, « Nos formules de
cours », « Notre équipe », les cours, « Prêt·e à te (re)mettre en mouvement ? »,
les six témoignages clients, la FAQ, « Envie de faire bouger vos
collaborateurs ? », le texte de bas de page. Le bandeau de chiffres 5 / 50 /
7j7 **n'existait pas dans l'original** : supprimé.

**Les textes** sont repris mot pour mot, y compris ce qui avait été resserré à
la réécriture du matin — deux chapeaux inventés ont disparu.

**Le style**, valeur par valeur : Bebas Neue partout (titres, sous-titres,
boutons, menu), h1 à 92 px / interligne 90, titres de section à 60 px bornés à
550 px, fond noir pur, boutons carrés en noir et blanc.

### Sept défauts trouvés par l'œil de Christian, expliqués par la mesure

Chacun a été signalé à l'écran, puis confirmé et chiffré :

1. **La vidéo débordait en hauteur** — 1160 px contre 760. Cause :
   `min-width: 177.78%` sur l'iframe. Pour couvrir en largeur, elle grandit en
   hauteur d'autant, jusqu'à 1778 px pour un bloc qui n'en fait que 810. La
   mesure de l'original donne `min-width: 0px` : **le WordPress ne cherche pas
   à couvrir**, il laisse le lecteur garder son format.
2. **La vidéo s'étirait au redimensionnement.** Le bloc d'origine a
   `width: 100%` ET `left: 20%` : il déborde de 20 % à droite, hors écran, et
   ce débordement est rogné. Sa largeur suit la fenêtre. Avec `right: 0`, elle
   se comprimait entre 20 % et le bord.
3. **Le texte du hero ne débordait pas sur le noir.** Le conteneur de
   l'original fait 1072 px et non 1177 : Bricks imbrique un conteneur à 90 %
   dans un autre à 90 %, soit 81 %.
4. **Les caractères paraissaient fins.** Pas une affaire de graisse — Bebas
   Neue n'en a qu'une — mais de `-webkit-font-smoothing: antialiased`, que la
   vitrine appliquait et que le WordPress n'applique pas. **Sur macOS, cette
   règle amincit nettement le trait.**
5. **Les fonds étaient clairs.** Le relevé tranche : aucune section de la page
   d'origine ne déclare de fond, elles héritent toutes du thème, qui est noir.
   **Le WordPress n'est pas un site clair avec des sections sombres, c'est
   l'inverse** — la vitrine faisait exactement le contraire. Palette inversée.
6. **Les textes étaient plus durs.** L'original n'emploie que du blanc
   transparent ; la vitrine, des gris opaques légèrement bleutés (`#c8ccd0`).
   Christian a fourni la valeur du thème : **`#dddedf`**.
7. **L'en-tête était un bandeau noir opaque**, là où l'original est
   **transparent** et se pose par-dessus le hero — ce qui reculait le hero
   d'autant. Liens en Bebas Neue 26 px, lien courant en jaune
   `rgb(255,213,122)`, dernier lien en bouton blanc à texte noir.

**Le vert lime de l'application** a été retiré partout : l'original n'a aucun
bouton vert, et les pastilles cochées devant les arguments étaient une
invention — l'original pose ces textes sur un fond beige translucide
`rgba(206,207,165,0.2)`.

### Décision : les tarifs restent lus en base

Arbitrée par Christian. La copie est fidèle **sauf** sur ce point : les tarifs,
la FAQ et le formulaire continuent de lire la base plutôt que d'être figés
comme dans le WordPress.

C'est la raison d'être de la vitrine — le page-builder figeait les prix, et le
site avait fini par annoncer **deux délais d'annulation contradictoires**, 12 h
sur une page et 24 h sur l'autre, sur une clause contractuelle.

### Le planning suit maintenant le mode choisi

Signalé par Christian sur `jag.` : **« ça n'a pas de sens que cliquer Planning
en mode Membre et en mode Admin montre la même chose »**.

Vérifié, et exact : **`SchedulePage` n'importait jamais `useMode`**. Elle
décidait de tout sur le rôle. Un admin qui basculait en Membre voyait le bouton
passer au vert et **rien d'autre changer**.

Seize endroits de la page en dépendent : le résumé des crédits, l'accès aux
semaines passées, les cours à surveiller, les décisions en attente, le nom des
salles — code technique côté staff, nom lisible côté client — et ce que fait un
clic, gérer ou réserver. Le chargement des données suivait le rôle lui aussi :
les cours annulés restaient affichés.

`isStaff` combine désormais le rôle **et** le mode. **Ce n'est pas un contrôle
d'accès** : le contexte le dit déjà, « le mode ne donne aucun droit, il choisit
ce qu'on affiche ». Routes et policies RLS inchangées.

> **Ce que ça débloque.** Le 31 août au matin, un coach signalait « 5 places
> disponibles » sur un cours complet. Le défaut ne touchait **que les membres** :
> admin et coach lisent toutes les réservations, leurs compteurs étaient justes,
> et aucun écran interne ne pouvait montrer le problème. La leçon notée ce
> jour-là — **tester avec un compte client** — devient applicable sans créer de
> compte.

Trois pages distinguent le staff sans lire le mode (`HelpPage`,
`PerformancesPage`, `ProfilePage`). **Écartées volontairement** : elles ajoutent
une capacité réservée au staff, pas une vue alternative. Les faire suivre le
mode retirerait une fonction au lieu d'en montrer une autre.

### L'ancien WordPress est consultable sur `wp.`

Il tourne sur `wp.backontrackstudio.be`, pour que les coachs puissent comparer.

**La méthode retenue a changé en cours de route, et c'est le point à retenir.**
La procédure complète (réécriture des 32 755 URL par `wp search-replace`) a été
écrite, puis **rendue inutile** par un raccourci : deux lignes dans
`wp-config.php` — `WP_HOME` et `WP_SITEURL` — suffisent à arrêter la
redirection. Elles priment sur la base **sans la modifier**, donc sans risque,
et s'annulent en les supprimant.

C'est le « piège » signalé dans la procédure longue, **retourné en solution** :
ce qui empêchait un remplacement de base d'avoir un effet devient le chemin le
plus court vers le résultat.

**Ce que le raccourci ne fait pas** : les URL restent en base, donc six images
de la page d'accueil ne s'affichent pas (elles existent pourtant sur `wp.` —
la page les demande à l'ancienne adresse). Suffisant pour juger la
présentation.

**Trois mesures prises sur le dump**, qui servent si la réécriture devient
nécessaire : préfixe `wpbot_` et non `wp_`, **32 755 URL** dont **13 982
sérialisées** — un `sed` en viderait quatorze mille en silence — et deux
plugins de cache (W3 Total Cache, LiteSpeed) qui font croire à un échec.

### Confier la vitrine à quelqu'un d'autre

`docs/confier-la-vitrine.md` répond à une question de Christian : que donner à
un designer ou à qui corrige un texte.

Le point utile : **`src/vitrine.css` est autonome** — 1 611 lignes sans aucune
dépendance au reste du projet, hors la police Google Fonts. Un designer peut le
retoucher de bout en bout sans rien casser. Les textes, eux, tiennent dans un
seul fichier, regroupés en tête avant le balisage.

Le document dit aussi ce qui **ne se confie pas** : les `.env`, les dumps, le
script de déploiement.

### Ce que l'en-tête flottant a cassé, et pourquoi

Passer l'en-tête en `position: absolute` — pour qu'il se pose par-dessus le
hero comme dans le WordPress — a eu une conséquence que je n'avais pas vue :
**il ne pousse plus le contenu**. La compensation posée en remède ne visait que
les classes `v-`, or **le planning est écrit en Tailwind** : le menu recouvrait
son sélecteur de jours.

La réserve est désormais sur `main`, ce qui couvre toutes les pages quelle que
soit leur façon d'être écrite, et **sa hauteur est mesurée au rendu** : la
valeur en dur valait 78 px quand l'en-tête en fait 83 — et 109 dès que le menu
passe sur deux lignes. Un `ResizeObserver` la suit, parce qu'elle change aussi
quand le menu se déplie, sans que la fenêtre bouge.

> Le hero garde son plein écran par une **marge négative**, pas par un `:has()`
> sur le parent : `:has()` manque aux navigateurs plus anciens, et une règle qui
> échoue laisserait le hero décalé sur la page la plus vue du site.

### Trois erreurs de mesure corrigées

Le bouton « Se connecter » était « beaucoup trop grand et laid ». La mesure sur
l'original donne **245 × 50 px, police 20 px, padding 8px 35px, min-height 0** ;
la vitrine cumulait une police de 26 px, un padding de 16 px **et** le
`min-height: 44px` hérité de `.v-bouton`.

Les liens du menu passent aussi de 26 à 20 px. **26 px est la valeur du menu
déplié sur mobile**, pas celle du grand écran — une lecture trop rapide du CSS.

Le texte de bas de page était un grand titre centré en Bebas Neue. Le relevé ne
pose **aucun style de titre** sur ces lignes : elles héritent du corps de page,
alignées à gauche. Un bloc CSS entier, vestige de la version précédente,
centrait encore le tout.

### La FAQ passe de douze à six questions

Six questions dans l'original, avec un accordéon — que la vitrine avait déjà
(`<details>`/`<summary>`). Il manquait seulement de s'en tenir aux six.

Leurs réponses sont reprises **mot pour mot**, y compris celle sur le
stationnement, qui donne des indications qu'aucune réécriture n'aurait
inventées : la zone bleue de l'Avenue des Pâquerettes et le parking gratuit de
l'Intermarché.

Le mécanisme qui lit les délais en base ne sert plus aucune réponse. **Conservé
quand même** : une question sur les délais reviendra, et elle devra lire la base
plutôt que figer un chiffre.

### La page des cours change de présentation

Christian a fourni la grille de la page « Nos cours semi-privés » du WordPress
et **proposé d'en faire une seconde page** plutôt qu'un remplacement, pour que
les coachs tranchent sur pièces. Bonne méthode : il a choisi la grille après
l'avoir vue.

`/cours` sert donc la grille, `/cours-2` garde l'ancienne liste le temps de la
montrer. **Les fichiers ont été renommés, pas seulement les routes** — échanger
les seules adresses aurait laissé un `VitrineCours2Page` servant `/cours`.

Les six couleurs de pastille viennent du CSS d'origine et ne sont pas
décoratives : elles distinguent les familles de cours dans une grille de six.
Les six photos de cette page **diffèrent** de celles de `/cours`, ce qu'aucune
lecture de la capture n'aurait révélé.

### La section tarifs quitte l'accueil

À la demande de Christian : trop d'informations sur une seule page. Le bloc
reste sur `/tarifs`.

### La vidéo : le différé n'était pas le coupable

Un coach signale une vidéo qui ne se charge pas de façon fluide sur son Mac.

Le différé (`requestIdleCallback`) a été retiré — elle part maintenant dès
l'ouverture, avec deux `preconnect`. Mais **la mesure disculpe ce réglage** : le
WordPress diffère lui aussi (`data-src`, `loading=lazy`). Le vrai frein est le
poids de YouTube — **131 Ko rien que pour la page d'intégration**, avant un
lecteur de plusieurs centaines de kilo-octets.

Christian a choisi de garder YouTube plutôt que d'héberger un fichier. **La
gêne peut donc persister sur une connexion lente** : la corriger vraiment
demanderait un `.mp4` servi depuis o2switch, ce qui suppose de récupérer le
fichier envoyé à YouTube. À rouvrir si les coachs le signalent encore.

### Un 403 chez un tiers : le site n'était pas en cause

Signalé sur Firefox depuis un PC extérieur. Toutes les adresses répondent
**200** depuis le Mac mini, y compris en se faisant passer pour Firefox sur
Windows.

L'information décisive est venue de Christian : **`aikicom.eu` fonctionnait
depuis ce même poste**, alors qu'il est sur le même compte o2switch. Cela écarte
le pare-feu Imunify360, qui aurait bloqué les deux.

Edge **et** Firefox réclamant tous deux un proxy, c'est le **réseau** de ce
poste qui impose un intermédiaire — la requête n'atteint jamais o2switch.

Écarté par la mesure : un filtre public de réputation (les deux domaines
résolvent via le DNS familial de Cloudflare), une IP suspecte (`app.` est sur la
même adresse qu'`aikicom.eu`, qui passait), un domaine trop récent (enregistré
en août 2024).

> **Rien à corriger côté site.** `docs/diagnostic-403.md` garde la démarche : ce
> symptôme reviendra, et la première réaction sera de soupçonner le serveur.

### Les deux seuls 403 du site sont voulus

`/assets/` et `/vitrine/` répondent 403 : c'est `Options -Indexes`, qui empêche
d'afficher l'inventaire des fichiers. Un visiteur n'y va jamais.

---

## Session du 2026-08-31 (soir) — le sous-domaine est `wp.`, et il lui manque son certificat

> **v3.98.0**. Documentation seule.

Christian a créé `wp.backontrackstudio.be` et y a déplacé les fichiers. La
procédure est adaptée à cette adresse (`wordpress-sur-sous-domaine.md`, renommé
de `wordpress-sur-desk.md`).

**Deux vérifications faites avant de guider, et toutes deux ont servi :**

**L'adresse portait une coquille.** Elle avait été annoncée comme
`wp.backontractstudio.be` — un `c` à la place du `k`. Le DNS tranche :
`wp.backontrackstudio.be` résout vers 109.234.165.117 (le serveur o2switch), la
variante avec `c` ne résout pas. Sans ce contrôle, l'orthographe fautive
partait en base **32 755 fois**.

**Le certificat SSL n'existe pas encore.** Le sous-domaine répond en HTTP mais
rien en HTTPS. L'ordre des opérations en dépend : écrire `https://` en base
sans certificat rendrait le site inaccessible derrière une alerte de sécurité,
et la cause serait cherchée du mauvais côté. C'est devenu l'étape 0 — AutoSSL
dans cPanel, avant tout le reste.

**L'état constaté confirme le diagnostic** posé plus tôt :

```
http://wp.backontrackstudio.be/  ->  301  ->  https://backontrackstudio.be/
```

Les fichiers ont bougé, la base non : WordPress y lit le domaine principal et
renvoie tout le monde vers la vitrine. C'est exactement ce que le remplacement
d'URL corrige, et la preuve que déplacer les fichiers ne suffit pas.

---

## Session du 2026-08-31 (fin d'après-midi) — WordPress ira sur un sous-domaine

> **v3.97.0**. Documentation seule, aucun code touché.

**Christian a tranché** : le WordPress tournera sur un sous-domaine — au final
**`wp.backontrackstudio.be`** — et non par commutation sur le domaine principal.
La voie sans réécriture de base reste documentée (`remettre-le-wordpress.md`)
pour le cas où l'ancien site devrait un jour reprendre sa place.

`docs/wordpress-sur-sous-domaine.md` décrit **cette** voie, correctement — parce que
mal faite, elle casse le site en silence.

### Ce que le dump a appris

Trois choses mesurées sur `wp-backontrack-20260831.sql.gz`, qui n'étaient pas
connues quand la première procédure a été écrite :

- **Le préfixe des tables est `wpbot_`**, pas `wp_`. La première procédure
  interrogeait `wp_options` : la requête aurait échoué. Corrigé.
- **32 755 occurrences** du domaine en base, dont **13 982 sérialisées**. Le
  chiffre qui tranche : un `sed` sur le dump viderait silencieusement près de
  quatorze mille valeurs — l'essentiel des mises en page Bricks. `wp
  search-replace --precise --recurse-objects` est donc **obligatoire**, pas
  préférable.
- **Deux plugins de cache** — W3 Total Cache et LiteSpeed. Ils servent des
  pages figées avec les anciennes URL, et font croire à un remplacement raté
  alors qu'il a réussi. La procédure conseille de les désactiver le temps de la
  relecture plutôt que de les vider.

Un piège est écarté en préalable : si `wp-config.php` force `WP_HOME` et
`WP_SITEURL`, **aucun remplacement en base n'a d'effet visible**. La procédure
fait vérifier ce point avant tout le reste.

### Ce que coûte cette voie

La base est réécrite pour pointer vers `wp.`. Remettre un jour ce WordPress
en production imposera le remplacement en sens inverse. C'est le prix du
sous-domaine, assumé, et il est écrit dans la procédure.

### Le hero vidéo n'est pas en ligne

Signalé par Christian : le site sert toujours l'ancienne présentation. Vérifié —
`backontrackstudio.be` sert `index-HPE8d5UG.js`, la construction du matin. Le
hero vidéo est **commité et compilé** (`youtube-nocookie` présent dans
`VitrineAccueilPage-B13ZSyB0.js`), mais **jamais déployé** : rien n'est parti
sur le serveur de la journée.

---

## Session du 2026-08-31 (après-midi) — le hero d'origine revient, WordPress redevient consultable

> **v3.95.0**. Build vert, lint **stable à 37** (aucun ajout). Rien n'est
> déployé ni poussé.

**Les coachs n'ont pas aimé la vitrine livrée le matin.** Deux demandes
distinctes : retrouver le hero à vidéo de l'ancien site, et pouvoir remettre le
WordPress en ligne pour comparer.

### La vidéo de fond revient sur l'accueil

Le hero React posait une photo fixe. Le hero d'origine, retrouvé dans
`.vitrine-source/pages/accueil.html`, tenait sur une **vidéo YouTube**
(`A3FVv05feQI`) en fond plein écran, muette et en boucle.

Toute la composition d'origine est reprise, pas seulement la vidéo : le nom du
studio et l'adresse, le titre « Studio de fitness à Rixensart », les deux
boutons « Découvrir nos cours » et « Séance d'essai gratuite », et l'invite à
défiler — la souris animée et son mot « Explorer ». Les boutons pointent
désormais vers les routes React, les anciennes URL WordPress étant mortes.

**Trois écarts assumés par rapport à une reprise littérale :**

- **La vidéo se charge en différé** (`requestIdleCallback`, repli sur un délai
  pour Safari). L'iframe YouTube tire près d'un demi-mégaoctet de script : la
  charger d'emblée retarderait le titre, c'est-à-dire la seule chose que le
  visiteur est venu lire. La photo tient le fond pendant ce temps, et **reste
  visible sous la vidéo** — si YouTube est bloqué ou lent, le hero ne devient
  jamais un rectangle noir.
- **`prefers-reduced-motion` est respecté** : la vidéo ne se charge pas du tout
  pour qui a désactivé les animations système. Une vidéo plein écran en boucle
  est précisément ce que ce réglage vise.
- **Le voile est allégé** — de 92 % en bas à un dégradé 70 → 57 % uniforme,
  celui du site d'origine. Le voile précédent avait été calculé pour un texte
  calé en bas de photo ; sur une vidéo centrée, il l'aurait noyée.

L'iframe garde `youtube-nocookie.com` : aucun cookie publicitaire n'est déposé
tant que rien n'est joué, ce qui évite d'avoir à demander un consentement sur
la page d'accueil.

> **Vérification incomplète, à faire à l'écran.** Le DOM confirme que l'iframe
> se pose, qu'elle couvre (2503×1408) et qu'aucune erreur console n'est levée.
> **La lecture elle-même n'a pas pu être constatée** : le navigateur piloté
> tient son onglet en `visibilityState: hidden`, où Chrome ne démarre pas
> l'autoplay. C'est le piège déjà rencontré le matin même. À regarder dans un
> vrai navigateur avant de déployer.

### Remettre le WordPress : le sous-domaine était une fausse bonne idée

Demande initiale : déplacer les fichiers WordPress dans un sous-domaine
(`desk.` ou `site.`).

**Écarté, et c'est la décision qui compte.** Les URL de WordPress vivent en
base — `wp_options`, chaque lien de chaque page, et **sérialisées** dans les
données Bricks. Servir depuis un autre domaine impose de réécrire la base, puis
de la réécrire en sens inverse au retour : deux migrations là où aucune n'est
nécessaire. Et un `sed` sur le dump ne peut pas faire ce travail — une chaîne
sérialisée porte sa longueur (`s:29:"..."`), que le remplacement texte ne met
pas à jour, et PHP jette alors la valeur **en silence**.

**Retenu à la place** : WordPress reste sur `backontrackstudio.be`, URL
intactes, et un `.htaccess` décide lequel des deux sites Apache sert. Les deux
cohabitent dans `vitrine/` et `wordpress/` ; **basculer, c'est déplacer un `#`**,
sans toucher à la base, et c'est réversible en dix secondes. Bénéfice
secondaire : les coachs jugent l'ancien site à sa vraie adresse, pas une copie
sur un sous-domaine qui se comporterait autrement.

- `serveur/htaccess-bascule-wordpress` — le commutateur
- `docs/remettre-le-wordpress.md` — la procédure, avec l'étape 0 de
  vérification et le retour en arrière à chaque étape

**Rien n'a été exécuté sur le serveur** : Christian lance la procédure
lui-même. **La base WordPress n'a pas été supprimée** — confirmé le jour même,
ce qui lève la seule inconnue de la procédure. Le dump
`wp-backontrack-20260831.sql.gz` reste le filet si elle venait à disparaître.

**À savoir avant de comparer les deux sites** : l'archive WordPress n'est pas en
bon état — `/seance-dessai` est cassée (reCaptcha invalide), `/horaire` renvoie
vers Technogym, et le délai d'annulation s'y contredit (12 h contre 24 h). Sans
cette mise en garde, les coachs compareront la vitrine à un souvenir plutôt
qu'au site réel.

### Point de vigilance

`./deploiement.sh prod-site` envoie vers `~/backontrackstudio.be/` et **non**
vers `~/backontrackstudio.be/vitrine/`. Une fois le rangement fait, ce script
doit être corrigé avant d'être relancé, sans quoi il écraserait le commutateur.
`app.` et `jag.` ne sont pas concernés.

---

## Sessions des 2026-08-29 et 30 — la production existe

> Deux journées enchaînées. **v3.74.0**, une trentaine de commits poussés
> (`ac80010..849acac`), build vert, lint stable à 36.

### Ce qui a changé pour de bon

| | |
|---|---|
| `bot3` | base de test, Paris, sur `jag.backontrackstudio.be` — **en service, chargée** |
| `bot-ops` | **production**, Paris, sur `app.backontrackstudio.be` — installée, **vide** |
| ~~`bot`~~ | supprimée. Sauvegarde dans `.dumps/bot-20260829-120547.sql`, **sur le Mac mini seulement** |

`bot` n'a jamais été une production : c'était la base de développement. Le plan
Pro n'inclut qu'un projet actif — un second coûte 10 $/mois, vérifié auprès de
l'API — d'où sa suppression avant la création de `bot-ops`.

### La migration, éprouvée de bout en bout

Le handoff du 28 posait l'objectif en notant qu'il n'avait jamais été atteint :
la chaîne complète n'avait jamais tourné sans intervention. **Elle est passée
d'un coup.** Onze compteurs identiques de part et d'autre, les 8 fichiers du
bucket copiés, aucun orphelin, soldes de crédits concordants membre par membre.

Deux scripts remplacent les quatre qui s'étaient empilés :
`creer-espace-application.sh` et `migrer-donnees.sh`. Le second ne vide jamais
rien — il refuse de tourner sur une cible habitée. C'est la différence avec
`copier-bot-vers-bot2.sh`, commode pour une base de développement qu'on
recharge sans cesse, dangereux pour une base qu'on met en service.

**Zéro image en URL absolue** : le correctif du 28 tient. C'était le défaut que
le journal redoutait le plus — il aurait survécu à la migration et n'aurait
cassé qu'à la suppression de l'ancien projet.

### Deux fuites de données personnelles, fermées

Ni l'une ni l'autre n'est venue d'une revue de sécurité. La première d'une
alerte du tableau de bord que Christian a pensé à signaler, la seconde d'une
demande de lien de menu.

**`coach_profiles`** exposait `email` et `phone` des coachs, avec un `GRANT` à
`anon` — lisibles par n'importe qui avec la clé publishable du site.

**`profiles`** exposait **tout** : 23 profils complets, 23 e-mails, 21
téléphones, 17 adresses, des dates de naissance, des contacts d'urgence et un
`medical_conditions` — donnée de santé au sens de l'article 9 du RGPD. Une
policy `USING (true)` sans clause `TO` vaut pour `PUBLIC`, donc pour `anon`.

**État final** : un membre ne lit que son propre profil, le staff lit tout, et
la vue `profils_publics` (id, nom, photo) sert le planning et les listes.
Vérifié avec l'identité d'un membre simple — 1 profil lisible, 1 téléphone
visible, le sien.

> **Un défaut d'ordre dans `install.sql`** aurait annulé tout cela sur une base
> neuve : le `REVOKE` d'`anon` était posé en section 6, alors que la section 8
> refait `GRANT ... ON ALL TABLES TO anon` — et `ALL TABLES` inclut les vues.
> Les deux `REVOKE` sont désormais en fin de fichier.

> **La leçon, à rejouer sur toute nouvelle base** : ce qu'un écran affiche ne
> dit rien de ce qu'il rapatrie. Le seul test qui prouve quelque chose est un
> `curl` avec la clé publishable, sur chaque table, après toute modification de
> policy.

### Une page de diagnostic

`/admin/diagnostic`, réservée au `super_admin`. Sept contrôles, chacun avec son
remède. Elle regarde la base **avec les yeux de l'application** — le point de
vue qui manquait le 28, quand une base paraissait installée et refusait toute
lecture.

Son premier passage sur une base réelle a trouvé **trois faux positifs dans son
propre code** : deux tables de liaison sans colonne `id`, et `OPTIONS` interdit
en `no-cors` qui annonçait dix fonctions absentes. Aucun n'était visible à la
lecture.

### Le déploiement, en une commande

```bash
./deploiement.sh jag     # test
./deploiement.sh ops     # production, avec confirmation écrite
```

Bascule du `.env`, build, contrôle que `dist/` ne porte aucune trace de l'autre
base, envoi par rsync, puis **relecture du site en ligne**.

Ce qui n'était écrit nulle part et que ce script formalise : `.env` n'est jamais
déployé, mais **Vite grave ses valeurs dans `dist/`** — l'URL de la base
apparaît dans onze fichiers minifiés. Un `dist` est donc déjà lié à une base
avant d'être envoyé, et le même dossier ne peut pas servir les deux
sous-domaines.

L'accès SSH a été rétabli au passage. L'ancienne clé était protégée par une
phrase de passe oubliée : le serveur l'acceptait puis refusait la connexion, ce
qui donnait un « Permission denied (publickey) » trompeur.

### Ce que les incidents ont appris

**Un coach n'a pas pu créer son compte** : « Erreur : Load failed », rien
d'autre. Supabase limite les e-mails d'authentification à **deux par heure**
tant qu'aucun serveur SMTP n'est configuré. Le réglage manquait complètement de
la procédure — il ne voyage ni avec `install.sql` ni avec un dump, et il était
posé sur l'ancienne base depuis des mois sans que personne ne s'en souvienne.

Sa seconde tentative, elle, était un vrai échec réseau — une barre de signal,
4 % de batterie. Les journaux Supabase n'en portaient aucune trace : la requête
n'avait jamais atteint le serveur. L'application dit maintenant *« votre compte
n'a PAS été créé »*, ce qu'un membre a besoin de savoir pour décider s'il
recommence.

**Et le vrai défaut n'était pas dans le code** : le site déployé était en
3.36.0 alors que le dépôt en était à 3.56.0. Trois correctifs existaient déjà
et n'atteignaient personne.

### Les règles métier revues

**Statuts de membre** — un pack expiré ne fait plus sortir du studio : quatre
semaines de grâce avant de basculer en « Inactif ». L'état intermédiaire a
disparu, trois statuts disaient la même chose.

**Fenêtre de réservation** — un cours ne se réserve que dans les N prochains
jours, dix par défaut, réglable. Le planning le montre toujours ; seul le bouton
refuse, en annonçant la date d'ouverture. Fenêtre glissante, choix de Christian
contre l'ouverture par paliers qui aurait fait courir tout le monde à midi.

> **Le piège** : `book_member_by_staff` ne passe pas par `can_book_class`, elle
> refait ses propres contrôles. Il a fallu y ajouter la fenêtre séparément,
> sinon un coach l'aurait contournée sans le savoir.

**Journal d'activité** — « mot de passe oublié » laisse enfin une trace. Des
coachs disaient l'avoir fait, le journal ne montrait rien, et rien ne permettait
de trancher.

### Mobile et stores

Le compte développeur Apple est acheté, **au nom propre** de Christian.

Le projet iOS était resté en 2.12.0 depuis le 7 août, et `Info.plist` ne
déclarait **aucune permission** : le scanner de QR ne pouvait pas fonctionner
dans l'application native. Un évaluateur aurait testé une fonction cassée — pire
qu'une fonction absente, et c'est justement le meilleur argument contre le rejet
4.2.

`./scripts/verifier-mobile.sh` répond désormais à une seule question : peut-on
envoyer aujourd'hui ? Il contrôle aussi **le contenu de la production** — une
base vide fait rejeter pour « minimum functionality ».

### Décisions prises

| | |
|---|---|
| **Sous-domaines** | `jag.` test, `app.` production, `desk.` en redirection |
| **hCaptcha** | reporté — il exige aussi le widget côté code, l'activer à moitié casserait toutes les inscriptions |
| **Stripe** | reste en mode test sur `bot-ops` jusqu'à l'ouverture |
| **Données de bot3** | **ne pas migrer** vers la production — les coachs ressaisiront proprement |
| **Compte Apple** | individuel ; le transfert vers la SRL reste possible plus tard |

### Étude de faisabilité — reprise des clients

Cent clients à reprendre, chacun avec ses soldes et ses dates, parfois deux
types de crédits. **Faisable** : `credits_remaining` et `expires_at` sont portés
par l'achat, pas par le type de pack — deux packs support hors catalogue
suffisent.

Un seul tableur, mais deux phases à l'exécution : le déclencheur qui crée le
profil **avale ses erreurs**, un compte peut naître sans profil sans que rien ne
le signale. Il faut contrôler entre les deux lots.

Rien n'est développé. `docs/coachs-reprise-clients.md` explique la solution aux
coachs, sans la leur imposer.

### Soirée du 30 — coupons, séance d'essai

**Coupons, une utilisation par personne** (3.84.0). `check_coupon` refuse un
second usage du même coupon par le même membre (`already_used`). Le `max_uses`
du coupon reste un plafond **global** : deux limites distinctes, la doc admin le
dit désormais.

**Séance d'essai désactivable** (3.85.0). Administration → Paramètres reçoit un
interrupteur et le champ de validité. Le mécanisme était **déjà entier en base**
— `grant_trial_pack` teste `trial_pack.enabled` et refuse avec `disabled`, et
lit `validity_days` au même endroit. Seul l'écran manquait : aucune migration.

Éprouvé sur bot-ops en transaction annulée. Éteindre ne retire rien à qui a
déjà reçu sa séance ; la durée ne vaut que pour les attributions à venir.

Les deux sont **en production**, `app.` et `jag.` sont en 3.85.0.

### Chantier ouvert — retirer l'essai d'un membre

Le réglage global arrête la distribution à venir, pas les séances déjà données.
**Six existent en production**, et chaque membre repris de l'ancien système en
recevra une qu'il a déjà consommée au studio.

**Décidé** : `retirer_pack_essai(p_user_id)` supprime un essai **intact**, et se
contente de **vider et périmer** un essai **déjà utilisé**.

**Pourquoi pas une suppression franche** : `bookings.pack_purchase_id` et
`invoice_requests.pack_purchase_id` référencent le pack sans `ON DELETE`,
Postgres refuse donc d'effacer un pack qui a servi. Et l'effacer détacherait la
réservation de ce qui l'a payée — la séance resterait au planning sans qu'on
sache d'où venait le crédit. C'est une perte d'information, pas un nettoyage.

Le front est écrit et compile, la migration aussi. **Rien n'est commité** :
elle n'est appliquée sur aucune base, le front appellerait une fonction absente.
Reste à l'appliquer (en **deux exécutions** — `ALTER TYPE ADD VALUE` ne tolère
pas l'usage de la valeur dans la même transaction), la reporter dans
`install.sql`, documenter et tester. Détail dans le handoff du 30 à 19:54.

**À ne pas oublier** : la séance d'essai est **active** sur `app.`. L'éteindre
avant d'inviter les membres actuels à s'inscrire.

### Soirée du 30 — Stripe en live, et l'effacement d'un compte

**Stripe est passé en production.** Le compte qui encaisse est **Aikicom
Perspectives SRL** (`acct_1RyvQUFXRrGYb9N4`), confirmé par Christian comme
l'entité qui exploite le studio. Le compte « BackOnTrack » qu'on avait sous les
yeux n'a **jamais été activé** : il n'existe qu'en test, et son onboarding en
était resté au premier écran. C'est pourtant lui qui s'ouvre par défaut.

Webhook `we_1UAERwFXRrGYb9N49NuwCuRt` créé avec les cinq événements traités.
Stripe impose l'API `2025-07-30.basil` quand le code déclare `2023-10-16` —
sans conséquence, le webhook lit déjà les deux emplacements du champ
`subscription`. Secrets live posés, mode basculé. **Un premier paiement réel
est passé le soir même.**

### Effacer un compte créé par erreur

Un coach a supprimé un compte de test et s'est retrouvé avec une ligne
« Membre supprimé #1ddf3cd3 » dont il ne pouvait rien faire — l'adresse e-mail
restant prise dans `auth.users`.

**Décidé** : `effacer_membre_anonymise`, réservée au super_admin, exige que le
compte soit déjà anonymisé et refuse s'il reste une réservation, un pack, une
facture, un abonnement, des frais d'inscription ou un cours encadré. Les fiches
anonymisées disparaissent de la liste pour les coachs et les admins ; le
super_admin les garde, puisque lui seul peut les effacer.

**Écarté** : supprimer sans condition. La ligne anonymisée porte les références
comptables — c'est sa raison d'être, et elle reste la bonne réponse pour un
membre qui a fréquenté le studio.

### L'erreur qui a coûté un aller-retour

J'avais affirmé que toutes les clés étrangères étaient en `CASCADE`, sur la foi
d'une requête `information_schema` revenue **vide**. Or `information_schema`
**ne voit pas le schéma `auth`** : quatorze contraintes en `NO ACTION` pointent
vers `auth.users`. La première version de la fonction échouait sur
`activity_log_actor_id_fkey`, et Christian l'a découvert à l'écran.

**À retenir** : pour les clés étrangères touchant `auth`, interroger
`pg_constraint`, jamais `information_schema` — et se méfier d'un résultat vide
là où il devrait forcément y avoir des lignes.

Le journal d'activité méritait un traitement à part : ses descriptions gardent
**l'adresse e-mail en clair**, que l'anonymisation ne touche pas. Le laisser
derrière un effacement « complet » aurait été un mensonge.

### Deux bugs trouvés en chemin

Le **bouton corbeille de la liste des membres ne supprimait rien** : `DELETE`
direct sur `profiles`, table sans policy `DELETE`, donc refus RLS **sans
erreur** et écran annonçant une suppression fictive. Le piège même que le
CLAUDE.md documente.

Les **titres `h4` n'avaient pas d'ancre** dans `MarkdownDoc.tsx` : les renvois
entre chapitres du guide pointaient dans le vide sur `/help`.

### Toujours ouvert

Le **retrait de la séance d'essai** d'un membre reste écrit, **non appliqué et
non commité** — Christian a demandé de s'arrêter là pour juger demain si ce
chantier vaut d'être terminé.

La question est légitime : le réglage global fonctionne et suffit peut-être. Ce
qui reste ne concerne que les **six essais accordés avant** la coupure, dont
deux comptes de l'équipe et un déjà consommé. Quatre membres réels, donc, avec
un essai qui expire fin septembre. Le handoff du 30 à 22:29 pose les trois
voies : terminer, abandonner, ou retirer les six à la main sans livrer la
fonctionnalité.

Le report dans `install.sql` a été fait ce soir — **à défaire si le chantier
est abandonné**, sinon une base neuve porterait une fonction que l'application
n'appelle pas.

### Demandé pour demain

**Pas d'écran blanc pendant un déploiement.** Le `rsync` remplace `index.html`
avant les fichiers `assets/` qu'il nomme : un client qui charge la page à cet
instant voit un écran blanc quelques secondes. Trois pistes dans le handoff, la
moins coûteuse étant sans doute d'envoyer `assets/` d'abord et `index.html` en
dernier.

---

## Session du 2026-08-28

**`install.sql` produisait des bases inutilisables.** Le fichier ne posait
aucun `GRANT` de table : ses 36 `GRANT` portaient tous sur des fonctions. Une
base installée depuis lui refusait toute lecture sur ses 27 tables —
`permission denied for table ...` — alors que RLS, policies, fonctions et
triggers étaient parfaits. Une policy ne s'applique qu'**après** le droit SQL :
une table sous RLS mais sans `GRANT` n'est pas protégée avec soin, elle est
fermée.

Le défaut ne se voyait pas parce qu'un projet Supabase créé avec
« Automatically expose new tables » pose ces droits tout seul (`pg_default_acl`).
`bot` les a reçus à sa création en avril ; le fichier n'a donc jamais eu à les
porter. Or `strategie-base-neuve.md` recommandait de **décocher** cette case,
pour ne pas exposer une table avant qu'elle soit protégée. Le fichier et la
procédure se contredisaient, chacun paraissant correct isolément.

**Le symptôme était trompeur.** L'application se chargeait, la connexion
réussissait, mais tout écran restait vide et un `super_admin` fraîchement promu
n'avait ni le mode Admin ni le mode Coach. La base était pourtant juste : c'est
le front qui lisait `user_roles`, recevait un refus, et le traitait comme « ce
compte n'a aucun rôle ». `fetchRoles` faisait `const { data } = await …` sans
tester `error` — la règle n° 5, une fois de plus. Corrigé : l'erreur est
distinguée du cas « aucun rôle » et tracée ; les rôles ne sont plus vidés sur
erreur, un incident réseau ne devant pas dégrader une session ouverte.

**Ce que les contrôles du 27 août ne pouvaient pas voir.** `install.sql` avait
été rejoué et déclaré conforme la veille — 27 tables, 89 policies, 76 fonctions,
12 triggers, tous exacts. Aucun de ces compteurs ne regardait les droits. La
base était certifiée complète et refusait toute lecture. `check-policies.sql`
vérifie désormais aussi les `GRANT`, et signale une table dont RLS serait
désactivé. Lancé sur `bot` et sur la base de développement : muet des deux
côtés.

Les `GRANT` entrent dans `install.sql` en **section 8, placée en dernier** :
`ON ALL TABLES` ne vaut que pour ce qui existe déjà, et la vue `coach_profiles`
de la section 6 aurait été sautée plus haut. Un `ALTER DEFAULT PRIVILEGES`
accompagne, sans quoi le défaut reviendrait table par table au prochain ajout.

> **`bot` n'a pas le problème mais n'a pas non plus ce garde-fou** : le jour où
> une migration y crée une table, celle-ci naîtra sans droits et le bug se
> rejouera, en production. Appliquer `20260828_grants_tables.sql` sur `bot` la
> mettrait à l'abri — **non fait**, en attente de décision.

**Deux fichiers `.env`, et un bandeau qui dit où l'on est.** `.env.test` (base
de développement) et `.env.ops` (base opérationnelle), qu'on met en service par
`cp`. La mécanique est volontairement bête — un `IF` dans un `.env` n'existe
pas, ce n'est pas un langage — mais elle laissait un angle mort : le `.env` en
service ne disait pas d'où il venait. D'où un bandeau orange en tête de
l'application, affiché **hors production uniquement**. En ops, le silence est
le signal : un avertissement permanent finit par ne plus être lu. Le défaut
penche du côté sûr, toute valeur autre que `ops` déclenche le bandeau, y compris
une variable absente. Vérifié dans les deux sens sur le contenu du bundle : en
production le texte n'est pas masqué, il est **absent du code livré**.

Au passage, `.gitignore` ne couvrait que `.env` et `.env.*.local` : `.env.test`
et `.env.ops` seraient partis dans un commit avec leurs clés. Corrigé en
`.env.*` avec exception `!.env.example`.

**`supabase/promouvoir-super-admin.sql`** : le premier compte d'une base neuve
ne peut pas se promouvoir lui-même — depuis le 6 août `user_roles` n'a plus
aucune policy d'écriture, et `grant_user_role()` exige d'être déjà admin. Une
seule ligne à modifier, l'adresse. Il refuse une adresse inexistante au lieu de
la laisser passer pour un succès : sans ce contrôle, l'`INSERT` touche zéro
ligne sans lever d'erreur. Sans `\set`, qui est une commande psql et ne
fonctionne pas dans l'éditeur du dashboard. Éprouvé sur les trois cas — adresse
inconnue, promotion, rejeu.

**Décidé** : pas d'écran d'amorçage du premier `super_admin` dans
l'application. Il devrait écrire dans `user_roles`, donc rouvrir ce qu'on a
fermé le 6 août ; l'installation reste une opération manuelle, faite une fois
par base, par quelqu'un qui a déjà les accès au dashboard.

**Les données de `bot` sont sauvegardées.** 424 Ko, 27 tables `public` plus
`auth.users` et `auth.identities`, 23 comptes cohérents entre les trois —
`.dumps/bot-20260828-104047.sql`. C'était le préalable à la copie vers la base
de développement, et il a fallu lever deux obstacles pour l'obtenir.

**`bot` n'accepte plus la connexion directe.** `db.<ref>.supabase.co` refuse le
port 5432 — « Connection refused » — alors que l'API répond et que le projet est
`ACTIVE_HEALTHY`. Ce n'est ni le mot de passe ni le réseau : `bot2`, créé le
27 août, répond en direct depuis la même machine. Les projets antérieurs à la
fin de l'IPv4 gratuite (janvier 2024) ont perdu cet accès ; `bot` date d'avril.
La voie est le **pooler**, qui change deux choses à la fois : l'hôte
(`aws-N-eu-west-1.pooler.supabase.com`) et l'**utilisateur**, qui devient
`postgres.<ref>` et non `postgres`. Le préfixe `aws-0` / `aws-1` ne se devine
pas — les deux répondent au ping, un seul accepte le projet : il se lit dans
Project Settings → Database → Connection string → onglet « Session pooler ».

> À noter pour plus tard : **`bot` et `bot2` sont dans deux organisations
> différentes** (`pflryojyjqgxqoekgcbb` et `qmtrvtjqgfbehwkgawwl`). Le mot de
> passe d'une base se réinitialise dans les réglages du **projet**, sous la
> bonne organisation. Il n'est jamais réaffiché — montré une seule fois à la
> création — et son reset ne casse ni le front ni les Edge Functions, qui
> passent par les clés API et non par Postgres.

**`--schema=public` était neutralisé, en silence.** La ligne
`SCHEMAS=(--schema=public --table=auth.users --table=auth.identities)` ne
sortait que les deux tables `auth` : dès qu'un `--table` est présent, `pg_dump`
ignore `--schema`. Le premier dump pesait 28 Ko, s'annonçait comme un succès, et
ne contenait pas une ligne de données applicatives. Il faut écrire
`--table='public.*'`, qui se combine au lieu d'exclure.

Le défaut venait de `copier-bot-vers-bot2.sh`, d'où la ligne avait été reprise.
Il y était plus grave qu'ailleurs : le script vide `bot2` **avant** d'importer,
si bien qu'un dump amputé l'aurait laissée avec 23 comptes et aucune donnée. Les
deux scripts refusent désormais de continuer si le dump ne contient aucune table
`public` — dans le script de copie, ce contrôle s'exécute **avant** l'étape
destructrice.

**Décidé** : sauvegarder d'abord, copier ensuite. L'export a été sorti dans un
script à part, `scripts/sauvegarder-bot.sh`, qui ne fait que lire — aucune
écriture, sur aucune base. Un dump réussi vaut par lui-même, indépendamment de
la copie vers `bot2` ; les mêler dans un seul script rendait impossible de
sécuriser les données sans accepter au passage l'effacement de la base de
développement. Le contrôle affiche le compte de lignes par table : un dump vide
ne peut plus passer pour une sauvegarde réussie.

**Pas de dump depuis le dashboard** — la question s'est posée. Supabase n'offre
pas d'export complet : les Backups ne sont téléchargeables qu'à partir des plans
payants, et le « Download CSV » de l'éditeur SQL sort table par table, sans
`auth.users` ni l'ordre des dépendances. `pg_dump` reste la seule voie.

**Les données sont dans la base de développement.** 23 comptes, 23 profils,
28 rôles, 553 cours, 142 réservations, 158 performances — tous les comptes
correspondent au dump, et six contrôles d'intégrité relationnelle ne trouvent
aucun orphelin, malgré les triggers désactivés pendant l'import.
`christian@aikicom.eu` y est `super_admin` : **la connexion à la base de
développement se fait désormais avec les identifiants de `bot`**, les deux
comptes créés la veille ayant été effacés par le vidage.

**L'import a échoué trois fois, sur trois causes distinctes.** Chacune valait
d'être comprise plutôt que contournée.

1. **`app_settings` en doublon.** `reset-test-data.sql` préserve volontairement
   les tables de configuration — c'est juste pour un reset, mais pas quand un
   dump apporte sa propre version complète et que `key` est unique. Les
   11 lignes en place refusaient les 15 du dump. `app_settings` entre donc dans
   le vidage du script de copie.
2. **Contrainte `invoice_requests_status_check` trop étroite.** La base de
   développement, née d'`install.sql`, n'admettait que `pending` et `processed`
   quand `bot` accepte cinq statuts. La migration `20260807_clients_b2b.sql`
   avait élargi `bot` **sans être reportée dans `install.sql`** — la règle n° 1,
   prise en défaut, et invisible jusqu'à ce qu'une facture au statut `paid`
   cherche à entrer. Corrigé des deux côtés.
3. **Colonne `mollie_payment_id` absente.** Vestige de la migration Mollie
   abandonnée le 2026-08-03 : `bot` la porte encore, `install.sql` — réécrit
   depuis — ne la crée plus. Elle est **vide sur les 11 lignes**, elle a donc
   été retirée du fichier d'import plutôt qu'ajoutée à la base neuve. Ici
   `install.sql` a raison et c'est `bot` qui traîne un reliquat ; l'en retirer
   est une décision à part, à ne pas prendre au détour d'un import.

Les deux premières causes ne se voyaient qu'à l'exécution. La troisième non
plus — mais une fois l'erreur lue, une comparaison systématique des
31 contraintes `CHECK` et des colonnes récentes des deux bases a montré qu'il
n'y avait **aucun autre écart**, ce qui a évité de découvrir les suivants un à
un.

**Le rollback ne couvre pas tout.** L'import est dans une transaction, le
vidage qui le précède est un `psql` séparé, déjà validé. Un import qui échoue
laisse donc la base **vide**, pas dans son état d'avant. Sans conséquence ici
puisque le dump contient tout, mais à savoir avant de lancer le script sur une
base dont le contenu compterait.

**L'écran blanc d'après import venait de Vite, pas de la base.** Le serveur de
développement tournait déjà pendant la bascule : il gardait en mémoire le
`.env` lu à son démarrage, et la session ouverte dans le navigateur référençait
un compte que le vidage venait d'effacer. D'où une page blanche, sans même de
bouton de déconnexion. Un `npm run dev` relancé a suffi. À retenir : **après
tout changement de `.env` ou de contenu de base, redémarrer Vite** — le `.env`
n'est lu qu'au démarrage, et un `localStorage.clear()` dans la console vide la
session quand l'interface ne répond plus.

Les données, elles, avaient été vérifiées entre-temps : droits de table,
policies de `user_roles`, `has_role()`, jointures du tableau de bord et valeurs
nulles — tout était correct, ce qui a écarté la base avant de chercher côté
application.

### Inventaire de ce qui a été posé sur la base de développement

**Règle rappelée par Christian le 2026-08-28 : `bot` est la référence.** La base
de développement ne sert qu'à éprouver la migration ; rien ne doit y exister qui
n'existe pas dans `bot`. Tant qu'on n'est pas passé en mode opérationnel, c'est
`bot` qui porte le réel — les coachs y testent.

Trois migrations ont été appliquées sur la base de développement dans la
journée. Deux d'entre elles la **rattrapaient** au niveau de `bot` sans le
dépasser :

| Migration | État de `bot` | Écart |
|---|---|---|
| `20260828_grants_tables_anon_authenticated` | GRANT présents, 6 `DEFAULT PRIVILEGES` posés | aucun |
| `20260828_invoice_requests_statuts_b2b` | a déjà les cinq statuts | aucun |
| `20260828_pack_types_lecture_detenteurs` | policy encore ancienne | **oui — le seul** |

**Un seul écart subsiste donc** : la policy de lecture de `pack_types`. Elle
corrige le « 0 crédit » et n'est pas encore sur `bot`, où six membres voient
toujours un solde amputé ou nul.

> À appliquer sur `bot` après validation. C'est une policy de lecture : elle
> n'écrit rien et ne touche aucune donnée.

### Deux bugs coachs, et le vestige Mollie retiré

**Le bouton « Enregistrer » était mort sur les performances chrono.** Sa
condition exigeait `form.value`, que le formulaire ne remplit jamais pour un
`measure_kind = 'time'` : il affiche deux champs minutes/secondes câblés
ailleurs. Le membre saisissait son temps, cliquait, et rien ne se passait —
sans message. Gauthier l'avait signalé comme « le rameur et le ski ne
s'enregistrent pas », en soupçonnant l'unité de mesure ; la base disait
l'inverse, le Rameur portait déjà 44 performances. La condition suit désormais
le champ réellement affiché, et `handleSave` — qui valide déjà temps vide et
secondes hors bornes — peut enfin s'exécuter et le dire.

**« 0 crédit » alors que des packs sont valides.** La policy de lecture de
`pack_types` ne laissait voir que `is_active = true`, quand le commentaire de
la colonne dit l'inverse : « hors catalogue, mais toujours utilisable ». Un
pack retiré de la vente devenait invisible, la jointure du planning renvoyait
NULL, et le crédit était écarté en silence. La policy autorise maintenant aussi
la lecture d'un pack que le membre détient, par achat ou par abonnement.

Appliqué sur les deux bases. Six membres retrouvent leurs crédits : Ingrid
passe de 8 à 27 affichés, Joan de 12 à 15 — exactement ce qu'elle signalait —
et trois autres de zéro à leur solde réel.

> Joan a **trois comptes** (`joan@backontrackstudio.be`,
> `joan.rodon2112@gmail.com`, `joan.rodon@hotmail.fr`). Sur deux d'entre eux, le
> « 0 crédit » était juste. Le bug était réel, mais la question des comptes en
> double reste ouverte.

**`registration_fees.mollie_payment_id` est supprimée.** Dernier vestige du
chantier abandonné le 2026-08-03 : 11 lignes, aucune valeur, aucun code qui la
lit. `install.sql` ne la créait plus depuis sa réécriture, si bien que la copie
des données vers une base neuve échouait dessus — après avoir vidé la cible.

Deux réponses étaient possibles : apprendre au script à élaguer les colonnes
absentes de la cible, ou aligner la source. **La seconde a été retenue** (choix
de Christian) : `bot` est la référence, et une référence ne devrait pas traîner
ce que le fichier d'installation a cessé de décrire. Un script tolérant aurait
masqué l'écart au lieu de le fermer — et ce code d'élagage, écrit puis retiré,
n'aurait presque jamais servi, donc jamais été éprouvé.

Les deux bases ont désormais **la même empreinte de colonnes** : 274 de part et
d'autre, `md5` identique. La copie ne butera plus.

### Le planning annonçait un travail sans offrir le moyen de le faire

Christian signale qu'un cours du 28 à 8h, dont il est le coach, affiche
« Présence à confirmer » sans qu'aucun bouton ne permette de pointer. La base
était pourtant en règle : cours passé, un inscrit, rien de pointé.

**Deux règles concurrentes.** Le badge venait de `getClassStatus`, qui classe en
`pending_checkin` un cours passé avec inscrits et non pointé. Le bandeau orange
qui porte le bouton *Pointer les présences* avait sa propre condition, et
excluait les cours **atteignant** le quorum :

```js
if (count === 0 || count >= minParticipants) return false
```

Le cours a un inscrit, le seuil est à un : le badge le signalait, le bandeau
l'écartait. Les deux reposent désormais sur la même fonction — elle décide, ici
comme sur le badge. Le bandeau couvre `pending_checkin` et `not_given`, deux cas
qui appellent le même geste.

> Effet de bord sur les données de test : le bandeau remonte 19 cours au lieu de
> quelques-uns, tous jamais pointés depuis le 10 août. C'est le reflet fidèle de
> la base, pas un défaut.

**Le nom du coach entre parenthèses.** Le bandeau est visible par tout le staff,
et pointer revient à celui qui a donné le cours : sans le nom, chacun devait
ouvrir la fiche pour savoir si l'affaire le concernait.

**Cliquer sur son propre cours passé ouvre le pointage.** Le dialogue de cette
page sait inscrire, désinscrire et annuler, mais pas marquer présent ou absent —
cliquer y menait donc à un écran sans le bouton attendu. La redirection ne vaut
que pour ses propres cours : celui d'un autre coach garde la fiche de gestion,
qui est bien l'écran voulu pour y inscrire ou annuler.

### Un coach peut lire les performances d'un membre

La policy `Perf: own read` autorisait déjà un coach à lire les performances de
n'importe quel membre — **l'écran manquait, pas le droit**. Deux chemins, selon
ce qu'on cherche :

- **depuis la fiche d'un cours**, le nom de chaque inscrit est cliquable : le
  coach prépare sa séance depuis la liste qu'il a sous les yeux ;
- **depuis une page « Membres »** (nouvelle entrée de l'espace coach), avec
  recherche par nom et le nombre de mesures par membre — ce qui distingue d'un
  coup d'œil ceux qui suivent leur progression.

La fiche reprend l'objectif du membre, ses mouvements, la courbe et le record.
**Lecture seule** : la policy autoriserait l'écriture, c'est un choix et non un
oubli — le membre reste maître de ce qu'il enregistre.

La page « Membres » est volontairement pauvre : nom, photo, nombre de mesures.
Ni coordonnées ni données de santé — elles relèvent de la fiche membre côté
administration, et un coach n'a pas à y accéder par ce chemin.

> La barre du bas en mode coach remplace « Perfs » (les *types* de performance)
> par « Membres » : consulter une fiche est un geste de tous les cours, définir
> un type se fait une fois. Les types restent au menu du haut.

**Le guide admin disait une chose devenue fausse** : « un coach ne voit ni Mes
cours, ni Mes packs, ni Performances ». C'était vrai avant le sélecteur de mode ;
le staff qui s'entraîne au studio les retrouve en mode Membre. Corrigé au
passage.

### L'objectif du membre, là où il sert

Le champ « objectifs » du profil s'affiche en tête de la page Mes performances,
le même quel que soit le mouvement — c'est un cap, pas une consigne d'exercice.
Le profil est un écran qu'on ouvre à l'inscription puis presque jamais ; relire
son objectif devant ses propres chiffres lui redonne un usage.

Vide, le champ ne laisse pas un blanc : la carte devient l'invitation à le
remplir. Et le bouton vers le profil reste présent une fois l'objectif écrit —
il se révise en cours de route.

### Attribuer un pack hors catalogue, pour la reprise des soldes

L'écran d'attribution d'un pack ne proposait que les packs `is_active = true`.
Or la bascule depuis l'ancien système demande le geste inverse : créer un pack
**artificiel** portant le solde d'un membre, le laisser hors catalogue pour que
personne ne puisse l'acheter, et l'attribuer à la main. Le filtre interdisait
précisément ce cas.

Le filtre est levé — la policy de lecture autorisait déjà l'admin à voir ces
packs, seule la requête les écartait. Les packs actifs restent en tête de liste,
et ceux qui sont hors catalogue portent la mention « hors catalogue » : les
choisir doit rester un acte délibéré.

### Un lien dans une annonce ne se voyait pas

Les annonces, la description d'un cours et la présentation d'un coach étaient
rendues dans un conteneur `prose prose-sm dark:prose-invert` — les classes de
`@tailwindcss/typography`. **Ce plugin n'est pas installé** : ces classes ne
produisaient rien, et un lien Markdown sortait en texte brut, sans couleur ni
soulignement. Rien ne signalait qu'on pouvait cliquer.

Le projet avait déjà buté là-dessus pour la documentation et écrit une classe
`.md-doc` à la main, dont le commentaire signale l'absence du plugin. Une classe
`.md-annonce` suit la même voie plutôt que d'ajouter la dépendance : liens en
couleur primaire soulignés, soulignement épaissi au survol, plus le gras,
l'italique, les listes et le code en ligne. Style volontairement sobre — une
annonce tient dans une petite carte, les marges d'un document y creuseraient
des trous.

**Cinq pages étaient concernées**, pas seulement le tableau de bord : la page
d'accueil publique, la description d'un cours au planning, la fiche d'un coach,
et l'aperçu de l'écran d'administration des annonces. Ce dernier compte
particulièrement — c'est là qu'on rédige, avec un aperçu qui ne montrait pas le
défaut qu'il était censé révéler.

### Le menu hamburger disparaît sur mobile

Les entrées qu'il portait rejoignent le menu du profil : mes packs, acheter un
pack, mes factures, parrainage. Elles n'apparaissent qu'en mode Membre.

**« Acheter un pack » a été repris volontairement** : la demande initiale ne
citait que trois entrées, mais le tiroir portait aussi le chemin vers l'achat,
absent de la barre du bas. Le supprimer sans le reprendre aurait laissé un
membre sur iPhone sans aucun moyen d'acheter.

Le staff ne perd rien : la barre du bas donne les écrans de chaque mode et le
`ModeSwitcher` reste dans l'en-tête. Le lint descend de 37 à 36 — un
`static-components` du React Compiler disparaît avec le tiroir.

### Le tableau de bord en trois lignes qui se lisent

Neuf cartes, réparties par sujet plutôt qu'au fil de leur ajout :

| Ligne | | | |
|---|---|---|---|
| Activité | Recettes encaissées | Cours donnés / planifiés | Valeur par cours donné |
| Crédits | Crédits consommés | Crédits perdus | Valeur produite |
| Membres | Premier contact | Membres potentiels | Nouveaux membres |

La ligne des crédits se lit de gauche à droite comme un raisonnement : ce qui a
été utilisé, ce qui a été perdu, le total acquis. C'est ce regroupement que
Christian a demandé, et il a réglé du même coup une disposition qui suivait
l'ordre des ajouts plutôt que le sens.

### Ce qui est payé et jamais consommé

Trois cartes s'ajoutent, et une distinction avec elles.

**Crédits perdus** : les soldes de packs arrivés à échéance sans avoir été
utilisés — 27 crédits, 904 €, sur l'ensemble de l'historique de `bot`. Le studio
les a encaissés, le membre ne les a pas eus. Un chiffre qui monte signale des
packs trop gros ou une validité trop courte. Comptés sur la période
d'**échéance**, comme les autres cartes suivent la période affichée.

Les packs illimités en sont exclus : `credits_remaining` n'y représente rien, et
le membre a eu son accès — il n'a rien perdu.

**Valeur produite** = consommée + perdue. Christian a d'abord demandé que la
valeur consommée intègre les crédits perdus, ce qui est économiquement juste :
un crédit expiré a été payé. Mais cela aurait faussé « valeur par cours donné »,
un crédit expiré n'étant rattaché à aucun cours — l'inclure gonflerait le
rendement apparent d'un créneau alors que personne n'est venu. D'où deux
chiffres distincts plutôt qu'un seul ambigu.

**Valeur par cours donné** quitte la petite ligne sous les crédits pour avoir sa
carte.

Les deux valorisations passent par la même fonction `creditValueCents` — prix du
pack divisé par son nombre de crédits — de sorte que consommé et perdu
s'additionnent honnêtement.

### Le tableau de bord suit le parcours, en chiffres bruts

Sept cartes sur deux lignes : l'activité d'un côté, les membres de l'autre. Les
deux ne se lisent pas ensemble — l'une compte de l'argent et des cours, l'autre
des personnes qui franchissent une étape.

**Valeur consommée** sort en carte à part, avec sa moyenne par séance donnée.
Elle était calculée depuis toujours mais reléguée en petite ligne sous les
crédits. Distincte des recettes encaissées : un pack vendu en janvier se
consomme jusqu'en mars, et c'est la consommation qui dit ce que le studio a
produit sur la période.

**Les ratios se comptent par cours, pas par heure.** Le premier jet affichait
« crédits par heure de cours » ; Christian a fait remarquer que le studio
raisonne en cours. Traduire un semi-privé de 50 minutes en 0,83 heure
n'apprenait rien à personne. Tout le mécanisme qui cumulait les minutes a été
retiré.

**Trois chiffres pour les membres, aucun quotient.** La demande initiale portait
sur un taux de conversion. Le calcul donnait **128 %** sur les données réelles —
plus de membres que de prospects sur le mois. Ce n'est pas un défaut de calcul :
on peut acheter un pack sans être passé par l'essai, ou essayer en juillet et
acheter en août ; numérateur et dénominateur ne portent pas sur les mêmes
personnes. Christian a tranché pour trois nombres bruts — premier contact,
membres potentiels, nouveaux membres — qui se lisent sans ce piège.

`stats_parcours(p_from, p_to)` date les **transitions** et non l'état courant :
quelqu'un devenu membre en juin ne compte pas dans les achats de juillet, sinon
le même membre serait recompté chaque mois. La fonction est `SECURITY DEFINER`
et contrôle le rôle admin — sans quoi tout membre connecté aurait lu les
chiffres commerciaux du studio.

### Les statuts suivent le parcours, plus les frais d'inscription

Définitions arrêtées avec Christian, chacune reposant sur un fait daté :

| Statut | Règle |
|---|---|
| Premier contact | compte créé, aucun essai réservé |
| Membre potentiel | a réservé son cours d'essai |
| Membre actif | a acheté un pack payant, et en a un en cours |
| Membre inactif | plus de pack valide, échéance de moins de 4 semaines |
| Ancien membre | échéance du dernier pack dépassée de plus de 4 semaines |

**Les frais d'inscription ne sont plus regardés.** Raisonnement de Christian :
on ne peut pas acheter un pack sans les avoir payés — la règle est appliquée à
l'achat — donc les tester une seconde fois est redondant. Et trompeur : des
frais offerts ou saisis en retard faisaient apparaître comme « potentiel »
quelqu'un qui s'entraînait depuis des semaines. C'est ce qui explique les cinq
membres à pack actif classés « potentiel » plus tôt dans la journée.

**`visitor` devient un vrai état.** Il n'était que la valeur par défaut de la
colonne, jamais produite par le calcul : tout compte sans frais payés basculait
en `potential`, confondant celui qui vient de créer son compte et celui qui a
déjà essayé. Le libellé devient « Premier contact », qui dit ce que le statut
signifie.

**L'essai se lit sur le pack, pas sur le drapeau.** `bookings.is_trial` et le
type du pack utilisé donnaient des comptes différents — 4 contre 7 : le drapeau
est une copie qu'il faut penser à poser, le pack est un fait. Même arbitrage que
pour le statut d'un cours : toujours dérivé, jamais recopié.

**Un déclencheur de plus.** « Premier contact → potentiel » se joue sur une
réservation, donc un `INSERT` dans `bookings` — les triggers posés le matin ne
couvraient que l'achat d'un pack et les frais. Celui sur `registration_fees` est
supprimé : il ne commande plus rien, et un trigger qui ne sert à rien finit par
tromper celui qui le lit.

### Écrire à plusieurs membres depuis la liste

Un bouton dans la barre de sélection de la liste des membres ouvre le client de
messagerie avec les adresses sélectionnées **en CCI**. En copie cachée, pas en
destinataires : un envoi groupé ne doit pas dévoiler l'adresse de chaque membre
à tous les autres.

Un `mailto:` trop long échoue **sans rien dire** — le navigateur n'ouvre rien et
n'émet aucune erreur. Au-delà de 1800 caractères, les adresses sont donc copiées
dans le presse-papiers, avec le message qui explique quoi en faire. Les
23 membres actuels pèsent 661 caractères : le repli ne servira qu'avec un studio
bien plus grand, mais il évite un bouton qui cesserait de fonctionner en
silence le jour venu.

### Les images ne portent plus l'adresse du projet

Préparant la reconstruction d'une base depuis `install.sql`, un piège est
apparu que personne n'avait vu : les URL d'images stockées en base contenaient
**la référence du projet en dur**.

```
https://aojguoqxbzqcganxgqem.supabase.co/storage/v1/object/public/avatars/coaches/x.jpg
```

Copier les données vers une autre base y aurait laissé les images pointer sur
l'ancienne. Et le défaut serait resté **invisible** tant que l'ancien projet
vivait — les images s'affichant normalement — pour que toutes disparaissent le
jour de sa suppression. Exactement le genre de défaut qui passe la répétition
et casse en vrai.

La base ne garde plus que le chemin (`coaches/x.jpg`) ; `src/lib/url-image.ts`
reconstruit l'adresse à l'affichage, à partir de `VITE_SUPABASE_URL`. Une base
devient ainsi indépendante du projet qui l'héberge : plus aucune réécriture
d'URL lors d'une migration.

Un seul endroit écrivait ces valeurs (`ImageUpload`), dix les affichaient dans
neuf fichiers. Le helper accepte les deux formes — une URL absolue est renvoyée
telle quelle — de sorte qu'une base non migrée continue de fonctionner.

> Décision de Christian : le faire **avant** la répétition sur une base neuve,
> pour que celle-ci éprouve la version définitive plutôt qu'un état
> intermédiaire.

Les 8 fichiers du bucket, au passage, ne sont pas ce que son nom laisse croire :
4 photos de types de cours et 4 portraits de coachs, pas des avatars de membres.

### Suppression et annulation multiples de cours

La sélection multiple du planning admin savait assigner un coach, changer la
capacité et dupliquer ; elle ne savait ni annuler ni supprimer. Gauthier
supprimait ses cours un par un.

**Deux actions distinctes, et c'est le cœur de la réponse.** `bookings` est en
`ON DELETE CASCADE` : supprimer un cours efface ses réservations sans rembourser
ni prévenir personne. La suppression est donc **refusée** dès qu'un cours
sélectionné a un inscrit, avec un message qui renvoie vers l'annulation ; le
bouton est même désactivé. L'annulation, elle, marque les cours annulés,
rembourse par `cancel_booking_by_studio` (le crédit revient toujours, même à
moins de 24 h, puisque l'annulation vient du studio), notifie et envoie un
e-mail à chaque inscrit.

La barre annonce ce qui est en jeu avant d'agir — « Annuler 5 cours —
12 réservation(s) remboursée(s), membres prévenus ». C'est le chiffre qui
manquait pour décider.

`class_deleted` entre au journal d'activité : la suppression d'un cours seul ne
laissait aucune trace, effacer plusieurs créneaux d'un coup en mérite une.

### Le statut de membre n'était presque jamais recalculé

`update_member_status` calculait juste — et n'était appelée nulle part où ça
comptait. Ses cinq points d'appel couvraient la commande B2B, le reset de test,
le bon d'achat, la case « frais payés » d'un admin et l'import de démo.
Manquaient l'achat d'un pack, le paiement Stripe des frais, et surtout
**l'écoulement du temps**, qui fait passer `active` → `inactive` → `former` sans
produire le moindre événement.

Résultat mesuré avant correction : **9 profils sur 23 portaient un statut faux**.
Trois étaient « membre actif » sans avoir payé les frais d'inscription, deux
« inactif » avec un pack en cours.

Trois déclencheurs posés, sans toucher à une seule règle de calcul :

- `refresh_my_member_status()`, appelée par `AuthContext.fetchProfile` à côté de
  `refresh_my_category` — c'est le patron que le projet avait déjà retenu pour
  la catégorie, et pour la même raison : l'expiration d'un pack ne produit aucun
  événement, un cron corrigerait après coup et finirait par diverger.
- un trigger sur `pack_purchases` INSERT — l'admin qui encode un paiement au
  comptoir voit l'effet tout de suite.
- un trigger sur `registration_fees` INSERT/DELETE — la table est alimentée par
  le webhook Stripe, la saisie admin et les bons d'achat ; un trigger les couvre
  tous là où il aurait fallu modifier chaque appelant.

Plus une remise à plat des 23 profils existants. Après : 8 `active`, 12
`potential`, 2 `inactive`, 1 `former` — tous cohérents avec les règles en
vigueur.

> **Cinq membres ont un pack actif mais restent `potential`** : ils n'ont pas
> payé les frais d'inscription. C'est conforme à la règle actuelle, et c'est
> exactement ce que la redéfinition demandée par les coachs (lot C2) doit
> trancher.

**Pourquoi ce correctif avant la redéfinition.** Joan demande de changer les
seuils ; les changer sans poser le déclencheur aurait donné des statuts justes
le jour du calcul et faux la semaine suivante — la situation d'avant, avec
d'autres chiffres.

### Lot A des remarques coachs — cinq points livrés

Les remarques de Gauthier et Joan ont été classées en trois lots ; le premier
est livré. Deux bugs avaient déjà été corrigés le matin (bouton mort sur les
chronos, « 0 crédit ») — restaient cinq améliorations sans décision préalable.

**Durée par défaut par type de cours.** Nouvelle colonne
`class_types.default_duration_minutes`, propagée au choix du type dans le
formulaire de planification — au même endroit que `default_max_participants`,
qui faisait déjà ce travail pour la capacité.

> La demande disait « semi-privés = 50 min, personal training = 1 h ». Or
> **aucun type ne s'appelle « semi-privé »** : ce que les coachs désignent ainsi,
> ce sont les cours de groupe (BackOnTrack, Boxing, CrossTraining, Ladies,
> Posture — 5 places), par opposition au personal training (2 places). Les
> valeurs ont donc été posées sur `default_max_participants`, un critère qui
> existe en base, plutôt que sur des libellés renommables. « Événement spécial »
> (20 places) garde 60 : sa durée varie, un défaut n'y veut rien dire.

**Packs archivés repliés, et l'explication qui manquait.** Six des treize types
de packs sont hors catalogue et encombraient la liste : ils sont repliés, avec
un compteur et un bouton pour les révéler. S'ajoute un encadré permanent,
visible de **tous** les admins, disant pourquoi un pack vendu ne se supprime pas
et que décocher « Actif » est le geste attendu.

C'est ce silence qui avait produit la demande de corbeille : le message
d'explication n'existait que pour le super admin, et seulement après un clic sur
un bouton que les autres ne voient pas.

**Onglets membre** : accueil │ planning │ mes cours │ mes performances, même
ordre en haut et en bas. « Mes packs » quitte la barre du bas — elle ne tient
que quatre entrées — et reste au menu du haut.

**Crédits consommés par heure de cours**, sur la carte du tableau de bord. Le
dénominateur est celui des heures **réellement données** (passées, non annulées,
au moins `min_participants` inscrits) : c'est la définition que la page utilise
déjà pour compter les cours donnés, et les heures planifiées dilueraient le
ratio avec des créneaux qui n'ont pas eu lieu.

**Reste à faire** : lot B (suppression multiple de cours, € par heure) et lot C
(statuts de membre et conversion). Le lot C porte un bug non demandé — le
recalcul de `member_status` n'est déclenché par presque rien, et **9 profils sur
23 portent un statut faux**.

### `bot` alignée sur `install.sql` — trois policies restées en arrière

Christian a tranché : **`bot` est la référence absolue.** La base de
développement sera effacée et recréée depuis `bot` ; tout ce qui doit vivre
doit donc être dans `bot`, et les scripts de passage tenus à jour.

En comparant le texte des policies, trois écarts sont apparus — dans le sens
inattendu : c'est `install.sql` qui était en avance, corrigé au fil des
sessions, tandis que `bot`, plus ancienne, gardait les premières versions. Une
base neuve naissait donc plus juste que la référence.

**Un seul avait un effet réel.** Sur `performances`, un coach pouvait *créer*
une performance pour un membre mais ni la corriger ni la supprimer : une faute
de frappe restait définitive, sauf à déranger un admin. Le studio compte cinq
coachs.

Les deux autres — `referrals` et `subscription_discounts` — étaient
**cosmétiques, vérification faite** : les policies `*_admin_all` couvrent déjà
toutes les commandes, `SELECT` compris, et deux policies permissives
s'additionnent en OR. L'admin voyait donc déjà ces lignes. Elles ont été
alignées quand même, pour que le texte des deux bases soit comparable — c'est
la condition pour qu'un écart futur se remarque au lieu de se noyer dans un
bruit de fond d'écarts tolérés.

`check-policies.sql` documentait précisément cet écart depuis le 27 août, en
nommant la migration jamais appliquée et en indiquant quoi écrire le jour où
elle passerait. C'est fait, et le fichier suit.

### Comparer les schémas, pas les compteurs

`scripts/comparer-bases.sh` compare le **texte** des policies, des signatures de
fonctions, des colonnes, des contraintes `CHECK` et des droits de table entre
deux bases. Il ne fait que lire.

Il répond à ce que la journée a montré : les deux bases affichaient **exactement
les mêmes compteurs** — 27 tables, 89 policies, 76 fonctions, 12 triggers —
alors que la policy de `pack_types` différait dans son texte et faisait lire
« 0 crédit » à six membres. Le contrôle du 27 août avait certifié `install.sql`
conforme sur ces mêmes compteurs, sans voir les droits manquants. **Un compteur
identique ne prouve rien** ; c'est la définition qu'il faut comparer.

**Reste ouvert** : les **10 Edge Functions dont aucune n'est déployée** sur la
base de développement — le front en appelle huit en dur, donc paiements,
e-mails et création de comptes y échoueront. Le bucket Storage `avatars` n'y
est pas non plus créé : les avatars des 23 profils pointent vers des fichiers
absents.

---

## Session du 2026-08-27

Partie d'une question d'exploitation — vider la base de test pour la recharger —
la session a découvert que `install.sql` **réintroduisait la faille des rôles
corrigée le 6 août** : il recréait les trois policies d'écriture sur
`user_roles` que la migration avait supprimées, et omettait les `REVOKE ALL`
sur `grant_user_role` / `revoke_user_role`. La base, elle, était saine — seule
une installation faite depuis ce fichier serait née vulnérable. Corrigé.

`reset-test-data.sql` ignorait huit tables apparues depuis le 7 août, dont deux
avec une clé étrangère en `NO ACTION` : il n'effaçait pas à moitié, il
**échouait**. Réécrit, puis exécuté réellement sur une base jetable — ce qui a
révélé un neuvième oubli qu'aucune lecture n'aurait vu : les admins conservés
pointent vers `member_categories`, qu'on ne peut donc pas vider avant eux.

`check-policies.sql` ne cherchait que les policies *manquantes*, alors que la
faille du 6 août était une policy *en trop* : il était aveugle au cas qui
comptait. Il compare désormais dans les deux sens, sur les 89 policies réelles.

**`install.sql` a été rejoué d'un bloc sur une base neuve : il passe.** Résultat
identique à la production (27 tables, 89 policies, 76 fonctions, 12 triggers).
C'est la première fois que ce fichier est éprouvé de bout en bout.

Deux trouvailles dans `import-demo.ts` : la clé `service_role` y était en clair
dans un fichier versionné — sortie vers `.env`, **à régénérer** puisqu'elle
reste dans l'historique git ; et le script écrivait encore dans
`trial_sessions`, supprimée le 7 août, l'erreur n'étant pas testée (règle n° 5).

**Décidé** : ne pas migrer `bot` vers Francfort (gain de ~15 ms, contre un
risque sur les comptes et les abonnements Stripe — la région se choisit à la
création) ; ne pas vider `bot`, qui sera remplacée puis gardée comme filet ; ne
pas y appliquer la migration `20260511` du bug coach sur les performances, pour
la même raison. Le développement local passe sur une base séparée.

La marche à suivre est dans **`docs/strategie-base-neuve.md`**.

---

## Session du 2026-08-24

Préparation de la **phase de test** : faire installer l'application par de vrais
utilisateurs, sur leur téléphone, avant de déposer quoi que ce soit sur l'App
Store. Pas de développement métier — de la plomberie PWA et de la documentation.

### La PWA existait, mais ne s'installait pas correctement sur iPhone

Le manifest, le service worker et son enregistrement étaient en place depuis
avril. Ce qui manquait tenait à des détails invisibles depuis un Mac.

**L'icône iPhone n'a jamais fonctionné.** `index.html` déclarait
`apple-touch-icon` vers `/icons/icon-192.png` — un fichier **absent** : le
dossier ne contenait que des `.webp`. Et le `.htaccess` renvoyant `index.html`
pour toute URL inconnue, iOS recevait **du HTML en HTTP 200** là où il attendait
une image. Aucune erreur nulle part : Safari posait simplement une icône
générique sur l'écran d'accueil.

> C'est la deuxième fois que ce dépôt rencontre un échec silencieux d'une
> écriture ou d'une requête qui « répond bien ». Le `.htaccess` exclut désormais
> les extensions statiques de la réécriture SPA : une image absente répond 404,
> ce qui se voit.

Les PNG sont générés depuis `resources/icon.png` (1024 × 1024, déjà présent pour
Capacitor) — la même source servira la fiche App Store.

**Toutes les icônes étaient déclarées `"any maskable"`.** Android applique alors
un masque circulaire et **rogne** l'icône. Les deux usages sont désormais
séparés : les tailles en `any`, plus deux entrées `maskable` dédiées.

**Le service worker ne se mettait jamais à jour.** `CACHE_NAME` était figé à
`'bot-v1'` : un testeur pouvait rester indéfiniment sur une version périmée et
**signaler un bug déjà corrigé** — exactement ce qu'une phase de test ne peut pas
se permettre. Le nom du cache porte maintenant la version de `package.json`,
injectée à la construction par un plugin Vite. Le service worker vit dans
`public/`, que Vite recopie sans transformer : `__APP_VERSION__` ne l'atteignait
pas. `sw.js` et `manifest.json`, qui ne portent pas de hash, passent en
`no-cache`.

### Installer ne se devine pas : il faut le montrer

Sur iPhone, **aucune invite n'existe** — le geste est « Partager » puis « Sur
l'écran d'accueil », et rien dans Safari ne le suggère. Sans explication, un
testeur iPhone n'installe jamais.

`useInstallationPWA` (`src/lib/pwa-install.ts`) ramène quatre situations à une
seule réponse : `prompt` (Chrome sait le faire), `ios-manuel` (montrer le geste),
`installee`, `impossible`. Deux décisions valent d'être notées :

- **Le hook répond `installee` en natif** (Capacitor). Proposer une installation
  dans l'app native n'aurait aucun sens — et Apple rejette une app qui pousse
  vers un autre canal de distribution.
- **Seul Safari reçoit le mode iOS.** Chrome et Firefox sur iPhone sont des
  habillages de WebKit et n'exposent pas « Sur l'écran d'accueil » : leur montrer
  le geste enverrait le membre chercher un bouton inexistant.

La bannière vit sur le **tableau de bord**, pas sur la page publique : installer
vaut pour un membre qui revient, pas pour un visiteur de passage. Un refus est
mémorisé **un mois** — une bannière qui revient à chaque page se lit comme une
publicité et fait fuir au lieu d'installer.

### « Nouvelle version disponible » : proposer plutôt qu'imposer

Le mécanisme de mise à jour fonctionnait, mais **sans rien dire**. Un membre qui
garde l'application ouverte reste sur son code jusqu'à la prochaine ouverture —
sans jamais savoir qu'une correction existe.

> **La bannière n'est pas réservée au téléphone**, contrairement à l'intuition
> de départ. Le problème n'est pas « être sur mobile », c'est « garder la page
> ouverte longtemps » — et c'est précisément le comportement du navigateur de
> bureau. iOS, lui, décharge régulièrement une PWA installée, ce qui la met à
> jour de lui-même. La cacher sur le web l'aurait retirée du cas où elle sert le
> plus. Seule exception : l'application native, dont le code est embarqué.

**`skipWaiting()` a été retiré de `install`.** Il faisait basculer le nouveau
service worker immédiatement, ce qui remplace le code sous les pieds du membre :
un formulaire à moitié rempli ou une réservation en cours de validation part
avec. Le worker attend désormais en réserve, et ne s'active que sur le message
`ACTIVER_MAINTENANT` — envoyé par le bouton « Recharger ».

Trois détails qui font la différence entre une bannière qui marche et une qui ment :

- **Le rechargement vient de `controllerchange`**, pas du clic. Recharger tout de
  suite rechargerait l'**ancienne** version : le nouveau worker n'a pas encore
  pris la main.
- **Un worker déjà en attente au chargement** est détecté explicitement. Sans ce
  test, un membre revenu après un déploiement ne verrait la bannière qu'au
  déploiement *suivant* — `updatefound` s'est déclenché avant que la page existe.
- **`navigator.serviceWorker.controller` absent = première visite.** Annoncer une
  « nouvelle version » à quelqu'un qui découvre le site n'aurait aucun sens.

Vérification faite en simulant un déploiement (`sw.js` réécrit sous le serveur de
preview) : bannière affichée, ancien worker toujours actif pendant l'attente,
puis après clic bascule complète, purge de l'ancien cache et rechargement.

**Pas de bouton pour fermer la bannière** : elle n'apparaît qu'en présence d'une
version réellement en attente. La faire disparaître laisserait le membre sur du
code périmé en croyant l'inverse.

### Confirmation d'inscription : aucun moyen de relancer l'e-mail

Signalé par Christian en préparant la phase de test, et c'est bloquant pour un
testeur : l'inscription envoie un e-mail de confirmation, la connexion est
refusée tant qu'il n'est pas cliqué, et **rien nulle part ne permettait d'en
redemander un**. Un e-mail tombé dans les indésirables et le testeur restait
dehors, sans recours.

**Deux points d'entrée, parce qu'il y a deux situations.** L'écran affiché juste
après l'inscription reçoit un bouton « Renvoyer l'e-mail ». Mais celui qui a
fermé cette page ne la reverra jamais : c'est le cas le plus probable quelques
heures plus tard. Le refus de connexion pour non-confirmation ouvre donc un
encart avec le même bouton — jusque-là, ce refus n'affichait qu'un toast, c'est
à dire une impasse.

**Le message de succès ne dit pas si l'adresse existe.** Supabase répond sans
erreur pour une adresse inconnue, et c'est volontaire de sa part : distinguer
les deux cas ici transformerait le bouton en moyen de savoir qui est inscrit au
studio. D'où « Si un compte existe pour cette adresse… ».

La seule erreur qui mérite d'être montrée est la limite de cadence — Supabase
impose une minute entre deux envois. Sans ce message, le membre reclique en
croyant que rien ne part.

**`signUp` ne passait pas `emailRedirectTo`**, contrairement à `resetPassword` et
au changement d'adresse dans le profil. Le lien de confirmation partait donc vers
l'URL configurée côté Supabase, qui n'est pas forcément l'origine réelle. Les
deux e-mails — premier envoi et renvoi — visent maintenant la même destination,
via un `urlApplication()` qui reprend le motif déjà en place dans `ProfilePage` :
toujours l'URL de production quand elle est connue, sans quoi une inscription
faite depuis le serveur de développement enverrait un lien vers `localhost`,
inutilisable depuis le téléphone qui reçoit l'e-mail.

Éprouvé de bout en bout sur un compte de test jetable, supprimé ensuite : refus
pour identifiants invalides (pas d'encart), refus pour non-confirmation (encart
et bouton), renvoi trop rapproché (message de cadence), renvoi accepté.

**Reste ouvert** : une adresse mal saisie à l'inscription n'a pas de rattrapage
dans l'application — le renvoi repartirait au même endroit. L'écran le dit et
renvoie vers le studio ; un vrai correctif demanderait de pouvoir changer
l'adresse d'un compte non confirmé.

### Le numéro de version, visible sans défiler

Il n'était affiché qu'en **pied de page** — hors de vue sur téléphone, où la
barre de navigation le recouvre en partie. Or c'est le premier renseignement à
demander à un testeur qui signale un problème : un numéro inférieur à celui
déployé, et le bug est probablement déjà corrigé.

Déplacé dans l'en-tête, à côté du logo, donc visible sur **toutes** les pages —
l'espace admin compris, ses routes étant imbriquées dans `Layout`. Il reste
affiché sous 640 px, là où le nom du studio est masqué : c'est précisément
l'écran d'un iPhone.

Le pied de page garde le sien : il sert au membre ordinaire, pas au testeur.

### Inscriptions : les voir, et pouvoir effacer un parasite

Trois demandes de Christian pendant la phase de test, liées au même parcours.

**Les inscriptions spontanées n'étaient pas tracées.** `user_created` n'était
écrit que par `AdminUsersPage`, quand le studio crée un membre à la main : une
inscription venue du formulaire public ne laissait aucune trace. Le studio ne
découvrait un nouveau venu qu'en parcourant la liste des membres.

Nouvelle action `signup_attempt`, distincte de `user_created` — les confondre
effacerait la différence entre « le studio a inscrit quelqu'un » et « quelqu'un
s'est inscrit tout seul », qui est justement celle qu'on cherche.

Écrite **depuis le trigger** `handle_new_user`, pas depuis le front : toute
création passe par `auth.users`, quelle qu'en soit l'origine. Dans un bloc
`BEGIN/EXCEPTION` à part, car le trigger avale déjà ses erreurs — une trace qui
échoue ne doit pas emporter la création du compte.

**Une adresse déjà inscrite ne créait aucune trace non plus**, et c'est le cas
qui a fait perdre du temps à un testeur : Supabase répond **sans erreur**,
n'envoie aucun e-mail, et renvoie un utilisateur factice dont `identities` est
vide. C'est sa protection contre l'énumération des comptes — répondre
franchement permettrait de tester des adresses pour savoir qui fréquente le
studio.

> **Décision : ne pas le dire au visiteur, le dire au studio.** L'écran de
> confirmation décrit le cas sans l'affirmer (« Tu as déjà un compte avec cette
> adresse ? Aucun e-mail n'est envoyé dans ce cas ») et propose « Mot de passe
> oublié », adresse pré-remplie. Le journal, lui, l'enregistre nommément :
> `log_duplicate_signup` est appelable sans session — la personne qui s'inscrit
> n'en a pas — mais ne renvoie jamais si l'adresse existe, et se borne à une
> trace par heure et par adresse pour qu'un formulaire soumis en boucle ne noie
> pas le journal.

**Effacer un parasite.** `delete_member_account` anonymise, le droit comptable
belge imposant sept ans dès qu'il y a eu paiement. Un parasite inscrit il y a dix
minutes n'a produit aucune écriture : l'anonymiser laisserait une ligne fantôme
« Membre supprimé #a1b2c3d4 » à vie, là où il n'y a rien à conserver.

`purge_parasite_account` efface donc pour de bon, mais **refuse** tout compte
dont l'e-mail est confirmé, membre du staff, ou portant la moindre trace
financière — achat payé, abonnement, frais d'inscription, réservation. Le
garde-fou est côté serveur : un admin ne peut pas effacer un vrai membre par
mégarde, et le refus nomme son motif plutôt que d'afficher un « impossible » qui
ferait croire à une panne.

> Le pack de séance d'essai ne bloque pas : offert d'office à l'inscription, il
> est présent sur **tous** les comptes et interdirait sinon chaque purge. Le
> filtre porte sur `price_paid_cents > 0`.

Le bouton vit sur la ligne du journal qui signale l'inscription — repérer le
parasite puis aller chercher sa fiche ferait perdre le fil d'un journal qu'on
parcourt de haut en bas.

### Le lien de parrainage ouvrait la page de connexion

`ReferralPage` génère `/auth?ref=CODE`, et `AuthPage` démarrait sur l'onglet
« Connexion » : on demandait à un filleul de se connecter à un compte qu'il n'a
pas, par définition. Le code était pourtant bien repris dans le formulaire —
encore fallait-il y arriver.

La présence de `?ref=` ouvre désormais l'onglet Inscription, et un bandeau dit
pourquoi le code est déjà rempli et ce qu'il rapporte. Sans `?ref=`, rien ne
change.

### Planning : séparer semi-privé et Personal Training

Demandé par Christian, sur le modèle de « Acheter un pack » où la séparation
existait déjà. Le motif est repris tel quel — même balisage, même logique — pour
que la lecture soit identique des deux côtés de l'application.

Le raisonnement est celui qui avait conduit aux onglets dans `PacksPage` : **le
type de crédit commande la réservation**, un crédit Personal Training ne paie pas
un cours semi-privé. Mélangés dans une même grille, les deux obligeaient le
membre à lire chaque carte pour savoir laquelle le concerne.

**Une différence assumée avec `PacksPage` : un onglet « Tout ».** On achète une
formule à la fois, mais on vient d'abord au planning pour voir sa semaine —
imposer un type ferait perdre la vue d'ensemble. C'est donc le choix par défaut.

Trois cohérences qu'il fallait tenir, chacune correspondant à un planning qui se
serait vidé sans explication :

- **Les onglets sont déduits des cours affichés**, comme les autres filtres : un
  type sans cours programmé n'a rien à proposer, son onglet serait un cul-de-sac.
  Conséquence à connaître : un seul type au planning et les onglets disparaissent.
- **Le filtre « type de cours » se restreint à l'onglet actif.** Proposer un
  cours semi-privé alors qu'on regarde le Personal Training donnerait un planning
  vide — deux filtres qui se contredisent en silence.
- **Changer d'onglet remet le type de cours à zéro**, pour la même raison : le
  type choisi appartient peut-être à l'autre onglet.

L'onglet compte enfin dans le décompte des filtres actifs et dans
« Réinitialiser » — sans quoi un planning vidé par l'onglet n'aurait aucune
explication visible.

> **À savoir sur les données de test** : les 9 cours Personal Training sont tous
> **passés** (13-20 août), les 107 cours à venir sont tous semi-privés. Un membre
> ne verra donc aucun onglet sur la semaine en cours — c'est le comportement
> voulu, pas un défaut. Le staff, qui peut reculer, les verra sur la semaine du
> 17 août : Personal Training (6) et Semi-privé (19).

### Gestion du planning : filtres lisibles, conflits annoncés

Deux signalements de Christian sur la même page admin.

**La barre de filtres avait une ligne en trop.** Elle alignait tout par le bas
(`items-end`), mais les champs portent un libellé au-dessus et les boutons non :
« Réinitialiser » décrochait seul en bas, les libellés flottaient, et le tableau
en devenait illisible. Chaque champ forme désormais sa propre colonne, et les
flèches de période restent groupées avec les deux dates — elles forment un seul
geste et ne doivent pas être séparées par un retour à la ligne.

**La duplication vérifiait déjà les conflits, mais après coup.** La règle
existait — même minute, même salle — et s'appliquait aussi à la création avec
répétition. Elle écrivait cependant d'abord, puis annonçait « 2 ignorés » : sans
dire lesquels, et sans possibilité de renoncer.

Un dialogue s'ouvre maintenant **avant** d'écrire et nomme chaque cours
concerné. Rien ne s'affiche s'il n'y a aucun conflit : l'admin a déjà cliqué.

`analyserConflits` (`src/lib/conflits-planning.ts`) sort la logique de la page :
elle servait déjà à deux endroits, dupliquée. Elle confronte les candidats aux
cours existants **et entre eux** — dupliquer deux cours vers le même créneau doit
se voir, alors qu'aucun des deux n'est encore en base.

Deux natures de conflit, qui n'appellent pas la même réponse :

- **Créneau occupé** (même minute, même salle) : bloquant. Deux cours ne tiennent
  pas dans la même salle au même moment.
- **Coach déjà pris** (même minute, salles différentes) : simple avertissement.
  Rien ne le vérifiait, et c'est pourtant le conflit le plus coûteux — il ne se
  découvre que le jour même, avec des membres inscrits des deux côtés. Bloquer
  interdirait des plannings valides : un coach peut superviser deux salles.

> **Corrigé au passage : une salle vide ne bloque plus.** La clé était
> `heure|salle`, et une salle absente devenait `heure|` — deux cours sans salle
> se bloquaient donc mutuellement, alors que rien ne dit qu'ils s'opposent. Cela
> interdisait deux Personal Training simultanés avec deux coachs différents.

Sept cas de test couvrent la logique : salle occupée, deux salles, salle vide,
conflit de coach, candidats entre eux, précision à la minute, cas nominal.

### Catégories de membres : attribuer à plusieurs d'un coup

Demandé par Christian : ranger les anciens membres sans les effacer, et sans
ouvrir chaque fiche une par une.

**La demande initiale portait sur le statut. Elle a été redirigée vers la
catégorie**, et c'est le point qui méritait d'être creusé : `member_status` est
**calculé** par `update_member_status` à partir des faits — frais payés, pack
actif, ancienneté du dernier pack expiré. Un statut posé à la main y serait
écrasé au prochain recalcul : le studio croirait avoir rangé ses anciens membres
et les retrouverait actifs, sans comprendre pourquoi.

C'est le principe que le projet applique déjà au statut d'un cours — *toujours
dérivé, jamais stocké*. Proposer « changer le statut en masse » aurait été
vendre un bouton qui ment.

`member_category_id`, lui, est un champ **choisi** : rien ne le recalcule. La
catégorie « archives » y trouve donc sa place, à côté d'abonné, ponctuel et
standard.

> **Effet de bord à connaître** : la catégorie commande les packs proposés à
> l'achat (`pack_type_categories`). Un membre archivé ne verra que les packs
> ouverts à sa catégorie — aucun, tant qu'aucun pack ne la déclare. Cohérent
> avec un archivage, mais à savoir avant d'archiver quelqu'un qui reviendrait.

La sélection multiple reprend le motif de `AdminSchedulePage` : cases à cocher,
barre d'actions qui n'apparaît qu'une fois quelque chose de sélectionné, et
« tout cocher » qui ne porte **que sur les membres affichés** — cocher après
avoir filtré ne doit pas embarquer ce qu'on ne voit pas.

Retirer la catégorie est proposé au même endroit : sans cette entrée, un membre
mal rangé le resterait.

### Un pack peut attribuer une catégorie

Le besoin de Christian : vendre une **séance supplémentaire à tarif abonné**,
invisible pour les autres. Le mécanisme d'accès existait déjà —
`pack_type_categories` restreint qui voit quel pack, et « Carte séance unique »
était déjà réservée aux abonnés. Ce qui manquait, c'est l'attribution
automatique de la catégorie : elle se posait à la main, donc s'oubliait.

Deux champs sur `pack_types` : `grants_category_id` (ce que l'achat donne) et
`reverts_to_category_id` (à quoi revenir ensuite).

**Deux réglages globaux avaient été envisagés** — « catégorie des abonnés » et
« catégorie après résiliation », déduites de `is_recurring`. Écarté : cela
suppose que tous les abonnements se valent. Les données disaient déjà le
contraire, et le jour où un abonnement premium coexiste avec un abonnement mini,
les deux donneraient le même tarif préférentiel. Un pack ponctuel ne pourrait par
ailleurs jamais accorder de catégorie.

> Le précédent B2B disait l'inverse — « pas de catégorie B2B, deux marqueurs pour
> le même fait finiraient par diverger ». La différence tient à ceci :
> `is_recurring` (comment on paie) et la catégorie (quel tarif on mérite) ne sont
> **pas** le même fait. Les lier par une règle globale, c'est décider une fois
> pour toutes qu'ils coïncident.

**La catégorie est dérivée, pas comptabilisée.** Stocker à l'achat et « rendre »
à l'expiration reviendrait à tenir un compteur : deux écritures qui doivent
rester d'accord, et qui divergeront. Un membre peut détenir un abonnement *et*
une carte de séances, sans qu'on sache dans quel ordre ils s'éteignent.
`derive_member_category` répond donc toujours à la même question — « vu ce que ce
membre détient maintenant, quelle catégorie mérite-t-il ? ». La colonne reste
écrite, les filtres en ont besoin, mais une seule logique la fixe.

**Priorité à l'abonnement** : un abonné qui achète une séance supplémentaire ne
perd pas son statut d'abonné — ce serait lui retirer le tarif qui l'a fait
acheter.

**Trois moments de recalcul**, dont un qui méritait réflexion :

- **À l'achat** — trigger sur `pack_purchases`. C'est l'instant où la catégorie
  doit être juste : le membre va s'en servir aussitôt.
- **À la fin d'un abonnement** — trigger sur `subscriptions`, événement net que
  Stripe signale.
- **À la lecture du profil** — parce que l'expiration d'un pack ponctuel ne
  produit **aucun événement** : la date passe, rien ne se déclenche. Un cron
  nocturne corrigerait après coup et finirait par diverger ; on recalcule au
  moment où la valeur sert, comme le fait déjà `update_member_status`.

Les deux triggers sont dans un bloc `BEGIN/EXCEPTION` : un classement qui échoue
ne doit pas annuler un achat payé.

> **Un pack qui ne se prononce pas ne change rien.** `apply_member_category`
> sort sans écrire quand aucun pack n'accorde de catégorie — un studio qui range
> ses membres à la main ne doit pas voir son classement effacé par un achat.

Éprouvé sur les données réelles, en transactions annulées : sans configuration
la fonction ne change rien pour personne (les classements manuels existants sont
préservés) ; l'abonnement configuré fait passer les cinq abonnés actifs en
« abonné » ; trois d'entre eux détiennent aussi un pack ponctuel accordant
« standard » et **restent abonnés** ; et la résiliation les ramène à
« standard ».

### La catégorie, visible dans la liste

Signalé par Christian juste après l'attribution groupée : sans la voir, on coche
à l'aveugle. Colonne ajoutée entre le rôle et les crédits, masquée sous 1024 px
comme les autres colonnes secondaires du tableau.

Un tiret plutôt qu'une case vide quand il n'y en a pas : sans catégorie est un
état légitime, pas une donnée manquante.

Ajoutée aussi à l'export CSV — une colonne qu'on voit à l'écran et qu'on ne
retrouve pas dans le fichier se remarque immédiatement.

**La colonne Rôle a été retirée** dans la foulée, sur décision de Christian :
cette page exclut coachs et admins, elle affichait donc « Client » sur les seize
lignes. La catégorie prend sa place et remonte à 640 px, où elle devient visible
bien plus tôt.

Le rôle reste utile là où il varie — la **fiche individuelle**, qui portait déjà
le statut et la catégorie mais pas lui : savoir qu'on regardait un coach exigeait
de faire défiler jusqu'aux interrupteurs de rôle, tout en bas. Il s'affiche
désormais en tête, à côté des deux autres. Un membre sans rôle particulier est
annoncé « Client » plutôt que laissé en blanc.

### Effacer un membre : la règle était déjà la bonne

Christian a proposé qu'un membre ayant une réservation ou un pack ne puisse pas
être effacé. C'est exactement ce que `purge_parasite_account` applique depuis le
matin même — plus l'e-mail confirmé et le staff.

Un seul écart, délibéré : **le pack de séance d'essai ne bloque pas**. Offert
d'office à toute inscription, il est présent sur tous les comptes ; le prendre
en compte rendrait la purge impossible en toutes circonstances. Le filtre porte
donc sur `price_paid_cents > 0` — « aucun pack **payé** ».

### Clôture du 2026-08-24 — v3.12.0

**Trente-deux commits sur la journée**, en deux sessions successives : la
matinée (`e3af6f5a`, 24 commits, jusqu'à la v3.5.0) puis l'après-midi et la
soirée (8 commits, `f33de65..9f91f0d`).

La matinée a livré la PWA installable, le renvoi de l'e-mail de confirmation,
la séparation semi-privé / Personal Training, les catégories attribuées par un
pack, la documentation du B2B — et l'écran d'inscription qui annonçait un
e-mail ne partant jamais sur une adresse déjà connue (`358987f`).

L'après-midi a ouvert sur une fausse alerte — une session bloquée dans un
terminal figé, dont tout le travail était en réalité commité — puis enchaîné
sept chantiers, tous nés de l'usage : Christian testait sur son iPhone et
signalait ce qui coinçait.

Appliqué en production : la migration `payment_method` et le webhook Stripe
(v13). **Le front reste en 3.11.0 en ligne** — la 3.12.0 est compilée dans
`dist/` mais non uploadée, et c'est elle qui porte le correctif PWA.

Deux documents pour l'équipe : le handoff technique
(`docs/handoffs/handoff-2026-08-24-2117-…`) et un bilan sans jargon destiné aux
coachs (`docs/nouveautes-2026-08-24.md`).

Un constat de méthode, à garder : la session de test Chrome était ouverte sur un
compte membre, ce qui a empêché d'éprouver à l'écran la grille calendrier, le
repli des stats coach et la correction du mode Membre. Trois livraisons reposent
donc sur la seule lecture du code. Prévoir une session admin pour les
vérifications visuelles.

### L'iPhone bloqué neuf versions en arrière

Christian signale que son téléphone affiche la **3.2** quand le dépôt est à la
3.11 — et il précise avoir bien vu la bannière « Nouvelle version disponible ».
La détection marchait donc ; c'est ce qui suivait le clic qui échouait.

Contrôles faits d'abord côté serveur, tous bons : `sw.js` en ligne annonce la
bonne version, le bundle est **identique octet pour octet** à `dist/`, les
en-têtes portent `no-cache, must-revalidate`, et la page ouverte dans un
navigateur affiche la version attendue. Rien à corriger de ce côté.

Deux défauts dans le code de mise à jour, et ils se combinent :

**`recharger()` tournait en rond.** Sans worker en attente, la fonction faisait
`window.location.reload()`. Or **un rechargement ne remplace jamais un service
worker actif** : la page revient à l'identique, la bannière réapparaît, et le
membre peut cliquer indéfiniment. La fonction force désormais une
vérification, active ce qui en sort, et en dernier recours **désinscrit le
worker et vide les caches** — le seul geste qui rende la main au réseau.

**`cache.addAll` rejetait en bloc.** Une seule requête en échec — un réseau qui
vacille, ce qui arrive sur mobile — et l'installation entière échouait. Un
worker dont l'install rejette ne passe jamais en attente : la nouvelle version
ne s'installe alors *plus jamais*. Le préchargement tolère maintenant l'échec
unitaire ; la stratégie « réseau d'abord » ira chercher la ressource au premier
accès.

S'y ajoute un filet de deux secondes après `ACTIVER_MAINTENANT` : iOS manque
parfois `controllerchange` après une bascule d'application, laissant le membre
devant un bouton sans effet.

À noter : **ces correctifs ne débloquent pas un appareil déjà coincé.** Pour
recevoir le nouveau code, il faudrait qu'il se mette à jour — ce qu'il ne sait
justement plus faire. Sortie manuelle : effacer les données du site.

### Deux ajustements dictés par l'usage réel

Christian, en se servant de l'application sur son iPhone.

**Les chiffres du coach se replient.** Quatre cartes de statistiques occupaient
le haut de l'écran et repoussaient la liste des cours sous la ligne de
flottaison. Or un coach ouvre cet écran juste avant sa séance, pour voir ses
cours — pas pour lire son remplissage du mois. Le bloc est donc **fermé par
défaut**, et le choix est retenu : celui qui les consulte souvent les rouvre
une fois.

**Gestion du planning remonte au deuxième rang** du menu d'administration,
juste après Membres. Elle était en huitième position, au milieu des types de
crédits et des catégories — des réglages qu'on touche une fois par saison,
quand le planning s'ouvre plusieurs fois par jour.

Rien de technique dans ces deux changements : ils viennent de l'usage, et
c'est le genre de réglage qu'aucune relecture de code ne trouve.

### Le bouton « Membre » qui ne faisait rien

Christian, dès le premier essai : « je peux passer à coach mais je ne peux pas
passer à membre ».

Le sélecteur fonctionnait. C'est la suite qui le défaisait, en trois temps :

1. le clic navigue vers `/` ;
2. `HomePage` voit un admin connecté et redirige vers `landingRouteFor(roles)`,
   soit **`/admin/dashboard`** ;
3. l'URL commence par `/admin` — et dans `ModeContext`, **l'URL fait foi**. Le
   choix est écrasé dans la milliseconde.

Coach échappait au piège pour une raison sans rapport avec les rôles :
`/coach/my-classes` est une vraie page, sans redirection. Rien ne venait
contredire le choix.

Le mode membre vise donc `/dashboard`, pas la racine. Trois entrées « Accueil »
pointaient aussi vers `/` — deux dans la barre mobile, une dans le menu du
haut : elles reproduisaient le symptôme par une autre porte, au premier clic.

Le logo garde `/` : « revenir à la racine » y est un geste attendu, et la
redirection ramène alors chacun à son espace naturel.

À retenir : faire de l'URL la source de vérité est juste, mais cela rend le
choix vulnérable à **toute** redirection automatique. Une règle d'affichage et
une règle de navigation qui se contredisent produisent un bouton mort, sans
erreur ni signal.

### Ce que pèse vraiment l'administration dans le bundle d'un membre

Question posée après le débat sur Technogym : faut-il séparer l'application
cliente de l'application staff pour alléger ce que télécharge un membre ?

**Mesure faite. La réponse est non.** Le découpage par route fait déjà son
travail : aucun chunk `Admin*` ni `Coach*` n'est chargé au démarrage.

| | Gzip | Au démarrage |
|---|---|---|
| 20 pages `Admin*` | 90,2 ko | non |
| 2 pages `Coach*` | 11,8 ko | non |
| Scanner QR + markdown | 104 ko | non |
| Recharts | 92 ko | non |
| Clés i18n `admin` | 2,2 ko | **oui** |

Séparer l'application économiserait donc **2,2 ko** — les libellés admin,
chargés avec le reste des traductions. Sans commune mesure avec le coût.

Une erreur au passage, corrigée : recharts avait d'abord été annoncé comme
présent dans le chunk d'entrée. La sonde cherchait le mot « recharts » dans le
fichier, et l'unique occurrence était un nom de fichier dans la table de
preload — pas du code. Vérification refaite sur des marqueurs réels
(`ResponsiveContainer`, `d3-scale`) : recharts est correctement isolé.

**Mais la mesure a trouvé autre chose.** `HomePage` est la seule page non
différée — c'est l'accueil — et elle importait `react-markdown` et `remark-gfm`
en statique, pour une annonce qui n'est affichée que si elle existe. Rendu
conditionnel, chargement inconditionnel.

Deux composants : `AnnonceMarkdown` (la frontière `lazy` + `Suspense`) et
`RenduMarkdown` (le rendu isolé, ce qui rend le découpage possible).
`DashboardPage` est harmonisée — déjà différée, elle partage maintenant le même
chunk.

**Chargement initial : 349,6 → 305,0 ko gzip, soit 44,6 ko de moins (12,8 %).**
Vérifié à l'écran avec une annonce contenant gras, italique, lien, liste et
tableau : le tableau prouve que `remark-gfm` arrive bien par le chunk différé.

Reste ouvert : le bloc d'annonce est très peu contrasté en thème sombre — il
faut zoomer pour le voir. Sans rapport avec ce chantier.

### Le planning se lit enfin comme un planning

Christian montre la capture d'une application concurrente : une grille
hebdomadaire, jours en colonnes, heures en lignes, cartes colorées avec vignette
et ratio de remplissage. « Plus attractive que la liste qu'on a. »

Le gain n'est pas seulement esthétique. Une liste dit tout mais ne montre rien :
un trou de deux heures le jeudi matin n'y ressemble à rien, alors qu'il saute
aux yeux dans une grille. Et surtout, **une liste n'a pas de case vide** — donc
aucun endroit où cliquer pour créer un cours au bon créneau.

Périmètre volontairement tenu : **l'admin d'abord**, là où le clic sur case vide
apporte le plus. Le planning membre garde sa vue actuelle, on évalue à l'usage
avant d'étendre.

Trois bonnes surprises à l'inspection : les données couvrent déjà ±1 à 2 mois
autour de la période (aucune requête ajoutée), `class_type.color` et `image_url`
étaient déjà chargés sans être utilisés, et `openAdd` n'avait qu'à devenir
paramétrable.

Deux pièges évités :

- **Les bornes de période ne s'appliquent pas à la grille.** Elles découpent une
  liste ; « du 24/08 sans date de fin » n'aurait affiché que la moitié des
  colonnes. Coach et type, eux, restent des filtres de lecture.
- **Sur mobile, la flèche avance d'un jour**, pas d'une semaine : sous 768 px la
  grille se replie sur une seule journée, et un pas de sept sauterait six jours
  sans qu'on le voie.

L'amplitude horaire va de 7 h à 21 h, élargie d'office si un cours sort de ces
bornes — afficher minuit à 23 h ferait défiler dans le vide.

### Le mode d'utilisation se choisit, il ne se subit plus

Christian, depuis son téléphone : « quand je suis admin, j'ai du mal à trouver
les fonctions de menu en mode client ». Il évoque Technogym, qui livre deux
applications séparées, et demande si le projet devrait en faire autant.

La séparation n'a pas été retenue — ce serait dupliquer types, client Supabase,
composants, i18n et logique de crédits, ou monter un monorepo, pour un studio
qui n'en tire aucun bénéfice démontré. Mais le symptôme, lui, était réel, et sa
cause inscrite en dur : `MobileBottomNav` assumait que « le staff ne s'entraîne
pas au studio », et l'en-tête portait `show: !!user && !isStaff` sur quatre
entrées. **Un admin n'atteignait donc ni ses réservations, ni ses packs, ni les
performances, ni la boutique — sur aucun support.** Sur téléphone, où la barre
du bas est la seule navigation, la fonction devenait introuvable.

Un sélecteur **Membre / Coach / Admin** dans l'en-tête pilote désormais le menu
du haut et la barre du bas. Il n'apparaît qu'aux comptes à plusieurs casquettes.

Trois décisions :

- **Le mode ne donne aucun droit**, il choisit l'affichage. Les autorisations
  restent portées par `RoleGuard` et les policies RLS — basculer en mode Admin
  sans le rôle ne mène nulle part.
- **L'URL fait foi** quand elle est explicite : ouvrir un lien direct vers
  `/admin` bascule l'affichage, sinon la barre du bas proposerait la navigation
  membre par-dessus un écran d'administration.
- **Un coach non-admin a Membre + Coach.** L'hypothèse inverse est précisément
  celle qui a produit le défaut.

Le mode effectif est **dérivé**, pas corrigé dans un effet : une première
version le rectifiait dans deux `useEffect`, ce qui ajoutait deux signalements
de lint et un second rendu à chaque changement de page.

Reste ouvert : le bundle contient le code admin pour tous. Le découpage par
route existe déjà (`Lazy`), mais personne n'a mesuré ce que pèse réellement
l'administration dans ce que télécharge un membre.

### Présent et absent ne peuvent plus être vrais ensemble

Christian, en testant la fiche de cours livrée le matin : « je peux appuyer en
même temps sur Présent et Absent ».

`checked_in_at` et `is_no_show` sont deux colonnes indépendantes, et chaque
bouton n'écrivait que la sienne. Les deux s'allumaient donc côte à côte, et les
compteurs de l'en-tête comptaient la même personne deux fois.

Chaque geste écrit désormais **les deux champs dans le même `UPDATE`** — pas
deux `UPDATE` successifs, qui laisseraient un instant où les deux sont vrais, et
un état incohérent si le second échoue.

Effet de bord repéré en corrigeant : la garde d'entrée de `handleCheckIn`
sortait dès que `checked_in_at` existait. Quelqu'un marqué absent par erreur ne
pouvait donc plus être pointé présent. Elle teste maintenant l'état complet.

Les lignes créées avant ce correctif, avec les deux champs remplis, restent
incohérentes jusqu'à ce qu'on reclique dessus — aucune reprise automatique n'a
été faite, le cas étant limité aux essais de Christian.

### Le mode de paiement cesse de se déduire du prix

Christian s'inquiète : « si c'est paiement manuel, il faut vérifier que c'est
bien inscrit dans le journal, sinon ces 139 euros risquent de disparaître ».

Vérification faite, l'argent ne disparaissait pas — aucun écran ne filtre sur
`stripe_payment_intent_id`, les 139 € entraient bien dans les recettes du
tableau de bord. Le vrai défaut était ailleurs : **rien ne distinguait un
encaissement d'un cadeau**. Les deux boutons « Cadeau » et « Paiement manuel »
ne faisaient que préremplir le champ prix ; l'information mourait à l'écran.
Un pack offert au tarif plein ressemblait donc à une recette, et 139 € en
espèces ne se distinguaient pas de 139 € par virement au rapprochement.

**Colonne `payment_method`** sur `pack_purchases` (`stripe`, `cash`,
`transfer`, `gift`), choisie explicitement. La reprise des lignes existantes ne
devine que le certain : un identifiant Stripe prouve un paiement en ligne, un
prix nul un cadeau — le reste **reste `NULL`** plutôt que de fabriquer une
recette en espèces qui n'a peut-être jamais existé.

Trois décisions, prises avec Christian :

- **Espèces et virement séparés**, pas un « manuel » unique : la caisse et le
  compte bancaire se rapprochent séparément.
- **Confirmation avant tout encaissement** — le montant répété seul, en gros,
  parce que c'est lui qu'on ne relit pas. Motif visé, dans ses mots : « oh,
  j'ai fait un cadeau et j'ai mal encodé le paiement manuel ».
- **Fond ambre dans le journal d'activité**, badge avec le montant, et la
  description préfixée `ENCAISSEMENT ESPÈCES —`. Sans quoi, dit-il, « ça sera
  oublié pour la comptabilité ».

Le défaut par défaut est le cadeau : hériter d'un « espèces » de l'attribution
précédente déclarerait une recette que personne n'a encaissée.

Deux défauts corrigés au passage sur le même écran : l'`INSERT` n'avait pas de
`select()` — le journal ne pointait donc vers aucune ligne d'achat, et un refus
RLS serait passé pour un succès (règle n°5).

Reste ouvert : le journal d'activité est **purgeable à partir de six mois**. La
colonne en base, elle, survit — c'est précisément pourquoi le mode de paiement
n'a pas été confié au seul journal.

**Appliqué le jour même**, dans cet ordre — la colonne d'abord, sans quoi le
webhook aurait écrit dans une colonne inexistante :

1. Migration sur la base (31 lignes reprises : 8 `stripe`, 15 `gift`, 8 `NULL`).
2. `stripe-webhook` redéployé en version 13, `verify_jwt` contrôlé à `false`.

Le front n'est pas déployé : base et webhook sont donc en avance sur la
production. Sans risque — l'ancien front ignore cette colonne — mais l'écran
d'attribution à trois modes n'existe pas encore pour le studio.

### Fiche de cours : la liste d'attente entre en scène

Christian fournit la capture d'une application concurrente à imiter. L'essentiel
y était déjà chez nous — compteurs, places, salle — sauf **la liste d'attente**,
qui n'était pas chargée du tout. C'est pourtant l'information qui manque quand
quelqu'un annule au dernier moment : le coach ignorait que quelqu'un attendait.

Elle s'affiche sous un **trait pointillé ambre**, avec la position dans la file
et la date d'inscription. Pas de boutons de pointage : on ne pointe pas quelqu'un
qui n'a pas de place.

**Présent et absent passent à parité**, côte à côte à gauche du nom. « Absent »
n'était qu'un petit lien à droite, si discret que le coach ne le trouvait pas —
or c'est lui qui libère une place.

> **Les règles d'activation viennent de Christian**, plus précises que ce que je
> proposais : avant le cours, on peut retirer un inscrit mais pas pointer ;
> pendant et après, on pointe mais on ne retire plus. Un clic accidentel avant le
> début fausserait les statistiques de fréquentation.

`handleUndoNoShow` manquait : on pouvait marquer absent sans pouvoir se dédire.

### Promouvoir depuis la liste d'attente

**Le raisonnement de Christian a tranché une vraie difficulté.** Si la salle est
complète, faut-il refuser ? Non : *« si j'accepte de promouvoir, c'est parce
qu'une des personnes qui ont réservé n'est pas présente. Or je ne peux pas
effacer une personne qui a réservé. »*

D'où la règle : **une place se libère quand un inscrit est marqué absent**, pas
quand on retire sa réservation. C'est ce qui rend les deux boutons à parité
nécessaires — sans un « absent » facile à poser, la règle serait inapplicable.

La promotion appelle `book_member_by_staff` : un crédit est décompté comme pour
toute réservation, et la capacité reste contrôlée côté serveur. Si la salle est
pleine, le message dit quoi faire — marquer d'abord un inscrit absent.

L'en-tête reprend enfin la maquette : vignette du cours, jauge de remplissage
noir/ambre, cinq compteurs colorés, et un bandeau en quatre colonnes
(coach, date, horaire, salle).

### Passe documentaire sur les trois derniers chantiers

`documentation-technique.md` n'avait rien reçu des trois derniers sujets —
check-in par scan, mise en avant des packs, périodicité — alors que c'est la
source de vérité technique. Trois sections ajoutées (802 → 911 lignes), dont les
raisonnements qui ne se déduisent pas du code : pourquoi `is_featured` est un
champ à part, pourquoi `book_member_by_staff` ne pointe pas, pourquoi la policy
`ALL` devait être découpée.

`guide-admin-en.md` non plus : 524 → 633 lignes. Il ignorait le scan, les trois
statuts et la restriction super admin.

Côté membre, deux cas manquaient dans les deux langues : **se présenter sans
avoir réservé** — le coach peut inscrire sur place si un crédit est disponible —
et **le bandeau d'un pack mis en avant**, qu'il fallait présenter pour ce qu'il
est : une suggestion du studio, pas une contrainte.

> Le retard de fond des guides anglais **reste entier** : le français compte 40
> sections détaillées, l'anglais en couvre une fraction. Chantier à part, signalé
> depuis le 23 août, toujours pas entamé.

### Accueil au studio : deux écrans qui refusaient sans expliquer

Christian cherchait un membre dans la liste d'ajout d'un cours, sans le trouver.
Vérification faite : sur seize membres, **neuf seulement** apparaissaient. Les
autres étaient écartés par trois filtres cumulés — pack expiré, mauvais type de
crédit, ou zéro crédit restant.

**La règle est juste** : inscrire quelqu'un sans crédit créerait une réservation
impayée, précisément ce que `book_class` a fermé le 23 août. **Le silence ne
l'était pas** : le membre absent ne disait pas s'il fallait lui attribuer un
pack ou si l'on cherchait la mauvaise personne.

Tous les membres sont désormais chargés ; ceux sans source utilisable restent
visibles, **grisés et non sélectionnables**, avec la mention « aucun crédit pour
ce cours ». Les inscriptibles passent devant — la liste sert à inscrire, pas à
consulter qui ne peut pas l'être.

### Le scan propose d'inscrire au lieu de refuser

Dans la foulée, Christian décrit le cas réel : quelqu'un se présente **sans avoir
réservé**, mais avec des crédits. Le scan répondait « membre non inscrit à ce
cours », et le coach devait ressortir de l'écran pour l'ajouter à la main.

Le code scanné cherche maintenant au-delà des inscrits. Trois issues, toutes
explicites : code inconnu, membre sans crédit utilisable, ou **proposition
d'inscription** — que le coach confirme, le solde annoncé avant plutôt que
découvert après.

La confirmation appelle `book_member_by_staff`, qui inscrit **et consomme le
crédit** dans la même transaction. C'est la même fonction que l'ajout manuel :
rien n'a été réécrit, et les règles de capacité, de cours annulé et de double
inscription s'appliquent telles quelles.

> **Elle ne pointe pas la présence**, vérifié dans son code source. Le pointage
> est donc écrit ensuite, sur l'identifiant de réservation qu'elle renvoie — la
> personne est devant le coach, il serait absurde de lui demander un second
> geste. Le message ne dit « pointé » que si l'écriture a réellement abouti.

### Types de packs : trois statuts, et la corbeille au super admin

Demandé par Christian : basculer actif/inactif depuis la liste, réserver la
suppression, et pouvoir **mettre un pack en avant**.

**Le statut se change d'un clic sur son badge**, qui fait tourner
inactif → actif → promu. Retirer un pack du catalogue est le geste courant —
bien plus que le supprimer, refusé dès qu'il a été vendu — il ne méritait pas un
aller-retour par le formulaire.

**« Promu » est un champ à part, pas un troisième état de `is_active`.** Les deux
ne répondent pas à la même question : un pack promu est forcément actif, la
promotion étant une mise en avant et non un état de vente. Les fondre en une
colonne interdirait de dépromouvoir sans désactiver, et un pack désactivé puis
réactivé aurait perdu sa promotion en silence. Une contrainte `NOT is_featured
OR is_active` empêche l'état incohérent.

> C'est le raisonnement du B2B pris à l'envers : là-bas, *deux marqueurs pour le
> même fait finiraient par diverger* ; ici, ç'aurait été **un seul marqueur pour
> deux faits différents**.

Quatre effets, tous demandés : bandeau au texte libre (`featured_label`, vide =
« Recommandé »), remontée en tête de section, anneau plus marqué que celui des
abonnements — sans quoi la mise en avant passerait inaperçue au milieu de cartes
déjà toutes encadrées — et priorité sur le bandeau « Abonnement », puisque c'est
le message que le studio a délibérément choisi de pousser.

Le mécanisme `isPopular` existait déjà dans `renderPack` mais recevait toujours
`false` : il n'y avait qu'à le brancher.

**La corbeille est réservée au super admin**, à l'écran *et en base*. La policy
`Pack types: admin manage` couvrait `ALL`, donc `DELETE` : masquer le bouton
n'aurait rien protégé — le projet l'a déjà écrit à propos du menu du staff. Elle
est découpée en trois : insert et update pour tout admin, delete pour le super
admin seul. Un admin retire du catalogue, il n'efface pas.

### Abonnements : semaines ou mois, et l'annuel confirmé possible

Christian voulait s'assurer qu'un **abonnement annuel** est faisable, et retirer
les jours de la périodicité.

**L'annuel fonctionnait déjà** : `month × 12`, exactement la limite haute de
Stripe. Il s'affiche désormais « chaque année » plutôt que « tous les 12 mois » —
juste mais administratif, là où l'annuel est un argument de vente.

**Les jours disparaissent.** « Tous les 72 jours » ne se dit pas, ne se compare
pas, et n'a aucun sens commercial. Un seul pack l'utilisait — « abo 72j », sans
aucun abonné — converti en 10 semaines par la migration (écart de deux jours,
sans conséquence).

**Les bornes de Stripe deviennent une contrainte**, en base et à la saisie : 52
semaines, 12 mois. Rien ne l'empêchait auparavant — un « mois × 24 » passait la
création puis se faisait refuser au premier paiement, sans explication. Changer
d'unité ramène aussi le nombre dans les bornes plutôt que d'attendre le refus.

### Supprimer un type de pack déjà vendu : dire pourquoi c'est refusé

Signalé par Christian en tentant de supprimer « abo 72j » : « Une erreur est
survenue », sans plus.

La base refusait à raison — **un achat actif existait** : 18 crédits restants,
valides jusqu'au 1er novembre. Supprimer le type aurait rendu cet achat orphelin,
sans nom ni prix, et fait disparaître des crédits que le membre détient encore.

Le défaut était donc l'écran, pas la règle. Les liens sont maintenant comptés
**avant** de tenter, et le refus nomme sa raison en proposant l'issue :
décocher « Actif » retire le pack du catalogue sans toucher aux membres qui le
détiennent. Les erreurs restantes remontent leur message réel plutôt qu'un
`common.error` générique.

### Le paiement n'ouvrait rien sur le web

Signalé par Christian : cliquer « Continuer » pour payer les frais d'inscription
ramenait à la page des packs au lieu d'ouvrir Stripe.

La cause tient à une ligne du plugin Capacitor. Sur le web, `Browser.open` se
réduit à `window.open(url, '_blank')` — une ouverture d'onglet, et rien d'autre.
Deux choses la faisaient échouer :

- **Le popup était bloqué.** L'ouverture suit un `fetch` vers
  `create-checkout-session` : le navigateur ne la rattache plus au clic et
  l'écarte comme une fenêtre intempestive. Comportement anti-popup standard, que
  rien ne signale à l'utilisateur.
- **En PWA installée, `_blank` sort de l'application** — ou n'aboutit pas du tout
  sur iOS.

`ouvrirPaiement` (`src/lib/ouvrir-paiement.ts`) redirige désormais la page
courante sur le web, et conserve `Browser.open` en natif, où il ouvre une vue
intégrée dont on revient sans quitter l'app. Trois appels concernés : frais
d'inscription, achat de pack, et achat depuis le dialogue « pas de crédits ».

> **`MarkdownLink` n'a pas été touché** : il ouvre un lien externe dans un
> document, où un onglet séparé reste le bon comportement.

**Conséquence qu'il a fallu traiter.** Tant qu'un onglet s'ouvrait, le membre
revenait à sa page inchangée. Avec la redirection, il atterrit sur `/my-packs` ou
`/schedule` sans plus avoir la page Stripe sous les yeux : seul `fee_paid` était
accusé, les deux autres retours n'affichaient rien. Ils confirment maintenant le
paiement.

### Deux défauts d'affichage signalés depuis l'iPhone

**« 0 crédit » ne s'affichait pas.** La liste des soldes partait de
`creditsByType`, qui ne contient que les types **dont le membre possède un
pack** : sans pack Personal Training, aucune entrée, donc aucune pastille — ni
solde, ni zéro. Or « 0 crédit » est précisément ce qu'il faut lire avant de
tenter une réservation.

Le sens de lecture est inversé : on part désormais des types **présents au
planning**, et on y cherche le solde. Absent, il vaut zéro. Trois membres de la
base sont dans ce cas — semi-privé seulement, aucun pack PT.

**Le pied de page passait sous la barre de navigation mobile.** Le `<main>`
portait bien une marge basse pour la dégager, mais **le `<Footer>` est en dehors
du main** : il n'en bénéficiait pas et se retrouvait masqué par la barre fixe.
Il fallait forcer le défilement pour l'atteindre — y compris son lien vers
l'aide.

La marge a été déplacée du `main` vers un conteneur du pied de page. Elle vaut
`4rem + safe-area-inset-bottom`, exactement la hauteur de la barre (`h-16` plus
la même safe-area). Sur ordinateur, `md:pb-0` la supprime : la barre mobile
n'existe pas à cette largeur.

### Planning : le type de crédit devient le premier choix

Quatre ajustements demandés par Christian, qui vont tous dans le même sens : on
ne consulte pas « le planning », on consulte le planning **d'une prestation**.

**Plus d'onglet « Tout ».** Il avait été ajouté en pensant qu'un membre veut
d'abord voir sa semaine entière. C'est faux : mélangés, les deux types
obligeaient à lire chaque carte pour trier. On regarde un type à la fois.

**Les onglets passent au-dessus du titre.** C'est le premier choix, celui qui
commande tout le reste de la page.

**Le semi-privé s'ouvre par défaut.** Le tri était alphabétique, ce qui plaçait
« Personal Training » en tête — sans rapport avec l'usage. Il suit désormais le
nom technique du type de crédit : `semi_prive`, puis `personal_training`, puis le
reste par ordre alphabétique.

**Le titre porte le type affiché** : « Planning Personal Training » quand on
filtre. L'écran dit ce qu'il montre sans qu'on ait à remonter aux onglets.

**Les crédits suivent l'onglet.** Afficher le solde semi-privé sous un planning
Personal Training donnait un compte que ces cours ne peuvent pas consommer.

`ongletActif` est calculé au rendu et non posé dans un effet — c'est le motif
retenu dans `PacksPage`. Le repli sur le premier onglet couvre le cas où le type
regardé disparaît : changer de semaine peut le retirer du planning.

> **Un incident de découpage** mérite d'être noté : une première tentative de
> déplacement du bloc a emporté toute la barre de navigation — flèches,
> « Aujourd'hui », sélecteur jour/semaine/liste. Détecté au build, annulé par
> `git checkout`, repris avec des bornes vérifiées ligne à ligne. Déplacer un
> bloc JSX au jugé ne marche pas.

> **À savoir sur les données de test** : aucun cours Personal Training n'est
> programmé à venir. Les onglets ne s'affichent donc pas sur la semaine en
> cours — comportement voulu, un onglet unique n'apporte rien.

### Les notifications passaient sous l'encoche

Signalé par Christian : sur iPhone, « Connexion réussie » s'affichait trop haut
pour être lisible.

En PWA installée, l'application occupe **tout** l'écran — barre d'état comprise.
Un toast calé en `top-right` sans marge se glissait donc sous l'encoche.

`sonner` expose une prop `mobileOffset` prévue pour ce cas, appliquée sous
600 px. Elle reçoit `calc(env(safe-area-inset-top) + 1rem)` : la valeur vaut 0
sur un appareil sans encoche, et l'affichage sur ordinateur ne change pas.

> **`src/components/ui/sonner.tsx` n'a pas été touché** — c'est du shadcn
> généré, qu'une régénération écraserait. Vérification faite, ce composant n'est
> d'ailleurs utilisé nulle part : `App.tsx` importe `Toaster` directement depuis
> `sonner`.

Vérifié dans le CSS de la bibliothèque plutôt qu'à l'écran : sous 600 px, la
règle est `top: var(--mobile-offset-top)`, soit exactement la variable que la
prop alimente. En paysage l'iPhone dépasse le seuil et garde l'offset bureau —
correct, il n'y a pas d'encoche en haut dans ce sens.

### Audit documentaire : le B2B manquait presque partout

Christian demande si la documentation est complète, et cite le B2B en exemple.
Vérification faite, il avait raison — et le trou était plus large que prévu.

| Document | Avant |
|---|---|
| `documentation-technique.md` | Complet (le circuit, les trois colonnes, le garde-fou) |
| `guide-admin.md` | **Mentionné en passant, jamais expliqué** — rien sur comment qualifier un client, ni sur ce que ça change |
| `guide-membre.md` | Absent |
| `guide-admin-en.md` | **Zéro mention** |
| `guide-utilisateur-en.md` | **Zéro mention** |

La partie technique était donc juste, mais **personne ne savait s'en servir** :
le guide admin citait « client professionnel » deux fois sans jamais dire où se
trouve l'interrupteur.

Ajouté dans les quatre guides : qualifier un client, le tableau de ce qui change
(paiement, crédit immédiat, abonnements masqués, code promo absent), le circuit
des factures en trois moments, et le fait que **le studio porte le risque
d'impayé** — décision assumée, sans relance ni suspension automatique.

> **L'audit a révélé un manque plus large.** Le parrainage, les bons d'achat et
> le suivi des clients sont **totalement absents des guides anglais** : zéro
> mention pour des mécanismes commerciaux complets. Le guide FR compte 40
> sections détaillées, l'anglais en couvre une fraction.
>
> Ce n'est pas un oubli de cette session : c'est le retard de fond signalé depuis
> le 23 août. Le combler est un **chantier de traduction à part entière**, pas
> une passe de complétion — il n'a pas été entamé ici.

### L'écran d'inscription annonçait un e-mail qui ne partait pas

Signalé par Christian : sur une adresse déjà inscrite, l'écran affichait « Un
e-mail vient d'être envoyé à… » **et**, quelques lignes plus bas, « Tu as déjà un
compte avec cette adresse ». La première affirmation était fausse — Supabase
n'envoie rien dans ce cas — et le membre attendait un message qui ne viendrait
jamais.

Le front **savait** qu'il s'agissait d'un doublon (`dejaInscrit`), mais jetait
l'information après l'avoir journalisée. Elle est désormais retenue, ce qui
permet de formuler un écran **vrai dans les deux cas sans révéler que le compte
existe** — la protection anti-énumération reste entière.

Sur un doublon :

- Le sous-titre ne dit plus « Ton compte est créé » : rien n'a été créé.
- Le message devient conditionnel — « si aucun compte n'existait, un e-mail vient
  de partir ; s'il en existait déjà un, rien n'a été envoyé ».
- Le rappel des indésirables disparaît : il n'y a rien à y chercher.
- L'encart « déjà un compte » passe en premier plan, c'est la seule sortie utile.
- **Le bouton « Renvoyer l'e-mail » disparaît** : Supabase refuse un `resend` de
  type signup sur un compte confirmé, le proposer promettrait un envoi qui
  n'aura pas lieu.
- Le bouton principal devient « Me connecter » plutôt que « J'ai confirmé » — il
  n'y a rien à confirmer.

### La catégorie invisible sur iPhone en portrait

Signalé par Christian, avec le bon diagnostic : visible en paysage, absente en
portrait. La colonne était en `hidden sm:table-cell`, soit un seuil de 640 px —
un iPhone fait 390 à 430 px en portrait, il passait dessous.

Forcer la colonne dans un tableau qui en compte déjà six l'aurait rendu illisible.
Le badge s'affiche donc **sous le nom** en dessous de 640 px, là où la ligne a de
la place. Les deux affichages sont complémentaires (`sm:hidden` et
`hidden sm:table-cell`) : aucune largeur ne montre les deux ni aucun.

C'est le motif déjà employé pour le badge B2B, posé à côté du nom.

### Le code de check-in, replié par défaut

Demandé par Christian. Déployé, il occupait environ 250 px en bas du tableau de
bord — le tiers d'un écran de téléphone — pour un usage de quelques secondes par
visite. Replié, la carte tient sur une ligne.

Le commentaire du bloc portait déjà la bonne intuition : *« c'est le geste de
l'arrivée au studio, on le cherche sur place, pas en consultant son planning »*.
Le replier va dans le même sens.

> **L'état n'est pas mémorisé.** On veut le même geste à chaque arrivée, pas un
> écran qui change d'une fois à l'autre selon ce qu'on a fait la veille.

Sur la **page Profil**, il reste déployé : on n'y va pas par hasard, c'est
justement l'endroit où l'on vient chercher son code.

### Passe documentaire de clôture

Onze chantiers livrés dans la journée, dont la trace était complète dans le
journal et les guides FR — mais **`documentation-technique.md` n'avait rien
reçu**, alors que c'est la source de vérité technique. Quatre sections ajoutées :
PWA, inscriptions au journal, catégorie dérivée des packs, conflits de planning.

**Un défaut trouvé au passage dans `guide-installation.md`** : le `.htaccess` y
était recopié en dur, dans sa version d'avant la correction du jour. Quelqu'un
qui aurait suivi ce guide aurait reproduit le bug de l'icône iPhone — un fichier
statique absent répondant `index.html` en HTTP 200. Le guide renvoie désormais au
fichier livré dans `public/` plutôt que d'en tenir une copie, et gagne les deux
commandes `curl` qui vérifient qu'un déploiement a pris.

**Les guides anglais** reçoivent les sections du jour (446 → 524 lignes pour
l'admin, 235 → 266 pour le membre). Leur retard de fond sur les versions
françaises **n'est pas rattrapé** : il préexiste au 23 août, porte sur 300 lignes
sans rapport avec cette session, et reste un chantier à part.

> **`CLAUDE.md` annonçait 38 signalements de lint, la base réelle est 37**
> (vérifié par `git stash` en début de session). Corrigé — un seuil faux fait
> soit passer une régression pour normale, soit chercher un défaut qui n'existe
> pas.

### Ce qu'il reste à savoir sur la PWA

- **Les notifications push** ne fonctionnent sur iOS qu'une fois l'application
  **installée sur l'écran d'accueil**, et restent moins fiables qu'en natif.
- **Une PWA ne remplace pas le dépôt App Store** : c'est le canal de test, le
  temps de préparer la fiche.

---

## Session du 2026-08-23

Reprise du projet après deux semaines. Session de **fiabilisation** avant mise
en production : rien de neuf côté métier, mais deux trous fermés et de quoi
sortir les données.

### La réservation membre n'était pas atomique

Trouvé en cherchant, pas en corrigeant un bug signalé. `confirmBooking`
enchaînait quatre allers-retours depuis le navigateur — vérifier les places,
choisir la source, insérer, décompter. Entre le premier et le troisième, rien
ne tenait.

**Deux conséquences réelles**, jamais constatées faute de trafic simultané :

- **Dépassement de capacité.** Le compteur de places venait d'un état React
  chargé à l'ouverture de la page. Deux membres cliquant sur la dernière place
  à la même seconde passaient tous les deux. Rien en base ne s'y opposait :
  `UNIQUE(scheduled_class_id, user_id)` protège de la double inscription d'un
  même membre, pas du dépassement.
- **Réservation sans débit.** `consume_credit` renvoie `VOID` et porte
  `AND credits_remaining > 0` : à zéro crédit, elle ne touche aucune ligne et
  ne lève **aucune erreur**. Tester `error` n'aurait rien changé.

Le projet connaissait déjà ce raisonnement — le commentaire du trigger de quota
dit « les réservations partent d'un INSERT direct depuis le front, donc un
contrôle appelé côté client serait décoratif ». La leçon avait été appliquée au
quota, jamais à la capacité ni aux crédits.

**`book_class`** applique la même méthode que `book_member_by_staff`, son
pendant staff qui existait déjà et faisait les choses correctement : décider et
écrire dans une seule transaction, sous `pg_advisory_xact_lock` posé sur le
cours. Elle réutilise `can_book_class` et `get_available_credits` au lieu de
réécrire leurs règles — dupliquer garantissait qu'un jour les copies
divergeraient.

Deux points de conception :

- **Le décompte précède l'écriture.** L'ordre inverse obligerait à lever une
  exception pour annuler une réservation déjà écrite, et le front devrait alors
  gérer deux formes de refus. L'atomicité garantit qu'un crédit ne peut pas
  être consommé sans réservation : si l'INSERT échoue ensuite, tout est annulé.
- **Verrou consultatif** plutôt que `SELECT FOR UPDATE` : il ne sérialise que
  les réservations du même cours, sans bloquer un admin qui modifierait
  l'horaire au même moment.

**Éprouvée en base** : neuf cas passés, dont les trois qui comptent — refus
sans crédit avec **zéro réservation écrite**, pack d'autrui inconsommable,
refus qui ne décompte rien.

> **Le verrou lui-même n'est pas encore éprouvé.** Il faudrait deux
> transactions simultanées, que le SQL Editor ne sait pas tenir : il referme la
> sienne dès qu'une requête rend la main. `supabase/test-book-class-concurrence.sql`
> décrit la manipulation à deux onglets ; à défaut, deux téléphones sur la
> dernière place d'un cours le diront.

**Deux chemins volontairement laissés en l'état** : la séance d'essai (doit
poser `is_trial`, et son pack ne remonte pas par `get_available_credits`) et
l'inscription par le staff (`book_class` réserve pour `auth.uid()`, elle
inscrirait l'admin au lieu du membre).

### Les deux tables les plus lues n'avaient aucun index

Question posée : faut-il archiver au-delà de six mois, pour la performance ?
**Non** — et la vraie réponse était ailleurs.

Les chiffres de la base, relevés le jour même : **1,1 Mo au total**, 454 cours,
120 réservations, 257 lignes de journal. Le plan Pro offre 8 Go. Même en
supposant une année réelle dix fois plus dense, on serait à 10–15 Mo par an :
le plan gratuit tiendrait trente ans. Archiver aurait amputé le suivi clients
et l'historique des revenus pour économiser quelques mégaoctets — quand
l'obligation comptable belge est de sept ans.

Le vrai défaut : **`bookings` et `scheduled_classes` n'avaient pas un seul
index** hors clé primaire et contrainte d'unicité, alors que 65 requêtes des
fonctions de la base les interrogent. Invisible sur les données de test ;
à 10 000 réservations, chaque affichage du planning aurait lu les 10 000 lignes
pour en retenir quatre.

Huit index posés, chacun répondant à des requêtes relevées une par une. Un
neuvième a été écarté en cours de route : la recherche par cours dans
`waitlist` est déjà servie par l'index de sa contrainte d'unicité.

### Exports CSV

**Une page dédiée** (`Administration → Exports`), huit sorties : réservations,
cours, membres, achats de packs, abonnements, présences par membre, avis,
journal d'activité. La liste des cours porte le coach, l'effectif, les
présences et le **statut dérivé**, calculé par la même fonction que l'écran.

Chaque export se charge à la demande — une année de réservations serait absurde
à rapatrier pour un bouton qu'on ne cliquera peut-être pas.

**Deux défauts corrigés au passage.** Le projet portait deux implémentations
CSV divergentes : virgule d'un côté, point-virgule de l'autre, et celle des
membres **n'échappait pas les guillemets** — un nom contenant `"` cassait le
fichier en silence. `src/lib/csv.ts` tranche : point-virgule (la virgule est le
séparateur décimal d'un Excel français, qui ouvrirait tout en une colonne) et
BOM UTF-8 (sans lui, « Rémi » devient « RÃ©mi »).

Les exports des pages Membres et Tableau de bord restent en place : ils
exportent ce qu'on regarde, filtres compris.

### Journal d'activité : export et purge

Export CSV portant sur **tout ce que les filtres retiennent**, pas sur les
cinquante entrées affichées.

Purge réservée au **super admin**, par ancienneté, six mois minimum. Elle passe
par une fonction plutôt que par une policy `DELETE`, et la distinction est le
cœur du sujet : ouvrir cette policy autoriserait à supprimer **n'importe
quelle** ligne, une par une — un journal d'audit que son lecteur peut trafiquer
ligne par ligne ne vaut plus rien. La fonction n'autorise qu'un effacement en
bloc, et **se journalise elle-même**.

### Le `REVOKE` qui ne révoquait rien

Mes migrations finissaient par `REVOKE ALL ... FROM PUBLIC`. **Sans effet** :
vérification faite, `anon` gardait son droit d'exécution. Les ACL le disent —
`anon=X/postgres` : Supabase accorde EXECUTE **nommément** à `anon` via ses
`ALTER DEFAULT PRIVILEGES`, le droit ne vient donc pas de `PUBLIC`.

Aucune fonction n'était exposée pour autant — le contrôle d'identité est dans
leur corps, et `purge_activity_log(12)` sans identité renvoie bien
`not_authenticated` sans rien effacer. Mais la seconde barrière annoncée
n'existait pas. Corrigé en visant `anon` ; `book_member_by_staff` en bénéficie,
elle n'avait aucun `REVOKE` depuis sa création.

> **À retenir** : sur Supabase, `REVOKE ... FROM PUBLIC` sur une fonction du
> schéma `public` ne fait rien. Il faut `REVOKE EXECUTE ... FROM anon`.

### Lint : de 77 à 38 signalements

Les 32 `any` supprimés **en typant**, jamais en désactivant une règle. Trois
causes : les jointures PostgREST (helper `one()` dans
`src/lib/supabase-joins.ts`), `ScheduledClass.coach` annoncé `Profile` complet
alors que les pages n'attachent que trois champs (type `CoachRef`), et les
objets Stripe dont le SDK décrit une forme périmée.

Le typage retrouvé a **immédiatement trouvé un défaut** : deux `pack_type`
passés bruts à `creditValueCents`, que le cast masquait.

Les 38 restants sont tous du React Compiler, sur du code validé à l'écran. Les
corriger change le comportement au runtime : chantier page par page, **pas** un
nettoyage de lint.

### Documentation

- **`CLAUDE.md` créé** à la racine : les règles qui ne se devinent pas en
  lisant le code, chacune avec l'incident qui la justifie.
- **Neuf documents rapatriés du vault** dans `docs/vault-import/`, dont
  `reservations-regles-et-cas-de-test.md` — le seul endroit où les règles de
  réservation sont écrites telles que présentées aux coachs. Il a servi le jour
  même à vérifier que `book_class` ne contredit aucune règle convenue.
- **Les handoffs** s'écrivent désormais dans `docs/handoffs/`.

### Fin de session — l'écran, et ce qu'il dit

Quatre corrections nées de l'essai réel, toutes du même ordre : le code faisait
ce qu'il fallait, l'écran disait autre chose.

**La pop-up de réservation restait ouverte** sur une réservation pourtant
enregistrée. La fermeture était la DERNIÈRE instruction, après le journal
d'activité et la notification : il suffisait qu'un de ces deux appels
accessoires échoue pour que tout ce qui suit soit abandonné. Le membre voyait
un bouton figé et pouvait cliquer deux fois.

> **Ce qui est acquis s'affiche d'abord.** La trace et l'e-mail suivent,
> isolés dans un `try`. Une réservation est en base : l'écran n'a pas à
> attendre l'envoi d'un e-mail pour le dire. Le même défaut existait sur trois
> autres chemins — liste d'attente, inscription en attente, séance d'essai.

**« Mes réservations » s'ouvrait sur tout l'historique.** Un membre de longue
date devait chercher sa prochaine séance au milieu de ses mois passés. Par
défaut : les séances à venir. Le reste est à un clic.

**« Expire le » s'affichait sur un abonnement reconduit.** Le mot laissait
croire à une fin. Deux corrections successives ont été nécessaires : la
première se fiait à `subscription_id`, qui reste vide sur un pack attribué à la
main — elle ne couvrait donc pas le cas réel. La seconde se fonde sur
`pack_type.is_recurring`, la nature de la formule.

**Le bouton de résiliation « manquant ».** Il ne manquait pas : sur un pack
attribué à la main, il n'y a rien à résilier. `subscriptions` n'est alimentée
que par le webhook Stripe, après un vrai paiement. Le silence était le
problème — ces packs portent maintenant « Offert par le studio — non reconduit
automatiquement ».

Et le libellé dit enfin **quand** l'arrêt prend effet : « Résilier à la fin de
la période », avec un dialogue qui s'ouvre sur « Rien ne s'arrête aujourd'hui ».
C'est la seule question qu'on se pose devant ce bouton.

### La durée d'un abonnement est libre

Question des coachs : 28 jours ne conviennent pas toujours, parfois 72 seraient
mieux. **Rien ne s'y oppose** — le formulaire accepte un nombre libre en jours,
semaines ou mois, et Stripe suit (maximum 365 jours, 52 semaines ou 12 mois,
sans dépasser un an au total).

Un obstacle a été levé au passage : le formulaire exigeait que la validité des
crédits corresponde au cycle de prélèvement. **Exigence infondée** — sur un
abonnement, `validity_days` n'est jamais lu, l'expiration suit `periodEnd`. Et
**insoluble** pour 72 jours, la validité se saisissant en semaines : 70 ou 77,
jamais 72. Un coach serait tombé dessus dès sa première tentative.

> À signaler aux coachs avant qu'ils tranchent : **72 jours ≈ 5 prélèvements
> par an** contre 13 à 28 jours, ce qui change la marge de chaque formule. Et
> **un prix Stripe est immuable** : mieux vaut trancher avant les premières
> ventes, les abonnés existants gardant leur cycle d'origine.

### Documentation — vérification d'ensemble

`docs/README.md` **créé** : il trie les seize fichiers en trois catégories — à
jour, références valables, traces du passé. Savoir lequel fait autorité n'était
plus évident.

**Supprimé** : `guide-coach.md`, qui décrivait en style technique (avec des URL
plutôt que des noms de menu) ce que `guide-admin.md` couvre déjà mieux, et qui
n'était accessible nulle part dans l'application. Son contenu unique a été
rapatrié.

**Annotés** : quatre documents périmés. `plan-implementation-v2.md` mentionne
Mollie cinquante fois pour une migration abandonnée le 3 août ;
`regles-coupons-parrainage.md` décrit des règles jamais implémentées ainsi. Les
garder se justifie — ils disent POURQUOI certaines décisions ont été prises —
les laisser passer pour des références, non.

**Corrigé** : le guide d'installation listait six migrations et s'arrêtait en
mai. Toute énumération vieillit en quelques jours ; remplacée par la règle.

**La documentation française est à jour au 2026-08-23**, `public/` compris —
c'est-à-dire ce que la page d'aide sert réellement.

### Supabase passe en Pro — 25 $/mois

Souscription au plan Pro le 2026-08-23, en prévision de la mise en production.
Ce qu'il apporte, et qui manquait :

- **Sauvegardes quotidiennes automatiques**, 7 jours de rétention
- **Pas de mise en veille** après une semaine d'inactivité — le plan gratuit
  suspend les projets dormants, ce qui serait fâcheux pour une application que
  des clients utilisent
- 8 Go de base, quand la nôtre en pèse 1,1 Mo

**La facture annonçait 35 $, pas 25.** Le plan Pro inclut 25 $ d'abonnement et
10 $ de crédit *compute*, mais ce crédit ne couvre **qu'un seul projet** — tout
projet supplémentaire coûte 10 $/mois, *regardless of activity*, qu'il serve ou
non. L'organisation en portait deux : `bot` et `nlp-lab-pnl`.

**`nlp-lab-pnl` a donc été mis en pause**, après export complet. Ce lab était un
essai dont la suite n'est pas décidée ; le mettre en veille ramène la facture à
25 $ sans rien détruire — un projet en pause se réveille d'un clic, intact.

> **La sauvegarde vit dans `~/backup-nlp-lab-pnl`**, dépôt Git local :
> `schema.sql` (18 tables, 59 fonctions, 68 policies) et `data.sql` (95 lignes,
> 8 comptes utilisateurs). **Contient des données personnelles — jamais sur un
> dépôt public.** Le Storage a été vérifié : rien à télécharger.
>
> Exporté avec `pg_dump` et non la CLI Supabase : `supabase db dump` exige
> Docker, absent de cette machine. `brew install libpq` suffit, et le plan
> gratuit n'y fait pas obstacle.

### Ce qui reste ouvert

**Prochaine session (2026-08-24) : préparer la publication sur l'App Store.**
Compte Apple Developer **au nom propre** — un compte Organization exigerait un
numéro D-U-N-S, dont l'obtention prend une à deux semaines, hors délai. Les deux
prérequis bloquants sont levés depuis le 7 août ; restent la fiche App Store
(description, mots-clés, captures aux formats imposés), l'icône 1024 × 1024, le
questionnaire « App Privacy » et la classification d'âge. Du travail de
préparation, pas de développement. À peser : l'éditeur affiché sera « Christian
Vanhenten », pas le studio.

Puis, dans l'ordre :

1. **Le verrou de concurrence**, à éprouver sur deux téléphones.
2. **Essayer dans l'application** : réserver, annuler, re-réserver, réserver
   sans crédit, ouvrir un export dans Excel.
3. **28 écritures Supabase ne testent toujours pas `error`** — le bug que le
   journal documente déjà. Repérées, non corrigées : chantier d'après
   lancement.
4. **Le parrainage n'est toujours pas testé** de bout en bout.
5. **Les guides anglais accusent un retard important** — 15 Ko contre 41 en
   français côté admin, 7,5 contre 12 côté membre. Ils ignorent le suivi
   clients, la séance d'essai, la suppression de compte, les exports et tout ce
   qui précède. **Reporté sciemment le 2026-08-23** : le studio est
   francophone, et l'écart est trop large pour une traduction faite à la
   sauvette. À reprendre comme un chantier à part entière.

---

## Session du 2026-08-09

### Vendre en août un abonnement qui commence en septembre

Besoin commercial : rencontrer un client le 15/08 et lui vendre un pack qui démarre le 01/09.

**Pour l'abonnement, Stripe fait tout le travail** — via `trial_end`, qui décale la première facture sans rien changer d'autre. Un champ « Démarrer plus tard » a été ajouté à la confirmation d'abonnement ; vide, le comportement ne change pas.

Le point qui rendait la chose sûre existait déjà : le webhook **ignore les factures à 0 €**, celles que Stripe émet à la souscription. Ce filtre avait été écrit le 5 août contre le bug du second pack lors d'un report d'échéance — le démarrage différé en hérite gratuitement. **Rien n'est crédité avant le paiement**, donc un client qui achète en août ne peut pas s'entraîner avant septembre.

Seule la notification a dû changer : elle annonçait « Abonnement activé » même quand rien ne démarrait, ce qui aurait fait chercher au membre des crédits inexistants. Elle dit maintenant « Abonnement enregistré » avec la date de début.

**Éprouvé au test clock** sur un cycle de 4 semaines avec `trial_end` à J+7 : aucun pack à la souscription (seulement la facture à 0 € correctement ignorée), pack de 4 crédits créé au jour dit avec `expires_at` calé sur la fin du cycle facturé, et cycle suivant enchaîné **à la seconde près** — la fin du premier pack est exactement le début du second.

> **Le pack ponctuel se règle sans code.** `pack_purchases` n'a pas de `starts_at` : un pack est consommable dès qu'il existe. Décision de Christian le même jour : **on choisit un pack dont la durée de validité couvre la période visée** — trois mois achetés le 15/08 portent jusqu'à mi-novembre. Rien à développer. La seule limite, assumée, est que le client peut consommer avant la date prévue ; elle ne gêne que sur un pack vendu au tarif d'une période précise, cas rare qu'une phrase au client règle mieux qu'une colonne en base.

### Guides membre et administrateur : six jours d'écart comblés

Quatre fonctions livrées et utilisées n'étaient documentées nulle part côté utilisateur : la **séance d'essai** offerte à l'inscription, la **suppression de compte**, la **saisie d'un code promo**, et le **démarrage différé** livré le matin même. Ajoutés aussi le bloc communications de l'accueil, la liste d'attente et son délai de deux heures, et côté admin les coordonnées légales — qui bloquent CGV, confidentialité et facturation tant qu'elles sont vides.

> **Une affirmation était devenue fausse.** Le guide annonçait qu'un coupon créé n'était pas utilisable, faute d'écran de saisie. Le champ existe depuis le 7 août. Une documentation qui dit « ça ne marche pas » quand ça marche empêche de vendre — c'est pire qu'un manque. Les deux autres mentions « pas encore » ont été vérifiées contre le code : elles sont exactes, elles restent.

### Suivi des clients — repérer qui ralentit avant de le perdre

Nouvelle page admin (`/admin/client-tracking`) qui répond à une question commerciale : **qui faut-il relancer ?** Chaque client est classé selon le temps écoulé depuis sa dernière séance — actif, ralentit, décroche, perdu, jamais venu — et l'onglet « À relancer » réunit les trois états qui appellent une action.

**Les « jamais venus » en sont exclus volontairement** : un inscrit jamais présent appelle un accueil, pas une relance. Ce n'est pas le même geste commercial.

**La tendance plutôt que le total.** Un total cumulé reste élevé chez quelqu'un qui a cessé de venir — il ne dit donc rien. La page compare la période récente à la précédente, de même durée : c'est cette comparaison qui révèle le ralentissement.

**Deux colonnes de présence, côte à côte.** « Réservé » est toujours fiable — la réservation a consommé un crédit, donc elle compte commercialement même si la personne n'est pas venue. « Pointé » dit la venue réelle mais dépend de la rigueur du pointage. Aucune des deux n'est suffisante seule, et **l'écart entre elles est lui-même une information** : sur un membre qui réserve sans venir, ou sur un pointage négligé. Le classement s'appuie sur la réservation, la donnée toujours présente — fonder l'alerte sur le pointage produirait de faux décrocheurs.

**Le revenu par séance, pas le total.** `booking_revenue()` existait déjà et gère le cas délicat du pack illimité, où le prix se répartit entre les séances réservées : réutilisée plutôt que recalculée. Quelqu'un qui achète un illimité et vient trois fois rapporte plus par séance que celui qui vient quinze fois — c'est ce chiffre qui dit la rentabilité.

Seuils réglables dans les Réglages (3 / 6 / 10 semaines par défaut, calés sur le cycle d'abonnement de 4 semaines), avec refus des valeurs non croissantes. Le staff est exclu de la liste : il fausserait les moyennes.

> **Le piège du jour, propre à PL/pgSQL.** La fonction se créait sans erreur et échouait au premier appel : `column reference "user_id" is ambiguous`. Les noms déclarés dans `RETURNS TABLE` deviennent des **variables** dans tout le corps, résolues **avant** les colonnes — et mes CTE exposaient une colonne portant exactement le nom d'un paramètre de sortie. L'erreur ne se déclenche qu'à l'exécution, jamais à la création : le SQL passe, la fonction existe, rien ne signale le problème avant le premier appel. Les CTE sortent désormais sous l'alias `uid`.

**Données de démonstration ajustées** pour que la page montre quelque chose : taux de pointage porté à ~95 % (conforme au réel, où les absences sont rares), et dernières séances étalées sur trois membres. Les quatre états sont représentés — 6 actifs, 1 ralentit, 1 décroché, 2 perdus.

### Les guides disaient où aller, mais avec les mauvais noms

Demande de Christian : indiquer le chemin d'accès de chaque fonction. Les deux guides s'ouvrent désormais sur un **tableau d'orientation** listant les entrées du menu dans l'ordre où elles apparaissent, avec un lien vers la section détaillée.

En confrontant les libellés au code, **six entrées étaient nommées autrement dans l'application** : « Membres » est *Utilisateurs*, « Réglages » est *Paramètres*, « Planning » est *Gestion du planning*, « Catégories » est *Catégories de membres*, « Demandes de facture » prend un s, « Journal » est *Journal d'activité*. Côté membre, « Mes cours » est *Mes réservations* et « Packs » est *Acheter un pack*.

> Un guide qui nomme un menu inexistant fait chercher au mauvais endroit — c'est plus coûteux qu'une absence d'indication.

### Le piège de la double copie

**La page `/help` ne lit pas `docs/`.** Les guides vivent à deux endroits sans aucune synchronisation :

- `docs/guide-admin.md` et `docs/guide-membre.md` — la version de travail ;
- `public/guide-admin.md` et `public/guide-**utilisateur**.md` — ce que l'application affiche.

J'éditais `docs/` depuis deux jours : **la page d'aide servait donc une version antérieure de 62 lignes**, sans le suivi des clients, sans le démarrage différé, sans les tableaux d'orientation. Personne n'aurait rien vu.

Corrigé, et consigné dans la documentation technique avec les deux `cp` à passer après chaque édition. Noter le renommage : `guide-membre.md` devient `guide-utilisateur.md` dans `public/`.

> **Les versions anglaises restent en retard.** Traduites à la main, elles ignorent le suivi des clients, le démarrage différé, la séance d'essai, la suppression de compte et les tableaux d'orientation. Signalé, non traité — c'est un chantier de traduction à part entière.

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

**Le plafond 10 cours / 7 jours est actif** sur « abonnement mini » et « Pack illimité » — donc pour tous leurs détenteurs, pas seulement les quatre clients de test. Sans conséquence : la base est une base de test, et ces valeurs en font partie au même titre que le reste. Les quatre clients de test restent également en place.

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


---

# Session du 2026-09-02 — Répondre au premier refus d'Apple

Apple a refusé la soumission du 1ᵉʳ septembre au titre de la **Guideline 2.1
— Information Needed**, motif `2.1.0 Performance: App Completeness`. Ce
n'est pas un rejet de fond : c'est la demande d'information systématique
adressée à un compte développeur **sans historique de publication**. Six
questions, dont un enregistrement d'écran sur appareil physique.

**Réponse envoyée à 11h54**, avec la vidéo en pièce jointe. Le champ
*Remarques* de la fiche a été rempli du même contenu, comme Apple le demande
— il servira de référence aux prochaines soumissions.

## Ce qui a été produit

- `docs/apple/reponse-review-2026-09-02.md` — le texte des six réponses, en
  anglais, réutilisable tel quel
- `docs/apple/restaurer-compte-demo.md` — les requêtes pour remettre en
  service le compte d'Apple après l'avoir supprimé devant la caméra
- `docs/soumettre-app-store-pas-a-pas.md` — nouvelle **étape 7**, qui
  documente la demande d'information et le tournage de la vidéo
- `app-bot-iphone13-final.mp4` — 2 min 21, 29 Mo, non versionné

## Décisions prises

**Le public visé est décrit comme ouvert, pas comme fermé.** La première
rédaction disait « les membres et coachs de ce studio, une soixantaine de
personnes ». Le courriel d'Apple se termine justement par un rappel de la
**règle 3.2** : une app réservée aux clients d'une entreprise peut être
renvoyée vers Apple Business Manager. La formule retenue — « toute personne
qui s'entraîne au studio ou souhaite commencer », l'inscription étant
libre — est exacte et n'appelle pas ce sujet.

**Les performances sont déclarées comme des données sportives.** L'écran
« Mes performances » affiche des courbes ; un évaluateur pourrait y voir des
données de santé. La réponse précise qu'il ne s'agit que de résultats
d'exercices définis par le studio, sans mesure corporelle et sans HealthKit.

**Ne pas toucher à l'outillage mobile pendant l'examen.** Le décalage de
version décrit plus bas était corrigeable aujourd'hui ; modifier les scripts
pendant qu'un build est en vérification ajoutait du risque sans rien
résoudre.

## Trois pièges rencontrés

### 1. La vidéo a détruit le compte de démo d'Apple

La séquence donnée à Christian disait « se connecter avec le compte de démo »
à l'étape 3, puis « supprimer le compte » à l'étape 9 — la seule session
ouverte étant celle du compte de démo. Il a été supprimé deux fois.

Sans restauration, l'évaluateur n'aurait pas pu se connecter : second refus
assuré, au motif « Accessing the app ». La procédure est désormais écrite.

Ce que la suppression fait exactement : `delete_own_account()` **anonymise**
le profil mais laisse `auth.users` intact, adresse et mot de passe compris.
D'où deux conséquences utiles : le compte est restaurable, et son adresse
reste indisponible pour une nouvelle inscription.

### 2. Un diagnostic faux, fondé sur le badge de version

La première vidéo a été déclarée tournée sur la PWA plutôt que sur l'app
native, au motif que le badge affichait 3.124.0 alors que le build soumis
porte 3.123.0. **C'était faux** : le badge vient du contenu web embarqué,
pas du navigateur. Un tournage a été refait pour rien.

La vérification qui manquait tenait en une commande — lire la version dans
`ios/App/App/public/assets/index-*.js`, c'est-à-dire ce que l'enveloppe
embarque réellement, plutôt que de raisonner sur `package.json`.

### 3. Le champ Notes et la pièce jointe ont des limites distinctes

Le champ *Remarques* accepte **4000 caractères** — le texte des six réponses
en fait 3823, il faut resserrer. La pièce jointe du fil de discussion est
limitée à **50 Mo** : une capture d'iPhone brute en fait 170. Compresser sans
réencoder (`ffmpeg -c copy` pour une simple coupe) évite toute perte.

## Ce qu'il faut savoir pour la suite

**Le bouton « Soumettre à nouveau » reste grisé, et c'est normal.** Pour une
demande d'information, Apple reprend l'examen à partir de la réponse : ni
nouvelle soumission, ni nouveau build. Le bouton ne se réactive que si Apple
réclame un binaire corrigé.

**Ne pas supprimer le compte de démo tant que l'examen est en cours.**

**Délai attendu :** 24 à 48 heures.

---

## À faire — deux numéros de version qui divergent dans l'app mobile

**Constaté le 2026-09-02**, en contrôlant une vidéo destinée à Apple : l'app
installée sur l'iPhone affiche `v3.124.0` dans son badge, alors que le build
soumis se déclare en `3.123.0`. Les deux sont vrais — ils ne viennent pas du
même endroit :

| Ce qu'on lit | Origine | Valeur |
|---|---|---|
| Le badge, dans l'interface | `package.json`, via `dist/` recopié par `cap sync` | 3.124.0 |
| La version vue par Apple | `MARKETING_VERSION` dans `project.pbxproj` | 3.123.0 |

**Comment on y arrive.** `version-mobile.sh` reporte correctement la version,
mais la **règle 2** impose un bump à *chaque* commit. Le commit `82c563b`
(1ᵉʳ septembre, 14h51 — la correction iPad) a donc porté `package.json` à
3.124.0 **après** le dernier passage du script. L'archive envoyée à Apple a
ensuite été construite en incrémentant seulement le numéro de build (6 → 7),
tandis qu'un `npm run build` régénérait un `dist/` en 3.124.0.

Tout chantier mobile recrée mécaniquement ce décalage, sauf à repasser
`version-mobile.sh` juste avant de construire l'archive.

**Conséquence côté Apple : aucune.** Le numéro déclaré est cohérent et le
build 7 est unique ; l'examinateur ne regarde pas le badge. Rien à corriger
avant de re-soumettre.

**Conséquence pour nous : réelle.** Devant un build installé, on ne peut plus
dire quel code il embarque. C'est ce qui a fait conclure à tort, ce matin,
qu'une vidéo avait été tournée sur la PWA plutôt que sur l'app native — et
coûté un tournage.

**Ce qui manque.** `verifier-mobile.sh` compare bien `package.json` à
`MARKETING_VERSION` (lignes 24 et 30) et aurait signalé l'écart : il n'a
simplement pas été lancé. Mais il ne contrôle **pas** la version réellement
embarquée dans `ios/App/App/public/` — c'est celle-là qui s'affiche à l'écran.

**À faire :**

1. Dans `verifier-mobile.sh`, **échouer** si le numéro embarqué dans
   `ios/App/App/public/assets/index-*.js` diffère de `MARKETING_VERSION`.
   C'est le contrôle qui manque : il compare ce qui s'affiche à ce qui est
   déclaré, pas deux fichiers de configuration entre eux.
2. À la fin de `version-mobile.sh`, rappeler que reporter la version ne suffit
   pas : sans `npm run build && npx cap sync` derrière, l'enveloppe garde
   l'ancien contenu web.

Décidé de ne pas y toucher avant la réponse à Apple : le décalage n'a aucun
effet sur la vérification en cours, et modifier l'outillage mobile pendant
qu'un build est en examen ajouterait du risque sans rien résoudre.

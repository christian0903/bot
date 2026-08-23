---
type: handoff
agent: cowork
session-machine: mac-mini
session-date: 2026-08-07
domaine: "[[_developpement]]"
auteur: "[[@Christian Vanhenten]]"
statut: actif
created: 2026-08-07
tags:
  - claude/handoff
  - handoff
  - bot
  - stripe
  - performances
  - facturation
---

# Handoff — App Bot : séance d'essai, communications, performances, B2B

> Session du 2026-08-07, **37 commits poussés** (v2.53.0). Journée nourrie par les retours de **deux coachs**. L'application tourne sur iPhone en version de test : démonstration faite.

---

## Reprendre

```bash
cd ~/bot && claude
```

Puis : « on reprend le handoff bot ». `main` est aligné sur `origin/main`, rien en attente.

**Points de reprise, au choix :**

1. **Export des factures vers Odoo** — le socle B2B est posé, il manque la structure de fichier que Christian doit fournir (voir en fin de document)
2. **Performances étape 3** — paliers (« Club 100 séances ») et régularité. Les fonctions SQL existent déjà, inutilisées
3. **Case notifications à l'inscription** — la seule demande des coachs encore ouverte sans décision en suspens

> **À faire dès la reprise** : saisir les coordonnées légales du studio dans les Réglages. Elles bloquent les CGV, la politique de confidentialité et la facturation.

---

## Le fil rouge de la journée

**Ce que le code promet n'est pas toujours ce que la base fait.** Quatre bugs de la journée avaient cette forme, et aucun ne se voyait à l'écran.

| Symptôme | Cause réelle |
|---|---|
| Le cours d'essai n'apparaît nulle part | Écrit dans une table à part que les écrans ne lisent pas |
| L'abonnement paraît échu le jour même | `invoice.period_*` date la **facture**, pas le cycle |
| Bouton « Annuler » sur une réservation annulée | Le refus serveur arrive **dans** le retour, pas en erreur |
| Le webhook rejette tout pendant une heure | `--no-verify-jwt` perdu au redéploiement |

> **Le réflexe à garder** : après une écriture Supabase ou un appel RPC, tester **le retour** autant que `error`. Une fonction SQL peut répondre `{error: "..."}` sans lever d'exception — le code passe alors dans la branche de succès et l'écran ment.

---

## Ce qui a été livré

### La séance d'essai — refondue

Elle était écrite dans `trial_sessions`, une table que ni « Mes réservations », ni l'accueil, **ni la liste de présence du coach** ne consultaient. Des personnes étaient attendues sans que personne ne le sache.

L'essai est désormais un **vrai pack** : gratuit, hors catalogue (`is_purchasable = FALSE`), attribué automatiquement à la création du profil. Il produit une réservation ordinaire, donc visible partout sans qu'aucun écran soit modifié. `trial_sessions` est supprimée.

Réglages : semi-privé uniquement, 30 jours configurables, nouveaux profils seulement.

### Communications sur l'accueil

L'audit a montré que **6 e-mails sur 14 ne laissaient aucune trace** dans l'application. Un bloc en tête d'accueil rassemble désormais tout : séance d'essai en avant, puis les communications, lu/non lu distingués, écartables à l'unité.

Nouveau helper `notifyMember` : **la notification part toujours, l'e-mail n'est qu'un rappel**. C'est l'inverse de l'ordre précédent — d'où les six oublis. `email_on_self_booking` ne coupe plus que l'e-mail.

> Écarter n'est **pas** supprimer : `dismissed_at` retire la ligne de l'écran du membre mais la conserve. En cas de contestation, elle prouve que l'information a été transmise.

### Deux e-mails critiques ajoutés

- **« Place disponible »** — l'offre expire en 2 h et n'existait qu'in-app
- **« Paiement refusé »** — le membre pouvait perdre son abonnement sans le savoir

L'offre de place naît dans une fonction SQL, qui ne peut pas appeler d'Edge Function. D'où une file `email_queue` : la fonction dépose, l'application envoie (à l'ouverture de l'accueil et après une annulation). Le passage par une table rend l'envoi **ré-essayable**.

### Abonnements — renouvellement éprouvé au *test clock*

Le renouvellement fonctionne. Le test a révélé deux défauts, tous deux corrigés :

1. **Le webhook rejetait tout depuis une heure** (401) — le `--no-verify-jwt` avait été perdu à un redéploiement. Entre 11 h et midi, tout paiement aurait été encaissé sans rien créditer.
2. **Les crédits d'un renouvellement expiraient avant leur propre cycle** — `expires_at` était calculé depuis l'heure du serveur, pas depuis la période facturée.

### Performances — étapes 1 et 2

Le coach demandait des graphiques. L'obstacle n'était pas technique (Recharts était déjà là) mais dans les données : le champ était libre, on y trouvait `1:55`, `50 kg`, `22,5` mélangés — **2 valeurs sur 57 exploitables**.

Chaque mouvement porte maintenant sa **nature** (charge, temps, répétitions, distance) et son **sens de progrès**. La saisie est contrainte : deux champs min/sec pour un chrono, un champ chiffré pour une charge.

Les courbes suivent : historique complet, record marqué, progression en clair (« +25 kg depuis mars »), **axe inversé sur un chrono** pour que « ça monte » veuille toujours dire « je progresse ».

### Avis sur les cours

Une note de 1 à 5 étoiles et un commentaire, après une séance suivie.

La question « qui peut noter quoi » se règle en base : l'avis s'attache à une **réservation**, pas à un cours. Il faut donc avoir été inscrit, la réservation doit être confirmée, le cours terminé. Une séance, un avis.

**Anonyme pour le coach, nominatif pour l'admin.** Un membre qui reverra son coach mardi ne note pas honnêtement s'il sait être identifié ; mais un avis intraçable n'engage personne.

La demande apparaît dans le bloc communications de l'accueil et **disparaît d'elle-même** passé le délai fixé dans les Réglages (7 jours par défaut, désactivable).

### Suppression de compte

Exigée par Apple depuis 2022, et par le RGPD. Deux versions : le membre depuis son profil, le studio depuis la fiche membre.

> **On anonymise, on n'efface pas.** Le droit comptable belge impose sept ans de conservation des pièces justificatives. La personne disparaît — nom, coordonnées, santé, performances — la comptabilité reste, détachée de toute identité.

Un abonnement actif **bloque** la fermeture : sans compte, le membre ne pourrait plus le résilier et continuerait d'être prélevé.

### Clients professionnels — paiement sur facture

Une entreprise ne paie pas par carte : elle commande, reçoit une facture, et règle selon ses délais. **Le pack est crédité immédiatement** — l'employé doit pouvoir s'entraîner sans attendre le circuit comptable de son employeur.

C'est un paiement à terme : le studio porte le risque d'impayé. Décision assumée, aucun automatisme de relance ou de suspension.

**Seul un admin qualifie un profil en B2B**, depuis l'onglet Packs de la fiche membre. Le contrôle est côté serveur : `order_pack_on_invoice` refuse un profil non qualifié — sans quoi n'importe qui obtiendrait des séances gratuitement.

Les abonnements sont masqués pour un B2B (un prélèvement automatique n'a pas de sens sur facture), et le filtre suit `is_business` plutôt qu'une catégorie dédiée : deux marqueurs pour le même fait finiraient par diverger.

Écran de suivi : filtres payée / à encaisser, montant, signalement au-delà de trente jours, numéro et date de facture saisissables **à tout moment**.

### Mentions légales, coupons, types de cours

**Les coordonnées du studio** se saisissent dans les Réglages et alimentent les CGV et la politique de confidentialité par des repères `{{studio_address}}`. Un champ vide affiche « (à compléter dans les Réglages) », et l'écran liste ce qui manque.

**Les coupons sont enfin utilisables.** Le champ de saisie n'existait nulle part — signalé depuis le 6 août. Il vit dans la confirmation d'achat, donc jamais chez un B2B qui règle sur facture. Le code est vérifié avant le paiement, avec la remise annoncée et la raison d'un refus nommée. Restriction par catégorie ajoutée.

**Types de cours** : l'édition existait, les garde-fous manquaient. Seul le **type de crédit** est verrouillé — le changer rendrait incompatibles les packs ayant payé les réservations. Verrou en base par trigger, dès qu'un cours est planifié. Titre, description, image restent librement modifiables.

**Communications** : une coche pour marquer lu sans ouvrir, un filtre « Tout / Non lues », et « Tout marquer lu ».

### Le reste

- **Conditions générales** — page publique `/cgv`, fichier `public/cgv.md` éditable sans développeur. **L'article 1 (assurance) est rédigé et applicable** : la séance d'essai n'est pas couverte, seuls les frais d'inscription déclenchent la couverture.
- **Réseaux sociaux** — 7 liens configurables dans les Réglages, affichés sur les deux accueils
- **Planning** — bouton « Aujourd'hui », passé masqué aux clients, crédits restants visibles
- **Mes réservations** — liste chronologique, pack rappelé sur chaque ligne
- **Mes packs** — seuls les utilisables par défaut
- **Inscription** — écran de confirmation qui reste affiché, au lieu d'un message fugace
- **Page Aide** — sommaire cliquable
- **Pied de page** — « Christian Vanhenten pour Back on Track », vraie version affichée

---

## Décisions prises

- **Les deux vues du planning restent** — les coachs se contredisaient
- **Règle de parrainage inchangée** — le premier paiement qualifie
- **Toute migration se reporte dans `install.sql` au même commit** — plus de rattrapage différé
- **Pas d'alerte sur les avis négatifs** pour l'instant
- **Pas de verrouillage de la bascule B2B** : passer de l'un à l'autre ne casse rien — packs valides, factures dues, seul le mode de paiement des futures commandes change. Un avertissement signale les factures ouvertes, sans bloquer une correction légitime.
- **Compte Apple Developer au nom propre de Christian** (99 $/an). L'ASBL conviendrait pour une future application Atelier PNL, pas pour Back On Track : publier pour un tiers commercial sort de son objet social.

---

## À faire ensuite

**Sans décision en attente :**

1. **Case notifications à l'inscription** — à clarifier : les notifications in-app servent de trace, c'est l'e-mail qui se refuse
2. **Performances étape 3** — paliers (« Club 100 séances ») et régularité. Les fonctions SQL existent déjà, inutilisées
3. **Écran admin des avis** — moyenne par coach et par type de cours, à cadrer : afficher un classement des coachs change la nature de l'outil

**En attente des coachs :**

- Capture d'écran pour « pack id required » (le code déployé est identique au dépôt)
- Descriptions des cours, liens externes souhaités
- Quels paliers de séances, comment un streak survit aux vacances
- Cadrage du feedback après cours

**Le gros morceau** : accueil éditable — blocs de cours et liens externes composés par le studio.

---

## Vigilance

- **La clé `sk_test_` est à faire tourner** — elle a transité en clair deux fois (5 et 7 août)
- **Le site déployé date d'hier** : les coachs testent l'ancienne version, d'où plusieurs remarques sur des points déjà corrigés
- **`--no-verify-jwt` à redonner à chaque déploiement du webhook**, puis vérifier avec `supabase functions list`
- **Les coordonnées légales du studio sont vides** (adresse, BCE, TVA) — obligatoires dans les CGV avant production
- **Relecture juridique des CGV recommandée** avant mise en vente
- **L'app iPhone signée en développement expire après 7 jours**

---

## Décisions bloquantes avant production

1. **Grille tarifaire** — rien ne peut être vendu sans
2. **Migration des clients actuels** — sort des crédits en cours
3. **Bancontact en récurrent** — toujours non vérifié chez Stripe
4. **13 prélèvements par an** sur un cycle de 4 semaines

---

## Publication sur l'App Store — prérequis

Décision du 2026-08-07 : Christian prend le **compte Apple Developer à son nom propre** (99 $/an, activation 24-48 h, pas de numéro D-U-N-S à obtenir). Il couvrira aussi une éventuelle application Atelier PNL.

### La commission de 30 % ne s'applique pas à Back On Track

Règle **3.1.3(e)** — biens et services physiques. Un cours de sport se consomme au studio, pas dans l'application : les packs, abonnements et frais d'inscription restent vendus par Stripe, sans commission Apple. Les studios de sport sont l'exemple type de cette exception.

> À écrire dans les « Notes pour la revue » au moment de la soumission : l'application sert à réserver des séances **en présentiel** à telle adresse, les achats donnent accès à un service physique. Cela évite un aller-retour avec le relecteur.

**Ce qui basculerait dans la commission** : du contenu consommé dans l'application — vidéos d'entraînement, programmes numériques, cours en ligne.

### Deux prérequis bloquants, à traiter avant toute soumission

1. **Suppression de compte depuis l'application** — obligatoire depuis 2022, **motif de rejet automatique**. Non implémenté (phase 13 RGPD, non entamée). Compter une demi-journée : bouton dans le profil, confirmation, fonction serveur qui **anonymise** plutôt que d'effacer — les données comptables doivent être conservées.
2. **Politique de confidentialité avec URL publique** — la case RGPD existe à l'inscription, mais aucun document derrière. Même situation que les CGV avant aujourd'hui : créer `public/politique-confidentialite.md` sur le modèle de `cgv.md`, avec une page publique.

### Pour une future application Atelier PNL

Cas différent : des ressources consultées **dans** l'application sont du contenu numérique, donc soumises à la commission Apple. Trois éléments à garder en tête :

- Le taux réel serait de **15 %**, pas 30 %, via le *Small Business Program* (sous un million de dollars annuels, inscription sur demande).
- Les **cours en présentiel restent exemptés** même dans cette application : c'est la nature de ce qui est vendu qui décide, pas l'application.
- **Modèle « lecteur »** possible : ne rien vendre dans l'application, seulement donner accès à ce qui a été acheté ailleurs. Aucun prix affiché, aucun lien de paiement. Contraignant mais légitime et répandu (Spotify, Netflix).

---

## Facturation — la suite attendue

Le socle B2B est posé : qualification, commande sur facture, suivi des encaissements.

> **Cadrage à ne pas perdre : la facture se crée dans Odoo, pas ici.** L'application enregistre la commande, crédite le pack, et garde trace du numéro et de la date qu'Odoo attribue. Elle ne calcule aucun numéro et ne génère aucun document.

### Le prochain chantier : l'export vers Odoo

C'est le besoin réel, et le seul engagé.

Sélectionner des factures dans l'écran de suivi et produire un fichier **Excel ou CSV** au format d'import d'Odoo — qui créera les factures de son côté.

**Christian fournira la structure exacte** : colonnes, format des dates, codes comptables, gestion de la TVA. Rien ne peut être écrit avant de l'avoir — deviner un format d'import comptable ne mène nulle part.

Ce qui est déjà en place et servira :

- `invoice_requests` porte le montant, la société, la TVA, l'adresse, le pack commandé
- `invoice_number` et `invoice_date` sont saisissables et le numéro porte un index unique
- Le filtre payée / à encaisser permet de choisir ce qu'on exporte

Ce qu'il faudra ajouter : une sélection multiple dans l'écran, et un marqueur « exporté » pour ne pas envoyer deux fois la même ligne.

### Hypothèse, à garder en suspens

Émettre les factures depuis l'application — avec numérotation propre, PDF et QR code de paiement européen — **est possible mais n'est pas décidé**. Cela supposerait une plage de numéros réservée à l'application et une séquence sans trou.

Christian le mentionne comme une piste, pas comme un objectif. **Ne pas engager ce travail sans une demande explicite.**

### Ce qui reste ouvert

- Aucun outil de relance : les impayés se suivent à l'œil dans l'écran des factures
- Pas de facturation récurrente B2B — un abonnement se prélève automatiquement, ce qui n'a pas de sens sur facture. Pour un engagement long, créer un pack de longue validité plutôt qu'un échéancier
- **Rien ne distingue en base un pack payé d'un pack facturé impayé** : le suivi vit dans `invoice_requests`, pas dans `pack_purchases`
- Les **coordonnées légales du studio** (adresse, BCE, TVA, contact) sont toujours vides dans les Réglages : elles bloquent les CGV, la politique de confidentialité et toute facturation

---

## Documents de référence

- `docs/journal-projet.md` — état des lieux complet
- `docs/documentation-technique.md` — architecture, pièges, procédure *test clock*
- `supabase/check-policies.sql` et `check-schema.sql` — audits, à jour
- `public/cgv.md` — conditions générales, à compléter

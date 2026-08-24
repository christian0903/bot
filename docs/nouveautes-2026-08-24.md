# Ce qui a changé — 24 août 2026

Version **3.12**. Voici ce qui bouge pour vous, sans jargon.

---

## S'inscrire : plus de message contradictoire

Si vous vous inscriviez avec une adresse e-mail **déjà utilisée**, l'écran
disait deux choses à la fois : « Un e-mail vient d'être envoyé » **et**, plus
bas, « Tu as déjà un compte ». Le premier message était faux — aucun e-mail ne
partait — et la personne attendait indéfiniment.

Maintenant l'écran est clair : il propose directement **Me connecter**, et ne
promet plus d'envoi qui n'aura pas lieu.

**Aussi :** si vous n'avez jamais reçu votre e-mail de confirmation, vous pouvez
désormais en **redemander un** depuis l'écran d'inscription. Avant, il n'y avait
aucun moyen — il fallait recommencer.

---

## L'application s'installe vraiment sur l'iPhone

L'installation sur l'écran d'accueil fonctionne maintenant correctement, avec
une icône propre. Un guide pas-à-pas existe si vous voulez l'installer sur votre
téléphone.

Et le **numéro de version** est affiché en haut à gauche, à côté du nom : c'est
le premier renseignement utile quand vous signalez un problème.

---

## Le planning sépare enfin semi-privé et Personal Training

Sur l'écran de réservation, un choix en haut permet de basculer entre
**Semi-privé** et **Personal Training** — comme sur la page d'achat de packs.
Vous ne voyez que les cours du type choisi, et les crédits correspondants.

---

## Notifications lisibles sur iPhone

Les messages du type « Connexion réussie » apparaissaient **sous l'encoche** de
l'iPhone : impossible de les lire. Ils sont descendus.

---

## Vous avez plusieurs casquettes ? Choisissez-la

En haut à droite de l'écran, un nouveau bouton : **Membre · Coach · Admin**.

Il n'apparaît que si vous avez plusieurs rôles. Il ne change aucun droit — il
change juste ce que l'application vous montre.

**À quoi ça sert :** jusqu'ici, si vous étiez coach ou administrateur, vous ne
pouviez plus atteindre vos *propres* réservations, vos packs ou la boutique.
L'application supposait que le staff ne s'entraîne pas au studio. Passez en mode
**Membre** et vous retrouvez l'application telle qu'un client la voit.

**Surtout utile sur téléphone**, où la barre du bas ne tient que quatre boutons :
elle suit maintenant le mode choisi.

---

## Le planning se lit comme un calendrier

Dans **Gestion du planning**, un nouveau bouton en haut à droite : **Liste** ou
**Calendrier**.

La vue calendrier montre la semaine d'un coup d'œil — les jours en colonnes, les
heures en lignes. Chaque cours est une carte colorée avec l'horaire, le nom, le
coach et le nombre d'inscrits : **vert** tant qu'il reste des places, **rouge**
quand c'est complet.

Deux gestes :

- **Clic sur un cours** → sa fiche, pour pointer les présences
- **Clic sur une case vide** → créer un cours à ce jour et à cette heure, déjà
  remplis dans le formulaire

Sur téléphone, la grille montre une seule journée à la fois — sept colonnes ne
se lisent pas sur un petit écran.

---

## Présent et absent ne peuvent plus être cochés ensemble

Sur la fiche d'un cours, cliquer **Présent** éteint désormais **Absent**, et
inversement. Avant, les deux pouvaient rester allumés en même temps, et la
personne était comptée deux fois.

Et si vous marquez quelqu'un absent par erreur, vous pouvez maintenant le
repasser en présent d'un clic — ce n'était plus possible avant.

---

## Vos statistiques ne bloquent plus la liste de vos cours

Dans **Mes cours**, le bloc « Mes 30 derniers jours » est maintenant **replié
par défaut**. Vous voyez directement vos cours en haut de l'écran, ce qui compte
quand vous ouvrez l'application juste avant une séance.

Un clic sur le titre rouvre vos chiffres — et l'application s'en souvient.

---

## Gestion du planning arrive en deuxième dans le menu

Dans le menu d'administration, **Gestion du planning** passe juste après
**Utilisateurs**. C'est l'écran le plus ouvert de la journée ; il était perdu en
huitième position, au milieu de réglages qu'on touche une fois par saison.

---

## Un pack payé en espèces ne se confond plus avec un cadeau

*(Pour ceux qui attribuent des packs à la main.)*

Quand vous attribuez un pack, vous choisissez maintenant **explicitement** :

| | Prix | Compté en recettes |
|---|---|---|
| **Cadeau / offert** | 0 € | non |
| **Espèces** | tarif plein | **oui** |
| **Virement** | tarif plein | **oui** |

Espèces et Virement ouvrent une **fenêtre de confirmation** qui rappelle le
montant : « vous déclarez avoir reçu 139 € ». C'est volontaire — l'erreur
classique est d'offrir un pack et de cliquer machinalement sur un encaissement,
créant une recette que personne n'a jamais encaissée.

Ces encaissements ressortent ensuite **sur fond orange dans le journal**, avec
le montant : ce sont les seuls qu'aucun relevé bancaire ne recoupe
automatiquement, ils doivent se repérer d'un coup d'œil pour la comptabilité.

---

## Côté administration, aussi

*(Pour ceux qui gèrent les membres et les packs.)*

- **Un pack peut attribuer une catégorie** à l'achat, et la reprendre à
  l'expiration — c'est ce qui ouvre à un abonné l'accès aux cours qui lui sont
  réservés.
- **La catégorie d'un membre est visible dans la liste**, sans ouvrir sa fiche.
  Elle s'affiche aussi sur iPhone en portrait, où elle était invisible.
- **Ranger plusieurs membres d'un coup** : sélection multiple pour attribuer une
  catégorie à toute une série.
- **Les tentatives d'inscription apparaissent au journal**, et un compte
  parasite — sans aucune réservation ni pack — peut être effacé depuis là.
- **Types de packs** : trois statuts (actif, inactif, corbeille), la suppression
  réservée au super-admin, et une explication claire quand elle est refusée.
- **Abonnements** en semaines ou en mois (les jours ont disparu), l'annuel
  confirmé possible.
- **Filtres du planning** rendus lisibles, et les conflits d'horaire annoncés
  avant d'enregistrer.
- **Le paiement Stripe** s'ouvre maintenant correctement depuis un navigateur.

---

## L'application se charge plus vite

Le premier chargement est allégé d'environ **13 %**. Rien à faire de votre côté,
c'est simplement plus rapide, en particulier sur une connexion mobile.

---

## Les mises à jour s'installeront mieux

Certains téléphones restaient bloqués sur une ancienne version, même en cliquant
« Recharger » sur le bandeau de mise à jour : le bouton n'avait aucun effet et le
bandeau revenait sans fin. C'est corrigé.

> **Si votre application affiche encore une vieille version**, cette correction
> ne peut pas vous atteindre — il faudrait que la mise à jour fonctionne, ce
> qu'elle ne fait justement plus. Une seule fois, faites :
> **Réglages → Safari → Effacer historique et données**, puis rouvrez
> l'application. Vous devrez vous reconnecter. Ensuite tout rentrera dans l'ordre.

---

*Une question, un comportement bizarre ? Signalez-le — le numéro de version est
affiché en haut à gauche, à côté du nom, et il aide beaucoup à comprendre.*

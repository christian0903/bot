# Reprendre les clients existants — c'est possible

> Note pour les coachs, une page. Elle dit ce qu'on peut faire des cent clients
> actuels et de leurs crédits en cours, si vous voulez éviter de tout ressaisir.

---

## Le problème

Vous avez une centaine de clients. Chacun a un solde de séances différent, une
date de validité différente, et parfois deux soldes — un en semi-privé, un en
personal training.

Les ressaisir un par un dans la nouvelle application prendrait plusieurs
heures, avec le risque d'erreurs que cela comporte.

---

## Ce qu'on peut faire à la place

**Vous préparez un tableur. On s'occupe du reste.**

Une ligne par client, avec ces colonnes :

| Adresse e-mail | Prénom | Nom | Séances semi-privé | Valable jusqu'au | Séances PT | Valable jusqu'au |
|---|---|---|---|---|---|---|
| marie@exemple.be | Marie | Dupont | 8 | 31/12/2026 | | |
| jean@exemple.be | Jean | Martin | 3 | 15/10/2026 | 5 | 30/11/2026 |

Les cases vides ne posent aucun problème : quelqu'un qui n'a que du
semi-privé laisse les colonnes PT vides.

Si votre ancien système sait exporter un fichier de ce genre, tant mieux — on
s'adaptera à ce qu'il produit plutôt que l'inverse.

---

## Ce qui se passe ensuite

L'application lit le fichier et fait deux choses :

1. **Elle crée un compte** pour chaque client — avec son nom et son adresse ;
2. **Elle lui attribue ses séances**, avec la bonne date de validité.

Avant d'écrire quoi que ce soit, elle affiche ce qu'elle a compris : combien de
clients, combien de séances au total, et surtout **ce qui cloche** — une
adresse en double, une case mal remplie. Vous corrigez le tableur et vous
recommencez, autant de fois qu'il faut.

Rien n'est écrit tant que vous n'avez pas dit d'y aller.

---

## Ce qu'il restera à faire

**Les clients devront choisir leur mot de passe.** On leur enverra un message
avec un lien — le même que celui du « mot de passe oublié ». Leur compte
existera déjà, ils n'auront rien à créer.

**Certaines informations resteront vides** : téléphone, adresse, date de
naissance. Chacun les complétera lui-même dans son profil, ou vous le ferez au
fil des passages.

---

## Faut-il le faire ?

Pas forcément. L'autre voie est de **demander à chacun de s'inscrire** sur la
nouvelle application, puis de lui attribuer ses séances restantes à la main.
C'est plus long pour vous, mais chacun accepte les conditions et vérifie ses
propres coordonnées.

**Notre avis** : à cent clients, l'import fait gagner du temps. En dessous de
trente, la saisie à la main est plus simple.

Dites-nous si le tableur existe, et on regardera ensemble ce qu'il contient.

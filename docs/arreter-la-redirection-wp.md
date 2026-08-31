# Arrêter la redirection de `wp.` vers la vitrine

> Écrit le 2026-08-31. **La version courte** : deux lignes à ajouter dans un
> fichier, et la redirection s'arrête. La procédure complète (avec la
> réécriture de la base) est dans `wordpress-sur-sous-domaine.md` — elle n'est
> **pas** nécessaire pour arrêter la redirection.

## Pourquoi ça redirige

WordPress garde son adresse **écrite dans sa base de données**. Il y lit
`https://backontrackstudio.be` et y renvoie tout visiteur, quelle que soit
l'adresse par laquelle il est arrivé.

Ce n'est donc pas une redirection à désactiver quelque part : c'est WordPress
qui se croit encore à son ancienne adresse. Il faut lui dire la nouvelle.

**Deux lignes dans `wp-config.php` suffisent.** Elles prennent le pas sur ce qui
est écrit en base, sans le modifier — donc sans aucun risque pour la base.

---

## La manipulation

Ouvrir, dans le **gestionnaire de fichiers de cPanel** :

```
wp.backontrackstudio.be / wp-config.php
```

Y ajouter ces deux lignes. **Important : tout en haut du fichier**, juste après
la toute première ligne `<?php` :

```php
define( 'WP_HOME',    'https://wp.backontrackstudio.be' );
define( 'WP_SITEURL', 'https://wp.backontrackstudio.be' );
```

Enregistrer. **C'est tout** — l'effet est immédiat, il n'y a rien à redémarrer.

> **Où exactement ?** Le fichier commence par `<?php`. Les deux lignes se
> placent juste en dessous. Ce qui compte, c'est qu'elles soient **avant** la
> ligne qui contient `wp-settings.php`, tout en bas du fichier.

### Si ces lignes existent déjà

Elles portent alors l'ancienne adresse. Il suffit de **remplacer** cette
adresse par `https://wp.backontrackstudio.be`, sans ajouter de lignes en double.

---

## Vérifier

Ouvrir `https://wp.backontrackstudio.be` dans un navigateur.

L'ancien site doit s'afficher **sans partir vers la vitrine**.

---

## Les deux défauts qui vont rester, et ce qu'ils veulent dire

### 1. L'alerte rouge « Connexion non privée »

**Constaté le 2026-08-31** : le certificat du sous-domaine est **auto-signé** —
celui que le serveur pose par défaut, que les navigateurs refusent.

C'est **sans rapport avec la redirection**, et sans gravité pour une relecture
interne : on peut passer outre en cliquant « Paramètres avancés » puis
« Continuer vers le site ».

Pour le corriger proprement, dans **cPanel → SSL/TLS Status** : cocher
`wp.backontrackstudio.be` et lancer **Run AutoSSL**. Le vrai certificat arrive
en quelques minutes. Si AutoSSL échoue, c'est en général que le sous-domaine
vient d'être créé — il suffit de réessayer un peu plus tard.

### 2. Des images manquantes et des liens qui ramènent à la vitrine

Les pages s'affichent, mais **certaines images ne se chargent pas** et certains
liens internes ramènent vers `backontrackstudio.be`.

C'est normal, et c'est la limite de ce raccourci : les deux lignes corrigent
l'adresse **du site**, mais chaque image et chaque lien a sa propre adresse
écrite en base — **32 755 au total**.

**Pour une relecture par les coachs, c'est en général suffisant** : la
présentation, les textes et la mise en page sont là, c'est ce qu'ils viennent
juger.

Si les images manquantes gênent vraiment, la réécriture complète est décrite
dans `wordpress-sur-sous-domaine.md`. Elle est plus longue et touche la base,
d'où l'intérêt d'essayer d'abord ce raccourci.

---

## Revenir en arrière

Supprimer les deux lignes. WordPress reprend l'adresse écrite en base, et la
redirection revient.

C'est tout l'intérêt de cette méthode : **la base n'est jamais modifiée**.

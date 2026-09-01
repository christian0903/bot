# Un visiteur reçoit une erreur 403 — par où chercher

> Écrit le 2026-08-31, après qu'un 403 a été signalé sur Firefox depuis un PC
> tiers, alors qu'`aikicom.eu` fonctionnait depuis le même poste.

## Ce qui a été vérifié, et qui est sain

Tout mesuré depuis le Mac mini le 2026-08-31 à 16h36 :

| Adresse | Réponse |
|---|---|
| `backontrackstudio.be` | **200** |
| `app.backontrackstudio.be` | **200** |
| `aikicom.eu` | **200** |
| `/cours`, `/cours-2`, `/tarifs`, `/contact`, `/planning` | **200** |
| les fichiers construits (`/assets/index-….js`) | **200** |

Les mêmes requêtes en se faisant passer pour Firefox sur Windows : **200
partout**. Le certificat couvre bien `backontrackstudio.be`, `www.` et `mail.`.

**Le site n'est donc pas en cause**, et le blocage est propre au poste ou au
réseau de ce visiteur.

## Les deux seuls 403 du site sont volontaires

```
/assets/    403
/vitrine/   403
```

C'est `Options -Indexes` : sans lui, ces adresses afficheraient l'inventaire
complet des fichiers. **Un visiteur n'y va jamais** — ce sont des dossiers de
ressources, pas des pages.

## Ce qui a été écarté

**Le pare-feu d'o2switch (Imunify360) qui bloquerait l'IP du visiteur.**
C'était la piste la plus probable, mais `aikicom.eu` est sur le même compte et
répondait normalement depuis ce poste : un blocage d'IP les aurait bloqués tous
les deux.

**Une IP différente.** `backontrackstudio.be` résout vers `185.154.136.222`
quand `app.` et `aikicom.eu` sont sur `109.234.165.117`. Les deux adresses
servent pourtant exactement le même fichier construit — c'est une répartition
interne d'o2switch, pas deux sites différents.

## Diagnostic établi : un proxy sur le réseau du visiteur

**Edge et Firefox demandent tous deux « de se connecter à un proxy ».** Deux
navigateurs indépendants réclamant la même chose, ce n'est ni l'un ni l'autre :
c'est le **réseau** de ce poste qui impose un serveur intermédiaire, et ce
proxy refuse ces domaines.

Ce que cela veut dire concrètement : la requête ne quitte jamais le réseau
local. Elle n'atteint pas o2switch, et rien de ce qui serait modifié sur le
serveur n'y changerait quoi que ce soit.

### Ce qui a été écarté par la mesure

**Un filtre public de réputation.** Les deux domaines résolvent normalement
via le DNS filtrant grand public de Cloudflare (1.1.1.3, famille) : ils ne sont
classés dangereux nulle part.

**Une IP suspecte.** `backontrackstudio.be` est seul sur `185.154.136.222`
tandis que `app.`, `wp.` et `aikicom.eu` partagent `109.234.165.117` — mais
`app.` était bloqué lui aussi, alors qu'il est sur la même adresse
qu'`aikicom.eu` qui passait. **C'est donc le nom de domaine qui est filtré, pas
l'adresse.**

**Un domaine trop récent.** `backontrackstudio.be` est enregistré depuis le
21 août 2024.

### Pourquoi `aikicom.eu` passe et pas les autres

Un proxy d'entreprise classe les sites par catégorie. `aikicom.eu` est
probablement déjà catégorisé — il existe depuis plus longtemps et a du trafic.
Un domaine qu'il ne connaît pas tombe souvent dans « non catégorisé », que
beaucoup de configurations bloquent par défaut.

C'est une hypothèse, invérifiable de l'extérieur : seul l'administrateur de ce
réseau peut lire la raison du refus dans ses journaux.

### Ce qu'il y a à faire

**Rien côté site.** Il n'y a aucune correction à apporter : le site répond 200
partout ailleurs.

Trois issues, selon le besoin :

- **Montrer le site à cette personne** : passer par un autre réseau — le
  partage de connexion d'un téléphone suffit et règle la question en dix
  secondes.
- **Si ce poste doit y accéder durablement** (un coach au travail, par
  exemple) : demander à l'administrateur du réseau d'autoriser
  `backontrackstudio.be` et `app.backontrackstudio.be`.
- **Si c'est un poste personnel** : vérifier les réglages proxy de Windows
  (Paramètres → Réseau → Proxy). Un proxy configuré à tort, souvent laissé par
  un ancien VPN ou un logiciel désinstallé, produit exactement ce symptôme.

> **Ce que cela ne dit pas.** Rien n'indique que d'autres visiteurs soient
> touchés. Le site répond normalement depuis l'extérieur, et ce cas concerne un
> réseau particulier.

## Ce qu'il reste à demander à la personne

Le diagnostic s'arrête là sans **le texte exact de l'écran**. Deux familles
d'erreur, deux remèdes sans rapport :

**Une page du serveur** — fond blanc, texte anglais « Forbidden », parfois un
logo o2switch ou Imunify360. C'est le serveur qui refuse. Remède : cPanel →
Imunify360 → retirer l'IP de la liste des bloquées. (Peu probable ici, vu
qu'`aikicom.eu` passait.)

**Une page du navigateur ou d'un logiciel du poste** — mise en page Firefox,
ou nom d'un antivirus / d'un filtrage d'entreprise. Le blocage est local :
proxy d'entreprise, extension de sécurité, DNS filtrant. Le site n'y peut rien.

### Trois questions qui tranchent

1. **Une capture de l'écran d'erreur**, ou son texte exact.
2. **Un autre réseau** — le même PC via le partage de connexion d'un téléphone.
   Si ça passe, c'est le réseau ; si ça bloque encore, c'est le poste.
3. **Un autre navigateur sur ce PC.** Si Chrome passe et Firefox non, c'est une
   extension ou un réglage de Firefox.

## Si le besoin est juste de leur montrer le site

Ne pas laisser cette personne bloquée pendant l'enquête : le site s'ouvre
depuis n'importe quel autre appareil, et une capture d'écran suffit souvent
pour un avis.

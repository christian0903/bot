# La documentation du projet — par où entrer

Seize documents, dont certains font autorité et d'autres sont des traces
d'étapes passées. Cette page dit lesquels.

## Les quatre à jour

| Document | Ce qu'il porte | Pour qui |
|---|---|---|
| **[journal-projet.md](journal-projet.md)** | Où en est le projet, ce qui a été décidé et pourquoi, ce qui reste | **À lire en premier à chaque reprise** |
| **[documentation-technique.md](documentation-technique.md)** | Comment ça marche, et les pièges qui ont déjà coûté cher | Développeur, super admin |
| **[guide-admin.md](guide-admin.md)** | Ce que voit et fait le staff — coach compris | Coach, admin |
| **[guide-membre.md](guide-membre.md)** | Ce que voit et fait un membre | Membre |

Les deux guides sont **servis par la page d'aide de l'application**, mais depuis
`public/` — voir l'avertissement en fin de page.

## Les documents de référence, toujours valables

| Document | Ce qu'il porte |
|---|---|
| [guide-installation.md](guide-installation.md) | Installer une base neuve, importer des données, déployer |
| [strategie-base-neuve.md](strategie-base-neuve.md) | Passer d'une base de test à une base de production, dans quel ordre et avec quel filet |
| [creer-base-operationnelle.md](creer-base-operationnelle.md) | **Marche à suivre guidée, étape par étape**, pour créer une base de zéro — à copier au début d'une conversation Claude |
| [adapter-le-style.md](adapter-le-style.md) | Changer le logo (sans recompiler) et les couleurs de l'application |
| [stripe-deploiement.md](stripe-deploiement.md) | Configurer Stripe, les clés, le webhook |
| [cadrage-bons-achat.md](cadrage-bons-achat.md) | Les règles réelles des bons d'achat et du parrainage |
| [dossier-fonctionnel-abonnement.md](dossier-fonctionnel-abonnement.md) | Le besoin recueilli auprès des coachs sur les abonnements |
| [charger-demo-data.md](charger-demo-data.md) | Charger un jeu de données de démonstration |
| [vault-import/](vault-import/) | Neuf documents rapatriés du vault Obsidian, dont les **règles de réservation validées avec les coachs** |

## Les traces d'étapes passées — à ne pas prendre pour des références

| Document | Pourquoi s'en méfier |
|---|---|
| [plan-implementation-v2.md](plan-implementation-v2.md) | Avril 2026. **Prévoit Mollie**, abandonné le 2026-08-03 au profit de Stripe |
| [description-fonctionnelle-v2.md](description-fonctionnelle-v2.md) | Avril 2026. Même réserve |
| [regles-coupons-parrainage.md](regles-coupons-parrainage.md) | Brouillon envoyé aux coachs. Décrit des règles **jamais implémentées ainsi** |
| [questionnaire-abonnement.md](questionnaire-abonnement.md), [systeme abonnement.md](systeme%20abonnement.md), [grille-analyse-abonnement.md](grille-analyse-abonnement.md), [consigne-enregistrement-gauthier.md](consigne-enregistrement-gauthier.md) | Matériel du recueil du besoin de juin 2026. Phase close — les deux premiers font largement doublon |

Chacun porte un avertissement en tête. Ils sont conservés parce qu'ils
expliquent **pourquoi** certaines décisions ont été prises — pas ce que
l'application fait aujourd'hui.

---

## ⚠️ Modifier un guide ne suffit pas

Les guides membre et administrateur vivent à **deux endroits** :

| Fichier | Rôle |
|---|---|
| `docs/guide-admin.md`, `docs/guide-membre.md` | La version qu'on édite |
| `public/guide-admin.md`, `public/guide-utilisateur.md` | **Ce que la page d'aide affiche réellement** |

Noter le renommage : `guide-membre` devient `guide-utilisateur` dans `public/`.

**Après toute modification :**

```bash
cp docs/guide-admin.md   public/guide-admin.md
cp docs/guide-membre.md  public/guide-utilisateur.md
npm run build
```

Sans cette copie, la modification est **invisible pour l'utilisateur**. Deux
journées de documentation avaient ainsi disparu, constaté le 2026-08-09.

**Les versions anglaises** (`public/guide-admin-en.md`,
`public/guide-utilisateur-en.md`) sont traduites à la main et **accusent un
retard important** : 15 Ko contre 41 en français côté admin. Elles ignorent le
suivi clients, la séance d'essai, la suppression de compte et les exports.
Décision du 2026-08-23 : mise à niveau reportée, le studio étant francophone.

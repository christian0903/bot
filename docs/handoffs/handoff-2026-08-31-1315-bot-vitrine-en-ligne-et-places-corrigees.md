---
type: handoff
projet:
domaine:
session-machine: mac-mini
session-date: 2026-08-31
session-heure: "13:15"
auteur: "[[@Christian Vanhenten]]"
statut: archive
created: 2026-08-31
tags:
  - claude/handoff
  - bot
  - vitrine
  - production
---

# Handoff — La vitrine remplace WordPress, et un cours complet ne ment plus

> **v3.94.0**, six commits locaux (`eaa7bc9` → `8574601`), **rien n'est poussé**.
> Build vert, arbre propre. Lint à **37** — voir « Ce qui cloche encore ».

---

## Où on en est

| Domaine | Sert | Version |
|---|---|---|
| `backontrackstudio.be` | **la nouvelle vitrine**, indexable | 3.94.0 |
| `app.` | l'application (bot-ops) | 3.94.0 |
| `jag.` | test (bot3) | 3.92.0 |
| `site.` | démonstration, encore en place | 3.92.0 |

Le WordPress est **écarté, pas supprimé** : `~/wordpress-archive-20260831`,
intact avec son `wp-config.php`. Deux commandes le remettent en place :

```bash
mv ~/backontrackstudio.be ~/vitrine-nouvelle
mv ~/wordpress-archive-20260831 ~/backontrackstudio.be
```

À garder deux ou trois semaines, puis supprimer (7,2 Go récupérés).

---

## Ce qui a été livré

**Le site vitrine**, en page unique construite avec l'application.
`VITE_VITRINE` décide de ce que sert la racine ; le même `dist/` part sur les
deux domaines. Surcoût pour un membre : **345 octets** compressés.

**Les prix sont lus en base** — sept packs, délais d'annulation (12 h / 24 h),
frais d'inscription. C'est le point qui compte : ils étaient figés dans le
page-builder, et le site avait fini par annoncer deux délais différents sur deux
pages.

**Formulaire de contact** par Edge Function + Resend, éprouvé de bout en bout
(les e-mails arrivent). Limite de cinq envois par heure et par IP, comptée en
base. Champ-piège, bornes de longueur, échappement HTML.

**22 redirections 301** vérifiées une par une. **95 Mo de photos → 5 Mo.**

**L'adresse e-mail du studio** est corrigée : `app_settings.studio_info.email`
portait `info@backotrackstudio.be`, sans le « n ». Elle alimente les CGV et la
politique de confidentialité, **trois fois**, dont deux comme point de contact
RGPD.

---

## Trois défauts trouvés et corrigés

### 1. Un cours complet s'annonçait libre — signalé par un coach

« 5 places disponibles » sur un cours qui répondait « Ce cours est complet ».

Le planning comptait les places en lisant `bookings` directement. Or la policy
de lecture est `auth.uid() = user_id` : **un membre ne voit que ses propres
réservations**. Sur un cours où il n'est pas inscrit, la requête revient vide —
et le code lisait ce vide comme « aucune place prise ».

Aucune erreur n'était levée : la requête réussit, un tableau vide est une
réponse valide. **Cousin de la règle n°6 du CLAUDE.md** — un refus d'écriture
n'est pas une exception, un filtrage de lecture non plus.

**Le défaut était invisible en interne** : admin et coach lisent toutes les
réservations, leurs compteurs ont toujours été justes. Seuls les membres le
subissaient. Cinq cours étaient concernés en production.

Corrigé par `places_prises_par_cours` (SECURITY DEFINER, ne rend qu'un nombre),
appliquée sur bot3 **et** bot-ops, empreintes MD5 identiques.

> **Leçon, à retenir** : tester avec un compte **client**, pas seulement avec un
> compte coach ou admin. C'est une classe entière de bugs qu'aucun test interne
> ne peut voir.

### 2. Le déploiement cassait la page de qui chargeait à cet instant

Une cliente signalait un écran blanc dont elle ne pouvait plus sortir : « c'est
comme si le lien était valide jusqu'au moment où il y a un bug ». Vider
l'historique n'y changeait rien.

`rsync` remplaçait `index.html` **avant** que les `assets/` qu'il nomme soient
arrivés, et `--delete` effaçait les anciens. Le service worker mettait la page
cassée en cache — et l'historique ne touche ni au service worker ni au Cache
Storage, d'où l'impression de « lien brûlé ».

L'envoi se fait désormais **en deux temps** : `assets/` d'abord sans `--delete`,
la page ensuite. Les anciens bundles survivent sept jours. Le service worker se
répare aussi sur un 404 d'asset.

> **Ce correctif n'aide pas un navigateur déjà bloqué** : il faut « Effacer les
> données de site » (pas l'historique) pour `app.backontrackstudio.be`.

### 3. Les ancres ne se rejouaient pas depuis une autre page

Depuis `/contact`, cliquer « Les cours » menait à l'accueil mais restait en
haut. Le navigateur cherche l'ancre avant que React ait rendu la section.

**Trois rattrapages ont échoué.** Le plus instructif dépendait de
`requestAnimationFrame`, que le navigateur **suspend dans un onglet
d'arrière-plan** — le défilement n'aurait jamais eu lieu pour qui ouvre un lien
dans un nouvel onglet.

`/cours` et `/tarifs` sont redevenues des pages. `BlocCours` et `BlocTarifs`
servent la page d'accueil **et** leur page dédiée : le contenu n'existe qu'en un
exemplaire.

---

## Deux incidents de méthode, à ne pas refaire

### `db push` est proscrit — sixième règle du CLAUDE.md

Il veut rejouer **50 migrations déjà appliquées**, dont
`20260805_reset_member_test_data.sql`, sur 64 comptes réels. Cause : les 67
migrations portent un horodatage à **8 chiffres** au lieu de 14, et le CLI ne
retient que ce préfixe.

Le piège s'est révélé quand `db push` a été lancé : **trois migrations sont
passées avant l'échec**, dont `20260830_retirer_pack_essai.sql` — un chantier
dont la décision n'était pas prise.

**Cause première** : un `migration repair --status reverted` lancé sur une
hypothèse non vérifiée.

> Pour appliquer une migration : l'**outil Supabase** (`apply_migration`) ou
> l'éditeur SQL du tableau de bord. Jamais `db push`.

### `install.sql` amputé de 713 lignes

En séparant deux chantiers pour faire deux commits, le découpage a supprimé
vingt fonctions dont `has_role` et `get_available_credits`. Détecté au contrôle,
restauré, commit corrigé par `--amend`. Le fichier porte **5426 lignes, 28
tables, 84 fonctions**.

---

## Ce qui cloche encore

**Le lint est passé de 36 à 37.** Vérifié : le 37ᵉ n'a pas été introduit par le
dernier chantier (mesuré avec et sans). Il vient d'une modification antérieure
de la journée, non identifiée. `SchedulePage.tsx:453` —
`setState` synchrone dans un effet, sur du code qui existait déjà.

---

## Prochaine action

**Pousser les six commits**, si validé. Rien n'a été poussé de la journée.

---

## Points ouverts

### Décisions en attente

- **Retrait de la séance d'essai** : la fonction `retirer_pack_essai` **existe
  en base** (appliquée par accident), le front est commité mais **pas déployé**.
  Défaire coûterait maintenant une suppression en base, pas seulement des
  fichiers.
- **Compte client de test en production** : abandonné ce jour, à reprendre.
  L'exclure des statistiques demande une colonne `is_test` filtrée sur **dix
  écrans d'administration** plus les exports plus trois fonctions SQL — une
  demi-journée, avec un risque d'oubli à chaque endroit. Un compte ordinaire
  nommé « Test Compte technique » pèse 1 sur 74 (1,3 %).
  Adresse recommandée : `christian.vanhenten+test@gmail.com` — le suffixe `+`
  est standard (RFC 5233) mais **pas garanti** sur un domaine o2switch.

### À faire

- Soumettre le **sitemap** à Google Search Console
- Supprimer `~/wordpress-archive-20260831` dans 2-3 semaines
- **Renommer les 67 migrations** avec un horodatage à 14 chiffres, à froid —
  c'est ce qui rendrait `db push` de nouveau utilisable
- Identifier le 37ᵉ signalement de lint
- SPF ne mentionne pas Resend ; hCaptcha ; comptes développeurs Apple et Google
- Copier `.dumps/bot-20260829-120547.sql` et `wp-backontrack-20260831.sql.gz`
  hors du Mac mini
- **Technogym** : la page `/rgpd` du WordPress les déclarait responsables
  conjoints du traitement, avec transfert vers les États-Unis. La 301 renvoie
  vers `/confidentialite`, mais la question de fond reste — reste-t-il des
  données chez eux ?

---

## Méthode qui a servi

**Comparer les empreintes MD5 de `prosrc`** entre bot3 et bot-ops après chaque
migration appliquée à la main. C'est ce qui a confirmé que les deux bases
portaient la même fonction, au caractère près.

**Éprouver sur `jag.` avant `ops.`** — le déploiement en deux temps y a été
vérifié (l'ancien bundle répond encore en 200) avant de toucher la production.

**Se méfier de l'environnement de test** : le navigateur piloté à distance tient
son onglet en arrière-plan, où Chrome suspend `requestAnimationFrame` et les
défilements animés. Plusieurs mesures ont paru fausses pour cette seule raison.

---
type: projet
sous-type: application
role-fichier: cdc-moc
statut: en-cours
priorite: 2
domaine: "[[_Back on Track]]"
date-creation: 2026-06-02
date-maj: 2026-08-13
auteur: "[[@Christian Vanhenten]]"
tags:
  - app
  - back-on-track
  - coaching-sportif
  - developpement
  - supabase
  - react
  - stripe
---

# P-2026-website-bot

> **Back On Track (BOT)** — application de réservation pour un studio de coaching sportif (cours semi-privés + Personal Training). Développée par Christian avec Claude. 3 coachs-associés administrateurs (dont Gauthier) ; Christian super-admin.

> Volet applicatif de la mission [[_Back on Track]], qui porte par ailleurs l'accompagnement organisationnel du studio ([[Back on Track - Zones de responsabilité]], [[Plan briefing aux coaches Back on Track]]).

> Le code vit **hors du vault** : `~/bot/` — dépôt distant `github.com/christian0903/bot`. La documentation détaillée vit avec le code, dans `~/bot/docs/` : ce fichier porte le pilotage et pointe vers elle.

## Où en est le projet — 2026-08-07

**Version 2.54.0.** 246 commits, dont 106 sur la seule semaine du 3 au 7 août. L'application tourne sur iPhone en version de test depuis le 2026-08-07 (signature de développement, 7 jours) : la démonstration aux coachs est faite.

Le projet n'est plus en phase de recueil du besoin — cette phase est close. Il est en **phase de finition avant mise en production et publication App Store**.

## Pile technique

| Couche | Techno |
|---|---|
| Frontend | React 19 + TypeScript + Tailwind 4 + Vite |
| Backend | Supabase (PostgreSQL + Auth + Realtime + Edge Functions Deno) |
| Mobile | Capacitor 8 (iOS + Android) |
| Paiement | **Stripe** |
| E-mails | Resend |
| Compta | Odoo (externe) |

> **Mollie a été abandonné le 2026-08-03** au profit de Stripe. Le plan d'implémentation initial prévoyait une migration vers Mollie : elle n'aura pas lieu.

> Il n'y a **pas de serveur applicatif**. Le front parle directement à Supabase ; les opérations sensibles passent par des Edge Functions, où les clés secrètes restent confinées.

## Ce qui est livré

**Socle (phases 1 à 10)** — comptes, packs, planning, réservations, liste d'attente, annulations, check-in, statistiques, notifications, e-mails.

**Phase 11 — admin avancé** : largement livrée. Gestion des rôles depuis l'application, sept statuts de cours dérivés, espace coach autonome (inscrire un membre, annuler son cours, périodes calendaires).

**Phase 12 — abonnements récurrents** : livrée et **éprouvée au test clock Stripe** le 2026-08-07. Le renouvellement automatique fonctionne : seconde facture émise et payée, cycle crédité.

**Séance d'essai** : livrée. C'est désormais un vrai pack gratuit attribué à l'inscription, qui produit une réservation ordinaire — donc visible partout, y compris sur la liste de présence du coach.

**Communications** : livrées. Tout e-mail laisse une trace dans l'application, rassemblée en tête d'accueil.

**Avis sur les cours** : livrés. Une à cinq étoiles et un commentaire, anonymes pour le coach, nominatifs pour l'admin, délai de demande réglable.

**Clients professionnels (B2B)** : livrés. Commande sur facture, pack crédité immédiatement, suivi des encaissements.

**Performances** : étapes 1 et 2 livrées — valeurs comparables (`value_num` en unité canonique) et courbes de progression.

**Prérequis App Store** : levés. Suppression de compte depuis l'application (par anonymisation) et politique de confidentialité avec URL publique.

**Mentions légales** : saisies une fois dans les Réglages, injectées dans tous les documents par repères `{{studio_address}}`.

**Coupons** : enfin saisissables, restreignables par catégorie, code vérifié avant paiement.

**Parrainage & bons d'achat** : livrés mais **jamais testés de bout en bout**.

## Ce qui reste

- [ ] **Tester le parrainage et les bons d'achat** de bout en bout — scénario complet en 10 étapes dans `~/bot/docs/journal-projet.md`. Premier travail de la reprise.
- [ ] **Saisir les coordonnées légales du studio** dans les Réglages — elles bloquent les CGV, la politique de confidentialité et la facturation.
- [ ] **Export des factures vers Odoo** — le socle B2B est posé ; il manque la structure de fichier que Christian doit fournir.
- [ ] **Performances étape 3** — paliers (« Club 100 séances ») et régularité. Les fonctions SQL existent déjà, inutilisées.
- [ ] **Case notifications à l'inscription** — dernière demande des coachs encore ouverte.
- [ ] **Compléter les CGV** — l'article 1 (assurance) est rédigé et applicable ; le reste attend le contenu du studio.
- [ ] **Phase 13 — RGPD & sécurité** : non entamée (hors les deux éléments App Store, déjà levés).
- [ ] **Import TechnoGym** — action côté coachs : export CSV des membres, agendas et cours.

## Décisions bloquantes avant mise en production

1. **Grille tarifaire** — prix des formules 4 / 8 / 12 / illimité, packs ponctuels équivalents, frais d'inscription. Rien ne peut être mis en vente sans.
2. **Migration des clients actuels** — que deviennent les crédits en cours au jour de la bascule ? Conservés jusqu'à épuisement (recommandé), convertis, ou délai de consommation ?
3. **Bancontact en récurrent** — à vérifier chez Stripe.
4. **Coût des transactions récurrentes** — un cycle de 4 semaines produit **13 prélèvements par an**, pas 12. À chiffrer sur la marge avant de figer les prix.

À confirmer d'une phrase, le développement pouvant avancer sur l'hypothèse : crédits non consommés perdus en fin de cycle · changement de formule au cycle suivant sans prorata · résiliation = arrêt du renouvellement, droits jusqu'à la fin du cycle payé · abonnement et pack ponctuel simultanés (et si oui, ordre de consommation).

## Publication sur l'App Store

Compte Apple Developer pris **au nom propre de Christian** (99 $/an) — décision du 2026-08-07.

**La commission de 30 % ne s'applique pas** : règle 3.1.3(e), biens et services physiques. Un cours se consomme au studio, pas dans l'application. Les packs et abonnements restent vendus par Stripe.

Les deux prérequis bloquants (suppression de compte, politique de confidentialité publique) sont levés.

## Chantiers écartés ou reportés

- **Rémunération des coachs** — reportée le 2026-08-06 : module à part, la gestion se fait hors application.
- **Personal training en auto-réservation** — jugé non urgent par les coachs (« je gère tout sur WhatsApp »). Deux tensions non résolues : liberté d'agenda du coach contre auto-réservation, et le premier contact humain.
- **Migration vers Mollie** — abandonnée le 2026-08-03.
- **Granularité horaire au quart d'heure** — petit correctif indépendant, non prioritaire.

## Règles de travail acquises

Ces règles ont été payées par des bugs réels ; elles sont consignées dans `~/bot/docs/documentation-technique.md`.

- **Le webhook Stripe est le seul endroit qui crédite.** Jamais depuis le front, jamais depuis `create-checkout-session` : un client fermant la page avant de payer obtiendrait ses crédits. Corollaire : si un paiement n'a rien crédité, regarder le webhook en premier.
- **Tester le retour autant que `error`.** Une fonction SQL peut répondre `{error: "..."}` sans lever d'exception : le code passe alors dans la branche de succès et l'écran ment.
- **Toute migration se reporte dans `install.sql` au même commit.** Le rattrapage différé a échoué deux jours de suite.
- **Un Price Stripe est immuable.** Changer le prix ou la périodicité d'un pack efface les identifiants mémorisés ; les abonnements souscrits gardent l'ancien tarif.
- **Les modes test et live sont étanches**, et le commutateur des Réglages bascule le paiement **et** le webhook d'un seul coup. À vérifier avant toute vente réelle.
- **Après avoir posé un secret Supabase, redéployer la fonction qui l'utilise** — elle ne le voit qu'au déploiement suivant. Et vérifier `--no-verify-jwt`, perdu au redéploiement le 2026-08-07 (une heure de paiements encaissés sans rien créditer).

## Points de vigilance

- **Le seuil de 2 participants est sévère.** Un cours en tête-à-tête ne compte jamais comme donné, alors qu'il a eu lieu et que le crédit est consommé. À reconsidérer selon la réalité du studio.
- **Les données de démonstration faussent les statistiques** — le seed a généré beaucoup de cours sans participants. Les chiffres paraîtront anormalement bas jusqu'à l'import de données réelles.

## Documentation (dans `~/bot/docs/`)

| Fichier | Contenu |
|---|---|
| `journal-projet.md` | Trace de l'évolution, session par session — **source de vérité** |
| `documentation-technique.md` | Infrastructure super-admin : Stripe, webhook, secrets, dépannage |
| `description-fonctionnelle-v2.md` | Fonctionnement complet (20 sections) |
| `plan-implementation-v2.md` | Plan technique en 8 phases (partiellement périmé : Mollie abandonné) |
| `guide-admin.md`, `guide-coach.md`, `guide-membre.md` | Guides d'usage |
| `guide-installation.md` | Installation |
| `dossier-fonctionnel-abonnement.md` | Dossier fonctionnel du système d'abonnement |
| `cadrage-bons-achat.md` | Cadrage des bons d'achat et coupons |
| `stripe-deploiement.md` | Procédure de déploiement Stripe |
| `regles-coupons-parrainage.md` | ⚠️ Périmé — décrit l'ancienne règle (pack ≥ 10 séances) |

## Liens

- Code (hors vault) : `~/bot/` — dépôt `github.com/christian0903/bot`
- [[journal-website-bot]] — chronologie du projet côté vault
- [[_Back on Track]] — domaine : la mission d'accompagnement du studio
- Handoff le plus récent : [[handoff-2026-08-07-bot-essai-communications-performances]]

---

### Mentions au journal

```dataviewjs
// Générique : capte tout BLOC de 60.PRO-journal/ dont une ligne porte un wikilink vers ce
// fichier maître. Un bloc = une ligne d'en-tête (paragraphe non indenté ou ligne de tâche)
// + les puces/sous-puces contiguës qui la suivent, + une éventuelle ligne de rattachement
// isolée (« Projet : [[...]]. »). Les deux écritures de wikilink sont résolues : forme
// courte [[__P-slug]] et forme chemin complet.
const me = dv.current().file.path;
const rows = [];

const estPuce = (l) => /^\s*[-*+]\s/.test(l) || /^\s+\S/.test(l);
const estVide = (l) => l.trim() === "";
const estTitre = (l) => /^#{1,6}\s/.test(l);
const estSep = (l) => /^\s*(\*\*\*|---|___)\s*$/.test(l);

for (const p of dv.pages('"60.PRO-journal"').sort(p => p.file.name, 'desc')) {
  const touche = (p.file.outlinks.values || []).some(l => {
    const r = app.metadataCache.getFirstLinkpathDest(l.path, p.file.path);
    return r && r.path === me;
  });
  if (!touche) continue;
  const raw = await dv.io.load(p.file.path);
  if (!raw) continue;
  const lignes = raw.split("\n");

  // 1. Repérer les lignes qui portent le lien vers ce fichier maître.
  const porte = lignes.map(line => {
    const liens = [...line.matchAll(/\[\[([^\]|#^]+)/g)].map(m => m[1].trim());
    return liens.some(lp => {
      const r = app.metadataCache.getFirstLinkpathDest(lp, p.file.path);
      return r && r.path === me;
    });
  });
  if (!porte.some(Boolean)) continue;

  // 2. Pour chaque ligne portante, remonter à l'en-tête de son bloc.
  const debuts = new Set();
  for (let i = 0; i < lignes.length; i++) {
    if (!porte[i]) continue;
    let d = i;
    // une puce (ou une ligne de rattachement isolée) rattache au paragraphe qui la précède
    while (d > 0) {
      const cur = lignes[d];
      const prev = lignes[d - 1];
      const rattachable = estPuce(cur) || /^\s*Projet\s*:/i.test(cur);
      if (!rattachable) break;
      if (estVide(prev) || estTitre(prev) || estSep(prev)) break;
      d--;
    }
    if (lignes[d].trim()) debuts.add(d);
  }

  // 3. Étendre chaque bloc vers le bas, puis rendre.
  const vus = new Set();
  for (const d of [...debuts].sort((a, b) => a - b)) {
    if (vus.has(d)) continue;
    let f = d;
    for (let j = d + 1; j < lignes.length; j++) {
      const l = lignes[j];
      if (estTitre(l) || estSep(l)) break;
      if (estVide(l)) {
        // une seule ligne vide, suivie d'une puce, ne ferme pas le bloc ;
        // deux lignes vides, ou une ligne vide suivie d'un paragraphe, le ferment
        const nx = lignes[j + 1];
        if (nx === undefined || estVide(nx)) break;
        if (!estPuce(nx) && !/^\s*Projet\s*:/i.test(nx)) break;
        continue;
      }
      if (!estPuce(l) && !/^\s*Projet\s*:/i.test(l)) break;
      f = j;
    }
    for (let j = d; j <= f; j++) vus.add(j);

    const bloc = lignes.slice(d, f + 1)
      .filter(l => l.trim() && !/^\s*Projet\s*:\s*(\[\[[^\]]+\]\]\s*[·,]?\s*)+\.?\s*$/i.test(l))
      .map(l => l.replace(/^\s*[-*+]\s+(\[.\]\s*)?/, m => m.match(/^\s*/)[0] + "• ").trimEnd());
    if (!bloc.length) continue;
    rows.push([p.file.link, bloc.join("\n")]);
  }
}
if (rows.length) dv.table(["Jour", "Entrée"], rows);
else dv.paragraph("_Aucune mention au journal pour ce projet._");
```

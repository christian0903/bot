import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { estHorsProduction } from '@/lib/base-en-service'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { LoadingState } from '@/components/common/LoadingState'
import {
  Stethoscope, CheckCircle2, AlertTriangle, XCircle,
  RefreshCw, Database, Server, Image, Settings2, ShieldCheck,
} from 'lucide-react'

/** Injectée au build depuis package.json (cf. vite.config.ts). */
declare const __APP_VERSION__: string

/**
 * Auto-diagnostic d'une installation, réservé au `super_admin`.
 *
 * Le 2026-08-28, une base neuve paraissait installée — 27 tables, 89 policies,
 * les compteurs justes — et refusait pourtant toute lecture : aucun `GRANT` de
 * table n'avait été posé. L'application se chargeait, la connexion
 * réussissait, et chaque écran restait vide. Un `super_admin` fraîchement
 * promu n'avait ni le mode Admin ni le mode Coach. Aucun contrôle ne regardait
 * les droits, et le seul signal partait dans la console.
 *
 * Cette page est le portage à l'écran de `supabase/check-policies.sql`. Elle
 * regarde la base **avec les yeux de l'application** — mêmes droits, mêmes
 * policies — ce qui est précisément le point de vue qui manquait : une base
 * peut être juste vue du dashboard et muette vue d'ici.
 *
 * Ce qu'elle ne fait pas :
 *
 *   * elle ne compte pas les policies une par une — `check-policies.sql` reste
 *     l'outil de référence, et son verdict fait foi ;
 *   * elle ne voit rien des secrets ni du webhook Stripe : ils vivent hors du
 *     navigateur. Elle affiche ce qui les trahit — le mode de paiement et la
 *     date du dernier encaissement, dont le silence prolongé est le vrai
 *     symptôme d'un webhook cassé.
 */

/** Les 27 tables de `install.sql`, dans l'ordre où on les lit en cas de panne. */
const TABLES = [
  'profiles', 'user_roles', 'app_settings',
  'class_types', 'scheduled_classes', 'bookings', 'waitlist',
  'credit_types', 'pack_types', 'pack_purchases', 'pack_type_categories',
  'subscriptions', 'subscription_discounts', 'registration_fees',
  'invoice_requests', 'coupons', 'coupon_categories',
  'referrals', 'referral_rewards', 'member_categories', 'member_badges',
  'performances', 'performance_types', 'class_reviews',
  'notifications', 'activity_log', 'email_queue',
] as const

/** Les réglages qu'`install.sql` pose. Leur absence trahit une base incomplète. */
const REGLAGES_ATTENDUS = [
  'announcement', 'stripe_mode', 'trial_pack', 'class_reviews',
  'payment_provider', 'referral_rules', 'booking_rules', 'room_names',
  'client_tracking',
] as const

/** Les dix Edge Functions de `supabase/functions/`. */
const FONCTIONS = [
  'stripe-webhook', 'create-checkout-session', 'manage-subscription',
  'cancel-my-subscription', 'create-user', 'admin-update-password',
  'admin-update-email', 'send-email', 'send-notification', 'process-email-queue',
] as const

type Etat = 'ok' | 'attention' | 'panne'

interface Ligne {
  libelle: string
  etat: Etat
  detail: string
  /** Ce qu'il faut faire. Un diagnostic qui dit « KO » sans dire quoi faire n'aide personne. */
  remede?: string
}

interface Bloc {
  titre: string
  icone: typeof Database
  lignes: Ligne[]
}

/**
 * Codes PostgreSQL que PostgREST fait remonter tels quels.
 *
 * `42501` est celui qui compte : il distingue « la lecture est refusée » de
 * « la table est vide ». Sans lui, les deux se ressemblent — c'est ce qui a
 * rendu l'incident du 28 août indéchiffrable pendant une matinée.
 *
 * Un piège demeure, qu'aucun code ne signale : une policy RLS trop stricte ne
 * lève AUCUNE erreur, elle renvoie zéro ligne. Un droit manquant est bruyant,
 * une policy manquante est muette.
 */
const DROIT_REFUSE = '42501'
const TABLE_ABSENTE = '42P01'

export function AdminDiagnosticPage() {
  const { i18n } = useTranslation()
  const isFr = i18n.language === 'fr'
  const { user, roles, hasRole } = useAuth()

  const [blocs, setBlocs] = useState<Bloc[]>([])
  const [loading, setLoading] = useState(true)

  const analyser = useCallback(async () => {
    setLoading(true)
    const resultat: Bloc[] = []

    // ── Environnement ────────────────────────────────────────────────────────
    // La première question à poser quand un testeur signale un problème : sur
    // quelle base est-il tombé ? La référence se lit dans l'URL et ne ment pas,
    // là où `VITE_BASE` n'est qu'une déclaration du fichier `.env`.
    const urlSupabase = import.meta.env.VITE_SUPABASE_URL ?? ''
    let ref = '?'
    try {
      ref = new URL(urlSupabase).hostname.split('.')[0]
    } catch {
      ref = isFr ? 'URL illisible' : 'unreadable URL'
    }

    const libelleBase = import.meta.env.VITE_BASE_LIBELLE
    const environnement: Ligne[] = [
      {
        libelle: isFr ? 'Base interrogée' : 'Database in use',
        etat: urlSupabase ? 'ok' : 'panne',
        detail: urlSupabase ? `${ref}${libelleBase ? ` — ${libelleBase}` : ''}` : (isFr ? 'VITE_SUPABASE_URL absente' : 'VITE_SUPABASE_URL missing'),
        remede: urlSupabase ? undefined : (isFr ? 'Renseigner VITE_SUPABASE_URL dans .env, puis rebuilder.' : 'Set VITE_SUPABASE_URL in .env, then rebuild.'),
      },
      {
        libelle: isFr ? 'Rôle de la base' : 'Database role',
        // Une base de test est un état normal, pas un défaut : l'attention
        // signale ici « attention à ce que vous faites », pas « c'est cassé ».
        etat: estHorsProduction ? 'attention' : 'ok',
        detail: estHorsProduction
          ? (isFr ? 'Base de test — le bandeau d\'avertissement est affiché' : 'Test database — warning banner shown')
          : (isFr ? 'Production (VITE_BASE=ops)' : 'Production (VITE_BASE=ops)'),
      },
      {
        libelle: isFr ? 'Version de l\'application' : 'Application version',
        etat: 'ok',
        detail: `v${__APP_VERSION__}`,
      },
      {
        libelle: isFr ? 'Liens des e-mails' : 'Email links',
        // VITE_APP_URL était déclarée mais VIDE en production, et le code
        // repliait avec `??` — qui ne bascule pas sur une chaîne vide.
        etat: import.meta.env.VITE_APP_URL ? 'ok' : 'attention',
        detail: import.meta.env.VITE_APP_URL || (isFr ? 'VITE_APP_URL vide — repli sur l\'adresse courante' : 'VITE_APP_URL empty — falling back to current origin'),
        remede: import.meta.env.VITE_APP_URL ? undefined : (isFr
          ? 'Renseigner VITE_APP_URL dans .env. Poser aussi le secret APP_URL, sans quoi les liens des e-mails envoyés par le serveur seront morts.'
          : 'Set VITE_APP_URL in .env, and the APP_URL secret too.'),
      },
    ]
    resultat.push({ titre: isFr ? 'Environnement' : 'Environment', icone: Server, lignes: environnement })

    // ── Droits de lecture ────────────────────────────────────────────────────
    // Le contrôle central. `head: true` ne rapatrie aucune ligne : seul
    // l'en-tête compte, ce qui rend les 27 sondes peu coûteuses.
    const sondes = await Promise.all(
      TABLES.map(async (table) => {
        // `*` et non `id` : les tables de liaison (pack_type_categories,
        // coupon_categories) n'ont pas de colonne `id`, et la sonde y échouait
        // en annonçant une erreur là où la table se portait bien. Avec
        // `head: true`, aucune ligne ne remonte : l'étoile ne coûte rien.
        const { count, error } = await supabase
          .from(table)
          .select('*', { count: 'exact', head: true })
        return { table, count, error }
      }),
    )

    const refusees = sondes.filter((s) => s.error?.code === DROIT_REFUSE)
    const absentes = sondes.filter((s) => s.error?.code === TABLE_ABSENTE)
    const autresErreurs = sondes.filter(
      (s) => s.error && s.error.code !== DROIT_REFUSE && s.error.code !== TABLE_ABSENTE,
    )

    const droits: Ligne[] = [{
      libelle: isFr ? 'Lecture des tables' : 'Table reads',
      etat: refusees.length > 0 || absentes.length > 0 ? 'panne' : autresErreurs.length > 0 ? 'attention' : 'ok',
      detail: refusees.length > 0
        ? (isFr ? `${refusees.length} table(s) sur ${TABLES.length} refusent la lecture` : `${refusees.length} of ${TABLES.length} tables deny reads`)
        : absentes.length > 0
          ? (isFr ? `${absentes.length} table(s) absente(s) de la base` : `${absentes.length} table(s) missing`)
          : autresErreurs.length > 0
            ? (isFr ? `${autresErreurs.length} table(s) en erreur` : `${autresErreurs.length} table(s) in error`)
            : (isFr ? `les ${TABLES.length} tables répondent` : `all ${TABLES.length} tables respond`),
      remede: refusees.length > 0
        ? (isFr
          ? `Droits manquants sur : ${refusees.map((r) => r.table).join(', ')}. Rejouer la section 8 d'install.sql (les GRANT), ou la migration 20260828_grants_tables.sql.`
          : `Missing grants on: ${refusees.map((r) => r.table).join(', ')}. Replay section 8 of install.sql.`)
        : absentes.length > 0
          ? (isFr
            ? `Absentes : ${absentes.map((r) => r.table).join(', ')}. La base n'a pas reçu install.sql en entier.`
            : `Missing: ${absentes.map((r) => r.table).join(', ')}. install.sql was not fully applied.`)
          : autresErreurs.length > 0
            ? autresErreurs.map((e) => `${e.table} : ${e.error?.message}`).join(' · ')
            : undefined,
    }]

    // Les tables vides ne sont pas un défaut — une base neuve l'est par
    // nature. Mais sur une base censée porter des données, c'est le signe
    // d'une policy RLS trop stricte, qui elle ne lève aucune erreur.
    const vides = sondes.filter((s) => !s.error && (s.count ?? 0) === 0)
    if (vides.length > 0) {
      droits.push({
        libelle: isFr ? 'Tables sans aucune ligne' : 'Empty tables',
        etat: 'attention',
        detail: `${vides.length}/${TABLES.length} — ${vides.map((v) => v.table).join(', ')}`,
        remede: isFr
          ? 'Normal sur une base neuve. Sur une base chargée, une table vide alors qu\'elle ne devrait pas l\'être trahit une policy RLS trop stricte — qui, elle, ne lève aucune erreur.'
          : 'Normal on a fresh database. Otherwise it may signal an over-strict RLS policy, which raises no error.',
      })
    }
    resultat.push({ titre: isFr ? 'Droits de lecture' : 'Read permissions', icone: ShieldCheck, lignes: droits })

    // ── Rôles ────────────────────────────────────────────────────────────────
    // Le contexte React et la base doivent dire la même chose. Un désaccord
    // signifie que `user_roles` s'est lue de travers — l'incident du 28 août
    // exactement, où l'application se croyait devant un simple membre.
    const roles_: Ligne[] = []
    if (user) {
      const { data: verdictSql, error: erreurRpc } = await supabase
        .rpc('has_role', { check_user_id: user.id, check_role: 'super_admin' })

      const vuParApp = hasRole('super_admin')
      roles_.push({
        libelle: isFr ? 'Rôles vus par l\'application' : 'Roles seen by the app',
        etat: erreurRpc ? 'attention' : vuParApp === verdictSql ? 'ok' : 'panne',
        detail: erreurRpc
          ? (isFr ? `has_role() injoignable : ${erreurRpc.message}` : `has_role() unreachable: ${erreurRpc.message}`)
          : vuParApp === verdictSql
            ? (roles.length > 0 ? roles.join(', ') : (isFr ? 'aucun rôle' : 'no role'))
            : (isFr ? `l'application dit « ${vuParApp} », la base dit « ${verdictSql} »` : `app says "${vuParApp}", database says "${verdictSql}"`),
        remede: !erreurRpc && vuParApp !== verdictSql
          ? (isFr
            ? 'La lecture de user_roles est refusée : l\'application vous croit simple membre. C\'est le symptôme du 28 août — vérifier les GRANT ci-dessus.'
            : 'user_roles reads are denied — check the grants above.')
          : undefined,
      })
    }
    resultat.push({ titre: isFr ? 'Rôles' : 'Roles', icone: ShieldCheck, lignes: roles_ })

    // ── Réglages ─────────────────────────────────────────────────────────────
    // Ces clés sont lues par les fonctions SQL du cœur métier, sans repli.
    const { data: reglages, error: erreurReglages } = await supabase
      .from('app_settings').select('key, value')

    const config: Ligne[] = []
    if (erreurReglages) {
      config.push({
        libelle: isFr ? 'Réglages' : 'Settings',
        etat: 'panne',
        detail: erreurReglages.message,
        remede: isFr ? 'app_settings est illisible — l\'application ne peut pas démarrer correctement.' : 'app_settings unreadable.',
      })
    } else {
      const presentes = new Set((reglages ?? []).map((r) => r.key))
      const manquantes = REGLAGES_ATTENDUS.filter((k) => !presentes.has(k))
      config.push({
        libelle: isFr ? 'Réglages attendus' : 'Expected settings',
        etat: manquantes.length === 0 ? 'ok' : 'panne',
        detail: manquantes.length === 0
          ? (isFr ? `les ${REGLAGES_ATTENDUS.length} réglages sont posés` : `all ${REGLAGES_ATTENDUS.length} settings present`)
          : (isFr ? `manquants : ${manquantes.join(', ')}` : `missing: ${manquantes.join(', ')}`),
        remede: manquantes.length > 0
          ? (isFr ? 'Rejouer la section 8 d\'install.sql : ces clés sont lues sans valeur de repli par les fonctions SQL.' : 'Replay section 8 of install.sql.')
          : undefined,
      })

      // Le mode de paiement mérite sa ligne : il commande le choix des clés
      // Stripe côté serveur, et c'est le réglage qu'on oublie de basculer.
      const mode = (reglages ?? []).find((r) => r.key === 'stripe_mode')
      const modeValeur = (mode?.value as { mode?: string } | null)?.mode
      config.push({
        libelle: isFr ? 'Mode de paiement' : 'Payment mode',
        etat: modeValeur === 'live' && estHorsProduction ? 'panne'
          : modeValeur === 'test' && !estHorsProduction ? 'attention' : 'ok',
        detail: modeValeur === 'live' ? (isFr ? 'LIVE — paiements réels' : 'LIVE — real payments') : (isFr ? 'test' : 'test'),
        remede: modeValeur === 'live' && estHorsProduction
          ? (isFr ? 'Une base de TEST encaisse en LIVE. Basculer stripe_mode en test, dans Réglages.' : 'A TEST database is charging in LIVE mode.')
          : modeValeur === 'test' && !estHorsProduction
            ? (isFr ? 'La base de production est en mode test : aucun paiement réel n\'est encaissé.' : 'Production database is in test mode.')
            : undefined,
      })
    }
    resultat.push({ titre: isFr ? 'Réglages' : 'Settings', icone: Settings2, lignes: config })

    // ── Encaissements ────────────────────────────────────────────────────────
    // Le webhook Stripe ne se contrôle pas depuis le navigateur : sa clé vit
    // dans les Edge Functions. Mais son silence se voit — un webhook cassé,
    // c'est plus aucun achat qui arrive, sans le moindre autre signal.
    const { data: dernierAchat } = await supabase
      .from('pack_purchases')
      .select('created_at')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    const jours = dernierAchat?.created_at
      ? Math.floor((Date.now() - new Date(dernierAchat.created_at).getTime()) / 86_400_000)
      : null

    resultat.push({
      titre: isFr ? 'Encaissements' : 'Payments',
      icone: Database,
      lignes: [{
        libelle: isFr ? 'Dernier pack crédité' : 'Last credited pack',
        etat: jours === null || jours > 30 ? 'attention' : 'ok',
        detail: jours === null
          ? (isFr ? 'aucun achat en base' : 'no purchase recorded')
          : jours === 0
            ? (isFr ? "aujourd'hui" : 'today')
            : (isFr ? `il y a ${jours} jour(s)` : `${jours} day(s) ago`),
        remede: isFr
          ? 'Le webhook Stripe est le seul endroit qui crédite. Un silence prolongé alors que des ventes ont lieu est son symptôme : contrôler dans Stripe → Webhooks → Tentatives, et que la fonction est déployée avec --no-verify-jwt.'
          : 'The Stripe webhook is the only place that credits. Check Stripe → Webhooks → Attempts.',
      }],
    })

    // ── Storage ──────────────────────────────────────────────────────────────
    const { data: fichiers, error: erreurStorage } = await supabase
      .storage.from('avatars').list('', { limit: 1 })

    resultat.push({
      titre: 'Storage',
      icone: Image,
      lignes: [{
        libelle: isFr ? 'Bucket « avatars »' : 'Bucket "avatars"',
        etat: erreurStorage ? 'panne' : 'ok',
        detail: erreurStorage
          ? erreurStorage.message
          : (fichiers && fichiers.length > 0
            ? (isFr ? 'accessible, il contient des fichiers' : 'reachable, has files')
            : (isFr ? 'accessible mais vide' : 'reachable but empty')),
        remede: erreurStorage
          ? (isFr ? 'Le bucket est créé par install.sql (section 8b). S\'il manque, la base n\'a pas reçu le fichier en entier — les photos de cours et de coachs ne s\'afficheront pas.' : 'The bucket is created by install.sql (section 8b).')
          : (fichiers && fichiers.length === 0
            ? (isFr ? 'Normal sur une base neuve. Après une migration, lancer scripts/copier-storage.sh — les images seraient sinon introuvables.' : 'Normal on a fresh database; otherwise run scripts/copier-storage.sh.')
            : undefined),
      }],
    })

    // ── Edge Functions ───────────────────────────────────────────────────────
    // En OPTIONS : les fonctions répondent au préflight CORS sans rien
    // exécuter. Les appeler pour de vrai enverrait des e-mails et ouvrirait
    // des sessions de paiement.
    // `HEAD` en `no-cors`, et non `OPTIONS`.
    //
    // Deux essais ont échoué avant celui-ci, tous deux sur bot3 le 2026-08-29 :
    // un `OPTIONS` ordinaire est rejeté par le contrôle d'origine avant même de
    // partir (« Failed to fetch »), et `OPTIONS` en `no-cors` est refusé par le
    // navigateur lui-même — la méthode n'y est pas autorisée. Les dix fonctions
    // étaient alors annoncées absentes alors qu'elles répondaient toutes.
    //
    // `HEAD` passe, mais la réponse est opaque : son code de statut est
    // illisible. On ne distingue donc que « a répondu » de « n'a pas répondu ».
    // C'est assez pour repérer un déploiement oublié, pas pour affirmer qu'une
    // fonction est absente — d'où le libellé prudent plus bas.
    const sondesFn = await Promise.all(
      FONCTIONS.map(async (nom) => {
        try {
          await fetch(`${urlSupabase}/functions/v1/${nom}`, { method: 'HEAD', mode: 'no-cors' })
          return { nom, repond: true }
        } catch {
          return { nom, repond: false }
        }
      }),
    )
    const absentesFn = sondesFn.filter((f) => !f.repond)

    resultat.push({
      titre: 'Edge Functions',
      icone: Server,
      lignes: [{
        libelle: isFr ? 'Fonctions déployées' : 'Deployed functions',
        etat: absentesFn.length === 0 ? 'ok' : 'attention',
        detail: absentesFn.length === 0
          ? (isFr ? `les ${FONCTIONS.length} fonctions répondent` : `all ${FONCTIONS.length} functions respond`)
          : (isFr ? `sans réponse : ${absentesFn.map((f) => f.nom).join(', ')}` : `no answer: ${absentesFn.map((f) => f.nom).join(', ')}`),
        remede: absentesFn.length > 0
          ? (isFr
            ? `Le navigateur n'a pas obtenu de réponse. Contrôler d'abord avec npx supabase functions list --project-ref <ref> : si elles y sont ACTIVE, c'est la sonde du navigateur qui est en défaut, pas le déploiement.`
            : `No answer from the browser. Check with npx supabase functions list first.`)
          : (isFr
            ? 'Répondre au préflight ne prouve ni que les secrets sont posés, ni que stripe-webhook porte bien --no-verify-jwt : cela se vérifie avec npx supabase functions list.'
            : 'Responding to preflight does not prove secrets are set.'),
      }],
    })

    setBlocs(resultat)
    setLoading(false)
  }, [isFr, user, roles, hasRole])

  // Le diagnostic se lance à l'ouverture : c'est tout l'objet de la page, et
  // son `setLoading` initial est ce que le compilateur signale. Le motif est
  // celui des 36 signalements résiduels du dépôt, ici assumé nommément plutôt
  // que laissé grossir le compteur.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void analyser() }, [analyser])

  // La route est déjà gardée, mais un admin simple qui atteindrait cette URL
  // doit lire pourquoi elle lui est fermée plutôt que d'être renvoyé sans mot.
  if (!hasRole('super_admin')) {
    return (
      <Card>
        <CardContent className="p-6 text-sm text-muted-foreground">
          {isFr
            ? 'Ce diagnostic est réservé au super administrateur.'
            : 'This diagnostic is restricted to super admins.'}
        </CardContent>
      </Card>
    )
  }

  if (loading) return <LoadingState />

  const pannes = blocs.flatMap((b) => b.lignes).filter((l) => l.etat === 'panne').length
  const attentions = blocs.flatMap((b) => b.lignes).filter((l) => l.etat === 'attention').length

  const Icone = ({ etat }: { etat: Etat }) =>
    etat === 'ok' ? <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0 mt-0.5" />
      : etat === 'attention' ? <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
        : <XCircle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Stethoscope className="h-6 w-6 text-primary" />
          {isFr ? 'Diagnostic' : 'Diagnostic'}
        </h1>
        <Button variant="outline" size="sm" onClick={() => { void analyser() }}>
          <RefreshCw className="h-4 w-4 mr-2" />
          {isFr ? 'Relancer' : 'Run again'}
        </Button>
      </div>

      {/* Le verdict d'abord : on ouvre cette page pour savoir si quelque chose
          cloche, pas pour lire vingt lignes vertes. */}
      <div className={`rounded-lg border p-4 ${
        pannes > 0 ? 'border-red-500/50 bg-red-50 dark:bg-red-950/20'
          : attentions > 0 ? 'border-amber-500/50 bg-amber-50 dark:bg-amber-950/20'
            : 'border-green-500/50 bg-green-50 dark:bg-green-950/20'}`}>
        <p className="text-sm font-medium">
          {pannes > 0
            ? (isFr ? `${pannes} problème(s) à corriger` : `${pannes} problem(s) to fix`)
            : attentions > 0
              ? (isFr ? `Rien de cassé, ${attentions} point(s) à connaître` : `Nothing broken, ${attentions} point(s) to note`)
              : (isFr ? 'Installation saine' : 'Installation healthy')}
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          {isFr
            ? 'Ce diagnostic voit la base avec les yeux de l\'application. Il ne remplace pas check-policies.sql, qui compte les policies une par une.'
            : 'This looks at the database as the application sees it. It does not replace check-policies.sql.'}
        </p>
      </div>

      {blocs.map((bloc) => (
        <Card key={bloc.titre}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <bloc.icone className="h-4 w-4 text-primary" />
              {bloc.titre}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {bloc.lignes.map((ligne) => (
              <div key={ligne.libelle} className="flex gap-3">
                <Icone etat={ligne.etat} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline gap-x-2">
                    <span className="text-sm font-medium">{ligne.libelle}</span>
                    <span className="text-sm text-muted-foreground break-words">{ligne.detail}</span>
                  </div>
                  {ligne.remede && ligne.etat !== 'ok' && (
                    <p className="text-xs text-muted-foreground mt-1 break-words">{ligne.remede}</p>
                  )}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

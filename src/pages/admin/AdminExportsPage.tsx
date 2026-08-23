// ============================================================================
// Exports — sortir les données du studio en CSV
// ----------------------------------------------------------------------------
// Le studio a besoin de ses chiffres AILLEURS que dans l'application : un
// tableur pour la comptabilité, un rapprochement avec le fichier des coachs,
// une reprise dans un autre outil. Cette page rassemble ces sorties au même
// endroit.
//
// CE QU'ELLE NE FAIT PAS : remplacer les exports déjà présents sur les pages
// Membres et Tableau de bord. Ceux-là exportent CE QU'ON REGARDE, filtres
// compris — un réflexe utile qu'on ne casse pas. Ici, on vient chercher des
// données pour les emporter ; là-bas, on emporte ce qu'on vient de consulter.
//
// CHAQUE EXPORT SE CHARGE À LA DEMANDE. Rien n'est lu au chargement de la
// page : une année de réservations représente des milliers de lignes qu'il
// serait absurde de rapatrier pour un bouton qu'on ne cliquera pas.
// ============================================================================

import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { supabase } from '@/lib/supabase'
import { downloadCsv, type CsvRow } from '@/lib/csv'
import { one } from '@/lib/supabase-joins'
import { getClassStatus, classStatusLabel, creditValueCents, formatEuros } from '@/lib/utils'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import {
  Download, CalendarDays, Users, Package, Repeat, Star,
  ClipboardCheck, ScrollText, BookOpen,
} from 'lucide-react'
import { format, startOfMonth, endOfMonth } from 'date-fns'

/** Ce qu'un export sait faire : produire des lignes pour une période. */
interface ExportDef {
  id: string
  icon: typeof Download
  titre: string
  titreEn: string
  /** À quoi ça sert, en une phrase — pour choisir sans ouvrir le fichier. */
  aide: string
  aideEn: string
  /** Les colonnes annoncées, pour savoir ce qu'on obtient avant de cliquer. */
  colonnes: string
  colonnesEn: string
  /** Une période ne veut rien dire pour certains exports (l'état courant). */
  parPeriode: boolean
  charger: (from: string, to: string) => Promise<CsvRow[]>
}

export function AdminExportsPage() {
  const { i18n } = useTranslation()
  const isFr = i18n.language === 'fr'

  const [dateFrom, setDateFrom] = useState(format(startOfMonth(new Date()), 'yyyy-MM-dd'))
  const [dateTo, setDateTo] = useState(format(endOfMonth(new Date()), 'yyyy-MM-dd'))
  const [enCours, setEnCours] = useState<string | null>(null)

  // Réglages lus au moment de l'export, pas au chargement : ils ne servent
  // qu'aux exports qui calculent un statut ou une valeur de séance.
  const lireReglages = async () => {
    const { data } = await supabase
      .from('app_settings')
      .select('key, value')
      .in('key', ['unlimited_session_cost', 'class_given_rule'])

    let coutIllimite: number | null = null
    let minParticipants = 1
    for (const s of data ?? []) {
      if (s.key === 'unlimited_session_cost') {
        coutIllimite = (s.value as { cents?: number })?.cents ?? null
      }
      if (s.key === 'class_given_rule') {
        minParticipants = (s.value as { min_participants?: number })?.min_participants ?? 1
      }
    }
    return { coutIllimite, minParticipants }
  }

  /** Les profils concernés, en une requête — `profiles` ne se joint pas (RLS). */
  const nomsDe = async (ids: string[]) => {
    const uniques = [...new Set(ids.filter(Boolean))]
    const noms = new Map<string, { nom: string; email: string }>()
    if (uniques.length === 0) return noms

    // Par tranches : une clause `IN` de plusieurs milliers d'identifiants
    // dépasse la longueur d'URL acceptée par PostgREST.
    for (let i = 0; i < uniques.length; i += 500) {
      const { data } = await supabase
        .from('profiles')
        .select('id, display_name, email')
        .in('id', uniques.slice(i, i + 500))
      for (const p of data ?? []) {
        noms.set(p.id, { nom: p.display_name ?? '', email: p.email ?? '' })
      }
    }
    return noms
  }

  const oui = (v: boolean) => (v ? (isFr ? 'oui' : 'yes') : (isFr ? 'non' : 'no'))
  const dateHeure = (iso: string) => format(new Date(iso), 'dd/MM/yyyy HH:mm')
  const dateSeule = (iso: string) => format(new Date(iso), 'dd/MM/yyyy')

  const exports: ExportDef[] = [
    // -----------------------------------------------------------------------
    {
      id: 'reservations',
      icon: BookOpen,
      titre: 'Réservations',
      titreEn: 'Bookings',
      aide: 'Une ligne par inscription. L\'export le plus polyvalent : tout se recoupe depuis là.',
      aideEn: 'One row per booking. The most versatile export: everything cross-references from here.',
      colonnes: 'Date, cours, coach, membre, e-mail, pack utilisé, statut, présence, absence, essai',
      colonnesEn: 'Date, class, coach, member, email, pack used, status, attended, no-show, trial',
      parPeriode: true,
      charger: async (from, to) => {
        const { data: cours } = await supabase
          .from('scheduled_classes')
          .select('id, starts_at, coach_id, is_cancelled, title, floor, class_type:class_types(name)')
          .gte('starts_at', from)
          .lte('starts_at', to)
          .order('starts_at')

        const idsCours = (cours ?? []).map(c => c.id)
        if (idsCours.length === 0) return []

        const lignes: CsvRow[] = []
        const parCours = new Map((cours ?? []).map(c => [c.id, c]))

        // Par tranches, pour la même raison que les profils.
        const reservations: Record<string, unknown>[] = []
        for (let i = 0; i < idsCours.length; i += 200) {
          const { data } = await supabase
            .from('bookings')
            .select('id, scheduled_class_id, user_id, status, checked_in_at, is_no_show, is_trial, created_at, cancelled_at, pack_purchase:pack_purchases(pack_type:pack_types(name))')
            .in('scheduled_class_id', idsCours.slice(i, i + 200))
          reservations.push(...(data ?? []))
        }

        const noms = await nomsDe([
          ...reservations.map(b => b.user_id as string),
          ...(cours ?? []).map(c => c.coach_id).filter(Boolean) as string[],
        ])

        for (const b of reservations) {
          const sc = parCours.get(b.scheduled_class_id as string)
          if (!sc) continue
          const membre = noms.get(b.user_id as string)
          const pack = one(one(b.pack_purchase as never)?.['pack_type'] as never) as { name?: string } | undefined

          lignes.push({
            [isFr ? 'Date du cours' : 'Class date']: dateHeure(sc.starts_at),
            [isFr ? 'Cours' : 'Class']: one(sc.class_type)?.name ?? '',
            [isFr ? 'Intitulé' : 'Title']: sc.title ?? '',
            [isFr ? 'Salle' : 'Room']: sc.floor ?? '',
            [isFr ? 'Coach' : 'Coach']: sc.coach_id ? (noms.get(sc.coach_id)?.nom ?? '') : '',
            [isFr ? 'Membre' : 'Member']: membre?.nom ?? '',
            'E-mail': membre?.email ?? '',
            [isFr ? 'Pack utilisé' : 'Pack used']: pack?.name ?? '',
            [isFr ? 'Statut' : 'Status']: b.status === 'confirmed'
              ? (isFr ? 'confirmée' : 'confirmed')
              : (isFr ? 'annulée' : 'cancelled'),
            [isFr ? 'Présence pointée' : 'Checked in']: b.checked_in_at ? dateHeure(b.checked_in_at as string) : '',
            [isFr ? 'Absent' : 'No-show']: oui(!!b.is_no_show),
            [isFr ? 'Séance d\'essai' : 'Trial']: oui(!!b.is_trial),
            [isFr ? 'Cours annulé' : 'Class cancelled']: oui(!!sc.is_cancelled),
            [isFr ? 'Réservé le' : 'Booked on']: dateHeure(b.created_at as string),
            [isFr ? 'Annulé le' : 'Cancelled on']: b.cancelled_at ? dateHeure(b.cancelled_at as string) : '',
          })
        }
        return lignes
      },
    },

    // -----------------------------------------------------------------------
    {
      id: 'cours',
      icon: CalendarDays,
      titre: 'Cours',
      titreEn: 'Classes',
      aide: 'Une ligne par cours, avec son coach, son effectif et s\'il a été donné.',
      aideEn: 'One row per class, with its coach, attendance and whether it was given.',
      colonnes: 'Date, type, coach, salle, capacité, inscrits, présents, absents, statut, revenu',
      colonnesEn: 'Date, type, coach, room, capacity, booked, attended, no-shows, status, revenue',
      parPeriode: true,
      charger: async (from, to) => {
        const { coutIllimite, minParticipants } = await lireReglages()

        const { data: cours } = await supabase
          .from('scheduled_classes')
          .select('id, starts_at, duration_minutes, max_participants, coach_id, is_cancelled, title, floor, class_type:class_types(name)')
          .gte('starts_at', from)
          .lte('starts_at', to)
          .order('starts_at')

        const idsCours = (cours ?? []).map(c => c.id)
        if (idsCours.length === 0) return []

        const reservations: Record<string, unknown>[] = []
        for (let i = 0; i < idsCours.length; i += 200) {
          const { data } = await supabase
            .from('bookings')
            .select('scheduled_class_id, status, checked_in_at, is_no_show, pack_purchase:pack_purchases(price_paid_cents, pack_type:pack_types(credit_count, is_unlimited))')
            .in('scheduled_class_id', idsCours.slice(i, i + 200))
            .eq('status', 'confirmed')
          reservations.push(...(data ?? []))
        }

        const noms = await nomsDe((cours ?? []).map(c => c.coach_id).filter(Boolean) as string[])

        return (cours ?? []).map(sc => {
          const siennes = reservations.filter(b => b.scheduled_class_id === sc.id)
          const presents = siennes.filter(b => b.checked_in_at).length
          const absents = siennes.filter(b => b.is_no_show).length

          const statut = getClassStatus({
            starts_at: sc.starts_at,
            is_cancelled: sc.is_cancelled ?? false,
            bookings: siennes.length,
            minParticipants,
            attended: presents,
            noShows: absents,
          })

          const revenu = siennes.reduce((somme, b) => {
            const pp = one(b.pack_purchase as never) as { price_paid_cents?: number; pack_type?: unknown } | undefined
            return somme + (creditValueCents(
              pp?.price_paid_cents ?? 0,
              one(pp?.pack_type as never) as { credit_count: number; is_unlimited?: boolean } | undefined,
              coutIllimite,
            ) ?? 0)
          }, 0)

          return {
            [isFr ? 'Date' : 'Date']: dateHeure(sc.starts_at),
            [isFr ? 'Cours' : 'Class']: one(sc.class_type)?.name ?? '',
            [isFr ? 'Intitulé' : 'Title']: sc.title ?? '',
            [isFr ? 'Coach' : 'Coach']: sc.coach_id ? (noms.get(sc.coach_id)?.nom ?? '') : '',
            [isFr ? 'Salle' : 'Room']: sc.floor ?? '',
            [isFr ? 'Durée (min)' : 'Duration (min)']: sc.duration_minutes,
            [isFr ? 'Capacité' : 'Capacity']: sc.max_participants ?? '',
            [isFr ? 'Inscrits' : 'Booked']: siennes.length,
            [isFr ? 'Présents' : 'Attended']: presents,
            [isFr ? 'Absents' : 'No-shows']: absents,
            [isFr ? 'Statut' : 'Status']: classStatusLabel(statut, isFr).label,
            [isFr ? 'Revenu (€)' : 'Revenue (€)']: formatEuros(revenu),
          }
        })
      },
    },

    // -----------------------------------------------------------------------
    {
      id: 'membres',
      icon: Users,
      titre: 'Membres',
      titreEn: 'Members',
      aide: 'L\'état courant de chaque membre — la période ne s\'applique pas.',
      aideEn: 'Each member\'s current state — the period does not apply.',
      colonnes: 'Nom, e-mail, téléphone, catégorie, inscription, crédits restants, abonnement, suppression',
      colonnesEn: 'Name, email, phone, category, signup, credits left, subscription, deletion',
      parPeriode: false,
      charger: async () => {
        // Les comptes supprimés sont CONSERVÉS dans l'export, marqués comme
        // tels. Les masquer ferait mentir un état des lieux comptable : leurs
        // achats existent toujours. Leurs données personnelles ayant été
        // anonymisées à la suppression, il n'y a rien à protéger de plus.
        const { data: profils } = await supabase
          .from('profiles')
          .select('id, display_name, email, phone, created_at, deleted_at, member_category:member_categories(name)')
          .order('display_name')

        const ids = (profils ?? []).map(p => p.id)
        if (ids.length === 0) return []

        // Crédits encore valables, tous packs confondus.
        const { data: packs } = await supabase
          .from('pack_purchases')
          .select('user_id, credits_remaining, expires_at, pack_type:pack_types(is_unlimited)')
          .gt('expires_at', new Date().toISOString())

        const { data: abos } = await supabase
          .from('subscriptions')
          .select('user_id, status, current_period_end, pack_type:pack_types(name)')
          .in('status', ['active', 'past_due', 'paused'])

        const credits = new Map<string, number>()
        const illimite = new Set<string>()
        for (const p of packs ?? []) {
          if (one(p.pack_type)?.is_unlimited) illimite.add(p.user_id)
          credits.set(p.user_id, (credits.get(p.user_id) ?? 0) + (p.credits_remaining ?? 0))
        }
        const abo = new Map((abos ?? []).map(a => [a.user_id, a]))

        return (profils ?? []).map(p => {
          const a = abo.get(p.id)
          return {
            [isFr ? 'Nom' : 'Name']: p.display_name ?? '',
            'E-mail': p.email ?? '',
            [isFr ? 'Téléphone' : 'Phone']: p.phone ?? '',
            [isFr ? 'Catégorie' : 'Category']: one(p.member_category)?.name ?? '',
            [isFr ? 'Inscrit le' : 'Signed up']: p.created_at ? dateSeule(p.created_at) : '',
            [isFr ? 'Crédits restants' : 'Credits left']: illimite.has(p.id)
              ? (isFr ? 'illimité' : 'unlimited')
              : (credits.get(p.id) ?? 0),
            [isFr ? 'Abonnement' : 'Subscription']: a ? (one(a.pack_type)?.name ?? '') : '',
            [isFr ? 'Statut abonnement' : 'Subscription status']: a?.status ?? '',
            [isFr ? 'Fin de cycle' : 'Period end']: a?.current_period_end ? dateSeule(a.current_period_end) : '',
            [isFr ? 'Compte supprimé le' : 'Account deleted']: p.deleted_at ? dateSeule(p.deleted_at) : '',
          }
        })
      },
    },

    // -----------------------------------------------------------------------
    {
      id: 'achats',
      icon: Package,
      titre: 'Achats de packs',
      titreEn: 'Pack purchases',
      aide: 'Ce qui a été vendu sur la période, à qui et à quel prix.',
      aideEn: 'What was sold over the period, to whom and at what price.',
      colonnes: 'Date, client, pack, prix payé, crédits, restants, validité, source',
      colonnesEn: 'Date, client, pack, price paid, credits, remaining, expiry, source',
      parPeriode: true,
      charger: async (from, to) => {
        const { data } = await supabase
          .from('pack_purchases')
          .select('user_id, purchased_at, expires_at, price_paid_cents, credits_remaining, subscription_id, stripe_invoice_id, pack_type:pack_types(name, credit_count, is_unlimited)')
          .gte('purchased_at', from)
          .lte('purchased_at', to)
          .order('purchased_at')

        const noms = await nomsDe((data ?? []).map(p => p.user_id))

        return (data ?? []).map(p => {
          const pt = one(p.pack_type)
          return {
            [isFr ? 'Date' : 'Date']: dateHeure(p.purchased_at),
            [isFr ? 'Client' : 'Client']: noms.get(p.user_id)?.nom ?? '',
            'E-mail': noms.get(p.user_id)?.email ?? '',
            [isFr ? 'Pack' : 'Pack']: pt?.name ?? '',
            [isFr ? 'Prix payé (€)' : 'Price paid (€)']: formatEuros(p.price_paid_cents ?? 0),
            [isFr ? 'Crédits' : 'Credits']: pt?.is_unlimited
              ? (isFr ? 'illimité' : 'unlimited')
              : (pt?.credit_count ?? 0),
            [isFr ? 'Restants' : 'Remaining']: pt?.is_unlimited ? '' : (p.credits_remaining ?? 0),
            [isFr ? 'Expire le' : 'Expires']: p.expires_at ? dateSeule(p.expires_at) : '',
            [isFr ? 'Origine' : 'Source']: p.subscription_id
              ? (isFr ? 'abonnement' : 'subscription')
              : (isFr ? 'achat ponctuel' : 'one-off'),
            [isFr ? 'Facture Stripe' : 'Stripe invoice']: p.stripe_invoice_id ?? '',
          }
        })
      },
    },

    // -----------------------------------------------------------------------
    {
      id: 'abonnements',
      icon: Repeat,
      titre: 'Abonnements',
      titreEn: 'Subscriptions',
      aide: 'Tous les abonnements et leur état — la période ne s\'applique pas.',
      aideEn: 'All subscriptions and their state — the period does not apply.',
      colonnes: 'Membre, formule, statut, début, fin de cycle, résiliation prévue, mode',
      colonnesEn: 'Member, plan, status, start, period end, cancel at end, mode',
      parPeriode: false,
      charger: async () => {
        const { data } = await supabase
          .from('subscriptions')
          .select('user_id, status, created_at, current_period_start, current_period_end, cancel_at_period_end, stripe_mode, pack_type:pack_types(name, price_cents)')
          .order('created_at', { ascending: false })

        const noms = await nomsDe((data ?? []).map(s => s.user_id))

        return (data ?? []).map(s => ({
          [isFr ? 'Membre' : 'Member']: noms.get(s.user_id)?.nom ?? '',
          'E-mail': noms.get(s.user_id)?.email ?? '',
          [isFr ? 'Formule' : 'Plan']: one(s.pack_type)?.name ?? '',
          [isFr ? 'Prix (€)' : 'Price (€)']: formatEuros(one(s.pack_type)?.price_cents ?? 0),
          [isFr ? 'Statut' : 'Status']: s.status ?? '',
          [isFr ? 'Souscrit le' : 'Started']: s.created_at ? dateSeule(s.created_at) : '',
          [isFr ? 'Cycle en cours' : 'Current period']: s.current_period_start && s.current_period_end
            ? `${dateSeule(s.current_period_start)} → ${dateSeule(s.current_period_end)}`
            : '',
          [isFr ? 'Résiliation en fin de cycle' : 'Cancels at period end']: oui(!!s.cancel_at_period_end),
          'Mode': s.stripe_mode ?? '',
        }))
      },
    },

    // -----------------------------------------------------------------------
    {
      id: 'presences',
      icon: ClipboardCheck,
      titre: 'Présences par membre',
      titreEn: 'Attendance per member',
      aide: 'Le récapitulatif par personne sur la période : venues, absences, dépenses.',
      aideEn: 'Per-person summary over the period: attendance, no-shows, spending.',
      colonnes: 'Membre, réservations, présents, absents, annulations, dernière venue, revenu',
      colonnesEn: 'Member, bookings, attended, no-shows, cancellations, last visit, revenue',
      parPeriode: true,
      charger: async (from, to) => {
        const { coutIllimite } = await lireReglages()

        const { data: cours } = await supabase
          .from('scheduled_classes')
          .select('id, starts_at')
          .gte('starts_at', from)
          .lte('starts_at', to)

        const idsCours = (cours ?? []).map(c => c.id)
        if (idsCours.length === 0) return []
        const dateDe = new Map((cours ?? []).map(c => [c.id, c.starts_at]))

        const reservations: Record<string, unknown>[] = []
        for (let i = 0; i < idsCours.length; i += 200) {
          const { data } = await supabase
            .from('bookings')
            .select('scheduled_class_id, user_id, status, checked_in_at, is_no_show, pack_purchase:pack_purchases(price_paid_cents, pack_type:pack_types(credit_count, is_unlimited))')
            .in('scheduled_class_id', idsCours.slice(i, i + 200))
          reservations.push(...(data ?? []))
        }

        const noms = await nomsDe(reservations.map(b => b.user_id as string))

        interface Cumul {
          reservations: number; presents: number; absents: number
          annulations: number; derniere: string | null; revenu: number
        }
        const parMembre = new Map<string, Cumul>()

        for (const b of reservations) {
          const uid = b.user_id as string
          if (!parMembre.has(uid)) {
            parMembre.set(uid, { reservations: 0, presents: 0, absents: 0, annulations: 0, derniere: null, revenu: 0 })
          }
          const c = parMembre.get(uid)!

          if (b.status === 'cancelled') { c.annulations++; continue }

          c.reservations++
          if (b.checked_in_at) c.presents++
          if (b.is_no_show) c.absents++

          const quand = dateDe.get(b.scheduled_class_id as string)
          if (quand && (!c.derniere || quand > c.derniere)) c.derniere = quand

          const pp = one(b.pack_purchase as never) as { price_paid_cents?: number; pack_type?: unknown } | undefined
          c.revenu += creditValueCents(
            pp?.price_paid_cents ?? 0,
            one(pp?.pack_type as never) as { credit_count: number; is_unlimited?: boolean } | undefined,
            coutIllimite,
          ) ?? 0
        }

        return [...parMembre.entries()]
          .sort((a, b) => b[1].reservations - a[1].reservations)
          .map(([uid, c]) => ({
            [isFr ? 'Membre' : 'Member']: noms.get(uid)?.nom ?? '',
            'E-mail': noms.get(uid)?.email ?? '',
            [isFr ? 'Réservations' : 'Bookings']: c.reservations,
            [isFr ? 'Présences pointées' : 'Checked in']: c.presents,
            [isFr ? 'Absences' : 'No-shows']: c.absents,
            [isFr ? 'Annulations' : 'Cancellations']: c.annulations,
            [isFr ? 'Dernière venue' : 'Last visit']: c.derniere ? dateSeule(c.derniere) : '',
            [isFr ? 'Revenu (€)' : 'Revenue (€)']: formatEuros(c.revenu),
            [isFr ? 'Revenu / séance (€)' : 'Revenue / session (€)']: c.reservations > 0
              ? formatEuros(c.revenu / c.reservations)
              : '',
          }))
      },
    },

    // -----------------------------------------------------------------------
    {
      id: 'avis',
      icon: Star,
      titre: 'Avis sur les cours',
      titreEn: 'Class reviews',
      aide: 'Les notes et commentaires laissés par les membres.',
      aideEn: 'Ratings and comments left by members.',
      colonnes: 'Date, cours, coach, membre, note, commentaire',
      colonnesEn: 'Date, class, coach, member, rating, comment',
      parPeriode: true,
      charger: async (from, to) => {
        const { data } = await supabase
          .from('class_reviews')
          .select('rating, comment, created_at, user_id, scheduled_class:scheduled_classes(starts_at, coach_id, class_type:class_types(name))')
          .gte('created_at', from)
          .lte('created_at', to)
          .order('created_at', { ascending: false })

        const noms = await nomsDe([
          ...(data ?? []).map(r => r.user_id),
          ...(data ?? []).map(r => one(r.scheduled_class)?.coach_id).filter(Boolean) as string[],
        ])

        return (data ?? []).map(r => {
          const sc = one(r.scheduled_class)
          return {
            [isFr ? 'Déposé le' : 'Posted']: dateHeure(r.created_at),
            [isFr ? 'Date du cours' : 'Class date']: sc?.starts_at ? dateHeure(sc.starts_at) : '',
            [isFr ? 'Cours' : 'Class']: one(sc?.class_type)?.name ?? '',
            [isFr ? 'Coach' : 'Coach']: sc?.coach_id ? (noms.get(sc.coach_id)?.nom ?? '') : '',
            [isFr ? 'Membre' : 'Member']: noms.get(r.user_id)?.nom ?? '',
            [isFr ? 'Note' : 'Rating']: r.rating ?? '',
            [isFr ? 'Commentaire' : 'Comment']: r.comment ?? '',
          }
        })
      },
    },

    // -----------------------------------------------------------------------
    {
      id: 'journal',
      icon: ScrollText,
      titre: 'Journal d\'activité',
      titreEn: 'Activity log',
      aide: 'La trace des actions faites dans l\'application, pour vérification.',
      aideEn: 'The record of actions taken in the app, for auditing.',
      colonnes: 'Date, action, auteur, personne concernée, description',
      colonnesEn: 'Date, action, actor, target, description',
      parPeriode: true,
      charger: async (from, to) => {
        const { data } = await supabase
          .from('activity_log')
          .select('created_at, action, actor_id, target_user_id, entity_type, description')
          .gte('created_at', from)
          .lte('created_at', to)
          .order('created_at', { ascending: false })
          .limit(10000)

        const noms = await nomsDe([
          ...(data ?? []).map(l => l.actor_id).filter(Boolean) as string[],
          ...(data ?? []).map(l => l.target_user_id).filter(Boolean) as string[],
        ])

        return (data ?? []).map(l => ({
          [isFr ? 'Date' : 'Date']: dateHeure(l.created_at),
          [isFr ? 'Action' : 'Action']: l.action ?? '',
          [isFr ? 'Par' : 'By']: l.actor_id ? (noms.get(l.actor_id)?.nom ?? '') : '',
          [isFr ? 'Concerne' : 'Target']: l.target_user_id ? (noms.get(l.target_user_id)?.nom ?? '') : '',
          [isFr ? 'Type' : 'Type']: l.entity_type ?? '',
          [isFr ? 'Description' : 'Description']: l.description ?? '',
        }))
      },
    },
  ]

  const lancer = async (def: ExportDef) => {
    setEnCours(def.id)
    try {
      // Bornes sur la journée entière : `dateTo` seul vaudrait minuit, et
      // exclurait tout ce qui s'est passé le dernier jour choisi.
      const lignes = await def.charger(`${dateFrom}T00:00:00`, `${dateTo}T23:59:59`)

      if (lignes.length === 0) {
        toast.info(isFr ? 'Aucune donnée sur cette période.' : 'No data for this period.')
        return
      }

      const suffixe = def.parPeriode ? `_${dateFrom}_${dateTo}` : `_${format(new Date(), 'yyyy-MM-dd')}`
      downloadCsv(lignes, `${def.id}${suffixe}`)
      toast.success(isFr
        ? `${lignes.length} ligne${lignes.length > 1 ? 's' : ''} exportée${lignes.length > 1 ? 's' : ''}.`
        : `${lignes.length} row${lignes.length > 1 ? 's' : ''} exported.`)
    } catch (e) {
      // Un export qui échoue en silence laisserait croire à un fichier vide.
      toast.error(isFr
        ? `Export impossible : ${(e as Error).message}`
        : `Export failed: ${(e as Error).message}`)
    } finally {
      setEnCours(null)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{isFr ? 'Exports' : 'Exports'}</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {isFr
            ? 'Sortir les données du studio au format CSV, pour un tableur ou un autre outil.'
            : 'Export studio data as CSV, for a spreadsheet or another tool.'}
        </p>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">{isFr ? 'Période' : 'Period'}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <Label className="text-xs">{isFr ? 'Du' : 'From'}</Label>
              <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="w-auto" />
            </div>
            <div>
              <Label className="text-xs">{isFr ? 'Au' : 'To'}</Label>
              <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="w-auto" />
            </div>
            <p className="text-xs text-muted-foreground pb-2">
              {isFr
                ? 'Ne s\'applique pas aux exports marqués « état courant ».'
                : 'Does not apply to exports marked "current state".'}
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-3 sm:grid-cols-2">
        {exports.map(def => {
          const Icon = def.icon
          return (
            <Card key={def.id} className="flex flex-col">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
                  {isFr ? def.titre : def.titreEn}
                  {!def.parPeriode && (
                    <span className="text-[10px] font-normal uppercase tracking-wide text-muted-foreground border rounded px-1.5 py-0.5">
                      {isFr ? 'état courant' : 'current state'}
                    </span>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-3 flex-1">
                <p className="text-sm text-muted-foreground">{isFr ? def.aide : def.aideEn}</p>
                <p className="text-xs text-muted-foreground/80 flex-1">
                  <span className="font-medium">{isFr ? 'Colonnes : ' : 'Columns: '}</span>
                  {isFr ? def.colonnes : def.colonnesEn}
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  className="self-start"
                  disabled={enCours !== null}
                  onClick={() => lancer(def)}
                >
                  <Download className="h-3.5 w-3.5 mr-1.5" />
                  {enCours === def.id
                    ? (isFr ? 'Préparation…' : 'Preparing…')
                    : (isFr ? 'Exporter (.csv)' : 'Export (.csv)')}
                </Button>
              </CardContent>
            </Card>
          )
        })}
      </div>

      <p className="text-xs text-muted-foreground">
        {isFr
          ? 'Les fichiers s\'ouvrent directement dans Excel, accents compris. Les pages Membres et Tableau de bord gardent leurs propres exports, qui reprennent les filtres affichés.'
          : 'Files open directly in Excel, accents included. The Members and Dashboard pages keep their own exports, which follow the on-screen filters.'}
      </p>
    </div>
  )
}

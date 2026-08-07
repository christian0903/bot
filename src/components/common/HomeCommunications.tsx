import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { formatDistanceToNow } from 'date-fns'
import { fr, enUS } from 'date-fns/locale'
import {
  Gift, Mail, X, Check, ChevronDown, ChevronUp, Info, CheckCircle2, AlertTriangle, XCircle,
} from 'lucide-react'
import { useNotifications } from '@/contexts/NotificationContext'
import { ClassReviewPrompt } from '@/components/common/ClassReviewPrompt'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { Notification } from '@/types'

/** Au-delà, la liste est repliée : l'accueil ne doit pas devenir une boîte de réception. */
const VISIBLE_COUNT = 4

const ICONS = {
  success: CheckCircle2,
  warning: AlertTriangle,
  error: XCircle,
  info: Info,
} as const

const TONES = {
  success: 'text-emerald-600 dark:text-emerald-400',
  warning: 'text-amber-600 dark:text-amber-400',
  error: 'text-red-600 dark:text-red-400',
  info: 'text-blue-600 dark:text-blue-400',
} as const

/**
 * Une communication reçue.
 *
 * Non lue : fond marqué et point coloré. Lue : effacée visuellement, mais
 * toujours consultable — c'est la différence entre « traité » et « disparu ».
 */
function CommunicationRow({
  notif, onRead, onDismiss, isFr, locale,
}: {
  notif: Notification
  onRead: () => void
  onDismiss: () => void
  isFr: boolean
  locale: typeof fr | typeof enUS
}) {
  const navigate = useNavigate()
  const unread = !notif.is_read
  const Icon = ICONS[(notif.type as keyof typeof ICONS)] ?? Info
  const tone = TONES[(notif.type as keyof typeof TONES)] ?? TONES.info

  const open = () => {
    if (unread) onRead()
    if (notif.link) navigate(notif.link)
  }

  return (
    <div
      className={cn(
        'group flex items-start gap-3 rounded-lg px-3 py-2.5 transition-colors',
        unread ? 'bg-muted/60' : 'hover:bg-muted/30',
      )}
    >
      <Icon className={cn('h-4 w-4 mt-0.5 shrink-0', unread ? tone : 'text-muted-foreground/50')} />

      <button onClick={open} className="min-w-0 flex-1 text-left">
        <div className="flex items-center gap-2">
          <span className={cn('text-sm truncate', unread ? 'font-semibold' : 'text-muted-foreground')}>
            {notif.title}
          </span>
          {unread && <span className="h-1.5 w-1.5 rounded-full bg-primary shrink-0" />}
          {/* Le membre comprend pourquoi il retrouve la même chose dans sa boîte mail. */}
          {notif.email_template && (
            <Mail className="h-3 w-3 text-muted-foreground/60 shrink-0" aria-label={isFr ? 'Aussi envoyé par e-mail' : 'Also sent by email'} />
          )}
        </div>
        <p className={cn('text-xs mt-0.5 line-clamp-2', unread ? 'text-muted-foreground' : 'text-muted-foreground/70')}>
          {notif.message}
        </p>
        <span className="text-[10px] text-muted-foreground/60">
          {formatDistanceToNow(new Date(notif.created_at), { addSuffix: true, locale })}
        </span>
      </button>

      <div className="flex shrink-0 items-center gap-0.5">
        {/* Marquer lu sans ouvrir. Jusqu'ici la seule façon de le faire était
            de cliquer la ligne — ce qui navigue ailleurs. Une communication
            qu'on a lue en diagonale n'a pas à emmener le membre sur une autre
            page pour être classée. */}
        {unread && (
          <button
            onClick={onRead}
            aria-label={isFr ? 'Marquer comme lu' : 'Mark as read'}
            title={isFr ? 'Marquer comme lu' : 'Mark as read'}
            className="rounded p-1 text-muted-foreground/40 opacity-0 transition-opacity hover:bg-muted hover:text-foreground group-hover:opacity-100 focus:opacity-100"
          >
            <Check className="h-3.5 w-3.5" />
          </button>
        )}
        <button
          onClick={onDismiss}
          aria-label={isFr ? 'Retirer' : 'Dismiss'}
          title={isFr ? 'Retirer' : 'Dismiss'}
          className="rounded p-1 text-muted-foreground/40 opacity-0 transition-opacity hover:bg-muted hover:text-foreground group-hover:opacity-100 focus:opacity-100"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  )
}

/**
 * Bloc « communications » en tête de l'accueil.
 *
 * Rassemble ce que le membre doit savoir : la séance d'essai s'il y a droit,
 * puis tout ce qui lui a été notifié — y compris ce qui est parti par e-mail,
 * parce que tout le monde ne lit pas ses e-mails.
 *
 * La séance d'essai passe DEVANT et ne ressemble pas aux autres lignes : pour
 * quelqu'un qui débute, c'est l'information qui déclenche la première venue.
 * Elle disparaît d'elle-même une fois la séance réservée.
 */
export function HomeCommunications({ trialDaysLeft }: { trialDaysLeft: number | null }) {
  const { notifications, markAsRead, markAllAsRead, dismiss, dismissRead } = useNotifications()
  const { i18n } = useTranslation()
  const isFr = i18n.language === 'fr'
  const locale = isFr ? fr : enUS
  const navigate = useNavigate()
  const [expanded, setExpanded] = useState(false)
  /** Ce qu'on affiche : tout, ou seulement ce qui n'a pas été lu. */
  const [filter, setFilter] = useState<'all' | 'unread'>('all')

  const hasTrial = trialDaysLeft !== null
  const unread = notifications.filter((n) => !n.is_read).length
  const readCount = notifications.length - unread

  // Le filtre porte sur la liste, pas sur la requête : tout est déjà chargé,
  // et basculer ne doit pas provoquer d'attente.
  //
  // Il se désactive de lui-même quand il n'y a plus rien de non lu : les
  // boutons disparaissent alors, et rester bloqué sur « non lues » laisserait
  // le membre devant un cadre vide sans moyen d'en sortir.
  const activeFilter = unread > 0 ? filter : 'all'
  const filtered = activeFilter === 'unread'
    ? notifications.filter((n) => !n.is_read)
    : notifications

  const shown = expanded ? filtered : filtered.slice(0, VISIBLE_COUNT)
  const hidden = filtered.length - shown.length

  // Pas de sortie anticipée : la demande d'avis peut être le seul contenu à
  // afficher, et `ClassReviewPrompt` décide lui-même s'il a quelque chose à
  // dire. Un `return null` ici la rendrait invisible pour un membre sans
  // essai ni notification — précisément celui qui vient de suivre son cours.
  return (
    <div className="space-y-2">
      {/* ---- Avis sur la dernière séance ---- */}
      {/* Placé DANS les communications plutôt qu'en bloc séparé : c'est un
          message adressé au membre, au même titre qu'une notification. Il
          disparaît de lui-même passé le délai fixé dans les Réglages. */}
      <ClassReviewPrompt />

      {/* ---- La séance d'essai : traitée à part, volontairement ---- */}
      {hasTrial && (
        <div className="rounded-xl border-2 border-primary/40 bg-primary/5 p-4">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/15">
              <Gift className="h-5 w-5 text-primary" />
            </div>

            <div className="min-w-0 flex-1">
              <p className="font-semibold">
                {isFr ? 'Ta séance d\'essai t\'attend — elle est offerte' : 'Your free trial session is waiting'}
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                {isFr
                  ? 'Choisis le cours qui te convient dans le planning et réserve : tu n\'as rien à payer.'
                  : 'Pick the class that suits you in the schedule and book it — nothing to pay.'}
              </p>
              {/* L'échéance n'est nommée que dans la dernière semaine : plus tôt,
                  elle banalise la date au lieu de la signaler. */}
              {trialDaysLeft <= 7 && (
                <p className="text-sm font-medium text-primary mt-1">
                  {isFr
                    ? `Plus que ${trialDaysLeft} jour${trialDaysLeft > 1 ? 's' : ''} pour en profiter.`
                    : `Only ${trialDaysLeft} day${trialDaysLeft > 1 ? 's' : ''} left to use it.`}
                </p>
              )}
              <Button size="sm" className="mt-3" onClick={() => navigate('/schedule')}>
                {isFr ? 'Voir le planning et réserver' : 'See the schedule and book'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ---- Les communications ---- */}
      {notifications.length > 0 && (
        <div className="rounded-xl border">
          <div className="flex items-center justify-between px-3 py-2 border-b">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">
                {isFr ? 'Communications' : 'Updates'}
              </span>
              {unread > 0 && (
                <span className="rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-bold text-primary-foreground">
                  {unread}
                </span>
              )}
            </div>

            <div className="flex items-center gap-3">
              {/* Filtre : proposé seulement s'il y a un tri à faire. Sur une
                  liste entièrement lue ou entièrement non lue, il n'apprend
                  rien et encombre. */}
              {unread > 0 && readCount > 0 && (
                <div className="inline-flex rounded-md border bg-muted/30 p-0.5 text-[11px]">
                  {(['all', 'unread'] as const).map((f) => (
                    <button
                      key={f}
                      onClick={() => setFilter(f)}
                      className={cn(
                        'px-2 py-0.5 rounded transition-colors',
                        activeFilter === f ? 'bg-background shadow-sm font-medium' : 'text-muted-foreground hover:text-foreground',
                      )}
                    >
                      {f === 'all'
                        ? (isFr ? 'Tout' : 'All')
                        : (isFr ? 'Non lues' : 'Unread')}
                    </button>
                  ))}
                </div>
              )}

              {unread > 0 && (
                <button
                  onClick={markAllAsRead}
                  className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  {isFr ? 'Tout marquer lu' : 'Mark all read'}
                </button>
              )}

              {/* Ne s'affiche que s'il y a quelque chose à retirer : proposer
                  « effacer les lues » sans élément lu ne ferait rien. */}
              {readCount > 0 && (
                <button
                  onClick={dismissRead}
                  className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  {isFr ? 'Effacer les lues' : 'Clear read'}
                </button>
              )}
            </div>
          </div>

          <div className="p-1">
            {/* Le filtre « non lues » peut se vider sous les doigts du membre
                quand il marque la dernière. Le dire, plutôt que de laisser un
                cadre vide qui ressemble à une panne. */}
            {shown.length === 0 ? (
              <p className="px-3 py-4 text-center text-xs text-muted-foreground">
                {isFr ? 'Tout est lu.' : 'Everything is read.'}
              </p>
            ) : (
              shown.map((n) => (
                <CommunicationRow
                  key={n.id}
                  notif={n}
                  isFr={isFr}
                  locale={locale}
                  onRead={() => markAsRead(n.id)}
                  onDismiss={() => dismiss(n.id)}
                />
              ))
            )}
          </div>

          {(hidden > 0 || expanded) && (
            <button
              onClick={() => setExpanded((v) => !v)}
              className="flex w-full items-center justify-center gap-1 border-t py-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              {expanded
                ? <>{isFr ? 'Réduire' : 'Show less'} <ChevronUp className="h-3 w-3" /></>
                : <>{isFr ? `Voir ${hidden} de plus` : `Show ${hidden} more`} <ChevronDown className="h-3 w-3" /></>}
            </button>
          )}
        </div>
      )}
    </div>
  )
}

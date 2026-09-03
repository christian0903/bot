import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ClipboardCheck } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'

interface CoursSansPresences {
  class_id: string
  coach_nom: string | null
  intitule: string
  starts_at: string
  inscrits: number
}

/**
 * Rappelle au staff les cours dont les présences ne sont pas pointées.
 *
 * Le déclenchement des e-mails est posé ici plutôt que dans un cron : ce projet
 * n'a pas `pg_cron`, et c'est déjà le principe retenu pour la file d'e-mails
 * (voir `flush-email-queue.ts`). Le staff ouvrant l'application plusieurs fois
 * par jour, les rappels partent — mais « au prochain passage », pas à l'heure
 * dite. Le bandeau, lui, est immédiat : c'est lui qui fait le vrai travail.
 */
export function BandeauPresences() {
  const { roles } = useAuth()
  const navigate = useNavigate()
  const { i18n } = useTranslation()
  const isFr = i18n.language === 'fr'
  const [cours, setCours] = useState<CoursSansPresences[]>([])

  const estStaff = roles.some(r => ['coach', 'admin', 'super_admin'].includes(r))

  useEffect(() => {
    if (!estStaff) return

    let annule = false

    // La fonction filtre déjà sur l'appelant : un coach ne reçoit que ses
    // cours, un admin les voit tous.
    supabase.rpc('cours_sans_presences', { p_pour_rappel: false })
      .then(({ data, error }) => {
        if (annule || error) return
        setCours((data ?? []) as CoursSansPresences[])
      })

    // Poser les rappels par e-mail. Silencieux et jamais bloquant : un échec
    // laisse les cours non marqués, ils repartiront à la prochaine ouverture.
    supabase.rpc('envoyer_rappels_presences').then(() => {})

    return () => { annule = true }
  }, [estStaff])

  if (!estStaff || cours.length === 0) return null

  return (
    <div className="rounded-lg border border-amber-500/40 bg-amber-50 dark:bg-amber-950/30 p-3 flex items-start gap-3">
      <ClipboardCheck className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium">
          {cours.length === 1
            ? (isFr ? 'Un cours attend de valider les présences' : 'One class is awaiting attendance validation')
            : (isFr
                ? `${cours.length} cours attendent de valider les présences`
                : `${cours.length} classes are awaiting attendance validation`)}
        </p>
        <p className="text-xs text-muted-foreground mt-0.5">
          {/* Le plus ancien suffit à situer : c'est celui qui presse. */}
          {isFr ? 'Le plus ancien : ' : 'Oldest: '}
          {cours[0].intitule}
          {/* Le coach nomme : sur un bandeau vu aussi par les admins, il dit
              a qui le rappel s'adresse. Absent si le cours n'a pas de coach. */}
          {cours[0].coach_nom ? ` (${cours[0].coach_nom})` : ''}
          {' — '}
          {new Date(cours[0].starts_at).toLocaleDateString(isFr ? 'fr-BE' : 'en-GB', {
            weekday: 'long', day: 'numeric', month: 'long',
            hour: '2-digit', minute: '2-digit',
          })}
        </p>
      </div>
      <Button
        variant="outline"
        size="sm"
        className="shrink-0"
        onClick={() => navigate('/admin/schedule')}
      >
        {isFr ? 'Pointer' : 'Mark'}
      </Button>
    </div>
  )
}

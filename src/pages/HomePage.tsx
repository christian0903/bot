import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Logo } from '@/components/common/Logo'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { CalendarDays, ShoppingBag, Megaphone, ArrowRight } from 'lucide-react'
import { AnnonceMarkdown } from '@/components/common/AnnonceMarkdown'
import { motion } from 'framer-motion'
import { landingRouteFor } from '@/lib/landing-route'
import { SocialLinks } from '@/components/common/SocialLinks'

export function HomePage() {
  const { t } = useTranslation()
  const { user, roles, loading } = useAuth()
  const navigate = useNavigate()
  const [announcement, setAnnouncement] = useState<string | null>(null)

  // Redirection selon le rôle : un admin ou un coach n'a que faire du tableau
  // de bord client (ses packs, ses réservations) — il arrive sur son espace.
  //
  // Attendre `loading` est indispensable : `roles` démarre à [] et se remplit
  // de façon asynchrone. Sans cette garde, l'effet partait avec un tableau
  // vide, concluait « client » et redirigeait vers /dashboard — la navigation
  // étant déjà faite, l'arrivée des rôles ne la corrigeait plus.
  useEffect(() => {
    if (loading || !user) return
    navigate(landingRouteFor(roles), { replace: true })
  }, [user, roles, loading, navigate])

  useEffect(() => {
    supabase
      .from('app_settings')
      .select('value')
      .eq('key', 'announcement')
      .single()
      .then(({ data }) => {
        if (data?.value?.content && data.value.published) {
          setAnnouncement(data.value.content as string)
        }
      })
  }, [])

  return (
    <div className="space-y-8">
      {/* Hero */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center py-12 md:py-20"
      >
        <div className="inline-flex items-center justify-center h-16 w-16 rounded-2xl bg-primary/10 mb-6">
          <Logo taille="home" />
        </div>
        <h1 className="text-4xl md:text-5xl font-bold tracking-tight">
          {t('home.welcome').replace('Back on Track', '')}
          <span className="text-primary">Back on Track</span>
        </h1>
        <p className="mt-4 text-lg text-muted-foreground max-w-md mx-auto">
          {t('home.subtitle')}
        </p>
        <div className="flex gap-3 justify-center mt-8">
          <Button
            size="lg"
            className="rounded-full px-6 gap-2"
            onClick={() => navigate(user ? '/schedule' : '/auth')}
          >
            <CalendarDays className="h-5 w-5" />
            {t('home.viewSchedule')}
            <ArrowRight className="h-4 w-4" />
          </Button>
          <Button
            size="lg"
            variant="outline"
            className="rounded-full px-6 gap-2"
            onClick={() => navigate(user ? '/packs' : '/auth')}
          >
            <ShoppingBag className="h-5 w-5" />
            {t('home.buyPack')}
          </Button>
        </div>
      </motion.div>

      {/* Announcement */}
      {announcement && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <Card className="border-primary/20 bg-primary/5">
            <CardContent className="p-5">
              <div className="flex items-start gap-3">
                <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                  <Megaphone className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold mb-2">{t('home.announcements')}</h3>
                  <div className="md-annonce text-sm">
                    <AnnonceMarkdown contenu={announcement} />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Réseaux du studio. En bas de la page vitrine : le visiteur y arrive
          après avoir lu la présentation. Rien ne s'affiche si aucun lien
          n'est renseigné dans les Réglages. */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25 }}
        className="flex justify-center pt-2"
      >
        <SocialLinks />
      </motion.div>
    </div>
  )
}

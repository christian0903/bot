import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { CalendarDays, ShoppingBag, Megaphone, Dumbbell, ArrowRight } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { motion } from 'framer-motion'

export function HomePage() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const navigate = useNavigate()
  const [announcement, setAnnouncement] = useState<string | null>(null)

  // Redirect logged-in users to dashboard
  useEffect(() => {
    if (user) {
      navigate('/dashboard', { replace: true })
    }
  }, [user, navigate])

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
          <Dumbbell className="h-8 w-8 text-primary" />
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
                  <div className="prose prose-sm dark:prose-invert max-w-none">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{announcement}</ReactMarkdown>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}
    </div>
  )
}

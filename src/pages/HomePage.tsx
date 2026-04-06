import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { CalendarDays, ShoppingBag, Megaphone } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { motion } from 'framer-motion'

export function HomePage() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const navigate = useNavigate()
  const [announcement, setAnnouncement] = useState<string | null>(null)

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
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center py-12"
      >
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
          {t('home.welcome')}
        </h1>
        <p className="mt-4 text-lg text-muted-foreground">
          {t('home.subtitle')}
        </p>
        <div className="flex gap-4 justify-center mt-8">
          <Button size="lg" onClick={() => navigate(user ? '/schedule' : '/auth')}>
            <CalendarDays className="mr-2 h-5 w-5" />
            {t('home.viewSchedule')}
          </Button>
          <Button size="lg" variant="outline" onClick={() => navigate(user ? '/packs' : '/auth')}>
            <ShoppingBag className="mr-2 h-5 w-5" />
            {t('home.buyPack')}
          </Button>
        </div>
      </motion.div>

      {announcement && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Megaphone className="h-5 w-5 text-primary" />
                {t('home.announcements')}
              </CardTitle>
            </CardHeader>
            <CardContent className="prose prose-sm dark:prose-invert max-w-none">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{announcement}</ReactMarkdown>
            </CardContent>
          </Card>
        </motion.div>
      )}
    </div>
  )
}

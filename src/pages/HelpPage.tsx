import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '@/contexts/AuthContext'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { BookOpen, Shield } from 'lucide-react'
import { LoadingState } from '@/components/common/LoadingState'
import { MarkdownDoc } from '@/components/common/MarkdownDoc'

export function HelpPage() {
  const { i18n } = useTranslation()
  const { hasRole } = useAuth()
  const isFr = i18n.language === 'fr'
  const isAdminOrCoach = hasRole('admin') || hasRole('coach')

  const [userGuide, setUserGuide] = useState('')
  const [adminGuide, setAdminGuide] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const userFile = isFr ? '/guide-utilisateur.md' : '/guide-utilisateur-en.md'
    const adminFile = isFr ? '/guide-admin.md' : '/guide-admin-en.md'

    const promises = [
      fetch(userFile).then(r => r.text()),
    ]

    if (isAdminOrCoach) {
      promises.push(fetch(adminFile).then(r => r.text()))
    }

    Promise.all(promises)
      .then(([user, admin]) => {
        setUserGuide(user)
        if (admin) setAdminGuide(admin)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [isFr, isAdminOrCoach])

  if (loading) return <LoadingState />

  if (!isAdminOrCoach) {
    return <MarkdownDoc content={userGuide} isFr={isFr} />
  }

  return (
    <div className="space-y-4">
      <Tabs defaultValue="user">
        <TabsList>
          <TabsTrigger value="user" className="gap-1.5">
            <BookOpen className="h-4 w-4" />
            {isFr ? 'Guide utilisateur' : 'User guide'}
          </TabsTrigger>
          <TabsTrigger value="admin" className="gap-1.5">
            <Shield className="h-4 w-4" />
            {isFr ? 'Guide coach & admin' : 'Coach & admin guide'}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="user" className="mt-6">
          <MarkdownDoc content={userGuide} isFr={isFr} />
        </TabsContent>

        <TabsContent value="admin" className="mt-6">
          <MarkdownDoc content={adminGuide} isFr={isFr} />
        </TabsContent>
      </Tabs>
    </div>
  )
}

import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '@/contexts/AuthContext'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { BookOpen, Shield } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { LoadingState } from '@/components/common/LoadingState'

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

  const MarkdownContent = ({ content }: { content: string }) => (
    <div className="max-w-3xl mx-auto prose prose-sm dark:prose-invert max-w-none prose-headings:text-foreground prose-a:text-primary prose-strong:text-foreground prose-code:text-primary prose-code:bg-muted prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-table:text-sm">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
    </div>
  )

  if (!isAdminOrCoach) {
    return <MarkdownContent content={userGuide} />
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
          <MarkdownContent content={userGuide} />
        </TabsContent>

        <TabsContent value="admin" className="mt-6">
          <MarkdownContent content={adminGuide} />
        </TabsContent>
      </Tabs>
    </div>
  )
}

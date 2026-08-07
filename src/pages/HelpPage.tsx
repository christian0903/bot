import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '@/contexts/AuthContext'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { BookOpen, Shield } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { LoadingState } from '@/components/common/LoadingState'
import { MarkdownLink } from '@/components/common/MarkdownLink'

/**
 * Identifiant d'ancre depuis un titre.
 *
 * Les accents sont décomposés puis retirés : « Réserver » et « Reserver »
 * doivent produire la même ancre, sinon le lien du sommaire ne trouve pas sa
 * cible.
 */
function slugify(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

// Les classes `prose` de Tailwind ne produisaient rien : le plugin
// @tailwindcss/typography n'est pas installé. Le rendu passe désormais par
// la classe `.md-doc` définie dans index.css.
function MarkdownContent({ content, isFr }: { content: string; isFr: boolean }) {
  // Sommaire construit depuis les titres de niveau 2 du document : il suit
  // le guide sans entretien. Sans lui, trouver « annuler une réservation »
  // demandait de faire défiler 140 lignes — le contenu est bon, c'est la
  // navigation qui manquait.
  const sections = content
    .split('\n')
    .filter((l) => l.startsWith('## '))
    .map((l) => l.slice(3).trim())

  return (
    <div className="max-w-3xl mx-auto pb-12">
      {sections.length > 2 && (
        <nav className="mb-8 rounded-xl border bg-muted/30 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
            {isFr ? 'Sur cette page' : 'On this page'}
          </p>
          <ul className="space-y-1">
            {sections.map((s) => (
              <li key={s}>
                <a
                  href={`#${slugify(s)}`}
                  className="text-sm text-primary hover:underline underline-offset-2"
                >
                  {s}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      )}

      <div className="md-doc">
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={{
            a: MarkdownLink,
            // Ancre posée sur chaque titre : c'est ce qui rend le sommaire
            // cliquable. `scroll-mt` évite que l'en-tête masque la cible.
            h2: ({ children }) => (
              <h2 id={slugify(String(children))} className="scroll-mt-20">{children}</h2>
            ),
            // Un tableau large doit défiler dans son cadre, sans pousser la page.
            table: ({ children }) => (
              <div className="md-table-wrap"><table>{children}</table></div>
            ),
          }}
        >{content}</ReactMarkdown>
      </div>
    </div>
  )
}

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
    return <MarkdownContent content={userGuide} isFr={isFr} />
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
          <MarkdownContent content={userGuide} isFr={isFr} />
        </TabsContent>

        <TabsContent value="admin" className="mt-6">
          <MarkdownContent content={adminGuide} isFr={isFr} />
        </TabsContent>
      </Tabs>
    </div>
  )
}

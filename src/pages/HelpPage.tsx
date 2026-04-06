import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { LoadingState } from '@/components/common/LoadingState'

export function HelpPage() {
  const { i18n } = useTranslation()
  const [content, setContent] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const file = i18n.language === 'fr' ? '/guide-utilisateur.md' : '/guide-utilisateur-en.md'
    fetch(file)
      .then((res) => res.text())
      .then((text) => {
        setContent(text)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [i18n.language])

  if (loading) return <LoadingState />

  return (
    <div className="max-w-3xl mx-auto">
      <div className="prose prose-sm dark:prose-invert max-w-none">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
      </div>
    </div>
  )
}

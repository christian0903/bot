import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { MarkdownLink } from '@/components/common/MarkdownLink'

/**
 * Le rendu Markdown proprement dit, isolé dans son propre module.
 *
 * C'est cet isolement qui permet le `lazy()` de `AnnonceMarkdown` : la
 * bibliothèque n'est téléchargée qu'au moment où une annonce existe vraiment.
 * Export par défaut, exigé par `React.lazy`.
 */
export default function RenduMarkdown({ contenu }: { contenu: string }) {
  return (
    <ReactMarkdown remarkPlugins={[remarkGfm]} components={{ a: MarkdownLink }}>
      {contenu}
    </ReactMarkdown>
  )
}

import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
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

/**
 * Rend un document Markdown avec son sommaire.
 *
 * Les classes `prose` de Tailwind ne produisent rien ici : le plugin
 * @tailwindcss/typography n'est pas installé. Le rendu passe par la classe
 * `.md-doc` définie dans index.css.
 *
 * Le sommaire se construit depuis les titres de niveau 2 : il suit le document
 * sans entretien quand celui-ci évolue.
 */
export function MarkdownDoc({ content, isFr }: { content: string; isFr: boolean }) {
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
            // Les sous-sections aussi : le guide admin en compte cinquante-quatre,
            // et sa table des matières y renvoie. Sans ancre, chaque lien y
            // tombait dans le vide.
            h3: ({ children }) => (
              <h3 id={slugify(String(children))} className="scroll-mt-20">{children}</h3>
            ),
            // Les h4 aussi : le guide admin y renvoie d'un chapitre à l'autre
            // (deux façons d'effacer un compte, à ne pas confondre), et un lien
            // qui ne saute nulle part passe pour un bug de la page d'aide.
            h4: ({ children }) => (
              <h4 id={slugify(String(children))} className="scroll-mt-20">{children}</h4>
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

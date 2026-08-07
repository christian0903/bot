import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { LoadingState } from '@/components/common/LoadingState'
import { MarkdownDoc } from '@/components/common/MarkdownDoc'
import { fillLegalPlaceholders, loadStudioLegal } from '@/lib/studio-legal'

/**
 * Conditions générales de vente.
 *
 * Page PUBLIQUE, volontairement : l'inscription exige d'accepter les CGV, et
 * on ne peut pas demander d'accepter un document qu'il faudrait déjà être
 * inscrit pour lire. Le lien de la case à cocher pointe ici.
 *
 * Le contenu vit dans `public/cgv.md`, éditable sans toucher au code — un
 * document juridique évolue à son rythme, souvent par quelqu'un d'autre que le
 * développeur.
 */
export function TermsPage() {
  const { i18n } = useTranslation()
  const isFr = i18n.language === 'fr'

  const [content, setContent] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Le document et les coordonnées arrivent de deux sources : le fichier
    // Markdown, éditable sans développeur, et les Réglages, où le studio tient
    // ses mentions légales à jour. Les fusionner ici évite de les répéter.
    Promise.all([
      fetch('/cgv.md').then((r) => {
        if (!r.ok) throw new Error(String(r.status))
        return r.text()
      }),
      loadStudioLegal(),
    ])
      .then(([text, studio]) => {
        setContent(fillLegalPlaceholders(text, studio, isFr))
        setLoading(false)
      })
      .catch(() => {
        // Un document juridique introuvable ne doit pas laisser une page
        // blanche : on le dit, avec de quoi nous joindre.
        setContent(isFr
          ? '# Conditions générales\n\nCe document est momentanément indisponible. Contactez le studio pour en obtenir une copie.'
          : '# Terms and conditions\n\nThis document is temporarily unavailable. Please contact the studio for a copy.')
        setLoading(false)
      })
  }, [isFr])

  if (loading) return <LoadingState />

  return <MarkdownDoc content={content} isFr={isFr} />
}

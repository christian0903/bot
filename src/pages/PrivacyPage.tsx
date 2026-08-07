import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { LoadingState } from '@/components/common/LoadingState'
import { MarkdownDoc } from '@/components/common/MarkdownDoc'
import { fillLegalPlaceholders, loadStudioLegal } from '@/lib/studio-legal'

/**
 * Politique de confidentialité.
 *
 * Page PUBLIQUE : Apple exige une URL accessible sans compte pour publier sur
 * l'App Store, et le RGPD impose que l'information soit lisible avant de
 * consentir — donc avant l'inscription.
 *
 * Le contenu vit dans `public/politique-confidentialite.md`, éditable sans
 * toucher au code.
 */
export function PrivacyPage() {
  const { i18n } = useTranslation()
  const isFr = i18n.language === 'fr'

  const [content, setContent] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Le document et les coordonnées arrivent de deux sources : le fichier
    // Markdown, éditable sans développeur, et les Réglages, où le studio tient
    // ses mentions légales à jour. Les fusionner ici évite de les répéter.
    Promise.all([
      fetch('/politique-confidentialite.md').then((r) => {
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
        setContent(isFr
          ? '# Politique de confidentialité\n\nCe document est momentanément indisponible. Contactez le studio pour en obtenir une copie.'
          : '# Privacy policy\n\nThis document is temporarily unavailable. Please contact the studio for a copy.')
        setLoading(false)
      })
  }, [isFr])

  if (loading) return <LoadingState />

  return <MarkdownDoc content={content} isFr={isFr} />
}

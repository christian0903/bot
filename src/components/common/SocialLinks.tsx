import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { MessageCircle, Star, Globe } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'

/**
 * Liens vers les réseaux du studio.
 *
 * Les logos de marques sont dessinés ici en SVG : Lucide les a retirés de sa
 * bibliothèque pour raisons de droits, et ajouter un paquet entier pour cinq
 * icônes serait disproportionné. WhatsApp, l'avis Google et le site web
 * utilisent des icônes génériques, qui existent bien dans Lucide.
 *
 * Rien n'est affiché tant que rien n'est renseigné : un studio sans TikTok ne
 * voit pas d'icône TikTok. Le composant disparaît entièrement si aucun lien
 * n'est configuré.
 */

interface StudioLinks {
  instagram_url?: string
  facebook_url?: string
  tiktok_url?: string
  youtube_url?: string
  whatsapp_number?: string
  google_review_url?: string
  website_url?: string
}

const InstagramIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
    <rect width="20" height="20" x="2" y="2" rx="5" />
    <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
    <line x1="17.5" x2="17.51" y1="6.5" y2="6.5" />
  </svg>
)

const FacebookIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
    <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" />
  </svg>
)

const YoutubeIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
    <path d="M2.5 17a24.12 24.12 0 0 1 0-10 2 2 0 0 1 1.4-1.4 49.56 49.56 0 0 1 16.2 0A2 2 0 0 1 21.5 7a24.12 24.12 0 0 1 0 10 2 2 0 0 1-1.4 1.4 49.55 49.55 0 0 1-16.2 0A2 2 0 0 1 2.5 17" />
    <path d="m10 15 5-3-5-3z" />
  </svg>
)

const TiktokIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
    <path d="M9 12a4 4 0 1 0 4 4V4a5 5 0 0 0 5 5" />
  </svg>
)

export function SocialLinks({ className }: { className?: string }) {
  const { i18n } = useTranslation()
  const isFr = i18n.language === 'fr'
  const [links, setLinks] = useState<StudioLinks | null>(null)

  useEffect(() => {
    let cancelled = false
    supabase
      .from('app_settings')
      .select('value')
      .eq('key', 'studio_info')
      .maybeSingle()
      .then(({ data }) => {
        if (!cancelled) setLinks((data?.value as StudioLinks) ?? null)
      })
    return () => { cancelled = true }
  }, [])

  if (!links) return null

  // Le numéro WhatsApp est saisi en clair par le studio : on retire tout ce qui
  // n'est pas un chiffre, sinon un « +32 470 ... » recopié tel quel produirait
  // un lien mort.
  const waDigits = links.whatsapp_number?.replace(/\D/g, '')

  const items = [
    { key: 'instagram', href: links.instagram_url, label: 'Instagram', icon: <InstagramIcon /> },
    { key: 'facebook', href: links.facebook_url, label: 'Facebook', icon: <FacebookIcon /> },
    { key: 'tiktok', href: links.tiktok_url, label: 'TikTok', icon: <TiktokIcon /> },
    { key: 'youtube', href: links.youtube_url, label: 'YouTube', icon: <YoutubeIcon /> },
    {
      key: 'whatsapp',
      href: waDigits ? `https://wa.me/${waDigits}` : undefined,
      label: 'WhatsApp',
      icon: <MessageCircle className="h-4 w-4" />,
    },
    {
      key: 'google',
      href: links.google_review_url,
      label: isFr ? 'Laisser un avis' : 'Leave a review',
      icon: <Star className="h-4 w-4" />,
    },
    {
      key: 'website',
      href: links.website_url,
      label: isFr ? 'Site web' : 'Website',
      icon: <Globe className="h-4 w-4" />,
    },
  ].filter((i) => i.href)

  if (items.length === 0) return null

  return (
    <div className={cn('flex items-center gap-2 flex-wrap', className)}>
      {items.map((item) => (
        <a
          key={item.key}
          href={item.href}
          target="_blank"
          // noreferrer en plus de noopener : la page ouverte ne doit pas
          // savoir d'où vient le clic.
          rel="noopener noreferrer"
          title={item.label}
          aria-label={item.label}
          className="flex h-9 w-9 items-center justify-center rounded-full border text-muted-foreground transition-colors hover:border-primary/40 hover:bg-primary/5 hover:text-primary"
        >
          {item.icon}
        </a>
      ))}
    </div>
  )
}

import type { AnchorHTMLAttributes } from 'react'
import { Capacitor } from '@capacitor/core'
import { Browser } from '@capacitor/browser'

// Anchor rendu par react-markdown : sur natif (iOS/Android) on ouvre dans le
// navigateur système via @capacitor/browser — sinon le clic remplacerait
// la WebView par le site externe et l'utilisateur sortirait de l'app.
// Sur web, on garde un <a> standard avec target="_blank" + rel sécurité.
export function MarkdownLink({ href, children, ...rest }: AnchorHTMLAttributes<HTMLAnchorElement>) {
  if (!href) return <a {...rest}>{children}</a>

  const isNative = Capacitor.isNativePlatform()
  const isExternal = /^https?:\/\//i.test(href)

  if (isNative && isExternal) {
    return (
      <a
        href={href}
        onClick={(e) => {
          e.preventDefault()
          Browser.open({ url: href }).catch(() => {})
        }}
        {...rest}
      >
        {children}
      </a>
    )
  }

  return (
    <a
      href={href}
      target={isExternal ? '_blank' : undefined}
      rel={isExternal ? 'noopener noreferrer' : undefined}
      {...rest}
    >
      {children}
    </a>
  )
}

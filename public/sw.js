// La version est réécrite à la construction par le plugin `versionner-le-sw`
// de vite.config.ts. En développement elle reste à 'dev'.
const APP_VERSION = '__SW_VERSION__'
const CACHE_NAME = `bot-${APP_VERSION}`
const STATIC_ASSETS = ['/', '/index.html']

// Install: cache static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  )
  // Pas de skipWaiting() ici : ce service worker attend en réserve, et
  // l'application propose au membre de recharger. S'activer tout de suite
  // remplacerait le code sous ses pieds — un formulaire à moitié rempli ou une
  // réservation en cours de validation partirait avec.
})

// L'application demande la bascule quand le membre a cliqué « Recharger ».
self.addEventListener('message', (event) => {
  if (event.data === 'ACTIVER_MAINTENANT') self.skipWaiting()
})

// Activate: clean old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  )
  self.clients.claim()
})

// Fetch: network-first strategy
// Skip caching for Supabase, Stripe, and external API requests
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url)

  // Don't intercept external requests (Supabase, Stripe, analytics, etc.)
  if (
    url.origin !== self.location.origin ||
    url.pathname.startsWith('/functions/') ||
    url.pathname.startsWith('/auth/') ||
    url.pathname.startsWith('/rest/') ||
    url.pathname.startsWith('/realtime/')
  ) {
    return
  }

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Cache successful GET responses
        if (event.request.method === 'GET' && response.status === 200) {
          const clone = response.clone()
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone))
        }
        return response
      })
      .catch(() => {
        // Fallback to cache when offline
        return caches.match(event.request).then((cached) => {
          if (cached) return cached
          // For navigation requests, return cached index.html (SPA fallback)
          if (event.request.mode === 'navigate') {
            return caches.match('/index.html')
          }
          return new Response('Offline', { status: 503 })
        })
      })
  )
})

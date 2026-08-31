// La version est réécrite à la construction par le plugin `versionner-le-sw`
// de vite.config.ts. En développement elle reste à 'dev'.
const APP_VERSION = '__SW_VERSION__'
const CACHE_NAME = `bot-${APP_VERSION}`
const STATIC_ASSETS = ['/', '/index.html']

// Install: cache static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    // `addAll` rejette en bloc dès qu'UNE requête échoue, et un install qui
    // rejette ne passe jamais en attente : la nouvelle version ne s'installe
    // alors plus jamais, et le membre reste des versions entières en arrière
    // sans aucun signal. Un préchargement raté n'a pas à coûter cela — la
    // stratégie « réseau d'abord » ira chercher la ressource au premier accès.
    caches.open(CACHE_NAME).then((cache) =>
      Promise.all(STATIC_ASSETS.map((url) => cache.add(url).catch(() => {})))
    )
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
        // Un fichier construit introuvable ne peut vouloir dire qu'une chose :
        // la page en cache reclame un bundle que le serveur n'a plus. Ces noms
        // portent une empreinte du contenu — ils ne changent jamais autrement,
        // et un 404 dessus n'arrive pas en fonctionnement normal.
        //
        // Sans ce rattrapage, la page reste blanche : le 404 n'est pas mis en
        // cache, donc rien ne se repare, et vider l'historique n'y change rien
        // — il ne touche ni au service worker ni au Cache Storage. Un client
        // l'a signale le 31 aout, bloque sur un lien qui ne « marchait plus ».
        //
        // On se retire alors completement : le rechargement suivant repart du
        // serveur, sur un index.html a jour.
        if (response.status === 404 && url.pathname.startsWith('/assets/')) {
          caches.keys()
            .then((keys) => Promise.all(keys.map((k) => caches.delete(k))))
            .then(() => self.registration.unregister())
            .then(() => self.clients.matchAll({ type: 'window' }))
            .then((clients) => clients.forEach((c) => c.navigate(c.url)))
            .catch(() => {})
          return response
        }

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

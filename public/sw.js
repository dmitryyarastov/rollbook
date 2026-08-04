/*
 * Rollbook service worker — precache the app shell at install (the build
 * injects the hashed asset list, so the app is offline-ready after the very
 * first visit), then network-first with cache fallback at runtime. Data
 * lives in localStorage and never touches the network.
 */
const CACHE = 'rollbook-dev' /* __CACHE_NAME__ */
const PRECACHE = ['./', './manifest.webmanifest'] /* __PRECACHE__ */

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return
  if (new URL(request.url).origin !== location.origin) return
  event.respondWith(
    fetch(request)
      .then((res) => {
        if (res.ok) {
          const copy = res.clone()
          caches.open(CACHE).then((cache) => cache.put(request, copy))
        }
        return res
      })
      .catch(async () => {
        // ignoreVary: vite serves assets with `Vary: Origin`, which would
        // reject module-script requests (they carry an Origin header the
        // install-time cache entries lack). URL identity is enough here.
        const hit = await caches.match(request, { ignoreVary: true })
        if (hit) return hit
        if (request.mode === 'navigate') {
          const shell = await caches.match('./', { ignoreVary: true })
          if (shell) return shell
        }
        return Response.error()
      }),
  )
})

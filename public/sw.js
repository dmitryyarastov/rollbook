/*
 * Rollbook service worker — precache the app shell at install (the build
 * injects the hashed asset list, so the app is offline-ready after the very
 * first visit). At runtime: navigations are network-first (a fresh deploy's
 * HTML names new hashed assets, so it is picked up on the next load), while
 * everything else is cache-first (the assets are content-hashed, hence
 * immutable — refetching them is pure waste; activate purges old caches).
 * Data lives in localStorage and never touches the network.
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

// ignoreVary: vite serves assets with `Vary: Origin`, which would reject
// module-script requests (they carry an Origin header the install-time cache
// entries lack). URL identity is enough here.
const fromCache = (request) => caches.match(request, { ignoreVary: true })

async function fetchAndCache(request) {
  const res = await fetch(request)
  if (res.ok) {
    const copy = res.clone()
    caches.open(CACHE).then((cache) => cache.put(request, copy))
  }
  return res
}

async function networkFirst(request) {
  try {
    return await fetchAndCache(request)
  } catch {
    const hit = await fromCache(request)
    if (hit) return hit
    const shell = await fromCache('./')
    if (shell) return shell
    return Response.error()
  }
}

async function cacheFirst(request) {
  const hit = await fromCache(request)
  if (hit) return hit
  try {
    return await fetchAndCache(request)
  } catch {
    return Response.error()
  }
}

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return
  if (new URL(request.url).origin !== location.origin) return
  event.respondWith(request.mode === 'navigate' ? networkFirst(request) : cacheFirst(request))
})

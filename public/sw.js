// Rainbow Kitten service worker. Goal: always the newest version when online, still playable offline.
// - Pages, version.json: straight from the network (no HTTP cache), cache only as offline fallback.
// - Hashed build files (assets/): never change, so cache first.
// - Other files (sprites, audio): revalidated with the server every time, cache as offline fallback.
const BUILD = '__BUILD_ID__'
const CACHE = `rk-${BUILD}`
const PRECACHE = __PRECACHE__

self.addEventListener('install', (event) => {
  self.skipWaiting()
  event.waitUntil(
    caches.open(CACHE).then((c) =>
      Promise.all(PRECACHE.map((url) => c.add(new Request(url, { cache: 'reload' })).catch(() => undefined))),
    ),
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

async function networkFirst(req, mode) {
  const cache = await caches.open(CACHE)
  try {
    const res = await fetch(req, { cache: mode })
    if (res.ok && req.method === 'GET') cache.put(req, res.clone())
    return res
  } catch (e) {
    const hit = await cache.match(req, { ignoreSearch: true })
    if (hit) return hit
    if (req.mode === 'navigate') {
      const index = await cache.match('./index.html')
      if (index) return index
    }
    throw e
  }
}

async function cacheFirst(req) {
  const cache = await caches.open(CACHE)
  const hit = await cache.match(req)
  if (hit) return hit
  const res = await fetch(req)
  if (res.ok) cache.put(req, res.clone())
  return res
}

self.addEventListener('fetch', (event) => {
  const req = event.request
  if (req.method !== 'GET') return
  const url = new URL(req.url)
  if (url.origin !== self.location.origin) return
  if (req.mode === 'navigate' || url.pathname.endsWith('/version.json') || url.pathname.endsWith('.html')) {
    event.respondWith(networkFirst(req, 'no-store'))
  } else if (url.pathname.includes('/assets/')) {
    event.respondWith(cacheFirst(req))
  } else {
    event.respondWith(networkFirst(req, 'no-cache'))
  }
})

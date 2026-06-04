// pCycle Service Worker
// Caches static shell only — all GAS/live requests go straight to network

const CACHE_NAME = 'pcycle-v1';

const STATIC_ASSETS = [
  '/pcycle/',
  '/pcycle/index.html',
  '/pcycle/manifest.json',
  '/pcycle/icon-192.png',
  '/pcycle/icon-512.png',
];

// Hosts that must NEVER be cached (live data / GAS backend)
const BYPASS_HOSTS = [
  'script.google.com',
  'googleapis.com',
  'unpkg.com',
  'fonts.googleapis.com',
  'fonts.gstatic.com',
  'cdnjs.cloudflare.com',
];

// ── INSTALL: cache static shell ──────────────────────────────
self.addEventListener('install', event => {
  console.log('[SW] Installing pCycle v1');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting())
  );
});

// ── ACTIVATE: remove old caches ──────────────────────────────
self.addEventListener('activate', event => {
  console.log('[SW] Activating pCycle v1');
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(k => k !== CACHE_NAME)
          .map(k => {
            console.log('[SW] Deleting old cache:', k);
            return caches.delete(k);
          })
      )
    ).then(() => self.clients.claim())
  );
});

// ── FETCH: cache-first for shell, network-only for live data ─
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Always bypass these hosts — send straight to network, no caching
  const isBypassed = BYPASS_HOSTS.some(host => url.hostname.includes(host));
  if (isBypassed) {
    return; // Let browser handle normally
  }

  // Only handle GET requests
  if (event.request.method !== 'GET') return;

  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) {
        return cached; // Serve from cache
      }

      // Fetch from network, cache successful responses
      return fetch(event.request)
        .then(response => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => {
          // Offline fallback: return app shell for navigation requests
          if (event.request.mode === 'navigate') {
            return caches.match('/pcycle/index.html');
          }
        });
    })
  );
});

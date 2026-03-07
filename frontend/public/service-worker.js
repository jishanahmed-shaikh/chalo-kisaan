/* Chalo Kisaan Service Worker v2.0 */
const CACHE_NAME = 'chalo-kisaan-v2';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/logo192.png',
  '/logo512.png',
  '/apple-touch-icon.png',
  '/static/js/main.chunk.js',
  '/static/js/bundle.js',
  '/static/css/main.chunk.css',
];

// Install: cache all static assets
self.addEventListener('install', (event) => {
  console.log('[SW] Installing Chalo Kisaan Service Worker');
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch((err) => {
        // Don't fail install if some assets aren't available yet
        console.log('[SW] Some assets not cached:', err);
      });
    })
  );
});

// Activate: clean old caches
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating Chalo Kisaan Service Worker');
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

// Fetch: network-first for API, cache-first for static assets
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET and chrome-extension requests
  if (request.method !== 'GET' || url.protocol === 'chrome-extension:') return;

  // API calls: network only (don't cache)
  if (url.pathname.startsWith('/api/') || url.hostname.includes('api.chalokisaan')) {
    event.respondWith(fetch(request).catch(() =>
      new Response(JSON.stringify({ error: 'Offline - please check your connection' }), {
        headers: { 'Content-Type': 'application/json' },
        status: 503,
      })
    ));
    return;
  }

  // Static assets: cache-first, fallback to network
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;

      return fetch(request).then((response) => {
        // Only cache successful responses for same-origin or fonts
        if (
          response.status === 200 &&
          (url.origin === self.location.origin || url.hostname.includes('fonts.g'))
        ) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
        }
        return response;
      }).catch(() => {
        // Offline fallback for navigation requests
        if (request.mode === 'navigate') {
          return caches.match('/index.html');
        }
      });
    })
  );
});

// Background sync for plan generation when back online
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-plan') {
    console.log('[SW] Background sync triggered');
  }
});

// Push notifications (future feature)
self.addEventListener('push', (event) => {
  if (!event.data) return;
  const data = event.data.json();
  self.registration.showNotification(data.title || 'Chalo Kisaan', {
    body: data.body || 'Your plan is ready!',
    icon: '/logo192.png',
    badge: '/logo192.png',
  });
});

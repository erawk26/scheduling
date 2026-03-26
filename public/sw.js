const CACHE_NAME = 'ke-agenda-v3';
const APP_SHELL = [
  '/',
  '/dashboard',
  '/dashboard/appointments',
  '/dashboard/clients',
  '/dashboard/services',
  '/dashboard/routes',
  '/dashboard/weather',
  '/dashboard/settings',
  '/dashboard/settings/messaging',
  '/dashboard/settings/billing',
  '/dashboard/settings/profile',
  '/dashboard/chat',
  '/offline',
];
const STATIC_EXTENSIONS = /\.(js|css|png|jpg|jpeg|svg|ico|woff|woff2)$/;

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // API requests: network-only, let the app handle offline
  if (url.pathname.startsWith('/api/')) {
    return;
  }

  // Static assets: cache-first
  if (STATIC_EXTENSIONS.test(url.pathname)) {
    event.respondWith(
      caches.match(request).then(
        (cached) => cached || fetch(request).then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        })
      )
    );
    return;
  }

  // Navigation requests: network-first with offline fallback
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() =>
        caches.match(request).then(
          (cached) => cached || caches.match('/offline') || caches.match('/')
        )
      )
    );
    return;
  }

  // Default: network-first
  event.respondWith(
    fetch(request).catch(() => caches.match(request))
  );
});

// Background Sync: retry queued mutations when connectivity returns
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-mutations') {
    event.waitUntil(
      // Post message to all clients to trigger sync
      self.clients.matchAll().then((clients) => {
        clients.forEach((client) => {
          client.postMessage({ type: 'SYNC_MUTATIONS' });
        });
      })
    );
  }
});

// Listen for sync registration requests from the app
self.addEventListener('message', (event) => {
  if (event.data?.type === 'REGISTER_SYNC') {
    if (self.registration.sync) {
      self.registration.sync.register('sync-mutations').catch(() => {
        // Background Sync not supported, app handles via online events
      });
    }
  }
});

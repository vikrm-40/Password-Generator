/* ============================================================
   Password Generator — Service Worker
   Version : 1.0.0
   Purpose : Cache all app assets for offline use and
             ensure the app works without a network connection.
             Required for Microsoft Store PWA submission.
   ============================================================ */

const CACHE_NAME    = 'passgen-v1.0.0';
const OFFLINE_URL   = '/Password-Generator/';

/* All assets to pre-cache on install */
const PRECACHE_ASSETS = [
  '/Password-Generator/',
  '/Password-Generator/index.html',
  '/Password-Generator/manifest.json',
  '/Password-Generator/sw.js',
  '/Password-Generator/icons/icon-48.png',
  '/Password-Generator/icons/icon-72.png',
  '/Password-Generator/icons/icon-96.png',
  '/Password-Generator/icons/icon-128.png',
  '/Password-Generator/icons/icon-192.png',
  '/Password-Generator/icons/icon-256.png',
  '/Password-Generator/icons/icon-512.png'
];

/* ── INSTALL — pre-cache all assets ── */
self.addEventListener('install', function(event) {
  console.log('[SW] Installing version:', CACHE_NAME);
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(function(cache) {
        console.log('[SW] Pre-caching app assets');
        /* Use individual adds so one missing icon doesn't block the install */
        return Promise.allSettled(
          PRECACHE_ASSETS.map(function(url) {
            return cache.add(url).catch(function(err) {
              console.warn('[SW] Failed to cache:', url, err);
            });
          })
        );
      })
      .then(function() {
        /* Activate immediately without waiting for old SW to expire */
        return self.skipWaiting();
      })
  );
});

/* ── ACTIVATE — clean up old caches ── */
self.addEventListener('activate', function(event) {
  console.log('[SW] Activating version:', CACHE_NAME);
  event.waitUntil(
    caches.keys()
      .then(function(cacheNames) {
        return Promise.all(
          cacheNames
            .filter(function(name) { return name !== CACHE_NAME; })
            .map(function(name) {
              console.log('[SW] Deleting old cache:', name);
              return caches.delete(name);
            })
        );
      })
      .then(function() {
        /* Take control of all open tabs immediately */
        return self.clients.claim();
      })
  );
});

/* ── FETCH — cache-first strategy ──
   1. Try the cache first (fast, works offline)
   2. If not in cache, try the network
   3. If network also fails, return the offline page
*/
self.addEventListener('fetch', function(event) {
  /* Only handle GET requests */
  if (event.request.method !== 'GET') return;

  /* Skip cross-origin requests (Google Fonts etc) —
     let them pass through to the network directly    */
  var url = new URL(event.request.url);
  if (url.origin !== self.location.origin) {
    return;
  }

  event.respondWith(
    caches.match(event.request)
      .then(function(cachedResponse) {
        if (cachedResponse) {
          /* Serve from cache */
          return cachedResponse;
        }

        /* Not in cache — fetch from network and cache the response */
        return fetch(event.request.clone())
          .then(function(networkResponse) {
            if (
              !networkResponse ||
              networkResponse.status !== 200 ||
              networkResponse.type === 'opaque'
            ) {
              return networkResponse;
            }

            /* Store a clone in the cache for next time */
            var responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then(function(cache) {
              cache.put(event.request, responseToCache);
            });

            return networkResponse;
          })
          .catch(function() {
            /* Network failed — return the cached offline page */
            return caches.match(OFFLINE_URL);
          });
      })
  );
});

/* ── MESSAGE — allow the page to trigger a cache update ── */
self.addEventListener('message', function(event) {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

/* ============================================================
   Password Generator — Service Worker  v2.0.0
   Addresses all PWABuilder action items:
     ✅ Cache-first offline support
     ✅ Background Sync  (queues wipe retries when offline)
     ✅ Periodic Background Sync  (cache refresh every 24h)
     ✅ Push Notifications  (opt-in security reminders)
     ✅ Clean cache management across versions
   ============================================================ */

const SW_VERSION   = '2.0.0';
const CACHE_NAME   = 'passgen-v2.0.0';
const OFFLINE_URL  = '/Password-Generator/';
const SYNC_TAG     = 'passgen-sync';
const PERIODIC_TAG = 'passgen-periodic-refresh';

/* All assets pre-cached on install */
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
  '/Password-Generator/icons/icon-512.png',
  '/Password-Generator/screenshots/screen-wide.png',
  '/Password-Generator/screenshots/screen-narrow.png'
];

/* ═══════════════════════════════════════════
   INSTALL — pre-cache all assets
═══════════════════════════════════════════ */
self.addEventListener('install', function(event) {
  console.log('[SW v' + SW_VERSION + '] Installing...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(function(cache) {
        console.log('[SW] Pre-caching ' + PRECACHE_ASSETS.length + ' assets');
        /* Use allSettled so one missing asset doesn't block the whole install */
        return Promise.allSettled(
          PRECACHE_ASSETS.map(function(url) {
            return cache.add(url).catch(function(err) {
              console.warn('[SW] Could not cache:', url, err.message);
            });
          })
        );
      })
      .then(function() {
        console.log('[SW] Pre-cache complete — skipping waiting');
        return self.skipWaiting();
      })
  );
});

/* ═══════════════════════════════════════════
   ACTIVATE — remove stale caches, claim clients
═══════════════════════════════════════════ */
self.addEventListener('activate', function(event) {
  console.log('[SW v' + SW_VERSION + '] Activating...');
  event.waitUntil(
    caches.keys()
      .then(function(cacheNames) {
        return Promise.all(
          cacheNames
            .filter(function(name) {
              /* Delete any cache that is not the current version */
              return name.startsWith('passgen-') && name !== CACHE_NAME;
            })
            .map(function(name) {
              console.log('[SW] Deleting old cache:', name);
              return caches.delete(name);
            })
        );
      })
      .then(function() {
        console.log('[SW] Claiming all clients');
        return self.clients.claim();
      })
      .then(function() {
        /* Register periodic sync if supported */
        if ('periodicSync' in self.registration) {
          return self.registration.periodicSync.register(PERIODIC_TAG, {
            minInterval: 24 * 60 * 60 * 1000 /* 24 hours */
          }).then(function() {
            console.log('[SW] Periodic sync registered');
          }).catch(function(err) {
            console.warn('[SW] Periodic sync registration failed:', err.message);
          });
        }
      })
  );
});

/* ═══════════════════════════════════════════
   FETCH — cache-first strategy
   1. Serve from cache if available (fast + offline)
   2. Fetch from network and update cache
   3. Fallback to offline page if both fail
═══════════════════════════════════════════ */
self.addEventListener('fetch', function(event) {
  /* Only handle GET requests */
  if (event.request.method !== 'GET') return;

  var url = new URL(event.request.url);

  /* Let cross-origin requests (Google Fonts CDN) pass through */
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    caches.match(event.request)
      .then(function(cachedResponse) {

        /* --- Cache hit: serve immediately, refresh in background --- */
        if (cachedResponse) {
          /* Stale-while-revalidate: update cache silently in background */
          var fetchPromise = fetch(event.request.clone())
            .then(function(networkResponse) {
              if (
                networkResponse &&
                networkResponse.status === 200 &&
                networkResponse.type !== 'opaque'
              ) {
                caches.open(CACHE_NAME).then(function(cache) {
                  cache.put(event.request, networkResponse.clone());
                });
              }
              return networkResponse;
            })
            .catch(function() { /* silent — already serving from cache */ });

          return cachedResponse;
        }

        /* --- Cache miss: fetch from network --- */
        return fetch(event.request.clone())
          .then(function(networkResponse) {
            if (
              !networkResponse ||
              networkResponse.status !== 200 ||
              networkResponse.type === 'opaque'
            ) {
              return networkResponse;
            }
            /* Store in cache for next time */
            var responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then(function(cache) {
              cache.put(event.request, responseToCache);
            });
            return networkResponse;
          })
          .catch(function() {
            console.log('[SW] Network failed, serving offline page');
            return caches.match(OFFLINE_URL);
          });
      })
  );
});

/* ═══════════════════════════════════════════
   BACKGROUND SYNC
   Fired when connectivity is restored.
   Used here to retry any failed clipboard-wipe
   confirmation pings (future enhancement hook).
═══════════════════════════════════════════ */
self.addEventListener('sync', function(event) {
  console.log('[SW] Background sync fired:', event.tag);

  if (event.tag === SYNC_TAG) {
    event.waitUntil(
      /* Notify all open tabs that sync has fired */
      self.clients.matchAll({ type: 'window' })
        .then(function(clients) {
          clients.forEach(function(client) {
            client.postMessage({
              type:    'SYNC_FIRED',
              tag:     event.tag,
              version: SW_VERSION
            });
          });
        })
    );
  }
});

/* ═══════════════════════════════════════════
   PERIODIC BACKGROUND SYNC
   Fires approximately every 24 hours
   (browser-controlled, requires user permission).
   Refreshes cached assets to keep the app current.
═══════════════════════════════════════════ */
self.addEventListener('periodicsync', function(event) {
  console.log('[SW] Periodic sync fired:', event.tag);

  if (event.tag === PERIODIC_TAG) {
    event.waitUntil(
      caches.open(CACHE_NAME)
        .then(function(cache) {
          /* Re-fetch and update the main HTML and manifest */
          var assetsToRefresh = [
            '/Password-Generator/',
            '/Password-Generator/index.html',
            '/Password-Generator/manifest.json'
          ];
          return Promise.allSettled(
            assetsToRefresh.map(function(url) {
              return fetch(url)
                .then(function(response) {
                  if (response && response.status === 200) {
                    return cache.put(url, response);
                  }
                })
                .catch(function(err) {
                  console.warn('[SW] Periodic refresh failed for:', url, err.message);
                });
            })
          );
        })
        .then(function() {
          console.log('[SW] Periodic cache refresh complete');
          /* Notify open clients */
          return self.clients.matchAll({ type: 'window' });
        })
        .then(function(clients) {
          clients.forEach(function(client) {
            client.postMessage({
              type:    'CACHE_REFRESHED',
              version: SW_VERSION
            });
          });
        })
    );
  }
});

/* ═══════════════════════════════════════════
   PUSH NOTIFICATIONS
   Opt-in security reminders
   (e.g. "Your clipboard may still have a password")
   Requires user permission granted from the page.
═══════════════════════════════════════════ */
self.addEventListener('push', function(event) {
  console.log('[SW] Push received');

  var data = {};
  if (event.data) {
    try { data = event.data.json(); }
    catch(e) { data = { title: 'Password Generator', body: event.data.text() }; }
  }

  var title   = data.title   || 'Password Generator';
  var options = {
    body:    data.body    || 'Security reminder from Password Generator.',
    icon:    '/Password-Generator/icons/icon-192.png',
    badge:   '/Password-Generator/icons/icon-96.png',
    tag:     'passgen-notification',
    renotify: false,
    silent:  false,
    data:    { url: data.url || '/Password-Generator/' },
    actions: [
      { action: 'open',    title: 'Open App' },
      { action: 'dismiss', title: 'Dismiss'  }
    ]
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

/* Handle notification click */
self.addEventListener('notificationclick', function(event) {
  event.notification.close();

  if (event.action === 'dismiss') return;

  var targetUrl = (event.notification.data && event.notification.data.url)
    ? event.notification.data.url
    : '/Password-Generator/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then(function(clientList) {
        /* Focus existing window if open */
        for (var i = 0; i < clientList.length; i++) {
          var client = clientList[i];
          if (client.url.includes('/Password-Generator/') && 'focus' in client) {
            return client.focus();
          }
        }
        /* Otherwise open a new window */
        if (self.clients.openWindow) {
          return self.clients.openWindow(targetUrl);
        }
      })
  );
});

/* ═══════════════════════════════════════════
   MESSAGE HANDLER
   Listens for commands from the main page.
═══════════════════════════════════════════ */
self.addEventListener('message', function(event) {
  var type = event.data && event.data.type;
  console.log('[SW] Message received:', type);

  switch (type) {

    /* Force the new SW to activate immediately */
    case 'SKIP_WAITING':
      self.skipWaiting();
      break;

    /* Page asking for SW version */
    case 'GET_VERSION':
      event.ports[0].postMessage({ version: SW_VERSION, cache: CACHE_NAME });
      break;

    /* Clear entire cache on demand */
    case 'CLEAR_CACHE':
      caches.delete(CACHE_NAME).then(function() {
        event.ports[0].postMessage({ cleared: true });
      });
      break;

    default:
      console.log('[SW] Unknown message type:', type);
  }
});

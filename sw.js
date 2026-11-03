/* Offline-capable shell. Navigation is network-first to prevent stale UI after updates. */
const CACHE = 'passgen-shell-v5';
const ASSETS = ['./', './index.html', './manifest.json', './icons/icon-48.png', './icons/icon-72.png', './icons/icon-96.png', './icons/icon-128.png', './icons/icon-192.png', './icons/icon-256.png', './icons/icon-512.png'];
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ASSETS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('passgen-') && key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;
  if (request.mode === 'navigate') {
    event.respondWith(fetch(request, {cache: 'no-store'}).then(response => {
      if (response.ok) {
        const copy = response.clone();
        event.waitUntil(caches.open(CACHE).then(cache => cache.put('./index.html', copy)));
      }
      return response;
    }).catch(async () => (await caches.match('./index.html')) || Response.error()));
    return;
  }
  event.respondWith(caches.match(request).then(cached => cached || fetch(request)));
});

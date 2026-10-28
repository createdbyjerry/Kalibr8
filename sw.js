// Service worker: caches the whole app on first load so it runs with no network.
const CACHE = 'kalibr8-v3';
const ASSETS = [
  './', './index.html', './manifest.webmanifest', './css/app.css',
  './js/app.bundle.js', './js/main.js', './js/store.js', './js/geo.js', './js/map.js', './js/feed.js', './js/sim.js', './js/ui.js',
  './js/views/drones.js', './js/views/flights.js', './js/views/flight-hud.js', './js/views/review.js',
  './js/views/annotate.js', './js/views/reports.js', './js/views/settings.js',
  './assets/k8-mark.svg', './assets/k8-icon.svg', './assets/icon-192.png', './assets/icon-512.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

// Cache-first for app files; network falls back to cache for navigations.
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  e.respondWith(
    caches.match(req, { ignoreSearch: true }).then((hit) => hit || fetch(req).then((res) => {
      const copy = res.clone();
      caches.open(CACHE).then((c) => c.put(req, copy));
      return res;
    }).catch(() => (req.mode === 'navigate' ? caches.match('./index.html') : undefined)))
  );
});

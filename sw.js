// ══════════════════════════════════════════════
// DeutschDaily Service Worker
// Cache-first strategy for app shell assets
// ══════════════════════════════════════════════

const CACHE_VERSION = 'dd-v1';
const APP_SHELL = [
  '/DEDaily.html',
  '/src/styles.css',
  '/src/styles/base.css',
  '/src/styles/layout.css',
  '/src/styles/cards.css',
  '/src/styles/stats.css',
  '/src/styles/progress.css',
  '/src/styles/history.css',
  '/src/styles/practice.css',
  '/src/styles/library.css',
  '/src/styles/responsive.css',
  '/src/styles/enhancements.css',
  '/src/content.js',
  '/src/learning.js',
  '/src/frequency-dictionary-data.js',
  '/src/backup-presets.js',
  '/src/storage.js',
  '/src/app.js',
  '/src/assets/logo.svg',
  '/src/assets/icon-512.png',
  '/manifest.json'
];

// Install — pre-cache app shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => {
      return cache.addAll(APP_SHELL);
    }).then(() => self.skipWaiting())
  );
});

// Activate — clean old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys
          .filter((key) => key !== CACHE_VERSION)
          .map((key) => caches.delete(key))
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch — cache-first for app shell, network-first for everything else
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Only handle same-origin requests
  if (url.origin !== self.location.origin) {
    return;
  }

  // For navigation requests, try network first then fall back to cached HTML
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          const clone = response.clone();
          caches.open(CACHE_VERSION).then((cache) => cache.put(event.request, clone));
          return response;
        })
        .catch(() => caches.match('/DEDaily.html'))
    );
    return;
  }

  // For all other same-origin requests: cache-first
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) {
        // Return cached version and update cache in background
        const fetchPromise = fetch(event.request).then((response) => {
          if (response.ok) {
            caches.open(CACHE_VERSION).then((cache) => cache.put(event.request, response));
          }
          return response.clone();
        }).catch(() => {});
        return cached;
      }
      // Not in cache — fetch from network and cache it
      return fetch(event.request).then((response) => {
        if (response.ok && url.pathname.match(/\.(css|js|svg|png|jpg|woff2?)$/)) {
          const clone = response.clone();
          caches.open(CACHE_VERSION).then((cache) => cache.put(event.request, clone));
        }
        return response;
      });
    })
  );
});

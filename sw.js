// ══════════════════════════════════════════════
// DeutschDaily Service Worker
// Cache-first strategy for app shell assets
// ══════════════════════════════════════════════

importScripts('/src/lid-catalog.js?v=20261120');

const CACHE_VERSION = 'dd-v13-lid-single-pass';
const LID_IMAGES = [...new Set(LID_QUESTIONS.flatMap(
  question => (question.figures || []).map(figure => `/src/assets/lid/${figure.file}`),
))];
const APP_SHELL = [
  '/DEDaily.html',
  '/src/styles.css?v=lid-lernstand-20261121',
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
  '/src/styles/lid.css?v=lernstand-20261121',
  '/src/content.js?v=history-20260523',
  '/src/learning.js?v=history-20260523',
  '/src/frequency-dictionary-data.js?v=freq-20260623',
  '/src/backup-presets.js?v=20260816',
  '/src/storage.js?v=lid-20261120',
  '/src/lid-catalog.js?v=20261120',
  '/src/lid-learning.js?v=single-pass-20261121',
  '/src/lid-view.js?v=lernstand-20261121',
  '/src/app.js?v=lid-home-20261120',
  '/resources/deutsch-a1-b1-kursplan.html',
  '/src/assets/logo.svg',
  '/src/assets/fonts/source-sans-3.woff2',
  '/src/assets/icon-512.png',
  '/manifest.json',
  ...LID_IMAGES,
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
          .filter((key) => key.startsWith('dd-') && key !== CACHE_VERSION)
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
        .catch(async () => {
          const path = url.pathname === '/' ? '/DEDaily.html' : url.pathname;
          return (await caches.match(path)) || Response.error();
        })
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

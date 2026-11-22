// Bump the cache version when any precached asset changes.
importScripts('/src/lid-catalog.js?v=20261120');

const CACHE_VERSION = 'dd-v15-offline-app';
const APP_PAGE = '/DEDaily.html';
const COURSE_PAGE = '/resources/deutsch-a1-b1-kursplan.html';
const LID_IMAGES = [...new Set(LID_QUESTIONS.flatMap(
  question => (question.figures || []).map(figure => `/src/assets/lid/${figure.file}`),
))];
const APP_SHELL = [
  APP_PAGE,
  '/src/styles.css?v=lid-themen-20261122',
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
  '/src/styles/lid.css?v=themen-20261122',
  '/src/styles/pwa.css?v=1',
  '/src/content.js?v=history-20260523',
  '/src/learning.js?v=history-20260523',
  '/src/frequency-dictionary-data.js?v=freq-20260623',
  '/src/backup-presets.js?v=20260816',
  '/src/storage.js?v=pwa-1',
  '/src/lid-catalog.js?v=20261120',
  '/src/lid-learning.js?v=pwa-1',
  '/src/lid-view.js?v=themen-20261122',
  '/src/app.js?v=pwa-1',
  '/src/pwa.js?v=1',
  COURSE_PAGE,
  '/src/assets/logo.svg',
  '/src/assets/fonts/source-sans-3.woff2',
  '/src/assets/icon-180.png',
  '/src/assets/icon-192.png',
  '/src/assets/icon-512.png',
  '/manifest.json',
  ...LID_IMAGES,
];
const SHELL_ASSETS = new Set(APP_SHELL);

async function missingAssets(cache) {
  const urls = new Set((await cache.keys()).map(request => request.url));
  return APP_SHELL.filter(path => !urls.has(new URL(path, self.location.origin).href));
}

function precache(cache, paths) {
  return cache.addAll(paths.map(path => new Request(path, { cache: 'reload' })));
}

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_VERSION).then(cache => precache(cache, APP_SHELL)));
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(key => /^dd-v\d/.test(key) && key !== CACHE_VERSION)
      .map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  const { request } = event;
  const { origin, pathname, search } = new URL(request.url);
  if (origin !== self.location.origin || request.method !== 'GET') return;

  // All app views share the same HTML. Query parameters still reach the app.
  const path = request.mode === 'navigate' && (pathname === '/' || pathname === APP_PAGE) ? APP_PAGE
    : pathname === COURSE_PAGE && (request.mode === 'navigate' || request.destination === 'iframe') ? COURSE_PAGE
    : pathname + search;
  if (!SHELL_ASSETS.has(path)) return;

  event.respondWith(
    caches.match(path, { cacheName: CACHE_VERSION }).then(response => response || fetch(request)),
  );
});

self.addEventListener('message', event => {
  const port = event.ports[0];
  const repair = event.data === 'dd-offline-repair';
  if (!port || (!repair && event.data !== 'dd-offline-status')) return;

  event.waitUntil((async () => {
    if (!repair && !await caches.has(CACHE_VERSION)) return false;
    const cache = await caches.open(CACHE_VERSION);
    const missing = await missingAssets(cache);
    if (!missing.length) return true;
    if (!repair) return false;
    await precache(cache, missing);
    return true;
  })().then(ready => port.postMessage(ready), () => port.postMessage(false)));
});

/* أبو مالك PWA service worker
   تغيير CACHE_VERSION يجبر المتصفحات على تنزيل النسخة الجديدة بعد النشر.
*/
const CACHE_VERSION = 'abu-malek-v8';
const APP_SHELL = [
  './',
  './index.html',
  './articles.html',
  './styles.css',
  './config.js',
  './app.js',
  './market-live.js',
  './manifest.webmanifest',
  './offline.html',
  './privacy.html',
  './terms.html',
  './assets/icon.svg'
];

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_VERSION);
    await cache.addAll(APP_SHELL);
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(key => key.startsWith('abu-malek-') && key !== CACHE_VERSION)
      .map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);

  if (request.method !== 'GET' || url.origin !== self.location.origin) return;

  // HTML وملفات الواجهة: الشبكة أولاً حتى تظهر التحديثات فور نشرها.
  event.respondWith((async () => {
    const cache = await caches.open(CACHE_VERSION);
    try {
      const response = await fetch(request, { cache: 'no-store' });
      if (response && response.ok) {
        cache.put(request, response.clone()).catch(() => {});
      }
      return response;
    } catch (error) {
      const cached = await cache.match(request);
      if (cached) return cached;
      if (request.mode === 'navigate') {
        return (await cache.match('./offline.html')) || Response.error();
      }
      return Response.error();
    }
  })());
});

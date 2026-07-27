'use strict';

const CACHE_NAME = 'rds-quote-pro-shell-v5-stage5';
const OFFLINE_PAGE = './index.html';

// Only these public, static application files are eligible for browser caching.
const APP_SHELL = [
  './index.html',
  './manifest.webmanifest',
  './icons/icon-32.png',
  './icons/icon-180.png',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

const CACHEABLE_PATHS = new Set(
  APP_SHELL.map(item => new URL(item, self.registration.scope).pathname)
);

function isCacheableStaticRequest(request, url) {
  if (request.method !== 'GET') return false;
  if (url.origin !== self.location.origin) return false;
  if (url.search || url.hash) return false;
  if (!CACHEABLE_PATHS.has(url.pathname)) return false;

  // Never cache dynamically generated or sensitive response types.
  const destination = request.destination;
  return destination === 'style' ||
    destination === 'script' ||
    destination === 'image' ||
    destination === 'manifest' ||
    destination === 'font' ||
    url.pathname.endsWith('/index.html');
}

function responseMayBeCached(response) {
  if (!response || !response.ok || response.type !== 'basic') return false;

  const cacheControl = response.headers.get('Cache-Control') || '';
  if (/no-store|private/i.test(cacheControl)) return false;

  const contentType = (response.headers.get('Content-Type') || '').toLowerCase();
  if (contentType.includes('application/pdf')) return false;
  if (contentType.includes('application/json')) return false;

  return true;
}

async function cacheAppShell() {
  const cache = await caches.open(CACHE_NAME);

  // Cache files individually so a missing optional icon does not prevent
  // the service worker from installing.
  await Promise.allSettled(
    APP_SHELL.map(async path => {
      const request = new Request(path, { cache: 'reload' });
      const response = await fetch(request);
      if (responseMayBeCached(response)) {
        await cache.put(request, response);
      }
    })
  );
}

self.addEventListener('install', event => {
  event.waitUntil(cacheAppShell());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const cacheNames = await caches.keys();
    await Promise.all(
      cacheNames
        .filter(name => name !== CACHE_NAME)
        .map(name => caches.delete(name))
    );
    await self.clients.claim();
  })());
});

self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // Google Apps Script, approval links, APIs, PDFs, and every other
  // cross-origin request always go directly to the network.
  if (url.origin !== self.location.origin) return;

  // HTML navigation is network-first so users receive the newest build.
  // The cached index is used only when the network is unavailable.
  if (request.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const response = await fetch(request, { cache: 'no-store' });

        // Cache only the clean app entry point, never customer-specific,
        // query-string, approval, or generated routes.
        const isCleanAppEntry = !url.search && !url.hash &&
          (url.pathname === new URL('./', self.registration.scope).pathname ||
           url.pathname === new URL('./index.html', self.registration.scope).pathname);

        if (isCleanAppEntry && responseMayBeCached(response)) {
          const cache = await caches.open(CACHE_NAME);
          await cache.put(new Request(OFFLINE_PAGE), response.clone());
        }
        return response;
      } catch (error) {
        const cached = await caches.match(OFFLINE_PAGE);
        if (cached) return cached;
        throw error;
      }
    })());
    return;
  }

  // Only explicitly allowlisted static assets may use cache-first behavior.
  if (!isCacheableStaticRequest(request, url)) return;

  event.respondWith((async () => {
    const cached = await caches.match(request);
    if (cached) return cached;

    const response = await fetch(request);
    if (responseMayBeCached(response)) {
      const cache = await caches.open(CACHE_NAME);
      await cache.put(request, response.clone());
    }
    return response;
  })());
});

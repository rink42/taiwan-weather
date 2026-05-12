'use strict';

const CACHE_VER = 'tw-weather-v6';
const STATIC_ASSETS = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './icons.js',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
];

// ── Install：預先快取靜態資源 ─────────────────────────────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_VER)
      .then(cache => cache.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting())
  );
});

// ── Activate：清除舊版快取 ────────────────────────────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(k => k !== CACHE_VER).map(k => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

// ── Fetch：API 走網路優先，其餘快取優先 ───────────────────────────────
self.addEventListener('fetch', event => {
  const url = event.request.url;

  // CWA / NLSC API → Network-Only（天氣與定位資料必須即時）
  if (url.includes('opendata.cwa.gov.tw') || url.includes('api.nlsc.gov.tw')) {
    event.respondWith(fetch(event.request));
    return;
  }

  // 靜態資源 → Cache-First
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(response => {
        // 只快取成功的 GET 請求
        if (!response || response.status !== 200 || event.request.method !== 'GET') {
          return response;
        }
        const toCache = response.clone();
        caches.open(CACHE_VER).then(cache => cache.put(event.request, toCache));
        return response;
      });
    })
  );
});

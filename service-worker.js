const CACHE_NAME = 'lolita-wardrobe-cache-v1';

const APP_SHELL = [
  './',
  './index.html',
  './manifest.json',
  './icon.PNG',

  'https://fastly.jsdelivr.net/npm/vant@4/lib/index.css',
  'https://fastly.jsdelivr.net/npm/echarts@5.5.0/dist/echarts.min.js',
  'https://fastly.jsdelivr.net/npm/vue@3',
  'https://fastly.jsdelivr.net/npm/vant@4/lib/vant.min.js',
  'https://fastly.jsdelivr.net/npm/localforage@1.10.0/dist/localforage.min.js'
];

self.addEventListener('install', (event) => {
  self.skipWaiting();

  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(APP_SHELL).catch((error) => {
        console.warn('[ServiceWorker] 部分资源预缓存失败：', error);
      });
    })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    Promise.all([
      self.clients.claim(),
      caches.keys().then((keys) => {
        return Promise.all(
          keys
            .filter((key) => key !== CACHE_NAME)
            .map((key) => caches.delete(key))
        );
      })
    ])
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;

  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // HTML 页面：优先网络，失败走缓存
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put('./index.html', responseClone);
          });
          return response;
        })
        .catch(() => {
          return caches.match('./index.html').then((cached) => {
            return cached || caches.match('./');
          });
        })
    );
    return;
  }

  // CDN 静态资源：优先缓存，后台更新
  if (url.origin.includes('jsdelivr.net')) {
    event.respondWith(
      caches.match(request).then((cached) => {
        const fetchPromise = fetch(request)
          .then((networkResponse) => {
            if (networkResponse && networkResponse.ok) {
              const responseClone = networkResponse.clone();
              caches.open(CACHE_NAME).then((cache) => {
                cache.put(request, responseClone);
              });
            }
            return networkResponse;
          })
          .catch(() => cached);

        return cached || fetchPromise;
      })
    );
    return;
  }

  // 本站静态资源：优先缓存，失败网络
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;

      return fetch(request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.ok) {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, responseClone);
            });
          }
          return networkResponse;
        })
        .catch(() => {
          if (request.destination === 'image') {
            return caches.match('./icon.PNG');
          }
        });
    })
  );
});
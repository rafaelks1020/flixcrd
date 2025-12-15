// Service Worker para Pflix PWA
const CACHE_NAME = 'pflix-v2';
const IMAGE_CACHE = 'pflix-images-v1';
const IMAGE_MAX_ENTRIES = 150;
const API_PUBLIC_CACHE = 'pflix-api-public-v1';
const API_PUBLIC_MAX_ENTRIES = 120;

// Arquivos para cache inicial
const PRECACHE_ASSETS = [
  '/offline',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png'
];

// Instalação - cachear assets essenciais
self.addEventListener('install', (event) => {
  console.log('[SW] Instalando...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[SW] Cache aberto');
        return cache.addAll(PRECACHE_ASSETS);
      })
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('push', (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    try {
      payload = event.data ? JSON.parse(event.data.text()) : {};
    } catch {
      payload = {};
    }
  }

  const title = payload.title || 'Pflix';
  const message = payload.message || payload.body || '';
  const data = payload.data || {};
  const url = data.url || payload.url || '/';

  const options = {
    body: message,
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-72.png',
    data: { ...data, url },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const targetUrl = event.notification?.data?.url || '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientsArr) => {
      for (const client of clientsArr) {
        try {
          if ('focus' in client) {
            client.navigate?.(targetUrl);
            return client.focus();
          }
        } catch {
        }
      }
      return self.clients.openWindow(targetUrl);
    })
  );
});

// Ativação - limpar caches antigos
self.addEventListener('activate', (event) => {
  console.log('[SW] Ativando...');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME && cacheName !== IMAGE_CACHE && cacheName !== API_PUBLIC_CACHE) {
            console.log('[SW] Removendo cache antigo:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

async function trimCache(cache, maxEntries) {
  try {
    const keys = await cache.keys();
    if (keys.length <= maxEntries) return;
    const excess = keys.length - maxEntries;
    for (let i = 0; i < excess; i += 1) {
      await cache.delete(keys[i]);
    }
  } catch {
  }
}

// Fetch - estratégia Network First (sempre busca da rede, fallback para cache)
self.addEventListener('fetch', (event) => {
  // Ignorar requisições não-GET
  if (event.request.method !== 'GET') return;
  
  const url = new URL(event.request.url);
  const isSameOrigin = url.origin === self.location.origin;

  const isPublicApi =
    isSameOrigin &&
    url.pathname.startsWith('/api/') &&
    (
      url.pathname === '/api/genres' ||
      url.pathname.startsWith('/api/genres/') ||
      url.pathname === '/api/titles'
    ) &&
    !event.request.headers.get('authorization');

  if (isPublicApi) {
    event.respondWith(
      caches.open(API_PUBLIC_CACHE).then((cache) =>
        cache.match(event.request).then((cached) => {
          const fetchPromise = fetch(event.request)
            .then((response) => {
              if (response && response.ok) {
                cache.put(event.request, response.clone());
                trimCache(cache, API_PUBLIC_MAX_ENTRIES);
              }
              return response;
            })
            .catch(() => undefined);

          if (cached) {
            fetchPromise.catch(() => undefined);
            return cached;
          }

          return fetchPromise.then((res) => res || caches.match('/offline'));
        })
      )
    );
    return;
  }

  // Ignorar requisições de API (sempre da rede)
  if (isSameOrigin && url.pathname.startsWith('/api/')) return;
  
  // Ignorar requisições de vídeo/stream
  if (
    isSameOrigin &&
    (url.pathname.includes('/hls/') ||
      /\.(m3u8|ts|mp4|m4s|cmfv|cmfa)$/i.test(url.pathname))
  ) {
    return;
  }

  if (isSameOrigin && event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(() => caches.match('/offline'))
    );
    return;
  }

  const isImageRequest =
    event.request.destination === 'image' ||
    /\.(png|jpg|jpeg|webp|gif|svg)$/i.test(url.pathname);

  const isTmdbImage = url.origin === 'https://image.tmdb.org' && isImageRequest;
  if (isTmdbImage) {
    event.respondWith(
      caches.open(IMAGE_CACHE).then((cache) =>
        cache.match(event.request).then((cached) => {
          const fetchPromise = fetch(event.request)
            .then((response) => {
              if (response) {
                cache.put(event.request, response.clone());
                trimCache(cache, IMAGE_MAX_ENTRIES);
              }
              return response;
            })
            .catch(() => undefined);

          if (cached) {
            fetchPromise.catch(() => undefined);
            return cached;
          }

          return fetchPromise.then((res) => res || Response.error());
        })
      )
    );
    return;
  }

  if (!isSameOrigin) return;

  const isNextStatic = url.pathname.startsWith('/_next/static/');
  const isIcon = url.pathname.startsWith('/icons/');
  const isAssetFile = /\.(css|js|json|woff2?|ttf|otf|png|jpg|jpeg|webp|gif|svg|ico)$/i.test(url.pathname);

  if (!isNextStatic && !isIcon && !isAssetFile) return;

  event.respondWith(
    caches.match(event.request).then((cached) => {
      const fetchPromise = fetch(event.request)
        .then((response) => {
          if (response && response.status === 200) {
            const responseClone = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseClone);
            });
          }
          return response;
        })
        .catch(() => undefined);

      if (cached) {
        return cached;
      }

      return fetchPromise.then((res) => res || caches.match('/offline'));
    })
  );
});

// Mensagens do cliente
self.addEventListener('message', (event) => {
  if (event.data === 'skipWaiting' || event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

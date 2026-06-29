const CACHE_NAME = 'diamkey-v2';
const urlsToCache = [
    '/home',
    '/css/style.css',
    '/js/diamkey-core.js',
    '/js/diamkey-router.js',
    '/js/diamkey-ui.js',
    '/js/diamkey-wall.js',
    '/js/diamkey-gpx.js',
    '/js/diamkey-qr.js',
    '/js/diamkey-bot.js',
    '/js/diamkey-users.js',
    '/js/diamkey-scanner.js',
    '/assets/favicon.ico',
    '/assets/logo-192.png',
    '/assets/logo-512.png'
];

self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME).then(cache => cache.addAll(urlsToCache).catch(err => {
            console.error('[SW] Cache preload failed:', err);
        }))
    );
});

self.addEventListener('fetch', event => {
    // Для навигационных запросов всегда пытаемся взять из сети, чтобы не получить chrome-error
    if (event.request.mode === 'navigate') {
        event.respondWith(
            fetch(event.request).catch(() => {
                // Если сеть недоступна, пробуем отдать cached /index.html (fallback)
                return caches.match('/home').then(response => response || caches.match('/index.html'));
            })
        );
        return;
    }

    // Для всех остальных запросов: кеш → сеть
    event.respondWith(
        caches.match(event.request).then(cachedResponse => {
            if (cachedResponse) return cachedResponse;
            return fetch(event.request).then(response => {
                // Не кешируем ответы с ошибками или не GET
                if (!response || response.status !== 200 || response.type !== 'basic') {
                    return response;
                }
                const responseToCache = response.clone();
                caches.open(CACHE_NAME).then(cache => {
                    cache.put(event.request, responseToCache);
                });
                return response;
            }).catch(() => {
                // Если сеть недоступна для ресурса, возвращаем пустоту, чтобы не сломать страницу
                return new Response(null, { status: 404 });
            });
        })
    );
});

self.addEventListener('activate', event => {
    const cacheWhitelist = [CACHE_NAME];
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    if (!cacheWhitelist.includes(cacheName)) {
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
});

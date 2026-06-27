const CACHE_NAME = 'diamkey-v1';
const urlsToCache = [
    '/home',
    '/css/style.css',
    '/js/diamkey-core.js',
    '/js/diamkey-router.js',
    '/js/diamkey-ui.js',
    '/js/diamkey-wall.js',
    '/js/diamkey-gpx.js',
    '/js/diamkey-add.js',
    '/js/diamkey-qr.js',
    '/js/diamkey-bot.js',
    '/js/diamkey-users.js',
    '/js/diamkey-settings.js',
    '/assets/favicon.ico',
    '/assets/logo-192.png',
    '/assets/logo-512.png'
];

self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME).then(cache => cache.addAll(urlsToCache))
    );
});

self.addEventListener('fetch', event => {
    event.respondWith(
        caches.match(event.request).then(response => response || fetch(event.request))
    );
});

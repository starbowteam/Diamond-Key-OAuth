const SUPABASE_URL = 'https://pqgwrokpizeelfrjmgoc.supabase.co';
const PROXY_URL = 'https://corsproxy.io/?url='; // публичный CORS-прокси

self.addEventListener('install', event => {
    // принудительно активируем SW без ожидания
    self.skipWaiting();
});

self.addEventListener('activate', event => {
    // берём под контроль все страницы сразу
    event.waitUntil(clients.claim());
});

self.addEventListener('fetch', event => {
    const url = event.request.url;

    // Перехватываем только запросы к Supabase
    if (url.startsWith(SUPABASE_URL)) {
        const encodedUrl = encodeURIComponent(url);
        const proxyUrl = PROXY_URL + encodedUrl;

        event.respondWith(
            fetch(proxyUrl, {
                method: event.request.method,
                headers: event.request.headers,
                body: event.request.body,
                mode: 'cors',
            })
        );
    }
});

// HR Connect — Service Worker
const CACHE_NAME = 'hr-connect-v1';
const STATIC_ASSETS = [
    '/',
    '/index.html',
    '/icons/icon-512.svg',
];

// Install: cache static assets
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
    );
    self.skipWaiting();
});

// Activate: clean old caches
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) =>
            Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
        )
    );
    self.clients.claim();
});

// Fetch: Network-first for API, Cache-first for assets
self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);

    // Skip non-GET and API calls — always go to network
    if (event.request.method !== 'GET' || url.pathname.startsWith('/api/')) {
        return;
    }

    event.respondWith(
        caches.match(event.request).then((cached) => {
            const fetched = fetch(event.request).then((response) => {
                // Cache successful responses
                if (response.ok) {
                    const clone = response.clone();
                    caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
                }
                return response;
            }).catch(() => cached); // Offline fallback to cache

            return cached || fetched;
        })
    );
});

// Push Notification handler
self.addEventListener('push', (event) => {
    let data = { title: 'HR Connect', body: 'มีการแจ้งเตือนใหม่', icon: '/icons/icon-512.svg' };
    try {
        data = { ...data, ...event.data.json() };
    } catch (e) {
        data.body = event.data?.text() || data.body;
    }

    event.waitUntil(
        self.registration.showNotification(data.title, {
            body: data.body,
            icon: data.icon || '/icons/icon-512.svg',
            badge: '/icons/icon-192.png',
            vibrate: [200, 100, 200],
            data: data.url || '/',
        })
    );
});

// Notification click — open the app
self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    event.waitUntil(
        self.clients.matchAll({ type: 'window' }).then((clients) => {
            for (const client of clients) {
                if (client.url.includes(self.location.origin) && 'focus' in client) {
                    return client.focus();
                }
            }
            return self.clients.openWindow(event.notification.data || '/');
        })
    );
});

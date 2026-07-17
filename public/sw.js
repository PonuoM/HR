// HR Connect — Service Worker
const CACHE_NAME = 'hr-connect-v3';
// Separate cache for face-api models so app updates don't wipe the heavy
// 7MB recognition weights. Bump only when /models/* file contents change.
const MODELS_CACHE = 'hr-connect-models-v1';
const STATIC_ASSETS = [
    '/',
    '/index.html',
    '/icons/icon-512.svg',
];
const MODEL_ASSETS = [
    '/models/tiny_face_detector_model-weights_manifest.json',
    '/models/tiny_face_detector_model.bin',
    '/models/face_landmark_68_model-weights_manifest.json',
    '/models/face_landmark_68_model.bin',
    '/models/face_recognition_model-weights_manifest.json',
    '/models/face_recognition_model.bin',
];

// Install: cache static assets + precache face-api models so first
// clock-in doesn't pay the 7MB download cost.
self.addEventListener('install', (event) => {
    event.waitUntil(Promise.all([
        caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS)),
        // Model precache is best-effort — don't block SW install if a single
        // file 404s (e.g., during dev when build hasn't copied them yet).
        caches.open(MODELS_CACHE).then((cache) =>
            Promise.all(MODEL_ASSETS.map((url) =>
                cache.add(url).catch((err) => console.warn('[SW] model precache miss', url, err))
            ))
        ),
    ]));
    self.skipWaiting();
});

// Activate: clean old caches (but keep current models cache)
self.addEventListener('activate', (event) => {
    const KEEP = new Set([CACHE_NAME, MODELS_CACHE]);
    event.waitUntil(
        caches.keys().then((keys) =>
            Promise.all(keys.filter((k) => !KEEP.has(k)).map((k) => caches.delete(k)))
        )
    );
    self.clients.claim();
});

// Fetch: cache-first for /models/* (immutable), network-first for everything else
self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);

    // Skip non-GET and API calls — always go to network
    if (event.request.method !== 'GET' || url.pathname.startsWith('/api/') || url.pathname.startsWith('/hr-mobile-connect/api/')) {
        return;
    }

    // Cache-first for face-api models — they're static binary weights that
    // never change without a redeploy, and downloading 7MB on every reload
    // tanks first-scan UX on slow mobile networks.
    if (url.pathname.startsWith('/models/')) {
        event.respondWith(
            caches.open(MODELS_CACHE).then(async (cache) => {
                const cached = await cache.match(event.request);
                if (cached) return cached;
                const response = await fetch(event.request);
                if (response.ok) cache.put(event.request, response.clone());
                return response;
            })
        );
        return;
    }

    // Network-first: try network, fall back to cache if offline
    event.respondWith(
        fetch(event.request)
            .then((response) => {
                if (response.ok) {
                    const clone = response.clone();
                    caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
                }
                return response;
            })
            .catch(() => caches.match(event.request))
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

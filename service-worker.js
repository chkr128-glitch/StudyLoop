const CACHE_NAME = 'studyloop-cache-v3'; // バージョンを更新
const urlsToCache = [
    './',
    './index.html',
    './icon.png',
    './apple-touch-icon.png',
    './manifest.json',
    './src/main.js',
    './src/components/authUI.js',
    './src/components/dashboard.js',
    './src/components/calendar.js',
    './src/components/analytics.js',
    './src/components/settings.js',
    './src/components/drill.js',
    './src/components/flashcard.js',
    './src/components/store.js',
    './src/components/ui.js',
    './src/components/taskUI.js',
    './src/components/timeline.js',
    './src/components/tutorial.js',
    './src/components/pastExams.js',
    './src/services/auth.js',
    './src/services/db.js',
    './src/utils/constants.js',
    './src/utils/helpers.js',
    './src/config/firebase.js'
];

self.addEventListener('install', event => {
    self.skipWaiting();
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                console.log('Opened cache');
                return cache.addAll(urlsToCache);
            })
    );
});

self.addEventListener('fetch', event => {
    const url = new URL(event.request.url);
    
    // FirestoreやGoogle APIなどの外部通信はキャッシュせず、必ずネットワークを使う
    if (!event.request.url.startsWith('http') || 
        url.hostname.includes('googleapis.com') || 
        url.hostname.includes('firebaseio.com') ||
        url.origin !== self.location.origin) {
        return;
    }

    event.respondWith(
        caches.match(event.request)
            .then(response => {
                if (response) {
                    return response;
                }
                return fetch(event.request).then(
                    function(response) {
                        if(!response || response.status !== 200 || response.type !== 'basic') {
                            return response;
                        }
                        var responseToCache = response.clone();
                        caches.open(CACHE_NAME)
                            .then(function(cache) {
                                cache.put(event.request, responseToCache);
                            });
                        return response;
                    }
                );
            })
    );
});

self.addEventListener('activate', event => {
    const cacheWhitelist = [CACHE_NAME];
    event.waitUntil(self.clients.claim());
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    if (cacheWhitelist.indexOf(cacheName) === -1) {
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
});

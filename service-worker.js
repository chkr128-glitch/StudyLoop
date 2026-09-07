const CACHE_NAME = 'studyloop-cache-v2'; // バージョンを上げて古いキャッシュを強制更新
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
    './src/components/taskUI.js',      // 追加
    './src/components/timeline.js',    // 追加
    './src/components/tutorial.js',    // 追加
    './src/components/pastExams.js',   // 追加
    './src/services/auth.js',
    './src/services/db.js',
    './src/utils/constants.js',
    './src/utils/helpers.js',
    './src/config/firebase.js'
];

self.addEventListener('install', event => {
    // 新しいService Workerがすぐにアクティブになるようにする
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
    // http または https のリクエスト以外（拡張機能の通信など）は無視する
    if (!event.request.url.startsWith('http')) {
        return;
    }

    event.respondWith(
        caches.match(event.request)
            .then(response => {
                // キャッシュがあればそれを返す
                if (response) {
                    return response;
                }
                
                // キャッシュがない場合はネットワークへリクエスト
                return fetch(event.request).then(
                    function(response) {
                        // 有効なレスポンスかチェック
                        if(!response || response.status !== 200 || response.type !== 'basic') {
                            return response;
                        }

                        // レスポンスをクローンしてキャッシュに保存
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

// 古いキャッシュの削除
self.addEventListener('activate', event => {
    const cacheWhitelist = [CACHE_NAME];
    
    // 新しいService Workerがコントロールをすぐに引き継ぐようにする
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

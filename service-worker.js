const CACHE_NAME = 'studyloop-cache-v1';
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
    './src/services/auth.js',
    './src/services/db.js',
    './src/utils/constants.js',
    './src/utils/helpers.js',
    './src/config/firebase.js'
];

self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                console.log('Opened cache');
                return cache.addAll(urlsToCache);
            })
    );
});

self.addEventListener('fetch', event => {
    // ★ 修正ポイント: http または https のリクエスト以外（拡張機能の通信など）は無視する
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
```eof

この修正により、拡張機能の通信を無視するようになり、エラーが出なくなります。
修正後は、ブラウザのキャッシュをクリアするか、スーパーリロード（Windows: `Ctrl + F5`, Mac: `Cmd + Shift + R`）を行って、新しいService Workerを読み込ませてください。
const CACHE_NAME = 'studyloop-cache-v2'; // アプデ時はこのv2をv3などに変更するとキャッシュが更新されます

// キャッシュするファイルのリスト（今回分割した全モジュールを含める）
const urlsToCache = [
  './',
  './index.html',
  './manifest.json',
  './icon.png',
  './apple-touch-icon.png',
  './src/main.js',
  './src/config/firebase.js',
  './src/utils/helpers.js',
  './src/utils/constants.js',
  './src/services/auth.js',
  './src/services/db.js',
  './src/components/ui.js',
  './src/components/authUI.js',
  './src/components/taskUI.js',
  './src/components/dashboard.js',
  './src/components/calendar.js',
  './src/components/analytics.js',
  './src/components/settings.js',
  './src/components/drill.js',
  './src/components/flashcard.js'
];

// インストール時の処理：ファイルをキャッシュに保存
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Opened cache');
        return cache.addAll(urlsToCache);
      })
  );
});

// アクティベート時の処理：古いキャッシュの削除
self.addEventListener('activate', (event) => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            console.log('Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});

// リクエスト時の処理（ネットワークファースト戦略）
// 常に最新データを取得しようと試み、オフライン時のみキャッシュを返す
self.addEventListener('fetch', (event) => {
  // 外部API(Firestore等)へのリクエストはキャッシュさせない
  if (event.request.url.includes('firestore.googleapis.com') || 
      event.request.url.includes('securetoken.googleapis.com') ||
      event.request.url.includes('generativelanguage.googleapis.com')) {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // ネットワークから取得成功した場合はキャッシュも更新
        if (!response || response.status !== 200 || response.type !== 'basic') {
          return response;
        }
        const responseToCache = response.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, responseToCache);
        });
        return response;
      })
      .catch(() => {
        // オフライン時はキャッシュを返す
        return caches.match(event.request);
      })
  );
});

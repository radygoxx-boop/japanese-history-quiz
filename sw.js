// sw.js — Service Worker v3
// questions.json をキャッシュし、オフラインでも動作させる

const CACHE_NAME   = 'nihonshi-quiz-v3';
const STATIC_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './questions.json',
  'https://fonts.googleapis.com/css2?family=Zen+Antique+Soft&family=Noto+Sans+JP:wght@400;700;900&display=swap',
];

// ── インストール: 静的アセットを全部キャッシュ ──
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache =>
      // フォントは失敗してもクラッシュしないよう allSettled を使う
      Promise.allSettled(STATIC_ASSETS.map(url => cache.add(url)))
    )
  );
  self.skipWaiting();
});

// ── アクティベート: 古いキャッシュを削除 ──
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// ── フェッチ戦略 ──
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  // questions.json : ネットワーク優先（GitHub Actionsの更新を確実に取得）
  //                  失敗したらキャッシュで代替 → オフラインでも動く
  if (url.pathname.endsWith('questions.json')) {
    e.respondWith(
      fetch(e.request)
        .then(res => {
          if (!res.ok) throw new Error('network error');
          // 最新をキャッシュに保存
          const clone = res.clone();
          caches.open(CACHE_NAME).then(c => c.put(e.request, clone));
          return res;
        })
        .catch(() => caches.match(e.request))
    );
    return;
  }

  // その他: キャッシュ優先 → なければネットワーク
  e.respondWith(
    caches.match(e.request).then(cached => cached || fetch(e.request))
  );
});

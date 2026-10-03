/* Service worker: игра работает офлайн. Запросы к ИИ (другой домен) не трогаем. */
const CACHE = 'klubok-v1.1.0';
const ASSETS = [
  './', './index.html', './css/style.css', './manifest.webmanifest', './icon.svg',
  './js/config.js', './js/util.js', './js/maze.js', './js/levels.js', './js/sprites.js', './js/render.js',
  './js/audio.js', './js/input.js', './js/progress.js', './js/ai.js', './js/story.js', './js/game.js',
  './js/ui.js', './js/main.js'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

// Свои файлы: сначала сеть (чтобы обновления приходили сразу), при офлайне — кэш.
// Шрифты Google: сначала кэш.
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET') return;
  if (url.origin === location.origin) {
    e.respondWith(
      fetch(e.request).then(res => {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, copy));
        return res;
      }).catch(() => caches.match(e.request).then(r => r || caches.match('./index.html')))
    );
  } else if (/fonts\.(googleapis|gstatic)\.com$/.test(url.hostname)) {
    e.respondWith(
      caches.match(e.request).then(r => r || fetch(e.request).then(res => {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, copy));
        return res;
      }))
    );
  }
});

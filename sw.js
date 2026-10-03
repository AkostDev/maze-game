/* Service worker: игра работает офлайн. Список ASSETS сверяется с файлами проекта тестом test/pwa.test.js. */
const CACHE = 'klubok-v2.0.0';
const ASSETS = [
  './', './index.html', './manifest.webmanifest', './icon.svg',
  './vendor/phaser.esm.min.js',
  './assets/fonts/Tiny5-cyrillic.woff2', './assets/fonts/Tiny5-latin.woff2',
  './src/main.js', './src/config.js',
  './src/core/rng.js', './src/core/maze.js', './src/core/worlds.js', './src/core/levels.js', './src/core/game.js', './src/core/progress.js',
  './src/gfx/sprites.js', './src/gfx/textures.js', './src/gfx/mazeLayer.js',
  './src/audio/sfx.js', './src/ui/kit.js',
  './src/scenes/BootScene.js', './src/scenes/MenuScene.js', './src/scenes/LevelsScene.js', './src/scenes/SettingsScene.js',
  './src/scenes/GameScene.js', './src/scenes/HudScene.js', './src/scenes/PauseScene.js', './src/scenes/ResultScene.js'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

// Свои файлы: сначала сеть (обновления приходят сразу), без сети — кэш.
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  e.respondWith(
    fetch(e.request).then(res => {
      const copy = res.clone();
      caches.open(CACHE).then(c => c.put(e.request, copy));
      return res;
    }).catch(() => caches.match(e.request, { ignoreSearch: true }).then(r => r || caches.match('./index.html')))
  );
});

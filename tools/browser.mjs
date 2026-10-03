// Общий хелпер проверок в настоящем браузере: статический сервер проекта + headless Chromium (playwright-core).
// Используют test/browser.smoke.mjs (смоук всех сцен) и tools/screens.mjs (снимки экранов).
// Chromium берётся из кэша Playwright; если его нет — `npx playwright-core install chromium`.
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { dirname, extname, join, normalize, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.woff2': 'font/woff2', '.css': 'text/css; charset=utf-8', '.txt': 'text/plain; charset=utf-8'
};

// Сервер на случайном свободном порту — не мешает `npm start` и параллельным запускам
export function startServer() {
  const server = http.createServer(async (req, res) => {
    try {
      let path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
      if (path.endsWith('/')) path += 'index.html';
      const file = normalize(join(ROOT, path));
      if (file !== ROOT && !file.startsWith(ROOT + sep)) throw new Error('outside root');
      const body = await readFile(file);
      res.writeHead(200, { 'Content-Type': MIME[extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
      res.end(body);
    } catch (e) {
      res.writeHead(404); res.end('not found');
    }
  });
  return new Promise(resolve => server.listen(0, '127.0.0.1', () => {
    resolve({ url: 'http://127.0.0.1:' + server.address().port + '/', close: () => new Promise(r => server.close(r)) });
  }));
}

let browserPromise = null;
export function launch() {
  if (!browserPromise) {
    browserPromise = chromium.launch({
      headless: true,
      // WebGL без видеокарты: программный рендер SwiftShader
      args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--mute-audio']
    });
  }
  return browserPromise;
}

// Открывает игру и ждёт главного меню. opts: { width, height, dpr, touch, query, save }.
// save — объект сохранения klubok.v2 (прогресс), кладётся в localStorage до загрузки игры.
export async function openGame(baseUrl, opts = {}) {
  const { width = 360, height = 780, dpr = 2, touch = true, query = '', save = null } = opts;
  const browser = await launch();
  const context = await browser.newContext({
    viewport: { width, height }, deviceScaleFactor: dpr, hasTouch: touch, isMobile: touch, serviceWorkers: 'block'
  });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push('PAGE ERROR: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  if (save) await page.addInitScript(s => { localStorage.setItem('klubok.v2', JSON.stringify(s)); }, save);
  await page.goto(baseUrl + 'index.html?test' + (query ? '&' + query : ''));
  await page.waitForFunction(() => window.KLUBOK && window.KLUBOK.ready, null, { timeout: 20000 });
  return { page, context, errors, close: () => context.close() };
}

export async function closeAll() {
  if (browserPromise) { const b = await browserPromise; browserPromise = null; await b.close(); }
}

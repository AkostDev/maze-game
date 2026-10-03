// PWA: service worker обязан кэшировать все файлы игры — иначе офлайн она не запустится.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { VERSION } from '../src/config.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const walk = dir => readdirSync(join(ROOT, dir), { withFileTypes: true }).flatMap(d =>
  d.isDirectory() ? walk(dir + '/' + d.name) : [dir + '/' + d.name]);

test('sw.js кэширует все файлы игры', () => {
  const sw = readFileSync(join(ROOT, 'sw.js'), 'utf8');
  const assets = Array.from(sw.matchAll(/'\.\/([^']*)'/g)).map(m => m[1]);
  const need = walk('src').filter(f => f.endsWith('.js'))
    .concat(walk('assets').filter(f => f.endsWith('.woff2')), ['vendor/phaser.esm.min.js', 'index.html', 'manifest.webmanifest', 'icon.svg']);
  need.forEach(f => assert.ok(assets.includes(f), 'нет в ASSETS: ' + f));
  assets.filter(a => a).forEach(a => assert.ok(existsSync(join(ROOT, a)), 'в ASSETS лишний файл: ' + a));
});

test('версия совпадает в config.js, sw.js и package.json', () => {
  const sw = readFileSync(join(ROOT, 'sw.js'), 'utf8');
  assert.ok(sw.includes("'klubok-v" + VERSION + "'"), 'имя кэша в sw.js не соответствует версии ' + VERSION);
  assert.equal(JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')).version, VERSION);
});

test('index.html подключает шрифт и точку входа', () => {
  const html = readFileSync(join(ROOT, 'index.html'), 'utf8');
  assert.ok(html.includes('src="src/main.js"'));
  Array.from(html.matchAll(/url\(([^)]+)\)/g)).forEach(m => assert.ok(existsSync(join(ROOT, m[1])), 'нет файла шрифта ' + m[1]));
});

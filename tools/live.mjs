#!/usr/bin/env node
// Проверка опубликованной игры (GitHub Pages): сайт открывается в headless Chromium, меню должно загрузиться без ошибок.
//   node tools/live.mjs                  сайт: ok — версия, рендер, уровень запускается
//   node tools/live.mjs --wait           сначала дождаться (до 6 минут), пока GitHub опубликует текущий коммит — после git push
//   node tools/live.mjs --shot out.png   ещё и снимок меню (телефон 360×780)
// Адрес сайта — поле homepage в package.json, репозиторий — поле repository.
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { openGame, closeAll, ROOT } from './browser.mjs';

const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'));
const site = pkg.homepage.replace(/\/?$/, '/');
const repo = pkg.repository.url.replace(/^.*github\.com\//, '').replace(/\.git$/, '');
const args = process.argv.slice(2);
const shot = args.includes('--shot') ? args[args.indexOf('--shot') + 1] : null;

// Публикацию ведёт сам GitHub: после push в main он создаёт развёртывание github-pages для этого коммита
async function waitDeploy() {
  const head = execSync('git rev-parse HEAD', { cwd: ROOT }).toString().trim();
  const api = 'https://api.github.com/repos/' + repo + '/deployments';
  for (let i = 0; i < 36; i++) {
    try {
      const list = await (await fetch(api + '?environment=github-pages&per_page=5')).json();
      const dep = Array.isArray(list) ? list.find(d => d.sha === head) : null;
      if (dep) {
        const st = await (await fetch(api + '/' + dep.id + '/statuses?per_page=1')).json();
        const state = Array.isArray(st) && st[0] ? st[0].state : 'queued';
        if (state === 'success') return true;
        if (state === 'failure' || state === 'error') { console.log('публикация: GitHub сообщил об ошибке (' + state + ')'); return false; }
      }
    } catch (e) { /* сеть моргнула — пробуем ещё */ }
    await new Promise(r => setTimeout(r, 10000));
  }
  console.log('публикация: не дождались коммита ' + head.slice(0, 7) + ' за 6 минут');
  return false;
}

if (args.includes('--wait') && !(await waitDeploy())) process.exit(1);

let rc = 0;
try {
  const g = await openGame(site, { width: 360, height: 780, dpr: 2 });
  const info = await g.page.evaluate(async () => {
    KLUBOK.go('Game', { index: 0 });
    await new Promise(r => setTimeout(r, 700));
    const sm = KLUBOK.game.scene;
    return { version: KLUBOK.version, webgl: KLUBOK.game.config.renderType === 2, playing: sm.isActive('Game') && sm.isActive('Hud') };
  });
  if (shot) { await g.page.evaluate(() => KLUBOK.go('Menu')); await g.page.waitForTimeout(600); await g.page.screenshot({ path: shot, scale: 'css' }); }
  const local = pkg.version;
  const bad = [];
  if (g.errors.length) bad.push('ошибки на странице: ' + g.errors.slice(0, 2).join(' | '));
  if (!info.playing) bad.push('уровень не запустился');
  if (!info.webgl) bad.push('рендер не WebGL');
  if (info.version !== local) bad.push('на сайте версия ' + info.version + ', локально ' + local);
  console.log('сайт: ' + (bad.length ? 'ПРОБЛЕМЫ — ' + bad.join('; ') : 'ok — ' + site + ' · версия ' + info.version + ', уровень запускается'));
  rc = bad.length ? 1 : 0;
  await g.close();
} catch (e) {
  console.log('сайт: ОШИБКА — ' + e.message.split('\n')[0]);
  rc = 1;
}
await closeAll();
process.exit(rc);

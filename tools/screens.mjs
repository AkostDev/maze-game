#!/usr/bin/env node
// Снимки экранов игры в headless Chromium: телефон 360×780 и ПК 1280×800 одной командой; печатает пути к PNG.
//   node tools/screens.mjs menu levels game            пресеты (список ниже), по два снимка на каждый
//   node tools/screens.mjs -m game                     только телефон;  -d — только ПК;  -t — ещё планшет 1024×768;  -l — ещё телефон лёжа 780×360
//   node tools/screens.mjs --level 30 --hero cat game  уровень (с нуля) и герой
//   node tools/screens.mjs --js "KLUBOK.go('Levels', { page: 2 })" mycase     свой сценарий под именем mycase
//   --hd — снимок в пикселях устройства (по умолчанию ужат до CSS-размера: картинка для Claude дешевле)
//   --out dir — папка для снимков (по умолчанию $TMPDIR/klubok-shots)
// Пресеты: menu levels settings intro game hint pause result lose
import { mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { startServer, openGame, closeAll } from './browser.mjs';

const args = process.argv.slice(2);
const opt = { sizes: ['m', 'd'], level: 14, hero: 'cat', js: null, hd: false, out: join(tmpdir(), 'klubok-shots') };
const names = [];
for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (a === '-m') opt.sizes = ['m'];
  else if (a === '-d') opt.sizes = ['d'];
  else if (a === '-t') opt.sizes = opt.sizes.concat('t');
  else if (a === '-l') opt.sizes = opt.sizes.concat('l');
  else if (a === '--hd') opt.hd = true;
  else if (a === '--level') opt.level = +args[++i];
  else if (a === '--hero') opt.hero = args[++i];
  else if (a === '--out') opt.out = args[++i];
  else if (a === '--js') opt.js = args[++i];
  else names.push(a);
}

const SIZES = { m: { width: 360, height: 780, dpr: 2, touch: true }, d: { width: 1280, height: 800, dpr: 1, touch: false }, t: { width: 1024, height: 768, dpr: 2, touch: true }, l: { width: 780, height: 360, dpr: 2, touch: true } };
const L = opt.level;
const GAME = `KLUBOK.go('Game', { index: ${L} });`;
const PLAY = `KLUBOK.game.scene.getScene('Game').logic.begin();`;
// [код, пауза до него (мс)] — шаги выполняются по очереди, после последнего — снимок
const PRESETS = {
  menu: [],
  levels: [[`KLUBOK.go('Levels', { page: ${Math.min(4, Math.floor(L / 10))} })`, 0]],
  settings: [[`KLUBOK.go('Settings')`, 0]],
  intro: [[`KLUBOK.go('Game', { index: ${L} })`, 0]],
  game: [[GAME, 0], [PLAY, 400]],
  hint: [[GAME, 0], [PLAY + `KLUBOK.game.scene.getScene('Game').useHint();`, 400]],
  pause: [[GAME, 0], [PLAY + `KLUBOK.game.scene.getScene('Game').pauseGame();`, 400]],
  result: [[GAME, 0], [`var g = KLUBOK.game.scene.getScene('Game'); g.logic.begin(); g.logic.steps = g.level.optimalSteps + 3; g.logic.elapsed = 47; g.logic.win();`, 400], ['', 2300]],
  lose: [[`KLUBOK.go('Game', { index: ${Math.max(L, 20) + (Math.max(L, 20) % 2)} })`, 0], [`var g = KLUBOK.game.scene.getScene('Game'); g.logic.begin(); g.logic.hearts = 1; g.logic.onHit();`, 400], ['', 1300]]
};

if (!names.length) { console.log('пресеты: ' + Object.keys(PRESETS).join(' ') + '   (ключи — в начале tools/screens.mjs)'); process.exit(64); }

// «Обжитое» сохранение: пройдены все уровни до L, звёзды разные
const levels = {};
for (let i = 0; i < L; i++) levels[i] = { stars: (i * 7) % 3 + 1, steps: 40 + i, time: 30 + i };
const save = { v: 2, hero: opt.hero, unlocked: L, levels, settings: { sound: true, music: true, vibration: true, dpad: false } };

mkdirSync(opt.out, { recursive: true });
const srv = await startServer();
let rc = 0;
for (const name of names) {
  const steps = opt.js ? [[opt.js, 0]] : PRESETS[name];
  if (!steps) { console.log('нет пресета: ' + name); rc = 1; continue; }
  for (const s of opt.sizes) {
    const g = await openGame(srv.url, Object.assign({ save: name === 'intro' && !opt.js && L === 0 ? null : save }, SIZES[s]));
    try {
      for (const [code, wait] of steps) {
        if (wait) await g.page.waitForTimeout(wait);
        if (code) await g.page.evaluate(code);
      }
      await g.page.waitForTimeout(700);
      const file = join(opt.out, name + '-' + s + '.png');
      await g.page.screenshot({ path: file, scale: opt.hd ? 'device' : 'css' });
      console.log(file + (g.errors.length ? '   ⚠ ' + g.errors[0] : ''));
      if (g.errors.length) rc = 1;
    } catch (e) {
      console.log('ОШИБКА ' + name + '-' + s + ': ' + e.message.split('\n')[0]);
      rc = 1;
    }
    await g.close();
  }
}
await closeAll();
await srv.close();
process.exit(rc);

// Смоук в настоящем браузере (headless Chromium, WebGL): все сцены, реальные клики, свайп, клавиши,
// прохождение уровней автопилотом, пауза, настройки, поворот экрана. Запуск: node test/browser.smoke.mjs
// Последняя строка вывода — итог: «Browser smoke: OK …» или список проблем (код возврата ≠ 0).
import { startServer, openGame, closeAll } from '../tools/browser.mjs';

const SIZES = [
  { tag: 'телефон', width: 360, height: 780, dpr: 2, touch: true },
  { tag: 'ПК', width: 1280, height: 800, dpr: 1, touch: false }
];
// Уровни-знакомства с каждой механикой, конец кампании и бесконечный режим
const LEVELS = [3, 9, 12, 20, 26, 30, 38, 49, 53];

const fails = [];
let checks = 0;

async function run(srv, size) {
  const g = await openGame(srv.url, size);
  const { page } = g;
  const ok = (cond, what) => { checks++; if (!cond) fails.push(size.tag + ': ' + what); };
  const wait = ms => page.waitForTimeout(ms);
  const active = () => page.evaluate(() => KLUBOK.game.scene.getScenes(true).map(s => s.scene.key));
  const until = async (fn, arg, what) => {
    checks++;
    try { await page.waitForFunction(fn, arg, { timeout: 9000 }); return true; } catch (e) { fails.push(size.tag + ': не дождались — ' + what); return false; }
  };
  const isActive = key => until(k => KLUBOK.game.scene.isActive(k), key, 'сцена ' + key);
  // Кнопка по имени (подпись или иконка) → координаты центра в CSS-пикселях
  const click = async (scene, name) => {
    const p = await page.evaluate(([sc, nm]) => {
      const o = KLUBOK.game.scene.getScene(sc).children.list.find(c => c.name === nm && c.input);
      const dpr = KLUBOK.game.registry.get('dpr');
      return o ? { x: o.x / dpr, y: o.y / dpr } : null;
    }, [scene, name]);
    ok(p, 'нет кнопки «' + name + '» в сцене ' + scene);
    if (p) await page.mouse.click(p.x, p.y);
    // сцена после нажатия может перестроиться; новые кнопки начинают принимать касания со следующего кадра
    await page.waitForTimeout(80);
  };
  const state = () => page.evaluate(() => {
    const gs = KLUBOK.game.scene.getScene('Game'), lg = gs.logic;
    return { steps: lg.steps, won: lg.won, lost: lg.lost, started: lg.started, hints: lg.hintsLeft, index: gs.index, dark: gs.level.rules.dark, fog: !!gs.fog, enemies: gs.enemySprites.length };
  });
  // Герой в CSS-пикселях и направление, куда можно шагнуть
  const hero = () => page.evaluate(() => {
    const gs = KLUBOK.game.scene.getScene('Game'), lg = gs.logic, cam = gs.cameras.main, dpr = KLUBOK.game.registry.get('dpr');
    const dir = [0, 1, 2, 3].find(d => lg.passable(lg.player.cell, d));
    return { x: (gs.hero.x - cam.worldView.x) * cam.zoom / dpr, y: (gs.hero.y - cam.worldView.y) * cam.zoom / dpr, dir, cell: cam.zoom * 20 / dpr };
  });
  const VEC = [[0, -1], [1, 0], [0, 1], [-1, 0]], KEY = ['ArrowUp', 'ArrowRight', 'ArrowDown', 'ArrowLeft'];
  // Быстрое прохождение: логика прокручивается автопилотом без ожидания реального времени
  const autoplay = () => page.evaluate(async () => {
    const { autopilot } = await import('/test/autopilot.js');
    const gs = KLUBOK.game.scene.getScene('Game');
    return autopilot(gs.logic, gs.level, 900);
  });

  // 1. Меню: выбор героя, запуск игры кнопкой
  ok((await active()).includes('Menu'), 'меню не открылось');
  const hero0 = await page.evaluate(() => KLUBOK.progress.hero);
  await click('Menu', 'play');
  ok((await page.evaluate(() => KLUBOK.progress.hero)) !== hero0, 'стрелка не сменила героя');
  await click('Menu', 'Играть');
  if (!(await isActive('Hud'))) { await g.close(); return; } // дальше проверять нечего
  let st = await state();
  ok(st.index === 0 && !st.started, 'первый уровень не запустился');
  ok(await page.evaluate(() => !!KLUBOK.game.scene.getScene('Hud').intro), 'нет карточки-знакомства на первом уровне');

  // 2. Управление: свайп, клавиша, тап — каждый даёт ровно шаг
  let h = await hero();
  const far = size.width > 600 ? 120 : 60;
  await page.mouse.move(size.width / 2, size.height / 2);
  await page.mouse.down();
  await page.mouse.move(size.width / 2 + VEC[h.dir][0] * far, size.height / 2 + VEC[h.dir][1] * far, { steps: 4 });
  await page.mouse.up();
  await wait(450);
  st = await state();
  ok(st.steps === 1 && st.started, 'свайп: шагов ' + st.steps + ' вместо 1');
  ok(await page.evaluate(() => !KLUBOK.game.scene.getScene('Hud').intro), 'карточка не исчезла после первого шага');
  h = await hero();
  await page.keyboard.press(KEY[h.dir]);
  await wait(400);
  ok((await state()).steps === 2, 'клавиша не дала шаг');
  h = await hero();
  await page.mouse.click(h.x + VEC[h.dir][0] * h.cell, h.y + VEC[h.dir][1] * h.cell);
  await wait(400);
  ok((await state()).steps === 3, 'тап рядом с героем не дал шаг');

  // 3. Подсказка и пауза
  await page.keyboard.press('KeyH');
  await wait(200);
  st = await state();
  ok(st.hints === 2, 'подсказка не израсходовалась');
  ok(await page.evaluate(() => KLUBOK.game.scene.getScene('Game').hintDots.length > 0), 'подсказка не нарисована');
  await click('Hud', 'pause');
  await isActive('Pause');
  ok(await page.evaluate(() => KLUBOK.game.scene.isPaused('Game')), 'игра не встала на паузу');
  await click('Pause', 'dpad'); // включаем экранные стрелки прямо в паузе
  await wait(150);
  await click('Pause', 'Продолжить');
  await until(() => KLUBOK.game.scene.isActive('Game') && !KLUBOK.game.scene.isActive('Pause'), null, 'возврат из паузы');
  await wait(200);
  ok(await page.evaluate(() => KLUBOK.progress.settings.dpad), 'настройка стрелок не включилась');
  h = await hero();
  const before = (await state()).steps;
  await click('Hud', 'dpad-' + h.dir);
  await wait(400);
  ok((await state()).steps === before + 1, 'экранная стрелка не дала шаг');
  await page.evaluate(() => { KLUBOK.progress.setSetting('dpad', false); });

  // 4. Победа → итоги → следующий уровень
  ok((await autoplay()) === 'won', 'автопилот не прошёл первый уровень');
  await isActive('Result');
  ok(await page.evaluate(() => KLUBOK.progress.unlocked === 1 && KLUBOK.progress.stars(0) >= 1), 'победа не записалась');
  await wait(1200);
  await click('Result', 'Дальше');
  await until(() => KLUBOK.game.scene.isActive('Hud') && KLUBOK.game.scene.getScene('Game').index === 1, null, 'переход на второй уровень');

  // 5. Уровни с каждой механикой
  for (const index of LEVELS) {
    await page.evaluate(i => KLUBOK.go('Game', { index: i }), index);
    if (!(await until(i => KLUBOK.game.scene.isActive('Hud') && KLUBOK.game.scene.getScene('Game').index === i, index, 'уровень ' + index))) continue;
    await wait(250);
    st = await state();
    ok(st.dark === st.fog, 'уровень ' + index + ': туман не соответствует правилам');
    const res = await autoplay();
    ok(res !== 'stuck', 'уровень ' + index + ': автопилот застрял');
    await isActive('Result');
    await wait(300);
  }
  // с итогов — к списку уровней и обратно в игру по кнопке уровня
  await click('Result', 'levels');
  await isActive('Levels');
  await page.evaluate(() => KLUBOK.go('Levels', { page: 0 }));
  await wait(300);
  await click('Levels', 'level-2');
  await until(() => KLUBOK.game.scene.isActive('Hud') && KLUBOK.game.scene.getScene('Game').index === 1, null, 'запуск уровня из списка');

  // 6. Поворот экрана во время игры и в меню
  await page.setViewportSize({ width: size.height, height: size.width });
  await wait(500);
  ok((await active()).includes('Hud'), 'после поворота пропал HUD');
  await page.keyboard.press('Escape');
  await isActive('Pause');
  await click('Pause', 'Меню');
  await isActive('Menu');
  await page.setViewportSize({ width: size.width, height: size.height });
  await wait(400);

  // 7. Настройки: переключатель и сброс прогресса с подтверждением
  await click('Menu', 'settings');
  await isActive('Settings');
  await click('Settings', 'Музыка: вкл');
  await wait(150);
  ok(await page.evaluate(() => KLUBOK.progress.settings.music === false), 'музыка не выключилась');
  await click('Settings', 'Сбросить прогресс');
  await wait(150);
  ok(await page.evaluate(() => KLUBOK.progress.unlocked > 0), 'прогресс сбросился без подтверждения');
  await click('Settings', 'Точно сбросить?');
  await isActive('Menu');
  ok(await page.evaluate(() => KLUBOK.progress.unlocked === 0 && KLUBOK.progress.settings.music === false), 'сброс: прогресс или настройки не те');

  ok(g.errors.length === 0, 'ошибки на странице: ' + g.errors.slice(0, 3).join(' | '));
  ok(await page.evaluate(() => KLUBOK.game.config.renderType === 2), 'рендер не WebGL');
  await g.close();
}

const srv = await startServer();
try {
  // SMOKE_ONLY=ПК node test/browser.smoke.mjs — прогнать один размер (для отладки)
  for (const size of SIZES) if (!process.env.SMOKE_ONLY || process.env.SMOKE_ONLY === size.tag) await run(srv, size);
} catch (e) {
  fails.push('исключение в сценарии: ' + e.message.split('\n')[0]);
}
await closeAll();
await srv.close();
if (fails.length) {
  console.log(fails.map(f => 'FAIL ' + f).join('\n'));
  console.log('Browser smoke: ПРОБЛЕМЫ (' + fails.length + ' из ' + checks + ' проверок)');
  process.exit(1);
}
console.log('Browser smoke: OK — ' + checks + ' проверок, ' + SIZES.map(s => s.tag).join(' и '));

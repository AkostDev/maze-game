// Прогресс и настройки: сохранение, лучший результат, устойчивость к повреждённым данным.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Progress, memoryStorage, KEY, DEFAULT_SETTINGS } from '../src/core/progress.js';

test('победа открывает следующий уровень и хранит лучший результат', () => {
  const p = new Progress(memoryStorage());
  assert.equal(p.unlocked, 0);
  assert.equal(p.isUnlocked(1), false);
  let r = p.recordWin(0, { stars: 2, steps: 30, time: 12.34 });
  assert.deepEqual(r, { firstWin: true, newBest: false, unlockedNext: true });
  assert.equal(p.unlocked, 1);
  assert.equal(p.stars(0), 2);

  r = p.recordWin(0, { stars: 1, steps: 20, time: 9 }); // хуже — не перезаписывает
  assert.equal(r.newBest, false);
  assert.equal(p.best(0).steps, 30);
  r = p.recordWin(0, { stars: 3, steps: 40, time: 20 }); // больше звёзд — лучше
  assert.equal(r.newBest, true);
  assert.equal(p.stars(0), 3);
  r = p.recordWin(0, { stars: 3, steps: 25, time: 20 }); // столько же звёзд, меньше шагов
  assert.equal(r.newBest, true);
  assert.equal(r.unlockedNext, false);
  assert.equal(p.unlocked, 1);
  assert.equal(p.totalStars(), 3);
  assert.equal(p.rangeStars(0, 10), 3);
});

test('сохранение переживает перезапуск', () => {
  const storage = memoryStorage();
  const a = new Progress(storage);
  a.recordWin(0, { stars: 3, steps: 10, time: 5 });
  a.setHero('cat');
  a.setSetting('music', false);
  const b = new Progress(storage);
  assert.equal(b.unlocked, 1);
  assert.equal(b.hero, 'cat');
  assert.equal(b.settings.music, false);
  assert.equal(b.settings.sound, true);
});

test('повреждённые и чужие данные не ломают игру', () => {
  for (const raw of ['{oops', 'null', '[]', '{"v":1,"profiles":[]}', '{"v":2,"hero":"dragon","unlocked":-5,"levels":{"0":{"stars":9}},"settings":{"sound":"да"}}']) {
    const storage = memoryStorage();
    storage.setItem(KEY, raw);
    const p = new Progress(storage);
    assert.equal(p.unlocked, 0);
    assert.equal(p.hero, 'hedgehog');
    assert.equal(p.totalStars(), 0);
    assert.deepEqual(p.settings, DEFAULT_SETTINGS);
  }
});

test('сброс прогресса сохраняет настройки', () => {
  const p = new Progress(memoryStorage());
  p.recordWin(0, { stars: 3, steps: 10, time: 5 });
  p.setSetting('sound', false);
  p.setHero('frog');
  p.reset();
  assert.equal(p.unlocked, 0);
  assert.equal(p.totalStars(), 0);
  assert.equal(p.hero, 'hedgehog');
  assert.equal(p.settings.sound, false);
  p.setSetting('нет такой', 1);
  assert.equal('нет такой' in p.settings, false);
});

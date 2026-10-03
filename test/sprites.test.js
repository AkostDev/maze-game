// Данные пиксельной графики: размеры карт и символы палитры; картинка лабиринта рисуется без браузера.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validate, SPRITES, ICONS } from '../src/gfx/sprites.js';
import { paintMaze, mazeSize, PITCH, WALL } from '../src/gfx/mazeLayer.js';
import { buildLevel, levelSpec } from '../src/core/levels.js';
import { WORLDS, HEROES } from '../src/core/worlds.js';

test('спрайты и иконки корректны', () => {
  assert.deepEqual(validate(), []);
  HEROES.forEach(h => { assert.ok(SPRITES[h.id], 'нет спрайта героя ' + h.id); assert.ok(SPRITES[h.id].alt, 'нет кадра шага у ' + h.id); });
  WORLDS.forEach(w => { assert.ok(SPRITES[w.item], 'нет находки ' + w.item); assert.ok(SPRITES[w.enemy], 'нет сторожа ' + w.enemy); });
  ['firefly', 'heart', 'key', 'house', 'houseOpen', 'yarn', 'star'].forEach(k => assert.ok(SPRITES[k], k));
  assert.ok(Object.keys(ICONS).length >= 20);
});

test('картинка лабиринта: стены там, где нет прохода', () => {
  for (const i of [0, 14, 33, 49]) {
    const lv = buildLevel(levelSpec(i, 1));
    const img = paintMaze(lv), size = mazeSize(lv), g = lv.grid;
    assert.equal(img.w, size.w); assert.equal(img.h, size.h);
    const wallTop = [lv.world.wallTop, lv.world.wallHi].map(c => parseInt(c.slice(1), 16));
    const isWall = (x, y) => { const p = img.pixels[y * img.w + x]; const rgb = ((p & 0xff) << 16) | (p & 0xff00) | ((p >>> 16) & 0xff); return wallTop.includes(rgb); };
    for (let c = 0; c < g.n; c++) {
      if (!g.active(c)) continue;
      const x = g.x(c) * PITCH, y = g.y(c) * PITCH;
      // середина правой и нижней границы клетки
      assert.equal(isWall(x + PITCH + 1, y + WALL + 8), !g.isOpen(c, 1), 'восточная стена клетки ' + c + ' уровня ' + i);
      assert.equal(isWall(x + WALL + 8, y + PITCH + 1), !g.isOpen(c, 2), 'южная стена клетки ' + c + ' уровня ' + i);
    }
  }
});

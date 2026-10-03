// Генерация уровней: инварианты решаемости и кривая сложности. Запуск: node --test test/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as M from '../src/core/maze.js';
import { buildLevel, levelSpec, difficulty, introFor, UNLOCKS, CAMPAIGN_LEVELS, LEVELS_PER_WORLD } from '../src/core/levels.js';
import { WORLDS } from '../src/core/worlds.js';

const ASPECTS = [0.62, 1, 1.6]; // телефон стоя, квадрат, планшет лёжа
const LAST = CAMPAIGN_LEVELS + 20; // кампания + кусок бесконечного режима

// Возвращает список нарушений инвариантов уровня (пустой — уровень корректен)
function check(lv) {
  const g = lv.grid, errs = [];
  const links = new Map();
  lv.portals.forEach(p => { links.set(p.a, [p.b]); links.set(p.b, [p.a]); });
  const gateOf = new Map();
  lv.gates.forEach((gt, k) => { gateOf.set(gt.a * 4 + gt.dir, k); gateOf.set(gt.b * 4 + M.OPP[gt.dir], k); });

  // 1. Все клетки достижимы
  const all = M.bfs(g, lv.start, { links }).dist;
  for (let i = 0; i < g.n; i++) if (g.active(i) && all[i] < 0) { errs.push('недостижимая клетка ' + i); break; }

  // 2. Каждая дверь обязательна: если закрыта только она, выход недостижим
  lv.gates.forEach((gt, k) => {
    const d = M.bfs(g, lv.start, { links, blocked: (i, dir) => dir >= 0 && gateOf.get(i * 4 + dir) === k }).dist;
    if (d[lv.exit] >= 0) errs.push('дверь ' + k + ' можно обойти');
  });

  // 3. Ключ k достижим, пока закрыты двери k и дальше
  lv.keys.forEach(key => {
    const d = M.bfs(g, lv.start, { links, blocked: (i, dir) => dir >= 0 && gateOf.has(i * 4 + dir) && gateOf.get(i * 4 + dir) >= key.color }).dist;
    if (d[key.cell] < 0) errs.push('ключ ' + key.color + ' за своей дверью');
  });
  if (lv.keys.length !== lv.gates.length) errs.push('ключей и дверей не поровну');

  // 4. Объекты не делят клетку
  const cells = [lv.start, lv.exit].concat(lv.items.map(i => i.cell), lv.keys.map(k => k.cell), lv.portals.flatMap(p => [p.a, p.b]));
  if (new Set(cells).size !== cells.length) errs.push('два объекта в одной клетке');

  // Порталы стоят только в тупиках: в проходном коридоре портал перегородил бы путь
  lv.portals.forEach(p => { if (g.degree(p.a) !== 1 || g.degree(p.b) !== 1) errs.push('портал не в тупике'); });

  // 5. Сторожа не ближе 3 клеток к старту и только там, где они включены правилами
  const plain = M.bfs(g, lv.start).dist;
  lv.enemies.forEach(e => { if (plain[e.cell] < 3) errs.push('сторож у старта'); });
  if (lv.rules.enemies !== (lv.enemies.length > 0)) errs.push('правило enemies не совпадает со списком сторожей');
  if (lv.rules.enemies && lv.hearts < 1) errs.push('сторожа без жизней');

  if (lv.required < 1) errs.push('нет обязательных находок');
  if (!(lv.optimalSteps > 0)) errs.push('optimalSteps = ' + lv.optimalSteps);
  return errs;
}

test('все уровни решаемы и корректны', () => {
  let n = 0;
  const bad = [];
  for (let i = 0; i < LAST; i++) {
    for (const aspect of ASPECTS) {
      const errs = check(buildLevel(levelSpec(i, aspect)));
      n++;
      if (errs.length) bad.push('уровень ' + i + ' (' + aspect + '): ' + errs.join('; '));
    }
  }
  console.log('Levels checked: ' + n + ', failures: ' + bad.length);
  assert.deepEqual(bad, []);
});

test('уровень детерминирован от сида', () => {
  for (const i of [0, 7, 23, 49, 63]) {
    const a = buildLevel(levelSpec(i, 1)), b = buildLevel(levelSpec(i, 1));
    assert.deepEqual(Array.from(a.grid.cells), Array.from(b.grid.cells));
    assert.deepEqual(a.items, b.items);
    assert.equal(a.optimalSteps, b.optimalSteps);
  }
});

test('механики появляются постепенно', () => {
  for (const aspect of ASPECTS) {
    const lv = i => buildLevel(levelSpec(i, aspect));
    for (let i = 0; i < UNLOCKS.gates; i++) assert.equal(lv(i).gates.length, 0, 'дверь до уровня ' + UNLOCKS.gates);
    for (let i = 0; i < UNLOCKS.portals; i++) assert.equal(lv(i).portals.length, 0, 'портал раньше времени: ' + i);
    for (let i = 0; i < UNLOCKS.enemies; i++) assert.equal(lv(i).enemies.length, 0, 'сторож раньше времени: ' + i);
    for (let i = 0; i < UNLOCKS.dark; i++) assert.equal(lv(i).rules.dark, false, 'ночь раньше времени: ' + i);
    // На уровне-знакомстве механика обязана присутствовать — иначе карточка обманет
    assert.ok(lv(UNLOCKS.gates).gates.length >= 1, 'нет двери на уровне-знакомстве');
    assert.ok(lv(UNLOCKS.shapes).shape, 'нет фигуры на уровне-знакомстве');
    assert.ok(lv(UNLOCKS.portals).portals.length >= 1, 'нет портала на уровне-знакомстве');
    assert.ok(lv(UNLOCKS.enemies).enemies.length >= 1, 'нет сторожа на уровне-знакомстве');
    assert.ok(lv(UNLOCKS.wander).enemies.some(e => e.type === 'wander'), 'нет бродяги на уровне-знакомстве');
    assert.equal(lv(UNLOCKS.dark).rules.dark, true);
    assert.ok(lv(UNLOCKS.chaser).enemies.some(e => e.type === 'chaser'), 'нет догоняющего на уровне-знакомстве');
  }
});

test('сложность растёт плавно', () => {
  assert.equal(difficulty(0), 0);
  assert.equal(difficulty(CAMPAIGN_LEVELS - 1), 1);
  for (let i = 1; i < CAMPAIGN_LEVELS; i++) {
    // «передышки» допустимы, но не откат больше чем на уровень-полтора
    assert.ok(difficulty(i) > difficulty(i - 1) - 0.05, 'резкий спад сложности на уровне ' + i);
  }
  const cells = i => { const lv = buildLevel(levelSpec(i, 1)); return lv.grid.activeList().length; };
  assert.ok(cells(0) <= 20, 'первый уровень должен быть крошечным');
  assert.ok(cells(CAMPAIGN_LEVELS - 1) >= 150, 'последний уровень должен быть большим');
  assert.equal(introFor(0), 'move');
  assert.equal(WORLDS.length * LEVELS_PER_WORLD, CAMPAIGN_LEVELS);
});

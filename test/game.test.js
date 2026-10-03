// Игровая логика: автопилот проходит уровни настоящим движком, плюс проверки пошагового управления и правил.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as M from '../src/core/maze.js';
import { makeRng } from '../src/core/rng.js';
import { buildLevel, levelSpec, CAMPAIGN_LEVELS } from '../src/core/levels.js';
import { Game, computeStars } from '../src/core/game.js';
import { autopilot } from './autopilot.js';

const DT = 1 / 30;

function newGame(index, aspect, events) {
  const level = buildLevel(levelSpec(index, aspect || 1));
  const game = new Game(level, {
    random: makeRng('test|' + index).next,
    onEvent: (type, data) => { if (events) events.push({ type, data }); }
  });
  return { level, game };
}

test('автопилот проходит кампанию и бесконечный режим', () => {
  let runs = 0, won = 0, lost = 0;
  const stuck = [];
  for (let i = 0; i < CAMPAIGN_LEVELS + 10; i++) {
    for (const aspect of [0.62, 1.6]) {
      const { level, game } = newGame(i, aspect);
      const res = autopilot(game, level, 900);
      runs++;
      if (res === 'won') {
        won++;
        const r = game.result(true);
        assert.ok(r.stars >= 1 && r.stars <= 3);
        assert.ok(r.steps >= 1);
      } else if (res === 'lost') {
        lost++;
        assert.ok(level.rules.enemies, 'проигрыш возможен только на уровне со сторожами: ' + i);
      } else stuck.push(i + '@' + aspect);
    }
  }
  console.log('Autopilot runs: ' + runs + ', won: ' + won + ', lost: ' + lost);
  assert.deepEqual(stuck, [], 'автопилот застрял');
  assert.ok(lost <= runs * 0.15, 'слишком много поражений автопилота: ' + lost);
});

test('одно нажатие — один шаг, очередь не длиннее трёх', () => {
  const { level, game } = newGame(8, 1);
  const g = level.grid;
  const d = [0, 1, 2, 3].find(k => game.passable(level.start, k));
  assert.ok(d >= 0);
  game.push(d);
  for (let i = 0; i < 60; i++) game.update(DT);
  assert.equal(game.steps, 1);
  assert.equal(game.player.cell, g.neighbor(level.start, d));
  for (let i = 0; i < 9; i++) game.push(d);
  assert.equal(game.stepQueue.length, 3);
});

test('удержание повторяет шаги по прямой после задержки', () => {
  const { level, game } = newGame(8, 1);
  const g = level.grid;
  const d = [0, 1, 2, 3].find(k => game.passable(level.start, k));
  game.setHeld(d, 0.3);
  for (let i = 0; i < 6; i++) game.update(DT); // 0.2 с — ещё рано
  assert.equal(game.steps, 0);
  for (let i = 0; i < 300; i++) game.update(DT);
  // дошёл до упора по прямой и остановился
  let c = level.start, n = 0;
  while (game.passable(c, d) && n < 99) { c = g.neighbor(c, d); n++; }
  assert.ok(game.steps >= 1);
  assert.equal(game.player.cell, c);
  game.release();
  assert.equal(game.heldDir, -1);
});

test('стена останавливает и даёт событие bump', () => {
  const events = [];
  const { level, game } = newGame(0, 1, events);
  const d = [0, 1, 2, 3].find(k => !level.grid.isOpen(level.start, k));
  game.push(d);
  for (let i = 0; i < 10; i++) game.update(DT);
  assert.equal(game.steps, 0);
  assert.ok(events.some(e => e.type === 'bump' && e.data.dir === d));
  assert.ok(events.some(e => e.type === 'start'));
});

test('дверца закрыта без ключа, выход — пока не собраны находки', () => {
  const { level, game } = newGame(6, 1);
  assert.ok(level.gates.length >= 1);
  const gt = level.gates[0];
  assert.equal(game.passable(gt.a, gt.dir), false);
  game.keysHeld.add(gt.color);
  assert.equal(game.passable(gt.a, gt.dir), true);

  const g = level.grid;
  const before = [0, 1, 2, 3].map(k => g.neighbor(level.exit, k)).filter(j => j >= 0 && g.isOpen(level.exit, g.dirBetween(level.exit, j)));
  assert.equal(game.exitOpen, false);
  before.forEach(j => assert.equal(game.passable(j, g.dirBetween(j, level.exit)), false));
  game.exitOpen = true;
  assert.ok(before.some(j => game.passable(j, g.dirBetween(j, level.exit)) || game.gateAt.has(j * 4 + g.dirBetween(j, level.exit))));
});

test('подсказка ведёт к цели и расходует запас', () => {
  const events = [];
  const { level, game } = newGame(5, 1, events);
  assert.equal(game.hintsLeft, level.hints);
  assert.equal(game.useHint(), true);
  const hint = events.find(e => e.type === 'hint');
  assert.ok(hint.data.path.length >= 2);
  assert.equal(hint.data.path[0], level.start);
  assert.equal(game.hintsLeft, level.hints - 1);
  game.hintsLeft = 0;
  assert.equal(game.useHint(), false);
  assert.ok(events.some(e => e.type === 'noHints'));
});

test('столкновение со сторожем отнимает жизнь, без жизней — поражение', () => {
  const events = [];
  const { game } = newGame(20, 1, events);
  assert.equal(game.hearts, 3);
  game.begin();
  game.onHit();
  assert.equal(game.hearts, 2);
  assert.ok(game.player.invuln > 0);
  game.onHit(); game.onHit();
  assert.equal(game.lost, true);
  assert.ok(events.some(e => e.type === 'lose' && e.data.result.reason === 'caught'));
});

test('звёзды: путь, столкновения и подсказки', () => {
  const lv = { optimalSteps: 100, stars: [2, 3], rules: { dark: false, enemies: false } };
  const g = (steps, hits, hints) => ({ steps, hits: hits || 0, hintsUsed: hints || 0 });
  assert.equal(computeStars(g(150), lv), 3);
  assert.equal(computeStars(g(250), lv), 2);
  assert.equal(computeStars(g(400), lv), 1);
  assert.equal(computeStars(g(150, 0, 1), lv), 2);
  assert.equal(computeStars(g(150, 0, 3), lv), 1);
  const guarded = Object.assign({}, lv, { rules: { dark: false, enemies: true } });
  assert.equal(computeStars(g(250), guarded), 3); // со сторожами пороги мягче
  assert.equal(computeStars(g(150, 1), guarded), 2);
  assert.equal(computeStars(g(150, 5), guarded), 1);
});

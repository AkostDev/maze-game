// Автопилот для тестов: общий для Node (test/game.test.js) и браузера (test/browser.smoke.mjs).
import * as M from '../src/core/maze.js';

const DT = 1 / 30;

// Автопилот — осторожный игрок: идёт к ближайшей цели, не шагает под сторожа, а от подошедшего вплотную отходит.
// Расстояния до сторожей — по коридорам (сторож за стеной не опасен). Возвращает 'won' | 'lost' | 'stuck'.
export function autopilot(game, level, maxSeconds) {
  const g = level.grid;
  const awake = () => game.enemies.filter(e => !e.asleep).map(e => (e.moving ? e.to : e.cell));
  const nearest = (cell, threats) => {
    if (!threats.length) return 99;
    const dist = M.bfs(g, cell, { blocked: (i, d) => d >= 0 && game.closedGate(i, d) }).dist;
    return Math.min.apply(null, threats.map(c => (dist[c] < 0 ? 99 : dist[c])));
  };
  for (let t = 0; t < maxSeconds; t += DT) {
    const pl = game.player;
    if (!pl.moving && !game.stepQueue.length) {
      const threats = awake();
      const here = nearest(pl.cell, threats);
      const res = M.bfs(g, pl.cell, { blocked: (i, d, j) => d >= 0 && !game.passable(i, d, j) });
      const targets = [];
      level.items.forEach(it => { if (!it.taken && it.kind === 'item') targets.push(it.cell); });
      level.keys.forEach(k => { if (!k.taken) targets.push(k.cell); });
      if (game.exitOpen) targets.push(level.exit);
      let best = -1, bd = 1e9;
      for (const c of targets) if (res.dist[c] >= 0 && res.dist[c] < bd) { bd = res.dist[c]; best = c; }
      const next = best >= 0 && best !== pl.cell ? M.pathTo(res.prev, pl.cell, best)[1] : -1;
      if (next >= 0 && nearest(next, threats) > 2) {
        game.push(g.dirBetween(pl.cell, next));
      } else if (here <= 2) {
        // отходим туда, где до сторожей дальше всего
        let flee = -1, fd = here;
        for (let d = 0; d < 4; d++) {
          if (!game.passable(pl.cell, d)) continue;
          const nd = nearest(g.neighbor(pl.cell, d), threats);
          if (nd > fd) { fd = nd; flee = d; }
        }
        if (flee >= 0) game.push(flee);
      }
    }
    game.update(DT);
    if (game.won) return 'won';
    if (game.lost) return 'lost';
  }
  return 'stuck';
}

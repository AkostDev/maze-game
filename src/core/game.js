/*
 * Игровая логика одного уровня: пошаговое движение по клеткам с плавной интерполяцией, предметы, ключи и дверцы,
 * порталы, сторожа, подсказка-клубочек, звёзды. Чистая логика — без Phaser и DOM: всё, что нужно показать
 * или озвучить, уходит наружу событиями emit() (их слушает GameScene).
 */
import * as M from './maze.js';
import { clamp, lerp } from './rng.js';

const OPP = M.OPP;
const DX = [0, 1, 0, -1], DY = [-1, 0, 1, 0];

export class Game {
  // opts: { onEvent(type, data), random() — источник случайности для сторожей (в тестах — сидированный) }
  constructor(level, opts) {
    opts = opts || {};
    const g = level.grid;
    this.level = level;
    this.onEvent = opts.onEvent || null;
    this.random = opts.random || Math.random;
    this.time = 0; this.elapsed = 0;
    this.started = false; this.won = false; this.lost = false; this.paused = false;
    this.steps = 0; this.hits = 0; this.hintsUsed = 0;
    this.hintsLeft = level.hints;
    this.hearts = level.rules.enemies ? level.hearts : 0;
    this.maxHearts = this.hearts;
    this.remaining = level.required;
    this.exitOpen = level.required === 0;
    this.keysHeld = new Set();
    this.itemsTaken = 0; this.bonusTaken = 0; this.gatesOpened = 0; this.portalsUsed = 0;
    this.lightRadius = level.fog;
    this.visited = new Uint8Array(g.n);
    this.visited[level.start] = 1;
    this.hint = null;
    this.lastProgress = 0; this.lastStuck = -99; this.lastBump = -1;
    this.heldDir = -1; this.heldSince = 0; this.holdDelay = 0.3;
    this.stepQueue = [];
    this.itemAt = new Map(); level.items.forEach(it => { it.taken = false; this.itemAt.set(it.cell, it); });
    this.keyAt = new Map(); level.keys.forEach(k => { k.taken = false; this.keyAt.set(k.cell, k); });
    this.portalAt = new Map(); level.portals.forEach(p => { this.portalAt.set(p.a, p.b); this.portalAt.set(p.b, p.a); });
    this.gateAt = new Map();
    level.gates.forEach(gt => {
      gt.open = false;
      this.gateAt.set(gt.a * 4 + gt.dir, gt);
      this.gateAt.set(gt.b * 4 + OPP[gt.dir], gt);
    });
    // px, py — положение в клетках (центр клетки = x + 0.5); dir — последнее направление шага
    this.player = {
      cell: level.start, from: level.start, to: level.start, t: 0, moving: false, dir: 2,
      px: g.x(level.start) + 0.5, py: g.y(level.start) + 0.5, invuln: 0, stun: 0, justTeleported: false
    };
    // Безопасная зона вокруг старта для сторожей
    this.startDist = M.bfs(g, level.start).dist;
    const sl = level.sleep;
    this.enemies = level.enemies.map((e, k) => ({
      type: e.type, route: e.route, ri: 0, rdir: 1, cell: e.cell, from: e.cell, to: e.cell, t: 0, moving: false,
      px: g.x(e.cell) + 0.5, py: g.y(e.cell) + 0.5, dirX: 0, lastDir: -1, speed: e.speed,
      asleep: false, wantSleep: false, sleepT: sl[0] + (sl[1] - sl[0]) * ((k * 0.37) % 1)
    }));
    this.sleepSeen = false;
    this.chaseField = null; this.chaseFrom = -1;
  }

  // ---------- Ввод ----------
  begin() {
    if (!this.started && !this.won && !this.lost) {
      this.started = true;
      this.emit('start', {});
    }
  }
  // Удержание направления: после задержки delay шаги повторяются по прямой, пока держат
  setHeld(dir, delay) {
    if (dir >= 0) this.begin();
    if (dir !== this.heldDir) this.heldSince = this.elapsed;
    this.heldDir = dir;
    if (delay != null) this.holdDelay = delay;
  }
  // Нажатие, свайп или тап — ровно один шаг (быстрые нажатия копятся, максимум 3)
  push(dir) {
    if (dir < 0 || this.won || this.lost) return;
    this.begin();
    if (this.stepQueue.length < 3) this.stepQueue.push(dir);
  }
  release() { this.heldDir = -1; }
  // Тап по полю: шаг в сторону касания (wx, wy — в клетках)
  tapToward(wx, wy) {
    const pl = this.player;
    const dx = wx - pl.px, dy = wy - pl.py;
    if (Math.abs(dx) < 0.45 && Math.abs(dy) < 0.45) return;
    this.push(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 1 : 3) : (dy > 0 ? 2 : 0));
  }

  // ---------- Правила прохода ----------
  passable(i, d, j) {
    const g = this.level.grid;
    if (!g.isOpen(i, d)) return false;
    if (j == null) j = g.neighbor(i, d);
    if (j < 0) return false;
    const gt = this.gateAt.get(i * 4 + d);
    if (gt && !gt.open && !this.keysHeld.has(gt.color)) return false;
    if (j === this.level.exit && !this.exitOpen) return false;
    return true;
  }
  bump(i, d) {
    if (this.elapsed - this.lastBump < 0.45) return;
    this.lastBump = this.elapsed;
    const g = this.level.grid;
    this.emit('bump', { dir: d });
    if (!g.isOpen(i, d)) return;
    const gt = this.gateAt.get(i * 4 + d);
    if (gt && !gt.open) { this.emit('gateLocked', { gate: gt }); return; }
    if (g.neighbor(i, d) === this.level.exit && !this.exitOpen) this.emit('exitLocked', { remaining: this.remaining });
  }

  // Следующий шаг: очередь нажатий, затем повтор при удержании. Без автоповоротов.
  chooseStep(cell) {
    if (this.stepQueue.length) {
      const d = this.stepQueue.shift();
      if (this.passable(cell, d)) return d;
      this.stepQueue.length = 0;
      this.bump(cell, d);
      return -1;
    }
    if (this.heldDir >= 0 && this.elapsed - this.heldSince >= this.holdDelay) {
      if (this.passable(cell, this.heldDir)) return this.heldDir;
      this.bump(cell, this.heldDir);
    }
    return -1;
  }

  startMove(d) {
    const pl = this.player;
    const gt = this.gateAt.get(pl.cell * 4 + d);
    if (gt && !gt.open) this.openGate(gt);
    pl.from = pl.cell; pl.to = this.level.grid.neighbor(pl.cell, d); pl.t = 0; pl.moving = true; pl.dir = d;
  }

  openGate(gt) {
    gt.open = true; this.gatesOpened++;
    this.keysHeld.delete(gt.color);
    this.emit('gateOpen', { gate: gt });
  }

  arrive() {
    const pl = this.player, lv = this.level;
    const from = pl.from;
    pl.cell = pl.to; pl.moving = false; pl.t = 0;
    this.steps++;
    if (!this.visited[pl.cell]) { this.visited[pl.cell] = 1; this.lastProgress = this.elapsed; }
    this.emit('step', { from, cell: pl.cell });

    const it = this.itemAt.get(pl.cell);
    if (it && !it.taken) this.take(it);
    const key = this.keyAt.get(pl.cell);
    if (key && !key.taken) {
      key.taken = true; this.keysHeld.add(key.color);
      this.lastProgress = this.elapsed;
      this.emit('key', { key });
    }
    if (pl.cell === lv.exit && this.exitOpen) { this.win(); return; }
    const other = this.portalAt.get(pl.cell);
    if (other != null && !pl.justTeleported) this.teleport(other);
    else if (other == null) pl.justTeleported = false;
  }

  take(it) {
    it.taken = true;
    this.lastProgress = this.elapsed;
    const lv = this.level;
    if (it.kind === 'item') {
      this.remaining--; this.itemsTaken++;
      this.emit('collect', { item: it, left: this.remaining, got: lv.required - this.remaining, total: lv.required });
      if (this.remaining <= 0 && !this.exitOpen) {
        this.exitOpen = true;
        this.emit('exitOpen', {});
      }
      return;
    }
    this.bonusTaken++;
    if (it.kind === 'firefly') this.lightRadius = Math.min(this.lightRadius + 0.45, 3.4);
    else if (it.kind === 'heart') this.hearts = Math.min(this.hearts + 1, this.maxHearts + 2);
    this.emit('bonus', { item: it, kind: it.kind });
  }

  teleport(to) {
    const pl = this.player, g = this.level.grid;
    const from = pl.cell;
    pl.cell = to; pl.from = to; pl.to = to; pl.moving = false;
    pl.px = g.x(to) + 0.5; pl.py = g.y(to) + 0.5;
    pl.justTeleported = true;
    this.stepQueue.length = 0;
    this.visited[to] = 1;
    this.portalsUsed++;
    this.emit('portal', { from, to });
  }

  // ---------- Подсказка-клубочек ----------
  // Путь до ближайшей цели: находка, ключ, дверца (если ключ уже есть) или открытый выход
  useHint() {
    if (this.won || this.lost) return false;
    if (this.hintsLeft <= 0) { this.emit('noHints', {}); return false; }
    const lv = this.level, pl = this.player;
    const from = pl.moving ? pl.to : pl.cell;
    const res = M.bfs(lv.grid, from, { blocked: (i, d, j) => d >= 0 && !this.passable(i, d, j) });
    const targets = [];
    lv.items.forEach(it => { if (!it.taken && it.kind === 'item') targets.push(it.cell); });
    lv.keys.forEach(k => { if (!k.taken) targets.push(k.cell); });
    lv.gates.forEach(gt => { if (!gt.open && this.keysHeld.has(gt.color)) targets.push(res.dist[gt.a] >= 0 ? gt.a : gt.b); });
    if (this.exitOpen) targets.push(lv.exit);
    let best = -1, bd = 1e9;
    for (const c of targets) if (res.dist[c] >= 0 && res.dist[c] < bd) { bd = res.dist[c]; best = c; }
    if (best < 0) return false;
    let path = M.pathTo(res.prev, from, best);
    if (path.length > lv.hintLen + 1) path = path.slice(0, lv.hintLen + 1);
    this.hint = { path, life: 7 };
    this.hintsUsed++; this.hintsLeft--;
    this.begin();
    this.emit('hint', { path });
    return true;
  }

  // ---------- Сторожа ----------
  updateEnemies(dt) {
    const lv = this.level, g = lv.grid, pl = this.player;
    if (!this.enemies.length) return;
    const pc = pl.moving && pl.t > 0.5 ? pl.to : pl.cell;
    if (this.enemies.some(e => e.type === 'chaser') && pc !== this.chaseFrom) {
      this.chaseFrom = pc;
      this.chaseField = M.bfs(g, pc, { blocked: (i, d) => d >= 0 && this.closedGate(i, d) }).dist;
    }
    const inSafe = c => this.startDist[c] >= 0 && this.startDist[c] < 3;
    const sl = lv.sleep;
    for (const e of this.enemies) {
      // Сторожа устают и засыпают — спящего можно обойти или пройти мимо
      e.sleepT -= dt;
      if (e.asleep) {
        if (e.sleepT <= 0) { e.asleep = false; e.sleepT = sl[0] + this.random() * (sl[1] - sl[0]); }
        continue;
      }
      if (e.sleepT <= 0 && !e.wantSleep) e.wantSleep = true;
      if (e.wantSleep && !e.moving) {
        e.wantSleep = false; e.asleep = true; e.sleepT = sl[2] * (0.85 + this.random() * 0.3);
        if (!this.sleepSeen) { this.sleepSeen = true; this.emit('enemySleep', {}); }
        continue;
      }
      let budget = e.speed * dt, guard = 0;
      while (budget > 0 && guard++ < 4) {
        if (!e.moving) {
          if (e.wantSleep) break;
          const next = this.enemyNext(e, inSafe);
          if (next < 0) break;
          e.from = e.cell; e.to = next; e.t = 0; e.moving = true;
          const d = g.dirBetween(e.cell, next);
          e.lastDir = d;
          if (DX[d]) e.dirX = DX[d];
        }
        const step = Math.min(budget, 1 - e.t);
        e.t += step; budget -= step;
        if (e.t >= 1) { e.cell = e.to; e.moving = false; e.t = 0; }
      }
      if (e.moving) {
        e.px = lerp(g.x(e.from), g.x(e.to), e.t) + 0.5;
        e.py = lerp(g.y(e.from), g.y(e.to), e.t) + 0.5;
      } else { e.px = g.x(e.cell) + 0.5; e.py = g.y(e.cell) + 0.5; }
    }
  }
  closedGate(i, d) { const gt = this.gateAt.get(i * 4 + d); return !!(gt && !gt.open); }
  enemyNext(e, inSafe) {
    const g = this.level.grid, lv = this.level;
    if (e.type === 'patrol' && e.route.length > 1) {
      let ni = e.ri + e.rdir;
      if (ni < 0 || ni >= e.route.length) { e.rdir = -e.rdir; ni = e.ri + e.rdir; }
      e.ri = ni;
      return e.route[ni];
    }
    const opts = [];
    for (let d = 0; d < 4; d++) {
      if (!g.isOpen(e.cell, d) || this.closedGate(e.cell, d)) continue;
      const j = g.neighbor(e.cell, d);
      if (j < 0 || j === lv.exit || inSafe(j) || this.portalAt.has(j)) continue;
      opts.push({ d, j });
    }
    if (!opts.length) return -1;
    if (e.type === 'chaser' && this.chaseField) {
      const my = this.chaseField[e.cell];
      if (my >= 0 && my <= lv.chaseRange && !inSafe(this.player.cell)) {
        let best = null;
        for (const o of opts) if (this.chaseField[o.j] >= 0 && this.chaseField[o.j] < my) best = o;
        if (best) return best.j;
      }
    }
    const fwd = opts.filter(o => e.lastDir < 0 || o.d !== OPP[e.lastDir]);
    const pool = fwd.length ? fwd : opts;
    return pool[Math.floor(this.random() * pool.length)].j;
  }

  onHit() {
    const pl = this.player;
    this.hits++;
    this.stepQueue.length = 0;
    this.hearts--;
    pl.invuln = 2.2; pl.stun = 0.35;
    this.emit('hit', { hearts: this.hearts });
    if (this.hearts <= 0) this.lose('caught');
  }

  // ---------- Кадр ----------
  update(dt) {
    this.time += dt;
    const pl = this.player, lv = this.level;
    if (this.hint) {
      this.hint.life -= dt;
      if (this.hint.life <= 0) this.hint = null;
    }
    if (this.paused || this.won || this.lost || !this.started) return;

    this.elapsed += dt;
    pl.invuln = Math.max(0, pl.invuln - dt);
    pl.stun = Math.max(0, pl.stun - dt);

    // Движение героя: бюджет пути за кадр переносится через границы клеток
    if (pl.stun <= 0) {
      let budget = dt * lv.speed, guard = 0;
      while (budget > 0 && guard++ < 6) {
        if (!pl.moving) {
          const d = this.chooseStep(pl.cell);
          if (d < 0) break;
          this.startMove(d);
        }
        const step = Math.min(budget, 1 - pl.t);
        pl.t += step; budget -= step;
        if (pl.t >= 1) { this.arrive(); if (this.won) break; }
      }
    }
    const g = lv.grid;
    if (pl.moving) {
      pl.px = lerp(g.x(pl.from), g.x(pl.to), pl.t) + 0.5;
      pl.py = lerp(g.y(pl.from), g.y(pl.to), pl.t) + 0.5;
    } else { pl.px = g.x(pl.cell) + 0.5; pl.py = g.y(pl.cell) + 0.5; }

    if (this.won) return;
    this.updateEnemies(dt);
    if (pl.invuln <= 0) {
      for (const e of this.enemies) {
        if (e.asleep) continue;
        const dx = e.px - pl.px, dy = e.py - pl.py;
        if (dx * dx + dy * dy < 0.36) { this.onHit(); break; }
      }
    }

    // «Застрял?» — повод подсветить кнопку подсказки
    if (this.elapsed - this.lastProgress > 20 && this.elapsed - this.lastStuck > 20 && !this.hint) {
      this.lastStuck = this.elapsed;
      this.emit('stuck', {});
    }
  }

  // ---------- Итоги ----------
  win() {
    if (this.won) return;
    this.won = true;
    this.heldDir = -1;
    this.emit('win', { result: this.result(true) });
  }
  lose(reason) {
    if (this.lost || this.won) return;
    this.lost = true;
    this.emit('lose', { result: Object.assign(this.result(false), { reason }) });
  }

  result(won) {
    const lv = this.level;
    return {
      won, stars: won ? computeStars(this, lv) : 0, time: this.elapsed, steps: this.steps, optimal: lv.optimalSteps,
      hintsUsed: this.hintsUsed, hits: this.hits, items: this.itemsTaken, bonus: this.bonusTaken,
      gates: this.gatesOpened, portals: this.portalsUsed, index: lv.index, title: lv.title
    };
  }

  emit(type, data) { if (this.onEvent) this.onEvent(type, data || {}); }
}

// Звёзды: по длине пути относительно оптимального (ночью и со сторожами пороги мягче),
// минус звезда за каждое столкновение и за подсказки
export function computeStars(game, lv) {
  const ratio = game.steps / Math.max(1, lv.optimalSteps);
  const loose = (lv.rules.dark ? 1.25 : 1) * (lv.rules.enemies ? 1.3 : 1);
  let s = ratio <= lv.stars[0] * loose ? 3 : ratio <= lv.stars[1] * loose ? 2 : 1;
  if (lv.rules.enemies) s = Math.min(s, 3 - Math.min(game.hits, 2));
  if (game.hintsUsed > 0) s = Math.min(s, 2);
  if (game.hintsUsed > 2) s = Math.min(s, 1);
  return clamp(s, 1, 3);
}

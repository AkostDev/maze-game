/*
 * Игровая логика: движение по клеткам с плавной интерполяцией, скольжение по коридорам,
 * буфер поворота, ведение пальцем; предметы, ключи, дверцы, порталы, враги, таймер, туман, подсказки.
 */
(function (root) {
  'use strict';
  const MZ = root.MZ = root.MZ || {};
  const M = MZ.maze, L = MZ.levels, audio = MZ.audio;
  const { clamp, lerp } = MZ.util;
  const OPP = M.OPP;
  const DX = [0, 1, 0, -1], DY = [-1, 0, 1, 0];

  class Game {
    constructor(renderer, cb) {
      this.r = renderer;
      this.cb = cb || {};
      this.level = null;
      this.time = 0;
      this.enemies = [];
      this.trail = [];
      this.player = { px: 0, py: 0 };
      this.paused = false;
    }

    start(level, opts) {
      opts = opts || {};
      const g = level.grid;
      this.level = level;
      this.heroId = opts.heroId || 'hedgehog';
      this.showTrail = opts.showTrail !== false;
      this.age = L.AGES[level.age];
      this.time = 0; this.elapsed = 0;
      this.started = false; this.won = false; this.lost = false; this.paused = false;
      this.steps = 0; this.hits = 0; this.hintsUsed = 0;
      this.hintsLeft = opts.hints != null ? opts.hints : this.age.hints;
      this.hearts = level.rules.enemies ? level.hearts : 0;
      this.maxHearts = this.hearts;
      this.remaining = level.required;
      this.exitOpen = level.required === 0; this.exitOpenT = this.exitOpen ? 1 : 0;
      this.keysHeld = new Set();
      this.itemsTaken = 0; this.bonusTaken = 0; this.gatesOpened = 0; this.portalsUsed = 0;
      this.timeLeft = level.timeLimit; this.overtime = false;
      this.lightRadius = level.fog;
      this.visited = new Uint8Array(g.n);
      this.visited[level.start] = 1;
      this.trail = [[g.x(level.start) + 0.5, g.y(level.start) + 0.5, 0]];
      this.hint = null;
      this.lastProgress = 0; this.lastStuck = -99; this.lastBump = -1;
      this.heldDir = -1; this.heldSince = 0; this.holdDelay = 0.3;
      this.bufferDir = -1; this.gliding = false; this.traceQueue = []; this.stepQueue = [];
      // 'step' — одно нажатие = одна клетка (по умолчанию); 'glide' — бег по коридору до развилки
      this.moveMode = opts.moveMode === 'glide' ? 'glide' : 'step';
      this.itemAt = new Map(); level.items.forEach(it => this.itemAt.set(it.cell, it));
      this.keyAt = new Map(); level.keys.forEach(k => this.keyAt.set(k.cell, k));
      this.portalAt = new Map(); level.portals.forEach(p => { this.portalAt.set(p.a, p.b); this.portalAt.set(p.b, p.a); });
      this.gateAt = new Map();
      level.gates.forEach(gt => {
        gt.open = false; gt.openT = 0; gt.shake = 0;
        this.gateAt.set(gt.a * 4 + gt.dir, gt);
        this.gateAt.set(gt.b * 4 + OPP[gt.dir], gt);
      });
      this.player = {
        cell: level.start, from: level.start, to: level.start, t: 0, moving: false, flowing: false, dir: -1, lastDir: -1,
        px: g.x(level.start) + 0.5, py: g.y(level.start) + 0.5, lookX: 0, lookY: 1,
        squash: 0, blink: 0, blinkT: 2.5, invuln: 0, stun: 0, teleportT: 0, justTeleported: false
      };
      // Безопасная зона вокруг старта для врагов
      this.startDist = M.bfs(g, level.start).dist;
      this.enemies = level.enemies.map((e, k) => ({
        type: e.type, route: e.route, ri: 0, rdir: 1, cell: e.cell, from: e.cell, to: e.cell, t: 0, moving: false,
        px: g.x(e.cell) + 0.5, py: g.y(e.cell) + 0.5, dirX: 0, dirY: 1, lastDir: -1,
        speed: e.speed, safe: e.safe, phase: k * 1.7,
        asleep: false, wantSleep: false, sleepT: this.age.sleep[0] + (this.age.sleep[1] - this.age.sleep[0]) * ((k * 0.37) % 1)
      }));
      this.sleepSeen = false;
      this.chaseField = null; this.chaseFrom = -1;
      this.r.setLevel(level);
      this.r.updateCamera(this, 0, true);
    }

    // ---------- Ввод ----------
    begin() {
      if (!this.started && !this.won && !this.lost) {
        this.started = true;
        if (this.cb.onStart) this.cb.onStart();
      }
    }
    // Удержание: в пошаговом режиме после задержки delay шаги повторяются, пока держат
    setHeld(dir, delay) {
      if (dir >= 0) { this.begin(); this.traceQueue.length = 0; }
      if (dir !== this.heldDir) this.heldSince = this.elapsed;
      this.heldDir = dir;
      if (delay != null) this.holdDelay = delay;
    }
    // Нажатие/свайп/тап: в пошаговом режиме — ровно один шаг (быстрые нажатия копятся, максимум 3)
    push(dir, glide) {
      if (dir < 0) return;
      this.begin();
      this.traceQueue.length = 0;
      if (this.moveMode === 'step') {
        if (this.stepQueue.length < 3) this.stepQueue.push(dir);
        return;
      }
      this.bufferDir = dir;
      this.bufferAt = this.elapsed;
      if (glide) this.gliding = true;
    }
    release(glide) {
      this.heldDir = -1;
      if (glide && this.moveMode === 'glide') this.gliding = true;
    }
    // Ведение пальцем: целевая клетка → короткий путь по коридорам
    traceTo(cell) {
      const lv = this.level, pl = this.player;
      if (cell < 0 || !lv.grid.active(cell)) return;
      const from = pl.moving ? pl.to : pl.cell;
      if (cell === from) { this.traceQueue.length = 0; return; }
      this.begin();
      const res = M.bfs(lv.grid, from, { blocked: (i, d, j) => d >= 0 && !this.passable(i, d, j) });
      if (res.dist[cell] < 0 || res.dist[cell] > 6) return;
      const path = M.pathTo(res.prev, from, cell);
      this.traceQueue = path.slice(1);
      this.bufferDir = -1; this.gliding = false; this.heldDir = -1; this.stepQueue.length = 0;
    }
    tapToward(wx, wy) {
      const pl = this.player;
      const dx = wx - pl.px, dy = wy - pl.py;
      if (Math.abs(dx) < 0.45 && Math.abs(dy) < 0.45) return;
      this.push(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 1 : 3) : (dy > 0 ? 2 : 0), true);
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
    exits(i, exceptDir) {
      const out = [];
      for (let d = 0; d < 4; d++) if (d !== exceptDir && this.passable(i, d)) out.push(d);
      return out;
    }
    bump(i, d) {
      if (this.elapsed - this.lastBump < 0.45) return;
      this.lastBump = this.elapsed;
      const g = this.level.grid;
      this.player.squash = -0.35;
      if (!g.isOpen(i, d)) { audio.play('bump'); return; }
      const gt = this.gateAt.get(i * 4 + d);
      if (gt && !gt.open) {
        gt.shake = 1; audio.play('locked'); audio.buzz(30);
        this.emit('gateLocked', { color: gt.color });
        return;
      }
      if (g.neighbor(i, d) === this.level.exit && !this.exitOpen) {
        audio.play('locked');
        this.emit('exitLocked', { remaining: this.remaining });
      }
    }

    // Выбор следующего шага. flowing — герой пришёл в клетку, не останавливаясь.
    chooseDir() {
      const pl = this.player, g = this.level.grid;
      const cell = pl.cell;
      const flowing = pl.flowing;
      // 1. Ведение пальцем
      if (this.traceQueue.length) {
        const next = this.traceQueue[0];
        const d = g.dirBetween(cell, next);
        if (d >= 0 && this.passable(cell, d)) { this.traceQueue.shift(); return d; }
        this.traceQueue.length = 0;
      }
      if (this.moveMode === 'step') return this.chooseStep(cell);
      // 2. Буфер поворота (свайп/тап/нажатие): сработает в первой клетке, где можно повернуть
      if (this.bufferDir >= 0) {
        const bd = this.bufferDir;
        if (this.passable(cell, bd)) { this.bufferDir = -1; return bd; }
        if (!flowing || this.elapsed - this.bufferAt > 1.5) {
          const fresh = this.elapsed - this.bufferAt < 0.3;
          this.bufferDir = -1;
          if (!flowing && this.heldDir < 0) {
            if (fresh) this.bump(cell, bd);
            this.gliding = false;
            return -1;
          }
        }
      }
      // 3. Удержание направления; в коридоре герой сам проходит повороты
      if (this.heldDir >= 0) {
        const hd = this.heldDir;
        if (this.passable(cell, hd)) return hd;
        if (flowing && pl.lastDir >= 0) {
          const ex = this.exits(cell, OPP[pl.lastDir]);
          if (ex.length === 1 && ex[0] !== OPP[hd]) return ex[0];
        }
        this.bump(cell, hd);
        return -1;
      }
      // 4. Скольжение по коридору до развилки
      if (this.gliding && flowing && pl.lastDir >= 0) {
        const ex = this.exits(cell, OPP[pl.lastDir]);
        if (ex.length === 1) return ex[0];
        this.gliding = false;
      }
      return -1;
    }

    // Пошаговый режим: очередь нажатий, затем повтор при удержании. Без автоповоротов.
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
      const pl = this.player, g = this.level.grid;
      const j = g.neighbor(pl.cell, d);
      const gt = this.gateAt.get(pl.cell * 4 + d);
      if (gt && !gt.open) this.openGate(gt);
      pl.from = pl.cell; pl.to = j; pl.t = 0; pl.moving = true; pl.flowing = true;
      if (pl.lastDir >= 0 && d !== pl.lastDir) pl.squash = 0.4;
      pl.dir = d; pl.lastDir = d;
      pl.lookX = DX[d]; pl.lookY = DY[d];
    }

    openGate(gt) {
      gt.open = true; this.gatesOpened++;
      this.keysHeld.delete(gt.color);
      audio.play('gate'); audio.buzz(20);
      const g = this.level.grid;
      const x = (g.x(gt.a) + g.x(gt.b)) / 2 + 0.5, y = (g.y(gt.a) + g.y(gt.b)) / 2 + 0.5;
      this.r.burst(x, y, [L.KEY_COLORS[gt.color].color, '#FFFFFF'], 18, { shape: 'star', speed: 3 });
      this.emit('gateOpen', { color: gt.color });
    }

    arrive() {
      const pl = this.player, lv = this.level, g = lv.grid;
      pl.cell = pl.to; pl.moving = false; pl.t = 0;
      this.steps++;
      audio.play('step');
      const cx = g.x(pl.cell) + 0.5, cy = g.y(pl.cell) + 0.5;
      this.trail.push([cx, cy, 0]);
      if (this.trail.length > 700) this.trail.splice(0, this.trail.length - 700);
      if (!this.visited[pl.cell]) { this.visited[pl.cell] = 1; this.lastProgress = this.elapsed; }

      const it = this.itemAt.get(pl.cell);
      if (it && !it.taken) this.take(it, cx, cy);
      const key = this.keyAt.get(pl.cell);
      if (key && !key.taken) {
        key.taken = true; this.keysHeld.add(key.color);
        this.lastProgress = this.elapsed;
        audio.play('key'); audio.buzz(25);
        this.r.burst(cx, cy, [L.KEY_COLORS[key.color].color, '#FFFFFF', '#FFE45C'], 20, { shape: 'star' });
        this.emit('key', { color: key.color });
      }
      if (pl.cell === lv.exit && this.exitOpen) { this.win(); return; }
      const other = this.portalAt.get(pl.cell);
      if (other != null && !pl.justTeleported) {
        this.teleport(other);
      } else if (other == null) pl.justTeleported = false;
    }

    take(it, cx, cy) {
      it.taken = true;
      this.lastProgress = this.elapsed;
      const lv = this.level;
      if (it.kind === 'item') {
        this.remaining--; this.itemsTaken++;
        audio.play('collect'); audio.buzz(15);
        this.r.burst(cx, cy, lv.world.deco.concat(['#FFFFFF']), 16, { shape: 'star', speed: 2.6 });
        this.r.floatText(cx, cy - 0.3, (lv.required - this.remaining) + '/' + lv.required, '#FFFFFF');
        this.emit('collect', { left: this.remaining });
        if (this.remaining <= 0 && !this.exitOpen) {
          this.exitOpen = true;
          setTimeout(() => audio.play('door'), 250);
          const g = lv.grid;
          this.r.burst(g.x(lv.exit) + 0.5, g.y(lv.exit) + 0.5, ['#FFD45C', '#FFFFFF', '#FF5B4F'], 30, { shape: 'star', speed: 3.5 });
          this.emit('exitOpen', {});
        }
      } else {
        this.bonusTaken++;
        audio.play('bonus');
        if (it.kind === 'clock') {
          const add = this.age.id === 'tiny' ? 10 : 7;
          this.timeLeft += add; this.overtime = this.timeLeft <= 0;
          this.r.floatText(cx, cy - 0.3, '+' + add + ' с', '#FFE070');
        } else if (it.kind === 'firefly') {
          this.lightRadius = Math.min(this.lightRadius + 0.45, 3.2);
          this.r.floatText(cx, cy - 0.3, 'Светлее!', '#FFF3A0');
        } else if (it.kind === 'heart') {
          this.hearts = Math.min(this.hearts + 1, this.maxHearts + 2);
          this.r.floatText(cx, cy - 0.3, '+♥', '#FF8FA3');
        }
        this.r.burst(cx, cy, ['#FFE45C', '#FFFFFF'], 12, { speed: 2 });
        this.emit('bonus', { kind: it.kind });
      }
    }

    teleport(to) {
      const pl = this.player, g = this.level.grid;
      const fx = g.x(pl.cell) + 0.5, fy = g.y(pl.cell) + 0.5;
      this.r.burst(fx, fy, ['#A15CFF', '#FFFFFF', '#00B8D9'], 16, { speed: 2.5, gravity: 0 });
      pl.cell = to; pl.from = to; pl.to = to; pl.moving = false;
      pl.px = g.x(to) + 0.5; pl.py = g.y(to) + 0.5;
      pl.teleportT = 1; pl.justTeleported = true;
      this.gliding = false; this.bufferDir = -1; this.traceQueue.length = 0; this.stepQueue.length = 0;
      this.trail.push([pl.px, pl.py, 1]);
      this.visited[to] = 1;
      this.portalsUsed++;
      audio.play('portal');
      this.emit('portal', {});
    }

    // ---------- Подсказка-клубочек ----------
    useHint() {
      if (this.won || this.lost) return false;
      if (this.hintsLeft <= 0) { this.emit('noHints', {}); audio.play('locked'); return false; }
      const lv = this.level, g = lv.grid, pl = this.player;
      const from = pl.moving ? pl.to : pl.cell;
      const res = M.bfs(g, from, { blocked: (i, d, j) => d >= 0 && !this.passable(i, d, j) });
      const targets = [];
      lv.items.forEach(it => { if (!it.taken && it.kind === 'item') targets.push(it.cell); });
      lv.keys.forEach(k => { if (!k.taken) targets.push(k.cell); });
      // Дверца, к которой уже есть ключ, тоже цель
      lv.gates.forEach(gt => { if (!gt.open && this.keysHeld.has(gt.color)) targets.push(res.dist[gt.a] >= 0 ? gt.a : gt.b); });
      if (this.exitOpen) targets.push(lv.exit);
      let best = -1, bd = 1e9;
      for (const c of targets) if (res.dist[c] >= 0 && res.dist[c] < bd) { bd = res.dist[c]; best = c; }
      if (best < 0) return false;
      let path = M.pathTo(res.prev, from, best);
      const limit = { tiny: 999, kid: 999, teen: 14, pro: 10 }[this.age.id];
      if (path.length > limit + 1) path = path.slice(0, limit + 1);
      this.hint = { path, progress: 0, life: 7 };
      this.hintsUsed++; this.hintsLeft--;
      audio.play('hint');
      this.emit('hint', {});
      this.begin();
      return true;
    }

    // ---------- Враги ----------
    updateEnemies(dt) {
      const lv = this.level, g = lv.grid, pl = this.player;
      if (!this.enemies.length) return;
      const pc = pl.moving && pl.t > 0.5 ? pl.to : pl.cell;
      if (this.enemies.some(e => e.type === 'chaser') && pc !== this.chaseFrom) {
        this.chaseFrom = pc;
        this.chaseField = M.bfs(g, pc, { blocked: (i, d) => d >= 0 && this.closedGate(i, d) }).dist;
      }
      const inSafe = c => this.startDist[c] >= 0 && this.startDist[c] < 3;
      const sl = this.age.sleep;
      for (const e of this.enemies) {
        // Сторожа устают и засыпают — спящего можно тихонько обойти или пройти мимо
        e.sleepT -= dt;
        if (e.asleep) {
          if (e.sleepT <= 0) { e.asleep = false; e.sleepT = sl[0] + Math.random() * (sl[1] - sl[0]); }
          continue;
        }
        if (e.sleepT <= 0 && !e.wantSleep) e.wantSleep = true;
        if (e.wantSleep && !e.moving) {
          e.wantSleep = false; e.asleep = true; e.sleepT = sl[2] * (0.85 + Math.random() * 0.3);
          if (!this.sleepSeen) { this.sleepSeen = true; this.emit('enemySleep', {}); }
          continue;
        }
        let budget = e.speed * dt;
        let guard = 0;
        while (budget > 0 && guard++ < 4) {
          if (!e.moving && e.wantSleep) break;
          if (!e.moving) {
            const next = this.enemyNext(e, inSafe);
            if (next < 0) break;
            e.from = e.cell; e.to = next; e.t = 0; e.moving = true;
            const d = g.dirBetween(e.cell, next);
            e.lastDir = d; e.dirX = DX[d]; e.dirY = DY[d];
          }
          const step = Math.min(budget, 1 - e.t);
          e.t += step; budget -= step;
          if (e.t >= 1) { e.cell = e.to; e.moving = false; e.t = 0; }
        }
        e.px = lerp(g.x(e.from), g.x(e.to), e.t) + 0.5;
        e.py = lerp(g.y(e.from), g.y(e.to), e.t) + 0.5;
        if (!e.moving) { e.px = g.x(e.cell) + 0.5; e.py = g.y(e.cell) + 0.5; }
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
        const pl = this.player;
        if (my >= 0 && my <= this.level.chaseRange && !inSafe(pl.cell)) {
          let best = null;
          for (const o of opts) if (this.chaseField[o.j] >= 0 && this.chaseField[o.j] < my) best = o;
          if (best) return best.j;
        }
      }
      const fwd = opts.filter(o => e.lastDir < 0 || o.d !== OPP[e.lastDir]);
      const pool = fwd.length ? fwd : opts;
      return pool[Math.floor(Math.random() * pool.length)].j;
    }

    onHit() {
      const pl = this.player;
      this.hits++;
      this.r.hit();
      audio.play('hit'); audio.buzz([60, 40, 60]);
      this.traceQueue.length = 0; this.gliding = false; this.bufferDir = -1; this.stepQueue.length = 0;
      if (this.age.id === 'tiny' || this.hearts <= 0 && this.maxHearts === 0) {
        pl.stun = 0.9; pl.invuln = 2.4;
        this.emit('hit', { hearts: -1 });
        return;
      }
      this.hearts--;
      pl.invuln = 2.2; pl.stun = 0.35;
      this.emit('hit', { hearts: this.hearts });
      if (this.hearts <= 0) this.lose('caught');
    }

    // ---------- Кадр ----------
    update(dt) {
      this.time += dt;
      const pl = this.player, lv = this.level;
      if (!lv) return;
      // Анимации, которые идут всегда
      pl.squash *= Math.pow(0.001, dt);
      pl.blinkT -= dt;
      if (pl.blinkT <= 0) { pl.blink = 1; pl.blinkT = 2 + Math.random() * 3.5; }
      pl.blink = Math.max(0, pl.blink - dt * 7);
      if (pl.teleportT > 0) pl.teleportT = Math.max(0, pl.teleportT - dt * 3);
      lv.gates.forEach(gt => {
        if (gt.open && gt.openT < 1) gt.openT = Math.min(1, gt.openT + dt * 2.5);
        if (gt.shake > 0) gt.shake = Math.max(0, gt.shake - dt * 2.5);
      });
      if (this.exitOpen && this.exitOpenT < 1) this.exitOpenT = Math.min(1, this.exitOpenT + dt * 2);
      if (this.hint) {
        this.hint.progress += dt * 16;
        this.hint.life -= dt;
        if (this.hint.life <= 0) this.hint = null;
      }
      if (this.paused || this.won || this.lost || !this.started) return;

      this.elapsed += dt;
      pl.invuln = Math.max(0, pl.invuln - dt);
      pl.stun = Math.max(0, pl.stun - dt);

      // Движение героя: бюджет пути за кадр переносится через границы клеток
      if (pl.stun <= 0) {
        let budget = dt * lv.speed;
        let guard = 0;
        while (budget > 0 && guard++ < 6) {
          if (!pl.moving) {
            const d = this.chooseDir();
            if (d < 0) { pl.flowing = false; break; }
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
      } else if (pl.teleportT <= 0) {
        pl.px = g.x(pl.cell) + 0.5; pl.py = g.y(pl.cell) + 0.5;
      }

      if (this.won) return;
      this.updateEnemies(dt);
      if (pl.invuln <= 0 && pl.teleportT <= 0) {
        for (const e of this.enemies) {
          if (e.asleep) continue;
          const dx = e.px - pl.px, dy = e.py - pl.py;
          if (dx * dx + dy * dy < 0.36) { this.onHit(); break; }
        }
      }

      // Таймер
      if (lv.rules.timer) {
        const before = Math.ceil(this.timeLeft);
        this.timeLeft -= dt;
        const after = Math.ceil(this.timeLeft);
        if (after !== before && after <= 10 && after > 0) audio.play('tick');
        if (this.timeLeft <= 0 && !this.overtime) {
          if (this.age.id === 'tiny') { this.overtime = true; this.emit('overtime', {}); }
          else { this.lose('time'); return; }
        }
      }

      // «Застрял?» — мягкая подсказка
      const stuckAfter = this.age.id === 'tiny' ? 12 : 25;
      if (this.elapsed - this.lastProgress > stuckAfter && this.elapsed - this.lastStuck > 25 && !this.hint) {
        this.lastStuck = this.elapsed;
        this.emit('stuck', {});
      }
    }

    // ---------- Итоги ----------
    win() {
      if (this.won) return;
      this.won = true;
      this.gliding = false; this.heldDir = -1;
      audio.play('win'); audio.buzz([30, 50, 30, 50, 80]);
      this.r.confetti(90);
      const g = this.level.grid;
      this.r.burst(g.x(this.level.exit) + 0.5, g.y(this.level.exit) + 0.5, ['#FFD45C', '#FF5B4F', '#FFFFFF', '#13A89E'], 40, { shape: 'star', speed: 4 });
      const result = this.result(true);
      setTimeout(() => { if (this.cb.onWin) this.cb.onWin(result); }, 900);
    }
    lose(reason) {
      if (this.lost || this.won) return;
      this.lost = true;
      this.lastLoss = reason;
      audio.play('lose'); audio.buzz(200);
      const result = this.result(false);
      result.reason = reason;
      setTimeout(() => { if (this.cb.onLose) this.cb.onLose(result); }, 800);
    }

    result(won) {
      const lv = this.level, age = this.age;
      const stars = won ? computeStars(this, lv, age) : 0;
      const par = lv.optimalSteps / lv.speed;
      let score = 0;
      if (won) {
        score = 500 + this.itemsTaken * 100 + this.gatesOpened * 150 + this.bonusTaken * 40 + stars * 300 +
          Math.max(0, Math.round((par * 1.6 - this.elapsed) * 12)) - this.hintsUsed * 100 - this.hits * 150;
        if (lv.rules.timer) score += Math.max(0, Math.round(this.timeLeft * 15));
        score = Math.max(50, Math.round(score * ({ tiny: 1, kid: 1.2, teen: 1.5, pro: 2 }[age.id])));
      }
      return {
        won, stars, score, time: this.elapsed, steps: this.steps, optimal: lv.optimalSteps,
        hintsUsed: this.hintsUsed, hits: this.hits, items: this.itemsTaken, bonus: this.bonusTaken,
        gates: this.gatesOpened, portals: this.portalsUsed, timeLeft: this.timeLeft, overtime: this.overtime,
        mode: lv.mode, index: lv.index, age: lv.age, title: lv.title, seed: lv.seed,
        perfectPath: won && this.steps <= lv.optimalSteps + 1, noHints: this.hintsUsed === 0,
        dark: lv.rules.dark, enemies: lv.rules.enemies, timer: lv.rules.timer
      };
    }

    emit(type, data) { if (this.cb.onEvent) this.cb.onEvent(type, data || {}); }
  }

  function computeStars(game, lv, age) {
    if (age.id === 'tiny') {
      let s = 3;
      if (game.hintsUsed > 3 || game.overtime || game.hits > 3) s = 2;
      return s;
    }
    let s;
    if (lv.rules.timer) {
      const f = game.timeLeft / lv.timeLimit;
      s = f >= (age.id === 'kid' ? 0.25 : 0.33) ? 3 : f >= 0.1 ? 2 : 1;
    } else if (lv.rules.enemies) {
      s = game.hits === 0 ? 3 : game.hits === 1 ? 2 : 1;
    } else {
      const ratio = game.steps / Math.max(1, lv.optimalSteps);
      const th = age.stars || [2, 3];
      const loose = lv.rules.dark ? 1.25 : 1;
      s = ratio <= th[0] * loose ? 3 : ratio <= th[1] * loose ? 2 : 1;
    }
    if (game.hintsUsed > 0) s = Math.min(s, 2);
    if (game.hintsUsed > 2) s = Math.min(s, 1);
    return clamp(s, 1, 3);
  }

  MZ.Game = Game;
  MZ.computeStars = computeStars;
})(typeof window !== 'undefined' ? window : globalThis);

/* Рендерер: статический слой лабиринта в кэше, камера со следованием и зумом, объекты, частицы, туман */
(function (root) {
  'use strict';
  const MZ = root.MZ = root.MZ || {};
  const S = MZ.sprites;
  const { clamp, lerp, makeRng } = MZ.util;
  const TAU = Math.PI * 2;

  class Renderer {
    constructor(canvas) {
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d');
      this.dpr = 1; this.w = 1; this.h = 1;
      this.insets = { top: 76, right: 12, bottom: 96, left: 12 };
      this.cam = { x: 0, y: 0, scale: 40 };
      this.userZoom = 1;
      this.overview = false;
      this.layer = null; this.layerScale = 0; this.layerDirty = true;
      this.particles = [];
      this.floaters = [];
      this.shake = 0;
      this.flash = 0;
      this.fog = null;
      this.level = null;
      this.reduced = MZ.util.reducedMotion();
      this.resize();
    }

    resize() {
      const rect = this.canvas.getBoundingClientRect();
      this.dpr = Math.min(root.devicePixelRatio || 1, 2.5);
      this.w = Math.max(1, rect.width);
      this.h = Math.max(1, rect.height);
      this.canvas.width = Math.round(this.w * this.dpr);
      this.canvas.height = Math.round(this.h * this.dpr);
      this.layerDirty = true;
      this.fog = null;
    }

    setInsets(ins) { Object.assign(this.insets, ins); }

    setLevel(level) {
      this.level = level;
      this.layer = null; this.layerDirty = true;
      this.particles.length = 0; this.floaters.length = 0;
      this.userZoom = 1; this.overview = false;
      this.cam.x = level.cols / 2; this.cam.y = level.rows / 2;
      this.cam.scale = this.fitScale();
    }

    viewW() { return Math.max(40, this.w - this.insets.left - this.insets.right); }
    viewH() { return Math.max(40, this.h - this.insets.top - this.insets.bottom); }
    fitScale() {
      const lv = this.level;
      if (!lv) return 40;
      return Math.max(8, Math.min(this.viewW() / (lv.cols + 0.6), this.viewH() / (lv.rows + 0.6)));
    }
    minCell() {
      const age = MZ.levels.AGES[this.level.age];
      return Math.min(age.minCellPx, Math.min(this.w, this.h) / 5);
    }
    maxCell() { return Math.max(this.fitScale(), Math.min(this.w, this.h) / 3.2); }
    targetScale() {
      const fit = this.fitScale();
      if (this.overview) return fit;
      if (this.level.rules.dark) {
        // Ночью камера всегда близко (≈8 клеток по короткой стороне) и следует за героем —
        // иначе маленький лабиринт на большом мониторе почти весь попадает в круг света
        const dc = Math.min(this.w, this.h) / 8;
        const base = Math.min(Math.max(fit, this.minCell()), dc);
        return clamp(base * this.userZoom, Math.min(fit, dc) * 0.7, dc * 1.6);
      }
      return clamp(Math.max(fit, this.minCell()) * this.userZoom, fit, this.maxCell());
    }
    zoomBy(f) {
      this.overview = false;
      const fit = this.fitScale(), base = Math.max(fit, this.minCell());
      this.userZoom = clamp(this.userZoom * f, fit / base, this.maxCell() / base);
    }
    toggleOverview() { this.overview = !this.overview; return this.overview; }

    worldToScreen(wx, wy) {
      const vx = this.insets.left + this.viewW() / 2, vy = this.insets.top + this.viewH() / 2;
      return [(wx - this.cam.x) * this.cam.scale + vx, (wy - this.cam.y) * this.cam.scale + vy];
    }
    screenToWorld(sx, sy) {
      const vx = this.insets.left + this.viewW() / 2, vy = this.insets.top + this.viewH() / 2;
      return [(sx - vx) / this.cam.scale + this.cam.x, (sy - vy) / this.cam.scale + this.cam.y];
    }

    updateCamera(game, dt, snap) {
      const lv = this.level;
      const target = this.targetScale();
      const k = snap ? 1 : 1 - Math.pow(0.0008, dt);
      this.cam.scale = lerp(this.cam.scale, target, k);
      const s = this.cam.scale;
      const vw = this.viewW() / s, vh = this.viewH() / s;
      let tx, ty;
      const px = game.player.px, py = game.player.py;
      if (lv.cols <= vw) tx = lv.cols / 2;
      else tx = clamp(px, vw / 2 - 0.3, lv.cols - vw / 2 + 0.3);
      if (lv.rows <= vh) ty = lv.rows / 2;
      else ty = clamp(py, vh / 2 - 0.3, lv.rows - vh / 2 + 0.3);
      const kc = snap ? 1 : 1 - Math.pow(0.002, dt);
      this.cam.x = lerp(this.cam.x, tx, kc);
      this.cam.y = lerp(this.cam.y, ty, kc);
      // Статический слой перерисовываем, если масштаб заметно изменился
      const wanted = this.wantedLayerScale();
      if (!this.layer || this.layerDirty || Math.abs(wanted - this.layerScale) / this.layerScale > 0.28) this.buildLayer(wanted);
    }

    wantedLayerScale() {
      const lv = this.level;
      const want = this.targetScale() * this.dpr;
      return Math.max(6, Math.min(want, 4096 / (lv.cols + 1), 4096 / (lv.rows + 1), Math.sqrt(14e6 / ((lv.cols + 1) * (lv.rows + 1)))));
    }

    // ---------- Статический слой ----------
    buildLayer(ls) {
      const lv = this.level, g = lv.grid, w = lv.world;
      const pad = 0.5;
      const cw = Math.ceil((lv.cols + pad * 2) * ls), ch = Math.ceil((lv.rows + pad * 2) * ls);
      const cv = this.layer && this.layer.width === cw && this.layer.height === ch ? this.layer : document.createElement('canvas');
      cv.width = cw; cv.height = ch;
      const c = cv.getContext('2d');
      c.clearRect(0, 0, cw, ch);
      c.save();
      c.scale(ls, ls);
      c.translate(pad, pad);
      // Тень «доски»
      c.fillStyle = w.shadow;
      for (let i = 0; i < g.n; i++) if (g.active(i)) c.fillRect(g.x(i) - 0.06, g.y(i) + 0.14, 1.12, 1.02);
      // Пол
      for (let i = 0; i < g.n; i++) {
        if (!g.active(i)) continue;
        const x = g.x(i), y = g.y(i);
        c.fillStyle = w.floor[(x + y) & 1];
        c.fillRect(x - 0.01, y - 0.01, 1.02, 1.02);
      }
      // Коврик старта
      const sx = g.x(lv.start) + 0.5, sy = g.y(lv.start) + 0.5;
      c.fillStyle = 'rgba(255,255,255,0.55)';
      c.beginPath(); c.ellipse(sx, sy + 0.1, 0.36, 0.26, 0, 0, TAU); c.fill();
      c.strokeStyle = 'rgba(0,0,0,0.08)'; c.lineWidth = 0.03; c.setLineDash([0.07, 0.06]);
      c.beginPath(); c.ellipse(sx, sy + 0.1, 0.3, 0.2, 0, 0, TAU); c.stroke(); c.setLineDash([]);
      // Декор (сидируемый)
      const rng = makeRng('deco|' + lv.seed);
      const occupied = new Set([lv.start, lv.exit]);
      lv.items.forEach(it => occupied.add(it.cell)); lv.keys.forEach(k => occupied.add(k.cell));
      lv.portals.forEach(p => { occupied.add(p.a); occupied.add(p.b); });
      for (let i = 0; i < g.n; i++) {
        if (!g.active(i) || occupied.has(i) || !rng.chance(0.16)) continue;
        c.save(); c.scale(1 / 100, 1 / 100);
        S.drawDeco(c, w.id, (g.x(i) + rng.range(0.25, 0.75)) * 100, (g.y(i) + rng.range(0.25, 0.75)) * 100, 100, rng.int(9), w.deco);
        c.restore();
      }
      // Стены
      const path = new Path2D();
      for (let i = 0; i < g.n; i++) {
        if (!g.active(i)) continue;
        const x = g.x(i), y = g.y(i);
        if (!g.isOpen(i, 0)) { path.moveTo(x, y); path.lineTo(x + 1, y); }
        if (!g.isOpen(i, 3)) { path.moveTo(x, y); path.lineTo(x, y + 1); }
        if (!g.isOpen(i, 2) && g.neighbor(i, 2) < 0) { path.moveTo(x, y + 1); path.lineTo(x + 1, y + 1); }
        if (!g.isOpen(i, 1) && g.neighbor(i, 1) < 0) { path.moveTo(x + 1, y); path.lineTo(x + 1, y + 1); }
      }
      c.lineCap = 'round'; c.lineJoin = 'round';
      c.save(); c.translate(0, 0.07); c.strokeStyle = w.shadow; c.lineWidth = 0.22; c.stroke(path); c.restore();
      c.strokeStyle = w.wall; c.lineWidth = 0.2; c.stroke(path);
      c.save(); c.translate(0, -0.035); c.strokeStyle = w.wallHi; c.lineWidth = 0.075; c.stroke(path); c.restore();
      c.restore();
      this.layer = cv; this.layerScale = ls; this.layerPad = pad; this.layerDirty = false;
    }

    // ---------- Эффекты ----------
    burst(wx, wy, colors, n, opts) {
      if (this.reduced) n = Math.ceil(n / 3);
      opts = opts || {};
      for (let k = 0; k < n; k++) {
        const a = Math.random() * TAU, sp = (opts.speed || 3) * (0.4 + Math.random() * 0.8);
        this.particles.push({
          x: wx, y: wy, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - (opts.up || 1.5),
          life: 1, decay: 1 / (opts.life || 0.8) * (0.7 + Math.random() * 0.6),
          size: (opts.size || 0.09) * (0.6 + Math.random() * 0.8),
          color: colors[k % colors.length], shape: opts.shape || 'dot', rot: Math.random() * TAU, vr: (Math.random() - 0.5) * 10,
          g: opts.gravity != null ? opts.gravity : 6
        });
      }
    }
    confetti(n) {
      const cols = ['#FF5B4F', '#FFBE2E', '#13A89E', '#7A5CFA', '#3D9BF5', '#FF8FC7'];
      for (let k = 0; k < (this.reduced ? 20 : n); k++) {
        this.particles.push({
          x: this.cam.x + (Math.random() - 0.5) * this.viewW() / this.cam.scale, y: this.cam.y - this.viewH() / this.cam.scale / 2 - Math.random() * 2,
          vx: (Math.random() - 0.5) * 2, vy: 2 + Math.random() * 3, life: 1, decay: 0.25 + Math.random() * 0.15,
          size: 0.12 + Math.random() * 0.1, color: cols[k % cols.length], shape: 'rect', rot: Math.random() * TAU, vr: (Math.random() - 0.5) * 8, g: 1.2
        });
      }
    }
    floatText(wx, wy, text, color) {
      this.floaters.push({ x: wx, y: wy, text, color: color || '#FFFFFF', life: 1 });
    }
    hit() { this.shake = this.reduced ? 0 : 0.35; this.flash = 0.6; }

    // ---------- Кадр ----------
    draw(game, dt) {
      const ctx = this.ctx, lv = this.level;
      if (!lv) return;
      this.updateCamera(game, dt, false);
      ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      ctx.clearRect(0, 0, this.w, this.h);
      let ox = 0, oy = 0;
      if (this.shake > 0) {
        this.shake = Math.max(0, this.shake - dt);
        ox = (Math.random() - 0.5) * this.shake * 22; oy = (Math.random() - 0.5) * this.shake * 22;
        ctx.translate(ox, oy);
      }
      const s = this.cam.scale;
      const t = game.time;
      const P = (cx, cy) => this.worldToScreen(cx, cy);
      const cellC = i => P(lv.grid.x(i) + 0.5, lv.grid.y(i) + 0.5);

      // Лабиринт
      if (this.layer) {
        const [x0, y0] = P(-this.layerPad, -this.layerPad);
        const k = s / this.layerScale;
        ctx.imageSmoothingEnabled = true;
        ctx.drawImage(this.layer, x0, y0, this.layer.width * k, this.layer.height * k);
      }

      // Нить-след
      this.drawTrail(ctx, game, P, s);

      // Порталы
      lv.portals.forEach(pt => {
        const col = MZ.levels.PORTAL_COLORS[pt.color];
        let [x, y] = cellC(pt.a); S.drawPortal(ctx, x, y, s, col, t);
        [x, y] = cellC(pt.b); S.drawPortal(ctx, x, y, s, col, t + 1);
      });
      // Дверцы
      lv.gates.forEach(gt => {
        if (gt.openT >= 1) return;
        const ax = lv.grid.x(gt.a) + 0.5, ay = lv.grid.y(gt.a) + 0.5;
        const bx = lv.grid.x(gt.b) + 0.5, by = lv.grid.y(gt.b) + 0.5;
        const [x, y] = P((ax + bx) / 2, (ay + by) / 2);
        const horizontal = ay !== by;
        S.drawGate(ctx, MZ.levels.KEY_COLORS[gt.color], x, y, s, horizontal, gt.openT, t, gt.shake || 0);
      });
      // Домик
      {
        const [x, y] = cellC(lv.exit);
        S.drawHouse(ctx, x, y, s, game.exitOpen, game.remaining, t, game.exitOpenT);
      }
      // Предметы и ключи
      lv.items.forEach((it, k) => {
        if (it.taken) return;
        const [x, y] = cellC(it.cell);
        S.drawItem(ctx, it.kind === 'item' ? lv.world.item : it.kind, x, y, s, t, k * 1.3);
      });
      lv.keys.forEach(kk => {
        if (kk.taken) return;
        const [x, y] = cellC(kk.cell);
        S.drawKey(ctx, MZ.levels.KEY_COLORS[kk.color], x, y, s, t + kk.color);
      });
      // Враги
      game.enemies.forEach(e => {
        const [x, y] = P(e.px, e.py);
        S.drawEnemy(ctx, lv.world.enemy, x, y, s, t + e.phase, e.dirX, e.dirY, e.asleep);
      });
      // Герой
      {
        const pl = game.player;
        const [x, y] = P(pl.px, pl.py);
        if (pl.teleportT > 0) {
          ctx.save(); ctx.globalAlpha = 1 - pl.teleportT;
          S.drawHero(ctx, game.heroId, x, y, s * (1 - pl.teleportT * 0.6), { t, lookX: pl.lookX, lookY: pl.lookY });
          ctx.restore();
        } else {
          S.drawHero(ctx, game.heroId, x, y, s, {
            t, lookX: pl.lookX, lookY: pl.lookY, moving: pl.moving, squash: pl.squash,
            blink: pl.blink, hurt: pl.invuln > 0, dizzy: pl.stun > 0
          });
        }
      }

      // Частицы
      this.updateParticles(ctx, dt, P, s);

      // Туман
      if (lv.rules.dark && !game.won) this.drawFog(ctx, game, P, s);
      // Подсказка-клубочек — поверх тумана, чтобы светить дорогу и ночью
      if (game.hint) this.drawHint(ctx, game, P, s, t);

      // Всплывающий текст
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      for (let k = this.floaters.length - 1; k >= 0; k--) {
        const f = this.floaters[k];
        f.life -= dt * 0.9; f.y -= dt * 0.9;
        if (f.life <= 0) { this.floaters.splice(k, 1); continue; }
        const [x, y] = P(f.x, f.y);
        ctx.globalAlpha = Math.min(1, f.life * 2);
        ctx.font = '800 ' + Math.round(clamp(s * 0.42, 14, 30)) + 'px Nunito, system-ui, sans-serif';
        ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(20,24,50,0.55)'; ctx.strokeText(f.text, x, y);
        ctx.fillStyle = f.color; ctx.fillText(f.text, x, y);
        ctx.globalAlpha = 1;
      }

      if (ox || oy) ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      // Вспышка при ударе
      if (this.flash > 0) {
        this.flash = Math.max(0, this.flash - dt * 1.6);
        const grd = ctx.createRadialGradient(this.w / 2, this.h / 2, Math.min(this.w, this.h) * 0.3, this.w / 2, this.h / 2, Math.max(this.w, this.h) * 0.7);
        grd.addColorStop(0, 'rgba(255,60,60,0)'); grd.addColorStop(1, 'rgba(255,60,60,' + (this.flash * 0.55) + ')');
        ctx.fillStyle = grd; ctx.fillRect(0, 0, this.w, this.h);
      }
    }

    drawTrail(ctx, game, P, s) {
      const tr = game.trail;
      if (!game.showTrail || tr.length < 1) return;
      const hero = S.heroById(game.heroId);
      ctx.save();
      ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      ctx.strokeStyle = hero.thread;
      ctx.globalAlpha = 0.55;
      ctx.lineWidth = Math.max(2, s * 0.07);
      // Нить рвётся на порталах (флаг p[2]) — рисуем отдельными сглаженными отрезками
      const segs = [[]];
      tr.forEach(p => {
        if (p[2] === 1 && segs[segs.length - 1].length) segs.push([]);
        segs[segs.length - 1].push(P(p[0], p[1]));
      });
      if (game.player.teleportT <= 0) segs[segs.length - 1].push(P(game.player.px, game.player.py));
      ctx.beginPath();
      segs.forEach(pts => {
        if (pts.length < 2) return;
        ctx.moveTo(pts[0][0], pts[0][1]);
        for (let k = 1; k < pts.length - 1; k++) {
          const mx = (pts[k][0] + pts[k + 1][0]) / 2, my = (pts[k][1] + pts[k + 1][1]) / 2;
          ctx.quadraticCurveTo(pts[k][0], pts[k][1], mx, my);
        }
        const last = pts[pts.length - 1];
        ctx.lineTo(last[0], last[1]);
      });
      ctx.stroke();
      ctx.restore();
    }

    drawHint(ctx, game, P, s, t) {
      const h = game.hint;
      const path = h.path;
      if (!path || path.length < 2) return;
      const g = this.level.grid;
      const alpha = clamp(h.life, 0, 1);
      const shown = Math.min(path.length - 1, h.progress);
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.setLineDash([s * 0.12, s * 0.14]);
      ctx.lineDashOffset = -t * s * 0.6;
      ctx.strokeStyle = '#FF5B4F'; ctx.lineWidth = Math.max(3, s * 0.1); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      ctx.beginPath();
      const whole = Math.floor(shown);
      for (let k = 0; k <= whole; k++) {
        const [x, y] = P(g.x(path[k]) + 0.5, g.y(path[k]) + 0.5);
        if (k === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      let bx, by;
      if (whole < path.length - 1) {
        const f = shown - whole;
        const ax = g.x(path[whole]) + 0.5, ay = g.y(path[whole]) + 0.5;
        const cx = g.x(path[whole + 1]) + 0.5, cy = g.y(path[whole + 1]) + 0.5;
        [bx, by] = P(lerp(ax, cx, f), lerp(ay, cy, f));
        ctx.lineTo(bx, by);
      } else {
        [bx, by] = P(g.x(path[whole]) + 0.5, g.y(path[whole]) + 0.5);
      }
      ctx.stroke();
      ctx.setLineDash([]);
      S.drawYarn(ctx, bx, by, s * 0.2, '#FF5B4F', shown * 2.2);
      // Цель подсвечивается
      const [tx, ty] = P(g.x(path[path.length - 1]) + 0.5, g.y(path[path.length - 1]) + 0.5);
      ctx.strokeStyle = 'rgba(255,91,79,0.8)'; ctx.lineWidth = Math.max(2, s * 0.05);
      ctx.beginPath(); ctx.arc(tx, ty, s * (0.42 + Math.sin(t * 6) * 0.05), 0, TAU); ctx.stroke();
      ctx.restore();
    }

    updateParticles(ctx, dt, P, s) {
      for (let k = this.particles.length - 1; k >= 0; k--) {
        const p = this.particles[k];
        p.life -= p.decay * dt;
        if (p.life <= 0) { this.particles.splice(k, 1); continue; }
        p.vy += p.g * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.rot += p.vr * dt;
        const [x, y] = P(p.x, p.y);
        const r = p.size * s;
        ctx.globalAlpha = Math.min(1, p.life * 1.5);
        if (p.shape === 'star') S.drawStar(ctx, x, y, r * 1.3, p.color);
        else if (p.shape === 'rect') {
          ctx.save(); ctx.translate(x, y); ctx.rotate(p.rot); ctx.fillStyle = p.color;
          ctx.fillRect(-r, -r * 0.5, r * 2, r); ctx.restore();
        } else { ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fillStyle = p.color; ctx.fill(); }
      }
      ctx.globalAlpha = 1;
    }

    drawFog(ctx, game, P, s) {
      const q = 0.5; // туман в половинном разрешении — дешевле, а края всё равно мягкие
      const fw = Math.ceil(this.w * q), fh = Math.ceil(this.h * q);
      if (!this.fog || this.fog.width !== fw || this.fog.height !== fh) {
        this.fog = document.createElement('canvas'); this.fog.width = fw; this.fog.height = fh;
      }
      const f = this.fog.getContext('2d');
      const lv = this.level, g = lv.grid;
      f.globalCompositeOperation = 'source-over';
      f.clearRect(0, 0, fw, fh);
      f.fillStyle = 'rgba(10,12,34,' + ({ tiny: 0.97, kid: 1, teen: 1, pro: 1 }[lv.age] || 1) + ')';
      f.fillRect(0, 0, fw, fh);
      f.globalCompositeOperation = 'destination-out';
      // Запомненные клетки — едва видны
      f.fillStyle = 'rgba(0,0,0,0.2)';
      const vis = game.visited;
      for (let i = 0; i < g.n; i++) {
        if (!vis[i]) continue;
        const [x, y] = P(g.x(i), g.y(i));
        if (x > this.w || y > this.h || x + s < 0 || y + s < 0) continue;
        f.fillRect(x * q, y * q, s * q + 1, s * q + 1);
      }
      // Круг света вокруг героя
      const [px, py] = P(game.player.px, game.player.py);
      const R = game.lightRadius * s * q;
      const flick = 1 + Math.sin(game.time * 9) * 0.015;
      const grd = f.createRadialGradient(px * q, py * q, R * 0.3, px * q, py * q, R * flick);
      grd.addColorStop(0, 'rgba(0,0,0,1)'); grd.addColorStop(0.6, 'rgba(0,0,0,0.8)'); grd.addColorStop(1, 'rgba(0,0,0,0)');
      f.fillStyle = grd;
      f.beginPath(); f.arc(px * q, py * q, R * flick, 0, TAU); f.fill();
      // Светлячки светятся сами
      lv.items.forEach(it => {
        if (it.taken || it.kind !== 'firefly') return;
        const [x, y] = P(g.x(it.cell) + 0.5, g.y(it.cell) + 0.5);
        const gr = f.createRadialGradient(x * q, y * q, 0, x * q, y * q, s * q * 0.6);
        gr.addColorStop(0, 'rgba(0,0,0,0.9)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
        f.fillStyle = gr; f.beginPath(); f.arc(x * q, y * q, s * q * 0.6, 0, TAU); f.fill();
      });
      ctx.drawImage(this.fog, 0, 0, this.w, this.h);
    }
  }

  MZ.Renderer = Renderer;
})(typeof window !== 'undefined' ? window : globalThis);

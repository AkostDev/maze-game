/*
 * Ввод: Pointer Events (мышь, палец, стилус), клавиатура, экранный D-pad.
 *  • Одно нажатие = одна клетка: свайп, тап сбоку от героя, стрелка, кнопка D-pad.
 *  • Удержание (клавиши, кнопки или пальца после свайпа) — шаги повторяются, пока держат.
 *    Смена направления без отрыва пальца — шаг в новую сторону.
 *  • Ведение: палец, поставленный на героя, ведёт его по дорожке клетка за клеткой (удобно малышам).
 *  • Два пальца — масштаб (пинч), колесо мыши — тоже.
 *  • В настройках можно включить «бег до развилки» (moveMode = 'glide').
 */
(function (root) {
  'use strict';
  const MZ = root.MZ = root.MZ || {};

  const KEY_REPEAT = 0.28; // задержка повтора при удержании клавиши/кнопки, с
  const touchRepeat = g => (g && g.age && g.age.id === 'tiny' ? 0.8 : 0.55);

  const KEYMAP = {
    ArrowUp: 0, KeyW: 0, ArrowRight: 1, KeyD: 1, ArrowDown: 2, KeyS: 2, ArrowLeft: 3, KeyA: 3,
    Numpad8: 0, Numpad6: 1, Numpad2: 2, Numpad4: 3
  };

  class Input {
    constructor(el, renderer, opts) {
      this.el = el;
      this.r = renderer;
      this.opts = opts || {};
      this.pointers = new Map();
      this.pinch = null;
      this.keys = [];
      this.keyDownAt = {};
      this.bind();
    }

    game() { return this.opts.getGame ? this.opts.getGame() : null; }
    active() {
      const g = this.game();
      return !!(g && g.level && !g.paused && !g.won && !g.lost && (!this.opts.isActive || this.opts.isActive()));
    }

    bind() {
      const el = this.el;
      const o = { passive: false };
      el.addEventListener('pointerdown', e => this.down(e), o);
      el.addEventListener('pointermove', e => this.move(e), o);
      el.addEventListener('pointerup', e => this.up(e, false), o);
      el.addEventListener('pointercancel', e => this.up(e, true), o);
      el.addEventListener('lostpointercapture', e => { if (this.pointers.has(e.pointerId)) this.up(e, true); });
      el.addEventListener('contextmenu', e => e.preventDefault());
      el.addEventListener('wheel', e => {
        if (!this.active()) return;
        e.preventDefault();
        this.r.zoomBy(e.deltaY < 0 ? 1.12 : 1 / 1.12);
      }, o);
      // iOS Safari: запрет системного масштабирования жестом
      ['gesturestart', 'gesturechange', 'gestureend'].forEach(t => el.addEventListener(t, e => e.preventDefault(), o));
      root.addEventListener('keydown', e => this.keyDown(e));
      root.addEventListener('keyup', e => this.keyUp(e));
      root.addEventListener('blur', () => this.releaseAll());
    }

    local(e) {
      const rect = this.el.getBoundingClientRect();
      return [e.clientX - rect.left, e.clientY - rect.top];
    }

    threshold() { return Math.max(12, Math.min(26, this.r.cam.scale * 0.32)); }

    down(e) {
      if (MZ.audio) MZ.audio.unlock();
      if (!this.active()) return;
      e.preventDefault();
      try { this.el.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
      const [x, y] = this.local(e);
      const now = performance.now();
      this.pointers.set(e.pointerId, { x, y, sx: x, sy: y, ax: x, ay: y, t0: now, mode: 'swipe', dir: -1, lastCell: -1, ignored: false });
      const g = this.game();
      if (this.pointers.size === 2) {
        // Начало пинча: отменяем движение
        g.setHeld(-1); g.traceQueue.length = 0;
        const [a, b] = Array.from(this.pointers.values());
        a.ignored = b.ignored = true;
        this.pinch = { dist: Math.hypot(a.x - b.x, a.y - b.y) };
        return;
      }
      if (this.pointers.size > 2) { this.pointers.get(e.pointerId).ignored = true; return; }
      const p = this.pointers.get(e.pointerId);
      const [hx, hy] = this.r.worldToScreen(g.player.px, g.player.py);
      const grab = Math.max(34, this.r.cam.scale * 0.95);
      if (Math.hypot(x - hx, y - hy) <= grab) {
        p.mode = 'trace';
        if (this.opts.onTraceStart) this.opts.onTraceStart();
      }
    }

    move(e) {
      const p = this.pointers.get(e.pointerId);
      if (!p) return;
      e.preventDefault();
      const [x, y] = this.local(e);
      p.x = x; p.y = y;
      if (this.pinch && this.pointers.size >= 2) {
        const [a, b] = Array.from(this.pointers.values());
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        if (this.pinch.dist > 10 && d > 10) this.r.zoomBy(d / this.pinch.dist);
        this.pinch.dist = d;
        return;
      }
      if (p.ignored || !this.active()) return;
      const g = this.game();
      if (p.mode === 'trace') {
        const [wx, wy] = this.r.screenToWorld(x, y);
        const lv = g.level;
        const cx = Math.floor(wx), cy = Math.floor(wy);
        if (cx < 0 || cy < 0 || cx >= lv.cols || cy >= lv.rows) return;
        const cell = cy * lv.cols + cx;
        if (cell !== p.lastCell) { p.lastCell = cell; g.traceTo(cell); }
        return;
      }
      const dx = x - p.ax, dy = y - p.ay, th = this.threshold();
      if (Math.abs(dx) < th && Math.abs(dy) < th) return;
      const dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 1 : 3) : (dy > 0 ? 2 : 0);
      p.ax = x; p.ay = y; // «плавающий якорь»: зигзаги пальцем читаются без отрыва
      if (dir !== p.dir) {
        p.dir = dir;
        g.push(dir, false);
        g.setHeld(dir, touchRepeat(g));
      }
    }

    up(e, cancelled) {
      const p = this.pointers.get(e.pointerId);
      if (!p) return;
      this.pointers.delete(e.pointerId);
      try { this.el.releasePointerCapture(e.pointerId); } catch (err) { /* ignore */ }
      if (this.pinch) {
        if (this.pointers.size < 2) this.pinch = null;
        return;
      }
      if (p.ignored) return;
      const g = this.game();
      if (!g || !g.level) return;
      if (cancelled) { g.release(false); return; }
      const dur = performance.now() - p.t0;
      const dist = Math.hypot(p.x - p.sx, p.y - p.sy);
      if (p.mode === 'swipe') {
        if (p.dir >= 0) g.release(dur < 320);
        else if (dist < 12 && dur < 400 && this.active()) {
          const [wx, wy] = this.r.screenToWorld(p.x, p.y);
          g.tapToward(wx, wy);
        } else g.release(false);
      }
    }

    releaseAll() {
      this.pointers.clear(); this.pinch = null; this.keys.length = 0;
      const g = this.game();
      if (g && g.level) g.release(false);
    }

    keyDown(e) {
      if (e.target && /input|textarea|select/i.test(e.target.tagName)) return;
      if (this.opts.onKey && this.opts.onKey(e)) return;
      const dir = KEYMAP[e.code];
      if (dir == null) return;
      if (MZ.audio) MZ.audio.unlock();
      if (!this.active()) return;
      e.preventDefault();
      if (e.repeat) return;
      const g = this.game();
      this.keys = this.keys.filter(k => k !== dir); this.keys.push(dir);
      this.keyDownAt[dir] = performance.now();
      g.push(dir, false);
      g.setHeld(dir, KEY_REPEAT);
    }

    keyUp(e) {
      const dir = KEYMAP[e.code];
      if (dir == null) return;
      this.keys = this.keys.filter(k => k !== dir);
      const g = this.game();
      if (!g || !g.level) return;
      if (this.keys.length) { const nd = this.keys[this.keys.length - 1]; g.setHeld(nd, KEY_REPEAT); return; }
      const quick = performance.now() - (this.keyDownAt[dir] || 0) < 190;
      if (g.heldDir === dir || g.heldDir < 0) g.release(quick);
    }

    // Экранный D-pad
    bindDpad(container) {
      container.querySelectorAll('[data-dir]').forEach(btn => {
        const dir = +btn.dataset.dir;
        const start = e => {
          e.preventDefault();
          if (MZ.audio) MZ.audio.unlock();
          if (!this.active()) return;
          try { btn.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
          btn.classList.add('is-down');
          const g = this.game();
          g.push(dir, false); g.setHeld(dir, KEY_REPEAT);
        };
        const end = e => {
          e.preventDefault();
          btn.classList.remove('is-down');
          const g = this.game();
          if (g && g.level && g.heldDir === dir) g.release(false);
        };
        btn.addEventListener('pointerdown', start);
        btn.addEventListener('pointerup', end);
        btn.addEventListener('pointercancel', end);
        btn.addEventListener('contextmenu', e => e.preventDefault());
      });
    }
  }

  MZ.Input = Input;
})(typeof window !== 'undefined' ? window : globalThis);

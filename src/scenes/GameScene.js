/*
 * Игровая сцена: показывает уровень (слой лабиринта, герой, предметы, сторожа, туман), ведёт камеру,
 * принимает управление и превращает события логики (src/core/game.js) в анимации, частицы и звуки.
 * Правил игры здесь нет — они в Game; интерфейс поверх поля — в HudScene.
 */
import * as Phaser from '../../vendor/phaser.esm.min.js';
import { metrics, hudInsets, goto, hex } from '../ui/kit.js';
import { progress } from '../core/progress.js';
import { sfx } from '../audio/sfx.js';
import { buildLevel, levelSpec, introFor, CAMPAIGN_LEVELS } from '../core/levels.js';
import { Game } from '../core/game.js';
import { clamp } from '../core/rng.js';
import { heroById, KEY_COLORS, PORTAL_COLORS, NIGHT } from '../core/worlds.js';
import { mazeCanvas, mazeSize, toWorld, PITCH, WALL } from '../gfx/mazeLayer.js';
import { LIGHT_SIZE, LIGHT_HOLE } from '../gfx/textures.js';

// Размер клетки на экране, CSS px: мельче MIN_CELL лабиринт не показывается целиком (камера следует за героем)
const MIN_CELL = 34;
const MAX_CELL = 84;
const SWIPE = 14;                     // порог свайпа, CSS px
// Через сколько секунд удержание начинает повторять шаги
const HOLD_TOUCH = 0.3;
const HOLD_KEYS = 0.25;
const KEYS = { ArrowUp: 0, KeyW: 0, ArrowRight: 1, KeyD: 1, ArrowDown: 2, KeyS: 2, ArrowLeft: 3, KeyA: 3 };
const DX = [0, 1, 0, -1], DY = [-1, 0, 1, 0];
const DEPTH = { maze: 0, trail: 1, floor: 2, item: 3, gate: 4, enemy: 5, hero: 6, fx: 8, fog: 9 };

export class GameScene extends Phaser.Scene {
  constructor() { super('Game'); }

  init(data) { this.index = (data && data.index) | 0; }

  create() {
    const m = metrics(this), pad = 6 * m.u;
    // Карточка-знакомство с новой механикой показывается, пока уровень не пройден; под неё оставляем место внизу
    this.hasCard = this.index < CAMPAIGN_LEVELS && !!introFor(this.index) && progress.stars(this.index) === 0;
    this.insets = hudInsets(this, progress.settings.dpad, this.hasCard);
    // Лабиринт вытягивается под свободную часть экрана
    const ins = this.insets;
    const aspect = (m.W - ins.left - ins.right - 2 * pad) / Math.max(1, m.H - ins.top - ins.bottom - 2 * pad);
    this.level = buildLevel(levelSpec(this.index, aspect));
    this.logic = new Game(this.level, { onEvent: (type, data) => this.onGameEvent(type, data) });
    this.overview = false; this.ended = false; this.pausing = false; this.swipe = null; this.held = [];
    // объект сцены переиспользуется между уровнями — всё состояние уровня сбрасывается здесь
    this.nudgeT = 0; this.nudgeDir = 0; this.wasMoving = false; this.hintDots = []; this.fog = null;

    this.buildWorld();
    this.fitCamera();
    this.bindInput();
    sfx.startMusic(this.level.world.id);
    this.scene.launch('Hud');

    this.scale.on('resize', this.fitCamera, this);
    this.game.events.on('blur', this.autoPause, this);
    this.game.events.on('hidden', this.autoPause, this);
    this.events.once('shutdown', () => {
      this.scale.off('resize', this.fitCamera, this);
      this.game.events.off('blur', this.autoPause, this);
      this.game.events.off('hidden', this.autoPause, this);
    });
  }

  get hud() { return this.scene.get('Hud'); }

  // ---------- Мир ----------
  buildWorld() {
    const lv = this.level, g = lv.grid, size = mazeSize(lv);
    const at = cell => ({ x: toWorld(g.x(cell) + 0.5), y: toWorld(g.y(cell) + 0.5) });
    this.at = at;
    if (this.textures.exists('maze')) this.textures.remove('maze');
    this.textures.addCanvas('maze', mazeCanvas(lv));
    this.cameras.main.setBackgroundColor(lv.world.bg);
    const span = 1600; // запас фона вокруг лабиринта, мировые px
    this.add.tileSprite(-span / 2, -span / 2, size.w + span, size.h + span, 'bg_' + lv.world.id).setOrigin(0).setDepth(-1);
    this.add.image(0, 0, 'maze').setOrigin(0).setDepth(DEPTH.maze);
    this.trail = this.add.graphics().setDepth(DEPTH.trail);

    const hero = heroById(progress.hero);
    this.heroDef = hero;
    const s = at(lv.start), e = at(lv.exit);
    this.add.image(s.x, s.y + 2, 'sprites', 'yarn').setTint(hex(hero.thread)).setDepth(DEPTH.floor);
    this.house = this.add.image(e.x, e.y, 'sprites', this.logic.exitOpen ? 'houseOpen' : 'house').setDepth(DEPTH.item);

    lv.portals.forEach(p => [p.a, p.b].forEach(c => {
      const q = at(c);
      this.add.sprite(q.x, q.y, 'sprites', 'portal_0').setTint(hex(PORTAL_COLORS[p.color])).setDepth(DEPTH.floor).play('portal_spin');
    }));

    const bob = sp => this.tweens.add({ targets: sp, y: sp.y - 1, duration: 420 + Math.random() * 260, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
    this.itemSprites = new Map();
    lv.items.forEach(it => {
      const q = at(it.cell);
      const sp = this.add.image(q.x, q.y, 'sprites', it.kind === 'item' ? lv.world.item : it.kind).setDepth(DEPTH.item);
      bob(sp);
      this.itemSprites.set(it, sp);
    });
    this.keySprites = new Map();
    lv.keys.forEach(k => {
      const q = at(k.cell);
      const sp = this.add.image(q.x, q.y, 'sprites', 'key').setTint(hex(KEY_COLORS[k.color].color)).setDepth(DEPTH.item);
      bob(sp);
      this.keySprites.set(k, sp);
    });
    // Дверца стоит на границе двух клеток: вертикальная — между соседями по горизонтали, и наоборот
    this.gateSprites = new Map();
    lv.gates.forEach(gt => {
      const a = at(gt.a), b = at(gt.b);
      const sp = this.add.image((a.x + b.x) / 2, (a.y + b.y) / 2, 'sprites', a.x === b.x ? 'gateH' : 'gateV')
        .setTint(hex(KEY_COLORS[gt.color].color)).setDepth(DEPTH.gate);
      this.gateSprites.set(gt, sp);
    });

    // Догоняющий сторож подкрашен красным — его видно издалека
    this.enemySprites = this.logic.enemies.map(en => {
      const sprite = this.add.image(toWorld(en.px), toWorld(en.py), 'sprites', lv.world.enemy).setDepth(DEPTH.enemy);
      const tint = en.type === 'chaser' ? 0xff9090 : 0xffffff;
      sprite.setTint(tint);
      return { sprite, tint, zzz: this.add.image(0, 0, 'icons', 'zzz').setDepth(DEPTH.fx).setVisible(false), asleep: false };
    });

    this.shadow = this.add.image(s.x, s.y + 7, 'ui', 'shadow').setDepth(DEPTH.floor);
    this.hero = this.add.sprite(s.x, s.y, 'sprites', hero.id).setDepth(DEPTH.hero);
    this.target = { x: s.x, y: s.y }; // камера следит за точкой без «подпрыгиваний» спрайта

    if (lv.rules.dark) {
      const night = hex(NIGHT), far = 3000;
      this.lightR = this.logic.lightRadius;
      this.fog = {
        light: this.add.image(s.x, s.y, 'light').setDepth(DEPTH.fog),
        rects: [0, 1, 2, 3].map(() => this.add.rectangle(0, 0, far, far, night).setDepth(DEPTH.fog)),
        far
      };
      this.placeFog(s.x, s.y);
    }
  }

  // Ночь: вокруг героя — картинка с прозрачной «дыркой», остальное закрыто четырьмя прямоугольниками
  placeFog(x, y) {
    const f = this.fog, scale = (this.lightR * PITCH) / LIGHT_HOLE;
    const half = (LIGHT_SIZE * scale) / 2 - 1, far = f.far;
    if (f.r !== this.lightR) { // размеры меняются только вместе с радиусом света
      f.r = this.lightR;
      f.light.setScale(scale);
      f.rects[0].setSize(far * 2, far); f.rects[1].setSize(far * 2, far);
      f.rects[2].setSize(far, half * 2 + 2); f.rects[3].setSize(far, half * 2 + 2);
      f.rects.forEach(r => r.setOrigin(0.5));
    }
    f.light.setPosition(x, y);
    f.rects[0].setPosition(x, y - half - far / 2);
    f.rects[1].setPosition(x, y + half + far / 2);
    f.rects[2].setPosition(x - half - far / 2, y);
    f.rects[3].setPosition(x + half + far / 2, y);
  }

  // ---------- Камера ----------
  // Масштаб — целое число пикселей устройства на пиксель рисунка. Лабиринт целиком на экране, если клетки
  // при этом не мельче MIN_CELL; иначе камера приближена и следует за героем. Ночью камера всегда близко.
  fitCamera() {
    const m = metrics(this), lv = this.level, cam = this.cameras.main, size = mazeSize(lv);
    this.insets = hudInsets(this, progress.settings.dpad, this.hasCard);
    const pad = 6 * m.u, ins = this.insets;
    const L = ins.left + pad, R = ins.right + pad, T = ins.top + pad, B = ins.bottom + pad;
    const zFit = Math.floor(Math.min((m.W - L - R) / size.w, (m.H - T - B) / size.h));
    const zMin = Math.max(1, Math.ceil((MIN_CELL * m.dpr) / PITCH));
    const zMax = Math.max(zMin, Math.floor((MAX_CELL * m.dpr) / PITCH));
    this.fits = zFit >= zMin;
    let z;
    if (lv.rules.dark) z = clamp(Math.round(Math.min(m.W, m.H) / (8 * PITCH)), zMin, zMax);
    else if (this.overview) z = clamp(zFit, 1, zMax);
    else z = this.fits ? Math.min(zFit, zMax) : zMin;
    cam.setZoom(z);

    // Границы камеры: лабиринт плюс поля под HUD. Если он меньше экрана — границы расширяются, и он встаёт по центру
    // свободной области.
    const vw = m.W / z, vh = m.H / z;
    let bx = -L / z, by = -T / z;
    let bw = size.w + (L + R) / z, bh = size.h + (T + B) / z;
    if (bw < vw) { bx -= (vw - bw) / 2; bw = vw; }
    if (bh < vh) { by -= (vh - bh) / 2; bh = vh; }
    cam.setBounds(bx, by, bw, bh);
    cam.startFollow(this.target, true, 0.18, 0.18);
    cam.centerOn(this.target.x, this.target.y);
  }

  toggleOverview() {
    if (this.fits || this.level.rules.dark) return;
    this.overview = !this.overview;
    this.fitCamera();
  }

  // Мировые координаты → экранные (для надписей, которые рисует HUD)
  toScreen(wx, wy) {
    const cam = this.cameras.main;
    return { x: (wx - cam.worldView.x) * cam.zoom, y: (wy - cam.worldView.y) * cam.zoom };
  }

  // ---------- Управление ----------
  // Свайп — шаг; не отрывая пальца — герой идёт дальше, а смена направления срабатывает сразу. Тап — шаг в сторону касания.
  bindInput() {
    const thr = SWIPE * metrics(this).dpr;
    this.input.on('pointerdown', p => {
      if (this.swipe) return;
      this.swipe = { id: p.id, ax: p.x, ay: p.y, t0: this.time.now, dir: -1, moved: false };
    });
    this.input.on('pointermove', p => {
      const s = this.swipe;
      if (!s || p.id !== s.id || !p.isDown) return;
      const dx = p.x - s.ax, dy = p.y - s.ay;
      if (Math.max(Math.abs(dx), Math.abs(dy)) < thr) return;
      const dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 1 : 3) : (dy > 0 ? 2 : 0);
      s.ax = p.x; s.ay = p.y; s.moved = true; // «плавающий якорь»: следующий свайп считается от текущей точки
      if (dir === s.dir) return;
      const engaged = s.dir >= 0;
      s.dir = dir;
      this.logic.push(dir);
      this.logic.setHeld(dir, engaged ? 0.1 : HOLD_TOUCH);
    });
    const end = p => {
      const s = this.swipe;
      if (!s || p.id !== s.id) return;
      this.swipe = null;
      if (!s.moved && this.time.now - s.t0 < 400) this.logic.tapToward((p.worldX - WALL / 2) / PITCH, (p.worldY - WALL / 2) / PITCH);
      this.logic.release();
    };
    this.input.on('pointerup', end);
    this.input.on('pointerupoutside', end);

    this.input.keyboard.on('keydown', e => {
      const dir = KEYS[e.code];
      if (dir != null) {
        if (e.repeat) return;
        this.held = this.held.filter(d => d !== dir).concat(dir);
        this.pressDir(dir);
        return;
      }
      if (e.repeat) return;
      if (e.code === 'Escape' || e.code === 'KeyP') this.pauseGame();
      else if (e.code === 'KeyH') this.useHint();
      else if (e.code === 'KeyR') this.restart();
      else if (e.code === 'KeyM') this.toggleOverview();
    });
    this.input.keyboard.on('keyup', e => {
      const dir = KEYS[e.code];
      if (dir == null) return;
      this.held = this.held.filter(d => d !== dir);
      // отпустили одну из двух зажатых клавиш — продолжаем в сторону оставшейся
      if (this.held.length) this.logic.setHeld(this.held[this.held.length - 1], HOLD_KEYS);
      else this.logic.release();
    });
  }

  // Нажатие клавиши или экранной стрелки: шаг сразу, при удержании — повтор
  pressDir(dir) {
    this.logic.push(dir);
    this.logic.setHeld(dir, HOLD_KEYS);
  }
  releaseDir() { this.logic.release(); }

  useHint() { if (!this.ended) this.logic.useHint(); }
  restart() { goto(this, 'Game', { index: this.index }); }

  pauseGame() {
    if (this.ended || this.pausing || !this.sys.isActive()) return;
    this.pausing = true; // операции со сценами выполняются в начале следующего кадра — не даём нажать дважды
    this.logic.release();
    this.swipe = null; this.held = [];
    this.scene.pause('Hud');
    this.scene.launch('Pause', { index: this.index });
    this.scene.pause();
  }
  // Свернули вкладку или окно потеряло фокус — ставим паузу сами
  autoPause() { if (this.logic.started) this.pauseGame(); }
  // Возврат из паузы: настройки могли измениться (кнопки-стрелки меняют поля HUD)
  onResume() {
    this.pausing = false;
    this.fitCamera();
    this.hud.rebuild();
  }

  // ---------- События игры → эффекты ----------
  onGameEvent(type, d) {
    const lv = this.level, hud = this.hud, at = this.at;
    const hp = { x: toWorld(this.logic.player.px), y: toWorld(this.logic.player.py) };
    switch (type) {
      case 'start': hud.hideIntro(); break;
      case 'step': {
        sfx.play('step');
        const a = at(d.from), b = at(d.cell);
        this.trail.fillStyle(hex(this.heroDef.thread), 1);
        this.trail.fillRect(Math.min(a.x, b.x) - 1, Math.min(a.y, b.y) + 2, Math.abs(a.x - b.x) + 2, Math.abs(a.y - b.y) + 2);
        break;
      }
      case 'bump': sfx.play('bump'); this.nudgeT = 0.14; this.nudgeDir = d.dir; break;
      case 'gateLocked': {
        sfx.play('locked'); sfx.buzz(30);
        const sp = this.gateSprites.get(d.gate);
        this.shake(sp);
        this.floatAt(sp.x, sp.y - 10, 'Нужен ключ', KEY_COLORS[d.gate.color].color);
        break;
      }
      case 'exitLocked':
        sfx.play('locked');
        this.shake(this.house);
        this.floatAt(this.house.x, this.house.y - 12, 'Собери ещё ' + d.remaining, '#ffcd45');
        break;
      case 'gateOpen': {
        sfx.play('gate'); sfx.buzz(20);
        const sp = this.gateSprites.get(d.gate);
        this.burst(sp.x, sp.y, [KEY_COLORS[d.gate.color].color, '#ffffff'], 14);
        this.tweens.add({ targets: sp, alpha: 0, scale: 1.6, duration: 260, onComplete: () => sp.destroy() });
        break;
      }
      case 'key': {
        sfx.play('key'); sfx.buzz(25);
        this.pickUp(this.keySprites.get(d.key));
        this.burst(hp.x, hp.y, [KEY_COLORS[d.key.color].color, '#ffffff', '#ffe45c'], 14);
        break;
      }
      case 'collect':
        sfx.play('collect'); sfx.buzz(15);
        this.pickUp(this.itemSprites.get(d.item));
        this.burst(hp.x, hp.y, ['#ffffff', '#ffcd75', lv.world.ui], 12);
        this.floatAt(hp.x, hp.y - 12, d.got + '/' + d.total, '#ffffff');
        break;
      case 'exitOpen':
        this.house.setFrame('houseOpen');
        this.tweens.add({ targets: this.house, scale: 1.25, duration: 160, yoyo: true, repeat: 1 });
        this.burst(this.house.x, this.house.y, ['#ffd45c', '#ffffff', '#ff5b4f'], 22);
        this.time.delayedCall(250, () => sfx.play('door'));
        break;
      case 'bonus':
        sfx.play('bonus');
        this.pickUp(this.itemSprites.get(d.item));
        this.burst(hp.x, hp.y, ['#ffe45c', '#ffffff'], 10);
        if (d.kind === 'firefly') {
          this.tweens.add({ targets: this, lightR: this.logic.lightRadius, duration: 500, ease: 'Sine.out' });
          this.floatAt(hp.x, hp.y - 12, 'Светлее!', '#fff3a0');
        } else this.floatAt(hp.x, hp.y - 12, '+1', '#ff8fa3');
        break;
      case 'portal': {
        sfx.play('portal');
        const a = at(d.from), b = at(d.to);
        this.burst(a.x, a.y, ['#b55cff', '#ffffff', '#2ad4e0'], 14);
        this.burst(b.x, b.y, ['#b55cff', '#ffffff', '#2ad4e0'], 14);
        this.hero.setScale(0.2);
        this.tweens.add({ targets: this.hero, scale: 1, duration: 220, ease: 'Back.out' });
        break;
      }
      case 'hint': sfx.play('hint'); this.showHint(d.path); break;
      case 'noHints': sfx.play('locked'); hud.noHints(); break;
      case 'enemySleep': sfx.play('sleep'); hud.tip('Сторож уснул — можно пройти!'); break;
      case 'hit':
        sfx.play('hit'); sfx.buzz([60, 40, 60]);
        this.cameras.main.shake(220, 0.012);
        break;
      case 'stuck': hud.attention(); break;
      case 'win': this.finish(true, d.result); break;
      case 'lose': this.finish(false, d.result); break;
    }
  }

  floatAt(wx, wy, text, color) {
    const p = this.toScreen(wx, wy);
    this.hud.floatText(p.x, p.y, text, color);
  }

  shake(sp) {
    if (this.tweens.isTweening(sp)) return;
    this.tweens.add({ targets: sp, x: sp.x + 1, duration: 45, yoyo: true, repeat: 3 });
  }

  pickUp(sp) {
    if (!sp) return;
    this.tweens.killTweensOf(sp);
    this.tweens.add({ targets: sp, y: sp.y - 8, alpha: 0, scale: 1.4, duration: 260, ease: 'Sine.out', onComplete: () => sp.destroy() });
  }

  burst(wx, wy, colors, count) {
    const em = this.add.particles(wx, wy, 'ui', {
      frame: 'px', speed: { min: 18, max: 70 }, lifespan: { min: 260, max: 620 }, gravityY: 90,
      scale: { start: 1, end: 0.5 }, tint: colors.map(hex), emitting: false
    }).setDepth(DEPTH.fx);
    em.explode(count);
    this.time.delayedCall(900, () => em.destroy());
  }

  // Подсказка: огоньки по очереди загораются вдоль пути и гаснут вместе с ней
  showHint(path) {
    this.hintDots.forEach(dot => dot.destroy());
    this.hintDots = path.slice(1).map((cell, k) => {
      const q = this.at(cell);
      const dot = this.add.image(q.x, q.y, 'ui', 'dot').setTint(0xffe45c).setDepth(DEPTH.fx).setAlpha(0);
      this.tweens.add({ targets: dot, alpha: 1, duration: 120, delay: k * 45 });
      this.tweens.add({ targets: dot, scale: 1.5, duration: 380, delay: k * 45, yoyo: true, repeat: -1 });
      return dot;
    });
  }

  finish(won, result) {
    if (this.ended) return;
    this.ended = true;
    this.logic.release();
    if (won) {
      const rec = progress.recordWin(this.index, result);
      sfx.play('win'); sfx.buzz([30, 50, 30, 50, 80]);
      this.burst(this.house.x, this.house.y, ['#ffd45c', '#ff5b4f', '#ffffff', '#2ab8a8'], 30);
      this.time.delayedCall(1000, () => this.showResult({ result, rec }));
    } else {
      sfx.play('lose'); sfx.buzz(200);
      this.time.delayedCall(800, () => this.showResult({ result }));
    }
  }

  showResult(data) {
    this.scene.stop('Hud');
    this.scene.launch('Result', Object.assign({ index: this.index }, data));
  }

  // ---------- Кадр ----------
  update(time, delta) {
    const lg = this.logic, pl = lg.player;
    lg.update(Math.min(delta / 1000, 0.05));

    let x = toWorld(pl.px), y = toWorld(pl.py);
    this.target.x = x; this.target.y = y;
    if (this.nudgeT > 0) { // толчок в стену
      this.nudgeT -= delta / 1000;
      const k = Math.sin(Math.max(0, this.nudgeT / 0.14) * Math.PI) * 2;
      x += DX[this.nudgeDir] * k; y += DY[this.nudgeDir] * k;
    }
    const hop = pl.moving ? Math.round(Math.sin(pl.t * Math.PI) * 2) : 0;
    this.hero.setPosition(x, y - hop);
    this.shadow.setPosition(x, y + 7);
    if (pl.moving !== this.wasMoving) {
      this.wasMoving = pl.moving;
      if (pl.moving) this.hero.play(this.heroDef.id + '_walk', true);
      else { this.hero.stop(); this.hero.setFrame(this.heroDef.id); }
    }
    this.hero.setAlpha(pl.invuln > 0 && Math.floor(time / 90) % 2 ? 0.35 : 1);
    if (!lg.hint && this.hintDots.length) { this.hintDots.forEach(dot => dot.destroy()); this.hintDots = []; }

    lg.enemies.forEach((en, k) => {
      const s = this.enemySprites[k];
      const ex = toWorld(en.px), ey = toWorld(en.py);
      s.sprite.setPosition(ex, ey - (en.asleep ? 0 : Math.round(Math.abs(Math.sin(time / 170 + k)))));
      s.sprite.setFlipX(en.dirX < 0);
      if (en.asleep !== s.asleep) {
        s.asleep = en.asleep;
        s.zzz.setVisible(en.asleep);
        s.sprite.setTint(en.asleep ? 0x8f9bb3 : s.tint);
      }
      if (en.asleep) s.zzz.setPosition(ex + 6, ey - 9 - Math.round(Math.sin(time / 300)));
    });

    if (this.fog) this.placeFog(x, y);
  }
}

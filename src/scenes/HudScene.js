/*
 * Интерфейс поверх игрового поля: пауза, счётчики (находки, ключи, жизни), подсказка, обзор лабиринта,
 * экранные стрелки, карточка-знакомство с новой механикой, всплывающие надписи. Данные берёт из GameScene.
 */
import { UiScene, metrics, hudInsets, label, button, panel, icon, sprite, hex, WHITE, BTN, TITLE_IN_BAR } from '../ui/kit.js';
import { INK } from '../gfx/textures.js';
import { progress } from '../core/progress.js';
import { KEY_COLORS } from '../core/worlds.js';

// Карточки-знакомства: показываются на уровне, где механика появляется впервые, пока уровень не пройден
const INTROS = {
  move: 'Собери всё и иди в домик!',
  gates: 'Дверцу открывает ключ\nтакого же цвета',
  shapes: 'Лабиринты бывают\nразной формы!',
  portals: 'Портал переносит\nк такому же порталу',
  enemies: 'Не попадись сторожу!\nКогда он спит — можно пройти',
  wander: 'Эти сторожа бродят,\nгде им вздумается',
  dark: 'Ночь! Светлячки делают\nфонарик ярче',
  chaser: 'Этот сторож бежит\nза тобой — убегай!'
};

export class HudScene extends UiScene {
  constructor() { super('Hud'); }

  create() {
    this.gs = this.scene.get('Game');
    this.introDone = false;
    super.create();
  }

  build() {
    const m = metrics(this), u = m.u, gs = this.gs, lv = gs.level;
    const dpad = progress.settings.dpad;
    this.sig = '';
    this.counters = [];
    this.intro = null;

    const top = m.safe.top + (BTN / 2 + 3) * u;
    this.top = top;
    button(this, { x: m.safe.left + (BTN / 2 + 3) * u, y: top, color: 'dark', icon: 'pause', onClick: () => gs.pauseGame() });
    // название уровня: в шапке, а на узком экране — строкой под ней
    label(this, m.cx, m.aw >= TITLE_IN_BAR ? top : top + (BTN / 2 + 7) * u, 'Уровень ' + (lv.index + 1) + ' · ' + lv.title, 8, WHITE, { stroke: INK, strokeW: 2 });

    // Управление: стоя — нижний ряд (стрелки по центру, подсказка справа, обзор слева);
    // лёжа — боковые колонки (стрелки справа, тогда подсказка и обзор слева). Поля под них считает hudInsets().
    const bottom = m.H - m.safe.bottom - (BTN / 2 + 4) * u;
    const left = m.safe.left + (BTN / 2 + 4) * u, right = m.W - m.safe.right - (BTN / 2 + 4) * u;
    const wide = !m.portrait;
    if (dpad) {
      const cx = wide ? right - BTN * u : m.cx, cy = bottom - BTN * u;
      [[0, 0, -1, -90], [1, 1, 0, 0], [2, 0, 1, 90], [3, -1, 0, 180]].forEach(([dir, dx, dy, angle]) => {
        button(this, {
          x: cx + dx * BTN * u, y: cy + dy * BTN * u, color: 'dark', icon: 'play', iconAngle: angle, name: 'dpad-' + dir,
          onDown: () => gs.pressDir(dir), onUp: () => gs.releaseDir()
        }).setAlpha(0.9);
      });
    }
    const hintX = dpad && wide ? left : right;
    this.hintBtn = button(this, { x: hintX, y: bottom, color: 'sun', icon: 'hint', onClick: () => gs.useHint() });
    this.hintCount = label(this, hintX + 9 * u, bottom - 10 * u, '', 8, WHITE, { stroke: INK, strokeW: 2 });
    if (!gs.fits && !lv.rules.dark) {
      // обзор всего лабиринта — в левом нижнем углу; если там уже подсказка, то над ней
      const stacked = hintX === left;
      button(this, { x: left, y: stacked ? bottom - (BTN + 4) * u : bottom, color: 'dark', icon: 'map', onClick: () => gs.toggleOverview() });
    }

    if (gs.hasCard && !this.introDone && !gs.logic.started) this.showIntro(lv.intro, m.H - hudInsets(this, dpad).base);
    this.refresh();
  }

  // Карточка стоит над нижним рядом кнопок, на месте, которое игровая сцена оставила свободным от лабиринта
  showIntro(id, bottomY) {
    const m = metrics(this), u = m.u, lv = this.gs.level;
    const w = Math.min(172, m.aw - 8), h = id === 'move' ? 52 : 40;
    const c = this.add.container(m.cx, Math.round(bottomY - (h / 2 + 2) * u));
    c.add(panel(this, 0, 0, w, h));
    const picX = (-w / 2 + 17) * u;
    if (id === 'move') {
      const touch = this.sys.game.device.input.touch;
      c.add(label(this, 12 * u, -12 * u, touch ? 'Проведи пальцем,\nкуда идти' : 'Ходи стрелками\nили WASD', 8, INK, { lineSpacing: -2 }));
      c.add(label(this, 12 * u, 11 * u, INTROS.move, 8, '#566c86'));
      const hand = this.add.image(picX - 4 * u, -10 * u, 'icons', touch ? 'hand' : 'dpad').setScale(u).setTint(hex(INK));
      c.add(hand);
      c.add(sprite(this, picX, 11 * u, lv.world.item));
      if (touch) this.tweens.add({ targets: hand, x: picX + 6 * u, duration: 700, ease: 'Sine.inOut', repeat: -1, repeatDelay: 300 });
    } else {
      const pic = { gates: 'key', shapes: 'star', portals: 'portal_0', dark: 'firefly' }[id] || lv.world.enemy;
      const sp = sprite(this, picX, -1 * u, pic);
      if (id === 'gates') sp.setTint(hex(KEY_COLORS[0].color));
      if (id === 'portals') sp.setTint(0xb55cff);
      if (id === 'shapes') sp.setTint(0xffcd45);
      c.add(sp);
      c.add(label(this, 12 * u, -1 * u, INTROS[id], 8, INK, { lineSpacing: -2 }));
    }
    this.intro = c;
  }

  hideIntro() {
    this.introDone = true;
    const c = this.intro;
    this.intro = null;
    if (!c || !c.active) return;
    this.tweens.add({ targets: c, alpha: 0, duration: 200, onComplete: () => c.destroy() });
  }

  // Счётчики справа вверху пересобираются, когда что-то изменилось
  refresh() {
    const lg = this.gs.logic, lv = this.gs.level;
    const sig = [lg.remaining, Array.from(lg.keysHeld).join(','), lg.hearts, lg.hintsLeft].join('|');
    if (sig === this.sig) return;
    this.sig = sig;
    const m = metrics(this), u = m.u;
    this.counters.forEach(o => o.destroy());
    this.counters = [];
    let x = m.W - m.safe.right - 5 * u;
    const add = o => { this.counters.push(o); return o; };

    const got = lv.required - lg.remaining;
    const t = add(label(this, x, this.top, got + '/' + lv.required, 9, lg.remaining ? WHITE : '#a7f070', { stroke: INK, strokeW: 2, ox: 1 }));
    x -= t.width + 9 * u;
    add(sprite(this, x, this.top, lv.world.item));
    x -= 14 * u;
    Array.from(lg.keysHeld).forEach(color => { add(icon(this, x, this.top, 'key', KEY_COLORS[color].color)); x -= 11 * u; });
    if (lv.rules.enemies) {
      x -= 2 * u;
      const total = Math.max(lg.maxHearts, lg.hearts);
      for (let k = total - 1; k >= 0; k--) { add(icon(this, x, this.top, 'heart', k < lg.hearts ? '#ff5b4f' : '#3a4466')); x -= 12 * u; }
    }
    this.hintCount.setText(String(lg.hintsLeft));
    this.hintBtn.setAlpha(lg.hintsLeft > 0 ? 1 : 0.55);
  }

  update() { this.refresh(); }

  // ---------- Сообщения от игровой сцены ----------
  floatText(x, y, text, color) {
    if (!this.sys.isActive()) return;
    const u = metrics(this).u;
    const t = label(this, x, y, text, 8, color, { stroke: INK, strokeW: 2 });
    this.tweens.add({ targets: t, y: y - 16 * u, alpha: 0, duration: 900, ease: 'Sine.out', onComplete: () => t.destroy() });
  }

  tip(text) {
    if (!this.sys.isActive()) return;
    const m = metrics(this);
    if (this.tipText && this.tipText.active) this.tipText.destroy();
    const t = label(this, m.cx, hudInsets(this).top + 12 * m.u, text, 8, WHITE, { stroke: INK, strokeW: 2, wrap: m.aw - 16 });
    this.tipText = t;
    this.tweens.add({ targets: t, alpha: 0, delay: 2400, duration: 500, onComplete: () => t.destroy() });
  }

  // Игрок давно топчется на месте — кнопка подсказки подмигивает
  attention() {
    if (!this.sys.isActive() || this.tweens.isTweening(this.hintBtn)) return;
    this.tweens.add({ targets: this.hintBtn, scale: 1.25, duration: 260, yoyo: true, repeat: 5, ease: 'Sine.inOut' });
  }

  noHints() {
    if (!this.sys.isActive()) return;
    this.tip('Подсказки закончились');
    if (!this.tweens.isTweening(this.hintBtn)) this.tweens.add({ targets: this.hintBtn, x: this.hintBtn.x + 3 * metrics(this).u, duration: 50, yoyo: true, repeat: 3 });
  }
}

/* Итоги уровня поверх игры: победа — звёзды, шаги и время, переход дальше; поражение — предложение попробовать ещё раз. */
import { UiScene, metrics, label, button, panel, dim, icon, goto, hex, BTN, BTN_H } from '../ui/kit.js';
import { INK } from '../gfx/textures.js';
import { sfx } from '../audio/sfx.js';
import { fmtTime } from '../core/rng.js';
import { WORLDS } from '../core/worlds.js';
import { worldFor, CAMPAIGN_LEVELS, LEVELS_PER_WORLD } from '../core/levels.js';

const CHEERS = ['', 'Получилось!', 'Молодец!', 'Отлично!'];

export class ResultScene extends UiScene {
  constructor() { super('Result'); }

  init(data) {
    this.index = data.index | 0;
    this.result = data.result;
    this.rec = data.rec || null;
    this.animated = false;
  }

  create() {
    super.create();
    this.input.keyboard.on('keydown', e => {
      if (e.repeat) return;
      if (e.code === 'Enter' || e.code === 'Space') this.primary();
      else if (e.code === 'KeyR') this.retry();
      else if (e.code === 'Escape') this.toLevels();
    });
  }

  primary() { if (this.result.won) goto(this, 'Game', { index: this.index + 1 }); else this.retry(); }
  retry() { goto(this, 'Game', { index: this.index }); }
  toLevels() { goto(this, 'Levels', { page: worldFor(Math.min(this.index, CAMPAIGN_LEVELS - 1)) }); }

  // Что нового после этой победы: следующий мир или конец кампании
  news() {
    const next = this.index + 1;
    if (!this.rec || !this.rec.unlockedNext) return this.rec && this.rec.newBest ? 'Новый рекорд!' : '';
    if (next === CAMPAIGN_LEVELS) return 'Все миры пройдены!\nДальше — бесконечные лабиринты';
    if (next % LEVELS_PER_WORLD === 0) return 'Открыт новый мир:\n' + WORLDS[worldFor(next)].name;
    return '';
  }

  build() {
    const m = metrics(this), u = m.u, r = this.result;
    dim(this, 0.5);
    const w = Math.min(160, m.aw - 12);
    const news = r.won ? this.news() : '';
    const h = r.won ? 112 + (news ? 10 + news.split('\n').length * 9 : 0) : 96;
    panel(this, m.cx, m.cy, w, h);
    let y = m.cy - (h / 2 - 14) * u;

    if (r.won) {
      label(this, m.cx, y, CHEERS[r.stars], 12, INK);
      y += 24 * u;
      // Звёзды появляются по одной
      [0, 1, 2].forEach(k => {
        const on = k < r.stars;
        const st = this.add.image(m.cx + (k - 1) * 34 * u, y + (k === 1 ? -3 : 0) * u, 'sprites', 'star').setScale(u * 2).setTint(on ? 0xffcd45 : 0xb9a98a);
        if (on && !this.animated) {
          st.setScale(0);
          this.tweens.add({ targets: st, scale: u * 2, duration: 320, delay: 250 + k * 280, ease: 'Back.out', onStart: () => sfx.play('star', k) });
        }
      });
      y += 28 * u;
      // Шаги и время
      const steps = label(this, 0, y, String(r.steps), 9, INK, { ox: 0 });
      const time = label(this, 0, y, fmtTime(r.time), 9, INK, { ox: 0 });
      const gap = 5 * u, ic = 12 * u, total = ic + 3 * u + steps.width + gap * 2 + ic + 3 * u + time.width;
      let x = m.cx - total / 2;
      icon(this, x + ic / 2, y, 'steps', '#566c86'); x += ic + 3 * u;
      steps.setX(Math.round(x)); x += steps.width + gap * 2;
      icon(this, x + ic / 2, y, 'clock', '#566c86'); x += ic + 3 * u;
      time.setX(Math.round(x));
      y += 14 * u;
      if (news) {
        y += (news.split('\n').length * 9) / 2 * u;
        label(this, m.cx, y, news, 7, '#b13e53');
        y += (news.split('\n').length * 9 / 2 + 6) * u;
      }
      y += (BTN_H / 2 + 2) * u;
      const bw = w - 16 - 2 * (BTN + 4);
      button(this, { x: m.cx - (w / 2 - 8 - BTN / 2) * u, y, w: BTN, h: BTN_H, color: 'gray', icon: 'levels', onClick: () => this.toLevels() });
      button(this, { x: m.cx - (w / 2 - 8 - BTN / 2 - BTN - 4) * u, y, w: BTN, h: BTN_H, color: 'gray', icon: 'restart', onClick: () => this.retry() });
      const nextBtn = button(this, { x: m.cx + (w / 2 - 8 - bw / 2) * u, y, w: bw, h: BTN_H, color: 'green', icon: 'play', text: 'Дальше', onClick: () => this.primary() });
      this.tweens.add({ targets: nextBtn, scale: 1.05, duration: 600, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
      if (!this.animated) this.confetti();
    } else {
      label(this, m.cx, y, 'Сторожа поймали!', 11, INK);
      y += 22 * u;
      label(this, m.cx, y, 'Попробуй ещё раз —\nу тебя получится', 8, '#566c86');
      y += (22 + BTN_H / 2) * u;
      const bw = w - 16 - BTN - 4;
      button(this, { x: m.cx - (w / 2 - 8 - BTN / 2) * u, y, w: BTN, h: BTN_H, color: 'gray', icon: 'levels', onClick: () => this.toLevels() });
      button(this, { x: m.cx + (w / 2 - 8 - bw / 2) * u, y, w: bw, h: BTN_H, color: 'green', icon: 'restart', text: 'Ещё раз', onClick: () => this.retry() });
    }
    this.animated = true;
  }

  confetti() {
    const m = metrics(this);
    const em = this.add.particles(0, 0, 'ui', {
      frame: 'px', x: { min: 0, max: m.W }, y: -8 * m.u, speedY: { min: 90 * m.u, max: 170 * m.u }, speedX: { min: -30 * m.u, max: 30 * m.u },
      lifespan: 2600, scale: m.u * 1.5, quantity: 3, frequency: 45,
      tint: ['#ffcd45', '#ff5b4f', '#5fd068', '#41a6f6', '#ff8fb3', '#ffffff'].map(hex)
    });
    this.time.delayedCall(1300, () => em.stop());
  }
}

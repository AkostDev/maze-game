/* Выбор уровня: по странице на мир (10 уровней), звёзды за каждый, замки на недоступных. Листается стрелками и свайпом. */
import { UiScene, metrics, label, button, backdrop, icon, goto, WHITE, BTN } from '../ui/kit.js';
import { INK } from '../gfx/textures.js';
import { progress } from '../core/progress.js';
import { sfx } from '../audio/sfx.js';
import { WORLDS } from '../core/worlds.js';
import { worldFor, LEVELS_PER_WORLD, CAMPAIGN_LEVELS } from '../core/levels.js';

export class LevelsScene extends UiScene {
  constructor() { super('Levels'); }

  init(data) {
    const cur = Math.min(progress.unlocked, CAMPAIGN_LEVELS - 1);
    this.page = data && data.page != null ? data.page : worldFor(cur);
  }

  create() {
    super.create();
    sfx.startMusic('menu');
    this.input.keyboard.on('keydown', e => {
      if (e.code === 'Escape') goto(this, 'Menu');
      else if (e.code === 'Enter' || e.code === 'Space') goto(this, 'Game', { index: progress.unlocked });
      else if (e.code === 'ArrowLeft') this.turn(-1);
      else if (e.code === 'ArrowRight') this.turn(1);
    });
    // Свайп влево-вправо листает миры
    this.input.on('pointerdown', p => { this.swipeX = p.x; });
    this.input.on('pointerup', p => {
      if (this.swipeX == null) return;
      const dx = p.x - this.swipeX;
      this.swipeX = null;
      if (Math.abs(dx) > 40 * metrics(this).dpr) this.turn(dx < 0 ? 1 : -1);
    });
  }

  turn(step) {
    const page = this.page + step;
    if (page < 0 || page >= WORLDS.length) return;
    this.page = page;
    sfx.play('click');
    this.rebuild();
  }

  build() {
    const m = metrics(this), u = m.u;
    const wd = WORLDS[this.page];
    const first = this.page * LEVELS_PER_WORLD;
    backdrop(this, wd.id);

    // Шапка: назад, название мира, звёзды мира
    const top = m.safe.top + (BTN / 2 + 4) * u;
    button(this, { x: m.safe.left + (BTN / 2 + 4) * u, y: top, color: 'gray', icon: 'arrow', iconFlip: true, onClick: () => goto(this, 'Menu') });
    label(this, m.cx, top, wd.name, m.aw < 200 ? 9 : 11, WHITE, { stroke: INK, strokeW: 3 });
    const sx = m.W - m.safe.right - 6 * u;
    const st = label(this, sx, top, progress.rangeStars(first, LEVELS_PER_WORLD) + '/' + LEVELS_PER_WORLD * 3, 7, WHITE, { stroke: INK, strokeW: 2, ox: 1 });
    if (m.aw >= 200) icon(this, sx - st.width - 5 * u, top, 'star', '#ffcd45');
    else st.setY(top + 14 * u);

    // Сетка уровней: 3 колонки стоя, 5 — лёжа
    const cols = m.portrait ? 3 : 5, rows = Math.ceil(LEVELS_PER_WORLD / cols);
    const pagerH = (BTN + 10) * u;
    const areaTop = top + (BTN / 2 + 8) * u, areaH = m.H - m.safe.bottom - pagerH - areaTop;
    const gap = 5;
    const bw = Math.floor(Math.min(46, (m.aw - 16 - gap * (cols - 1)) / cols));
    const bh = Math.floor(Math.min(42, (areaH / u - gap * (rows - 1)) / rows));
    const gridH = rows * bh + (rows - 1) * gap;
    const y0 = areaTop + (areaH - gridH * u) / 2 + (bh * u) / 2;
    for (let n = 0; n < LEVELS_PER_WORLD; n++) {
      const index = first + n;
      const r = Math.floor(n / cols), inRow = Math.min(cols, LEVELS_PER_WORLD - r * cols);
      const x = m.cx + ((n % cols) - (inRow - 1) / 2) * (bw + gap) * u;
      const y = y0 + r * (bh + gap) * u;
      const open = progress.isUnlocked(index), stars = progress.stars(index);
      if (!open) {
        button(this, { x, y, w: bw, h: bh, icon: 'lock', disabled: true });
        continue;
      }
      const isNext = index === progress.unlocked;
      const b = button(this, { x, y, w: bw, h: bh, color: isNext ? 'green' : 'sun', name: 'level-' + (index + 1), onClick: () => goto(this, 'Game', { index }) });
      b.add(label(this, 0, -(bh >= 34 ? 7 : 5) * u, String(index + 1), bh >= 34 ? 12 : 10, INK));
      const sy = (bh / 2 - (bh >= 34 ? 12 : 10)) * u;
      [0, 1, 2].forEach(s => b.add(this.add.image((s - 1) * 9 * u, sy, 'icons', 'star').setScale(u * 0.75).setTint(s < stars ? 0xb5651d : 0xe8d9a8)));
      if (isNext) this.tweens.add({ targets: b, scale: 1.06, duration: 600, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
    }

    // Листалка миров: стрелки и точки-страницы
    const py = m.H - m.safe.bottom - (BTN / 2 + 5) * u;
    if (this.page > 0) button(this, { x: m.cx - 56 * u, y: py, color: 'gray', icon: 'play', iconFlip: true, onClick: () => this.turn(-1) });
    if (this.page < WORLDS.length - 1) button(this, { x: m.cx + 56 * u, y: py, color: 'gray', icon: 'play', onClick: () => this.turn(1) });
    WORLDS.forEach((w, k) => {
      const on = k === this.page;
      this.add.rectangle(m.cx + (k - (WORLDS.length - 1) / 2) * 12 * u, py, (on ? 6 : 4) * u, (on ? 6 : 4) * u, on ? 0xffffff : 0x1a1c2c, on ? 1 : 0.5);
    });
  }
}

/* Пауза поверх игры: продолжить, начать заново, к уровням, в меню и быстрые переключатели звука и управления. */
import { UiScene, metrics, label, button, panel, dim, goto, BTN, BTN_H } from '../ui/kit.js';
import { INK } from '../gfx/textures.js';
import { progress } from '../core/progress.js';
import { worldFor, CAMPAIGN_LEVELS } from '../core/levels.js';
import { TOGGLES, toggleSetting } from './SettingsScene.js';

export class PauseScene extends UiScene {
  constructor() { super('Pause'); }

  init(data) { this.index = (data && data.index) | 0; }

  create() {
    super.create();
    this.input.keyboard.on('keydown', e => {
      if (e.repeat) return;
      if (e.code === 'Escape' || e.code === 'KeyP' || e.code === 'Enter' || e.code === 'Space') this.resume();
      else if (e.code === 'KeyR') goto(this, 'Game', { index: this.index });
    });
  }

  resume() {
    const game = this.scene.get('Game');
    this.scene.resume('Game');
    this.scene.resume('Hud');
    game.onResume();
    this.scene.stop();
  }

  build() {
    const m = metrics(this), u = m.u;
    dim(this);
    // На низком экране (телефон лёжа) кнопки встают в две колонки
    const cols = m.ah < 190 ? 2 : 1, rows = 4 / cols;
    const w = Math.min(cols === 2 ? 260 : 150, m.aw - 12), h = rows * (BTN_H + 4) + BTN + 34;
    const bw = (w - 16 - (cols - 1) * 4) / cols;
    panel(this, m.cx, m.cy, w, h);
    let y = m.cy - (h / 2 - 13) * u;
    label(this, m.cx, y, 'Пауза', 12, INK);
    y += (13 + BTN_H / 2) * u;
    [
      ['green', 'play', 'Продолжить', () => this.resume()],
      ['sun', 'restart', 'Заново', () => goto(this, 'Game', { index: this.index })],
      ['sun', 'levels', 'Уровни', () => goto(this, 'Levels', { page: worldFor(Math.min(this.index, CAMPAIGN_LEVELS - 1)) })],
      ['gray', 'home', 'Меню', () => goto(this, 'Menu')]
    ].forEach(([color, ic, text, onClick], n) => {
      button(this, { x: m.cx + ((n % cols) - (cols - 1) / 2) * (bw + 4) * u, y: y + Math.floor(n / cols) * (BTN_H + 4) * u, w: bw, h: BTN_H, color, icon: ic, text, onClick });
    });
    y += rows * (BTN_H + 4) * u;

    // Быстрые переключатели: зелёный — включено
    y += (BTN - BTN_H) / 2 * u;
    const step = Math.min(BTN + 6, (w - 16) / TOGGLES.length);
    TOGGLES.forEach((t, k) => {
      const on = progress.settings[t.key];
      button(this, {
        x: m.cx + (k - (TOGGLES.length - 1) / 2) * step * u, y, color: on ? 'green' : 'gray', icon: on || !t.off ? t.icon : t.off,
        onClick: () => { toggleSetting(t.key); this.rebuild(); }
      });
    });
  }
}

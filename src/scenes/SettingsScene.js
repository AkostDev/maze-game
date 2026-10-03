/* Настройки: звук, музыка, вибрация, кнопки-стрелки на экране, сброс прогресса (со вторым нажатием для подтверждения). */
import { UiScene, metrics, label, button, panel, backdrop, goto, WHITE, BTN, BTN_H } from '../ui/kit.js';
import { INK } from '../gfx/textures.js';
import { progress } from '../core/progress.js';
import { sfx } from '../audio/sfx.js';
import { WORLDS } from '../core/worlds.js';
import { worldFor } from '../core/levels.js';
import { VERSION } from '../config.js';

// Переключатели: ключ настройки, иконка, подпись
export const TOGGLES = [
  { key: 'sound', icon: 'sound', off: 'mute', text: 'Звуки' },
  { key: 'music', icon: 'music', text: 'Музыка' },
  { key: 'vibration', icon: 'vibration', text: 'Вибрация' },
  { key: 'dpad', icon: 'dpad', text: 'Кнопки-стрелки' }
];

export function toggleSetting(key) {
  progress.setSetting(key, !progress.settings[key]);
  sfx.configure(progress.settings);
  if (key === 'vibration' && progress.settings.vibration) sfx.buzz(30);
}

export class SettingsScene extends UiScene {
  constructor() { super('Settings'); }

  create() {
    this.confirmReset = false;
    super.create();
    this.input.keyboard.on('keydown-ESC', () => goto(this, 'Menu'));
  }

  build() {
    const m = metrics(this), u = m.u;
    backdrop(this, WORLDS[worldFor(progress.unlocked)].id);
    const top = m.safe.top + (BTN / 2 + 4) * u;
    button(this, { x: m.safe.left + (BTN / 2 + 4) * u, y: top, color: 'gray', icon: 'arrow', iconFlip: true, onClick: () => goto(this, 'Menu') });
    label(this, m.cx, top, 'Настройки', 11, WHITE, { stroke: INK, strokeW: 3 });

    // На низком экране (телефон лёжа) переключатели встают в две колонки
    const cols = m.ah < 215 ? 2 : 1, rowH = BTN_H + 4;
    const w = Math.min(cols === 2 ? 300 : 168, m.aw - 12), bw = (w - 14 - (cols - 1) * 4) / cols;
    const rows = Math.ceil(TOGGLES.length / cols) + 1;
    const ph = rows * rowH + 20;
    const cy = Math.max(top + (BTN / 2 + 4 + ph / 2) * u, m.cy);
    panel(this, m.cx, cy, w, ph);
    const y0 = cy - (ph / 2 - 8 - BTN_H / 2) * u;
    TOGGLES.forEach((t, n) => {
      const on = progress.settings[t.key];
      button(this, {
        x: m.cx + ((n % cols) - (cols - 1) / 2) * (bw + 4) * u, y: y0 + Math.floor(n / cols) * rowH * u,
        w: bw, h: BTN_H, color: on ? 'green' : 'gray', icon: on || !t.off ? t.icon : t.off,
        text: t.text + (on ? ': вкл' : ': выкл'),
        onClick: () => { toggleSetting(t.key); this.rebuild(); }
      });
    });
    // Сброс: первое нажатие спрашивает, второе — сбрасывает
    button(this, {
      x: m.cx, y: y0 + (rows - 1) * rowH * u + 2 * u, w: Math.min(w - 14, 154), h: BTN_H, color: this.confirmReset ? 'red' : 'dark', icon: 'trash',
      text: this.confirmReset ? 'Точно сбросить?' : 'Сбросить прогресс',
      onClick: () => {
        if (this.confirmReset) { progress.reset(); this.confirmReset = false; goto(this, 'Menu'); return; }
        this.confirmReset = true;
        this.rebuild();
      }
    });
    if (cy + (ph / 2 + 14) * u > m.H - m.safe.bottom) return; // подпись версии — только если есть место
    label(this, m.cx, m.H - m.safe.bottom - 8 * u, 'Волшебный клубок ' + VERSION + ' · Phaser 4', 6, WHITE, { stroke: INK, strokeW: 2 });
  }
}

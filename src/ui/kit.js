/*
 * Набор интерфейса на Phaser: метрики экрана, текст, кнопки, панели, фон, базовая сцена с перестройкой при resize.
 * Все размеры элементов задаются в «арт-пикселях» и умножаются на u — целое число пикселей устройства
 * (на телефоне 1 арт-пиксель = 2 CSS-пикселя, на планшете и ПК — 3). Так пиксель-арт остаётся ровным.
 */
import * as Phaser from '../../vendor/phaser.esm.min.js';
import { sfx } from '../audio/sfx.js';
import { INK } from '../gfx/textures.js';

export const FONT = '"Tiny5", system-ui, sans-serif';
export const WHITE = '#ffffff';
export const hex = c => parseInt(c.slice(1), 16);

// Размеры кнопок в арт-пикселях: квадратная иконка 23 (46 CSS px на телефоне), высота обычной кнопки 24
export const BTN = 23;
export const BTN_H = 24;

export function metrics(scene) {
  const W = scene.scale.width, H = scene.scale.height;
  const reg = scene.game.registry;
  const dpr = reg.get('dpr') || 1;
  const k = Math.min(W, H) / dpr >= 600 ? 3 : 2;
  const u = Math.max(1, Math.round(k * dpr));
  const safe = reg.get('safe') || { top: 0, right: 0, bottom: 0, left: 0 };
  return { W, H, dpr, u, safe, portrait: H >= W, cx: Math.round(W / 2), cy: Math.round(H / 2), aw: W / u, ah: H / u };
}

export const TITLE_IN_BAR = 260; // от этой ширины (арт-пиксели) название уровня стоит прямо в шапке
export const CARD_H = 56; // место под карточку-знакомство над нижним рядом кнопок, арт-пиксели

// Поля экрана, занятые HUD (в пикселях устройства, от краёв экрана, вырезы учтены): в оставшемся прямоугольнике
// игровая сцена размещает лабиринт. Стоя кнопки управления занимают нижний ряд, лёжа — боковые колонки.
// base — высота нижнего ряда кнопок (над ним встаёт карточка-знакомство).
export function hudInsets(scene, dpad, card) {
  const m = metrics(scene), u = m.u;
  // на узком экране название уровня не помещается в шапку и занимает свою строку под ней
  const top = m.safe.top + (BTN + 6 + (m.aw < TITLE_IN_BAR ? 10 : 0)) * u;
  const cardH = card ? CARD_H * u : 0;
  if (m.portrait) {
    const base = m.safe.bottom + (dpad ? BTN * 3 + 10 : BTN + 8) * u;
    return { top, base, bottom: base + cardH, left: m.safe.left, right: m.safe.right };
  }
  const side = (BTN + 8) * u;
  return {
    top, base: m.safe.bottom + 2 * u, bottom: m.safe.bottom + 2 * u + cardH,
    left: m.safe.left + side, right: m.safe.right + (dpad ? (BTN * 3 + 10) * u : side)
  };
}

// Текст: size — в арт-пикселях (8 — основной, 6 — мелкий, 12–16 — заголовки). Шрифт Tiny5 нарисован на сетке
// 8 px, поэтому кегль округляется до кратного 8 px устройства — «пиксели» букв остаются целыми и резкими.
export function label(scene, x, y, text, size, color, o) {
  o = o || {};
  const u = metrics(scene).u;
  const style = {
    fontFamily: FONT, fontSize: Math.max(1, Math.round((size * u) / 8)) * 8 + 'px', color: color || INK,
    align: o.align || 'center', padding: { x: u, y: u }
  };
  if (o.wrap) style.wordWrap = { width: o.wrap * u };
  if (o.stroke) { style.stroke = o.stroke; style.strokeThickness = Math.round((o.strokeW || 2) * u); }
  if (o.shadow) style.shadow = { offsetX: 0, offsetY: u, color: o.shadow, blur: 0, fill: true, stroke: false };
  if (o.lineSpacing != null) style.lineSpacing = o.lineSpacing * u;
  return scene.add.text(Math.round(x), Math.round(y), text, style).setOrigin(o.ox != null ? o.ox : 0.5, o.oy != null ? o.oy : 0.5);
}

export function icon(scene, x, y, name, color, scale) {
  const u = metrics(scene).u;
  return scene.add.image(Math.round(x), Math.round(y), 'icons', name).setScale(u * (scale || 1)).setTint(hex(color || INK));
}

export function sprite(scene, x, y, frame, scale) {
  const u = metrics(scene).u;
  return scene.add.image(Math.round(x), Math.round(y), 'sprites', frame).setScale(u * (scale || 1));
}

// На светлых кнопках надпись тёмная, на ярких — белая с тенью
const DARK_TEXT = { sun: true, gray: true, green: true };

/*
 * Кнопка. o: { x, y — центр (px устройства); w, h — размер в арт-пикселях; color — ключ BUTTONS;
 *   icon, iconAngle, iconFlip; text, size; onClick; onDown/onUp — для кнопок, которые держат (D-pad); disabled }
 * Зона касания не меньше 46 CSS px, даже если кнопка нарисована мельче.
 */
export function button(scene, o) {
  const m = metrics(scene), u = m.u;
  const w = o.w || BTN, h = o.h || BTN;
  const color = o.disabled ? 'gray' : (o.color || 'sun');
  const c = scene.add.container(Math.round(o.x), Math.round(o.y));
  c.name = o.name || o.text || o.icon || ''; // по имени кнопку находят проверки в браузере
  const up = scene.add.nineslice(0, 0, 'ui', 'btn_' + color, w, h, 5, 5, 5, 6).setScale(u);
  const down = scene.add.nineslice(0, 0, 'ui', 'btn_' + color + '_down', w, h, 5, 5, 6, 5).setScale(u).setVisible(false);
  const inner = scene.add.container(0, -1.5 * u);
  const ink = DARK_TEXT[color] ? INK : WHITE;
  const parts = [];
  if (o.icon) {
    const ic = scene.add.image(0, 0, 'icons', o.icon).setScale(u * (o.iconScale || 1)).setTint(hex(ink));
    if (o.iconAngle) ic.setAngle(o.iconAngle);
    if (o.iconFlip) ic.setFlipX(true);
    parts.push(ic);
  }
  if (o.text) {
    const t = label(scene, 0, 0, o.text, o.size || 8, ink, { shadow: ink === WHITE ? 'rgba(26,28,44,0.55)' : null });
    parts.push(t);
  }
  // иконка и подпись в ряд, по центру
  const gap = 3 * u;
  const total = parts.reduce((s, p) => s + p.displayWidth, 0) + gap * (parts.length - 1);
  let x = -total / 2;
  parts.forEach(p => { p.x = Math.round(x + p.displayWidth / 2); x += p.displayWidth + gap; });
  inner.add(parts);
  c.add([up, down, inner]);
  if (o.disabled) { c.setAlpha(0.6); return c; }

  const minHit = 46 * m.dpr;
  c.setSize(Math.max(w * u, minHit), Math.max(h * u, minHit));
  c.setInteractive({ useHandCursor: true });
  let pressed = false;
  const show = on => {
    pressed = on;
    up.setVisible(!on); down.setVisible(on);
    inner.y = (on ? 0.5 : -1.5) * u;
  };
  c.on('pointerdown', () => { show(true); if (o.onDown) o.onDown(); });
  c.on('pointerout', () => { if (pressed) { show(false); if (o.onUp) o.onUp(); } });
  c.on('pointerup', () => {
    if (!pressed) return;
    show(false);
    if (o.onUp) o.onUp();
    if (o.onClick) { sfx.play('click'); o.onClick(); }
  });
  return c;
}

// Панель-«заплатка»: бумажный фон с пунктирным стежком по краю — фирменная деталь игры
export function panel(scene, x, y, w, h) {
  const u = metrics(scene).u;
  const c = scene.add.container(Math.round(x), Math.round(y));
  c.add(scene.add.nineslice(0, 0, 'ui', 'panel', w, h, 5, 5, 5, 6).setScale(u));
  const g = scene.add.graphics();
  g.fillStyle(0xc9a66b, 1);
  const x0 = -w / 2 + 3, y0 = -h / 2 + 3, x1 = w / 2 - 4, y1 = h / 2 - 6;
  for (let px = x0 + 2; px + 2 <= x1 - 1; px += 4) { g.fillRect(px * u, y0 * u, 2 * u, u); g.fillRect(px * u, y1 * u, 2 * u, u); }
  for (let py = y0 + 2; py + 2 <= y1 - 1; py += 4) { g.fillRect(x0 * u, py * u, u, 2 * u); g.fillRect(x1 * u, py * u, u, 2 * u); }
  c.add(g);
  return c;
}

// Фон мира: плитка на весь экран, медленно плывёт
export function backdrop(scene, worldId) {
  const m = metrics(scene);
  const ts = scene.add.tileSprite(0, 0, m.W, m.H, 'bg_' + worldId).setOrigin(0).setTileScale(m.u).setDepth(-10);
  scene.tweens.add({ targets: ts, tilePositionX: 32, tilePositionY: 32, duration: 9000, repeat: -1 });
  return ts;
}

// Затемнение под модальным окном; заодно не пропускает касания к сценам ниже
export function dim(scene, alpha) {
  const m = metrics(scene);
  return scene.add.rectangle(0, 0, m.W, m.H, 0x0b1020, alpha == null ? 0.6 : alpha).setOrigin(0).setInteractive();
}

const OVERLAYS = ['Hud', 'Pause', 'Result'];

// Переход на сцену: закрывает игру и всё, что открыто поверх неё
export function goto(scene, key, data) {
  const sp = scene.scene;
  OVERLAYS.concat(key === 'Game' ? [] : ['Game']).forEach(k => {
    if (k !== scene.scene.key && (sp.isActive(k) || sp.isPaused(k))) sp.stop(k);
  });
  sp.start(key, data);
}

/*
 * Базовая сцена интерфейса: наследник реализует build() — расставляет элементы по текущим метрикам.
 * При изменении размера окна или повороте экрана сцена целиком перестраивается (rebuild).
 */
export class UiScene extends Phaser.Scene {
  create() {
    this.scale.on('resize', this.rebuild, this);
    this.events.once('shutdown', () => this.scale.off('resize', this.rebuild, this));
    this.build();
  }
  rebuild() {
    if (!this.sys.isActive() && !this.sys.isPaused()) return;
    this.tweens.killAll();
    this.children.list.slice().forEach(o => o.destroy());
    this.build();
  }
  build() {}
}

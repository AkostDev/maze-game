/*
 * Сборка текстур при загрузке: атласы спрайтов и иконок из ASCII-карт, элементы интерфейса (кнопки, панель),
 * фон миров, «дырка света» для ночных уровней. Всё рисуется на canvas и регистрируется в TextureManager.
 */
import { PALETTE, SPRITES, GATE, ICONS, SPRITE, ICON, expand, validate } from './sprites.js';
import { WORLDS, NIGHT } from '../core/worlds.js';
import { makeRng } from '../core/rng.js';

// Цвета кнопок: [лицо, блик, кромка]
export const BUTTONS = {
  red: ['#ff5b4f', '#ff9488', '#b13e53'],
  sun: ['#ffcd45', '#ffe9a3', '#c98a1a'],
  green: ['#5fd068', '#a5ef9f', '#2f8f4a'],
  teal: ['#2ab8a8', '#7fe6d6', '#1a7a70'],
  grape: ['#8b6cf6', '#bda9ff', '#5a44b8'],
  gray: ['#94b0c2', '#c9dbe6', '#566c86'],
  dark: ['#3a4466', '#56628c', '#1a1c2c']
};
export const INK = '#1a1c2c';
export const PAPER = '#f4e9d4';

function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}

function paint(ctx, rows, ox, oy, colorOf) {
  rows.forEach((r, y) => {
    for (let x = 0; x < r.length; x++) {
      const col = colorOf(r[x]);
      if (col) { ctx.fillStyle = col; ctx.fillRect(ox + x, oy + y, 1, 1); }
    }
  });
}

// Раскладывает кадры по сетке с зазором 2 px (чтобы соседние кадры не «подтекали»)
function atlas(scene, key, cellW, cellH, frames) {
  const cols = 8, pad = 2;
  const rowsN = Math.ceil(frames.length / cols);
  const canvas = makeCanvas(cols * (cellW + pad), rowsN * (cellH + pad));
  const ctx = canvas.getContext('2d');
  const rects = frames.map((f, n) => {
    const x = (n % cols) * (cellW + pad), y = Math.floor(n / cols) * (cellH + pad);
    f.draw(ctx, x, y);
    return { name: f.name, x, y, w: f.w || cellW, h: f.h || cellH };
  });
  const tex = scene.textures.addCanvas(key, canvas);
  rects.forEach(r => tex.add(r.name, 0, r.x, r.y, r.w, r.h));
  return tex;
}

function portalRows(frame) {
  const rows = [];
  for (let y = 0; y < SPRITE; y++) {
    let row = '';
    for (let x = 0; x < SPRITE; x++) {
      const dx = x - 7.5, dy = y - 7.5, r = Math.hypot(dx, dy);
      if (r > 7.7) row += '.';
      else if (r > 6.5) row += 'k';
      else if (r > 3.3) {
        // закрученные дольки: сдвиг по радиусу даёт спираль, кадр — поворот
        const a = (Math.atan2(dy, dx) + Math.PI) / (Math.PI * 2);
        row += Math.floor(a * 8 + r * 0.45 + frame * 0.5) % 2 ? 'w' : 'G';
      } else row += r > 2.3 ? 'k' : 'K';
    }
    rows.push(row);
  }
  return rows;
}

function buildSprites(scene) {
  const color = ch => (ch === '.' ? null : PALETTE[ch]);
  const frames = [];
  for (const name in SPRITES) {
    frames.push({ name, draw: (ctx, x, y) => paint(ctx, expand(SPRITES[name], 'a'), x, y, color) });
    if (SPRITES[name].alt) frames.push({ name: name + '_b', draw: (ctx, x, y) => paint(ctx, expand(SPRITES[name], 'b'), x, y, color) });
  }
  const gateH = GATE[0].split('').map((_, x) => GATE.map(row => row[x]).join(''));
  frames.push({ name: 'gateV', w: 8, h: 16, draw: (ctx, x, y) => paint(ctx, GATE, x, y, color) });
  frames.push({ name: 'gateH', w: 16, h: 8, draw: (ctx, x, y) => paint(ctx, gateH, x, y, color) });
  [0, 1].forEach(f => frames.push({ name: 'portal_' + f, draw: (ctx, x, y) => paint(ctx, portalRows(f), x, y, color) }));
  atlas(scene, 'sprites', SPRITE, SPRITE, frames);
}

function buildIcons(scene) {
  const frames = Object.keys(ICONS).map(name => ({
    name, draw: (ctx, x, y) => paint(ctx, ICONS[name], x, y, ch => (ch === '#' ? '#ffffff' : null))
  }));
  atlas(scene, 'icons', ICON, ICON, frames);
}

// Кнопка 16×16 под NineSlice (углы 5 px): в обычном виде — с толстой нижней кромкой, в нажатом — «утоплена»
function drawButton(ctx, x, y, [face, hi, lip], down) {
  const top = down ? 2 : 0, lipH = down ? 1 : 3;
  const rect = (c, rx, ry, w, h) => { ctx.fillStyle = c; ctx.fillRect(x + rx, y + ry, w, h); };
  rect(INK, 1, top, 14, 16 - top); rect(INK, 0, top + 1, 16, 14 - top);
  rect(lip, 1, top + 1, 14, 14 - top);
  rect(face, 1, top + 1, 14, 14 - top - lipH);
  rect(hi, 2, top + 1, 12, 1);
}

function drawPanel(ctx, x, y) {
  const rect = (c, rx, ry, w, h) => { ctx.fillStyle = c; ctx.fillRect(x + rx, y + ry, w, h); };
  rect(INK, 1, 0, 14, 16); rect(INK, 0, 1, 16, 14);
  rect('#c9b48a', 1, 1, 14, 14);
  rect(PAPER, 1, 1, 14, 12);
  rect('#fffaf0', 2, 1, 12, 1);
}

function buildUi(scene) {
  const frames = [];
  for (const name in BUTTONS) {
    frames.push({ name: 'btn_' + name, draw: (ctx, x, y) => drawButton(ctx, x, y, BUTTONS[name], false) });
    frames.push({ name: 'btn_' + name + '_down', draw: (ctx, x, y) => drawButton(ctx, x, y, BUTTONS[name], true) });
  }
  frames.push({ name: 'panel', draw: drawPanel });
  frames.push({ name: 'px', w: 2, h: 2, draw: (ctx, x, y) => { ctx.fillStyle = '#fff'; ctx.fillRect(x, y, 2, 2); } });
  frames.push({
    name: 'dot', w: 4, h: 4, draw: (ctx, x, y) => { ctx.fillStyle = '#fff'; ctx.fillRect(x + 1, y, 2, 4); ctx.fillRect(x, y + 1, 4, 2); }
  });
  frames.push({
    name: 'shadow', w: 12, h: 4, draw: (ctx, x, y) => {
      ctx.fillStyle = 'rgba(10,12,28,0.28)'; ctx.fillRect(x + 2, y, 8, 4); ctx.fillRect(x, y + 1, 12, 2);
    }
  });
  atlas(scene, 'ui', 16, 16, frames);

  // Свет в темноте: непрозрачная ночь со ступенчатой прозрачной дыркой радиусом LIGHT_HOLE px
  const S = 64, light = makeCanvas(S, S), lc = light.getContext('2d');
  const img = lc.createImageData(S, S);
  const n = parseInt(NIGHT.slice(1), 16);
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const r = Math.hypot(x - S / 2 + 0.5, y - S / 2 + 0.5);
      const a = r < 20 ? 0 : r < 23 ? 0.4 : r < 26 ? 0.7 : r < 29 ? 0.88 : 1;
      const o = (y * S + x) * 4;
      img.data[o] = n >>> 16; img.data[o + 1] = (n >>> 8) & 0xff; img.data[o + 2] = n & 0xff; img.data[o + 3] = Math.round(a * 255);
    }
  }
  lc.putImageData(img, 0, 0);
  scene.textures.addCanvas('light', light);
}
export const LIGHT_SIZE = 64;
export const LIGHT_HOLE = 24;

// Фон мира — плитка 32×32 с редким узором своего вида
function buildBackdrops(scene) {
  const marks = {
    forest: (ctx, x, y) => { ctx.fillRect(x, y, 1, 2); ctx.fillRect(x + 2, y + 1, 1, 2); },
    sea: (ctx, x, y) => { ctx.fillRect(x, y, 3, 1); ctx.fillRect(x + 3, y + 1, 2, 1); },
    candy: (ctx, x, y) => { ctx.fillRect(x, y, 2, 2); },
    snow: (ctx, x, y) => { ctx.fillRect(x + 1, y, 1, 3); ctx.fillRect(x, y + 1, 3, 1); },
    space: (ctx, x, y) => { ctx.fillRect(x, y, 1, 1); }
  };
  WORLDS.forEach(wd => {
    const c = makeCanvas(32, 32), ctx = c.getContext('2d');
    const rng = makeRng('bg|' + wd.id);
    ctx.fillStyle = wd.bg; ctx.fillRect(0, 0, 32, 32);
    for (let k = 0; k < 14; k++) {
      ctx.fillStyle = k % 4 === 0 ? wd.bgDeco : wd.bgAlt;
      marks[wd.id](ctx, rng.int(27), rng.int(28));
    }
    scene.textures.addCanvas('bg_' + wd.id, c);
  });
}

export function buildTextures(scene) {
  const errs = validate();
  if (errs.length) throw new Error('Ошибка в данных спрайтов: ' + errs.slice(0, 3).join('; '));
  buildSprites(scene);
  buildIcons(scene);
  buildUi(scene);
  buildBackdrops(scene);
}

export function buildAnimations(scene) {
  for (const name in SPRITES) {
    if (!SPRITES[name].alt) continue;
    scene.anims.create({ key: name + '_walk', frames: [{ key: 'sprites', frame: name + '_b' }, { key: 'sprites', frame: name }], frameRate: 9, repeat: -1 });
  }
  scene.anims.create({ key: 'portal_spin', frames: [{ key: 'sprites', frame: 'portal_0' }, { key: 'sprites', frame: 'portal_1' }], frameRate: 5, repeat: -1 });
}

/*
 * Картинка лабиринта: статичный слой (пол, стены с передней гранью, коврик у выхода) рисуется попиксельно
 * один раз на уровень и показывается одним Image. Клетка — 16 px пола + стена 4 px (шаг сетки 20 px).
 * paintMaze() — чистая функция (работает и в Node), mazeCanvas() — обёртка для браузера.
 */
import { hashStr } from '../core/rng.js';

export const CELL = 16;   // пол клетки
export const WALL = 4;    // толщина стены
export const PITCH = 20;  // шаг сетки = CELL + WALL
const FACE = 3;           // высота передней грани стены

// Мировые координаты (px) центра клетки по её положению в клетках: cx = x + 0.5
export const toWorld = c => c * PITCH + WALL / 2;

export function mazeSize(level) {
  return { w: level.cols * PITCH + WALL, h: level.rows * PITCH + WALL + FACE + 1 };
}

const abgr = hex => {
  const n = parseInt(hex.slice(1), 16);
  return (0xff000000 | ((n & 0xff) << 16) | (n & 0xff00) | (n >>> 16)) >>> 0;
};
const mix = (a, b, t) => {
  let out = 0xff000000;
  for (let sh = 0; sh < 24; sh += 8) out |= Math.round(((a >>> sh) & 0xff) * (1 - t) + ((b >>> sh) & 0xff) * t) << sh;
  return out >>> 0;
};
const noise = (x, y, seed) => {
  let h = (Math.imul(x, 374761393) + Math.imul(y, 668265263) + seed) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};

// Рисунок на верхней грани стены — свой у каждого мира (листва, волны, карамельные полосы, лёд, панели)
function wallAccent(worldId, x, y, n) {
  if (worldId === 'forest') return n < 0.24;
  if (worldId === 'sea') return (x + y * 2) % 7 === 0 || n < 0.06;
  if (worldId === 'candy') return (x + y) % 4 === 0;
  if (worldId === 'snow') return n < 0.1;
  return x % 5 === 0 && y % 2 === 0;
}

export function paintMaze(level) {
  const g = level.grid, wd = level.world;
  const { w: W, h: H } = mazeSize(level);
  const kind = new Uint8Array(W * H); // 0 — пусто, 1 — пол, 2 — стена
  const fill = (x0, y0, w, h, v) => {
    for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) if (kind[y * W + x] < v) kind[y * W + x] = v;
  };
  const span = PITCH + WALL;
  for (let i = 0; i < g.n; i++) {
    if (!g.active(i)) continue;
    const x = g.x(i) * PITCH, y = g.y(i) * PITCH;
    fill(x, y, span, span, 1);
    // столбики по углам — сетка выглядит цельной даже там, где стены убраны петлями
    fill(x, y, WALL, WALL, 2); fill(x + PITCH, y, WALL, WALL, 2);
    fill(x, y + PITCH, WALL, WALL, 2); fill(x + PITCH, y + PITCH, WALL, WALL, 2);
    if (!g.isOpen(i, 0)) fill(x, y, span, WALL, 2);
    if (!g.isOpen(i, 2)) fill(x, y + PITCH, span, WALL, 2);
    if (!g.isOpen(i, 3)) fill(x, y, WALL, span, 2);
    if (!g.isOpen(i, 1)) fill(x + PITCH, y, WALL, span, 2);
  }

  const seed = hashStr('maze|' + level.seed) | 0;
  const C = {
    floor: wd.floor.map(abgr), deco: abgr(wd.floorDeco),
    top: abgr(wd.wallTop), hi: abgr(wd.wallHi), front: abgr(wd.wallFront), dark: abgr(wd.wallDark)
  };
  const mat = abgr('#ffcd75');
  const ex = g.x(level.exit), ey = g.y(level.exit);
  const px = new Uint32Array(W * H);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const k = kind[y * W + x];
      if (k === 2) {
        const edge = y === 0 || kind[(y - 1) * W + x] !== 2;
        px[y * W + x] = edge || wallAccent(wd.id, x, y, noise(x, y, seed)) ? C.hi : C.top;
        continue;
      }
      // передняя грань: сколько пикселей вверх до стены
      let up = 0;
      for (let n = 1; n <= FACE + 1 && y - n >= 0; n++) if (kind[(y - n) * W + x] === 2) { up = n; break; }
      if (up >= 1 && up <= FACE) { px[y * W + x] = up === FACE ? C.dark : C.front; continue; }
      if (k !== 1) continue;
      const cx = Math.min(level.cols - 1, Math.floor(Math.max(0, x - WALL / 2) / PITCH));
      const cy = Math.min(level.rows - 1, Math.floor(Math.max(0, y - WALL / 2) / PITCH));
      let c = C.floor[(cx + cy) & 1];
      if (cx === ex && cy === ey) c = mix(c, mat, 0.45);
      else if (noise(x, y, seed + 7) < 0.028) c = C.deco;
      if (up === FACE + 1) c = mix(c, C.dark, 0.22); // тень под стеной
      px[y * W + x] = c;
    }
  }
  return { w: W, h: H, pixels: px };
}

export function mazeCanvas(level) {
  const { w, h, pixels } = paintMaze(level);
  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext('2d');
  const img = ctx.createImageData(w, h);
  new Uint32Array(img.data.buffer).set(pixels);
  ctx.putImageData(img, 0, 0);
  return canvas;
}

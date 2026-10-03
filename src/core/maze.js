/*
 * Лабиринты: сетка с битмасками проходов, маски-фигуры, генераторы, braid, поиск путей.
 * Проход из клетки: N=1, E=2, S=4, W=8. Индекс клетки: y * cols + x. Чистая логика — без Phaser и DOM.
 */

const DIRS = [
  { i: 0, bit: 1, dx: 0, dy: -1, name: 'up' },
  { i: 1, bit: 2, dx: 1, dy: 0, name: 'right' },
  { i: 2, bit: 4, dx: 0, dy: 1, name: 'down' },
  { i: 3, bit: 8, dx: -1, dy: 0, name: 'left' }
];
const OPP = [2, 3, 0, 1];

class Grid {
  constructor(cols, rows, mask) {
    this.cols = cols;
    this.rows = rows;
    this.n = cols * rows;
    this.cells = new Uint8Array(this.n);
    this.mask = mask ? mask : new Uint8Array(this.n).fill(1);
  }
  idx(x, y) { return y * this.cols + x; }
  x(i) { return i % this.cols; }
  y(i) { return (i / this.cols) | 0; }
  active(i) { return i >= 0 && i < this.n && this.mask[i] === 1; }
  neighbor(i, d) {
    const x = i % this.cols + DIRS[d].dx, y = ((i / this.cols) | 0) + DIRS[d].dy;
    if (x < 0 || y < 0 || x >= this.cols || y >= this.rows) return -1;
    const j = y * this.cols + x;
    return this.mask[j] === 1 ? j : -1;
  }
  isOpen(i, d) { return (this.cells[i] & DIRS[d].bit) !== 0; }
  carve(i, d) {
    const j = this.neighbor(i, d);
    if (j < 0) return -1;
    this.cells[i] |= DIRS[d].bit;
    this.cells[j] |= DIRS[OPP[d]].bit;
    return j;
  }
  degree(i) {
    const c = this.cells[i];
    return (c & 1) + ((c >> 1) & 1) + ((c >> 2) & 1) + ((c >> 3) & 1);
  }
  activeList() {
    const out = [];
    for (let i = 0; i < this.n; i++) if (this.mask[i] === 1) out.push(i);
    return out;
  }
  dirBetween(a, b) {
    for (let d = 0; d < 4; d++) if (this.neighbor(a, d) === b) return d;
    return -1;
  }
}

// ---------- Генераторы (работают на любой связной маске) ----------

function randomActive(g, rng) {
  const list = g.activeList();
  return list[rng.int(list.length)];
}

// Рекурсивный бэктрекер (DFS): длинные извилистые коридоры, мало развилок — хорошо для малышей
function backtracker(g, rng) {
  const visited = new Uint8Array(g.n);
  const start = randomActive(g, rng);
  const stack = [start];
  visited[start] = 1;
  const opts = [];
  while (stack.length) {
    const cur = stack[stack.length - 1];
    opts.length = 0;
    for (let d = 0; d < 4; d++) {
      const j = g.neighbor(cur, d);
      if (j >= 0 && !visited[j]) opts.push(d);
    }
    if (!opts.length) { stack.pop(); continue; }
    const d = opts[rng.int(opts.length)];
    const j = g.carve(cur, d);
    visited[j] = 1;
    stack.push(j);
  }
}

// Growing Tree: смесь «новейший/случайный» — плавно регулирует характер между DFS и Прима
function growingTree(g, rng, opts) {
  const newest = opts && opts.newest != null ? opts.newest : 0.7;
  const visited = new Uint8Array(g.n);
  const start = randomActive(g, rng);
  const list = [start];
  visited[start] = 1;
  const dirs = [];
  while (list.length) {
    const k = rng.next() < newest ? list.length - 1 : rng.int(list.length);
    const cur = list[k];
    dirs.length = 0;
    for (let d = 0; d < 4; d++) {
      const j = g.neighbor(cur, d);
      if (j >= 0 && !visited[j]) dirs.push(d);
    }
    if (!dirs.length) { list[k] = list[list.length - 1]; list.pop(); continue; }
    const j = g.carve(cur, dirs[rng.int(dirs.length)]);
    visited[j] = 1;
    list.push(j);
  }
}

// Алгоритм Прима (рандомизированный, по фронтиру): много коротких тупиков
function prim(g, rng) {
  const state = new Uint8Array(g.n); // 0 — вне, 1 — фронтир, 2 — в дереве
  const frontier = [];
  const addFrontier = i => {
    for (let d = 0; d < 4; d++) {
      const j = g.neighbor(i, d);
      if (j >= 0 && state[j] === 0) { state[j] = 1; frontier.push(j); }
    }
  };
  const start = randomActive(g, rng);
  state[start] = 2;
  addFrontier(start);
  const ins = [];
  while (frontier.length) {
    const k = rng.int(frontier.length);
    const f = frontier[k];
    frontier[k] = frontier[frontier.length - 1];
    frontier.pop();
    ins.length = 0;
    for (let d = 0; d < 4; d++) {
      const j = g.neighbor(f, d);
      if (j >= 0 && state[j] === 2) ins.push(d);
    }
    g.carve(f, ins[rng.int(ins.length)]);
    state[f] = 2;
    addFrontier(f);
  }
}

// Алгоритм Краскала: случайные рёбра + система непересекающихся множеств
function kruskal(g, rng) {
  const parent = new Int32Array(g.n);
  for (let i = 0; i < g.n; i++) parent[i] = i;
  const find = i => {
    while (parent[i] !== i) { parent[i] = parent[parent[i]]; i = parent[i]; }
    return i;
  };
  const edges = [];
  for (let i = 0; i < g.n; i++) {
    if (!g.active(i)) continue;
    if (g.neighbor(i, 1) >= 0) edges.push(i * 4 + 1);
    if (g.neighbor(i, 2) >= 0) edges.push(i * 4 + 2);
  }
  rng.shuffle(edges);
  for (const e of edges) {
    const i = e >> 2, d = e & 3;
    const j = g.neighbor(i, d);
    const a = find(i), b = find(j);
    if (a !== b) { parent[a] = b; g.carve(i, d); }
  }
}

// Алгоритм Уилсона: случайные блуждания со стиранием петель — равномерное остовное дерево (без перекоса)
function wilson(g, rng) {
  const inTree = new Uint8Array(g.n);
  const walkDir = new Int8Array(g.n).fill(-1);
  const remaining = g.activeList();
  const pos = new Int32Array(g.n).fill(-1);
  remaining.forEach((c, k) => { pos[c] = k; });
  const removeRemaining = c => {
    const k = pos[c];
    if (k < 0) return;
    const last = remaining[remaining.length - 1];
    remaining[k] = last; pos[last] = k;
    remaining.pop(); pos[c] = -1;
  };
  const first = remaining[rng.int(remaining.length)];
  inTree[first] = 1;
  removeRemaining(first);
  const dirs = [];
  while (remaining.length) {
    const startCell = remaining[rng.int(remaining.length)];
    let cur = startCell;
    while (!inTree[cur]) {
      dirs.length = 0;
      for (let d = 0; d < 4; d++) if (g.neighbor(cur, d) >= 0) dirs.push(d);
      const d = dirs[rng.int(dirs.length)];
      walkDir[cur] = d;
      cur = g.neighbor(cur, d);
    }
    cur = startCell;
    while (!inTree[cur]) {
      const d = walkDir[cur];
      const next = g.carve(cur, d);
      inTree[cur] = 1;
      removeRemaining(cur);
      cur = next;
    }
  }
}

// Hunt-and-Kill: как DFS, но без стека — длинные коридоры с неожиданными ответвлениями
function huntAndKill(g, rng) {
  const visited = new Uint8Array(g.n);
  let cur = randomActive(g, rng);
  visited[cur] = 1;
  let left = g.activeList().length - 1;
  const dirs = [];
  while (left > 0) {
    dirs.length = 0;
    for (let d = 0; d < 4; d++) {
      const j = g.neighbor(cur, d);
      if (j >= 0 && !visited[j]) dirs.push(d);
    }
    if (dirs.length) {
      cur = g.carve(cur, dirs[rng.int(dirs.length)]);
      visited[cur] = 1; left--;
      continue;
    }
    // Охота: ищем непосещённую клетку рядом с посещённой
    let found = -1;
    for (let i = 0; i < g.n && found < 0; i++) {
      if (!g.active(i) || visited[i]) continue;
      dirs.length = 0;
      for (let d = 0; d < 4; d++) {
        const j = g.neighbor(i, d);
        if (j >= 0 && visited[j]) dirs.push(d);
      }
      if (dirs.length) {
        g.carve(i, dirs[rng.int(dirs.length)]);
        found = i;
      }
    }
    if (found < 0) break;
    cur = found; visited[cur] = 1; left--;
  }
}

const generators = { backtracker, growingTree, prim, kruskal, wilson, huntAndKill };

function generate(algo, cols, rows, mask, rng, opts) {
  const g = new Grid(cols, rows, mask);
  (generators[algo] || backtracker)(g, rng, opts);
  return g;
}

// Braid: убираем часть тупиков, добавляя петли. allow(i, j) — можно ли соединять клетки.
function braid(g, ratio, rng, allow) {
  if (ratio <= 0) return 0;
  const deadEnds = [];
  for (let i = 0; i < g.n; i++) if (g.active(i) && g.degree(i) === 1) deadEnds.push(i);
  rng.shuffle(deadEnds);
  let opened = 0;
  const best = [], any = [];
  for (const c of deadEnds) {
    if (g.degree(c) !== 1 || !rng.chance(ratio)) continue;
    best.length = 0; any.length = 0;
    for (let d = 0; d < 4; d++) {
      if (g.isOpen(c, d)) continue;
      const j = g.neighbor(c, d);
      if (j < 0 || (allow && !allow(c, j))) continue;
      any.push(d);
      if (g.degree(j) === 1) best.push(d);
    }
    const pool = best.length ? best : any;
    if (!pool.length) continue;
    g.carve(c, pool[rng.int(pool.length)]);
    opened++;
  }
  return opened;
}

// BFS. opts.blocked(i, d, j) → true если ребро закрыто; opts.links — Map клетка → [клетки] (порталы)
function bfs(g, start, opts) {
  const dist = new Int32Array(g.n).fill(-1);
  const prev = new Int32Array(g.n).fill(-1);
  const blocked = opts && opts.blocked;
  const links = opts && opts.links;
  const q = new Int32Array(g.n);
  let head = 0, tail = 0;
  dist[start] = 0;
  q[tail++] = start;
  while (head < tail) {
    const i = q[head++];
    const c = g.cells[i];
    for (let d = 0; d < 4; d++) {
      if (!(c & DIRS[d].bit)) continue;
      const j = g.neighbor(i, d);
      if (j < 0 || dist[j] >= 0) continue;
      if (blocked && blocked(i, d, j)) continue;
      dist[j] = dist[i] + 1; prev[j] = i; q[tail++] = j;
    }
    if (links && links.has(i)) {
      for (const j of links.get(i)) {
        if (dist[j] >= 0) continue;
        if (blocked && blocked(i, -1, j)) continue;
        dist[j] = dist[i] + 1; prev[j] = i; q[tail++] = j;
      }
    }
  }
  return { dist, prev };
}

function pathTo(prev, start, target) {
  const path = [];
  let c = target;
  while (c >= 0) {
    path.push(c);
    if (c === start) break;
    c = prev[c];
  }
  path.reverse();
  return path[0] === start ? path : [];
}

function farthest(dist) {
  let best = -1, bi = -1;
  for (let i = 0; i < dist.length; i++) if (dist[i] > best) { best = dist[i]; bi = i; }
  return bi;
}

// ---------- Маски-фигуры ----------

// Оставляем только самую большую 4-связную область
function largestComponent(mask, cols, rows) {
  const n = cols * rows;
  const comp = new Int32Array(n).fill(-1);
  let bestId = -1, bestSize = 0, id = 0;
  const q = new Int32Array(n);
  for (let s = 0; s < n; s++) {
    if (!mask[s] || comp[s] >= 0) continue;
    let head = 0, tail = 0, size = 0;
    q[tail++] = s; comp[s] = id;
    while (head < tail) {
      const i = q[head++]; size++;
      const x = i % cols, y = (i / cols) | 0;
      const nb = [x > 0 ? i - 1 : -1, x < cols - 1 ? i + 1 : -1, y > 0 ? i - cols : -1, y < rows - 1 ? i + cols : -1];
      for (const j of nb) if (j >= 0 && mask[j] && comp[j] < 0) { comp[j] = id; q[tail++] = j; }
    }
    if (size > bestSize) { bestSize = size; bestId = id; }
    id++;
  }
  const out = new Uint8Array(n);
  for (let i = 0; i < n; i++) out[i] = comp[i] === bestId ? 1 : 0;
  return { mask: out, size: bestSize };
}

function pointInPolygon(x, y, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i][0], yi = poly[i][1], xj = poly[j][0], yj = poly[j][1];
    if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
// Пятиконечная звезда с толстыми лучами (внутренний радиус 0.58)
const STAR_POLY = [];
for (let k = 0; k < 10; k++) {
  const r = k % 2 === 0 ? 1.08 : 0.58, a = Math.PI / 2 + k * Math.PI / 5;
  STAR_POLY.push([Math.cos(a) * r, Math.sin(a) * r]);
}

// Фигуры задаются функцией от нормированных координат X, Y ∈ [-1, 1] (Y вверх)
const SHAPES = {
  circle: (X, Y) => X * X + Y * Y <= 1.0,
  diamond: (X, Y) => Math.abs(X) + Math.abs(Y) <= 1.05,
  heart: (X, Y) => {
    const x = X * 1.22, y = Y * 1.18 + 0.12;
    const a = x * x + y * y - 1;
    return a * a * a - x * x * y * y * y <= 0;
  },
  star: (X, Y) => pointInPolygon(X, Y + 0.1, STAR_POLY),
  flower: (X, Y) => {
    const r = Math.sqrt(X * X + Y * Y), t = Math.atan2(Y, X);
    return r <= 0.55 + 0.45 * Math.abs(Math.cos(3 * t));
  },
  ring: (X, Y) => { const r = X * X + Y * Y; return r <= 1 && r >= 0.16; },
  cross: (X, Y) => Math.abs(X) <= 0.42 || Math.abs(Y) <= 0.42,
  house: (X, Y) => (Y <= 0.2 && Math.abs(X) <= 0.78) || (Y > 0.2 && Math.abs(X) <= 1.0 - (Y - 0.2) * 1.25)
};

function shapeMask(name, cols, rows) {
  const f = SHAPES[name];
  const mask = new Uint8Array(cols * rows);
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const X = ((x + 0.5) / cols) * 2 - 1;
      const Y = 1 - ((y + 0.5) / rows) * 2;
      mask[y * cols + x] = f && f(X, Y) ? 1 : 0;
    }
  }
  return largestComponent(mask, cols, rows).mask;
}

function shapeFill(name) {
  const S = 40, m = shapeMask(name, S, S);
  let c = 0;
  for (let i = 0; i < m.length; i++) c += m[i];
  return c / (S * S);
}

// Обрезаем пустые поля вокруг маски
function trimMask(mask, cols, rows) {
  let x0 = cols, y0 = rows, x1 = -1, y1 = -1;
  for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
    if (!mask[y * cols + x]) continue;
    if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
  }
  const w = x1 - x0 + 1, h = y1 - y0 + 1;
  const out = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) out[y * w + x] = mask[(y + y0) * cols + x + x0];
  return { mask: out, cols: w, rows: h };
}

// ---------- Метрики ----------
function metrics(g) {
  let dead = 0, junc = 0, cells = 0;
  for (let i = 0; i < g.n; i++) {
    if (!g.active(i)) continue;
    cells++;
    const d = g.degree(i);
    if (d === 1) dead++; else if (d >= 3) junc++;
  }
  return { cells, deadEnds: dead, junctions: junc };
}

function decisionsOnPath(g, path) {
  let n = 0;
  for (let k = 1; k < path.length - 1; k++) if (g.degree(path[k]) >= 3) n++;
  return n;
}

export { DIRS, OPP, Grid, generators, generate, braid, bfs, pathTo, farthest, SHAPES, shapeMask, shapeFill, largestComponent, trimMask, metrics, decisionsOnPath };

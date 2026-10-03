/*
 * Дизайнер уровней: одна кампания с плавной кривой сложности (без возрастов и режимов).
 * Размер растёт от 4×4, механики подключаются по одной (UNLOCKS). Каждый уровень проверяется
 * «жадным прохождением» — нерешаемые кандидаты отбрасываются. Чистая логика — без Phaser и DOM.
 */
import { makeRng, hashStr, clamp, lerp, invLerp } from './rng.js';
import * as M from './maze.js';
import { WORLDS, PORTAL_COLORS } from './worlds.js';

export const LEVELS_PER_WORLD = 10;
export const CAMPAIGN_LEVELS = 50;
export const HERO_SPEED = 6; // клеток в секунду

// Индекс уровня (с нуля), с которого появляется механика. На этом уровне игроку показывают карточку-знакомство.
export const UNLOCKS = {
  gates: 3,
  shapes: 9,
  portals: 12,
  enemies: 20,
  wander: 26,
  dark: 30,
  chaser: 38
};

const SHAPE_POOL = ['heart', 'star', 'circle', 'flower', 'diamond', 'house', 'cross', 'ring'];
const ALGOS = [
  ['backtracker'],
  ['backtracker', 'growingTree', 'huntAndKill'],
  ['growingTree', 'huntAndKill', 'wilson', 'prim'],
  ['wilson', 'prim', 'kruskal', 'growingTree']
];

export function worldFor(index) { return Math.floor(index / LEVELS_PER_WORLD) % WORLDS.length; }

// Кривая сложности 0…1: линейный рост с «передышкой» в начале мира и на уровне с новой механикой
export function difficulty(index) {
  if (index >= CAMPAIGN_LEVELS) return 1;
  let d = index / (CAMPAIGN_LEVELS - 1);
  if (index > 0 && index % LEVELS_PER_WORLD === 0) d -= 0.03;
  if (introFor(index)) d -= 0.04;
  return clamp(d, 0, 1);
}

// Какая механика впервые появляется на уровне (или null)
export function introFor(index) {
  if (index === 0) return 'move';
  for (const id in UNLOCKS) if (UNLOCKS[id] === index) return id;
  return null;
}

export function levelTitle(index) {
  const w = WORLDS[worldFor(index)];
  return w.names[index % w.names.length];
}

const edgeKey = (i, d) => i * 4 + d;

// ---------- Параметры уровня ----------
export function resolveParams(spec) {
  const idx = spec.index | 0;
  const endless = idx >= CAMPAIGN_LEVELS;
  const rng = makeRng('params|' + spec.seed);
  const d = endless ? clamp(0.85 + rng.next() * 0.15, 0, 1) : difficulty(idx);
  // Доля пути от появления механики до конца кампании: −1 — ещё не открыта
  const ramp = from => (idx < from ? -1 : endless ? 1 : invLerp(from, CAMPAIGN_LEVELS - 1, idx));

  // Ночь — каждый третий уровень; сторожа — через уровень, в последнем мире всегда. Ночью сторожа только под конец.
  const dark = idx >= UNLOCKS.dark && idx % 3 === 0;
  const eT = ramp(UNLOCKS.enemies);
  let nEnemies = 0;
  if (eT >= 0 && (idx % 2 === 0 || idx >= 40)) nEnemies = Math.round(lerp(1, 4, eT));
  if (dark) nEnemies = idx >= 45 ? Math.min(nEnemies, 2) : 0;

  const L = lerp(4, 15, Math.pow(d, 0.9));
  let area = L * L;
  if (dark) area *= 0.8;
  if (nEnemies > 0) area *= 1.05;

  let shape = null;
  if (idx >= UNLOCKS.shapes && idx % 5 === 4 && !dark) {
    shape = SHAPE_POOL[(hashStr(spec.seed) >>> 3) % SHAPE_POOL.length];
  }
  let cols, rows, mask = null;
  const aspect = clamp(spec.aspect || 1, 0.62, 1.65);
  if (shape) {
    const boxArea = area / M.shapeFill(shape);
    const c = Math.max(7, Math.round(Math.sqrt(boxArea * aspect)));
    const r = Math.max(7, Math.round(boxArea / c));
    const res = M.trimMask(M.shapeMask(shape, c, r), c, r);
    cols = res.cols; rows = res.rows; mask = res.mask;
  } else {
    cols = Math.max(3, Math.round(Math.sqrt(area * aspect)));
    rows = Math.max(3, Math.round(area / cols));
  }
  const cells = mask ? mask.reduce((a, b) => a + b, 0) : cols * rows;

  const gT = ramp(UNLOCKS.gates), pT = ramp(UNLOCKS.portals), dT = ramp(UNLOCKS.dark);
  let nGates = gT < 0 ? 0 : Math.round(lerp(1, 3.3, gT));
  nGates = Math.min(nGates, Math.floor(cells / 18)); // маленький лабиринт не вмещает много дверей
  const nPortals = pT < 0 ? 0 : Math.round(lerp(1, 2.2, pT));
  const tier = Math.min(ALGOS.length - 1, Math.floor(d * ALGOS.length));
  const pool = ALGOS[tier];

  return {
    index: idx, d, endless, cols, rows, mask, shape,
    algo: pool[(hashStr('algo|' + spec.seed) >>> 2) % pool.length],
    algoOpts: { newest: lerp(1, 0.35, d) },
    braid: clamp(lerp(0.45, 0.06, d) + (nEnemies > 0 ? 0.15 : 0), 0, 0.75),
    nItems: Math.round(lerp(1.3, 5.3, d)), nGates, nPortals, nEnemies,
    rules: { enemies: nEnemies > 0, dark },
    extras: { fireflies: dark ? 2 + Math.round(d * 2) : 0, hearts: nEnemies >= 3 ? 1 : 0 },
    easy: d < 0.15, offPath: lerp(-0.6, 1, d), decisionTarget: lerp(0.08, 0.5, d),
    enemySpeed: lerp(1.2, 2.6, Math.max(0, eT)),
    chaseRange: Math.round(lerp(5, 8, Math.max(0, eT))),
    // сон сторожей: [бодрствует от, до, спит] секунд
    sleep: [lerp(3.5, 6, Math.max(0, eT)), lerp(5.5, 9, Math.max(0, eT)), lerp(4, 2.4, Math.max(0, eT))],
    fog: lerp(2.3, 1.7, Math.max(0, dT)),
    stars: [lerp(2.4, 1.6, d), lerp(3.6, 2.4, d)],
    hintLen: d < 0.4 ? 99 : 12
  };
}

// ---------- Проектирование одного кандидата ----------
function designCandidate(p, rng) {
  const g = M.generate(p.algo, p.cols, p.rows, p.mask, rng, p.algoOpts);
  const act = g.activeList();
  if (act.length < 6) return null;

  // Старт и выход — концы «диаметра» лабиринта (самый длинный путь)
  const a = act[rng.int(act.length)];
  const b = M.farthest(M.bfs(g, a).dist);
  let start = b, exit = M.farthest(M.bfs(g, b).dist);
  if (rng.chance(0.5)) { const t = start; start = exit; exit = t; }
  const mainPath = M.pathTo(M.bfs(g, start).prev, start, exit);
  if (mainPath.length < 3) return null;

  // Двери — на рёбрах единственного пути идеального лабиринта (это мосты)
  const gates = [];
  let nGates = p.nGates;
  while (nGates > 0 && mainPath.length < 6 + nGates * 4) nGates--;
  for (let k = 1; k <= nGates; k++) {
    const span = mainPath.length / (nGates + 1);
    let pos = Math.round(span * k + (rng.next() - 0.5) * span * 0.5);
    pos = clamp(pos, 2, mainPath.length - 3);
    const prevPos = gates.length ? gates[gates.length - 1].pos : 0;
    if (pos - prevPos < 3) pos = prevPos + 3;
    if (pos > mainPath.length - 3) break;
    const ga = mainPath[pos], gb = mainPath[pos + 1];
    gates.push({ pos, a: ga, b: gb, dir: g.dirBetween(ga, gb), color: gates.length });
  }
  const gateEdges = new Map();
  gates.forEach((gt, k) => {
    gateEdges.set(edgeKey(gt.a, gt.dir), k);
    gateEdges.set(edgeKey(gt.b, M.OPP[gt.dir]), k);
  });

  // Регионы: области между дверями
  const region = new Int8Array(g.n).fill(-1);
  const blockAll = (i, d) => d >= 0 && gateEdges.has(edgeKey(i, d));
  [start].concat(gates.map(gt => gt.b)).forEach((s, r) => {
    const res = M.bfs(g, s, { blocked: blockAll });
    for (let i = 0; i < g.n; i++) if (res.dist[i] >= 0 && region[i] < 0) region[i] = r;
  });

  const used = new Set([start, exit]);

  // Порталы: пары тупиков в одном регионе, далеко друг от друга. Выбираются до петель и остаются тупиками —
  // портал в проходном коридоре перегородил бы его (наступил — улетел).
  const portals = [];
  for (let k = 0; k < p.nPortals; k++) {
    const ends = act.filter(c => !used.has(c) && g.degree(c) === 1);
    if (ends.length < 2) break;
    rng.shuffle(ends);
    let found = null;
    for (let t = 0; t < Math.min(ends.length, 12) && !found; t++) {
      const pa = ends[t];
      const da = M.bfs(g, pa, { blocked: blockAll }).dist;
      let bb = -1, bd = 0;
      for (const c of ends) if (c !== pa && region[c] === region[pa] && da[c] > bd) { bd = da[c]; bb = c; }
      if (bb >= 0 && bd >= Math.max(6, Math.sqrt(act.length) * 0.9)) found = [pa, bb];
    }
    if (!found) break;
    used.add(found[0]); used.add(found[1]);
    portals.push({ a: found[0], b: found[1], color: k % PORTAL_COLORS.length });
  }
  const links = new Map();
  portals.forEach(pt => { links.set(pt.a, [pt.b]); links.set(pt.b, [pt.a]); });

  // Петли — только внутри одного региона; выход и порталы остаются тупичками
  M.braid(g, p.braid, rng, (i, j) => region[i] === region[j] && i !== exit && j !== exit && !links.has(i) && !links.has(j));

  const pathDist = multiBfs(g, mainPath);

  // Ключи: ключ k — в регионе перед дверью k, лучше в тупике подальше от основного пути (на лёгких уровнях — рядом с ним)
  const keys = [];
  for (let k = 0; k < gates.length; k++) {
    let best = -1, bestScore = -1e9;
    for (let pass = 0; pass < 2 && best < 0; pass++) {
      for (const c of act) {
        if (used.has(c)) continue;
        const r = region[c];
        if (pass === 0 ? r !== k : r > k) continue;
        let s = pathDist[c] * 1.4 + (g.degree(c) === 1 ? 3 : 0) + rng.next() * 2;
        if (p.easy) s = -Math.abs(pathDist[c] - 1.5) + (g.degree(c) === 1 ? 1 : 0) + rng.next();
        if (s > bestScore) { bestScore = s; best = c; }
      }
    }
    if (best < 0) return null;
    used.add(best);
    keys.push({ cell: best, color: k });
  }

  // Предметы: равномерно по лабиринту (выборка дальних точек), с учётом тупиков и основного пути
  const items = [];
  const placeSpread = (count, kind) => {
    for (let n = 0; n < count; n++) {
      const dist = multiBfs(g, Array.from(used));
      let best = -1, bestScore = -1e9;
      for (const c of act) {
        if (used.has(c)) continue;
        const s = Math.min(dist[c], 12) + (g.degree(c) === 1 ? 2.2 : 0) + p.offPath * Math.min(pathDist[c], 6) + rng.next() * 2.5;
        if (s > bestScore) { bestScore = s; best = c; }
      }
      if (best < 0) return false;
      used.add(best);
      items.push({ cell: best, kind });
    }
    return true;
  };
  if (!placeSpread(p.nItems, 'item')) return null;

  // Бонусы: светлячки ночью, сердечко там, где много сторожей
  placeSpread(p.extras.fireflies, 'firefly');
  placeSpread(p.extras.hearts, 'heart');

  // Проверка решаемости и оптимальная длина маршрута (жадный обход)
  const tour = greedyTour(g, start, exit, items.filter(it => it.kind === 'item').map(it => it.cell), keys, gates, gateEdges, links);
  if (!tour.ok) return null;

  // Сторожа
  const enemies = [];
  if (p.nEnemies > 0) {
    const dStart = M.bfs(g, start, { links }).dist;
    const maxD = Math.max.apply(null, act.map(c => dStart[c]));
    const safe = Math.max(3, Math.min(6, Math.round(maxD * 0.22)));
    const taken = new Set();
    for (let k = 0; k < p.nEnemies; k++) {
      const ds = multiBfs(g, [start].concat(Array.from(taken)));
      let best = -1, bestScore = -1e9;
      for (const c of act) {
        if (dStart[c] < safe + 1 || c === exit || taken.has(c) || links.has(c) || used.has(c)) continue;
        const s = Math.min(ds[c], 10) + rng.next() * 3;
        if (s > bestScore) { bestScore = s; best = c; }
      }
      if (best < 0) break;
      taken.add(best);
      // На уровне-знакомстве первый сторож обязательно нового типа. Догоняющих мало: один, под конец кампании — два.
      let type = 'patrol';
      const lucky = rng.next();
      const chasers = enemies.filter(e => e.type === 'chaser').length;
      const canChase = p.index >= UNLOCKS.chaser && chasers < (p.index >= 45 ? 2 : 1);
      if (canChase && (lucky < 0.35 || (p.index === UNLOCKS.chaser && k === 0))) type = 'chaser';
      else if (p.index >= UNLOCKS.wander && (lucky < 0.6 || (p.index === UNLOCKS.wander && k === 0))) type = 'wander';
      const route = [best];
      if (type === 'patrol') {
        const len = rng.irange(3, 7);
        let cur = best;
        for (let s = 0; s < len; s++) {
          const opts = [];
          for (let dd = 0; dd < 4; dd++) {
            if (!g.isOpen(cur, dd) || gateEdges.has(edgeKey(cur, dd))) continue;
            const j = g.neighbor(cur, dd);
            if (j < 0 || route.indexOf(j) >= 0 || j === exit || dStart[j] < safe || links.has(j) || used.has(j)) continue;
            opts.push(j);
          }
          if (!opts.length) break;
          cur = opts[rng.int(opts.length)];
          route.push(cur);
        }
        if (route.length < 3) type = 'wander';
      }
      enemies.push({ type, cell: best, route, speed: p.enemySpeed * (type === 'chaser' ? 0.85 : 1) * rng.range(0.9, 1.1), safe });
    }
  }

  // Оценка «интересности»: покрытие маршрутом, доля развилок на пути, все ли заказанные двери и порталы поместились
  const sp = M.pathTo(M.bfs(g, start, { links }).prev, start, exit);
  const decisions = M.decisionsOnPath(g, sp);
  const decRatio = decisions / Math.max(1, sp.length);
  const score = Math.min(tour.steps / act.length, 2.6) - Math.abs(decRatio - p.decisionTarget) * 2.5 +
    gates.length * 0.8 + portals.length * 0.6 + rng.next() * 0.15;

  return {
    grid: g, start, exit, items, keys,
    gates: gates.map(gt => ({ a: gt.a, b: gt.b, dir: gt.dir, color: gt.color })),
    portals, enemies, optimalSteps: tour.steps, score,
    meta: Object.assign(M.metrics(g), { decisions, pathLen: sp.length })
  };
}

export function multiBfs(g, sources) {
  const dist = new Int32Array(g.n).fill(1e6);
  const q = new Int32Array(g.n);
  let head = 0, tail = 0;
  for (const s of sources) { if (dist[s] !== 0) { dist[s] = 0; q[tail++] = s; } }
  while (head < tail) {
    const i = q[head++];
    for (let d = 0; d < 4; d++) {
      if (!g.isOpen(i, d)) continue;
      const j = g.neighbor(i, d);
      if (j >= 0 && dist[j] > dist[i] + 1) { dist[j] = dist[i] + 1; q[tail++] = j; }
    }
  }
  return dist;
}

// Жадный обход: собрать все предметы и ключи, затем дойти до выхода. Заодно — проверка решаемости.
function greedyTour(g, start, exit, itemCells, keys, gates, gateEdges, links) {
  const haveKey = new Array(gates.length).fill(false);
  const remaining = new Set(itemCells);
  const keyAt = new Map();
  keys.forEach(k => { keyAt.set(k.cell, k.color); remaining.add(k.cell); });
  let pos = start, steps = 0, guard = 0;
  const blocked = (i, d, j) => {
    if (j === exit && remaining.size > 0) return true;
    if (d < 0) return false;
    const k = gateEdges.get(edgeKey(i, d));
    return k != null && !haveKey[k];
  };
  while (remaining.size && guard++ < 64) {
    const { dist } = M.bfs(g, pos, { blocked, links });
    let best = -1, bd = 1e9;
    remaining.forEach(c => { if (dist[c] >= 0 && dist[c] < bd) { bd = dist[c]; best = c; } });
    if (best < 0) return { ok: false };
    steps += bd; pos = best; remaining.delete(best);
    if (keyAt.has(best)) haveKey[keyAt.get(best)] = true;
  }
  const { dist } = M.bfs(g, pos, { blocked, links });
  if (dist[exit] < 0) return { ok: false };
  return { ok: true, steps: steps + dist[exit] };
}

// ---------- Сборка уровня ----------
export function buildLevel(spec) {
  const p = resolveParams(spec);
  const rng = makeRng('level|' + spec.seed);
  const K = p.cols * p.rows <= 64 ? 8 : 6;
  let best = null;
  for (let k = 0; k < K; k++) {
    const c = designCandidate(p, makeRng('cand|' + spec.seed + '|' + k + '|' + rng.int(1e9)));
    if (c && (!best || c.score > best.score)) best = c;
  }
  // Страховка: упрощаем параметры, пока не получится решаемый уровень
  let tries = 0;
  while (!best && tries < 20) {
    tries++;
    p.nGates = Math.max(0, p.nGates - 1);
    p.nPortals = 0;
    if (tries > 4) { p.mask = null; p.shape = null; }
    best = designCandidate(p, makeRng('fallback|' + spec.seed + '|' + tries));
  }
  if (!best) throw new Error('Не удалось построить уровень');

  const worldIndex = worldFor(p.index);
  return {
    seed: spec.seed, index: p.index, endless: p.endless, d: p.d,
    world: WORLDS[worldIndex], worldIndex, grid: best.grid, cols: p.cols, rows: p.rows,
    start: best.start, exit: best.exit,
    items: best.items.map(it => ({ cell: it.cell, kind: it.kind, taken: false })),
    keys: best.keys.map(k => ({ cell: k.cell, color: k.color, taken: false })),
    gates: best.gates.map(gt => Object.assign({ open: false }, gt)),
    portals: best.portals, enemies: best.enemies,
    required: best.items.filter(it => it.kind === 'item').length,
    optimalSteps: best.optimalSteps,
    rules: p.rules, fog: p.fog, hearts: p.rules.enemies ? 3 : 0, hints: 3, hintLen: p.hintLen,
    speed: HERO_SPEED, chaseRange: p.chaseRange, sleep: p.sleep, stars: p.stars,
    title: levelTitle(p.index), intro: p.endless ? null : introFor(p.index),
    shape: p.shape, algo: p.algo, meta: best.meta
  };
}

// aspect — пропорции игрового поля (ширина / высота): лабиринт вытягивается под экран
export function levelSpec(index, aspect) {
  return { index, aspect, seed: 'v2|' + index };
}

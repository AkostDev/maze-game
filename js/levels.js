/*
 * Дизайнер уровней: миры, возрастные группы, кривая сложности, расстановка
 * предметов, ключей и дверей, порталов и врагов. Каждый уровень проверяется
 * «жадным прохождением» — нерешаемые кандидаты отбрасываются.
 */
(function (root) {
  'use strict';
  const MZ = root.MZ = root.MZ || {};
  const { makeRng, hashStr, clamp, lerp, invLerp } = MZ.util;
  const M = MZ.maze;

  const LEVELS_PER_WORLD = 8;
  const CAMPAIGN_LEVELS = 40;

  const WORLDS = [
    {
      id: 'forest', name: 'Лесная полянка', short: 'Лес',
      bg: ['#A6DDA0', '#6FC07A'], floor: ['#EEF9DF', '#E3F3CD'], wall: '#2F8A4C', wallHi: '#5DBB72',
      shadow: 'rgba(24,74,38,0.32)', deco: ['#9BD48A', '#F7A8C8', '#FFE08A'],
      item: 'apple', itemGender: 'n', itemName: ['яблочко', 'яблочка', 'яблочек'],
      enemy: 'bee', enemyName: 'пчёлки',
      names: ['Солнечная опушка', 'Грибная тропка', 'Беличье дупло', 'Земляничная поляна', 'Шишкин двор', 'Дубовая аллея', 'Совиная роща', 'Тайный ручеёк', 'Моховая кочка', 'Ежевичный куст']
    },
    {
      id: 'sea', name: 'Морское дно', short: 'Море',
      bg: ['#86D6F2', '#3FA9DD'], floor: ['#FFF3D4', '#FAE6BA'], wall: '#1976C0', wallHi: '#4DAAE8',
      shadow: 'rgba(8,48,92,0.32)', deco: ['#FF9E80', '#80DEEA', '#FFD180'],
      item: 'shell', itemGender: 'f', itemName: ['ракушка', 'ракушки', 'ракушек'],
      enemy: 'crab', enemyName: 'крабики',
      names: ['Коралловый садик', 'Ракушечный берег', 'Жемчужная бухта', 'Дом осьминожки', 'Водорослевый лес', 'Пузырьковая тропа', 'Тайна кита', 'Затонувший сундук', 'Морская звезда', 'Песчаная отмель']
    },
    {
      id: 'candy', name: 'Конфетная страна', short: 'Сладости',
      bg: ['#FFC9DF', '#FF93BE'], floor: ['#FFF6FA', '#FFEAF3'], wall: '#D93D76', wallHi: '#FF77A6',
      shadow: 'rgba(120,20,62,0.28)', deco: ['#A0E7E5', '#FFD166', '#C3AED6'],
      item: 'candy', itemGender: 'f', itemName: ['конфетка', 'конфетки', 'конфеток'],
      enemy: 'jelly', enemyName: 'мармеладки',
      names: ['Леденцовая улица', 'Шоколадный мост', 'Зефирное облако', 'Мармеладный сад', 'Пряничный домик', 'Карамельный замок', 'Вафельная башня', 'Сахарная горка', 'Ирисковый пруд', 'Пастильный парк']
    },
    {
      id: 'snow', name: 'Снежное королевство', short: 'Зима',
      bg: ['#D4EAFF', '#9FC8F2'], floor: ['#FFFFFF', '#EEF5FF'], wall: '#4F7FE0', wallHi: '#94B8FF',
      shadow: 'rgba(28,56,120,0.28)', deco: ['#CFE3FF', '#B8F2E6', '#E7D9FF'],
      item: 'snowflake', itemGender: 'f', itemName: ['снежинка', 'снежинки', 'снежинок'],
      enemy: 'snowball', enemyName: 'снежки',
      names: ['Снежная горка', 'Ледяная пещера', 'Дом снеговика', 'Морозный узор', 'Сосульковый зал', 'Пингвинья бухта', 'Северное сияние', 'Хрустальный дворец', 'Метелица', 'Звонкий каток']
    },
    {
      id: 'space', name: 'Звёздный космос', short: 'Космос',
      bg: ['#2B2466', '#0E1233'], floor: ['#2D3372', '#282D66'], wall: '#8C7DFF', wallHi: '#C8BEFF',
      shadow: 'rgba(0,0,0,0.5)', deco: ['#FFFFFF', '#FFD166', '#7DF9FF'],
      item: 'crystal', itemGender: 'm', itemName: ['кристалл', 'кристалла', 'кристаллов'],
      enemy: 'ufo', enemyName: 'НЛО',
      names: ['Лунная база', 'Кольца Сатурна', 'Звёздная пыль', 'Метеоритный пояс', 'Марсианский каньон', 'Орбита', 'Туманность Лиса', 'Галактика Клубок', 'Комета', 'Млечный путь']
    }
  ];

  // Возрастные группы и диапазоны сложности [начало кампании, конец кампании]
  const AGES = {
    tiny: {
      id: 'tiny', label: '3–5 лет', title: 'Малыш', blurb: 'Крупные клетки, без проигрышей, голосовые подсказки',
      size: [4, 8], items: [1, 3], gates: [0, 1], gateFrom: 10, portalFrom: 99, portals: [0, 0],
      braid: [0.55, 0.3], algos: ['backtracker'], newest: 1, speed: 4.2,
      enemies: [1, 2], enemySpeed: [0.9, 1.3], wanderFrom: 99, chaserFrom: 99, chaseRange: 0, hearts: 0,
      timeFactor: [3.4, 2.6], fog: [2.0, 1.7], hints: 99, offPath: -0.6, shapeFrom: 5, minCellPx: 46,
      decisionTarget: 0.08, stars: null, sleep: [3, 5, 4.2]
    },
    kid: {
      id: 'kid', label: '6–8 лет', title: 'Следопыт', blurb: 'Ключи и дверцы, первые сторожа',
      size: [6, 13], items: [2, 4], gates: [0, 2], gateFrom: 3, portalFrom: 16, portals: [1, 2],
      braid: [0.3, 0.12], algos: ['backtracker', 'growingTree', 'huntAndKill'], newest: 0.85, speed: 5.2,
      enemies: [1, 4], enemySpeed: [1.3, 2.0], wanderFrom: 12, chaserFrom: 99, chaseRange: 0, hearts: 3,
      timeFactor: [2.6, 1.9], fog: [1.7, 1.45], hints: 3, offPath: 0.3, shapeFrom: 3, minCellPx: 36,
      decisionTarget: 0.22, stars: [2.0, 3.2], sleep: [4, 6, 3.2]
    },
    teen: {
      id: 'teen', label: '9–12 лет', title: 'Искатель', blurb: 'Порталы, хитрые сторожа, больше развилок',
      size: [9, 18], items: [2, 5], gates: [1, 3], gateFrom: 0, portalFrom: 5, portals: [1, 2],
      braid: [0.15, 0.05], algos: ['growingTree', 'huntAndKill', 'wilson', 'prim'], newest: 0.6, speed: 6.2,
      enemies: [2, 6], enemySpeed: [1.8, 2.6], wanderFrom: 3, chaserFrom: 14, chaseRange: 6, hearts: 3,
      timeFactor: [2.1, 1.55], fog: [1.5, 1.3], hints: 2, offPath: 0.7, shapeFrom: 2, minCellPx: 30,
      decisionTarget: 0.38, stars: [1.7, 2.6], sleep: [5, 7.5, 2.7]
    },
    pro: {
      id: 'pro', label: '13+ и взрослые', title: 'Мастер', blurb: 'Подростки и взрослые: большие лабиринты, погоня, минимум подсказок',
      size: [12, 26], items: [3, 7], gates: [1, 4], gateFrom: 0, portalFrom: 3, portals: [1, 3],
      braid: [0.08, 0.0], algos: ['wilson', 'prim', 'kruskal', 'growingTree'], newest: 0.35, speed: 7.2,
      enemies: [3, 9], enemySpeed: [2.2, 3.3], wanderFrom: 0, chaserFrom: 6, chaseRange: 9, hearts: 3,
      timeFactor: [1.75, 1.3], fog: [1.35, 1.15], hints: 1, offPath: 1.0, shapeFrom: 2, minCellPx: 26,
      decisionTarget: 0.55, stars: [1.45, 2.2], sleep: [6, 9, 2.3]
    }
  };
  const AGE_ORDER = ['tiny', 'kid', 'teen', 'pro'];

  const MODES = {
    classic: { id: 'classic', name: 'Прогулка', desc: 'Собери всё и открой домик', icon: 'path', color: 'teal' },
    time: { id: 'time', name: 'На время', desc: 'Успей, пока тикают часики', icon: 'clock', color: 'sun' },
    enemies: { id: 'enemies', name: 'Сторожа', desc: 'Не попадись сторожам', icon: 'bug', color: 'accent' },
    dark: { id: 'dark', name: 'Ночной', desc: 'Свети фонариком в темноте', icon: 'moon', color: 'night' },
    story: { id: 'story', name: 'Сказка', desc: 'ИИ-сказочник сочинит уровень', icon: 'sparkle', color: 'grape' },
    daily: { id: 'daily', name: 'Лабиринт дня', desc: 'Один на всех, каждый день новый', icon: 'calendar', color: 'sky' }
  };
  const CAMPAIGN_MODES = ['classic', 'time', 'enemies', 'dark'];

  const KEY_COLORS = [
    { id: 'red', name: 'красный', color: '#FF4B4B', dark: '#B82626', symbol: 'circle' },
    { id: 'blue', name: 'синий', color: '#3B82F6', dark: '#1D4FB8', symbol: 'square' },
    { id: 'green', name: 'зелёный', color: '#22B35E', dark: '#137A3D', symbol: 'triangle' },
    { id: 'yellow', name: 'жёлтый', color: '#FFBF1A', dark: '#B07F00', symbol: 'diamond' }
  ];
  const PORTAL_COLORS = ['#A15CFF', '#00B8D9', '#FF7A1A'];
  const SHAPE_POOL = ['heart', 'star', 'circle', 'flower', 'diamond', 'house', 'cross', 'ring'];

  function worldFor(index) { return Math.floor(index / LEVELS_PER_WORLD) % WORLDS.length; }

  // Кривая сложности: плавный рост с «передышкой» в начале каждого мира
  function difficulty(index) {
    if (index >= CAMPAIGN_LEVELS) return 1;
    const inWorld = index % LEVELS_PER_WORLD;
    let d = index / (CAMPAIGN_LEVELS - 1);
    if (inWorld === 0 && index > 0) d -= 0.035;
    return clamp(d, 0, 1);
  }

  function localTitle(index) {
    const w = WORLDS[worldFor(index)];
    if (index >= CAMPAIGN_LEVELS) return w.names[index % w.names.length] + ' ✦';
    return w.names[index % LEVELS_PER_WORLD];
  }

  const edgeKey = (i, d) => i * 4 + d;

  // ---------- Параметры уровня ----------
  function resolveParams(spec) {
    const age = AGES[spec.age] || AGES.kid;
    const mode = spec.mode;
    const idx = spec.index || 0;
    const ov = spec.override || {};
    const rng = makeRng('params|' + spec.seed);
    let d = ov.sizeT != null ? clamp(ov.sizeT, 0, 1) : difficulty(idx);
    const endless = idx >= CAMPAIGN_LEVELS && mode !== 'story' && mode !== 'daily';
    if (endless) d = clamp(0.85 + rng.next() * 0.15, 0, 1);

    const L = lerp(age.size[0], age.size[1], d);
    let area = L * L;
    if (mode === 'dark') area *= 0.8;
    if (mode === 'time') area *= 0.92;
    if (ov.enemies > 0 || mode === 'enemies') area *= 1.05;

    // Фигура
    let shape = ov.shape || null;
    if (!shape && !ov.ascii && mode !== 'daily' && idx >= age.shapeFrom && L >= 7 && idx % 4 === 3) {
      shape = SHAPE_POOL[(hashStr(spec.seed) >>> 3) % SHAPE_POOL.length];
    }
    if (mode === 'daily') shape = SHAPE_POOL[(hashStr(spec.seed) >>> 5) % SHAPE_POOL.length];

    let cols, rows, mask = null;
    const aspect = spec.fixedAspect ? 1 : clamp(spec.aspect || 1, 0.62, 1.65);
    if (ov.ascii) {
      const artArea = ov.ascii.length * Math.max.apply(null, ov.ascii.map(s => String(s).length));
      const scale = clamp(Math.round(Math.sqrt(area * 1.6 / Math.max(1, artArea))), 1, 3);
      const res = M.asciiMask(ov.ascii, scale);
      if (res) { cols = res.cols; rows = res.rows; mask = res.mask; shape = 'custom'; }
    }
    if (!mask && shape && shape !== 'custom' && M.SHAPES[shape]) {
      const fill = M.shapeFill(shape);
      const boxArea = area / fill;
      const c = Math.max(7, Math.round(Math.sqrt(boxArea * aspect)));
      const r = Math.max(7, Math.round(boxArea / c));
      const res = M.trimMask(M.shapeMask(shape, c, r), c, r);
      cols = res.cols; rows = res.rows; mask = res.mask;
    }
    if (!mask) {
      shape = null;
      cols = Math.max(3, Math.round(Math.sqrt(area * aspect)));
      rows = Math.max(3, Math.round(area / cols));
    }

    const ramp = (from, range) => idx < from ? -1 : (endless ? 1 : invLerp(from, CAMPAIGN_LEVELS - 1, idx));
    const gT = ramp(age.gateFrom);
    const pT = ramp(age.portalFrom);
    let nGates = gT < 0 ? 0 : Math.round(lerp(Math.max(age.gates[0], 1), age.gates[1], gT));
    if (age.id === 'tiny' && gT >= 0) nGates = 1;
    let nPortals = pT < 0 ? 0 : Math.round(lerp(age.portals[0], age.portals[1], pT));
    let nItems = Math.round(lerp(age.items[0], age.items[1], d));

    const rules = { timer: false, enemies: false, dark: false, countUp: false };
    if (mode === 'time') rules.timer = true;
    if (mode === 'enemies') rules.enemies = true;
    if (mode === 'dark') rules.dark = true;
    if (mode === 'daily') rules.countUp = true;

    let nEnemies = 0;
    if (mode === 'enemies') nEnemies = Math.round(lerp(age.enemies[0], age.enemies[1], d));

    let braid = lerp(age.braid[0], age.braid[1], d);
    if (mode === 'enemies') braid += 0.12;

    // Переопределения из сказки (ИИ или локальной)
    if (ov.items != null) nItems = clamp(ov.items | 0, 1, age.items[1] + 1);
    if (ov.keys != null) nGates = clamp(ov.keys | 0, 0, age.gates[1]);
    if (ov.portals != null) nPortals = clamp(ov.portals | 0, 0, Math.max(age.portals[1], age.id === 'tiny' ? 0 : 1));
    if (ov.enemies != null) {
      nEnemies = clamp(ov.enemies | 0, 0, age.enemies[1]);
      rules.enemies = nEnemies > 0;
      if (rules.enemies) braid += 0.1;
    }
    if (ov.dark != null) rules.dark = !!ov.dark;
    if (ov.timer != null) rules.timer = !!ov.timer;
    if (ov.loops != null) braid = clamp(age.braid[1] + (age.braid[0] - age.braid[1]) * ov.loops + 0.05, 0, 0.7);

    const algo = age.algos[(hashStr('algo|' + spec.seed) >>> 2) % age.algos.length];
    const cells = mask ? mask.reduce((a, b) => a + b, 0) : cols * rows;
    // Слишком маленькие лабиринты не вмещают много дверей
    nGates = Math.min(nGates, Math.floor(cells / 18));

    return {
      age, mode, index: idx, d, cols, rows, mask, shape, algo,
      algoOpts: { newest: age.newest }, braid: clamp(braid, 0, 0.75),
      nItems, nGates, nPortals, nEnemies, rules,
      enemySpeed: lerp(age.enemySpeed[0], age.enemySpeed[1], d),
      fog: lerp(age.fog[0], age.fog[1], d),
      timeFactor: lerp(age.timeFactor[0], age.timeFactor[1], d),
      extras: {
        clocks: rules.timer ? 1 + Math.round(d * 2) : 0,
        fireflies: rules.dark ? 2 + Math.round(d * 2) : 0,
        hearts: rules.enemies && age.hearts > 0 && nEnemies >= 3 ? 1 : 0
      },
      endless
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
    const fromB = M.bfs(g, b);
    let start = b, exit = M.farthest(fromB.dist);
    if (rng.chance(0.5)) { const t = start; start = exit; exit = t; }
    const base = M.bfs(g, start);
    const mainPath = M.pathTo(base.prev, start, exit);
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
    const seeds = [start].concat(gates.map(gt => gt.b));
    seeds.forEach((s, r) => {
      const res = M.bfs(g, s, { blocked: blockAll });
      for (let i = 0; i < g.n; i++) if (res.dist[i] >= 0 && region[i] < 0) region[i] = r;
    });

    // Петли — только внутри одного региона, выход остаётся тупичком
    M.braid(g, p.braid, rng, (i, j) => region[i] === region[j] && i !== exit && j !== exit);

    const used = new Set([start, exit]);
    const onPath = new Uint8Array(g.n);
    mainPath.forEach(c => { onPath[c] = 1; });
    // Расстояние от основного пути (мультиисточниковый BFS)
    const pathDist = multiBfs(g, mainPath);

    // Ключи: ключ k — в регионе перед дверью k, лучше в тупике подальше от основного пути
    const keys = [];
    for (let k = 0; k < gates.length; k++) {
      let best = -1, bestScore = -1e9;
      for (let pass = 0; pass < 2 && best < 0; pass++) {
        for (const c of act) {
          if (used.has(c)) continue;
          const r = region[c];
          if (pass === 0 ? r !== k : r > k) continue;
          let s = pathDist[c] * 1.4 + (g.degree(c) === 1 ? 3 : 0) + rng.next() * 2;
          if (p.age.id === 'tiny') s = -Math.abs(pathDist[c] - 1.5) + (g.degree(c) === 1 ? 1 : 0) + rng.next();
          if (s > bestScore) { bestScore = s; best = c; }
        }
      }
      if (best < 0) return null;
      used.add(best);
      keys.push({ cell: best, color: k });
    }

    // Предметы: равномерно по лабиринту (выборка дальних точек), с учётом тупиков и основного пути
    const items = [];
    const placeSpread = (count, kind, allowRegion) => {
      for (let n = 0; n < count; n++) {
        const dist = multiBfs(g, Array.from(used));
        let best = -1, bestScore = -1e9;
        for (const c of act) {
          if (used.has(c) || (allowRegion && !allowRegion(c))) continue;
          const s = Math.min(dist[c], 12) + (g.degree(c) === 1 ? 2.2 : 0) + p.age.offPath * Math.min(pathDist[c], 6) + rng.next() * 2.5;
          if (s > bestScore) { bestScore = s; best = c; }
        }
        if (best < 0) return false;
        used.add(best);
        items.push({ cell: best, kind });
      }
      return true;
    };
    if (!placeSpread(p.nItems, 'item')) return null;

    // Порталы: пары тупиков в одном регионе, далеко друг от друга
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

    // Бонусы режимов
    placeSpread(p.extras.clocks, 'clock');
    placeSpread(p.extras.fireflies, 'firefly');
    placeSpread(p.extras.hearts, 'heart');

    // Проверка решаемости и оптимальная длина маршрута (жадный обход)
    const tour = greedyTour(g, start, exit, items.filter(it => it.kind === 'item').map(it => it.cell), keys, gates, gateEdges, links);
    if (!tour.ok) return null;

    // Враги
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
        let type = 'patrol';
        if (p.index >= p.age.chaserFrom && rng.chance(0.35)) type = 'chaser';
        else if (p.index >= p.age.wanderFrom && rng.chance(0.4)) type = 'wander';
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
        enemies.push({
          type, cell: best, route,
          speed: p.enemySpeed * (type === 'chaser' ? 0.85 : 1) * rng.range(0.9, 1.1),
          safe
        });
      }
    }

    // Оценка «интересности»
    const cellsCount = act.length;
    const coverage = tour.steps / cellsCount;
    const solved = M.bfs(g, start, { links }).prev;
    const sp = M.pathTo(solved, start, exit);
    const decRatio = M.decisionsOnPath(g, sp) / Math.max(1, sp.length);
    const met = M.metrics(g);
    const score = Math.min(coverage, 2.6) - Math.abs(decRatio - p.age.decisionTarget) * 2.5 + rng.next() * 0.15;

    return {
      grid: g, start, exit, mainPath, region, items, keys,
      gates: gates.map(gt => ({ a: gt.a, b: gt.b, dir: gt.dir, color: gt.color })),
      portals, enemies, optimalSteps: tour.steps, score,
      meta: Object.assign(met, { decisions: M.decisionsOnPath(g, sp), pathLen: sp.length })
    };
  }

  function multiBfs(g, sources) {
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
    steps += dist[exit];
    return { ok: true, steps };
  }

  // ---------- Сборка уровня ----------
  function buildLevel(spec) {
    const p = resolveParams(spec);
    const rng = makeRng('level|' + spec.seed);
    const K = p.age.id === 'tiny' ? 8 : (p.cols * p.rows > 500 ? 4 : 6);
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

    const worldIndex = spec.override && spec.override.world != null ? spec.override.world : worldFor(p.index);
    const world = WORLDS[worldIndex] || WORLDS[0];
    const age = p.age;
    const timeLimit = Math.ceil(best.optimalSteps / age.speed * p.timeFactor + 6);

    return {
      seed: spec.seed, age: age.id, mode: spec.mode, index: p.index, endless: p.endless,
      world, worldIndex, grid: best.grid, cols: p.cols, rows: p.rows,
      start: best.start, exit: best.exit,
      items: best.items.map(it => ({ cell: it.cell, kind: it.kind, taken: false })),
      keys: best.keys.map(k => ({ cell: k.cell, color: k.color, taken: false })),
      gates: best.gates.map(gt => Object.assign({ open: false, openT: 0 }, gt)),
      portals: best.portals,
      enemies: best.enemies,
      required: best.items.filter(it => it.kind === 'item').length,
      optimalSteps: best.optimalSteps,
      timeLimit, fog: p.fog, rules: p.rules,
      hearts: age.hearts, speed: age.speed, chaseRange: age.chaseRange,
      title: spec.title || (spec.mode === 'daily' ? 'Лабиринт дня' : localTitle(p.index)),
      shape: p.shape, algo: p.algo, meta: best.meta, story: spec.story || null
    };
  }

  function campaignSpec(ageId, mode, index, aspect) {
    return { age: ageId, mode, index, aspect, seed: ['v1', ageId, mode, index].join('|') };
  }

  function dailySpec(ageId, dateKey) {
    const idx = { tiny: 14, kid: 22, teen: 26, pro: 32 }[ageId] || 20;
    return { age: ageId, mode: 'daily', index: idx, fixedAspect: true, seed: ['daily', dateKey, ageId].join('|'), title: 'Лабиринт дня' };
  }

  MZ.levels = {
    WORLDS, AGES, AGE_ORDER, MODES, CAMPAIGN_MODES, KEY_COLORS, PORTAL_COLORS,
    LEVELS_PER_WORLD, CAMPAIGN_LEVELS,
    worldFor, difficulty, localTitle, resolveParams, buildLevel, campaignSpec, dailySpec, multiBfs, edgeKey
  };
})(typeof window !== 'undefined' ? window : globalThis);

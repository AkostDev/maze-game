/*
 * ИИ-помощник (vibecode.moe, OpenAI-совместимый /v1/chat/completions).
 * Принцип: игра НИКОГДА не ждёт ИИ. Всё готовится заранее в фоне и кэшируется;
 * если ИИ медленный или недоступен — мгновенно используются локальные тексты и генерация.
 */
(function (root) {
  'use strict';
  const MZ = root.MZ = root.MZ || {};
  const { store } = MZ.util;
  const CACHE_KEY = 'klubok.ai.v1';
  const WORLD_IDS = ['forest', 'sea', 'candy', 'snow', 'space'];
  const SHAPES = ['none', 'heart', 'star', 'circle', 'flower', 'diamond', 'house', 'cross', 'ring', 'custom'];

  const SYSTEM = 'Ты — добрый сказочник и геймдизайнер детской игры-лабиринта «Волшебный клубок». ' +
    'Пиши по-русски, коротко, тепло и безопасно для детей: без страшилок, насилия, брендов, ссылок и эмодзи. ' +
    'Отвечай ТОЛЬКО валидным JSON-объектом, без пояснений и без markdown.';

  const AGE_GUIDE = {
    tiny: 'игроку 3–5 лет: очень простые слова; size 0–0.4, keys 0–1, enemies 0–1, portals 0, dark false, loops 0.6–1',
    kid: 'игроку 6–8 лет: просто и весело; size 0.3–0.7, keys 0–2, enemies 0–2, portals 0–1, dark иногда, loops 0.3–0.7',
    teen: 'игроку 9–12 лет: с интригой; size 0.5–0.9, keys 1–3, enemies 0–4, portals 0–2, loops 0.1–0.5',
    pro: 'подростку или взрослому: остроумно; size 0.7–1, keys 2–4, enemies 2–6, portals 1–3, loops 0–0.3'
  };

  const AI = {
    status: 'idle', // idle | working | ok | offline | off
    lastError: '',
    failures: 0,
    pausedUntil: 0,
    chain: Promise.resolve(),
    pending: new Set(),
    listeners: [],
    cache: null,

    cfg() { return (MZ.config && MZ.config.ai) || {}; },

    loadCache() {
      this.cache = store.get(CACHE_KEY, null) || {};
      this.cache.stories = this.cache.stories || {};
      this.cache.names = this.cache.names || {};
      this.cache.phrases = this.cache.phrases || {};
      this.cache.stats = this.cache.stats || { ok: 0, fail: 0, avgMs: 0 };
    },
    saveCache() { store.set(CACHE_KEY, this.cache); },

    onChange(fn) { this.listeners.push(fn); },
    setStatus(s, err) {
      this.status = s;
      if (err != null) this.lastError = err;
      this.listeners.forEach(fn => { try { fn(s); } catch (e) { /* ignore */ } });
    },

    userEnabled() {
      const st = MZ.progress && MZ.progress.state ? MZ.progress.settings : null;
      return !(st && st.ai === false);
    },
    available() {
      const c = this.cfg();
      if (!c.enabled || !c.endpoint || !this.userEnabled()) return false;
      if (typeof fetch !== 'function') return false;
      if (root.navigator && root.navigator.onLine === false) return false;
      return Date.now() >= this.pausedUntil;
    },

    // Один запрос с перебором моделей. Возвращает объект JSON или null. Никогда не бросает исключений.
    async request(userPrompt, opts) {
      opts = opts || {};
      const c = this.cfg();
      const models = [c.model].concat(c.fallbackModels || []).filter(Boolean);
      const t0 = Date.now();
      for (const model of models) {
        if (!this.available()) return null;
        const ctrl = typeof AbortController === 'function' ? new AbortController() : null;
        const timer = setTimeout(() => ctrl && ctrl.abort(), opts.timeout || c.timeoutMs || 45000);
        try {
          const headers = { 'Content-Type': 'application/json' };
          if (c.apiKey) headers.Authorization = 'Bearer ' + c.apiKey;
          const res = await fetch(c.endpoint, {
            method: 'POST', headers, signal: ctrl ? ctrl.signal : undefined,
            body: JSON.stringify({
              model,
              messages: [{ role: 'system', content: SYSTEM }, { role: 'user', content: userPrompt }],
              temperature: opts.temperature != null ? opts.temperature : 0.9
            })
          });
          clearTimeout(timer);
          if (!res.ok) { this.lastError = model + ': HTTP ' + res.status; continue; }
          const data = await res.json();
          const text = data && data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
          const obj = parseJson(text);
          if (!obj) { this.lastError = model + ': не JSON'; continue; }
          this.failures = 0;
          const st = this.cache.stats;
          st.ok++; st.avgMs = Math.round(st.avgMs ? st.avgMs * 0.7 + (Date.now() - t0) * 0.3 : Date.now() - t0);
          st.model = model;
          this.saveCache();
          return obj;
        } catch (e) {
          clearTimeout(timer);
          this.lastError = model + ': ' + (e && e.name === 'AbortError' ? 'таймаут' : 'нет связи');
        }
      }
      this.failures++;
      this.cache.stats.fail++;
      if (this.failures >= (c.maxFailures || 2)) {
        this.pausedUntil = Date.now() + (c.cooldownMs || 300000);
        this.failures = 0;
      }
      return null;
    },

    // Последовательная очередь фоновых задач с дедупликацией
    task(key, fn) {
      if (this.pending.has(key) || !this.available()) return Promise.resolve(null);
      this.pending.add(key);
      const run = async () => {
        if (!this.available()) return null;
        this.setStatus('working');
        let out = null;
        try { out = await fn(); } catch (e) { out = null; }
        this.setStatus(out ? 'ok' : (this.available() ? 'idle' : 'offline'));
        return out;
      };
      const p = this.chain.then(run, run).finally(() => this.pending.delete(key));
      this.chain = p.catch(() => null);
      return p;
    },

    // ---------- Сказки ----------
    storyPrompt(age, heroName, theme) {
      const A = MZ.levels.AGES[age];
      const worldHint = theme && theme !== 'any' ? 'Мир: ' + theme + '.' : 'Мир выбери сам.';
      return 'Сочини мини-сказку-уровень для лабиринта. Герой: ' + heroName + '. ' + worldHint + '\n' +
        'Сложность — ' + AGE_GUIDE[age] + '.\n' +
        'Верни JSON: {"title":"до 40 символов","intro":"1–2 коротких предложения, без прошедшего времени у героя",' +
        '"goal":"что сделать, до 60 символов","outro":"радостная концовка, 1 предложение",' +
        '"world":"forest|sea|candy|snow|space","item":"что собираем — строго по миру: forest→яблочки, sea→ракушки, candy→конфетки, snow→снежинки, space→кристаллы; goal упоминает именно их",' +
        '"shape":"' + SHAPES.join('|') + '",' +
        '"art":["если shape=custom — 8–12 строк одинаковой длины 8–12 символов из # и точек: заполненный связный силуэт по теме; иначе пустой массив"],' +
        '"size":0.5,"keys":0,"enemies":0,"portals":0,"dark":false,"loops":0.5}' +
        ' Ограничения: keys ≤ ' + A.gates[1] + ', enemies ≤ ' + A.enemies[1] + ', portals ≤ ' + A.portals[1] + '.';
    },

    validateStory(o, age, theme) {
      if (!o || typeof o !== 'object') return null;
      const A = MZ.levels.AGES[age];
      const txt = (v, n) => typeof v === 'string' ? cleanText(v).slice(0, n) : '';
      const num = (v, a, b, d) => { const x = Number(v); return isFinite(x) ? Math.min(b, Math.max(a, x)) : d; };
      const title = txt(o.title, 48), intro = txt(o.intro, 260);
      if (!title || !intro) return null;
      let world = WORLD_IDS.indexOf(o.world) >= 0 ? o.world : (WORLD_IDS.indexOf(theme) >= 0 ? theme : 'forest');
      let shape = SHAPES.indexOf(o.shape) >= 0 ? o.shape : 'none';
      let art = null;
      if (shape === 'custom') {
        art = Array.isArray(o.art) ? o.art.map(s => String(s).replace(/[^#.]/g, '.')).filter(s => s.length >= 6) : null;
        // Проверяем, что рисунок годится для лабиринта
        const m = art && MZ.maze.asciiMask(art, 1);
        const fill = m ? m.mask.reduce((a, b) => a + b, 0) / (m.cols * m.rows) : 0;
        if (!m || fill < 0.35 || m.mask.reduce((a, b) => a + b, 0) < 30) { shape = 'none'; art = null; }
      }
      return {
        id: 's' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5),
        ai: true, age, theme: theme || 'any',
        title, intro, goal: txt(o.goal, 80), outro: txt(o.outro, 160) || 'Ура! Домик открыт!',
        world, item: MZ.story && MZ.story.ITEMS_NOM[world] || txt(o.item, 24),
        shape: shape === 'none' ? null : shape, art,
        size: num(o.size, 0, 1, 0.5),
        keys: Math.round(num(o.keys, 0, A.gates[1], 0)),
        enemies: Math.round(num(o.enemies, 0, A.enemies[1], 0)),
        portals: Math.round(num(o.portals, 0, A.portals[1], 0)),
        dark: age === 'tiny' ? false : !!o.dark,
        loops: num(o.loops, 0, 1, 0.5)
      };
    },

    fetchStory(age, heroName, theme) {
      return this.task('story|' + age + '|' + (theme || 'any') + '|' + ((this.cache.stories[age] || []).length), async () => {
        const o = await this.request(this.storyPrompt(age, heroName, theme), { temperature: 1 });
        const s = this.validateStory(o, age, theme);
        if (!s) return null;
        const q = this.cache.stories[age] = this.cache.stories[age] || [];
        q.push(s);
        while (q.length > 5) q.shift();
        this.saveCache();
        return s;
      });
    },

    // Взять готовую ИИ-сказку (предпочтительно по теме). Возвращает null, если пока нет.
    takeStory(age, theme) {
      const q = this.cache.stories[age] || [];
      let k = -1;
      if (theme && theme !== 'any') k = q.findIndex(s => s.world === theme || s.theme === theme);
      else if (q.length) k = 0;
      if (k < 0) return null;
      const s = q.splice(k, 1)[0];
      this.saveCache();
      return s;
    },
    storiesReady(age) { return (this.cache.stories[age] || []).length; },

    // ---------- Фразы совёнка ----------
    fetchPhrases(age) {
      const cur = this.cache.phrases[age];
      if (cur && Date.now() - cur.at < 3 * 86400000) return Promise.resolve(cur);
      const A = MZ.levels.AGES[age];
      return this.task('phrases|' + age, async () => {
        const o = await this.request('Придумай короткие (до 50 символов) фразы совёнка-помощника в игре-лабиринте для игрока ' + A.label +
          '. Верни JSON: {"start":[6 фраз перед уровнем],"collect":[6 фраз, когда нашёл предмет],' +
          '"stuck":[6 мягких подсказок, если заблудился: предложи нажать клубочек или заглянуть в тупички],' +
          '"win":[6 похвал за победу],"lose":[4 утешения после неудачи]}');
        if (!o) return null;
        const pack = { at: Date.now() };
        ['start', 'collect', 'stuck', 'win', 'lose'].forEach(k => {
          pack[k] = Array.isArray(o[k]) ? o[k].map(s => cleanText(String(s)).slice(0, 70)).filter(s => s.length > 2).slice(0, 8) : [];
        });
        if (!pack.win.length) return null;
        this.cache.phrases[age] = pack;
        this.saveCache();
        return pack;
      });
    },
    phrase(kind, age) {
      const pack = this.cache.phrases[age];
      const ai = pack && pack[kind] && pack[kind].length ? pack[kind] : null;
      const local = LOCAL_PHRASES[kind] || LOCAL_PHRASES.start;
      // Смешиваем: ИИ-фразы разнообразят, локальные гарантируют наличие
      const pool = ai && Math.random() < 0.7 ? ai : local;
      return pool[Math.floor(Math.random() * pool.length)];
    },

    // ---------- Названия уровней ----------
    fetchNames(age, worldIndex) {
      const key = age + '|' + worldIndex;
      if (this.cache.names[key]) return Promise.resolve(this.cache.names[key]);
      const w = MZ.levels.WORLDS[worldIndex], A = MZ.levels.AGES[age];
      return this.task('names|' + key, async () => {
        const o = await this.request('Придумай 8 коротких (до 22 символов) волшебных названий уровней лабиринта в мире «' + w.name +
          '» для игрока ' + A.label + '. Названия не повторяются. Верни JSON: {"names":["...", "..."]}');
        const names = o && Array.isArray(o.names) ? o.names.map(s => cleanText(String(s)).slice(0, 26)).filter(s => s.length > 1) : [];
        if (names.length < 8) return null;
        this.cache.names[key] = names.slice(0, 8);
        this.saveCache();
        return this.cache.names[key];
      });
    },
    levelName(age, index) {
      if (index >= MZ.levels.CAMPAIGN_LEVELS) return null;
      const w = MZ.levels.worldFor(index);
      const list = this.cache.names[age + '|' + w];
      return list ? list[index % MZ.levels.LEVELS_PER_WORLD] : null;
    },

    // Фоновая подготовка: вызывается при старте и после уровней, ничего не блокирует
    prefetch(profile, opts) {
      if (!profile || !this.available()) return;
      opts = opts || {};
      const age = profile.age;
      const hero = (MZ.sprites.heroById(profile.hero) || {}).name || 'Ёжик';
      this.fetchPhrases(age);
      const mp = MZ.progress.modeProgress(profile, profile.lastMode || 'classic');
      const w = MZ.levels.worldFor(Math.min(mp.unlocked, MZ.levels.CAMPAIGN_LEVELS - 1));
      this.fetchNames(age, w);
      if (this.storiesReady(age) < 2) this.fetchStory(age, hero, opts.theme || 'any');
      if (opts.theme && opts.theme !== 'any' && !(this.cache.stories[age] || []).some(s => s.world === opts.theme)) this.fetchStory(age, hero, opts.theme);
    },

    // Проверка связи для экрана настроек
    async ping() {
      const was = this.pausedUntil;
      this.pausedUntil = 0;
      this.setStatus('working');
      const o = await this.request('Верни JSON {"ok":true,"hello":"короткое приветствие ребёнку"}', { timeout: 60000, temperature: 0.5 });
      if (!o && was > Date.now()) this.pausedUntil = was;
      this.setStatus(o ? 'ok' : 'offline');
      return o;
    }
  };

  function parseJson(text) {
    if (!text || typeof text !== 'string') return null;
    let t = text.trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
    const a = t.indexOf('{'), b = t.lastIndexOf('}');
    if (a < 0 || b <= a) return null;
    t = t.slice(a, b + 1);
    try { return JSON.parse(t); } catch (e) { return null; }
  }

  // Чистим текст: без ссылок, разметки и управляющих символов
  function cleanText(s) {
    return s.replace(/https?:\/\/\S+/g, '').replace(/[<>{}`*_#]/g, '').replace(/[\u0000-\u001f]/g, ' ').replace(/\s+/g, ' ').trim();
  }

  const LOCAL_PHRASES = {
    start: ['Вперёд, за приключениями!', 'Я верю в тебя!', 'Найди всё и открой домик!', 'Смотри внимательно на дорожки!', 'Ух, какой интересный лабиринт!', 'Ты готов? Поехали!'],
    collect: ['Отлично, нашлось!', 'Ещё одно! Так держать!', 'Какая находка!', 'Ура, в копилку!', 'Здорово получается!', 'Молодец, ищем дальше!'],
    stuck: ['Нажми на клубочек — он покажет путь!', 'Загляни в тупички — там бывают находки.', 'Попробуй другую дорожку!', 'Не спеши, посмотри на весь лабиринт.', 'Клубочек всегда поможет!', 'Иногда нужно вернуться назад.'],
    win: ['Ты справился! Ура!', 'Великолепно!', 'Вот это да! Молодец!', 'Настоящий мастер лабиринтов!', 'Блестяще пройдено!', 'Так держать, герой!'],
    lose: ['Ничего страшного, попробуем ещё!', 'В следующий раз получится!', 'Ты уже почти у цели!', 'Главное — не сдаваться!'],
    gate: ['Нужен ключик такого же цвета!', 'Найди ключ этого цвета.', 'Дверца заперта — ищи ключик!'],
    exit: ['Сначала собери всё, что нужно!', 'Домик откроется, когда найдёшь все предметы.'],
    key: ['Ключик! Теперь найди дверцу.', 'Есть ключ! Где же дверца?']
  };

  AI.LOCAL_PHRASES = LOCAL_PHRASES;
  AI.parseJson = parseJson;
  AI.loadCache();
  MZ.ai = AI;
})(typeof window !== 'undefined' ? window : globalThis);

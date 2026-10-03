/* Профили, прогресс, рекорды и достижения. Всё хранится локально (localStorage). */
(function (root) {
  'use strict';
  const MZ = root.MZ = root.MZ || {};
  const { store, uid, todayKey } = MZ.util;
  const KEY = 'klubok.v1';
  const MAX_RECORDS = 400;

  const DEFAULT_SETTINGS = {
    sound: true, music: true, voice: true, vibration: true, trail: true, dpad: false, ai: true, theme: 'auto',
    glide: false, speech: 'normal', voiceName: ''
  };

  function blankStats() {
    return {
      wins: 0, items: 0, gates: 0, steps: 0, hints: 0, hits: 0, portals: 0, bonus: 0, play: 0,
      perfect: 0, noHint: 0, shortest: 0, fastTime: 0, noHitEnemy: 0, darkWins: 0, storyWins: 0, dailyWins: 0,
      worlds: {}, modesWon: {}
    };
  }

  function blankProfile(name, age, hero) {
    const progress = {}; // ключи вида "classic@kid" — см. modeProgress
    return {
      id: uid(), name: (name || '').trim().slice(0, 16) || 'Игрок', age: age || 'kid', hero: hero || 'hedgehog',
      created: Date.now(), lastMode: 'classic', progress,
      daily: { last: null, streak: 0, bestStreak: 0, results: {} },
      stats: blankStats(), achievements: {}
    };
  }

  const P = {
    state: null,

    load() {
      const s = store.get(KEY, null);
      if (s && s.v === 1 && Array.isArray(s.profiles)) {
        this.state = s;
        this.state.settings = Object.assign({}, DEFAULT_SETTINGS, s.settings || {});
        // Миграция: добавляем недостающие поля
        this.state.profiles.forEach(p => {
          p.stats = Object.assign(blankStats(), p.stats || {});
          p.progress = p.progress || {};
          p.daily = p.daily || { last: null, streak: 0, bestStreak: 0, results: {} };
          p.achievements = p.achievements || {};
        });
        this.state.records = this.state.records || [];
      } else {
        this.state = { v: 1, profiles: [], activeId: null, settings: Object.assign({}, DEFAULT_SETTINGS), records: [] };
      }
      return this.state;
    },

    save() { store.set(KEY, this.state); },

    get settings() { return this.state.settings; },
    setSetting(k, v) { this.state.settings[k] = v; this.save(); },

    profiles() { return this.state.profiles; },
    active() { return this.state.profiles.find(p => p.id === this.state.activeId) || null; },
    setActive(id) { this.state.activeId = id; this.save(); },

    createProfile(name, age, hero) {
      const p = blankProfile(name, age, hero);
      this.state.profiles.push(p);
      if (this.state.profiles.length > 8) this.state.profiles.shift();
      this.state.activeId = p.id;
      // Малышам по умолчанию включаем озвучку
      if (age === 'tiny') this.state.settings.voice = true;
      this.save();
      return p;
    },
    updateProfile(id, fields) {
      const p = this.state.profiles.find(x => x.id === id);
      if (!p) return;
      if (fields.name != null) p.name = String(fields.name).trim().slice(0, 16) || p.name;
      if (fields.age) p.age = fields.age;
      if (fields.hero) p.hero = fields.hero;
      this.save();
    },
    deleteProfile(id) {
      this.state.profiles = this.state.profiles.filter(p => p.id !== id);
      this.state.records = this.state.records.filter(r => r.pid !== id);
      if (this.state.activeId === id) this.state.activeId = this.state.profiles.length ? this.state.profiles[0].id : null;
      this.save();
    },
    resetProfile(id) {
      const p = this.state.profiles.find(x => x.id === id);
      if (!p) return;
      const fresh = blankProfile(p.name, p.age, p.hero);
      fresh.id = p.id;
      Object.assign(p, fresh);
      this.state.records = this.state.records.filter(r => r.pid !== id);
      this.save();
    },

    // Прогресс хранится отдельно для каждой возрастной группы, чтобы смена возраста не ломала кампанию
    modeProgress(p, mode) {
      p = p || this.active();
      const key = mode + '@' + p.age;
      if (!p.progress[key]) p.progress[key] = { unlocked: 0, levels: {} };
      return p.progress[key];
    },
    totalStars(p) {
      p = p || this.active();
      let s = 0;
      for (const k in p.progress) for (const i in p.progress[k].levels) s += p.progress[k].levels[i].stars || 0;
      return s;
    },
    modeStars(p, mode) {
      const mp = this.modeProgress(p, mode);
      let s = 0;
      for (const i in mp.levels) s += mp.levels[i].stars || 0;
      return s;
    },
    completedCampaign(p) {
      p = p || this.active();
      let best = 0;
      for (const k in p.progress) best = Math.max(best, Object.keys(p.progress[k].levels).length);
      return best;
    },

    // Запись результата победы. Возвращает { newBest, unlocked: [достижения] }
    recordWin(res, extra) {
      const p = this.active();
      if (!p) return { newBest: false, unlocked: [] };
      extra = extra || {};
      const st = p.stats;
      st.wins++; st.items += res.items; st.gates += res.gates; st.steps += res.steps; st.hints += res.hintsUsed;
      st.hits += res.hits; st.portals += res.portals; st.bonus += res.bonus; st.play += Math.round(res.time);
      if (res.stars === 3) st.perfect++;
      if (res.noHints) st.noHint++;
      if (res.perfectPath) st.shortest++;
      if (res.timer && !res.overtime && res.timeLeft / Math.max(1, extra.timeLimit || 1) >= 0.33) st.fastTime++;
      if (res.enemies && res.hits === 0) st.noHitEnemy++;
      if (res.dark) st.darkWins++;
      if (res.mode === 'story') st.storyWins++;
      if (extra.worldId) st.worlds[extra.worldId] = 1;
      st.modesWon[res.mode] = 1;

      let newBest = false;
      if (MZ.levels.CAMPAIGN_MODES.indexOf(res.mode) >= 0) {
        const mp = this.modeProgress(p, res.mode);
        const prev = mp.levels[res.index];
        if (!prev || res.score > prev.score) newBest = !!prev;
        mp.levels[res.index] = {
          stars: Math.max(prev ? prev.stars : 0, res.stars),
          time: prev ? Math.min(prev.time, res.time) : res.time,
          steps: prev ? Math.min(prev.steps, res.steps) : res.steps,
          score: prev ? Math.max(prev.score, res.score) : res.score
        };
        mp.unlocked = Math.max(mp.unlocked, res.index + 1);
        p.lastMode = res.mode;
      }
      if (res.mode === 'daily') {
        const today = todayKey();
        const d = p.daily;
        if (d.last !== today) {
          const y = new Date(); y.setDate(y.getDate() - 1);
          d.streak = d.last === todayKey(y) ? d.streak + 1 : 1;
          d.bestStreak = Math.max(d.bestStreak, d.streak);
          d.last = today;
          st.dailyWins++;
        }
        const prev = d.results[today];
        if (!prev || res.time < prev.time) { newBest = !!prev; d.results[today] = { time: res.time, stars: res.stars, score: res.score }; }
      }

      this.state.records.push({
        pid: p.id, name: p.name, hero: p.hero, age: p.age, mode: res.mode, index: res.index, title: res.title,
        time: Math.round(res.time * 10) / 10, steps: res.steps, stars: res.stars, score: res.score,
        date: Date.now(), day: res.mode === 'daily' ? todayKey() : null
      });
      if (this.state.records.length > MAX_RECORDS) {
        this.state.records.sort((a, b) => b.score - a.score);
        this.state.records.length = MAX_RECORDS;
      }
      const unlocked = this.checkAchievements(p);
      this.save();
      return { newBest, unlocked };
    },

    recordLoss(res) {
      const p = this.active();
      if (!p) return;
      p.stats.steps += res.steps; p.stats.hits += res.hits; p.stats.play += Math.round(res.time);
      this.save();
    },

    records(filter) {
      let list = this.state.records.slice();
      if (filter.mode && filter.mode !== 'all') list = list.filter(r => r.mode === filter.mode);
      if (filter.day) list = list.filter(r => r.day === filter.day);
      if (filter.age) list = list.filter(r => r.age === filter.age);
      if (filter.mode === 'daily') list.sort((a, b) => a.time - b.time || b.score - a.score);
      else list.sort((a, b) => b.score - a.score || a.time - b.time);
      return list.slice(0, filter.limit || 30);
    },

    // ---------- Достижения ----------
    checkAchievements(p) {
      const out = [];
      ACHIEVEMENTS.forEach(a => {
        if (p.achievements[a.id]) return;
        if (a.value(p, this) >= a.target) { p.achievements[a.id] = Date.now(); out.push(a); }
      });
      return out;
    },
    achievementList(p) {
      p = p || this.active();
      return ACHIEVEMENTS.map(a => ({
        def: a, unlocked: !!(p && p.achievements[a.id]), at: p && p.achievements[a.id],
        value: p ? Math.min(a.target, a.value(p, this)) : 0
      }));
    }
  };

  const ACHIEVEMENTS = [
    { id: 'first_win', title: 'Первый шаг', desc: 'Пройди первый лабиринт', icon: 'flag', target: 1, value: p => p.stats.wins },
    { id: 'wins_10', title: 'Путешественник', desc: 'Пройди 10 лабиринтов', icon: 'path', target: 10, value: p => p.stats.wins },
    { id: 'wins_50', title: 'Покоритель', desc: 'Пройди 50 лабиринтов', icon: 'crown', target: 50, value: p => p.stats.wins },
    { id: 'stars_30', title: 'Звездочёт', desc: 'Собери 30 звёзд за уровни', icon: 'star', target: 30, value: (p, P) => P.totalStars(p) },
    { id: 'stars_100', title: 'Созвездие', desc: 'Собери 100 звёзд за уровни', icon: 'stars', target: 100, value: (p, P) => P.totalStars(p) },
    { id: 'items_50', title: 'Собиратель', desc: 'Найди 50 предметов', icon: 'apple', target: 50, value: p => p.stats.items },
    { id: 'items_250', title: 'Коллекционер', desc: 'Найди 250 предметов', icon: 'gem', target: 250, value: p => p.stats.items },
    { id: 'keys_10', title: 'Ключник', desc: 'Открой 10 цветных дверец', icon: 'key', target: 10, value: p => p.stats.gates },
    { id: 'perfect_10', title: 'Отличник', desc: '10 уровней на три звезды', icon: 'medal', target: 10, value: p => p.stats.perfect },
    { id: 'nohint_10', title: 'Сам с усам', desc: '10 уровней без подсказок', icon: 'brain', target: 10, value: p => p.stats.noHint },
    { id: 'shortest_5', title: 'Прямая дорожка', desc: '5 уровней самым коротким путём', icon: 'target', target: 5, value: p => p.stats.shortest },
    { id: 'time_5', title: 'Молния', desc: '5 уровней «На время» с запасом в треть', icon: 'bolt', target: 5, value: p => p.stats.fastTime },
    { id: 'ninja_5', title: 'Невидимка', desc: '5 раз пройди мимо сторожей незамеченным', icon: 'ghost', target: 5, value: p => p.stats.noHitEnemy },
    { id: 'dark_5', title: 'Светлячок', desc: 'Пройди 5 ночных лабиринтов', icon: 'moon', target: 5, value: p => p.stats.darkWins },
    { id: 'portals_10', title: 'Телепортист', desc: 'Прыгни в портал 10 раз', icon: 'portal', target: 10, value: p => p.stats.portals },
    { id: 'steps_1000', title: 'Марафонец', desc: 'Пройди 1 000 клеток', icon: 'shoe', target: 1000, value: p => p.stats.steps },
    { id: 'steps_10000', title: 'Кругосветка', desc: 'Пройди 10 000 клеток', icon: 'globe', target: 10000, value: p => p.stats.steps },
    { id: 'worlds_5', title: 'Все миры', desc: 'Побывай во всех пяти мирах', icon: 'map', target: 5, value: p => Object.keys(p.stats.worlds).length },
    { id: 'story_3', title: 'Сказочник', desc: 'Пройди 3 сказки', icon: 'book', target: 3, value: p => p.stats.storyWins },
    { id: 'daily_1', title: 'Лабиринт дня', desc: 'Пройди лабиринт дня', icon: 'calendar', target: 1, value: p => p.stats.dailyWins },
    { id: 'streak_3', title: 'Три дня подряд', desc: 'Лабиринт дня три дня подряд', icon: 'fire', target: 3, value: p => p.daily.bestStreak },
    { id: 'streak_7', title: 'Неделя приключений', desc: 'Лабиринт дня семь дней подряд', icon: 'fire', target: 7, value: p => p.daily.bestStreak },
    { id: 'campaign', title: 'Чемпион', desc: 'Пройди все 40 уровней любого режима', icon: 'trophy', target: 40, value: (p, P) => P.completedCampaign(p) },
    { id: 'all_modes', title: 'Мастер на все руки', desc: 'Победи во всех шести режимах', icon: 'sparkle', target: 6, value: p => Object.keys(p.stats.modesWon).length }
  ];

  P.ACHIEVEMENTS = ACHIEVEMENTS;
  MZ.progress = P;
})(typeof window !== 'undefined' ? window : globalThis);

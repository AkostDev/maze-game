/*
 * Прогресс игрока: открытые уровни, звёзды и лучшие результаты, выбранный герой, настройки.
 * Одно сохранение в localStorage (ключ KEY). Чистая логика: хранилище передаётся снаружи.
 */
import { HEROES } from './worlds.js';

export const KEY = 'klubok.v2';

export const DEFAULT_SETTINGS = {
  sound: true,
  music: true,
  vibration: true,
  dpad: false
};

function blank() {
  return { v: 2, hero: HEROES[0].id, unlocked: 0, levels: {}, settings: Object.assign({}, DEFAULT_SETTINGS) };
}

// Хранилище в памяти — когда localStorage недоступен (приватный режим, тесты в Node)
export function memoryStorage() {
  const data = {};
  return {
    getItem: k => (k in data ? data[k] : null),
    setItem: (k, v) => { data[k] = String(v); },
    removeItem: k => { delete data[k]; }
  };
}

export class Progress {
  constructor(storage) {
    this.storage = storage || memoryStorage();
    this.state = blank();
    this.load();
  }

  // Чужие и повреждённые данные не должны ломать игру: берём только поля известных типов
  load() {
    let raw = null;
    try { raw = JSON.parse(this.storage.getItem(KEY)); } catch (e) { raw = null; }
    const s = blank();
    if (raw && typeof raw === 'object' && raw.v === 2) {
      if (HEROES.some(h => h.id === raw.hero)) s.hero = raw.hero;
      if (Number.isInteger(raw.unlocked) && raw.unlocked >= 0) s.unlocked = raw.unlocked;
      if (raw.levels && typeof raw.levels === 'object') {
        for (const k in raw.levels) {
          const r = raw.levels[k];
          if (r && r.stars >= 1 && r.stars <= 3) s.levels[k] = { stars: r.stars | 0, steps: r.steps | 0, time: +r.time || 0 };
        }
      }
      if (raw.settings && typeof raw.settings === 'object') {
        for (const k in DEFAULT_SETTINGS) if (typeof raw.settings[k] === typeof DEFAULT_SETTINGS[k]) s.settings[k] = raw.settings[k];
      }
    }
    this.state = s;
  }

  save() {
    try { this.storage.setItem(KEY, JSON.stringify(this.state)); } catch (e) { /* квота или запрет — играем без сохранения */ }
  }

  get settings() { return this.state.settings; }
  setSetting(key, value) {
    if (!(key in DEFAULT_SETTINGS)) return;
    this.state.settings[key] = value;
    this.save();
  }

  get hero() { return this.state.hero; }
  setHero(id) {
    if (!HEROES.some(h => h.id === id)) return;
    this.state.hero = id;
    this.save();
  }

  // Индекс самого дальнего доступного уровня: все уровни до него включительно можно играть
  get unlocked() { return this.state.unlocked; }
  isUnlocked(index) { return index <= this.state.unlocked; }
  best(index) { return this.state.levels[index] || null; }
  stars(index) { const r = this.state.levels[index]; return r ? r.stars : 0; }
  totalStars() {
    let n = 0;
    for (const k in this.state.levels) n += this.state.levels[k].stars;
    return n;
  }
  // Звёзды за диапазон уровней [from, from + count)
  rangeStars(from, count) {
    let n = 0;
    for (let i = from; i < from + count; i++) n += this.stars(i);
    return n;
  }

  // Победа: лучший результат — больше звёзд, при равных — меньше шагов. Открывает следующий уровень.
  recordWin(index, result) {
    const old = this.state.levels[index];
    const better = !old || result.stars > old.stars || (result.stars === old.stars && result.steps < old.steps);
    if (better) this.state.levels[index] = { stars: result.stars, steps: result.steps, time: Math.round(result.time * 10) / 10 };
    const unlockedNext = index + 1 > this.state.unlocked;
    if (unlockedNext) this.state.unlocked = index + 1;
    this.save();
    return { firstWin: !old, newBest: better && !!old, unlockedNext };
  }

  reset() {
    const settings = this.state.settings;
    this.state = blank();
    this.state.settings = settings;
    this.save();
  }
}

function browserStorage() {
  try {
    const ls = globalThis.localStorage;
    if (ls) { ls.getItem(KEY); return ls; }
  } catch (e) { /* доступ запрещён */ }
  return memoryStorage();
}

// Единственный экземпляр на всё приложение
export const progress = new Progress(browserStorage());

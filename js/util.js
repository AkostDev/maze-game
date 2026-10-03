/* Общие утилиты: сидируемый генератор случайных чисел, математика, хранилище, DOM-хелперы */
(function (root) {
  'use strict';
  const MZ = root.MZ = root.MZ || {};

  // xmur3 — превращает строку в 32-битные сиды
  function xmur3(str) {
    let h = 1779033703 ^ str.length;
    for (let i = 0; i < str.length; i++) {
      h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
      h = (h << 13) | (h >>> 19);
    }
    return function () {
      h = Math.imul(h ^ (h >>> 16), 2246822507);
      h = Math.imul(h ^ (h >>> 13), 3266489909);
      return (h ^= h >>> 16) >>> 0;
    };
  }

  // sfc32 — быстрый и качественный PRNG
  function sfc32(a, b, c, d) {
    return function () {
      a >>>= 0; b >>>= 0; c >>>= 0; d >>>= 0;
      let t = (a + b) | 0;
      a = b ^ (b >>> 9);
      b = (c + (c << 3)) | 0;
      c = (c << 21) | (c >>> 11);
      d = (d + 1) | 0;
      t = (t + d) | 0;
      c = (c + t) | 0;
      return (t >>> 0) / 4294967296;
    };
  }

  function makeRng(seed) {
    const s = xmur3(String(seed));
    const next = sfc32(s(), s(), s(), s());
    for (let i = 0; i < 12; i++) next(); // прогрев
    const rng = {
      next,
      int(n) { return Math.floor(next() * n); },
      range(a, b) { return a + next() * (b - a); },
      irange(a, b) { return a + Math.floor(next() * (b - a + 1)); },
      chance(p) { return next() < p; },
      pick(arr) { return arr[Math.floor(next() * arr.length)]; },
      shuffle(arr) {
        for (let i = arr.length - 1; i > 0; i--) {
          const j = Math.floor(next() * (i + 1));
          const t = arr[i]; arr[i] = arr[j]; arr[j] = t;
        }
        return arr;
      }
    };
    return rng;
  }

  function hashStr(str) { return xmur3(String(str))(); }

  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const lerp = (a, b, t) => a + (b - a) * t;
  const invLerp = (a, b, v) => (b === a ? 0 : clamp((v - a) / (b - a), 0, 1));

  const ease = {
    outCubic: t => 1 - Math.pow(1 - t, 3),
    inOutSine: t => -(Math.cos(Math.PI * t) - 1) / 2,
    outBack: t => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); },
    outElastic: t => (t === 0 || t === 1) ? t : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * (2 * Math.PI) / 3) + 1
  };

  function fmtTime(sec) {
    sec = Math.max(0, Math.floor(sec));
    const m = Math.floor(sec / 60), s = sec % 60;
    return m + ':' + (s < 10 ? '0' : '') + s;
  }

  function todayKey(d) {
    d = d || new Date();
    const mm = d.getMonth() + 1, dd = d.getDate();
    return d.getFullYear() + '-' + (mm < 10 ? '0' : '') + mm + '-' + (dd < 10 ? '0' : '') + dd;
  }

  // Русское склонение: plural(5, ['звезда','звезды','звёзд'])
  function plural(n, forms) {
    const a = Math.abs(n) % 100, b = a % 10;
    if (a > 10 && a < 20) return forms[2];
    if (b > 1 && b < 5) return forms[1];
    if (b === 1) return forms[0];
    return forms[2];
  }

  // Число словами для озвучки: numWord(2, 'f') → «две», numWord(1, 'n') → «одно»
  const ONES = ['ноль', 'один', 'два', 'три', 'четыре', 'пять', 'шесть', 'семь', 'восемь', 'девять', 'десять', 'одиннадцать',
    'двенадцать', 'тринадцать', 'четырнадцать', 'пятнадцать', 'шестнадцать', 'семнадцать', 'восемнадцать', 'девятнадцать'];
  const TENS = ['', '', 'двадцать', 'тридцать', 'сорок', 'пятьдесят', 'шестьдесят', 'семьдесят', 'восемьдесят', 'девяносто'];
  function numWord(n, g) {
    n = Math.abs(Math.round(n));
    if (n >= 100) return String(n);
    const unit = k => k === 1 ? (g === 'f' ? 'одна' : g === 'n' ? 'одно' : 'один') : k === 2 ? (g === 'f' ? 'две' : 'два') : ONES[k];
    if (n < 20) return unit(n);
    const u = n % 10;
    return TENS[Math.floor(n / 10)] + (u ? ' ' + unit(u) : '');
  }

  // Безопасное хранилище: localStorage может быть недоступен (приватный режим, file://, запрет cookies)
  const memStore = {};
  const store = {
    get(key, def) {
      try {
        const raw = root.localStorage ? root.localStorage.getItem(key) : memStore[key];
        if (raw == null) return def;
        return JSON.parse(raw);
      } catch (e) { return memStore[key] != null ? JSON.parse(memStore[key]) : def; }
    },
    set(key, val) {
      const raw = JSON.stringify(val);
      memStore[key] = raw;
      try { if (root.localStorage) root.localStorage.setItem(key, raw); } catch (e) { /* квота или запрет */ }
    },
    remove(key) {
      delete memStore[key];
      try { if (root.localStorage) root.localStorage.removeItem(key); } catch (e) { /* ignore */ }
    }
  };

  // Мини-DOM-хелпер: el('div', {class:'x', onclick: fn}, [children])
  function el(tag, attrs, children) {
    const node = document.createElement(tag);
    if (attrs) {
      for (const k in attrs) {
        const v = attrs[k];
        if (v == null || v === false) continue;
        if (k === 'class') node.className = v;
        else if (k === 'text') node.textContent = v;
        else if (k === 'html') node.innerHTML = v; // только для наших собственных SVG-иконок
        else if (k === 'style' && typeof v === 'object') {
          for (const sk in v) { if (sk.startsWith('--')) node.style.setProperty(sk, v[sk]); else node.style[sk] = v[sk]; }
        }
        else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2), v);
        else if (k === 'dataset') Object.assign(node.dataset, v);
        else node.setAttribute(k, v === true ? '' : v);
      }
    }
    if (children != null) {
      (Array.isArray(children) ? children : [children]).forEach(c => {
        if (c == null || c === false) return;
        node.appendChild(typeof c === 'string' || typeof c === 'number' ? document.createTextNode(String(c)) : c);
      });
    }
    return node;
  }

  function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  const reducedMotion = () => {
    try { return root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; }
  };

  MZ.util = { makeRng, hashStr, clamp, lerp, invLerp, ease, fmtTime, todayKey, plural, numWord, store, el, uid, reducedMotion };
})(typeof window !== 'undefined' ? window : globalThis);

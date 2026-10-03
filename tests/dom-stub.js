/* Мини-DOM для смоук-теста интерфейса в JavaScriptCore (без браузера) */
var window = globalThis;
(function () {
  var timers = [], rafs = [], now = 0;
  globalThis.__flushTimers = function (ms) {
    now += ms || 0;
    for (var guard = 0; guard < 50; guard++) {
      var due = timers.filter(function (t) { return t.at <= now; });
      if (!due.length) break;
      timers = timers.filter(function (t) { return t.at > now; });
      due.forEach(function (t) { t.fn(); });
    }
  };
  globalThis.__flushRaf = function (frames, step) {
    for (var i = 0; i < frames; i++) {
      now += step || 16;
      var list = rafs; rafs = [];
      list.forEach(function (fn) { fn(now); });
      __flushTimers(0);
    }
  };
  globalThis.setTimeout = function (fn, ms) { var id = Math.random(); timers.push({ fn: fn, at: now + (ms || 0), id: id }); return id; };
  globalThis.clearTimeout = function (id) { timers = timers.filter(function (t) { return t.id !== id; }); };
  globalThis.setInterval = function () { return 0; };
  globalThis.clearInterval = function () {};
  globalThis.requestAnimationFrame = function (fn) { rafs.push(fn); return rafs.length; };
  globalThis.cancelAnimationFrame = function () {};
  globalThis.performance = { now: function () { return now; } };

  function ctxProxy() {
    var store = {};
    return new Proxy(store, {
      get: function (o, k) {
        if (k in o) return o[k];
        if (k === 'createLinearGradient' || k === 'createRadialGradient') return function () { return { addColorStop: function () {} }; };
        if (k === 'measureText') return function () { return { width: 10 }; };
        if (k === 'getImageData') return function () { return { data: [] }; };
        return function () {};
      },
      set: function (o, k, v) { o[k] = v; return true; }
    });
  }
  function matches(elm, sel) {
    sel = sel.trim();
    if (sel[0] === '#') return elm.id === sel.slice(1);
    if (sel[0] === '.') return (' ' + elm.className + ' ').indexOf(' ' + sel.slice(1) + ' ') >= 0;
    if (sel[0] === '[') { var a = sel.slice(1, -1).split('=')[0]; return elm.getAttribute(a) != null; }
    return elm.tagName === sel.toUpperCase();
  }
  function El(tag) {
    this.tagName = String(tag).toUpperCase(); this.children = []; this.parentNode = null; this.attrs = {};
    this.style = { setProperty: function (k, v) { this[k] = v; } }; this.dataset = {}; this.hidden = false; this.id = ''; this.className = ''; this._text = '';
    this.value = ''; this.checked = false; this.disabled = false; this.listeners = {};
    var self = this;
    this.classList = {
      add: function (c) { if (!self.classList.contains(c)) self.className = (self.className + ' ' + c).trim(); },
      remove: function (c) { self.className = self.className.split(' ').filter(function (x) { return x !== c; }).join(' '); },
      toggle: function (c, on) { if (on === undefined) on = !self.classList.contains(c); on ? self.classList.add(c) : self.classList.remove(c); },
      contains: function (c) { return (' ' + self.className + ' ').indexOf(' ' + c + ' ') >= 0; }
    };
    if (this.tagName === 'CANVAS') { this.width = 300; this.height = 150; var cx = ctxProxy(); this.getContext = function () { return cx; }; }
    if (this.tagName === 'TEMPLATE') this.content = { get firstChild() { return new El('svg'); } };
  }
  El.prototype = {
    appendChild: function (c) { if (c.parentNode) c.parentNode.removeChild(c); c.parentNode = this; this.children.push(c); return c; },
    removeChild: function (c) { this.children = this.children.filter(function (x) { return x !== c; }); c.parentNode = null; return c; },
    remove: function () { if (this.parentNode) this.parentNode.removeChild(this); },
    get firstChild() { return this.children[0] || null; },
    get isConnected() { var n = this; while (n.parentNode) n = n.parentNode; return n === document.documentElement; },
    setAttribute: function (k, v) { this.attrs[k] = String(v); if (k === 'id') this.id = v; if (k === 'class') this.className = v; },
    getAttribute: function (k) { return k in this.attrs ? this.attrs[k] : (k === 'data-dir' && this.dataset.dir != null ? this.dataset.dir : null); },
    removeAttribute: function (k) { delete this.attrs[k]; },
    addEventListener: function (t, fn) { (this.listeners[t] = this.listeners[t] || []).push(fn); },
    removeEventListener: function () {},
    dispatch: function (t, ev) { ev = ev || {}; ev.preventDefault = ev.preventDefault || function () { ev.defaultPrevented = true; }; ev.currentTarget = this; ev.target = ev.target || this; (this.listeners[t] || []).forEach(function (fn) { fn(ev); }); },
    click: function () { this.dispatch('click', {}); },
    focus: function () {}, setPointerCapture: function () {}, releasePointerCapture: function () {},
    getBoundingClientRect: function () { return { left: 0, top: 0, width: 390, height: this.id === 'hud' ? 80 : this.id === 'hudBottom' ? 90 : 780 }; },
    querySelectorAll: function (sel) { var out = []; (function walk(n) { n.children.forEach(function (c) { if (matches(c, sel)) out.push(c); walk(c); }); })(this); return out; },
    querySelector: function (sel) { return this.querySelectorAll(sel)[0] || null; },
    get offsetWidth() { return 100; },
    set innerHTML(v) { this.children = []; this._html = v; },
    get innerHTML() { return this._html || ''; },
    set textContent(v) { this.children = []; this._text = String(v); },
    get textContent() { return this._text; }
  };
  var docEl = new El('html'), body = new El('body');
  docEl.appendChild(body);
  globalThis.document = {
    documentElement: docEl, body: body, readyState: 'complete',
    createElement: function (t) { return new El(t); },
    createTextNode: function (t) { var e = new El('#text'); e._text = t; return e; },
    getElementById: function (id) { var r = null; (function walk(n) { n.children.forEach(function (c) { if (!r && c.id === id) r = c; if (!r) walk(c); }); })(docEl); return r; },
    querySelectorAll: function (s) { return docEl.querySelectorAll(s); },
    addEventListener: function () {}, hidden: false
  };
  // Статическая разметка из index.html
  function mk(tag, id, parent, cls) { var e = new El(tag); if (id) e.id = id; if (cls) e.className = cls; (parent || body).appendChild(e); return e; }
  var app = mk('div', 'app');
  var stage = mk('div', 'stage', app, 'stage'); stage.hidden = true; mk('canvas', 'game', stage);
  var hud = mk('header', 'hud', app, 'hud'); hud.hidden = true;
  mk('button', 'btnPause', hud); mk('small', 'hudWorld', hud); mk('strong', 'hudLevel', hud); mk('div', 'hudStats', hud);
  var hb = mk('div', 'hudBottom', app); hb.hidden = true; mk('button', 'btnMap', hb);
  var dp = mk('div', 'dpad', hb); [0, 3, 1, 2].forEach(function (d) { var b = mk('button', null, dp); b.dataset.dir = String(d); b.attrs['data-dir'] = String(d); });
  var hint = mk('button', 'btnHint', hb);
  mk('div', 'owl', app); mk('div', 'intro', app); mk('main', 'screens', app); var m = mk('div', 'modal', app); m.hidden = true; mk('div', 'toasts', app);
  // После innerHTML у кнопки подсказки должен найтись #hintCount — эмулируем
  var origSet = Object.getOwnPropertyDescriptor(El.prototype, 'innerHTML').set;
  Object.defineProperty(hint, 'innerHTML', { set: function (v) { origSet.call(this, v); var c = new El('span'); c.id = 'hintCount'; this.appendChild(c); }, get: function () { return ''; } });

  var ls = {};
  globalThis.localStorage = { getItem: function (k) { return k in ls ? ls[k] : null; }, setItem: function (k, v) { ls[k] = String(v); }, removeItem: function (k) { delete ls[k]; } };
  globalThis.navigator = { onLine: true, vibrate: function () { return true; } };
  globalThis.location = { search: '', protocol: 'file:' };
  globalThis.devicePixelRatio = 2; globalThis.innerWidth = 390; globalThis.innerHeight = 780;
  globalThis.matchMedia = function (q) { return { matches: /coarse/.test(q) }; };
  globalThis.getComputedStyle = function () { return { paddingLeft: '12px', paddingRight: '12px' }; };
  globalThis.addEventListener = function () {};
  globalThis.Path2D = function () { this.moveTo = function () {}; this.lineTo = function () {}; };
  globalThis.console = { error: function (e) { print('console.error: ' + e + (e && e.stack ? '\n' + e.stack : '')); }, log: print, warn: print };
})();

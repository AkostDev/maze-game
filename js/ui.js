/* Интерфейс: экраны, модальные окна, HUD, совёнок, тосты, иконки. Действия вызывают MZ.app.* */
(function (root) {
  'use strict';
  const MZ = root.MZ = root.MZ || {};
  const { el, fmtTime, plural, makeRng } = MZ.util;
  const L = MZ.levels, S = MZ.sprites;

  // ---------- Иконки (24×24, штрих) ----------
  const F = ' fill="currentColor" stroke="none"';
  const ICONS = {
    play: '<path d="M8 5.5v13a1 1 0 0 0 1.5.86l10.2-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5z"' + F + '/>',
    pause: '<rect x="6" y="5" width="4" height="14" rx="1.5"' + F + '/><rect x="14" y="5" width="4" height="14" rx="1.5"' + F + '/>',
    home: '<path d="M3.5 11 12 4l8.5 7"/><path d="M5.5 9.5V20h5v-5.5h3V20h5V9.5"/>',
    restart: '<path d="M4 12a8 8 0 1 0 2.6-5.9"/><path d="M4 4v4.5h4.5"/>',
    back: '<path d="M15 5l-7 7 7 7"/>',
    next: '<path d="M9 5l7 7-7 7"/>',
    trophy: '<path d="M8 4h8v5a4 4 0 0 1-8 0z"/><path d="M8 6H5a3 3 0 0 0 3 4.5M16 6h3a3 3 0 0 1-3 4.5"/><path d="M12 13v4M8.5 20h7M10 17h4"/>',
    list: '<path d="M9 6h11M9 12h11M9 18h11"/><circle cx="4.5" cy="6" r="1.3"' + F + '/><circle cx="4.5" cy="12" r="1.3"' + F + '/><circle cx="4.5" cy="18" r="1.3"' + F + '/>',
    settings: '<path d="M4 7h9M17.5 7H20M4 17h3M11.5 17H20"/><circle cx="15.2" cy="7" r="2.3"/><circle cx="9.2" cy="17" r="2.3"/>',
    sound: '<path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z"/><path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11"/>',
    mute: '<path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z"/><path d="M16 9.5l5 5M21 9.5l-5 5"/>',
    music: '<path d="M9 18V6l10-2v12"/><circle cx="6.5" cy="18" r="2.5"/><circle cx="16.5" cy="16" r="2.5"/>',
    star: '<path d="M12 3.2l2.6 5.5 6 .8-4.4 4.2 1.1 6-5.3-2.9-5.3 2.9 1.1-6L3.4 9.5l6-.8z"' + F + '/>',
    stars: '<path d="M9 4l1.6 3.4 3.7.5-2.7 2.6.7 3.7L9 12.4l-3.3 1.8.7-3.7L3.7 7.9l3.7-.5z"/><path d="M17 12l1.1 2.3 2.5.4-1.8 1.7.4 2.5-2.2-1.2-2.2 1.2.4-2.5-1.8-1.7 2.5-.4z"/>',
    yarn: '<circle cx="12" cy="12" r="8"/><path d="M5.5 8.5c4 .5 9 3 11.5 8M8 4.8c3 1.5 6.5 5.5 7.3 11.8M4.2 13.5c3.2-1 7.8-.2 10.8 3.8"/>',
    zoom: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="M20 20l-4.8-4.8M8 10.5h5M10.5 8v5"/>',
    map: '<path d="M9 4 3.5 6v14L9 18l6 2 5.5-2V4L15 6z"/><path d="M9 4v14M15 6v14"/>',
    lock: '<rect x="5" y="10.5" width="14" height="10" rx="2.5"/><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5"/>',
    clock: '<circle cx="12" cy="13" r="7.5"/><path d="M12 9v4l2.5 2M9.5 3h5"/>',
    heart: '<path d="M12 20s-7.5-4.6-9-9.3C2 7.2 4.3 4.5 7.3 4.5c2 0 3.6 1.2 4.7 2.9 1.1-1.7 2.7-2.9 4.7-2.9 3 0 5.3 2.7 4.3 6.2C19.5 15.4 12 20 12 20z"' + F + '/>',
    key: '<circle cx="8" cy="12" r="4"/><path d="M12 12h9M18 12v3M15.5 12v2"/>',
    sparkle: '<path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z"' + F + '/><path d="M19 15.5l.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7z"' + F + '/>',
    user: '<circle cx="12" cy="8.5" r="3.8"/><path d="M4.5 20a7.5 7.5 0 0 1 15 0"/>',
    users: '<circle cx="9" cy="9" r="3.3"/><path d="M3 19.5a6 6 0 0 1 12 0"/><path d="M15.5 5.8a3.3 3.3 0 0 1 0 6.4M17.5 14a6 6 0 0 1 3.5 5.5"/>',
    check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
    close: '<path d="M6 6l12 12M18 6 6 18"/>',
    path: '<path d="M5 19V9a4 4 0 0 1 8 0v6a4 4 0 0 0 8 0V5"/><circle cx="5" cy="19" r="1.6"' + F + '/>',
    bug: '<ellipse cx="12" cy="13.5" rx="5" ry="6"/><path d="M12 7.5v12M9 5.5 7.5 3.5M15 5.5l1.5-2M7 11H4M20 11h-3M7 16H4.5M19.5 16H17"/>',
    moon: '<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/>',
    calendar: '<rect x="4" y="5.5" width="16" height="14.5" rx="3"/><path d="M4 10h16M8.5 3.5v4M15.5 3.5v4"/><circle cx="12" cy="15" r="1.5"' + F + '/>',
    book: '<path d="M12 6.5C10 5 7 4.5 4 5v13.5c3-.5 6 0 8 1.5 2-1.5 5-2 8-1.5V5c-3-.5-6 0-8 1.5zM12 6.5V20"/>',
    flag: '<path d="M5 21V4M5 4.5h11l-2 3.5 2 3.5H5"/>',
    crown: '<path d="M4 18h16M4.5 15 3.5 7l5 4 3.5-6 3.5 6 5-4-1 8z"/>',
    apple: '<path d="M12 7.5c-1.5-1-4.5-1.2-6 1-1.8 2.7-.6 7.8 2.2 10 1.3 1 2.5.6 3.8 0 1.3.6 2.5 1 3.8 0 2.8-2.2 4-7.3 2.2-10-1.5-2.2-4.5-2-6-1z"/><path d="M12 7.5c0-2 1-3.5 2.5-4"/>',
    gem: '<path d="M6.5 4h11l3.5 5-9 11L3 9z"/><path d="M3 9h18M9.5 4 8 9l4 11 4-11-1.5-5"/>',
    medal: '<circle cx="12" cy="15" r="5"/><path d="M8.5 11 5.5 3.5h4L12 9l2.5-5.5h4L15.5 11"/>',
    brain: '<path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3z"/>',
    target: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4.5"/><circle cx="12" cy="12" r="1.4"' + F + '/>',
    bolt: '<path d="M13 3 5 13.5h6L10 21l8.5-11h-6z"/>',
    ghost: '<path d="M5 20V11a7 7 0 0 1 14 0v9l-2.3-1.8L14.3 20 12 18.2 9.7 20l-2.4-1.8z"/><circle cx="9.5" cy="11" r="1.2"' + F + '/><circle cx="14.5" cy="11" r="1.2"' + F + '/>',
    portal: '<circle cx="12" cy="12" r="8"/><path d="M12 7.5a4.5 4.5 0 1 1-4.5 4.5M12 10.5a1.5 1.5 0 1 1-1.5 1.5"/>',
    shoe: '<path d="M3 16.5V8.5l4.5.5 1.5 3c2 1 5 1.5 8 1.5 2.2 0 4 1.2 4 3v1H3z"/><path d="M3 19.5h18"/>',
    globe: '<circle cx="12" cy="12" r="8.5"/><path d="M3.5 12h17M12 3.5c2.5 2.5 3.5 5.5 3.5 8.5s-1 6-3.5 8.5c-2.5-2.5-3.5-5.5-3.5-8.5s1-6 3.5-8.5z"/>',
    fire: '<path d="M12 21a6.5 6.5 0 0 0 6.5-6.5c0-4-3-6-4-9.5-1.5 2-2 3.5-2 5-1-1-1.8-2.3-2-4C8 8 5.5 10.5 5.5 14.5A6.5 6.5 0 0 0 12 21z"/>',
    vibrate: '<rect x="8" y="4" width="8" height="16" rx="2"/><path d="M4.5 8.5v7M19.5 8.5v7M2 10.5v3M22 10.5v3"/>',
    thread: '<path d="M3 17c3-6 5 4 8-2s5 3 8-4"/><circle cx="20" cy="7" r="2"' + F + '/>',
    dpad: '<path d="M9.5 3.5h5v6h6v5h-6v6h-5v-6h-6v-5h6z"/>',
    contrast: '<circle cx="12" cy="12" r="8.5"/><path d="M12 3.5v17a8.5 8.5 0 0 0 0-17z"' + F + '/>',
    info: '<circle cx="12" cy="12" r="8.5"/><path d="M12 11v5.5M12 7.8v.2"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    edit: '<path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16z"/><path d="M13.5 6.5l4 4"/>',
    trash: '<path d="M4.5 7h15M9.5 7V4.5h5V7M6.5 7l1 13h9l1-13"/>',
    hand: '<path d="M8 13V5.5a1.5 1.5 0 0 1 3 0V11M11 10V4a1.5 1.5 0 0 1 3 0v6M14 10V5.5a1.5 1.5 0 0 1 3 0V14c0 4-2.5 7-6 7-2.5 0-4-1.2-5.5-3.5L3.8 15a1.6 1.6 0 0 1 2.5-2L8 15"/>',
    keyboard: '<rect x="2.5" y="6" width="19" height="12" rx="2.5"/><path d="M6 10h.01M9.5 10h.01M13 10h.01M16.5 10h.01M7 14h10"/>',
    speaker: '<path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z"/><path d="M15.5 9a4 4 0 0 1 0 6"/>',
    fullscreen: '<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>'
  };
  function icon(name) {
    return '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (ICONS[name] || ICONS.star) + '</svg>';
  }
  function iconEl(name, cls) {
    const t = document.createElement('template');
    t.innerHTML = icon(name);
    const s = t.content.firstChild;
    if (cls) s.setAttribute('class', cls);
    return s;
  }

  // Совёнок Угуша — помощник
  const OWL = '<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M13 20 18 7l9 10z" fill="#7C5234"/><path d="M51 20 46 7l-9 10z" fill="#7C5234"/>' +
    '<ellipse cx="32" cy="37" rx="21" ry="23" fill="#A8744F"/><ellipse cx="32" cy="44" rx="13" ry="13" fill="#F3D9B1"/>' +
    '<path d="M20 50c2 3 4 4 6 4M44 50c-2 3-4 4-6 4" stroke="#C99A6C" stroke-width="2" fill="none" stroke-linecap="round"/>' +
    '<circle cx="23.5" cy="29" r="8.5" fill="#fff"/><circle cx="40.5" cy="29" r="8.5" fill="#fff"/>' +
    '<circle cx="24.5" cy="30" r="4.4" fill="#2A1E14"/><circle cx="41.5" cy="30" r="4.4" fill="#2A1E14"/>' +
    '<circle cx="26" cy="28.3" r="1.5" fill="#fff"/><circle cx="43" cy="28.3" r="1.5" fill="#fff"/>' +
    '<path d="M28.5 35h7L32 40.5z" fill="#FFB020"/><path d="M12 52c10 5 30 5 40 0" stroke="#FF5B4F" stroke-width="5" fill="none" stroke-linecap="round"/></svg>';

  // ---------- Мини-холсты ----------
  function sizedCanvas(css) {
    const dpr = Math.min(root.devicePixelRatio || 1, 2);
    const c = document.createElement('canvas');
    c.width = Math.round(css * dpr); c.height = Math.round(css * dpr);
    const ctx = c.getContext('2d');
    ctx.scale(dpr, dpr);
    return [c, ctx];
  }
  function heroCanvas(heroId, css) {
    const [c, ctx] = sizedCanvas(css);
    S.drawHero(ctx, heroId, css / 2, css * 0.56, css * 1.15, { t: 0.4, lookX: 0, lookY: 0.4 });
    return c;
  }
  function itemCanvas(kind, css) {
    const [c, ctx] = sizedCanvas(css);
    S.drawItem(ctx, kind, css / 2, css / 2 + css * 0.04, css * 1.4, 0, 0);
    return c;
  }
  function keyCanvas(color, css) {
    const [c, ctx] = sizedCanvas(css);
    S.drawKey(ctx, L.KEY_COLORS[color], css / 2, css / 2 + css * 0.04, css * 1.5, 0);
    return c;
  }

  const MODE_COLORS = { classic: 'c-teal', time: 'c-sun', enemies: 'c-accent', dark: 'c-night', story: 'c-grape', daily: 'c-sky' };
  const AGE_COLORS = { tiny: 'var(--accent)', kid: 'var(--sun-deep)', teen: 'var(--teal)', pro: 'var(--grape)' };
  const isTouch = () => { try { return root.matchMedia('(pointer: coarse)').matches; } catch (e) { return false; } };

  const UI = {
    screensEl: null, current: null, anim: null, owlTimer: null, hudSig: '', hudEls: null,

    init() {
      this.screensEl = document.getElementById('screens');
      document.getElementById('btnPause').innerHTML = icon('pause');
      document.getElementById('btnMap').innerHTML = icon('map');
      document.getElementById('btnHint').innerHTML = icon('yarn') + '<span class="badge" id="hintCount"></span>';
      document.querySelectorAll('#dpad button').forEach(b => { b.innerHTML = icon('next'); });
      document.getElementById('btnPause').addEventListener('click', () => MZ.app.pause());
      document.getElementById('btnHint').addEventListener('click', () => MZ.app.hint());
      document.getElementById('btnMap').addEventListener('click', () => MZ.app.toggleOverview());
      const modal = document.getElementById('modal');
      modal.addEventListener('click', e => { if (e.target === modal && this.modalDismiss) this.closeModal(true); });
      root.addEventListener('keydown', e => {
        if (e.key === 'Escape' && !modal.hidden && this.modalDismiss) { e.preventDefault(); this.closeModal(true); }
      });
    },

    // ---------- Экраны ----------
    show(name, arg) {
      this.stopAnim();
      this.aiListener = null;
      this.closeModal();
      this.screensEl.innerHTML = '';
      this.current = name;
      const node = this[name](arg);
      if (node) {
        this.screensEl.appendChild(node);
        node.scrollTop = 0;
      }
      MZ.audio.startMusic('menu');
    },
    hideScreens() { this.stopAnim(); this.screensEl.innerHTML = ''; this.current = null; },
    stopAnim() { if (this.anim) cancelAnimationFrame(this.anim); this.anim = null; },

    screen(children) { return el('section', { class: 'screen' }, el('div', { class: 'wrap' }, children)); },
    backBtn(action, label) {
      return el('button', { class: 'icon-btn', type: 'button', 'aria-label': label || 'Назад', html: icon('back'), onclick: () => { MZ.audio.play('click'); action(); } });
    },
    topbar(back, title, right) {
      return el('div', { class: 'topbar' }, [back, el('div', { class: 'grow' }, title ? el('h2', { text: title }) : null)].concat(right || []));
    },

    // Онбординг: возраст → герой и имя
    welcome(opts) {
      opts = opts || {};
      const st = this.welcomeState = this.welcomeState && opts.keep ? this.welcomeState :
        { step: 1, age: opts.age || null, hero: opts.hero || 'hedgehog', name: opts.name || '', canBack: !!opts.canBack, editId: opts.editId || null };
      const redraw = () => { this.screensEl.innerHTML = ''; this.screensEl.appendChild(this.welcome({ keep: true })); };
      const dots = el('div', { class: 'steps-dots', 'aria-hidden': 'true' }, [el('i', { class: st.step === 1 ? 'on' : '' }), el('i', { class: st.step === 2 ? 'on' : '' })]);
      if (st.step === 1) {
        const ages = L.AGE_ORDER.map(id => {
          const a = L.AGES[id];
          return el('button', {
            class: 'patch age-card' + (st.age === id ? ' is-selected' : ''), type: 'button', style: { '--c': AGE_COLORS[id] },
            onclick: () => {
              MZ.audio.unlock(); MZ.audio.play('click');
              st.age = id; st.step = 2; redraw();
              if (id === 'tiny') MZ.audio.say('Выбери своего героя!', true);
            }
          }, [el('span', { class: 'age', text: id === 'pro' ? '13+' : a.label }), el('strong', { text: a.title }), el('small', { text: a.blurb })]);
        });
        return this.screen([
          el('div', { class: 'topbar' }, [st.canBack ? this.backBtn(() => MZ.app.home()) : null, el('div', { class: 'grow' }), dots]),
          el('div', { class: 'logo' }, [
            el('span', { class: 'eyebrow', text: st.editId ? 'Настройка игрока' : 'Добро пожаловать' }),
            el('h1', { html: 'Волшебный <span>клубок</span>' }),
            el('p', { class: 'tagline', text: 'Лабиринты, в которых клубочек подскажет дорогу, а совёнок подбодрит. Для малышей, школьников и взрослых.' })
          ]),
          el('div', { class: 'section-head' }, [el('h2', { text: 'Сколько лет игроку?' })]),
          el('p', { class: 'muted', text: 'От возраста зависят размер лабиринтов, подсказки и сложность. Поменять можно в настройках.' }),
          el('div', { class: 'ages' }, ages)
        ]);
      }
      const heroes = S.HEROES.map(h => {
        const c = heroCanvas(h.id, 96);
        return el('button', {
          class: 'patch hero-pick' + (st.hero === h.id ? ' is-selected' : ''), type: 'button', 'aria-label': h.name,
          onclick: () => { MZ.audio.play('click'); st.hero = h.id; redraw(); if (st.age === 'tiny') MZ.audio.say(h.name, true); }
        }, [c, el('span', { text: h.name })]);
      });
      const input = el('input', {
        class: 'input', id: 'playerName', type: 'text', maxlength: '16', autocomplete: 'off', placeholder: 'Можно пропустить',
        value: st.name, oninput: e => { st.name = e.target.value; }
      });
      return this.screen([
        el('div', { class: 'topbar' }, [this.backBtn(() => { st.step = 1; redraw(); }), el('div', { class: 'grow' }), dots]),
        el('div', { class: 'logo' }, [el('span', { class: 'eyebrow', text: L.AGES[st.age].label }), el('h2', { text: 'Выбери героя' })]),
        el('div', { class: 'heroes' }, heroes),
        el('div', { class: 'field' }, [el('label', { for: 'playerName', text: 'Как зовут игрока?' }), input]),
        el('button', {
          class: 'btn btn--xl btn--block', type: 'button', html: icon('play') + '<span>' + (st.editId ? 'Сохранить' : 'Поехали!') + '</span>',
          onclick: () => {
            MZ.audio.play('click');
            if (st.editId) MZ.app.updateProfile(st.editId, st.name, st.age, st.hero);
            else MZ.app.createProfile(st.name, st.age, st.hero);
            this.welcomeState = null;
          }
        })
      ]);
    },

    home() {
      const P = MZ.progress, p = P.active();
      const age = L.AGES[p.age];
      const lastMode = L.CAMPAIGN_MODES.indexOf(p.lastMode) >= 0 ? p.lastMode : 'classic';
      const mp = P.modeProgress(p, lastMode);
      const achDone = Object.keys(p.achievements).length;
      const art = el('canvas', { class: 'hero-art', 'aria-hidden': 'true' });
      const chipAvatar = heroCanvas(p.hero, 44);
      const modes = ['classic', 'time', 'enemies', 'dark', 'story', 'daily'].map(id => {
        const m = L.MODES[id];
        let meta;
        if (L.CAMPAIGN_MODES.indexOf(id) >= 0) {
          const stars = P.modeStars(p, id);
          meta = el('span', { class: 'meta', html: icon('star') + '<span class="num">' + stars + ' / ' + L.CAMPAIGN_LEVELS * 3 + '</span>' });
        } else if (id === 'daily') {
          const done = p.daily.results[MZ.util.todayKey()];
          meta = el('span', { class: 'meta', text: done ? 'Сегодня: ' + fmtTime(done.time) : (p.daily.streak ? 'Серия: ' + p.daily.streak + ' ' + plural(p.daily.streak, ['день', 'дня', 'дней']) : 'Ещё не пройден') });
        } else {
          meta = el('span', { class: 'meta', text: p.stats.storyWins ? 'Пройдено сказок: ' + p.stats.storyWins : 'Новая история каждый раз' });
        }
        return el('button', {
          class: 'patch mode-card ' + MODE_COLORS[id], type: 'button',
          onclick: () => { MZ.audio.play('click'); MZ.app.openMode(id); }
        }, [
          id === 'story' ? el('span', { class: 'badge-ai', text: 'ИИ' }) : null,
          el('span', { class: 'tile', html: icon(m.icon) }),
          el('h3', { text: m.name }), el('p', { text: m.desc }), meta
        ]);
      });
      const node = this.screen([
        el('div', { class: 'topbar' }, [
          el('button', { class: 'profile-chip', type: 'button', 'aria-label': 'Сменить игрока', onclick: () => { MZ.audio.play('click'); this.profilesModal(); } },
            [chipAvatar, el('span', { class: 'who' }, [el('strong', { text: p.name }), el('small', { text: age.label })])]),
          el('div', { class: 'grow' }),
          el('span', { class: 'stat-pill num', title: 'Звёзды', html: icon('star') + P.totalStars(p) }),
          el('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Настройки', html: icon('settings'), onclick: () => { MZ.audio.play('click'); this.show('settings'); } })
        ]),
        el('div', { class: 'patch hero' }, [
          art,
          el('div', { class: 'hero-copy' }, [
            el('div', { class: 'logo' }, [el('span', { class: 'eyebrow', text: 'Игра-лабиринт' }), el('h1', { html: 'Волшебный <span>клубок</span>' })]),
            el('p', { class: 'tagline', text: p.age === 'tiny' ? 'Собери все находки — и домик откроется!' : 'Собирай находки, ищи ключи от цветных дверец и доберись до домика.' }),
            el('button', {
              class: 'btn btn--xl', type: 'button', onclick: () => { MZ.audio.play('click'); MZ.app.continueGame(); },
              html: icon('play') + '<span class="play-stack">Играть<span class="play-sub">' + L.MODES[lastMode].name + ' · уровень ' + (Math.min(mp.unlocked, 999) + 1) + '</span></span>'
            })
          ])
        ]),
        el('div', { class: 'section-head' }, [el('h2', { text: 'Режимы' }), el('span', { class: 'eyebrow', text: age.title + ' · ' + age.label })]),
        el('div', { class: 'modes' }, modes),
        el('div', { class: 'duo' }, [
          el('button', { class: 'patch link-card', type: 'button', onclick: () => { MZ.audio.play('click'); this.show('records'); } },
            [el('span', { class: 'tile', html: icon('list') }), el('span', {}, [el('strong', { text: 'Рекорды' }), el('small', { text: 'Лучшие результаты' })])]),
          el('button', { class: 'patch link-card', type: 'button', onclick: () => { MZ.audio.play('click'); this.show('achievements'); } },
            [el('span', { class: 'tile', html: icon('trophy') }), el('span', {}, [el('strong', { text: 'Достижения' }), el('small', { class: 'num', text: achDone + ' из ' + P.ACHIEVEMENTS.length })])])
        ])
      ]);
      requestAnimationFrame(() => this.animateHeroArt(art, p.hero));
      return node;
    },

    // Живая мини-сцена на главной: герой идёт по лабиринту к домику, за ним тянется нить
    animateHeroArt(canvas, heroId) {
      const rect = canvas.getBoundingClientRect();
      if (!rect.width) return;
      const dpr = Math.min(root.devicePixelRatio || 1, 2);
      canvas.width = Math.round(rect.width * dpr); canvas.height = Math.round(rect.height * dpr);
      const ctx = canvas.getContext('2d');
      const cols = 8, rows = 5;
      const g = MZ.maze.generate('backtracker', cols, rows, null, makeRng('home-art-3'));
      MZ.maze.braid(g, 0.3, makeRng('home-braid'));
      const start = g.idx(0, rows - 1), exit = g.idx(cols - 1, 0);
      const path = MZ.maze.pathTo(MZ.maze.bfs(g, start).prev, start, exit);
      const w = L.WORLDS[0];
      const cell = Math.min(rect.width / (cols + 0.8), rect.height / (rows + 0.8));
      const ox = (rect.width - cols * cell) / 2, oy = (rect.height - rows * cell) / 2;
      const hero = S.heroById(heroId);
      const reduced = MZ.util.reducedMotion();
      let t0 = performance.now();
      const frame = now => {
        if (!canvas.isConnected) return;
        const t = (now - t0) / 1000;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, rect.width, rect.height);
        ctx.save(); ctx.translate(ox, oy);
        S.roundRect(ctx, -cell * 0.3, -cell * 0.3 + cell * 0.12, cols * cell + cell * 0.6, rows * cell + cell * 0.6, cell * 0.4);
        ctx.fillStyle = w.shadow; ctx.fill();
        S.roundRect(ctx, -cell * 0.3, -cell * 0.3, cols * cell + cell * 0.6, rows * cell + cell * 0.6, cell * 0.4);
        ctx.fillStyle = w.floor[0]; ctx.fill();
        ctx.lineCap = 'round'; ctx.strokeStyle = w.wall; ctx.lineWidth = cell * 0.18;
        ctx.beginPath();
        for (let i = 0; i < g.n; i++) {
          const x = g.x(i) * cell, y = g.y(i) * cell;
          if (!g.isOpen(i, 0)) { ctx.moveTo(x, y); ctx.lineTo(x + cell, y); }
          if (!g.isOpen(i, 3)) { ctx.moveTo(x, y); ctx.lineTo(x, y + cell); }
          if (g.y(i) === rows - 1) { ctx.moveTo(x, y + cell); ctx.lineTo(x + cell, y + cell); }
          if (g.x(i) === cols - 1) { ctx.moveTo(x + cell, y); ctx.lineTo(x + cell, y + cell); }
        }
        ctx.stroke();
        const cycle = path.length / 3.2 + 2.2;
        const k = reduced ? path.length - 1 : Math.min(path.length - 1, ((t % cycle) * 3.2));
        const whole = Math.floor(k), f = k - whole;
        const pos = i => [g.x(path[i]) * cell + cell / 2, g.y(path[i]) * cell + cell / 2];
        ctx.strokeStyle = hero.thread; ctx.globalAlpha = 0.6; ctx.lineWidth = cell * 0.08;
        ctx.beginPath();
        for (let i = 0; i <= whole; i++) { const [x, y] = pos(i); if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y); }
        let hx, hy;
        if (whole < path.length - 1) { const a = pos(whole), b = pos(whole + 1); hx = a[0] + (b[0] - a[0]) * f; hy = a[1] + (b[1] - a[1]) * f; }
        else { [hx, hy] = pos(whole); }
        ctx.lineTo(hx, hy); ctx.stroke(); ctx.globalAlpha = 1;
        const [ex, ey] = pos(path.length - 1);
        const arrived = whole >= path.length - 1;
        S.drawHouse(ctx, ex, ey, cell, true, 0, t, arrived ? 1 : 0.3);
        S.drawItem(ctx, 'apple', g.x(g.idx(3, 2)) * cell + cell / 2, g.y(g.idx(3, 2)) * cell + cell / 2, cell, t, 0);
        let lx = 0, ly = 0;
        if (whole < path.length - 1) { const a = pos(whole), b = pos(whole + 1); lx = Math.sign(b[0] - a[0]); ly = Math.sign(b[1] - a[1]); }
        S.drawHero(ctx, heroId, hx, hy, cell * 1.1, { t, lookX: lx, lookY: ly, moving: !arrived && !reduced, blink: (t % 3.3) < 0.12 ? 1 : 0 });
        ctx.restore();
        this.anim = reduced ? null : requestAnimationFrame(frame);
      };
      this.anim = requestAnimationFrame(frame);
    },

    levels(mode) {
      const P = MZ.progress, p = P.active();
      const mp = P.modeProgress(p, mode);
      const m = L.MODES[mode];
      const worlds = L.WORLDS.map((w, wi) => {
        let stars = 0;
        const btns = [];
        for (let k = 0; k < L.LEVELS_PER_WORLD; k++) {
          const idx = wi * L.LEVELS_PER_WORLD + k;
          const rec = mp.levels[idx];
          if (rec) stars += rec.stars;
          const locked = idx > mp.unlocked;
          const next = idx === mp.unlocked;
          const name = MZ.ai.levelName(p.age, idx) || L.localTitle(idx);
          const starRow = el('span', { class: 'stars' }, [0, 1, 2].map(s => iconEl('star', rec && rec.stars > s ? 'on' : '')));
          btns.push(el('button', {
            class: 'lvl' + (rec ? ' is-done' : '') + (next ? ' is-next' : '') + (locked ? ' is-locked' : ''), type: 'button',
            'aria-label': 'Уровень ' + (idx + 1) + ': ' + name + (locked ? ' (закрыт)' : ''), title: name,
            onclick: () => {
              if (locked) { MZ.audio.play('locked'); this.toast('Сначала пройди уровень ' + (mp.unlocked + 1), 'lock'); return; }
              MZ.audio.play('click'); MZ.app.startCampaign(mode, idx);
            }
          }, locked ? [iconEl('lock', 'lock')] : [el('span', { text: String(idx + 1) }), starRow]));
        }
        return el('div', { class: 'patch world' }, [
          el('div', { class: 'world-head' }, [
            el('span', { class: 'world-swatch', style: { background: 'linear-gradient(145deg,' + w.bg[0] + ',' + w.bg[1] + ')' } }),
            el('div', { class: 'grow' }, [el('h3', { text: w.name }), el('small', { class: 'num', text: '★ ' + stars + ' / ' + L.LEVELS_PER_WORLD * 3 })])
          ]),
          el('div', { class: 'levels-grid' }, btns)
        ]);
      });
      const endless = mp.unlocked >= L.CAMPAIGN_LEVELS ? el('div', { class: 'patch endless' }, [
        el('div', { class: 'grow' }, [el('h3', { text: 'Бесконечные лабиринты' }), el('p', { class: 'muted', text: 'Все 40 уровней пройдены! Дальше — самые сложные лабиринты без конца.' })]),
        el('button', { class: 'btn btn--grape', type: 'button', html: icon('play') + '<span>Уровень ' + (mp.unlocked + 1) + '</span>', onclick: () => MZ.app.startCampaign(mode, mp.unlocked) })
      ]) : null;
      return this.screen([
        this.topbar(this.backBtn(() => MZ.app.home()), m.name, [el('span', { class: 'stat-pill num', html: icon('star') + P.modeStars(p, mode) })]),
        el('p', { class: 'muted', text: m.desc + '. ' + L.AGES[p.age].title + ' · ' + L.AGES[p.age].label }),
        endless
      ].concat(worlds));
    },

    // Сказка от ИИ
    story() {
      const p = MZ.progress.active();
      const st = this.storyState = this.storyState || { theme: 'any', story: null };
      if (!st.story || st.story.age !== p.age) st.story = MZ.app.pickStory(st.theme);
      const s = st.story;
      const aiLine = el('div', { class: 'ai-line' });
      const paintAi = () => {
        const ready = MZ.ai.storiesReady(p.age);
        const status = MZ.ai.available() ? MZ.ai.status : 'offline';
        aiLine.innerHTML = '';
        aiLine.appendChild(el('span', { class: 'ai-dot ' + (status === 'working' ? 'working' : status === 'offline' ? 'offline' : 'ok') }));
        aiLine.appendChild(el('span', {
          text: status === 'offline' ? 'ИИ-сказочник сейчас отдыхает — сказки из волшебной книжки' :
            status === 'working' ? 'ИИ-сказочник сочиняет новую сказку… (готово: ' + ready + ')' :
              'ИИ-сказочник готов · сказок в запасе: ' + ready
        }));
      };
      paintAi();
      this.aiListener = paintAi;
      const chips = MZ.story.THEMES.map(th => el('button', {
        class: 'chip-btn' + (st.theme === th.id ? ' is-on' : ''), type: 'button', text: th.label,
        onclick: () => { MZ.audio.play('click'); st.theme = th.id; st.story = MZ.app.pickStory(th.id); this.show('story'); }
      }));
      const w = L.WORLDS[Math.max(0, ['forest', 'sea', 'candy', 'snow', 'space'].indexOf(s.world))];
      const tags = [
        el('span', { class: 'tag' + (s.ai ? ' tag--ai' : ''), html: icon(s.ai ? 'sparkle' : 'book') + (s.ai ? 'Сочинил ИИ' : 'Из книжки сказок') }),
        el('span', { class: 'tag', text: w.name })
      ];
      if (s.shape || s.art) tags.push(el('span', { class: 'tag', text: 'Форма: ' + (s.art ? 'рисунок ИИ' : (MZ.maze.SHAPE_NAMES[s.shape] || s.shape)) }));
      if (s.keys) tags.push(el('span', { class: 'tag', html: icon('key') + s.keys }));
      if (s.enemies) tags.push(el('span', { class: 'tag', html: icon('bug') + s.enemies }));
      if (s.portals) tags.push(el('span', { class: 'tag', html: icon('portal') + s.portals }));
      if (s.dark) tags.push(el('span', { class: 'tag', html: icon('moon') + 'Ночь' }));
      return this.screen([
        this.topbar(this.backBtn(() => { this.aiListener = null; MZ.app.home(); }), 'Сказка'),
        aiLine,
        el('div', { class: 'chips', role: 'tablist' }, chips),
        el('div', { class: 'patch story-card' }, [
          el('div', { class: 'story-tags' }, tags),
          el('h2', { text: s.title }),
          el('p', { class: 'story-intro', text: s.intro }),
          s.goal ? el('p', { class: 'muted', text: s.goal }) : null,
          el('div', { class: 'story-actions' }, [
            el('button', { class: 'btn btn--xl btn--grape btn--block', type: 'button', html: icon('play') + '<span>Играть</span>', onclick: () => { MZ.audio.play('click'); MZ.app.startStory(s); st.story = null; } }),
            el('div', { class: 'row' }, [
              el('button', { class: 'btn btn--ghost grow', type: 'button', html: icon('restart') + '<span>Другая сказка</span>', onclick: () => { MZ.audio.play('click'); st.story = MZ.app.pickStory(st.theme, true); this.show('story'); } }),
              MZ.audio.canSpeak() ? el('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Прочитать вслух', html: icon('speaker'), onclick: () => MZ.audio.say(s.title + '. ' + s.intro, true) }) : null
            ])
          ])
        ]),
        el('p', { class: 'muted', text: 'ИИ-сказочник сочиняет истории заранее, пока ты играешь, — поэтому ждать не нужно. Он выбирает мир, форму лабиринта, ключи, сторожей и даже рисует силуэт лабиринта.' })
      ]);
    },

    records(tab) {
      const P = MZ.progress, me = P.active();
      tab = tab || 'all';
      const tabs = [['all', 'Все']].concat(['classic', 'time', 'enemies', 'dark', 'story', 'daily'].map(id => [id, L.MODES[id].name]));
      const filter = { mode: tab, limit: 25 };
      if (tab === 'daily') filter.day = MZ.util.todayKey();
      const list = P.records(filter);
      const players = P.profiles().map(p => el('div', { class: 'patch player-card' }, [
        heroCanvas(p.hero, 40),
        el('div', { class: 'grow' }, [el('strong', { text: p.name }), el('small', { class: 'num', text: '★ ' + P.totalStars(p) + ' · ' + p.stats.wins + ' ' + plural(p.stats.wins, ['победа', 'победы', 'побед']) })])
      ]));
      let body;
      if (!list.length) {
        body = el('div', { class: 'empty' }, [iconEl('trophy'), el('p', { text: tab === 'daily' ? 'Сегодня лабиринт дня ещё никто не прошёл. Будь первым!' : 'Здесь появятся лучшие результаты. Пройди любой уровень!' })]);
      } else {
        const rows = list.map((r, k) => {
          const place = k + 1;
          const lvl = r.mode === 'story' || r.mode === 'daily' ? L.MODES[r.mode].name : L.MODES[r.mode].name + ' · ' + (r.index + 1);
          return el('tr', { class: (place <= 3 ? 'place-' + place : '') + (r.pid === me.id ? ' mine' : '') }, [
            el('td', { class: 'num place', text: String(place) }),
            el('td', {}, el('div', { class: 'who' }, [heroCanvas(r.hero, 30), el('div', { class: 'who-txt' }, [
              el('span', { class: 'nm', text: r.name }), el('small', { text: lvl + (r.title && r.mode !== 'daily' ? ' · ' + r.title : '') })
            ])])),
            el('td', { class: 'num', text: fmtTime(r.time) }),
            el('td', { class: 'num score' }, [el('span', { text: String(r.score) }), el('small', { class: 'stars-txt', text: '★'.repeat(r.stars) })])
          ]);
        });
        body = el('table', { class: 'board' }, [
          el('thead', {}, el('tr', {}, ['#', 'Игрок и уровень', 'Время', 'Очки'].map(h => el('th', { text: h })))),
          el('tbody', {}, rows)
        ]);
      }
      return this.screen([
        this.topbar(this.backBtn(() => MZ.app.home()), 'Рекорды'),
        el('div', { class: 'players' }, players),
        el('div', { class: 'tabs', role: 'tablist' }, tabs.map(([id, name]) => el('button', {
          class: 'tab' + (tab === id ? ' is-on' : ''), type: 'button', role: 'tab', 'aria-selected': tab === id ? 'true' : 'false', text: name,
          onclick: () => { MZ.audio.play('click'); this.show('records', id); }
        }))),
        tab === 'daily' ? el('p', { class: 'muted', text: 'Лабиринт дня одинаковый для всех игроков одного возраста. Лучшее время побеждает! Твоя серия: ' + me.daily.streak + ' ' + plural(me.daily.streak, ['день', 'дня', 'дней']) + '.' }) : null,
        el('div', { class: 'patch' }, body)
      ]);
    },

    achievements() {
      const P = MZ.progress;
      const list = P.achievementList();
      const done = list.filter(a => a.unlocked).length;
      return this.screen([
        this.topbar(this.backBtn(() => MZ.app.home()), 'Достижения'),
        el('div', { class: 'patch ach-summary' }, [
          el('span', { class: 'big num', text: done + '/' + list.length }),
          el('div', { class: 'bar' }, el('i', { style: { width: Math.round(done / list.length * 100) + '%' } }))
        ]),
        el('div', { class: 'ach-grid' }, list.map(a => el('div', { class: 'patch ach' + (a.unlocked ? ' is-on' : '') }, [
          el('span', { class: 'medal', html: icon(a.unlocked ? a.def.icon : 'lock') }),
          el('div', { class: 'body' }, [
            el('strong', { text: a.def.title }), el('small', { text: a.def.desc }),
            a.unlocked ? el('div', { class: 'prog', text: 'Получено ' + new Date(a.at).toLocaleDateString('ru-RU') }) :
              el('div', { class: 'prog' }, [el('div', { class: 'bar' }, el('i', { style: { width: Math.round(a.value / a.def.target * 100) + '%' } })), el('span', { class: 'num', text: a.value + '/' + a.def.target })])
          ])
        ])))
      ]);
    },

    settings() {
      const P = MZ.progress, p = P.active(), set = P.settings;
      const sw = (key, title, sub, ic, onChange, disabled) => {
        const input = el('input', { type: 'checkbox', id: 'set-' + key, role: 'switch', 'aria-label': title });
        input.checked = !!set[key];
        if (disabled) input.disabled = true;
        input.addEventListener('change', () => { P.setSetting(key, input.checked); MZ.app.applySettings(); MZ.audio.play('click'); if (onChange) onChange(input.checked); });
        return el('div', { class: 'set-row' }, [
          el('span', { class: 'ico', html: icon(ic) }),
          el('label', { class: 'txt', for: 'set-' + key }, [el('strong', { text: title }), sub ? el('small', { text: sub }) : null]),
          el('span', { class: 'switch' }, [input, el('i')])
        ]);
      };
      const seg = (items, cur, onPick) => el('div', { class: 'seg' }, items.map(([v, label]) => el('button', {
        type: 'button', class: v === cur ? 'is-on' : '', text: label, onclick: () => { MZ.audio.play('click'); onPick(v); }
      })));
      const aiStatus = el('small');
      const paintAi = () => {
        const s = MZ.ai.cache.stats;
        const st = !MZ.ai.userEnabled() ? 'выключен' : MZ.ai.available() ? (MZ.ai.status === 'working' ? 'думает…' : 'на связи') : 'временно недоступен';
        aiStatus.textContent = 'Статус: ' + st + (s.ok ? ' · ответов: ' + s.ok + (s.avgMs ? ', в среднем ' + Math.round(s.avgMs / 1000) + ' с' : '') : '') + (s.model ? ' · ' + s.model : '');
      };
      paintAi();
      this.aiListener = paintAi;
      const adult = el('div', { class: 'row' });
      const lockBtn = el('button', {
        class: 'btn btn--ghost hold-btn', type: 'button', html: icon('lock') + '<span>Удерживайте 2 секунды</span><i></i>'
      });
      this.holdToConfirm(lockBtn, () => {
        adult.innerHTML = '';
        adult.appendChild(el('button', { class: 'btn btn--sun', type: 'button', html: icon('restart') + '<span>Сбросить прогресс</span>', onclick: () => this.confirm('Сбросить весь прогресс игрока «' + p.name + '»?', () => { P.resetProfile(p.id); this.toast('Прогресс сброшен', 'check'); this.show('settings'); }) }));
        adult.appendChild(el('button', { class: 'btn', type: 'button', html: icon('trash') + '<span>Удалить игрока</span>', onclick: () => this.confirm('Удалить игрока «' + p.name + '» и его рекорды?', () => { P.deleteProfile(p.id); MZ.app.afterProfileChange(); }) }));
      });
      adult.appendChild(lockBtn);
      const canVibrate = typeof navigator !== 'undefined' && 'vibrate' in navigator;
      return this.screen([
        this.topbar(this.backBtn(() => { this.aiListener = null; MZ.app.home(); }), 'Настройки'),
        el('div', { class: 'patch' }, el('div', { class: 'profile-panel' }, [
          el('div', { class: 'profile-item is-on' }, [heroCanvas(p.hero, 40), el('div', { class: 'grow' }, [el('strong', { text: p.name }), el('small', { text: L.AGES[p.age].title + ' · ' + L.AGES[p.age].label })]),
            el('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Изменить игрока', html: icon('edit'), onclick: () => this.show('welcome', { canBack: true, editId: p.id, age: p.age, hero: p.hero, name: p.name }) })]),
          el('div', { class: 'row' }, [
            el('span', { class: 'eyebrow', text: 'Возраст' }),
            seg(L.AGE_ORDER.map(id => [id, L.AGES[id].label.replace(' и взрослые', '')]), p.age, v => { P.updateProfile(p.id, { age: v }); MZ.app.applySettings(); this.show('settings'); })
          ]),
          el('button', { class: 'btn btn--ghost', type: 'button', html: icon('users') + '<span>Сменить игрока</span>', onclick: () => this.profilesModal() })
        ])),
        el('div', { class: 'patch set-list' }, [
          sw('sound', 'Звуки', 'Шаги, находки, дверцы', 'sound'),
          sw('music', 'Музыка', 'Тихая мелодия в каждом мире', 'music'),
          sw('voice', 'Озвучка', MZ.audio.canSpeak() ? 'Совёнок читает подсказки вслух' : 'Браузер не умеет говорить', 'speaker', null, !MZ.audio.canSpeak()),
          canVibrate ? sw('vibration', 'Вибрация', 'Лёгкий отклик на телефоне', 'vibrate') : null,
          sw('trail', 'Нить-след', 'Показывает, где герой уже был', 'thread'),
          sw('dpad', 'Кнопки-стрелки', 'Экранный джойстик вместо свайпов', 'dpad'),
          sw('glide', 'Бег до развилки', 'Выкл — одно нажатие = одна клетка', 'path')
        ]),
        this.voiceSettings(set, seg),
        el('div', { class: 'patch set-list' }, [
          el('div', { class: 'set-row' }, [el('span', { class: 'ico', html: icon('contrast') }), el('div', { class: 'txt' }, [el('strong', { text: 'Тема' }), el('small', { text: 'Светлая, тёмная или как в системе' })]),
            seg([['auto', 'Авто'], ['light', 'Светлая'], ['dark', 'Тёмная']], set.theme, v => { P.setSetting('theme', v); MZ.app.applySettings(); this.show('settings'); })])
        ]),
        el('div', { class: 'patch set-list' }, [
          sw('ai', 'ИИ-помощник', 'Сказки, названия уровней и фразы совёнка', 'sparkle', () => paintAi()),
          el('div', { class: 'set-row' }, [el('span', { class: 'ico', html: icon('info') }), el('div', { class: 'txt' }, [el('strong', { text: 'Связь с ИИ' }), aiStatus]),
            el('button', {
              class: 'btn btn--ghost', type: 'button', text: 'Проверить', onclick: async e => {
                const b = e.currentTarget; b.disabled = true; b.textContent = 'Ждём…';
                const r = await MZ.ai.ping();
                b.disabled = false; b.textContent = 'Проверить';
                this.toast(r ? 'ИИ на связи: ' + (r.hello || 'привет!') : 'ИИ не ответил — игра работает и без него', r ? 'sparkle' : 'info');
                paintAi();
              }
            })])
        ]),
        el('div', { class: 'patch help-list' }, [
          el('h3', { text: 'Как играть' }),
          el('div', {}, [iconEl('hand'), el('p', { text: 'Одно движение — один шаг: проведи пальцем в сторону или коснись экрана рядом с героем. Не отпускай палец — герой пойдёт дальше.' })]),
          el('div', {}, [iconEl('path'), el('p', { text: 'Малышам проще так: поставь палец на героя и веди его по дорожке.' })]),
          el('div', {}, [iconEl('keyboard'), el('p', { text: 'На компьютере — стрелки или WASD: нажатие — шаг, удержание — идёт дальше. Пробел — подсказка, Esc — пауза, колёсико — масштаб.' })]),
          el('div', {}, [iconEl('key'), el('p', { text: 'Цветной ключ открывает дверцу такого же цвета. Собери все находки — домик откроется.' })]),
          el('div', {}, [iconEl('yarn'), el('p', { text: 'Клубочек покажет дорогу к ближайшей цели. Два пальца — приблизить или отдалить лабиринт.' })])
        ]),
        el('div', { class: 'patch' }, el('div', { class: 'help-list', style: { padding: '0' } }, [
          el('h3', { text: 'Для взрослых' }),
          el('p', { class: 'muted', text: 'Сброс прогресса и удаление игрока защищены от случайного нажатия.' }),
          adult
        ])),
        el('p', { class: 'muted', style: { textAlign: 'center', fontSize: '13px' }, text: 'Волшебный клубок · версия ' + MZ.config.version + ' · всё сохраняется только на этом устройстве' })
      ]);
    },

    // Голос совёнка: выбор голоса, скорость речи, проверка
    voiceSettings(set, seg) {
      const P = MZ.progress;
      if (!MZ.audio.canSpeak()) return null;
      const voices = MZ.audio.voices();
      const sel = el('select', { class: 'select', id: 'set-voiceName', 'aria-label': 'Голос' });
      sel.appendChild(el('option', { value: '', text: voices.length ? 'Лучший доступный' : 'Голоса загружаются…' }));
      voices.forEach(v => {
        const o = el('option', { value: v.name, text: v.name.replace(/Microsoft |Google |\(.*?\)/g, '').trim() || v.name });
        if (v.name === set.voiceName) o.selected = true;
        sel.appendChild(o);
      });
      sel.addEventListener('change', () => { P.setSetting('voiceName', sel.value); MZ.app.applySettings(); MZ.audio.say('Привет! Так я звучу.', true); });
      return el('div', { class: 'patch set-list' }, [
        el('div', { class: 'set-row' }, [el('span', { class: 'ico', html: icon('speaker') }),
          el('div', { class: 'txt' }, [el('strong', { text: 'Голос совёнка' }), el('small', { text: 'Самые чёткие — с пометкой Natural, Online или «улучшенный»' })]), sel]),
        el('div', { class: 'set-row' }, [el('span', { class: 'ico', html: icon('clock') }),
          el('div', { class: 'txt' }, [el('strong', { text: 'Скорость речи' }), el('small', { text: 'Малышам понятнее медленно' })]),
          seg([['slow', 'Медленно'], ['normal', 'Обычно']], set.speech || 'normal', v => { P.setSetting('speech', v); MZ.app.applySettings(); MZ.audio.say('Собери три яблочка и открой домик!', true); this.show('settings'); })]),
        el('div', { class: 'set-row' }, [el('span', { class: 'ico', html: icon('sound') }),
          el('div', { class: 'txt' }, [el('strong', { text: 'Послушать' }), el('small', { text: 'Так совёнок говорит в игре' })]),
          el('button', { class: 'btn btn--ghost', type: 'button', text: 'Проверить', onclick: () => MZ.audio.say('Привет! Я совёнок Угуша. Собери две ракушки и открой домик!', true) })])
      ]);
    },

    // ---------- Модальные окна ----------
    openModal(children, dismiss) {
      const m = document.getElementById('modal');
      m.innerHTML = '';
      m.appendChild(el('div', { class: 'patch modal-card' }, children));
      m.hidden = false;
      this.modalDismiss = dismiss || null;
      const first = m.querySelector('button');
      if (first) setTimeout(() => { try { first.focus({ preventScroll: true }); } catch (e) { /* ignore */ } }, 50);
    },
    closeModal(byUser) {
      const m = document.getElementById('modal');
      if (m.hidden) return;
      m.hidden = true; m.innerHTML = '';
      const cb = this.modalDismiss; this.modalDismiss = null;
      if (byUser && cb) cb();
    },

    resultModal(res, info) {
      const lv = info.level;
      const phrase = MZ.ai.phrase('win', res.age);
      const stars = el('div', { class: 'big-stars', 'aria-label': res.stars + ' из 3 звёзд' }, [0, 1, 2].map(k => iconEl('star', res.stars > k ? 'on' : '')));
      for (let k = 0; k < res.stars; k++) setTimeout(() => MZ.audio.play('star', k), 250 + k * 300);
      const stats = el('div', { class: 'result-stats' }, [
        el('div', {}, [el('b', { text: fmtTime(res.time) }), el('small', { text: 'Время' })]),
        el('div', {}, [el('b', { text: String(res.steps) }), el('small', { text: 'Шагов' })]),
        el('div', {}, [el('b', { text: String(res.score) }), el('small', { text: 'Очки' })])
      ]);
      const ach = info.unlocked && info.unlocked.length ? el('div', { class: 'new-ach' }, info.unlocked.map(a => el('div', {}, [iconEl(a.icon), el('span', { text: 'Новое достижение: ' + a.title })]))) : null;
      const nextLabel = lv.mode === 'story' ? 'Новая сказка' : lv.mode === 'daily' ? 'К рекордам' : 'Дальше';
      this.openModal([
        el('span', { class: 'eyebrow', text: lv.title }),
        el('h2', { text: phrase }),
        stars,
        lv.story && lv.story.outro ? el('p', { class: 'cheer', text: lv.story.outro }) : null,
        info.newBest ? el('span', { class: 'ribbon', text: 'Новый рекорд!' }) : null,
        stats,
        res.optimal && res.age !== 'tiny' ? el('p', { class: 'muted', style: { fontSize: '14px' }, text: 'Самый короткий путь со всеми находками — около ' + res.optimal + ' ' + plural(res.optimal, ['шага', 'шагов', 'шагов']) + '.' }) : null,
        ach,
        el('div', { class: 'modal-actions' }, [
          el('button', { class: 'btn btn--xl btn--block', type: 'button', html: '<span>' + nextLabel + '</span>' + icon('next'), onclick: () => { MZ.audio.play('click'); MZ.app.next(); } }),
          el('div', { class: 'row' }, [
            el('button', { class: 'btn btn--ghost', type: 'button', html: icon('restart') + '<span>Ещё раз</span>', onclick: () => { MZ.audio.play('click'); MZ.app.retry(); } }),
            el('button', { class: 'btn btn--ghost', type: 'button', html: icon('home') + '<span>Меню</span>', onclick: () => { MZ.audio.play('click'); MZ.app.quit(); } })
          ])
        ])
      ]);
      if (res.age === 'tiny') MZ.audio.say(phrase);
    },

    loseModal(res) {
      const title = res.reason === 'time' ? 'Время вышло!' : 'Сторожа поймали!';
      const phrase = MZ.ai.phrase('lose', res.age);
      this.openModal([
        el('span', { class: 'eyebrow', text: res.title }),
        el('h2', { text: title }),
        el('p', { class: 'cheer', text: phrase }),
        el('div', { class: 'modal-actions' }, [
          el('button', { class: 'btn btn--xl btn--block btn--teal', type: 'button', html: icon('restart') + '<span>Ещё раз</span>', onclick: () => { MZ.audio.play('click'); MZ.app.retry(); } }),
          el('button', { class: 'btn btn--ghost btn--block', type: 'button', html: icon('home') + '<span>Меню</span>', onclick: () => { MZ.audio.play('click'); MZ.app.quit(); } })
        ])
      ]);
    },

    pauseModal(level) {
      const set = MZ.progress.settings;
      const toggle = (key, on, off, label) => {
        const b = el('button', { class: 'icon-btn', type: 'button', 'aria-label': label, 'aria-pressed': set[key] ? 'true' : 'false', html: icon(set[key] ? on : off) });
        b.addEventListener('click', () => {
          MZ.progress.setSetting(key, !set[key]); MZ.app.applySettings();
          b.innerHTML = icon(set[key] ? on : off); b.setAttribute('aria-pressed', set[key] ? 'true' : 'false');
          if (key === 'music' && set.music) MZ.audio.startMusic(level.world.id);
        });
        return b;
      };
      const goal = MZ.story.goalText(level);
      this.openModal([
        el('span', { class: 'eyebrow', text: level.world.name }),
        el('h2', { text: 'Пауза' }),
        el('p', { class: 'muted', text: goal }),
        el('div', { class: 'modal-actions' }, [
          el('button', { class: 'btn btn--xl btn--block btn--teal', type: 'button', html: icon('play') + '<span>Продолжить</span>', onclick: () => { MZ.audio.play('click'); MZ.app.resume(); } }),
          el('div', { class: 'row' }, [
            el('button', { class: 'btn btn--ghost', type: 'button', html: icon('restart') + '<span>Заново</span>', onclick: () => { MZ.audio.play('click'); MZ.app.retry(); } }),
            el('button', { class: 'btn btn--ghost', type: 'button', html: icon('home') + '<span>Меню</span>', onclick: () => { MZ.audio.play('click'); MZ.app.quit(); } })
          ]),
          el('div', { class: 'row' }, [toggle('sound', 'sound', 'mute', 'Звуки'), toggle('music', 'music', 'mute', 'Музыка')])
        ])
      ], () => MZ.app.resume());
    },

    profilesModal() {
      const P = MZ.progress, me = P.active();
      this.openModal([
        el('h2', { text: 'Кто играет?' }),
        el('div', { class: 'profile-list' }, P.profiles().map(p => el('button', {
          class: 'profile-item' + (p.id === me.id ? ' is-on' : ''), type: 'button',
          onclick: () => { MZ.audio.play('click'); this.closeModal(); MZ.app.switchProfile(p.id); }
        }, [heroCanvas(p.hero, 40), el('div', { class: 'grow' }, [el('strong', { text: p.name }), el('small', { class: 'num', text: L.AGES[p.age].label + ' · ★ ' + P.totalStars(p) })]),
          p.id === me.id ? iconEl('check') : null]))),
        el('div', { class: 'modal-actions' }, [
          el('button', { class: 'btn btn--sun btn--block', type: 'button', html: icon('plus') + '<span>Новый игрок</span>', onclick: () => { this.closeModal(); this.show('welcome', { canBack: true }); } }),
          el('button', { class: 'btn btn--ghost btn--block', type: 'button', text: 'Закрыть', onclick: () => this.closeModal() })
        ])
      ], () => {});
    },

    confirm(text, onYes) {
      this.openModal([
        el('h2', { text: 'Точно?' }), el('p', { class: 'muted', text: text }),
        el('div', { class: 'modal-actions' }, [
          el('button', { class: 'btn btn--block', type: 'button', text: 'Да', onclick: () => { this.closeModal(); onYes(); } }),
          el('button', { class: 'btn btn--ghost btn--block', type: 'button', text: 'Отмена', onclick: () => this.closeModal() })
        ])
      ], () => {});
    },

    // «Удерживайте кнопку» — родительский замок от случайных нажатий
    holdToConfirm(btn, done) {
      let raf = null, t0 = 0;
      const bar = () => btn.querySelector('i');
      const stop = () => { if (raf) cancelAnimationFrame(raf); raf = null; if (bar()) bar().style.width = '0'; };
      btn.addEventListener('pointerdown', e => {
        e.preventDefault(); t0 = performance.now();
        const tick = now => {
          const k = Math.min(1, (now - t0) / 2000);
          if (bar()) bar().style.width = (k * 100) + '%';
          if (k >= 1) { stop(); MZ.audio.play('door'); done(); return; }
          raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
      });
      ['pointerup', 'pointerleave', 'pointercancel'].forEach(ev => btn.addEventListener(ev, stop));
    },

    // ---------- HUD ----------
    showHud(level) {
      document.getElementById('hud').hidden = false;
      document.getElementById('hudBottom').hidden = false;
      document.getElementById('hudWorld').textContent = level.mode === 'story' ? 'Сказка · ' + level.world.name :
        level.mode === 'daily' ? 'Лабиринт дня' : L.MODES[level.mode].name + ' · уровень ' + (level.index + 1);
      document.getElementById('hudLevel').textContent = level.title;
      document.getElementById('dpad').hidden = !MZ.progress.settings.dpad;
      const stats = document.getElementById('hudStats');
      stats.innerHTML = '';
      const itemsChip = el('div', { class: 'hchip', 'aria-label': 'Находки' }, [itemCanvas(level.world.item, 32), el('span', { class: 'v' })]);
      const keysChip = el('div', { class: 'hchip', 'aria-label': 'Ключи' });
      const timeChip = el('div', { class: 'hchip', 'aria-label': 'Время' }, [iconEl('clock'), el('span', { class: 'v' })]);
      const heartChip = el('div', { class: 'hchip', 'aria-label': 'Жизни' }, el('span', { class: 'hearts' }));
      const keyIcons = level.keys.map(k => { const c = keyCanvas(k.color, 32); keysChip.appendChild(c); return c; });
      stats.appendChild(itemsChip);
      if (level.keys.length) stats.appendChild(keysChip);
      if (level.rules.timer || level.rules.countUp) stats.appendChild(timeChip);
      if (level.rules.enemies && level.hearts > 0) stats.appendChild(heartChip);
      this.hudEls = { itemsChip, keysChip, timeChip, heartChip, keyIcons, hint: document.getElementById('hintCount'), hintBtn: document.getElementById('btnHint') };
      this.hudSig = '';
      document.getElementById('stage').style.background = 'radial-gradient(120% 90% at 50% 0%, ' + level.world.bg[0] + ', ' + level.world.bg[1] + ')';
      requestAnimationFrame(() => MZ.app.measureInsets());
    },
    hideHud() {
      document.getElementById('hud').hidden = true;
      document.getElementById('hudBottom').hidden = true;
      this.hideOwl(); this.hideIntro();
    },
    updateHud(game) {
      const h = this.hudEls, lv = game.level;
      if (!h || !lv) return;
      const t = lv.rules.timer ? Math.max(0, Math.ceil(game.timeLeft)) : Math.floor(game.elapsed);
      const keySig = lv.keys.map(k => (k.taken ? 1 : 0) + (game.keysHeld.has(k.color) ? 2 : 0)).join('');
      const sig = [game.remaining, keySig, t, game.hearts, game.hintsLeft, game.overtime ? 1 : 0].join('|');
      if (sig === this.hudSig) return;
      this.hudSig = sig;
      const got = lv.required - game.remaining;
      h.itemsChip.querySelector('.v').textContent = got + '/' + lv.required;
      h.itemsChip.classList.toggle('is-done', game.remaining <= 0);
      lv.keys.forEach((k, i) => {
        const c = h.keyIcons[i];
        const held = game.keysHeld.has(k.color);
        c.style.opacity = held ? '1' : '0.28';
        c.style.display = k.taken && !held ? 'none' : '';
      });
      if (lv.rules.timer) {
        h.timeChip.querySelector('.v').textContent = game.overtime ? '0:00' : fmtTime(t);
        h.timeChip.classList.toggle('is-warn', t <= 10);
      } else if (lv.rules.countUp) h.timeChip.querySelector('.v').textContent = fmtTime(t);
      if (lv.rules.enemies && lv.hearts > 0) {
        const box = h.heartChip.querySelector('.hearts');
        box.innerHTML = '';
        const total = Math.max(game.maxHearts, game.hearts);
        for (let k = 0; k < total; k++) box.appendChild(iconEl('heart', k < game.hearts ? '' : 'off'));
      }
      h.hint.textContent = game.hintsLeft > 50 ? '∞' : String(game.hintsLeft);
      h.hintBtn.disabled = game.hintsLeft <= 0;
      h.hintBtn.style.opacity = game.hintsLeft <= 0 ? '0.5' : '1';
    },
    hintAttention(on) { const b = document.getElementById('btnHint'); if (b) b.classList.toggle('is-attention', !!on); },

    owl(text, speak, ms) {
      if (!text) return;
      const o = document.getElementById('owl');
      o.innerHTML = OWL;
      o.appendChild(el('p', { text }));
      o.hidden = false;
      o.style.animation = 'none'; void o.offsetWidth; o.style.animation = '';
      clearTimeout(this.owlTimer);
      this.owlTimer = setTimeout(() => this.hideOwl(), ms || 3800);
      if (speak) MZ.audio.say(typeof speak === 'string' ? speak : text);
    },
    hideOwl() { clearTimeout(this.owlTimer); const o = document.getElementById('owl'); if (o) o.hidden = true; },

    intro(level) {
      const box = document.getElementById('intro');
      box.innerHTML = '';
      box.className = 'intro-card';
      const eyebrow = level.mode === 'story' ? 'Сказка' : level.mode === 'daily' ? 'Лабиринт дня · ' + MZ.util.todayKey() : level.world.name + ' · уровень ' + (level.index + 1);
      const how = isTouch() ? 'Свайп или касание — шаг на клетку' : 'Стрелки или WASD — шаг на клетку';
      const extras = [];
      if (level.rules.timer) extras.push('Успей за ' + fmtTime(level.timeLimit));
      if (level.rules.enemies) extras.push('Не касайся: ' + level.world.enemyName);
      if (level.rules.dark) extras.push('Темно! Светлячки дают свет');
      if (level.portals.length) extras.push('Порталы переносят');
      box.appendChild(el('span', { class: 'eyebrow', text: eyebrow }));
      box.appendChild(el('h2', { text: level.title }));
      box.appendChild(el('div', { class: 'goal' }, [itemCanvas(level.world.item, 36), el('span', { text: MZ.story.goalText(level) })]));
      if (extras.length) box.appendChild(el('p', { class: 'extra', text: extras.join(' · ') }));
      box.appendChild(el('span', { class: 'how', html: icon(isTouch() ? 'hand' : 'keyboard') + '<span>' + how + '</span>' }));
      box.hidden = false;
      clearTimeout(this.introTimer);
      this.introTimer = setTimeout(() => this.hideIntro(), 7000);
    },
    hideIntro() {
      const box = document.getElementById('intro');
      if (!box || box.hidden) return;
      clearTimeout(this.introTimer);
      box.classList.add('is-leaving');
      setTimeout(() => { box.hidden = true; box.classList.remove('is-leaving'); }, 300);
    },

    toast(text, ic) {
      const box = document.getElementById('toasts');
      const t = el('div', { class: 'toast', role: 'status' }, [ic ? iconEl(ic) : null, el('span', { text })]);
      box.appendChild(t);
      while (box.children.length > 3) box.removeChild(box.firstChild);
      setTimeout(() => { t.classList.add('is-leaving'); setTimeout(() => t.remove(), 320); }, 2600);
    }
  };

  UI.icon = icon;
  UI.iconEl = iconEl;
  UI.heroCanvas = heroCanvas;
  MZ.ui = UI;
})(typeof window !== 'undefined' ? window : globalThis);

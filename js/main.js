/* Точка входа и контроллер приложения: связывает игру, интерфейс, прогресс и ИИ */
(function (root) {
  'use strict';
  const MZ = root.MZ;
  const L = MZ.levels, P = MZ.progress, UI = MZ.ui, audio = MZ.audio, AI = MZ.ai;
  const { plural, todayKey, numWord } = MZ.util;

  const app = {
    renderer: null, game: null, input: null, spec: null, level: null, playing: false, last: 0,

    boot() {
      P.load();
      UI.init();
      const canvas = document.getElementById('game');
      this.renderer = new MZ.Renderer(canvas);
      this.game = new MZ.Game(this.renderer, {
        onWin: r => this.onWin(r), onLose: r => this.onLose(r),
        onEvent: (t, d) => this.onEvent(t, d), onStart: () => this.onStart()
      });
      this.input = new MZ.Input(canvas, this.renderer, {
        getGame: () => this.game,
        isActive: () => this.playing && document.getElementById('modal').hidden,
        onKey: e => this.onKey(e),
        onTraceStart: () => UI.hideIntro()
      });
      this.input.bindDpad(document.getElementById('dpad'));
      this.applySettings();

      const onResize = () => { if (this.playing) { this.renderer.resize(); this.measureInsets(); } };
      if (root.ResizeObserver) new ResizeObserver(onResize).observe(document.getElementById('stage'));
      root.addEventListener('resize', onResize);
      root.addEventListener('orientationchange', () => setTimeout(onResize, 250));
      document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
          if (this.playing && !this.game.paused && !this.game.won && !this.game.lost && this.game.started) this.pause();
          audio.suspend();
        } else audio.resume();
      });
      // Первый жест пользователя разблокирует звук — сразу включаем подходящую музыку
      const unlock = () => {
        const first = !audio.ctx;
        audio.unlock();
        if (first && audio.ctx) audio.startMusic(this.playing && this.level ? this.level.world.id : 'menu');
      };
      root.addEventListener('pointerdown', unlock, { passive: true });
      root.addEventListener('keydown', unlock);
      AI.onChange(() => { if (UI.aiListener) UI.aiListener(); });

      if (P.active()) this.home();
      else UI.show('welcome', {});
      requestAnimationFrame(t => { this.last = t; this.loop(t); });
      setTimeout(() => AI.prefetch(P.active()), (MZ.config.ai && MZ.config.ai.prefetchDelayMs) || 4000);
      this.registerSW();
    },

    loop(now) {
      const dt = Math.min(0.05, Math.max(0, (now - this.last) / 1000));
      this.last = now;
      if (this.playing) {
        this.game.update(dt);
        this.renderer.draw(this.game, dt);
        UI.updateHud(this.game);
      }
      requestAnimationFrame(t => this.loop(t));
    },

    measureInsets() {
      const hud = document.getElementById('hud'), bottom = document.getElementById('hudBottom');
      const top = hud.hidden ? 12 : hud.getBoundingClientRect().height + 4;
      const bot = bottom.hidden ? 12 : bottom.getBoundingClientRect().height + 2;
      const cs = getComputedStyle(hud);
      const side = Math.max(10, parseFloat(cs.paddingLeft) || 10);
      this.renderer.setInsets({ top, bottom: bot, left: side, right: Math.max(10, parseFloat(cs.paddingRight) || 10) });
    },
    aspect() {
      const w = root.innerWidth || 800, h = root.innerHeight || 600;
      const hudH = w < 520 ? 200 : 170;
      return Math.max(0.4, w - 24) / Math.max(200, h - hudH);
    },

    // ---------- Навигация ----------
    home() { this.stop(); UI.show('home'); },
    stop() {
      this.playing = false;
      this.input && this.input.releaseAll();
      UI.hideHud();
      document.getElementById('stage').hidden = true;
      if (root.speechSynthesis) try { root.speechSynthesis.cancel(); } catch (e) { /* ignore */ }
    },
    openMode(id) {
      if (id === 'story') UI.show('story');
      else if (id === 'daily') this.startDaily();
      else UI.show('levels', id);
    },
    continueGame() {
      const p = P.active();
      const mode = L.CAMPAIGN_MODES.indexOf(p.lastMode) >= 0 ? p.lastMode : 'classic';
      this.startCampaign(mode, P.modeProgress(p, mode).unlocked);
    },
    startCampaign(mode, index) {
      const p = P.active();
      p.lastMode = mode; P.save();
      this.startLevel(L.campaignSpec(p.age, mode, index, this.aspect()));
    },
    startDaily() { this.startLevel(L.dailySpec(P.active().age, todayKey())); },
    startStory(story) {
      const p = P.active();
      this.startLevel(MZ.story.levelSpec(story, p.age, this.aspect(), p.stats.storyWins));
    },
    pickStory(theme, forceNew) {
      const p = P.active();
      const heroName = MZ.sprites.heroById(p.hero).name;
      let s = AI.takeStory(p.age, theme);
      if (!s) s = MZ.story.local(p.age, heroName, theme, Date.now().toString(36) + (forceNew ? Math.random() : ''));
      AI.prefetch(p, { theme });
      return s;
    },

    startLevel(spec) {
      const p = P.active();
      let level;
      try { level = L.buildLevel(spec); } catch (e) {
        if (root.console) console.error(e);
        UI.toast('Не получилось построить уровень, попробуй другой', 'info');
        return;
      }
      if (L.CAMPAIGN_MODES.indexOf(spec.mode) >= 0) {
        const n = AI.levelName(p.age, spec.index);
        if (n) level.title = n;
      }
      this.spec = spec; this.level = level;
      UI.hideScreens(); UI.closeModal();
      document.getElementById('stage').hidden = false;
      UI.showHud(level);
      this.renderer.resize();
      this.measureInsets();
      this.game.start(level, { heroId: p.hero, showTrail: P.settings.trail, moveMode: P.settings.glide ? 'glide' : 'step' });
      this.playing = true;
      UI.updateHud(this.game);
      UI.hintAttention(false);
      UI.intro(level);
      audio.startMusic(level.world.id);
      if (p.age === 'tiny') setTimeout(() => audio.say(MZ.story.goalSpeech(level)), 400);
    },

    retry() { if (this.spec) this.startLevel(this.spec); },
    next() {
      const lv = this.level;
      if (!lv) return this.home();
      if (lv.mode === 'story') { this.stop(); UI.storyState = { theme: UI.storyState ? UI.storyState.theme : 'any', story: null }; UI.show('story'); }
      else if (lv.mode === 'daily') { this.stop(); UI.show('records', 'daily'); }
      else this.startCampaign(lv.mode, lv.index + 1);
    },
    quit() {
      const lv = this.level;
      this.stop();
      if (lv && L.CAMPAIGN_MODES.indexOf(lv.mode) >= 0) UI.show('levels', lv.mode);
      else UI.show('home');
    },
    pause() {
      if (!this.playing || this.game.won || this.game.lost || this.game.paused) return;
      this.game.paused = true;
      this.input.releaseAll();
      UI.hideIntro();
      UI.pauseModal(this.level);
    },
    resume() {
      UI.closeModal();
      if (this.playing) this.game.paused = false;
    },
    hint() {
      if (!this.playing || this.game.paused) return;
      if (this.game.useHint()) { UI.hideIntro(); UI.hintAttention(false); }
    },
    toggleOverview() {
      if (!this.playing) return;
      const on = this.renderer.toggleOverview();
      document.getElementById('btnMap').innerHTML = UI.icon(on ? 'zoom' : 'map');
      document.getElementById('btnMap').setAttribute('aria-label', on ? 'Приблизить' : 'Весь лабиринт');
    },

    // ---------- События игры ----------
    onStart() {
      UI.hideIntro();
      const age = P.active().age;
      if (Math.random() < 0.5) UI.owl(AI.phrase('start', age), false, 2600);
    },
    onEvent(type, d) {
      const p = P.active(), lv = this.level;
      const tiny = p.age === 'tiny';
      const w = lv.world;
      switch (type) {
        case 'collect':
          if (d.left > 0) {
            if (tiny) audio.say('Ещё ' + numWord(d.left, w.itemGender) + ' ' + plural(d.left, w.itemName) + '!');
            else if (Math.random() < 0.3) UI.owl(AI.phrase('collect', p.age), false, 2200);
          }
          UI.hintAttention(false);
          break;
        case 'exitOpen':
          UI.owl('Всё собрано! Домик открыт — беги туда!', tiny);
          break;
        case 'key':
          UI.owl(AI.phrase('key', p.age), tiny, 3000);
          break;
        case 'gateLocked': {
          const c = L.KEY_COLORS[d.color];
          UI.owl('Эту дверцу откроет ' + c.name + ' ключик!', tiny, 3000);
          break;
        }
        case 'exitLocked':
          UI.owl('Собери ещё ' + d.remaining + ' ' + plural(d.remaining, w.itemName) + ', и домик откроется!',
            tiny && 'Собери ещё ' + numWord(d.remaining, w.itemGender) + ' ' + plural(d.remaining, w.itemName) + ', и домик откроется!', 3200);
          break;
        case 'hit':
          if (tiny) UI.owl('Ой! Осторожно, ' + w.enemyName + '!', true, 2400);
          else if (d.hearts === 1) UI.owl('Осталась одна жизнь — будь внимательнее!', false, 2600);
          break;
        case 'stuck':
          UI.owl(AI.phrase('stuck', p.age), tiny, 4200);
          UI.hintAttention(true);
          break;
        case 'hint':
          UI.hintAttention(false);
          break;
        case 'noHints':
          UI.toast('Подсказки на этом уровне закончились', 'yarn');
          break;
        case 'overtime':
          UI.owl('Часики остановились, но ты можешь закончить!', tiny);
          break;
        case 'enemySleep':
          UI.owl('Тсс! Сторож уснул — спящего можно тихонько пройти.', tiny, 3400);
          break;
        case 'portal':
          if (!this.portalSeen) { this.portalSeen = true; UI.owl('Вжух! Порталы переносят в другое место.', tiny, 2600); }
          break;
      }
    },
    onWin(res) {
      const lv = this.level;
      const info = P.recordWin(res, { worldId: lv.world.id, timeLimit: lv.timeLimit });
      UI.hideOwl();
      UI.resultModal(res, { level: lv, newBest: info.newBest, unlocked: info.unlocked });
      if (info.unlocked.length) setTimeout(() => audio.play('achievement'), 1300);
      AI.prefetch(P.active());
    },
    onLose(res) {
      P.recordLoss(res);
      UI.hideOwl();
      UI.loseModal(res);
    },
    onKey(e) {
      if (e.defaultPrevented) return true;
      const modalOpen = !document.getElementById('modal').hidden;
      if (!this.playing || modalOpen) return false;
      switch (e.code) {
        case 'Escape': case 'KeyP': e.preventDefault(); this.pause(); return true;
        case 'Space': case 'KeyH': e.preventDefault(); this.hint(); return true;
        case 'KeyM': case 'KeyZ': e.preventDefault(); this.toggleOverview(); return true;
        case 'Equal': case 'NumpadAdd': e.preventDefault(); this.renderer.zoomBy(1.15); return true;
        case 'Minus': case 'NumpadSubtract': e.preventDefault(); this.renderer.zoomBy(1 / 1.15); return true;
      }
      return false;
    },

    // ---------- Профили и настройки ----------
    applySettings() {
      const s = P.settings, p = P.active();
      audio.configure({ sound: s.sound, music: s.music, voice: s.voice, vibration: s.vibration, speech: s.speech, voiceName: s.voiceName });
      const html = document.documentElement;
      if (s.theme === 'light' || s.theme === 'dark') html.setAttribute('data-theme', s.theme);
      else html.removeAttribute('data-theme');
      document.body.dataset.age = p ? p.age : '';
      if (this.game) { this.game.showTrail = s.trail !== false; this.game.moveMode = s.glide ? 'glide' : 'step'; }
      const dp = document.getElementById('dpad');
      if (dp) dp.hidden = !s.dpad;
    },
    createProfile(name, age, hero) {
      const p = P.createProfile(name, age, hero);
      this.applySettings();
      this.home();
      UI.toast('Привет, ' + p.name + '! Удачи в лабиринтах', 'sparkle');
      AI.prefetch(p);
    },
    updateProfile(id, name, age, hero) {
      P.updateProfile(id, { name, age, hero });
      this.applySettings();
      UI.show('settings');
      UI.toast('Сохранено', 'check');
    },
    switchProfile(id) {
      P.setActive(id);
      this.applySettings();
      this.home();
      AI.prefetch(P.active());
    },
    afterProfileChange() {
      this.applySettings();
      if (P.active()) this.home(); else UI.show('welcome', {});
    },

    registerSW() {
      try {
        if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
          navigator.serviceWorker.register('sw.js').catch(() => { /* офлайн-режим необязателен */ });
        }
      } catch (e) { /* ignore */ }
    }
  };

  MZ.app = app;

  // Отладка: ?debug показывает ошибки прямо на экране
  if (/[?&]debug\b/.test(location.search)) {
    const show = msg => {
      const d = document.createElement('div');
      d.className = 'fatal'; d.textContent = msg;
      document.body.appendChild(d);
    };
    root.addEventListener('error', e => show('Ошибка: ' + e.message + ' @ ' + (e.filename || '').split('/').pop() + ':' + e.lineno));
    root.addEventListener('unhandledrejection', e => show('Promise: ' + (e.reason && e.reason.message || e.reason)));
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => app.boot());
  else app.boot();
})(typeof window !== 'undefined' ? window : globalThis);

/* Звук: синтез эффектов и музыки на WebAudio, озвучка (speechSynthesis), вибрация */
(function (root) {
  'use strict';
  const MZ = root.MZ = root.MZ || {};

  const A = {
    ctx: null, master: null, sfx: null, music: null,
    opts: { sound: true, music: true, voice: true, vibration: true, speech: 'normal', voiceName: '' },
    musicTimer: null, musicWorld: null, nextNote: 0, step: 0,
    lastStep: 0, voice: null
  };

  A.configure = function (o) {
    Object.assign(A.opts, o);
    if (A.sfx) A.sfx.gain.value = A.opts.sound ? 0.9 : 0;
    if (A.music) A.music.gain.value = A.opts.music ? 0.55 : 0;
    if (!A.opts.music) A.stopMusic();
    if (!A.opts.voice && root.speechSynthesis) try { root.speechSynthesis.cancel(); } catch (e) { /* ignore */ }
  };

  // AudioContext можно создать/возобновить только после жеста пользователя (iOS/Chrome)
  A.unlock = function () {
    try {
      if (!A.ctx) {
        const AC = root.AudioContext || root.webkitAudioContext;
        if (!AC) return;
        A.ctx = new AC();
        A.master = A.ctx.createGain(); A.master.gain.value = 0.8; A.master.connect(A.ctx.destination);
        A.sfx = A.ctx.createGain(); A.sfx.gain.value = A.opts.sound ? 0.9 : 0; A.sfx.connect(A.master);
        A.music = A.ctx.createGain(); A.music.gain.value = A.opts.music ? 0.55 : 0; A.music.connect(A.master);
      }
      if (A.ctx.state === 'suspended') A.ctx.resume();
    } catch (e) { /* звук недоступен — играем без него */ }
    if (A.unlockSpeech) A.unlockSpeech();
  };

  A.suspend = function () { try { if (A.ctx && A.ctx.state === 'running') A.ctx.suspend(); } catch (e) { /* ignore */ } };
  A.resume = function () { try { if (A.ctx && A.ctx.state === 'suspended') A.ctx.resume(); } catch (e) { /* ignore */ } };

  function tone(freq, dur, o) {
    if (!A.ctx || !A.opts.sound) return;
    o = o || {};
    const t0 = A.ctx.currentTime + (o.delay || 0);
    const osc = A.ctx.createOscillator();
    const g = A.ctx.createGain();
    osc.type = o.type || 'triangle';
    osc.frequency.setValueAtTime(freq, t0);
    if (o.slide) osc.frequency.exponentialRampToValueAtTime(Math.max(20, o.slide), t0 + dur);
    const vol = o.vol != null ? o.vol : 0.2;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0 + Math.min(0.02, dur * 0.3));
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g); g.connect(o.bus || A.sfx);
    osc.start(t0); osc.stop(t0 + dur + 0.05);
  }

  function noise(dur, o) {
    if (!A.ctx || !A.opts.sound) return;
    o = o || {};
    const len = Math.floor(A.ctx.sampleRate * dur);
    const buf = A.ctx.createBuffer(1, len, A.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = A.ctx.createBufferSource(); src.buffer = buf;
    const f = A.ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = o.freq || 1200;
    const g = A.ctx.createGain(); g.gain.value = o.vol || 0.12;
    src.connect(f); f.connect(g); g.connect(A.sfx);
    src.start(A.ctx.currentTime + (o.delay || 0));
  }

  const N = n => 440 * Math.pow(2, (n - 69) / 12); // MIDI → Гц

  const SFX = {
    click: () => tone(720, 0.06, { vol: 0.12 }),
    step: () => {
      const now = performance.now();
      if (now - A.lastStep < 70) return;
      A.lastStep = now;
      tone(230 + Math.random() * 40, 0.04, { type: 'sine', vol: 0.05 });
    },
    collect: () => { tone(N(84), 0.09, { vol: 0.16 }); tone(N(88), 0.14, { vol: 0.16, delay: 0.07 }); tone(N(91), 0.18, { vol: 0.12, delay: 0.14 }); },
    key: () => [72, 76, 79, 84, 88].forEach((n, k) => tone(N(n), 0.16, { vol: 0.14, delay: k * 0.06 })),
    gate: () => { tone(300, 0.3, { type: 'sine', slide: 900, vol: 0.18 }); tone(N(84), 0.3, { vol: 0.12, delay: 0.2 }); },
    locked: () => { tone(190, 0.1, { type: 'square', vol: 0.06 }); tone(160, 0.14, { type: 'square', vol: 0.06, delay: 0.12 }); },
    portal: () => { tone(380, 0.4, { type: 'sine', slide: 1600, vol: 0.16 }); noise(0.35, { freq: 2400, vol: 0.05 }); },
    hit: () => { tone(320, 0.3, { type: 'sawtooth', slide: 70, vol: 0.14 }); noise(0.2, { freq: 500, vol: 0.12 }); },
    bump: () => tone(140, 0.06, { type: 'sine', vol: 0.08 }),
    door: () => [67, 72, 76, 79].forEach((n, k) => tone(N(n), 0.22, { vol: 0.14, delay: k * 0.08 })),
    win: () => {
      [72, 76, 79, 84].forEach((n, k) => tone(N(n), 0.2, { vol: 0.16, delay: k * 0.11 }));
      [72, 76, 79].forEach(n => tone(N(n + 12), 0.8, { vol: 0.08, delay: 0.5 }));
    },
    lose: () => [67, 64, 60].forEach((n, k) => tone(N(n), 0.3, { type: 'sine', vol: 0.15, delay: k * 0.2 })),
    star: k => tone(N(84 + (k || 0) * 4), 0.25, { vol: 0.16 }),
    tick: () => tone(1500, 0.03, { type: 'square', vol: 0.04 }),
    bonus: () => { tone(N(88), 0.1, { vol: 0.14 }); tone(N(93), 0.2, { vol: 0.14, delay: 0.08 }); },
    hint: () => [79, 83, 86].forEach((n, k) => tone(N(n), 0.14, { type: 'sine', vol: 0.12, delay: k * 0.07 })),
    achievement: () => [76, 79, 83, 88].forEach((n, k) => tone(N(n), 0.25, { vol: 0.13, delay: k * 0.09 }))
  };

  A.play = function (name, arg) {
    try { if (SFX[name]) SFX[name](arg); } catch (e) { /* ignore */ }
  };

  // ---------- Генеративная музыка ----------
  const SCALES = {
    forest: { root: 60, scale: [0, 2, 4, 7, 9], wave: 'triangle', bpm: 100 },
    sea: { root: 62, scale: [0, 2, 4, 7, 9], wave: 'sine', bpm: 84 },
    candy: { root: 65, scale: [0, 2, 4, 7, 9], wave: 'square', bpm: 112 },
    snow: { root: 57, scale: [0, 3, 5, 7, 10], wave: 'sine', bpm: 90 },
    space: { root: 52, scale: [0, 3, 5, 7, 10], wave: 'sine', bpm: 76 },
    menu: { root: 60, scale: [0, 2, 4, 7, 9], wave: 'triangle', bpm: 92 }
  };

  A.startMusic = function (worldId) {
    if (!A.ctx || !A.opts.music) return;
    if (A.musicTimer && A.musicWorld === worldId) return;
    A.stopMusic();
    A.musicWorld = worldId;
    const cfg = SCALES[worldId] || SCALES.menu;
    const beat = 60 / cfg.bpm / 2; // восьмые
    let melody = 2;
    A.nextNote = A.ctx.currentTime + 0.1;
    A.step = 0;
    const chords = [0, 3, 4, 2];
    A.musicTimer = setInterval(() => {
      if (!A.ctx || A.ctx.state !== 'running') return;
      while (A.nextNote < A.ctx.currentTime + 0.35) {
        const t = A.nextNote - A.ctx.currentTime;
        const bar = Math.floor(A.step / 8) % 4;
        const chordRoot = cfg.scale[chords[bar] % cfg.scale.length];
        if (A.step % 4 === 0) tone(N(cfg.root - 12 + chordRoot), beat * 3.5, { type: 'sine', vol: 0.09, delay: t, bus: A.music });
        if (Math.random() < (A.step % 2 === 0 ? 0.7 : 0.35)) {
          melody = Math.max(0, Math.min(9, melody + [-2, -1, -1, 0, 1, 1, 2][Math.floor(Math.random() * 7)]));
          const oct = Math.floor(melody / cfg.scale.length), deg = melody % cfg.scale.length;
          tone(N(cfg.root + 12 * oct + cfg.scale[deg]), beat * 1.6, { type: cfg.wave, vol: cfg.wave === 'square' ? 0.025 : 0.05, delay: t, bus: A.music });
        }
        A.nextNote += beat;
        A.step++;
      }
    }, 90);
  };

  A.stopMusic = function () {
    if (A.musicTimer) clearInterval(A.musicTimer);
    A.musicTimer = null; A.musicWorld = null;
  };

  // ---------- Озвучка ----------
  // Чёткая речь для детей: лучший доступный русский голос, спокойный темп, числа словами,
  // короткие фразы по очереди (длинные реплики браузеры читают хуже и иногда обрывают).
  const RATES = { slow: 0.74, normal: 0.88 };

  function voiceScore(v) {
    if (!/^ru/i.test(v.lang || '')) return -1;
    let s = 100;
    if (/natural|neural|online/i.test(v.name)) s += 40;      // Edge/Windows: естественные голоса — самые чёткие
    if (/premium|enhanced|улучш/i.test(v.name)) s += 30;     // macOS/iOS: улучшенные голоса
    if (/google/i.test(v.name)) s += 25;                     // Chrome/Android
    if (/milena|милена|katya|катя|alena|алёна|алена|dariya|svetlana|светлана|irina|ирина/i.test(v.name)) s += 12;
    if (v.localService) s += 2;
    return s;
  }
  A.voices = function () {
    try {
      return (root.speechSynthesis.getVoices() || []).filter(v => voiceScore(v) >= 0).sort((a, b) => voiceScore(b) - voiceScore(a));
    } catch (e) { return []; }
  };
  function pickVoice() {
    const list = A.voices();
    A.voice = (A.opts.voiceName && list.find(v => v.name === A.opts.voiceName)) || list[0] || null;
  }
  if (root.speechSynthesis) {
    pickVoice();
    try { root.speechSynthesis.addEventListener('voiceschanged', pickVoice); } catch (e) {
      try { root.speechSynthesis.onvoiceschanged = pickVoice; } catch (e2) { /* ignore */ }
    }
  }
  const baseConfigure = A.configure;
  A.configure = function (o) { baseConfigure(o); pickVoice(); };

  A.canSpeak = () => !!root.speechSynthesis && typeof root.SpeechSynthesisUtterance === 'function';

  // Текст → удобный для синтеза: числа словами, без типографских значков
  function speakable(text) {
    return String(text)
      .replace(/\+\s*(?=\d)/g, 'плюс ')
      .replace(/(\d+)\s*с(?![а-яё])/gi, (m, n) => MZ.util.numWord(+n, 'f') + ' ' + MZ.util.plural(+n, ['секунда', 'секунды', 'секунд']))
      .replace(/\d+/g, n => MZ.util.numWord(+n, 'm'))
      .replace(/[«»"“”]/g, '')
      .replace(/\s*[—–]\s*/g, ', ')
      .replace(/…/g, '.')
      .replace(/\s*·\s*/g, ', ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  A.say = function (text, force) {
    if ((!A.opts.voice && !force) || !A.canSpeak() || !text) return;
    try {
      const synth = root.speechSynthesis;
      const clean = speakable(text).slice(0, 320);
      const parts = (clean.match(/[^.!?]+[.!?]*/g) || [clean]).map(x => x.trim()).filter(Boolean);
      const rate = RATES[A.opts.speech] || RATES.normal;
      const speak = () => {
        parts.forEach(part => {
          const u = new root.SpeechSynthesisUtterance(part);
          u.lang = 'ru-RU';
          if (A.voice) u.voice = A.voice;
          u.rate = rate; u.pitch = 1.05; u.volume = 1;
          synth.speak(u);
        });
        try { synth.resume(); } catch (e) { /* ignore */ }
      };
      // Chrome теряет фразу, если speak() вызвать сразу после cancel() — даём паузу
      if (synth.speaking || synth.pending) { synth.cancel(); setTimeout(speak, 90); }
      else speak();
    } catch (e) { /* ignore */ }
  };

  // iOS разрешает речь только после жеста пользователя: «прогреваем» синтез тихой фразой
  A.unlockSpeech = function () {
    if (A.speechUnlocked || !A.canSpeak()) return;
    A.speechUnlocked = true;
    try { const u = new root.SpeechSynthesisUtterance(' '); u.volume = 0; root.speechSynthesis.speak(u); } catch (e) { /* ignore */ }
  };
  A.speakable = speakable;

  A.buzz = function (pattern) {
    if (!A.opts.vibration) return;
    try { if (navigator.vibrate) navigator.vibrate(pattern); } catch (e) { /* ignore */ }
  };

  MZ.audio = A;
})(typeof window !== 'undefined' ? window : globalThis);

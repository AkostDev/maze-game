/*
 * Звук без файлов: эффекты и фоновая музыка синтезируются на WebAudio, плюс вибрация.
 * Звуковая система Phaser отключена (audio.noAudio) — загружать нечего.
 */

const A = {
  ctx: null, master: null, sfxBus: null, musicBus: null,
  opts: { sound: true, music: true, vibration: true },
  musicTimer: null, musicId: null, wantMusic: null, nextNote: 0, step: 0, lastStep: 0
};

function tone(freq, dur, o) {
  if (!A.ctx) return;
  o = o || {};
  if (!o.bus && !A.opts.sound) return;
  const t0 = A.ctx.currentTime + (o.delay || 0);
  const osc = A.ctx.createOscillator();
  const g = A.ctx.createGain();
  osc.type = o.type || 'square';
  osc.frequency.setValueAtTime(freq, t0);
  if (o.slide) osc.frequency.exponentialRampToValueAtTime(Math.max(20, o.slide), t0 + dur);
  const vol = o.vol != null ? o.vol : 0.12;
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(vol, t0 + Math.min(0.02, dur * 0.3));
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(g); g.connect(o.bus || A.sfxBus);
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
  src.connect(f); f.connect(g); g.connect(A.sfxBus);
  src.start(A.ctx.currentTime + (o.delay || 0));
}

const N = n => 440 * Math.pow(2, (n - 69) / 12); // MIDI → Гц

// Эффекты в духе 8-бит: прямоугольная волна, короткие арпеджио
const SFX = {
  click: () => tone(720, 0.05, { vol: 0.07 }),
  step: () => {
    const now = performance.now();
    if (now - A.lastStep < 70) return;
    A.lastStep = now;
    tone(200 + Math.random() * 40, 0.035, { type: 'triangle', vol: 0.08 });
  },
  collect: () => [84, 88, 91].forEach((n, k) => tone(N(n), 0.09, { vol: 0.09, delay: k * 0.06 })),
  key: () => [72, 76, 79, 84, 88].forEach((n, k) => tone(N(n), 0.12, { vol: 0.08, delay: k * 0.055 })),
  gate: () => { tone(300, 0.25, { slide: 900, vol: 0.09 }); tone(N(84), 0.25, { vol: 0.08, delay: 0.18 }); },
  locked: () => { tone(190, 0.09, { vol: 0.06 }); tone(150, 0.13, { vol: 0.06, delay: 0.11 }); },
  portal: () => { tone(380, 0.35, { type: 'sine', slide: 1600, vol: 0.14 }); noise(0.3, { freq: 2400, vol: 0.05 }); },
  hit: () => { tone(320, 0.28, { type: 'sawtooth', slide: 70, vol: 0.13 }); noise(0.2, { freq: 500, vol: 0.12 }); },
  bump: () => tone(130, 0.05, { type: 'triangle', vol: 0.1 }),
  door: () => [67, 72, 76, 79].forEach((n, k) => tone(N(n), 0.18, { vol: 0.09, delay: k * 0.08 })),
  win: () => {
    [72, 76, 79, 84].forEach((n, k) => tone(N(n), 0.16, { vol: 0.1, delay: k * 0.11 }));
    [72, 76, 79].forEach(n => tone(N(n + 12), 0.7, { type: 'triangle', vol: 0.08, delay: 0.5 }));
  },
  lose: () => [67, 64, 60].forEach((n, k) => tone(N(n), 0.28, { type: 'triangle', vol: 0.14, delay: k * 0.2 })),
  star: k => tone(N(84 + (k || 0) * 4), 0.2, { vol: 0.1 }),
  bonus: () => { tone(N(88), 0.09, { vol: 0.09 }); tone(N(93), 0.18, { vol: 0.09, delay: 0.08 }); },
  hint: () => [79, 83, 86].forEach((n, k) => tone(N(n), 0.12, { type: 'triangle', vol: 0.12, delay: k * 0.07 })),
  sleep: () => tone(N(64), 0.3, { type: 'sine', slide: N(57), vol: 0.1 })
};

// Лад, тембр и темп фоновой мелодии каждого мира
const SCALES = {
  forest: { root: 60, scale: [0, 2, 4, 7, 9], wave: 'triangle', bpm: 100 },
  sea: { root: 62, scale: [0, 2, 4, 7, 9], wave: 'sine', bpm: 84 },
  candy: { root: 65, scale: [0, 2, 4, 7, 9], wave: 'square', bpm: 112 },
  snow: { root: 57, scale: [0, 3, 5, 7, 10], wave: 'sine', bpm: 90 },
  space: { root: 52, scale: [0, 3, 5, 7, 10], wave: 'sine', bpm: 76 },
  menu: { root: 60, scale: [0, 2, 4, 7, 9], wave: 'triangle', bpm: 92 }
};

function stopTimer() {
  if (A.musicTimer) clearInterval(A.musicTimer);
  A.musicTimer = null; A.musicId = null;
}

function runMusic(id) {
  if (!A.ctx || !A.opts.music) return;
  if (A.musicTimer && A.musicId === id) return;
  stopTimer();
  A.musicId = id;
  const cfg = SCALES[id] || SCALES.menu;
  const beat = 60 / cfg.bpm / 2; // восьмые
  const chords = [0, 3, 4, 2];
  let melody = 2;
  A.nextNote = A.ctx.currentTime + 0.1;
  A.step = 0;
  A.musicTimer = setInterval(() => {
    if (!A.ctx || A.ctx.state !== 'running') return;
    while (A.nextNote < A.ctx.currentTime + 0.35) {
      const t = A.nextNote - A.ctx.currentTime;
      const chordRoot = cfg.scale[chords[Math.floor(A.step / 8) % 4] % cfg.scale.length];
      if (A.step % 4 === 0) tone(N(cfg.root - 12 + chordRoot), beat * 3.5, { type: 'sine', vol: 0.09, delay: t, bus: A.musicBus });
      if (Math.random() < (A.step % 2 === 0 ? 0.7 : 0.35)) {
        melody = Math.max(0, Math.min(9, melody + [-2, -1, -1, 0, 1, 1, 2][Math.floor(Math.random() * 7)]));
        const oct = Math.floor(melody / cfg.scale.length), deg = melody % cfg.scale.length;
        tone(N(cfg.root + 12 * oct + cfg.scale[deg]), beat * 1.6, { type: cfg.wave, vol: cfg.wave === 'square' ? 0.025 : 0.05, delay: t, bus: A.musicBus });
      }
      A.nextNote += beat;
      A.step++;
    }
  }, 90);
}

export const sfx = {
  // Применить настройки { sound, music, vibration }
  configure(o) {
    Object.assign(A.opts, o);
    if (A.sfxBus) A.sfxBus.gain.value = A.opts.sound ? 0.9 : 0;
    if (A.musicBus) A.musicBus.gain.value = A.opts.music ? 0.55 : 0;
    if (!A.opts.music) stopTimer();
    else if (A.wantMusic) runMusic(A.wantMusic);
  },
  // AudioContext можно создать и запустить только после жеста пользователя (iOS, Chrome)
  unlock() {
    try {
      if (!A.ctx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        A.ctx = new AC();
        A.master = A.ctx.createGain(); A.master.gain.value = 0.8; A.master.connect(A.ctx.destination);
        A.sfxBus = A.ctx.createGain(); A.sfxBus.gain.value = A.opts.sound ? 0.9 : 0; A.sfxBus.connect(A.master);
        A.musicBus = A.ctx.createGain(); A.musicBus.gain.value = A.opts.music ? 0.55 : 0; A.musicBus.connect(A.master);
      }
      if (A.ctx.state === 'suspended') A.ctx.resume();
      if (A.wantMusic) runMusic(A.wantMusic);
    } catch (e) { /* звук недоступен — играем без него */ }
  },
  suspend() { try { if (A.ctx && A.ctx.state === 'running') A.ctx.suspend(); } catch (e) { /* ignore */ } },
  resume() { try { if (A.ctx && A.ctx.state === 'suspended') A.ctx.resume(); } catch (e) { /* ignore */ } },
  play(name, arg) { try { if (SFX[name]) SFX[name](arg); } catch (e) { /* ignore */ } },
  // Музыка мира (ключ SCALES). До первого жеста пользователя только запоминается — начнёт играть после unlock().
  startMusic(id) { A.wantMusic = id; runMusic(id); },
  stopMusic() { A.wantMusic = null; stopTimer(); },
  buzz(pattern) {
    if (!A.opts.vibration) return;
    try { if (navigator.vibrate) navigator.vibrate(pattern); } catch (e) { /* ignore */ }
  }
};

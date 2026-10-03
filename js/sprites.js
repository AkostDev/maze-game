/* Процедурная графика: герои, враги, предметы, ключи, дверцы, домик, порталы, декор. Без картинок. */
(function (root) {
  'use strict';
  const MZ = root.MZ = root.MZ || {};
  const TAU = Math.PI * 2;

  const HEROES = [
    { id: 'hedgehog', name: 'Ёжик', body: '#9A6232', belly: '#F7DDB5', accent: '#5E3B1C', thread: '#FF5B4F' },
    { id: 'cat', name: 'Котик', body: '#FF9A3C', belly: '#FFE6C7', accent: '#E0701A', thread: '#3B82F6' },
    { id: 'frog', name: 'Лягушонок', body: '#4CC76B', belly: '#DDF7CF', accent: '#2E9C4B', thread: '#FFB020' },
    { id: 'penguin', name: 'Пингвин', body: '#2F3B5C', belly: '#FFFFFF', accent: '#FF9F1C', thread: '#13A89E' },
    { id: 'bunny', name: 'Зайка', body: '#ECE6F7', belly: '#FFFFFF', accent: '#FF93B8', thread: '#7A5CFA' }
  ];
  const heroById = id => HEROES.find(h => h.id === id) || HEROES[0];

  function circle(ctx, x, y, r, fill) {
    ctx.beginPath(); ctx.arc(x, y, r, 0, TAU);
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  }
  function ellipse(ctx, x, y, rx, ry, fill, rot) {
    ctx.beginPath(); ctx.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), rot || 0, 0, TAU);
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  }
  function roundRect(ctx, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }
  function shadow(ctx, x, y, s, alpha) {
    ellipse(ctx, x, y + s * 0.3, s * 0.28, s * 0.09, 'rgba(0,0,0,' + (alpha == null ? 0.18 : alpha) + ')');
  }

  // Глаза, которые смотрят в сторону движения
  function eyes(ctx, x, y, r, gap, lookX, lookY, blink, opts) {
    opts = opts || {};
    if (opts.closed) { // спящие глазки-дужки
      ctx.strokeStyle = opts.brow || '#1B1F33'; ctx.lineWidth = r * 0.4; ctx.lineCap = 'round';
      for (const side of [-1, 1]) { ctx.beginPath(); ctx.arc(x + side * gap, y - r * 0.2, r * 0.75, 0.15 * Math.PI, 0.85 * Math.PI); ctx.stroke(); }
      return;
    }
    const ey = Math.max(0.12, 1 - blink);
    for (const side of [-1, 1]) {
      const ex = x + side * gap;
      ctx.save();
      ctx.translate(ex, y); ctx.scale(1, ey);
      ellipse(ctx, 0, 0, r, r * 1.12, '#FFFFFF');
      ellipse(ctx, lookX * r * 0.38, lookY * r * 0.38 + r * 0.08, r * 0.62, r * 0.7, opts.pupil || '#1B1F33');
      circle(ctx, lookX * r * 0.38 - r * 0.22, lookY * r * 0.38 - r * 0.2, r * 0.22, '#FFFFFF');
      ctx.restore();
      if (opts.angry) {
        ctx.strokeStyle = opts.brow || '#1B1F33'; ctx.lineWidth = r * 0.42; ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(ex - side * r * 1.0, y - r * 1.55);
        ctx.lineTo(ex + side * r * 0.7, y - r * 1.05);
        ctx.stroke();
      }
    }
  }

  // ---------- Герои ----------
  function drawHero(ctx, id, x, y, s, st) {
    st = st || {};
    const h = heroById(id);
    const t = st.t || 0;
    const r = s * 0.34;
    const lookX = st.lookX || 0, lookY = st.lookY || 0;
    const bob = st.moving ? -Math.abs(Math.sin(t * 13)) * s * 0.06 : Math.sin(t * 2.2) * s * 0.012;
    const sq = st.squash || 0;
    shadow(ctx, x, y + s * 0.02, s * (st.moving ? 0.9 : 1));
    ctx.save();
    ctx.translate(x, y + bob);
    ctx.scale(1 + sq * 0.18, 1 - sq * 0.18);
    if (st.hurt) ctx.globalAlpha = 0.45 + 0.45 * Math.abs(Math.sin(t * 22));
    const blink = st.blink || 0;
    const tilt = lookX * 0.08;
    ctx.rotate(tilt);

    if (h.id === 'hedgehog') {
      // Иголки
      ctx.beginPath();
      const spikes = 14;
      for (let k = 0; k <= spikes * 2; k++) {
        const aa = -Math.PI * 1.08 + (k / (spikes * 2)) * Math.PI * 1.16;
        const rr = k % 2 === 0 ? r * 1.02 : r * 1.32;
        const px = Math.cos(aa) * rr, py = Math.sin(aa) * rr - r * 0.05;
        if (k === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.closePath(); ctx.fillStyle = h.accent; ctx.fill();
      circle(ctx, 0, 0, r * 1.02, h.body);
      ellipse(ctx, 0, r * 0.2, r * 0.78, r * 0.72, h.belly);
      circle(ctx, -r * 0.7, -r * 0.62, r * 0.2, h.belly);
      circle(ctx, r * 0.7, -r * 0.62, r * 0.2, h.belly);
      eyes(ctx, 0, -r * 0.02, r * 0.2, r * 0.36, lookX, lookY, blink);
      ellipse(ctx, lookX * r * 0.08, r * 0.36, r * 0.16, r * 0.12, '#2A1A10');
    } else if (h.id === 'cat') {
      for (const side of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(side * r * 0.95, -r * 0.2);
        ctx.lineTo(side * r * 0.78, -r * 1.25);
        ctx.lineTo(side * r * 0.15, -r * 0.85);
        ctx.closePath(); ctx.fillStyle = h.body; ctx.fill();
        ctx.beginPath();
        ctx.moveTo(side * r * 0.8, -r * 0.45);
        ctx.lineTo(side * r * 0.72, -r * 1.02);
        ctx.lineTo(side * r * 0.35, -r * 0.8);
        ctx.closePath(); ctx.fillStyle = '#FFB3C7'; ctx.fill();
      }
      circle(ctx, 0, 0, r, h.body);
      // Полоски
      ctx.strokeStyle = h.accent; ctx.lineWidth = r * 0.12; ctx.lineCap = 'round';
      for (const k of [-1, 0, 1]) { ctx.beginPath(); ctx.moveTo(k * r * 0.22, -r * 0.98); ctx.lineTo(k * r * 0.18, -r * 0.7); ctx.stroke(); }
      ellipse(ctx, 0, r * 0.38, r * 0.55, r * 0.42, h.belly);
      eyes(ctx, 0, -r * 0.08, r * 0.21, r * 0.4, lookX, lookY, blink, { pupil: '#1F3A1A' });
      ctx.beginPath(); ctx.moveTo(-r * 0.1, r * 0.22); ctx.lineTo(r * 0.1, r * 0.22); ctx.lineTo(0, r * 0.34); ctx.closePath();
      ctx.fillStyle = '#FF7FA0'; ctx.fill();
      ctx.strokeStyle = 'rgba(60,40,30,0.55)'; ctx.lineWidth = Math.max(1, r * 0.05);
      for (const side of [-1, 1]) for (const k of [0, 1]) {
        ctx.beginPath(); ctx.moveTo(side * r * 0.35, r * 0.34 + k * r * 0.12); ctx.lineTo(side * r * 0.95, r * 0.26 + k * r * 0.22); ctx.stroke();
      }
    } else if (h.id === 'frog') {
      circle(ctx, -r * 0.48, -r * 0.62, r * 0.42, h.body);
      circle(ctx, r * 0.48, -r * 0.62, r * 0.42, h.body);
      ellipse(ctx, 0, r * 0.05, r * 1.05, r * 0.9, h.body);
      ellipse(ctx, 0, r * 0.4, r * 0.7, r * 0.45, h.belly);
      eyes(ctx, 0, -r * 0.66, r * 0.27, r * 0.48, lookX, lookY, blink);
      ctx.strokeStyle = '#1F5E30'; ctx.lineWidth = r * 0.1; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.arc(0, r * 0.02, r * 0.45, 0.25 * Math.PI, 0.75 * Math.PI); ctx.stroke();
      circle(ctx, -r * 0.62, r * 0.12, r * 0.14, 'rgba(255,120,150,0.55)');
      circle(ctx, r * 0.62, r * 0.12, r * 0.14, 'rgba(255,120,150,0.55)');
    } else if (h.id === 'penguin') {
      ellipse(ctx, -r * 0.95, r * 0.25, r * 0.22, r * 0.45, h.body, 0.4);
      ellipse(ctx, r * 0.95, r * 0.25, r * 0.22, r * 0.45, h.body, -0.4);
      ellipse(ctx, 0, 0, r, r * 1.05, h.body);
      circle(ctx, -r * 0.3, -r * 0.1, r * 0.5, h.belly);
      circle(ctx, r * 0.3, -r * 0.1, r * 0.5, h.belly);
      ellipse(ctx, 0, r * 0.35, r * 0.62, r * 0.55, h.belly);
      eyes(ctx, 0, -r * 0.18, r * 0.19, r * 0.34, lookX, lookY, blink);
      ctx.beginPath(); ctx.moveTo(-r * 0.18, r * 0.12); ctx.lineTo(r * 0.18, r * 0.12); ctx.lineTo(lookX * r * 0.1, r * 0.34); ctx.closePath();
      ctx.fillStyle = h.accent; ctx.fill();
      circle(ctx, -r * 0.55, r * 0.2, r * 0.12, 'rgba(255,130,160,0.5)');
      circle(ctx, r * 0.55, r * 0.2, r * 0.12, 'rgba(255,130,160,0.5)');
    } else { // зайка
      for (const side of [-1, 1]) {
        const wig = Math.sin(t * 3 + side) * 0.08;
        ellipse(ctx, side * r * 0.42, -r * 1.15, r * 0.24, r * 0.62, h.body, side * 0.15 + wig);
        ellipse(ctx, side * r * 0.42, -r * 1.1, r * 0.12, r * 0.45, h.accent, side * 0.15 + wig);
      }
      circle(ctx, 0, 0, r, h.body);
      ellipse(ctx, 0, r * 0.36, r * 0.58, r * 0.45, h.belly);
      eyes(ctx, 0, -r * 0.1, r * 0.2, r * 0.38, lookX, lookY, blink, { pupil: '#3A2A55' });
      ellipse(ctx, 0, r * 0.2, r * 0.12, r * 0.09, h.accent);
      circle(ctx, -r * 0.6, r * 0.2, r * 0.13, 'rgba(255,130,170,0.5)');
      circle(ctx, r * 0.6, r * 0.2, r * 0.13, 'rgba(255,130,170,0.5)');
    }
    if (st.dizzy) {
      for (let k = 0; k < 3; k++) {
        const a = t * 5 + k * TAU / 3;
        drawStar(ctx, Math.cos(a) * r * 0.9, -r * 1.3 + Math.sin(a) * r * 0.25, r * 0.22, '#FFD23F');
      }
    }
    ctx.restore();
  }

  // ---------- Враги ----------
  function drawEnemy(ctx, kind, x, y, s, t, dirX, dirY, asleep) {
    const r = s * 0.3;
    const lx = dirX || 0, ly = dirY || 0;
    const E = o => Object.assign({ angry: !asleep, closed: !!asleep }, o || {});
    if (asleep) t *= 0.25;
    shadow(ctx, x, y, s * 0.85, 0.15);
    ctx.save();
    ctx.translate(x, y);
    if (kind === 'bee') {
      const hover = Math.sin(t * 8) * s * 0.04;
      ctx.translate(0, hover - s * 0.04);
      const flap = Math.abs(Math.sin(t * 30));
      ellipse(ctx, -r * 0.45, -r * 0.85, r * 0.42, r * (0.2 + flap * 0.35), 'rgba(220,240,255,0.85)', -0.5);
      ellipse(ctx, r * 0.45, -r * 0.85, r * 0.42, r * (0.2 + flap * 0.35), 'rgba(220,240,255,0.85)', 0.5);
      ellipse(ctx, 0, 0, r * 1.05, r * 0.88, '#FFC928');
      ctx.save(); ctx.beginPath(); ctx.ellipse(0, 0, r * 1.05, r * 0.88, 0, 0, TAU); ctx.clip();
      ctx.fillStyle = '#3A2A1A';
      ctx.fillRect(-r * 0.2, -r, r * 0.26, r * 2); ctx.fillRect(r * 0.42, -r, r * 0.26, r * 2);
      ctx.restore();
      eyes(ctx, -r * 0.35, -r * 0.1, r * 0.2, r * 0.28, lx, ly, 0, E());
    } else if (kind === 'crab') {
      const wave = Math.sin(t * 6) * 0.35;
      for (const side of [-1, 1]) {
        ctx.save(); ctx.translate(side * r * 1.05, -r * 0.35); ctx.rotate(side * (0.4 + wave));
        circle(ctx, 0, 0, r * 0.38, '#FF5E3A');
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(side * r * 0.45, -r * 0.3); ctx.lineTo(side * r * 0.1, -r * 0.45); ctx.closePath();
        ctx.fillStyle = '#FFE9E0'; ctx.fill();
        ctx.restore();
      }
      ctx.strokeStyle = '#D9401F'; ctx.lineWidth = r * 0.14; ctx.lineCap = 'round';
      for (const side of [-1, 1]) for (let k = 0; k < 3; k++) {
        ctx.beginPath(); ctx.moveTo(side * r * 0.6, r * 0.2 + k * r * 0.15);
        ctx.lineTo(side * r * (1.05 + Math.sin(t * 12 + k) * 0.06), r * 0.45 + k * r * 0.18); ctx.stroke();
      }
      ellipse(ctx, 0, r * 0.15, r * 0.95, r * 0.7, '#FF6B45');
      ctx.strokeStyle = '#D9401F'; ctx.lineWidth = r * 0.12;
      ctx.beginPath(); ctx.moveTo(-r * 0.3, -r * 0.35); ctx.lineTo(-r * 0.35, -r * 0.75); ctx.moveTo(r * 0.3, -r * 0.35); ctx.lineTo(r * 0.35, -r * 0.75); ctx.stroke();
      eyes(ctx, 0, -r * 0.82, r * 0.2, r * 0.35, lx, ly, 0, E());
    } else if (kind === 'jelly') {
      const wob = Math.sin(t * 7) * 0.08;
      ctx.scale(1 + wob, 1 - wob);
      const grd = ctx.createLinearGradient(0, -r, 0, r);
      grd.addColorStop(0, '#FF8FD1'); grd.addColorStop(1, '#E0409A');
      ctx.beginPath();
      ctx.moveTo(-r, r * 0.55);
      ctx.bezierCurveTo(-r * 1.1, -r * 1.2, r * 1.1, -r * 1.2, r, r * 0.55);
      for (let k = 0; k < 4; k++) {
        const x0 = r - (k + 0.5) * (r * 2 / 4);
        ctx.quadraticCurveTo(x0, r * (0.95 + Math.sin(t * 6 + k) * 0.08), x0 - r * 0.25, r * 0.55);
      }
      ctx.closePath(); ctx.fillStyle = grd; ctx.fill();
      ellipse(ctx, -r * 0.4, -r * 0.45, r * 0.22, r * 0.12, 'rgba(255,255,255,0.7)', -0.5);
      eyes(ctx, 0, -r * 0.05, r * 0.2, r * 0.33, lx, ly, 0, E({ brow: '#7A1650' }));
    } else if (kind === 'snowball') {
      const roll = t * 4;
      const grd = ctx.createRadialGradient(-r * 0.3, -r * 0.4, r * 0.1, 0, 0, r * 1.1);
      grd.addColorStop(0, '#FFFFFF'); grd.addColorStop(1, '#B9D3F5');
      circle(ctx, 0, 0, r * 1.0, grd);
      ctx.fillStyle = 'rgba(150,185,235,0.6)';
      for (let k = 0; k < 4; k++) {
        const a = roll + k * 1.7;
        circle(ctx, Math.cos(a) * r * 0.6, Math.sin(a) * r * 0.55, r * 0.09);
        ctx.fill();
      }
      eyes(ctx, 0, -r * 0.1, r * 0.2, r * 0.34, lx, ly, 0, E({ pupil: '#223', brow: '#35507F' }));
      ctx.strokeStyle = '#35507F'; ctx.lineWidth = r * 0.1; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.arc(0, r * 0.55, r * 0.25, 1.15 * Math.PI, 1.85 * Math.PI); ctx.stroke();
    } else { // ufo
      const hover = Math.sin(t * 4) * s * 0.04;
      ctx.translate(0, hover);
      ctx.fillStyle = 'rgba(125,249,255,0.18)';
      ctx.beginPath(); ctx.moveTo(-r * 0.5, r * 0.2); ctx.lineTo(r * 0.5, r * 0.2); ctx.lineTo(r * 0.8, r * 1.1); ctx.lineTo(-r * 0.8, r * 1.1); ctx.closePath(); ctx.fill();
      ellipse(ctx, 0, -r * 0.2, r * 0.6, r * 0.55, 'rgba(160,255,230,0.9)');
      eyes(ctx, 0, -r * 0.3, r * 0.17, r * 0.24, lx, ly, 0, E());
      ellipse(ctx, 0, r * 0.15, r * 1.15, r * 0.42, '#8A93B8');
      ellipse(ctx, 0, r * 0.05, r * 1.1, r * 0.25, '#B8C0E0');
      for (let k = 0; k < 5; k++) {
        const on = Math.floor(t * 6 + k) % 2 === 0;
        circle(ctx, -r * 0.8 + k * r * 0.4, r * 0.22, r * 0.09, on ? '#FFE45C' : '#FF6B9A');
      }
    }
    ctx.restore();
    if (asleep) { // «Zzz» над спящим сторожем
      const tt = t * 4;
      ctx.save();
      ctx.fillStyle = '#FFFFFF'; ctx.strokeStyle = 'rgba(30,40,80,0.55)'; ctx.lineWidth = Math.max(2, s * 0.04);
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      for (let k = 0; k < 3; k++) {
        const ph = (tt * 0.5 + k / 3) % 1;
        ctx.globalAlpha = Math.sin(ph * Math.PI);
        ctx.font = '900 ' + Math.round(s * (0.18 + k * 0.05)) + 'px Nunito, sans-serif';
        const zx = x + r * (0.5 + ph * 0.8), zy = y - r * (0.9 + ph * 1.6);
        ctx.strokeText('z', zx, zy); ctx.fillText('z', zx, zy);
      }
      ctx.restore();
    }
  }

  // ---------- Предметы ----------
  function drawStar(ctx, x, y, r, fill, stroke) {
    ctx.beginPath();
    for (let k = 0; k < 10; k++) {
      const rr = k % 2 === 0 ? r : r * 0.48, a = -Math.PI / 2 + k * Math.PI / 5;
      const px = x + Math.cos(a) * rr, py = y + Math.sin(a) * rr;
      if (k === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fillStyle = fill; ctx.fill();
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = r * 0.14; ctx.lineJoin = 'round'; ctx.stroke(); }
  }

  function drawHeartShape(ctx, x, y, r, fill) {
    ctx.beginPath();
    ctx.moveTo(x, y + r * 0.9);
    ctx.bezierCurveTo(x - r * 1.5, y - r * 0.1, x - r * 0.7, y - r * 1.2, x, y - r * 0.45);
    ctx.bezierCurveTo(x + r * 0.7, y - r * 1.2, x + r * 1.5, y - r * 0.1, x, y + r * 0.9);
    ctx.closePath(); ctx.fillStyle = fill; ctx.fill();
  }

  function drawItem(ctx, kind, x, y, s, t, phase) {
    const bob = Math.sin(t * 3 + (phase || 0)) * s * 0.05;
    const r = s * 0.24;
    shadow(ctx, x, y - s * 0.02, s * 0.7, 0.12);
    ctx.save();
    ctx.translate(x, y + bob - s * 0.03);
    if (kind === 'apple') {
      ctx.beginPath();
      ctx.moveTo(0, -r * 0.7);
      ctx.bezierCurveTo(r * 0.9, -r * 1.25, r * 1.5, -r * 0.1, r * 0.9, r * 0.7);
      ctx.bezierCurveTo(r * 0.55, r * 1.2, r * 0.1, r * 1.0, 0, r * 0.9);
      ctx.bezierCurveTo(-r * 0.1, r * 1.0, -r * 0.55, r * 1.2, -r * 0.9, r * 0.7);
      ctx.bezierCurveTo(-r * 1.5, -r * 0.1, -r * 0.9, -r * 1.25, 0, -r * 0.7);
      ctx.fillStyle = '#FF3B3B'; ctx.fill();
      ellipse(ctx, -r * 0.45, -r * 0.2, r * 0.18, r * 0.32, 'rgba(255,255,255,0.55)', 0.3);
      ctx.strokeStyle = '#6B3E1E'; ctx.lineWidth = r * 0.16; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(0, -r * 0.65); ctx.quadraticCurveTo(r * 0.05, -r * 1.05, r * 0.2, -r * 1.2); ctx.stroke();
      ellipse(ctx, r * 0.5, -r * 1.05, r * 0.36, r * 0.17, '#3DBE5A', -0.5);
    } else if (kind === 'shell') {
      const grd = ctx.createLinearGradient(0, -r, 0, r);
      grd.addColorStop(0, '#FFB199'); grd.addColorStop(1, '#FF7A8A');
      ctx.beginPath();
      ctx.moveTo(0, r * 0.95);
      for (let k = 0; k <= 6; k++) {
        const a = Math.PI * (1.08 + k * 0.14);
        ctx.quadraticCurveTo(Math.cos(a - 0.07) * r * 1.35, Math.sin(a - 0.07) * r * 1.35 + r * 0.2, Math.cos(a) * r * 1.15, Math.sin(a) * r * 1.15 + r * 0.2);
      }
      ctx.closePath(); ctx.fillStyle = grd; ctx.fill();
      ctx.strokeStyle = 'rgba(180,60,70,0.45)'; ctx.lineWidth = r * 0.08;
      for (let k = 1; k < 6; k++) {
        const a = Math.PI * (1.08 + k * 0.14);
        ctx.beginPath(); ctx.moveTo(0, r * 0.9); ctx.lineTo(Math.cos(a) * r * 1.05, Math.sin(a) * r * 1.05 + r * 0.2); ctx.stroke();
      }
      roundRect(ctx, -r * 0.35, r * 0.75, r * 0.7, r * 0.3, r * 0.12); ctx.fillStyle = '#FF8F8F'; ctx.fill();
      circle(ctx, r * 0.25, -r * 0.3, r * 0.14, '#FFFFFF');
    } else if (kind === 'candy') {
      ctx.rotate(-0.35);
      for (const side of [-1, 1]) {
        ctx.beginPath(); ctx.moveTo(side * r * 0.6, 0); ctx.lineTo(side * r * 1.35, -r * 0.55); ctx.lineTo(side * r * 1.35, r * 0.55); ctx.closePath();
        ctx.fillStyle = '#FF77B7'; ctx.fill();
      }
      circle(ctx, 0, 0, r * 0.72, '#FF4F9A');
      ctx.save(); ctx.beginPath(); ctx.arc(0, 0, r * 0.72, 0, TAU); ctx.clip();
      ctx.strokeStyle = '#FFFFFF'; ctx.lineWidth = r * 0.2;
      for (let k = -2; k <= 2; k++) { ctx.beginPath(); ctx.moveTo(k * r * 0.5 - r, -r); ctx.lineTo(k * r * 0.5 + r, r); ctx.stroke(); }
      ctx.restore();
      circle(ctx, -r * 0.25, -r * 0.3, r * 0.14, 'rgba(255,255,255,0.8)');
    } else if (kind === 'snowflake') {
      ctx.rotate(t * 0.6);
      ctx.strokeStyle = '#4AA8FF'; ctx.lineCap = 'round';
      ctx.shadowColor = 'rgba(120,200,255,0.9)'; ctx.shadowBlur = r * 0.8;
      for (let k = 0; k < 6; k++) {
        ctx.save(); ctx.rotate(k * Math.PI / 3);
        ctx.lineWidth = r * 0.18;
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -r * 1.1); ctx.stroke();
        ctx.lineWidth = r * 0.13;
        ctx.beginPath(); ctx.moveTo(0, -r * 0.6); ctx.lineTo(-r * 0.3, -r * 0.85); ctx.moveTo(0, -r * 0.6); ctx.lineTo(r * 0.3, -r * 0.85); ctx.stroke();
        ctx.restore();
      }
      circle(ctx, 0, 0, r * 0.2, '#FFFFFF');
    } else if (kind === 'crystal') {
      ctx.shadowColor = 'rgba(125,249,255,0.9)'; ctx.shadowBlur = r * 0.9;
      const pts = [[0, -r * 1.2], [r * 0.8, -r * 0.35], [r * 0.5, r * 0.95], [-r * 0.5, r * 0.95], [-r * 0.8, -r * 0.35]];
      ctx.beginPath(); pts.forEach((p, k) => (k ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]))); ctx.closePath();
      const grd = ctx.createLinearGradient(-r, -r, r, r);
      grd.addColorStop(0, '#9EFCFF'); grd.addColorStop(1, '#8F6BFF');
      ctx.fillStyle = grd; ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = 'rgba(255,255,255,0.45)';
      ctx.beginPath(); ctx.moveTo(0, -r * 1.2); ctx.lineTo(r * 0.8, -r * 0.35); ctx.lineTo(0, -r * 0.1); ctx.closePath(); ctx.fill();
      ctx.fillStyle = 'rgba(60,30,140,0.25)';
      ctx.beginPath(); ctx.moveTo(0, -r * 0.1); ctx.lineTo(r * 0.5, r * 0.95); ctx.lineTo(-r * 0.5, r * 0.95); ctx.closePath(); ctx.fill();
    } else if (kind === 'clock') {
      circle(ctx, -r * 0.62, -r * 0.72, r * 0.3, '#FFB020');
      circle(ctx, r * 0.62, -r * 0.72, r * 0.3, '#FFB020');
      circle(ctx, 0, 0, r * 0.95, '#FF8A00');
      circle(ctx, 0, 0, r * 0.75, '#FFFFFF');
      ctx.strokeStyle = '#2A2F45'; ctx.lineWidth = r * 0.14; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -r * 0.5); ctx.moveTo(0, 0); ctx.lineTo(r * 0.35, r * 0.1); ctx.stroke();
      ctx.fillStyle = '#2A8C4A'; ctx.font = 'bold ' + Math.round(r * 0.6) + 'px Nunito, sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('+', r * 0.95, r * 0.9);
    } else if (kind === 'firefly') {
      const glow = 0.6 + 0.4 * Math.sin(t * 5 + (phase || 0));
      const grd = ctx.createRadialGradient(0, 0, 0, 0, 0, r * 2.4);
      grd.addColorStop(0, 'rgba(255,240,120,' + (0.8 * glow) + ')'); grd.addColorStop(1, 'rgba(255,240,120,0)');
      circle(ctx, 0, 0, r * 2.4, grd);
      ellipse(ctx, -r * 0.4, -r * 0.35, r * 0.35, r * 0.2, 'rgba(230,245,255,0.9)', -0.6);
      ellipse(ctx, r * 0.4, -r * 0.35, r * 0.35, r * 0.2, 'rgba(230,245,255,0.9)', 0.6);
      circle(ctx, 0, 0, r * 0.45, '#FFE55C');
      circle(ctx, 0, -r * 0.45, r * 0.25, '#4A3B2A');
    } else if (kind === 'heart') {
      const beat = 1 + Math.sin(t * 6) * 0.06;
      ctx.scale(beat, beat);
      drawHeartShape(ctx, 0, 0, r * 0.95, '#FF4D6D');
      circle(ctx, -r * 0.35, -r * 0.3, r * 0.14, 'rgba(255,255,255,0.7)');
    } else {
      drawStar(ctx, 0, 0, r * 1.05, '#FFC93C', '#F29E00');
    }
    ctx.restore();
  }

  // Символ для различения цветов без опоры на цвет
  function symbolPath(ctx, sym, x, y, r) {
    ctx.beginPath();
    if (sym === 'circle') ctx.arc(x, y, r, 0, TAU);
    else if (sym === 'square') ctx.rect(x - r * 0.85, y - r * 0.85, r * 1.7, r * 1.7);
    else if (sym === 'triangle') { ctx.moveTo(x, y - r); ctx.lineTo(x + r, y + r * 0.8); ctx.lineTo(x - r, y + r * 0.8); ctx.closePath(); }
    else { ctx.moveTo(x, y - r * 1.1); ctx.lineTo(x + r, y); ctx.lineTo(x, y + r * 1.1); ctx.lineTo(x - r, y); ctx.closePath(); }
  }

  function drawKey(ctx, kc, x, y, s, t) {
    const r = s * 0.2;
    const bob = Math.sin(t * 3.2) * s * 0.05;
    shadow(ctx, x, y - s * 0.02, s * 0.7, 0.12);
    ctx.save();
    ctx.translate(x, y + bob - s * 0.03);
    const pulse = 0.5 + 0.5 * Math.sin(t * 4);
    const grd = ctx.createRadialGradient(0, 0, r * 0.2, 0, 0, r * 2.2);
    grd.addColorStop(0, 'rgba(255,255,255,' + (0.55 + 0.25 * pulse) + ')'); grd.addColorStop(1, 'rgba(255,255,255,0)');
    circle(ctx, 0, 0, r * 2.2, grd);
    ctx.rotate(-0.6 + Math.sin(t * 2) * 0.12);
    ctx.fillStyle = kc.dark;
    roundRect(ctx, -r * 0.1, -r * 0.2, r * 1.9, r * 0.42, r * 0.15); ctx.fill();
    ctx.fillRect(r * 1.25, r * 0.1, r * 0.28, r * 0.45);
    ctx.fillRect(r * 0.8, r * 0.1, r * 0.28, r * 0.32);
    ctx.fillStyle = kc.color;
    roundRect(ctx, -r * 0.05, -r * 0.3, r * 1.8, r * 0.36, r * 0.15); ctx.fill();
    circle(ctx, -r * 0.55, 0, r * 0.82, kc.dark);
    circle(ctx, -r * 0.55, -r * 0.08, r * 0.78, kc.color);
    symbolPath(ctx, kc.symbol, -r * 0.55, -r * 0.08, r * 0.34);
    ctx.fillStyle = '#FFFFFF'; ctx.fill();
    ctx.restore();
  }

  // Дверца на ребре между клетками. cx, cy — середина ребра, horizontal — ребро горизонтальное
  function drawGate(ctx, kc, cx, cy, s, horizontal, openT, t, locked) {
    if (openT >= 1) return;
    ctx.save();
    ctx.translate(cx, cy);
    if (!horizontal) ctx.rotate(Math.PI / 2);
    const len = s * 0.92, th = s * 0.2;
    const a = 1 - openT;
    ctx.globalAlpha = a;
    // Прутья
    ctx.fillStyle = kc.dark;
    roundRect(ctx, -len / 2, -th / 2, len, th, th / 2); ctx.fill();
    ctx.fillStyle = kc.color;
    roundRect(ctx, -len / 2, -th / 2 - th * 0.12, len, th * 0.8, th / 2); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.45)';
    for (let k = -2; k <= 2; k++) {
      if (k === 0) continue;
      roundRect(ctx, k * len * 0.19 - th * 0.12, -th * 0.4, th * 0.24, th * 0.5, th * 0.1); ctx.fill();
    }
    // Замок-бейдж с символом
    const shake = locked ? Math.sin(t * 40) * s * 0.03 * locked : 0;
    const br = s * 0.2 * (1 + openT * 0.5);
    circle(ctx, shake, 0, br, '#FFFFFF');
    circle(ctx, shake, 0, br * 0.8, kc.color);
    symbolPath(ctx, kc.symbol, shake, 0, br * 0.38);
    ctx.fillStyle = '#FFFFFF'; ctx.fill();
    ctx.restore();
  }

  // Домик-выход
  function drawHouse(ctx, x, y, s, open, remaining, t, openT) {
    const w = s * 0.7, h = s * 0.5;
    shadow(ctx, x, y + s * 0.02, s, 0.16);
    ctx.save();
    ctx.translate(x, y + s * 0.06);
    // Стены
    roundRect(ctx, -w / 2, -h * 0.35, w, h * 0.95, s * 0.06); ctx.fillStyle = '#FFE7C2'; ctx.fill();
    ctx.strokeStyle = '#E7B983'; ctx.lineWidth = s * 0.025; ctx.stroke();
    // Крыша
    ctx.beginPath();
    ctx.moveTo(-w * 0.64, -h * 0.3); ctx.lineTo(0, -h * 1.12); ctx.lineTo(w * 0.64, -h * 0.3); ctx.closePath();
    ctx.fillStyle = '#FF5B4F'; ctx.fill();
    ctx.lineJoin = 'round'; ctx.strokeStyle = '#D63C32'; ctx.lineWidth = s * 0.04; ctx.stroke();
    // Труба и окошко
    ctx.fillStyle = '#D63C32'; ctx.fillRect(w * 0.18, -h * 1.0, s * 0.08, s * 0.16);
    circle(ctx, 0, -h * 0.6, s * 0.06, open ? '#FFE070' : '#8FD3FF');
    // Дверь
    const dw = w * 0.36, dh = h * 0.58;
    if (open) {
      const glow = ctx.createRadialGradient(0, h * 0.3, 0, 0, h * 0.3, s * 0.5);
      glow.addColorStop(0, 'rgba(255,220,110,' + (0.55 + 0.2 * Math.sin(t * 4)) + ')'); glow.addColorStop(1, 'rgba(255,220,110,0)');
      circle(ctx, 0, h * 0.3, s * 0.5, glow);
      roundRect(ctx, -dw / 2, h * 0.6 - dh, dw, dh, dw * 0.5); ctx.fillStyle = '#FFD45C'; ctx.fill();
      // Распахнутая створка
      const k = Math.min(1, openT || 1);
      ctx.save(); ctx.translate(-dw / 2, 0); ctx.scale(1 - 0.75 * k, 1);
      roundRect(ctx, 0, h * 0.6 - dh, dw, dh, dw * 0.5); ctx.fillStyle = '#A0643A'; ctx.fill();
      ctx.restore();
    } else {
      roundRect(ctx, -dw / 2, h * 0.6 - dh, dw, dh, dw * 0.5); ctx.fillStyle = '#A0643A'; ctx.fill();
      circle(ctx, dw * 0.25, h * 0.3, s * 0.025, '#FFD45C');
    }
    ctx.restore();
    if (!open && remaining > 0) {
      // Замочек со счётчиком оставшихся предметов
      const bx = x + s * 0.3, by = y - s * 0.28;
      const pulse = 1 + Math.sin(t * 3) * 0.05;
      ctx.save(); ctx.translate(bx, by); ctx.scale(pulse, pulse);
      ctx.strokeStyle = '#6B7390'; ctx.lineWidth = s * 0.05;
      ctx.beginPath(); ctx.arc(0, -s * 0.06, s * 0.09, Math.PI, 0); ctx.stroke();
      roundRect(ctx, -s * 0.14, -s * 0.07, s * 0.28, s * 0.22, s * 0.05); ctx.fillStyle = '#FFBE2E'; ctx.fill();
      ctx.fillStyle = '#3B2A00';
      ctx.font = '800 ' + Math.round(s * 0.17) + 'px Nunito, sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(String(remaining), 0, s * 0.045);
      ctx.restore();
    }
  }

  function drawPortal(ctx, x, y, s, color, t) {
    ctx.save();
    ctx.translate(x, y);
    const r = s * 0.36;
    const grd = ctx.createRadialGradient(0, 0, r * 0.1, 0, 0, r * 1.2);
    grd.addColorStop(0, '#FFFFFF'); grd.addColorStop(0.35, color); grd.addColorStop(1, 'rgba(255,255,255,0)');
    circle(ctx, 0, 0, r * 1.2, grd);
    ctx.lineCap = 'round';
    for (let k = 0; k < 3; k++) {
      ctx.strokeStyle = k % 2 ? '#FFFFFF' : color;
      ctx.globalAlpha = 0.9 - k * 0.2;
      ctx.lineWidth = s * 0.05;
      ctx.beginPath();
      const a0 = t * (2.4 + k * 0.6) + k * 2.1;
      ctx.arc(0, 0, r * (0.45 + k * 0.22), a0, a0 + Math.PI * 1.3);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawYarn(ctx, x, y, r, color, rot) {
    ctx.save();
    ctx.translate(x, y); ctx.rotate(rot || 0);
    circle(ctx, 0, 0, r, color);
    ctx.save(); ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.clip();
    ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.lineWidth = Math.max(1, r * 0.12); ctx.lineCap = 'round';
    for (let k = -2; k <= 2; k++) {
      ctx.beginPath(); ctx.ellipse(k * r * 0.35, 0, r * 0.35, r * 1.2, 0.6, 0, TAU); ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(0,0,0,0.15)';
    ctx.beginPath(); ctx.ellipse(0, r * 0.3, r * 1.1, r * 0.5, -0.3, 0, Math.PI); ctx.stroke();
    ctx.restore();
    circle(ctx, -r * 0.35, -r * 0.35, r * 0.18, 'rgba(255,255,255,0.5)');
    ctx.restore();
  }

  // Мелкий декор на полу (рисуется в статический слой)
  function drawDeco(ctx, worldId, x, y, s, v, colors) {
    const c = colors[v % colors.length];
    ctx.save();
    ctx.translate(x, y);
    ctx.globalAlpha = 0.85;
    if (worldId === 'forest') {
      if (v % 3 === 0) { // цветочек
        for (let k = 0; k < 5; k++) { const a = k * TAU / 5; circle(ctx, Math.cos(a) * s * 0.05, Math.sin(a) * s * 0.05, s * 0.04, c); }
        circle(ctx, 0, 0, s * 0.03, '#FFD54A');
      } else { // травинки
        ctx.strokeStyle = '#8CCB78'; ctx.lineWidth = s * 0.025; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(-s * 0.04, s * 0.04); ctx.lineTo(-s * 0.06, -s * 0.04); ctx.moveTo(0, s * 0.04); ctx.lineTo(0, -s * 0.07); ctx.moveTo(s * 0.04, s * 0.04); ctx.lineTo(s * 0.07, -s * 0.03); ctx.stroke();
      }
    } else if (worldId === 'sea') {
      if (v % 2) { ctx.strokeStyle = 'rgba(80,170,230,0.5)'; ctx.lineWidth = s * 0.02; circle(ctx, 0, 0, s * 0.05); ctx.stroke(); circle(ctx, s * 0.07, -s * 0.06, s * 0.03); ctx.stroke(); }
      else { ellipse(ctx, 0, 0, s * 0.06, s * 0.035, 'rgba(210,170,120,0.6)'); }
    } else if (worldId === 'candy') {
      ctx.rotate(v);
      roundRect(ctx, -s * 0.05, -s * 0.015, s * 0.1, s * 0.03, s * 0.015); ctx.fillStyle = c; ctx.fill();
    } else if (worldId === 'snow') {
      circle(ctx, 0, 0, s * 0.025, '#D6E6FF'); circle(ctx, s * 0.06, s * 0.03, s * 0.018, '#E3EEFF');
    } else {
      ctx.globalAlpha = 0.6 + (v % 3) * 0.1;
      drawStar(ctx, 0, 0, s * 0.045, c);
    }
    ctx.restore();
  }

  MZ.sprites = {
    HEROES, heroById, drawHero, drawEnemy, drawItem, drawKey, drawGate, drawHouse, drawPortal,
    drawYarn, drawDeco, drawStar, drawHeartShape, roundRect, circle, ellipse, symbolPath
  };
})(typeof window !== 'undefined' ? window : globalThis);

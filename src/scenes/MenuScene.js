/* Главное меню: название, выбор героя, большая кнопка «Играть» (продолжить с первого непройденного уровня), уровни и настройки. */
import { UiScene, metrics, label, button, panel, backdrop, icon, goto, hex, WHITE, BTN, BTN_H } from '../ui/kit.js';
import { INK } from '../gfx/textures.js';
import { progress } from '../core/progress.js';
import { sfx } from '../audio/sfx.js';
import { HEROES, WORLDS, heroById } from '../core/worlds.js';
import { worldFor, levelTitle, CAMPAIGN_LEVELS } from '../core/levels.js';

export class MenuScene extends UiScene {
  constructor() { super('Menu'); }

  create() {
    super.create();
    sfx.startMusic('menu');
    this.input.keyboard.on('keydown', e => {
      if (e.code === 'Enter' || e.code === 'Space') this.play();
      else if (e.code === 'ArrowLeft') this.switchHero(-1);
      else if (e.code === 'ArrowRight') this.switchHero(1);
    });
    if (window.KLUBOK) window.KLUBOK.ready = true;
  }

  play() { goto(this, 'Game', { index: progress.unlocked }); }

  switchHero(step) {
    const i = HEROES.findIndex(h => h.id === progress.hero);
    progress.setHero(HEROES[(i + step + HEROES.length) % HEROES.length].id);
    sfx.play('click');
    this.rebuild();
  }

  build() {
    const m = metrics(this), u = m.u;
    const next = progress.unlocked;
    backdrop(this, WORLDS[worldFor(next)].id);

    // В альбомной ориентации — две колонки: слева название и герой, справа кнопки
    const wide = !m.portrait && m.aw >= 250;
    const colL = wide ? Math.round(m.W * 0.27) : m.cx;
    const colR = wide ? Math.round(m.W * 0.74) : m.cx;
    const pw = wide ? Math.min(132, Math.floor(m.aw * 0.42)) : Math.min(132, m.aw - 16); // ширина кнопки «Играть»
    const blockH = wide ? 150 : 262; // высота содержимого в арт-пикселях
    // Стоя верхняя полоса отдана счётчику звёзд — название не должно на него наезжать; на низких экранах отступы сжимаются
    const band = wide ? 4 : 18;
    const k = Math.min(1, (m.ah - band - 6) / blockH);
    let y = m.safe.top + band * u + Math.max(0, (m.H - m.safe.top - band * u - blockH * k * u) / 2);

    const title = label(this, colL, y + 22 * u * k, 'Волшебный\nклубок', wide ? 18 : 20, WHITE,
      { stroke: INK, strokeW: 3, lineSpacing: -3 });
    this.tweens.add({ targets: title, y: title.y - 2 * u, duration: 1400, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
    y += 50 * u * k;

    // Герой: карточка со стрелками выбора
    const hero = heroById(progress.hero);
    const cardY = y + 42 * u * k;
    panel(this, colL, cardY, 104, 76);
    const spr = this.add.sprite(colL, cardY - 8 * u, 'sprites', hero.id).setScale(u * 3);
    spr.play(hero.id + '_walk');
    this.add.image(colL + 26 * u, cardY + 8 * u, 'sprites', 'yarn').setScale(u * 1.5).setTint(hex(hero.thread));
    label(this, colL, cardY + 26 * u, hero.name, 9, INK);
    button(this, { x: colL - 66 * u, y: cardY, color: 'gray', icon: 'play', iconFlip: true, onClick: () => this.switchHero(-1) });
    button(this, { x: colL + 66 * u, y: cardY, color: 'gray', icon: 'play', onClick: () => this.switchHero(1) });

    // Кнопки
    let by = wide ? m.cy - 30 * u : cardY + 62 * u * k;
    const playBtn = button(this, { x: colR, y: by, w: pw, h: 32, color: 'green', icon: 'play', text: 'Играть', size: 12, onClick: () => this.play() });
    this.tweens.add({ targets: playBtn, scale: 1.04, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
    const done = next >= CAMPAIGN_LEVELS;
    label(this, colR, by + 24 * u, 'Уровень ' + (next + 1) + (done ? '' : ' · ' + levelTitle(next)), 7, WHITE, { stroke: INK, strokeW: 2 });
    by += 50 * u * (wide ? 1 : k);
    button(this, { x: colR - (BTN / 2 + 2) * u, y: by, w: pw - BTN - 4, h: BTN_H, color: 'sun', icon: 'levels', text: 'Уровни', onClick: () => goto(this, 'Levels') });
    button(this, { x: colR + (pw - BTN) / 2 * u, y: by, w: BTN, h: BTN_H, color: 'grape', icon: 'settings', onClick: () => goto(this, 'Settings') });

    // Всего звёзд — в правом верхнем углу
    const sx = m.W - m.safe.right - 8 * u, sy = m.safe.top + 12 * u;
    const total = label(this, sx, sy, String(progress.totalStars()), 9, WHITE, { stroke: INK, strokeW: 2, ox: 1 });
    icon(this, sx - total.width - 5 * u, sy, 'star', '#ffcd45');
  }
}

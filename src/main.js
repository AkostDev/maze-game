/*
 * Точка входа: создаёт Phaser.Game, подгоняет холст под экран в пикселях устройства, включает звук по первому жесту.
 * Игра разбита на сцены (src/scenes): Boot → Menu ⇄ Levels / Settings → Game (+ Hud, Pause, Result поверх).
 */
import * as Phaser from '../vendor/phaser.esm.min.js';
import { VERSION } from './config.js';
import { progress } from './core/progress.js';
import { sfx } from './audio/sfx.js';
import { BootScene } from './scenes/BootScene.js';
import { MenuScene } from './scenes/MenuScene.js';
import { LevelsScene } from './scenes/LevelsScene.js';
import { SettingsScene } from './scenes/SettingsScene.js';
import { GameScene } from './scenes/GameScene.js';
import { HudScene } from './scenes/HudScene.js';
import { PauseScene } from './scenes/PauseScene.js';
import { ResultScene } from './scenes/ResultScene.js';

// Холст рисуется в пикселях устройства (до 3x) и сжимается стилем до размера окна — пиксель-арт остаётся резким
function viewport() {
  const dpr = Math.min(Math.max(window.devicePixelRatio || 1, 1), 3);
  return { dpr, w: Math.max(2, Math.round(window.innerWidth * dpr)), h: Math.max(2, Math.round(window.innerHeight * dpr)) };
}

// Вырезы и скругления экрана: отступы невидимого блока #safe (env(safe-area-inset-*)), в пикселях устройства
function safeArea(dpr) {
  const el = document.getElementById('safe');
  const cs = el ? getComputedStyle(el) : null;
  const px = v => Math.round((parseFloat(v) || 0) * dpr);
  return cs
    ? { top: px(cs.paddingTop), right: px(cs.paddingRight), bottom: px(cs.paddingBottom), left: px(cs.paddingLeft) }
    : { top: 0, right: 0, bottom: 0, left: 0 };
}

async function start() {
  // Шрифт нужен до первого текста: иначе Phaser нарисует надписи запасным шрифтом
  try {
    await Promise.race([
      document.fonts.load('16px "Tiny5"', 'Жж Zz 12'),
      new Promise(r => setTimeout(r, 2500))
    ]);
  } catch (e) { /* играем с системным шрифтом */ }

  const v = viewport();
  const game = new Phaser.Game({
    type: Phaser.AUTO, parent: 'game', backgroundColor: '#1b2b34',
    pixelArt: true, banner: false, disableContextMenu: true,
    scale: { mode: Phaser.Scale.NONE, width: v.w, height: v.h, zoom: 1 / v.dpr },
    audio: { noAudio: true }, // звук синтезируется в src/audio/sfx.js
    input: { activePointers: 3 },
    scene: [BootScene, MenuScene, LevelsScene, SettingsScene, GameScene, HudScene, PauseScene, ResultScene]
  });
  game.registry.set('dpr', v.dpr);
  game.registry.set('safe', safeArea(v.dpr));

  const fit = () => {
    const n = viewport();
    if (n.dpr !== game.registry.get('dpr')) { game.registry.set('dpr', n.dpr); game.scale.setZoom(1 / n.dpr); }
    game.registry.set('safe', safeArea(n.dpr));
    if (n.w !== game.scale.width || n.h !== game.scale.height) game.scale.resize(n.w, n.h);
  };
  window.addEventListener('resize', fit);
  window.addEventListener('orientationchange', () => setTimeout(fit, 120));
  if (window.visualViewport) window.visualViewport.addEventListener('resize', fit);

  sfx.configure(progress.settings);
  const unlock = () => sfx.unlock();
  ['pointerdown', 'touchend', 'keydown'].forEach(ev => window.addEventListener(ev, unlock, { passive: true }));
  document.addEventListener('visibilitychange', () => (document.hidden ? sfx.suspend() : sfx.resume()));

  // Для отладки в консоли и для проверок в браузере (tools/browser.mjs ждёт ready)
  window.KLUBOK = {
    game, progress, sfx, version: VERSION, ready: false,
    // открыть сцену из любого состояния: KLUBOK.go('Game', { index: 12 })
    go(key, data) {
      const sm = game.scene;
      sm.getScenes(false).forEach(sc => { const k = sc.scene.key; if (sm.isActive(k) || sm.isPaused(k)) sm.stop(k); });
      sm.start(key, data);
    }
  };

  const test = new URLSearchParams(location.search).has('test');
  if ('serviceWorker' in navigator && location.protocol.startsWith('http') && !test) {
    navigator.serviceWorker.register('sw.js').catch(() => { /* офлайн-режим недоступен — не страшно */ });
  }
}

start();

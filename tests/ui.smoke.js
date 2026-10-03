/* Смоук-тест интерфейса: онбординг → экраны → игра во всех режимах → итоги */
(function () {
  var app = MZ.app, UI = MZ.ui, M = MZ.maze;
  var step = function (name, fn) { try { fn(); print('  ok  ' + name); } catch (e) { print('  FAIL ' + name + ': ' + e + '\n' + e.stack); throw e; } };
  MZ.config.ai.enabled = false; // без сети

  step('экран приветствия при первом запуске', function () { if (UI.current !== 'welcome') throw new Error('current=' + UI.current); });
  step('создание профиля', function () { app.createProfile('Тест', 'kid', 'cat'); if (UI.current !== 'home') throw new Error(UI.current); });
  __flushRaf(5);
  ['levels', 'story', 'records', 'achievements', 'settings'].forEach(function (s) {
    step('экран ' + s, function () { UI.show(s, s === 'levels' ? 'classic' : undefined); __flushRaf(2); });
  });
  step('рекорды: вкладка «дня»', function () { UI.show('records', 'daily'); });
  step('модалка профилей', function () { UI.profilesModal(); UI.closeModal(); });
  step('онбординг: 2-й игрок', function () { UI.show('welcome', { canBack: true }); });

  function autoplay(label) {
    var g = app.game, lv = g.level, frames = 0;
    g.begin();
    while (!g.won && !g.lost && frames < 60 * 240) {
      if (!g.player.moving && !g.traceQueue.length) {
        var res = M.bfs(lv.grid, g.player.cell, { blocked: function (i, d, j) { return d >= 0 && !g.passable(i, d, j); } });
        var tg = [];
        lv.items.forEach(function (it) { if (!it.taken && it.kind === 'item') tg.push(it.cell); });
        lv.keys.forEach(function (k) { if (!k.taken) tg.push(k.cell); });
        lv.gates.forEach(function (gt) { if (!gt.open && g.keysHeld.has(gt.color)) tg.push(res.dist[gt.a] >= 0 ? gt.b : gt.a); });
        if (g.exitOpen) tg.push(lv.exit);
        var best = -1, bd = 1e9; tg.forEach(function (c) { if (res.dist[c] > 0 && res.dist[c] < bd) { bd = res.dist[c]; best = c; } });
        if (best >= 0) g.traceQueue = M.pathTo(res.prev, g.player.cell, best).slice(1);
        if (frames === 30) g.useHint();
      }
      __flushRaf(1, 16); frames++;
    }
    __flushTimers(2000);
    return g.won ? 'won' : g.lost ? 'lost' : 'timeout';
  }

  var modes = [['classic', 0], ['classic', 9], ['time', 4], ['enemies', 6], ['dark', 5]];
  modes.forEach(function (mi) {
    step('игра ' + mi[0] + ' #' + (mi[1] + 1), function () {
      app.startCampaign(mi[0], mi[1]);
      if (!app.playing) throw new Error('not playing');
      __flushRaf(3);
      var r = autoplay();
      if (r === 'timeout') throw new Error('timeout');
      if (document.getElementById('modal').hidden) throw new Error('нет окна итогов');
      print('       → ' + r + ', шагов ' + app.game.steps);
    });
  });
  step('пауза и продолжение', function () { app.startCampaign('classic', 1); __flushRaf(2); app.game.begin(); app.pause(); if (!app.game.paused) throw new Error('no pause'); app.resume(); if (app.game.paused) throw new Error('still paused'); });
  step('обзор карты и зум', function () { app.toggleOverview(); __flushRaf(3); app.toggleOverview(); app.renderer.zoomBy(1.3); __flushRaf(3); });
  step('ввод: свайп пальцем', function () {
    var cv = document.getElementById('game'), inp = app.input;
    cv.dispatch('pointerdown', { pointerId: 1, clientX: 50, clientY: 700 });
    cv.dispatch('pointermove', { pointerId: 1, clientX: 110, clientY: 700 });
    cv.dispatch('pointerup', { pointerId: 1, clientX: 110, clientY: 700 });
    __flushRaf(30);
    void inp;
  });
  step('ввод: пинч двумя пальцами', function () {
    var cv = document.getElementById('game');
    cv.dispatch('pointerdown', { pointerId: 2, clientX: 100, clientY: 400 });
    cv.dispatch('pointerdown', { pointerId: 3, clientX: 200, clientY: 400 });
    cv.dispatch('pointermove', { pointerId: 3, clientX: 260, clientY: 400 });
    cv.dispatch('pointerup', { pointerId: 3 }); cv.dispatch('pointerup', { pointerId: 2 });
    __flushRaf(5);
  });
  step('дальше → следующий уровень', function () { var i = app.level.index; autoplay(); app.next(); if (app.level.index !== i + 1) throw new Error('index ' + app.level.index); });
  step('лабиринт дня', function () { app.startDaily(); __flushRaf(2); var r = autoplay(); print('       → ' + r); app.next(); if (UI.current !== 'records') throw new Error(UI.current); });
  step('сказка (локальная)', function () { UI.show('story'); var s = app.pickStory('space'); app.startStory(s); __flushRaf(2); var r = autoplay(); print('       → ' + r + ' «' + s.title + '»'); app.next(); if (UI.current !== 'story') throw new Error(UI.current); });
  step('малыш: без проигрыша, озвучка', function () { app.createProfile('Малыш', 'tiny', 'bunny'); app.startCampaign('enemies', 3); __flushRaf(2); var r = autoplay(); if (r !== 'won') throw new Error(r); });
  step('настройки: тема и D-pad', function () { MZ.progress.setSetting('theme', 'dark'); MZ.progress.setSetting('dpad', true); app.applySettings(); if (document.documentElement.attrs['data-theme'] !== 'dark') throw new Error('theme'); });
  step('достижения начисляются', function () { var n = Object.keys(MZ.progress.active().achievements).length; UI.show('achievements'); print('       → у малыша достижений: ' + n); if (!n) throw new Error('0'); });
  step('рекорды заполнены', function () { var r = MZ.progress.records({ mode: 'all' }); print('       → записей: ' + r.length); if (!r.length) throw new Error('empty'); UI.show('records'); });
  print('UI smoke: OK');
})();

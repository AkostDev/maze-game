/* Автопилот проходит уровни через настоящий игровой движок: движение, дверцы, ключи, домик, таймер, враги */
(function () {
  var L = MZ.levels, M = MZ.maze;
  if (typeof setTimeout === 'undefined') globalThis.setTimeout = function (fn) { fn(); return 0; };
  var fakeR = { setLevel: function () {}, updateCamera: function () {}, burst: function () {}, floatText: function () {}, confetti: function () {}, hit: function () {} };
  var stats = { runs: 0, won: 0, lost: 0, stuck: 0, time: 0 }, events = {};
  var lostList = [];

  function autopilotTarget(game) {
    var lv = game.level, g = lv.grid, pl = game.player;
    var res = M.bfs(g, pl.cell, { blocked: function (i, d, j) { return d >= 0 && !game.passable(i, d, j); } });
    var targets = [];
    lv.items.forEach(function (it) { if (!it.taken && it.kind === 'item') targets.push(it.cell); });
    lv.keys.forEach(function (k) { if (!k.taken) targets.push(k.cell); });
    lv.gates.forEach(function (gt) { if (!gt.open && game.keysHeld.has(gt.color)) targets.push(res.dist[gt.a] >= 0 ? gt.b : gt.a); });
    if (game.exitOpen) targets.push(lv.exit);
    var best = -1, bd = 1e9;
    targets.forEach(function (c) { if (res.dist[c] > 0 && res.dist[c] < bd) { bd = res.dist[c]; best = c; } });
    if (best < 0) return null;
    return M.pathTo(res.prev, pl.cell, best).slice(1);
  }

  function run(spec, name) {
    var lv = L.buildLevel(spec);
    var won = false, lost = null;
    var game = new MZ.Game(fakeR, {
      onWin: function () { won = true; }, onLose: function (r) { lost = r.reason; },
      onEvent: function (t) { events[t] = (events[t] || 0) + 1; }
    });
    game.start(lv, { heroId: 'cat' });
    game.begin();
    var dt = 1 / 60, t = 0, limit = lv.optimalSteps / lv.speed * 4 + 30;
    while (!game.won && !game.lost && t < limit) {
      if (!game.player.moving && game.player.stun <= 0) {
        var path = autopilotTarget(game);
        // Осторожный игрок: не шагает в клетку рядом с бодрствующим сторожем, отступает, если тот рядом
        if (path && path.length && lv.rules.enemies) {
          var g = lv.grid, pl = game.player;
          var near = function (c, r) { var x = g.x(c) + 0.5, y = g.y(c) + 0.5; return game.enemies.some(function (e) { return !e.asleep && Math.hypot(e.px - x, e.py - y) < r; }); };
          if (near(path[0], 1.6)) {
            var here = near(pl.cell, 1.4);
            path = null;
            if (here) { // отступаем в самую безопасную соседнюю клетку
              var best = -1, bestD = -1;
              game.exits(pl.cell, -1).forEach(function (d) {
                var j = g.neighbor(pl.cell, d), x = g.x(j) + 0.5, y = g.y(j) + 0.5;
                var md = Math.min.apply(null, game.enemies.filter(function (e) { return !e.asleep; }).map(function (e) { return Math.hypot(e.px - x, e.py - y); }).concat([99]));
                if (md > bestD) { bestD = md; best = j; }
              });
              if (best >= 0) path = [best];
            }
          }
        }
        game.traceQueue = path ? path.slice(0, 1) : [];
      }
      game.update(dt); t += dt;
    }
    won = game.won; if (game.lost) lost = game.lastLoss || 'lost';
    stats.runs++; stats.time += t;
    if (won) stats.won++; else if (lost) { stats.lost++; lostList.push(name + ':' + lost); } else { stats.stuck++; print('STUCK ' + name + ' steps=' + game.steps + ' remaining=' + game.remaining); }
    return game;
  }

  L.AGE_ORDER.forEach(function (age) {
    L.CAMPAIGN_MODES.forEach(function (mode) {
      for (var i = 0; i < 40; i += 3) run(L.campaignSpec(age, mode, i, 1.3), age + '/' + mode + '/' + i);
    });
    run(L.dailySpec(age, '2026-09-22'), age + '/daily');
    run({ age: age, mode: 'story', index: 0, seed: 'st|' + age, override: { world: 4, keys: 2, enemies: 2, dark: true, portals: 1, loops: 0.4 } }, age + '/story');
  });

  // Скольжение: один свайп ведёт героя до развилки или тупика
  var glideOk = 0, glideBad = 0;
  for (var s = 0; s < 30; s++) {
    var lv = L.buildLevel(L.campaignSpec('kid', 'classic', s, 1));
    var game = new MZ.Game(fakeR, {});
    game.start(lv, { moveMode: 'glide' });
    var dirs = game.exits(lv.start, -1);
    if (!dirs.length) continue;
    game.push(dirs[0], true);
    for (var k = 0; k < 600 && (game.player.moving || game.bufferDir >= 0 || k < 2); k++) game.update(1 / 60);
    var pl = game.player, ex = game.exits(pl.cell, M.OPP[pl.lastDir]);
    if (pl.cell !== lv.start && (ex.length !== 1 || game.won)) glideOk++; else { glideBad++; print('glide stop at corridor cell, exits=' + ex.length); }
  }

  // Пошаговый режим (по умолчанию): одно нажатие = одна клетка; удержание — по прямой без автоповоротов
  var stepOk = 0, stepBad = 0;
  for (var q = 0; q < 30; q++) {
    var lv2 = L.buildLevel(L.campaignSpec('teen', 'classic', q, 1));
    var gm = new MZ.Game(fakeR, {});
    gm.start(lv2, {});
    var d0 = gm.exits(lv2.start, -1)[0];
    gm.push(d0);
    for (var f = 0; f < 120; f++) gm.update(1 / 60);
    var one = gm.steps === 1 && gm.player.cell === lv2.grid.neighbor(lv2.start, d0);
    // Три быстрых нажатия подряд в свободную сторону → до трёх шагов, не больше
    var before = gm.steps, cell = gm.player.cell, dd = -1, run = 0;
    for (var d = 0; d < 4 && dd < 0; d++) {
      var c = cell, k = 0;
      while (k < 3 && gm.passable(c, d)) { c = lv2.grid.neighbor(c, d); k++; }
      if (k === 3) dd = d;
    }
    var three = true;
    if (dd >= 0) { gm.push(dd); gm.push(dd); gm.push(dd); gm.push(dd); for (f = 0; f < 200; f++) gm.update(1 / 60); three = gm.steps - before === 3; }
    // Удержание: идём, пока свободно, и останавливаемся у стены (без поворота)
    var hd = gm.exits(gm.player.cell, -1)[0], start = gm.player.cell, expect = start;
    while (gm.passable(expect, hd)) expect = lv2.grid.neighbor(expect, hd);
    gm.setHeld(hd, 0);
    for (f = 0; f < 60 * 15; f++) gm.update(1 / 60);
    gm.release();
    for (f = 0; f < 30; f++) gm.update(1 / 60);
    var held = gm.player.cell === expect || gm.won;
    if (one && three && held) stepOk++; else { stepBad++; print('step fail q=' + q + ' one=' + one + ' three=' + three + ' held=' + held); }
  }
  print('Step checks ok: ' + stepOk + ', bad: ' + stepBad);
  if (stepBad) throw new Error('step tests failed');

  print('Autopilot runs: ' + stats.runs + ', won: ' + stats.won + ', lost: ' + stats.lost + ' ' + JSON.stringify(lostList) + ', stuck: ' + stats.stuck + ', sim time: ' + Math.round(stats.time) + 's');
  print('Glide checks ok: ' + glideOk + ', bad: ' + glideBad);
  print('Events: ' + JSON.stringify(events));
  if (stats.stuck || glideBad) throw new Error('game tests failed');
})();

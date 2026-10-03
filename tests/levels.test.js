/* Проверка уровней: решаемость, обязательность дверей, достижимость ключей, безопасный старт */
(function () {
  var L = MZ.levels, M = MZ.maze;
  var fails = 0, total = 0, t0 = Date.now(), slowest = 0, slowName = '';
  function fail(msg) { fails++; if (fails < 15) print('FAIL: ' + msg); }

  function check(lv, name) {
    total++;
    var g = lv.grid;
    var gateEdge = {};
    lv.gates.forEach(function (gt, k) { gateEdge[gt.a * 4 + gt.dir] = k; gateEdge[gt.b * 4 + M.OPP[gt.dir]] = k; });
    var links = new Map();
    lv.portals.forEach(function (p) { links.set(p.a, [p.b]); links.set(p.b, [p.a]); });
    function reach(openUpTo) { // двери с индексом < openUpTo открыты
      return M.bfs(g, lv.start, { links: links, blocked: function (i, d) {
        if (d < 0) return false; var k = gateEdge[i * 4 + d]; return k != null && k >= openUpTo; } }).dist;
    }
    // Все двери открыты — достижимо всё
    var all = reach(99);
    g.activeList().forEach(function (c) { if (all[c] < 0) fail(name + ' unreachable cell ' + c); });
    // Каждая дверь обязательна, ключ к ней доступен до неё
    lv.gates.forEach(function (gt, k) {
      var d = reach(k);
      if (d[lv.exit] >= 0) fail(name + ' gate ' + k + ' is bypassable');
      var key = lv.keys.filter(function (kk) { return kk.color === gt.color; })[0];
      if (!key) fail(name + ' no key for gate ' + k);
      else if (d[key.cell] < 0) fail(name + ' key ' + k + ' behind its gate');
    });
    // Уникальность клеток объектов
    var seen = {};
    [lv.start, lv.exit].concat(lv.items.map(function (i) { return i.cell; }), lv.keys.map(function (k) { return k.cell; }),
      [].concat.apply([], lv.portals.map(function (p) { return [p.a, p.b]; }))).forEach(function (c) {
      if (seen[c]) fail(name + ' overlapping objects at ' + c); seen[c] = 1; });
    // Враги не у старта
    var ds = M.bfs(g, lv.start, { links: links }).dist;
    lv.enemies.forEach(function (e) { if (ds[e.cell] < 3) fail(name + ' enemy too close to start'); });
    if (lv.required < 1) fail(name + ' no required items');
    if (!(lv.optimalSteps > 0)) fail(name + ' bad optimalSteps');
  }

  var ages = L.AGE_ORDER, modes = L.CAMPAIGN_MODES, aspects = [0.55, 1, 1.8];
  var summary = {};
  ages.forEach(function (age) {
    modes.forEach(function (mode) {
      for (var i = 0; i < 48; i++) {
        var a = aspects[i % 3];
        var s = Date.now();
        var lv = L.buildLevel(L.campaignSpec(age, mode, i, a));
        var dt = Date.now() - s;
        if (dt > slowest) { slowest = dt; slowName = age + '/' + mode + '/' + i + ' ' + lv.cols + 'x' + lv.rows; }
        check(lv, age + '/' + mode + '/' + i);
        if (mode === 'classic' && (i === 0 || i === 20 || i === 39)) {
          summary[age + ' #' + (i + 1)] = lv.cols + 'x' + lv.rows + ' items=' + lv.required + ' gates=' + lv.gates.length +
            ' portals=' + lv.portals.length + ' opt=' + lv.optimalSteps + ' dec=' + lv.meta.decisions + ' algo=' + lv.algo + (lv.shape ? ' shape=' + lv.shape : '');
        }
        if (mode === 'enemies' && i === 39) summary[age + ' enemies #40'] = lv.enemies.map(function (e) { return e.type; }).join(',');
      }
    });
    for (var d = 0; d < 10; d++) check(L.buildLevel(L.dailySpec(age, '2026-09-' + (10 + d))), age + '/daily/' + d);
    // Сказочные переопределения, включая ASCII-форму
    check(L.buildLevel({ age: age, mode: 'story', index: 0, seed: 'story|' + age, override: { world: 2, keys: 2, enemies: 2, dark: true, portals: 1, loops: 0.5,
      ascii: ['...####...', '..######..', '.########.', '##########', '.########.', '..######..', '...####...'] } }), age + '/story');
  });
  for (var k in summary) print(k + ': ' + summary[k]);
  print('\nLevels checked: ' + total + ', failures: ' + fails + ', time: ' + (Date.now() - t0) + 'ms, slowest: ' + slowest + 'ms (' + slowName + ')');
  if (fails) throw new Error('tests failed');
})();

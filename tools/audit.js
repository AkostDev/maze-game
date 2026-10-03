/* Аудит вёрстки: проходит по всем экранам и модалкам, ищет элементы, которые вылезают за экран
   или чей текст не помещается в свой блок. Запускается через tools/audit.sh */
(function () {
  var W = document.documentElement.clientWidth, report = [];
  function desc(e) {
    var t = (e.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 28);
    return e.tagName.toLowerCase() + (e.className && typeof e.className === 'string' ? '.' + e.className.trim().split(/\s+/).join('.') : '') + (t ? ' «' + t + '»' : '');
  }
  function audit(name) {
    var issues = [];
    document.querySelectorAll('.screen *, .modal *, .hud *, .hud-bottom *, .intro-card *, .owl *').forEach(function (e) {
      if (!e.getClientRects().length) return;
      var cs = getComputedStyle(e);
      if (cs.visibility === 'hidden' || cs.display === 'inline') return;
      if (e.closest('.chips, .tabs') || e.matches('.round-btn')) return; // прокрутка и значки-бейджи — намеренно
      var r = e.getBoundingClientRect();
      if (r.width < 1) return;
      if (r.right > W + 1 || r.left < -1) issues.push('за экраном: ' + desc(e) + ' [' + Math.round(r.left) + '..' + Math.round(r.right) + ']');
      var clip = cs.overflowX === 'hidden' && cs.textOverflow === 'ellipsis';
      if (clip && e.scrollWidth > e.clientWidth + 1) issues.push('многоточие: ' + desc(e));
      if (!clip && cs.overflowX === 'visible' && e.scrollWidth > e.clientWidth + 2 && e.clientWidth > 0 && e.tagName !== 'svg' && e.tagName !== 'CANVAS')
        issues.push('не влезает: ' + desc(e) + ' [' + e.scrollWidth + '>' + e.clientWidth + ']');
    });
    var uniq = issues.filter(function (x, i) { return issues.indexOf(x) === i; });
    report.push(name + ': ' + (uniq.length ? '\n    ' + uniq.slice(0, 12).join('\n    ') : 'ok'));
  }
  var UI = MZ.ui, app = MZ.app;
  UI.show('welcome', {}); audit('Онбординг·возраст');
  UI.welcomeState.age = 'kid'; UI.welcomeState.step = 2; UI.screensEl.innerHTML = ''; UI.screensEl.appendChild(UI.welcome({ keep: true })); audit('Онбординг·герой');
  UI.welcomeState = null;
  UI.show('home'); audit('Главная');
  UI.show('levels', 'classic'); audit('Уровни');
  UI.show('story'); audit('Сказка');
  UI.show('records'); audit('Рекорды');
  UI.show('achievements'); audit('Достижения');
  UI.show('settings'); audit('Настройки');
  UI.show('home'); UI.profilesModal(); audit('Кто играет');
  UI.closeModal();
  app.startCampaign('enemies', 12); audit('Игра·HUD');
  UI.pauseModal(app.level); audit('Пауза');
  UI.closeModal();
  UI.resultModal({ won: true, stars: 3, score: 12840, time: 125, steps: 187, optimal: 150, age: 'kid', hintsUsed: 0 },
    { level: app.level, newBest: true, unlocked: [MZ.progress.ACHIEVEMENTS[0], MZ.progress.ACHIEVEMENTS[12]] });
  audit('Итоги');
  return 'ШИРИНА ' + W + '\n  ' + report.join('\n  ');
})();

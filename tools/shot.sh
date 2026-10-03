#!/bin/sh
# Скриншот игры движком WebKit (как Safari) без открытия окон.
# Пример: tools/shot.sh out.png 390 844 "MZ.app.createProfile('Аня','kid','cat'); MZ.app.startCampaign('classic',5)"
# Сервер на :8765 поднимается сам, если не запущен (tools/_server.sh).
cd "$(dirname "$0")/.."
. tools/_server.sh || exit 1
BIN=tools/.snap
[ -x "$BIN" ] || swiftc -O tools/snap.swift -o "$BIN" || exit 1
# Окно вне экрана система считает скрытым и замораживает анимации — отключаем их и подменяем rAF
PRE="(function(){var st=document.createElement('style');st.textContent='*,*::before,*::after{animation:none!important;transition:none!important}';document.head.appendChild(st);window.requestAnimationFrame=function(f){return setTimeout(function(){f(performance.now())},16)};MZ.app.loop(performance.now());})();MZ.progress.setSetting('music',false);"
"$BIN" "http://127.0.0.1:8765/index.html?debug" "$1" "${2:-390}" "${3:-844}" "$PRE ${4:-} ; 'ok'" "${5:-1.5}"

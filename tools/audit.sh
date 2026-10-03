#!/bin/sh
# Аудит мобильной вёрстки на нескольких ширинах. Сервер на :8765 поднимается сам (tools/_server.sh).
cd "$(dirname "$0")/.."
. tools/_server.sh || exit 1
BIN=tools/.snap
[ -x "$BIN" ] || swiftc -O tools/snap.swift -o "$BIN" || exit 1
PRE="(function(){var st=document.createElement('style');st.textContent='*,*::before,*::after{animation:none!important;transition:none!important}';document.head.appendChild(st);window.requestAnimationFrame=function(f){return setTimeout(function(){f(performance.now())},16)};MZ.app.loop(performance.now());})();MZ.progress.setSetting('music',false);MZ.progress.setSetting('voice',false);MZ.config.ai.enabled=false;"
SEED="var P=MZ.progress;var a=P.createProfile('Александра','kid','cat');var m=P.createProfile('Миша','teen','frog');P.setActive(a.id);[0,1,2,3,4].forEach(function(i){P.recordWin({won:true,stars:i%3+1,score:1500+i*170,time:30+i*7,steps:60+i,optimal:50,hintsUsed:0,hits:0,items:3,bonus:0,gates:1,portals:0,timeLeft:0,mode:'classic',index:i,age:'kid',title:MZ.levels.localTitle(i),perfectPath:false,noHints:true},{worldId:'forest'});});MZ.app.applySettings();"
for W in ${WIDTHS:-320 360 390 430 768}; do
  "$BIN" "http://127.0.0.1:8765/index.html?debug" "${OUT:-/tmp}/audit_$W.png" "$W" 800 "$PRE $SEED 'ok'" 1.2 "$(cat tools/audit.js)" | grep -v '^JS result\|^saved'
done

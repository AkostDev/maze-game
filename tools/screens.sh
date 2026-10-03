#!/bin/sh
# Скриншоты типовых экранов на телефоне (360×780) и ПК (1280×800) одной командой; печатает пути к PNG.
#   tools/screens.sh home levels game-dark        пресеты (список ниже), по два снимка на каждый
#   tools/screens.sh -m game                      только телефон;  -d — только ПК
#   tools/screens.sh -j "MZ.app.startCampaign('time',7)" mycase     свой сценарий под именем mycase
#   AGE=tiny HERO=bunny MODE=classic LEVEL=5 OUT=dir tools/screens.sh game
#   HD=1 — оставить снимок в 2x (по умолчанию ужимается до 1x: картинка для Claude в ~4 раза дешевле)
# Пресеты: welcome welcome2 home levels story records achievements settings profiles
#          intro game game-time game-enemies game-dark game-story pause result lose
cd "$(dirname "$0")/.."
. tools/_server.sh || exit 1
OUT="${OUT:-${TMPDIR:-/tmp}/klubok-shots}"; mkdir -p "$OUT"
AGE="${AGE:-kid}"; HERO="${HERO:-cat}"; MODE="${MODE:-classic}"; LEVEL="${LEVEL:-5}"
SIZES="m d"; CUSTOM=""
while [ $# -gt 0 ]; do
  case "$1" in
    -m) SIZES="m"; shift;;
    -d) SIZES="d"; shift;;
    -j) CUSTOM="$2"; shift 2;;
    *) break;;
  esac
done
[ $# -gt 0 ] || { sed -n '2,9p' "$0"; exit 64; }

# Профиль с прогрессом, чтобы экраны выглядели «обжитыми»
SEED="var P=MZ.progress;var a=P.createProfile('Александра','$AGE','$HERO');P.createProfile('Миша','teen','frog');P.setActive(a.id);[0,1,2,3,4,5,6].forEach(function(i){P.recordWin({won:true,stars:i%3+1,score:1500+i*170,time:30+i*7,steps:60+i,optimal:50,hintsUsed:0,hits:0,items:3,bonus:0,gates:1,portals:0,timeLeft:0,mode:'classic',index:i,age:'$AGE',title:MZ.levels.localTitle(i),perfectPath:false,noHints:true},{worldId:'forest'});});MZ.progress.setSetting('voice',false);MZ.config.ai.enabled=false;MZ.app.applySettings();"
PLAY="MZ.ui.hideIntro();MZ.app.game.begin();MZ.ui.hideOwl();"

js_for() {
  case "$1" in
    welcome) echo "MZ.ui.show('welcome',{})";;
    welcome2) echo "MZ.ui.show('welcome',{age:'$AGE'});MZ.ui.welcomeState.step=2;MZ.ui.screensEl.innerHTML='';MZ.ui.screensEl.appendChild(MZ.ui.welcome({keep:true}))";;
    home) echo "$SEED MZ.ui.show('home')";;
    levels) echo "$SEED MZ.ui.show('levels','$MODE')";;
    story|records|achievements|settings) echo "$SEED MZ.ui.show('$1')";;
    profiles) echo "$SEED MZ.ui.show('home');MZ.ui.profilesModal()";;
    intro) echo "$SEED MZ.app.startCampaign('$MODE',$LEVEL)";;
    game) echo "$SEED MZ.app.startCampaign('$MODE',$LEVEL);$PLAY";;
    game-time) echo "$SEED MZ.app.startCampaign('time',$LEVEL);$PLAY";;
    game-enemies) echo "$SEED MZ.app.startCampaign('enemies',12);$PLAY";;
    game-dark) echo "$SEED MZ.app.startCampaign('dark',$LEVEL);$PLAY";;
    game-story) echo "$SEED MZ.app.startStory(MZ.app.pickStory('sea'));$PLAY";;
    pause) echo "$SEED MZ.app.startCampaign('$MODE',$LEVEL);$PLAY MZ.app.pause()";;
    result) echo "$SEED MZ.app.startCampaign('$MODE',$LEVEL);MZ.ui.hideIntro();MZ.ui.resultModal({won:true,stars:3,score:12840,time:125,steps:187,optimal:150,age:'$AGE',hintsUsed:0},{level:MZ.app.level,newBest:true,unlocked:[MZ.progress.ACHIEVEMENTS[0]]})";;
    lose) echo "$SEED MZ.app.startCampaign('time',$LEVEL);MZ.ui.hideIntro();MZ.ui.loseModal({reason:'time',age:'$AGE',title:MZ.app.level.title})";;
    *) return 1;;
  esac
}

rc=0
for name in "$@"; do
  if [ -n "$CUSTOM" ]; then js="$SEED $CUSTOM"; else js=$(js_for "$name") || { echo "нет пресета: $name"; rc=1; continue; }; fi
  for s in $SIZES; do
    if [ "$s" = m ]; then w=360; h=780; else w=1280; h=800; fi
    f="$OUT/$name-$s.png"
    res=$(tools/shot.sh "$f" "$w" "$h" "$js" 1.5 2>&1)
    if echo "$res" | grep -q '^saved'; then
      [ -n "$HD" ] || sips -Z "$([ "$s" = m ] && echo $h || echo $w)" "$f" >/dev/null 2>&1
      err=$(echo "$res" | grep -E 'PAGE ERROR|JS error')
      echo "$f${err:+   ⚠ $err}"
    else echo "ОШИБКА $name ${w}x$h: $(echo "$res" | tail -2 | tr '\n' ' ')"; rc=1; fi
  done
done
exit $rc

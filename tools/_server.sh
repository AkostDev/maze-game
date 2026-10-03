# Общий хелпер: локальный сервер на :8765 для скриншотов и аудита. Подключать из скрипта: `. tools/_server.sh || exit 1`
# Поднимает сервер, если его ещё нет, и гасит при выходе из скрипта (только если поднял сам).
# Код намеренно не в функции: в zsh `trap … EXIT` внутри функции срабатывает при выходе из неё и убивает сервер.
# Без сервера tools/.snap ждёт страницу 110 с и пишет «timeout» — поэтому проверяем заранее.
KLUBOK_URL="http://127.0.0.1:8765/index.html"
if ! curl -s -o /dev/null --max-time 2 "$KLUBOK_URL"; then
  python3 -m http.server 8765 --bind 127.0.0.1 >/dev/null 2>&1 &
  KLUBOK_SRV=$!
  trap 'kill "$KLUBOK_SRV" 2>/dev/null' EXIT
  _up=""
  for _i in 1 2 3 4 5 6 7 8 9 10 11 12; do
    if curl -s -o /dev/null --max-time 1 "$KLUBOK_URL"; then _up=1; break; fi
    sleep 0.3
  done
  [ -n "$_up" ] || { echo "не удалось поднять сервер на :8765"; return 1 2>/dev/null || exit 1; }
fi

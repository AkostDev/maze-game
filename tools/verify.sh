#!/bin/sh
# Проверка одним вызовом с коротким выводом: подробности печатаются только при ошибке (бережёт контекст Claude).
#   tools/verify.sh       тесты логики в Node (уровни, автопилот, прогресс, данные графики, PWA) + сверка базы знаний
#   tools/verify.sh ui    то же + смоук в настоящем браузере: все сцены на телефоне и ПК (headless Chromium, ~40 с)
cd "$(dirname "$0")/.."
MODE="${1:-quick}"
LOG="${TMPDIR:-/tmp}/klubok-verify.$$.log"
rc=0

if node --test --test-reporter=spec test/*.test.js > "$LOG" 2>&1; then
  echo "тесты: ok — $(grep -o 'Levels checked: [0-9]*, failures: [0-9]*' "$LOG"); $(grep -o 'Autopilot runs: [0-9]*, won: [0-9]*, lost: [0-9]*' "$LOG"); всего тестов: $(grep -o 'pass [0-9]*' "$LOG" | grep -o '[0-9]*')"
else
  echo "тесты: ОШИБКА"; grep -nE '^✖|AssertionError|SyntaxError|Error:' "$LOG" | head -20; echo '--- хвост вывода ---'; tail -12 "$LOG"; rc=1
fi

if [ "$MODE" = "ui" ]; then
  if node test/browser.smoke.mjs > "$LOG" 2>&1; then
    echo "браузер: ok — $(tail -1 "$LOG" | sed 's/^Browser smoke: OK — //')"
  else
    echo "браузер: ОШИБКА"; grep -v '^$' "$LOG" | tail -15; rc=1
  fi
fi

python3 tools/kb.py check || rc=1
rm -f "$LOG"
exit $rc

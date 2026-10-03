#!/bin/sh
# Проверка одним вызовом с коротким выводом: подробности печатаются только при ошибке (бережёт контекст Claude).
#   tools/verify.sh       тесты (синтаксис, 812 уровней, автопилот, смоук интерфейса) + сверка базы знаний
#   tools/verify.sh ui    то же + аудит вёрстки на 320–768 px (сервер поднимается сам)
cd "$(dirname "$0")/.."
MODE="${1:-quick}"
LOG="${TMPDIR:-/tmp}/klubok-verify.$$.log"
rc=0

if ./tests/run.sh > "$LOG" 2>&1 && grep -q 'UI smoke: OK' "$LOG"; then
  echo "тесты: ok — $(grep -o 'Levels checked: [0-9]*, failures: [0-9]*' "$LOG"); $(grep -o 'Autopilot runs: [0-9]*, won: [0-9]*, lost: [0-9]*' "$LOG"); UI smoke ok"
else
  echo "тесты: ОШИБКА"; grep -nE 'FAIL|STUCK|Error|Exception|bad: [1-9]' "$LOG" | head -20; echo '--- хвост вывода ---'; tail -12 "$LOG"; rc=1
fi

if [ "$MODE" = "ui" ]; then
  if . tools/_server.sh; then
    tools/audit.sh > "$LOG" 2>&1
    # Ошибки — «за экраном» и «не влезает»; «многоточие» (текст обрезан с …) — только предупреждение одной строкой
    awk '
      /^ШИРИНА/ { w = $2; widths = widths " " w; next }
      /^  [^ ]/ { scr = $0; sub(/^  /, "", scr); sub(/:.*$/, "", scr); next }
      /^    многоточие/ { if (!(scr in warn)) order[++n] = scr; warn[scr]++; next }
      /^    / { sub(/^    /, ""); printf "  %s px · %s · %s\n", w, scr, $0; bad++; next }
      /PAGE ERROR|JS error|POST error|timeout|snapshot failed/ { printf "  %s\n", $0; bad++ }
      END {
        if (widths == "") { print "  аудит не дал результата"; bad++ }
        ws = ""; for (i = 1; i <= n; i++) ws = ws (i > 1 ? ", " : "") order[i] " ×" warn[order[i]]
        printf "вёрстка: %s — ширины%s%s\n", (bad ? "ПРОБЛЕМЫ (" bad ")" : "ok"), widths, (ws != "" ? "; обрезка текста «…»: " ws : "")
        exit bad ? 1 : 0
      }' "$LOG" || rc=1
  else rc=1; fi
fi

python3 tools/kb.py check || rc=1
rm -f "$LOG"
exit $rc

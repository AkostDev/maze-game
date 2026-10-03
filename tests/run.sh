#!/bin/sh
# Тесты логики без браузера и Node: используется JavaScriptCore из macOS.
cd "$(dirname "$0")/.."
JSC=/System/Library/Frameworks/JavaScriptCore.framework/Versions/Current/Helpers/jsc
[ -x "$JSC" ] || { echo "jsc не найден (нужна macOS)"; exit 1; }
echo "== Синтаксис =="
for f in js/*.js sw.js; do
  "$JSC" -e "try { checkSyntax('$f'); } catch (e) { print('$f: ' + e); quit(1); }" || exit 1
done
echo "ok"
echo "== Уровни =="
"$JSC" -e 'var window = globalThis;' js/config.js js/util.js js/maze.js js/levels.js tests/levels.test.js || exit 1
echo "== Игровой движок =="
"$JSC" -e 'var window = globalThis;' js/config.js js/util.js js/maze.js js/levels.js js/sprites.js js/audio.js js/game.js tests/game.test.js || exit 1
echo "== Интерфейс (смоук) =="
# Вывод смоука длинный — показываем только итог; при падении печатаем шаг с ошибкой (через `| tail` код возврата терялся)
SMOKE=$("$JSC" tests/dom-stub.js js/config.js js/util.js js/maze.js js/levels.js js/sprites.js js/render.js js/audio.js js/input.js js/progress.js js/ai.js js/story.js js/game.js js/ui.js js/main.js tests/ui.smoke.js 2>&1)
echo "$SMOKE" | grep -q '^UI smoke: OK$' || { echo "$SMOKE" | grep -A8 'FAIL' | head -30; echo "$SMOKE" | tail -3; exit 1; }
echo "UI smoke: OK"
echo "Все тесты пройдены"

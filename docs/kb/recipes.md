# Рецепты: что и где менять

Чек-листы для типовых задач. Имена — как в коде; где что лежит по строкам — в MAP.md. После любого рецепта: `tools/verify.sh`
(для интерфейса — `tools/verify.sh ui` + снимки `tools/screens.sh`), затем обнови затронутые документы базы знаний.

## Новый мир
1. levels.js `WORLDS` — объект мира (все поля как у соседей: цвета, `item`, `itemGender`, `itemName` в трёх формах, `enemy`, `enemyName`, 10 `names`).
2. sprites.js — ветки в `drawItem()` (вид находки), `drawEnemy()` (вид сторожа), `drawDeco()` (декор пола).
3. audio.js `SCALES` — лад и темп музыки мира.
4. Сказки: story.js `WORLD_IDS`, `ITEMS_NOM`, `TALES`, `THEMES`; ai.js `WORLD_IDS` и текст промпта в `storyPrompt()`; массив id миров в `story()` (ui.js).
5. Кампания: мир уровня считает `worldFor()` — 5 миров × `LEVELS_PER_WORLD` = `CAMPAIGN_LEVELS`. Шестой мир попадёт в кампанию только
   с увеличением `CAMPAIGN_LEVELS` (тогда поправь тексты «40 уровней», достижения `campaign` и `worlds_5`, цикл в tests/levels.test.js).

## Новый герой
sprites.js: запись в `HEROES` (`id, name, body, belly, accent, thread`) + ветка в `drawHero()` (последняя ветка — else). Выбор героя, аватары и нить
подхватятся сами (`welcome()`, `heroCanvas()`, `drawTrail()`). Сетка `.heroes` / `.hero-pick` рассчитана на 5 — проверь онбординг на 320 px.

## Новый предмет-бонус (как часы/светлячок/сердце)
1. levels.js: количество в `extras` (`resolveParams()`) и расстановка `placeSpread(…, 'вид')` в `designCandidate()`.
2. game.js `take()` — эффект бонуса. 3. sprites.js `drawItem()` — рисунок. 4. При необходимости — подсказка в `intro()` и светимость в `drawFog()`.

## Новая механика уровня (лёд, односторонние проходы, кнопки…)
1. Данные: новое поле level в `designCandidate()` → `buildLevel()` (и в data.md). Расстановка — после дверей/регионов, с учётом `used`.
2. Решаемость: учесть в `greedyTour()` (иначе `optimalSteps` и проверка проходимости врут) и в проверках tests/levels.test.js.
3. Правила: `passable()`, `arrive()`, при необходимости `chooseDir()` / `chooseStep()`; враги — `enemyNext()`; подсказка — `useHint()` (она ходит по `passable()`).
4. Отрисовка: статичное — `buildLayer()`, меняющееся — `draw()`; спрайт в sprites.js.
5. Событие для совёнка: `emit()` в game.js → ветка в `onEvent()`. Автопилот в tests/game.test.js должен уметь проходить механику.
6. Включение по возрасту/уровню — поле в `AGES` (по образцу `gateFrom`, `portalFrom`).

## Новый тип сторожа
levels.js: выбор `type` в `designCandidate()` (пороги — поля `AGES`); game.js `enemyNext()` — поведение; при своём рисунке — `drawEnemy()`.
Проверь сон (`updateEnemies()`), безопасную зону старта и автопилот (в tests/game.test.js `stuck` — провал, поражения — нет).

## Новый режим
1. levels.js `MODES` (`id, name, desc, icon, color`). Кампанийный (с картой уровней и прогрессом) — ещё и в `CAMPAIGN_MODES`.
2. Правила — флаг в `rules` в `resolveParams()`; читать его в game.js / render.js / `showHud()` / `intro()` (правила берутся из `level.rules`, не из имени режима).
3. Интерфейс: список режимов в `home()` и вкладки в `records()` (массивы id в ui.js), `MODE_COLORS` + класс `.c-…` в CSS; для особого режима — ветка в `openMode()`, `next()`, `quit()`, `showHud()`.
4. Прогресс: `recordWin()` (кампания пишет в `modeProgress()`; особые режимы — своя ветка, как daily), достижение `all_modes` (target = число режимов).
5. Тесты: циклы по `CAMPAIGN_MODES` подхватят сами; для особого режима добавь прогон в tests/game.test.js и шаг в tests/ui.smoke.js.

## Новая настройка
1. progress.js `DEFAULT_SETTINGS` — ключ и значение по умолчанию (миграция старых сохранений произойдёт сама в `load()`).
2. ui.js `settings()` — строка `sw(...)` для булевой или `seg(...)` для выбора.
3. main.js `applySettings()` — применить (или читать `P.settings.ключ` в месте использования; для игры — передать в `Game.start()` через `startLevel()`).

## Новый экран
Метод в объекте `UI` (ui.js) по образцу `achievements()`: возвращает `this.screen([this.topbar(this.backBtn(…), 'Заголовок'), …])`; открывается
`show('имя', arg)`. Кнопка входа — в `home()` или `settings()`. Стили — новый раздел в css/style.css. Добавь экран в tests/ui.smoke.js, tools/audit.js
и пресет в tools/screens.sh.

## Новая модалка
Метод по образцу `confirm()` / `pauseModal()`: `openModal([...узлы], dismiss)`; кнопки в `.modal-actions`. Если открывается во время игры —
поставь `game.paused` (см. `pause()`), иначе игра продолжит идти под модалкой.

## Новая иконка / звук / фраза
- Иконка: ключ в `ICONS` (ui.js) — содержимое SVG 24×24 штрихом; заливка — константой F. Использование: `icon()` / `iconEl()`.
- Звук: ключ в `SFX` (audio.js) из `tone()` / `noise()`; вызов `audio.play('имя')`.
- Реплика совёнка на событие: `emit()` в game.js → ветка в `onEvent()` → `owl()`; случайные фразы — `LOCAL_PHRASES` + вид в `fetchPhrases()`.
  Малышам — озвучка: второй аргумент `owl()`; числа — словами (`numWord()`, `plural()`).

## Новое достижение / показатель статистики
progress.js: счётчик — в `blankStats()` и приращение в `recordWin()` (данные берутся из result — при необходимости добавь поле в `result()`);
запись в `ACHIEVEMENTS` (`id, title, desc, icon, target, value`). Экран достижений и сводка обновятся сами.

## Новый показатель в HUD
ui.js: чип `.hchip` в `showHud()` + обновление в `updateHud()` и **обязательно значение в строке-подписи** `sig`. Проверь ширину HUD на 320 px
(`tools/verify.sh ui`).

## Новый файл скрипта
index.html (порядок зависимостей!) → sw.js (список ASSETS) → tests/run.sh (списки файлов для jsc — в том же порядке) → строка в таблице CLAUDE.md.
Модуль — IIFE с `const MZ = root.MZ = root.MZ || {}` и экспортом `MZ.имя = …`.

## Выпуск версии
`MZ.config.version` (config.js) и имя кэша в sw.js (иначе у установленных PWA останутся старые файлы) → docs/PLAN.md → статус в CLAUDE.md.

## Изменение формата сохранений
Новое поле с умолчанием — через `blankStats()` / `blankProfile()` / `DEFAULT_SETTINGS` и миграцию в `load()`. Несовместимое изменение — новая версия
`v` и ключа `KEY`, с переносом старых данных. Ключ прогресса кампании — `режим@возраст` (`modeProgress()`).

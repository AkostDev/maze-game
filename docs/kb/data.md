# Структуры данных

Источники: js/levels.js, js/game.js, js/progress.js, js/story.js

## Координаты и сетка (maze.js)
- Клетка — индекс `i = y * cols + x`. Направления `d`: 0 вверх, 1 вправо, 2 вниз, 3 влево; биты проходов 1, 2, 4, 8 (`DIRS`), обратное — `OPP[d]`.
- `Grid`: `cols, rows, n, cells: Uint8Array` (битмаска открытых проходов), `mask: Uint8Array` (1 — клетка существует; фигурные лабиринты).
  Методы: `idx()`, `x()`, `y()`, `active()`, `neighbor()` (−1 если нет), `isOpen()`, `carve()`, `degree()`, `activeList()`, `dirBetween()`.
- Мировые координаты — в клетках: центр клетки `(x + 0.5, y + 0.5)`. Ключ ребра: `cell * 4 + dir` (`edgeKey()`, `Game.gateAt`).

## spec → `buildLevel()`
`{ age, mode, index, aspect, seed, fixedAspect?, title?, story?, override? }`
`override` (сказка): `{ world, sizeT, shape, ascii, items, keys, enemies, portals, dark, timer, loops }` — всё зажимается в лимиты возраста.
Фабрики: `campaignSpec()`, `dailySpec()`, `MZ.story.levelSpec()`.

## level (результат `buildLevel()`)
```
seed, age (id), mode, index, endless, world (объект), worldIndex, grid, cols, rows, start, exit,
items:   [{ cell, kind: 'item' | 'clock' | 'firefly' | 'heart', taken }]   // 'item' — обязательные находки
keys:    [{ cell, color, taken }]            // color — индекс в KEY_COLORS
gates:   [{ a, b, dir, color, open, openT, shake }]   // ребро a→b по dir
portals: [{ a, b, color }]                   // color — индекс в PORTAL_COLORS
enemies: [{ type: 'patrol' | 'wander' | 'chaser', cell, route, speed, safe }]
required, optimalSteps, timeLimit, fog, rules: { timer, enemies, dark, countUp },
hearts, speed, chaseRange, title, shape, algo, meta: { cells, deadEnds, junctions, decisions, pathLen }, story
```
Правила уровня читаются только из `level.rules` (не из `mode`): сказка может включить любые.
`level.gates[*].open/openT/shake` и `items/keys[*].taken` мутируются игрой; `Game.start()` сбрасывает двери, но `retry()` всё равно строит уровень заново.

## Мир (`WORLDS`) и возраст (`AGES`)
Мир: `id, name, short, bg[2], floor[2], wall, wallHi, shadow, deco[3], item, itemGender ('m'|'f'|'n'), itemName[3 формы], enemy, enemyName, names[10]`.
Возраст — поля и смысл (значения — в levels.md): `size, items, gates, gateFrom, portalFrom, portals, braid, algos, newest, speed,
enemies, enemySpeed, wanderFrom, chaserFrom, chaseRange, hearts, timeFactor, fog, hints, offPath, shapeFrom, minCellPx,
decisionTarget, stars, sleep` + `id, label, title, blurb`. Пары `[a, b]` — значение в начале и в конце кампании.

## Состояние `Game` (после `start()`)
```
level, age (объект AGES), heroId, showTrail, moveMode ('step' | 'glide')
time (идёт всегда — анимации), elapsed (только в игре, без паузы), started, won, lost, paused, lastLoss
steps, hits, hintsUsed, hintsLeft, hearts, maxHearts, remaining, exitOpen, exitOpenT
keysHeld: Set<color>, itemsTaken, bonusTaken, gatesOpened, portalsUsed
timeLeft, overtime, lightRadius, visited: Uint8Array, trail: [[x, y, флагРазрыва]], hint: { path, progress, life } | null
ввод: heldDir, heldSince, holdDelay, bufferDir, bufferAt, gliding, traceQueue[], stepQueue[] (≤ 3)
индексы: itemAt, keyAt, portalAt (cell → парная клетка), gateAt (cell*4+dir → gate)
player:  { cell, from, to, t, moving, flowing, dir, lastDir, px, py, lookX, lookY, squash, blink, blinkT, invuln, stun, teleportT, justTeleported }
enemies: [{ type, route, ri, rdir, cell, from, to, t, moving, px, py, dirX, dirY, lastDir, speed, safe, phase, asleep, wantSleep, sleepT }]
startDist (BFS от старта), chaseField, chaseFrom, sleepSeen
```

## result (`result()` → `onWin`/`onLose` → `recordWin()`)
`won, stars, score, time, steps, optimal, hintsUsed, hits, items, bonus, gates, portals, timeLeft, overtime, mode, index, age,
title, seed, perfectPath, noHints, dark, enemies, timer` (+ `reason: 'time' | 'caught'` при поражении).

## Хранилище `klubok.v1` (progress.js, `P.state`)
```
{ v: 1, profiles: [...], activeId, settings: {...}, records: [...] }
profile: { id, name (≤16), age, hero, created, lastMode,
           progress: { "режим@возраст": { unlocked, levels: { index: { stars, time, steps, score } } } },
           daily: { last, streak, bestStreak, results: { 'YYYY-MM-DD': { time, stars, score } } },
           stats: {...}, achievements: { id: timestamp } }
stats:   wins, items, gates, steps, hints, hits, portals, bonus, play, perfect, noHint, shortest, fastTime,
         noHitEnemy, darkWins, storyWins, dailyWins, worlds: { id: 1 }, modesWon: { mode: 1 }
record:  { pid, name, hero, age, mode, index, title, time, steps, stars, score, date, day }
```
- Настройки (`DEFAULT_SETTINGS`): `sound, music, voice, vibration, trail, dpad, ai` (bool), `theme` ('auto'|'light'|'dark'),
  `glide` (bool; false = пошагово), `speech` ('normal'|'slow'), `voiceName` (''= лучший голос).
- Лимиты: 8 профилей (старый вытесняется), `MAX_RECORDS` = 400 (лишние по очкам отбрасываются).
- Миграция в `load()`: недостающие поля дополняются из `blankStats()` / `DEFAULT_SETTINGS`. Новое поле профиля/статистики/настройки
  обязательно получает значение по умолчанию там же — иначе старые сохранения сломаются. Смена формата → новая версия `v` и ключа.
- Доступ: `P.active()`, `P.settings`, `setSetting()`, `modeProgress()` (создаёт запись при первом обращении), `totalStars()`, `modeStars()`, `records()`.

## Сказка (story.js / ai.js)
`{ id, ai (bool), age, theme, world (id), title, intro, goal, outro, item, shape | null, art (ASCII-строки) | null, size 0…1, keys, enemies, portals, dark, loops 0…1 }`

## Кэш ИИ `klubok.ai.v1` (`AI.cache`)
`{ stories: { age: [≤5 сказок] }, names: { "age|worldIndex": [8] }, phrases: { age: { at, start[], collect[], stuck[], win[], lose[] } }, stats: { ok, fail, avgMs, model } }`

## Достижение (`ACHIEVEMENTS`)
`{ id, title, desc, icon (имя из ICONS), target, value(profile, P) → число }` — выдаётся в `checkAchievements()` при `value >= target`.

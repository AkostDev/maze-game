# Структуры данных

Источники: src/core/levels.js, src/core/game.js, src/core/progress.js, src/core/worlds.js

## Сетка — `Grid` (src/core/maze.js)
`cells[i]` — битмаска проходов из клетки: N=1, E=2, S=4, W=8. Индекс клетки `i = y * cols + x`. `mask[i] = 1` — клетка существует
(фигурные лабиринты). Направления `d`: 0 — вверх, 1 — вправо, 2 — вниз, 3 — влево (`DIRS`, обратное — `OPP`).

## Спецификация и уровень
`levelSpec(index, aspect)` → `{ index, aspect, seed: 'v2|index' }`.

`buildLevel()` возвращает level:
| Поле | Значение |
|---|---|
| `seed`, `index`, `endless`, `d` | сид, номер с нуля, бесконечный ли режим, сложность 0…1 |
| `world`, `worldIndex` | запись из `WORLDS` и её номер |
| `grid`, `cols`, `rows`, `shape` | сетка, размеры, имя фигуры или null |
| `start`, `exit` | клетки старта и домика |
| `items[]` | `{ cell, kind, taken }`; kind: `item` (обязательная находка мира), `firefly`, `heart` |
| `keys[]`, `gates[]` | `{ cell, color, taken }` и `{ a, b, dir, color, open }` — дверь на ребре a→b; color — индекс в `KEY_COLORS` |
| `portals[]` | `{ a, b, color }`; color — индекс в `PORTAL_COLORS` |
| `enemies[]` | `{ type: patrol / wander / chaser, cell, route, speed, safe }` |
| `required`, `optimalSteps` | сколько находок надо собрать; длина жадного маршрута (база для звёзд) |
| `rules` | `{ enemies, dark }` — правила уровня; читать их, а не номер уровня |
| `hearts`, `hints`, `hintLen` | жизни (3 со сторожами, иначе 0), подсказок на уровень, длина показа пути |
| `speed`, `chaseRange`, `sleep`, `fog`, `stars` | скорость героя, дальность погони, цикл сна, радиус света, пороги звёзд [3★, 2★] |
| `title`, `intro` | название; id механики для карточки-знакомства (`move`, ключ `UNLOCKS`) или null |
| `algo`, `meta` | алгоритм и метрики (тупики, развилки, длина пути) — для отладки |

`Game` в конструкторе сбрасывает `taken` и `open` у объектов уровня — один level можно играть заново.

## Состояние игры — `Game`
`player` `{ cell, from, to, t, moving, dir, px, py, invuln, stun, justTeleported }`; `enemies[]` — копии с полями движения
(`px`, `py`, `dirX`, `asleep`, `sleepT`, `ri`/`rdir` для патруля); счётчики `steps`, `hits`, `hintsUsed`, `hintsLeft`, `hearts`, `maxHearts`,
`remaining`, `itemsTaken`, `bonusTaken`, `gatesOpened`, `portalsUsed`, `elapsed`; `keysHeld` (Set цветов), `exitOpen`, `lightRadius`,
`hint` `{ path, life }`; флаги `started`, `paused`, `won`, `lost`. Карты поиска по клетке: `itemAt`, `keyAt`, `portalAt`, `gateAt` (ключ `cell * 4 + dir`).

`result()` → `{ won, stars, time, steps, optimal, hintsUsed, hits, items, bonus, gates, portals, index, title }` (+ `reason: 'caught'` при поражении).

## События `emit()` → `onGameEvent()`
| Событие | Данные | Что делает сцена |
|---|---|---|
| `start` | — | прячет карточку-знакомство |
| `step` | `{ from, cell }` | звук шага, отрезок нити |
| `bump` | `{ dir }` | толчок героя в стену |
| `gateLocked` / `exitLocked` | `{ gate }` / `{ remaining }` | тряска, надпись «Нужен ключ» / «Собери ещё N» |
| `gateOpen`, `key` | `{ gate }`, `{ key }` | исчезновение спрайта, частицы |
| `collect`, `bonus` | `{ item, got, total, left }`, `{ item, kind }` | подбор, надпись, свет ярче для светлячка |
| `exitOpen` | — | домик открывается |
| `portal` | `{ from, to }` | вспышки в обоих порталах |
| `hint`, `noHints`, `stuck` | `{ path }`, —, — | огоньки по пути; сообщение; подмигивание кнопки подсказки |
| `enemySleep`, `hit` | —, `{ hearts }` | совет «можно пройти»; тряска камеры |
| `win`, `lose` | `{ result }` | `finish()` |
Новое событие: `emit()` в game.js → ветка в `onGameEvent()` (список событий в карте кода обновится сам).

## Прогресс — `Progress` (ключ localStorage `klubok.v2`)
```
{ v: 2, hero: 'hedgehog', unlocked: 0, levels: { '0': { stars, steps, time } }, settings: { sound, music, vibration, dpad } }
```
- `unlocked` — индекс самого дальнего доступного уровня; `recordWin()` открывает следующий и хранит лучший результат
  (больше звёзд, при равных — меньше шагов), возвращает `{ firstWin, newBest, unlockedNext }`.
- `load()` берёт из сохранения только поля известных типов: чужие и битые данные дают чистый прогресс, а не падение.
- `reset()` стирает прогресс, настройки сохраняет. Новое поле настроек — в `DEFAULT_SETTINGS` (подхватится само).
- Экземпляр один — `progress` (экспорт модуля); в Node и при запрете localStorage работает `memoryStorage()`.
- Сохранение версии 1.1 (`klubok.v1`: профили, возрасты, режимы) не читается и не трогается — формат несовместим.

## Миры, герои, цвета — src/core/worlds.js
`WORLDS[]`: `id`, `name`, `item`, `itemName` (три падежные формы), `enemy`, палитра (`bg`, `bgAlt`, `bgDeco`, `floor[2]`, `floorDeco`,
`wallTop`, `wallHi`, `wallFront`, `wallDark`, `ui`), `names[10]`. `item` и `enemy` — имена спрайтов в `SPRITES`, `id` — ещё и ключ музыки в `SCALES`
и текстуры фона. `HEROES[]`: `id` (имя спрайта), `name`, `thread` — цвет нити. `NIGHT` — цвет темноты.

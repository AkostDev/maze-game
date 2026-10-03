# Потоки: загрузка, навигация, старт уровня, события

Источники: js/main.js, index.html

Контроллер — объект `app` в main.js (`MZ.app`). UI никогда не трогает игру напрямую: кнопки вызывают `MZ.app.*`,
игра сообщает о себе через колбэки, `app` решает, что показать/сказать/записать.

## Пространство имён и порядок загрузки
`window.MZ`: config, util, maze, levels, sprites, Renderer, audio, Input, progress, ai, story, Game, computeStars, ui, app.
Скрипты обычные (не модули); каждый файл — IIFE, в начале берёт зависимости из `MZ.*`, поэтому **порядок в index.html важен**
(модуль видит только то, что подключено выше). Обращение через `MZ.x` внутри функций (а не в шапке) порядка не требует.

## Слои DOM (index.html)
`#stage` (canvas `#game`) → `#hud` (верх: `#btnPause`, `#hudWorld`, `#hudLevel`, `#hudStats`) → `#hudBottom`
(`#btnMap`, `#dpad`, `#btnHint`) → `#owl` → `#intro` → `#screens` (экраны меню) → `#modal` → `#toasts`.
В игре `#screens` пуст, `#stage` и HUD видимы; в меню наоборот (`stop()` прячет сцену и HUD).

## Загрузка — `boot()`
`P.load()` → `UI.init()` → `Renderer` на `#game` → `Game(renderer, {onWin,onLose,onEvent,onStart})` →
`Input(canvas, renderer, {getGame, isActive, onKey, onTraceStart})` → `bindDpad()` → `applySettings()` →
подписки: ResizeObserver/resize/orientationchange (→ `resize()` + `measureInsets()`), visibilitychange (автопауза,
`audio.suspend()`/`resume()`), первый pointerdown/keydown (→ `audio.unlock()` + музыка) → `AI.onChange()` →
экран `home` (есть активный профиль) или `welcome` → запуск `loop()` → через `prefetchDelayMs` `AI.prefetch()` → `registerSW()`.

## Кадр — `loop()`
dt зажат в 0…0.05 с. Только при `app.playing`: `Game.update()` → `Renderer.draw()` → `UI.updateHud()`.
Ввод активен, когда `playing` и модалка скрыта (`isActive`), плюс собственные условия `Input.active()`.

## Навигация (методы `app`)
| Метод | Что делает |
|---|---|
| `home()` | `stop()` + экран home |
| `stop()` | playing=false, отпускает ввод, прячет HUD и сцену, глушит речь |
| `openMode()` | story → экран story; daily → `startDaily()`; остальное → экран levels(mode) |
| `continueGame()` | `startCampaign(lastMode, unlocked)` |
| `startCampaign()` | запоминает `lastMode`, `startLevel(L.campaignSpec(age, mode, index, aspect()))` |
| `startDaily()` | `startLevel(L.dailySpec(age, todayKey()))` |
| `startStory()` | `startLevel(MZ.story.levelSpec(story, age, aspect(), storyWins))` |
| `pickStory()` | готовая ИИ-сказка `AI.takeStory()` или мгновенная `MZ.story.local()`; тут же `AI.prefetch()` |
| `retry()` | `startLevel(this.spec)` — тот же уровень |
| `next()` | сказка → экран story (новая); daily → экран records('daily'); кампания → `startCampaign(mode, index+1)` |
| `quit()` | кампания → экран levels(mode); иначе home |
| `pause()` / `resume()` | флаг `game.paused` + `pauseModal()`; закрытие модалки = resume |
| `hint()` | `Game.useHint()` |
| `toggleOverview()` | `Renderer.toggleOverview()` + смена иконки `#btnMap` (map ↔ zoom) |

## Старт уровня — `startLevel()`
`L.buildLevel(spec)` (в try/catch → тост при ошибке) → для кампании название от ИИ `AI.levelName()` →
`hideScreens()`, `closeModal()` → показать `#stage` → `showHud()` → `Renderer.resize()` → `measureInsets()` →
`Game.start(level, {heroId, showTrail, moveMode})` → `playing = true` → `intro()` (карточка цели, 7 с) →
`audio.startMusic(world.id)` → малышу голосом `goalSpeech()`.
`aspect()` — пропорции игрового поля под экран (влияют на cols/rows уровня); `measureInsets()` передаёт рендереру
высоту верхнего и нижнего HUD, чтобы лабиринт не уходил под кнопки.

## События игры → `onEvent()` (источник: `Game.emit()`)
| type | данные | реакция app |
|---|---|---|
| collect | left | малыш: голосом «Ещё N…»; иначе в 30 % совёнок `AI.phrase('collect')`; снять мигание подсказки |
| exitOpen | — | совёнок «Всё собрано!…» |
| key | color | совёнок `AI.phrase('key')` |
| gateLocked | color | совёнок «Эту дверцу откроет <цвет> ключик!» (`KEY_COLORS`) |
| exitLocked | remaining | совёнок «Собери ещё N…», для речи отдельный текст с числом словами |
| hit | hearts (−1 — без жизней) | малыш: «Ой! Осторожно…»; при 1 жизни — предупреждение |
| stuck | — | совёнок `AI.phrase('stuck')` + `hintAttention(true)` |
| hint | — | `hintAttention(false)` |
| noHints | — | тост |
| overtime | — | совёнок (малыш: время вышло, но играть можно) |
| enemySleep | — | совёнок (один раз за уровень) |
| portal | — | совёнок один раз за сессию (`app.portalSeen`) |
| gateOpen, bonus | color / kind | не обрабатываются (есть только эффекты внутри Game) |

Прочие колбэки: `onStart()` — первый ход: скрыть intro, в 50 % фраза совёнка; `onWin()` (через 0.9 с после победы) —
`P.recordWin()` → `resultModal()` → звук достижения → `AI.prefetch()`; `onLose()` (через 0.8 с) — `P.recordLoss()` → `loseModal()`.
Второй аргумент `owl()` — `true` (озвучить тот же текст; обычно только для tiny) или отдельная строка для речи.

## Горячие клавиши — `onKey()`
Esc/P — пауза · Space/H — подсказка · M/Z — весь лабиринт · +/− — зум. Движение (стрелки/WASD/Numpad) — в `KEYMAP` (input.js).
Esc при открытой модалке закрывает её (обработчик в `UI.init()`).

## Настройки и профили
`applySettings()` вызывается после любого `setSetting()` и смены профиля: `audio.configure()`, атрибут `data-theme` на html,
`body.dataset.age` (CSS для малышей), `game.showTrail`, `game.moveMode`, видимость `#dpad`.
`createProfile()` → home + тост + prefetch · `updateProfile()` → экран settings · `switchProfile()` → home ·
`afterProfileChange()` — после удаления (home или welcome).

## Отладка и PWA
`?debug` в адресе — ошибки показываются на экране блоком `.fatal` (скриншотный тул печатает их как PAGE ERROR).
`registerSW()` — только на http(s). В sw.js список ASSETS и имя кэша с версией: новый файл игры надо добавить в ASSETS.

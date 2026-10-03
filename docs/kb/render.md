# Отрисовка, спрайты, звук

Источники: js/render.js, js/sprites.js, js/audio.js

## Renderer (render.js)
- Единицы мира — клетки. Камера `cam = {x, y, scale}`, `scale` — пикселей на клетку. Переводы: `worldToScreen()`, `screenToWorld()`.
  Поле зрения — холст минус `insets` (высота HUD; задаёт `setInsets()` из `measureInsets()`).
- Масштаб — `targetScale()`: `fitScale()` (весь лабиринт в экран) или не мельче `minCell()` (`AGES[age].minCellPx`) × `userZoom`, не крупнее `maxCell()`;
  режим обзора `overview` = вписать целиком. **Ночью** камера всегда близко (≈ 8 клеток по короткой стороне экрана) — иначе на большом
  мониторе почти весь лабиринт попадает в круг света. `zoomBy()` — пинч/колесо/клавиши, `toggleOverview()` — кнопка карты.
- `updateCamera()` плавно ведёт камеру за героем; если лабиринт помещается — центрирует.
- `setLevel()` — сброс при старте уровня; `resize()` — пересчёт холста (dpr ≤ 2.5).

### Статический слой
`buildLayer()` рисует в отдельный canvas всё неподвижное: тень «доски», пол в шашечку (`world.floor`), коврик старта, декор (`drawDeco()`, сид `deco|seed`),
стены (`world.wall`, блик `wallHi`). Пересобирается при смене уровня, `resize()` и изменении масштаба более чем на 28 % (`wantedLayerScale()`
ограничивает размер текстуры). Всё, что зависит от хода игры, сюда класть нельзя — оно рисуется в `draw()`.

### Кадр — `draw()` (порядок слоёв)
слой лабиринта → нить-след (`drawTrail()`, рвётся на порталах) → порталы → дверцы → домик-выход → предметы и ключи → враги → герой →
частицы (`updateParticles()`) → туман (`drawFog()`, только `rules.dark`) → подсказка-клубочек (`drawHint()` — поверх тумана) →
всплывающий текст → красная вспышка при ударе.

### Эффекты (вызывает Game через `this.r`)
`burst(wx, wy, colors, n, {shape: 'dot'|'star'|'rect', speed, up, life, size, gravity})`, `confetti(n)`, `floatText(wx, wy, text, color)`, `hit()` (тряска + вспышка).
При `prefers-reduced-motion` частиц втрое меньше, тряски нет. В тестах движка рендерер подменяется заглушкой с этими же методами
(`fakeR` в tests/game.test.js) — новый метод, который зовёт Game, нужно добавить и туда.

### Туман
Отдельный canvas в половинном разрешении: заливка почти непрозрачная (tiny 0.97, остальные 1), «дырки» — посещённые клетки (слабо),
круг света радиусом `game.lightRadius` клеток вокруг героя, свечение невзятых светлячков.

## Спрайты (sprites.js) — процедурная графика, без картинок
Общий принцип: `(ctx, …, x, y, s, …)` — центр в пикселях и размер клетки `s`; всё рисуется в долях `s`. `t` — время для анимации.
- `drawHero(ctx, id, x, y, s, {t, lookX, lookY, moving, squash, blink, hurt, dizzy})` — ветки по `id`; последний герой (bunny) — ветка else.
  `HEROES`: `{id, name, body, belly, accent, thread}` (`thread` — цвет нити-следа); `heroById()` с запасным вариантом.
- `drawEnemy(ctx, kind, x, y, s, t, dirX, dirY, asleep)` — `kind` = `world.enemy`; `ufo` — ветка else; спящий рисуется с «Zzz».
- `drawItem(ctx, kind, x, y, s, t, phase)` — мировые находки (`world.item`) и бонусы `clock`, `firefly`, `heart`.
- `drawKey(ctx, kc, …)`, `drawGate(ctx, kc, cx, cy, s, horizontal, openT, t, locked)` — `kc` = элемент `KEY_COLORS` (`color, dark, symbol`:
  у каждого цвета своя фигура — для различения без опоры на цвет; `symbolPath()`).
- `drawHouse(ctx, x, y, s, open, remaining, t, openT)` — выход со счётчиком оставшихся находок; `drawPortal()`, `drawYarn()` (клубочек подсказки),
  `drawDeco(ctx, worldId, x, y, s, v, colors)` — мелкий декор пола по мирам; примитивы `circle()`, `ellipse()`, `roundRect()`, `drawStar()`, `drawHeartShape()`.
Те же функции рисуют мини-иконки в DOM (`heroCanvas()` и др. в ui.js) и сцену на главной.

## Звук (audio.js) — объект `A` = `MZ.audio`
- `unlock()` — создать/возобновить AudioContext; вызывается первым жестом пользователя (требование браузеров). `suspend()` / `resume()` — при сворачивании.
- `configure({sound, music, voice, vibration, speech, voiceName})` — из `applySettings()`.
- Эффекты: `play(name, arg)` — имена в `SFX` (список в MAP.md); синтез через `tone(freq, dur, {type, vol, delay, slide, bus})` и `noise()`.
- Музыка: `startMusic(worldId | 'menu')` — генеративная мелодия по `SCALES` (лад, темп, тембр на мир); `stopMusic()`.
- Речь: `say(text, force)` — `force` говорит даже при выключенной озвучке (пробы в настройках, онбординг). `speakable()` готовит текст:
  числа словами, «5 с» → «пять секунд», без кавычек и тире; режется на предложения; темп `RATES` (normal 0.88, slow 0.74).
  Голос: `voiceScore()` ранжирует русские голоса (Natural/Online > Enhanced > Google > именные), `voices()` — список для настроек, `canSpeak()`.
  После отмены текущей речи — пауза 90 мс перед новой фразой (баг Chrome). **Для речи давай отдельный текст с числами словами и верным родом**
  (`goalSpeech()`, `numWord()` + `world.itemGender`), а не экранную строку с цифрами.
- `buzz(pattern)` — вибрация, если включена.

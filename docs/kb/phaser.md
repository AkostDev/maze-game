# Phaser 4 в этом проекте: как подключён, приёмы и грабли

Источники: src/main.js, src/scenes/BootScene.js, tools/vendor.mjs

Движок — **Phaser 4.2.1** (WebGL). Перед работой с его API открой нужный скилл `phaser-*` (в .claude/skills, это официальная документация
из пакета phaser): память о Phaser 3 в ряде мест неверна. Что читать под задачу:
| Задача | Скилл |
|---|---|
| отличия от Phaser 3, что удалено и чем заменено | `phaser-v3-to-v4-migration`, `phaser-v4-new-features` |
| конфиг игры, пиксель-арт, размер холста | `phaser-game-setup-and-config`, `phaser-scale-and-responsive` |
| сцены, запуск поверх, пауза, обмен данными | `phaser-scenes`, `phaser-events-system` |
| спрайты, NineSlice, тинт, контейнеры | `phaser-sprites-and-images`, `phaser-groups-and-containers`, `phaser-game-object-components` |
| текст | `phaser-text-and-bitmaptext` |
| касания, клавиатура | `phaser-input-keyboard-mouse-touch` |
| камера | `phaser-cameras` |
| твины, таймеры, анимации кадров | `phaser-tweens`, `phaser-time-and-timers`, `phaser-animations` |
| частицы | `phaser-particles` |
| Graphics и фигуры | `phaser-graphics-and-shapes` |
| фильтры, свет, RenderTexture (в игре пока не используются) | `phaser-filters-and-postfx`, `phaser-render-textures` |

## Подключение без сборки
- `npm install` ставит пакет, `npm run vendor` (tools/vendor.mjs) копирует сборку в `vendor/phaser.esm.min.js` и скиллы в .claude/skills/phaser-*
  (с префиксом в имени и в перекрёстных ссылках). Оба результата лежат в репозитории: игра запускается после клонирования любым статическим сервером.
- Модули импортируют движок так: `import * as Phaser from '../vendor/phaser.esm.min.js'` (путь относительный). Сборщика нет; ES-модули
  не работают при открытии файла двойным кликом — нужен сервер (`npm start`).
- Модули src/core и src/gfx/mazeLayer.js, src/gfx/sprites.js движок не импортируют — их тестирует Node.

## Конфиг игры (src/main.js)
- `pixelArt: true` — без сглаживания, округление пикселей включено.
- Холст в **пикселях устройства**: режим масштаба NONE, размер = окно × `dpr` (не больше 3), `zoom: 1 / dpr`; при изменении окна — `game.scale.resize`.
  Так целочисленный масштаб камеры даёт ровные пиксели на любом экране, а текст остаётся резким. Сцены получают событие resize сами.
- `audio.noAudio` — звук синтезирует src/audio/sfx.js; `input.activePointers: 3` — экранные стрелки и свайп одновременно.
- Значения `dpr` и `safe` лежат в реестре игры (`game.registry`), их читает `metrics()`.

## Приёмы, принятые в проекте
- **Текстуры из canvas**: `textures.addCanvas(key, canvas)`, кадры — `texture.add(name, 0, x, y, w, h)`. Генератор текстур из Phaser 3
  (`textures.generate`) в четвёрке удалён. Повторно зарегистрировать ключ нельзя — сначала `textures.remove` (так делает слой лабиринта).
- **NineSlice** рисует углы в исходном размере, поэтому объекту задаётся `setScale(u)`, а ширина и высота — в арт-пикселях.
- **Тинт**: `setTint` умножает цвет (белый спрайт → цветной, чёрный контур остаётся). Заливки `setTintFill` в четвёрке нет — вместо неё `setTintMode`.
- **Текст**: шрифт Tiny5 подключён через `@font-face` в index.html и ждётся в `start()` до создания игры. Он нарисован на сетке 8 px, поэтому
  `label()` округляет кегль до кратного 8 px устройства. Жирного начертания нет. Нужных символов может не быть — проверяй снимком.
- **Частицы**: эмиттер создаётся на каждый всплеск (`add.particles` с `emitting: false` → `explode`) и удаляется таймером; массив в `tint` — случайный цвет.
- **Сцены поверх сцен**: модальные окна и HUD — отдельные сцены. Касание достаётся только верхней сцене, если она его обработала, поэтому
  кнопки HUD не «протекают» в свайп игровой сцены.
- **Перестройка вместо подгонки**: сцены интерфейса на resize удаляют все объекты и строят заново (`UiScene`).

## Грабли
- Операции `scene.start / stop / pause / resume / launch` ставятся в очередь и выполняются в начале следующего кадра.
  Сразу после вызова состояние ещё старое — отсюда флаг `pausing` в `pauseGame()` и безусловный `rebuild()` в `onResume()`.
- Объект сцены живёт всё время работы игры; `create()` вызывается при каждом запуске. Поля, не сброшенные в `create()`, тянутся из прошлого запуска.
- Подписки на `this.scale` и `this.game.events` при остановке сцены сами не снимаются — снимать в обработчике `shutdown`.
  Подписки на `this.input`, `this.input.keyboard`, `this.events` движок снимает сам.
- Контейнеру для касаний нужен размер: `setSize` и только потом `setInteractive` (зона — по центру контейнера).
- `Math.TAU` в четвёрке — 2π (в тройке было π/2); классов `Geom.Point`, `Mesh`, `BitmapMask` нет.
- Нецелый масштаб камеры размывает пиксель-арт — зум всегда целый (см. `fitCamera()`).
- В headless Chromium WebGL работает через SwiftShader (флаги — в tools/browser.mjs); смоук проверяет, что рендер действительно WebGL.

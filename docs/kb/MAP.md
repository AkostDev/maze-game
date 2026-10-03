# Карта кода

> Сгенерировано `tools/kb.py map` — руками не править, обновляется хуком после каждой правки.
> Запись `имя:строка-конец` = диапазон строк. Читать точечно: `Read(file, offset=строка, limit=конец−строка+1)`.
> `·Раздел·` — метка раздела внутри файла. После своей правки номера ниже неё сдвигаются — перечитай этот файл.

## src/core/game.js (393) → Game, computeStars
Игровая логика одного уровня: пошаговое движение по клеткам с плавной интерполяцией, предметы, ключи и дверцы,
- class Game:12-380 → ·Ввод· begin:64-69 setHeld:71-76 push:78-82 release:83 tapToward:85-90 ·Правила прохода· passable:93-102 bump:103-112 chooseStep:115-128 startMove:130-135 openGate:137-141 arrive:143-163 take:165-182 teleport:184-194 ·Подсказка-клубочек· useHint:198-219 ·Сторожа· updateEnemies:222-265 closedGate:266 enemyNext:267-294 onHit:296-304 ·Кадр· update:307-355 ·Итоги· win:358-363 lose:364-368 result:370-377 emit:379-380
- computeStars:384-392

## src/core/levels.js (386) → LEVELS_PER_WORLD, CAMPAIGN_LEVELS, HERO_SPEED, UNLOCKS, worldFor, difficulty, introFor, levelTitle, resolveParams, multiBfs, buildLevel, levelSpec
Дизайнер уровней: одна кампания с плавной кривой сложности (без возрастов и режимов).
- LEVELS_PER_WORLD:10 CAMPAIGN_LEVELS:11 HERO_SPEED:12 UNLOCKS:15-23 SHAPE_POOL:25 ALGOS:26-31 worldFor:33 difficulty:36-42 introFor:45-49 levelTitle:51-54 edgeKey:56 ·Параметры уровня· resolveParams:59-121 ·Проектирование одного кандидата· designCandidate:124-299 multiBfs:301-315 greedyTour:318-341 ·Сборка уровня· buildLevel:344-380 levelSpec:383-385

## src/core/maze.js (431) → DIRS, OPP, Grid, generators, generate, braid, bfs, pathTo, farthest, SHAPES, shapeMask, shapeFill, largestComponent, trimMask, metrics, decisionsOnPath
Лабиринты: сетка с битмасками проходов, маски-фигуры, генераторы, braid, поиск путей.
- DIRS:6-11 OPP:12
- class Grid:14-53 → idx:22 x:23 y:24 active:25 neighbor:26-31 isOpen:32 carve:33-39 degree:40-43 activeList:44-48 dirBetween:49-52
- ·Генераторы (работают на любой связной маске)· randomActive:57-60 backtracker:63-82 growingTree:85-105 prim:108-135 kruskal:138-158 wilson:161-197 huntAndKill:200-234 generate:238-242 braid:245-268 bfs:271-299 pathTo:301-311 farthest:313-317 ·Маски-фигуры· largestComponent:322-343 pointInPolygon:345-352 STAR_POLY:354
- SHAPES:361-377 → circle:362 diamond:363 heart:364-368 star:369 flower:370-373 ring:374 cross:375 house:376-377
- ·Маски-фигуры· shapeMask:379-390 shapeFill:392-397 trimMask:400-410 ·Метрики· metrics:413-422 decisionsOnPath:424-428

## src/core/progress.js (122) → KEY, DEFAULT_SETTINGS, memoryStorage, Progress, progress
Прогресс игрока: открытые уровни, звёзды и лучшие результаты, выбранный герой, настройки.
- KEY:7 DEFAULT_SETTINGS:9-14 blank:16-18 memoryStorage:21-28
- class Progress:30-110 → load:38-56 save:58-60 settings:62 setSetting:63-67 hero:69 setHero:70-74 unlocked:77 isUnlocked:78 best:79 stars:80 totalStars:81-85 rangeStars:87-91 recordWin:94-102 reset:104-109
- browserStorage:112-118

## src/core/rng.js (73) → makeRng, hashStr, clamp, lerp, invLerp, fmtTime, plural
Сидируемый генератор случайных чисел и математика. Уровни детерминированы от сида — Math.random в генерации не используется.
- xmur3:4-15 sfc32:18-30 makeRng:32-51 hashStr:53 clamp:55 lerp:56 invLerp:57 fmtTime:59-63 plural:66-72

## src/core/worlds.js (72) → WORLDS, HEROES, heroById, KEY_COLORS, PORTAL_COLORS, NIGHT
Миры, герои, цвета ключей и порталов — данные без логики.
- WORLDS:7-48 HEROES:51-57 heroById:59 KEY_COLORS:62-67 PORTAL_COLORS:69 NIGHT:71-72

## src/gfx/mazeLayer.js (108) → CELL, WALL, PITCH, toWorld, mazeSize, paintMaze, mazeCanvas
Картинка лабиринта: статичный слой (пол, стены с передней гранью, коврик у выхода) рисуется попиксельно
- CELL:8 WALL:9 PITCH:10 FACE:11 toWorld:14 mazeSize:16-18 abgr:20-23 mix:24-28 noise:29-33 wallAccent:36-42 paintMaze:44-96 mazeCanvas:98-107

## src/gfx/sprites.js (306) → PALETTE, SPRITE, ICON, SPRITES, GATE, ICONS, expand, validate
Пиксельная графика как данные: палитра и ASCII-карты спрайтов. Картинок-файлов в игре нет —
- PALETTE:9-17 SPRITE:19 ICON:20 SPRITES:22-166 GATE:169-172 ICONS:175-276 expand:279-285 validate:288-305

## src/gfx/textures.js (184) → BUTTONS, INK, PAPER, LIGHT_SIZE, LIGHT_HOLE, buildTextures, buildAnimations
Сборка текстур при загрузке: атласы спрайтов и иконок из ASCII-карт, элементы интерфейса (кнопки, панель),
- BUTTONS:10-18 INK:19 PAPER:20 makeCanvas:22-26 paint:28-35 atlas:38-51 portalRows:53-70 buildSprites:72-84 buildIcons:86-91 drawButton:94-101 drawPanel:103-109 buildUi:111-143 LIGHT_SIZE:144 LIGHT_HOLE:145 buildBackdrops:148-166 buildTextures:168-175 buildAnimations:177-183

## src/audio/sfx.js (152) → sfx
Звук без файлов: эффекты и фоновая музыка синтезируются на WebAudio, плюс вибрация.
- A:6-10 tone:12-28 noise:30-42 N:44
- SFX:47-72 → click:48 step:49-54 collect:55 key:56 gate:57 locked:58 portal:59 hit:60 bump:61 door:62 win:63-66 lose:67 star:68 bonus:69 hint:70 sleep:71-72
- SCALES:75-82 stopTimer:84-87 runMusic:89-115
- sfx:117-151 → configure:119-125 unlock:127-140 suspend:141 resume:142 play:143 startMusic:145 stopMusic:146 buzz:147-150

## src/ui/kit.js (191) → FONT, WHITE, hex, BTN, BTN_H, metrics, TITLE_IN_BAR, CARD_H, hudInsets, label, icon, sprite, button, panel, backdrop, dim, goto, UiScene
Набор интерфейса на Phaser: метрики экрана, текст, кнопки, панели, фон, базовая сцена с перестройкой при resize.
- FONT:10 WHITE:11 hex:12 BTN:15 BTN_H:16 metrics:18-26 TITLE_IN_BAR:28 CARD_H:29 hudInsets:34-48 label:52-64 icon:66-69 sprite:71-74 DARK_TEXT:77 button:84-132 panel:135-146 backdrop:149-154 dim:157-160 OVERLAYS:162 goto:165-171
- class UiScene:177-190 → create:178-182 rebuild:183-188 build:189-190

## src/scenes/BootScene.js (16) → BootScene
Сцена загрузки: рисует все текстуры из данных (файлов-картинок нет), создаёт анимации и открывает меню.
- class BootScene:5-15 → create:8-14

## src/scenes/GameScene.js (458) → GameScene
Игровая сцена: показывает уровень (слой лабиринта, герой, предметы, сторожа, туман), ведёт камеру,
- MIN_CELL:18 MAX_CELL:19 SWIPE:20 HOLD_TOUCH:22 HOLD_KEYS:23 KEYS:24 DEPTH:26
- class GameScene:28-457 → init:31 create:33-61 hud:63 ·Мир· buildWorld:66-135 placeFog:138-153 ·Камера· fitCamera:158-183 toggleOverview:185-189 toScreen:192-195 ·Управление· bindInput:199-250 pressDir:253-256 releaseDir:257 useHint:259 restart:260 pauseGame:262-270 autoPause:272 onResume:274-278 ·События игры → эффекты· onGameEvent:281-360 floatAt:362-365 shake:367-370 pickUp:372-376 burst:378-385 showHint:388-397 finish:399-412 showResult:414-417 ·Кадр· update:420-456

## src/scenes/HudScene.js (164) → HudScene
Интерфейс поверх игрового поля: пауза, счётчики (находки, ключи, жизни), подсказка, обзор лабиринта,
- INTROS:11-20
- class HudScene:22-163 → create:25-29 build:31-69 showIntro:72-96 hideIntro:98-104 refresh:107-131 update:133 ·Сообщения от игровой сцены· floatText:136-141 tip:143-150 attention:153-156 noHints:158-162

## src/scenes/LevelsScene.js (97) → LevelsScene
Выбор уровня: по странице на мир (10 уровней), звёзды за каждый, замки на недоступных. Листается стрелками и свайпом.
- class LevelsScene:9-96 → init:12-15 create:17-34 turn:36-42 build:44-95

## src/scenes/MenuScene.js (80) → MenuScene
Главное меню: название, выбор героя, большая кнопка «Играть» (продолжить с первого непройденного уровня), уровни и настройки.
- class MenuScene:9-79 → create:12-21 play:23 switchHero:25-30 build:32-78

## src/scenes/PauseScene.js (63) → PauseScene
Пауза поверх игры: продолжить, начать заново, к уровням, в меню и быстрые переключатели звука и управления.
- class PauseScene:8-62 → init:11 create:13-20 resume:22-28 build:30-61

## src/scenes/ResultScene.js (110) → ResultScene
Итоги уровня поверх игры: победа — звёзды, шаги и время, переход дальше; поражение — предложение попробовать ещё раз.
- CHEERS:9
- class ResultScene:11-109 → init:14-19 create:21-29 primary:31 retry:32 toLevels:33 news:36-42 build:44-98 confetti:100-108

## src/scenes/SettingsScene.js (71) → TOGGLES, toggleSetting, SettingsScene
Настройки: звук, музыка, вибрация, кнопки-стрелки на экране, сброс прогресса (со вторым нажатием для подтверждения).
- TOGGLES:11-16 toggleSetting:18-22
- class SettingsScene:24-70 → create:27-31 build:33-69

## src/config.js (3) → VERSION
Общие константы приложения. При выпуске версии обнови VERSION здесь, CACHE в sw.js и version в package.json.
- VERSION:2-3

## src/main.js (88)
Точка входа: создаёт Phaser.Game, подгоняет холст под экран в пикселях устройства, включает звук по первому жесту.
- viewport:19-22 safeArea:25-32 start:34-85

## index.html
- id: #game #safe #boot
- точка входа: src/main.js (ES-модули, дальше — по import)

## Реестры (строковые ключи)
- Миры (индекс = `level.worldIndex`) — src/core/worlds.js `WORLDS`: forest sea candy snow space
- Герои — src/core/worlds.js `HEROES`: hedgehog cat frog penguin bunny
- Цвета ключей (индекс = color) — src/core/worlds.js `KEY_COLORS`: red blue green yellow
- Механики и уровень, с которого они появляются — src/core/levels.js `UNLOCKS`: gates shapes portals enemies wander dark chaser
- Фигуры лабиринта — src/core/maze.js `SHAPES`: circle diamond heart star flower ring cross house
- Настройки `progress.settings` — src/core/progress.js `DEFAULT_SETTINGS`: sound music vibration dpad
- Спрайты 16×16 — кадры атласа `sprites` — src/gfx/sprites.js `SPRITES`: hedgehog cat frog penguin bunny bee crab jelly snowball ufo apple shell candy snowflake crystal firefly heart key house houseOpen yarn star
- Иконки — кадры атласа `icons` — src/gfx/sprites.js `ICONS`: pause play arrow home restart settings sound mute music levels lock check close hint hand trash vibration dpad steps clock map zzz star heart key
- Звуки `sfx.play(name)` — src/audio/sfx.js `SFX`: click step collect key gate locked portal hit bump door win lose star bonus hint sleep
- Музыка `sfx.startMusic(id)` — src/audio/sfx.js `SCALES`: forest sea candy snow space menu
- События `Game.emit(type)` → `GameScene.onGameEvent()`: start bump gateLocked exitLocked gateOpen step key collect exitOpen bonus portal noHints hint enemySleep hit stuck win lose
- Сцены `scene.start(key)`: Boot (BootScene.js) · Game (GameScene.js) · Hud (HudScene.js) · Levels (LevelsScene.js) · Menu (MenuScene.js) · Pause (PauseScene.js) · Result (ResultScene.js) · Settings (SettingsScene.js)

## Прочие файлы (строк) — описание в docs/kb/testing.md
sw.js (35) · test/levels.test.js (108) · test/game.test.js (142) · test/progress.test.js (67) · test/sprites.test.js (33) · test/pwa.test.js (33) · test/autopilot.js (48) · test/browser.smoke.mjs (205) · tools/verify.sh (27) · tools/browser.mjs (71) · tools/screens.mjs (85) · tools/vendor.mjs (43) · tools/icon.mjs (32) · tools/kb.py (527)

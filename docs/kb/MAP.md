# Карта кода

> Сгенерировано `tools/kb.py map` — руками не править, обновляется хуком после каждой правки.
> Запись `имя:строка-конец` = диапазон строк. Читать точечно: `Read(file, offset=строка, limit=конец−строка+1)`.
> `·Раздел·` — метка раздела внутри файла. После своей правки номера ниже неё сдвигаются — перечитай этот файл.

## js/config.js (27) → MZ.config
Настройки ИИ-помощника (vibecode.moe, OpenAI-совместимый API).

## js/util.js (162) → MZ.util
Общие утилиты: сидируемый генератор случайных чисел, математика, хранилище, DOM-хелперы
- xmur3:7-18 sfc32:21-33 makeRng:35-55 hashStr:57 clamp:59 lerp:60 invLerp:61
- ease:63-68 → outCubic:64 inOutSine:65 outBack:66 outElastic:67-68
- fmtTime:70-74 todayKey:76-80 plural:83-89 ONES:92-93 TENS:94 numWord:95-102
- store:106-123 → get:107-113 set:114-118 remove:119-122
- el:126-150 uid:152-154 reducedMotion:156-158

## js/maze.js (466) → MZ.maze
Лабиринты: сетка с битмасками проходов, маски-фигуры, генераторы, braid, поиск путей.
- DIRS:9-14 OPP:15
- class Grid:17-56 → constructor:18-24 idx:25 x:26 y:27 active:28 neighbor:29-34 isOpen:35 carve:36-42 degree:43-46 activeList:47-51 dirBetween:52-55
- ·Генераторы (работают на любой связной маске)· randomActive:60-63 backtracker:66-85 growingTree:88-108 prim:111-138 kruskal:141-161 wilson:164-200 huntAndKill:203-237 generate:241-245 braid:248-271 bfs:274-302 pathTo:304-314 farthest:316-320 ·Маски-фигуры· largestComponent:325-346 pointInPolygon:348-355 STAR_POLY:357
- SHAPES:364-380 → circle:365 diamond:366 heart:367-371 star:372 flower:373-376 ring:377 cross:378 house:379-380
- ·Маски-фигуры· SHAPE_NAMES:381 shapeMask:383-394 shapeFill:396-401 asciiMask:404-423 trimMask:426-436 ·Метрики· metrics:439-448 decisionsOnPath:450-454

## js/levels.js (520) → MZ.levels
Дизайнер уровней: миры, возрастные группы, кривая сложности, расстановка
- LEVELS_PER_WORLD:12 CAMPAIGN_LEVELS:13 WORLDS:15-56 AGES:59-92 AGE_ORDER:93 MODES:95-102 CAMPAIGN_MODES:103 KEY_COLORS:105-110 PORTAL_COLORS:111 SHAPE_POOL:112 worldFor:114 difficulty:117-123 localTitle:125-129 edgeKey:131 ·Параметры уровня· resolveParams:134-231 ·Проектирование одного кандидата· designCandidate:234-416 multiBfs:418-432 greedyTour:435-459 ·Сборка уровня· buildLevel:462-503 campaignSpec:505-507 dailySpec:509-512

## js/sprites.js (573) → MZ.sprites
Процедурная графика: герои, враги, предметы, ключи, дверцы, домик, порталы, декор. Без картинок.
- TAU:5 HEROES:7-13 heroById:14 circle:16-19 ellipse:20-23 roundRect:24-33 shadow:34-36 eyes:39-63 ·Герои· drawHero:66-167 ·Враги· drawEnemy:170-266 ·Предметы· drawStar:269-279 drawHeartShape:281-287 drawItem:289-389 symbolPath:392-398 drawKey:400-422 drawGate:425-451 drawHouse:454-501 drawPortal:503-521 drawYarn:523-537 drawDeco:540-566

## js/render.js (449) → MZ.Renderer
Рендерер: статический слой лабиринта в кэше, камера со следованием и зумом, объекты, частицы, туман
- TAU:7
- class Renderer:9-445 → constructor:10-27 resize:29-38 setInsets:40 setLevel:42-49 viewW:51 viewH:52 fitScale:53-57 minCell:58-61 maxCell:62 targetScale:63-74 zoomBy:75-79 toggleOverview:80 worldToScreen:82-85 screenToWorld:86-89 updateCamera:91-110 wantedLayerScale:112-116 ·Статический слой· buildLayer:119-173 ·Эффекты· burst:176-189 confetti:190-199 floatText:200-202 hit:203 ·Кадр· draw:206-316 drawTrail:318-347 drawHint:349-385 updateParticles:387-403 drawFog:405-444

## js/audio.js (236) → MZ.audio
Звук: синтез эффектов и музыки на WebAudio, озвучка (speechSynthesis), вибрация
- A:6-11 → configure:13-19 unlock:22-35 suspend:37 resume:38 play:101-103 ·Генеративная музыка· startMusic:115-142 stopMusic:144-147 ·Озвучка· voices:164-168 configure:180 canSpeak:182 say:198-219 unlockSpeech:222-226 buzz:229-232
- tone:40-55 noise:57-69 N:71
- SFX:73-99 → click:74 step:75-80 collect:81 key:82 gate:83 locked:84 portal:85 hit:86 bump:87 door:88 win:89-92 lose:93 star:94 tick:95 bonus:96 hint:97 achievement:98-99
- ·Генеративная музыка· SCALES:106-113 ·Озвучка· RATES:152 voiceScore:154-163 pickVoice:169-172 speakable:185-196

## js/input.js (216) → MZ.Input
Ввод: Pointer Events (мышь, палец, стилус), клавиатура, экранный D-pad.
- KEY_REPEAT:14 touchRepeat:15 KEYMAP:17-20
- class Input:22-212 → constructor:23-32 game:34 active:35-38 bind:40-59 local:61-64 threshold:66 down:68-93 move:95-128 up:130-152 releaseAll:154-158 keyDown:160-174 keyUp:176-185 bindDpad:188-211

## js/progress.js (248) → MZ.progress
Профили, прогресс, рекорды и достижения. Всё хранится локально (localStorage).
- KEY:6 MAX_RECORDS:7 DEFAULT_SETTINGS:9-12 blankStats:14-20 blankProfile:22-30
- P:32-216 → load:35-52 save:54 settings:56 setSetting:57 profiles:59 active:60 setActive:61 createProfile:63-72 updateProfile:73-80 deleteProfile:81-86 resetProfile:87-95 modeProgress:98-103 totalStars:104-109 modeStars:110-115 completedCampaign:116-121 recordWin:124-181 recordLoss:183-188 records:190-198 ·Достижения· checkAchievements:201-208 achievementList:209-215
- ACHIEVEMENTS:218-243

## js/ai.js (310) → MZ.ai
ИИ-помощник (vibecode.moe, OpenAI-совместимый /v1/chat/completions).
- CACHE_KEY:10 WORLD_IDS:11 SHAPES:12 SYSTEM:14-16 AGE_GUIDE:18-23
- AI:25-278 → cfg:35 loadCache:37-43 saveCache:44 onChange:46 setStatus:47-51 userEnabled:53-56 available:57-63 request:66-110 task:113-127 ·Сказки· storyPrompt:130-142 validateStory:144-174 fetchStory:176-187 takeStory:190-199 storiesReady:200 ·Фразы совёнка· fetchPhrases:203-222 phrase:223-230 ·Названия уровней· fetchNames:233-246 levelName:247-252 prefetch:255-266 ping:269-277
- parseJson:280-287 cleanText:290-292 LOCAL_PHRASES:294-303

## js/story.js (112) → MZ.story
Сказки: локальный генератор (мгновенный запасной вариант для ИИ) и сборка уровня по сказке
- THEMES:7-14 WORLD_IDS:15 ITEMS_NOM:16 TALES:19-45 PARAMS:47-52 local:54-73 levelSpec:76-91 goalText:93-100 goalSpeech:103-108

## js/game.js (599) → MZ.Game, MZ.computeStars
Игровая логика: движение по клеткам с плавной интерполяцией, скольжение по коридорам,
- class Game:13-571 → constructor:14-23 start:25-79 ·Ввод· begin:82-87 setHeld:89-94 push:96-107 release:108-111 traceTo:113-124 tapToward:125-130 ·Правила прохода· passable:133-142 exits:143-147 bump:148-164 chooseDir:167-211 chooseStep:214-227 startMove:229-238 openGate:240-248 arrive:250-275 take:277-311 teleport:313-326 ·Подсказка-клубочек· useHint:329-353 ·Враги· updateEnemies:356-398 closedGate:399 enemyNext:400-428 onHit:430-445 ·Кадр· update:448-525 ·Итоги· win:528-538 lose:539-547 result:549-568 emit:570-571
- computeStars:573-594

## js/ui.js (873) → MZ.ui
Интерфейс: экраны, модальные окна, HUD, совёнок, тосты, иконки. Действия вызывают MZ.app.*
- ·Иконки (24×24, штрих)· ICONS:10-67 icon:68-70 iconEl:71-77 OWL:80-86 ·Мини-холсты· sizedCanvas:89-96 heroCanvas:97-101 itemCanvas:102-106 keyCanvas:107-111 MODE_COLORS:113 AGE_COLORS:114 isTouch:115
- UI:117-866 → init:120-134 ·Экраны· show:137-149 hideScreens:150 stopAnim:151 screen:153 backBtn:154-156 topbar:157-159 welcome:162-218 home:220-279 animateHeroArt:282-341 levels:343-384 story:387-439 records:441-483 achievements:485-504 settings:506-594 voiceSettings:597-619 ·Модальные окна· openModal:622-630 closeModal:631-637 resultModal:639-669 loseModal:671-683 pauseModal:685-710 profilesModal:712-726 confirm:728-736 holdToConfirm:739-754 ·HUD· showHud:757-779 hideHud:780-784 updateHud:785-815 hintAttention:816 owl:818-828 hideOwl:829 intro:831-850 hideIntro:851-857 toast:859-865

## js/main.js (328) → MZ.app
Точка входа и контроллер приложения: связывает игру, интерфейс, прогресс и ИИ
- app:8-310 → boot:11-54 loop:56-65 measureInsets:67-74 aspect:75-79 ·Навигация· home:82 stop:83-89 openMode:90-94 continueGame:95-99 startCampaign:100-104 startDaily:105 startStory:106-109 pickStory:110-117 startLevel:119-144 retry:146 next:147-153 quit:154-159 pause:160-166 resume:167-170 hint:171-174 toggleOverview:175-180 ·События игры· onStart:183-187 onEvent:188-239 onWin:240-247 onLose:248-252 onKey:253-265 ·Профили и настройки· applySettings:268-278 createProfile:279-285 updateProfile:286-291 switchProfile:292-297 afterProfileChange:298-301 registerSW:303-309

## css/style.css (568)
- Токены:5-73
- Основа:74-107 → .eyebrow .muted .num .grow .row
- Каркас:108-133 → .stage .screen .wrap .topbar
- Кнопки:134-167 → .btn .is-down .btn--sun .btn--teal .btn--grape .btn--sky .btn--ghost .btn--xl .btn--block .icon-btn
- Заплатка со стежком:168-174 → .patch
- Главная:175-236 → .profile-chip .who .stat-pill .hero .hero-art .hero-copy .logo .eyebrow .tagline .play-stack .play-sub .section-head .modes .mode-card .tile .meta .badge-ai .c-teal .c-sun .c-accent .c-night .c-grape .c-sky .duo .link-card
- Онбординг:237-267 → .ages .age-card .age .is-selected .heroes .hero-pick .field .input .select .steps-dots .on
- Уровни:268-293 → .world .world-head .world-swatch .levels-grid .lvl .stars .on .is-done .is-next .is-locked .lock .endless .grow
- Сказка:294-315 → .chips .chip-btn .is-on .story-card .story-intro .story-tags .tag .tag--ai .story-actions .row .btn--block .ai-line .ai-dot .ok .working .offline
- Рекорды:316-347 → .tabs .tab .is-on .players .player-card .board .who .who-txt .nm .score .place-1 .place-2 .place-3 .mine .empty
- Достижения:348-363 → .ach-summary .big .bar .ach-grid .ach .medal .is-on .body .prog
- Настройки:364-407 → .set-list .set-row .ico .txt .seg .select .btn .switch .is-on .profile-panel .help-list .profile-list .profile-item .grow .icon-btn
- HUD:408-510 → .hud .hud-btn .hud-title .hud-stats .hchip .is-warn .is-done .hearts .off .hud-bottom .round-btn .hint .is-attention .badge .dpad .is-down .owl .intro-card .eyebrow .goal .extra .how .is-leaving
- Модальные окна:511-547 → .modal .modal-card .modal-actions .row .btn .big-stars .on .result-stats .ribbon .new-ach .cheer .hold-btn
- Тосты:548-568 → .toasts .toast .is-leaving .fatal

## index.html
- id: #app #stage #game #hud #btnPause #hudWorld #hudLevel #hudStats #hudBottom #btnMap #dpad #btnHint #owl #intro #screens #modal #toasts
- порядок скриптов: config → util → maze → levels → sprites → render → audio → input → progress → ai → story → game → ui → main

## Реестры (строковые ключи)
- Иконки `UI.icon(name)` — js/ui.js `ICONS`: play pause home restart back next trophy list settings sound mute music star stars yarn zoom map lock clock heart key sparkle user users check close path bug moon calendar book flag crown apple gem medal brain target bolt ghost portal shoe globe fire vibrate thread dpad contrast info plus edit trash hand keyboard speaker fullscreen
- Звуки `audio.play(name)` — js/audio.js `SFX`: click step collect key gate locked portal hit bump door win lose star tick bonus hint achievement
- Музыка `audio.startMusic(id)` — js/audio.js `SCALES`: forest sea candy snow space menu
- Миры — js/levels.js `WORLDS`: forest sea candy snow space
- Возрасты — js/levels.js `AGES`: tiny kid teen pro
- Режимы — js/levels.js `MODES`: classic time enemies dark story daily
- Цвета ключей (индекс = color) — js/levels.js `KEY_COLORS`: red blue green yellow
- Герои — js/sprites.js `HEROES`: hedgehog cat frog penguin bunny
- Виды предметов `drawItem(kind)` (мировой `world.item` + бонусы) — js/sprites.js `drawItem`: apple shell candy snowflake crystal clock firefly heart
- Виды врагов `drawEnemy(kind)` = `world.enemy` (последний — ветка else) — js/sprites.js `drawEnemy`: bee crab jelly snowball
- Фигуры лабиринта — js/maze.js `SHAPES`: circle diamond heart star flower ring cross house
- Достижения — js/progress.js `ACHIEVEMENTS`: first_win wins_10 wins_50 stars_30 stars_100 items_50 items_250 keys_10 perfect_10 nohint_10 shortest_5 time_5 ninja_5 dark_5 portals_10 steps_1000 steps_10000 worlds_5 story_3 daily_1 streak_3 streak_7 campaign all_modes
- Настройки `P.settings` — js/progress.js `DEFAULT_SETTINGS`: sound music voice vibration trail dpad ai theme glide speech voiceName
- Темы сказок — js/story.js `THEMES`: any forest sea candy snow space
- Фразы совёнка `AI.phrase(kind)` — js/ai.js `LOCAL_PHRASES`: start collect stuck win lose gate exit key
- События `Game.emit(type)` → `app.onEvent`: gateLocked exitLocked gateOpen key collect exitOpen bonus portal noHints hint enemySleep hit overtime stuck
- Экраны `UI.show(name)`: settings records achievements story welcome home levels

## Прочие файлы (строк) — описание в docs/kb/testing.md
sw.js (41) · tests/run.sh (21) · tests/levels.test.js (68) · tests/game.test.js (123) · tests/ui.smoke.js (77) · tests/dom-stub.js (122) · tools/verify.sh (38) · tools/screens.sh (65) · tools/_server.sh (17) · tools/shot.sh (12) · tools/audit.sh (12) · tools/audit.js (47) · tools/snap.swift (58) · tools/kb.py (546)

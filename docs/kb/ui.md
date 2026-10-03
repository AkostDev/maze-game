# Интерфейс: экраны, модалки, HUD, стили

Источники: js/ui.js, css/style.css, index.html

## Принципы
- Весь интерфейс — DOM поверх canvas, строится хелпером `el(tag, attrs, children)` из util.js: `class`, `text` (textContent),
  `html` (**только свои SVG-иконки**, никогда текст игрока/ИИ), `style` (объект; `--переменные` через setProperty), `on*`, `dataset`.
- Экран = метод объекта `UI`, возвращающий DOM-узел через `screen()`; показывается `show(name, arg)` (чистит `#screens`, закрывает модалку,
  сбрасывает `aiListener`, включает музыку меню). Кнопки вызывают `MZ.app.*`; у каждой — `MZ.audio.play('click')`.
- Перерисовка — повторным `show()` того же экрана (состояние держится в полях `UI`, не в DOM).

## Экраны
| name (arg) | Содержимое | Куда ведёт |
|---|---|---|
| `welcome()` (opts: age, hero, name, canBack, editId, keep) | шаг 1 — возраст (`.age-card`), шаг 2 — герой (`.hero-pick`) и имя `#playerName`; состояние в `welcomeState` | `createProfile()` или `updateProfile()` при editId |
| `home()` | чип профиля, звёзды, настройки; карточка-герой с живой сценой (`animateHeroArt()`); 6 карточек режимов (`.mode-card` + цвет из `MODE_COLORS`); рекорды и достижения | `openMode()`, `continueGame()`, `profilesModal()` |
| `levels()` (mode) | 5 миров × 8 кнопок `.lvl` (`.is-done` / `.is-next` / `.is-locked`), звёзды; блок «Бесконечные» после 40-го | `startCampaign()` |
| `story()` | статус ИИ (`.ai-line`), темы (`.chip-btn`), карточка сказки с тегами; состояние в `storyState {theme, story}` | `startStory()`, `pickStory()` |
| `records()` (tab) | карточки игроков, вкладки режимов (`.tab`), таблица `.board` (день — по времени, остальное — по очкам) | — |
| `achievements()` | сводка и сетка `.ach` с прогрессом | — |
| `settings()` | профиль и возраст, переключатели, `voiceSettings()`, тема, ИИ (проверка связи `ping()`), справка, «для взрослых» (`holdToConfirm()`) | `applySettings()` |

Конструкторы внутри `settings()`: `sw(key, title, sub, icon, onChange, disabled)` — булев переключатель по ключу настройки;
`seg(items, cur, onPick)` — сегментированный выбор. Общие: `topbar()`, `backBtn()`.

## Модальные окна
`openModal(children, dismiss)` — карточка `.modal-card` в `#modal`; если передан `dismiss`, клик по фону и Esc закрывают и вызывают его.
`closeModal(byUser)`. Готовые: `resultModal(res, {level, newBest, unlocked})`, `loseModal(res)`, `pauseModal(level)`, `profilesModal()`,
`confirm(text, onYes)`. Пока модалка открыта, ввод в игру отключён (`isActive` в main.js).

## HUD (во время игры)
- `showHud(level)` собирает чипы `.hchip` в `#hudStats`: находки (всегда), ключи (если есть), время (`rules.timer | countUp`),
  жизни (`rules.enemies` и `hearts > 0`); красит фон `#stage` в цвета мира; ссылки на узлы — в `hudEls`.
- `updateHud(game)` вызывается каждый кадр, но DOM трогает только при изменении строки-подписи `hudSig`
  (`remaining | ключи | время | жизни | подсказки | overtime`). **Новый показатель HUD — добавь его в подпись**, иначе не обновится.
- `owl(text, speak, ms)` — реплика совёнка (`speak`: true — озвучить текст, строка — озвучить её; по умолчанию 3.8 с); `hideOwl()`.
- `intro(level)` — карточка начала уровня (цель, особенности режима, способ управления), 7 с; `hideIntro()`.
- `toast(text, icon)` — до 3 одновременно, 2.6 с. `hintAttention(on)` — мигание кнопки подсказки.
- Счётчик подсказок `#hintCount`: «∞», если запас > 50.

## Иконки и мини-холсты
- `icon(name)` → SVG-строка 24×24 (stroke, `currentColor`), `iconEl(name, cls)` → узел. Имена — ключи `ICONS` (список в MAP.md, «Реестры»);
  неизвестное имя молча превращается в звезду. У SVG всегда есть width/height=24 — без CSS не растянется.
- `heroCanvas(heroId, css)`, `itemCanvas(kind, css)`, `keyCanvas(color, css)` — картинки из спрайтов для DOM (аватары, чипы).
- `OWL` — SVG совёнка Угуши.

## Дизайн-система (css/style.css; разделы и классы — в MAP.md)
- **Mobile-first.** Токены на `:root`: цвета (`--bg --surface --surface-2 --ink --ink-2 --ink-3 --line --stitch`), акценты с `-deep`/`-soft`
  (`--accent` красный #FF5B4F, `--sun` #FFBE2E, `--teal` #13A89E, `--grape` #7A5CFA — цвет ИИ, `--sky`, `--night`), размеры
  `--fs --fs-sm --fs-xs --tap --tap-lg --r-lg --r-md --gap --pad --gutter`, safe-area `--safe-t/b/l/r`.
  С 600 px токены крупнее; малышам — `body[data-age="tiny"]` (крупнее шрифт и цели касания).
- **Тёмная тема задана дважды**: `@media (prefers-color-scheme: dark)` для `:root:not([data-theme="light"])` и `:root[data-theme="dark"]` —
  новый цветовой токен добавляй в оба блока.
- Шрифты: Unbounded (`--font-display`) — только h1/h2, он широкий; h3 и всё в узких блоках — Nunito 900.
- Фирменная карточка `.patch` — «заплатка» с пунктирным стежком (`::before`). Кнопки `.btn` (+ `.btn--sun/--teal/--grape/--sky/--ghost`,
  `.btn--xl`, `.btn--block`; цвет через `--b/--bd/--bc`), квадратная `.icon-btn`, круглая игровая `.round-btn`.
- Утилиты: `.row` (flex с переносом), `.grow`, `.muted`, `.eyebrow`, `.num` (табличные цифры), `.tile` (плитка-иконка).
- Состояния: `.is-on`, `.is-selected`, `.is-done`, `.is-next`, `.is-locked`, `.is-warn`, `.is-attention`, `.is-leaving`, `.is-down`.
- Брейкпоинты: 600 (основной), 720 (сетки главной и уровней), 820, 540; узкие случаи ≤ 400, ≤ 380, HUD ≤ 559.
- `body` не прокручивается; прокручивается `.screen`. Анимации выключаются при `prefers-reduced-motion`.

## Правила вёрстки (на этом уже обжигались)
- Текст обязан помещаться на 320 px: длинные русские слова, имя до 16 символов. В flex-строке у текстового блока — `.grow` / `min-width: 0`.
- Цели касания ≥ `--tap` (46/48 px), главные ≥ `--tap-lg`; малышам крупнее.
- Canvas внутри карточек получают размер из CSS; иконкам без CSS-правила нужен размер по умолчанию.
- После любой правки интерфейса: `tools/verify.sh ui` (аудит 320–768) и снимки `tools/screens.sh <экран>` — телефон и ПК (см. testing.md).
- Смоук-тест гоняет все экраны на мини-DOM: новый вызов DOM API, которого нет в tests/dom-stub.js, уронит его — дополни заглушку.

# ИИ-помощник и сказки

Источники: js/ai.js, js/story.js, js/config.js

## Главное правило
**Игра никогда не ждёт ИИ.** API (vibecode.moe, OpenAI-совместимый chat/completions) отвечает 20–60 с и иногда 502. Поэтому: запросы только фоном,
результат в кэш (`klubok.ai.v1`), в момент использования берётся готовое из кэша или мгновенный локальный вариант.
Текст ИИ выводится только через textContent и проходит `cleanText()` (без ссылок, разметки, управляющих символов) и обрезку длины.
Ключ лежит в js/config.js и виден в браузере — никуда его не копируй (ни в документы, ни в тесты); для публичного хостинга нужен прокси.

## Настройки — `MZ.config.ai` (config.js)
`enabled, endpoint, apiKey, model, fallbackModels[], timeoutMs (45 с), maxFailures (2), cooldownMs (5 мин), prefetchDelayMs (4 с)`; `MZ.config.version`.

## Механика (ai.js, объект `AI`)
- `available()` — включён в конфиге и в настройках игрока (`settings.ai`), есть fetch, онлайн, не на паузе после ошибок.
- `request(prompt, {timeout, temperature})` — перебирает модели по цепочке, ждёт JSON (`parseJson()` терпит обёртку ```json), никогда не бросает исключений,
  возвращает объект или null. `maxFailures` неудач подряд → пауза `cooldownMs` (circuit breaker).
- `task(key, fn)` — последовательная очередь с дедупликацией по ключу; статус `idle | working | ok | offline` через `setStatus()` →
  слушатели `onChange()` (экраны story и settings перерисовывают строку статуса через `UI.aiListener`).
- `prefetch(profile, {theme})` — вызывается при загрузке, после победы, при выборе сказки/профиля: фразы, названия уровней текущего мира,
  запас сказок (< 2 в очереди).
- `ping()` — проверка связи из настроек (снимает паузу на время проверки).

## Три применения
| Что | Запрос | Кэш | Использование | Локальный запасной вариант |
|---|---|---|---|---|
| Сказка-уровень | `fetchStory()` (`storyPrompt()` + `AGE_GUIDE`) → `validateStory()` | `stories[age]`, очередь ≤ 5 | `takeStory()` в `pickStory()` | `MZ.story.local()` |
| Фразы совёнка | `fetchPhrases()`, обновление раз в 3 дня | `phrases[age]` | `phrase(kind, age)` — 70 % ИИ, 30 % локальные | `LOCAL_PHRASES` |
| Названия уровней | `fetchNames()` — 8 названий на мир и возраст | `names["age\|world"]` | `levelName()` в `startLevel()` и на экране уровней | `localTitle()` |

## Валидация сказки — `validateStory()`
Нужны `title` и `intro`; мир — из списка (иначе тема или forest); предмет принудительно по миру (`ITEMS_NOM`), чтобы текст совпадал с игрой;
`shape` — из списка; `custom` + `art` → проверка `asciiMask()` (заполнение ≥ 35 %, ≥ 30 клеток), иначе без фигуры;
числа зажимаются в лимиты возраста (`AGES[age].gates/enemies/portals`), у tiny `dark` всегда false. Дальше ещё раз зажимает `resolveParams()`.

## Локальные сказки и сборка уровня (story.js)
- `local(age, heroName, theme, seed)` — шаблоны `TALES[world]` (`t` — название, `i` — завязка с `{Hero}` и `{items}`, `o` — концовка; без прошедшего
  времени у героя — не нужно угадывать род), параметры из `PARAMS[age]` (диапазоны size/keys/enemies/portals/dark/loops).
- `levelSpec(story, age, aspect, storyIndex)` → spec с `mode: 'story'`, сидом `story|id|age` и `override` (мир, размер, фигура/ASCII, ключи, враги, порталы, ночь, петли).
- `goalText(level)` — цель для экрана («Собери 3 яблочка…»); `goalSpeech(level)` — она же для голоса: числа словами с родом.
- `THEMES` — чипы тем на экране сказки (`any` + миры).

## Новая ИИ-функция — шаблон
1. Метод-загрузчик (по образцу `fetchNames()`) через `task('x|…', async () => …)`: `request()` → валидация/`cleanText()` → запись в `cache` + `saveCache()`.
2. Синхронный геттер, который отдаёт кэш или null — и локальный запасной вариант в месте использования.
3. Вызов загрузчика из `prefetch()`. Новое поле кэша — инициализировать в `loadCache()`.

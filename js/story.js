/* Сказки: локальный генератор (мгновенный запасной вариант для ИИ) и сборка уровня по сказке */
(function (root) {
  'use strict';
  const MZ = root.MZ = root.MZ || {};
  const { makeRng, clamp, plural, numWord } = MZ.util;

  const THEMES = [
    { id: 'any', label: 'Удиви меня' },
    { id: 'forest', label: 'Про лес' },
    { id: 'sea', label: 'Про море' },
    { id: 'candy', label: 'Про сладости' },
    { id: 'snow', label: 'Про зиму' },
    { id: 'space', label: 'Про космос' }
  ];
  const WORLD_IDS = ['forest', 'sea', 'candy', 'snow', 'space'];
  const ITEMS_NOM = { forest: 'яблочки', sea: 'ракушки', candy: 'конфетки', snow: 'снежинки', space: 'кристаллы' };

  // Шаблоны без прошедшего времени у героя — так не нужно угадывать род
  const TALES = {
    forest: [
      { t: 'Праздник на опушке', i: 'Белочка рассыпала {items} по всему лесу. {Hero} спешит на помощь!', o: 'Праздник спасён — белочка угощает всех пирогом!' },
      { t: 'Тайна старого дуба', i: 'Мудрая сова зовёт в гости, но дорога к её дубу запутана. {Hero} отправляется в путь.', o: 'Сова угощает чаем с мёдом и рассказывает сказку.' },
      { t: 'Грибной дождик', i: 'После дождя в лесу выросли волшебные тропинки. {Hero} берёт корзинку и идёт гулять.', o: 'Корзинка полна, а дома ждёт тёплый ужин!' }
    ],
    sea: [
      { t: 'Жемчужина осьминожки', i: 'Осьминожка потеряла свои {items} среди кораллов. {Hero} надевает маску и ныряет!', o: 'Осьминожка счастлива и машет всеми восемью лапками!' },
      { t: 'Подводный бал', i: 'Рыбки готовят бал, а для украшений нужны {items}. {Hero} плывёт на поиски.', o: 'Бал начинается, и все танцуют в пузырьках!' },
      { t: 'Карта кита', i: 'Добрый кит нарисовал карту сокровищ. {Hero} разгадывает её!', o: 'Сокровище найдено, кит радостно пускает фонтан!' }
    ],
    candy: [
      { t: 'Большой торт', i: 'В Конфетной стране пекут огромный торт, но не хватает начинки. Нужны {items}!', o: 'Торт готов, и каждому достался кусочек!' },
      { t: 'Мармеладный переполох', i: 'Мармеладки разбежались и спрятали {items}. {Hero} наводит порядок.', o: 'Порядок наведён — пора пить какао!' },
      { t: 'Леденцовый замок', i: 'Король сладостей приглашает в замок. {Hero} собирает подарки по дороге.', o: 'Король в восторге от подарков!' }
    ],
    snow: [
      { t: 'Шарф снеговика', i: 'Снеговику холодно без волшебных снежинок. {Hero} собирает их в лабиринте!', o: 'Снеговик улыбается, а на небе сияет северное сияние.' },
      { t: 'Ледяная горка', i: 'Пингвины построили горку, а дорогу к ней замело. {Hero} ищет путь.', o: 'Вжух! Все катаются с горки!' },
      { t: 'Хрустальный дворец', i: 'Снежная королева приглашает на праздник. Но сначала нужно найти {items}.', o: 'Во дворце зажигаются тысячи огоньков!' }
    ],
    space: [
      { t: 'Путь домой', i: 'Маленькой ракете нужны {items}, чтобы долететь до дома. {Hero} помогает!', o: 'Ракета взлетает, оставляя за собой звёздный след!' },
      { t: 'Лунный пикник', i: 'На Луне устраивают пикник, а {items} разлетелись по кратерам. {Hero} собирает их.', o: 'Пикник под звёздами удался!' },
      { t: 'Потерянная звёздочка', i: 'С неба упала звёздочка и заблудилась. {Hero} отправляется её искать.', o: 'Звёздочка возвращается на небо и подмигивает!' }
    ]
  };

  const PARAMS = {
    tiny: { size: [0, 0.4], keys: [0, 1], enemies: [0, 1], portals: [0, 0], dark: 0, loops: [0.6, 1] },
    kid: { size: [0.3, 0.7], keys: [0, 2], enemies: [0, 2], portals: [0, 1], dark: 0.2, loops: [0.3, 0.7] },
    teen: { size: [0.5, 0.9], keys: [1, 3], enemies: [0, 4], portals: [0, 2], dark: 0.3, loops: [0.1, 0.5] },
    pro: { size: [0.7, 1], keys: [2, 4], enemies: [2, 6], portals: [1, 3], dark: 0.35, loops: [0, 0.3] }
  };

  function local(age, heroName, theme, seed) {
    const rng = makeRng('tale|' + seed);
    const world = theme && theme !== 'any' ? theme : rng.pick(WORLD_IDS);
    const tale = rng.pick(TALES[world] || TALES.forest);
    const pr = PARAMS[age] || PARAMS.kid;
    const fill = s => s.replace(/\{Hero\}/g, heroName).replace(/\{items\}/g, ITEMS_NOM[world]);
    const shapes = [null, null, 'heart', 'star', 'flower', 'circle', 'house'];
    const size = rng.range(pr.size[0], pr.size[1]);
    return {
      id: 'l' + seed, ai: false, age, theme: theme || 'any', world,
      title: tale.t, intro: fill(tale.i), goal: '', outro: tale.o, item: ITEMS_NOM[world],
      shape: size > 0.35 ? rng.pick(shapes) : null, art: null,
      size,
      keys: rng.irange(pr.keys[0], pr.keys[1]),
      enemies: rng.irange(pr.enemies[0], pr.enemies[1]),
      portals: rng.irange(pr.portals[0], pr.portals[1]),
      dark: rng.chance(pr.dark),
      loops: rng.range(pr.loops[0], pr.loops[1])
    };
  }

  // Сказка → спецификация уровня для MZ.levels.buildLevel
  function levelSpec(story, age, aspect, storyIndex) {
    const worldIndex = Math.max(0, WORLD_IDS.indexOf(story.world));
    const A = MZ.levels.AGES[age];
    const items = Math.round(A.items[0] + (A.items[1] - A.items[0]) * story.size);
    return {
      age, mode: 'story', index: storyIndex || 0, aspect,
      seed: ['story', story.id, age].join('|'),
      title: story.title, story,
      override: {
        world: worldIndex, sizeT: clamp(story.size, 0, 1),
        shape: story.art ? null : story.shape, ascii: story.art || null,
        items, keys: story.keys, enemies: story.enemies, portals: story.portals,
        dark: story.dark, loops: story.loops
      }
    };
  }

  function goalText(level) {
    const w = level.world;
    const n = level.required;
    let s = 'Собери ' + n + ' ' + plural(n, w.itemName);
    if (level.keys.length) s += ', найди ' + (level.keys.length === 1 ? 'ключик' : level.keys.length + ' ' + plural(level.keys.length, ['ключик', 'ключика', 'ключиков']));
    s += ' и открой домик';
    return s;
  }

  // То же для голоса: числа словами и с правильным родом («Собери две ракушки»)
  function goalSpeech(level) {
    const w = level.world, n = level.required, k = level.keys.length;
    let s = 'Собери ' + numWord(n, w.itemGender) + ' ' + plural(n, w.itemName);
    if (k) s += ', найди ' + (k === 1 ? 'ключик' : numWord(k, 'm') + ' ' + plural(k, ['ключик', 'ключика', 'ключиков']));
    return s + ' и открой домик!';
  }

  MZ.story = { THEMES, local, levelSpec, goalText, goalSpeech, ITEMS_NOM };
})(typeof window !== 'undefined' ? window : globalThis);

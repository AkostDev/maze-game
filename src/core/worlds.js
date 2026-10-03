/*
 * Миры, герои, цвета ключей и порталов — данные без логики.
 * Палитра мира читается и генератором картинки лабиринта (src/gfx/mazeLayer.js), и интерфейсом.
 */

// floor — два тона «шахматки» пола; wall* — верх, блик, передняя грань и тень стены; bg* — фон вокруг лабиринта
export const WORLDS = [
  {
    id: 'forest', name: 'Лесная полянка', item: 'apple', itemName: ['яблоко', 'яблока', 'яблок'], enemy: 'bee',
    bg: '#2f6b3f', bgAlt: '#37774a', bgDeco: '#56a35f',
    floor: ['#ecdcab', '#e4d19c'], floorDeco: '#cdb67e',
    wallTop: '#3f9b4f', wallHi: '#6cc56a', wallFront: '#236b3a', wallDark: '#184a2a', ui: '#38b764',
    names: ['Солнечная опушка', 'Грибная тропка', 'Беличье дупло', 'Земляничная поляна', 'Шишкин двор',
      'Дубовая аллея', 'Совиная роща', 'Тайный ручеёк', 'Моховая кочка', 'Ежевичный куст']
  },
  {
    id: 'sea', name: 'Морское дно', item: 'shell', itemName: ['ракушка', 'ракушки', 'ракушек'], enemy: 'crab',
    bg: '#1d5f8a', bgAlt: '#236b9a', bgDeco: '#4f9fcc',
    floor: ['#f6e7c1', '#efdcae'], floorDeco: '#d9c28c',
    wallTop: '#3a86c8', wallHi: '#7cc0ee', wallFront: '#235a94', wallDark: '#173d66', ui: '#41a6f6',
    names: ['Коралловый садик', 'Ракушечный берег', 'Жемчужная бухта', 'Дом осьминожки', 'Водорослевый лес',
      'Пузырьковая тропа', 'Тайна кита', 'Затонувший сундук', 'Морская звезда', 'Песчаная отмель']
  },
  {
    id: 'candy', name: 'Конфетная страна', item: 'candy', itemName: ['конфета', 'конфеты', 'конфет'], enemy: 'jelly',
    bg: '#8a3d6b', bgAlt: '#97477a', bgDeco: '#c874a4',
    floor: ['#fff1e0', '#ffe6d0'], floorDeco: '#ffc4da',
    wallTop: '#e85d9a', wallHi: '#ffa3c8', wallFront: '#b0356e', wallDark: '#7a1f4c', ui: '#ff8fb3',
    names: ['Леденцовая улица', 'Шоколадный мост', 'Зефирное облако', 'Мармеладный сад', 'Пряничный домик',
      'Карамельный замок', 'Вафельная башня', 'Сахарная горка', 'Ирисковый пруд', 'Пастильный парк']
  },
  {
    id: 'snow', name: 'Снежное королевство', item: 'snowflake', itemName: ['снежинка', 'снежинки', 'снежинок'], enemy: 'snowball',
    bg: '#56789f', bgAlt: '#6083ab', bgDeco: '#a9c6e8',
    floor: ['#f7fbff', '#e8f1fb'], floorDeco: '#c9dcf2',
    wallTop: '#6fa3e8', wallHi: '#b9d8ff', wallFront: '#4470bd', wallDark: '#2c4c8a', ui: '#73eff7',
    names: ['Снежная горка', 'Ледяная пещера', 'Дом снеговика', 'Морозный узор', 'Сосульковый зал',
      'Пингвинья бухта', 'Северное сияние', 'Хрустальный дворец', 'Метелица', 'Звонкий каток']
  },
  {
    id: 'space', name: 'Звёздный космос', item: 'crystal', itemName: ['кристалл', 'кристалла', 'кристаллов'], enemy: 'ufo',
    bg: '#12122b', bgAlt: '#171736', bgDeco: '#f4f4f4',
    floor: ['#343a73', '#2e3368'], floorDeco: '#4c5296',
    wallTop: '#8c7dff', wallHi: '#c8beff', wallFront: '#5a4bc4', wallDark: '#342a80', ui: '#c8beff',
    names: ['Лунная база', 'Кольца Сатурна', 'Звёздная пыль', 'Метеоритный пояс', 'Марсианский каньон',
      'Орбита', 'Туманность Лиса', 'Галактика Клубок', 'Комета', 'Млечный путь']
  }
];

// thread — цвет нити, которую герой разматывает за собой
export const HEROES = [
  { id: 'hedgehog', name: 'Ёжик', thread: '#ff5b4f' },
  { id: 'cat', name: 'Котик', thread: '#ffbe2e' },
  { id: 'frog', name: 'Лягушонок', thread: '#b98cff' },
  { id: 'penguin', name: 'Пингвин', thread: '#2ad4c0' },
  { id: 'bunny', name: 'Зайка', thread: '#ff8fb3' }
];

export const heroById = id => HEROES.find(h => h.id === id) || HEROES[0];

// Ключ и дверца одного цвета — пара; индекс в массиве = поле color у ключа и дверцы
export const KEY_COLORS = [
  { id: 'red', color: '#ff5b4f' },
  { id: 'blue', color: '#41a6f6' },
  { id: 'green', color: '#5fd068' },
  { id: 'yellow', color: '#ffcd45' }
];

export const PORTAL_COLORS = ['#b55cff', '#2ad4e0', '#ff8a3c'];

export const NIGHT = '#0b1020';

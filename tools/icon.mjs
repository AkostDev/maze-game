#!/usr/bin/env node
// Генерирует icon.svg из пиксельных спрайтов игры (герой и клубок) — иконка PWA всегда в одном стиле с игрой.
// Запуск: node tools/icon.mjs (после правки спрайтов cat или yarn в src/gfx/sprites.js).
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PALETTE, SPRITES, expand } from '../src/gfx/sprites.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const S = 24; // сторона иконки в «пикселях»; спрайт 16×16 стоит по центру — в безопасной зоне maskable-иконки
const rects = [];
const put = (x, y, w, h, fill) => rects.push(`<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fill}"/>`);
const draw = (rows, ox, oy, recolor) => rows.forEach((row, y) => {
  for (let x = 0; x < row.length; x++) {
    if (row[x] === '.') continue;
    put(ox + x, oy + y, 1, 1, (recolor && recolor[row[x]]) || PALETTE[row[x]]);
  }
});

put(0, 0, S, S, '#2ab8a8');
// «шахматка» пола, как в лабиринте
for (let y = 0; y < S; y += 8) for (let x = (y / 8) % 2 ? 0 : 8; x < S; x += 16) put(x, y, 8, 8, '#27ab9c');
// нить клубка: от края к герою
put(0, 19, 9, 1, '#ff5b4f'); put(8, 17, 1, 3, '#ff5b4f');
draw(expand(SPRITES.cat, 'a'), 4, 3);
// клубок цвета нити — в правом нижнем углу, вдвое мельче не сделать, поэтому рисуем только его ядро 8×8
const yarn = expand(SPRITES.yarn, 'a').slice(4, 12).map(r => r.slice(4, 12));
draw(yarn, 14, 14, { w: '#ff5b4f', G: '#b13e53' });

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${S} ${S}" shape-rendering="crispEdges">\n  ${rects.join('\n  ')}\n</svg>\n`;
writeFileSync(join(ROOT, 'icon.svg'), svg);
console.log('icon.svg: ' + rects.length + ' прямоугольников');

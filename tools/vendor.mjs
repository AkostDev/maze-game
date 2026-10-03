#!/usr/bin/env node
// Переносит Phaser из node_modules в проект: сборку движка — в vendor/, официальные скиллы — в .claude/skills/phaser-*.
// Запуск: `npm run vendor` (после `npm install` или обновления версии phaser в package.json).
// Игра работает без сборки, поэтому движок лежит в репозитории готовым файлом.
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PKG = join(ROOT, 'node_modules', 'phaser');
if (!existsSync(PKG)) {
  console.error('нет node_modules/phaser — сначала npm install');
  process.exit(1);
}
const version = JSON.parse(readFileSync(join(PKG, 'package.json'), 'utf8')).version;

// 1. Движок (ES-модуль, минифицированный) и лицензия
mkdirSync(join(ROOT, 'vendor'), { recursive: true });
cpSync(join(PKG, 'dist', 'phaser.esm.min.js'), join(ROOT, 'vendor', 'phaser.esm.min.js'));
cpSync(join(PKG, 'LICENSE.md'), join(ROOT, 'vendor', 'PHASER-LICENSE.md'));

// 2. Скиллы: имя и ссылки между ними получают префикс phaser-, чтобы не путаться со скиллами проекта
const SKILLS = join(ROOT, '.claude', 'skills');
mkdirSync(SKILLS, { recursive: true });
for (const name of readdirSync(SKILLS)) {
  if (name.startsWith('phaser-')) rmSync(join(SKILLS, name), { recursive: true, force: true });
}
const names = readdirSync(join(PKG, 'skills'), { withFileTypes: true }).filter(d => d.isDirectory()).map(d => d.name);
const relink = text => names.reduce((t, n) => t.split('../' + n + '/').join('../phaser-' + n + '/'), text);
const walk = dir => readdirSync(dir, { withFileTypes: true }).flatMap(d =>
  d.isDirectory() ? walk(join(dir, d.name)) : [join(dir, d.name)]);
for (const name of names) {
  const dst = join(SKILLS, 'phaser-' + name);
  cpSync(join(PKG, 'skills', name), dst, { recursive: true });
  for (const file of walk(dst)) {
    if (!file.endsWith('.md')) continue;
    let text = relink(readFileSync(file, 'utf8'));
    if (file.endsWith('SKILL.md')) text = text.replace(/^name: .*$/m, 'name: phaser-' + name);
    writeFileSync(file, text);
  }
}
console.log(`phaser ${version}: vendor/phaser.esm.min.js, скиллов: ${names.length} (.claude/skills/phaser-*)`);

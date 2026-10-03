#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""База знаний проекта для Claude (docs/kb): карта кода src/, проверка ссылок документов на код, отслеживание изменений.

  python3 tools/kb.py map     пересобрать карту кода docs/kb/MAP.md (символы и номера строк)
  python3 tools/kb.py check   проверить ссылки базы знаний на код и её свежесть
  python3 tools/kb.py stamp   пометить базу знаний сверенной с текущим кодом
  python3 tools/kb.py hook post-edit|session-start|stop   точки входа хуков (.claude/settings.json)

Только стандартная библиотека, Python 3.9+.
"""
import hashlib
import json
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
KB = os.path.join(ROOT, 'docs', 'kb')
MAP = os.path.join(KB, 'MAP.md')
SYNC = os.path.join(KB, '.sync.json')

# Файлы, по которым в карте только заголовок (без символов)
EXTRA = ['sw.js', 'test/levels.test.js', 'test/game.test.js', 'test/progress.test.js', 'test/sprites.test.js', 'test/pwa.test.js',
         'test/autopilot.js', 'test/browser.smoke.mjs', 'tools/verify.sh', 'tools/browser.mjs', 'tools/screens.mjs',
         'tools/vendor.mjs', 'tools/icon.mjs', 'tools/kb.py']

# Порядок папок src/ в карте: от чистой логики к сценам
SRC_ORDER = ['core', 'gfx', 'audio', 'ui', 'scenes', '']

# Реестры — имена, которые в коде используются как строковые ключи: (подпись, файл, константа, режим)
#   keys — ключи первого уровня объекта; ids — значения id: '...'; allkeys — все ключи вида name:
#   branches — значения сравнений `=== '...'` в теле функции
REGISTRIES = [
    ('Миры (индекс = `level.worldIndex`)', 'src/core/worlds.js', 'WORLDS', 'ids'),
    ('Герои', 'src/core/worlds.js', 'HEROES', 'ids'),
    ('Цвета ключей (индекс = color)', 'src/core/worlds.js', 'KEY_COLORS', 'ids'),
    ('Механики и уровень, с которого они появляются', 'src/core/levels.js', 'UNLOCKS', 'keys'),
    ('Фигуры лабиринта', 'src/core/maze.js', 'SHAPES', 'keys'),
    ('Настройки `progress.settings`', 'src/core/progress.js', 'DEFAULT_SETTINGS', 'allkeys'),
    ('Спрайты 16×16 — кадры атласа `sprites`', 'src/gfx/sprites.js', 'SPRITES', 'keys'),
    ('Иконки — кадры атласа `icons`', 'src/gfx/sprites.js', 'ICONS', 'keys'),
    ('Звуки `sfx.play(name)`', 'src/audio/sfx.js', 'SFX', 'keys'),
    ('Музыка `sfx.startMusic(id)`', 'src/audio/sfx.js', 'SCALES', 'keys'),
]

KEYWORDS = {'if', 'for', 'while', 'switch', 'catch', 'return', 'function', 'else', 'do', 'try', 'super', 'constructor'}
# Слова заглавными буквами, которые в базе знаний не являются именами констант
NOT_CONSTS = {'HUD', 'DOM', 'PWA', 'BFS', 'DFS', 'RNG', 'SVG', 'CSS', 'JSON', 'CORS', 'API', 'URL', 'HTML', 'MAP', 'TODO',
              'HTTP', 'PNG', 'FPS', 'DPR', 'UI', 'OK', 'KB', 'REGISTRIES', 'ASSETS', 'CACHE', 'ESM', 'WEBGL', 'CANVAS',
              'AUTO', 'NONE', 'OFL', 'MIT', 'NEAREST', 'WASD', 'ASCII', 'KLUBOK', 'RESIZE', 'FILL'}


def read(rel):
    with open(os.path.join(ROOT, rel), encoding='utf-8') as f:
        return f.read()


def js_files():
    """Все модули src/**/*.js: папки в порядке SRC_ORDER, внутри — по алфавиту."""
    out = []
    src = os.path.join(ROOT, 'src')
    for base, _dirs, files in os.walk(src):
        for n in files:
            if n.endswith('.js'):
                out.append(os.path.relpath(os.path.join(base, n), ROOT).replace(os.sep, '/'))

    def key(rel):
        parts = rel.split('/')
        d = parts[1] if len(parts) > 2 else ''
        return (SRC_ORDER.index(d) if d in SRC_ORDER else len(SRC_ORDER), rel)
    return sorted(out, key=key)


def indent(line):
    return len(line) - len(line.lstrip(' '))


def header_comment(lines):
    """Первая содержательная строка заголовочного комментария файла."""
    for raw in lines[:8]:
        s = raw.strip()
        if s.startswith('#!') or 'coding:' in s:
            continue
        s = re.sub(r'^(/\*+|\*+/?|//+|#+|"""|\'\'\')\s*', '', s)
        s = re.sub(r'\s*(\*/|""")$', '', s).strip()
        if s and not s.startswith(('(function', "'use strict'", 'import ', 'var ', 'const ', 'cd ')):
            return s
    return ''


class Sym(object):
    def __init__(self, name, start, end, owner=None, section=None, kind='fn'):
        self.name, self.start, self.end, self.owner, self.section, self.kind = name, start, end, owner, section, kind

    @property
    def full(self):
        return (self.owner + '.' + self.name) if self.owner else self.name


def block_end(lines, i, ind):
    """Последняя строка (0-based) конструкции, начатой в строке i с отступом ind."""
    for j in range(i + 1, len(lines)):
        s = lines[j]
        if not s.strip():
            continue
        if indent(s) <= ind:
            if s.strip()[0] in '}])':
                return j
            k = j - 1
            while k > i and not lines[k].strip():
                k -= 1
            return k
    return len(lines) - 1


RE_SECTION = re.compile(r'^\s*// -{3,}\s*(.+?)\s*-{3,}\s*$')
RE_CLASS = re.compile(r'^class (\w+)')
RE_FUNC = re.compile(r'^(?:async )?function (\w+)\s*\(')
RE_DECL = re.compile(r'^(?:const|let|var) (\w+) = (.*)$')
RE_MEMBER = re.compile(r'^(\w+)\.(\w+) = (?:async )?(?:function\b|\(.*\)\s*=>|\w+\s*=>)')
RE_METHOD = re.compile(r'^(?:async |static |get |set )?(\w+)\s*\([^)]*\)\s*\{')
RE_PROPFN = re.compile(r'^(\w+):\s*(?:async\s+)?(?:function\b|\([^)]*\)\s*=>|\w+\s*=>)')


def parse_js(rel):
    lines = read(rel).split('\n')
    wrapped = any(l.startswith('(function') for l in lines[:12])
    base = 2 if wrapped else 0
    syms, exports, consts = [], [], []
    owner, owner_end, section, section_in_owner = None, -1, None, False
    for i, raw in enumerate(lines):
        if not raw.strip():
            continue
        ind = indent(raw)
        s = raw.strip()
        if owner and i > owner_end:
            owner = None
            if section_in_owner:
                section, section_in_owner = None, False
        m = RE_SECTION.match(raw)
        if m and ind in (base, base + 2):
            section, section_in_owner = m.group(1), bool(owner)
            continue
        if ind == base:
            # ES-модули: `export` перед объявлением — имя попадает в список экспорта файла
            exported = s.startswith('export ')
            if exported:
                s = re.sub(r'^export (default )?', '', s)
                m = re.match(r'^(?:async )?(?:class|function|const|let) (\w+)', s)
                if m:
                    exports.append(m.group(1))
                elif s.startswith('{'):
                    exports.extend(x.split(' as ')[-1].strip() for x in s.strip('{}; ').split(',') if x.strip())
                    continue
            m = RE_CLASS.match(s)
            if m:
                owner, owner_end = m.group(1), block_end(lines, i, ind)
                syms.append(Sym(owner, i, owner_end, None, section, 'class'))
                continue
            m = RE_FUNC.match(s)
            if m:
                syms.append(Sym(m.group(1), i, block_end(lines, i, ind), None, section))
                continue
            m = RE_MEMBER.match(s)
            if m:
                syms.append(Sym(m.group(2), i, block_end(lines, i, ind), m.group(1), section))
                continue
            m = RE_DECL.match(s)
            if m:
                name, rhs = m.group(1), m.group(2)
                if name == 'MZ' or re.match(r'^(root\.)?MZ\b', rhs) or re.match(r'^[\w.]+;$', rhs) and not rhs[0].isdigit():
                    continue
                end = block_end(lines, i, ind)
                is_fn = bool(re.match(r'^(async\s+)?(function\b|\([^)]*\)\s*=>|\w+\s*=>)', rhs))
                is_obj = rhs.rstrip().endswith(('{', '[')) and end > i
                if is_obj and rhs.rstrip().endswith('{'):
                    owner, owner_end = name, end
                if is_fn:
                    syms.append(Sym(name, i, end, None, section))
                elif is_obj or (name.isupper() and len(name) >= 3):
                    syms.append(Sym(name, i, end, None, section, 'const'))
                    consts.append(name)
                continue
        elif owner and ind == base + 2:
            m = RE_METHOD.match(s) or RE_PROPFN.match(s)
            if m and m.group(1) not in KEYWORDS:
                syms.append(Sym(m.group(1), i, block_end(lines, i, ind), owner, section))
    return {'lines': lines, 'header': header_comment(lines), 'syms': syms, 'exports': exports, 'consts': consts}


def registry(parsed, const, mode):
    for s in parsed['syms']:
        if s.name == const and s.owner is None:
            body = parsed['lines'][s.start:s.end + 1]
            if mode == 'branches':
                return list(dict.fromkeys(re.findall(r"=== '(\w+)'", '\n'.join(body))))
            if mode == 'ids':
                return re.findall(r"\bid: '([^']+)'", '\n'.join(body))
            if mode == 'allkeys':
                return re.findall(r'(\w+):', '\n'.join(body[1:]))
            ind = indent(body[0]) + 2
            out = []
            for l in body[1:]:
                m = re.match(r'^(\w+):', l.strip())
                if m and indent(l) == ind:
                    out.append(m.group(1))
            return out
    return None


GAME_JS = 'src/core/game.js'


def collect():
    """Разбор всего кода: {'js': {rel: parsed}, 'ids': [...], 'events': [...], 'scenes': [(ключ, файл)]}"""
    data = {'js': {}, 'order': js_files()}
    for rel in data['order']:
        data['js'][rel] = parse_js(rel)
    html = read('index.html') if os.path.exists(os.path.join(ROOT, 'index.html')) else ''
    data['ids'] = re.findall(r'\bid="([\w-]+)"', html)
    data['entry'] = re.findall(r'<script[^>]+src="([^"]+)"', html)
    uniq = lambda xs: list(dict.fromkeys(xs))
    data['events'] = uniq(re.findall(r"this\.emit\('(\w+)'", '\n'.join(data['js'][GAME_JS]['lines']))) if GAME_JS in data['js'] else []
    data['scenes'] = []
    for rel, p in data['js'].items():
        if rel.startswith('src/scenes/'):
            for key in re.findall(r"super\(\s*'(\w+)'", '\n'.join(p['lines'])):
                data['scenes'].append((key, rel.split('/')[-1]))
    return data


def fmt_syms(parsed):
    """Строки карты для одного файла."""
    out = []
    top = [s for s in parsed['syms'] if s.owner is None]
    members = {}
    for s in parsed['syms']:
        if s.owner:
            members.setdefault(s.owner, []).append(s)

    def rng(s):
        return '%s:%d' % (s.name, s.start + 1) if s.end == s.start else '%s:%d-%d' % (s.name, s.start + 1, s.end + 1)

    def run(items, sec0):
        parts, sec = [], sec0
        for s in items:
            if s.section != sec and s.section:
                parts.append('·%s·' % s.section)
            sec = s.section
            parts.append(rng(s))
        return ' '.join(parts)

    loose, sec = [], None
    for s in top:
        if s.name in members:
            if loose:
                out.append('- ' + run(loose, None))
                loose = []
            label = 'class ' if s.kind == 'class' else ''
            out.append('- %s%s → %s' % (label, rng(s), run(members[s.name], s.section)))
        else:
            loose.append(s)
    if loose:
        out.append('- ' + run(loose, None))
    orphans = [o for o in members if o not in {s.name for s in top}]
    for o in orphans:
        out.append('- %s.* → %s' % (o, run(members[o], None)))
    return out


def build_map(data):
    L = ['# Карта кода', '',
         '> Сгенерировано `tools/kb.py map` — руками не править, обновляется хуком после каждой правки.',
         '> Запись `имя:строка-конец` = диапазон строк. Читать точечно: `Read(file, offset=строка, limit=конец−строка+1)`.',
         '> `·Раздел·` — метка раздела внутри файла. После своей правки номера ниже неё сдвигаются — перечитай этот файл.', '']
    for rel in data['order']:
        p = data['js'][rel]
        exp = (' → ' + ', '.join(p['exports'])) if p['exports'] else ''
        L.append('## %s (%d)%s' % (rel, len(p['lines']), exp))
        if p['header']:
            L.append(p['header'])
        L.extend(fmt_syms(p))
        L.append('')
    L.append('## index.html')
    L.append('- id: ' + ' '.join('#' + i for i in data['ids']))
    L.append('- точка входа: ' + ' '.join(data['entry']) + ' (ES-модули, дальше — по import)')
    L.append('')
    L.append('## Реестры (строковые ключи)')
    for label, rel, const, mode in REGISTRIES:
        vals = registry(data['js'][rel], const, mode) if rel in data['js'] else None
        if vals is None:
            L.append('- %s: ⚠ `%s` не найден в %s — поправь REGISTRIES в tools/kb.py' % (label, const, rel))
        else:
            L.append('- %s — %s `%s`: %s' % (label, rel, const, ' '.join(vals)))
    L.append('- События `Game.emit(type)` → `GameScene.onGameEvent()`: ' + ' '.join(data['events']))
    L.append('- Сцены `scene.start(key)`: ' + ' · '.join('%s (%s)' % s for s in data['scenes']))
    L.append('')
    L.append('## Прочие файлы (строк) — описание в docs/kb/testing.md')
    L.append(' · '.join('%s (%d)' % (rel, len(read(rel).split('\n'))) for rel in EXTRA if os.path.exists(os.path.join(ROOT, rel))))
    return '\n'.join(L) + '\n'


def write_map(data=None):
    data = data or collect()
    text = build_map(data)
    os.makedirs(KB, exist_ok=True)
    old = None
    if os.path.exists(MAP):
        with open(MAP, encoding='utf-8') as f:
            old = f.read()
    if old != text:
        with open(MAP, 'w', encoding='utf-8') as f:
            f.write(text)
    return data


# ---------- Свежесть: отпечатки символов ----------

def sha(text):
    return hashlib.sha1(text.encode('utf-8')).hexdigest()[:10]


def fingerprints(data):
    """{файл: {'_': хэш файла, символ: хэш тела}} для всего, на что могут ссылаться документы."""
    fp = {}
    for rel, p in data['js'].items():
        d = {'_': sha('\n'.join(p['lines']))}
        for s in p['syms']:
            if s.kind == 'class':
                continue
            d[s.full] = sha('\n'.join(p['lines'][s.start:s.end + 1]))
        fp[rel] = d
    for rel in ['index.html'] + EXTRA:
        if os.path.exists(os.path.join(ROOT, rel)):
            fp[rel] = {'_': sha(read(rel))}
    return fp


def kb_docs():
    if not os.path.isdir(KB):
        return []
    return sorted(n for n in os.listdir(KB) if n.endswith('.md') and n != 'MAP.md')


def doc_sources(name):
    with open(os.path.join(KB, name), encoding='utf-8') as f:
        head = f.read(600)
    m = re.search(r'Источники:\s*(.+)', head)
    if not m:
        return []
    return [x.strip(' `.') for x in m.group(1).split(',') if x.strip(' `.')]


def stale(data):
    """[(документ, файл, [изменённые символы])] — что поменялось в коде после последнего stamp."""
    if not os.path.exists(SYNC):
        return [(n, '—', ['база знаний ещё не помечена: python3 tools/kb.py stamp']) for n in kb_docs()][:1]
    with open(SYNC, encoding='utf-8') as f:
        old = json.load(f).get('files', {})
    now = fingerprints(data)
    out = []
    for name in kb_docs():
        for src in doc_sources(name):
            a, b = old.get(src), now.get(src)
            if a is None and b is None:
                continue
            if a is None or b is None:
                out.append((name, src, ['файл добавлен' if a is None else 'файл удалён']))
                continue
            if a.get('_') == b.get('_'):
                continue
            ch = ['~' + k for k in b if k != '_' and k in a and a[k] != b[k]]
            ch += ['+' + k for k in b if k not in a]
            ch += ['−' + k for k in a if k not in b]
            out.append((name, src, ch or ['правки вне функций']))
    return out


def stamp():
    data = write_map()
    with open(SYNC, 'w', encoding='utf-8') as f:
        json.dump({'files': fingerprints(data)}, f, ensure_ascii=False, indent=0, sort_keys=True)
    print('kb: помечено сверенным (%d документов)' % len(kb_docs()))


# ---------- Проверка ссылок ----------

def known(data):
    fns, consts, owners = set(), set(), set()
    for p in data['js'].values():
        for s in p['syms']:
            if s.kind == 'const':
                consts.add(s.name)
            else:
                fns.add(s.name)
            if s.owner:
                owners.add(s.owner)
    ids = set(data['ids'])
    return fns, consts, ids


RE_TICK = re.compile(r'`([^`\n]+)`')
RE_FILE = re.compile(r'^(?:\./)?((?:src|test|tools|docs|vendor|assets|\.claude)/[\w./-]+|[\w.-]+\.(?:html|md|js|mjs|sh|py|json|webmanifest|svg))$')
BARE_DIRS = ['', 'src', 'src/core', 'src/gfx', 'src/audio', 'src/ui', 'src/scenes', 'test', 'tools', 'docs', 'docs/kb']


def file_exists(ref):
    if '/' in ref:
        return os.path.exists(os.path.join(ROOT, ref))
    return any(os.path.exists(os.path.join(ROOT, d, ref)) for d in BARE_DIRS)


def broken_refs(data):
    fns, consts, ids = known(data)
    docs = [os.path.join('docs', 'kb', n) for n in kb_docs()] + ['CLAUDE.md']
    for base, dirs, files in os.walk(os.path.join(ROOT, '.claude')):
        # скиллы Phaser — внешняя документация (tools/vendor.mjs), ссылки в них на наш код не указывают
        dirs[:] = [d for d in dirs if not d.startswith('phaser-')]
        for n in files:
            if n.endswith('.md'):
                docs.append(os.path.relpath(os.path.join(base, n), ROOT))
    errs = []
    for rel in docs:
        if not os.path.exists(os.path.join(ROOT, rel)):
            continue
        fenced = False
        for ln, line in enumerate(read(rel).split('\n'), 1):
            if line.lstrip().startswith('```'):
                fenced = not fenced
                continue
            if fenced:
                continue
            for t in RE_TICK.findall(line):
                t = t.strip()
                why = None
                m = RE_FILE.match(t)
                if m:
                    if not file_exists(m.group(1)):
                        why = 'нет файла'
                elif re.match(r'^[\w.]+\(\)$', t):
                    if t[:-2].split('.')[-1] not in fns:
                        why = 'нет функции'
                elif re.match(r'^#[A-Za-z][\w-]*$', t):
                    if t[1:] not in ids and not re.match(r'^#[0-9A-Fa-f]{3,8}$', t):
                        why = 'нет id'
                elif re.match(r'^[A-Z][A-Z0-9_]{2,}$', t):
                    if t not in consts and t not in NOT_CONSTS:
                        why = 'нет константы'
                if why:
                    errs.append('%s:%d `%s` — %s' % (rel, ln, t, why))
    return errs


def report(data):
    """(ошибки ссылок, устаревшее) в виде готовых строк."""
    errs = broken_refs(data)
    st = stale(data)
    lines = []
    if errs:
        lines.append('Битые ссылки в базе знаний (имя переименовано/удалено — поправь документ):')
        lines += ['  ' + e for e in errs[:40]]
    if st:
        lines.append('Код изменился после последней сверки базы знаний:')
        by = {}
        for name, src, ch in st:
            by.setdefault(src, {'docs': [], 'ch': ch})['docs'].append(name)
        for src, v in by.items():
            lines.append('  %s [%s] → проверь %s' % (src, ' '.join(v['ch'][:14]) + (' …' if len(v['ch']) > 14 else ''),
                                                    ', '.join('docs/kb/' + d for d in v['docs'])))
    return errs, st, lines


def main(argv):
    cmd = argv[1] if len(argv) > 1 else 'map'
    if cmd == 'map':
        write_map()
        if '-v' in argv:
            print(os.path.relpath(MAP, ROOT))
        return 0
    if cmd == 'stamp':
        stamp()
        return 0
    if cmd == 'check':
        data = write_map()
        errs, st, lines = report(data)
        print('\n'.join(lines) if lines else 'kb: ok')
        if st and not errs:
            print('Обнови затронутые документы (если описанное в них поведение изменилось), затем: python3 tools/kb.py stamp')
        return 1 if (errs or st) else 0
    if cmd == 'hook':
        kind = argv[2] if len(argv) > 2 else ''
        try:
            payload = json.load(sys.stdin) if not sys.stdin.isatty() else {}
        except ValueError:
            payload = {}
        if kind == 'post-edit':
            path = (payload.get('tool_input') or {}).get('file_path') or ''
            if path.endswith(('.js', '.mjs', '.html')):
                write_map()
            return 0
        if kind == 'session-start':
            data = write_map()
            _errs, _st, lines = report(data)
            if lines:
                print('[база знаний docs/kb]\n' + '\n'.join(lines) +
                      '\nДо сверки не доверяй этим документам вслепую — сверяйся с кодом затронутых символов.')
            return 0
        if kind == 'stop':
            if payload.get('stop_hook_active'):
                return 0
            data = write_map()
            errs, st, lines = report(data)
            if not lines:
                return 0
            sys.stderr.write('\n'.join(lines) + '\nЕсли работа над задачей закончена: обнови затронутые документы docs/kb '
                             '(только то, что реально изменилось в описанном поведении), затем `python3 tools/kb.py stamp`. '
                             'Если задача ещё в процессе или ждёшь ответа пользователя — просто заверши ход.\n')
            return 2
        return 0
    sys.stderr.write(__doc__)
    return 64


if __name__ == '__main__':
    sys.exit(main(sys.argv))

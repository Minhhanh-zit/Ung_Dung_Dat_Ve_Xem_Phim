/* global __dirname */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const dir = path.join(__dirname, '..', 'src', 'cinehunt');
const files = fs.readdirSync(dir).filter(f => /\.tsx?$/.test(f) && !/ 2\.tsx?$/.test(f));
const read = f => fs.readFileSync(path.join(dir, f), 'utf8');

// Ký tự/emoji từng được dùng làm icon: không được quay lại giao diện.
const ICON_GLYPHS = /[\u2190-\u21FF\u2300-\u23FF\u25A0-\u27BF\u2B00-\u2BFF\u2039\u203A\u2661\u2665\u2605\u{1F300}-\u{1FAFF}]/u;

test('no glyph/emoji is used as a UI icon in active CineHunt files', () => {
  const hits = [];
  for (const f of files) {
    read(f).split('\n').forEach((line, i) => { if (ICON_GLYPHS.test(line)) hits.push(`${f}:${i + 1}`); });
  }
  assert.deepEqual(hits, []);
});

test('theme is context-based: no global mutable C/S or applyTheme', () => {
  for (const f of files) {
    const src = read(f);
    assert.ok(!/applyTheme/.test(src), `${f} still references applyTheme`);
    assert.ok(!/export const [CS]\b/.test(src), `${f} exports a global C/S`);
    assert.ok(!/import\s*\{[^}]*\b[CS]\b[^}]*\}\s*from\s*'\.\/ui'/.test(src), `${f} imports C/S from ui`);
  }
});

test('theme persists through persist.ts only once, from the provider', () => {
  const users = files.filter(f => /saveTheme\(/.test(read(f)));
  assert.deepEqual(users, ['theme.tsx']);
});

test('the theme switch keeps switch semantics for accessibility', () => {
  const ui = read('ui.tsx');
  assert.match(ui, /accessibilityRole="switch"/);
  assert.match(ui, /accessibilityState=\{\{checked:isDark\}\}/);
});

/* global __dirname */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

const source = fs.readFileSync(path.join(__dirname, '..', 'src', 'cinehunt', 'themeTokens.ts'), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const mod = { exports: {} };
new Function('module', 'exports', compiled)(mod, mod.exports);
const { PALETTES, DEFAULT_THEME_MODE, paletteFor, contrastRatio } = mod.exports;

test('default theme is light (decided product behaviour)', () => {
  assert.equal(DEFAULT_THEME_MODE, 'light');
});

test('light and dark palettes expose exactly the same tokens', () => {
  assert.deepEqual(Object.keys(PALETTES.light).sort(), Object.keys(PALETTES.dark).sort());
  assert.ok(Object.keys(PALETTES.light).length >= 44);
});

test('every token is a #RRGGBB colour', () => {
  for (const mode of ['light', 'dark']) {
    for (const [key, value] of Object.entries(PALETTES[mode])) {
      assert.match(value, /^#[0-9A-Fa-f]{6}$/, `${mode}.${key}=${value}`);
    }
  }
});

test('original brand colours are unchanged (user chose to keep them)', () => {
  assert.equal(PALETTES.light.bg, '#FBF5E8');
  assert.equal(PALETTES.light.purple, '#6C3FD1');
  assert.equal(PALETTES.dark.bg, '#080B16');
  assert.equal(PALETTES.dark.purple, '#C2A5FF');
});

test('semantic aliases point at the same underlying values', () => {
  for (const mode of ['light', 'dark']) {
    const p = PALETTES[mode];
    assert.equal(p.background, p.bg);
    assert.equal(p.surface, p.panel);
    assert.equal(p.textPrimary, p.white);
    assert.equal(p.textSecondary, p.muted);
    assert.equal(p.border, p.stroke);
  }
});

test('hero colours stay identical in both modes (gradient cards are always dark)', () => {
  for (const key of ['lavender', 'hero', 'heroCyan', 'heroGreen']) {
    assert.equal(PALETTES.light[key], PALETTES.dark[key]);
  }
});

test('paletteFor returns the matching palette', () => {
  assert.equal(paletteFor('dark'), PALETTES.dark);
  assert.equal(paletteFor('light'), PALETTES.light);
});

// Cặp chữ/nền chính phải đạt WCAG AA (4.5) ở cả hai theme.
const AA_PAIRS = [['white', 'bg'], ['white', 'panel'], ['white', 'panel2'], ['muted', 'bg'], ['muted', 'panel'], ['muted', 'panel2'],
  ['purple', 'bg'], ['bg', 'purple'], ['cyan', 'bg'], ['green', 'bg'], ['green', 'panel'], ['red', 'bg'], ['okText', 'okBg'],
  ['badText', 'badBg'], ['red', 'dangerBg'], ['brand', 'bg'], ['white', 'tabBg'], ['purple', 'tabBg']];
test('primary text/background pairs meet WCAG AA in both themes', () => {
  for (const mode of ['light', 'dark']) {
    for (const [fg, bg] of AA_PAIRS) {
      const ratio = contrastRatio(PALETTES[mode][fg], PALETTES[mode][bg]);
      assert.ok(ratio >= 4.5, `${mode} ${fg} on ${bg} = ${ratio.toFixed(2)}`);
    }
  }
});

// Ngoại lệ ĐÃ BIẾT của bảng màu Light gốc (giữ nguyên theo yêu cầu). Ngưỡng 3:1 đủ cho icon/chữ lớn,
// chưa đủ AA cho chữ nhỏ: ghi lại để không tệ đi âm thầm và để cân nhắc chỉnh màu sau.
test('known Light exceptions stay at least 3:1 (documented, not AA for small text)', () => {
  const known = [['soft', 'bg'], ['soft', 'tabBg'], ['orange', 'bg']];
  for (const [fg, bg] of known) {
    const light = contrastRatio(PALETTES.light[fg], PALETTES.light[bg]);
    assert.ok(light >= 3 && light < 4.5, `light ${fg} on ${bg} = ${light.toFixed(2)}`);
  }
});

test('Dark secondary text also meets AA', () => {
  assert.ok(contrastRatio(PALETTES.dark.soft, PALETTES.dark.bg) >= 4.5);
  assert.ok(contrastRatio(PALETTES.dark.orange, PALETTES.dark.bg) >= 4.5);
});

test('contrastRatio is symmetric and spans 1..21', () => {
  assert.equal(contrastRatio('#000000', '#FFFFFF').toFixed(1), '21.0');
  assert.equal(contrastRatio('#FFFFFF', '#000000').toFixed(1), '21.0');
  assert.equal(contrastRatio('#336699', '#336699').toFixed(1), '1.0');
});

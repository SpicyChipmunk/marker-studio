// Guide name generator: descriptive (reads the palette), varied, tidy.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { app, matching } from './harness.mjs';

const H = app.EVO_HUES, N = app.EVO_NEUTRAL;
const has = (name, words) => words.some((w) => name.includes(w));
const names = (hexes, k = 30) => Array.from({ length: k }, (_, i) => app.evoName(hexes, i * 7919));

test('deterministic for the same palette and seed', () => {
  const h = ['#7a1f2b', '#9b2335'];
  assert.equal(app.evoName(h, 42), app.evoName(h, 42));
});

test('deep reds read as deep reds', () => {
  const out = names(['#7a1f2b', '#9b2335', '#5c1a22', '#a83244']);
  const deep = [...H.red.deep, ...H.red.mid, ...app.EVO_MOOD.deep];
  assert.ok(out.every((n) => has(n, deep) || has(n, app.EVO_VIBE)), out.join(' | '));
  assert.ok(!out.some((n) => has(n, H.red.pale.concat(H.pink.pale))), 'no pale words for deep reds: ' + out.join(' | '));
});

test('two-colour palettes name both families', () => {
  const out = names(['#1f2f5c', '#243a73', '#d4a017', '#c8961e', '#1b2a52']);
  const blue = Object.values(H.blue).flat(), yellow = Object.values(H.yellow).flat();
  assert.ok(out.some((n) => has(n, blue) && has(n, yellow)), out.join(' | '));
});

test('greys get neutral words, never a chromatic colour name', () => {
  const out = names(['#8a8a8a', '#b0b0b0', '#6e6e6e', '#c8c8c8']);
  const neutral = Object.values(N).flat();
  assert.ok(out.every((n) => has(n, neutral)), out.join(' | '));
});

test('soft pastel greens are not mistaken for greys', () => {
  const out = names(['#9fbf9f', '#b8d8c0', '#8fb39a', '#c9e3d1']);
  const green = Object.values(H.green).flat();
  assert.ok(out.filter((n) => has(n, green)).length >= out.length * 0.6, out.join(' | '));
});

test('rainbow palettes get a spectrum word', () => {
  const out = names(['#e63946', '#f4a261', '#e9c46a', '#2a9d8f', '#457b9d', '#7b2cbf', '#ff70a6']);
  assert.ok(out.every((n) => has(n, app.EVO_SPECTRUM)), out.join(' | '));
});

test('names are short, never repeat a word, and vary a lot', () => {
  const C = matching.COLORS; let seed = 7; const rnd = () => (seed = (seed * 1103515245 + 12345) >>> 0) / 4294967296;
  const seen = new Set();
  for (let t = 0; t < 1500; t++) {
    const k = 3 + ((rnd() * 14) | 0), base = (rnd() * C.length) | 0, spread = rnd() < 0.5 ? 12 : C.length;
    const hexes = []; for (let i = 0; i < k; i++) hexes.push(C[(base + ((rnd() * spread) | 0)) % C.length].hex);
    const n = app.evoName(hexes, t);
    assert.ok(n.length <= 24, n);
    const w = n.toLowerCase().split(/[\s&-]+/).filter(Boolean);
    assert.equal(new Set(w).size, w.length, 'repeated word in ' + n);
    seen.add(n);
  }
  assert.ok(seen.size >= 1200, `only ${seen.size} distinct names in 1500`);
});

test('avoids names already in the Library', () => {
  const h = ['#1f8a8a', '#27a0a0', '#ff7f6a', '#f06c58'];
  const first = app.evoName(h, 1);
  const second = app.evoName(h, 1, new Set([first.toLowerCase()]));
  assert.notEqual(second, first);
});

test('paletteName names a palette from its colours and skips names already in the Library', () => {
  const idxs = [0, 37, 74, 111];
  const hexes = app.__eval('[0, 37, 74, 111].map((i) => COLORS[i].hex)');
  app.__eval('state.saved = []');
  const first = app.paletteName(idxs);
  assert.equal(first, app.evoName([...hexes], 0, new Set()));
  assert.doesNotMatch(first, /·|\d/, 'no date: ' + first);
  app.__eval(`state.saved = [{ id: 1, type: 'guide', name: ${JSON.stringify(first.toUpperCase())}, keys: [] }]`);
  assert.equal([...app.usedSavedNames()][0], first.toLowerCase(), 'used names are lower case');
  const second = app.paletteName(idxs);
  assert.notEqual(second.toLowerCase(), first.toLowerCase(), 'a name in use (any case, any type) is not repeated');
  assert.equal(app.paletteName([]), 'Palette', 'no colours: the plain fallback');
  app.__eval('state.saved = []');
});

// (v308: "… (2)", "… (3)" for every name clash — Save a copy, Duplicate, a guide imported again — was "(copy)", "(copy 2)")
test('copyName: "(2)", then the next number, never a name already in the Library, and a copy of a copy counts on', () => {
  app.__eval(`state.saved = [{ id: 1, type: 'guide', name: 'Rose Tango', keys: [] }, { id: 2, type: 'palette', name: 'Rose Tango (2)', keys: [] }]`);
  assert.equal(app.copyName('Rose Tango'), 'Rose Tango (3)', 'any item, any case, counts as taken');
  assert.equal(app.copyName('Rose Tango (3)', new Set(['rose tango', 'rose tango (2)', 'rose tango (3)'])), 'Rose Tango (4)');
  assert.equal(app.copyName('Rose Tango (copy 2)', new Set(['rose tango'])), 'Rose Tango (2)', 'v307’s “(copy)” names count on too');
  assert.equal(app.copyName('Moss', new Set()), 'Moss (2)');
  assert.equal(app.copyName('', new Set()), 'Colouring guide (2)');
  assert.ok(app.copyName('x'.repeat(200), new Set()).length <= 120, 'fits the name limit');
  assert.match(app.copyName('x'.repeat(200), new Set()), / \(2\)$/, 'with its number');
  app.__eval('state.saved = []');
});

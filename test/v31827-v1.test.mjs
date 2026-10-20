// v318.27 (builder V1): Ohuhu's 6 Skin Tones set; 24 Portrait with its Colorless Blender and read off Ohuhu's shop name
// ("Honolulu 24 Skin Tone Colors"); Print's rows drawn Pages, Paper, Labels with PRINT_OPTS as it was. The browser
// tests (e2e/v31827-v1) cover the Print sheet on phones, Home's count, its button and ⋯ › Open a PDF.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createApp } from './harness.mjs';

const app = createApp(),
  E = app.__eval;
const read = (f) => readFileSync(new URL('../' + f, import.meta.url), 'utf8');
const idx = (n) => E(`MARKER_SETS.findIndex((p) => p.n === ${JSON.stringify(n)})`);
const keysOf = (n) => [...E(`presetMkeys(MARKER_SETS[${idx(n)}])`)];
const sets = (text) =>
  JSON.parse(
    E('JSON.stringify(scanSets(' + JSON.stringify(text) + ').map((g) => g.map((i) => MARKER_SETS[i].n)))'),
  );

test('6 Skin Tones: Ohuhu’s six, after 24 Portrait, no blender, a set of 6 everywhere it is counted', () => {
  const i = idx('6 Skin Tones');
  assert.ok(i > 0);
  assert.equal(i, idx('24 Portrait') + 1, 'after 24 Portrait');
  assert.equal(E(`MARKER_SETS[${i}].b`), 'Ohuhu');
  assert.deepEqual(
    keysOf('6 Skin Tones').sort(),
    ['YR00', 'YR05', 'YR06', 'YR312', 'YR55', 'E614'].map((c) => 'Ohuhu|' + c).sort(),
  );
  assert.ok(!keysOf('6 Skin Tones').includes('Ohuhu|0'), 'no Colorless Blender listed');
  assert.equal(E(`presetSize(MARKER_SETS[${i}])`), 6);
  // (Find my set: three of its caps, "Up to 30": it first)
  const r = app.findSets(
    'Ohuhu',
    E("FIND_BUCKETS.findIndex((b) => b.t === 'Up to 30')"),
    ['YR312', 'YR55', 'E614'].map((c) => 'Ohuhu|' + c),
  );
  assert.equal(E(`MARKER_SETS[${r[0].i}].n`), '6 Skin Tones');
  // (the set list: its row with 6)
  E("state.owned = new Set(['Ohuhu|YR00'])");
  assert.match(
    E('presetListHTML()'),
    /<span class="presetnm">6 Skin Tones<\/span><span class="presetn">1\/6<\/span>/,
  );
  // (named wherever the sets are listed)
  const html = read('src/html/dialogs.html');
  for (const t of [read('README.md'), read('docs/TESTERS.md').replace(/\s+/g, ' '), html])
    assert.ok(/24 Portrait and 6 Skin Tones sets/.test(t.replace(/\s+/g, ' ')));
});

test('24 Portrait: its Colorless Blender comes with it (Ohuhu’s and Blick’s pages), its size still 24', () => {
  assert.ok(keysOf('24 Portrait').includes('Ohuhu|0'));
  assert.equal(E(`presetSize(MARKER_SETS[${idx('24 Portrait')}])`), 24);
  assert.ok(!keysOf('Honolulu 24').includes('Ohuhu|0'), 'the Honolulu 24 still none');
});

test('Scan reads Ohuhu’s three skin sets by size, the shop’s "Honolulu 24 Skin Tone Colors" as 24 Portrait', () => {
  assert.deepEqual(sets('Ohuhu Honolulu 24 Skin Tone Colors Dual Tips Alcohol Markers'), [['24 Portrait']]);
  assert.deepEqual(sets('Ohuhu Alcohol Markers 24 Skin Tone Colors Portrait'), [['24 Portrait']]);
  assert.deepEqual(sets('Ohuhu 6 Skin Tones Alcohol Markers'), [['6 Skin Tones']]);
  assert.deepEqual(sets('Ohuhu Alcohol Markers 36 Skin Tone Colors'), [['36 Skin Tones']]);
  // (a code isn't a size: YR06 here)
  assert.deepEqual(sets('Ohuhu skin tones YR06 E614'), []);
  // (not Honolulu 24 any more; the plain Honolulu 24 still is)
  assert.deepEqual(sets('Ohuhu Honolulu 24 Colors'), [['Honolulu 24']]);
});

test('Print: PRINT_OPTS keeps Paper third (printSummary, PAPER_OPTS); the sheet draws Pages, Paper, Labels', () => {
  const src = read('src/js/guide/90-export.js'),
    opts = src.slice(src.indexOf('const PRINT_OPTS = ['), src.indexOf('function printOptVal'));
  assert.deepEqual(
    [...opts.matchAll(/^ {4}'(pwhat|plabels|paper)',$/gm)].map((m) => m[1]),
    ['pwhat', 'plabels', 'paper'],
  );
  assert.match(src, /\[byKey\('pwhat'\), byKey\('paper'\), byKey\('plabels'\)\]\.forEach/);
  // (the close-ups note is in #sfPrWhat, not the foot's summary)
  const sum = src.slice(src.indexOf('function printSummary'), src.indexOf('function printPic'));
  assert.ok(!/printCloseNote/.test(sum));
});

test('Home’s Markers card counts colours, as the guide’s card does; the button says it starts from a photo', () => {
  const chrome = read('src/js/chrome.js');
  // (v318.28: setKeys, Copic's 0 counted as in its set; test/v31828-y1 checks the card's count itself)
  assert.match(chrome, /const n = setKeys\(\[\.\.\.state\.owned\]\)\.length \|\| state\.owned\.size;/);
  assert.match(
    read('src/html/app.html'),
    /<button id="homeNew" class="btn-primary homenew">New guide from a photo<\/button>/,
  );
});

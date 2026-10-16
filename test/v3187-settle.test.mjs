// v318.7 accuracy pass: the photo reader's settling where two looks read one cap differently, readings made up here
// (the reader itself isn't run). Each test fails on v318.6.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from './harness.mjs';

// a photo, one list: lines { t: text, u: unsure, box: [cx, cy, w, h, angle], names: [[text, dy]], alts: [[text, conf,
// turn]], conf }, img { w, h } for a photo with edges → { list, asks (each its answers), titles }
function photo(lines, brand = '', img) {
  const app = createApp();
  app.__eval('scanList = []; ocrAnswered = []; ocrPhotos = 0; scanBrand = ' + JSON.stringify(brand) + ';');
  return JSON.parse(
    app.__eval(
      '(function (L, img) {' +
        'const r = { n: ++ocrPhotos, items: new Map(), taken: new Set(), brands: {}, sure: 0, p: null, done: false,' +
        ' note: "", img: img || null };' +
        'ocrRun = r;' +
        'let id = 0; const lines = [];' +
        'L.forEach((t, k) => {' +
        '  const box = t.box || [200 * (k % 6), 300 * Math.floor(k / 6), 60, 30, 0], me = ++id;' +
        '  lines.push({ id: me, look: 1, text: t.t, conf: t.conf || 0.97, unsure: !!t.u, nameOf: 0, box: box,' +
        '    alts: t.alts || [] });' +
        '  (t.names || []).forEach((n) => lines.push({ id: ++id, look: 1, text: n[0], conf: 0.97, unsure: false,' +
        '    nameOf: me, box: [box[0], box[1] + n[1], 80, 20, 0] }));' +
        '});' +
        'lines.forEach((it) => ocrLine(r, it));' +
        'ocrDone(r, { lines: lines, stat: {}, ms: 1, aborted: false });' +
        'clearTimeout(r.soon);' +
        'return JSON.stringify({ list: scanList.filter((e) => !e.ask).map((e) => mkey(e.i)),' +
        ' asks: scanList.filter((e) => e.ask).map((e) => e.opts.map((o) => mkey(o.i)).join(",")),' +
        ' titles: scanList.filter((e) => e.ask).map((e) => e.ask) });' +
        '})',
    )(lines, img || null),
  );
}
// Ohuhu codes as they are now, enough to make a photo plainly of them (eight), and Copic's
const NOW = ['B015', 'B03', 'B08', 'B09', 'B111', 'B112', 'B114', 'B115'].map((c) => ({ t: c }));
const CNOW = ['B00', 'B01', 'B02', 'B04', 'B05', 'B06', 'B12', 'B14'].map((c) => ({ t: c }));

test('a code read unsure where another was read for sure is that cap misread by one look: left out', () => {
  // (one look's "B000" over the other's sure "R000": Copic B000 had gone in from R000's cap; so G12 over G14, BV25 over
  // RV25, YR0o over YR09, R29 over B29, BV310 over BV210)
  const o = photo(
    CNOW.concat([
      { t: 'R000', box: [613, 855, 64, 28, 11] },
      { t: 'B000', u: true, box: [612, 848, 64, 20, 10] },
    ]),
    'Copic',
  );
  assert.ok(o.list.includes('Copic|R000'), o.list.join(' '));
  assert.ok(!o.list.includes('Copic|B000'), o.list.join(' '));
  assert.deepEqual(o.asks, []);
  // (read half a line's height apart, as one look's slices of a cap are: "R29" 14 below "B29", lines 20 high)
  const p = photo(
    CNOW.concat([
      { t: 'B29', box: [1646, 851, 53, 20, 22] },
      { t: 'R29', u: true, box: [1640, 865, 53, 20, 22] },
    ]),
    'Copic',
  );
  assert.ok(p.list.includes('Copic|B29') && !p.list.includes('Copic|R29'), p.list.join(' '));
  // (elsewhere on the photo, its own cap: still added)
  const q = photo(
    CNOW.concat([
      { t: 'R000', box: [613, 855, 64, 28, 11] },
      { t: 'B000', u: true, box: [900, 848, 64, 20, 10] },
    ]),
    'Copic',
  );
  assert.ok(q.list.includes('Copic|B000'), q.list.join(' '));
  // (its own name read with it: the cap it says, kept)
  const s = photo(
    CNOW.concat([
      { t: 'R000', box: [613, 855, 64, 28, 11] },
      { t: 'B000', u: true, box: [612, 848, 64, 20, 10], names: [['Pale Porcelain Blue', 30]] },
    ]),
    'Copic',
  );
  assert.ok(s.list.includes('Copic|B000'), s.list.join(' '));
  // (a sure reading of digits alone in the same place, "8411" of B411's cap, isn't a code read for sure: B411 stays)
  const b = photo(
    NOW.concat([
      { t: '8411', box: [172, 1721, 65, 19, -14] },
      { t: 'B411', u: true, box: [174, 1728, 65, 31, -14] },
    ]),
  );
  assert.ok(b.list.includes('Ohuhu|B411'), b.list.join(' '));
  assert.deepEqual(b.asks, []);
});

test('a cap cut by the photo’s edge whose whole name was read with its code is kept, plain words or not', () => {
  // ("V015" at the top edge with "Deep Violet", every word of it a plain one, had been left out)
  const img = { w: 1536, h: 2048 },
    cut = (names) => NOW.concat([{ t: 'V015', u: true, box: [451, 13, 69, 26, -9], names }]);
  assert.ok(
    photo(
      cut([
        ['Deep', 20],
        ['Violet', 37],
      ]),
      '',
      img,
    ).list.includes('Ohuhu|V015'),
    'kept',
  );
  // (the other way round too)
  assert.ok(
    photo(
      cut([
        ['Violet', 20],
        ['Deep', 37],
      ]),
      '',
      img,
    ).list.includes('Ohuhu|V015'),
    'kept',
  );
  // (a word of it alone settles nothing, nor no name: as before)
  assert.ok(!photo(cut([['Deep', 20]]), '', img).list.includes('Ohuhu|V015'));
  assert.ok(!photo(cut([]), '', img).list.includes('Ohuhu|V015'));
  assert.ok(
    !photo(
      cut([
        ['Deep', 20],
        ['Violet', 37],
      ]),
      '',
      img,
    ).asks.length,
  );
});

test('a reading read where a word or a code with letters was read is that line misread: not asked about', () => {
  // ("663" read off "Eggnog" had been asked as GG05, "Eg9" off "Egg" as E69)
  const o = photo(
    NOW.concat([
      { t: 'Eggnog', box: [692, 551, 96, 27, -28] },
      { t: '663', box: [715, 536, 46, 32, -10] },
    ]),
  );
  assert.deepEqual(o.asks, []);
  assert.ok(!o.list.includes('Ohuhu|GG05'), o.list.join(' '));
  const p = photo(
    NOW.concat([
      { t: 'Egg', box: [1063, 1089, 48, 36, 29] },
      { t: 'Eg9', box: [1059, 1084, 54, 28, 59] },
    ]),
  );
  assert.deepEqual(p.asks, []);
  // (read elsewhere, asked about as before)
  const q = photo(
    NOW.concat([
      { t: 'Eggnog', box: [692, 551, 96, 27, -28] },
      { t: '663', box: [915, 736, 46, 32, -10] },
    ]),
  );
  assert.deepEqual(q.asks, ['Ohuhu|GG05']);
  assert.deepEqual(
    photo(
      NOW.concat([
        { t: 'Egg', box: [1063, 1089, 48, 36, 29] },
        { t: 'Eg9', box: [1259, 1284, 54, 28, 59] },
      ]),
    ).asks,
    ['Ohuhu|E69'],
  );
  // (digits alone, "804", over "BG04" read unsure: BG04 goes in, B04 isn't asked about)
  const d = photo(
    NOW.concat([
      { t: 'BG04', u: true, box: [697, 2001, 64, 38, 51] },
      { t: '804', u: true, box: [690, 2007, 64, 23, 51] },
    ]),
  );
  assert.ok(d.list.includes('Ohuhu|BG04'), d.list.join(' '));
  assert.deepEqual(d.asks, []);
  // ("829" over "R29", both unsure: B29 or G28 had been asked, turned)
  const t = photo(
    CNOW.concat([
      { t: 'R29', u: true, box: [860, 1528, 80, 45, -63] },
      { t: '829', u: true, box: [870, 1533, 80, 26, -63] },
    ]),
    'Copic',
  );
  assert.ok(!t.asks.some((a) => a.includes('Copic|G28')), t.asks.join(' | '));
  // (a cap's own name read again by the other look over its code, "Bark" over "914 Bark Brown": still asked about by
  // the name, as before)
  const n = photo(
    NOW.concat([
      {
        t: '914',
        box: [55, 843, 64, 28, 60],
        names: [
          ['Bark', -10],
          ['Brown', -23],
        ],
      },
      { t: 'Bark', box: [81, 836, 58, 45, 37] },
    ]),
  );
  assert.ok(
    n.asks.some((a) => a.includes('Ohuhu|E914')),
    n.asks.join(' | '),
  );
});

test('digits alone by one look, a code with letters by the other read nearly as surely: that code, unsure', () => {
  // ("879" by the flipped look, "G28" by the first: asked about as B79, G28 missed)
  const o = photo(
    CNOW.concat([
      {
        t: '879',
        conf: 0.922,
        alts: [
          ['879', 0.922, 180],
          ['G28', 0.843, 0],
        ],
      },
    ]),
    'Copic',
  );
  assert.ok(o.list.includes('Copic|G28'), o.list.join(' '));
  assert.deepEqual(o.asks, []);
  // (the other look much less sure: asked about as before)
  const p = photo(
    CNOW.concat([
      {
        t: '879',
        conf: 0.922,
        alts: [
          ['879', 0.922, 180],
          ['G28', 0.6, 0],
        ],
      },
    ]),
    'Copic',
  );
  assert.ok(!p.list.includes('Copic|G28'), p.list.join(' '));
  assert.deepEqual(p.asks, ['Copic|B79']);
});

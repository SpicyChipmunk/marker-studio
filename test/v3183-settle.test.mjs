// v318.3 debug: the photo reader's settling, readings made up here (the reader itself isn't run). Each test fails on
// v318.3 as released to review.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from './harness.mjs';

// Ohuhu codes as they are now, enough to make a photo plainly of them (eight); and Copic's
const NOW = ['B015', 'B03', 'B08', 'B09', 'B111', 'B112', 'B114', 'B115'].map((c) => [c]);
const CNOW = ['B00', 'B01', 'B02', 'B04', 'B05', 'B06', 'B12', 'B14'].map((c) => [c]);
// a session of photos, one list: photo(lines) with lines [text, unsure, names [[text, dy]], alts [[text, conf]], conf]
// → { list, asks, titles }
function session(brand = '') {
  const app = createApp();
  app.__eval('scanList = []; ocrAnswered = []; ocrPhotos = 0; scanBrand = ' + JSON.stringify(brand) + ';');
  return {
    app,
    photo(texts) {
      return JSON.parse(
        app.__eval(
          '(function () {' +
            'const r = { n: ++ocrPhotos, items: new Map(), taken: new Set(), brands: {}, sure: 0, p: null, done: false,' +
            ' note: "" };' +
            'ocrRun = r;' +
            'let id = 0; const lines = [];' +
            JSON.stringify(texts) +
            '.forEach((t, k) => {' +
            '  const x = 200 * (k % 6), y = 300 * Math.floor(k / 6), me = ++id;' +
            '  lines.push({ id: me, look: 1, text: t[0], conf: t[4] || 0.97, unsure: !!t[1], nameOf: 0,' +
            '    box: [x, y, 60, 30, 0], alts: t[3] || [] });' +
            '  (t[2] || []).forEach((n) => lines.push({ id: ++id, look: 1, text: n[0], conf: 0.97, unsure: false,' +
            '    nameOf: me, box: [x, y + n[1], 80, 20, 0] }));' +
            '});' +
            'lines.forEach((it) => ocrLine(r, it));' +
            'ocrDone(r, { lines: lines, stat: {}, ms: 1, aborted: false });' +
            'clearTimeout(r.soon);' +
            'return JSON.stringify({ list: scanList.filter((e) => !e.ask).map((e) => mkey(e.i)),' +
            ' asks: scanList.filter((e) => e.ask).map((e) => e.opts.map((o) => mkey(o.i)).join(",")),' +
            ' titles: scanList.filter((e) => e.ask).map((e) => e.title) });' +
            '})()',
        ),
      );
    },
  };
}
const photo = (texts, brand = '') => session(brand).photo(texts);

test('a photo’s one line left to settle is a question in the list, not a muted card: a name alone, another brand’s code', () => {
  // (Ohuhu chosen, every code taken at once: the cap whose name only was read)
  const o = photo(NOW.concat([['Pumpkin Yellow']]), 'Ohuhu');
  assert.ok(o.asks.includes('Ohuhu|Y210'), o.asks.join(' | '));
  // (a Copic cap among a few Ohuhu ones, an unsure line read apart: v318.1 asked about it)
  const p = photo([['B015'], ['B03'], ['RV91'], ['B08', true]], 'Ohuhu');
  assert.ok(p.asks.includes('Copic|RV91'), p.asks.join(' | '));
  assert.ok(p.list.includes('Ohuhu|B08'), p.list.join(' '));
  // (and the other lines all taken at once)
  const q = photo([['B015'], ['B03'], ['RV91']], 'Ohuhu');
  assert.ok(q.asks.includes('Copic|RV91'), q.asks.join(' | '));
});

test('a few Copic caps read with Ohuhu chosen are asked about, not dropped as Ohuhu codes read short (E71 of E711)', () => {
  // (the photo isn't plainly of one brand: v318.1 asked about both)
  const o = photo([['B015'], ['E71'], ['RV91']], 'Ohuhu');
  assert.ok(o.asks.includes('Copic|E71'), o.asks.join(' | '));
  assert.ok(o.asks.includes('Copic|RV91'), o.asks.join(' | '));
  // (on a tray plainly of Ohuhu's, still left out as E711 read short)
  const p = photo(NOW.concat([['E711'], ['E71']]), 'Ohuhu');
  assert.ok(!p.asks.includes('Copic|E71'), p.asks.join(' | '));
});

// what Scan's box makes of a text, as a list of "code asked [options]"
function typed(t, brand = '') {
  return JSON.parse(
    createApp().__eval(
      '(function () { const r = scanRead(' +
        JSON.stringify(t) +
        ', ' +
        JSON.stringify(brand) +
        '); return JSON.stringify((r.codes || []).map((c) => c.code + " " + (c.asked || "-") + " [" +' +
        ' c.opts.map((i) => COLORS[i].code).join(",") + "]")); })()',
    ),
  );
}

test('a grey’s number is its "No.": "C-3 Cool Gray No.5" is asked about, typed or from a photo', () => {
  assert.deepEqual(typed('C-3 Cool Gray No.5', 'Copic'), ['C3 name [C-3,C-5]']);
  assert.deepEqual(typed('W-1 Warm Gray No.3'), ['W1 name [W-1,W-3]']);
  assert.deepEqual(typed('C-0 Cool Gray No.00'), ['C0 name [C-0,C-00]']);
  // (its own, read in any order, still is)
  assert.deepEqual(typed('C-3 No.3 Gray Cool', 'Copic'), ['C3 - [C-3]']);
  assert.deepEqual(typed('C-3 Cool Gray No.3', 'Copic'), ['C3 - [C-3]']);
  const o = photo(CNOW.concat([['C-3', false, [['Cool Gray No.5', 30]]]]), 'Copic');
  assert.ok(!o.list.includes('Copic|C-3'), o.list.join(' '));
  assert.ok(o.asks.includes('Copic|C-3,Copic|C-5'), o.asks.join(' | '));
});

test('a code read with another marker’s whole name offers that marker too ("R29 Crimson": RV29), sure or unsure', () => {
  const o = photo([['R29', false, [['Crimson', 30]]]]);
  assert.ok(!o.list.length, o.list.join(' '));
  assert.ok(
    o.asks.some((a) => a.split(',').includes('Copic|RV29')),
    o.asks.join(' | '),
  );
  // ("V91 Grayish Cherry" unsure, as when it went in at once: V91 or RV91)
  const p = photo(CNOW.concat([['V91', true, [['Grayish Cherry', 30]]]]));
  assert.ok(p.asks.includes('Copic|V91,Copic|RV91'), p.asks.join(' | '));
  // (a word of another's name, none of its own, still asked by the code alone)
  const q = photo(CNOW.concat([['V91', false, [['Cherry', 30]]]]));
  assert.deepEqual(q.asks, ['Copic|V91']);
});

test('a code taken at once and read with a word of another marker’s name is asked about by the photo’s brand only', () => {
  // ("B21 Peacock", Ohuhu chosen: Ohuhu's B21, not Copic's too)
  const o = photo(NOW.concat([['B21', false, [['Peacock', 30]]]]), 'Ohuhu');
  assert.ok(!o.list.includes('Ohuhu|B21'), o.list.join(' '));
  assert.deepEqual(o.asks, ['Ohuhu|B21']);
});

test('on a photo of current codes, a word of the old marker’s name read with its code is asked about ("Y210 Golden")', () => {
  const o = photo(NOW.concat([['Y210', false, [['Golden', 30]]]]));
  assert.ok(!o.list.includes('Ohuhu|Y210') && !o.list.includes('Ohuhu|Y416'), o.list.join(' '));
  assert.ok(o.asks.includes('Ohuhu|Y210,Ohuhu|Y416'), o.asks.join(' | '));
  // (its whole name: Y416; a word of the current one's, or none: Y210, as before)
  assert.ok(photo(NOW.concat([['Y210', false, [['Golden Brown', 30]]]])).list.includes('Ohuhu|Y416'));
  assert.ok(photo(NOW.concat([['Y210', false, [['Pumpkin', 30]]]])).list.includes('Ohuhu|Y210'));
  assert.ok(photo(NOW.concat([['Y210']])).list.includes('Ohuhu|Y210'));
  // (asked as the code and the name not matching, so it stays with Y210 Pumpkin Yellow's own cap beside it)
  const p = photo(
    NOW.concat([
      ['Y210', false, [['Pumpkin Yellow', 30]]],
      ['Y210', false, [['Golden', 30]]],
    ]),
  );
  assert.ok(p.list.includes('Ohuhu|Y210'), p.list.join(' '));
  assert.ok(p.asks.includes('Ohuhu|Y210,Ohuhu|Y416'), p.asks.join(' | '));
});

test('another brand’s code read as it is isn’t swapped for a next reading of the brand chosen (E711 isn’t Copic E71)', () => {
  const alt = (t, a) => [
    t,
    false,
    [],
    [
      [t, 0.95],
      [a, 0.9],
    ],
    0.95,
  ];
  const o = photo(CNOW.concat([alt('E711', 'E71')]), 'Copic');
  assert.ok(!o.list.includes('Copic|E71'), o.list.join(' '));
  assert.ok(o.asks.includes('Ohuhu|E711'), o.asks.join(' | '));
  // (nor a reading that's another code of the brand chosen: Ohuhu's R014 isn't Copic R14)
  const p = photo([['B00'], alt('R014', 'R14')], 'Copic');
  assert.ok(!p.list.includes('Copic|R14'), p.list.join(' '));
  assert.ok(p.asks.includes('Ohuhu|R014'), p.asks.join(' | '));
  // (a next reading that's more of the cap still is: Copic's E51 read off Ohuhu's E515, on a tray of Ohuhu caps)
  assert.ok(photo(NOW.concat([alt('E51', 'E515')])).list.includes('Ohuhu|E515'));
  assert.ok(photo(NOW.concat([alt('E51', 'E515')]), 'Ohuhu').list.includes('Ohuhu|E515'));
});

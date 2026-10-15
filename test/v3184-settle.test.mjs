// v318.4 review: the photo reader's settling with the v318.4 fixes in place, readings made up here (the reader itself
// isn't run). Each test fails on v318.4 as released to review.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from './harness.mjs';

// Ohuhu codes as they are now, enough to make a photo plainly of them (eight)
const NOW = ['B015', 'B03', 'B08', 'B09', 'B111', 'B112', 'B114', 'B115'].map((c) => [c]);
// a photo, one list: lines [text, unsure, names [[text, dy]], alts [[text, conf]], conf, twin] → { list, asks, pics }, pics
// being each question's picture as the text of the line it's cut round (the cutting itself stubbed: no pixels here)
function photo(texts, brand = '') {
  const app = createApp();
  app.__eval(
    'scanList = []; ocrAnswered = []; ocrPhotos = 0; scanBrand = ' +
      JSON.stringify(brand) +
      ';' +
      'ocrCrop = function (img, box) { return box[0] + "," + box[1]; };',
  );
  return JSON.parse(
    app.__eval(
      '(function () {' +
        'const r = { n: ++ocrPhotos, items: new Map(), taken: new Set(), brands: {}, sure: 0, p: null, done: false,' +
        ' note: "", img: { data: {} } };' +
        'ocrRun = r;' +
        'let id = 0; const lines = [];' +
        JSON.stringify(texts) +
        '.forEach((t, k) => {' +
        '  const x = 200 * (k % 6), y = 300 * Math.floor(k / 6), me = ++id;' +
        '  lines.push({ id: me, look: 1, text: t[0], conf: t[4] || 0.97, unsure: !!t[1], nameOf: 0,' +
        '    box: [x, y, 60, 30, 0], alts: t[3] || [] });' +
        '  (t[2] || []).forEach((n) => lines.push({ id: ++id, look: 1, text: n[0], conf: 0.97, unsure: false,' +
        '    nameOf: me, box: [x, y + n[1], 80, 20, 0] }));' +
        // (twin: the same cap read again in the same place by the second look, without its names)
        '  if (t[5]) lines.push({ id: ++id, look: 2, text: t[0], conf: 0.95, unsure: false, nameOf: 0,' +
        '    box: [x + 2, y + 1, 60, 30, 0], alts: [] });' +
        '});' +
        'lines.forEach((it) => ocrLine(r, it));' +
        'ocrDone(r, { lines: lines, stat: {}, ms: 1, aborted: false });' +
        'clearTimeout(r.soon);' +
        'const at = (c) => lines.find((x) => !x.nameOf && x.box[0] + "," + x.box[1] === c);' +
        'return JSON.stringify({ list: scanList.filter((e) => !e.ask).map((e) => mkey(e.i)),' +
        ' asks: scanList.filter((e) => e.ask).map((e) => e.opts.map((o) => mkey(o.i)).join(",")),' +
        ' pics: scanList.filter((e) => e.ask).map((e) => (e.crop && at(e.crop) ? at(e.crop).id : 0)) });' +
        '})()',
    ),
  );
}

test('a question’s picture is the cap asked about, not one read the same that went in for sure', () => {
  // ("YR11 Orange" asked, YR11 Peachy Blush's own cap read before it and added: the picture had been that one's)
  const o = photo(
    NOW.concat([
      ['YR11', false, [['Peachy Blush', 30]]],
      ['YR11', false, [['Orange', 30]]],
    ]),
  );
  assert.ok(o.list.includes('Ohuhu|YR11'), o.list.join(' '));
  assert.deepEqual(o.asks, ['Ohuhu|YR11,Ohuhu|YR112']);
  // (lines 1 to 8 the tray, 9 YR11 with its name, 11 the one asked about)
  assert.deepEqual(o.pics, [11]);
  // ("E1T: E11 or E17?", E11's cap read before it)
  const p = photo([['E11'], ['E1T']], 'Copic');
  assert.deepEqual(p.asks, ['Copic|E11,Copic|E17']);
  assert.deepEqual(p.pics, [2]);
  // (the code and the name not matching: the line whose names don't, though neither went in at once. "R29 Lipstick Red",
  // lines 1 and 2, added at the end; "R29 Crimson", 3 and 4, asked)
  const s = photo(
    [
      ['R29', true, [['Lipstick Red', 30]]],
      ['R29', true, [['Crimson', 30]]],
    ],
    'Copic',
  );
  assert.ok(s.list.includes('Copic|R29'), s.list.join(' '));
  assert.deepEqual(s.asks, ['Copic|R29,Copic|RV29']);
  assert.deepEqual(s.pics, [3]);
  // (a reading asked about as Scan reads it, "p3" as P3, has its picture: there had been none)
  const q = photo(NOW.concat([['p3', true]]));
  assert.deepEqual(q.asks, ['Ohuhu|V18']);
  assert.deepEqual(q.pics, [9]);
});

test('a code taken at once under the brand chosen and asked about once the photo shows the other brand stays asked', () => {
  // (Copic chosen, "B21 Peacock" read first, then a tray plainly of Ohuhu caps: Ohuhu's B21 had been missed)
  const o = photo([['B21', false, [['Peacock', 30]]]].concat(NOW), 'Copic');
  assert.ok(!o.list.includes('Copic|B21') && !o.list.includes('Ohuhu|B21'), o.list.join(' '));
  assert.deepEqual(o.asks, ['Ohuhu|B21']);
  assert.equal(o.list.length, 8);
});

test('on a photo of current codes, a word of the old marker’s name read with its code unsure is asked about too', () => {
  // ("Y210 Golden" unsure had gone in as Y416 Golden Brown, by its old code, though asked about when read for sure)
  const o = photo(NOW.concat([['Y210', true, [['Golden', 30]]]]));
  assert.ok(!o.list.includes('Ohuhu|Y416') && !o.list.includes('Ohuhu|Y210'), o.list.join(' '));
  assert.ok(o.asks.includes('Ohuhu|Y210,Ohuhu|Y416'), o.asks.join(' | '));
  // (its old marker's whole name still settles it, unsure as sure)
  assert.ok(photo(NOW.concat([['Y210', true, [['Golden Brown', 30]]]])).list.includes('Ohuhu|Y416'));
});

test('a code taken at once whose name read makes it another brand’s marker of that code is asked about, not kept', () => {
  // ("RV29 Crimson", Copic's cap, with Ohuhu chosen: Ohuhu's RV29 is Plum Pink. Typed, it's said to be Copic's)
  const o = photo([['B015'], ['RV29', false, [['Crimson', 30]]], ['B03']], 'Ohuhu');
  assert.ok(!o.list.includes('Ohuhu|RV29'), o.list.join(' '));
  assert.ok(o.asks.includes('Copic|RV29'), o.asks.join(' | '));
  assert.ok(o.list.includes('Ohuhu|B015') && o.list.includes('Ohuhu|B03'), o.list.join(' '));
  // (read unsure, the same: it had been asked as Ohuhu's RV29 alone, an answer that's not the cap)
  assert.deepEqual(photo([['RV29', true, [['Crimson', 30]]]], 'Ohuhu').asks, ['Copic|RV29']);
  // (Ohuhu's own name, or none: Ohuhu's RV29, as before)
  assert.ok(photo([['RV29', false, [['Plum Pink', 30]]]], 'Ohuhu').list.includes('Ohuhu|RV29'));
  assert.ok(photo([['RV29']], 'Ohuhu').list.includes('Ohuhu|RV29'));
});

test('a cap read twice in one place, its names beside one reading only, is asked about as when it’s read once', () => {
  // (the second look's reading of the same cap had kept what the first's names asked about: added unasked)
  const twin = (t, names) => [t, false, [[names, 30]], [], 0.97, true];
  const o = photo(NOW.concat([twin('B21', 'Peacock')]), 'Ohuhu');
  assert.ok(!o.list.includes('Ohuhu|B21'), o.list.join(' '));
  assert.deepEqual(o.asks, ['Ohuhu|B21']);
  const p = photo([twin('C-3', 'Cool Gray No.5')], 'Copic');
  assert.ok(!p.list.includes('Copic|C-3'), p.list.join(' '));
  assert.deepEqual(p.asks, ['Copic|C-3,Copic|C-5']);
  const q = photo([twin('RV29', 'Crimson')], 'Ohuhu');
  assert.ok(!q.list.includes('Ohuhu|RV29'), q.list.join(' '));
  assert.deepEqual(q.asks, ['Copic|RV29']);
  // (its own name: added, once)
  assert.deepEqual(photo([twin('RV29', 'Plum Pink')], 'Ohuhu').list, ['Ohuhu|RV29']);
  assert.deepEqual(photo([twin('C-3', 'Cool Gray No.3')], 'Copic').list, ['Copic|C-3']);
});

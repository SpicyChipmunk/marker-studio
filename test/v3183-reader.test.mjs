// v318.3: the photo reader finds more without guessing. Readings made up here (the reader itself isn't run): a code's
// line whose best reading holds no code takes its next reading that does, read nearly as surely ("61" → E19); a word of
// a cap's name misread by one letter chooses between the code's own markers only ("Y210 Yelliow" is Y210 Pumpkin
// Yellow, not Y416 that was Y210). Fails on v318.2.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from './harness.mjs';

const NOW = ['B015', 'B03', 'B08', 'B09', 'B111', 'B112', 'B114', 'B115'];
// a photo's lines: [text, unsure, names [[text, dy]], alts [[text, conf]]] → { list, asks }
function photo(texts, conf = 0.97) {
  const app = createApp();
  return JSON.parse(
    app.__eval(
      '(function () {' +
        'scanList = []; scanBrand = ""; ocrPhotos = 1;' +
        'const r = { n: 1, items: new Map(), taken: new Set(), brands: {}, sure: 0, p: null, done: false, note: "" };' +
        'ocrRun = r;' +
        'let id = 0; const lines = [];' +
        JSON.stringify(texts) +
        '.forEach((t, k) => {' +
        '  const x = 200 * (k % 6), y = 300 * Math.floor(k / 6), me = ++id;' +
        '  lines.push({ id: me, look: 1, text: t[0], conf: ' +
        conf +
        ', unsure: !!t[1], nameOf: 0, box: [x, y, 60, 30, 0],' +
        '    alts: t[3] || [] });' +
        '  (t[2] || []).forEach((n) => lines.push({ id: ++id, look: 1, text: n[0], conf: 0.97, unsure: false, nameOf: me,' +
        '    box: [x, y + n[1], 80, 20, 0] }));' +
        '});' +
        'lines.forEach((it) => ocrLine(r, it));' +
        'ocrDone(r, { lines: lines, stat: {}, ms: 1, aborted: false });' +
        'clearTimeout(r.soon);' +
        'return JSON.stringify({ list: scanList.filter((e) => !e.ask).map((e) => mkey(e.i)),' +
        ' asks: scanList.filter((e) => e.ask).map((e) => e.opts.map((o) => mkey(o.i)).join(",")) });' +
        '})()',
    ),
  );
}
const now = NOW.map((c) => [c]);

test('a line read as no code takes its next reading that is one, read nearly as surely ("61" → E19)', () => {
  const o = photo(
    now.concat([
      [
        '61',
        false,
        [],
        [
          ['61', 0.9],
          ['E19', 0.86],
        ],
      ],
    ]),
    0.9,
  );
  assert.ok(o.list.includes('Ohuhu|E19'), o.list.join(' '));
  // (not one read much less surely, nor below 0.75)
  const p = photo(
    now.concat([
      [
        '61',
        false,
        [],
        [
          ['61', 0.9],
          ['E19', 0.7],
        ],
      ],
    ]),
    0.9,
  );
  assert.ok(!p.list.includes('Ohuhu|E19'), p.list.join(' '));
  // (nor in place of a reading that holds a code)
  const q = photo(
    now.concat([
      [
        'E17',
        false,
        [],
        [
          ['E17', 0.9],
          ['E19', 0.89],
        ],
      ],
    ]),
    0.9,
  );
  assert.ok(q.list.includes('Ohuhu|E17') && !q.list.includes('Ohuhu|E19'), q.list.join(' '));
});

test('a cap’s name misread by a letter chooses between the code’s own markers: "Y210 Yelliow" is Y210, not asked', () => {
  // (fewer than eight codes: no generation, so only the name can settle it)
  const o = photo([['B015'], ['Y210', false, [['Yelliow', 30]]]]);
  assert.ok(o.list.includes('Ohuhu|Y210'), o.list.join(' '));
  assert.deepEqual(o.asks, []);
  // (two letters off: asked, as before)
  const p = photo([['B015'], ['Y210', false, [['Yeliiow', 30]]]]);
  assert.deepEqual(p.asks, ['Ohuhu|Y210,Ohuhu|Y416']);
  // (typed, as before)
  const app = createApp();
  assert.match(
    app.__eval('JSON.stringify(scanRead("Y210 Yelliow", "Ohuhu").codes.map((c) => c.asked))'),
    /old/,
  );
});

test('a cap whose name was read but not its code is asked about by its whole name, never added unasked', () => {
  // (a name of two words, alone on its line: no code read anywhere near it)
  const o = photo(now.concat([['Silver Cloud']]));
  assert.ok(!o.list.includes('Ohuhu|GG03'), 'not added unasked');
  assert.deepEqual(o.asks, ['Ohuhu|GG03']);
  // (a code line read as no code, with the cap's name below it)
  const p = photo(now.concat([['Q3l', false, [['Silver Cloud', 30]]]]));
  assert.deepEqual(p.asks, ['Ohuhu|GG03'], JSON.stringify(p));
  // (not one word of five letters, nor a word of other names: "Frost", "Grey")
  assert.deepEqual(photo(now.concat([['Frost'], ['Grey']])).asks, []);
  // (nor a marker already in the list)
  assert.deepEqual(photo(now.concat([['Celadon Blue']])).asks, []);
});

// v318: the photo reader's lines into Scan's list, without the reader itself (its readings made up here): a code for
// sure into the list as it's read, once the photo's brand is plain; a code two brands share, and the first few before
// the brand's plain, settled at the end by the photo's brand; another brand's code read short (BG11 beside BG114), or
// unsure, left out; every code the photo added marked with it, for Undo this photo. Fails on v317.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from './harness.mjs';

// (through JSON: arrays from the app's own realm)
function run(brand, texts) {
  const app = createApp();
  return JSON.parse(
    app.__eval(
      '(function () {' +
        'scanList = []; scanBrand = ' +
        JSON.stringify(brand) +
        ';' +
        'const r = { n: 1, items: new Map(), taken: new Set(), brands: {}, sure: 0, p: null, done: false, note: "" };' +
        'ocrRun = r;' +
        'const lines = ' +
        JSON.stringify(texts) +
        '.map((t, k) => ({ id: k + 1, look: 1, text: t[0], conf: 0.9, unsure: !!t[1], nameOf: t[2] || 0, box: [0, 0, 1, 1, 0] }));' +
        'const keys = () => scanList.filter((e) => !e.ask).map((e) => mkey(e.i));' +
        'lines.forEach((it) => ocrLine(r, it));' +
        'const streamed = keys();' +
        'ocrDone(r, { lines: lines, stat: {}, ms: 1, aborted: false });' +
        'clearTimeout(r.soon);' +
        'return JSON.stringify({ streamed: streamed, list: keys(), asks: scanList.filter((e) => e.ask).length,' +
        ' photo: scanList.every((e) => e.photo === 1), added: r.added, brand: r.brand, scanBrand: scanBrand });' +
        '})()',
    ),
  );
}

test('a tray of one brand: its plain codes as they come, the rest settled by its brand at the end', () => {
  const o = run('', [
    // (Ohuhu's own codes: the first four before five show the brand)
    ['B015'],
    ['B03'],
    ['B08'],
    ['B09'],
    ['B111'],
    ['B112'],
    ['B114'],
    ['B115'],
    ['B27'],
    ['B310'],
    // (a code both brands have, and its name on the cap)
    ['B02'],
    ['Light', false, 11],
    // (Copic's BG11, the start of Ohuhu's BG114 read in the same photo: a cap read short; two of Copic's to eleven of
    // Ohuhu's, plainly an Ohuhu tray)
    ['BG11'],
    ['BG114'],
    // (read unsure: another brand's code)
    ['B41', true],
    // (a lone word with no digit)
    ['Green'],
  ]);
  assert.deepEqual(
    o.streamed,
    ['Ohuhu|BG114', 'Ohuhu|B310', 'Ohuhu|B27', 'Ohuhu|B115', 'Ohuhu|B114', 'Ohuhu|B112', 'Ohuhu|B111'],
    'into the list as read, the newest first',
  );
  assert.deepEqual([...o.list].sort(), [
    'Ohuhu|B015',
    'Ohuhu|B02',
    'Ohuhu|B03',
    'Ohuhu|B08',
    'Ohuhu|B09',
    'Ohuhu|B111',
    'Ohuhu|B112',
    'Ohuhu|B114',
    'Ohuhu|B115',
    'Ohuhu|B27',
    'Ohuhu|B310',
    'Ohuhu|BG114',
  ]);
  assert.equal(o.asks, 0, 'nothing asked about');
  assert.ok(o.photo, 'each marked with its photo');
  assert.equal(o.added, 12);
  assert.equal(o.brand, 'Ohuhu');
  assert.equal(o.scanBrand, '', 'the brand above the box as it was');
});

test('a brand chosen above the box: its codes as they come, two brands’ codes too', () => {
  const o = run('Copic', [['B02'], ['BG11'], ['E01']]);
  assert.deepEqual([...o.streamed].sort(), ['Copic|B02', 'Copic|BG11', 'Copic|E01']);
  assert.deepEqual([...o.list].sort(), ['Copic|B02', 'Copic|BG11', 'Copic|E01']);
  assert.equal(o.scanBrand, 'Copic');
});

test('a mixed photo, no brand plain: a code both brands have is asked about, not guessed', () => {
  const o = run('', [['B015'], ['B02'], ['BG11']]);
  assert.deepEqual(o.streamed, [], 'none for sure while the brand isn’t plain');
  assert.deepEqual([...o.list].sort(), ['Copic|BG11', 'Ohuhu|B015']);
  assert.equal(o.asks, 1, 'B02: which brand');
  assert.equal(o.brand, '');
});

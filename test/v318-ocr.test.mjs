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
        '.map((t, k) => ({ id: k + 1, look: 1, text: t[0], conf: 0.9, unsure: !!t[1], nameOf: t[2] || 0, box: t[3] || [0, 0, 1, 1, 0] }));' +
        'const keys = () => scanList.filter((e) => !e.ask).map((e) => mkey(e.i));' +
        'lines.forEach((it) => ocrLine(r, it));' +
        'const streamed = keys();' +
        'ocrDone(r, { lines: lines, stat: {}, ms: 1, aborted: false });' +
        'clearTimeout(r.soon);' +
        'return JSON.stringify({ streamed: streamed, list: keys(), asks: scanList.filter((e) => e.ask).length,' +
        ' photo: scanList.every((e) => e.photo === 1), added: r.added, brand: r.brand, scanBrand: scanBrand,' +
        ' titles: scanList.filter((e) => e.ask).map((e) => e.title + " " + e.opts.map((o) => mkey(o.i)).join(",")) });' +
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

// (fresh-eyes review, v318) Ohuhu's own codes, enough to make the photo plainly Ohuhu's
const OH = ['B015', 'B03', 'B08', 'B09', 'B111', 'B112', 'B114', 'B115'].map((c, k) => [
  c,
  false,
  0,
  [k * 100, 900, 60, 30, 0],
]);

test('a code both brands have now is the photo’s brand’s, never left out as read short (E81 beside E814)', () => {
  const o = run(
    '',
    OH.concat([
      ['E81', false, 0, [100, 100, 60, 30, 0]],
      ['E814', false, 0, [400, 100, 70, 30, 0]],
    ]),
  );
  assert.ok(o.list.includes('Ohuhu|E81'), 'E81 kept: ' + o.list.join(' '));
  assert.ok(o.list.includes('Ohuhu|E814'));
  assert.equal(o.asks, 0);
});

test('another brand’s code that’s the end of one of the photo’s (Y13 beside BGY13), or offered only by its name, isn’t asked about', () => {
  const o = run(
    '',
    OH.concat([
      ['BGY13', false, 0, [100, 100, 80, 30, 0]],
      // (the same cap's code read short, with its name)
      ['Y13', false, 0, [600, 100, 50, 30, 0]],
      ['Seagull Grey', false, 11, [600, 130, 80, 20, 0]],
      // (a code read as nothing, its name another brand's marker's: Copic R32 Peach)
      ['R47', false, 0, [100, 500, 50, 30, 0]],
      ['Peach', false, 13, [100, 530, 60, 20, 0]],
    ]),
  );
  assert.ok(o.list.includes('Ohuhu|BGY13'));
  assert.equal(o.asks, 0, o.titles.join(' | '));
});

test('a scrap read as a lone 0 isn’t the blender; the blender with its name is', () => {
  const a = run('Copic', [['0,3,5', true, 0, [100, 100, 80, 20, 90]]]);
  assert.deepEqual(a.list, [], 'a seam read "0,3,5": nothing');
  const b = run('Copic', [
    ['0', false, 0, [100, 100, 30, 30, 0]],
    ['Colorless Blender', false, 1, [100, 130, 90, 20, 0]],
  ]);
  assert.deepEqual(b.list, ['Copic|0']);
});

test('the same cap read twice, once with its name: one line, settled by the name; a scrap of a code read elsewhere isn’t asked about', () => {
  // (R23 is Ohuhu's Sakura now, and was R38's code: its name says which)
  const o = run(
    '',
    OH.concat([
      ['R23', false, 0, [300, 300, 70, 40, 18]],
      ['R23', false, 0, [302, 301, 76, 43, 21]],
      ['Sakura', false, 10, [290, 330, 80, 30, 20]],
      // (R15, Lychee Juice, read whole; a scrap read "RT5" elsewhere is R15 too, or RV19 that was R15)
      ['R15', false, 0, [700, 300, 70, 40, 0]],
      ['Lychee Juice', false, 12, [700, 330, 90, 25, 0]],
      ['RT5', false, 0, [1000, 600, 60, 25, 0]],
    ]),
  );
  assert.ok(o.list.includes('Ohuhu|R23'), o.list.join(' '));
  assert.ok(o.list.includes('Ohuhu|R15'));
  assert.equal(o.asks, 0, o.titles.join(' | '));
});

test('a question an earlier photo raised goes once a later photo has put every answer in the list', () => {
  const app = createApp();
  const o = JSON.parse(
    app.__eval(
      '(function () {' +
        'scanList = []; scanBrand = "";' +
        'const photo = (n, texts) => {' +
        '  const r = { n: n, items: new Map(), taken: new Set(), brands: {}, sure: 0, p: null, done: false, note: "" };' +
        '  ocrRun = r;' +
        '  const lines = texts.map((t, k) => ({ id: k + 1, look: 1, text: t[0], conf: 0.99, unsure: false, nameOf: t[1] || 0,' +
        '    box: [k * 100, 0, 60, 30, 0] }));' +
        '  lines.forEach((it) => ocrLine(r, it));' +
        '  ocrDone(r, { lines: lines, stat: {}, ms: 1, aborted: false });' +
        '  clearTimeout(r.soon);' +
        '  return r;' +
        '};' +
        'const oh = ["B015", "B03", "B08", "B09", "B111", "B112"].map((c) => [c]);' +
        // (R23 with no name: Sakura now, or the old R23 that's R38, Rose Pink)
        'const r1 = photo(1, oh.concat([["R23"]]));' +
        'const asked = scanList.filter((e) => e.ask).map((e) => e.title);' +
        'const r2 = photo(2, oh.concat([["R23"], ["Sakura", 7], ["R38"], ["Rose Pink", 9]]));' +
        'return JSON.stringify({ asked: asked, r1: r1.asked, left: scanList.filter((e) => e.ask).length, r2: r2.asked,' +
        ' list: scanList.filter((e) => !e.ask).map((e) => mkey(e.i)) });' +
        '})()',
    ),
  );
  assert.deepEqual(o.asked, ['Which R23?']);
  assert.equal(o.r1, 1);
  assert.ok(o.list.includes('Ohuhu|R23') && o.list.includes('Ohuhu|R38'), o.list.join(' '));
  assert.equal(o.left, 0, 'answered: gone');
  assert.equal(o.r2, 0);
});

test('read again after running out of memory: the first try’s lines don’t keep the second’s out (both number from 1)', () => {
  const app = createApp();
  const o = JSON.parse(
    app.__eval(
      '(function () {' +
        'scanList = []; scanBrand = "";' +
        'const r = { n: 1, items: new Map(), taken: new Set(), brands: {}, sure: 0, p: null, done: false, note: "" };' +
        'ocrRun = r; ocrPhotos = 1;' +
        'const mk = (texts) => texts.map((t, k) => ({ id: k + 1, look: 1, text: t, conf: 0.99, unsure: false, nameOf: 0,' +
        '  box: [k * 100, 0, 60, 30, 0] }));' +
        'const oh = ["B015", "B03", "B08", "B09", "B111", "B112", "B114", "B115"];' +
        'mk(oh).forEach((it) => ocrLine(r, it));' +
        'const first = r.taken.size;' +
        'ocrFailed({ message: "Aborted()", memory: true });' +
        // (the second try: line 6, taken at once by the first, a code both brands have, settled at the end by the
        // photo's brand)
        'const two = mk(oh.slice(0, 5).concat(["E81"], oh.slice(5)));' +
        'two.forEach((it) => ocrLine(r, it));' +
        'ocrDone(r, { lines: two, stat: {}, ms: 1, aborted: false });' +
        'clearTimeout(r.soon);' +
        'return JSON.stringify({ first: first, gentle: !!r.gentle, list: scanList.filter((e) => !e.ask).map((e) => mkey(e.i)) });' +
        '})()',
    ),
  );
  assert.ok(o.first >= 3, 'the first try took some at once: ' + o.first);
  assert.ok(o.gentle);
  assert.ok(o.list.includes('Ohuhu|E81'), o.list.join(' '));
  assert.equal(o.list.length, 9);
});

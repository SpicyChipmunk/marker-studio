// The photo reader’s readings and settling.
// (v320) Tests organised by feature: each block below came from the file named above it, its tests unchanged.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from './harness.mjs';
import { readFileSync } from 'node:fs';

// ---- from v318-ocr.test.mjs ----
// v318: the photo reader's lines into Scan's list, without the reader itself (its readings made up here): a code for
// sure into the list as it's read, once the photo's brand is plain; a code two brands share, and the first few before
// the brand's plain, settled at the end by the photo's brand; another brand's code read short (BG11 beside BG114), or
// unsure, left out; every code the photo added marked with it, for Undo this photo. Fails on v317.
{
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
  // (fresh-eyes review, v318) Ohuhu's own codes, enough to make the photo plainly Ohuhu's
  const OH = ['B015', 'B03', 'B08', 'B09', 'B111', 'B112', 'B114', 'B115'].map((c, k) => [
    c,
    false,
    0,
    [k * 100, 900, 60, 30, 0],
  ]);
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
}

// ---- from v3181-gentle.test.mjs ----
// v318.1: read gently (after running out of memory, for a fortnight, or after the app closed mid-read) is the photo at
// 1600 px with the detector in four strips, not 1280 px: in Safari's engine the peak was the same within the noise,
// and 1280 px added wrong codes. Fails on v318.
{
  // (a localStorage of its own: the harness's is a stub)
  function store() {
    const m = new Map();
    return {
      getItem: (k) => (m.has(k) ? m.get(k) : null),
      setItem: (k, v) => m.set(k, String(v)),
      removeItem: (k) => m.delete(k),
    };
  }
  async function sent(setup) {
    const app = createApp({ localStorage: store() });
    const p = app.__eval(
      '(async function () {' +
        setup +
        'let got = null;' +
        'ocrW = { postMessage: (m) => (got = m), terminate() {} };' +
        'ocrReady = Promise.resolve(ocrW);' +
        'const r = { n: 1, items: new Map(), taken: new Set(), brands: {}, sure: 0, p: null, done: false, note: "",' +
        '  img: { w: 4, h: 4, data: { data: new Uint8ClampedArray(64) } } };' +
        'ocrRun = r;' +
        'await ocrGo(r);' +
        'return JSON.stringify({ maxSide: got.o.maxSide, detTiles: got.o.detTiles });' +
        '})()',
    );
    return JSON.parse(await p);
  }
  test('read gently: 1600 px in four strips, not 1280 px', async () => {
    const normal = await sent(
      'localStorage.removeItem("ms-ocr-low"); localStorage.removeItem("ms-ocr-busy");',
    );
    assert.deepEqual(normal, { maxSide: 1600, detTiles: 1 }, 'a desktop, as before');
    const low = await sent('localStorage.setItem("ms-ocr-low", String(Date.now()));');
    assert.deepEqual(low, { maxSide: 1600, detTiles: 4 });
    const busy = await sent(
      'localStorage.removeItem("ms-ocr-low"); localStorage.setItem("ms-ocr-busy", "1");',
    );
    assert.deepEqual(busy, { maxSide: 1600, detTiles: 4 });
  });
}

// ---- from v3181-parts.test.mjs ----
// v318.1: a part of a cap read as a code of its own. On the page: a code inside a longer one read in the same place
// ("V91" of RV91, "Y00" of BGY00) is left out, and taken back out of the list when it went in at once;
// a code read for sure whose names are another marker's ("V91" with Grayish Cherry, RV91's) is asked about. In the
// engine: a box read whole as one of its halves reads ("GY00", its halves "GY00" and "Y00") keeps no other half.
// Each fails before v318.1.
{
  // (as in v318-ocr: each line through ocrLine as it comes, then ocrDone; readings made up here)
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
          '.map((t, k) => ({ id: k + 1, look: t[4] || 1, text: t[0], conf: 0.97, unsure: !!t[1], nameOf: t[2] || 0, box: t[3] || [0, 0, 1, 1, 0] }));' +
          'const keys = () => scanList.filter((e) => !e.ask).map((e) => mkey(e.i));' +
          'lines.forEach((it) => ocrLine(r, it));' +
          'const streamed = keys();' +
          'ocrDone(r, { lines: lines, stat: {}, ms: 1, aborted: false });' +
          'clearTimeout(r.soon);' +
          'return JSON.stringify({ streamed: streamed, list: keys(), added: r.added,' +
          ' photo: scanList.every((e) => e.photo === 1),' +
          ' titles: scanList.filter((e) => e.ask).map((e) => e.title + " " + e.opts.map((o) => mkey(o.i)).join(",")) });' +
          '})()',
      ),
    );
  }
  // (a tray plainly Copic's: codes only Copic has)
  const CO = ['R46', 'BV00', 'E74', 'YG63', 'W-3', 'C-5', 'G85'].map((c, k) => [
    c,
    false,
    0,
    [k * 100, 900, 60, 30, 0],
  ]);
  // --- the engine, with made-up models: a detector that finds one tall box, a recogniser that reads what it's told
  const ENGINE = readFileSync(new URL('../src/js/ocr/engine.js', import.meta.url), 'utf8');
  const DICT = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
  function fakeOrt(reads) {
    let k = 0;
    class Tensor {
      constructor(type, data, dims) {
        this.type = type;
        this.data = data;
        this.dims = dims;
      }
    }
    const det = {
      inputNames: ['x'],
      outputNames: ['y'],
      run: async (feeds) => {
        const [, , H, W] = feeds.x.dims,
          n = feeds.x.dims[0],
          p = new Float32Array(n * H * W);
        // (a block of text 120 × 50 in the middle of each map)
        for (let b = 0; b < n; b++)
          for (let y = (H >> 1) - 25; y < (H >> 1) + 25; y++)
            for (let x = (W >> 1) - 60; x < (W >> 1) + 60; x++)
              if (x >= 0 && y >= 0 && x < W && y < H) p[b * H * W + y * W + x] = 1;
        return { y: { data: p, dims: [n, 1, H, W] } };
      },
    };
    const rec = {
      inputNames: ['x'],
      outputNames: ['y'],
      run: async () => {
        const [text, conf] = reads[k++] || ['', 0],
          C = DICT.length + 2,
          T = 2 * text.length + 2,
          p = new Float32Array(T * C);
        for (let t = 0; t < T; t++) p[t * C] = 1;
        [...text].forEach((ch, i) => {
          const o = (2 * i + 1) * C;
          p[o] = 0;
          p[o + DICT.indexOf(ch) + 1] = conf;
        });
        return { y: { data: p, dims: [1, T, C] } };
      },
    };
    let s = 0;
    return {
      Tensor,
      InferenceSession: { create: async () => [det, rec][s++] },
    };
  }
  async function readTall(halfBox) {
    const OCR2 = new Function(ENGINE + '\nreturn OCR2;')();
    // (the whole box read unsure as GY00, again turned over as nothing; its halves GY00 and Y00)
    const ort = fakeOrt([
      ['GY00', 0.85],
      ['', 0],
      ['GY00', 0.83],
      ['Y00', 0.77],
    ]);
    const reader = await OCR2.create(ort, new Uint8Array(1), new Uint8Array(1), DICT.join('\n'), null);
    const img = { width: 320, height: 320, data: new Uint8ClampedArray(320 * 320 * 4).fill(200) },
      told = [];
    const r = await reader.read(
      img,
      { maxSide: 320, split: 2.5, retry: true, halfBox: halfBox },
      { line: (it) => told.push(it.best.text) },
    );
    return { lines: r.lines.map((it) => it.best.text), told: told };
  }
  test('a code inside a longer one read in the same place is that cap read short: left out, and out of the list again', () => {
    const o = run(
      '',
      CO.concat([
        ['RV91', false, 0, [300, 300, 90, 34, 10]],
        // (the second look's box over the same cap, its first letter lost)
        ['V91', false, 0, [312, 302, 64, 32, 12], 2],
      ]),
    );
    // (v318.12: a code that's a longer one's tail, V91 of RV91, no longer goes in at once: it waits for the end, read
    // again for its lost first letter, ocrWidenWait)
    assert.ok(!o.streamed.includes('Copic|V91'), 'it waited');
    assert.ok(o.list.includes('Copic|RV91'));
    assert.ok(!o.list.includes('Copic|V91'), o.list.join(' '));
    assert.equal(o.added, o.list.length);
  });
  test('the same short code on a cap of its own, or with its own name, stays', () => {
    const o = run(
      '',
      CO.concat([
        ['RV91', false, 0, [300, 300, 90, 34, 10]],
        // (elsewhere on the photo: another cap)
        ['V91', false, 0, [800, 600, 64, 32, 0]],
      ]),
    );
    assert.ok(o.list.includes('Copic|V91') && o.list.includes('Copic|RV91'), o.list.join(' '));
    const n = run(
      '',
      CO.concat([
        ['RV91', false, 0, [300, 300, 90, 34, 10]],
        ['V91', false, 0, [312, 302, 64, 32, 12]],
        ['Pale Grape', false, CO.length + 2, [312, 330, 90, 20, 12]],
      ]),
    );
    assert.ok(n.list.includes('Copic|V91'), 'its own name read with it: ' + n.list.join(' '));
  });
  test('a short scrap read as an old code (Ohuhu G3, now G311) inside a longer code (G316) isn’t that marker', () => {
    const OH = ['B015', 'B03', 'B08', 'B09', 'B111', 'B112'].map((c, k) => [
      c,
      false,
      0,
      [k * 100, 900, 60, 30, 0],
    ]);
    const o = run(
      '',
      OH.concat([
        ['G316', false, 0, [400, 400, 90, 34, 0], 2],
        ['G3', false, 0, [392, 401, 70, 33, 0]],
      ]),
    );
    assert.ok(o.list.includes('Ohuhu|G316'));
    assert.ok(!o.list.includes('Ohuhu|G311'), o.list.join(' '));
  });
  test('a code read for sure with another marker’s name is asked about, not kept as read', () => {
    const o = run(
      '',
      CO.concat([
        ['V91', false, 0, [246, 15, 85, 47, 30]],
        ['Grayish Cherry', false, CO.length + 1, [250, 50, 110, 22, 30]],
      ]),
    );
    assert.ok(!o.streamed.includes('Copic|V91'), 'it waited (v318.12)');
    assert.ok(!o.list.includes('Copic|V91') && !o.list.includes('Copic|RV91'), o.list.join(' '));
    assert.equal(o.titles.length, 1, o.titles.join(' | '));
    assert.match(o.titles[0], /don’t match.*Copic\|V91.*Copic\|RV91|don’t match.*Copic\|RV91.*Copic\|V91/);
    assert.ok(o.photo, 'the question is the photo’s, for Undo this photo');
    // (its own name: kept)
    const b = run(
      '',
      CO.concat([
        ['V91', false, 0, [246, 15, 85, 47, 30]],
        ['Pale Grape', false, CO.length + 1, [250, 50, 110, 22, 30]],
      ]),
    );
    assert.ok(b.list.includes('Copic|V91'));
    assert.equal(b.titles.length, 0);
  });
  test('engine: a box read whole as one of its halves keeps no other half (GY00 / Y00), told to the page or not', async () => {
    const off = await readTall(false);
    assert.ok(off.lines.includes('Y00'), 'without the rule, as before: ' + off.lines.join(' '));
    const on = await readTall(true);
    assert.ok(!on.lines.includes('Y00'), on.lines.join(' '));
    assert.ok(!on.told.includes('Y00'), 'nor streamed to the page as it was read');
    assert.ok(on.lines.includes('GY00'));
  });
}

// ---- from v3182-reader.test.mjs ----
// v318.2: the photo reader adds no marker it can't stand behind. Readings made up here (the reader itself isn't run):
// digits alone aren't bent into a lettered code ("99" isn't G9, G112's old code; "808" is asked about); a reading with
// letters that isn't the code as printed is asked about ("W60g"); a photo plainly of the codes as they are now asks
// about a code that's only an old one ("GG1" of GG15; v318.2 dropped it) unless its name is read, and takes a code
// that's current over another's
// old one (Y210, not "Which Y210?"); a cap's names in either order (R22 "Pink Ballet") and "R22 Pink" aren't RV17
// Pink; a code read with another marker's name is asked about; noise questions go; "Yellowish" isn't Copic's Yellow.
// Typed and pasted codes as before. Fails on v318.1.
{
  // Ohuhu codes as they are now, enough to make a photo plainly of them (eight)
  const NOW = ['B015', 'B03', 'B08', 'B09', 'B111', 'B112', 'B114', 'B115'];
  // a photo's lines: [text, unsure, names (lines below the code), box] → { list, asks, titles }
  function photo(texts, brand = '') {
    const app = createApp();
    return JSON.parse(
      app.__eval(
        '(function () {' +
          'scanList = []; scanBrand = ' +
          JSON.stringify(brand) +
          '; ocrPhotos = 1;' +
          'const r = { n: 1, items: new Map(), taken: new Set(), brands: {}, sure: 0, p: null, done: false, note: "" };' +
          'ocrRun = r;' +
          'let id = 0; const lines = [];' +
          JSON.stringify(texts) +
          '.forEach((t, k) => {' +
          '  const x = 200 * (k % 6), y = 300 * Math.floor(k / 6), me = ++id;' +
          '  lines.push({ id: me, look: 1, text: t[0], conf: 0.97, unsure: !!t[1], nameOf: 0, box: [x, y, 60, 30, 0] });' +
          '  (t[2] || []).forEach((n, j) => lines.push({ id: ++id, look: 1, text: n[0], conf: 0.97, unsure: false, nameOf: me,' +
          '    box: [x, y + n[1], 80, 20, 0] }));' +
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
  }
  const now = NOW.map((c) => [c]);
  // typed: what Scan's box makes of a text, as a list of "code asked [options]"
  function typed(t, brand = '') {
    const app = createApp();
    return JSON.parse(
      app.__eval(
        '(function () { const r = scanRead(' +
          JSON.stringify(t) +
          ', ' +
          JSON.stringify(brand) +
          '); return JSON.stringify((r.codes || []).map((c) => c.code + " " + (c.asked || "-") + " [" + c.opts.map((i) => COLORS[i].code).join(",") + "]")); })()',
      ),
    );
  }
  test('digits alone from a photo: two are no code ("99" isn’t G112), three or more are asked about ("808": B08?)', () => {
    const o = photo(now.concat([['99']]));
    assert.ok(!o.list.includes('Ohuhu|G112'), o.list.join(' '));
    assert.deepEqual(o.asks, []);
    const p = photo([['B015'], ['808'], ['99']]);
    assert.ok(!p.list.includes('Ohuhu|G112') && !p.list.includes('Ohuhu|B08'), p.list.join(' '));
    assert.deepEqual(p.asks, ['Ohuhu|B08']);
    assert.match(p.titles[0], /“808” read: is it this one\?/);
    // (typed, as before: Scan's box puts misreads right)
    assert.deepEqual(typed('99', 'Ohuhu'), ['G9 - [G112]']);
    assert.deepEqual(typed('808', 'Ohuhu'), ['B08 - [B08]']);
  });
  test('a reading with letters that isn’t the code as printed is asked about, not added ("W60g": WG06?); as printed, at once', () => {
    const o = photo(now.concat([['W60g'], ['WG01'], ['YRO6']]));
    assert.ok(!o.list.includes('Ohuhu|WG06'), o.list.join(' '));
    assert.ok(o.asks.includes('Ohuhu|WG06'), o.asks.join(' | '));
    assert.ok(o.list.includes('Ohuhu|WG01'), 'the code as printed');
    assert.ok(o.list.includes('Ohuhu|YR06'), 'O for 0 is as printed');
    assert.deepEqual(typed('W60g', 'Ohuhu'), ['WG06 - [WG06]'], 'typed, as before');
  });
  test('a photo plainly of the codes as they are now: an old code alone is asked about, with its own name it’s added; Y210 is Y210', () => {
    const o = photo(now.concat([['GG1'], ['Y210']]));
    assert.ok(!o.list.includes('Ohuhu|GG03'), 'GG1, likely a scrap of GG15, not added: ' + o.list.join(' '));
    assert.ok(o.list.includes('Ohuhu|Y210'), 'not "Which Y210?"');
    // (v318.3: asked, with the cap's picture beside it, rather than left out)
    assert.deepEqual(o.asks, ['Ohuhu|GG03']);
    assert.match(o.titles[0], /“GG1” read: is it this one\?/);
    const n = photo(now.concat([['GG1', false, [['Silver Cloud', 30]]]]));
    assert.ok(n.list.includes('Ohuhu|GG03'), 'by its old code with its name: ' + n.list.join(' '));
    // (fewer than eight codes read: no generation, asked as before)
    const few = photo([['B015'], ['Y210']]);
    assert.deepEqual(few.asks, ['Ohuhu|Y210,Ohuhu|Y416']);
    // (a photo of old codes, several: no generation either, so an older set's caps aren't dropped)
    const older = photo(
      NOW.slice(0, 6)
        .map((c) => [c])
        .concat([['GG1'], ['G9'], ['Y1']]),
    );
    assert.ok(
      older.list.includes('Ohuhu|GG03') || older.asks.some((a) => a.includes('GG03')),
      JSON.stringify(older),
    );
  });
  test('R22 Ballet Pink: its names in either order, or "Pink" alone, aren’t RV17 Pink (R22 by its old code)', () => {
    // (the cap's lines read in reading order: "Ballet" nearer the code than "Pink")
    const o = photo(
      now.concat([
        [
          'R22',
          false,
          [
            ['Pink', 60],
            ['Ballet', 30],
          ],
        ],
      ]),
    );
    assert.ok(o.list.includes('Ohuhu|R22') && !o.list.includes('Ohuhu|RV17'), o.list.join(' '));
    const p = photo(now.concat([['R22', false, [['Pink', 30]]]]));
    assert.ok(!p.list.includes('Ohuhu|RV17'), 'not RV17: ' + p.list.join(' '));
    assert.ok(p.list.includes('Ohuhu|R22'), 'the code as it is now, on a photo of them');
    assert.deepEqual(typed('R22 Pink Ballet', 'Ohuhu'), ['R22 - [R22]']);
    assert.deepEqual(typed('R22 Pink', 'Ohuhu'), ['R22 old [R22,RV17]'], 'typed: asked, not RV17');
    assert.deepEqual(typed('R22 Ballet Pink', 'Ohuhu'), ['R22 - [R22]']);
  });
  test('a code read with a word of another marker’s name and none of its own is asked about', () => {
    const o = photo(now.concat([['B21', false, [['Sakura', 30]]]]));
    assert.ok(!o.list.includes('Ohuhu|B21'), o.list.join(' '));
    // (v318.3 debug: "Sakura" is R23's whole name, so Scan's own question between the code and the name, R23 offered too;
    // a word that's no whole name, "nt Ochre", is asked about by the code alone)
    assert.ok(o.asks.includes('Ohuhu|B21,Ohuhu|R23'), o.asks.join(' | '));
    const p = photo(now.concat([['R38', false, [['nt Ochre', 30]]]]));
    assert.ok(!p.list.includes('Ohuhu|R38'), p.list.join(' '));
    assert.ok(p.asks.includes('Ohuhu|R38'), p.asks.join(' | '));
    assert.match(p.titles.join(' '), /“R38 nt Ochre” read: is it this one\?/);
  });
  test('noise questions go: a name alone that’s a word of other names ("Grey"); another brand’s code that’s part of the photo’s brand’s (Copic BG11 by BG114)', () => {
    const o = photo(now.concat([['Grey'], ['BG11']]));
    assert.deepEqual(o.titles, [], o.titles.join(' | '));
  });
  test('"Yellowish" isn’t Copic Y06 Yellow: YR20 Yellowish Shade read either way round', () => {
    assert.deepEqual(typed('YR20 Shade Yellowish', ''), ['YR20 - [YR20]']);
    assert.deepEqual(typed('YR20 Yellowish', ''), ['YR20 - [YR20]']);
    assert.deepEqual(typed('YG06 Green Yellowish', 'Copic'), ['YG06 - [YG06]']);
    // (Yellow itself still is)
    assert.deepEqual(typed('Y06 Yellow', 'Copic'), ['Y06 - [Y06]']);
  });
}

// ---- from v31821-reader.test.mjs ----
// v318.21, the reader: a code misread by one character is put right by the whole name read beside it ("5110" with
// "Dark Suntan" is E110, YR312's older cap), listed with "read as “5110”"; and a Π read for the grey caps' Ⅱ is that Ⅱ.
// Fails on v318.20.
{
  // a photo's lines: [code, [name lines linked to it], [name lines nearby, not linked]], six caps a row
  function photo(caps) {
    const a = createApp();
    return JSON.parse(
      a.__eval(
        '(function () { scanList = []; scanBrand = ""; ocrPhotos = 1;' +
          'const r = { n: 1, items: new Map(), taken: new Set(), brands: {}, sure: 0, p: null, done: false, note: "" };' +
          'ocrRun = r; let id = 0; const lines = [];' +
          JSON.stringify(caps) +
          '.forEach((t, k) => { const x = 300 * (k % 6), y = 400 * Math.floor(k / 6), me = ++id;' +
          '  lines.push({ id: me, look: 1, text: t[0], conf: 0.97, unsure: false, nameOf: 0, box: [x, y, 60, 30, 0] });' +
          '  (t[1] || []).forEach((n, j) => lines.push({ id: ++id, look: 1, text: n, conf: 0.97, unsure: false, nameOf: me, box: [x, y + 30 + 20 * j, 80, 20, 0] }));' +
          '  (t[2] || []).forEach((n, j) => lines.push({ id: ++id, look: 1, text: n, conf: 0.97, unsure: false, nameOf: 0, box: [x + 10, y + 40 + 20 * j, 80, 20, 0] })); });' +
          'lines.forEach((it) => ocrLine(r, it)); ocrDone(r, { lines: lines, stat: {}, ms: 1, aborted: false }); clearTimeout(r.soon);' +
          'return JSON.stringify({ list: scanList.filter((e) => !e.ask).map((e) => mkey(e.i) + (e.how === "fixed" ? " as " + e.as : "")),' +
          ' asks: scanList.filter((e) => e.ask).map((e) => e.opts.map((o) => mkey(o.i)).join(",")) }); })()',
      ),
    );
  }
  // a tray of older Ohuhu caps read right
  const OLD = ['YR170', 'RP6', 'BR3', 'YR030', 'G420', 'CG050', 'NG03', 'PB1', 'Y7', 'R10', 'YR2', 'R6'].map(
    (c) => [c],
  );
  test('a code misread by one character, with its whole name beside it: that marker, listed, "read as" on its row', () => {
    const p = photo(
      OLD.concat([
        ['5110', ['Dark', 'Suntan']],
        // ("Cocoa Brown" is Copic E74's name too: the code decides, E400 being E97's older cap)
        ['F400', [], ['Cocoa', 'Brown']],
        ['RVO70', ['Sakura Pink']],
      ]),
    );
    for (const k of ['Ohuhu|YR312 as 5110', 'Ohuhu|E97 as F400', 'Ohuhu|RV09 as RVO70'])
      assert.ok(p.list.includes(k), k + ' in ' + JSON.stringify(p));
    assert.ok(!p.list.some((k) => /^Copic\|E74/.test(k)), JSON.stringify(p));
    // (said on its row and kept through a reload of the list: e2e/v31821-reader)
  });
  test('not put right: part of the name, a short reading, a code as read', () => {
    // (one word of the name only)
    const a = photo(OLD.concat([['5110', ['Dark']]]));
    assert.ok(!a.list.some((k) => /YR312/.test(k)), JSON.stringify(a));
    // (two characters: no code is guessed from so little)
    const b = photo(OLD.concat([['00', ['Cocoa Brown']]]));
    assert.ok(!b.list.some((k) => /E97|E74/.test(k)), JSON.stringify(b));
    // (a code as it is is read as itself, E110 YR312's older cap, not put right to another one character away)
    const c = photo(OLD.concat([['E110', ['Sardonyx']]]));
    assert.ok(!c.list.some((k) => / as /.test(k)) && !c.list.includes('Ohuhu|R15'), JSON.stringify(c));
  });
  test('a Π read for the grey caps’ Ⅱ is that Ⅱ', () => {
    const app = createApp();
    const k = (t) =>
      JSON.parse(
        app.__eval(
          'JSON.stringify((scanRead(' +
            JSON.stringify(t) +
            ', "Ohuhu").codes || []).map((c) => c.opts.map(mkey).join(",")))',
        ),
      );
    assert.deepEqual(k('CG∏04'), ['Ohuhu|CG18']);
    assert.deepEqual(k('CGΠ04 Cool Grey II 4'), ['Ohuhu|CG18']);
    assert.deepEqual(k('bgπ03'), ['Ohuhu|B310']);
    assert.equal(app.__eval('scanKey("CG∏04")'), 'CGII04');
  });
}

// ---- from v31822-closer.test.mjs ----
// v318.22 Look closer: a photo read is kept for it (not one read closer already, nor one no bigger than its copy); its
// spots are the lines that didn't settle into a marker; the lines read closer are settled with the photo's own, what
// that adds added under the photo's number, and a marker taken off the list since, or a question the photo had asked,
// left as they are. Fails on v318.21.
{
  const OLD = ['YR170', 'RP6', 'BR3', 'YR030', 'G420', 'CG050', 'NG03', 'PB1', 'Y7', 'R10', 'YR2', 'R6'];
  // a photo read: the tray above and the extra lines given, then `then` run in the app; returns what it returns
  function run(extra, then, img) {
    const a = createApp();
    return JSON.parse(
      a.__eval(
        '(function () { scanList = []; scanBrand = ""; ocrPhotos = 1; ocrCloserList = [];' +
          'const r = { n: 1, file: { name: "x.jpg" }, items: new Map(), taken: new Set(), brands: {}, sure: 0, p: null,' +
          ' done: false, note: "", img: ' +
          JSON.stringify(img || { w: 1536, h: 2048, ow: 3024, oh: 4032 }) +
          ' }; ocrRun = r; let id = 0;' +
          'const lines = ' +
          JSON.stringify(OLD) +
          '.map((t, k) => ({ id: ++id, look: 1, text: t, conf: 0.97, unsure: false, nameOf: 0, box: [100 + 200 * (k % 6), 100 + 300 * Math.floor(k / 6), 60, 30, 0] }));' +
          JSON.stringify(extra) +
          '.forEach((l) => lines.push(Object.assign({ id: ++id, look: 1, conf: 0.6, unsure: true, nameOf: 0 }, l)));' +
          'lines.forEach((it) => ocrLine(r, it)); ocrDone(r, { lines: lines, stat: {}, ms: 1, aborted: false }); clearTimeout(r.soon);' +
          'const p = ocrCloserList[0], k = (e) => e.ask ? "ask " + e.opts.map((o) => mkey(o.i)).join(",") : mkey(e.i) + " #" + e.photo;' +
          'return JSON.stringify((' +
          then +
          ')(p, k)); })()',
      ),
    );
  }
  // the lines read closer: GY5 with its name, where "GYX9" and "Absinme" were read
  const CLOSER =
    '{ lines: [{ id: 901, look: 1, text: "GY5", conf: 0.98, unsure: false, nameOf: 0, box: [700, 1500, 60, 30, 0] },' +
    ' { id: 902, look: 1, text: "Absinthe", conf: 0.98, unsure: false, nameOf: 901, box: [700, 1540, 80, 20, 0] }] }';
  const MISREAD = [
    { text: 'GYX9', box: [700, 1500, 60, 30, 0] },
    { text: 'Absinme', box: [700, 1540, 80, 20, 0] },
  ];
  test('a photo read is kept for Look closer; its spots are the lines that didn’t settle', () => {
    const r = run(
      MISREAD,
      '(p) => ({ kept: !!p, n: p && p.n, spots: p ? ocrCloserSpots(p).map((x) => x.text) : [] })',
    );
    assert.equal(r.kept, true);
    assert.equal(r.n, 1);
    assert.deepEqual(r.spots, ['GYX9', 'Absinme']);
    // (not a photo no bigger than its copy)
    assert.equal(run(MISREAD, '(p) => !!p', { w: 1536, h: 2048, ow: 1536, oh: 2048 }), false);
    // (nor one read closer already, or gently)
    assert.equal(
      run(
        MISREAD,
        '() => { ocrCloserList = []; const im = { w: 1536, h: 2048, ow: 3024, oh: 4032 };' +
          ' ocrCloserKeep({ n: 2, file: {}, detail: true, img: im }, []); ocrCloserKeep({ n: 3, file: {}, low: true, img: im }, []);' +
          ' return ocrCloserList.length; }',
      ),
      0,
    );
  });
  test('what the closer read settles is added under the photo’s number', () => {
    const r = run(MISREAD, '(p, k) => ocrCloserMerge(p, ' + CLOSER + ').map(k)');
    assert.deepEqual(r, ['Ohuhu|YG211 #1']);
  });
  test('a marker taken off the list since, or a question the photo asked, is left as it is', () => {
    // (YG211 listed by the photo, then taken off: not put back)
    const a = run(
      [{ text: 'GY5', conf: 0.98, unsure: false, box: [700, 1500, 60, 30, 0] }],
      '(p, k) => { scanList = scanList.filter((e) => e.ask || mkey(e.i) !== "Ohuhu|YG211"); return ocrCloserMerge(p, ' +
        CLOSER +
        ').map(k); }',
    );
    assert.deepEqual(a, []);
    // (BG期05 asked by the photo, the question taken off: not asked again)
    const b = run(
      [{ text: 'BG期05', conf: 0.98, unsure: false, box: [700, 1500, 60, 30, 0] }],
      '(p, k) => { const q = scanList.filter((e) => e.ask).length; scanList = scanList.filter((e) => !e.ask);' +
        ' return { q: q, again: ocrCloserMerge(p, { lines: [] }).map(k) }; }',
    );
    assert.equal(b.q, 1);
    assert.deepEqual(b.again, []);
  });
}

// ---- from v31822-reader.test.mjs ----
// v318.22, the reader: an older cap's code that's another brand's code now, told by a word of that cap's name ("Y13"
// with "Chestnut" is Ohuhu E515, not Copic Y13); Ohuhu's older grey caps with the Ⅱ misread ("CGé08", "BG期05"); a cap
// whose name alone was read, its first line a word of it ("Colorless" over "Blender"); the name fix taking a name
// misread by a letter, or a code's last digit read as its look-alike letter ("GYS" for GY5). Fails on v318.21.
{
  // a photo's lines: [code, [name lines linked to it], [name lines nearby, not linked]], six caps a row
  function photo(caps) {
    const a = createApp();
    return JSON.parse(
      a.__eval(
        '(function () { scanList = []; scanBrand = ""; ocrPhotos = 1;' +
          'const r = { n: 1, items: new Map(), taken: new Set(), brands: {}, sure: 0, p: null, done: false, note: "" };' +
          'ocrRun = r; let id = 0; const lines = [];' +
          JSON.stringify(caps) +
          '.forEach((t, k) => { const x = 300 * (k % 6), y = 400 * Math.floor(k / 6), me = ++id;' +
          '  lines.push({ id: me, look: 1, text: t[0], conf: 0.97, unsure: false, nameOf: 0, box: [x, y, 60, 30, 0] });' +
          '  (t[1] || []).forEach((n, j) => lines.push({ id: ++id, look: 1, text: n, conf: 0.97, unsure: false, nameOf: me, box: [x, y + 30 + 20 * j, 80, 20, 0] }));' +
          '  (t[2] || []).forEach((n, j) => lines.push({ id: ++id, look: 1, text: n, conf: 0.97, unsure: false, nameOf: 0, box: [x + 10, y + 40 + 20 * j, 80, 20, 0] })); });' +
          'lines.forEach((it) => ocrLine(r, it)); ocrDone(r, { lines: lines, stat: {}, ms: 1, aborted: false }); clearTimeout(r.soon);' +
          'return JSON.stringify({ list: scanList.filter((e) => !e.ask).map((e) => mkey(e.i) + (e.how === "fixed" ? " as " + e.as : "") + (e.cv ? " cv " + e.cv : "")),' +
          ' asks: scanList.filter((e) => e.ask).map((e) => e.opts.map((o) => mkey(o.i)).join(",")) }); })()',
      ),
    );
  }
  // a tray of older Ohuhu caps read right; and one of Copic caps
  const OLD = ['YR170', 'RP6', 'BR3', 'YR030', 'G420', 'CG050', 'NG03', 'PB1', 'Y7', 'R10', 'YR2', 'R6'].map(
    (c) => [c],
  );
  const COP = ['YG03', 'B23', 'E74', 'R85', 'BV04', 'G28', 'C-3', 'W-5', 'E31', 'RV29', 'Y38', 'BG34'].map(
    (c) => [c],
  );
  const has = (p, re) => p.list.some((k) => re.test(k));
  test('an older cap’s code that’s another brand’s code now, with a word of that cap’s name: that cap', () => {
    const a = photo(OLD.concat([['Y13', ['Chestnut']]]));
    assert.ok(a.list.includes('Ohuhu|E515 cv old'), JSON.stringify(a));
    assert.ok(!has(a, /^Copic\|Y13/), JSON.stringify(a));
    const b = photo(OLD.concat([['R11', ['Mauve']]]));
    assert.ok(b.list.includes('Ohuhu|V13 cv old'), JSON.stringify(b));
    // (Copic's own name: not Ohuhu's older cap)
    const c = photo(OLD.concat([['Y13', ['Lemon Yellow']]]));
    assert.ok(!has(c, /E515/) && !c.asks.some((q) => /E515/.test(q)), JSON.stringify(c));
    // (on a tray of Copic caps, Copic's)
    const d = photo(COP.concat([['Y13', ['Chestnut']]]));
    assert.ok(d.list.includes('Copic|Y13') && !has(d, /E515/), JSON.stringify(d));
  });
  test('Ohuhu’s older grey caps with the Ⅱ misread: CG listed, BG with its name, else asked', () => {
    const a = photo(OLD.concat([['CGé08', ['Cool Greyll8']], ['cclo8']]));
    assert.ok(a.list.includes('Ohuhu|BGY25 as CGé08 cv old'), JSON.stringify(a));
    assert.deepEqual(a.asks, [], 'no question about the name alone');
    // (BG05 is a cap now: without its name, asked; with it, listed; never taken for BG05 as read)
    const b = photo(OLD.concat([['BG期05']]));
    assert.deepEqual(b.asks, ['Ohuhu|B411,Ohuhu|BG05'], JSON.stringify(b));
    assert.ok(!has(b, /BG05|B411/), JSON.stringify(b));
    const c = photo(OLD.concat([['BG期05', ['Blue Grey II 5']]]));
    assert.ok(c.list.includes('Ohuhu|B411 as BG期05 cv old') && !has(c, /\|BG05/), JSON.stringify(c));
    assert.deepEqual(c.asks, []);
    // (not a word, not another number in its name, not a Copic tray)
    for (const [caps, why] of [
      [OLD.concat([['Cocoa']]), 'a word'],
      [OLD.concat([['CGé08', ['Cool Grey II 7']]]), 'another number in its name'],
      [COP.concat([['CGé08']]), 'a Copic tray'],
      [OLD.concat([['BGY13']]), 'BGY13'],
    ]) {
      const p = photo(caps);
      assert.ok(!has(p, /BGY25|CG18|BGY24|B310/), why + ': ' + JSON.stringify(p));
    }
  });
  test('a cap whose name alone was read, its first line a word of the name: asked by its name', () => {
    const p = photo(OLD.concat([['Colorless', ['Blender']]]));
    assert.ok(p.asks.includes('Ohuhu|0'), JSON.stringify(p));
  });
  test('the name fix: a code’s last digit read as a letter; a name misread by a letter or without its plain words', () => {
    const a = photo(OLD.concat([['GYS', ['Absinthe']]]));
    assert.ok(a.list.includes('Ohuhu|YG211 as GYS cv old'), JSON.stringify(a));
    const b = photo(OLD.concat([['F400', ['Cocoa']]]));
    assert.ok(b.list.includes('Ohuhu|E97 as F400 cv old'), JSON.stringify(b));
    const c = photo(OLD.concat([['5110', ['Dark', 'Suntam']]]));
    assert.ok(c.list.includes('Ohuhu|YR312 as 5110 cv old'), JSON.stringify(c));
    // (never a two-character code by these: "RI" with Coral Pink is left to Scan's own reading)
    const d = photo(OLD.concat([['RI', ['Coral Pink']]]));
    assert.ok(!d.list.some((k) => / as RI/.test(k)), JSON.stringify(d));
  });
}

// ---- from v3183-reader.test.mjs ----
// v318.3: the photo reader finds more without guessing. Readings made up here (the reader itself isn't run): a code's
// line whose best reading holds no code takes its next reading that does, read nearly as surely ("61" → E19); a word of
// a cap's name misread by one letter chooses between the code's own markers only ("Y210 Yelliow" is Y210 Pumpkin
// Yellow, not Y416 that was Y210). Fails on v318.2.
{
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
}

// ---- from v3183-settle.test.mjs ----
// v318.3 debug: the photo reader's settling, readings made up here (the reader itself isn't run). Each test fails on
// v318.3 as released to review.
{
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
}

// ---- from v3184-settle.test.mjs ----
// v318.4 review: the photo reader's settling with the v318.4 fixes in place, readings made up here (the reader itself
// isn't run). Each test fails on v318.4 as released to review.
{
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
  // (v318.6 debug) another brand's cap read whole, its name with its code, on a tray plainly of one brand had gone without
  // a word as that brand's code read short (v318.2's noise rule, meant for scraps): Copic's BG11 as BG114's start, Y13 as
  // BGY13's end, E71 as E711's start. A cap whose name alone was read was asked about; one read whole was dropped.
  test('another brand’s cap read with its name on a tray plainly of one brand is asked about, not dropped as a code read short', () => {
    for (const brand of ['', 'Ohuhu', 'Copic']) {
      for (const [code, name, unsure] of [
        ['BG11', 'Moon White', false],
        ['Y13', 'Lemon Yellow', false],
        ['E71', 'Champagne', false],
        ['E71', 'Champagne', true],
      ]) {
        const o = photo(NOW.concat([[code, unsure, [[name, 30]]]]), brand);
        assert.deepEqual(
          o.asks,
          ['Copic|' + code],
          brand + ' ' + code + ' ' + name + ': ' + o.asks.join(' | '),
        );
        assert.ok(!o.list.some((k) => /Copic/.test(k)), 'asked, not added: ' + o.list.join(' '));
        // (with its picture, the cap's own line: 9, after the tray's eight)
        assert.deepEqual(o.pics, [9]);
      }
      // (beside the Ohuhu cap whose code it starts, the same: both are there)
      const p = photo(NOW.concat([['E711'], ['E71', false, [['Champagne', 30]]]]), brand);
      assert.deepEqual(p.asks, ['Copic|E71'], brand + ': ' + p.asks.join(' | '));
      assert.ok(p.list.includes('Ohuhu|E711'), p.list.join(' '));
      // (the code alone, or with the Ohuhu cap's name, a scrap of it: still left out, as before)
      assert.deepEqual(photo(NOW.concat([['E71']]), brand).asks, []);
      assert.deepEqual(photo(NOW.concat([['E71', false, [['Old Mahogany', 30]]]]), brand).asks, []);
    }
  });
}

// ---- from v3187-failed.test.mjs ----
// v318.7: a photo whose reading failed (out of memory, read again gently; or given up) takes back out what it added at
// once, as closing Scan mid-photo does: its end never checked those (a cap cut by the photo's edge, one look's
// misreading, the photo's brand). Readings made up here (the reader itself isn't run). Fails on v318.6.
{
  // a photo's first lines read, then the reader fails: { before, after, also } (the list's keys; also: a marker typed
  // before the photo, kept)
  function failed(memory) {
    const app = createApp();
    return JSON.parse(
      app.__eval(
        '(function () {' +
          'scanList = []; scanBrand = "Ohuhu"; ocrPhotos = 1;' +
          'scanHandleCodes("R014");' +
          'const r = { n: 1, items: new Map(), taken: new Set(), brands: {}, sure: 0, p: null, done: false, note: "" };' +
          'ocrRun = r; ocrGo = function () {};' +
          '["B015", "B03", "808"].forEach((t, k) => ocrLine(r, { id: k + 1, look: 1, text: t, conf: 0.98, unsure: false,' +
          '  nameOf: 0, box: [100 + 200 * k, 100, 60, 30, 0] }));' +
          'const before = scanList.map((e) => (e.ask ? "?" : mkey(e.i)));' +
          'ocrFailed({ memory: ' +
          (memory ? 'true' : 'false') +
          ' });' +
          'return JSON.stringify({ before: before, after: scanList.map((e) => (e.ask ? "?" : mkey(e.i))),' +
          ' bent: (r.bent || []).length, gentle: !!r.gentle, done: !!r.done });' +
          '})()',
      ),
    );
  }
  test('out of memory: the first try’s adds come out before the photo is read again gently', () => {
    const o = failed(true);
    assert.ok(o.before.includes('Ohuhu|B015'), 'added at once while read: ' + o.before.join(' '));
    assert.deepEqual(o.after, ['Ohuhu|R014'], 'only what was there before the photo');
    assert.equal(o.bent, 0, 'its digits to ask about ("808") let go of too');
    assert.equal(o.gentle, true);
  });
  test('the reader given up: the photo’s adds come out, what was there before stays', () => {
    const o = failed(false);
    assert.ok(o.before.includes('Ohuhu|B03'), o.before.join(' '));
    assert.deepEqual(o.after, ['Ohuhu|R014']);
    assert.equal(o.done, true);
  });
}

// ---- from v3187-settle.test.mjs ----
// v318.7 accuracy pass: the photo reader's settling where two looks read one cap differently, readings made up here
// (the reader itself isn't run). Each test fails on v318.6.
{
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
}

// ---- from v3189-detail.test.mjs ----
// v318.9: a photo whose codes are small in it (a whole bag, a tray from afar, a Copic case) is read again closer. The
// engine, told detailCheck, says so after its first detection with nothing read (detail: true, stat.detail.lineH); the
// page then decodes the photo up to 4096 px and reads it with the detector at 3200 in 16 strips. Not when read gently,
// nor for a photo no bigger than 2560 px. A closer read that never finished reads gently for a fortnight; a memory
// failure in it reads the 2048 copy again. And a sure code paired before reading as a taller box's name is swapped back
// for a free pair too, not only a zoomed box's lines ("Jade Green" over G311). Each fails on v318.8.
{
  // --- the engine, with made-up models (as in v3181-parts): a detector that finds the blocks it's given, a recogniser
  // that reads what it's told
  const ENGINE = readFileSync(new URL('../src/js/ocr/engine.js', import.meta.url), 'utf8');
  const DICT = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
  function fakeOrt(blocks, reads) {
    const seen = { rec: 0 };
    class Tensor {
      constructor(type, data, dims) {
        this.type = type;
        this.data = data;
        this.dims = dims;
      }
    }
    const det = {
      inputNames: ['x'],
      outputNames: ['y'],
      run: async (feeds) => {
        const [n, , H, W] = feeds.x.dims,
          p = new Float32Array(n * H * W);
        // (each block [cx, cy, w, h] in the map's own pixels)
        for (let b = 0; b < n; b++)
          blocks.forEach(([cx, cy, w, h]) => {
            for (let y = Math.round(cy - h / 2); y < cy + h / 2; y++)
              for (let x = Math.round(cx - w / 2); x < cx + w / 2; x++)
                if (x >= 0 && y >= 0 && x < W && y < H) p[b * H * W + y * W + x] = 1;
          });
        return { y: { data: p, dims: [n, 1, H, W] } };
      },
    };
    const rec = {
      inputNames: ['x'],
      outputNames: ['y'],
      run: async () => {
        const [text, conf] = reads[seen.rec++] || ['', 0],
          C = DICT.length + 2,
          T = 2 * text.length + 2,
          p = new Float32Array(T * C);
        for (let t = 0; t < T; t++) p[t * C] = 1;
        [...text].forEach((ch, i) => {
          const o = (2 * i + 1) * C;
          p[o] = 0;
          p[o + DICT.indexOf(ch) + 1] = conf;
        });
        return { y: { data: p, dims: [1, T, C] } };
      },
    };
    let s = 0;
    return { seen, Tensor, InferenceSession: { create: async () => [det, rec][s++] } };
  }
  async function engineRead(blocks, reads, o, abort) {
    const OCR2 = new Function(ENGINE + '\nreturn OCR2;')();
    const ort = fakeOrt(blocks, reads);
    const reader = await OCR2.create(ort, new Uint8Array(1), new Uint8Array(1), DICT.join('\n'), null);
    const img = { width: 320, height: 320, data: new Uint8ClampedArray(320 * 320 * 4).fill(200) },
      told = [],
      ctl = new AbortController();
    if (abort) ctl.abort();
    const r = await reader.read(img, Object.assign({ maxSide: 320, signal: ctl.signal }, o), {
      line: (it) => told.push(it.best.text),
    });
    return { r: r, told: told, recs: ort.seen.rec };
  }
  // --- the page, with a worker of its own: what each read is sent with
  function store(init) {
    const m = new Map(Object.entries(init || {}));
    return {
      getItem: (k) => (m.has(k) ? m.get(k) : null),
      setItem: (k, v) => m.set(k, String(v)),
      removeItem: (k) => m.delete(k),
      _m: m,
    };
  }
  // (r a photo of ow × oh px, its 2048 copy in hand; ocrPhoto made up: the size it would decode to, no pixels of anyone's)
  const PAGE =
    'const posts = [], decoded = [];' +
    'const fake = () => ({ postMessage: (m) => { if (m.t === "read") posts.push(m); }, terminate() {} });' +
    'ocrW = fake();' +
    'ocrReady = Promise.resolve(ocrW);' +
    'ocrStart = async () => { if (!ocrW) { ocrW = fake(); ocrReady = Promise.resolve(ocrW); } return ocrW; };' +
    'ocrPhoto = async (f, cap) => { decoded.push(cap || 2048); const s = Math.min(1, (cap || 2048) / 4032);' +
    '  const w = Math.round(4032 * s), h = Math.round(3024 * s);' +
    '  return { w: w, h: h, data: { data: new Uint8ClampedArray(16) }, show: null, ow: 4032, oh: 3024 }; };' +
    'const photo = (ow, oh) => ({ n: 1, items: new Map(), taken: new Set(), brands: {}, sure: 0, p: null, done: false,' +
    '  note: "", file: {}, img: { w: Math.round(ow * Math.min(1, 2048 / ow)), h: Math.round(oh * Math.min(1, 2048 / ow)),' +
    '  data: { data: new Uint8ClampedArray(16) }, ow: ow, oh: oh } });' +
    'const opts = (m) => ({ w: m.img.width, maxSide: m.o.maxSide, detTiles: m.o.detTiles, detailCheck: m.o.detailCheck || 0 });' +
    // (the harness's timers don't run: microtasks only)
    'const wait = async () => { for (let i = 0; i < 100; i++) await null; };';
  async function page(storage, body) {
    const ls = store(storage);
    const app = createApp({ localStorage: ls });
    const out = JSON.parse(await app.__eval('(async function () {' + PAGE + body + '})()'));
    return Object.assign(out, { store: Object.fromEntries(ls._m) });
  }
  test('engine: codes small for detailCheck: nothing read, told so with the line height; else read as before', async () => {
    const one = [[160, 160, 120, 30]];
    const small = await engineRead(one, [['R014', 0.99]], { detailCheck: 200 });
    assert.equal(small.r.detail, true);
    assert.equal(small.r.lines.length, 0);
    assert.ok(small.r.stat.detail && small.r.stat.detail.lineH > 20, JSON.stringify(small.r.stat.detail));
    assert.equal(small.recs, 0, 'nothing read');
    assert.deepEqual(small.told, [], 'nothing told the page');
    const large = await engineRead(one, [['R014', 0.99]], { detailCheck: 10 });
    assert.ok(!large.r.detail);
    assert.deepEqual(
      large.r.lines.map((it) => it.best.text),
      ['R014'],
    );
    const none = await engineRead(one, [['R014', 0.99]], {});
    assert.ok(!none.r.detail && !none.r.stat.detail, 'no detailCheck: as before');
    const stopped = await engineRead(one, [['R014', 0.99]], { detailCheck: 200 }, true);
    assert.ok(stopped.r.aborted && !stopped.r.detail, 'stopped before: stopped, not read closer');
  });
  test('engine: a sure code paired as the name of a taller box above it is the code, not the name (Jade Green over G311)', async () => {
    // (a two-word name's box, taller than the code's under it: paired before reading, the code as its name)
    const blocks = [
      [160, 100, 120, 40],
      [160, 175, 90, 20],
    ];
    const r = await engineRead(
      blocks,
      [
        ['JADEGREEN', 0.97],
        ['G311', 0.99],
      ],
      {},
    );
    const code = r.r.lines.find((it) => it.best && it.best.text === 'G311');
    assert.ok(code, r.r.lines.map((it) => it.best && it.best.text).join(' '));
    assert.ok(!code.nameOf, 'G311 is a line of its own, not a name');
    assert.ok(r.told.includes('G311'), 'and told to the page as a code');
    // (two codes one above the other: neither made the other's name and swapped)
    const two = await engineRead(
      blocks,
      [
        ['R014', 0.99],
        ['G311', 0.99],
      ],
      {},
    );
    const top = two.r.lines.find((it) => it.best && it.best.text === 'R014');
    assert.ok(top && !top.nameOf, 'the taller code stays the code');
  });
  test('page: a photo bigger than 2560 px is asked about its codes; not a smaller one, nor one read gently', async () => {
    const o = await page(
      {},
      'const a = photo(4032, 3024); ocrRun = a; await ocrGo(a);' +
        'const b = photo(2400, 1800); ocrRun = b; await ocrGo(b);' +
        'localStorage.setItem("ms-ocr-low", String(Date.now()));' +
        'const c = photo(4032, 3024); ocrRun = c; await ocrGo(c);' +
        'return JSON.stringify({ posts: posts.map(opts) });',
    );
    assert.deepEqual(o.posts[0], { w: 2048, maxSide: 1600, detTiles: 1, detailCheck: 25 });
    assert.equal(o.posts[1].detailCheck, 0, 'no bigger than 2560 px: read as before');
    assert.deepEqual(
      o.posts[2],
      { w: 2048, maxSide: 1600, detTiles: 4, detailCheck: 0 },
      'read gently: as before',
    );
  });
  test('page: told the codes are small, the photo is decoded at 4096 and read at 3200 in 16 strips, the photo not ended', async () => {
    const o = await page(
      {},
      'const r = photo(4032, 3024); ocrRun = r; await ocrGo(r);' +
        'const busy0 = localStorage.getItem("ms-ocr-busy");' +
        'ocrMessage({ data: { t: "done", detail: true, lines: [], stat: { detail: { lineH: 20 } }, ms: 1, aborted: false } });' +
        'await wait();' +
        'return JSON.stringify({ posts: posts.map(opts), decoded: decoded, done: r.done, busy0: busy0,' +
        ' busy: localStorage.getItem("ms-ocr-busy"), detail: r.detail, w: r.img.w, h: r.img.h });',
    );
    assert.equal(o.posts.length, 2);
    assert.deepEqual(o.posts[1], { w: 4032, maxSide: 3200, detTiles: 16, detailCheck: 0 });
    assert.deepEqual(o.decoded, [4096]);
    assert.equal(o.done, false, 'the photo goes on: not ended, nothing settled');
    assert.equal(o.busy0, '1');
    assert.equal(o.busy, '2', 'the closer read marked as under way');
    assert.deepEqual([o.w, o.h], [4032, 3024], "the photo's size is the larger copy's");
  });
  test('page: Stop tapped before the closer read: stopped, nothing more sent', async () => {
    const o = await page(
      {},
      'const r = photo(4032, 3024); ocrRun = r; await ocrGo(r);' +
        'r.stop = true;' +
        'ocrMessage({ data: { t: "done", detail: true, lines: [], stat: { detail: { lineH: 20 } }, ms: 1, aborted: false } });' +
        'await wait();' +
        'clearTimeout(r.soon);' +
        'return JSON.stringify({ n: posts.length, done: r.done, aborted: r.aborted });',
    );
    assert.equal(o.n, 1);
    assert.equal(o.done, true);
    assert.equal(o.aborted, true);
  });
  test('page: out of memory in the closer read: the 2048 copy read again gently, not the larger one', async () => {
    const o = await page(
      {},
      'const r = photo(4032, 3024); ocrRun = r; await ocrGo(r);' +
        'ocrMessage({ data: { t: "done", detail: true, lines: [], stat: { detail: { lineH: 20 } }, ms: 1, aborted: false } });' +
        'await wait();' +
        'ocrFailed({ message: "Aborted()", memory: true });' +
        'await wait();' +
        'return JSON.stringify({ posts: posts.map(opts), decoded: decoded, w: r.img.w, detail: !!r.detail, done: r.done });',
    );
    assert.equal(o.posts.length, 3);
    assert.deepEqual(o.posts[2], { w: 2048, maxSide: 1600, detTiles: 4, detailCheck: 0 });
    assert.deepEqual(o.decoded, [4096, 2048]);
    assert.equal(o.w, 2048);
    assert.equal(o.detail, false);
    assert.equal(o.done, false);
    assert.ok(o.store['ms-ocr-low'], 'gently for a fortnight, as after any memory failure');
  });
  test('page: a closer read that never finished: gently for a fortnight, said; an ordinary one: this photo only', async () => {
    const closer = await page(
      { 'ms-ocr-busy': '2' },
      'const r = photo(4032, 3024); ocrRun = r; await ocrGo(r);' +
        'return JSON.stringify({ posts: posts.map(opts), note: r.note });',
    );
    assert.deepEqual(closer.posts[0], { w: 2048, maxSide: 1600, detTiles: 4, detailCheck: 0 });
    assert.ok(closer.store['ms-ocr-low'], 'gently for a fortnight');
    assert.match(closer.note, /didn’t finish/);
    const plain = await page(
      { 'ms-ocr-busy': '1' },
      'const r = photo(4032, 3024); ocrRun = r; await ocrGo(r);' +
        'return JSON.stringify({ posts: posts.map(opts) });',
    );
    assert.equal(plain.posts[0].detTiles, 4, 'the next photo gently, as before');
    assert.equal(plain.posts[0].detailCheck, 0);
    assert.ok(!plain.store['ms-ocr-low'], 'not for a fortnight');
  });
}

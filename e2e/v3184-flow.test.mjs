// v318.4 e2e: what driving Photograph your caps end to end with the real reader, on synthetic trays, found; each test
// fails on v318.4 as released to review. The reader's lines are made up here, as it read the trays (nothing of
// anyone's), except the last test's, a drawn tray of both brands read by the real reader.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, openApp, idle } from './helpers.mjs';

before(setup);
after(teardown);

// Ohuhu codes as they are now, eight, enough for a photo plainly of them (as test/v3183-settle's), read in its middle
const NOW = ['B015', 'B03', 'B08', 'B09', 'B111', 'B112', 'B114', 'B115'];
// a photo W×H read: lines [text, box, names [[text, box]]] (a box [cx, cy, w, h, angle]); `done` false leaves it being
// read. → { list, asks: [{ k, opts, crop }] }
function photo(page, { brand = '', W = 2048, H = 1536, lines, done = true, n = 1 }) {
  return page.evaluate(
    ([brand, W, H, lines, done, n]) => {
      const cv = document.createElement('canvas');
      cv.width = W;
      cv.height = H;
      const g = cv.getContext('2d');
      g.fillStyle = '#ccc';
      g.fillRect(0, 0, W, H);
      if (n === 1) {
        scanList = [];
        ocrAnswered = [];
      }
      scanBrand = brand;
      const r = {
        n: n,
        items: new Map(),
        taken: new Set(),
        brands: {},
        sure: 0,
        p: null,
        done: false,
        note: '',
      };
      r.img = { w: W, h: H, data: g.getImageData(0, 0, W, H) };
      ocrRun = r;
      let id = 0;
      const all = [];
      lines.forEach(([t, box, names]) => {
        const me = ++id;
        all.push({
          id: me,
          look: 1,
          text: t,
          conf: 0.98,
          unsure: false,
          nameOf: 0,
          box: box,
          alts: [[t, 0.98, 0]],
        });
        (names || []).forEach(([nt, nb]) =>
          all.push({ id: ++id, look: 1, text: nt, conf: 0.97, unsure: false, nameOf: me, box: nb }),
        );
      });
      all.forEach((it) => ocrLine(r, it));
      if (done) ocrDone(r, { lines: all, stat: {}, ms: 1, aborted: false });
      clearTimeout(r.soon);
      return {
        list: scanList.filter((e) => !e.ask).map((e) => mkey(e.i)),
        asks: scanList
          .filter((e) => e.ask)
          .map((e) => ({ k: e.ask, opts: e.opts.map((o) => mkey(o.i)), crop: !!e.crop })),
      };
    },
    [brand, W, H, lines, done, n],
  );
}
// the eight codes in a row across the middle
const middle = NOW.map((t, k) => [t, [200 + k * 200, 760, 110, 44, 0]]);

test('a cap cut by the photo’s edge, its code read short, isn’t added nor asked about; a whole code at the edge, or in the middle, is', async () => {
  const { page, errors } = await openApp({ width: 820, height: 1180 });
  // ("/R312" of YR312, its Y under the bottom edge: had gone in at once as R312; "G1" with "Dusty", G113 cut there,
  // asked about as G312 that was G1)
  const o = await photo(page, {
    lines: middle.concat([
      ['/R312', [1328, 1509, 127, 54, -14]],
      ['G1', [912, 1507, 64, 43, -87], [['Dusty', [874, 1505, 68, 25, -81]]]],
    ]),
  });
  assert.ok(!o.list.includes('Ohuhu|R312'), o.list.join(' '));
  assert.deepEqual(o.asks, []);
  // (the same readings in the middle of the photo: as before)
  const p = await photo(page, { lines: middle.concat([['R312', [1328, 1100, 127, 54, -14]]]) });
  assert.ok(p.list.includes('Ohuhu|R312'), p.list.join(' '));
  // (a code at the edge that's no part of another, read as printed: added; and one read with its own name)
  const q = await photo(page, {
    lines: middle.concat([
      ['BV310', [1000, 20, 130, 50, 0]],
      ['R312', [1328, 1509, 127, 54, -14], [['Magenta', [1300, 1460, 90, 24, -14]]]],
    ]),
  });
  assert.ok(q.list.includes('Ohuhu|BV310'), q.list.join(' '));
  assert.ok(q.list.includes('Ohuhu|R312'), q.list.join(' '));
  assert.deepEqual(errors, []);
});

test('with a brand chosen, a cap of the other brand read with its name isn’t added as the brand chosen’s marker of its code: asked', async () => {
  const { page, errors } = await openApp({ width: 820, height: 1180 });
  // (a tray of both brands, Ohuhu chosen: Copic's E81 Ivory and E97 Deep Orange had gone in as Ohuhu's E81 and E97)
  const o = await photo(page, {
    brand: 'Ohuhu',
    lines: [
      ['B015', [300, 300, 110, 44, 0]],
      ['E81', [700, 300, 110, 44, 0], [['Ivory', [700, 340, 90, 24, 0]]]],
      ['E97', [1100, 300, 110, 44, 0], [['Deep Orange', [1100, 340, 140, 24, 0]]]],
    ],
  });
  assert.ok(!o.list.includes('Ohuhu|E81') && !o.list.includes('Ohuhu|E97'), o.list.join(' '));
  const asked = o.asks.map((a) => a.opts.join(','));
  assert.ok(asked.includes('Copic|E81') && asked.includes('Copic|E97'), asked.join(' | '));
  assert.ok(o.list.includes('Ohuhu|B015'));
  // (Copic chosen: Ohuhu's Y02 Lemon Chiffon, its name misread, as Copic's Y02)
  const p = await photo(page, {
    brand: 'Copic',
    lines: [['Y02', [700, 300, 110, 44, 0], [['Lemon Chifon', [700, 340, 140, 24, 0]]]]],
  });
  assert.ok(!p.list.includes('Copic|Y02'), p.list.join(' '));
  assert.ok(
    p.asks.some((a) => a.opts.includes('Ohuhu|Y02')),
    JSON.stringify(p.asks),
  );
  // (its own name read: as before)
  const q = await photo(page, {
    brand: 'Copic',
    lines: [['E81', [700, 300, 110, 44, 0], [['Ivory', [700, 340, 90, 24, 0]]]]],
  });
  assert.deepEqual(q.list, ['Copic|E81']);
  assert.deepEqual(errors, []);
});

test('a name read with a “|” for its l isn’t a code: no question with no right answer and no picture', async () => {
  const { page, errors } = await openApp({ width: 820, height: 1180 });
  // (Copic chosen, a tray of Ohuhu's: its codes read again at the end; "R|ush", Blush cut by the edge, had been read as
  // R1, Ohuhu's old code for R210)
  const o = await photo(page, {
    brand: 'Copic',
    lines: middle.concat([['YR03', [34, 751, 114, 38, 51], [['R|ush', [28, 800, 56, 16, 56]]]]]),
  });
  assert.ok(!o.asks.some((a) => a.opts.includes('Ohuhu|R210')), JSON.stringify(o.asks));
  // (and the code beside it read as printed: added, not asked about for the "1" in its name)
  assert.ok(o.list.includes('Ohuhu|YR03'), o.list.join(' '));
  assert.deepEqual(o.asks, []);
  assert.deepEqual(errors, []);
});

test('a question by a cap’s whole name has its picture when its words were read in the other order', async () => {
  const { page, errors } = await openApp({ width: 820, height: 1180 });
  // (Copic's BV00 Mauve Shadow, its code unread, "Shadow" a line before "Mauve")
  const o = await photo(page, {
    lines: ['B00', 'B01', 'B02', 'B04', 'B05', 'B06', 'B12', 'B14']
      .map((t, k) => [t, [200 + k * 200, 760, 110, 44, 0]])
      .concat([
        [
          'UV00',
          [1092, 1200, 130, 46, 8],
          [
            ['Shadow', [1116, 1140, 97, 31, 8]],
            ['Mauve', [1108, 1168, 86, 28, 8]],
          ],
        ],
      ]),
  });
  const q = o.asks.find((a) => a.opts.includes('Copic|BV00'));
  assert.ok(q, JSON.stringify(o.asks));
  assert.ok(q.crop, 'its picture');
  assert.deepEqual(errors, []);
});

test('Scan closed, or the app reloaded, while a photo’s read: what it added at once is taken back out, not left unchecked', async () => {
  const { page, errors } = await openApp({ width: 820, height: 1180 });
  await page.evaluate(() => openScan());
  await idle(page);
  // (Copic chosen, an Ohuhu tray's first codes: taken at once as Copic's, before the photo's brand shows)
  const o = await photo(page, {
    brand: 'Copic',
    done: false,
    lines: [
      ['R46', [300, 300, 110, 44, 0]],
      ['RV09', [700, 300, 110, 44, 0]],
      ['B02', [1100, 300, 110, 44, 0]],
    ],
  });
  assert.deepEqual(o.list.sort(), ['Copic|B02', 'Copic|R46', 'Copic|RV09']);
  // (a reload meanwhile: not kept)
  await page.evaluate(() => scanRender());
  assert.deepEqual(JSON.parse(await page.evaluate(() => localStorage.getItem('ms-scan-list') || '[]')), []);
  await page.click('#scClose');
  await idle(page);
  assert.deepEqual(await page.evaluate(() => scanList.map((e) => mkey(e.i))), []);
  // (a photo read to its end: kept, and through a reload)
  await page.evaluate(() => openScan());
  await idle(page);
  const p = await photo(page, { lines: middle });
  assert.equal(p.list.length, 8);
  await page.evaluate(() => scanRender());
  assert.equal(JSON.parse(await page.evaluate(() => localStorage.getItem('ms-scan-list'))).length, 8);
  assert.deepEqual(errors, []);
});

test('a batch’s next photo, as it opens, is said as its place in the batch, the bar where the batch is', async () => {
  const { page, errors } = await openApp({ width: 820, height: 1180 });
  await page.evaluate(() => openScan());
  await idle(page);
  const said = await page.evaluate(() => {
    const f = new File([new Uint8Array(8)], 'a.jpg', { type: 'image/jpeg' });
    ocrQ = { files: [f, f, f], k: 1, n0: 1, per: [{ added: 3, asked: 0 }], stop: false, t0: 0 };
    ocrNext();
    return [document.getElementById('ocrSay').textContent, document.getElementById('ocrBar').style.width];
  });
  assert.deepEqual(said, ['Photo 2 of 3 · Opening the photo…', '33%']);
  await page.click('#scClose');
  await idle(page);
  assert.deepEqual(errors, []);
});

test('a batch whose first photo can’t be opened reads the next', async () => {
  const { page, errors, ctx } = await openApp({ width: 820, height: 1180 });
  await ctx.unrouteAll({ behavior: 'ignoreErrors' });
  await page.evaluate(() => openScan());
  await idle(page);
  await page.click('#ocrOpen');
  await page.click('#ocrGet');
  await page.waitForSelector('#ocrPick', { timeout: 60000 });
  // (a photo of nothing: no caps, and quickly read)
  const jpg = await page.evaluate(() => {
    const c = document.createElement('canvas');
    c.width = 320;
    c.height = 240;
    c.getContext('2d').fillRect(0, 0, 320, 240);
    return c.toDataURL('image/jpeg').split(',')[1];
  });
  const [fc] = await Promise.all([page.waitForEvent('filechooser'), page.click('#ocrPick')]);
  await fc.setFiles([
    { name: 'broken.jpg', mimeType: 'image/jpeg', buffer: Buffer.from('not a photo') },
    { name: 'b.jpg', mimeType: 'image/jpeg', buffer: Buffer.from(jpg, 'base64') },
  ]);
  await page.waitForSelector('#ocrDone', { timeout: 120000 });
  assert.match(await page.textContent('#ocrSay'), /^2 photos: no new codes read · 1 not read/);
  assert.match(await page.textContent('#ocrSum'), /Photo 1: not read · Photo 2: 0 added/);
  assert.deepEqual(errors, []);
});

test('the real reader on a drawn tray of both brands, Ohuhu chosen: no Copic cap goes in as Ohuhu’s marker of its code', async () => {
  const { page, errors, ctx } = await openApp({ width: 820, height: 1180 });
  await ctx.unrouteAll({ behavior: 'ignoreErrors' });
  await page.click('#wcOneByOne');
  await page.click('#wcOneType');
  await idle(page);
  await page.click('#scBrand button[data-b="Ohuhu"]');
  await page.click('#ocrOpen');
  await page.click('#ocrGet');
  await page.waitForSelector('#ocrPick', { timeout: 60000 });
  // (caps of each brand in turn, a code over its name, any way round: Copic's E81 Ivory and E97 Deep Orange among them,
  // codes both brands have)
  const t = await page.evaluate(() => {
    const keys = [
      'Ohuhu|R014',
      'Copic|E81',
      'Ohuhu|B015',
      'Copic|E97',
      'Ohuhu|YR03',
      'Copic|E74',
      'Ohuhu|R312',
      'Copic|E84',
    ];
    const W = 1600,
      H = 1200,
      R = 140,
      cv = document.createElement('canvas');
    cv.width = W;
    cv.height = H;
    const g = cv.getContext('2d');
    g.fillStyle = '#2a2622';
    g.fillRect(0, 0, W, H);
    keys.forEach((k, i) => {
      const c = COLORS[keyIdx(k)];
      g.save();
      g.translate(200 + (i % 4) * 400, 300 + Math.floor(i / 4) * 600);
      g.fillStyle = '#d9d6cf';
      g.beginPath();
      g.arc(0, 0, R + 8, 0, 7);
      g.fill();
      g.fillStyle = c.hex;
      g.beginPath();
      g.arc(0, 0, R, 0, 7);
      g.fill();
      g.fillStyle = '#ece9e2';
      g.beginPath();
      g.arc(0, 0, R * 0.78, 0, 7);
      g.fill();
      g.rotate(((i * 47) % 360) * (Math.PI / 180));
      g.fillStyle = '#222';
      g.textAlign = 'center';
      g.font = 'bold 50px Helvetica, Arial, sans-serif';
      g.fillText(c.code, 0, -3);
      g.font = '22px Helvetica, Arial, sans-serif';
      g.fillText(c.name, 0, 36);
      g.restore();
    });
    return cv.toDataURL('image/jpeg', 0.92).split(',')[1];
  });
  const [fc] = await Promise.all([page.waitForEvent('filechooser'), page.click('#ocrPick')]);
  await fc.setFiles({ name: 'tray.jpg', mimeType: 'image/jpeg', buffer: Buffer.from(t, 'base64') });
  await page.waitForSelector('#ocrDone', { timeout: 240000 });
  const got = await page.evaluate(() => scanList.filter((e) => !e.ask).map((e) => mkey(e.i)));
  for (const k of ['Ohuhu|E81', 'Ohuhu|E97', 'Ohuhu|E74', 'Ohuhu|E84'])
    assert.ok(!got.includes(k), 'added ' + k + ': ' + got.join(' '));
  assert.ok(got.includes('Ohuhu|R014') && got.includes('Ohuhu|B015'), got.join(' '));
  assert.deepEqual(errors, []);
});

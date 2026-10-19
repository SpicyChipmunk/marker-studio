// v318.22 Scan › Photograph your caps, in the browser: the photo shown and its boxes let go of their pixels as the view
// changes (Chrome held on to each photo's canvases, and reading stopped after about ten photos), and the hint under a
// photo says how to read the caps it missed. Fails on v318.21.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, openApp, idle, scanFromMarkers, pause } from './helpers.mjs';

before(setup);
after(teardown);

const KEY = 'ohuhu-hb320-picker-v3';
const stored = {
  'ms-onboarded': '1',
  'ms-setup-tip': '1',
  'ms-last-ver': 'v318',
  [KEY]: JSON.stringify({
    mode: 'collection',
    ownedSeedV: 2,
    copicAdd1: 1,
    libAdj1: 1,
    setFix1: 1,
    owned: ['Ohuhu|R014'],
    saved: [],
  }),
};

test('a photo’s canvases are emptied as the view moves on; the hint says how to read the caps it missed', async () => {
  const { page, errors } = await openApp({ width: 820, height: 1180, storage: stored });
  await idle(page);
  await scanFromMarkers(page);
  await idle(page);
  const r = await page.evaluate(() => {
    // (a photo's view: its shown copy and its boxes, as ocrStart puts them in)
    ocrShow(
      '<div class="ocrstat"><span id="ocrSay"></span><span id="ocrLeft"></span></div>' +
        '<div class="ocrbar"><b id="ocrBar"></b></div><div class="ocrpic" id="ocrPic"></div>' +
        '<div class="ocrsum" id="ocrSum"></div><div class="ocrrow" id="ocrBtns"></div>',
    );
    const a = document.createElement('canvas'),
      b = document.createElement('canvas');
    a.width = b.width = 675;
    a.height = b.height = 900;
    document.getElementById('ocrPic').append(a, b);
    // (a photo read: its summary under it)
    const run = { n: 1, done: true, failed: false, items: new Map(), taken: new Set(), added: 3, asked: 0 };
    ocrQ = null;
    ocrStatus(run);
    const hint = document.getElementById('ocrSum').textContent;
    // (the next view: the photo's canvases go)
    ocrShowPick();
    return { a: [a.width, a.height], b: [b.width, b.height], hint: hint };
  });
  assert.deepEqual(r.a, [0, 0]);
  assert.deepEqual(r.b, [0, 0]);
  assert.match(
    r.hint,
    /Caps without a box weren’t read\. Half a tray at a time, with no glare on the caps, reads best\./,
  );
  assert.deepEqual(errors, []);
});

// a photo 800×600 drawn here (nothing of anyone's), the reader's lines made up: caps read for sure, and "808" near the
// top left, asked about (its cap's picture cut from the photo). size: the copy read (2048 normally, or 4096 read closer)
function read(page, size) {
  return page.evaluate((size) => {
    const W = size,
      H = Math.round((size * 3) / 4),
      cv = document.createElement('canvas');
    cv.width = W;
    cv.height = H;
    const g = cv.getContext('2d');
    g.fillStyle = '#888';
    g.fillRect(0, 0, W, H);
    g.fillStyle = '#d33';
    g.fillRect(W * 0.2 - 40, H * 0.2 - 40, 80, 80);
    const data = g.getImageData(0, 0, W, H),
      show = document.createElement('canvas');
    show.width = 800;
    show.height = 600;
    show.getContext('2d').drawImage(cv, 0, 0, 800, 600);
    scanList = [];
    ocrAnswered = [];
    ocrPhotos = 0;
    scanBrand = '';
    const r = {
      n: ++ocrPhotos,
      items: new Map(),
      taken: new Set(),
      brands: {},
      sure: 0,
      p: null,
      done: false,
      note: '',
    };
    r.img = { w: W, h: H, data: data, show: show };
    ocrRun = r;
    const k = W / 2048,
      codes = ['B04', 'B05', 'YR2', 'R10', 'G02', 'E04', 'Y06', 'B21', 'V12'],
      lines = codes.map((t, n) => ({
        id: n + 1,
        look: 1,
        text: t,
        conf: 0.98,
        unsure: false,
        nameOf: 0,
        box: [(500 + (n % 5) * 150) * k, (300 + Math.floor(n / 5) * 500) * k, 60 * k, 28 * k, 0],
      }));
    lines.push({
      id: 20,
      look: 1,
      text: '808',
      conf: 0.97,
      unsure: false,
      nameOf: 0,
      box: [W * 0.2, H * 0.2, 60 * k, 28 * k, 0],
    });
    lines.forEach((it) => ocrLine(r, it));
    ocrDone(r, { lines: lines, stat: {}, ms: 1, aborted: false });
    clearTimeout(r.soon);
    ocrRun = null;
    scanSaveList();
    scanRender();
    const q = scanList.find((e) => e.ask);
    return q
      ? { where: q.where, near: q.near, pid: q.pid, crop: !!q.crop, photo: !!scanPics.photo(q.pid) }
      : null;
  }, size);
}

test('a phone held sideways: Where in the photo? rings the cap itself, not the one below', async () => {
  const { page, errors } = await openApp({ width: 844, height: 390, storage: stored });
  await idle(page);
  await scanFromMarkers(page);
  await idle(page);
  const q = await read(page, 2048);
  assert.ok(q && q.crop && q.photo, JSON.stringify(q));
  await page.click('#scList .sccrop');
  await page.waitForSelector('.sczoom');
  await idle(page);
  await pause(page, 350, 'past the moment the tap that opened it is ignored for');
  await page.click('.sczwhere');
  const ring = await page.evaluate(() => {
    const r = document.querySelector('.sczring').getBoundingClientRect(),
      p = document.querySelector('.sczpic img').getBoundingClientRect();
    return { x: (r.left + r.width / 2 - p.left) / p.width, y: (r.top + r.height / 2 - p.top) / p.height };
  });
  assert.ok(Math.abs(ring.x - 0.2) < 0.03 && Math.abs(ring.y - 0.2) < 0.03, JSON.stringify(ring));
  assert.deepEqual(errors, []);
});

test('Clear list in Find mode leaves the photos of the list kept for Add numbered as they were', async () => {
  const { page, errors } = await openApp({ width: 1024, height: 768, storage: stored });
  await idle(page);
  await page.evaluate(() => {
    scanList = [
      { i: 5, how: '', photo: 1 },
      { i: 6, how: '', photo: 1 },
      { i: 7, how: '', photo: 2 },
    ];
    ocrPhotos = scanPhotoMax();
    scanSaveList();
  });
  await page.evaluate(() => openScan({ find: { brand: 'Ohuhu', bucket: 0, done() {} } }));
  await page.evaluate(() =>
    scanTake(
      COLORS.findIndex((c) => c.brand === 'Ohuhu'),
      '',
      true,
    ),
  );
  await page.click('#scClear');
  await page.click('#scClear');
  await page.evaluate(() => closeScan());
  const after = await page.evaluate(() => ({ list: scanList.length, ocrPhotos: ocrPhotos }));
  assert.equal(after.ocrPhotos, 2, 'the next photo is Photo 3: ' + JSON.stringify(after));
  assert.deepEqual(errors, []);
});

test('Look closer: offered under a photo read, what it reads added and said, Undo look closer takes it back', async () => {
  const { page, errors } = await openApp({ width: 820, height: 1180, storage: stored });
  await idle(page);
  await scanFromMarkers(page);
  await idle(page);
  await page.evaluate(() => {
    ocrShow(
      '<div class="ocrstat"><span id="ocrSay"></span><span id="ocrLeft"></span></div>' +
        '<div class="ocrbar"><b id="ocrBar"></b></div><div class="ocrpic" id="ocrPic"></div>' +
        '<div class="ocrsum" id="ocrSum"></div><div class="ocrrow" id="ocrBtns"></div>',
    );
    scanList = [];
    ocrAnswered = [];
    ocrPhotos = 1;
    ocrQ = null;
    const r = {
      n: 1,
      file: { name: 'x.jpg' },
      items: new Map(),
      taken: new Set(),
      brands: {},
      sure: 0,
      p: null,
    };
    // (shown, with its boxes' canvas, as ocrOne puts them in)
    const show = document.createElement('canvas');
    show.width = 384;
    show.height = 512;
    r.img = { w: 1536, h: 2048, ow: 3024, oh: 4032, show: show };
    r.cv = document.createElement('canvas');
    ocrRun = r;
    const lines = ['YR170', 'RP6', 'BR3', 'YR030', 'G420', 'CG050', 'NG03', 'PB1', 'Y7', 'R10'].map(
      (t, k) => ({
        id: k + 1,
        look: 1,
        text: t,
        conf: 0.97,
        unsure: false,
        nameOf: 0,
        box: [100 + 200 * (k % 6), 100 + 300 * Math.floor(k / 6), 60, 30, 0],
      }),
    );
    lines.push({
      id: 20,
      look: 1,
      text: 'GYX9',
      conf: 0.6,
      unsure: true,
      nameOf: 0,
      box: [700, 1500, 60, 30, 0],
    });
    lines.forEach((it) => ocrLine(r, it));
    ocrDone(r, { lines: lines, stat: {}, ms: 1, aborted: false });
    clearTimeout(r.soon);
    // (the reader's closer look, made up: GY5 with its name where "GYX9" was read)
    window.ocrCloserRead = async () => ({
      lines: [
        { id: 901, look: 1, text: 'GY5', conf: 0.98, unsure: false, nameOf: 0, box: [700, 1500, 60, 30, 0] },
        {
          id: 902,
          look: 1,
          text: 'Absinthe',
          conf: 0.98,
          unsure: false,
          nameOf: 901,
          box: [700, 1540, 80, 20, 0],
        },
      ],
    });
  });
  const n0 = await page.evaluate(() => scanList.filter((e) => !e.ask).length);
  await page.click('#ocrCloser');
  await page.waitForSelector('#ocrCloserUndo');
  assert.match(await page.textContent('#ocrSay'), /^Looked closer: 1 more added$/);
  const after = await page.evaluate(() =>
    scanList.filter((e) => !e.ask).map((e) => mkey(e.i) + ' #' + e.photo),
  );
  assert.equal(after.length, n0 + 1);
  assert.ok(after.includes('Ohuhu|YG211 #1'), JSON.stringify(after));
  // (v318.22 debug: the code read closer boxed where it was read, in place of what the photo had read there)
  const box = () => page.evaluate(() => [ocrRun.items.has(901), ocrRun.items.has(20)]);
  assert.deepEqual(await box(), [true, false]);
  assert.equal(await page.$('#ocrCloser'), null, 'not offered again for the same photo');
  await page.click('#ocrCloserUndo');
  assert.equal(await page.evaluate(() => scanList.filter((e) => !e.ask).length), n0);
  assert.deepEqual(await box(), [false, true], 'its box off, the photo’s back');
  assert.match(await page.textContent('#ocrSay'), /Look closer taken back/);
  assert.ok(await page.$('#ocrCloser'), 'offered again');
  assert.deepEqual(errors, []);
});

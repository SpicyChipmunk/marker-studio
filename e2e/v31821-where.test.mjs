// v318.21 Scan, in the browser: "Where in the photo?" under a question's close-up flips it to the whole photo with the
// cap ringed and words for where it is ("Near the top left · beside …"); a tap on the photo flips back. The photo is
// kept with its question through a reload, and goes with its last question. Fails on v318.20.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, openApp, idle, scanFromMarkers, until, pause } from './helpers.mjs';

before(setup);
after(teardown);

const KEY = 'ohuhu-hb320-picker-v3';
const stored = {
  'ms-onboarded': '1',
  'ms-setup-tip': '1',
  'ms-last-ver': 'v318',
  'ms-scan-brand': '',
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

test('Where in the photo?: the whole photo, the cap ringed, words for where; back to the close-up; kept through a reload', async () => {
  const { page, errors } = await openApp({ width: 820, height: 1180, storage: stored });
  await idle(page);
  await scanFromMarkers(page);
  await idle(page);
  const q = await read(page, 2048);
  assert.ok(q && q.crop && q.photo, JSON.stringify(q));
  assert.deepEqual(q.where.slice(0, 2), [0.2, 0.2]);
  assert.equal(q.near.length, 2, JSON.stringify(q.near));
  await page.click('#scList .sccrop');
  await page.waitForSelector('.sczoom');
  await idle(page);
  assert.equal(await page.textContent('.sczwhere'), 'Where in the photo?');
  await pause(page, 350, 'past the moment the tap that opened it is ignored for');
  await page.click('.sczwhere');
  assert.equal(await page.getAttribute('.sczwhere', 'aria-pressed'), 'true');
  assert.match(await page.textContent('.sczwords'), /^Near the top left · beside \S+ and \S+$/);
  const ring = await page.evaluate(() => {
    const r = document.querySelector('.sczring').getBoundingClientRect(),
      p = document.querySelector('.sczpic img').getBoundingClientRect();
    return {
      x: (r.left + r.width / 2 - p.left) / p.width,
      y: (r.top + r.height / 2 - p.top) / p.height,
      hidden: document.querySelector('.sczring').hidden,
    };
  });
  assert.equal(ring.hidden, false);
  assert.ok(Math.abs(ring.x - 0.2) < 0.02 && Math.abs(ring.y - 0.2) < 0.02, JSON.stringify(ring));
  // (a tap on the photo flips back, not closing)
  await page.click('.sczpic img');
  await idle(page);
  assert.equal(await page.textContent('.sczwhere'), 'Where in the photo?');
  assert.ok(await page.isVisible('.sczoom'));
  await page.click('.sczoom [data-a="close"]');
  await idle(page);
  // (kept through a reload: the picture store gives back the photo with its question)
  await page.reload();
  await idle(page);
  await scanFromMarkers(page);
  await until(
    page,
    () => !!document.querySelector('#scList .sccrop img'),
    null,
    'the question’s picture back',
  );
  await page.click('#scList .sccrop');
  await page.waitForSelector('.sczwhere');
  await pause(page, 350, 'past the moment the tap that opened it is ignored for');
  await page.click('.sczwhere');
  assert.match(await page.textContent('.sczwords'), /^Near the top left/);
  assert.deepEqual(errors, []);
});

test('the place is the copy’s the close-up was cut from: a photo read closer (4096) rings the same cap', async () => {
  const { page, errors } = await openApp({ width: 820, height: 1180, storage: stored });
  await idle(page);
  await scanFromMarkers(page);
  await idle(page);
  const q = await read(page, 4096);
  assert.ok(q && q.photo, JSON.stringify(q));
  assert.deepEqual(q.where.slice(0, 2), [0.2, 0.2]);
  // (its photo goes with its last question)
  await page.evaluate(() => {
    scanList = scanList.filter((e) => !e.ask);
    scanSaveList();
  });
  assert.equal(await page.evaluate((pid) => scanPics.photo(pid), q.pid), null);
  assert.deepEqual(errors, []);
});

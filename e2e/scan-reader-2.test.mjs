// Scan › Photograph your caps: the photo reader.
// (v320) Tests organised by feature: each block below came from the file named above it, its tests unchanged.
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { ENGINE, idle, openApp, pause, scanFromMarkers, setup, teardown } from './helpers.mjs';

before(setup);
after(teardown);

// ---- from v31822-reader.test.mjs ----
// v318.22 Scan › Photograph your caps, in the browser: the photo shown and its boxes let go of their pixels as the view
// changes (Chrome held on to each photo's canvases, and reading stopped after about ten photos), and the hint under a
// photo says how to read the caps it missed. Fails on v318.21.
{
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
          {
            id: 901,
            look: 1,
            text: 'GY5',
            conf: 0.98,
            unsure: false,
            nameOf: 0,
            box: [700, 1500, 60, 30, 0],
          },
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
}

// ---- from v3183-crops.test.mjs ----
// v318.3: a question from a photo shows the cap it's about, cut from the photo the right way up as the reader read it;
// a tap shows it larger, and a tap, Escape or Back closes that. The photo is drawn here (nothing of anyone's), the
// reader's lines made up. Fails on v318.2.
{
  // a photo 400×400: round the box at (200, 200), red where the reading starts, blue where it ends, with the box turned
  // `a` degrees; the reader's lines: eight codes as they are now, and "808" (asked about) in that box, read at `turn`
  function read(page, a, turn) {
    return page.evaluate(
      ([a, turn]) => {
        const cv = document.createElement('canvas');
        cv.width = cv.height = 400;
        const g = cv.getContext('2d');
        g.fillStyle = '#888';
        g.fillRect(0, 0, 400, 400);
        g.translate(200, 200);
        g.rotate((a * Math.PI) / 180);
        g.fillStyle = '#f00';
        g.fillRect(-60, -40, 60, 80);
        g.fillStyle = '#00f';
        g.fillRect(0, -40, 60, 80);
        const data = cv.getContext('2d').getImageData(0, 0, 400, 400);
        scanList = [];
        scanBrand = '';
        const r = {
          n: 1,
          items: new Map(),
          taken: new Set(),
          brands: {},
          sure: 0,
          p: null,
          done: false,
          note: '',
        };
        r.img = { w: 400, h: 400, data: data };
        ocrRun = r;
        const lines = ['B015', 'B03', 'B05', 'B09', 'B111', 'B112', 'B114', 'B115'].map((t, k) => ({
          id: k + 1,
          look: 1,
          text: t,
          conf: 0.98,
          unsure: false,
          nameOf: 0,
          box: [20 + k * 40, 380, 30, 14, 0],
        }));
        lines.push({
          id: 20,
          look: 1,
          text: '808',
          conf: 0.97,
          unsure: false,
          nameOf: 0,
          box: [200, 200, 100, 40, a],
          turn: turn,
        });
        lines.forEach((it) => ocrLine(r, it));
        ocrDone(r, { lines: lines, stat: {}, ms: 1, aborted: false });
        clearTimeout(r.soon);
        scanRender();
        const q = scanList.find((e) => e.ask);
        return { asks: scanList.filter((e) => e.ask).map((e) => e.title), crop: q && q.crop };
      },
      [a, turn],
    );
  }
  // the crop's colour on its left and on its right (the reading's start and end once it's upright)
  // (v318.8: read back once more, a frame later, when a side is neither: one run of WebKit here read 'other' twice,
  // once in some hundreds, and the picture itself read right at once and a frame later in 80 more. A picture that is
  // itself wrong still fails; the pixels read go in the message, to tell the two apart if it happens again)
  const sides = (page, url) =>
    page.evaluate(async (url) => {
      const look = async () => {
        const im = new Image();
        im.src = url;
        await im.decode();
        const c = document.createElement('canvas');
        c.width = im.width;
        c.height = im.height;
        const g = c.getContext('2d');
        g.drawImage(im, 0, 0);
        const px = (x, y) => [...g.getImageData(x, y, 1, 1).data.slice(0, 3)];
        return [px(im.width * 0.35, im.height / 2), px(im.width * 0.65, im.height / 2)];
      };
      const col = (p) => (p[0] > 150 && p[2] < 100 ? 'red' : p[2] > 150 && p[0] < 100 ? 'blue' : 'other');
      let ps = await look();
      if (ps.some((p) => col(p) === 'other')) {
        const first = ps.map((p) => p.join(','));
        await new Promise((r) => requestAnimationFrame(() => setTimeout(r, 50)));
        ps = await look();
        if (ps.some((p) => col(p) === 'other'))
          return ps
            .map(col)
            .concat(['read ' + first.join(' ') + ', then ' + ps.map((p) => p.join(',')).join(' ')]);
      }
      return ps.map(col);
    }, url);
  test('a question from a photo shows its cap, upright as the reader read it, whatever the turn', async () => {
    const { page, errors } = await openApp({
      width: 390,
      height: 844,
      storage: { 'ms-onboarded': '1', 'ms-setup-tip': '1' },
    });
    await scanFromMarkers(page);
    for (const [a, turn, want] of [
      [0, 0, ['red', 'blue']],
      [90, 0, ['red', 'blue']],
      [-35, 0, ['red', 'blue']],
      [0, 180, ['blue', 'red']],
      [90, 180, ['blue', 'red']],
    ]) {
      const o = await read(page, a, turn);
      assert.deepEqual(o.asks, ['“808” read: is it this one?']);
      assert.match(o.crop || '', /^data:image\/jpeg;base64,/, 'a picture of the cap');
      assert.deepEqual(await sides(page, o.crop), want, `turned ${a}°, read at ${turn}°`);
    }
    // the row: the picture in place of the "?"
    assert.equal(await page.locator('#scList .scask .sccrop img').count(), 1);
    assert.equal(await page.locator('#scList .scask .scmark').count(), 0);
    assert.deepEqual(errors, []);
  });
  // (v318.7: Not now in Close's place, still data-a="close")
  test('a tap on the picture shows it larger; Not now, Escape or Back closes it, and focus goes back', async () => {
    const { page, errors } = await openApp({
      width: 820,
      height: 1180,
      storage: { 'ms-onboarded': '1', 'ms-setup-tip': '1' },
    });
    await scanFromMarkers(page);
    await read(page, 20, 0);
    // (Back: not in Safari's engine under test automation, where it's left to the browser: helpers.mjs WK.back)
    for (const how of ENGINE === 'webkit' ? ['tap', 'Escape'] : ['tap', 'Escape', 'back']) {
      await page.click('#scList .sccrop');
      await page.waitForSelector('.sczoom.on');
      assert.equal(await page.locator('.sczoom img').count(), 1);
      assert.match(await page.textContent('.sczoom'), /“808” read: is it this one\?/);
      await page.waitForTimeout(350);
      if (how === 'tap') await page.click('.sczoom [data-a="close"]');
      else if (how === 'Escape') await page.keyboard.press('Escape');
      else await page.goBack().catch(() => {});
      await page.waitForSelector('.sczoom', { state: 'detached' });
      assert.ok(await page.isVisible('#scList'), `Scan still open after ${how}`);
      if (how !== 'back')
        assert.equal(
          await page.evaluate(() => document.activeElement.classList.contains('sccrop')),
          true,
          'focus back on the picture',
        );
    }
    // answering the question takes the picture with it
    await page.click('#scList .scchoose');
    assert.equal(await page.locator('#scList .sccrop').count(), 0);
    assert.deepEqual(errors, []);
  });
  // (v318.3 debug) Safari doesn't focus a button that's tapped: focus was given back to what had it before, the box (on an
  // iPad, its keyboard over the list), not the picture tapped; nor found again once the list was drawn again under it
  test('the larger view gives focus back to the picture tapped, not to what had it before, even with the list redrawn', async () => {
    const { page, errors } = await openApp({
      width: 820,
      height: 1180,
      storage: { 'ms-onboarded': '1', 'ms-setup-tip': '1' },
    });
    await scanFromMarkers(page);
    await read(page, 0, 0);
    for (const redraw of [false, true]) {
      // (a tap as Safari makes it: a click, with no focus on the button)
      await page.evaluate(() => {
        document.getElementById('scBox').focus();
        document.querySelector('#scList .sccrop').click();
      });
      await page.waitForSelector('.sczoom.on');
      if (redraw) await page.evaluate(() => scanRender());
      await page.keyboard.press('Escape');
      await page.waitForSelector('.sczoom', { state: 'detached' });
      assert.equal(
        await page.evaluate(() => document.activeElement.className),
        'sccrop',
        redraw ? 'on the picture drawn again' : 'on the picture',
      );
    }
    assert.deepEqual(errors, []);
  });
  // (v318.3 debug) a phone held sideways: the picture kept square (it had been squashed to 320×257 by the dialogs' own
  // height limit) and Close in view (v318.7: Not now, with the answers beside the picture there)
  test('the larger view on a phone held sideways: the picture square, Not now in view', async () => {
    const { page, errors } = await openApp({
      width: 844,
      height: 390,
      storage: { 'ms-onboarded': '1', 'ms-setup-tip': '1' },
    });
    await scanFromMarkers(page);
    await read(page, 0, 0);
    await page.evaluate(() => document.querySelector('#scList .sccrop').click());
    await page.waitForSelector('.sczoom.on');
    const o = await page.evaluate(() => {
      const i = document.querySelector('.sczoom img').getBoundingClientRect(),
        b = document.querySelector('.sczoom [data-a="close"]').getBoundingClientRect();
      return { w: Math.round(i.width), h: Math.round(i.height), bottom: b.bottom };
    });
    assert.ok(Math.abs(o.w - o.h) <= 1, `square: ${o.w}×${o.h}`);
    assert.ok(o.bottom <= 390, `Not now in view: its foot at ${o.bottom}`);
    assert.deepEqual(errors, []);
  });
  // (v318.3 debug) "Which G410?" (G410, or G24 by its old code) on a photo whose G24 was read before it: the picture was
  // G24's cap, already added, not the G410 asked about
  test('a question about a code shows the cap read as that code, not another of its answers read before it', async () => {
    const { page, errors } = await openApp({
      width: 390,
      height: 844,
      storage: { 'ms-onboarded': '1', 'ms-setup-tip': '1' },
    });
    await scanFromMarkers(page);
    const o = await page.evaluate(() => {
      // red round the first line (G24), blue round the second (G410)
      const cv = document.createElement('canvas');
      cv.width = 400;
      cv.height = 400;
      const g = cv.getContext('2d');
      g.fillStyle = '#f00';
      g.fillRect(0, 0, 200, 400);
      g.fillStyle = '#00f';
      g.fillRect(200, 0, 200, 400);
      scanList = [];
      scanBrand = 'Ohuhu';
      const r = {
        n: 1,
        items: new Map(),
        taken: new Set(),
        brands: {},
        sure: 0,
        p: null,
        done: false,
        note: '',
      };
      r.img = { w: 400, h: 400, data: g.getImageData(0, 0, 400, 400) };
      ocrRun = r;
      const lines = ['G24', 'G410'].map((t, k) => ({
        id: k + 1,
        look: 1,
        text: t,
        conf: 0.97,
        unsure: false,
        nameOf: 0,
        box: [100 + k * 200, 200, 40, 20, 0],
        turn: 0,
      }));
      lines.forEach((it) => ocrLine(r, it));
      ocrDone(r, { lines: lines, stat: {}, ms: 1, aborted: false });
      clearTimeout(r.soon);
      const q = scanList.find((e) => e.ask);
      return { asks: scanList.filter((e) => e.ask).map((e) => e.title), crop: q && q.crop };
    });
    assert.deepEqual(o.asks, ['Which G410?']);
    assert.deepEqual(await sides(page, o.crop), ['blue', 'blue'], 'the G410 cap');
    assert.deepEqual(errors, []);
  });
}

// ---- from v31832-ocr-start.test.mjs ----
// v318.32 D1-1 (Fable R32): Scan closed while the reader's worker is starting (files loaded, 'init' sent, 'ready' not
// yet back): ocrEnd() terminated the worker, but the ocrStart promise awaited by ocrGo never settled, so ocrGo's frame
// (and its photo's pixels, r.img.data, ~12 MB) stayed for good, each time. Now ocrEnd tells it. And decision 6.9: a
// picture pasted into the box is read by the reader when it's stored. Fails on v318.31.
{
  // a dark tray with one code on it (drawn here: no photo of anyone's is in the repo)
  const tray = (page) =>
    page.evaluate(() => {
      const cv = document.createElement('canvas');
      cv.width = 1536;
      cv.height = 2048;
      const g = cv.getContext('2d');
      g.fillStyle = '#2a2622';
      g.fillRect(0, 0, 1536, 2048);
      g.fillStyle = '#ddd';
      g.font = 'bold 40px Arial';
      g.fillText('B02', 100, 100);
      return cv.toDataURL('image/jpeg', 0.9).split(',')[1];
    });
  test('D1-1 Scan closed while the reader starts: ocrStart settles, ocrGo does not hang, Look closer is let go of', async () => {
    const { page, errors, ctx } = await openApp({ width: 820, height: 1180 });
    // (Playwright's WebKit, with any route set, fails the worker's blob: loads: the route keeping the app offline is
    // lifted, as e2e/v318-ocr does; all it loads is the app's own server)
    await ctx.unrouteAll({ behavior: 'ignoreErrors' });
    await page.click('#wcOneByOne');
    await page.click('#wcOneType');
    await idle(page);
    await page.click('#ocrOpen');
    await page.click('#ocrGet');
    await page.waitForSelector('#ocrPick', { timeout: 60000 });
    // ocrStart wrapped, to see whether its promise settles
    await page.evaluate(() => {
      const orig = ocrStart;
      window.__starts = [];
      ocrStart = function () {
        const p = orig();
        const rec = { settled: false };
        p.then(
          () => (rec.settled = 'ok'),
          (e) => (rec.settled = 'rej:' + e.message),
        );
        window.__starts.push(rec);
        return p;
      };
    });
    const jpg = await tray(page);
    const [fc] = await Promise.all([page.waitForEvent('filechooser'), page.click('#ocrPick')]);
    await fc.setFiles({ name: 'tray.jpg', mimeType: 'image/jpeg', buffer: Buffer.from(jpg, 'base64') });
    // the worker exists but hasn't said ready yet
    await page.waitForFunction(() => ocrW && !ocrW._up && window.__starts.length === 1, null, {
      timeout: 60000,
      polling: 5,
    });
    const state = await page.evaluate(() => ({ up: !!ocrW._up, sent: !!(ocrRun && ocrRun.sent) }));
    // (a closer look's state stood in for too: ocrClose lets go of it, so it's offered again on the next photo)
    await page.evaluate(() => {
      ocrCl = { stop: false, k: 0, of: 1, done: 0, all: 0, wait: null };
    });
    await page.click('#scClose');
    await idle(page);
    assert.equal(await page.evaluate(() => ocrW), null, 'worker ended');
    assert.equal(await page.evaluate(() => ocrCl), null, 'Look closer let go of');
    await page.waitForTimeout(4000);
    const rec = await page.evaluate(() => window.__starts[0]);
    console.log('state at close:', state, 'ocrStart promise:', rec);
    // (rejected 'ended' when Scan closed before the worker's 'ready'; 'ok' when the ready came first, which a fast
    // start in WebKit can: settled either way, and ocrGo let the photo go)
    assert.notEqual(rec.settled, false, 'ocrStart settled after Scan closed mid-start (v318.31: never)');
    assert.equal(await page.evaluate(() => ocrRun), null, 'no read under way');
    assert.deepEqual(errors, []);
  });
  test('6.9 a picture pasted into the box is read by the reader when it is stored', async () => {
    const { page, errors, ctx } = await openApp({ width: 820, height: 1180 });
    await ctx.unrouteAll({ behavior: 'ignoreErrors' });
    await page.click('#wcOneByOne');
    await page.click('#wcOneType');
    await idle(page);
    await page.click('#ocrOpen');
    await page.click('#ocrGet');
    await page.waitForSelector('#ocrPick', { timeout: 60000 });
    await page.click('#ocrNo');
    await idle(page);
    const jpg = await tray(page);
    const r = await page.evaluate(async (b64) => {
      const bin = atob(b64),
        u = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
      const f = new File([u], 'tray.jpg', { type: 'image/jpeg' }),
        dt = new DataTransfer();
      dt.items.add(f);
      const box = document.getElementById('scBox');
      box.focus();
      const ev = new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true });
      box.dispatchEvent(ev);
      return { prevented: ev.defaultPrevented };
    }, jpg);
    assert.ok(r.prevented, 'the paste taken');
    await page.waitForFunction(() => ocrRun && ocrRun.n >= 1, null, { timeout: 15000 });
    assert.ok(await page.isVisible('#ocrView'), "the reader's view, reading");
    // the read runs to its end, the photo counted
    await page.waitForFunction(() => ocrRun && ocrRun.done, null, { timeout: 180000 });
    assert.match(await page.textContent('#ocrView'), /B02|read|Done/);
    await page.click('#scClose');
    await idle(page);
    assert.deepEqual(errors, []);
  });
}

// ---- from v3184-flow.test.mjs ----
// v318.4 e2e: what driving Photograph your caps end to end with the real reader, on synthetic trays, found; each test
// fails on v318.4 as released to review. The reader's lines are made up here, as it read the trays (nothing of
// anyone's), except the last test's, a drawn tray of both brands read by the real reader.
{
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
}

// ---- from v3189-detail.test.mjs ----
// v318.9: a photo whose codes are small in it is read again closer, with the real reader on drawn trays (nothing of
// anyone's): told so by the first look, the photo decoded again at its own size (up to 4096 px) and read with the
// detector at 3200 in 16 strips; said on screen. Not a photo no bigger than 2560 px, nor one of large codes. Stop during
// the closer read; out of memory in it, the 2048 copy read again gently; two photos at once, the first read closer.
// Fails on v318.8 (one read, at 2048).
{
  // a tray W × H (a JPEG) of n caps of the brand from its colour list's `from`: round caps of radius R, each a code (in
  // `font` px) over its name, turned any way
  const tray = (page, o) =>
    page.evaluate((o) => {
      const caps = COLORS.filter((c) => c.brand === o.brand && /^[A-Z]{1,3}\d{2,3}$/.test(c.code)).slice(
          o.from,
          o.from + o.n,
        ),
        cv = document.createElement('canvas');
      cv.width = o.W;
      cv.height = o.H;
      const g = cv.getContext('2d');
      g.fillStyle = '#2a2622';
      g.fillRect(0, 0, o.W, o.H);
      let s = o.seed;
      const r = () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296;
      const R = o.R,
        cols = Math.floor((o.W - 80) / (R * 2.2));
      caps.forEach((c, i) => {
        g.save();
        g.translate(R * 1.2 + 40 + (i % cols) * R * 2.2, R * 1.2 + 40 + Math.floor(i / cols) * R * 2.2);
        g.fillStyle = '#d9d6cf';
        g.beginPath();
        g.arc(0, 0, R + 4, 0, 7);
        g.fill();
        g.fillStyle = c.hex;
        g.beginPath();
        g.arc(0, 0, R, 0, 7);
        g.fill();
        g.rotate((r() - 0.5) * Math.PI * 2);
        g.fillStyle = '#222';
        g.textAlign = 'center';
        g.font = 'bold ' + o.font + 'px Helvetica, Arial, sans-serif';
        g.fillText(c.code, 0, -o.font * 0.15);
        // (the whole name, smaller to fit: a name cut short can be another marker's whole name, Deep Violet of Deep Violet Blue)
        let f = Math.round(o.font * 0.58);
        g.font = f + 'px Helvetica, Arial, sans-serif';
        while (f > 6 && g.measureText(c.name).width > R * 1.8)
          g.font = --f + 'px Helvetica, Arial, sans-serif';
        g.fillText(String(c.name), 0, o.font * 0.6);
        g.restore();
      });
      return {
        jpg: cv.toDataURL('image/jpeg', 0.92).split(',')[1],
        keys: caps.map((c) => c.brand + '|' + c.code),
      };
    }, o);
  // (small codes: ~15 px in a 2600-px photo, ~12 in its 2048 copy; large: 40 px)
  const SMALL = { brand: 'Ohuhu', from: 20, n: 40, W: 2600, H: 1950, R: 42, font: 15, seed: 7 },
    LARGE = { brand: 'Ohuhu', from: 20, n: 12, W: 2600, H: 1950, R: 150, font: 46, seed: 7 };
  const unroute = (ctx) => ctx.unrouteAll({ behavior: 'ignoreErrors' });
  const list = (page) => page.evaluate(() => scanList.filter((e) => !e.ask).map((e) => mkey(e.i)));
  async function ready(opts) {
    const a = await openApp(Object.assign({ width: 820, height: 1180 }, opts));
    await unroute(a.ctx);
    await a.page.click('#wcOneByOne');
    await a.page.click('#wcOneType');
    await idle(a.page);
    await a.page.click('#ocrOpen');
    await a.page.click('#ocrGet');
    await a.page.waitForSelector('#ocrPick', { timeout: 60000 });
    // (each read the page sends the worker, as sent; and, when asked, the closer read answered with a memory failure)
    await a.page.evaluate(() => {
      window.__reads = [];
      const pm = Worker.prototype.postMessage,
        T0 = performance.now(),
        at = () => Math.round((performance.now() - T0) / 100) / 10;
      // (v318.28) what was sent to the reader and what came back, in seconds, for a wait that times out to say where
      // it stopped (told)
      window.__tl = [];
      Worker.prototype.postMessage = function (m, t) {
        if (!this.__tl) {
          this.__tl = true;
          this.addEventListener('message', (e) => {
            const k = e.data && e.data.t;
            if (k !== 'line' && k !== 'progress') window.__tl.push(at() + ' ' + k);
          });
        }
        window.__tl.push(at() + ' sent ' + (m && m.t) + (m && m.o && m.o.maxSide ? ' ' + m.o.maxSide : ''));
        if (m && m.t === 'read') {
          window.__reads.push({
            w: m.img.width,
            h: m.img.height,
            maxSide: m.o.maxSide,
            detTiles: m.o.detTiles,
            detailCheck: m.o.detailCheck || 0,
          });
          if (window.__failCloser && m.o.maxSide === 3200) {
            const w = this;
            setTimeout(() => w.onmessage({ data: { t: 'error', message: 'Aborted()', memory: true } }), 50);
            return;
          }
        }
        return pm.call(this, m, t);
      };
    });
    return a;
  }
  async function choose(page, trays, button) {
    const [fc] = await Promise.all([page.waitForEvent('filechooser'), page.click(button || '#ocrPick')]);
    await fc.setFiles(
      trays.map((t, k) => ({
        name: 'tray' + k + '.jpg',
        mimeType: 'image/jpeg',
        buffer: Buffer.from(t.jpg, 'base64'),
      })),
    );
  }
  const reads = (page) => page.evaluate(() => window.__reads);
  // (v318.28) a wait that times out says how far the reads got: GitHub's WebKit timed out twice in these (at 120 s in
  // Stop's first wait, at 240 s in two photos'), where those steps take 15 and 50 s here on two busy CPUs (WebKit, 4
  // runs each) and the whole file 160 s on GitHub (ci-durations): a read that stalled, not one that was slow
  const told = (page, p) =>
    p.catch(async (e) => {
      const tl = await page.evaluate(() => window.__tl).catch(() => null);
      e.message += '\nthe reads so far (seconds since Scan was ready): ' + JSON.stringify(tl);
      throw e;
    });
  test('small codes: read again closer, at the photo’s size with the detector at 3200 in 16 strips, said on screen', async () => {
    const { page, errors } = await ready();
    const t = await tray(page, SMALL);
    await choose(page, [t]);
    await page.waitForFunction(() => /closer/.test(document.getElementById('ocrSay').textContent), null, {
      timeout: 60000,
      polling: 50,
    });
    await page.waitForSelector('#ocrDone', { timeout: 240000 });
    const rs = await reads(page);
    assert.equal(rs.length, 2, JSON.stringify(rs));
    assert.deepEqual(rs[0].detailCheck, 25);
    assert.equal(rs[0].w, 2048, 'first, its 2048 copy');
    assert.deepEqual(rs[1], { w: 2600, h: 1950, maxSide: 3200, detTiles: 16, detailCheck: 0 });
    assert.ok((await page.evaluate(() => ocrRun.lineH)) < 25);
    const got = await list(page);
    const hit = t.keys.filter((k) => got.includes(k));
    assert.ok(
      hit.length >= 32,
      'read ' + hit.length + ' of 40: missing ' + t.keys.filter((k) => !got.includes(k)),
    );
    assert.ok(
      got.filter((k) => !t.keys.includes(k)).length <= 1,
      'wrong: ' + got.filter((k) => !t.keys.includes(k)),
    );
    assert.doesNotMatch(await page.textContent('#ocrSay'), /closer/, 'done: said as before');
    assert.equal(await page.evaluate(() => localStorage.getItem('ms-ocr-busy')), null);
    assert.deepEqual(errors, []);
  });
  test('large codes, or a photo no bigger than 2560 px: one read, as before', async () => {
    const { page, errors } = await ready();
    await choose(page, [await tray(page, LARGE)]);
    await page.waitForSelector('#ocrDone', { timeout: 120000 });
    let rs = await reads(page);
    assert.equal(rs.length, 1, JSON.stringify(rs));
    assert.equal(rs[0].detailCheck, 25, 'asked, and not small');
    await page.evaluate(() => (window.__reads = []));
    await choose(
      page,
      [await tray(page, Object.assign({}, SMALL, { W: 2048, H: 1536, R: 33, font: 12 }))],
      '#ocrMore',
    );
    await page.waitForSelector('#ocrDone', { timeout: 120000 });
    rs = await reads(page);
    assert.equal(rs.length, 1, JSON.stringify(rs));
    assert.equal(rs[0].detailCheck, 0, 'no bigger than 2560 px: not asked');
    assert.deepEqual(errors, []);
  });
  test('Stop during the closer read lands within a moment; out of memory in it, the 2048 copy read again gently', async () => {
    const { page, errors } = await ready();
    const t = await tray(page, SMALL);
    await choose(page, [t]);
    await told(
      page,
      page.waitForFunction(
        () => {
          const b = document.getElementById('ocrStop');
          if (!b || window.__reads.length < 2 || !ocrRun || !ocrRun.sent) return false;
          window.__stopAt = performance.now();
          b.click();
          return true;
        },
        null,
        { timeout: 120000, polling: 50 },
      ),
    );
    await page.waitForFunction(() => !ocrRun || ocrRun.done, null, { timeout: 60000, polling: 20 });
    const ms = await page.evaluate(() => performance.now() - window.__stopAt);
    assert.ok(ms < 6000, 'stopped in ' + Math.round(ms) + ' ms');
    await page.waitForSelector('#ocrDone', { timeout: 60000 });
    assert.match(await page.textContent('#ocrSay'), /stopped/);
    // out of memory in the closer read
    await page.evaluate(() => {
      window.__reads = [];
      window.__failCloser = true;
    });
    await choose(page, [t], '#ocrMore');
    await told(page, page.waitForSelector('#ocrDone', { timeout: 240000 }));
    const rs = await reads(page);
    assert.equal(rs.length, 3, JSON.stringify(rs));
    assert.deepEqual(rs[2], { w: 2048, h: 1536, maxSide: 1600, detTiles: 4, detailCheck: 0 });
    assert.ok(await page.evaluate(() => !!localStorage.getItem('ms-ocr-low')), 'gently for a fortnight');
    assert.ok((await list(page)).length >= 1, 'read');
    assert.deepEqual(errors, []);
  });
  test('two photos at once, the first read closer: both read, one summary', async () => {
    const { page, errors } = await ready();
    await choose(page, [await tray(page, SMALL), await tray(page, LARGE)]);
    await told(
      page,
      page.waitForFunction(
        () => /^Photo 2 of 2 · /.test(document.getElementById('ocrSay').textContent),
        null,
        {
          timeout: 240000,
        },
      ),
    );
    await told(page, page.waitForSelector('#ocrDone', { timeout: 240000 }));
    const rs = await reads(page);
    assert.deepEqual(
      rs.map((r) => [r.maxSide, r.detailCheck]),
      [
        [1600, 25],
        [3200, 0],
        [1600, 25],
      ],
    );
    assert.match(await page.textContent('#ocrSay'), /^2 photos: \d+ markers added to the list/);
    assert.match(await page.textContent('#ocrSum'), /Photo 1: \d+ added.*Photo 2: \d+ added/);
    assert.deepEqual(errors, []);
  });
}

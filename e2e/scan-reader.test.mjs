// Scan › Photograph your caps: the photo reader.
// (v320) Tests organised by feature: each block below came from the file named above it, its tests unchanged.
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { idle, openApp, pause, scanFromMarkers, setup, teardown, until } from './helpers.mjs';

before(setup);
after(teardown);

// ---- from v318-adding-8.test.mjs ----
// v318 review (adding markers, 8): the photo reader's card widens to 760 px only when that shows the photo 500 px wide,
// for the codes over its boxes: a photo taken upright on an iPad held sideways is as narrow either way, so the card
// stays as it was; turned upright, it widens. Fails on v318.
{
  // a tray of caps, 1536×2048 (a JPEG): round caps, each a code over its name, turned any way, a little noise; n caps of
  // the brand from the colour list's first of that brand at `from`
  const tray = (page, brand, from, n, seed) =>
    page.evaluate(
      ([brand, from, n, seed]) => {
        const caps = COLORS.filter((c) => c.brand === brand && /^[A-Z]{1,3}\d{2,3}$/.test(c.code)).slice(
            from,
            from + n,
          ),
          W = 1536,
          H = 2048,
          cv = document.createElement('canvas');
        cv.width = W;
        cv.height = H;
        const g = cv.getContext('2d');
        g.fillStyle = '#2a2622';
        g.fillRect(0, 0, W, H);
        let s = seed;
        const r = () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296;
        const R = 62,
          cols = Math.floor(W / (R * 2.2));
        caps.forEach((c, i) => {
          g.save();
          g.translate(R * 1.2 + (i % cols) * R * 2.2, R * 1.2 + Math.floor(i / cols) * R * 2.2);
          g.fillStyle = '#d9d6cf';
          g.beginPath();
          g.arc(0, 0, R + 6, 0, 7);
          g.fill();
          g.fillStyle = c.hex;
          g.beginPath();
          g.arc(0, 0, R, 0, 7);
          g.fill();
          g.rotate((r() - 0.5) * Math.PI * 2);
          g.fillStyle = '#222';
          g.textAlign = 'center';
          g.font = 'bold 26px Helvetica, Arial, sans-serif';
          g.fillText(c.code, 0, -4);
          g.font = '15px Helvetica, Arial, sans-serif';
          g.fillText(String(c.name).slice(0, 14), 0, 15);
          g.restore();
        });
        return {
          jpg: cv.toDataURL('image/jpeg', 0.92).split(',')[1],
          keys: caps.map((c) => c.brand + '|' + c.code),
        };
      },
      [brand, from, n, seed],
    );
  const unroute = (ctx) => ctx.unrouteAll({ behavior: 'ignoreErrors' });
  const card = (page) =>
    page.evaluate(() => ({
      w: Math.round(document.querySelector('.sccard').getBoundingClientRect().width),
      pic: Math.round(document.querySelector('#ocrPic canvas').getBoundingClientRect().width),
    }));
  test('an upright photo on an iPad held sideways: the card stays 480 px; turned upright, 760 with the codes shown', async () => {
    const { page, errors, ctx } = await openApp({
      width: 1180,
      height: 820,
      storage: { 'ms-onboarded': '1', 'ms-setup-tip': '1' },
    });
    await unroute(ctx);
    await page.evaluate(() => openScan());
    await idle(page);
    await page.click('#ocrOpen');
    await page.click('#ocrGet');
    await page.waitForSelector('#ocrPick', { timeout: 60000 });
    const t = await tray(page, 'Ohuhu', 20, 12, 3);
    const [fc] = await Promise.all([page.waitForEvent('filechooser'), page.click('#ocrPick')]);
    await fc.setFiles({ name: 'tray.jpg', mimeType: 'image/jpeg', buffer: Buffer.from(t.jpg, 'base64') });
    await page.waitForSelector('#ocrDone', { timeout: 180000 });
    let c = await card(page);
    assert.equal(c.w, 480, 'not widened for nothing: ' + JSON.stringify(c));
    assert.ok(c.pic < 500);
    await page.setViewportSize({ width: 820, height: 1180 });
    await page.waitForFunction(() => document.querySelector('.sccard').getBoundingClientRect().width > 700);
    c = await card(page);
    assert.ok(c.pic >= 500, 'wide enough for the codes: ' + JSON.stringify(c));
    // Done: back to the list, the card as it was
    await page.click('#ocrDone');
    await idle(page);
    assert.equal(
      Math.round(await page.evaluate(() => document.querySelector('.sccard').getBoundingClientRect().width)),
      480,
    );
    assert.deepEqual(errors, []);
  });
}

// ---- from v318-ocr.test.mjs ----
// v318: Scan's Read a photo of your caps, with the real reader on a synthetic tray (drawn here: no photo of anyone's is
// in the repo). The card and its consent; the download into a cache of its own, checked, resumed after a cut; a photo
// read into the list as it's read; Undo this photo; Stop; the worker ended as Scan closes. Fails on v317.
{
  // a tray of caps, 1536×2048 (a JPEG): round caps, each a code over its name, turned any way, a little noise; n caps of
  // the brand from the colour list's first of that brand at `from`
  const tray = (page, brand, from, n, seed) =>
    page.evaluate(
      ([brand, from, n, seed]) => {
        const caps = COLORS.filter((c) => c.brand === brand && /^[A-Z]{1,3}\d{2,3}$/.test(c.code)).slice(
            from,
            from + n,
          ),
          W = 1536,
          H = 2048,
          cv = document.createElement('canvas');
        cv.width = W;
        cv.height = H;
        const g = cv.getContext('2d');
        g.fillStyle = '#2a2622';
        g.fillRect(0, 0, W, H);
        let s = seed;
        const r = () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296;
        const R = 62,
          cols = Math.floor(W / (R * 2.2));
        caps.forEach((c, i) => {
          g.save();
          g.translate(R * 1.2 + (i % cols) * R * 2.2, R * 1.2 + Math.floor(i / cols) * R * 2.2);
          g.fillStyle = '#d9d6cf';
          g.beginPath();
          g.arc(0, 0, R + 6, 0, 7);
          g.fill();
          g.fillStyle = c.hex;
          g.beginPath();
          g.arc(0, 0, R, 0, 7);
          g.fill();
          g.rotate((r() - 0.5) * Math.PI * 2);
          g.fillStyle = '#222';
          g.textAlign = 'center';
          g.font = 'bold 26px Helvetica, Arial, sans-serif';
          g.fillText(c.code, 0, -4);
          g.font = '15px Helvetica, Arial, sans-serif';
          g.fillText(String(c.name).slice(0, 14), 0, 15);
          g.restore();
        });
        return {
          jpg: cv.toDataURL('image/jpeg', 0.92).split(',')[1],
          keys: caps.map((c) => c.brand + '|' + c.code),
        };
      },
      [brand, from, n, seed],
    );
  // (Playwright's WebKit, with any route set, fails the worker's blob: loads: the reader then stops with a problem. The
  // tests that read lift openApp's route keeping them offline; all they load is the app's own server)
  const unroute = (ctx) => ctx.unrouteAll({ behavior: 'ignoreErrors' });
  const list = (page) => page.evaluate(() => scanList.filter((e) => !e.ask).map((e) => mkey(e.i)));
  async function scanOpen(page) {
    await page.click('#wcOneByOne');
    await page.click('#wcOneType');
    await idle(page);
  }
  async function download(page) {
    await page.click('#ocrOpen');
    await page.click('#ocrGet');
    await page.waitForSelector('#ocrPick', { timeout: 60000 });
  }
  async function read(page, t, button) {
    const [fc] = await Promise.all([page.waitForEvent('filechooser'), page.click(button || '#ocrPick')]);
    await fc.setFiles({ name: 'tray.jpg', mimeType: 'image/jpeg', buffer: Buffer.from(t.jpg, 'base64') });
  }
  test('the card, its consent and Not now; not in Find mode; the reader downloaded into its own cache, every file checked', async () => {
    const { page, errors } = await openApp({ width: 820, height: 1180 });
    await scanOpen(page);
    assert.ok(await page.isVisible('#ocrOpen'));
    await page.click('#ocrOpen');
    await page.waitForSelector('#ocrGet');
    assert.match(
      await page.textContent('#ocrView'),
      /^The reader works on this device: your photos never leave it\. It’s a one-time download of about 22 MB, kept for offline use\./,
    );
    assert.equal(await page.textContent('#scTitle'), 'Photograph your caps');
    assert.equal(await page.isVisible('#scBox'), false, 'the list and box behind it');
    await page.click('#ocrNo');
    assert.ok(await page.isVisible('#scBox'));
    assert.equal(await page.textContent('#scTitle'), 'Scan or type codes');
    await download(page);
    const c = await page.evaluate(async () => {
      const names = await caches.keys(),
        k = await (await caches.open('marker-studio-ocr-1')).keys();
      return { names, files: k.map((r) => r.url.split('/').pop()).sort() };
    });
    assert.deepEqual(c.names, ['marker-studio-ocr-1'], 'only its own cache');
    assert.deepEqual(c.files, [
      'cls.onnx',
      'det.onnx',
      'ort-wasm-simd-threaded.wasm',
      'ort.wasm.bundle.min.mjs',
      'rec-dict.txt',
      'rec.onnx',
    ]);
    assert.match(await page.textContent('#ocrView'), /The reader is ready/);
    // Find mode: no card
    await page.click('#scClose');
    await idle(page);
    await page.evaluate(() => openScan({ find: { brand: 'Ohuhu', bucket: 1, done: () => {} } }));
    await idle(page);
    assert.equal(await page.isVisible('#ocrOpen'), false);
    assert.deepEqual(errors, []);
  });
  test('a download cut off part way: said, what came kept, and finished on a second try', async () => {
    const { page, errors, ctx } = await openApp({ width: 390, height: 844 });
    await scanOpen(page);
    let cut = true;
    await ctx.route('**/vendor/ocr/1/rec.onnx', (route) => (cut ? route.abort() : route.continue()));
    await page.click('#ocrOpen');
    await page.click('#ocrGet');
    await page.waitForSelector('#ocrView .ocrwarn');
    assert.match(
      await page.textContent('#ocrView .ocrwarn'),
      /The download didn’t finish: what’s downloaded is kept\. Try again\./,
    );
    const kept = await page.evaluate(
      async () => (await (await caches.open('marker-studio-ocr-1')).keys()).length,
    );
    assert.ok(kept >= 1 && kept < 6, 'part kept: ' + kept);
    assert.equal(await page.evaluate(() => ocrStored()), false);
    cut = false;
    await page.click('#ocrGet');
    await page.waitForSelector('#ocrPick', { timeout: 60000 });
    assert.equal(await page.evaluate(() => ocrStored()), true);
    assert.deepEqual(errors, []);
  });
  test('a photo read: its codes join the list as they’re read; Done says so; Undo this photo takes them back out', async () => {
    const { page, errors, ctx } = await openApp({ width: 820, height: 1180 });
    await unroute(ctx);
    await scanOpen(page);
    await download(page);
    const t = await tray(page, 'Ohuhu', 30, 24, 11);
    await read(page, t);
    // (codes in the list before the photo's done)
    await page.waitForFunction(() => scanList.length >= 3 && ocrRun && !ocrRun.done, null, {
      timeout: 60000,
    });
    await page.waitForSelector('#ocrDone', { timeout: 120000 });
    const got = await list(page);
    const hit = t.keys.filter((k) => got.includes(k));
    assert.ok(
      hit.length >= 22,
      'read ' + hit.length + ' of 24: missing ' + t.keys.filter((k) => !got.includes(k)),
    );
    assert.ok(
      got.filter((k) => !t.keys.includes(k)).length <= 1,
      'wrong: ' + got.filter((k) => !t.keys.includes(k)),
    );
    assert.match(await page.textContent('#ocrSay'), /^\d+ markers added to the list/);
    assert.ok(await page.evaluate(() => document.querySelector('canvas.ocrbox').width > 0));
    await page.click('#ocrUndo');
    await idle(page);
    assert.deepEqual(await list(page), []);
    assert.match(await page.textContent('#scStat'), /Photo taken back out/);
    // (v318 review: the keyboard's place on the card, not in the box, whose focus in a tap opens an iPad's keyboard)
    assert.equal(await page.evaluate(() => document.activeElement.id), 'ocrOpen');
    // again (the reader known to be stored: the card's tap goes straight to the photo), and Done
    await read(page, t, '#ocrOpen');
    await page.waitForSelector('#ocrDone', { timeout: 120000 });
    await page.click('#ocrDone');
    await idle(page);
    assert.match(await page.textContent('#scStat'), /^✓From the photo: \d+ added to the list/);
    assert.equal(
      await page.evaluate(() => document.activeElement.id),
      'scAdd',
      'on Add, no keyboard over the list',
    );
    assert.ok((await list(page)).length >= 22);
    assert.deepEqual(errors, []);
  });
  test('Stop: it lands within a moment, not at the end of a look; what was read stays; Scan closed ends the worker', async () => {
    const { page, errors, ctx } = await openApp({ width: 820, height: 1180 });
    await unroute(ctx);
    await scanOpen(page);
    await download(page);
    const t = await tray(page, 'Copic', 10, 40, 5);
    await read(page, t);
    // (tapped in the page as the second code comes: WebKit's page, busy as the worker reads on one core, isn't still
    // long enough for Playwright's own click before the read's done)
    await page.waitForFunction(
      () => {
        const b = document.getElementById('ocrStop');
        if (scanList.length < 2 || !b) return false;
        window.__stopAt = performance.now();
        b.click();
        return true;
      },
      null,
      { timeout: 90000, polling: 50 },
    );
    // (the worker lets its messages in as it reads: v318's first build heard Stop only at the end of a look)
    await page.waitForFunction(() => !ocrRun || ocrRun.done, null, { timeout: 60000, polling: 20 });
    const ms = await page.evaluate(() => performance.now() - window.__stopAt);
    assert.ok(ms < 4000, 'stopped in ' + Math.round(ms) + ' ms');
    assert.equal(await page.evaluate(() => window.__ocrLast.aborted), true);
    await page.waitForSelector('#ocrDone', { timeout: 60000 });
    assert.match(await page.textContent('#ocrSay'), /stopped/);
    const n = (await list(page)).length;
    assert.ok(n >= 2 && n <= 40, 'kept ' + n);
    assert.ok(await page.evaluate(() => !!ocrW));
    await page.click('#ocrDone');
    await page.click('#scClose');
    await idle(page);
    assert.equal(await page.evaluate(() => ocrW), null, 'the worker ended');
    // (v318 review) Scan closed while a photo's read: the worker ended, and the next photo not read gently for it (the
    // flag that says a read was cut short by running out of memory had stayed)
    await page.evaluate(() => openScan());
    await idle(page);
    await read(page, t, '#ocrOpen');
    await page.waitForFunction(
      () => ocrRun && ocrRun.sent && localStorage.getItem('ms-ocr-busy') === '1',
      null,
      {
        timeout: 60000,
        polling: 20,
      },
    );
    await page.click('#scClose');
    await idle(page);
    assert.equal(await page.evaluate(() => ocrW), null, 'the worker ended mid-read');
    assert.equal(
      await page.evaluate(() => localStorage.getItem('ms-ocr-busy')),
      null,
      'not taken for running out of memory',
    );
    assert.deepEqual(errors, []);
  });
  test('offline, the reader not stored: the consent says it needs the internet once, and its button waits', async () => {
    const { page, errors, ctx } = await openApp({ width: 390, height: 844 });
    await scanOpen(page);
    await ctx.setOffline(true);
    await page.click('#ocrOpen');
    assert.match(await page.textContent('#ocrView .ocrwarn'), /needs the internet the first time/);
    assert.ok(await page.isDisabled('#ocrGet'));
    await ctx.setOffline(false);
    assert.deepEqual(errors, []);
  });
  test('several photos chosen at once: read in turn, a marker in two photos listed once, one summary, Undo these photos; Stop before the reader has a photo', async () => {
    const { page, errors, ctx } = await openApp({ width: 820, height: 1180 });
    await unroute(ctx);
    await scanOpen(page);
    await download(page);
    // (two trays sharing 12 caps)
    const a = await tray(page, 'Ohuhu', 30, 24, 3),
      b = await tray(page, 'Ohuhu', 42, 24, 9),
      keys = [...new Set(a.keys.concat(b.keys))];
    assert.equal(keys.length, 36);
    const [fc] = await Promise.all([page.waitForEvent('filechooser'), page.click('#ocrPick')]);
    assert.ok(fc.isMultiple(), 'more than one photo can be chosen');
    await fc.setFiles([
      { name: 'a.jpg', mimeType: 'image/jpeg', buffer: Buffer.from(a.jpg, 'base64') },
      { name: 'b.jpg', mimeType: 'image/jpeg', buffer: Buffer.from(b.jpg, 'base64') },
    ]);
    await page.waitForFunction(
      () => /^Photo 1 of 2 · /.test(document.getElementById('ocrSay').textContent),
      null,
      {
        timeout: 60000,
      },
    );
    await page.waitForFunction(
      () => /^Photo 2 of 2 · /.test(document.getElementById('ocrSay').textContent),
      null,
      {
        timeout: 120000,
      },
    );
    await page.waitForSelector('#ocrDone', { timeout: 120000 });
    assert.match(await page.textContent('#ocrSay'), /^2 photos: \d+ markers added to the list/);
    // (v318 review: what a screen reader hears, in a live region kept across the photos, not one made with each)
    assert.match(await page.textContent('#ocrLive'), /^2 photos: \d+ markers added to the list/);
    assert.equal(await page.evaluate(() => !!document.getElementById('ocrLive').closest('#ocrView')), false);
    assert.match(await page.textContent('#ocrSum'), /Photo 1: \d+ added.*Photo 2: \d+ added/);
    const got = await list(page);
    assert.equal(new Set(got).size, got.length, 'each marker once');
    const hit = keys.filter((k) => got.includes(k));
    assert.ok(
      hit.length >= 33,
      'read ' + hit.length + ' of 36: missing ' + keys.filter((k) => !got.includes(k)),
    );
    assert.ok(
      got.filter((k) => !keys.includes(k)).length <= 1,
      'wrong: ' + got.filter((k) => !keys.includes(k)),
    );
    assert.equal(await page.textContent('#ocrUndo'), 'Undo these 2 photos');
    await page.click('#ocrUndo');
    await idle(page);
    assert.deepEqual(await list(page), []);
    assert.match(await page.textContent('#scStat'), /Photos taken back out/);
    // Stop as the photos are chosen, before the first is opened: nothing read, the batch ended, said
    await page.evaluate(
      ([x, y]) => {
        const f = (b64, n) =>
          new File([Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))], n, { type: 'image/jpeg' });
        ocrChosen([f(x, 'a.jpg'), f(y, 'b.jpg')]);
        document.getElementById('ocrStop').click();
      },
      [a.jpg, b.jpg],
    );
    await page.waitForSelector('#ocrDone', { timeout: 60000 });
    // (v318 review: said as the one photo it stopped at, the other not read)
    assert.equal(await page.textContent('#ocrSay'), 'No new codes read · stopped · the other photo not read');
    assert.equal(await page.$('#ocrUndo'), null);
    await page.click('#ocrDone');
    await idle(page);
    assert.match(await page.textContent('#scStat'), /From the photo: nothing new/);
    assert.deepEqual(await list(page), []);
    assert.deepEqual(errors, []);
  });
  test('Photograph your caps: first in the welcome’s one by one, and in Markers’ Add markers; Scan opens on the reader, no keyboard; the stored reader’s picker in the same tap', async () => {
    const { page, errors, ctx } = await openApp({ width: 820, height: 1180 });
    await unroute(ctx);
    assert.match(
      await page.textContent('#wcOneByOne'),
      /Photograph or scan the caps, tick colours on a chart/,
    );
    await page.click('#wcOneByOne');
    await idle(page);
    assert.deepEqual(await page.$$eval('#wcStepOne .wcc b', (b) => b.map((x) => x.textContent)), [
      'Photograph your caps',
      'Scan caps one at a time',
      'Tick colours on a chart',
      'Type or paste codes',
    ]);
    await page.click('#wcOnePhoto');
    await page.waitForSelector('#ocrGet');
    assert.equal(await page.textContent('#scTitle'), 'Photograph your caps');
    assert.notEqual(
      await page.evaluate(() => document.activeElement && document.activeElement.id),
      'scBox',
      'no keyboard',
    );
    // Not now: Scan's list, opened from the welcome: what's added there is the welcome's
    await page.click('#ocrNo');
    await page.fill('#scBox', 'R014');
    await page.press('#scBox', 'Enter');
    await idle(page);
    await page.click('#scAdd');
    await idle(page);
    assert.ok(await page.isVisible('#wcStep2'), 'the welcome’s last step');
    assert.match(await page.textContent('#wcDone'), /1 marker/);
    assert.match(await page.textContent('#wcMoreExtra'), /Photograph or scan their caps, or tick them/);
    await page.click('#wcLook');
    await idle(page);
    // Markers › + Add markers: after a set
    await page.click('#mCollection');
    await idle(page);
    await page.click('#mkAddBtn');
    await idle(page);
    assert.deepEqual(
      (await page.$$eval('#wcAddWays .wcc b', (b) => b.map((x) => x.textContent))).slice(0, 2),
      ['Add a set you own', 'Photograph your caps'],
    );
    await page.click('#mkaPhoto');
    await page.waitForSelector('#ocrGet');
    await page.click('#ocrGet');
    await page.waitForSelector('#ocrPick', { timeout: 60000 });
    await page.click('#scClose');
    await idle(page);
    // (the reader known to be stored: the row's tap opens the photo picker itself)
    await page.click('#mkAddBtn');
    await idle(page);
    const [fc] = await Promise.all([
      page.waitForEvent('filechooser', { timeout: 10000 }),
      page.click('#mkaPhoto'),
    ]);
    assert.ok(fc.isMultiple());
    assert.deepEqual(errors, []);
  });
  test('where the reader can’t run: no Photograph your caps, and the welcome reads as before', async () => {
    const { page, errors } = await openApp({
      width: 390,
      height: 844,
      init: () => {
        WebAssembly.validate = () => false;
      },
    });
    assert.match(
      await page.textContent('#wcOneByOne'),
      /Scan caps one at a time, tick colours on a chart, or type the codes\./,
    );
    await page.click('#wcOneByOne');
    await idle(page);
    assert.equal(await page.isVisible('#wcOnePhoto'), false);
    await page.click('#wcOneType');
    await idle(page);
    assert.equal(await page.isVisible('#ocrOpen'), false);
    assert.deepEqual(errors, []);
    // (an empty Markers' card of ways to add, where it can and where it can't)
    for (const can of [true, false]) {
      const o = await openApp({
        width: 820,
        height: 1180,
        storage: { 'ms-onboarded': '1', 'ms-setup-tip': '1', 'ms-owned': '[]' },
        init: can
          ? null
          : () => {
              WebAssembly.validate = () => false;
            },
      });
      await idle(o.page);
      await o.page.click('#mCollection');
      await idle(o.page);
      const ways = await o.page.$$eval('#mkAddWays .wcc b', (b) => b.map((x) => x.textContent));
      assert.equal(ways.includes('Photograph your caps'), can, String(ways));
      assert.deepEqual(o.errors, []);
    }
  });
}

// ---- from v31821-reader.test.mjs ----
// v318.21 Scan, in the browser: a code misread by one character and put right by the whole name read beside it is
// listed with "read as “5110”" on its row, kept through a reload of the list. Fails on v318.20.
{
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
  // a photo's reading made up (nothing of anyone's): a tray of older Ohuhu caps, and "5110" with "Dark Suntan" under it
  function read(page) {
    return page.evaluate(() => {
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
      ocrRun = r;
      const caps = [
        'YR170',
        'RP6',
        'BR3',
        'YR030',
        'G420',
        'CG050',
        'NG03',
        'PB1',
        'Y7',
        'R10',
        'YR2',
        'R6',
        '5110',
      ];
      const lines = [];
      let id = 0;
      caps.forEach((t, k) => {
        const me = ++id,
          x = 300 * (k % 6),
          y = 400 * Math.floor(k / 6);
        lines.push({
          id: me,
          look: 1,
          text: t,
          conf: 0.97,
          unsure: false,
          nameOf: 0,
          box: [x, y, 60, 30, 0],
        });
        if (t === '5110')
          lines.push({
            id: ++id,
            look: 1,
            text: 'Dark Suntan',
            conf: 0.97,
            unsure: false,
            nameOf: me,
            box: [x, y + 30, 80, 20, 0],
          });
      });
      lines.forEach((it) => ocrLine(r, it));
      ocrDone(r, { lines: lines, stat: {}, ms: 1, aborted: false });
      clearTimeout(r.soon);
      ocrRun = null;
      scanSaveList();
      scanRender();
    });
  }
  const row = (page) =>
    page.$$eval(
      '#scList li',
      (ls) => ls.map((l) => l.textContent.replace(/\s+/g, ' ').trim()).find((t) => /YR312/.test(t)) || '',
    );
  test('a code put right by its name: listed, "read as" on its row, kept through a reload', async () => {
    const { page, errors } = await openApp({ width: 820, height: 1180, storage: stored });
    await idle(page);
    await scanFromMarkers(page);
    await idle(page);
    await read(page);
    await idle(page);
    assert.match(await row(page), /read as “5110”/);
    await page.reload();
    await idle(page);
    await scanFromMarkers(page);
    await idle(page);
    assert.match(await row(page), /read as “5110”/, 'after a reload');
    assert.deepEqual(errors, []);
  });
}

// ---- from v31821-where.test.mjs ----
// v318.21 Scan, in the browser: "Where in the photo?" under a question's close-up flips it to the whole photo with the
// cap ringed and words for where it is ("Near the top left · beside …"); a tap on the photo flips back. The photo is
// kept with its question through a reload, and goes with its last question. Fails on v318.20.
{
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
    assert.equal(await page.textContent('.sczwhere'), 'Back to the close-up');
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
}

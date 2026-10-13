// v318: Scan's Read a photo of your caps, with the real reader on a synthetic tray (drawn here: no photo of anyone's is
// in the repo). The card and its consent; the download into a cache of its own, checked, resumed after a cut; a photo
// read into the list as it's read; Undo this photo; Stop; the worker ended as Scan closes. Fails on v317.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, openApp, idle } from './helpers.mjs';

before(setup);
after(teardown);

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
    /^Read your caps from photosThe reader works on this device: your photos never leave it\. It’s a one-time download of about 22 MB, kept for offline use\./,
  );
  assert.equal(await page.textContent('#scTitle'), 'Read photos of your caps');
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
  await page.waitForFunction(() => scanList.length >= 3 && ocrRun && !ocrRun.done, null, { timeout: 60000 });
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
  // again (the reader known to be stored: the card's tap goes straight to the photo), and Done
  await read(page, t, '#ocrOpen');
  await page.waitForSelector('#ocrDone', { timeout: 120000 });
  await page.click('#ocrDone');
  await idle(page);
  assert.match(await page.textContent('#scStat'), /^✓From the photo: \d+ added to the list/);
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
  assert.equal(await page.textContent('#ocrSay'), '1 photo: no new codes read · stopped');
  assert.equal(await page.$('#ocrUndo'), null);
  await page.click('#ocrDone');
  await idle(page);
  assert.match(await page.textContent('#scStat'), /From 1 photo: nothing new/);
  assert.deepEqual(await list(page), []);
  assert.deepEqual(errors, []);
});

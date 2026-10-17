// v318.9: a photo whose codes are small in it is read again closer, with the real reader on drawn trays (nothing of
// anyone's): told so by the first look, the photo decoded again at its own size (up to 4096 px) and read with the
// detector at 3200 in 16 strips; said on screen. Not a photo no bigger than 2560 px, nor one of large codes. Stop during
// the closer read; out of memory in it, the 2048 copy read again gently; two photos at once, the first read closer.
// Fails on v318.8 (one read, at 2048).
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, openApp, idle } from './helpers.mjs';

before(setup);
after(teardown);

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
      while (f > 6 && g.measureText(c.name).width > R * 1.8) g.font = --f + 'px Helvetica, Arial, sans-serif';
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
    const pm = Worker.prototype.postMessage;
    Worker.prototype.postMessage = function (m, t) {
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
  await page.waitForFunction(
    () => {
      const b = document.getElementById('ocrStop');
      if (!b || window.__reads.length < 2 || !ocrRun || !ocrRun.sent) return false;
      window.__stopAt = performance.now();
      b.click();
      return true;
    },
    null,
    { timeout: 120000, polling: 50 },
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
  await page.waitForSelector('#ocrDone', { timeout: 240000 });
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
  await page.waitForFunction(
    () => /^Photo 2 of 2 · /.test(document.getElementById('ocrSay').textContent),
    null,
    {
      timeout: 240000,
    },
  );
  await page.waitForSelector('#ocrDone', { timeout: 240000 });
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

// v318 review (adding markers, 8): the photo reader's card widens to 760 px only when that shows the photo 500 px wide,
// for the codes over its boxes: a photo taken upright on an iPad held sideways is as narrow either way, so the card
// stays as it was; turned upright, it widens. Fails on v318.
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

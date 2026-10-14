// v318 review: Save image with its codes, for a narrow picture (the sample is 568 px wide), is saved up to twice its
// size, about 1100 px wide, its codes and key drawn at that size (sharp) and the same codes placed as before; a picture
// that wide already (a page of the person's own, 1600 px or more on its long side) is saved as it was; the picture
// without its codes (its card) is unchanged.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, openApp, idle, sampleGuide, letterGuide } from './helpers.mjs';

before(setup);
after(teardown);

// the saved image's size, and each code's text, where, and its size on the image as saved
const saved = (page, noCodes = false) =>
  page.evaluate((noCodes) => {
    const P = CanvasRenderingContext2D.prototype,
      of = P.fillText,
      log = [];
    P.fillText = function (t, x, y) {
      const m = this.getTransform();
      log.push({
        t: String(t),
        y: y * m.d + m.f,
        fs: parseFloat(/(\d+(\.\d+)?)px/.exec(this.font)[1]) * m.a,
      });
      return of.apply(this, arguments);
    };
    let c;
    try {
      c = __mstest.buildExportCanvas(false, noCodes);
    } finally {
      P.fillText = of;
    }
    const codes = new Set(Object.values(__mstest.assignData.assign).map((m) => m.code));
    return {
      w: c.width,
      h: c.height,
      W: __mstest.W,
      H: __mstest.H,
      placed: __mstest.exPlaced ? __mstest.exPlaced.boxes.length : 0,
      dropped: __mstest.exPlaced ? __mstest.exPlaced.dropped.length : 0,
      // (on the picture, not in the key under it)
      codes: log.filter((e) => codes.has(e.t) && e.y < (__mstest.H * c.width) / __mstest.W),
    };
  }, noCodes);

test('the sample saved with its codes is about 1100 px wide, its codes as placed before and none under 10 px', async () => {
  const { page, errors } = await openApp({ width: 820, height: 1180 });
  await sampleGuide(page);
  await idle(page);
  const r = await saved(page);
  assert.equal(r.W, 568, 'the sample is 568 px wide');
  assert.ok(r.w >= 1090 && r.w <= 1136, `saved ${r.w} px wide (568 before)`);
  const k = r.w / r.W;
  assert.ok(Math.abs(r.h / k - Math.round(r.h / k)) < 1, 'the whole image, key and all, at the same scale');
  // (the same placing as at its own size: v304-export's checks of it still hold)
  assert.ok(r.placed > 100 && r.dropped > 0, `${r.placed} codes placed, ${r.dropped} dots`);
  assert.ok(
    r.codes.every((e) => e.fs >= 10 * k - 0.01),
    'each code at least 10 picture px, drawn at the larger size',
  );
  // the picture without codes is the card, as before
  const off = await saved(page, true);
  assert.equal(off.w, 568, 'without codes: the picture at its own size, for its card');
  assert.deepEqual(errors, []);
});

test('a page of the person’s own, wide enough already, is saved at its own size', async () => {
  const { page, errors } = await openApp({
    width: 820,
    height: 1180,
    storage: { 'ms-onboarded': '1', 'ms-setup-tip': '1' },
  });
  await page.click('#mSections');
  await idle(page);
  await letterGuide(page);
  const r = await saved(page);
  assert.ok(r.W >= 1100, `the page is ${r.W} px wide`);
  assert.equal(r.w, r.W, 'saved at its own width');
  assert.deepEqual(errors, []);
});

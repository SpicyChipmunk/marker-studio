// v318 review: with larger text on a phone the Plan's pinned picture shrinks to a lower floor (45% of the screen at the
// usual size, about 40% at 1.3×, 36% at 1.6×), so the tabs' panel keeps several rows of its larger controls; the usual
// size, an iPad and Colour along are as they were.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, openAtScale, idle, sampleGuide, notOnWebKit, WK } from './helpers.mjs';

before(setup);
after(teardown);

const pinned = (page) =>
  page.evaluate(
    () =>
      new Promise((res) => {
        scrollTo(0, 600);
        requestAnimationFrame(() =>
          requestAnimationFrame(() => {
            const pic = document.getElementById('sfCanvas').getBoundingClientRect(),
              tabs = document.querySelector('.sftabs').getBoundingClientRect(),
              bar = [...document.querySelectorAll('.sfbar')].find((b) => b.getClientRects().length).getBoundingClientRect();
            res({ pic: pic.height / innerHeight, panel: bar.top - tabs.bottom });
          }),
        );
      }),
  );

for (const [scale, w, h, lo, hi] of [
  [1, 390, 844, 0.44, 0.46],
  [1.3, 390, 844, 0.38, 0.41],
  [1.6, 390, 844, 0.34, 0.37],
  [1.6, 820, 1180, 0.49, 0.51],
]) {
  test(`${w}×${h} at ${scale}× text: the Plan's picture pinned at ${Math.round(lo * 100)}–${Math.round(hi * 100)}% of the screen`, notOnWebKit(WK.font), async () => {
    const { page, errors } = await openAtScale(scale, { width: w, height: h });
    await sampleGuide(page);
    await idle(page);
    const r = await pinned(page);
    assert.ok(r.pic >= lo && r.pic <= hi, `the picture: ${(r.pic * 100).toFixed(1)}%`);
    // (314px before, at either size)
    if (scale > 1 && w < 700) assert.ok(r.panel >= 340, `the panel: ${Math.round(r.panel)}px`);
    // Colour along keeps its own size
    await page.click('#sfColor');
    await idle(page);
    const a = await page.evaluate(() => document.getElementById('sfCanvas').getBoundingClientRect().height / innerHeight);
    assert.ok(a >= 0.44, `Colour along: ${(a * 100).toFixed(1)}%`);
    assert.deepEqual(errors, []);
  });
}

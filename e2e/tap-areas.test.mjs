// v318 review: small tap areas found on a touch walk-through, each now 44px where the layout has room: Pattern's + Zone,
// Codes on the saved image, Markers' Swatch chart ↓ under Add markers, and Palette's colour counts (44px wide on an
// iPad; on a phone, where seven of them and the label fill the row, their tap areas meet with no gap between).
// Measured the way a finger finds them: the points where the page hands a tap to the control.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, openApp, idle, sampleGuide } from './helpers.mjs';

before(setup);
after(teardown);

// the tap area's width along the control's middle row and height along its middle column (1px steps, 30px round it);
// a checkbox counts its label
const tapArea = (page, sel) =>
  page.evaluate((sel) => {
    const e = document.querySelector(sel);
    e.scrollIntoView({ block: 'center', behavior: 'instant' });
    const r = e.getBoundingClientRect(),
      cx = (r.left + r.right) / 2,
      cy = (r.top + r.bottom) / 2,
      mine = (h) => !!h && (h === e || e.contains(h) || [...(e.labels || [])].some((l) => l.contains(h)));
    let w = 0,
      h = 0;
    for (let y = r.top - 30; y <= r.bottom + 30; y++) if (mine(document.elementFromPoint(cx, y))) h++;
    for (let x = r.left - 30; x <= r.right + 30; x++) if (mine(document.elementFromPoint(x, cy))) w++;
    return { w, h };
  }, sel);

test('the guide: + Zone and Codes on the saved image are 44px tall to a tap', async () => {
  const { page, errors } = await openApp();
  await sampleGuide(page);
  await idle(page);
  await page.click('#sfTab-pattern');
  await idle(page);
  const z = await tapArea(page, '#sfZoneAdd');
  assert.ok(z.h >= 44, `+ Zone: ${z.h}px tall to a tap (35 before)`);
  // (and the first pattern choice under it keeps its own: the zone's area doesn't reach into it)
  const g = await tapArea(page, '#sfPanel-pattern .sfedit');
  assert.ok(g.h >= 40, `the pattern choice under it: ${g.h}px`);
  await page.click('#sfTab-share');
  await idle(page);
  const c = await tapArea(page, '#sfExCodes');
  assert.ok(c.h >= 44, `Codes on the saved image: ${c.h}px tall to a tap (24 before)`);
  assert.deepEqual(errors, []);
});

test('Markers: Swatch chart ↓ under Add markers is a 44px tap area, not tucked under the button', async () => {
  const { page, errors } = await openApp();
  await sampleGuide(page);
  await page.click('#mCollection');
  await idle(page);
  assert.ok(await page.isVisible('#mkAddBtn'), 'Add markers shows (a set is owned)');
  const j = await tapArea(page, '#mkJump');
  assert.ok(j.h >= 44, `Swatch chart: ${j.h}px tall to a tap (32 before)`);
  const a = await tapArea(page, '#mkAddBtn');
  assert.ok(a.h >= 44, `Add markers keeps its own: ${a.h}px`);
  assert.deepEqual(errors, []);
});

for (const [width, height, wide] of [
  [390, 844, false],
  [820, 1180, true],
]) {
  test(`Palette's colour counts at ${width}px: ${wide ? '44px wide' : 'tap areas that meet'}`, async () => {
    const { page, errors } = await openApp({
      width,
      height,
      storage: { 'ms-onboarded': '1', 'ms-setup-tip': '1' },
    });
    await page.click('#mPalette');
    await idle(page);
    const r = await page.evaluate(() => {
      const bs = [...document.querySelectorAll('#segs button')].filter((b) => b.getClientRects().length);
      bs[0].scrollIntoView({ block: 'center', behavior: 'instant' });
      const a = bs[0].getBoundingClientRect(),
        z = bs[bs.length - 1].getBoundingClientRect(),
        y = (a.top + a.bottom) / 2;
      let miss = 0;
      for (let x = a.left; x < z.right; x++) if (!bs.includes(document.elementFromPoint(x, y))) miss++;
      return { n: bs.length, w: Math.min(...bs.map((b) => b.getBoundingClientRect().width)), miss };
    });
    assert.equal(r.n, 7);
    assert.equal(r.miss, 0, 'every point along the row is one of the counts');
    if (wide) assert.ok(r.w >= 44, `each is ${r.w}px wide`);
    const fits = await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth);
    assert.ok(fits, 'the page is no wider than the screen');
    assert.deepEqual(errors, []);
  });
}

// v318 review: in the Plan a toast (Surprise's, 8 seconds with its Undo) sits over the foot of the picture, just above
// its tool row, not over the tabs and their controls: on a phone it had covered the whole tab bar, on an iPad held
// sideways Colours from. Held sideways, it stays inside the picture's own column.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, openApp, idle, sampleGuide } from './helpers.mjs';

before(setup);
after(teardown);

const overlaps = (a, b) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
const where = (page) =>
  page.evaluate(() => {
    const R = (e) => (e ? e.getBoundingClientRect().toJSON() : null);
    return {
      toast: R(document.getElementById('msToast')),
      tabs: R(document.querySelector('.sftabs')),
      tools: R(document.getElementById('sfZoomCtl')),
      pic: R(document.getElementById('sfPicBox')),
      ctl: [...document.querySelectorAll('#sfCtl button, #sfCtl input, #sfCtl select')]
        .filter((b) => b.getClientRects().length && !b.closest('.sftab:not(.on)'))
        .map(R),
    };
  });

for (const [w, h, side] of [
  [390, 844, false],
  [820, 1180, false],
  [1180, 820, true],
]) {
  test(`${w}×${h}: Surprise's toast is over the picture's foot, clear of the tabs and the controls`, async () => {
    const { page, errors } = await openApp({ width: w, height: h });
    await sampleGuide(page);
    await idle(page);
    await page.click('#sfSurprise');
    await page.waitForSelector('#msToast.on');
    await idle(page, 100);
    const r = await where(page);
    assert.match(await page.textContent('#msToast'), /^Surprise: /);
    assert.ok(!overlaps(r.toast, r.tabs), 'not over the tabs');
    assert.ok(!r.ctl.some((c) => overlaps(r.toast, c)), 'not over any control of the Plan');
    assert.ok(r.toast.bottom <= (side ? r.pic.bottom : r.tools.top) + 1, 'above the tool row (sideways: the picture’s foot)');
    assert.ok(r.toast.top >= r.pic.top, 'within the picture');
    if (side) assert.ok(r.toast.left >= r.pic.left - 1 && r.toast.right <= r.pic.right + 1, 'inside the picture’s column');
    assert.deepEqual(errors, []);
  });
}

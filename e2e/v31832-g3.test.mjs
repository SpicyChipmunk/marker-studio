// v318.32 (G3) in the browser: "Start the palette from" on an iPad shows its markers, not 2 px slivers under the
// search box. Safari's engine sized the auto rows of the scrolling marker grid (a flex item of the card) to nothing
// at 820 x 1180 and 1180 x 820 until something relaid the page (a screenshot, a turn); on the iPad itself nothing did.
// Fails on v318.31's HEAD in WebKit (the rows measure 0 before any relayout); Chromium never squashed them.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, openApp, idle, frames } from './helpers.mjs';

before(setup);
after(teardown);

// the first marker's height and the grid's rows as laid out now (no screenshot or scroll first: those relaid the page
// and hid the fault)
const rows = (page) =>
  page.evaluate(() => {
    const g = document.getElementById('seedGrid'),
      c = g.querySelector('.cell');
    return {
      cell: Math.round(c.getBoundingClientRect().height),
      row: parseFloat(getComputedStyle(g).gridTemplateRows.split(' ')[0]),
      n: g.querySelectorAll('.cell').length,
      scrolls: g.scrollHeight > g.clientHeight,
      randomIn: document.getElementById('seedRandom').getBoundingClientRect().bottom <= innerHeight,
    };
  });

for (const [w, h, name] of [
  [820, 1180, 'iPad portrait'],
  [1180, 820, 'iPad landscape'],
]) {
  test(`Start the palette from on an ${name} (${w} x ${h}, touch): every marker its full height, the grid scrolling, Random base in view; still so after turning`, async () => {
    const { page, errors } = await openApp({ width: w, height: h, touch: true });
    await page.click('#wcSkip');
    await page.click('#wcLook');
    await page.click('#mPalette');
    await idle(page);
    await page.click('#seedBtn');
    await page.waitForSelector('#seedOverlay.on');
    await idle(page);
    let r = await rows(page);
    assert.ok(r.n > 100, 'every marker to pick from with an empty collection');
    assert.ok(r.cell >= 40, `a marker card ${r.cell} px tall (its swatch alone is 36): rows of ${r.row} px`);
    assert.ok(r.scrolls, 'the grid scrolls');
    assert.ok(r.randomIn, 'Random base stays in view under the grid');
    // turning the iPad with the dialog open
    await page.setViewportSize({ width: h, height: w });
    await frames(page, 2);
    r = await rows(page);
    assert.ok(r.cell >= 40, `after turning: a marker card ${r.cell} px tall, rows of ${r.row} px`);
    assert.ok(r.randomIn, 'after turning: Random base in view');
    await page.setViewportSize({ width: w, height: h });
    await frames(page, 2);
    r = await rows(page);
    assert.ok(r.cell >= 40, `turned back: a marker card ${r.cell} px tall, rows of ${r.row} px`);
    // the same grid as "Choose a marker" for a Custom slot
    await page.click('#seedClose');
    await idle(page);
    await page.click('#harm [data-h="custom"]');
    await idle(page);
    await page.click('#bands .band');
    await page.waitForSelector('#seedOverlay.on');
    await idle(page);
    assert.equal(await page.textContent('#pickTitle'), 'Choose a marker');
    r = await rows(page);
    assert.ok(r.cell >= 40, `Choose a marker: a marker card ${r.cell} px tall, rows of ${r.row} px`);
    assert.deepEqual(errors, []);
  });
}

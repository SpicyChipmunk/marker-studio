// v313 (Colour along): D1, more of the marker list on the first screen. On an iPad held upright the order chips and the
// code box share one row; on a phone, once the first-time instructions have been seen, Colour along opens with the
// order chips just under the picture's tool row (the picture keeps its size). Each test fails on v312.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, openApp, sampleGuide, idle } from './helpers.mjs';

before(setup);
after(teardown);

const along = async (page) => {
  await page.click('#sfColor');
  await idle(page);
  await page.waitForTimeout(150);
};
const back = async (page) => {
  await page.click('#sfDoneBtn');
  await idle(page);
};
// where things are on the screen
const rects = (page) =>
  page.evaluate(() => {
    const r = (s) => {
      const e = document.querySelector(s);
      if (!e) return null;
      const b = e.getBoundingClientRect();
      return { top: b.top, bottom: b.bottom, left: b.left, right: b.right, h: b.height };
    };
    const bar = document.querySelector('#sfRoot .sfbar');
    const barTop = bar.getBoundingClientRect().top;
    const rows = [...document.querySelectorAll('#sfAlist .sfarow .sfah')].filter((x) => {
      const b = x.getBoundingClientRect();
      return b.height > 20 && b.top >= 0 && b.bottom <= barTop + 1;
    }).length;
    return {
      sort: r('#sfAlSort'),
      find: r('#sfFind .sffindf'),
      pic: r('#sfView'),
      pinH: parseFloat(document.documentElement.style.getPropertyValue('--pinH')) || 0,
      barTop,
      rows,
      y: scrollY,
    };
  });

test('an iPad held upright: the order chips and the code box on one row, and the picture as big as before', async () => {
  const { page, errors } = await openApp({ width: 820, height: 1180 });
  await sampleGuide(page);
  await along(page);
  const r = await rects(page);
  assert.ok(r.find && r.sort, JSON.stringify(r));
  assert.ok(r.find.left > r.sort.right, 'the code box beside the chips');
  assert.ok(Math.abs(r.find.bottom - r.sort.bottom) < 6, 'on one row: ' + JSON.stringify([r.find, r.sort]));
  assert.deepEqual(errors, []);
});

test('a phone: Colour along opens with the order chips just under the picture’s tool row once its instructions are seen (the first time, as before)', async () => {
  for (const [w, h] of [
    [390, 844],
    [430, 932],
  ]) {
    const { page, errors } = await openApp({ width: w, height: h });
    await sampleGuide(page);
    await along(page);
    // the first time: the instructions show, as before
    assert.ok(await page.isVisible('#sfAlHint'), 'the first-time instructions');
    const r0 = await rects(page);
    assert.ok(r0.sort.top > r0.pinH + 30, 'not scrolled past them');
    // a row opened: seen
    await page.locator('#sfAlist .sfarow .sfah').first().click();
    await idle(page);
    await back(page);
    await along(page);
    const r = await rects(page);
    assert.ok(
      Math.abs(r.sort.top - (r.pinH + 8)) <= 4,
      `${w}: chips under the tool row: ${JSON.stringify(r)}`,
    );
    assert.ok(r.rows >= 3, `${w}: ${r.rows} marker rows above the bar`);
    // the ⓘ line is a scroll up
    await page.evaluate(() => scrollBy(0, -200));
    await page.waitForTimeout(100);
    assert.ok(await page.isVisible('#sfCtl .sfinfo'), 'the ⓘ line above');
    assert.deepEqual(errors, []);
    await page.context().close();
  }
});

test('a marker just finished: its row’s “All N coloured ✓” lights up for a moment; not on opening the list again', async () => {
  const { page, errors } = await openApp({ width: 820, height: 1180 });
  await sampleGuide(page);
  await along(page);
  await page.locator('#sfAlist .sfarow .sfah').first().click();
  await idle(page);
  const k = await page.getAttribute('#sfAlist .sfarow.open', 'data-k');
  await page.click('#sfMarkAll');
  await idle(page);
  const row = `#sfAlist .sfarow[data-k="${k}"]`;
  assert.match(await page.textContent(row + ' .cnt'), /^All \d+ coloured/);
  assert.ok(
    await page.evaluate((s) => document.querySelector(s).classList.contains('sfaflash'), row),
    'lit up',
  );
  // the others don't
  assert.equal(await page.locator('#sfAlist .sfaflash').count(), 1);
  // opening the list again: it's in Done, not lit
  await back(page);
  await along(page);
  assert.equal(await page.locator('#sfAlist .sfaflash').count(), 0);
  assert.deepEqual(errors, []);
});

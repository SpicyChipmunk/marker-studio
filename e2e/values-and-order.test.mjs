// v278: Values (the picture in greys, a view only), Colour along's list lightest first, Find next along the same
// path as focus mode, and the Sections screen asking for a rebuild only when the kept sections change.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, openApp, sampleGuide, idle, scrollTop, buildGo } from './helpers.mjs';

before(setup);
after(teardown);

const vals = (page) => page.evaluate(() => { const b = document.getElementById('sfVals'); return { shown: !!b && b.style.display !== 'none' && b.getClientRects().length > 0, pressed: b && b.getAttribute('aria-pressed'), filter: getComputedStyle(document.getElementById('sfCanvas')).filter }; });

test('Values shows the picture in greys, in the guide and Colour along; not in the sections editor, and not saved', async () => {
  const { page, errors } = await openApp();
  await sampleGuide(page); await idle(page);
  const saved0 = await page.evaluate(() => JSON.stringify(__mstest.currentDesignObj().payload.style));
  assert.deepEqual(await vals(page), { shown: true, pressed: 'false', filter: 'none' });
  await page.click('#sfVals'); await idle(page);
  assert.deepEqual(await vals(page), { shown: true, pressed: 'true', filter: 'grayscale(1)' });
  assert.equal(await page.evaluate(() => JSON.stringify(__mstest.currentDesignObj().payload.style)), saved0, 'a view only: the guide is unchanged');
  assert.equal(await page.evaluate(() => __mstest.planCount), 0, 'not an Undo step');
  // Colour along keeps it
  await page.click('#sfColor'); await idle(page);
  assert.deepEqual(await vals(page), { shown: true, pressed: 'true', filter: 'grayscale(1)' });
  // the sections editor's colours are a map: no Values there, and its colours show
  await page.click('#sfDoneBtn'); await idle(page);
  await page.click('#sfBack2'); await idle(page);
  const r = await vals(page);
  assert.equal(r.shown, false); assert.equal(r.filter, 'none');
  // and back on the guide it's still on (until turned off)
  await buildGo(page); await idle(page);
  assert.deepEqual(await vals(page), { shown: true, pressed: 'true', filter: 'grayscale(1)' });
  await page.click('#sfVals'); await idle(page);
  assert.deepEqual(await vals(page), { shown: true, pressed: 'false', filter: 'none' });
  assert.deepEqual(errors, []);
});

test('Colour along lists its markers lightest first; Find next goes through a marker the way focus mode does', async () => {
  const { page, errors } = await openApp();
  await sampleGuide(page); await idle(page);
  await page.click('#sfColor'); await idle(page); await scrollTop(page);
  // (each row's marker, lightness by the same measure focus mode sorts by: Rec. 601 luma of its hex)
  const lums = await page.$$eval('#sfAlist .sfarow', (rs) => rs.map((r) => { const m = Object.values(__mstest.assignData.assign).find((x) => x.mkey === r.dataset.k), h = m.hex; return [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)).reduce((s, v, i) => s + v * [0.299, 0.587, 0.114][i], 0); }));
  assert.ok(lums.length > 5);
  for (let i = 1; i < lums.length; i++) assert.ok(lums[i] <= lums[i - 1] + 1e-9, `row ${i} is not lighter than row ${i - 1}`);
  // a marker with several sections: Find next goes along its path (topmost first, then the nearest), skipping ticked ones
  const i = await page.$$eval('#sfAlist .sfarow .cnt', (c) => c.findIndex((x) => /of ([4-9]|\d\d)/.test(x.textContent)));
  assert.ok(i >= 0);
  await page.locator('#sfAlist .sfarow .sfah').nth(i).click(); await idle(page);
  const path = await page.evaluate(() => __mstest.hlPath());
  assert.ok(path.length >= 4);
  // (tick the second one: Find next passes over it)
  await page.evaluate((l) => { __mstest.colored[l] = 1; }, path[1]);
  const seen = [];
  for (let k = 0; k < path.length - 1; k++) {
    await page.click('#sfFindNext'); await idle(page);
    seen.push(await page.evaluate(() => __mstest.fnLast));
  }
  assert.deepEqual(seen, path.filter((l, j) => j !== 1), 'along the path, and round again');
  assert.deepEqual(errors, []);
});

test('the Sections screen asks for a rebuild only when the smallest-section slider changes which sections are kept', async () => {
  const { page, errors } = await openApp();
  await sampleGuide(page); await idle(page);
  await page.click('#sfBack2'); await idle(page);
  const warned = () => page.evaluate(() => /Section edits not saved/.test(document.getElementById('sfRoot').textContent));
  const set = (v) => page.evaluate((v) => { const el = document.getElementById('sfMin'); el.value = String(v); el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); }, v);
  assert.equal(await warned(), false);
  // a notch either way keeps the same 166 sections
  await set(31); await idle(page); assert.equal(await warned(), false, 'a nudge that keeps the same sections');
  await set(29); await idle(page); assert.equal(await warned(), false);
  // far enough to drop some: that's an edit to build
  await set(60); await idle(page); assert.equal(await warned(), true, 'some sections dropped');
  await set(30); await idle(page); assert.equal(await warned(), false, 'back where it was built');
  assert.deepEqual(errors, []);
});

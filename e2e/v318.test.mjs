// v318: a new collection with less typing. After a set on the welcome, "Some are missing" opens the chart with the
// set's markers ticked, to untick the few lost or used up; it isn't offered after caps or the chart alone. Fails on v317.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, openApp, idle } from './helpers.mjs';

before(setup);
after(teardown);

const shown = (page, id) =>
  page.evaluate((id) => document.getElementById(id).getClientRects().length > 0, id);

test('a set on the welcome, then Some are missing: the chart with its markers ticked; two unticked, saved, removed', async () => {
  const { page, errors } = await openApp({ width: 820, height: 1180 });
  await page.click('#wcHaveSet');
  await page.check('#wcSets input[data-i="3"]');
  await page.click('#wcAdd');
  await idle(page);
  assert.equal(await page.textContent('#wcT2'), '120 markers added');
  assert.ok(await shown(page, 'wcMoreMiss'), 'offered after a set');
  assert.match(await page.textContent('#wcMoreMiss'), /Some are missing.*Untick them on a chart/);
  await page.click('#wcMoreMiss');
  await idle(page);
  assert.ok(await shown(page, 'chGrid'), 'the chart');
  const two = await page.$$eval('#chGrid .chsw[aria-pressed="true"]', (l) =>
    l.slice(0, 2).map((b) => b.dataset.i),
  );
  assert.equal(two.length, 2, 'the set’s markers ticked');
  for (const i of two) await page.click(`#chGrid .chsw[data-i="${i}"]`);
  assert.equal(await page.textContent('#chSave'), 'Remove 2');
  await page.click('#chSave');
  await idle(page);
  assert.equal(await page.evaluate(() => state.owned.size), 119);
  assert.equal(await page.textContent('#wcT2'), '2 markers removed');
  assert.ok(await shown(page, 'wcMoreMiss'), 'still offered, for more');
  // the toast's Undo: both back, and the card as it was
  await page.click('#toastAct');
  await idle(page);
  assert.equal(await page.evaluate(() => state.owned.size), 121);
  assert.equal(await page.textContent('#wcT2'), '120 markers added');
  assert.ok(await shown(page, 'wcMoreMiss'));
  assert.deepEqual(errors, []);
});

test('caps or the chart alone: no Some are missing; the set’s Undo takes it away again', async () => {
  const { page, errors } = await openApp({ width: 820, height: 1180 });
  await page.click('#wcOneByOne');
  await page.click('#wcOneType');
  for (const c of ['R014', 'BG314']) {
    await page.fill('#scBox', c);
    await page.press('#scBox', 'Enter');
  }
  await page.click('#scAdd');
  await idle(page);
  assert.equal(await page.textContent('#wcT2'), '2 markers added');
  assert.equal(await shown(page, 'wcMoreMiss'), false, 'not after caps');
  // then a set from Anything else, and its Undo
  await page.click('#wcMoreSet');
  await page.check('#wcSets input[data-i="3"]');
  await page.click('#wcAdd');
  await idle(page);
  assert.ok(await shown(page, 'wcMoreMiss'), 'after the set');
  await page.click('#toastAct');
  await idle(page);
  assert.equal(await page.evaluate(() => state.owned.size), 2);
  assert.ok(await shown(page, 'wcStep1'), 'back on the list it was added from');
  await page.click('#wcStep1 .wcback');
  await idle(page);
  assert.equal(await page.textContent('#wcT2'), '2 markers added');
  assert.equal(await shown(page, 'wcMoreMiss'), false, 'the set taken back out');
  assert.deepEqual(errors, []);
});

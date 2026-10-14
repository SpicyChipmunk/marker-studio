// v318 review (adding markers, 2): Some are missing (the welcome, after a set) opens the chart on your markers only,
// titled to untick the lost ones; an unticked one stays where it was, faded; None are missing closes it; Show all colours
// gives every colour back. Markers' own chart is as it was. Fails on v318.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, openApp, idle, chartFromMarkers } from './helpers.mjs';

before(setup);
after(teardown);

const shown = (page, id) =>
  page.evaluate((id) => document.getElementById(id).getClientRects().length > 0, id);
const swatches = (page) =>
  page.$$eval('#chGrid .chsw', (l) =>
    l.map((b) => ({ i: +b.dataset.i, on: b.getAttribute('aria-pressed') === 'true' })),
  );

test('Some are missing: only your markers, untick the lost, Remove; None are missing; Show all colours', async () => {
  const { page, errors } = await openApp({ width: 390, height: 844 });
  await page.click('#wcHaveSet');
  await page.check('#wcSets input[data-i="3"]');
  await page.click('#wcAdd');
  await idle(page);
  await page.click('#wcMoreMiss');
  await idle(page);
  assert.equal(await page.textContent('#chTitle'), 'Untick any you’ve lost');
  assert.equal(await shown(page, 'chBrand'), false, 'one brand: no brand buttons');
  let sw = await swatches(page);
  assert.ok(sw.length > 3 && sw.every((s) => s.on), 'only the markers you have, all ticked');
  assert.ok(
    await page.evaluate(
      (is) => is.every((i) => state.owned.has(mkey(i))),
      sw.map((s) => s.i),
    ),
  );
  // nothing unticked: the button closes, all there
  assert.equal(await page.textContent('#chSave'), 'None are missing');
  assert.equal(await page.isEnabled('#chSave'), true);
  await page.click('#chSave');
  await idle(page);
  assert.equal(await shown(page, 'chGrid'), false, 'closed');
  assert.equal(await page.textContent('#wcT2'), '120 markers added', 'nothing changed');
  // again: two unticked stay in place, faded; Remove 2
  await page.click('#wcMoreMiss');
  await idle(page);
  await page.click(`#chGrid .chsw[data-i="${sw[0].i}"]`);
  await page.click(`#chGrid .chsw[data-i="${sw[2].i}"]`);
  const after1 = await swatches(page);
  assert.deepEqual(
    after1.map((s) => s.i),
    sw.map((s) => s.i),
    'the swatches stay where they were',
  );
  assert.equal(
    await page.$eval(`#chGrid .chsw[data-i="${sw[0].i}"] i`, (e) => getComputedStyle(e).opacity),
    '0.3',
  );
  assert.equal(await page.textContent('#chSave'), 'Remove 2');
  // Show all colours: every red, the two unticked still unticked
  await page.click('#chAll');
  assert.equal(await page.textContent('#chTitle'), 'Tick the colours you have');
  sw = await swatches(page);
  assert.ok(sw.length > after1.length && sw.some((s) => !s.on), 'every colour');
  assert.equal(await page.textContent('#chSave'), 'Remove 2');
  await page.click('#chSave');
  await idle(page);
  assert.equal(await page.textContent('#wcT2'), '2 markers removed');
  assert.deepEqual(errors, []);
});

test('Markers’ chart: every colour, as before', async () => {
  const { page, errors } = await openApp({
    width: 820,
    height: 1180,
    storage: { 'ms-onboarded': '1', 'ms-setup-tip': '1' },
  });
  await chartFromMarkers(page);
  assert.equal(await page.textContent('#chTitle'), 'Tick the colours you have');
  assert.equal(await shown(page, 'chAll'), false);
  assert.equal(await page.isEnabled('#chSave'), false);
  assert.equal(await page.textContent('#chSave'), 'Tick your colours');
  assert.deepEqual(errors, []);
});

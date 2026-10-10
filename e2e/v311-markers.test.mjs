// v311: Markers' Add markers. With a collection, + Add markers at the top opens a sheet (the welcome's card) with the
// ways to add (a set, Scan, the chart) and "Not sure which set you have? Find it from 3 caps"; with none yet, the same
// ways are in a card at the top. Find ends where it started: a set added closes the sheet with the usual message and
// Undo; "None of these" goes back to the ways. Clear collection is in ⋯.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, openApp, idle, openAtScale, pause } from './helpers.mjs';

before(setup);
after(teardown);

const KEY = 'ohuhu-hb320-picker-v3';
const coll = (owned) => ({
  'ms-onboarded': '1',
  'ms-setup-tip': '1',
  [KEY]: JSON.stringify({
    mode: 'collection',
    collView: 'owned',
    ownedSeedV: 2,
    copicAdd1: 1,
    libAdj1: 1,
    setFix1: 1,
    owned,
    saved: [],
  }),
});
const h48 = (page) => page.evaluate(() => presetMkeys(MARKER_SETS.find((p) => p.n === 'Honolulu 48')));
const shown = (page, id) =>
  page.evaluate((id) => {
    const e = document.getElementById(id);
    return !!e && e.getClientRects().length > 0;
  }, id);
const step = (page) =>
  page.evaluate(() =>
    document.getElementById('welcome').classList.contains('on')
      ? [...document.querySelectorAll('#welcome .wcstep')]
          .filter((e) => e.style.display !== 'none')
          .map((e) => e.id)[0]
      : null,
  );
const focused = (page) => page.evaluate(() => document.activeElement && document.activeElement.id);
async function scanCaps(page, codes) {
  for (const c of codes) {
    await page.fill('#scBox', c);
    await page.press('#scBox', 'Enter');
  }
  await page.click('#scAdd');
  await idle(page);
}
async function withH48(w = 820, h = 1180) {
  const a = await openApp({ width: w, height: h, storage: coll([]) });
  await a.page.evaluate(() => {
    presetMkeys(MARKER_SETS.find((p) => p.n === 'Honolulu 48')).forEach((k) => state.owned.add(k));
    save();
  });
  await a.page.reload();
  await idle(a.page);
  return a;
}

test('with a collection: + Add markers on the first screen opens the ways to add; Escape closes it, back on the button', async () => {
  for (const [w, h] of [
    [820, 1180],
    [1180, 820],
    [390, 844],
  ]) {
    const { page, errors, ctx } = await withH48(w, h);
    assert.ok(await shown(page, 'mkAddBtn'));
    assert.ok((await page.locator('#mkAddBtn').boundingBox()).y < h, w + ': on the first screen');
    assert.equal(await shown(page, 'mkAddCard'), false);
    await page.click('#mkAddBtn');
    await idle(page);
    assert.equal(await step(page), 'wcStepAdd');
    assert.equal(await page.textContent('#wcTA'), 'Add markers');
    assert.deepEqual(await page.$$eval('#wcAddWays .wcc b', (b) => b.map((x) => x.textContent)), [
      'Add a set you own',
      'Scan or type codes',
      'Tick colours on a chart',
    ]);
    assert.match(
      await page.textContent('#wcAddWays .mkfind'),
      /Not sure which set you have\? Find it from 3 caps/,
    );
    // (none of the welcome's first-run lines)
    assert.equal(await shown(page, 'wcSkip'), false);
    assert.equal(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      true,
      'no sideways scroll',
    );
    await page.keyboard.press('Escape');
    await idle(page);
    assert.equal(await step(page), null);
    assert.equal(await focused(page), 'mkAddBtn');
    assert.deepEqual(errors, []);
    await ctx.close();
  }
});

test('Add a set you own from the sheet: added with the message and Undo, the sheet closed; Back from the list to the ways', async () => {
  const { page, errors } = await withH48();
  await page.click('#mkAddBtn');
  await page.click('#mkaSet');
  await idle(page);
  assert.equal(await step(page), 'wcStep1');
  // Back: the ways again
  await page.click('#wcStep1 .wcback');
  assert.equal(await step(page), 'wcStepAdd');
  await page.click('#mkaSet');
  const n0 = await page.evaluate(() => state.owned.size);
  // (what Honolulu 120 brings that Honolulu 48 didn't)
  const add = await page.evaluate(
    () => presetMkeys(MARKER_SETS[3]).filter((k) => !state.owned.has(k)).length,
  );
  assert.ok(add >= 72, 'new: ' + add);
  await page.check('#wcSets input[data-i="3"]'); // Honolulu 120
  await page.click('#wcAdd');
  await idle(page);
  assert.equal(await step(page), null, 'closed, no "Anything else?"');
  assert.equal(await page.evaluate(() => state.owned.size), n0 + add);
  assert.match(
    await page.textContent('#msToast'),
    new RegExp('^Added ' + add + ' markers to your collection'),
  );
  assert.equal(await focused(page), 'mkAddBtn');
  await page.click('#toastAct');
  await idle(page);
  assert.equal(await page.evaluate(() => state.owned.size), n0);
  assert.deepEqual(errors, []);
});

test('Find it from 3 caps from the sheet: Yes adds the set (its blender said) and closes; None of these goes back to the ways', async () => {
  const { page, errors } = await openApp({ width: 820, height: 1180, storage: coll(['Ohuhu|Y06']) });
  await idle(page);
  await page.click('#mkAddBtn');
  await page.click('#mkaFind');
  await idle(page);
  assert.equal(await step(page), 'wcStepFind');
  await page.click('#wcFCount [data-n="3"]');
  await page.click('#wcFindNext');
  await idle(page);
  await scanCaps(page, ['R014', 'Y28', 'BG314']);
  assert.equal(await step(page), 'wcStepRes');
  assert.equal(await page.textContent('#wcFindNone'), 'None of these: other ways to add');
  await page.click('#wcFindNone');
  assert.equal(await step(page), 'wcStepAdd');
  // and again, to Yes
  await page.click('#mkaFind');
  await page.click('#wcFindNext');
  await idle(page);
  await scanCaps(page, ['R014', 'Y28', 'BG314']);
  await page.click('#wcFindYes');
  await idle(page);
  assert.equal(await step(page), null);
  assert.ok(await page.evaluate(() => state.owned.has('Ohuhu|0') && state.owned.has('Ohuhu|R014')));
  assert.match(await page.textContent('#msToast'), /^Added 1\d\d markers and a Colorless Blender/);
  assert.equal(await focused(page), 'mkAddBtn');
  // Scan's own list is as it was (Find's caps kept apart)
  assert.deepEqual(await page.evaluate(() => JSON.parse(localStorage.getItem('ms-scan-list') || '[]')), []);
  assert.deepEqual(errors, []);
});

test('a set found that is yours already: said so, nothing added', async () => {
  const { page, errors } = await withH48();
  const n0 = await page.evaluate(() => state.owned.size);
  await page.click('#mkAddBtn');
  await page.click('#mkaFind');
  await page.click('#wcFCount [data-n="1"]');
  await page.click('#wcFindNext');
  await idle(page);
  const caps = (await h48(page))
    .filter((k) => k !== 'Ohuhu|0')
    .slice(0, 3)
    .map((k) => k.split('|')[1]);
  await scanCaps(page, caps);
  assert.match(await page.textContent('#wcRes'), /Honolulu 48/);
  await page.click('#wcFindYes');
  await idle(page);
  assert.equal(await page.evaluate(() => state.owned.size), n0);
  assert.equal(await page.textContent('#msToast'), 'Honolulu 48 is already in your collection.');
  assert.deepEqual(errors, []);
});

test('Scan or the chart from the sheet: the sheet closes, the tool opens as always; closed, the keyboard on Add markers', async () => {
  const { page, errors } = await withH48();
  for (const [row, ov, x] of [
    ['#mkaScan', 'scanOverlay', '#scClose'],
    ['#mkaChart', 'chartOverlay', '#chClose'],
  ]) {
    await page.click('#mkAddBtn');
    await page.click(row);
    await idle(page);
    assert.equal(await step(page), null);
    assert.ok(await page.evaluate((id) => document.getElementById(id).classList.contains('on'), ov));
    await page.click(x);
    await idle(page);
    assert.equal(await focused(page), 'mkAddBtn', row);
  }
  assert.deepEqual(errors, []);
});

test('no markers yet: the ways in a card at the top; Find from it opens on its own, and Back closes it; the first set shows the top', async () => {
  const { page, errors } = await openApp({ width: 390, height: 844, storage: coll([]) });
  await idle(page);
  assert.ok(await shown(page, 'mkAddCard'));
  assert.equal(await shown(page, 'mkAddBtn'), false);
  assert.ok((await page.locator('#mkcSet').boundingBox()).y < 844, 'on the first screen');
  assert.match(
    await page.textContent('#findResults'),
    /Your collection is empty\. Add your markers above, or switch to All/,
  );
  await page.click('#mkcFind');
  await idle(page);
  assert.equal(await step(page), 'wcStepFind');
  await page.click('#wcStepFind .wcback');
  await idle(page);
  assert.equal(await step(page), null);
  assert.equal(await focused(page), 'mkcFind');
  // None of these, from Find opened on its own: the ways, Back from which closes
  await page.click('#mkcFind');
  await page.click('#wcFCount [data-n="3"]');
  await page.click('#wcFindNext');
  await idle(page);
  await scanCaps(page, ['R014']);
  await page.click('#wcFindNone');
  assert.equal(await step(page), 'wcStepAdd');
  await page.keyboard.press('Escape');
  await idle(page);
  assert.equal(await step(page), null);
  // a set from the card: the card goes, the top of the collection and Add markers
  await page.click('#mkcSet');
  await page.check('#wcSets input[data-i="1"]');
  await page.click('#wcAdd');
  await idle(page);
  assert.equal(await shown(page, 'mkAddCard'), false);
  assert.equal(await page.evaluate(() => scrollY), 0);
  assert.equal(await focused(page), 'mkAddBtn');
  assert.deepEqual(errors, []);
});

test('Clear collection in ⋯: the first tap asks with the menu open, a double tap doesn’t clear, the second clears; Undo', async () => {
  const { page, errors } = await withH48();
  const n0 = await page.evaluate(() => state.owned.size);
  await page.click('#mkMore');
  assert.deepEqual(
    await page.$$eval('#mkMenu button', (b) =>
      b.filter((x) => x.style.display !== 'none').map((x) => x.textContent.trim()),
    ),
    ['Untick all shown', 'Clear collection', 'Back up & restore (in the Library)'],
  );
  assert.match(await page.getAttribute('#mkMore', 'aria-label'), /Clear collection/);
  await page.dblclick('#mkClear');
  await idle(page);
  assert.equal(await page.evaluate(() => state.owned.size), n0, 'a double tap only asks');
  assert.ok(await page.isVisible('#mkMenu'));
  assert.match(await page.textContent('#mkClear'), /^Clear all \d+ markers\? Tap again$/);
  await pause(page, 450, 'its second tap, not a double tap');
  await page.click('#mkClear');
  await idle(page);
  assert.equal(await page.evaluate(() => state.owned.size), 0);
  assert.equal(await page.isVisible('#mkMenu'), false);
  assert.match(await page.textContent('#msToast'), new RegExp('^Cleared ' + n0 + ' markers'));
  assert.ok(await shown(page, 'mkAddCard'), 'the ways to add at the top again');
  await page.click('#toastAct');
  await idle(page);
  assert.equal(await page.evaluate(() => state.owned.size), n0);
  // nothing to clear: not offered
  await page.evaluate(() => {
    state.owned.clear();
    save();
    fullRender();
  });
  await page.click('#mkMore');
  assert.equal(await page.isVisible('#mkClear'), false);
  assert.deepEqual(errors, []);
});

test('larger text: the button, the card and the sheet fit a phone and an iPad without sideways scroll', async () => {
  for (const [w, h, owned] of [
    [390, 844, true],
    [390, 844, false],
    [820, 1180, true],
  ]) {
    const { page, errors, ctx } = await openAtScale(1.6, {
      width: w,
      height: h,
      storage: coll(owned ? ['Ohuhu|Y06', 'Ohuhu|R014'] : []),
    });
    await idle(page);
    const wide = () => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1);
    assert.ok(await wide(), w + ' page');
    await page.click(owned ? '#mkAddBtn' : '#mkcSet');
    await idle(page);
    assert.ok(await wide(), w + ' sheet');
    const fits = await page.evaluate(() => {
      const c = document.querySelector('#welcome .wcard').getBoundingClientRect();
      return c.left >= 0 && c.right <= innerWidth + 1;
    });
    assert.ok(fits, w + ' card in view');
    assert.deepEqual(errors, []);
    await ctx.close();
  }
});

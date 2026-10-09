// v309.1, from the pressure test of v309's first-collection flow: the welcome follows the toast's Undo (it went on
// saying "2 markers added"); the chart's removals are said as removals; a cap in no set doesn't spoil the
// match, and the caps a set hasn't are said and named on its button; Scan's "Fits so far" line is above the list.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, openApp, idle } from './helpers.mjs';

before(setup);
after(teardown);

const type = async (page, codes) => {
  for (const c of codes) {
    await page.fill('#scBox', c);
    await page.press('#scBox', 'Enter');
  }
};
const visible = (page, id) =>
  page.evaluate((id) => document.getElementById(id).getClientRects().length > 0, id);

test('one by one › Scan › Add, then the toast’s Undo: the welcome goes back to the ways to add, not "2 markers added"', async () => {
  const { page, errors } = await openApp({ width: 820, height: 1180 });
  await page.click('#wcOneByOne');
  await page.click('#wcOneScan');
  await type(page, ['R014', 'BG314']);
  await page.click('#scAdd');
  await idle(page);
  assert.equal(await page.textContent('#wcT2'), '2 markers added');
  await page.click('#toastAct');
  await idle(page);
  assert.equal(await page.evaluate(() => state.owned.size), 0);
  assert.ok(await visible(page, 'wcStepOne'), 'back on one by one');
  assert.equal(await visible(page, 'wcStep2'), false);
  assert.equal(await page.evaluate(() => document.activeElement.id), 'wcTO');
  // and Back from there goes to the first step
  await page.click('#wcStepOne .wcback');
  assert.ok(await visible(page, 'wcStep0'));
  assert.deepEqual(errors, []);
});

test('the chart from the welcome: an untick alone is said as removed; its Undo takes the welcome back too', async () => {
  const { page, errors } = await openApp({ width: 820, height: 1180 });
  await page.click('#wcOneByOne');
  await page.click('#wcOneScan');
  await type(page, ['R014']);
  await page.click('#scAdd');
  await idle(page);
  await page.click('#wcMoreExtra');
  await page.click('#wcOneChart');
  await idle(page);
  await page.click('#chGrid .chsw[aria-label^="R014 "]');
  assert.equal(await page.textContent('#chSave'), 'Remove 1');
  await page.click('#chSave');
  await idle(page);
  assert.equal(await page.textContent('#wcT2'), '1 marker removed');
  assert.equal(await page.textContent('#wcDone'), '0 markers are in your collection. Anything else?');
  await page.click('#toastAct');
  await idle(page);
  assert.equal(await page.evaluate(() => state.owned.size), 1);
  assert.ok(await visible(page, 'wcStepOne'));
  assert.deepEqual(errors, []);
});

test('not sure: a cap in no set (B04, sold on its own) still finds Honolulu 120 with all the caps that count; it’s named and added too', async () => {
  const { page, errors } = await openApp({ width: 820, height: 1180 });
  await page.click('#wcNotSure');
  await page.click('#wcFCount [data-n="3"]');
  await page.click('#wcFindNext');
  await idle(page);
  // the line saying what fits is above the list, in view on a phone with the list long
  assert.ok(
    await page.evaluate(
      () =>
        document.getElementById('scFind').compareDocumentPosition(document.getElementById('scList')) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ),
    'above the list',
  );
  await type(page, ['B04', 'R014', 'BG314']);
  assert.match(await page.textContent('#scFind'), /^Fits so far: Honolulu 120\./);
  await page.click('#scAdd');
  await idle(page);
  assert.equal(await page.textContent('#wcTR'), 'Is this your set?');
  assert.match(
    await page.textContent('#wcRes'),
    /Best match.*Has all 2 caps you scanned: R014, BG314\.B04 isn’t in it: added as well\./,
  );
  assert.equal(await page.textContent('#wcFindYes'), 'Yes, add these 120 markers and the other cap');
  await page.click('#wcFindYes');
  await idle(page);
  // (120 colours, the blender that comes with it, and B04)
  assert.equal(await page.evaluate(() => state.owned.size), 122);
  assert.ok(await page.evaluate(() => state.owned.has('Ohuhu|0') && state.owned.has('Ohuhu|B04')));
  assert.deepEqual(errors, []);
});

// v309.1, Ben's answers: the Ohuhu sets come with a Colorless Blender (added with the set, not counted in its size);
// adding a set from the welcome has Undo, as Markers' Add a set has; "Is this your set?" fits a phone on its side.
test('a set from the welcome: its blender comes with it, uncounted; the toast’s Undo takes them out and goes back to the list', async () => {
  const { page, errors } = await openApp({ width: 820, height: 1180 });
  await page.click('#wcHaveSet');
  assert.equal(await page.textContent('#wcSets label:has(input[data-i="3"]) .presetn'), '120');
  await page.check('#wcSets input[data-i="3"]');
  assert.equal(await page.textContent('#wcAdd'), 'Add 120 markers');
  await page.click('#wcAdd');
  await idle(page);
  assert.equal(await page.textContent('#wcT2'), '120 markers added');
  assert.ok(await page.evaluate(() => state.owned.has('Ohuhu|0') && state.owned.size === 121));
  assert.match(await page.textContent('#msToast'), /^Added 120 markers/);
  await page.click('#toastAct');
  await idle(page);
  assert.equal(await page.evaluate(() => state.owned.size), 0);
  assert.ok(await visible(page, 'wcStep1'), 'back on the list');
  assert.equal(await page.evaluate(() => document.activeElement.id), 'wcT1');
  assert.equal(await page.isChecked('#wcSets input[data-i="3"]'), false);
  // and Back from there to the first step
  await page.click('#wcStep1 .wcback');
  assert.ok(await visible(page, 'wcStep0'));
  assert.deepEqual(errors, []);
});

test('Markers › Add a set you own: the blender comes with the set; the toast counts the colours', async () => {
  const { page, errors } = await openApp({
    width: 820,
    height: 1180,
    storage: {
      'ms-onboarded': '1',
      'ms-setup-tip': '1',
      'ohuhu-hb320-picker-v3': JSON.stringify({
        mode: 'collection',
        ownedSeedV: 2,
        copicAdd1: 1,
        libAdj1: 1,
        setFix1: 1,
        owned: [],
        saved: [],
      }),
    },
  });
  await idle(page);
  // (with no markers yet the list is open already)
  if ((await page.getAttribute('#presetHdr', 'aria-expanded')) !== 'true') await page.click('#presetHdr');
  await page.check('#presetList input[data-i="1"]');
  await page.click('#presetAdd');
  await idle(page);
  assert.ok(await page.evaluate(() => state.owned.has('Ohuhu|0') && state.owned.size === 49));
  assert.match(await page.textContent('#msToast'), /^Added 48 markers/);
  // the set shows as yours (its colours), also for someone who has them all but not the blender
  await page.evaluate(() => {
    state.owned.delete('Ohuhu|0');
    presetRelist();
  });
  assert.ok(
    await page.evaluate(() =>
      document
        .querySelector('#presetList input[data-i="1"]')
        .closest('.presetrow')
        .classList.contains('have'),
    ),
  );
  assert.deepEqual(errors, []);
});

test('a phone on its side: "Is this your set?" shows the set, Yes, No and None of these without scrolling', async () => {
  for (const [w, h] of [
    [844, 390],
    [667, 375],
  ]) {
    const { page, errors, ctx } = await openApp({ width: w, height: h });
    await page.click('#wcNotSure');
    await page.click('#wcFCount [data-n="3"]');
    await page.click('#wcFindNext');
    await type(page, ['R014', 'Y28', 'BG314']);
    await page.click('#scAdd');
    await idle(page);
    const m = await page.evaluate(() => {
      const c = document.querySelector('.wcard').getBoundingClientRect();
      return ['#wcRes', '#wcFindYes', '#wcFindOther', '#wcFindNone'].map((s) => {
        const r = document.querySelector(s).getBoundingClientRect();
        return { s, ok: r.top >= c.top && r.bottom <= c.bottom - 4 && r.height > 0 };
      });
    });
    for (const x of m) assert.ok(x.ok, w + '×' + h + ': ' + x.s + ' in the card');
    assert.deepEqual(errors, []);
    await ctx.close();
  }
});

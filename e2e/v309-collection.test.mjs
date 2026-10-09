// v309: a first collection without a set list to tick. The welcome opens on three ways in (I have a set, I bought them
// one by one, I'm not sure which set); "not sure" finds the set from about how many markers and a few caps read by
// Scan; "one by one" adds through Scan or the new colour chart, which Markers has too; after a set, the welcome asks
// whether there's anything else.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, openApp, idle } from './helpers.mjs';

before(setup);
after(teardown);

const shown = (page, id) =>
  page.evaluate((id) => {
    const e = document.getElementById(id);
    // (an overlay is fixed, with no offsetParent: shown when it has a box)
    return !!e && e.getClientRects().length > 0;
  }, id);
const owned = (page) => page.evaluate(() => state.owned.size);
const type = async (page, codes) => {
  for (const c of codes) {
    await page.fill('#scBox', c);
    await page.press('#scBox', 'Enter');
  }
};

test('three ways in; I have a set leads to the list, and Back (or Escape) comes back to the choice', async () => {
  const { page, errors } = await openApp({ width: 820, height: 1180 });
  for (const id of ['wcHaveSet', 'wcOneByOne', 'wcNotSure', 'wcSkip', 'wcRestore'])
    assert.ok(await shown(page, id), id);
  assert.equal(await shown(page, 'wcSets'), false, 'the set list waits behind I have a set');
  await page.click('#wcHaveSet');
  assert.ok(await shown(page, 'wcSets'));
  assert.equal(
    await page.evaluate(() => document.activeElement.id),
    'wcT1',
    'the keyboard on the step’s heading',
  );
  await page.click('#wcStep1 .wcback');
  assert.ok(await shown(page, 'wcHaveSet'));
  assert.equal(await page.evaluate(() => document.activeElement.id), 'wcHaveSet', 'back on what led there');
  await page.click('#wcOneByOne');
  assert.ok(await shown(page, 'wcOneChart'));
  await page.keyboard.press('Escape');
  await idle(page);
  assert.ok(await shown(page, 'wcOneByOne'), 'Escape is Back');
  assert.ok(
    await page.evaluate(() => document.getElementById('welcome').classList.contains('on')),
    'still open',
  );
  assert.deepEqual(errors, []);
});

test('not sure which set: about how many and 3 caps find Honolulu 120; the other match a tap away; Yes adds it and asks for anything else', async () => {
  const { page, errors } = await openApp({
    width: 820,
    height: 1180,
    // (a list kept from an earlier Scan visit: finding a set leaves it as it was)
    storage: { 'ms-scan-list': JSON.stringify([{ k: 'Copic|E00' }]) },
  });
  const kept = () =>
    page.evaluate(() => JSON.parse(localStorage.getItem('ms-scan-list') || '[]').map((e) => e.k));
  assert.deepEqual(await kept(), ['Copic|E00']);
  await page.click('#wcNotSure');
  assert.equal(await page.isDisabled('#wcFindNext'), true, 'about how many first');
  await page.click('#wcFCount [data-n="3"]');
  await page.click('#wcFindNext');
  await idle(page);
  assert.equal(await page.textContent('#scTitle'), 'Scan 3 caps');
  assert.equal(await shown(page, 'scBrand'), false, 'the brand is the one chosen');
  assert.equal(await page.locator('#scList li').count(), 0, 'a list of its own');
  assert.equal(await page.textContent('#scAdd'), 'Find my set');
  assert.equal(await page.isDisabled('#scAdd'), true);
  await type(page, ['R014', 'Y28']);
  assert.match(await page.textContent('#scFind'), /^Fits so far: Honolulu 120\..*One more cap to be sure\.$/);
  await type(page, ['BG314']);
  assert.doesNotMatch(await page.textContent('#scFind'), /One more cap/);
  await page.click('#scAdd');
  await idle(page);
  assert.equal(await shown(page, 'scanOverlay'), false);
  assert.ok(await shown(page, 'wcStepRes'));
  assert.equal(await page.textContent('#wcTR'), 'Is this your set?');
  assert.match(
    await page.textContent('#wcRes'),
    /Ohuhu Honolulu 120.*120 markers and a Colorless Blender.*Has all 3 caps you scanned: R014, Y28, BG314\./,
  );
  assert.equal(await page.textContent('#wcFindYes'), 'Yes, add these 120 markers');
  assert.equal(await page.textContent('#wcFindOther'), 'No: show Honolulu 168 (also matches)');
  await page.click('#wcFindOther');
  assert.match(await page.textContent('#wcRes'), /Also matches.*Honolulu 168/);
  // round to the first again
  while (!/Back to Honolulu 120/.test(await page.textContent('#wcFindOther')))
    await page.click('#wcFindOther');
  await page.click('#wcFindOther');
  assert.match(await page.textContent('#wcRes'), /Best match.*Honolulu 120/);
  await page.click('#wcFindYes');
  await idle(page);
  assert.equal(await owned(page), 121, "120 colours and the blender that comes with them (v309.1)");
  assert.equal(await page.textContent('#wcT2'), '120 markers added');
  assert.equal(await page.textContent('#wcDone'), 'Honolulu 120 is in your collection. Anything else?');
  assert.ok(await shown(page, 'wcMoreExtra'));
  assert.ok(await shown(page, 'wcMoreSet'));
  assert.equal(await page.textContent('#wcSample'), 'That’s all: try the sample');
  // Scan as it was: its own title, the list kept for Add
  assert.equal(await page.textContent('#scTitle'), 'Scan or type codes');
  assert.deepEqual(await kept(), ['Copic|E00']);
  assert.deepEqual(errors, []);
});

test('not sure, then Scan closed without finding: back on the find step, Scan as it was', async () => {
  const { page, errors } = await openApp({ width: 820, height: 1180 });
  await page.click('#wcNotSure');
  await page.click('#wcFBrand [data-b="Copic"]');
  await page.click('#wcFCount [data-n="0"]');
  await page.click('#wcFindNext');
  await type(page, ['E00']);
  await page.click('#scClose');
  await idle(page);
  assert.ok(await shown(page, 'wcStepFind'));
  assert.equal(await page.evaluate(() => document.activeElement.id), 'wcFindNext');
  assert.equal(await owned(page), 0, 'nothing added');
  await page.click('#wcFindNext');
  assert.equal(await page.locator('#scList li').count(), 0, 'each find starts afresh');
  await type(page, ['E00', 'R29']);
  await page.click('#scAdd');
  await idle(page);
  assert.match(await page.textContent('#wcRes'), /Copic Ciao 24/);
  assert.deepEqual(errors, []);
});

test('caps no set has: said, and they can be added on their own', async () => {
  const { page, errors } = await openApp({ width: 820, height: 1180 });
  await page.click('#wcNotSure');
  await page.click('#wcFCount [data-n="1"]');
  await page.click('#wcFindNext');
  // (Ohuhu's fluorescents are in none of its sets)
  const fl = await page.evaluate(() => {
    const inSets = new Set(MARKER_SETS.filter((p) => p.b === 'Ohuhu').flatMap((p) => presetMkeys(p)));
    return COLORS.filter((c, i) => c.brand === 'Ohuhu' && !inSets.has(mkey(i)))
      .slice(0, 2)
      .map((c) => c.code);
  });
  assert.equal(fl.length, 2);
  await type(page, fl);
  assert.match(await page.textContent('#scFind'), /No Ohuhu set has these/);
  await page.click('#scAdd');
  await idle(page);
  assert.equal(await page.textContent('#wcTR'), 'No set found');
  assert.equal(await page.textContent('#wcFindYes'), 'Add the 2 markers you scanned');
  assert.equal(await shown(page, 'wcFindOther'), false);
  await page.click('#wcFindYes');
  await idle(page);
  assert.equal(await owned(page), 2);
  assert.equal(await page.textContent('#wcT2'), '2 markers added');
  assert.deepEqual(errors, []);
});

test('one by one: Scan’s Add, then the chart’s, each says what was added and asks for anything else', async () => {
  const { page, errors } = await openApp({ width: 820, height: 1180 });
  await page.click('#wcOneByOne');
  await page.click('#wcOneScan');
  await idle(page);
  assert.equal(await page.textContent('#scTitle'), 'Scan or type codes');
  // (codes only Ohuhu has: no question which brand)
  await type(page, ['R014', 'BG314']);
  assert.match(await page.textContent('#scCount'), /^2 markers/);
  assert.equal(await page.textContent('#scCount b'), '2', 'the number big');
  await page.click('#scAdd');
  await idle(page);
  assert.equal(await owned(page), 2);
  assert.ok(await shown(page, 'wcStep2'), 'the welcome goes on');
  assert.equal(await page.textContent('#wcT2'), '2 markers added');
  assert.equal(await page.textContent('#wcDone'), '2 markers are in your collection. Anything else?');
  await page.click('#wcMoreExtra');
  await page.click('#wcOneChart');
  await idle(page);
  assert.ok(await shown(page, 'chartOverlay'));
  assert.equal(await page.isDisabled('#chSave'), true);
  // Red, as it opens: R014 already ticked (it's yours); two more
  assert.equal(await page.getAttribute('#chGrid .chsw[aria-label^="R014 "]', 'aria-pressed'), 'true');
  const two = await page.$$eval('#chGrid .chsw[aria-pressed="false"]', (l) =>
    l.slice(0, 2).map((b) => b.dataset.i),
  );
  for (const i of two) await page.click(`#chGrid .chsw[data-i="${i}"]`);
  assert.equal(await page.textContent('#chSave'), 'Add 2 markers');
  assert.match(await page.textContent('#chFamLbl'), /^Red · 3 of \d+ ticked$/);
  await page.click('#chSave');
  await idle(page);
  assert.equal(await owned(page), 4);
  assert.equal(await page.textContent('#wcT2'), '2 more markers added');
  assert.equal(await page.textContent('#wcDone'), '4 markers are in your collection. Anything else?');
  // I have another set: the list, the sets you have ticked off as before
  await page.click('#wcMoreSet');
  assert.ok(await shown(page, 'wcSets'));
  await page.click('#wcLook').catch(() => {});
  assert.deepEqual(errors, []);
});

test('Skip: the full range, without "anything else"', async () => {
  const { page, errors } = await openApp({ width: 820, height: 1180 });
  await page.click('#wcSkip');
  assert.equal(await page.textContent('#wcT2'), 'Explore with the full range');
  assert.equal(await shown(page, 'wcMore'), false);
  assert.equal(await page.textContent('#wcSample'), 'Try the sample');
  assert.deepEqual(errors, []);
});

test('Markers › Tick colours on a chart: yours ticked; untick one and tick two, Save, and Undo puts it all back', async () => {
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
        owned: ['Copic|E00', 'Copic|E11', 'Ohuhu|R014'],
        saved: [],
      }),
    },
  });
  await idle(page);
  await page.click('#chartOpen');
  await idle(page);
  assert.equal(
    await page.getAttribute('#chBrand [data-b="Copic"]', 'aria-pressed'),
    'true',
    'the brand of most of yours',
  );
  await page.click('#chFams .chfam[data-f="Earth / Skin / Brown"]');
  assert.equal(await page.textContent('#chFams [aria-pressed="true"]'), 'Earth & skin2');
  const e00 = await page.evaluate(() => COLORS.findIndex((c) => c.brand === 'Copic' && c.code === 'E00'));
  await page.click(`#chGrid .chsw[data-i="${e00}"]`);
  const two = await page.$$eval('#chGrid .chsw[aria-pressed="false"]', (l) =>
    l
      .filter((b) => !/^E00 /.test(b.getAttribute('aria-label')))
      .slice(0, 2)
      .map((b) => b.dataset.i),
  );
  for (const i of two) await page.click(`#chGrid .chsw[data-i="${i}"]`);
  assert.equal(await page.textContent('#chSave'), 'Save: +2 −1');
  assert.match(await page.textContent('#chSum'), /^4 ticked in all$/);
  await page.click('#chSave');
  await idle(page);
  assert.equal(await shown(page, 'chartOverlay'), false);
  assert.equal(await owned(page), 4);
  assert.equal(await page.evaluate(() => state.owned.has('Copic|E00')), false);
  assert.match(await page.textContent('#msToast'), /^Added 2, removed 1/);
  await page.click('#toastAct');
  await idle(page);
  assert.deepEqual(await page.evaluate(() => [...state.owned].sort()), [
    'Copic|E00',
    'Copic|E11',
    'Ohuhu|R014',
  ]);
  assert.equal(await page.evaluate(() => document.activeElement && document.activeElement.id), 'chartOpen');
  assert.deepEqual(errors, []);
});

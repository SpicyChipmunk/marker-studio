// v308.2 (reviewer 2: Markers and Palette): marking a marker Running low or Dry in its details shows Owned's
// "Running low · N" straight away (it waited for the next view change); Palette's Rainbow offers only the sizes the
// markers in play can fill (with 12 markers, 14 and 16 were offered and Generate refused them); Save image's file
// is named for the palette.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, openApp, idle, until, welcome } from './helpers.mjs';

before(setup);
after(teardown);

const KEY = 'ohuhu-hb320-picker-v3';
const onboarded = (extra = {}) => ({
  'ms-onboarded': '1',
  'ms-setup-tip': '1',
  'ms-last-ver': 'v307',
  'ms-scan-brand': '',
  ...extra,
});
const appState = (extra = {}) =>
  JSON.stringify({
    mode: 'collection',
    collView: 'owned',
    ownedSeedV: 2,
    copicAdd1: 1,
    libAdj1: 1,
    setFix1: 1,
    owned: ['Ohuhu|R014', 'Ohuhu|B08', 'Ohuhu|Y26'],
    saved: [],
    ...extra,
  });
const ink = async (page, code, v) => {
  await page.evaluate(
    (c) => openMarkerSheet(COLORS.findIndex((x) => x.brand === 'Ohuhu' && x.code === c)),
    code,
  );
  await idle(page);
  await page.click(`#mkInk [data-ink="${v}"]`);
  await idle(page);
  await page.click('#mkClose');
  await idle(page);
};

test('marking a marker Running low or Dry in its details shows Owned’s Running low chip at once, and its count follows', async () => {
  const { page, errors } = await openApp({
    width: 820,
    height: 1180,
    storage: onboarded({ [KEY]: appState() }),
  });
  await page.waitForSelector('#results .cell');
  assert.equal(await page.isVisible('#lowChip'), false, 'none marked yet');
  await ink(page, 'B08', 'low');
  assert.equal(await page.isVisible('#lowChip'), true, 'the chip once one is marked');
  assert.equal(await page.textContent('#lowChip'), 'Running low · 1');
  await ink(page, 'Y26', 'dry');
  assert.equal(await page.textContent('#lowChip'), 'Running low or dry · 2');
  // back to OK: the count follows, and the chip goes once none is marked
  await ink(page, 'Y26', '');
  assert.equal(await page.textContent('#lowChip'), 'Running low · 1');
  await ink(page, 'B08', '');
  assert.equal(await page.isVisible('#lowChip'), false);
  assert.equal(await page.locator('#results .cell').count(), 3);
  assert.deepEqual(errors, []);
});

test('Palette › Rainbow with 12 markers: sizes stop at 12, a bigger size moves down, and Generate works', async () => {
  const { page, errors } = await openApp({ width: 820, height: 1180 });
  await welcome(page, 'look');
  await page.evaluate(() => {
    state.harmony = 'rainbow';
    state.palSize = 16;
    state.owned = new Set(presetMkeys(MARKER_SETS.find((s) => s.n === 'Ciao 12')));
    save();
  });
  await page.click('#mPalette');
  await idle(page);
  const shown = () =>
    page.$$eval('#segs [data-n]', (b) =>
      b.filter((x) => !x.disabled && x.style.display !== 'none').map((x) => +x.dataset.n),
    );
  assert.deepEqual(await shown(), [6, 8, 10, 12]);
  assert.equal(await page.evaluate(() => state.palSize), 12, '16 moved down to 12');
  assert.equal(await page.isDisabled('#draw'), false, 'Generate works: ' + (await page.textContent('#draw')));
  await page.click('#draw');
  await until(page, () => !rolling, null, 'the roll');
  await idle(page);
  assert.equal(await page.evaluate(() => state.palettes[state.palettes.length - 1].length), 11);
  // a bigger collection offers them all again
  await page.evaluate(() => {
    presetMkeys(MARKER_SETS.find((s) => s.n === 'Honolulu 120')).forEach((k) => state.owned.add(k));
    save();
    fullRender();
  });
  await idle(page);
  assert.deepEqual(await shown(), [6, 8, 10, 12, 14, 16]);
  assert.deepEqual(errors, []);
});

test('Palette: a size the markers in play can no longer fill moves down, and the Colours row shows the one it moved to', async () => {
  const { page, errors } = await openApp({ width: 820, height: 1180 });
  await welcome(page, 'look');
  await page.evaluate(() => {
    state.harmony = 'complementary';
    state.palSize = 8;
    state.owned = new Set(presetMkeys(MARKER_SETS.find((s) => s.n === 'Ciao 12')));
    save();
  });
  await page.click('#mPalette');
  await idle(page);
  const n = await page.evaluate(() => state.palSize);
  assert.ok(n < 8, 'moved down: ' + n);
  assert.equal(await page.getAttribute(`#segs [data-n="${n}"]`, 'aria-pressed'), 'true');
  assert.deepEqual(errors, []);
});

test('Palette › Save image: the file is named for the palette, as its card is', async () => {
  const { page, errors } = await openApp({ width: 820, height: 1180 });
  await welcome(page, 'look');
  await page.click('#mPalette');
  await idle(page);
  await page.click('#draw');
  await until(page, () => !rolling, null, 'the roll');
  await idle(page);
  const name = (await page.textContent('#readout .name')).trim();
  await page.click('#libMore');
  await page.click('#exportBtn');
  await until(page, () => !!document.getElementById('cardImg').getAttribute('src'), null, 'the card');
  const want =
    name
      .toLowerCase()
      .replace(/[^\p{L}\p{M}\p{N}]+/gu, '-')
      .replace(/^-+|-+$/g, '') + '.png';
  assert.equal(await page.getAttribute('#dlLink', 'download'), want);
  assert.deepEqual(errors, []);
});

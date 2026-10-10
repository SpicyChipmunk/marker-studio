// v310.1 (reviewer 3): Markers and Palette.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, openApp, idle, addFromMarkers } from './helpers.mjs';

before(setup);
after(teardown);

const seeded = (owned, extra = {}) => ({
  'ms-onboarded': '1',
  'ms-setup-tip': '1',
  'ohuhu-hb320-picker-v3': JSON.stringify({
    mode: 'collection',
    ownedSeedV: 2,
    copicAdd1: 1,
    libAdj1: 1,
    setFix1: 1,
    owned,
    saved: [],
    ...extra,
  }),
});
// Honolulu 48's colours (no blender), set up in the page and kept
async function own48(page, extra = {}) {
  await page.evaluate((extra) => {
    const p = MARKER_SETS.find((x) => x.n === 'Honolulu 48');
    state.owned = new Set(presetMkeys(p).filter((k) => k !== 'Ohuhu|0'));
    Object.assign(state, extra);
    save();
  }, extra);
  await page.reload();
  await idle(page);
}
// a set's count in the sets list (v311: Add markers' sheet's, opened afresh and closed again)
async function row(page, name) {
  await addFromMarkers(page, 'set');
  const t = await page.evaluate(
    (name) =>
      [...document.querySelectorAll('#wcSets .presetrow')]
        .filter((r) => r.querySelector('.presetnm').textContent === name)
        .map((r) => r.querySelector('.presetn').textContent)[0],
    name,
  );
  await page.keyboard.press('Escape');
  await page.keyboard.press('Escape');
  await idle(page);
  return t;
}

// (v311: the list is in Add markers' sheet, drawn as it opens: the counts as the collection is then)
test('the sets list counts the collection as it is: after a marker ticked in the grid, Tick all shown, and their Undo', async () => {
  const { page, errors } = await openApp({ width: 820, height: 1180, storage: seeded(['Ohuhu|Y06']) });
  await idle(page);
  await own48(page);
  assert.equal(await row(page, 'Honolulu 48'), '✓ 48');
  // one of the 48's markers unticked in the grid
  const i = await page.evaluate(() => keyIdx('Ohuhu|R014'));
  await page.click(`#results .cell[data-i="${i}"]`);
  await idle(page);
  await page.click('#toastAct');
  await idle(page);
  assert.equal(await row(page, 'Honolulu 48'), '✓ 48');
  await page.click(`#results .cell[data-i="${i}"]`);
  await idle(page);
  assert.equal(await row(page, 'Honolulu 48'), '47/48');
  assert.equal(await row(page, 'Honolulu 72'), '46/72');
  // Tick all shown: GG03 and GG05 (in the 72) and GG07 (not), by search
  await page.click('#ownView [data-v="unowned"]');
  await idle(page);
  await page.fill('#q', 'GG0');
  await idle(page);
  await page.click('#ownAll');
  await idle(page);
  assert.equal(await row(page, 'Honolulu 72'), '48/72');
  assert.deepEqual(errors, []);
});

test('Add a set: the Colorless Blender an Ohuhu set brings is said, so the count adds up', async () => {
  const { page, errors } = await openApp({
    width: 820,
    height: 1180,
    storage: seeded(['Ohuhu|Y06'], { wish: [{ k: 'Ohuhu|R16', why: 'y', ts: 2 }] }),
  });
  await idle(page);
  await own48(page);
  const n0 = await page.evaluate(() => state.owned.size);
  assert.equal(await row(page, 'Honolulu 120'), '47/120');
  await addFromMarkers(page, 'set');
  await page.check('#wcSets input[data-i="3"]'); // Honolulu 120
  await page.click('#wcAdd');
  await idle(page);
  const n1 = await page.evaluate(() => state.owned.size);
  assert.equal(n1 - n0, 74);
  assert.equal(
    (await page.textContent('#msToast')).replace(/\s+/g, ' ').trim(),
    'Added 73 markers and a Colorless Blender · 1 off To buy Undo',
  );
  await page.click('#toastAct');
  await idle(page);
  assert.equal(await page.evaluate(() => state.owned.size), n0);
  // a set with no blender (Honolulu 24, inside the 48): said to be yours already
  await addFromMarkers(page, 'set');
  await page.check('#wcSets input[data-i="0"]');
  await page.click('#wcAdd');
  await idle(page);
  assert.match(await page.textContent('#msToast'), /^Honolulu 24 is already in your collection\./);
  assert.deepEqual(errors, []);
});

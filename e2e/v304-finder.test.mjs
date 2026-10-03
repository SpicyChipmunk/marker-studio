// v304 (Markers): Tick all shown, Copy codes and Palette from these act on what the grid shows (Ramp gaps shows only
// some of the matches); an armed Untick all shown is disarmed by a search; a search puts the code searched for first
// ("Best match", then "Old code") without the groups' rise at each letter; Palette from these needs a colour, not only
// the Colorless Blender; a search that finds nothing says so, not "Your collection is empty". The custom slot picker
// shows every marker (it stopped at 400) and searches as Markers does; back in Custom the palette has its own size.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, openApp, idle } from './helpers.mjs';

before(setup);
after(teardown);

const KEY = 'ohuhu-hb320-picker-v3';
const onboarded = (extra = {}) => ({ 'ms-onboarded': '1', 'ms-setup-tip': '1', 'ms-last-ver': 'v304', ...extra });
const appState = (extra = {}) => JSON.stringify({ mode: 'home', ownedSeedV: 2, copicAdd1: 1, libAdj1: 1, setFix1: 1, saved: [], ...extra });
const clip = () => { window.__clip = []; try { Object.defineProperty(navigator, 'clipboard', { value: { writeText: async (t) => { window.__clip.push(t); } }, configurable: true }); } catch (e) {} };
// the app's default collection (the sets most people start with), as keys
async function defaultKeys() {
  const { page, ctx } = await openApp({ storage: onboarded() });
  const k = await page.evaluate(() => [...defaultOwned()]);
  await ctx.close();
  return k;
}
const shownCodes = (page) => page.$$eval('#results .cell', (l) => l.map((c) => COLORS[+c.dataset.i].code));

test('Ramp gaps: Tick all shown ticks the gaps shown, Copy codes copies them in order, Palette from these uses them', async () => {
  const owned = await defaultKeys();
  const { page, errors } = await openApp({ init: clip, storage: onboarded({ [KEY]: appState({ mode: 'collection', collView: 'unowned', gapSort: 'ramps', owned }) }) });
  await idle(page);
  const shown = await shownCodes(page),
    all = await page.evaluate(() => finderMatches().length);
  assert.ok(shown.length > 0 && shown.length < all, shown.length + ' shown of ' + all);
  await page.click('#copyBtn'); await idle(page);
  assert.deepEqual((await page.evaluate(() => window.__clip[0])).split(', ').map((s) => s.replace(/^(Copic|Ohuhu) /, '')), shown);
  const before = await page.evaluate(() => state.owned.size);
  await page.click('#ownAll'); await idle(page);
  assert.equal((await page.evaluate(() => state.owned.size)) - before, shown.length, 'ticked only what was shown');
  await page.click('#toastAct'); await idle(page);
  assert.equal(await page.evaluate(() => state.owned.size), before, 'Undo');
  const again = await shownCodes(page);
  await page.click('#toPalette'); await idle(page);
  assert.deepEqual((await page.evaluate(() => state.pool.map((i) => COLORS[i].code))).sort(), again.sort());
  assert.deepEqual(errors, []);
});

test('Untick all shown, armed, then a search: disarmed, and nothing is unticked', async () => {
  const owned = await defaultKeys();
  const { page, errors } = await openApp({ storage: onboarded({ [KEY]: appState({ mode: 'collection', collView: 'owned', owned }) }) });
  await idle(page);
  await page.fill('#q', 'r2'); await idle(page);
  await page.click('#mkMore'); await page.click('#ownNone');
  assert.match(await page.textContent('#ownNone'), /^Untick \d+ markers\? Tap again$/);
  await page.fill('#q', ''); await idle(page);
  assert.equal(await page.textContent('#ownNone'), 'Untick all shown');
  if (await page.isVisible('#ownNone')) await page.click('#ownNone', { delay: 0 });
  await idle(page);
  assert.equal(await page.evaluate(() => state.owned.size), owned.length, 'the next tap asks again');
  assert.deepEqual(errors, []);
});

test('a search for a code: "Best match" first, then "Old code"; no rise at each letter', async () => {
  const { page, errors } = await openApp({ init: clip, storage: onboarded({ [KEY]: appState({ mode: 'collection', collView: 'all', owned: [] }) }) });
  await idle(page);
  await page.fill('#q', 'g410'); await idle(page);
  const heads = await page.$$eval('#results .rghead', (l) => l.map((h) => h.textContent.replace(/\s*\d+$/, '').trim()));
  assert.deepEqual(heads.slice(0, 2), ['Best match', 'Old code']);
  assert.deepEqual((await shownCodes(page)).slice(0, 2), ['G410', 'G24']);
  assert.equal(await page.$eval('#results', (r) => r.classList.contains('noanim')), true);
  assert.equal(await page.$eval('#results .rgroup', (g) => getComputedStyle(g).animationName), 'none');
  await page.click('#copyBtn'); await idle(page);
  assert.equal(await page.evaluate(() => window.__clip[0]), 'G410, G24');
  // "cool grey 3" and "c3" find Copic's C-3
  for (const q of ['cool grey 3', 'c3']) {
    await page.fill('#q', q); await idle(page);
    assert.deepEqual(await shownCodes(page), ['C-3'], q);
  }
  assert.deepEqual(errors, []);
});

test('Palette from these needs a colour; a search that finds nothing says so, collection empty or not', async () => {
  const { page, errors } = await openApp({ storage: onboarded({ [KEY]: appState({ mode: 'collection', collView: 'all', owned: [] }) }) });
  await idle(page);
  await page.fill('#q', 'colorless'); await idle(page);
  assert.equal((await shownCodes(page)).length, 2);
  assert.equal(await page.$eval('#toPalette', (b) => b.disabled), true, 'only the blenders');
  await page.evaluate(() => { state.collView = 'unowned'; save(); fullRender(); });
  await page.fill('#q', 'zzzz'); await idle(page);
  const t = await page.textContent('#results');
  assert.match(t, /No markers match/);
  assert.doesNotMatch(t, /Your collection is empty/);
  assert.deepEqual(errors, []);
});

test('custom slot picker: every marker, and the same search as Markers', async () => {
  const { page, errors } = await openApp({ storage: onboarded({ [KEY]: appState({ mode: 'palette', harmony: 'custom', palSize: 4, customPal: [], owned: [] }) }) });
  await idle(page);
  await page.click('#bands .band'); await page.waitForSelector('#seedOverlay.on'); await idle(page);
  const n = await page.$$eval('#seedGrid .cell', (l) => l.length),
    inPlay = await page.evaluate(() => COLORS.filter((c, i) => inPool(i)).length);
  assert.ok(inPlay > 400);
  assert.equal(n, inPlay, 'it had stopped at 400');
  await page.fill('#seedSearch', 'cool grey 3'); await idle(page);
  assert.deepEqual(await page.$$eval('#seedGrid .cell', (l) => l.map((c) => COLORS[+c.dataset.i].code)), ['C-3']);
  await page.fill('#seedSearch', 'grey'); await idle(page);
  const brands = await page.$$eval('#seedGrid .cell', (l) => [...new Set(l.map((c) => COLORS[+c.dataset.i].brand))].sort());
  assert.deepEqual(brands, ['Copic', 'Ohuhu'], 'Copic’s Gray too');
  assert.deepEqual(errors, []);
});

test('Custom: another scheme and back keeps its markers; a smaller size chosen in Custom cuts them', async () => {
  const twelve = Array.from({ length: 12 }, (_, k) => k * 10);
  const { page, errors } = await openApp({ storage: onboarded({ [KEY]: appState({ mode: 'palette', harmony: 'custom', palSize: 12, customPal: twelve, owned: [] }) }) });
  await idle(page);
  const look = () => page.evaluate(() => ({ bands: document.querySelectorAll('#bands .band').length, filled: document.querySelectorAll('#bands .band:not(.empty)').length }));
  assert.deepEqual(await look(), { bands: 12, filled: 12 });
  // Analogous goes up to 8: back in Custom, all 12 (it had come back with 8, the other 4 lost)
  await page.click('#harm [data-h="analogous"]'); await idle(page);
  await page.click('#harm [data-h="custom"]'); await idle(page);
  assert.deepEqual(await look(), { bands: 12, filled: 12 });
  // a smaller size chosen in Custom: the slots past it go, and stay gone after another scheme
  await page.evaluate(() => setSize(4)); await idle(page);
  assert.deepEqual(await look(), { bands: 4, filled: 4 });
  await page.click('#harm [data-h="complementary"]'); await idle(page);
  await page.click('#harm [data-h="custom"]'); await idle(page);
  assert.deepEqual(await look(), { bands: 4, filled: 4 });
  assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('ohuhu-hb320-picker-v3')).customPal.length), 4);
  assert.deepEqual(errors, []);
});

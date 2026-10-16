// v318.7 Scan, in the browser: with Ohuhu set for you (an all-Ohuhu collection, no brand ever tapped), two Copic caps
// read whole switch the reading to both brands, with a row at the top of the list and Keep Ohuhu; the row isn't a
// question, isn't saved, and × takes it off; a brand tapped ends it; a reload brings the brand set for you back. And a
// brand tapped answers "Which R29?" between two brands' markers (section 0). Each test fails on v318.6.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, openApp, idle, scanFromMarkers } from './helpers.mjs';

before(setup);
after(teardown);

const KEY = 'ohuhu-hb320-picker-v3';
const onboarded = (extra = {}) => ({ 'ms-onboarded': '1', 'ms-setup-tip': '1', 'ms-last-ver': 'v318', ...extra });
const OHUHU = ['Ohuhu|R014', 'Ohuhu|Y111', 'Ohuhu|B08', 'Ohuhu|G36', 'Ohuhu|BV310', 'Ohuhu|YR313', 'Ohuhu|RV08', 'Ohuhu|B04'];
const appState = (extra = {}) =>
  JSON.stringify({ mode: 'collection', ownedSeedV: 2, copicAdd1: 1, libAdj1: 1, setFix1: 1, owned: OHUHU, saved: [], ...extra });
const scanOpen = async (page) => {
  await page.click('#mCollection');
  await idle(page);
  await scanFromMarkers(page);
  await idle(page);
};
const pressed = (page) => page.$eval('#scBrand button[aria-pressed="true"]', (b) => b.dataset.b);
// as Scan Text puts a cap's text in the box, then holds still
const scanText = async (page, text) => {
  await page.evaluate((t) => {
    const b = document.getElementById('scBox');
    b.value = t;
    b.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertReplacementText' }));
  }, text);
  await page.waitForFunction(() => document.getElementById('scBox').value === '', null, { timeout: 5000 });
  await idle(page);
};
const type = async (page, text) => {
  await page.fill('#scBox', text);
  await page.press('#scBox', 'Enter');
  await idle(page);
};
const rows = (page) =>
  page.$$eval('#scList .scrow', (rs) => rs.map((r) => (r.querySelector('.sccode') || r.querySelector('b')).textContent));
const row = (page) => page.$('#scList .scswitch');

test('Scan with Ohuhu set for you: two Copic caps read whole switch to both brands, said on a row with Keep Ohuhu; the row is no question and isn’t saved; Keep Ohuhu takes it back', async () => {
  const { page, errors } = await openApp({ width: 820, height: 1180, storage: onboarded({ [KEY]: appState() }) });
  await scanOpen(page);
  assert.equal(await pressed(page), 'Ohuhu');
  // a code both brands use, Ohuhu's for now; then a Copic cap read whole: a question in the list, not a vanishing card
  await scanText(page, 'YR07');
  await scanText(page, 'E71 Champagne');
  assert.deepEqual(await rows(page), ['Copic E71 Champagne: add it? Ohuhu was set for you', 'YR07']);
  assert.equal(await pressed(page), 'Ohuhu');
  assert.equal(await row(page), null);
  // the second: switched. Either pressed (not stored), the row at the top, the first cap in, YR07 asked
  await scanText(page, 'BG11 Moon White');
  assert.equal(await pressed(page), '');
  assert.equal(await page.evaluate(() => localStorage.getItem('ms-scan-brand')), null, 'not stored');
  assert.ok(await row(page), 'the row');
  assert.match(await page.textContent('#scList .scswitch'), /Reading both brands: Copic caps were read/);
  assert.equal(await page.textContent('#scList .scswitch .scswkeep'), 'Keep Ohuhu');
  assert.deepEqual(await rows(page), ['Reading both brands: Copic caps were read', 'BG11', 'E71', 'YR07: Ohuhu or Copic?']);
  assert.match(await page.textContent('#scStat'), /Reading both brands: Copic caps were read.*Codes both brands use are asked from now on · Keep Ohuhu is at the top of the list/);
  // counted as the one question it is, the row not among them; nor saved for a reload
  assert.match(await page.textContent('#scCount'), /2.markers · 1.to.choose/);
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('ms-scan-list')));
  assert.equal(saved.length, 3, JSON.stringify(saved));
  // Keep Ohuhu: Ohuhu pressed, YR07 Ohuhu's again, the Copic caps asked about, the row gone
  await page.click('#scList .scswitch .scswkeep');
  await idle(page);
  assert.equal(await pressed(page), 'Ohuhu');
  assert.equal(await row(page), null);
  assert.deepEqual(await rows(page), ['Copic BG11 Moon White: add it? Ohuhu was set for you', 'Copic E71 Champagne: add it? Ohuhu was set for you', 'YR07']);
  assert.match(await page.textContent('#scStat'), /Ohuhu again.*Copic codes read since are asked below/);
  // two more distinct Copic caps: switched again, the row back; × takes the row off, the reading stays
  await scanText(page, 'B000');
  assert.equal(await pressed(page), 'Ohuhu');
  await scanText(page, 'C-3');
  assert.equal(await pressed(page), '');
  assert.ok(await row(page), 'the row again');
  await page.click('#scList .scswitch .scswx');
  await idle(page);
  assert.equal(await row(page), null);
  assert.equal(await pressed(page), '');
  // a reload: the brand set for you is back, nothing of the switch kept
  await page.keyboard.press('Escape');
  await idle(page);
  await page.reload();
  await idle(page);
  await scanOpen(page);
  assert.equal(await pressed(page), 'Ohuhu');
  assert.equal(await row(page), null);
  assert.match(await page.textContent('#scStat'), /Set to Ohuhu, the brand of all your markers/);
  assert.deepEqual(errors, []);
});

test('Scan: a brand tapped on the switch ends the switch and its row, kept from then on; Clear list brings the brand set for you back', async () => {
  const { page, errors } = await openApp({ width: 820, height: 1180, storage: onboarded({ [KEY]: appState() }) });
  await scanOpen(page);
  await scanText(page, 'E71 Champagne');
  await scanText(page, 'BG11 Moon White');
  assert.ok(await row(page));
  await page.click('#scClear');
  await page.click('#scClear');
  await idle(page);
  assert.equal(await row(page), null);
  assert.equal(await pressed(page), 'Ohuhu');
  await scanText(page, 'E71 Champagne');
  await scanText(page, 'BG11 Moon White');
  assert.ok(await row(page));
  await page.click('#scBrand button[data-b="Copic"]');
  await idle(page);
  assert.equal(await row(page), null);
  assert.equal(await pressed(page), 'Copic');
  assert.equal(await page.evaluate(() => localStorage.getItem('ms-scan-brand')), 'Copic');
  // (a Copic cap read now is simply Copic's: the switch is over for good)
  await scanText(page, 'C-3');
  assert.equal(await row(page), null);
  assert.ok((await rows(page)).includes('C-3'));
  assert.deepEqual(errors, []);
});

test('Scan with Ohuhu chosen: "Which R29?" offers Ohuhu YR47 by its old code and Copic R29; a brand tapped answers it', async () => {
  const { page, errors } = await openApp({ width: 820, height: 1180, storage: onboarded({ [KEY]: appState() }) });
  await scanOpen(page);
  await page.click('#scBrand button[data-b="Ohuhu"]');
  await idle(page);
  await type(page, 'R29');
  assert.deepEqual(await rows(page), ['Which R29?']);
  const chips = await page.$$eval('#scList .scask .scchoose', (b) => b.map((x) => x.textContent));
  assert.deepEqual(chips, ['YR47 Dusty Peach · Ohuhu · was R29', 'R29 Lipstick Red · Copic']);
  await page.click('#scBrand button[data-b="Copic"]');
  await idle(page);
  assert.deepEqual(await rows(page), ['R29']);
  assert.match(await page.textContent('#scList .scrow'), /Copic/);
  assert.match(await page.textContent('#scStat'), /1 question answered/);
  // and back under Ohuhu, typed again: the Ohuhu marker's turn
  await page.click('#scBrand button[data-b="Ohuhu"]');
  await idle(page);
  await type(page, 'R30');
  assert.deepEqual(await rows(page), ['Which R30?', 'R29']);
  await page.click('#scList .scask .scchoose:has-text("was R30")');
  await idle(page);
  assert.deepEqual(await rows(page), ['E81', 'R29']);
  assert.match(await page.textContent('#scList .scrow'), /by its old code/);
  assert.deepEqual(errors, []);
});

test('Scan: codes both brands use added to the collection as Ohuhu’s before the switch are named on the row, not rewritten', async () => {
  const { page, errors } = await openApp({ width: 820, height: 1180, storage: onboarded({ [KEY]: appState() }) });
  await scanOpen(page);
  await scanText(page, 'YR07');
  await scanText(page, 'B015');
  await page.click('#scAdd');
  await idle(page);
  assert.ok(await page.evaluate(() => state.owned.has('Ohuhu|YR07')));
  await scanFromMarkers(page);
  await idle(page);
  assert.equal(await pressed(page), 'Ohuhu');
  await scanText(page, 'E71 Champagne');
  await scanText(page, 'BG11 Moon White');
  assert.ok(await row(page));
  assert.match(await page.textContent('#scList .scswitch small'), /^YR07 went into your collection as Ohuhu$/);
  assert.ok(await page.evaluate(() => state.owned.has('Ohuhu|YR07')), 'not rewritten');
  assert.deepEqual(errors, []);
});

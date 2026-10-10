// v305 small items: Back up & restore's two Restore buttons say which; Match's hex code part-typed greys the last result
// and, on Enter, says what's expected; Scan with a collection all of one brand starts on that brand, visibly, when no
// brand was ever chosen and Brands I'd buy is that brand too (or automatic), and the choices say which are yours.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, openApp, idle, openBackupDialog, scanFromMarkers } from './helpers.mjs';

before(setup);
after(teardown);

const KEY = 'ohuhu-hb320-picker-v3';
const onboarded = (extra = {}) => ({ 'ms-onboarded': '1', 'ms-setup-tip': '1', 'ms-last-ver': 'v305', ...extra });
const OHUHU = ['Ohuhu|R014', 'Ohuhu|Y111', 'Ohuhu|B08', 'Ohuhu|G36', 'Ohuhu|BV310', 'Ohuhu|YR313', 'Ohuhu|RV08', 'Ohuhu|B04'];
const appState = (extra = {}) => JSON.stringify({ mode: 'collection', ownedSeedV: 2, copicAdd1: 1, libAdj1: 1, setFix1: 1, owned: OHUHU, saved: [], ...extra });

test('Back up & restore: "Restore a file" and "Restore from text"', async () => {
  const { page, errors } = await openApp({ width: 820, height: 1180, storage: onboarded({ [KEY]: appState() }) });
  await openBackupDialog(page);
  assert.equal(await page.textContent('#backupImport'), 'Restore a file');
  await page.click('#backupShow');
  assert.equal(await page.textContent('#backupRestore'), 'Restore from text');
  assert.deepEqual(errors, []);
});

test('Match a colour: a hex code part-typed greys the last result; Enter on 1 to 5 digits says what’s expected', async () => {
  const { page, errors } = await openApp({ width: 820, height: 1180, storage: onboarded({ [KEY]: appState() }) });
  await page.click('#mCollection'); await idle(page);
  await page.click('#mkMatchBtn');
  await page.click('.msrc [data-src="hex"]');
  await page.fill('#matchHex', '#40e0d0'); await idle(page);
  const dim = () => page.$eval('#matchResult', (r) => r.style.opacity);
  const hint = () => page.evaluate(() => { const h = document.getElementById('matchHexHint'); return h && h.style.display !== 'none' ? h.textContent : ''; });
  assert.equal(await dim(), '');
  for (const part of ['#4', '#40e', '#40e0d']) {
    await page.fill('#matchHex', part); await idle(page);
    assert.equal(await dim(), part === '#40e' ? '' : '0.35', part + ': ' + (part === '#40e' ? 'a 3-digit code is a colour' : 'the last result greyed'));
    assert.equal(await hint(), '', part + ': no hint while typing');
  }
  await page.press('#matchHex', 'Enter'); await idle(page);
  assert.equal(await hint(), 'Enter 6 hex digits, e.g. #3A7BD5', 'five digits, then Enter');
  await page.fill('#matchHex', '#40e0d0'); await idle(page);
  assert.equal(await hint(), '');
  assert.equal(await dim(), '');
  assert.deepEqual(errors, []);
});

const scanOpen = async (page) => { await page.click('#mCollection'); await idle(page); await scanFromMarkers(page); await idle(page); };
const pressed = (page) => page.$eval('#scBrand button[aria-pressed="true"]', (b) => b.dataset.b);
const type = async (page, text) => { await page.fill('#scBox', text); await page.press('#scBox', 'Enter'); await idle(page); };

test('Scan: an all-Ohuhu collection starts on Ohuhu, shown and said, until a brand is tapped; never stored by itself', async () => {
  const { page, errors } = await openApp({ width: 820, height: 1180, storage: onboarded({ [KEY]: appState() }) });
  await scanOpen(page);
  assert.equal(await pressed(page), 'Ohuhu');
  assert.match(await page.textContent('#scStat'), /Set to Ohuhu, the brand of all your markers · Either brand reads both/);
  assert.equal(await page.evaluate(() => localStorage.getItem('ms-scan-brand')), null, 'not stored');
  // a Copic-only code asks
  await type(page, 'B000');
  assert.match(await page.textContent('#scStat'), /Another brand than the one chosen \(Ohuhu\)/);
  // Either brand, tapped: kept from now on
  await page.click('#scBrand button[data-b=""]'); await idle(page);
  assert.equal(await page.evaluate(() => localStorage.getItem('ms-scan-brand')), '');
  await page.click('#scClose'); await idle(page);
  await scanFromMarkers(page); await idle(page);
  assert.equal(await pressed(page), '');
  assert.match(await page.textContent('#scStat'), /Each marker read shows here/);
  assert.deepEqual(errors, []);
});

test('Scan: Either brand to start when your markers are of two brands, or Brands I’d buy has another brand', async () => {
  for (const [extra, why] of [
    [{ owned: [...OHUHU, 'Copic|E09'] }, 'two brands'],
    [{ buyBrands: ['Ohuhu', 'Copic'] }, 'Brands I’d buy: both'],
    [{ buyBrands: ['Copic'] }, 'Brands I’d buy: Copic'],
  ]) {
    const { page, errors } = await openApp({ width: 1180, height: 820, storage: onboarded({ [KEY]: appState(extra) }) });
    await scanOpen(page);
    assert.equal(await pressed(page), '', why);
    assert.match(await page.textContent('#scStat'), /Each marker read shows here/, why);
    assert.deepEqual(errors, []);
    await page.context().close();
  }
  // Brands I'd buy set to Ohuhu alone: as automatic
  const { page, errors } = await openApp({ width: 1180, height: 820, storage: onboarded({ [KEY]: appState({ buyBrands: ['Ohuhu'] }) }) });
  await scanOpen(page);
  assert.equal(await pressed(page), 'Ohuhu');
  assert.deepEqual(errors, []);
});

test('Scan: a question’s choices say which one is already yours', async () => {
  const { page, errors } = await openApp({ width: 820, height: 1180, storage: onboarded({ [KEY]: appState(), 'ms-scan-brand': '' }) });
  await scanOpen(page);
  // B04: Ohuhu's (yours) or Copic's
  await type(page, 'B04');
  const choices = await page.$$eval('#scList .scask .scchoose', (bs) => bs.map((b) => b.textContent));
  assert.equal(choices.length, 2);
  assert.match(choices.find((c) => /Ohuhu/.test(c)), /· Ohuhu · already yours$/);
  assert.doesNotMatch(choices.find((c) => /Copic/.test(c)), /already yours/);
  assert.deepEqual(errors, []);
});

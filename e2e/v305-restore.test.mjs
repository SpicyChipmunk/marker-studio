// v305: Restore › Keep mine keeps your markers but no longer drops the backup's To buy list, ink marks and Brands I'd
// buy: they merge in for your markers (yours win on a clash) and every message says what came in.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, openApp, idle, answerAsks, openBackupDialog } from './helpers.mjs';

before(setup);
after(teardown);

const KEY = 'ohuhu-hb320-picker-v3';
const onboarded = (extra = {}) => ({ 'ms-onboarded': '1', 'ms-setup-tip': '1', 'ms-last-ver': 'v305', ...extra });
const OWN = ['Ohuhu|R014', 'Ohuhu|Y111', 'Ohuhu|B08', 'Ohuhu|G36', 'Ohuhu|BV310', 'Ohuhu|YR313', 'Ohuhu|RV08', 'Ohuhu|BG311'];
const appState = (extra = {}) => JSON.stringify({ mode: 'home', ownedSeedV: 2, copicAdd1: 1, libAdj1: 1, setFix1: 1, owned: OWN, saved: [], ...extra });
const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
const guide = (id, name) => ({ id, name, W: 1, H: 1, keys: ['Ohuhu|R014'], n: 1, ts: Date.now() - 864e5, payload: { lmap: PNG, assign: { 0: 'Ohuhu|R014' } } });
const BACKUP = (extra = {}) => ({
  v: 3,
  type: 'ms-backup',
  ts: Date.now() - 864e5,
  owned: ['Ohuhu|R014', 'Ohuhu|B08', 'Copic|E09'],
  saved: [],
  guides: [],
  wish: [{ k: 'Ohuhu|G43', why: 'x', ts: 1 }, { k: 'Copic|B000', why: 'dup', ts: 2 }, { k: 'Ohuhu|R014', why: 'owned here', ts: 3 }, { k: 'Ohuhu|Y111', why: 'low', ts: 4 }],
  ink: { 'Ohuhu|B08': 'low', 'Copic|E09': 'dry', 'Ohuhu|Y111': 'low' },
  buyBrands: ['Ohuhu'],
  ...extra,
});
const file = (o) => ({ name: 'b.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(o)) });
const toastText = (page) => page.evaluate(() => { const t = document.getElementById('msToast'); return t && t.classList.contains('on') ? t.textContent : ''; });
const mine = { wish: [{ k: 'Copic|B000', why: 'mine', ts: 1 }], ink: { 'Ohuhu|B08': 'dry' } };

test('restore › Keep mine merges the backup’s To buy, ink and Brands I’d buy into yours, and says so', async () => {
  const { page, errors } = await openApp({ width: 820, height: 1180, storage: onboarded({ [KEY]: appState(mine) }) });
  await answerAsks(page, false);
  await page.click('#mHome'); await page.click('#homeLibCard'); await page.waitForSelector('#savedOverlay.on');
  await page.setInputFiles('#guidesFile', file(BACKUP())); await idle(page);
  const s = await page.evaluate(() => ({ wish: state.wish.map((w) => w.k), ink: state.ink, buy: state.buyBrands, n: state.owned.size }));
  assert.equal(s.n, 8, 'your markers kept');
  assert.deepEqual(s.wish, ['Copic|B000', 'Ohuhu|G43', 'Ohuhu|Y111'], 'once each; R014 is yours (no ink mark) so it stays off; Y111 is now marked low');
  assert.deepEqual(s.ink, { 'Ohuhu|B08': 'dry', 'Ohuhu|Y111': 'low' }, 'yours wins; none for E09 (not yours)');
  assert.deepEqual(s.buy, ['Ohuhu'], 'Brands I’d buy from the backup: yours was automatic');
  assert.equal(await toastText(page), 'Kept your markers; added 2 to buy and 1 Running low note. Brands I’d buy set from the backup.');
  await page.reload(); await idle(page);
  assert.deepEqual(await page.evaluate(() => ({ wish: state.wish.map((w) => w.k), ink: state.ink, buy: state.buyBrands })), { wish: s.wish, ink: s.ink, buy: s.buy }, 'saved');
  // the To buy view shows them
  await page.click('#mCollection'); await page.click('#ownView [data-v="wish"]'); await idle(page);
  assert.equal(await page.locator('#wishView .wrow').count(), 3);
  assert.match(await page.textContent('#wishView .wrow[data-k="Ohuhu|Y111"] .wwhy'), /^low/);
  assert.deepEqual(errors, []);
});

test('restore › Keep mine with guides: the Back up & restore dialog and Welcome/Home’s words count what came in', async () => {
  const { page, errors } = await openApp({ width: 1180, height: 820, storage: onboarded({ [KEY]: appState({ buyBrands: ['Copic'] }) }) });
  await answerAsks(page, false);
  await openBackupDialog(page);
  await page.setInputFiles('#backupFile', file(BACKUP({ guides: [guide(21, 'Owl')] }))); await idle(page);
  await page.waitForFunction(() => /guide/.test(document.getElementById('backupCap').textContent), null, { timeout: 10000 });
  assert.equal(await page.textContent('#backupCap'), 'Added 3 to buy and 2 Running low notes; 1 guide restored.');
  assert.deepEqual(await page.evaluate(() => state.buyBrands), ['Copic'], 'yours chosen: kept');
  // Welcome and Home's note (restoreAny's callback): a backup with only To buy entries isn't called empty
  const r = await page.evaluate(
    (o) => new Promise((res) => restoreAny(new File([JSON.stringify(o)], 'b.json'), 'nope', (r) => res(r && { list: restoredList(r), wish: r.wish }))),
    BACKUP({ wish: [{ k: 'Ohuhu|R16', why: 'x', ts: 1 }, { k: 'Ohuhu|R28', why: 'x', ts: 1 }], ink: {} }),
  );
  assert.deepEqual(r, { list: '2 markers to buy', wish: 2 });
  assert.deepEqual(errors, []);
});
